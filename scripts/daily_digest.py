import os
import json
import boto3
import requests
import time
import re
import subprocess
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from botocore.exceptions import ClientError

# 兼容搜索库
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

# --- [OpenCC 繁体支持] ---
try:
    import opencc
    # 针对 opencc-python-reimplemented 库的正确初始化方式
    cc_converter = opencc.OpenCC('s2twp') 
except ImportError:
    cc_converter = None
    print("[!] 未检测到 opencc，将无法生成繁体字段。")

# --- 1. 基础配置 ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, '.env'))
# Load .env.local from project root
project_root = os.path.dirname(SCRIPT_DIR)
load_dotenv(os.path.join(project_root, '.env.local'))

# R2 配置
R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME')
R2_SOURCE_PREFIX = os.getenv('R2_SOURCE_PREFIX', 'archive/')
R2_TARGET_PREFIX = os.getenv('R2_TARGET_PREFIX', 'ollama/')

# Google Gemini Configuration
try:
    import google.generativeai as genai
    GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') or "AIzaSyAccHxx9xdNR8ZW6ux92XffIeF65UTzlx8"
    genai.configure(api_key=GOOGLE_API_KEY)
except ImportError:
    genai = None
    print("[!] Google Generative AI SDK not found. Install with `pip install google-generativeai`")

# 降低单次处理新闻条数上限，从 120 降至 100，进一步防止 TPM 超限
MAX_NEWS_ITEMS = 100 

# 反爬虫伪装 UA 池
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
] 

# 本地文件路径
LOCAL_SAVE_DIR = os.path.join(SCRIPT_DIR, "local_summaries")

# 读取世界基准文案 (Source of Truth)
WORLD_BASELINE = ""
try:
    baseline_path = os.path.join(project_root, "src", "lib", "world-baseline.ts")
    if os.path.exists(baseline_path):
        with open(baseline_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # 简单的提取逻辑：提取 export const WORLD_BASELINE = `...`; 中间反引号的内容
            import re
            match = re.search(r'export const WORLD_BASELINE = `(.*?)`;', content, re.DOTALL)
            if match:
                WORLD_BASELINE = match.group(1).strip()
                print("[-] [System] 已加载本地基准文案 (Local Fallback)")
            else:
                print("[!] 无法从 ts 文件解析世界基准文案")
    else:
        print(f"[!] 未找到基准文件: {baseline_path}")
except Exception as e:
    print(f"[!] 读取基准文件失败: {e}")

# 尝试从 R2 加载最新基准 (Override Local)
try:
    # 假设 R2 公开 URL 由环境变量提供，或者硬编码（因为 daily_digest.py 也是通过 Action 运行，有 Secrets）
    # 但 Python 脚本可能没有 NEXT_PUBLIC_R2_URL 环境变量，通常只有 R2 Credentials。
    # 这里我们直接用 boto3 去 fetch，因为我们有权限。
    def fetch_r2_baseline():
        global WORLD_BASELINE
        # 使用这里定义的 get_r2_client 稍后会定义，或者直接在这里极其简化的手动构造请求？
        # 不，还是复用 boto3 更稳。
        # 由于 get_r2_client 在下面定义，我们先稍后调用。
        pass
except Exception:
    pass



# --- 2. 工具函数 ---

def get_r2_client():
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("[!] R2 凭据不完整，跳过 R2 操作。")
        return None
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

def get_target_date_str():
    # 默认处理昨天 (强制使用 JST 时间)
    jst = timezone(timedelta(hours=9))
    target_date = datetime.now(jst) - timedelta(days=1)
    return target_date.strftime('%Y-%m-%d')

def load_previous_context(current_date_str):
    try:
        curr_date = datetime.strptime(current_date_str, '%Y-%m-%d')
        prev_date = curr_date - timedelta(days=1)
        prev_date_str = prev_date.strftime('%Y-%m-%d')
        filename = f"{prev_date_str}_summary.json"
        file_path = os.path.join(LOCAL_SAVE_DIR, filename)
        
        if os.path.exists(file_path):
            print(f"[-] [Memory] 加载昨日记忆: {filename}")
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            # 提取 stance 或 summary 作为记忆
            summary = data.get('section_stance') or data.get('summary', '')
            summary_clean = re.sub(r'<[^>]+>', '', summary)[:800]
            vibe = data.get('editorial_vibe', '未知')
            return f"昨日风向：{vibe}\n昨日重点：{summary_clean}"
        return "昨日无特定记录，视为新起点。"
    except Exception:
        return ""

def download_json_from_r2(client, date_str):
    if not client: return None
    key_name = f"{R2_SOURCE_PREFIX}{date_str}.json"
    print(f"[-] 正在从 R2 下载数据: {key_name}")
    try:
        response = client.get_object(Bucket=R2_BUCKET_NAME, Key=key_name)
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except ClientError as e:
        print(f"[!] R2 下载失败: {e}")
        return None

def upload_json_to_r2(client, json_str, key_name):
    if not client: return
    print(f"[-] 正在上传到 R2: {key_name} ...")
    try:
        client.put_object(
            Bucket=R2_BUCKET_NAME, 
            Key=key_name, 
            Body=json_str.encode('utf-8'), 
            ContentType='application/json'
        )
        print(f"[+] 上传成功: {key_name}")
    except Exception as e:
        print(f"[!] 上传失败: {e}")

def extract_json_from_text(text):
    if not text: return None
    try:
        # 去除 <think> 标签内容
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        # 尝试匹配 ```json ... ```
        match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
        if match:
            clean_text = match.group(1)
        else:
            # 尝试直接匹配第一个 { 到最后一个 }
            match = re.search(r'\{[\s\S]*\}', text)
            clean_text = match.group(0) if match else text
        
        # 修复常见 JSON 错误：尾随逗号
        clean_text = re.sub(r',\s*([\]}])', r'\1', clean_text)
        return json.loads(clean_text)
    except:
        return None

def format_markdown_bold_to_html(text):
    if not text: return ""
    text = str(text)
    return re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)

