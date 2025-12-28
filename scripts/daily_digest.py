import os
import json
import boto3
import requests
import time
import re
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
    # 不要带 .json 后缀，库会自动处理路径
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

# 【性能配置】
CTX_SIZE = 12288 

# 本地文件路径
LOCAL_SAVE_DIR = os.path.join(SCRIPT_DIR, "local_summaries")

# --- 2. 工具函数 ---

def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

def get_target_date_str():
    # 默认处理昨天 (强制使用 JST 时间)
    # GitHub Actions 默认为 UTC，需 +9 小时转换为 JST
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
            summary = data.get('summary', '')[:800] 
            summary_clean = re.sub(r'<[^>]+>', '', summary)
            vibe = data.get('editorial_vibe', '未知')
            return f"昨日风向：{vibe}\n昨日重点：{summary_clean}"
        return "昨日无特定记录，视为新起点。"
    except Exception:
        return ""

def download_json_from_r2(client, date_str):
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
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
        if match:
            clean_text = match.group(1)
        else:
            match = re.search(r'\{[\s\S]*\}', text)
            clean_text = match.group(0) if match else text
        
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
    # 修复 Qwen 返回 List[Dict] 导致的格式残留 ({'event': '...', 'description': '...'})
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
    import subprocess
    import json
    
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
            "temperature": 0.1, 
            "num_ctx": CTX_SIZE,
            "num_predict": -1
        }
    }
    if format_json:
        payload["format"] = "json"

    # 构建 curl 命令参数 - 模仿本地 100% 成功的极简格式
    # 不加 Content-Type 和 User-Agent，因为本地测试时没加也通了
    curl_cmd = [
        "curl", "-s", "-L", "-X", "POST", api_url,
        "-H", f"CF-Access-Client-Id: {CF_ACCESS_CLIENT_ID.strip()}",
        "-H", f"CF-Access-Client-Secret: {CF_ACCESS_CLIENT_SECRET.strip()}",
        "-d", json.dumps(payload)
    ]
    
    print(f"[-] [Auth] Replicating local curl format (ID: {CF_ACCESS_CLIENT_ID[:4]}***)")

    # 执行命令
    try:
        # 增加 -w 打印状态码，增加 -L 跟随重定向
        curl_cmd_ext = curl_cmd.copy()
        curl_cmd_ext.insert(1, "-L") # 跟随重定向
        
        result = subprocess.run(curl_cmd_ext, capture_output=True, text=True, encoding='utf-8', timeout=180)
        
        if result.returncode != 0:
            print(f"[!!!] Curl 传输层失败: {result.stderr}")
            return None
            
        output = result.stdout.strip()
        if not output:
            print(f"[!!!] API 返回内容为空 (可能被拦截或解析失败)")
            return None

        try:
            res_json = json.loads(output)
            if 'error' in res_json:
                print(f"\n[!!!] 模型报错: {res_json['error']}")
                return None
            return res_json.get('response')
        except json.JSONDecodeError:
            print(f"\n[!!!] 无法解析 API 返回的 JSON (可能是 HTML 错误页)")
            print(f"[-] 返回内容前150位: {output[:150]}...")
            return None
        
    except Exception as e:
        print(f"\n[!!!] Curl 调用异常: {e}\n")
        return None

def unload_model():
    """强制卸载模型以释放显存 (同样改用 curl)"""
    import subprocess
    import json
    print("[-] 正在请求卸载模型释放显存...")
    
    api_url = OLLAMA_API_URL.strip()
    if not api_url.endswith('/api/generate') and not api_url.endswith('/api/chat'):
        api_url = api_url.rstrip('/') + '/api/generate'

    payload = {
        "model": OLLAMA_MODEL,
        "keep_alive": 0
    }
    
    curl_cmd = [
        "curl", "-s", "-X", "POST", api_url,
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload)
    ]
    
    if CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET:
        curl_cmd.extend([
            "-H", f"CF-Access-Client-Id: {CF_ACCESS_CLIENT_ID.strip()}",
            "-H", f"CF-Access-Client-Secret: {CF_ACCESS_CLIENT_SECRET.strip()}"
        ])
        
    try:
        subprocess.run(curl_cmd, timeout=10)
        print("[+] 已发送显存释放信号")
    except:
        pass

