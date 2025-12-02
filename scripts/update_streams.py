import os
import json
from googleapiclient.discovery import build
import datetime

# Configuration
# 修改点：不再使用 "YOUR_API_KEY_HERE" 作为默认值，避免被安全扫描误判
API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID")
OUTPUT_FILE = "public/live_data.json"

def get_live_stream_id(api_key, channel_id):
    """
    Fetches the current live video ID for a given channel.
    """
    try:
        # 构建 YouTube API 客户端
        youtube = build("youtube", "v3", developerKey=api_key)

        # 搜索该频道正在进行的直播
        request = youtube.search().list(
            part="id,snippet",
            channelId=channel_id,
            eventType="live",  # 只搜直播
            type="video",
            maxResults=1
        )
        response = request.execute()

        # 如果找到了直播
        if response.get("items"):
            video = response["items"][0]
            video_id = video["id"]["videoId"]
            title = video["snippet"]["title"]
            print(f"✅ Found live stream: {title} ({video_id})")
            return {
                "isLive": True,
                "videoId": video_id,
                "title": title,
                "lastUpdated": datetime.datetime.now().isoformat()
            }
        else:
            print("⚠️ No live stream found on this channel.")
            return {
                "isLive": False,
                "videoId": None,
                "title": None,
                "lastUpdated": datetime.datetime.now().isoformat()
            }

    except Exception as e:
        print(f"❌ An error occurred: {e}")
        # 返回错误信息，但不中断流程，以免覆盖旧数据（可选）
        return {
            "isLive": False,
            "error": str(e),
            "lastUpdated": datetime.datetime.now().isoformat()
        }

def save_to_json(data, filename):
    """
    Saves the data to a JSON file.
    """
    # 确保目录存在
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"💾 Data saved to {filename}")

if __name__ == "__main__":
    # 严格检查：如果环境变量为空，直接抛出异常，让 GitHub Action 报错提醒你
    if not API_KEY or not CHANNEL_ID:
        raise ValueError("❌ 错误: 未找到 API Key 或 Channel ID！请检查 GitHub Secrets 设置。")

    print("🚀 Starting update script...")
    data = get_live_stream_id(API_KEY, CHANNEL_ID)
    save_to_json(data, OUTPUT_FILE)
    print("✨ Done.")