import httpx

from backend.config import ALIYUN_API_KEY, ALIYUN_ASR_MODEL, ALIYUN_BASE_URL


def _build_payload(audio_b64: str, letter: str | None) -> dict:
    # qwen3-asr-flash（OpenAI 兼容）接收 data URI 形式的音频，自动识别语种与文字。
    data_uri = f"data:audio/wav;base64,{audio_b64}"
    return {
        "model": ALIYUN_ASR_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": {"data": data_uri}},
                ],
            },
        ],
    }


async def transcribe_wav(audio_b64: str, letter: str | None = None) -> str:
    payload = _build_payload(audio_b64, letter)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{ALIYUN_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {ALIYUN_API_KEY}"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    content = data["choices"][0]["message"]["content"]
    if isinstance(content, list):  # 兼容个别返回为分段数组的情况
        content = " ".join(part.get("text", "") for part in content if isinstance(part, dict))
    return content.strip().lower()
