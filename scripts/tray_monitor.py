import pystray
from PIL import Image, ImageDraw
import time
import requests
import threading
import subprocess
import os
import sys
import msvcrt

# 配置
HEALTH_URL = "http://127.0.0.1:8000/health"
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(SERVER_DIR, "logs", "analysis.log")
START_BAT = os.path.join(SERVER_DIR, "start_server.bat")
LOCK_FILE = os.path.join(SERVER_DIR, ".monitor.lock")

def is_already_running():
    try:
        # 尝试创建并锁定一个文件
        f = open(LOCK_FILE, 'w')
        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        # 保持文件句柄打开
        return f
    except:
        return None

def get_gpu_vram_usage():
    """使用 nvidia-smi 获取显存使用率"""
    try:
        # 获取已用显存和总显存
        cmd = ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"]
        
        # 在 Windows 上隐藏子进程窗口
        startupinfo = None
        creationflags = 0
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NO_WINDOW
            
        output = subprocess.check_output(
            cmd, 
            encoding='utf-8', 
            timeout=2, 
            startupinfo=startupinfo,
            creationflags=creationflags
        ).strip()
        
        used, total = map(int, output.split(','))
        percent = int((used / total) * 100)
        return percent, f"{used}/{total} MB ({percent}%)"
    except Exception:
        return None, "无法获取 GPU 信息"

