import os
import hashlib
import asyncio
import logging
import sys
import socket
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import boto3
from botocore.config import Config
from ollama import Client
import trafilatura
from opencc import OpenCC
from googlenewsdecoder import gnewsdecoder
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

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

# 并发控制 & 去重机制
ollama_lock = asyncio.Lock()
fetch_semaphore = asyncio.Semaphore(3)  # 限制同时进行网页抓取的数量，防止网络拥堵
resolve_semaphore = asyncio.Semaphore(5) # 限制同时进行 URL 解析的数量

# 任务状态追踪
active_resolving_tasks: Dict[str, asyncio.Event] = {} # raw_url_hash -> Event: 正在解析 URL 
resolved_url_cache: Dict[str, str] = {} # raw_url_hash -> real_url: 解析结果缓存 (内存级)

active_analysis_tasks: Dict[str, asyncio.Event] = {} # real_url_hash -> Event: 正在分析 (抓取+Ollama)
queue_count = 0
cc = OpenCC('s2twp')  # 简体转台湾繁体

async def increment_queue():
    global queue_count
    queue_count += 1
    return queue_count

# ================= 限流控制 (Rate Limiting) =================
# 简单的内存限流：IP -> [timestamp1, timestamp2, ...]
request_history: Dict[str, list] = {}
RATE_LIMIT_WINDOW = 60  # 窗口大小：60秒
RATE_LIMIT_MAX_REQUESTS = 2  # 限制次数：2次

