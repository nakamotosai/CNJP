import os
import boto3
import json
from dotenv import load_dotenv

# Load credentials
load_dotenv('c:/Users/sai/cnjp/scripts/.env')
load_dotenv('c:/Users/sai/cnjp/.env.local')

R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME')

def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

client = get_r2_client()
try:
    response = client.get_object(Bucket=R2_BUCKET_NAME, Key='ollama/2025-12-30_summary.json')
    content = response['Body'].read().decode('utf-8')
    data = json.loads(content)
    print("KEYS:", data.keys())
    print("\nSUMMARY:\n", data.get('summary'))
    print("\nSECTION_STANCE:", data.get('section_stance'))
    print("\nCOUNT:", data.get('news_count'))
    print("\nHIGHLIGHTS COUNT:", len(data.get('key_highlights', [])))
except Exception as e:
    print(f"Error: {e}")
