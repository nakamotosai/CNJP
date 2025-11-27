import feedparser
from deep_translator import GoogleTranslator
import json
import os
import datetime
import time
import requests
from bs4 import BeautifulSoup # 用来从 Google 新闻里扣图片

# 设置时区 UTC+9
JST_OFFSET = datetime.timedelta(hours=9)

# Google 新闻 (日本焦点) RSS
RSS_URL = "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja"

def get_current_jst_time():
    return datetime.datetime.utcnow() + JST_OFFSET

def update_news():
    print("🚀 开始抓取 Google 新闻(日本热榜)...")
    
    # 伪装头
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(RSS_URL, headers=headers, timeout=10)
        print(f"📡 响应状态码: {response.status_code}")
        
        if response.status_code != 200:
            print("❌ 访问被拒绝")
            return

        feed = feedparser.parse(response.content)
        
    except Exception as e:
        print(f"❌ 网络请求失败: {e}")
        return

    if not feed.entries:
        print("⚠️ 未获取到新闻")
        return

    translator = GoogleTranslator(source='auto', target='zh-CN')
    
    archive_dir = "archive"
    if not os.path.exists(archive_dir):
        os.makedirs(archive_dir)
        
    date_str = get_current_jst_time().strftime("%Y-%m-%d")
    archive_path = os.path.join(archive_dir, f"{date_str}.json")
    
    existing_links = set()
    current_archive_data = []

    # 读取旧数据
    if os.path.exists(archive_path):
        try:
            with open(archive_path, 'r', encoding='utf-8') as f:
                current_archive_data = json.load(f)
                for item in current_archive_data:
                    existing_links.add(item['link'])
        except:
            pass

    new_items_count = 0
    
    # 抓取前 20 条
    for entry in feed.entries[:20]:
        link = entry.link
        if link in existing_links:
            continue

        # 翻译标题
        # Google新闻标题通常是 "标题 - 媒体名"，我们只翻译横杠前面的部分会更准确
        clean_title = entry.title.split(' - ')[0]
        try:
            zh_title = translator.translate(clean_title)
        except:
            zh_title = clean_title
        
        # --- 🔥 核心：从 Google 描述中提取图片 ---
        image_url = ""
        if 'summary' in entry:
            # Google 把图片放在 summary 的 html 标签里
            soup = BeautifulSoup(entry.summary, 'html.parser')
            img_tag = soup.find('img')
            if img_tag and 'src' in img_tag.attrs:
                image_url = img_tag['src']
        # ---------------------------------------
        
        time_str = get_current_jst_time().strftime("%H:%M")

        item_data = {
            "title": zh_title,
            "origin": entry.title,
            "link": link,
            "time": time_str,
            "image": image_url
        }
        
        current_archive_data.insert(0, item_data)
        existing_links.add(link)
        new_items_count += 1
        time.sleep(0.5)

    print(f"✅ 新增了 {new_items_count} 条新闻")

    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(current_archive_data, f, ensure_ascii=False, indent=2)

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(current_archive_data[:20], f, ensure_ascii=False, indent=2)
    print("✅ data.json 更新成功")

if __name__ == "__main__":
    update_news()