# --- 3. 核心业务逻辑 ---

def preprocess_data(news_data, limit=300):
    titles_for_ai = []
    lookup_dict = {}
    if isinstance(news_data, list):
        for idx, item in enumerate(news_data):
            title = (item.get('title_cn') or item.get('title') or "").strip()
            origin = item.get('origin', '未知媒体')
            if title:
                # 给每个标题加一个索引 ID，让 AI 返回这个 ID，避免标题匹配失败
                ref_id = f"REF_{idx}"
                full_title_str = f"[{ref_id}] {title} (来源: {origin})"
                titles_for_ai.append(full_title_str)
                lookup_dict[ref_id] = {
                    "original_title": title,
                    "link": item.get('link', ''),
                    "origin": origin,
                    "id": item.get('id', None)
                }
    print(f"[*] 数据加载完成: {len(titles_for_ai)} 条 (Limit: {limit})")
    return titles_for_ai[:limit], lookup_dict

def identify_hot_topics(titles):
    print(f"[-] [AI] 正在扫描全量标题...")
    titles_text = "\n".join([f"- {t}" for t in titles])
    
    system = "你是一名新闻主编。请识别 2-3 个核心议题关键词。只输出关键词，用中文逗号分隔。禁止输出任何其他语言。"
    prompt = f"新闻标题流：\n{titles_text}\n\n请输出3个核心关键词（中文）："

    res = call_ollama_safe(prompt, system)
    if not res: return []
    
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
        print(f"[!] 搜索引擎初始化失败: {e}")
        pass
    return "\n".join(context_results)

# 【核心更新】优化 Prompt：强制长文本定调
# 【核心更新】优化 Prompt：强制长文本定调
def generate_structured_summary(titles, web_context, prev_context_str, keywords, target_date_str):
    print(f"[-] [AI] 正在撰写结构化内参 (JSON Structure Mode)...")
    titles_text = "\n".join([f"- {t}" for t in titles])
    keywords_str = "、".join(keywords)
    
    system = (
        f"你是服务于决策层的《从日本看中国》情报分析师。日期：{target_date_str}。\n"
        "请基于新闻流，撰写一份结构化情报简报。\n\n"
        "【语言铁律】\n"
        "**严禁输出阿拉伯文、英文或其他外语。**\n"
        "**必须且只能使用简体中文 (Simplified Chinese)。**\n\n"
        "【写作要求 - 重点执行】\n"
        "1. **抹去具体媒体名**：在描述事件时，**严禁出现**如《读卖新闻》具体媒体名，请改用“日媒”或“日本舆论”代替。\n"
        "2. **拒绝列表式预测**：在`forecast`字段，**严禁**罗列新闻标题。必须写一段连贯的**推演性文字**。\n"
        "3. **态势定调要详细**：在`stance`字段，**严禁**只写“摩擦升级”这种短语！必须写一段 **50-100字** 的完整描述，说明为什么摩擦升级。\n\n"
        "【输出格式】\n"
        "返回合法 JSON，**强制**包含以下三个 Key（不要改名）：\n"
        "1. `stance`: **态势定调**。（注意：必须是完整的描述性段落，不能少于50字）\n"
        "2. `events`: **关键事件解析**。（深度阐述1-2件大事，不要出现媒体名）\n"
        "3. `forecast`: **风向预测**。（一段连贯的未来局势推演，不要写成清单）"
    )

    prompt = (
        f"【昨日基准】\n{prev_context_str}\n\n"
        f"【今日数据源】（核心词：{keywords_str}）\n{titles_text}\n\n"
        f"【情报细节】\n{web_context}\n\n"
        "请务必输出 JSON，包含 stance, events, forecast 三个字段："
    )

    res_json_str = call_ollama_safe(prompt, system, format_json=True)
    obj = extract_json_from_text(res_json_str)
    
    # 鲁棒性处理：兼容多种可能的 Key 名 (大小写不敏感)
    if obj:
        normalized = {}
        
        def get_fuzzy(target_keys):
            # 1. 精确匹配
            for k in target_keys:
                if obj.get(k): return obj[k]
            # 2. 大小写不敏感匹配
            for k in target_keys:
                for obj_k in obj.keys():
                    if obj_k.lower() == k.lower() and obj[obj_k]:
                        return obj[obj_k]
            return None

        # 态势定调
        normalized['stance'] = get_fuzzy([
            'stance', 'situation', '态势定调', 'trend', 'overview', 'summary', 
            'stance_sc', 'section_stance'
        ])
        # 关键事件 (扩充 fuzzy list 以修复暂无事件解析问题)
        normalized['events'] = get_fuzzy([
            'events', 'event', 'key_events', '关键事件', 'highlights', 'impact', 
            'news', 'main_events', 'major_events', 'critical_events', 'event_analysis',
            'events_sc', 'section_events', 'analysis'
        ])
        # 风向预测
        normalized['forecast'] = get_fuzzy([
            'forecast', 'prediction', '风向预测', 'outlook', 'future', 
            'forecast_sc', 'section_forecast', 'prospect'
        ])
        
        # Debug Log: 如果还是没提取到，打印原始 keys 以便调试
        if not normalized['events']:
            print(f"[!] Warning: Failed to extract 'events'. Raw keys: {list(obj.keys())}")
            print(f"[!] Raw excerpt: {str(obj)[:200]}")

        return normalized
    return None

