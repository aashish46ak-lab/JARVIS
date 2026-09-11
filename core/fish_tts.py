"""Fish Audio TTS — voice 05b36da8574341d0803391491850db20 (no pygame required)"""
from __future__ import annotations

import io
import tempfile
from pathlib import Path

DEFAULT_VOICE_ID = "05b36da8574341d0803391491850db20"


class FishAudioTTSEngine:
    def __init__(self, api_key: str, voice_id: str = DEFAULT_VOICE_ID):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "").strip() or DEFAULT_VOICE_ID
        if not self.api_key:
            raise ValueError("Fish API key required")

    def _bytes(self, text: str) -> bytes:
        try:
            from fishaudio import FishAudio

            client = FishAudio(api_key=self.api_key)
            audio = client.tts.convert(
                text=text,
                reference_id=self.voice_id,
                format="mp3",
            )
            if hasattr(audio, "read"):
                return audio.read()
            if isinstance(audio, (bytes, bytearray)):
                return bytes(audio)
            return b"".join(bytes(x) if not isinstance(x, bytes) else x for x in audio)
        except Exception as e1:
            print("[Fish] SDK:", e1)

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
                "format": "mp3",
                "normalize": True,
                "latency": "normal",
            },
            timeout=90,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Fish HTTP {r.status_code}: {r.text[:400]}")
        return r.content

    def speak(self, text: str) -> None:
        data = self._bytes(text)
        path = Path(tempfile.gettempdir()) / "jarvis_fish_tts.mp3"
        path.write_bytes(data)

        # Prefer fishaudio.utils.play
        try:
            from fishaudio.utils import play as fish_play

            fish_play(data)
            return
        except Exception as e:
            print("[Fish] utils.play:", e)

        # sounddevice + soundfile (wav path)
        try:
            import numpy as np
            import sounddevice as sd
            import soundfile as sf

            # try decode mp3 via soundfile (needs libsndfile with mp3) or pydub
            try:
                samples, sr = sf.read(io.BytesIO(data), dtype="float32")
            except Exception:
                from pydub import AudioSegment

                seg = AudioSegment.from_file(io.BytesIO(data), format="mp3")
                samples = (
                    np.array(seg.get_array_of_samples()).astype("float32")
                    / (1 << (8 * seg.sample_width - 1))
                )
                if seg.channels > 1:
                    samples = samples.reshape((-1, seg.channels)).mean(axis=1)
                sr = seg.frame_rate
            if getattr(samples, "ndim", 1) > 1:
                samples = samples.mean(axis=1)
            sd.play(samples, sr)
            sd.wait()
            return
        except Exception as e:
            print("[Fish] sounddevice:", e)

        # Windows: open with default player (may not wait)
        import os
        import subprocess

        if os.name == "nt":
            subprocess.run(["cmd", "/c", f'start /min "" "{path}"'], check=False)
            return
        raise RuntimeError("Cannot play Fish audio — pip install soundfile pydub")
