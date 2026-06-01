#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 把 frontend/ 一并打入；config_local.py 必须存在（含 API Key）
test -f backend/config_local.py || { echo "缺少 backend/config_local.py (API Key)"; exit 1; }

pyinstaller --noconfirm --windowed --name "SpeakingStar" \
  --add-data "frontend:frontend" \
  --hidden-import backend.config_local \
  run.py

# 用 hdiutil 封装 .dmg
APP="dist/SpeakingStar.app"
test -d "$APP" || { echo "打包未生成 .app"; exit 1; }
rm -f dist/SpeakingStar.dmg
hdiutil create -volname "SpeakingStar" -srcfolder "$APP" -ov -format UDZO dist/SpeakingStar.dmg
echo "完成：dist/SpeakingStar.dmg"
