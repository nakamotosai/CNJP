import feedparser
import calendar
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
        
        timestamp = calendar.timegm(entry.published_parsed)
        time_str = datetime.datetime.fromtimestamp(timestamp, JST).strftime("%m-%d %H:%M")
        
        new_data.append({
            "title": title_zh,
            "title_ja": title_ja,
            "link": link,
            "image": extract_image(entry),
            "summary": "",
            "category": classify_news(title_zh),
            "time_str": time_str,
            "timestamp": timestamp,
            "origin": entry.source.title if hasattr(entry, 'source') else "Google News"
        })
    
    # 今日存档
    archive_dir = "archive"
    os.makedirs(archive_dir, exist_ok=True)
    today_str = get_current_jst_time().strftime("%Y-%m-%d")
    today_path = os.path.join(archive_dir, f"{today_str}.json")
    
    today_list = []
    if os.path.exists(today_path):
        with open(today_path, 'r', encoding='utf-8') as f:
            today_list = json.load(f)
            
    # Update existing items and add new ones
    today_dict = {item['link']: item for item in today_list}
    
    added = 0
    updated = 0
    for item in new_data:
        if item['link'] in today_dict:
            today_dict[item['link']].update(item)
            updated += 1
        else:
            today_dict[item['link']] = item
            added += 1
            
    today_list = list(today_dict.values())
    today_list.sort(key=lambda x: x['timestamp'], reverse=True)
    
    with open(today_path, 'w', encoding='utf-8') as f:
        json.dump(today_list, f, ensure_ascii=False, indent=2)
    
    # 首页：只显示今天 + 昨天的新闻，最多100条
    cutoff = (get_current_jst_time() - datetime.timedelta(days=1)).timestamp()
    recent_news = []
    seen = set()
    
    for delta in [0, 1]:
        date = (get_current_jst_time() - datetime.timedelta(days=delta)).strftime("%Y-%m-%d")
        path = os.path.join(archive_dir, f"{date}.json")
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                day_data = json.load(f)
                for item in day_data:
                    if item['link'] not in seen:
                        recent_news.append(item)
                        seen.add(item['link'])
    
    recent_news.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Limit to 100 items for homepage
    homepage_news = recent_news[:100]
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(homepage_news, f, ensure_ascii=False, indent=2)
    
    print(f"更新完成！今日总计 {len(today_list)} 条，本次新增 {added} 条，更新 {updated} 条，首页显示最近两天共 {len(homepage_news)} 条（限制100条）")
    if added > 0 or updated > 0:
        print("最新三条预览：")
        for item in homepage_news[:3]:
            print(f"  {item['time_str']}  {item['title'][:60]}")

if __name__ == "__main__":
    update_news()