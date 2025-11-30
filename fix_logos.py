import json
import os
from urllib.parse import urlparse

# 定义存档目录
ARCHIVE_DIR = "public/archive"
DATA_FILE = "public/data.json"

# === 核心修改：媒体名称 -> 官网域名 映射表 ===
# 只要 origin 里包含 Key 中的文字，就使用对应的域名获取 Logo
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

def get_logo_url(item):
    origin = item.get("origin", "")
    link = item.get("link", "")
    
    # 1. 优先使用映射表匹配
    for key, domain in MEDIA_DOMAIN_MAP.items():
        if key in origin:
            return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    
    # 2. 如果没匹配到，才尝试从 Link 解析 (虽然可能是 Google 链接)
    try:
        if link:
            domain = urlparse(link).netloc
            # 如果解析出来是 google news，那就没办法了，只能放弃或显示默认
            if "google" in domain:
                return "" 
            return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    except:
        pass
    
    return ""

def fix_archives():
    if not os.path.exists(ARCHIVE_DIR):
        print("存档目录不存在！")
        return

    files = [f for f in os.listdir(ARCHIVE_DIR) if f.endswith(".json")]
    print(f"找到 {len(files)} 个存档文件，开始修复 Logo (基于媒体映射)...")

    for filename in files:
        file_path = os.path.join(ARCHIVE_DIR, filename)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        updated_count = 0
        for item in data:
            # 强制重新计算 Logo，因为旧的可能是错的 Google 图标
            old_logo = item.get("logo", "")
            new_logo = get_logo_url(item)
            
            # 只有当新计算出的 Logo 有效，且与旧的不一样时才更新
            if new_logo and new_logo != old_logo:
                item["logo"] = new_logo
                updated_count += 1
        
        if updated_count > 0:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"✅ {filename}: 修正了 {updated_count} 条数据的 Logo")
        else:
            print(f"⏭️ {filename}: 无需修正")

    print("正在重新生成 data.json ...")
    
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            home_data = json.load(f)
        
        home_updated = 0
        if "news" in home_data:
            for item in home_data["news"]:
                new_logo = get_logo_url(item)
                if new_logo and new_logo != item.get("logo", ""):
                    item["logo"] = new_logo
                    home_updated += 1
        
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(home_data, f, ensure_ascii=False, indent=2)
        print(f"✅ public/data.json: 修正了 {home_updated} 条显示数据")

if __name__ == "__main__":
    fix_archives()