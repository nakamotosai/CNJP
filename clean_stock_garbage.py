# clean_stock_garbage.py  —— 只删股票垃圾，其他新闻100%保留
import json
import os
import re

# 需要清理的文件
DATA_FILE = "data.json"
ARCHIVE_DIR = "archive"

# 股票特征：标题以“中国”开头 + 2~5个汉字，或者包含常见股票词
def is_stock_garbage(title):
    if re.search(r'^中国[々〇〻〆一-龯]{2,5}', title):
        return True
    stock_keywords =  ["株価", "上昇", "下落", "出来高", "売買高", "決算", "業績", "配当",
            "中国塗料", "中国電力", "中国工業", "中国汽船", "中国銀行",
            "NEXT FUNDS", "华夏基金", "中華股票", "上证50",  "中国株式", 
            "K线", "チャート", "株価チャート", "株式情報"]
    if any(kw in title for kw in stock_keywords):
        return True
    return False

# 1. 清理 data.json
if os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    cleaned = [item for item in data if not is_stock_garbage(item['title'])]
    removed = len(data) - len(cleaned)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)
    print(f"data.json 清理完成：删除了 {removed} 条股票垃圾，保留 {len(cleaned)} 条正常新闻")

# 2. 清理 archive 目录下所有历史文件
if os.path.exists(ARCHIVE_DIR):
    for filename in os.listdir(ARCHIVE_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(ARCHIVE_DIR, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                day_data = json.load(f)
            cleaned_day = [item for item in day_data if not is_stock_garbage(item['title'])]
            removed_day = len(day_data) - len(cleaned_day)
            if removed_day > 0:
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(cleaned_day, f, ensure_ascii=False, indent=2)
                print(f"{filename} 删除了 {removed_day} 条股票垃圾")