# 【核心更新】强制凑数逻辑：务必凑够 5 条
def select_highlights_json(titles):
    print(f"[-] [AI] 正在筛选关键信号 (JSON Mode)...")
    titles_text = "\n".join([f"- {t}" for t in titles])
    
    system = (
        "你是一个政治编辑。请从提供的列表中筛选 **5 条** 最关键的新闻。\n"
        "【数量铁律】\n"
        "**必须严格输出 5 条新闻，一条都不能少！**\n"
        "【语言要求】\n"
        "**必须使用简体中文输出。**\n"
        "【输出格式 JSON】\n"
        "{\n"
        "  \"highlights\": [\n"
        "    {\n"
        "      \"ref_id\": \"(标题前的 REF_XX)\",\n"
        "      \"comment\": \"(一句话犀利点评)\"\n"
        "    }\n"
        "  ],\n"
        "  \"editorial_vibe\": \"(2-4个字，如：胶着、缓和)\"\n"
        "}"
    )
    
    prompt = f"新闻列表（带 ID）：\n{titles_text}\n\n请生成 JSON（简体中文，使用 ref_id，强制输出5条）："
    return call_ollama_safe(prompt, system, format_json=True)

def construct_final_data(summary_obj, highlights_json, lookup_dict, total_count, target_date_str, keywords):
    print(f"[-] [Data] 正在组装数据...")
    date_obj = datetime.strptime(target_date_str, '%Y-%m-%d')
    
    # 增强版字段清洗工具
    def smart_sanitize(value, default_val):
        if not value: return default_val
        
        # 1. 如果是字符串，直接返回
        if isinstance(value, str):
            return value
            
        # 2. 如果是列表，尝试智能合并
        if isinstance(value, list):
            # 检查是否是 list of dicts (Qwen 常见错误格式)
            if len(value) > 0 and isinstance(value[0], dict):
                lines = []
                for item in value:
                    # 尝试提取 value 里的常见内容字段
                    content = item.get('description') or item.get('event') or item.get('content') or item.get('summary') or str(item)
                    lines.append(content)
                return "\n".join(lines)
            else:
                # 普通列表 (list of strings)
                return "\n".join(str(v) for v in value)
                
        return str(value)

    # 1. 处理结构化摘要
    stance_sc = "暂无定调"
    events_sc = "暂无事件解析"
    forecast_sc = "暂无预测"

    if summary_obj and isinstance(summary_obj, dict):
        stance_sc = smart_sanitize(summary_obj.get('stance'), stance_sc)
        events_sc = smart_sanitize(summary_obj.get('events'), events_sc)
        forecast_sc = smart_sanitize(summary_obj.get('forecast'), forecast_sc)
    
    # 清洗 + 去除残留媒体名
    stance_sc = clean_unwanted_dividers(stance_sc)
    events_sc = clean_unwanted_dividers(events_sc)
    forecast_sc = clean_unwanted_dividers(forecast_sc)

    # 标题去括号
    combined_summary_sc = (
        f"<b>态势定调</b>\n{stance_sc}\n\n"
        f"<b>关键事件</b>\n{events_sc}\n\n"
        f"<b>风向预测</b>\n{forecast_sc}"
    )
    
    # 生成繁体版
    stance_tc = to_tc(stance_sc)
    events_tc = to_tc(events_sc)
    forecast_tc = to_tc(forecast_sc)
    combined_summary_tc = to_tc(combined_summary_sc)

    # 格式化 HTML
    stance_sc = format_markdown_bold_to_html(stance_sc)
    events_sc = format_markdown_bold_to_html(events_sc)
    forecast_sc = format_markdown_bold_to_html(forecast_sc)
    combined_summary_sc = format_markdown_bold_to_html(combined_summary_sc)

    stance_tc = format_markdown_bold_to_html(stance_tc)
    events_tc = format_markdown_bold_to_html(events_tc)
    forecast_tc = format_markdown_bold_to_html(forecast_tc)
    combined_summary_tc = format_markdown_bold_to_html(combined_summary_tc)

    # 2. 高亮新闻处理
    highlights_obj = extract_json_from_text(highlights_json)
    final_highlights = []
    
    editorial_vibe_sc = "复杂博弈"
    
    if highlights_obj:
        vibe_val = highlights_obj.get("editorial_vibe") or highlights_obj.get("vibe")
        editorial_vibe_sc = smart_sanitize(vibe_val, "复杂博弈")
        raw_list = highlights_obj.get("highlights", [])
        
        for item in raw_list:
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
            else:
                # 兼容性匹配（由于标题可能被 AI 部分改写）
                t = item.get("title", "")
                if t:
                    for rid, rinfo in lookup_dict.items():
                        if t in rinfo['original_title'] or rinfo['original_title'] in t:
                            final_highlights.append({
                                "title": rinfo['original_title'],
                                "title_tc": to_tc(rinfo['original_title']),
                                "link": rinfo['link'],
                                "origin": rinfo['origin'],
                                "id": rinfo['id'],
                                "analysis": smart_sanitize(comment_sc, ""),
                                "analysis_tc": to_tc(smart_sanitize(comment_sc, ""))
                            })
                            break

    editorial_vibe_tc = to_tc(editorial_vibe_sc)
    title_sc = f"{date_obj.year}年{date_obj.month}月{date_obj.day}日 态势简报"
    title_tc = to_tc(title_sc)

    return {
        "title": title_sc,
        "title_tc": title_tc,
        
        "summary": combined_summary_sc,
        "summary_tc": combined_summary_tc,
        
        "section_stance": stance_sc,        
        "section_stance_tc": stance_tc,     
        
        "section_events": events_sc,        
        "section_events_tc": events_tc,     
        
        "section_forecast": forecast_sc,    
        "section_forecast_tc": forecast_tc, 
        
        "key_highlights": final_highlights,
        "editorial_vibe": editorial_vibe_sc,
        "editorial_vibe_tc": editorial_vibe_tc,
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "id": f"{date_obj.strftime('%Y%m%d')}_DAILY",
        "type": "DAILY",
        "generated_at": datetime.now().isoformat(),
        "news_count": total_count,
        "keywords": keywords # 保留关键词供调试
    }

