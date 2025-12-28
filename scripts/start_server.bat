@echo off
:: FastAPI AI 解读服务启动脚本 (静默运行)
:: 放在启动文件夹中开机自动运行

cd /d C:\Users\sai\cnjp\scripts
:: 使用 pyw 以完全隐藏黑色命令行窗口
start /b pyw server.py
start /b pyw tray_monitor.py
