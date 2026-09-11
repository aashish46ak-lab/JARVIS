"""Fish Audio TTS — use with fish_api_key in config/api_keys.json."""
from __future__ import annotations


class FishAudioTTSEngine:
    """Fish Audio cloud TTS — JARVIS voice via reference_id."""

    def __init__(self, api_key: str, voice_id: str = "14129c3e320149449d6bada6862f7338"):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "14129c3e320149449d6bada6862f7338").strip()

    def speak(self, text: str) -> None:
        import requests
        from core.tts import _play_audio_bytes

        if not self.api_key:
            raise RuntimeError("Fish Audio API key missing — set fish_api_key in config/api_keys.json")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "model": "s1",
        }
        payload = {
            "text": text,
            "reference_id": self.voice_id,
            "format": "mp3",
            "latency": "balanced",
        }
        urls = [
            "https://api.fish.audio/v1/tts",
            "https://api.fish.audio/v1/text-to-speech",
        ]
        last_err = None
        for url in urls:
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=60)
                if resp.status_code == 200 and resp.content:
                    _play_audio_bytes(resp.content)
                    return
                last_err = f"{resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                last_err = str(e)
        raise RuntimeError(f"Fish Audio TTS failed: {last_err}")
