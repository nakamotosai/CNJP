import os
import json
import subprocess
from dotenv import load_dotenv

load_dotenv('scripts/.env')
load_dotenv('.env.local')

OLLAMA_API_URL = os.getenv('OLLAMA_API_URL', 'https://ollama.saaaai.com/api/generate')
OLLAMA_MODEL = "qwen3:8b"
CF_ACCESS_CLIENT_ID = os.getenv('CF_ACCESS_CLIENT_ID')
CF_ACCESS_CLIENT_SECRET = os.getenv('CF_ACCESS_CLIENT_SECRET')

print(f"URL: {OLLAMA_API_URL}")
print(f"Model: {OLLAMA_MODEL}")

payload = {
    "model": OLLAMA_MODEL,
    "prompt": "Say hello",
    "stream": False
}

curl_cmd = [
    "curl", "-v", "-L", "-X", "POST", OLLAMA_API_URL,
    "-H", f"CF-Access-Client-Id: {CF_ACCESS_CLIENT_ID}",
    "-H", f"CF-Access-Client-Secret: {CF_ACCESS_CLIENT_SECRET}",
    "-H", "Content-Type: application/json",
    "-d", json.dumps(payload)
]

print("Running curl...")
result = subprocess.run(curl_cmd, capture_output=True, text=True, encoding='utf-8')
print(f"Return code: {result.returncode}")
print(f"Stdout: {result.stdout}")
print(f"Stderr: {result.stderr}")
