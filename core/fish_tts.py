"""Fish Audio TTS — voice 05b36da8574341d0803391491850db20"""
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
        # Prefer official SDK
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
            # some SDK versions return iterable chunks
            return b"".join(audio) if not isinstance(audio, bytes) else audio
        except Exception as e1:
            print("[Fish] SDK path:", e1)

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
            raise RuntimeError(f"Fish HTTP {r.status_code}: {r.text[:300]}")
        return r.content

    def speak(self, text: str) -> None:
        data = self._bytes(text)
        # Write temp mp3 and play
        path = Path(tempfile.gettempdir()) / "jarvis_fish_tts.mp3"
        path.write_bytes(data)

        # 1) pygame
        try:
            import pygame

            pygame.mixer.init()
            pygame.mixer.music.load(str(path))
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.wait(50)
            return
        except Exception as e:
            print("[Fish] pygame:", e)

        # 2) playsound
        try:
            from playsound import playsound

            playsound(str(path))
            return
        except Exception as e:
            print("[Fish] playsound:", e)

        # 3) Windows start
        try:
            import os
            import subprocess

            if os.name == "nt":
                subprocess.run(
                    ["powershell", "-c", f"(New-Object Media.SoundPlayer '{path}').PlaySync()"],
                    check=False,
                )
                # mp3 may need:
                subprocess.run(
                    ["cmd", "/c", f'start /wait "" "{path}"'],
                    check=False,
                )
        except Exception as e:
            print("[Fish] fallback play:", e)
            raise RuntimeError("Could not play Fish audio — pip install pygame") from e
