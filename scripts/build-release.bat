@echo off
echo ========================================
echo Building Daily Note Release Version...
echo ========================================
echo.

REM 构建后端
echo [1/3] Building backend...
cd backend
call bun build ./src/index.ts --compile --outfile ./dist/daily-note-backend.exe
cd ..

REM 构建前端
echo [2/3] Building frontend...
cd frontend
call pnpm run build
cd ..

REM 构建 Tauri Release（会自动处理 sidecar 重命名）
echo [3/3] Building Tauri application...
cd src-tauri
cargo build --release
cd ..

REM 复制文件到项目根目录
echo.
echo Copying files...
copy src-tauri\target\release\daily-note.exe .\
copy backend\dist\daily-note-backend.exe .\

REM 创建数据目录结构
if not exist data mkdir data
if not exist data\database mkdir data\database

REM 复制 .env 模板
copy backend\.env .env

echo.
echo ========================================
echo Release Build Complete!
echo ========================================
echo Main: daily-note.exe
echo Backend: daily-note-backend.exe
echo.
echo Usage:
echo   1. Edit .env and add your ANTHROPIC_API_KEY
echo   2. Run daily-note.exe (backend starts automatically)
echo ========================================
pause