class TrayMonitor:
    def __init__(self):
        self.status = "检查中..."
        self.ollama_status = "未知"
        self.r2_status = "未知"
        self.vram_info = "未知"
        self.vram_percent = 0
        self.icon_color = "gray"
        self.icon = None
        self.stop_event = threading.Event()

    def create_battery_image(self, percent, color):
        """创建一个竖着放的电池形状图标"""
        if percent is None:
            percent = 0
        
        # 64x64 图标
        image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        
        # 电池壳参数 (竖向)
        # 外框 (宽一点，长一点，居中)
        rect_x0, rect_y0, rect_x1, rect_y1 = 18, 14, 46, 58
        # 电池头 (在顶部)
        head_x0, head_y0, head_x1, head_y1 = 26, 8, 38, 14
        
        # 绘制电池外壳
        border_color = (200, 200, 200, 255)
        draw.rectangle([rect_x0, rect_y0, rect_x1, rect_y1], outline=border_color, width=4)
        draw.rectangle([head_x0, head_y0, head_x1, head_y1], fill=border_color)
        
        # 绘制填充 (从下往上长)
        fill_max_height = (rect_y1 - 4) - (rect_y0 + 4)
        fill_height = int(fill_max_height * (percent / 100))
        
        if fill_height > 0:
            # 填充颜色
            if color == "green":
                fill_color = (34, 197, 94, 255) # 亮绿
            elif color == "red":
                fill_color = (239, 68, 68, 255) # 亮红
            elif color == "yellow":
                fill_color = (234, 179, 8, 255) # 黄
            else:
                fill_color = (156, 163, 175, 255) # 灰
            
            # 底部坐标是 rect_y1 - 4，顶部随百分比变化
            draw.rectangle([rect_x0 + 4, rect_y1 - 4 - fill_height, rect_x1 - 4, rect_y1 - 4], fill=fill_color)
            
        return image

    def get_menu(self):
        return pystray.Menu(
            pystray.MenuItem(f"显存占用: {self.vram_info}", lambda: None, enabled=False),
            pystray.MenuItem(f"整体状态: {self.status}", lambda: None, enabled=False),
            pystray.MenuItem(f"Ollama: {self.ollama_status}", lambda: None, enabled=False),
            pystray.MenuItem(f"R2 存储: {self.r2_status}", lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("查看日志", self.show_logs),
            pystray.MenuItem("仅重启 AI 解读后端", self.restart_only_server),
            pystray.MenuItem("尝试重启所有服务 (含 Ollama)", self.restart_service),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出监控", self.on_exit)
        )

    def show_logs(self):
        if os.path.exists(LOG_FILE):
            os.startfile(LOG_FILE)

    def restart_only_server(self):
        try:
            # 在 Windows 上隐藏子进程窗口
            startupinfo = None
            creationflags = 0
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                creationflags = subprocess.CREATE_NO_WINDOW

            # 仅杀掉 python.exe (通常是 server.py)
            subprocess.run(
                ["taskkill", "/F", "/IM", "python.exe"], 
                capture_output=True,
                startupinfo=startupinfo,
                creationflags=creationflags
            )
            # 重启后端
            subprocess.Popen(
                [sys.executable.replace("python.exe", "pythonw.exe"), "server.py"], 
                cwd=SERVER_DIR,
                creationflags=creationflags
            )
        except Exception as e:
            self.log_error(f"Restart server only failed: {e}")

    def restart_service(self):
        try:
            # 在 Windows 上隐藏子进程窗口
            startupinfo = None
            creationflags = 0
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                creationflags = subprocess.CREATE_NO_WINDOW

            current_pid = os.getpid()
            kill_cmd = f"Get-Process | Where-Object {{ ($_.Name -eq 'python' -or $_.Name -eq 'pythonw') -and $_.Id -ne {current_pid} }} | Stop-Process -Force"
            subprocess.run(
                ["powershell", "-Command", kill_cmd], 
                capture_output=True,
                startupinfo=startupinfo,
                creationflags=creationflags
            )
            
            ollama_path = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
            if os.path.exists(ollama_path):
                subprocess.Popen(
                    ["powershell", "-Command", f"Start-Process '{ollama_path}' -ArgumentList 'serve' -WindowStyle Hidden"],
                    creationflags=creationflags
                )
            
            subprocess.Popen(
                [START_BAT], 
                shell=True, 
                cwd=SERVER_DIR,
                creationflags=creationflags
            )
        except Exception as e:
            self.log_error(f"Restart all services failed: {e}")

    def log_error(self, msg):
        with open(os.path.join(SERVER_DIR, "logs", "monitor_error.log"), "a", encoding="utf-8") as f:
            f.write(f"{time.ctime()}: {msg}\n")

    def on_exit(self, icon, item):
        self.stop_event.set()
        icon.stop()

    def check_loop(self, icon):
        while not self.stop_event.is_set():
            # 1. 获取显存信息
            p, info = get_gpu_vram_usage()
            self.vram_percent = p
            self.vram_info = info

            # 2. 获取服务健康状态
            try:
                r = requests.get(HEALTH_URL, timeout=3)
                if r.status_code == 200:
                    data = r.json()
                    self.ollama_status = "✅ 已连接" if data.get("ollama") == "connected" else f"❌ 异常 ({data.get('ollama')})"
                    self.r2_status = "✅ 已连接" if data.get("r2") == "connected" else f"❌ 异常 ({data.get('r2')})"
                    
                    if data.get("status") == "ok":
                        new_status = "全线正常"
                        new_color = "green"
                    else:
                        new_status = "部分组件异常"
                        new_color = "yellow"
                else:
                    new_status = "FastAPI 异常"
                    new_color = "yellow"
                    self.ollama_status = "未知"
                    self.r2_status = "未知"
            except Exception:
                new_status = "服务未启动"
                new_color = "red"
                self.ollama_status = "后端未就绪"
                self.r2_status = "无法连接"

            # 3. 更新图标和菜单 (即使百分比变化也要更新图标)
            self.status = new_status
            self.icon_color = new_color
            icon.icon = self.create_battery_image(self.vram_percent, new_color)
            icon.title = f"AI 解读服务: {self.status}\nVRAM: {self.vram_info}"
            icon.menu = self.get_menu()

            time.sleep(10)

    def run(self):
        self.icon = pystray.Icon(
            "AI_Monitor",
            self.create_battery_image(0, "gray"),
            title="AI 解读服务: 检查中...",
            menu=self.get_menu()
        )
        
        threading.Thread(target=self.check_loop, args=(self.icon,), daemon=True).start()
        self.icon.run()

if __name__ == "__main__":
    lock_file_handle = is_already_running()
    if not lock_file_handle:
        sys.exit(0)
    
    monitor = TrayMonitor()
    monitor.run()
