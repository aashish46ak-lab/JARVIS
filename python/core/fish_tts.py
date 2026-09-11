"""Fish Audio TTS — JARVIS MCU voice."""
from __future__ import annotations


def _play_mp3(audio_bytes: bytes) -> None:
    import io
    import tempfile
    from pathlib import Path

    try:
        from core.tts import _play_audio_bytes
        _play_audio_bytes(audio_bytes)
        return
    except Exception:
        pass

    try:
        import numpy as np
        import sounddevice as sd
        from pydub import AudioSegment

        seg = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
        samples = np.array(seg.get_array_of_samples()).astype(np.float32)
        if seg.channels == 2:
            samples = samples.reshape((-1, 2)).mean(axis=1)
        samples /= 32768.0
        sd.play(samples, seg.frame_rate)
        sd.wait()
        return
    except Exception:
        pass

    path = Path(tempfile.gettempdir()) / "jarvis_fish_tts.mp3"
    path.write_bytes(audio_bytes)
    try:
        import os
        import time

        os.startfile(str(path))
        time.sleep(max(2.0, len(audio_bytes) / 16000))
    except Exception as e:
        raise RuntimeError(f"Could not play MP3 ({path}): {e}") from e


class FishAudioTTSEngine:
    # Jarvis (MCU) on Fish Audio — https://fish.audio/m/05b36da8574341d0803391491850db20
    DEFAULT_VOICE = "05b36da8574341d0803391491850db20"

    def __init__(self, api_key: str, voice_id: str | None = None):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or self.DEFAULT_VOICE).strip()

    def speak(self, text: str) -> None:
        import requests

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

        models = ["s2.1-pro-free", "s1", "s2-pro", "s2.1-pro"]
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
                    _play_mp3(resp.content)
                    return
                last_err = f"{resp.status_code} model={model}: {resp.text[:200]}"
                if resp.status_code != 402:
                    print(f"[Fish] fail {last_err}")
            except Exception as e:
                last_err = str(e)
                print(f"[Fish] error {last_err}")

        raise RuntimeError(f"Fish Audio TTS failed: {last_err}")
