"""Vercel Python Serverless 函数：POST /api/segment → 用 qwen-flash 把黏连英文切成单词。

仅标准库；Key 取自环境变量 ALIYUN_API_KEY（只在服务端使用）。
"""
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

KEY = os.environ.get("ALIYUN_API_KEY", "")
URL = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1") + "/chat/completions"
MODEL = os.environ.get("DASHSCOPE_SEGMENT_MODEL", "qwen-flash")
SYS = ("You split run-together English into separate words. "
       "Output ONLY the words in lowercase separated by single spaces, nothing else.")


def segment(text: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYS},
            {"role": "user", "content": text},
        ],
        "temperature": 0,
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
            text = (json.loads(body or b"{}") or {}).get("text", "")
            out = segment(text) if text else ""
        except Exception:
            out = ""  # 失败则空，前端回退原文
        payload = json.dumps({"text": out}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(payload)
