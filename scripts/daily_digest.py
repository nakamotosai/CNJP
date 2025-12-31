import os
import json
import boto3
import requests
import time
import re
import subprocess
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

# Ollama 配置
OLLAMA_API_URL = os.getenv('OLLAMA_API_URL', 'https://ollama.saaaai.com/api/generate')
OLLAMA_MODEL = "qwen3:8b"

# Cloudflare Access 配置
CF_ACCESS_CLIENT_ID = os.getenv('CF_ACCESS_CLIENT_ID')
CF_ACCESS_CLIENT_SECRET = os.getenv('CF_ACCESS_CLIENT_SECRET')

# 【性能配置】更严格的限制，避免 8B 模型过载
CTX_SIZE = 12288 
# 降低单次处理新闻条数上限，从 300 降至 120，确保模型即便在上下文压力下也能产出高质量摘要
MAX_NEWS_ITEMS = 120 

# 本地文件路径
LOCAL_SAVE_DIR = os.path.join(SCRIPT_DIR, "local_summaries")

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

def call_ollama_safe(prompt, system, format_json=False):
    # 自动更正 URL
    api_url = OLLAMA_API_URL.strip()
    if not api_url.endswith('/api/generate') and not api_url.endswith('/api/chat'):
        api_url = api_url.rstrip('/') + '/api/generate'

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": 0.2, # 稍微提高一点稳定性
            "num_ctx": CTX_SIZE,
            "num_predict": -1
        }
    }
    if format_json:
        payload["format"] = "json"

    # 使用 curl 调用，规避 requests 可能存在的证书或超时问题
    curl_cmd = [
        "curl", "-s", "-L", "-X", "POST", api_url,
        "-H", f"CF-Access-Client-Id: {CF_ACCESS_CLIENT_ID.strip()}",
        "-H", f"CF-Access-Client-Secret: {CF_ACCESS_CLIENT_SECRET.strip()}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload)
    ]
    
    try:
        result = subprocess.run(curl_cmd, capture_output=True, text=True, encoding='utf-8', timeout=180)
        if result.returncode != 0:
            print(f"[!!!] Curl 传输层失败: {result.stderr}")
            return None
            
        output = result.stdout.strip()
        if not output:
            print(f"[!!!] API 返回内容为空")
            return None

        try:
            res_json = json.loads(output)
            if 'error' in res_json:
                print(f"\n[!!!] 模型报错: {res_json['error']}")
                return None
            return res_json.get('response')
        except json.JSONDecodeError:
            print(f"\n[!!!] 无法解析 API 返回的 JSON")
            return None
    except Exception as e:
        print(f"\n[!!!] Curl 调用异常: {e}")
        return None

def unload_model():
    """强制卸载模型以释放显存"""
    api_url = OLLAMA_API_URL.strip()
    if not api_url.endswith('/api/generate') and not api_url.endswith('/api/chat'):
        api_url = api_url.rstrip('/') + '/api/generate'

    payload = {"model": OLLAMA_MODEL, "keep_alive": 0}
    curl_cmd = [
        "curl", "-s", "-L", "-X", "POST", api_url,
        "-H", "Content-Type: application/json",
        "-H", f"CF-Access-Client-Id: {CF_ACCESS_CLIENT_ID.strip()}",
        "-H", f"CF-Access-Client-Secret: {CF_ACCESS_CLIENT_SECRET.strip()}",
        "-d", json.dumps(payload)
    ]
    try:
        subprocess.run(curl_cmd, timeout=10)
    except:
        pass

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
    print(f"[-] [AI] 正在扫描全量标题以识别核心议题...")
    # 抽取部分标题用于关键词识别，避免列表太长造成幻觉
    sample_titles = titles[:40] 
    titles_text = "\n".join([f"- {t}" for t in sample_titles])
    
    system = "你是一名新闻主编。请从标题列表中识别 2-3 个核心议题关键词。只输出关键词，用中文逗号分隔。禁止输出任何其他文字。"
    prompt = f"新闻标题流：\n{titles_text}\n\n请输出3个核心关键词（中文）："

    res = call_ollama_safe(prompt, system)
    if not res: return ["中日关系", "地区局势"]
    
    cleaned = res.replace("，", ",").replace("、", ",").replace("\n", ",")
    return [k.strip() for k in cleaned.split(",") if k.strip()][:3]

def search_web_for_context(keywords, target_date_str):
    if not keywords: return ""
    print(f"[-] [Network] 正在回溯情报 ({target_date_str}): {keywords} ...")
    context_results = []
    try:
        with DDGS() as ddgs:
            for query in keywords:
                historical_query = f"{query} {target_date_str}"
                try:
                    results = list(ddgs.text(historical_query, max_results=2))
                    for res in results:
                        context_results.append(f"【情报-{query}】{res['body']}")
                except Exception as e:
                    print(f"[!] 关键词 '{query}' 搜索失败: {e}")
                time.sleep(1)
    except Exception as e:
        print(f"[!] 搜索引擎服务不可用: {e}")
    return "\n".join(context_results)

def generate_structured_summary(titles, web_context, prev_context_str, keywords, target_date_str):
    print(f"[-] [AI] 正在撰写结构化内参 (JSON Structure Mode)...")
    # 为了保证摘要质量，选取前 80 条最具代表性的新闻给模型
    core_titles = titles[:80]
    titles_text = "\n".join([f"- {t}" for t in core_titles])
    keywords_str = "、".join(keywords)
    
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

    res_json_str = call_ollama_safe(prompt, system, format_json=True)
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
    return call_ollama_safe(prompt, system, format_json=True)

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
    unload_model()
    print("\n[√] 日报任务处理完毕。")

if __name__ == "__main__":
    main()
