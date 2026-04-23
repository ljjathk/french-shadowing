@echo off
echo 正在启动法语跟读应用...
start "" "http://localhost:8000"
python -m http.server 8000
pause
