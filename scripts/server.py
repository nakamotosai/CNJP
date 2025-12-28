import os
import hashlib
import asyncio
import logging
import sys
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import boto3
from botocore.config import Config
from ollama import Client
import trafilatura
from opencc import OpenCC
from googlenewsdecoder import gnewsdecoder
from logging.handlers import RotatingFileHandler

# ================= 配置 =================
# 获取脚本所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 日志文件路径
log_file = os.path.join(LOG_DIR, "analysis.log")

# 配置根日志器，以便捕获 uvicorn 和其他库的日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=5, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("news_analysis")

from dotenv import load_dotenv

# 加载环境变量
# 1. 加载 scripts/.env (Ollama Access Key)
load_dotenv(os.path.join(BASE_DIR, ".env"))
# 2. 加载 .env.local (R2 Credentials)
load_dotenv(os.path.join(os.path.dirname(BASE_DIR), ".env.local"))

# Debug Logging
logger.info(f"ENV_CHECK | OLLAMA_HOST: {os.getenv('OLLAMA_HOST')}")
logger.info(f"ENV_CHECK | R2_KEY: {'*' * 5 if os.getenv('R2_ACCESS_KEY_ID') else 'MISSING'}")
logger.info(f"ENV_CHECK | CF_CLIENT_ID: {'*' * 5 if os.getenv('CF_ACCESS_CLIENT_ID') else 'MISSING'}")

# 环境变量
OLLAMA_HOST = 'https://ollama.saaaai.com'
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME', 'cnjp-data')

# Cloudflare Access 密钥
OLLAMA_HEADERS = {
    'CF-Access-Client-Id': os.getenv('CF_ACCESS_CLIENT_ID'),
    'CF-Access-Client-Secret': os.getenv('CF_ACCESS_CLIENT_SECRET')
}

app = FastAPI(title="News AI Analysis Server")

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# R2 客户端配置
def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

# 并发控制：一次只允许一个请求使用 Ollama
ollama_lock = asyncio.Lock()
# 简单的全局队列计数
queue_count = 0
cc = OpenCC('s2twp')  # 简体转台湾繁体

async def increment_queue():
    global queue_count
    queue_count += 1
    return queue_count

async def decrement_queue():
    global queue_count
    if queue_count > 0:
        queue_count -= 1
    return queue_count

async def get_queue_count():
    return queue_count

# ================= 工具函数 =================
def extract_real_url(google_url: str) -> str:
    """转换 Google News RSS URL 为原始新闻链接"""
    if "news.google.com" not in google_url:
        return google_url
    try:
        decoded_url = gnewsdecoder(google_url)
        if decoded_url and decoded_url.get('status') and decoded_url.get('decoded_url'):
            url = decoded_url['decoded_url']
            logger.debug(f"URL_DECODE_SUCCESS | {url[:50]}")
            return url
    except Exception as e:
        logger.warning(f"URL_DECODE_FAILED | {google_url[:50]} | {e}")
    return google_url

def cache_exists(hash_id: str) -> bool:
    try:
        client = get_r2_client()
        client.head_object(Bucket=R2_BUCKET_NAME, Key=f"analysis/{hash_id}.json")
        return True
    except:
        return False

def get_cache(hash_id: str) -> dict:
    client = get_r2_client()
    response = client.get_object(Bucket=R2_BUCKET_NAME, Key=f"analysis/{hash_id}.json")
    import json
    return json.loads(response['Body'].read().decode('utf-8'))

async def put_cache(hash_id: str, data: dict):
    client = await asyncio.to_thread(get_r2_client)
    import json
    await asyncio.to_thread(
        client.put_object,
        Bucket=R2_BUCKET_NAME,
        Key=f"analysis/{hash_id}.json",
        Body=json.dumps(data, ensure_ascii=False),
        ContentType='application/json'
    )

# ================= Pydantic 模型 =================
class AnalyzeRequest(BaseModel):
    url: HttpUrl
    check_only: bool = False

class AnalysisData(BaseModel):
    title: str
    simplified: str
    traditional: str
    original_url: str
    analyzed_at: str

