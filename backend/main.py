import logging
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.aliyun_client import transcribe_wav

logger = logging.getLogger("contest")

app = FastAPI(title="Kindergarten Speaking Contest")


@app.middleware("http")
async def no_cache(request: Request, call_next):
    # 禁用缓存：每次启动/重新打包后，浏览器都加载最新的前端代码，避免跑到旧版 JS。
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


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


if hasattr(sys, "_MEIPASS"):
    _FRONTEND = Path(sys._MEIPASS) / "frontend"
else:
    _FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
