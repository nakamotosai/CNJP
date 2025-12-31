import feedparser
import calendar
import json
import os
import datetime
import time
import requests
import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse, quote
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from ollama import Client

# Load environment variables
load_dotenv()
try:
    # 尝试加载 scripts/.env (Ollama 配置)
    script_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts", ".env")
    if os.path.exists(script_env):
        load_dotenv(script_env)
    
    # 尝试加载根目录 .env.local (R2 配置)
    local_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
    if os.path.exists(local_env):
        load_dotenv(local_env)
except:
    pass

# 日本时间 (UTC+9)
JST = datetime.timezone(datetime.timedelta(hours=9))

# === R2 配置 ===
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID") or os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY") or os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "cnjp-data")

def get_r2_client():
    """获取 R2 客户端"""
    if not R2_ACCOUNT_ID or not R2_ACCESS_KEY or not R2_SECRET_KEY:
        print("⚠️ R2 credentials not configured, skipping R2 upload")
        return None
    
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

def upload_to_r2(client, local_path, r2_key):
    """上传文件到 R2"""
    if client is None:
        return False
    try:
        with open(local_path, 'rb') as f:
            client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=r2_key,
                Body=f.read(),
                ContentType='application/json'
            )
        print(f"✅ Uploaded to R2: {r2_key}")
        return True
    except Exception as e:
        print(f"❌ R2 upload failed for {r2_key}: {e}")
        return False

