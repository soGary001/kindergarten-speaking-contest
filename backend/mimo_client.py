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
