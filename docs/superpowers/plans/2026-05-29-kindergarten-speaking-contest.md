# 国际幼儿园英语口语比赛网站 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个内部使用的英语口语比赛网站：孩子对麦克风说英语，屏幕实时显示识别文字并做首字母高亮，分小班/中班两个玩法，可打包成 macOS `.dmg` / Windows `.exe` 双击运行。

**Architecture:** 单进程 FastAPI 应用，既托管纯静态前端（原生 HTML/CSS/JS，无构建步骤），又提供 `/api/transcribe` 接口；该接口调用小米 Mimo `mimo-v2-omni`（OpenAI 兼容）做语音转写。浏览器端用 Web Audio 捕获 PCM、做静音检测（VAD），"说完一句"就编码成 WAV（16kHz 单声道）上传识别。API Key 存在后端、打包进二进制，前端不可见。

**Tech Stack:** Python 3.11、FastAPI、uvicorn、httpx、pytest / 原生 JS（Web Audio API）、PyInstaller。

依据 spec：`docs/superpowers/specs/2026-05-29-kindergarten-speaking-contest-design.md`

---

## 文件结构

```text
kindergarten-speaking-contest/
├── backend/
│   ├── __init__.py
│   ├── config.py            # BASE_URL / MODEL / API_KEY（env 或 gitignored config_local.py）
│   ├── config_local.py      # 真实 API Key（gitignored，打包时编入二进制）
│   ├── mimo_client.py       # async transcribe_wav(audio_b64, letter) -> str
│   └── main.py              # FastAPI：托管 frontend/ + POST /api/transcribe
├── frontend/
│   ├── index.html           # 开始页（小班 / 中班）
│   ├── junior.html          # 小班页
│   ├── senior.html          # 中班页
│   ├── css/memphis.css      # Memphis 糖果明亮样式
│   └── js/
│       ├── recorder.js      # getUserMedia + VAD + WAV 编码
│       ├── junior.js        # 小班逻辑（随机字母、30s、连续单词）
│       └── senior.js        # 中班逻辑（选字母、60s、单词+句子）
├── tests/
│   ├── __init__.py
│   ├── test_mimo_client.py
│   └── test_transcribe_api.py
├── scripts/
│   └── mimo_smoke_test.py   # 冒烟：确认 mimo-v2-omni 接收 wav 的格式
├── build/
│   ├── build_mac.sh
│   └── build_windows.bat
├── run.py                   # 入口：起 uvicorn 并自动开浏览器（打包入口）
├── requirements.txt
└── README.md
```

各文件单一职责：`mimo_client.py` 只负责拼请求/调用 Mimo/取文本；`main.py` 只做路由与静态托管；`recorder.js` 只负责"录音→VAD→WAV→回调"，不碰页面 DOM；`junior.js`/`senior.js` 各自只管自己页面的玩法与渲染。

---

## Task 1: 项目脚手架与依赖

**Files:**
- Create: `requirements.txt`
- Create: `backend/__init__.py`
- Create: `tests/__init__.py`
- Create: `backend/main.py`（先放一个健康检查）

- [ ] **Step 1: 写 requirements.txt**

```text
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: 创建空包文件**

`backend/__init__.py` 与 `tests/__init__.py` 写入空内容（一个空行即可）。

- [ ] **Step 3: 写最小 FastAPI 应用（含健康检查）**

`backend/main.py`：

```python
from fastapi import FastAPI

app = FastAPI(title="Kindergarten Speaking Contest")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 4: 建虚拟环境并安装依赖**

Run:
```bash
cd ~/Documents/GitHub/kindergarten-speaking-contest
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
Expected: 安装成功，无报错。

- [ ] **Step 5: 启动确认**

Run: `uvicorn backend.main:app --port 8000` 然后另开终端 `curl http://localhost:8000/api/health`
Expected: 返回 `{"status":"ok"}`。确认后 Ctrl-C 停止。

- [ ] **Step 6: Commit**

```bash
git add requirements.txt backend/__init__.py tests/__init__.py backend/main.py
git commit -m "chore: scaffold FastAPI app with health check"
```

---

## Task 2: Mimo 冒烟测试（去风险：确认 omni 接收 wav 的格式）

> 这是一个探索性 spike，目的是在写正式代码前**锁定 `mimo-v2-omni` 的音频请求格式与响应结构**。后续 Task 4 的 `mimo_client` 以此结果为准。