def save_local_txt(final_data, date_str):
    if not os.path.exists(LOCAL_SAVE_DIR): os.makedirs(LOCAL_SAVE_DIR)
    
    txt_path = os.path.join(LOCAL_SAVE_DIR, f"{date_str}_report.txt")
    s_stance = final_data.get('section_stance', '').replace('<b>', '').replace('</b>', '')
    s_events = final_data.get('section_events', '').replace('<b>', '').replace('</b>', '')
    s_forecast = final_data.get('section_forecast', '').replace('<b>', '').replace('</b>', '')
    
    txt_content = f"""=== {final_data['title']} ===
风向: {final_data['editorial_vibe']}
时间: {final_data['timestamp']}

态势定调
{s_stance}

关键事件
{s_events}

风向预测
{s_forecast}

关键信号
"""
    for item in final_data['key_highlights']:
        txt_content += f"• {item['title']}\n  [评] {item['analysis']}\n  [源] {item['origin']}\n"
    
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(txt_content)
    print(f"[+] 本地文本已保存: {txt_path}")

# --- 4. 主程序 ---

def main():
    target_date = get_target_date_str()
    print(f"=== 启动智能主编系统 (Fix Stance & Count): {target_date} ===")
    
    s3_client = get_r2_client()
    
    # --- 幂等性检查 (Idempotency Check) ---
    check_key = f"{R2_TARGET_PREFIX}{target_date}_summary.json"
    try:
        # 尝试检查文件是否存在
        s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=check_key)
        print(f"[!] Skip: 目标文件已存在 ({check_key})，今日日报已生成。")
        return
    except ClientError as e:
        # 404 Not Found 代表未生成，可以继续
        error_code = int(e.response['Error']['Code'])
        if error_code != 404:
            print(f"[!] 检查文件状态时发生未知错误: {e}")
            return
            
    raw_data = download_json_from_r2(s3_client, target_date)
    if not raw_data: return

    titles_for_ai, lookup_dict = preprocess_data(raw_data, limit=300)
    if not titles_for_ai: return

    # 加载历史上下文
    prev_context_str = load_previous_context(target_date)

    keywords = identify_hot_topics(titles_for_ai)
    if not keywords: return

    web_context = search_web_for_context(keywords, target_date)

    summary_obj = generate_structured_summary(titles_for_ai, web_context, prev_context_str, keywords, target_date)
    
    highlights_json = select_highlights_json(titles_for_ai)
    
    # 组装数据
    final_data = construct_final_data(summary_obj, highlights_json or "{}", lookup_dict, len(lookup_dict), target_date, keywords)
    
    print("\n--- 摘要预览 (态势) ---")
    print(final_data.get('section_stance', '')[:100] + "...")
    print("----------------\n")
    
    save_local_txt(final_data, target_date)
    
    json_output_str = json.dumps(final_data, ensure_ascii=False, indent=2)

    local_json_path = os.path.join(LOCAL_SAVE_DIR, f"{target_date}_summary.json")
    with open(local_json_path, 'w', encoding='utf-8') as f:
        f.write(json_output_str)
    print(f"[+] 本地 JSON 已保存: {local_json_path}")
    
    upload_json_to_r2(s3_client, json_output_str, f"{R2_TARGET_PREFIX}{target_date}_summary.json")
    upload_json_to_r2(s3_client, json_output_str, f"{R2_TARGET_PREFIX}latest.json")

    # 释放显存
    time.sleep(60) # 等待1分钟
    unload_model()

    print("\n[√] 任务完成！")

if __name__ == "__main__":
    main()
