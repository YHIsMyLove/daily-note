@echo off
echo ========================================
echo   添加 Daily Note Backend 到开机启动
echo ========================================
echo.

set TARGET=%~dp0start.bat
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_FOLDER%\Daily-Note-Backend.lnk

echo 创建快捷方式到: %SHORTCUT%
echo 目标文件: %TARGET%
echo.

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Daily Note Backend Service'; $s.Save()"

if exist "%SHORTCUT%" (
    echo.
    echo [成功] 开机启动项已添加！
    echo.
    echo 快捷方式位置: %SHORTCUT%
    echo.
    echo 如需移除开机启动，请删除该快捷方式文件
) else (
    echo.
    echo [失败] 创建快捷方式失败，请以管理员身份运行
)

echo.
pause