class AnalyzeResponse(BaseModel):
    source: str
    hash_id: str
    data: Optional[AnalysisData] = None
    queue_position: int = 0
    cached: Optional[bool] = None

class HealthResponse(BaseModel):
    status: str
    ollama: str
    r2: str

class QueueResponse(BaseModel):
    queue_length: int
    is_processing: bool
    estimated_wait_seconds: int

# ================= API 端点 =================
@app.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
async def health_check():
    ollama_status = "unknown"
    r2_status = "unknown"
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_HOST}/api/tags", headers=OLLAMA_HEADERS, timeout=5.0)
            if response.status_code == 200:
                ollama_status = "connected"
            else:
                ollama_status = f"error:{response.status_code}"
    except Exception as e:
        ollama_status = f"error:{str(e)[:50]}"
    try:
        # boto3 head_bucket 是同步阻塞的，在 async 环境建议放进线程
        client = await asyncio.to_thread(get_r2_client)
        await asyncio.to_thread(client.head_bucket, Bucket=R2_BUCKET_NAME)
        r2_status = "connected"
    except Exception as e:
        r2_status = f"error:{str(e)[:50]}"
    return HealthResponse(
        status="ok" if ollama_status == "connected" and r2_status == "connected" else "degraded",
        ollama=ollama_status,
        r2=r2_status
    )

@app.get("/queue", response_model=QueueResponse)
async def queue_status():
    queue_length = await get_queue_count()
    is_processing = ollama_lock.locked()
    return QueueResponse(
        queue_length=queue_length,
        is_processing=is_processing,
        estimated_wait_seconds=queue_length * 30
    )