def check_rate_limit(client_ip: str):
    """检查 IP 是否超限，返回 True 表示允许，False 表示超限"""
    # 1. 本地回环地址 / 内网地址 豁免 (用于自动预热)
    if client_ip in ["127.0.0.1", "::1", "localhost"]:
        return True
        
    global request_history
    now = datetime.now().timestamp()
    
    # 初始化
    if client_ip not in request_history:
        request_history[client_ip] = []
    
    # 清理过期记录
    request_history[client_ip] = [t for t in request_history[client_ip] if now - t < RATE_LIMIT_WINDOW]
    
    # 检查数量
    if len(request_history[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    # 记录本次请求 (注意：只有真正进入处理流程才记录，所以在调用此函数前通常已经确定要处理)
    # 但为了逻辑严谨，我们由调用方决定何时添加 timestamp? 
    # 或者在这里先检查，如果通过，在真正执行时再 append?
    # 策略：这里只做 Check & Record。如果由调用方决定记录，可以分开。
    # 为了简化，这里检查通过就记录消耗。
    request_history[client_ip].append(now)
    return True

# 回滚限流计数 (当发现命中缓存不需要消耗算力时)
def rollback_rate_limit(client_ip: str):
    if client_ip in request_history and request_history[client_ip]:
        request_history[client_ip].pop()

async def decrement_queue():
    global queue_count
    if queue_count > 0:
        queue_count -= 1
    return queue_count

async def get_queue_count():
    return queue_count

# ================= 工具函数 =================
def extract_real_url_sync(google_url: str) -> str:
    """转换 Google News RSS URL 为原始新闻链接 (同步版)"""
    if "news.google.com" not in google_url:
        return google_url
    try:
        decoded_url = gnewsdecoder(google_url)
        if decoded_url and decoded_url.get('status') and decoded_url.get('decoded_url'):
            url = decoded_url['decoded_url']
            return url
    except Exception as e:
        logger.warning(f"URL_DECODE_FAILED | {google_url[:50]} | {e}")
    return google_url

async def extract_real_url(google_url: str) -> str:
    """异步包装器：转换 Google News RSS URL"""
    return await asyncio.to_thread(extract_real_url_sync, google_url)

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

# ... (Port Clean up functions remain same) ...
def is_port_in_use(port: int) -> bool:
    """检查端口是否被占用"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # 设置 SO_REUSEADDR 以便在 TIME_WAIT 状态下也能进行绑定测试
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('0.0.0.0', port))
            return False
        except OSError:
            return True

def kill_process_on_port(port: int):
    """杀死占用指定端口的进程（Windows版本）"""
    import subprocess
    try:
        # 查找占用端口的进程
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    try:
                        pid_int = int(pid)
                        # 不要杀死自己
                        if pid_int != os.getpid():
                            logger.info(f"PORT_CLEANUP | Killing process {pid} on port {port}")
                            subprocess.run(
                                ['taskkill', '/F', '/PID', pid],
                                capture_output=True,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                            )
                    except (ValueError, subprocess.SubprocessError) as e:
                        logger.warning(f"PORT_CLEANUP | Failed to kill PID {pid}: {e}")
    except Exception as e:
        logger.error(f"PORT_CLEANUP | Error: {e}")

# ... (Pydantic models remain same) ...
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
async def analyze_news(request: AnalyzeRequest, request_obj: Request):
    url_str = str(request.url)
    
    # === 第一层去重：基于原始 URL (Raw URL Deduplication) ===
    # 目的：防止大量用户点击同一个 Google Redirect Link 造成服务器瞬间压力
    raw_url_hash = hashlib.md5(url_str.encode()).hexdigest()
    
    real_url = None
    
    # 1.1 检查内存缓存中是否已解析过此 URL
    if raw_url_hash in resolved_url_cache:
        real_url = resolved_url_cache[raw_url_hash]
    
    # 1.2 如果正在解析，等待
    elif raw_url_hash in active_resolving_tasks:
        logger.info(f"URL_RESOLVE_WAIT | {raw_url_hash[:8]} | Waiting for ongoing resolution")
        try:
            await asyncio.wait_for(active_resolving_tasks[raw_url_hash].wait(), timeout=30)
            if raw_url_hash in resolved_url_cache:
                real_url = resolved_url_cache[raw_url_hash]
        except Exception as e:
            logger.warning(f"URL_RESOLVE_TIMEOUT | {raw_url_hash[:8]} | {e}")
            
    # 1.3 亲自解析
    if not real_url:
        # === 限流检查点 1：解析 URL 也是一种资源消耗，但相对较小，暂且不计，或者计入？
        # 用户需求是“真正触发解读”才算。解析URL算前置步骤。
        # 但如果大量请求解析也是负担。
        # 按照用户描述：“直接从R2秒出的文章不算，只计算真正触发解读”。
        # 所以我们在进入 Ollama 之前做强校验。
        
        active_resolving_tasks[raw_url_hash] = asyncio.Event()
        try:
            async with resolve_semaphore: # 限制并发解析数量
                real_url = await extract_real_url(url_str)
                resolved_url_cache[raw_url_hash] = real_url
        finally:
            active_resolving_tasks[raw_url_hash].set()
            del active_resolving_tasks[raw_url_hash]

    # === 正式处理流程 ===
    hash_id = hashlib.md5(real_url.encode()).hexdigest()
    
    # 2. 检查 R2 缓存 (Cache Check) - 使用 真实URL Hash

    try:
        # 放入线程以防阻塞
        exists = await asyncio.to_thread(cache_exists, hash_id)
        if exists:
            cached_data = await asyncio.to_thread(get_cache, hash_id)
            logger.info(f"CACHE_HIT | {hash_id[:8]}")
            return {
                "source": "cache",
                "hash_id": hash_id,
                "data": cached_data,
                "queue_position": 0,
                "cached": True
            }
        
        # 2.1 额外检查：如果前台(route.ts)没命中RawUrl缓存，但这里命中了RealUrl缓存
        # 说明是旧数据，需要补写 RawUrl 缓存以供下次秒出
        if exists and hash_id != raw_url_hash:
             try:
                 # 将这份数据也存一份到 raw_url_hash
                 cached_data = await asyncio.to_thread(get_cache, hash_id)
                 await put_cache(raw_url_hash, cached_data)
                 logger.info(f"CACHE_HEALING | Backfilled raw_url cache: {raw_url_hash[:8]}")
             except Exception as e:
                 logger.warning(f"CACHE_HEALING_FAIL | {e}")
        
        elif request.check_only:
             return {"cached": False, "hash_id": hash_id, "source": "none"}
    except Exception as e:
        logger.warning(f"CACHE_ERROR | {hash_id[:8]} | {e}")

    if request.check_only:
        return {"cached": False, "hash_id": hash_id, "source": "none"}

    # 3. 第二层去重：基于真实 URL 的任务 (Real URL Deduplication)
    # 检查是否有正在进行的相同任务
    if hash_id in active_analysis_tasks:
        logger.info(f"TASK_DEDUPE | Waiting for existing task: {hash_id[:8]}")
        try:
            # 等待原任务完成（最长等待 300秒）
            await asyncio.wait_for(active_analysis_tasks[hash_id].wait(), timeout=300)
            
            # 任务完成后再次检查缓存
            exists = await asyncio.to_thread(cache_exists, hash_id)
            if exists:
                cached_data = await asyncio.to_thread(get_cache, hash_id)
                logger.info(f"DEDUPE_SUCCESS | {hash_id[:8]} | Retrieved from fresh cache")
                return {
                    "source": "cache_dedupe",
                    "hash_id": hash_id,
                    "data": cached_data,
                    "queue_position": 0,
                    "cached": True
                }
            else:
                logger.warning(f"DEDUPE_AMBIGUOUS | Task finished but no cache: {hash_id[:8]}")
                raise HTTPException(status_code=503, detail="前序排队任务处理失败，请重试")
                
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="等待排队任务超时")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"DEDUPE_ERROR | {hash_id[:8]} | {e}")
            raise HTTPException(status_code=500, detail="等待排队任务时发生错误")

    # 4. 准备执行 AI 解读 (算力消耗点)
    
    # === 限流检查点 2：真正消耗算力前 ===
    client_ip = request_obj.client.host
    # 如果有反向代理(Cloudflare)，需尝试获取真实 IP
    # 注意：FastAPI 获取 header 需要 request_obj
    cf_ip = request_obj.headers.get("cf-connecting-ip")
    real_ip = cf_ip if cf_ip else client_ip
    
    if not check_rate_limit(real_ip):
         logger.warning(f"RATE_LIMIT | {real_ip} | Limit exceeded")
         raise HTTPException(status_code=429, detail="每分钟解读次数限制 2 次，请休息一下再试（排队请求除外）")

    # 4. 成为“领头”任务 (Become Leader)
    active_analysis_tasks[hash_id] = asyncio.Event()

    # 加入队列计数
    queue_pos = await increment_queue()
    logger.info(f"QUEUE_JOIN | {hash_id[:8]} | pos={queue_pos}")
    start_time = datetime.now()
    
    try:
        # 限制抓取并发数
        content = None
        title = "新闻文章"
        
        async with fetch_semaphore:
            # 抓取网页内容 (非异步函数，放入线程)
            downloaded = await asyncio.to_thread(trafilatura.fetch_url, real_url)
            if downloaded:
                content = await asyncio.to_thread(trafilatura.extract, downloaded)
                metadata = await asyncio.to_thread(trafilatura.extract_metadata, downloaded)
                title = metadata.title if metadata and metadata.title else "新闻文章"
        
        if not content or len(content) < 50:
            raise HTTPException(status_code=422, detail="未能提取到有效的文章正文内容")

        # 检查是否包含付费墙或订阅提示
        paywall_keywords = ["続きを読む", "会員限定", "購読", "ログインして読"]
        if any(kw in content for kw in paywall_keywords) and len(content) < 300:
             logger.warning(f"PAYWALL_DETECTED | {hash_id[:8]} | Content length: {len(content)}")
             raise HTTPException(status_code=422, detail="检测到付费订阅限制，AI 无法获取正文")

        # 使用 Ollama 分析 (串行执行)
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
            # 双重存储：
            # 1. 存 main hash (真实URL)
            await put_cache(hash_id, analysis_data)
            # 2. 存 raw hash (原始URL) -> 秒出关键
            if raw_url_hash != hash_id:
                await put_cache(raw_url_hash, analysis_data)
                
            logger.info(f"CACHE_SAVE | {hash_id[:8]} & {raw_url_hash[:8]}")
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
        # 关键：无论成功还是失败，都要唤醒等待者并从任务列表中移除
        if hash_id in active_analysis_tasks:
            active_analysis_tasks[hash_id].set()
            del active_analysis_tasks[hash_id]
            
        await decrement_queue()

# ================= 离线补课逻辑 =================

async def process_pending_requests():
    """定期检查 R2 中挂起的请求并自动补课"""
    logger.info("WORKER | Background worker started.")
    while True:
        try:
            client = await asyncio.to_thread(get_r2_client)
            # 列出所有 pending/ 下的文件
            response = await asyncio.to_thread(
                client.list_objects_v2,
                Bucket=R2_BUCKET_NAME,
                Prefix="pending/"
            )
            
            contents = response.get('Contents', [])
            if contents:
                logger.info(f"WORKER | Found {len(contents)} pending requests.")
                for obj in contents:
                    key = obj['Key']
                    if not key.endswith('.json'): continue
                    
                    try:
                        # 下载并读取
                        res = await asyncio.to_thread(client.get_object, Bucket=R2_BUCKET_NAME, Key=key)
                        import json
                        pending_data = json.loads(res['Body'].read().decode('utf-8'))
                        original_url = pending_data.get('url')
                        
                        if original_url:
                            logger.info(f"WORKER | Auto-processing: {original_url[:50]}...")
                            # 模拟一次处理请求 (不带 check_only)
                            req = AnalyzeRequest(url=original_url)
                            await analyze_news(req)
                        
                        # 处理完或已存在缓存，删除补课记录
                        await asyncio.to_thread(client.delete_object, Bucket=R2_BUCKET_NAME, Key=key)
                        logger.info(f"WORKER | Cleaned up pending task: {key}")
                        
                    except Exception as e:
                        logger.error(f"WORKER | Error processing {key}: {e}")
                    
                    # 适当延迟，避免连续高负载
                    await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"WORKER | Worker loop error: {e}")
            
        # 每隔 5 分钟巡检一次
        await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event():
    # 启动后台补课协程
    asyncio.create_task(process_pending_requests())

if __name__ == "__main__":
    import uvicorn
    import time
    
    PORT = 8000
    MAX_RETRIES = 5
    RETRY_DELAY = 3
    
    # for attempt in range(MAX_RETRIES):
    #     # 检查端口是否被占用
    #     if is_port_in_use(PORT):
    #         logger.warning(f"PORT_CHECK | Port {PORT} is in use. Attempting to free it... (attempt {attempt + 1}/{MAX_RETRIES})")
    #         kill_process_on_port(PORT)
    #         time.sleep(2)  # 等待进程完全终止
    #         
    #         # 再次检查
    #         if is_port_in_use(PORT):
    #             logger.warning(f"PORT_CHECK | Port {PORT} still in use after cleanup. Waiting...")
    #             time.sleep(RETRY_DELAY)
    #             continue
    #     
    #     try:
    #         logger.info("Starting Server...")
    #         # 使用 log_config=None 以避免 uvicorn 尝试初始化其默认日志配置
    #         uvicorn.run(app, host="0.0.0.0", port=PORT, log_config=None)
    #         break  # 正常退出时跳出循环
    #     except Exception as e:
    #         logger.error(f"CRITICAL | Server error: {e}")
    #         if "Address already in use" in str(e) or "10048" in str(e):
    #             logger.info(f"Port conflict detected. Retrying in {RETRY_DELAY}s...")
    #             time.sleep(RETRY_DELAY)
    #         else:
    #             # 其他错误也等待一下再重试
    #             logger.info(f"Restarting in {RETRY_DELAY}s...")
    #             time.sleep(RETRY_DELAY)
    #     except KeyboardInterrupt:
    #         logger.info("Server stopped by user.")
    #         break
    try:
        logger.info("Starting Server...")
        # 使用 log_config=None 以避免 uvicorn 尝试初始化其默认日志配置
        uvicorn.run(app, host="0.0.0.0", port=PORT, log_config=None)
    except Exception as e:
        logger.error(f"CRITICAL | Server error: {e}")
    except KeyboardInterrupt:
        logger.info("Server stopped by user.")
    else:
        logger.error(f"FATAL | Failed to start server after {MAX_RETRIES} attempts. Giving up.")
        sys.exit(1)