**Files:**
- Create: `scripts/mimo_smoke_test.py`
- Create: `backend/config_local.py`（gitignored）

- [ ] **Step 1: 创建 config_local.py 放真实 Key（不提交）**

`backend/config_local.py`（`.gitignore` 已忽略 `backend/config_local.py`）：

```python
API_KEY = "tp-cq9fzfpucn14r4e8rb1vsyw0wto18ag1rgccbrz353y0s8ph"
```

- [ ] **Step 2: 准备一段测试音频**

录一段约 2 秒、清晰说 "cat" 的英文音频，转成 16kHz 单声道 wav，存为 `scripts/sample.wav`（可用任意工具；macOS 可用 QuickTime 录音后用 `ffmpeg -i in.m4a -ar 16000 -ac 1 scripts/sample.wav` 转换）。`scripts/sample.wav` 不提交。

- [ ] **Step 3: 写冒烟脚本**

`scripts/mimo_smoke_test.py`：

```python
import base64
import json
import sys
import httpx

sys.path.insert(0, ".")
from backend.config_local import API_KEY

BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
MODEL = "mimo-v2-omni"


def main() -> None:
    with open("scripts/sample.wav", "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You transcribe short English speech from young children. "
                "Output ONLY the words you hear, lowercase, no punctuation, no explanation.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Transcribe this audio. The child is saying English words."},
                    {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}},
                ],
            },
        ],
        "temperature": 0,
    }

    resp = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json=payload,
        timeout=30,
    )
    print("HTTP", resp.status_code)
    print(json.dumps(resp.json(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 运行并观察**

Run: `python scripts/mimo_smoke_test.py`
Expected（理想）：HTTP 200，响应里 `choices[0].message.content` ≈ `"cat"`。

如果失败，按下列顺序排查并**把可用格式记录到 spec 第 8 节**：
1. HTTP 4xx 且提示音频字段无效 → 尝试把 `"format": "wav"` 改为 `"mp3"`，或把 `input_audio` 换成 OpenAI 新版 `{"type":"input_audio","input_audio":{...}}` 之外的厂商变体（查 Mimo 文档）。
2. 若 omni 不支持 chat 内嵌音频 → 检查 Mimo 是否提供 `audio/transcriptions`（Whisper 风格）端点，改用之；并据此调整 Task 4。
3. 记下最终可用的：端点路径、音频字段结构、`format` 取值、响应取文本的路径。

- [ ] **Step 5: Commit（只提交脚本，不提交音频与 Key）**

```bash
git add scripts/mimo_smoke_test.py
git commit -m "chore: add mimo-v2-omni smoke test to lock audio request format"
```

---

## Task 3: 后端配置 config.py

**Files:**
- Create: `backend/config.py`

- [ ] **Step 1: 写 config.py**

`backend/config.py`：

```python
import os

BASE_URL = os.getenv("MIMO_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1")
MODEL = os.getenv("MIMO_MODEL", "mimo-v2-omni")

# Key 优先取环境变量；否则从 gitignored 的 config_local.py 读取（打包时随之编入二进制）。
API_KEY = os.getenv("MIMO_API_KEY", "")
if not API_KEY:
    try:
        from backend.config_local import API_KEY as _LOCAL_KEY

        API_KEY = _LOCAL_KEY
    except ImportError:
        API_KEY = ""
```

- [ ] **Step 2: 确认可导入**

Run: `python -c "from backend.config import API_KEY, MODEL; print(bool(API_KEY), MODEL)"`
Expected: `True mimo-v2-omni`（前提：已建 config_local.py）。

- [ ] **Step 3: Commit**

```bash
git add backend/config.py
git commit -m "feat: add backend config (mimo base url / model / api key)"
```

---

## Task 4: Mimo 客户端 mimo_client.py（TDD）

> 若 Task 2 冒烟显示的格式与下面不同，以冒烟结果为准修改 `_build_payload` 与取文本路径；测试用 mock 不受真实格式影响。

**Files:**
- Create: `backend/mimo_client.py`
- Test: `tests/test_mimo_client.py`

- [ ] **Step 1: 写失败测试**

`tests/test_mimo_client.py`：

```python
import pytest
from backend import mimo_client


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


