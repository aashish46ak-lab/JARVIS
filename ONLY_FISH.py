"""
ONLY Fish voice — no Gemini speaking.
Voice ID locked: 05b36da8574341d0803391491850db20

1) Put fish_api_key in config/api_keys.json
2) python ONLY_FISH.py
3) Hear test line
4) python main.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = ROOT / "config" / "api_keys.json"
MAIN = ROOT / "main.py"
FISH = ROOT / "core" / "fish_tts.py"
VOICE_ID = "05b36da8574341d0803391491850db20"


def ensure_fish_module() -> None:
    ROOT.joinpath("core").mkdir(exist_ok=True)
    url = "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py"
    print("  downloading fish_tts.py…")
    urllib.request.urlretrieve(url, FISH)
    print("  OK", FISH)


def load_key() -> str:
    if not CFG.exists():
        raise SystemExit(
            f"Missing {CFG}\nCreate it with:\n"
            '  "fish_api_key": "YOUR_KEY",\n'
            f'  "fish_voice_id": "{VOICE_ID}"'
        )
    data = json.loads(CFG.read_text(encoding="utf-8"))
    data["fish_voice_id"] = VOICE_ID
    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    key = (data.get("fish_api_key") or "").strip()
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    if not key or key.startswith("YOUR_"):
        raise SystemExit(
            "fish_api_key is empty or still YOUR_FISH_API_KEY.\n"
            f"Edit {CFG} and put your real Fish key from https://fish.audio"
        )
    return key


def test_speak(key: str) -> None:
    print("  testing Fish TTS (you should HEAR audio)…")
    import sys

    sys.path.insert(0, str(ROOT))
    from core.fish_tts import FishAudioTTSEngine

    eng = FishAudioTTSEngine(key, VOICE_ID)
    eng.speak("Hello sir. This is JARVIS. Fish audio is working.")
    print("  OK test finished")


def hardwire_main() -> None:
    if not MAIN.exists():
        print("  ! main.py missing — skip patch")
        return
    m = MAIN.read_text(encoding="utf-8")

    # Strip old fish blocks to avoid double
    # Inject after _is_speaking init ALWAYS
    if "ONLY_FISH_MARKER" not in m:
        if "self._is_speaking         = False" in m:
            block = f'''self._is_speaking         = False
        # ONLY_FISH_MARKER
        self._speak_mute_until    = 0.0
        self._fish_player         = None
        self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey and not _fkey.startswith("YOUR_"):
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = "{VOICE_ID}"
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] ONLY FISH voice on →", _vid)
        except Exception as _fe:
            print("[JARVIS] Fish load FAIL:", _fe)'''
            m = m.replace("self._is_speaking         = False", block, 1)
            print("  OK fish init in main")

    # Kill Gemini audio always when fish flag
    if "ONLY_FISH_SKIP_GEMINI" not in m:
        old = (
            "                    if response.data:\n"
            "                        if self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        new = (
            "                    if response.data:\n"
            "                        # ONLY_FISH_SKIP_GEMINI\n"
            '                        if getattr(self, "_use_fish_voice", False):\n'
            "                            pass\n"
            "                        elif self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        if old in m:
            m = m.replace(old, new, 1)
            print("  OK skip Gemini PCM")

    if "ONLY_FISH_SPEAK" not in m:
        target = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
        if target in m:
            m = m.replace(
                target,
                target
                + '''
                                # ONLY_FISH_SPEAK
                                if getattr(self, "_use_fish_voice", False) and self._fish_player:
                                    _fo = full_out
                                    def _fs(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            self._fish_player.speak(t)
                                        except Exception as e:
                                            print("[JARVIS] Fish speak FAIL:", e)
                                        finally:
                                            import time as _t
                                            self._speak_mute_until = _t.monotonic() + 2.0
                                            self.set_speaking(False)
                                    threading.Thread(target=_fs, daemon=True).start()''',
                1,
            )
            print("  OK speak on every reply")

    MAIN.write_text(m, encoding="utf-8")
    print("  OK main.py hardwired")


def main() -> None:
    print("=== ONLY_FISH ===\n")
    ensure_fish_module()
    key = load_key()
    print("  key OK, voice", VOICE_ID)
    try:
        test_speak(key)
    except Exception as e:
        print("\nTEST FAILED:", e)
        print("Fix API key / network, then retry.")
        print("Also try:  pip install fish-audio-sdk pygame requests")
        raise SystemExit(1)
    hardwire_main()
    print("\nSUCCESS. Now:  python main.py")
    print("Must see: [JARVIS] ONLY FISH voice on")


if __name__ == "__main__":
    main()
