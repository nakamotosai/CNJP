import feedparser
import calendar
from deep_translator import GoogleTranslator
import json
import os
import datetime
import time
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# 日本时间 (UTC+9)
JST = datetime.timezone(datetime.timedelta(hours=9))

# === 媒体映射表 (与 fix_logos 保持一致) ===
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
    "読売新聞": "www.yomiuri.co.jp",
    "産経": "www.sankei.com",
    "Sankei": "www.sankei.com",
    "共同": "www.kyodo.co.jp",
    "Kyodo": "www.kyodo.co.jp",
    "時事": "www.jiji.com",
    "Jiji": "www.jiji.com",
    "東洋経済": "toyokeizai.net",
    "現代ビジネス": "gendai.media",
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

# 获取新闻源 Logo (优先映射，其次RSS Source，最后Link)
def get_source_logo(entry):
    # 1. 尝试从 source title 匹配映射表
    if hasattr(entry, 'source') and 'title' in entry.source:
        origin_name = entry.source['title']
        for key, domain in MEDIA_DOMAIN_MAP.items():
            if key in origin_name:
                return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"

    # 2. 尝试从 source href 获取域名
    try:
        if hasattr(entry, 'source') and 'href' in entry.source:
            domain_url = entry.source['href']
            domain = urlparse(domain_url).netloc
            if "google" not in domain:
                return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    except:
        pass
        
    return ""

def classify_news(title):
    keywords = {
        "时政": ["政府", "政策", "习近平", "李强", "外交", "政治", "选举", "议员", "首相", "总统", "军事", "国防", "中共", "党", "台湾", "香港", "人权", "制裁", "大使", "领事", "条约", "协定", "峰会", "会谈", "大臣", "内阁", "国会", "参议院", "众议院", "自民党", "公明党", "立宪民主党", "维新会", "共产党", "国民民主党", "令和新选组", "社民党", "参政党", "拜登", "特朗普", "普京", "岸田", "石破", "高市", "小泉", "河野", "林芳正", "茂木", "加藤", "上川", "核武器", "导弹", "演习", "巡逻", "海警", "钓鱼岛", "尖阁", "南海", "东海", "台海"],
        "经济": ["经济", "贸易", "股市", "投资", "银行", "企业", "GDP", "市场", "消费", "产业", "汇率", "美元", "日元", "电动车", "EV", "半导体", "芯片", "通胀", "物价", "工资", "就业", "失业", "房地产", "楼市", "央行", "利率", "加息", "降息", "关税", "出口", "进口", "供应链", "制造", "丰田", "本田", "日产", "索尼", "松下", "软银", "优衣库", "任天堂", "阿里", "腾讯", "字节", "华为", "比亚迪", "宁德时代", "财报", "亏损", "盈利", "收购", "合并", "破产", "裁员"],
        "社会": ["社会", "人口", "教育", "医疗", "犯罪", "事故", "灾害", "疫情", "生活", "旅游", "签证", "移民", "少子化", "老龄化", "养老", "福利", "保险", "医院", "医生", "护士", "学校", "学生", "老师", "大学", "高考", "留学", "治安", "警察", "逮捕", "审判", "法院", "律师", "地震", "台风", "暴雨", "洪水", "火灾", "交通", "铁路", "新干线", "航班", "机场", "地铁", "公交", "出租车", "食品", "安全", "环境", "污染", "垃圾", "气候", "变暖", "碳中和", "核电", "核污水", "排海", "靖国神社", "熊猫"],
        "体育": ["体育", "奥运", "足球", "篮球", "棒球", "选手", "比赛", "冠军", "大谷", "翔平", "羽生", "结弦", "乒乓", "网球", "游泳", "田径", "马拉松", "相扑", "柔道", "空手道", "剑道", "世界杯", "亚洲杯", "亚运会", "联赛", "俱乐部", "球队", "金牌", "银牌", "铜牌"],
        "科技": ["科技", "科学", "AI", "互联网", "手机", "芯片", "航天", "研发", "半导体", "人工智能", "机器人", "无人机", "5G", "6G", "卫星", "火箭", "探测", "宇宙", "太空", "生物", "基因", "疫苗", "药物", "癌症", "诺贝尔", "物理", "化学", "数学", "天文", "黑洞", "量子", "超导", "材料", "电池", "能源", "清洁", "环保"],
        "娱乐": ["娱乐", "电影", "音乐", "动漫", "电视剧", "明星", "偶像", "演唱会", "综艺", "声优", "吉卜力", "鬼灭", "海贼王", "进击的巨人", "EVA", "AKB", "乃木坂", "杰尼斯", "岚", "SMAP"]
    }
    for cat, words in keywords.items():
        if any(w in title for w in words):
            return cat
    return "其他"

