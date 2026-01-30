@echo off
echo ========================================
echo Building Daily Note Debug Version...
echo ========================================
echo.

REM 构建 Debug 版本（显示控制台）
cd src-tauri
cargo build
cd ..

REM 复制文件到项目根目录
echo Copying executable...
copy src-tauri\target\debug\daily-note.exe daily-note-debug.exe

REM 创建数据目录
if not exist data mkdir data

REM 复制 .env 模板
copy backend\.env .env.template

echo.
echo ========================================
echo Debug Build Complete!
echo ========================================
echo Executable: daily-note-debug.exe
echo.
echo Debug mode usage:
echo   1. Start backend: cd backend && node dist/index.js
echo   2. Start app: daily-note-debug.exe
echo ========================================
pause