def clean_unwanted_dividers(text):
    if not text: return ""
    text = str(text) 
    # 修复 Qwen 返回 List[Dict] 导致的格式残留
    text = re.sub(r"\{'event':\s*['\"](.*?)['\"],\s*'description':\s*['\"](.*?)['\"]\}", r"\1\n\2", text)
    
    text = re.sub(r'\n\s*[-*]{3,}\s*\n', '\n\n', text)
    text = re.sub(r'^\s*[-*]{3,}\s*\n', '', text)
    text = re.sub(r'\n\s*[-*]{3,}\s*$', '', text)
    text = re.sub(r'[（\(]《.*?》[）\)]', '', text)
    return text

def to_tc(text):
    if not text: return ""
    text = str(text)
    if cc_converter:
        return cc_converter.convert(text)
    return text 

def call_ai_model(prompt, system, format_json=False):
    if not genai:
        print("[!] Google Generative AI SDK not initialized.")
        return None
        
    print("[-] [AI] Calling Google Gemma 3 (27b-it)...")
    try:
        # Merge system prompt into user prompt as system_instruction might not be supported
        # [注入世界基准]
        final_system = system
        if WORLD_BASELINE:
             final_system = f"{system}\n\n【世界基准 (World Baseline)】\n{WORLD_BASELINE}\n\n请基于上述基准进行分析，除非新闻原文明确提及了相反的最新事实。"
        
        full_prompt = f"{final_system}\n\n{prompt}" if final_system else prompt
        
        model = genai.GenerativeModel(
            model_name="gemma-3-27b-it",
            generation_config={
                "temperature": 0.6
                # "response_mime_type": "application/json" # Not supported by gemma-3-27b-it
            }
        )
        response = model.generate_content(full_prompt)
        text = response.text
        if format_json:
             # Clean up markdown code blocks if present
            text = re.sub(r'```json\s*|\s*```', '', text)
        return text
    except Exception as e:
        print(f"[!] Gemini Error: {e}")
        return None

# --- 3. 核心业务逻辑 ---

def preprocess_data(news_data, limit=MAX_NEWS_ITEMS):
    titles_for_ai = []
    lookup_dict = {}
    if isinstance(news_data, list):
        # 按照时间戳倒序排列，优先处理最新新闻
        news_sorted = sorted(news_data, key=lambda x: x.get('timestamp', 0), reverse=True)
        for idx, item in enumerate(news_sorted):
            title = (item.get('title_cn') or item.get('title') or "").strip()
            origin = item.get('origin', '未知媒体')
            link = item.get('link', '')

            # [Filter] 屏蔽 TVer (电视剧非新闻)
            if "TVer" in origin or "TVer" in title or "TVer" in link:
                print(f"[-] [Filter] Skipping TVer content: {title[:20]}...")
                continue

            if title:
                ref_id = f"REF_{idx}"
                full_title_str = f"[{ref_id}] {title} (来源: {origin})"
                titles_for_ai.append(full_title_str)
                lookup_dict[ref_id] = {
                    "original_title": title,
                    "link": item.get('link', ''),
                    "origin": origin,
                    "id": item.get('id', None)
                }
    actual_limit = min(len(titles_for_ai), limit)
    print(f"[*] 数据加载完成: 共 {len(titles_for_ai)} 条 -> AI处理前 {actual_limit} 条")
    return titles_for_ai[:actual_limit], lookup_dict