@pytest.mark.asyncio
async def test_transcribe_wav_returns_text(monkeypatch):
    captured = {}

    async def fake_post(self, url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["auth"] = headers["Authorization"]
        return _FakeResponse(
            200,
            {"choices": [{"message": {"content": "  Cat "}}]},
        )

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    text = await mimo_client.transcribe_wav("ZmFrZQ==", letter="C")

    assert text == "cat"  # 去空格 + 小写
    assert captured["url"].endswith("/chat/completions")
    assert captured["auth"].startswith("Bearer ")
    # 字母上下文应进入提示
    dumped = str(captured["json"])
    assert "C" in dumped
    assert "input_audio" in dumped


@pytest.mark.asyncio
async def test_transcribe_wav_empty_on_blank(monkeypatch):
    async def fake_post(self, url, headers=None, json=None, timeout=None):
        return _FakeResponse(200, {"choices": [{"message": {"content": "   "}}]})

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)
    text = await mimo_client.transcribe_wav("ZmFrZQ==", letter=None)
    assert text == ""
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/test_mimo_client.py -v`
Expected: FAIL（`mimo_client` 无 `transcribe_wav`）。

- [ ] **Step 3: 实现 mimo_client.py**

`backend/mimo_client.py`：

```python
import httpx

from backend.config import API_KEY, BASE_URL, MODEL

_SYSTEM = (
    "You transcribe short English speech from young children at an English contest. "
    "Output ONLY the English words you hear, in lowercase, no punctuation and no explanation."
)


def _build_payload(audio_b64: str, letter: str | None) -> dict:
    hint = "The child is saying English words"
    if letter:
        hint += f" starting with the letter '{letter}'"
    hint += ", and may then say a short sentence. Transcribe everything spoken."
    return {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": hint},
                    {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}},
                ],
            },
        ],
        "temperature": 0,
    }


async def transcribe_wav(audio_b64: str, letter: str | None = None) -> str:
    payload = _build_payload(audio_b64, letter)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return content.strip().lower()
```

- [ ] **Step 4: 运行确认通过**

Run: `pytest tests/test_mimo_client.py -v`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add backend/mimo_client.py tests/test_mimo_client.py
git commit -m "feat: add mimo client transcribe_wav with tests"
```

---

## Task 5: 转写接口 /api/transcribe（TDD）

**Files:**
- Modify: `backend/main.py`
- Test: `tests/test_transcribe_api.py`

- [ ] **Step 1: 写失败测试**

`tests/test_transcribe_api.py`：

```python
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_transcribe_returns_text(monkeypatch):
    async def fake_transcribe(audio_b64, letter=None):
        assert audio_b64 == "ZmFrZQ=="
        assert letter == "C"
        return "cat"

    monkeypatch.setattr("backend.main.transcribe_wav", fake_transcribe)

    resp = client.post("/api/transcribe", json={"audio": "ZmFrZQ==", "letter": "C"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "cat"}


def test_transcribe_handles_upstream_error(monkeypatch):
    async def fake_transcribe(audio_b64, letter=None):
        raise RuntimeError("upstream down")

    monkeypatch.setattr("backend.main.transcribe_wav", fake_transcribe)

    resp = client.post("/api/transcribe", json={"audio": "ZmFrZQ==", "letter": "C"})
    # 识别失败不应让前端崩；返回 200 + 空文本，让倒计时继续
    assert resp.status_code == 200
    assert resp.json() == {"text": ""}


def test_transcribe_requires_audio():
    resp = client.post("/api/transcribe", json={"letter": "C"})
    assert resp.status_code == 422
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/test_transcribe_api.py -v`
Expected: FAIL（无 `/api/transcribe`）。

- [ ] **Step 3: 实现接口**

把 `backend/main.py` 改为：

```python
import logging

from fastapi import FastAPI
from pydantic import BaseModel

from backend.mimo_client import transcribe_wav

logger = logging.getLogger("contest")

app = FastAPI(title="Kindergarten Speaking Contest")


class TranscribeRequest(BaseModel):
    audio: str  # base64-encoded 16kHz mono wav
    letter: str | None = None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/transcribe")
async def transcribe(req: TranscribeRequest) -> dict:
    try:
        text = await transcribe_wav(req.audio, letter=req.letter)
    except Exception:  # 上游失败不阻塞前端
        logger.exception("transcribe failed")
        return {"text": ""}
    return {"text": text}
```

- [ ] **Step 4: 运行确认通过**

