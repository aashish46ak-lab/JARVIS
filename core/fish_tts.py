"""Fish Audio TTS — id 05b36da8574341d0803391491850db20"""
from __future__ import annotations

import io
import time

DEFAULT_VOICE_ID = "05b36da8574341d0803391491850db20"


class FishAudioTTSEngine:
    def __init__(self, api_key: str, voice_id: str = DEFAULT_VOICE_ID):
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "").strip() or DEFAULT_VOICE_ID
        if not self.api_key:
            raise ValueError("Fish API key required")

    def _mp3_bytes(self, text: str) -> bytes:
        text = (text or "").strip()
        if not text:
            return b""

        try:
            from fishaudio import FishAudio

            client = FishAudio(api_key=self.api_key)
            audio = client.tts.convert(
                text=text,
                reference_id=self.voice_id,
                format="mp3",
            )
            if isinstance(audio, (bytes, bytearray)):
                return bytes(audio)
            if hasattr(audio, "read"):
                return audio.read()
            chunks = []
            for c in audio:
                chunks.append(c if isinstance(c, (bytes, bytearray)) else bytes(c))
            return b"".join(chunks)
        except Exception as e:
            print("[Fish] SDK fail, HTTP fallback:", e)

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
            },
            timeout=90,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Fish API {r.status_code}: {r.text[:300]}")
        return r.content

    def speak(self, text: str) -> None:
        data = self._mp3_bytes(text)
        if not data:
            return
        print(f"[Fish] playing {len(data)} bytes…")

        # 1) fishaudio.utils.play
        try:
            from fishaudio.utils import play

            play(data)
            return
        except Exception as e:
            print("[Fish] utils.play:", e)

        # 2) pydub + sounddevice
        try:
            import numpy as np
            import sounddevice as sd
            from pydub import AudioSegment

            seg = AudioSegment.from_file(io.BytesIO(data), format="mp3")
            samples = (
                np.array(seg.get_array_of_samples()).astype("float32")
                / (1 << (8 * seg.sample_width - 1))
            )
            if seg.channels > 1:
                samples = samples.reshape((-1, seg.channels)).mean(axis=1)
            sd.play(samples, seg.frame_rate)
            sd.wait()
            return
        except Exception as e:
            print("[Fish] pydub/sd:", e)

        # 3) write file + winsound-ish via powershell Media.SoundPlayer won't do mp3
        # use start with wait using Windows Media Feature? last resort:
        import os
        import subprocess
        import tempfile
        from pathlib import Path

        path = Path(tempfile.gettempdir()) / "jarvis_fish.mp3"
        path.write_bytes(data)
        if os.name == "nt":
            # PowerShell play with MediaPlayer (async) — sleep approximate
            cmd = (
                f"Add-Type -AssemblyName presentationCore; "
                f"$p = New-Object System.Windows.Media.MediaPlayer; "
                f"$p.Open([uri]'{path.as_posix()}'); $p.Play(); "
                f"Start-Sleep -Seconds 8"
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", cmd], check=False)
            return
        raise RuntimeError("Cannot play Fish audio")