def identify_hot_topics(titles):
    print(f"[-] [AI] 正在扫描全量标题以识别核心议题 (Hot & Rising)...")
    # 抽取更多标题用于关键词识别，确保覆盖面
    sample_titles = titles[:150] 
    titles_text = "\n".join([f"- {t}" for t in sample_titles])
    
    system = (
        "你是一名新闻主编。请从标题列表中分析出：\n"
        "1. **Hot (热门搜索)**: 3 个最核心、最宏观的议题关键词（如：中日关系、地区局势）。\n"
        "2. **Rising (上升热词)**: 15 个具体的人名、地名、事件名或专有名词（如：石破茂、半导体、核废水）。\n"
        "请返回 JSON 格式：{\"hot\": [\"词1\", \"词2\", \"词3\"], \"rising\": [\"词1\", ... \"词15\"]}"
    )
    prompt = f"新闻标题流：\n{titles_text}\n\n请输出 JSON 关键词数据："

    res = call_ai_model(prompt, system, format_json=True)
    
    try:
        data = extract_json_from_text(res)
        if data and isinstance(data, dict):
            hot = data.get('hot', [])[:3]
            rising = data.get('rising', [])[:15]
            if hot or rising:
                return {"hot": hot, "rising": rising}
    except Exception as e:
        print(f"[!] 关键词解析失败: {e}")

    # Fallback
    return {"hot": ["中日关系", "地区局势", "经贸合作"], "rising": ["东京", "汇率", "签证", "旅游", "企业"]}

def search_web_for_context(keywords, target_date_str):
    # keywords 现在是 dict，只搜索 hot 关键词以节省时间
    hot_keywords = keywords.get('hot', []) if isinstance(keywords, dict) else keywords
    if not hot_keywords: return ""
    
    print(f"[-] [Network] 正在回溯情报 ({target_date_str}): {hot_keywords} ...")
    context_results = []
    
    for query in hot_keywords:
        historical_query = f"{query} {target_date_str}"
        max_retries = 3
        success = False
        
        for attempt in range(max_retries):
            try:
                # 随机选择 User-Agent
                headers = {"User-Agent": random.choice(USER_AGENTS)}
                
                with DDGS(headers=headers) as ddgs:
                    # 获取结果，加上异常处理
                    results = list(ddgs.text(historical_query, max_results=2))
                    
                    if results:
                        for res in results:
                            # 兼容不同版本的字段
                            body = res.get('body') or res.get('snippet') or ""
                            context_results.append(f"【情报-{query}】{body}")
                        success = True
                        break # 成功则退出重试循环
                    else:
                         # 没结果可能是真没结果，也可能是被ban，稍微等一下再试
                         if attempt < max_retries - 1:
                             time.sleep(1)
            except Exception as e:
                print(f"    [Retry] 关键词 '{query}' 第 {attempt+1} 次失败: {e}")
                
            # 指数退避: 1s, 2s, 4s... 加随机抖动
            if not success and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0.1, 1.0)
                time.sleep(wait_time)

        if not success:
            print(f"[!] 关键词 '{query}' 搜索均失败或无结果。")
            
        # 关键词之间必须有停顿
        time.sleep(random.uniform(1.5, 3.0))

    return "\n".join(context_results)

def generate_structured_summary(titles, web_context, prev_context_str, keywords, target_date_str):
    print(f"[-] [AI] 正在撰写结构化内参 (JSON Structure Mode)...")
    # 为了保证摘要质量，选取前 80 条最具代表性的新闻给模型
    core_titles = titles[:80]
    titles_text = "\n".join([f"- {t}" for t in core_titles])
    
    # 仅使用 hot 关键词作为 prompt 背景
    hot_keywords = keywords.get('hot', []) if isinstance(keywords, dict) else keywords
    keywords_str = "、".join(hot_keywords)
    
    system = (
        f"你是决策层的情报分析师。日期：{target_date_str}。\n"
        "请基于新闻流产出一份深度内参简报。所有输出必须使用简体中文。\n\n"
        "【写作指南】\n"
        "1. `stance`: **态势定调**。必须是一段 **80-150字** 的连贯描述，深度分析今日局势。严禁一句话带过！\n"
        "2. `events`: **关键事件**。详细阐述 1-2 条核心消息的影响。严禁媒体名。\n"
        "3. `forecast`: **风向预测**。基于今日动态，对未来 48 小时的局势推演。一段连贯文字。\n\n"
        "【输出格式】\n"
        "必须返回 JSON，包含 key: stance, events, forecast。"
    )

    prompt = (
        f"【前置背景】\n{prev_context_str}\n\n"
        f"【今日数据】（关键词：{keywords_str}）\n{titles_text}\n\n"
        "请生成 JSON 摘要："
    )

    res_json_str = call_ai_model(prompt, system, format_json=True)
    obj = extract_json_from_text(res_json_str)
    
    if obj:
        normalized = {}
        def get_fuzzy(target_keys):
            for k in target_keys:
                if obj.get(k): return obj[k]
                for obj_k in obj.keys():
                    if obj_k.lower() == k.lower() and obj[obj_k]: return obj[obj_k]
            return None

        normalized['stance'] = get_fuzzy(['stance', 'situation', '态势定调', 'overview'])
        normalized['events'] = get_fuzzy(['events', 'event', '关键事件', 'impact'])
        normalized['forecast'] = get_fuzzy(['forecast', 'prediction', '风向预测', 'outlook'])
        return normalized
    return None

