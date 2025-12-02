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

# 🎯 关键修改：我们要找的关键词
# 只要标题里包含这些词，就认为是我们要的目标
TARGET_KEYWORDS = ["渋谷", "Shibuya", "Scramble"]

def get_live_stream_id(api_key, channel_id):
    try:
        youtube = build("youtube", "v3", developerKey=api_key)

        # 1. 获取该频道下所有的直播（把数量 maxResults 提高到 5，防止涩谷排在后面）
        request = youtube.search().list(
            part="id,snippet",
            channelId=channel_id,
            eventType="live",
            type="video",
            maxResults=5 
        )
        response = request.execute()
        items = response.get("items", [])

        if not items:
            print("⚠️ No live stream found on this channel.")
            return create_empty_data()

        # 2. 遍历结果，寻找包含关键词的视频
        selected_video = None
        
        print(f"🔍 Found {len(items)} active streams. Filtering for keywords: {TARGET_KEYWORDS}...")

        for video in items:
            title = video["snippet"]["title"]
            print(f"   - Checking: {title}")
            
            # 检查标题是否包含任一关键词
            for keyword in TARGET_KEYWORDS:
                if keyword in title:
                    selected_video = video
                    print(f"   ✅ Match found! ('{keyword}' in title)")
                    break
            
            if selected_video:
                break

        # 3. 如果没找到涩谷，就拿第一个（比如新闻）做保底，或者你可以选择返回空
        if not selected_video:
            print("⚠️ 没找到涩谷直播，使用第一个可用的直播作为替补。")
            selected_video = items[0]

        # 4. 提取数据
        video_id = selected_video["id"]["videoId"]
        title = selected_video["snippet"]["title"]
        
        return {
            "isLive": True,
            "videoId": video_id,
            "title": title,
            "lastUpdated": datetime.datetime.now().isoformat()
        }

    except Exception as e:
        print(f"❌ An error occurred: {e}")
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
    print(f"💾 Data saved to {filename}")

if __name__ == "__main__":
    if not yt_token or not target_channel_id:
        raise ValueError("❌ Error: Missing configuration secrets in GitHub!")

    print("🚀 Starting update script...")
    data = get_live_stream_id(yt_token, target_channel_id)
    save_to_json(data, OUTPUT_FILE)
    print("✨ Done.")