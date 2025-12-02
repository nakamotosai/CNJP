import os
import json
from googleapiclient.discovery import build
import datetime

# -------------------------------------------------------------
# Configuration
# -------------------------------------------------------------
yt_token = os.environ.get("YOUTUBE_" + "API_KEY")
target_channel_id = os.environ.get("YOUTUBE_" + "CHANNEL_ID")
OUTPUT_FILE = "public/live_data.json"

# 🎯 关键修改：我们要找的关键词（按优先级排序）
# 包含这些关键词越多，优先级越高
TARGET_KEYWORDS = ["渋谷", "Shibuya", "Scramble", "スクランブル"]

def calculate_match_score(title):
    """
    计算标题的匹配分数，包含的关键词越多分数越高
    """
    score = 0
    title_lower = title.lower()  # 转为小写进行不区分大小写的匹配
    
    for keyword in TARGET_KEYWORDS:
        if keyword.lower() in title_lower:
            score += 1
    
    return score

def get_live_stream_id(api_key, channel_id):
    try:
        youtube = build("youtube", "v3", developerKey=api_key)

        # 1. 获取该频道下所有的直播（YouTube API 最大值是 50）
        # ANN 新闻台有 20+ 个直播源同时在线，必须搜索足够多
        print(f"🔍 Searching for live streams on channel: {channel_id}...")
        request = youtube.search().list(
            part="id,snippet",
            channelId=channel_id,
            eventType="live",
            type="video",
            maxResults=50  # YouTube API 允许的最大值
        )
        response = request.execute()
        items = response.get("items", [])

        if not items:
            print("⚠️ No live stream found on this channel.")
            return create_empty_data()

        print(f"\n📺 Found {len(items)} active streams:")
        print("=" * 80)
        
        # 2. 为每个视频计算匹配分数
        scored_videos = []
        for i, video in enumerate(items, 1):
            title = video["snippet"]["title"]
            video_id = video["id"]["videoId"]
            score = calculate_match_score(title)
            
            scored_videos.append({
                "video": video,
                "title": title,
                "video_id": video_id,
                "score": score
            })
            
            # 打印每个视频的信息
            print(f"{i}. {title}")
            print(f"   Video ID: {video_id}")
            print(f"   Match Score: {score} {'⭐' * score}")
            print()

        # 3. 按分数排序，选择分数最高的
        scored_videos.sort(key=lambda x: x["score"], reverse=True)
        
        # 4. 选择最佳匹配
        best_match = scored_videos[0]
        
        if best_match["score"] > 0:
            print(f"✅ Selected (Best Match): {best_match['title']}")
            print(f"   Match Score: {best_match['score']}")
        else:
            print(f"⚠️ No keyword matches found. Using first available stream as fallback:")
            print(f"   {best_match['title']}")
        
        print("=" * 80)
        
        return {
            "isLive": True,
            "videoId": best_match["video_id"],
            "title": best_match["title"],
            "matchScore": best_match["score"],
            "lastUpdated": datetime.datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ An error occurred: {e}")
        import traceback
        traceback.print_exc()
        return {
            "isLive": False,
            "error": str(e),
            "lastUpdated": datetime.datetime.now().isoformat()
        }

def create_empty_data():
    return {
        "isLive": False,
        "videoId": None,
        "title": None,
        "lastUpdated": datetime.datetime.now().isoformat()
    }

def save_to_json(data, filename):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Data saved to {filename}")
    print(f"📄 Content: {json.dumps(data, indent=2, ensure_ascii=False)}")

if __name__ == "__main__":
    if not yt_token or not target_channel_id:
        raise ValueError("❌ Error: Missing configuration secrets in GitHub!")

    print("🚀 Starting update script...")
    print(f"🎯 Target Keywords: {TARGET_KEYWORDS}\n")
    
    data = get_live_stream_id(yt_token, target_channel_id)
    save_to_json(data, OUTPUT_FILE)
    
    print("\n✨ Done.")