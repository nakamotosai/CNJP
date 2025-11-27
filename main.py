import feedparser
from deep_translator import GoogleTranslator
import json
import os
import datetime
import time
import requests
from bs4 import BeautifulSoup

# 设置时区 UTC+9
JST_OFFSET = datetime.timedelta(hours=9)

def get_current_jst_time():
    return datetime.datetime.utcnow() + JST_OFFSET

def extract_image(entry):
    # 尝试提取图片的逻辑 (Google News 专用)
    content_html = ""
    if 'summary' in entry:
        content_html = entry.summary
    elif 'description' in entry:
        content_html = entry.description
    
    if content_html:
        try:
            soup = BeautifulSoup(content_html, 'html.parser')
            img = soup.find('img')
            if img and 'src' in img.attrs:
                return img['src']
        except:
            pass
    return ""

def fetch_google_china_news():
    print("🚀 正在抓取 Google News (日本/中国相关)...")
    # 关键词：中国
    # ceid=JP:ja 限制为日本版
    # when:1d 限制过去24小时 (我们每天存，首页聚合7天，所以抓24小时够了)
    url = "https://news.google.com/rss/search?q=中国+when:1d&hl=ja&gl=JP&ceid=JP:ja"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code != 200:
            return []
        feed = feedparser.parse(response.content)
        return feed.entries
    except Exception as e:
        print(f"❌ 抓取失败: {e}")
        return []

def process_entries(entries):
    processed = []
    translator = GoogleTranslator(source='auto', target='zh-CN')
    
    # 每次最多抓 30 条
    for entry in entries[:30]:
        original_title = entry.title
        # 去掉媒体后缀 (例如 " - NHK NEWS")
        clean_title = original_title.split(' - ')[0]
        
        try:
            zh_title = translator.translate(clean_title)
        except:
            zh_title = clean_title 

        image_url = extract_image(entry)
        
        # 获取当前时间对象
        now = get_current_jst_time()
        
        # 尝试解析 RSS 自带的时间
        try:
            if hasattr(entry, 'published_parsed'):
                # entry.published_parsed 是 UTC 时间，需转为 JST
                pub_tm = entry.published_parsed
                dt_utc = datetime.datetime(*pub_tm[:6])
                dt_jst = dt_utc + datetime.timedelta(hours=9)
            else:
                dt_jst = now
        except:
            dt_jst = now

        # 格式化时间字符串
        time_display = dt_jst.strftime("%m-%d %H:%M") # 显示为 11-28 10:00
        timestamp = dt_jst.timestamp() # 用于排序的数字

        item = {
            "title": zh_title,
            "origin": original_title,
            "link": entry.link,
            "time_str": time_display,
            "timestamp": timestamp, # 排序用
            "image": image_url
        }
        processed.append(item)
        time.sleep(0.2)
        
    return processed

def update_news():
    # 1. 抓取今日最新
    raw_entries = fetch_google_china_news()
    new_data = process_entries(raw_entries)

    # 2. 存入今日存档
    archive_dir = "archive"
    if not os.path.exists(archive_dir):
        os.makedirs(archive_dir)
    
    today = get_current_jst_time()
    today_str = today.strftime("%Y-%m-%d")
    archive_path = os.path.join(archive_dir, f"{today_str}.json")
    
    # 读取旧的今日存档（合并去重）
    final_today_list = []
    if os.path.exists(archive_path):
        try:
            with open(archive_path, 'r', encoding='utf-8') as f:
                final_today_list = json.load(f)
        except:
            pass

    # 合并逻辑
    existing_links = set(i['link'] for i in final_today_list)
    for item in new_data:
        if item['link'] not in existing_links:
            final_today_list.insert(0, item) # 新的放前面
    
    # 保存今日存档
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(final_today_list, f, ensure_ascii=False, indent=2)
    print(f"✅ 今日存档更新 ({len(final_today_list)}条)")

    # 3. 生成首页数据 (聚合过去 30 天)
    print("🔄 正在聚合近 30 天数据...")
    home_data = []
    seen_links = set()

    # 倒序遍历过去 30 天 (今天 -> 30天前)
    for i in range(30):
        target_date = today - datetime.timedelta(days=i)
        d_str = target_date.strftime("%Y-%m-%d")
        f_path = os.path.join(archive_dir, f"{d_str}.json")
        
        if os.path.exists(f_path):
            try:
                with open(f_path, 'r', encoding='utf-8') as f:
                    day_data = json.load(f)
                    for item in day_data:
                        if item['link'] not in seen_links:
                            home_data.append(item)
                            seen_links.add(item['link'])
            except:
                pass
    
    # 默认按热度/RSS顺序保留 (或者按时间排，这里先保持RSS原序，前端负责排序)
    # Google RSS 本身就是按“相关性/热度”排序的
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(home_data, f, ensure_ascii=False, indent=2)
    print(f"✅ data.json 更新完毕 (包含 {len(home_data)} 条新闻)")

if __name__ == "__main__":
    update_news()