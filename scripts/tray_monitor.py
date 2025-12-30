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
SERVER_PID_FILE = os.path.join(SERVER_DIR, ".server.pid")

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

def get_server_pid():
    """获取 server.py 进程的 PID"""
    try:
        startupinfo = None
        creationflags = 0
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NO_WINDOW
        
        # 使用 PowerShell 查找运行 server.py 的进程
        result = subprocess.run(
            ["powershell", "-Command", 
             "Get-Process python*, pythonw* -ErrorAction SilentlyContinue | ForEach-Object { $p = $_; try { if ($p.CommandLine -like '*server.py*') { $p.Id } } catch {} }"],
            capture_output=True,
            text=True,
            startupinfo=startupinfo,
            creationflags=creationflags
        )
        
        pids = [int(pid.strip()) for pid in result.stdout.strip().split('\n') if pid.strip().isdigit()]
        return pids
    except Exception:
        return []

def kill_server_process():
    """只杀死 server.py 进程，不影响其他 Python 进程"""
    try:
        startupinfo = None
        creationflags = 0
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NO_WINDOW
        
        # 方法1：通过端口找到进程并杀死
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            startupinfo=startupinfo,
            creationflags=creationflags
        )
        
        killed = False
        for line in result.stdout.split('\n'):
            if ':8000' in line and 'LISTENING' in line:
                parts = line.split()
                if parts:
                    pid = parts[-1]
                    try:
                        pid_int = int(pid)
                        # 不要杀死 tray_monitor 自己
                        if pid_int != os.getpid():
                            subprocess.run(
                                ['taskkill', '/F', '/PID', pid],
                                capture_output=True,
                                startupinfo=startupinfo,
                                creationflags=creationflags
                            )
                            killed = True
                    except (ValueError, subprocess.SubprocessError):
                        pass
        
        return killed
    except Exception:
        return False

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
            pystray.MenuItem("一键清理系统内存", self.clean_memory),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("仅重启 AI 解读后端", self.restart_only_server),
            pystray.MenuItem("尝试重启所有服务 (含 Ollama)", self.restart_service),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出监控", self.on_exit)
        )

    def show_logs(self):
        if os.path.exists(LOG_FILE):
            os.startfile(LOG_FILE)

    def clean_memory(self):
        """执行系统内存清理 (Trim Working Sets)"""
        try:
            # 提高权限并在后台运行 PowerShell 脚本来清理所有进程的内存
            # 使用 EmptyWorkingSet API 的 PowerShell 实现
            ps_script = """
            $code = @'
            [DllImport("psapi.dll")]
            public static extern int EmptyWorkingSet(IntPtr hProcess);
'@
            $type = Add-Type -MemberDefinition $code -Name "MemUtil" -Namespace "Win32" -PassThru
            Get-Process | Where-Object { $_.Id -gt 0 } | ForEach-Object {
                try {
                    $res = $type::EmptyWorkingSet($_.Handle)
                } catch {}
            }
            """
            
            startupinfo = None
            creationflags = 0
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                creationflags = subprocess.CREATE_NO_WINDOW

            subprocess.Popen(
                ["powershell", "-Command", ps_script],
                startupinfo=startupinfo,
                creationflags=creationflags
            )
            
            # 使用 Windows 系统通知 (Toast) 告知用户
            # 这里简单起见通过 PowerShell 发送一个系统级通知
            notify_script = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, '内存清理完成', '已成功尝试整理并释放系统内存。', [System.Windows.Forms.ToolTipIcon]::Info)"
            subprocess.Popen(
                ["powershell", "-Command", notify_script],
                startupinfo=startupinfo,
                creationflags=creationflags
            )

        except Exception as e:
            self.log_error(f"Memory cleanup failed: {e}")

    def restart_only_server(self):
        """只重启 server.py，不影响其他 Python 进程（包括 tray_monitor 自己）"""
        try:
            startupinfo = None
            creationflags = 0
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                creationflags = subprocess.CREATE_NO_WINDOW

            # 只杀死端口 8000 上的进程（即 server.py）
            kill_server_process()
            
            # 等待进程完全终止
            time.sleep(2)
            
            # 重启 server.py
            subprocess.Popen(
                [sys.executable.replace("python.exe", "pythonw.exe"), "server.py"], 
                cwd=SERVER_DIR,
                creationflags=creationflags
            )
            
            # 显示通知
            notify_script = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, 'AI 解读后端', '正在重启中，请稍候...', [System.Windows.Forms.ToolTipIcon]::Info)"
            subprocess.Popen(
                ["powershell", "-Command", notify_script],
                startupinfo=startupinfo,
                creationflags=creationflags
            )
            
        except Exception as e:
            self.log_error(f"Restart server only failed: {e}")

    def restart_service(self):
        """重启所有服务（包括 Ollama）"""
        try:
            startupinfo = None
            creationflags = 0
            if os.name == 'nt':
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                creationflags = subprocess.CREATE_NO_WINDOW

            current_pid = os.getpid()
            
            # 只杀死 server.py 进程（通过端口检测）
            kill_server_process()
            
            # 等待进程终止
            time.sleep(2)
            
            # 重启 Ollama
            ollama_path = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
            if os.path.exists(ollama_path):
                subprocess.Popen(
                    ["powershell", "-Command", f"Start-Process '{ollama_path}' -ArgumentList 'serve' -WindowStyle Hidden"],
                    creationflags=creationflags
                )
            
            # 重启 server.py
            subprocess.Popen(
                [START_BAT], 
                shell=True, 
                cwd=SERVER_DIR,
                creationflags=creationflags
            )
            
            # 显示通知
            notify_script = "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, 'AI 服务', '正在重启所有服务，请稍候...', [System.Windows.Forms.ToolTipIcon]::Info)"
            subprocess.Popen(
                ["powershell", "-Command", notify_script],
                startupinfo=startupinfo,
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
        fail_count = 0
        while not self.stop_event.is_set():
            # 1. 获取显存信息
            p, info = get_gpu_vram_usage()
            self.vram_percent = p
            self.vram_info = info

            # 2. 获取服务健康状态
            new_status = self.status
            new_color = self.icon_color
            
            try:
                # 稍微增加超时时间到 5 秒
                r = requests.get(HEALTH_URL, timeout=5)
                if r.status_code == 200:
                    fail_count = 0
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
                    fail_count += 1
            except Exception:
                fail_count += 1

            # 容错处理：只有连续失败 3 次以上才变红
            if fail_count >= 3:
                new_status = "服务响应异常"
                new_color = "red"
                self.ollama_status = "后端未就绪"
                self.r2_status = "无法连接"
            elif fail_count > 0:
                # 如果只是偶尔一次失败，保持之前的颜色，但状态显示繁忙/重试
                new_status = f"服务繁忙 ({fail_count}/3)"
                # 保持原有的 new_color (通常是 green)
            
            # 3. 更新图标和菜单
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
