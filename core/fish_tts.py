"""Fish Audio TTS engine for JARVIS voice option."""
from __future__ import annotations

import io
from typing import Optional

import numpy as np


class FishAudioTTSEngine:
    """Synthesize speech via Fish Audio API (PCM/WAV)."""

    def __init__(self, api_key: str, voice_id: str = "14129c3e320149449d6bada6862f7338"):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "").strip() or "14129c3e320149449d6bada6862f7338"
        if not self.api_key:
            raise ValueError("Fish API key required")

    def synthesize(self, text: str) -> tuple[np.ndarray, int]:
        """Return (float32 mono samples, sample_rate)."""
        import requests

        url = "https://api.fish.audio/v1/tts"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "model": "s1",
        }
        payload = {
            "text": text,
            "reference_id": self.voice_id,
            "format": "wav",
            "mp3_bitrate": 128,
            "normalize": True,
            "latency": "normal",
        }
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.content
        # decode wav
        try:
            import soundfile as sf

            samples, sr = sf.read(io.BytesIO(data), dtype="float32")
            if samples.ndim > 1:
                samples = samples.mean(axis=1)
            return samples, int(sr)
        except Exception:
            # raw pcm fallback 24k
            arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            return arr, 24000


# Used by Mark-LIII TTSPlayer if present
class FishTTSPlayer:
    def __init__(self, engine: FishAudioTTSEngine):
        self.engine = engine

    def speak(self, text: str) -> None:
        import sounddevice as sd

        samples, sr = self.engine.synthesize(text)
        sd.play(samples, sr)
        sd.wait()
