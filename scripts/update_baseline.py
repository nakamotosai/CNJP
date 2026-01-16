
import os
import json
import datetime
import google.generativeai as genai
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# 加载环境变量 (兼顾本地运行和 GitHub Actions)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(SCRIPT_DIR)
load_dotenv(os.path.join(project_root, '.env.local'))

# --- 配置 ---
# 从环境变量读取配置 (由 GitHub Action 注入)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "cnjp-data")
JST = datetime.timezone(datetime.timedelta(hours=9))

def get_r2_client():
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("[!] R2 凭证缺失")
        return None
    try:
        url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        client = boto3.client(
            's3',
            endpoint_url=url,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto" # Must be auto for R2
        )
        return client
    except Exception as e:
        print(f"[!] R2 连接失败: {e}")
        return None

def fetch_latest_intel():
    """使用 Gemini 2.5 Flash + Google Search 获取最新情报"""
    if not GOOGLE_API_KEY:
        print("[!] GOOGLE_API_KEY 缺失")
        return None

    print(f"[-] [AI] 正在调用 Gemini 2.5 Flash 进行全网搜索... (SDK Version: {genai.__version__})")
    genai.configure(api_key=GOOGLE_API_KEY)
    
    # 尝试使用字符串快捷方式 (适配较新 SDK)
    # 如果失败，再尝试字典列表
    try:
        model = genai.GenerativeModel('gemini-2.5-flash', tools='google_search_retrieval')
    except Exception as e:
        print(f"[!] 字符串工具定义失败: {e}，尝试字典定义...")
        tools = [{'google_search': {}}]
        model = genai.GenerativeModel('gemini-2.5-flash', tools=tools)

    # 1. 请求生成包含全量和精简版的 JSON
    prompt = """
    请通过 Google 搜索，核实截至今日（2026年）以下国家的 **现任最高领导人** 及 **双边关系现状**。
    目标国家：中国、日本、美国、韩国、俄罗斯。
    双边关系：中日关系、中美关系、日美关系。

    请返回一个 **纯 JSON** 对象（不要包含 Markdown 标记），包含两个字段：
    1. `content`: 全量 Markdown 版（详细）。
    2. `content_lite`: 精简 Markdown 版（仅包含人名清单和一句话关系，用于高频 API 调用）。

    【全量版 (content) 格式要求】:
    # World Baseline (YYYY.MM)
    ## 1. Leaders
    (表格形式)
    ## 2. Relations
    (详细描述)

    【精简版 (content_lite) 格式要求】:
    ## 关键领导人 (YYYY.MM)
    * **国家**: 姓名 (职务)
    ...
    ## 核心关系
    * **关系**: 四字定调 (一句话备注)
    ...
    """

    try:
        response = model.generate_content(prompt)
        text = response.text
        if not text:
            print("[!] AI 未返回内容")
            return None
        
        # 清理 JSON 格式
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        
        print(f"[-] [AI] 情报获取成功，全量长度: {len(data.get('content', ''))}, 精简长度: {len(data.get('content_lite', ''))}")
        return data
    except Exception as e:
        print(f"[!] AI 生成或解析失败: {e}")
        return None

def upload_to_r2(data_dict):
    client = get_r2_client()
    if not client:
        return False
    
    today_str = datetime.datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S")
    
    # data_dict 应该已经包含 content 和 content_lite
    payload = {
        "updated_at": today_str,
        "content": data_dict.get("content", ""),
        "content_lite": data_dict.get("content_lite", "")
    }
    
    json_bytes = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
    
    key = "config/world_baseline.json"
    
    try:
        print(f"[-] 正在上传至 R2: {key}")
        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=json_bytes,
            ContentType='application/json'
        )
        print("[-] 上传成功！")
        return True
    except Exception as e:
        print(f"[!] 上传失败: {e}")
        return False

def main():
    print("=== 开始自动更新世界基准 (Auto Baseline Updater) ===")
    
    data_dict = fetch_latest_intel()
    if not data_dict:
        print("[!] 无法获取最新基准，任务终止。")
        exit(1)
        
    print("\n--- 预览新基准 (Lite) ---\n")
    print(data_dict.get("content_lite", "")[:500])
    print("\n------------------\n")
    
    if upload_to_r2(data_dict):
        print("=== 更新完成 ===")
    else:
        print("[!] 更新失败")
        exit(1)

if __name__ == "__main__":
    main()
