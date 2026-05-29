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
