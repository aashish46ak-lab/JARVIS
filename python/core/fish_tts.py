"""Fish Audio TTS — JARVIS voice via reference_id."""
from __future__ import annotations


class FishAudioTTSEngine:
    """Fish Audio cloud TTS."""

    DEFAULT_VOICE = "14129c3e320149449d6bada6862f7338"

    def __init__(self, api_key: str, voice_id: str | None = None):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or self.DEFAULT_VOICE).strip()

    def speak(self, text: str) -> None:
        import requests
        from core.tts import _play_audio_bytes

        if not self.api_key:
            raise RuntimeError("fish_api_key missing in config/api_keys.json")
        if not (text or "").strip():
            return

        payload = {
            "text": text.strip(),
            "reference_id": self.voice_id,
            "format": "mp3",
            "normalize": True,
            "latency": "balanced",
        }

        # Try current model headers (Fish rotates names)
        models = ["s1", "s2-pro", "s2.1-pro", "s2.1-pro-free"]
        last_err = None
        for model in models:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "model": model,
            }
            try:
                resp = requests.post(
                    "https://api.fish.audio/v1/tts",
                    json=payload,
                    headers=headers,
                    timeout=90,
                )
                if resp.status_code == 200 and resp.content and len(resp.content) > 500:
                    print(f"[Fish] OK model={model} bytes={len(resp.content)}")
                    _play_audio_bytes(resp.content)
                    return
                last_err = f"{resp.status_code} model={model}: {resp.text[:300]}"
                print(f"[Fish] fail {last_err}")
            except Exception as e:
                last_err = str(e)
                print(f"[Fish] error {last_err}")

        raise RuntimeError(f"Fish Audio TTS failed: {last_err}")
