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
