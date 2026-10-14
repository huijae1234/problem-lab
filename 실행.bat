@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" echo API 키 없이 실행합니다. 직접 작성과 저장은 정상적으로 사용할 수 있어요.
start "" http://localhost:8765
where py >nul 2>nul && py server.py && goto :end
where python >nul 2>nul && python server.py && goto :end
where node >nul 2>nul && node server.mjs && goto :end
echo Python이나 Node.js가 없어 서버를 켤 수 없어요. 둘 중 하나를 설치해 주세요.
:end
pause