def select_highlights_json(titles):
    print(f"[-] [AI] 正在从标题中筛选 Top 5 关键信号...")
    # 筛选时也稍微减少一些条数，避免模型压力过大导致 Ref ID 匹配错误
    selection_titles = titles[:100]
    titles_text = "\n".join([f"- {t}" for t in selection_titles])
    
    system = (
        "你是一个政治编辑。请从列表中筛选出 **5 条** 最关键的新闻，按重要程度排序。\n"
        "必须严格输出 5 条，使用简体中文。\n"
        "输出 JSON 格式：\n"
        "{\n"
        "  \"highlights\": [\n"
        "    {\"ref_id\": \"REF_XX\", \"comment\": \"犀利点评\"}\n"
        "  ],\n"
        "  \"editorial_vibe\": \"2-4个字定调昨日关系\"\n"
        "}"
    )
    
    prompt = f"新闻列表：\n{titles_text}\n\n请严格按格式输出 JSON (5条)："
    return call_ai_model(prompt, system, format_json=True)

def construct_final_data(summary_obj, highlights_json, lookup_dict, total_count, target_date_str, keywords):
    print(f"[-] [Data] 正在组装并清洗数据...")
    date_obj = datetime.strptime(target_date_str, '%Y-%m-%d')
    
    def smart_sanitize(value, default_val):
        if not value: return default_val
        if isinstance(value, str): return value
        if isinstance(value, list):
            if len(value) > 0 and isinstance(value[0], dict):
                lines = []
                for item in value:
                    content = item.get('description') or item.get('event') or item.get('content') or item.get('summary') or str(item)
                    lines.append(content)
                return "\n".join(lines)
            return "\n".join(str(v) for v in value)
        return str(value)

    stance_sc = smart_sanitize(summary_obj.get('stance') if summary_obj else None, "中日互动维持现有博弈格局。")
    events_sc = smart_sanitize(summary_obj.get('events') if summary_obj else None, "当日关键事件暂无显著质变分析。")
    forecast_sc = smart_sanitize(summary_obj.get('forecast') if summary_obj else None, "局势预计在震荡中维持现状。")
    
    stance_sc = clean_unwanted_dividers(stance_sc)
    events_sc = clean_unwanted_dividers(events_sc)
    forecast_sc = clean_unwanted_dividers(forecast_sc)

    combined_summary_sc = (
        f"<b>态势定调</b>\n{stance_sc}\n\n"
        f"<b>关键事件</b>\n{events_sc}\n\n"
        f"<b>风向预测</b>\n{forecast_sc}"
    )
    
    combined_summary_tc = to_tc(combined_summary_sc)
    
    stance_sc = format_markdown_bold_to_html(stance_sc)
    events_sc = format_markdown_bold_to_html(events_sc)
    forecast_sc = format_markdown_bold_to_html(forecast_sc)
    combined_summary_sc = format_markdown_bold_to_html(combined_summary_sc)

    highlights_obj = extract_json_from_text(highlights_json)
    final_highlights = []
    editorial_vibe_sc = "复杂博弈"
    
    if highlights_obj:
        vibe_val = highlights_obj.get("editorial_vibe") or highlights_obj.get("vibe") or "复杂博弈"
        editorial_vibe_sc = smart_sanitize(vibe_val, "复杂博弈")
        raw_list = highlights_obj.get("highlights", [])
        if isinstance(raw_list, list):
            for item in raw_list:
                if not isinstance(item, dict): continue
                ref_id = item.get("ref_id", "")
                comment_sc = item.get("comment", "")
                info = lookup_dict.get(ref_id)
                if info:
                    final_highlights.append({
                        "title": info['original_title'],
                        "title_tc": to_tc(info['original_title']),
                        "link": info['link'],
                        "origin": info['origin'],
                        "id": info['id'],
                        "analysis": smart_sanitize(comment_sc, ""),
                        "analysis_tc": to_tc(smart_sanitize(comment_sc, ""))
                    })

    return {
        "title": f"{date_obj.year}年{date_obj.month}月{date_obj.day}日 态势简报",
        "title_tc": to_tc(f"{date_obj.year}年{date_obj.month}月{date_obj.day}日 态势简报"),
        "summary": combined_summary_sc,
        "summary_tc": combined_summary_tc,
        "section_stance": stance_sc,        
        "section_stance_tc": to_tc(stance_sc),     
        "section_events": events_sc,        
        "section_events_tc": to_tc(events_sc),     
        "section_forecast": forecast_sc,    
        "section_forecast_tc": to_tc(forecast_sc), 
        "key_highlights": final_highlights,
        "editorial_vibe": editorial_vibe_sc,
        "editorial_vibe_tc": to_tc(editorial_vibe_sc),
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "id": f"{date_obj.strftime('%Y%m%d')}_DAILY",
        "type": "DAILY",
        "generated_at": datetime.now().isoformat(),
        "news_count": total_count,
        "keywords": keywords
    }