def fetch_all_china_news():
    print("正在抓取全部最新日本媒体中国新闻（不限时间，抓满为止）...")
    url = "https://news.google.com/rss/search?q=中国&hl=ja&gl=JP&ceid=JP:ja"
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

def update_news():
    new_entries = fetch_all_china_news()
    
    news_by_date = {}
    preview_items = []
    
    translator_sc = GoogleTranslator(source='ja', target='zh-CN')
    translator_tc = GoogleTranslator(source='ja', target='zh-TW')
    
    print("开始处理并翻译新闻...")
    
    for i, entry in enumerate(new_entries):
        link = entry.link
        title_ja = entry.title
        
        if i > 0 and i % 10 == 0:
            print(f"已处理 {i} 条，休息 1 秒...")
            time.sleep(1)

        try:
            title_zh = translator_sc.translate(title_ja)
        except Exception as e:
            print(f"简体翻译失败: {e}")
            title_zh = title_ja
            
        try:
            title_tc = translator_tc.translate(title_ja)
        except Exception as e:
            print(f"繁体翻译失败: {e}")
            title_tc = title_ja
        
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
            "origin": entry.source.title if hasattr(entry, 'source') else "Google News"
        }
        
        if news_date_str not in news_by_date:
            news_by_date[news_date_str] = []
        news_by_date[news_date_str].append(news_item)

        if len(preview_items) < 5:
            preview_items.append(news_item)

    # Archive 更新
    archive_dir = "public/archive"
    os.makedirs(archive_dir, exist_ok=True)
    
    total_updated = 0
    total_added = 0
    total_ignored = 0

    for date_key, items in news_by_date.items():
        file_path = os.path.join(archive_dir, f"{date_key}.json")
        
        existing_list = []
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_list = json.load(f)
        
        data_map = {}
        for item in existing_list:
            raw_title = item.get('title_ja') or item.get('original_title') or item.get('title') or ""
            clean_key = get_clean_title_key(raw_title)
            
            # 补全旧数据格式
            if not item.get('title_ja') and item.get('original_title'):
                item['title_ja'] = item['original_title']
                
            data_map[clean_key] = item
        
        for new_item in items:
            new_clean_key = get_clean_title_key(new_item['title_ja'])
            
            if new_clean_key in data_map:
                existing_item = data_map[new_clean_key]
                if existing_item['link'] == new_item['link']:
                    data_map[new_clean_key].update(new_item)
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
            
        print(f"[{date_key}] 存档更新: 总{len(final_list)}条 (忽略重复{total_ignored}条)")

    # data.json 更新
    homepage_news = []
    seen_titles = set()
    
    today = get_current_jst_time()
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
    
    with open('public/data.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"全部完成！本次新增 {total_added} 条，更新 {total_updated} 条，忽略重复 {total_ignored} 条。")
    print(f"首页数据 data.json 已包含 {len(homepage_news)} 条新闻。")

    if preview_items:
        print("\n======== 最新抓取的 5 条新闻预览 ========")
        for i, item in enumerate(preview_items):
            print(f"{i+1}. [{item['time_str']}] {item['title']}")
        print("=========================================\n")

if __name__ == "__main__":
    update_news()