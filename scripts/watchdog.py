import subprocess
import time
import sys
import os
import requests
import signal

# 配置
SERVER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
HEALTH_URL = "http://127.0.0.1:8000/health"
CHECK_INTERVAL = 60  # 检查间隔（秒）
STARTUP_DELAY = 10   # 启动/重启后的等待时间（秒）
MAX_FAILURES = 3     # 连续失败多少次后强制重启

# 配置
SERVER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_FILE = os.path.join(LOG_DIR, "watchdog.log")
HEALTH_URL = "http://127.0.0.1:8000/health"
CHECK_INTERVAL = 60  # 检查间隔（秒）
STARTUP_DELAY = 10   # 启动/重启后的等待时间（秒）
MAX_FAILURES = 3     # 连续失败多少次后强制重启

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

def log(msg):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    formatted_msg = f"[{timestamp}] {msg}"
    try:
        # 同时输出到控制台（调试用）和文件（后台用）
        print(formatted_msg)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(formatted_msg + "\n")
    except Exception:
        pass

def run_server():
    log("🚀 正在启动 server.py ...")
    # 使用当前 python 解释器启动子进程
    return subprocess.Popen(
        [sys.executable, SERVER_SCRIPT],
        cwd=os.path.dirname(SERVER_SCRIPT)
    )

def check_health():
    try:
        r = requests.get(HEALTH_URL, timeout=5)
        if r.status_code == 200:
            return True, None
        return False, f"Status Code: {r.status_code}"
    except Exception as e:
        return False, str(e)

def kill_process(process):
    try:
        log("⚠️ 正在强制终止进程...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        log("✅ 进程已终止")
    except Exception as e:
        log(f"❌ 终止进程失败: {e}")

def main():
    # 刚启动时（如唤醒后），给一点时间让网络恢复
    log(f"🕒 守护进程已启动，等待 {STARTUP_DELAY} 秒以确保网络连接...")
    time.sleep(STARTUP_DELAY)

    process = run_server()
    # 给服务器一点启动时间
    time.sleep(5)
    
    failure_count = 0

    try:
        while True:
            # 1. 检查进程是否存活
            if process.poll() is not None:
                log("❌ 检测到 server.py 已退出，准备重启...")
                process = run_server()
                failure_count = 0 # 重置计数
                time.sleep(STARTUP_DELAY)
                continue

            # 2. 心跳检测 (Health Check)
            is_healthy, error_msg = check_health()
            
            if is_healthy:
                if failure_count > 0:
                    log("✅ 服务已恢复健康")
                failure_count = 0
            else:
                failure_count += 1
                log(f"⚠️ 健康检查失败 ({failure_count}/{MAX_FAILURES}): {error_msg}")
                
                if failure_count >= MAX_FAILURES:
                    log("🔥 连续失败达到上限，正在重启服务...")
                    kill_process(process)
                    process = run_server()
                    failure_count = 0
                    time.sleep(STARTUP_DELAY)

            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        log("👋 接收到停止信号，正在退出...")
        if process:
            kill_process(process)
        sys.exit(0)

if __name__ == "__main__":
    main()
