import os
import json
from googleapiclient.discovery import build
import datetime

# Configuration
# 建议将这些敏感信息配置在 GitHub Secrets 中
API_KEY = os.environ.get("YOUTUBE_API_KEY", "YOUR_API_KEY_HERE")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID", "YOUR_CHANNEL_ID_HERE")
OUTPUT_FILE = "public/live_data.json"

def get_live_stream_id(api_key, channel_id):
    """
    Fetches the current live video ID for a given channel.
    """
    try:
        youtube = build("youtube", "v3", developerKey=api_key)

        # Search for live broadcasts on the channel
        request = youtube.search().list(
            part="id,snippet",
            channelId=channel_id,
            eventType="live",
            type="video",
            maxResults=1
        )
        response = request.execute()

        if response.get("items"):
            video = response["items"][0]
            video_id = video["id"]["videoId"]
            title = video["snippet"]["title"]
            print(f"Found live stream: {title} ({video_id})")
            return {
                "isLive": True,
                "videoId": video_id,
                "title": title,
                "lastUpdated": datetime.datetime.now().isoformat()
            }
        else:
            print("No live stream found.")
            return {
                "isLive": False,
                "videoId": None,
                "title": None,
                "lastUpdated": datetime.datetime.now().isoformat()
            }

    except Exception as e:
        print(f"An error occurred: {e}")
        return {
            "isLive": False,
            "error": str(e),
            "lastUpdated": datetime.datetime.now().isoformat()
        }

def save_to_json(data, filename):
    """
    Saves the data to a JSON file.
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Data saved to {filename}")

if __name__ == "__main__":
    if API_KEY == "YOUR_API_KEY_HERE" or CHANNEL_ID == "YOUR_CHANNEL_ID_HERE":
        print("Warning: API_KEY or CHANNEL_ID not set. Using placeholder data or failing.")
        # For local testing without keys, you might want to comment this out or handle it gracefully
        # exit(1) 

    data = get_live_stream_id(API_KEY, CHANNEL_ID)
    save_to_json(data, OUTPUT_FILE)
