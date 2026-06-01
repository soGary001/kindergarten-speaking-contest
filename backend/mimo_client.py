import httpx

from backend.config import API_KEY, BASE_URL, MODEL

_SYSTEM = (
    "You are a precise speech-to-text engine for an English speaking activity with young children. "
    "Transcribe ONLY the English words actually spoken in the audio, exactly as you hear them, "
    "in lowercase and separated by single spaces. "
    "Do not add, guess, or invent words. Do not explain. "
    "If the audio is silent, just noise, or unclear, output nothing at all."
)


def _build_payload(audio_b64: str, letter: str | None) -> dict:
    hint = "Transcribe the English speech in this audio."
    if letter:
        hint += (
            f" (The speaker was asked to say words beginning with '{letter}', "
            "but transcribe only what is actually said.)"
        )
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
        # omni 是推理模型，默认每次先"思考"约 9 秒；关闭后降到约 2 秒，且不再脑补。
        "thinking": {"type": "disabled"},
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
