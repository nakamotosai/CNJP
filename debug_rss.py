
import feedparser
import time
import calendar
from urllib.parse import quote
import datetime

query = "中国 -中国地方 -中国電力 -中国銀行 -中国道 -中国新人 -中国大会 -TVer -电视剧 -第*集 -有料記事 -会員限定"
encoded_query = quote(query)

# Test 1: Standard URL (No scoring, no tbs)
url1 = f"https://news.google.com/rss/search?q={encoded_query}&hl=ja&gl=JP&ceid=JP:ja"

# Test 2: Standard URL + when:2d inside query
detailed_query = query + " when:2d"
encoded_detailed = quote(detailed_query)
url2 = f"https://news.google.com/rss/search?q={encoded_detailed}&hl=ja&gl=JP&ceid=JP:ja"

print(f"Current System Time: {time.time()}")
print(f"Current Local Time: {datetime.datetime.now()}")

for name, u in [("Standard URL", url1), ("Query when:2d", url2)]:
    print(f"\n--- Testing {name} ---")
    print(f"URL: {u}")
    feed = feedparser.parse(u)
    print(f"Entries found: {len(feed.entries)}")
    
    if len(feed.entries) > 0:
        print("First 3 entries:")
        for i, entry in enumerate(feed.entries[:3]):
            print(f"[{i}] Title: {entry.title}")
            print(f"    Published Raw: {entry.published}")
            if hasattr(entry, 'published_parsed'):
                # 检查解析后的时间
                ts = calendar.timegm(entry.published_parsed)
                dt = datetime.datetime.fromtimestamp(ts)
                print(f"    Parsed Timestamp: {ts} -> {dt}")
                
                # Check filter logic
                cutoff_ts = time.time() - (48 * 3600)
                if ts < cutoff_ts:
                     print(f"    [FILTER CHECK] Would include? NO (Too Old)")
                else:
                     print(f"    [FILTER CHECK] Would include? YES")
            else:
                print("    Parsed: None")