Run: `pytest tests/test_transcribe_api.py -v`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add backend/main.py tests/test_transcribe_api.py
git commit -m "feat: add /api/transcribe endpoint with error fallback"
```

---

## Task 6: 托管静态前端 + 开始页

**Files:**
- Modify: `backend/main.py`
- Create: `frontend/index.html`
- Create: `frontend/css/memphis.css`

- [ ] **Step 1: 写 Memphis 糖果明亮基础样式**

`frontend/css/memphis.css`：

```css
:root {
  --pink: #ff8fab; --yellow: #ffd23f; --green: #06d6a0;
  --blue: #118ab2; --rose: #ef476f; --purple: #c9b8f0;
  --ink: #073b4c; --bg: #eaf6ff;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: "Comic Sans MS", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  background: var(--bg); color: var(--ink); overflow: hidden;
}
.scene { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; }
.shape { position: absolute; z-index: 0; }
.circle { border-radius: 50%; }
.tri { width: 0; height: 0; background: transparent !important; }
h1.title { font-size: 64px; font-weight: 900; z-index: 2;
  text-shadow: 4px 4px 0 var(--yellow); margin: 0 0 40px; }
.btn-row { display: flex; gap: 32px; z-index: 2; }
.big-btn { border: none; cursor: pointer; padding: 36px 56px; border-radius: 28px;
  font-size: 36px; font-weight: 900; color: var(--ink);
  box-shadow: 6px 7px 0 rgba(0,0,0,.18); transition: transform .1s; }
.big-btn:active { transform: translateY(3px); }
.btn-junior { background: var(--yellow); }
.btn-senior { background: var(--green); }

/* 大字母 */
.big-letter { font-size: 200px; font-weight: 900; color: var(--rose);
  text-shadow: 6px 6px 0 var(--yellow); z-index: 2; }
.prompt { font-size: 32px; font-weight: 800; color: var(--blue); z-index: 2; margin-top: 8px; }

/* 倒计时圆环 */
.timer { position: fixed; top: 28px; right: 28px; width: 96px; height: 96px;
  border-radius: 50%; border: 10px solid var(--green); background: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 40px; font-weight: 900; color: var(--ink); z-index: 5; }
.timer.warn { border-color: var(--rose); }

/* 气泡糖单词 */
.bubbles { position: fixed; left: 24px; right: 24px; bottom: 40px;
  display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; z-index: 3; }
.bub { padding: 18px 32px; border-radius: 32px; font-size: 38px; font-weight: 900;
  color: var(--ink); background: #fff; box-shadow: 5px 6px 0 rgba(0,0,0,.18);
  animation: pop .45s ease-out both; }
.bub.ok { background: var(--green); color: #053; }
.bub .star { font-size: 26px; vertical-align: super; }
@keyframes pop { 0% { transform: scale(.4) rotate(-8deg); opacity: 0; }
  70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }

/* 中班句子 */
.sentence { position: fixed; left: 32px; right: 32px; bottom: 56px;
  font-size: 40px; font-weight: 800; line-height: 1.3; text-align: center; z-index: 3;
  animation: pop .5s ease-out both; }
.sentence b { color: var(--rose); background: var(--yellow);
  padding: 2px 12px; border-radius: 14px; }

/* 中班首页字母气泡 */
.letter-grid { display: flex; flex-wrap: wrap; gap: 28px; justify-content: center; z-index: 2; }
.letter-bubble { width: 120px; height: 120px; border-radius: 28px; border: none; cursor: pointer;
  font-size: 60px; font-weight: 900; color: var(--ink);
  box-shadow: 5px 6px 0 rgba(0,0,0,.18); animation: floaty 2.2s ease-in-out infinite; }
@keyframes floaty { 0%,100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-14px) rotate(3deg); } }

