@echo off
cd /d "%~dp0"
start "Daily Note Backend" /min node dist/start.js
