@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    cn.saaaai.com 一键推送神器
echo ========================================
echo.

git add -A
if %errorlevel% neq 0 goto error

git commit -m "update %date:~0,10% %time:~0,8%"
if %errorlevel% neq 0 goto error

echo.
echo 正在同步 GitHub 上最新的 JSON 数据文件...
git fetch origin
git checkout origin/main -- *.json
echo JSON 已更新完成！
echo.

echo 正在强力推送你的最新代码...
git push --force-with-lease origin main
if %errorlevel% neq 0 goto error

echo.
echo ███████╗成功！全部代码已推送到 GitHub！
echo 快去 https://cn.saaaai.com 看看效果吧！
echo.
pause
exit

:error
echo.
echo 出错了！请检查网络或手动推送
pause