.hint { position: fixed; top: 24px; left: 24px; font-size: 20px; color: #888; z-index: 5; }
.hidden { display: none !important; }
```

- [ ] **Step 2: 写开始页**

`frontend/index.html`：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Speaking Star</title>
  <link rel="stylesheet" href="/css/memphis.css" />
</head>
<body>
  <div class="scene">
    <div class="shape circle" style="top:8%;left:10%;width:90px;height:90px;background:var(--pink)"></div>
    <div class="shape" style="top:14%;right:12%;width:70px;height:70px;background:var(--yellow);transform:rotate(20deg)"></div>
    <div class="shape tri" style="bottom:16%;right:18%;border-left:40px solid transparent;border-right:40px solid transparent;border-bottom:64px solid var(--green)"></div>
    <div class="shape circle" style="bottom:12%;left:14%;width:40px;height:40px;background:var(--blue)"></div>
    <h1 class="title">🌈 Speaking Star</h1>
    <div class="btn-row">
      <button class="big-btn btn-junior" onclick="location.href='/junior.html'">小班 Junior</button>
      <button class="big-btn btn-senior" onclick="location.href='/senior.html'">中班 Middle</button>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: 在 FastAPI 挂载静态目录（放在文件末尾，API 路由之后）**

在 `backend/main.py` 末尾追加：

```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
```

并在文件顶部 import 区保持整洁（`from pathlib import Path` 等可移到顶部）。

- [ ] **Step 4: 手动验证**

Run: `uvicorn backend.main:app --port 8000`，浏览器打开 `http://localhost:8000/`
Expected: 看到糖果明亮开始页，两个大按钮；`/api/health` 仍返回 ok（API 路由优先于静态挂载）。

- [ ] **Step 5: Commit**

```bash
git add backend/main.py frontend/index.html frontend/css/memphis.css
git commit -m "feat: serve static frontend and start page"
```

---

## Task 7: 录音模块 recorder.js（录音 + VAD + WAV 编码）

**Files:**
- Create: `frontend/js/recorder.js`

- [ ] **Step 1: 实现 recorder.js**

`frontend/js/recorder.js`：

```javascript
// 录音 + 静音检测(VAD) + WAV(16kHz 单声道) 编码。
// 用法：const rec = new Recorder({ onUtterance, getLetter });
//      await rec.start(); ... rec.stop();
// "说完一句"（语音后静音约 800ms）会触发 onUtterance(wavBase64)。
class Recorder {
  constructor({ onUtterance, getLetter, silenceMs = 800, minSpeechMs = 250, threshold = 0.012 }) {
    this.onUtterance = onUtterance;
    this.getLetter = getLetter || (() => null);
    this.silenceMs = silenceMs;
    this.minSpeechMs = minSpeechMs;
    this.threshold = threshold;
    this.sampleRate = 16000;
    this.frames = [];        // 当前句累计的 Float32 块
    this.speaking = false;
    this.lastVoiceTs = 0;
    this.speechStartTs = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = (e) => this._onAudio(e.inputBuffer.getChannelData(0));
    this.source.connect(this.proc);
    this.proc.connect(this.ctx.destination);
  }

  stop() {
    if (this.proc) this.proc.disconnect();
    if (this.source) this.source.disconnect();
    if (this.ctx) this.ctx.close();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.frames = [];
    this.speaking = false;
  }

  _rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  _onAudio(buf) {
    const now = performance.now();
    const loud = this._rms(buf) > this.threshold;
    if (loud) {
      if (!this.speaking) { this.speaking = true; this.speechStartTs = now; this.frames = []; }
      this.lastVoiceTs = now;
      this.frames.push(new Float32Array(buf));
    } else if (this.speaking) {
      this.frames.push(new Float32Array(buf)); // 收尾静音也留一点
      if (now - this.lastVoiceTs > this.silenceMs) this._flush(now);
    }
  }

  _flush(now) {
    const duration = this.lastVoiceTs - this.speechStartTs;
    const frames = this.frames;
    this.speaking = false;
    this.frames = [];
    if (duration < this.minSpeechMs || frames.length === 0) return;
    const wavB64 = this._encodeWav(frames);
    this.onUtterance(wavB64, this.getLetter());
  }

  _encodeWav(frames) {
    let total = 0;
    frames.forEach((f) => (total += f.length));
    const pcm = new Float32Array(total);
    let off = 0;
    frames.forEach((f) => { pcm.set(f, off); off += f.length; });

    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    const sr = this.sampleRate;
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);   // PCM
    view.setUint16(22, 1, true);   // mono
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    let p = 44;
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      p += 2;
    }
    // ArrayBuffer -> base64
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}
```

- [ ] **Step 2: 语法自检**

Run: `node --check frontend/js/recorder.js`
Expected: 无输出（语法正确）。

- [ ] **Step 3: Commit**

```bash
git add frontend/js/recorder.js
git commit -m "feat: add browser recorder with VAD and wav encoding"
```

---

## Task 8: 小班页 junior.html + junior.js

**Files:**
- Create: `frontend/junior.html`
- Create: `frontend/js/junior.js`

- [ ] **Step 1: 写小班页面**

`frontend/junior.html`：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>小班 Junior</title>
  <link rel="stylesheet" href="/css/memphis.css" />
</head>
<body>
  <a class="hint" href="/index.html">← 返回</a>
  <div id="timer" class="timer">30</div>
  <div class="scene">
    <div class="shape circle" style="top:10%;left:8%;width:70px;height:70px;background:var(--yellow)"></div>
    <div class="shape tri" style="bottom:30%;left:10%;border-left:30px solid transparent;border-right:30px solid transparent;border-bottom:50px solid var(--pink)"></div>
    <div id="letter" class="big-letter">C</div>
    <div id="prompt" class="prompt">说出 C 开头的单词 🎤</div>
  </div>
  <div id="bubbles" class="bubbles"></div>
  <script src="/js/recorder.js"></script>
  <script src="/js/junior.js"></script>
</body>
</html>
```

- [ ] **Step 2: 写小班逻辑**

`frontend/js/junior.js`：

```javascript
const LETTERS = ["A", "C", "E", "F", "K", "S"];
const DURATION = 30;

const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const bubblesEl = document.getElementById("bubbles");

let currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
let remaining = DURATION;
let recorder = null;
let timerId = null;

function render() {
  letterEl.textContent = currentLetter;
  promptEl.textContent = `说出 ${currentLetter} 开头的单词 🎤`;
  timerEl.textContent = remaining;
}

function addWords(text, letter) {
  if (!text) return;
  text.split(/\s+/).filter(Boolean).forEach((w) => {
    const clean = w.replace(/[^a-zA-Z]/g, "");
    if (!clean) return;
    const ok = clean[0].toUpperCase() === letter.toUpperCase();
    const div = document.createElement("div");
    div.className = ok ? "bub ok" : "bub";
    div.innerHTML = ok ? `${clean}<span class="star">✓</span>` : clean;
    bubblesEl.appendChild(div);
  });
}

async function sendUtterance(wavB64, letter) {
  try {
    const resp = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: wavB64, letter }),
    });
    const data = await resp.json();
    addWords(data.text, letter);
  } catch (e) { /* 静默跳过，不阻塞倒计时 */ }
}

