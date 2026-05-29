@echo off
cd /d %~dp0\..
if not exist backend\config_local.py (
  echo 缺少 backend\config_local.py ^(API Key^)
  exit /b 1
)
pyinstaller --noconfirm --windowed --name "SpeakingStar" ^
  --add-data "frontend;frontend" ^
  --hidden-import backend.config_local ^
  run.py
echo 完成：dist\SpeakingStar\SpeakingStar.exe