@app.post("/analyze")
async def analyze_news(request: AnalyzeRequest):
    url_str = str(request.url)
    real_url = extract_real_url(url_str)
    hash_id = hashlib.md5(real_url.encode()).hexdigest()
    
    # 检查 R2 缓存
    try:
        if cache_exists(hash_id):
            cached_data = get_cache(hash_id)
            logger.info(f"CACHE_HIT | {hash_id[:8]}")
            return {
                "source": "cache",
                "hash_id": hash_id,
                "data": cached_data,
                "queue_position": 0,
                "cached": True
            }
        elif request.check_only:
            return {"cached": False, "hash_id": hash_id, "source": "none"}
    except Exception as e:
        logger.warning(f"CACHE_ERROR | {hash_id[:8]} | {e}")

    if request.check_only:
        return {"cached": False, "hash_id": hash_id, "source": "none"}

    # 加入队列
    queue_pos = await increment_queue()
    logger.info(f"QUEUE_JOIN | {hash_id[:8]} | pos={queue_pos}")
    start_time = datetime.now()
    
    try:
        # 抓取网页内容 (非异步函数，放入线程)
        downloaded = await asyncio.to_thread(trafilatura.fetch_url, real_url)
        if downloaded:
            content = await asyncio.to_thread(trafilatura.extract, downloaded)
            metadata = await asyncio.to_thread(trafilatura.extract_metadata, downloaded)
            title = metadata.title if metadata and metadata.title else "新闻文章"
        else:
            content = None
            title = "新闻文章"
        
        if not content or len(content) < 50:
            raise HTTPException(status_code=422, detail="未能提取到有效的文章正文内容")

        # 使用 Ollama 分析
        try:
            async with ollama_lock:
                logger.info(f"OLLAMA_START | {hash_id[:8]} | {title[:30]}")
                client = Client(host=OLLAMA_HOST, headers=OLLAMA_HEADERS)
                
                # 原始结构化 prompt
                prompt = f"""
【语言强制锁定】
**警告：本任务的唯一输出语言为简体中文（Simplified Chinese）。**
**禁止**在输出结果中包含任何日文句子。如果包含日文，任务视为失败。

你是一名专业的新闻整理型AI编辑，面向看不到、也看不懂日文原文的中文读者。
你的任务是：阅读日文原文，**将其翻译并改写**为简体中文新闻简报。

【新闻标题】
{title}

【新闻全文（日文）】
{content[:2000]}

【核心指令】

1. **翻译并整合**：
   - 必须整合正文、"エキスパートの補足・見解"（专家解读）和"ココがポイント"（要点）中的所有信息。
   - 所有内容必须**翻译成地道的简体中文**。

2. **辩证对立结构**：
   - 严格区分"成就/优势"与"问题/挑战"。

3. **精准数据原则（防幻觉关键）**：
   - **保留：** 原文明确出现的关键数据（如里程、人数、伤亡数、金额）和专有名词（如地名、人名）。
   - **禁止：** 输出原文未出现的数字。
   - **比较级处理：** 严禁为了夸张而编造具体数字。

4. **主语明确**：
   - 明确指出责任方，不使用模糊指代。

5. **时间锚定**：
   - 严格尊重原文年份（如2025年），即使看起来是未来，也必须照实转录。

【输出格式（固定）】
（注意：直接输出以下栏目内容，不要重复输出本段格式说明，不要输出Markdown星号）

核心事实
（请用简体中文撰写）
用 2–3 句话。简述新闻最核心的事件本身。

背景说明
（请用简体中文撰写）
用 2–3 句话。简述事件的历史背景或前因后果。

正面评价
（请用简体中文撰写）
用 3–4 句话。归纳新闻中提到的积极进展、优势、成就或官方应对。

负面评价
（请用简体中文撰写）
用 3–4 句话。归纳新闻中指出的问题、劣势、副作用。
*重点关注：原文中提及的具体负面案例、数据佐证。*

一句话总结
（请用简体中文撰写）
用 一句中性陈述句，概括现状。

【最终检查】
在输出前，请确认：我没有编造任何原文未提及的数据吧？
"""
                
                response = await asyncio.to_thread(
                    client.chat,
                    model='qwen3:8b',
                    messages=[{'role': 'user', 'content': prompt}],
                    options={"num_ctx": 4096, "temperature": 0.6}
                )
                
                simplified_content = response['message']['content']
                traditional_content = cc.convert(simplified_content)
                
                elapsed = (datetime.now() - start_time).total_seconds()
                logger.info(f"OLLAMA_DONE | {hash_id[:8]} | {elapsed:.1f}s")
                
        except Exception as e:
            logger.error(f"OLLAMA_ERROR | {hash_id[:8]} | {e}")
            raise HTTPException(status_code=503, detail=f"AI 分析失败: {str(e)}")
        
        # 存入 R2
        analysis_data = {
            "title": title,
            "simplified": simplified_content,
            "traditional": traditional_content,
            "original_url": real_url,
            "analyzed_at": datetime.now().isoformat()
        }
        
        try:
            await put_cache(hash_id, analysis_data)
            logger.info(f"CACHE_SAVE | {hash_id[:8]}")
        except Exception as e:
            logger.warning(f"CACHE_SAVE_ERROR | {hash_id[:8]} | {e}")
        
        return {
            "source": "generate",
            "hash_id": hash_id,
            "data": analysis_data,
            "queue_position": 0,
            "cached": False
        }
        
    finally:
        await decrement_queue()

if __name__ == "__main__":
    import uvicorn
    import time
    
    RETRY_DELAY = 5
    
    while True:
        try:
            logger.info("Starting Server...")
            # 使用 log_config=None 以避免 uvicorn 尝试初始化其默认日志配置（在某些环境下会因 stdout 缺失或冲突报错）
            # 这样 uvicorn 会直接使用我们已经通过 logging.basicConfig 配置好的 root logger
            uvicorn.run(app, host="0.0.0.0", port=8000, log_config=None)
        except Exception as e:
            logger.error(f"CRITICAL | Server crashed: {e}")
            # 如果是因为端口占用，给更多时间，或者干脆退出让 watchdog 处理
            if "Address already in use" in str(e):
                logger.info("Port 8000 in use, waiting longer...")
                time.sleep(10)
            else:
                logger.info(f"Restarting in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
        except KeyboardInterrupt:
            logger.info("Server stopped by user.")
            break
