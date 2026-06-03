"""Vercel Python Serverless 函数：POST /api/transcribe → 阿里云 qwen3-asr-flash → {text}。

仅用标准库（urllib），无需额外依赖，冷启动快。Key 取自环境变量 ALIYUN_API_KEY，
只在服务端使用，前端永远拿不到。桌面/APK 仍走各自的识别路径，不受影响。
"""
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

KEY = os.environ.get("ALIYUN_API_KEY", "")
URL = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1") + "/chat/completions"
MODEL = os.environ.get("DASHSCOPE_ASR_MODEL", "qwen3-asr-flash")


def transcribe(audio_b64: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": [{"type": "input_audio", "input_audio": {"data": "data:audio/wav;base64," + audio_b64}}],
        }],
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    content = data["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
    return str(content).strip().lower()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            audio = (json.loads(body or b"{}") or {}).get("audio", "")
            text = transcribe(audio) if audio else ""
        except Exception:
            text = ""  # 识别失败不阻塞前端
        payload = json.dumps({"text": text}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)
