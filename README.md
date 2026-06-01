# Speaking Star · 幼儿园英语口语比赛

内部使用的英语口语比赛网站。孩子对麦克风说英语，屏幕实时显示识别文字并做首字母高亮。

## 玩法
- **小班 Junior**：随机字母（A C E F K S），连续说该字母开头的单词，30 秒。
- **中班 Middle**：从 S D T F B G 选一个字母，说"单词 + 一句话"，60 秒。

## 本地运行（开发）
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# 创建 backend/config_local.py，写入: API_KEY = "你的 Mimo Key"
python run.py
```
用 **Chrome** 打开自动弹出的地址，允许麦克风。

## 打包
- macOS：`bash build/build_mac.sh` → `dist/SpeakingStar.dmg`
- Windows（须在 Windows 上）：`build\build_windows.bat` → `dist\SpeakingStar\SpeakingStar.exe`

打包前必须存在 `backend/config_local.py`（含 API Key），它会被编入程序、不随源码泄露。

## 现场提示
- 用 Chrome，首次运行点"允许麦克风"。
- 安静环境识别更准；嘈杂时可调 `frontend/js/recorder.js` 的 `threshold`（变大更不灵敏）和 `silenceMs`。
