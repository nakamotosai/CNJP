
import os
import json
import daily_digest


import os
import json
import boto3
from datetime import datetime, timedelta
import daily_digest

def clean_r2_direct(days_back=15):
    client = daily_digest.get_r2_client()
    if not client:
        print("[!] No R2 client available. Cannot clean cloud archives.")
        return

    # Check last N days
    base = datetime.now()
    date_list = [base - timedelta(days=x) for x in range(days_back + 1)]
    
    print(f"[*] Starting Cloud Cleanup for last {days_back} days...")

    for date_obj in date_list:
        date_str = date_obj.strftime('%Y-%m-%d')
        
        # --- 1. Clean Raw Source (archive/YYYY-MM-DD.json) ---
        source_key = f"{daily_digest.R2_SOURCE_PREFIX}{date_str}.json"
        try:
            try:
                obj = client.get_object(Bucket=daily_digest.R2_BUCKET_NAME, Key=source_key)
                content = obj['Body'].read().decode('utf-8')
                raw_data = json.loads(content)
            except client.exceptions.NoSuchKey:
                # print(f"    [Source] {date_str}: Not found.")
                raw_data = None
            
            if raw_data:
                original_len = len(raw_data)
                cleaned_data = [
                    item for item in raw_data 
                    if "TVer" not in item.get('origin', '') and 
                       "TVer" not in item.get('title', '') and
                       "TVer" not in item.get('title_cn', '')
                ]
                
                if len(cleaned_data) < original_len:
                    diff = original_len - len(cleaned_data)
                    print(f"    [!] Source {date_str}: Found & Removing {diff} TVer items.")
                    # Re-upload
                    daily_digest.upload_json_to_r2(client, json.dumps(cleaned_data, ensure_ascii=False), source_key)
                else:
                    # print(f"    [Source] {date_str}: Clean.")
                    pass

        except Exception as e:
            print(f"    [!] Error checking source {date_str}: {e}")


        # --- 2. Clean Summary (ollama/YYYY-MM-DD_summary.json) ---
        summary_key = f"{daily_digest.R2_TARGET_PREFIX}{date_str}_summary.json"
        try:
            try:
                obj = client.get_object(Bucket=daily_digest.R2_BUCKET_NAME, Key=summary_key)
                content = obj['Body'].read().decode('utf-8')
                summary_data = json.loads(content)
            except client.exceptions.NoSuchKey:
                summary_data = None
            
            if summary_data:
                highlights = summary_data.get('key_highlights', [])
                new_highlights = [
                    h for h in highlights 
                    if "TVer" not in h.get('origin', '') and "TVer" not in h.get('title', '')
                ]
                
                if len(new_highlights) < len(highlights):
                     diff = len(highlights) - len(new_highlights)
                     print(f"    [!] Summary {date_str}: Found & Removing {diff} TVer items.")
                     summary_data['key_highlights'] = new_highlights
                     daily_digest.upload_json_to_r2(client, json.dumps(summary_data, ensure_ascii=False, indent=2), summary_key)
                else:
                     # print(f"    [Summary] {date_str}: Clean.")
                     pass

        except Exception as e:
             print(f"    [!] Error checking summary {date_str}: {e}")

if __name__ == "__main__":
    print("=== Direct R2 Cloud Cleanup initiated ===")
    clean_r2_direct()
    print("=== Cloud Cleanup Complete ===")