function tick() {
  remaining -= 1;
  timerEl.textContent = remaining;
  if (remaining <= 5) timerEl.classList.add("warn");
  if (remaining <= 0) finish();
}

function finish() {
  clearInterval(timerId);
  if (recorder) recorder.stop();
  location.href = "/index.html";
}

async function main() {
  render();
  recorder = new Recorder({
    onUtterance: sendUtterance,
    getLetter: () => currentLetter,
  });
  try {
    await recorder.start();
  } catch (e) {
    promptEl.textContent = "请允许使用麦克风后刷新页面 🎤";
    return;
  }
  timerId = setInterval(tick, 1000);
}

main();
```

- [ ] **Step 3: 语法自检**

Run: `node --check frontend/js/junior.js`
Expected: 无输出。

- [ ] **Step 4: 手动验证（浏览器，需麦克风）**

Run: `uvicorn backend.main:app --port 8000`，Chrome 打开 `http://localhost:8000/junior.html`，允许麦克风。
Expected: 出现随机字母与 30s 倒计时；说一个该字母开头的英文单词，停顿约 1 秒后，单词以绿色气泡 ✓ 弹出；说不匹配的单词为白色气泡；倒计时归零自动回开始页。
（前提：Task 2 冒烟已通过；若识别为空，回到 Task 2 排查格式。）

- [ ] **Step 5: Commit**

```bash
git add frontend/junior.html frontend/js/junior.js
git commit -m "feat: add junior mode (random letter, 30s, continuous words)"
```

---

## Task 9: 中班页 senior.html + senior.js

**Files:**
- Create: `frontend/senior.html`
- Create: `frontend/js/senior.js`

- [ ] **Step 1: 写中班页面（首页选字母 + 进行中两态）**

`frontend/senior.html`：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>中班 Middle</title>
  <link rel="stylesheet" href="/css/memphis.css" />