def main():
    target_date = get_target_date_str()
    print(f"=== 启动智能主编系统 (Enhanced Stability): {target_date} ===")

    # [新增] 尝试从 R2 下载最新的世界基准覆盖本地
    try:
        r2 = get_r2_client()
        if r2:
            print("[-] [Init] 检查云端世界基准 (config/world_baseline.json)...")
            bucket = os.getenv("R2_BUCKET_NAME", "cnjp-data")
            try:
                response = r2.get_object(Bucket=bucket, Key="config/world_baseline.json")
                body = response['Body'].read().decode('utf-8')
                data = json.loads(body)
                if data and data.get("content"):
                    global WORLD_BASELINE
                    WORLD_BASELINE = data.get("content")
                    print("[-] [Init] 成功加载云端动态基准！")
            except Exception as inner_e:
                print(f"[-] [Init] 云端未找到基准或读取失败: {inner_e}")
    except Exception as e:
        print(f"[-] [Init] 云端基准加载逻辑跳过: {e}")

    
    s3_client = get_r2_client()
    # 为调试/补发，如果不强制检查，可以注释掉下面这段
    check_key = f"{R2_TARGET_PREFIX}{target_date}_summary.json"
    # s3_client.head_object 调用有时可能受 CF 拦截，这里直接尝试下载或继续

    raw_data = download_json_from_r2(s3_client, target_date)
    if not raw_data: 
        print(f"[!] 未能从 R2 获取日期为 {target_date} 的新闻数据。")
        return

    titles_for_ai, lookup_dict = preprocess_data(raw_data, limit=MAX_NEWS_ITEMS)
    if not titles_for_ai: 
        print("[!] 数据预处理后为空，停止生成。")
        return

    prev_context_str = load_previous_context(target_date)
    keywords = identify_hot_topics(titles_for_ai)
    web_context = search_web_for_context(keywords, target_date)
    summary_obj = generate_structured_summary(titles_for_ai, web_context, prev_context_str, keywords, target_date)
    
    print("[-] [Rate Limit] 暂停 30 秒以释放 TPM 配额...")
    time.sleep(30)
    
    highlights_json = select_highlights_json(titles_for_ai)
    
    final_data = construct_final_data(
        summary_obj, highlights_json or "{}", 
        lookup_dict, len(raw_data), 
        target_date, keywords
    )
    
    json_output_str = json.dumps(final_data, ensure_ascii=False, indent=2)
    local_json_path = os.path.join(LOCAL_SAVE_DIR, f"{target_date}_summary.json")
    if not os.path.exists(LOCAL_SAVE_DIR): os.makedirs(LOCAL_SAVE_DIR)
    
    with open(local_json_path, 'w', encoding='utf-8') as f:
        f.write(json_output_str)
    
    upload_json_to_r2(s3_client, json_output_str, f"{R2_TARGET_PREFIX}{target_date}_summary.json")
    upload_json_to_r2(s3_client, json_output_str, f"{R2_TARGET_PREFIX}latest.json")

    time.sleep(10)
    # unload_model() # Removed
    print("\n[√] 日报任务处理完毕。")

if __name__ == "__main__":
    main()
