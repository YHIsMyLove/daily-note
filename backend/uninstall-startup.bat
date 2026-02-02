@echo off
echo ========================================
echo   移除 Daily Note Backend 开机启动
echo ========================================
echo.

set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_FOLDER%\Daily-Note-Backend.lnk

echo 目标文件: %SHORTCUT%
echo.

if exist "%SHORTCUT%" (
    del "%SHORTCUT%"
    echo [成功] 开机启动项已移除！
) else (
    echo [提示] 未找到开机启动项
)

echo.
pause
