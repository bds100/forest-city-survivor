@echo off
chcp 65001 >nul
echo 숲이 된 도시 - 로컬 서버를 시작합니다. 이 창을 닫으면 서버가 꺼집니다.
start "" http://localhost:8765/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -Port 8765
