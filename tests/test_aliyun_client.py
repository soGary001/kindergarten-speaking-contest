import pytest

from backend import aliyun_client


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
async def test_transcribe_wav_returns_lowercase_text(monkeypatch):
    captured = {}

    async def fake_post(self, url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["auth"] = headers["Authorization"]
        return _FakeResponse(200, {"choices": [{"message": {"content": "Boy."}}]})

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    text = await aliyun_client.transcribe_wav("ZmFrZQ==", letter="B")

    assert text == "boy."  # 去空格 + 小写（标点由前端按词清洗）
    assert captured["url"].endswith("/chat/completions")
    assert captured["auth"].startswith("Bearer ")
    dumped = str(captured["json"])
    assert "qwen3-asr-flash" in dumped
    assert "input_audio" in dumped
    assert "data:audio/wav;base64,ZmFrZQ==" in dumped


@pytest.mark.asyncio
async def test_transcribe_wav_handles_list_content(monkeypatch):
    async def fake_post(self, url, headers=None, json=None, timeout=None):
        return _FakeResponse(200, {"choices": [{"message": {"content": [{"text": "Hello World"}]}}]})

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)
    text = await aliyun_client.transcribe_wav("ZmFrZQ==")
    assert text == "hello world"
