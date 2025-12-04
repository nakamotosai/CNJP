@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo     cn.saaaai.com 一键推送神器
echo ========================================
echo.

:: 让用户输入 commit 描述（支持回车跳过用时间自动生成）
set "msg="
set /p msg=请输入本次提交描述（直接回车使用时间自动生成）： 

:: 如果用户没输入，就用日期+时间当描述
if "%msg%"=="" (
    set "msg=update %date:~0,4%-%date:~5,2%-%date:~8,2% %time:~0,2%:%time:~3,2%"
)

echo.
echo 正在添加所有改动文件...
git add -A
if %errorlevel% neq 0 goto error

echo.
echo 正在提交，描述：%msg%
git commit -m "%msg%"
if %errorlevel% neq 0 goto error

echo.
echo 正在同步 GitHub 上最新的 JSON 数据文件...
git fetch origin
git checkout origin/main -- *.json
echo JSON 已更新完成！
echo.

echo 正在强力推送你的最新代码到 GitHub...
git push --force-with-lease origin main
if %errorlevel% neq 0 goto error

echo.
echo ███████╗成功！全部代码已成功推送到 GitHub！
echo 快去 https://cn.saaaai.com 看看最新效果吧～
echo.
echo 按任意键退出...
pause >nul
exit

:error
echo.
echo ××××× 出错了！可能原因：
echo   1. 没有改动任何文件（空提交被拒绝）
echo   2. 有冲突没有解决
echo   3. 网络问题
echo   4. GitHub 权限问题
echo.
echo 请打开命令行手动执行一遍看看具体错误
echo.
pause