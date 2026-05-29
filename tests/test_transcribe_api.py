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
