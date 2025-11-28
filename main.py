import feedparser
from deep_translator import GoogleTranslator
import json
import os
import datetime
import time
import requests
from bs4 import BeautifulSoup
import re

# 设置时区 UTC+9（日本时间）
JST_OFFSET = datetime.timedelta(hours=9)

def get_current_jst_time():
    return datetime.datetime.utcnow() + JST_OFFSET

def extract_image(entry):
    # 尝试从 Google News 的 summary/description 中提取图片
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

def classify_news(title):
    # 简单的关键词分类
    keywords = {
        "时政": ["政府", "政策", "习近平", "李强", "外交", "政治", "选举", "议员", "首相", "总统", "军事", "国防", "中共", "党", "台湾", "香港", "人权", "制裁", "大使", "领事", "条约", "协定", "峰会", "会谈", "大臣", "内阁", "国会", "参议院", "众议院", "自民党", "公明党", "立宪民主党", "维新会", "共产党", "国民民主党", "令和新选组", "社民党", "参政党", "拜登", "特朗普", "普京", "岸田", "石破", "高市", "小泉", "河野", "林芳正", "茂木", "加藤", "上川", "核武器", "导弹", "演习", "巡逻", "海警", "钓鱼岛", "尖阁", "南海", "东海", "台海"],
        "经济": ["经济", "贸易", "股市", "投资", "银行", "企业", "GDP", "市场", "消费", "产业", "汇率", "美元", "日元", "电动车", "EV", "半导体", "芯片", "通胀", "物价", "工资", "就业", "失业", "房地产", "楼市", "央行", "利率", "加息", "降息", "关税", "出口", "进口", "供应链", "制造", "丰田", "本田", "日产", "索尼", "松下", "软银", "优衣库", "任天堂", "阿里", "腾讯", "字节", "华为", "比亚迪", "宁德时代", "财报", "亏损", "盈利", "收购", "合并", "破产", "裁员"],
        "社会": ["社会", "人口", "教育", "医疗", "犯罪", "事故", "灾害", "疫情", "生活", "旅游", "签证", "移民", "少子化", "老龄化", "养老", "福利", "保险", "医院", "医生", "护士", "学校", "学生", "老师", "大学", "高考", "留学", "治安", "警察", "逮捕", "审判", "法院", "律师", "地震", "台风", "暴雨", "洪水", "火灾", "交通", "铁路", "新干线", "航班", "机场", "地铁", "公交", "出租车", "食品", "安全", "环境", "污染", "垃圾", "气候", "变暖", "碳中和", "核电", "核污水", "排海", "靖国神社", "熊猫"],
        "体育": ["体育", "奥运", "足球", "篮球", "棒球", "选手", "比赛", "冠军", "大谷", "翔平", "羽生", "结弦", "乒乓", "网球", "游泳", "田径", "马拉松", "相扑", "柔道", "空手道", "剑道", "世界杯", "亚洲杯", "亚运会", "联赛", "俱乐部", "球队", "金牌", "银牌", "铜牌"],
        "科技": ["科技", "科学", "AI", "互联网", "手机", "芯片", "航天", "研发", "半导体", "人工智能", "机器人", "无人机", "5G", "6G", "卫星", "火箭", "探测", "宇宙", "太空", "生物", "基因", "疫苗", "药物", "癌症", "诺贝尔", "物理", "化学", "数学", "天文", "黑洞", "量子", "超导", "材料", "电池", "能源", "清洁", "环保", "自动驾驶", "元宇宙", "区块链", "加密货币", "比特币"],
        "娱乐": ["娱乐", "电影", "音乐", "明星", "动漫", "游戏", "动画", "漫画", "声优", "偶像", "歌手", "演员", "导演", "剧集", "日剧", "韩剧", "综艺", "演唱会", "票房", "榜单", "红白", "吉卜力", "宫崎骏", "新海诚", "鬼灭", "咒术", "海贼王", "火影", "柯南", "宝可梦", "马里奥", "塞尔达"]
    }

    for category, words in keywords.items():
        if any(word in title for word in words):
            return category
    return "其他"

