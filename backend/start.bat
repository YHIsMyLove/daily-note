@echo off
echo Starting Daily Note Backend...
cd /d "%~dp0"
cd ..
pnpm dev:backend
pause
