import os
import urllib.request
import json
import time
import ssl

# Bypass SSL verification if needed (for some local envs)
ssl._create_default_https_context = ssl._create_unverified_context

R2_PUBLIC_URL = "https://pub-cf7a92abc9c3455da9ccb7cea39a6cda.r2.dev"
PUBLIC_DIR = os.path.join(os.getcwd(), "public")
ARCHIVE_DIR = os.path.join(PUBLIC_DIR, "archive")

os.makedirs(ARCHIVE_DIR, exist_ok=True)

def download_file(url_path, local_path):
    url = f"{R2_PUBLIC_URL}/{url_path}?t={int(time.time())}"
    print(f"Downloading {url} -> {local_path} ...")
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            if response.status == 200:
                content = response.read()
                with open(local_path, "wb") as f:
                    f.write(content)
                return True
            else:
                print(f"⚠️ Failed to download {url_path}: Status {response.status}")
                return False
    except Exception as e:
        print(f"❌ Error downloading {url_path}: {e}")
        return False

def sync():
    # 1. Download data.json
    download_file("data.json", os.path.join(PUBLIC_DIR, "data.json"))
    
    # 2. Download live_data.json
    download_file("live_data.json", os.path.join(PUBLIC_DIR, "live_data.json"))

    # 3. Download archive/index.json
    index_success = download_file("archive/index.json", os.path.join(ARCHIVE_DIR, "index.json"))

    # 4. Download all archives in index
    if index_success:
        try:
            with open(os.path.join(ARCHIVE_DIR, "index.json"), "r", encoding="utf-8") as f:
                index_data = json.load(f)
            
            dates = list(index_data.keys())
            print(f"Found {len(dates)} archive dates in index.")
            
            for date_str in dates:
                filename = f"{date_str}.json"
                download_file(f"archive/{filename}", os.path.join(ARCHIVE_DIR, filename))
                
        except Exception as e:
            print(f"❌ Error processing index: {e}")

if __name__ == "__main__":
    sync()