def fetch_google_china_news():
    print("正在抓取 Google News（日本版 · 中国相关）...")
    # 搜索过去 24 小时 ('when:1d') 的新闻，以防中间漏抓。
    url = "https://news.google.com/rss/search?q=中国+when:1d&hl=ja&gl=JP&ceid=JP:ja" 
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        print(f"抓到 {len(feed.entries)} 条原始条目")
        return feed.entries
    except Exception as e:
        print(f"抓取失败: {e}")
        return []

def process_entries(entries):
    processed_data = []
    translator = GoogleTranslator(source='ja', target='zh-CN')

    for entry in entries:
        title = entry.title
        link = entry.link
        published = entry.published_parsed
        
        # 过滤掉包含"株"（股票）等无关信息的标题
        if "株" in title or "市场" in title or "铭柄" in title:
             # 再次确认是否真的是纯财经行情，如果包含重要政治关键词则保留
            if not any(k in title for k in ["习近平", "首相", "外交", "军事"]):
                continue

        # 翻译标题
        try:
            title_zh = translator.translate(title)
        except:
            title_zh = title

        # 提取摘要并截断
        summary = ""
        if 'summary' in entry:
            # 清理 HTML 标签
            soup = BeautifulSoup(entry.summary, 'html.parser')
            text = soup.get_text()
            # 简单截断 (先取前150字翻译，再截断到50字)
            try:
                summary_zh = translator.translate(text[:150])
                if len(summary_zh) > 50:
                    summary = summary_zh[:50] + "..."
                else:
                    summary = summary_zh
            except:
                summary = text[:50] + "..."
        
        # 提取图片
        image_url = extract_image(entry)
        
        # 格式化时间
        timestamp = time.mktime(published)
        time_str = time.strftime("%Y-%m-%d %H:%M", time.localtime(timestamp))
        
        # 分类
        category = classify_news(title_zh)

        processed_data.append({
            "title": title_zh,
            "link": link,
            "image": image_url,
            "summary": summary,
            "category": category,
            "time_str": time_str,
            "timestamp": timestamp,
            "origin": entry.source.title if 'source' in entry else "Google News"
        })
    
    return processed_data

def update_news():
    entries = fetch_google_china_news()
    new_data = process_entries(entries)
    
    # 存档今日数据
    archive_dir = "archive"
    os.makedirs(archive_dir, exist_ok=True)
    today_str = get_current_jst_time().strftime("%Y-%m-%d")
    archive_path = os.path.join(archive_dir, f"{today_str}.json")

    # 读取已有今日数据并去重合并
    final_today_list = []
    if os.path.exists(archive_path):
        try:
            with open(archive_path, 'r', encoding='utf-8') as f:
                final_today_list = json.load(f)
        except:
            pass

    existing_links = {i['link'] for i in final_today_list}
    new_count = 0 # 统计新增条目
    
    for item in new_data:
        if item['link'] not in existing_links:
            # 新发现的文章直接插入到列表头部
            final_today_list.insert(0, item)
            new_count += 1 

    # -------------------------------------------------------------
    # 🌟 关键修复：强制按照时间戳倒序排序
    # 确保最新新闻（时间戳最大的）总在列表最前面。
    final_today_list.sort(key=lambda x: x['timestamp'], reverse=True)
    # -------------------------------------------------------------
    
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(final_today_list, f, ensure_ascii=False, indent=2)

    # 聚合近30天生成首页 data.json
    home_data = []
    seen_links = set()
    today = get_current_jst_time()

    for i in range(30):
        date = (today - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        path = os.path.join(archive_dir, f"{date}.json")
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    day_data = json.load(f)
                    for item in day_data:
                        if item['link'] not in seen_links:
                            home_data.append(item)
                            seen_links.add(item['link'])
            except:
                pass

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(home_data, f, ensure_ascii=False, indent=2)

    # 🌟 改进：打印发现的新闻数量，方便在 Actions 日志中确认
    print(f"发现了 {new_count} 条新文章。")
    print(f"更新完成！今日 {len(final_today_list)} 条，首页共 {len(home_data)} 条新闻")

if __name__ == "__main__":
    update_news()