</head>
<body>
  <a class="hint" href="/index.html">← 返回</a>

  <!-- 选字母态 -->
  <div id="pick" class="scene">
    <h1 class="title" style="font-size:44px">点一个字母开始 ✨</h1>
    <div id="grid" class="letter-grid"></div>
  </div>

  <!-- 进行中态 -->
  <div id="play" class="scene hidden">
    <div id="timer" class="timer">60</div>
    <div id="letter" class="big-letter">S</div>
    <div id="prompt" class="prompt">说一个 S 开头的单词，再用它说一句话 🎤</div>
    <div id="word" class="bubbles"></div>
    <div id="sentence" class="sentence"></div>
  </div>

  <script src="/js/recorder.js"></script>
  <script src="/js/senior.js"></script>
</body>
</html>
```

- [ ] **Step 2: 写中班逻辑**

`frontend/js/senior.js`：

```javascript
const LETTERS = ["S", "D", "T", "F", "B", "G"];
const COLORS = ["var(--pink)", "var(--yellow)", "var(--green)", "var(--blue)", "var(--rose)", "var(--purple)"];
const DURATION = 60;

const pickEl = document.getElementById("pick");
const gridEl = document.getElementById("grid");
const playEl = document.getElementById("play");
const letterEl = document.getElementById("letter");
const promptEl = document.getElementById("prompt");
const timerEl = document.getElementById("timer");
const wordEl = document.getElementById("word");
const sentenceEl = document.getElementById("sentence");

let currentLetter = null;
let remaining = DURATION;
let recorder = null;
let timerId = null;
let wordShown = false;

// 渲染选字母网格
LETTERS.forEach((l, i) => {
  const b = document.createElement("button");
  b.className = "letter-bubble";
  b.textContent = l;
  b.style.background = COLORS[i % COLORS.length];
  b.style.animationDelay = `${i * 0.15}s`;
  b.onclick = () => startPlay(l);
  gridEl.appendChild(b);
});

function showWord(clean) {
  const ok = clean[0].toUpperCase() === currentLetter.toUpperCase();
  wordEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = ok ? "bub ok" : "bub";
  div.style.fontSize = "48px";
  div.innerHTML = ok ? `${clean}<span class="star">✓</span>` : clean;
  wordEl.appendChild(div);
}

function showSentence(text, clean) {
  const re = new RegExp(`\\b(${clean})\\b`, "i");
  sentenceEl.innerHTML = text.replace(re, "<b>$1</b>");
}

function handleText(text) {
  if (!text) return;
  const words = text.split(/\s+/).map((w) => w.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
  if (words.length === 0) return;
  if (!wordShown) {
    showWord(words[0]);
    wordShown = true;
    if (words.length > 1) showSentence(text, words[0]); // 同一句里既有单词又有句子
  } else {
    showSentence(text, wordEl.textContent.replace("✓", "").trim());
  }
}

async function sendUtterance(wavB64, letter) {
  try {
    const resp = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: wavB64, letter }),
    });
    const data = await resp.json();
    handleText(data.text);
  } catch (e) { /* 静默跳过 */ }
}

function tick() {
  remaining -= 1;
  timerEl.textContent = remaining;
  if (remaining <= 5) timerEl.classList.add("warn");
  if (remaining <= 0) finish();
}

function finish() {
  clearInterval(timerId);
  if (recorder) recorder.stop();
  location.href = "/index.html";
}

async function startPlay(letter) {
  currentLetter = letter;
  pickEl.classList.add("hidden");
  playEl.classList.remove("hidden");
  letterEl.textContent = letter;
  promptEl.textContent = `说一个 ${letter} 开头的单词，再用它说一句话 🎤`;
  timerEl.textContent = remaining;

  recorder = new Recorder({ onUtterance: sendUtterance, getLetter: () => currentLetter });
  try {
    await recorder.start();
  } catch (e) {
    promptEl.textContent = "请允许使用麦克风后刷新页面 🎤";
    return;
  }
  timerId = setInterval(tick, 1000);
}
```

- [ ] **Step 3: 语法自检**

Run: `node --check frontend/js/senior.js`
Expected: 无输出。

- [ ] **Step 4: 手动验证（浏览器）**

Run: `uvicorn backend.main:app --port 8000`，Chrome 打开 `http://localhost:8000/senior.html`。
Expected: 首页 6 个彩色字母上下浮动；点一个 → 进入大字母 + 60s 倒计时；说"单词 + 句子"后，单词以大气泡（对的带 ✓）显示、句子在下方显示且目标单词被黄色高亮；倒计时归零回开始页。

