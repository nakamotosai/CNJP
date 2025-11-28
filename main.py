import feedparser
from deep_translator import GoogleTranslator
import json
import os
import datetime
import time
from bs4 import BeautifulSoup

# 日本时间
JST = datetime.timezone(datetime.timedelta(hours=9))

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

def classify_news(title):
    # 你原来的关键词分类，保持不变
    keywords = { ... }  # 直接复制你原来的关键词表，省略几千字
    for cat, words in keywords.items():
        if any(w in title for w in words):
            return cat
    return "其他"

def fetch_all_china_news():
    print("正在抓取全部最新日本媒体中国新闻（不限时间，抓满为止）...")
    # 最简单、最猛的 RSS：去掉任何时间限制，抓最新 200 条（Google RSS 最大上限）
    url = "https://news.google.com/rss/search?q=中国&hl=ja&gl=JP&ceid=JP:ja"
    feed = feedparser.parse(url)
    
    entries = []
    for entry in feed.entries:
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            pub_time = time.mktime(entry.published_parsed)
            entries.append((pub_time, entry))
    
    # 按时间倒序（最新在前）
    entries.sort(key=lambda x: x[0], reverse=True)
    print(f"本次从 RSS 抓到 {len(entries)} 条新闻")
    return [e[1] for e in entries]

def update_news():
    new_entries = fetch_all_china_news()
    new_data = []
    translator = GoogleTranslator(source='ja', target='zh-CN')
    
    for entry in new_entries:
        link = entry.link
        title_ja = entry.title
        try:
            title_zh = translator.translate(title_ja)
        except:
            title_zh = title_ja
        
        timestamp = time.mktime(entry.published_parsed)
        time_str = time.strftime("%m-%d %H:%M", time.localtime(timestamp))
        
        new_data.append({
            "title": title_zh,
            "link": link,
            "image": extract_image(entry),
            "summary": "",
            "category": classify_news(title_zh),
            "time_str": time_str,
            "timestamp": timestamp,
            "origin": entry.source.title if hasattr(entry, 'source') else "Google News"
        })
    
    # ========= 今日存档 =========
    archive_dir = "archive"
    os.makedirs(archive_dir, exist_ok=True)
    today_str = get_current_jst_time().strftime("%Y-%m-%d")
    today_path = os.path.join(archive_dir, f"{today_str}.json")
    
    today_list = []
    if os.path.exists(today_path):
        with open(today_path, 'r', encoding='utf-8') as f:
            today_list = json.load(f)
    
    # 去重：用 link 判断
    existing_links = {item['link'] for item in today_list}
    added = 0
    for item in new_data:
        if item['link'] not in existing_links:
            today_list.append(item)
            existing_links.add(item['link'])
            added += 1
    
    # 永远按时间倒序（最新在前）
    today_list.sort(key=lambda x: x['timestamp'], reverse=True)
    
    with open(today_path, 'w', encoding='utf-8') as f:
        json.dump(today_list, f, ensure_ascii=False, indent=2)
    
    # ========= 生成首页 data.json：只显示今天 + 昨天的新闻（超过1天自动归档）=========
    cutoff = (get_current_jst_time() - datetime.timedelta(days=1)).timestamp()
    recent_news = []
    seen = set()
    
    for delta in [0, 1]:  # 今天 + 昨天
        date = (get_current_jst_time() - datetime.timedelta(days=delta)).strftime("%Y-%m-%d")
        path = os.path.join(archive_dir, f"{date}.json")
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                day_data = json.load(f)
                for item in day_data:
                    if item['link'] not in seen:
                        recent_news.append(item)
                        seen.add(item['link'])
    
    # 按时间排序，最新在前
    recent_news.sort(key=lambda x: x['timestamp'], reverse=True)
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(recent_news, f, ensure_ascii=False, indent=2)
    
    print(f"更新完成！今日总计 {len(today_list)} 条，本次新增 {added} 条，首页显示最近两天共 {len(recent_news)} 条")
    if added > 0 and recent_news:
        print("最新三条预览：")
        for item in recent_news[:3]:
            print(f"  {item['time_str']}  {item['title'][:60]}")

if __name__ == "__main__":
    update_news()