def download_file_from_r2(client, r2_key, local_path):
    """从 R2 下载文件到本地"""
    if client is None:
        return False
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        client.download_file(R2_BUCKET_NAME, r2_key, local_path)
        print(f"✅ Downloaded from R2: {r2_key}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            print(f"ℹ️ File not found in R2: {r2_key} (will create new)")
        else:
            print(f"❌ R2 download failed for {r2_key}: {e}")
        return False
    except Exception as e:
        print(f"❌ R2 download failed for {r2_key}: {e}")
        return False

# === 媒体映射表 ===
MEDIA_DOMAIN_MAP = {
    "Yahoo": "news.yahoo.co.jp",
    "雅虎": "news.yahoo.co.jp",
    "日本経済新聞": "www.nikkei.com",
    "日経": "www.nikkei.com",
    "Nikkei": "www.nikkei.com",
    "NHK": "www3.nhk.or.jp",
    "TBS": "newsdig.tbs.co.jp",
    "JNN": "newsdig.tbs.co.jp",
    "FNN": "www.fnn.jp",
    "フジテレビ": "www.fnn.jp",
    "富士": "www.fnn.jp",
    "日テレ": "news.ntv.co.jp",
    "日本テレビ": "news.ntv.co.jp",
    "NNN": "news.ntv.co.jp",
    "テレ朝": "news.tv-asahi.co.jp",
    "テレビ朝日": "news.tv-asahi.co.jp",
    "ANN": "news.tv-asahi.co.jp",
    "毎日新聞": "mainichi.jp",
    "朝日新聞": "www.asahi.com",
    "読卖新闻": "www.yomiuri.co.jp",
    "产经": "www.sankei.com",
    "Sankei": "www.sankei.com",
    "共同": "www.kyodo.co.jp",
    "Kyodo": "www.kyodo.co.jp",
    "时事": "www.jiji.com",
    "Jiji": "www.jiji.com",
    "东洋经济": "toyokeizai.net",
    "现代ビジネス": "gendai.media",
    "Diamond": "diamond.jp",
    "ダイヤモンド": "diamond.jp",
    "JBpress": "jbpress.ismedia.jp",
    "Newsweek": "www.newsweekjapan.jp",
    "CNN": "www.cnn.co.jp",
    "BBC": "www.bbc.com",
    "Bloomberg": "www.bloomberg.co.jp",
    "Reuters": "jp.reuters.com",
    "路透": "jp.reuters.com",
    "Record China": "www.recordchina.co.jp",
    "サーチナ": "searchina.net",
    "北海道新聞": "www.hokkaido-np.co.jp",
    "東京新聞": "www.tokyo-np.co.jp",
    "西日本新聞": "www.nishinippon.co.jp",
    "中日新聞": "www.chunichi.co.jp",
    "沖縄タイムス": "www.okinawatimes.co.jp",
    "琉球新報": "ryukyushimpo.jp"
}

# === 1. 假新闻过滤名单 ===
IGNORE_KEYWORDS = [
    "中国地方", "中国地区", "中国５県", "中国五県",
    "中国電力", "中国电", "中电",
    "中国银行", "中国银",
    "中国道", "中国自动车道",
    "中国运输局", "中国整備局", "中国经产局",
    "中国新人", "中国大会", "中国リーグ",
    "中国バス", "中国ジェイアール",
    "鸟取", "岛根", "冈山", "广岛", "山口",
    # TV Show / Drama / Entertainment filters
    "TVer", "电视剧", "动画", "剧集", "完结", "综艺",
    # Paywall / Subscription indicators
    "有料記事", "会員限定", "デジタル", "購読"
]
# 白名单 (有这些词的就算有干扰词也不删)
WHITELIST_KEYWORDS = [
    "北京", "上海", "深圳", "香港", "台湾", "習近平", "李強", "共産党", "中共", 
    "人民元", "外交部", "領事館", "総領事", "中国政府", "日中", "中日", "GDP",
    "EV", "不动产", "军", "导弹", "台湾有事", "尖阁"
]

def is_false_positive(title, source_name):
    # 明确过滤 TVer 来源及其内容
    if "TVer" in source_name or "TVer" in title:
        return True
    
    # 针对电视剧/动画的集数匹配 (如: 第33集, 第12回, 第5话)
    # 避免误杀 "第1位", "第2大" 等情况，这里限定后面跟 集/回/话
    if re.search(r'第\d+[集回話话]', title):
        return True

    # 针对"中国新闻(Chugoku Shimbun)"媒体
    if "中国新聞" in source_name:
        if not any(wk in title for wk in WHITELIST_KEYWORDS):
            return True
            
    # 检查标题和来源名称
    for kw in IGNORE_KEYWORDS:
        if kw in title or kw in source_name:
            # 如果在白名单中，则保留（除非是明确的 TV/剧集过滤）
            if any(wk in title for wk in WHITELIST_KEYWORDS):
                # 如果是特定的付费/剧集关键词，白名单也不放行
                if kw in ["有料記事", "会員限定", "TVer", "电视剧"]:
                    return True
                return False 
            return True
    return False

# === 2. 新的分类逻辑 (无科技，有军事) ===
def classify_news(title):
    keywords = {
        "军事": [
            "军事", "国防", "军", "军队", "解放军", "核武器", "导弹", "演习", "训练", 
            "巡逻", "海警", "海警局", "钓鱼岛", "尖阁", "南海", "东海", "台海", 
            "航母", "战斗机", "战机", "舰艇", "潜艇", "驱逐舰", "轰炸机", "侦察机",
            "入侵", "领空", "领海", "雷达", "部队", "战备", "武力", "威慑"
        ],
        "经济": [
            "经济", "贸易", "股市", "投资", "银行", "企业", "GDP", "市场", "消费", "产业", 
            "汇率", "美元", "日元", "通胀", "物价", "工资", "就业", "失业", "房地产", "楼市", 
            "央行", "利率", "加息", "降息", "关税", "出口", "进口", "供应链", "制造", "财报", 
            "亏损", "盈利", "收购", "合并", "破产", "裁员",
            # 原科技词汇并入经济
            "科技", "技术", "研发", "AI", "人工智能", "芯片", "半导体", "电动车", "EV", "比亚迪", 
            "宁德时代", "华为", "腾讯", "阿里", "字节", "TikTok", "百度", "丰田", "本田", "日产", 
            "索尼", "松下", "软银", "5G", "6G", "互联网", "机器人", "无人机", "手机", "智能",
            "太空", "宇宙", "卫星", "火箭", "嫦娥", "神舟", "空间站"
        ],
        "社会": [
            "社会", "人口", "教育", "医疗", "犯罪", "事故", "灾害", "疫情", "感染", "新冠", 
            "生活", "旅游", "签证", "移民", "少子化", "老龄化", "养老", "福利", "保险", 
            "医院", "学校", "学生", "老师", "大学", "高考", "留学", "治安", "警察", "逮捕", 
            "审判", "法院", "律师", "死刑", "地震", "台风", "暴雨", "洪水", "火灾", 
            "交通", "铁路", "新干线", "航班", "机场", "地铁", "公交", "食品", "安全", 
            "环境", "污染", "垃圾", "气候", "变暖", "碳中和", "核电", "核污水", "排海", "靖国神社", "熊猫"
        ],
        "体育": [
            "体育", "奥运", "足球", "篮球", "棒球", "选手", "比赛", "冠军", "大谷", "翔平", 
            "羽生", "结弦", "乒乓", "网球", "游泳", "田径", "マラソン", "相扑", "柔道", 
            "世界杯", "亚洲杯", "亚运会", "联赛", "俱乐部", "球队", "金牌"
        ],
        "娱乐": [
            "娱乐", "电影", "音乐", "动漫", "电视剧", "明星", "偶像", "演唱会", "综艺", 
            "声优", "吉卜力", "鬼灭", "海贼王", "进击的巨人", "AKB", "乃木坂", "杰尼斯", 
            "游戏", "黑神话", "原神", "任天堂"
        ],
        "时政": [
            "政府", "政策", "习近平", "李强", "外交", "政治", "选举", "议员", "首相", "总统", 
            "中共", "党", "人权", "制裁", "大使", "领事", "条约", "协定", "峰会", "会谈", 
            "大臣", "内阁", "国会", "参议院", "众议院", "自民党", "拜登", "特朗普", "普京", 
            "岸田", "石破", "高市", "关系", "互访"
        ]
    }
    
    priority_order = ["军事", "体育", "娱乐", "社会", "经济", "时政"]
    
    for cat in priority_order:
        if any(w in title for w in keywords[cat]):
            return cat
    return "其他"

def get_current_jst_time():
    return datetime.datetime.now(JST)

def extract_image(entry):
    content = entry.get('summary', '') or entry.get('description', '') or ''
    if content:
        try:
            soup = BeautifulSoup(content, 'html.parser')
            img = soup.find('img')
            if img and img.get('src'):
                return img['src']
        except:
            pass
    return ""

def get_source_logo(entry):
    if hasattr(entry, 'source') and 'title' in entry.source:
        origin_name = entry.source['title']
        for key, domain in MEDIA_DOMAIN_MAP.items():
            if key in origin_name:
                return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    try:
        if hasattr(entry, 'source') and 'href' in entry.source:
            domain_url = entry.source['href']
            domain = urlparse(domain_url).netloc
            if "google" not in domain:
                return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    except:
        pass
    return ""

def fetch_all_china_news():
    print("正在抓取全部最新日本媒体中国新闻...")
    # 新的RSS URL，包含排除参数。增加排除 TVer 和 电视剧关键词，以及特定的集数模式
    # Google News search query 语法支持一些排除，但正则类匹配有限，主要靠后续 Python 过滤
    query = "中国 -中国地方 -中国電力 -中国銀行 -中国道 -中国新人 -中国大会 -TVer -电视剧 -第*集 -有料記事 -会員限定"
    encoded_query = quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja&scoring=n"
    feed = feedparser.parse(url)
    entries = []
    for entry in feed.entries:
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            pub_time = calendar.timegm(entry.published_parsed)
            entries.append((pub_time, entry))
    entries.sort(key=lambda x: x[0], reverse=True)
    print(f"本次从 RSS 抓到 {len(entries)} 条新闻")
    return [e[1] for e in entries]

def get_clean_title_key(full_title):
    if not full_title:
        return ""
    if " - " in full_title:
        return full_title.rsplit(" - ", 1)[0].strip()
    return full_title.strip()

def google_translate_batch(texts, target_lang='zh-CN', source_lang='ja'):
    """
    使用 Google Translate gtx 接口进行批量翻译
    """
    if not texts:
        return []
    
    # 过滤掉空字符串，但保留原始索引
    original_texts = texts
    valid_texts = []
    text_map = [] # 记录有效文本在原列表中的索引
    
    for i, t in enumerate(texts):
        if t and t.strip():
            valid_texts.append(t.strip())
            text_map.append(i)
            
    if not valid_texts:
        return texts

    # 将文本用换行符拼接。注意：gtx 接口建议通过 POST 发送，单次内容不宜超过 5000 字符
    combined_text = "\n".join(valid_texts)
    
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl={}&dt=t".format(target_lang)
    data = {
        "q": combined_text
    }
    
    # 构建最终结果数组，预填为原文本（作为回退）
    results = list(original_texts)
    
    try:
        response = requests.post(url, data=data, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        # 谷歌翻译返回的结构中，data[0] 是翻译片段列表
        full_translation = ""
        if data and data[0]:
            for segment in data[0]:
                if segment[0]:
                    full_translation += segment[0]
        
        # 将翻译后的全文按换行符拆分
        translated_lines = full_translation.strip().split('\n')
        
        # 如果拆分后的行数和输入一致，则一一对应
        if len(translated_lines) == len(valid_texts):
            for i, line in enumerate(translated_lines):
                results[text_map[i]] = line.strip()
        else:
            # 数量不匹配视为失败，触发 Ollama 回退
            raise Exception(f"Batch mismatch: {len(translated_lines)} vs {len(valid_texts)}")
                
    except Exception as e:
        print(f"❌ Google Translate failed: {e}. Switching to Ollama fallback...")
        try:
            # Fallback to Ollama
            host = os.environ.get('OLLAMA_HOST', 'https://ollama.saaaai.com')
            headers = {
                'CF-Access-Client-Id': os.environ.get('CF_ACCESS_CLIENT_ID', ''),
                'CF-Access-Client-Secret': os.environ.get('CF_ACCESS_CLIENT_SECRET', '')
            }
            client = Client(host=host, headers=headers)
            
            # Simple prompt for batch translation
            # Note: For strict alignment, item-by-item is safer but slower. 
            # Given title length, item-by-item is acceptable for < 50 items.
            print(f"  Using Ollama to translate {len(valid_texts)} titles...")
            
            for i, text in enumerate(valid_texts):
                try:
                    prompt = f"Translate the following news title from Japanese to {target_lang}. Output ONLY the translated text, no explanation:\n\n{text}"
                    r = client.chat(
                        model='qwen3:8b', 
                        messages=[{'role': 'user', 'content': prompt}],
                        options={"temperature": 0.3}
                    )
                    translated = r['message']['content'].strip()
                    # Remove any quotes if model adds them
                    translated = translated.strip('"').strip("'")
                    results[text_map[i]] = translated
                except Exception as oe:
                    print(f"  Ollama failed for item {i}: {oe}")
                    
        except Exception as fallback_err:
            print(f"❌ Ollama fallback also failed: {fallback_err}")

    return results

def update_news():
    new_entries = fetch_all_china_news()
    
    news_by_date = {}
    
    print("开始处理新闻...")
    
    valid_count = 0
    filtered_count = 0
    
    # 记录本次抓取的时间戳
    current_fetch_time = int(time.time())

    # 1. 第一步：过滤新闻
    candidates = []
    for entry in new_entries:
        title_ja = entry.title
        source_title = entry.source.title if hasattr(entry, 'source') else ""

        if is_false_positive(title_ja, source_title):
            # print(f"  [过滤] 疑似非新闻/地区新闻: {title_ja}")
            filtered_count += 1
            continue
            
        candidates.append(entry)
    
    print(f"过滤后剩余 {len(candidates)} 条新闻")

    # 2. 第二步：批量翻译标题
    ja_titles = [e.title for e in candidates]
    print("正在进行批量翻译 (简体)...")
    zh_titles = google_translate_batch(ja_titles, target_lang='zh-CN')
    print("正在进行批量翻译 (繁体)...")
    tc_titles = google_translate_batch(ja_titles, target_lang='zh-TW')

    # 3. 第三步：组合数据
    for entry, title_zh, title_tc in zip(candidates, zh_titles, tc_titles):
        title_ja = entry.title
        link = entry.link
        source_title = entry.source.title if hasattr(entry, 'source') else ""
        
        timestamp = calendar.timegm(entry.published_parsed)
        news_datetime = datetime.datetime.fromtimestamp(timestamp, JST)
        news_date_str = news_datetime.strftime("%Y-%m-%d")
        time_str = news_datetime.strftime("%m-%d %H:%M")
        logo_url = get_source_logo(entry)

        news_item = {
            "title": title_zh,
            "title_tc": title_tc,
            "title_ja": title_ja,
            "link": link,
            "image": extract_image(entry),
            "logo": logo_url,
            "summary": "",
            "category": classify_news(title_zh),
            "time_str": time_str,
            "timestamp": timestamp,
            "fetched_at": current_fetch_time,
            "origin": source_title
        }
        
        if news_date_str not in news_by_date:
            news_by_date[news_date_str] = []
        news_by_date[news_date_str].append(news_item)
        valid_count += 1

    print(f"抓取处理结束：有效 {valid_count} 条，过滤 {filtered_count} 条。")

    # Archive 更新
    archive_dir = "public/archive"
    os.makedirs(archive_dir, exist_ok=True)
    
    # 获取 R2 客户端
    r2_client = get_r2_client()

    today = get_current_jst_time()
    yesterday = today - datetime.timedelta(days=1)
    
    dates_to_sync = set(news_by_date.keys())
    dates_to_sync.add(today.strftime("%Y-%m-%d"))
    dates_to_sync.add(yesterday.strftime("%Y-%m-%d"))
    
    print(f"需同步日期: {dates_to_sync}")

    if r2_client:
        for date_str in dates_to_sync:
            download_file_from_r2(r2_client, f"archive/{date_str}.json", os.path.join(archive_dir, f"{date_str}.json"))
    
    total_updated = 0
    total_added = 0
    total_ignored = 0

    uploaded_archives = []

    for date_key, items in news_by_date.items():
        file_path = os.path.join(archive_dir, f"{date_key}.json")
        existing_list = []
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_list = json.load(f)
            except:
                existing_list = []
        
        data_map = {}
        for item in existing_list:
            raw_title = item.get('title_ja') or item.get('original_title') or item.get('title') or ""
            clean_key = get_clean_title_key(raw_title)
            if not item.get('title_ja') and item.get('original_title'):
                item['title_ja'] = item['original_title']
            data_map[clean_key] = item
        
        for new_item in items:
            new_clean_key = get_clean_title_key(new_item['title_ja'])
            if new_clean_key in data_map:
                existing_item = data_map[new_clean_key]
                if existing_item['link'] == new_item['link']:
                    original_fetched_at = existing_item.get('fetched_at')
                    data_map[new_clean_key].update(new_item)
                    if original_fetched_at:
                        data_map[new_clean_key]['fetched_at'] = original_fetched_at
                    total_updated += 1
                else:
                    total_ignored += 1
            else:
                data_map[new_clean_key] = new_item
                total_added += 1
        
        final_list = list(data_map.values())
        final_list.sort(key=lambda x: x['timestamp'], reverse=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(final_list, f, ensure_ascii=False, indent=2)
        
        upload_to_r2(r2_client, file_path, f"archive/{date_key}.json")
        uploaded_archives.append(date_key)
            
        print(f"[{date_key}] 存档更新: 总{len(final_list)}条")

    # === 生成 archive/index.json ===
    print("正在更新归档索引...")
    
    index_path = os.path.join(archive_dir, 'index.json')
    if r2_client:
        download_file_from_r2(r2_client, "archive/index.json", index_path)

    archive_index = {}
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                archive_index = json.load(f)
        except Exception as e:
            print(f"读取现有 index.json 失败: {e}, 将重建索引")

    for date_str in dates_to_sync:
        file_path = os.path.join(archive_dir, f"{date_str}.json")
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    archive_index[date_str] = len(data)
            except Exception as e:
                print(f"读取 {file_path} 计算索引失败: {e}")

    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(archive_index, f, ensure_ascii=False, indent=2)
    print("归档索引更新完毕。")
    
    upload_to_r2(r2_client, index_path, "archive/index.json")

    # data.json 更新
    homepage_news = []
    seen_titles = set()
    target_dates = [
        today.strftime("%Y-%m-%d"),
        (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    ]
    for date_str in target_dates:
        path = os.path.join(archive_dir, f"{date_str}.json")
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                day_data = json.load(f)
                for item in day_data:
                    raw_title = item.get('title_ja') or item.get('original_title') or item.get('title') or ""
                    clean_key = get_clean_title_key(raw_title)
                    if clean_key not in seen_titles:
                        homepage_news.append(item)
                        seen_titles.add(clean_key)
    
    homepage_news.sort(key=lambda x: x['timestamp'], reverse=True)
    
    output_data = {
        "last_updated": get_current_jst_time().strftime("%Y年%m月%d日 %H时%M分"),
        "news": homepage_news
    }
    
    data_json_path = 'public/data.json'
    with open(data_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    upload_to_r2(r2_client, data_json_path, "data.json")
    
    print(f"全部完成！首页数据 data.json 已包含 {len(homepage_news)} 条新闻。")
    if r2_client:
        print(f"✅ R2 上传完成：data.json, archive/index.json, 及 {len(uploaded_archives)} 个日期存档")

if __name__ == "__main__":
    update_news()