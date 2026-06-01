import base64
import json
import sys
import httpx

sys.path.insert(0, ".")
from backend.config_local import API_KEY

BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
MODEL = "mimo-v2-omni"


def main() -> None:
    with open("scripts/sample.wav", "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You transcribe short English speech from young children. "
                "Output ONLY the words you hear, lowercase, no punctuation, no explanation.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Transcribe this audio. The child is saying English words."},
                    {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}},
                ],
            },
        ],
        "temperature": 0,
    }

    resp = httpx.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json=payload,
        timeout=30,
    )
    print("HTTP", resp.status_code)
    print(json.dumps(resp.json(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