- [ ] **Step 5: Commit**

```bash
git add frontend/senior.html frontend/js/senior.js
git commit -m "feat: add middle mode (letter pick, 60s, word + sentence)"
```

---

## Task 10: 桌面入口 run.py（起服务 + 自动开浏览器）

**Files:**
- Create: `run.py`

- [ ] **Step 1: 写入口脚本**

`run.py`：

```python
import socket
import threading
import time
import webbrowser

import uvicorn

from backend.main import app


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main() -> None:
    port = _free_port()
    url = f"http://localhost:{port}/"

    def open_browser() -> None:
        time.sleep(1.2)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    print(f"Speaking Star running at {url}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 验证**

Run: `python run.py`
Expected: 终端打印地址，默认浏览器自动打开开始页；麦克风功能正常。Ctrl-C 退出。

- [ ] **Step 3: Commit**

```bash
git add run.py
git commit -m "feat: add desktop entry that starts server and opens browser"
```

---

## Task 11: 打包（PyInstaller → macOS .dmg / Windows .exe）

**Files:**
- Create: `build/build_mac.sh`
- Create: `build/build_windows.bat`

- [ ] **Step 1: 安装 PyInstaller**

Run: `pip install pyinstaller==6.10.0`
（也把它加到 `requirements.txt` 末尾：`pyinstaller==6.10.0`）

- [ ] **Step 2: 写 macOS 打包脚本**

`build/build_mac.sh`：

```bash
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
```

- [ ] **Step 3: 写 Windows 打包脚本**

`build/build_windows.bat`：

```bat
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
```

- [ ] **Step 4: 让打包后的 run.py 能找到 frontend（处理 PyInstaller 临时目录）**

修改 `backend/main.py` 里 frontend 路径解析，兼容 PyInstaller 的 `sys._MEIPASS`：

```python
import sys
from pathlib import Path
from fastapi.staticfiles import StaticFiles

if hasattr(sys, "_MEIPASS"):
    _FRONTEND = Path(sys._MEIPASS) / "frontend"
else:
    _FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
```

（替换 Task 6 Step 3 追加的那段。）

- [ ] **Step 5: macOS 打包并验证**

Run: `bash build/build_mac.sh`
Expected: 生成 `dist/SpeakingStar.dmg`；双击挂载、运行 `SpeakingStar.app`，自动开浏览器、麦克风识别正常。

> Windows 的 `.exe` 需在 Windows 机器上执行 `build\build_windows.bat`（PyInstaller 不支持跨系统打包），产物为 `dist\SpeakingStar\SpeakingStar.exe`。

- [ ] **Step 6: Commit**

```bash
git add build/build_mac.sh build/build_windows.bat backend/main.py requirements.txt
git commit -m "build: add PyInstaller mac/windows packaging scripts"
```

---

## Task 12: README 与现场使用说明

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README**

`README.md`：

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with run and packaging instructions"
```

---

## 自检（Self-Review）

- **Spec 覆盖**：小班规则→Task 8；中班规则→Task 9；随机字母/30s/60s→Task 8/9；首字母高亮→Task 8/9；Mimo 识别→Task 2/4/5；"说完一句出一句"VAD→Task 7；Memphis 糖果明亮视觉→Task 6（CSS）+ 8/9；单进程托管→Task 6；打包 dmg/exe→Task 11；Key 编入二进制不入库→Task 2(config_local)+3+11；错误处理→Task 5(接口兜底)+8/9(catch)+7(麦克风权限提示)；明确不做项（无登录/DB/打分/TTS）→未引入，符合。三个待验证假设→Task 2 冒烟覆盖音频格式；WAV 由前端固定为 16kHz 单声道（Task 7）规避转码；静音阈值现场可调（README）。
- **占位符扫描**：无 TBD/TODO；每个代码步骤含完整代码。
- **类型/命名一致**：`transcribe_wav(audio_b64, letter)` 在 mimo_client/测试/main 一致；接口请求字段 `audio`/`letter` 与前端 `fetch` body 一致；`Recorder({onUtterance, getLetter})` 与 junior/senior 调用一致；返回 `{ "text": ... }` 与前端读取 `data.text` 一致。

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-29-kindergarten-speaking-contest.md`.
