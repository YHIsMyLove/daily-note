@echo off
cd /d "%~dp0"
start "" /b powershell -WindowStyle Hidden -Command "node dist/start.js"
