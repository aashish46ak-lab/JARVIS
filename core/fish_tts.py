"""Fish Audio TTS for JARVIS voice (Mark-LIII TTSPlayer compatible)."""
from __future__ import annotations

import io

import numpy as np

DEFAULT_VOICE_ID = "05b36da8574341d0803391491850db20"


class FishAudioTTSEngine:
    def __init__(self, api_key: str, voice_id: str = DEFAULT_VOICE_ID):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "").strip() or DEFAULT_VOICE_ID
        if not self.api_key:
            raise ValueError("Fish API key required")

    def synthesize(self, text: str):
        import requests

        r = requests.post(
            "https://api.fish.audio/v1/tts",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "model": "s1",
            },
            json={
                "text": text,
                "reference_id": self.voice_id,
                "format": "wav",
                "normalize": True,
                "latency": "normal",
            },
            timeout=60,
        )
        r.raise_for_status()
        data = r.content
        try:
            import soundfile as sf

            samples, sr = sf.read(io.BytesIO(data), dtype="float32")
            if getattr(samples, "ndim", 1) > 1:
                samples = samples.mean(axis=1)
            return samples, int(sr)
        except Exception:
            arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            return arr, 24000

    def speak(self, text: str) -> None:
        import sounddevice as sd

        samples, sr = self.synthesize(text)
        sd.play(samples, sr)
        sd.wait()
