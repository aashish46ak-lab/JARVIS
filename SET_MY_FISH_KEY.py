"""
Set YOUR Fish API key + lock voice id 05b36da8574341d0803391491850db20
Then fix Gemini (JARVIS name crash) and enable Fish TTS in main.py.

  cd JARVIS-MARK43
  python SET_MY_FISH_KEY.py
  python main.py
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = ROOT / "config" / "api_keys.json"
MAIN = ROOT / "main.py"
FISH = ROOT / "core" / "fish_tts.py"
VOICE_ID = "05b36da8574341d0803391491850db20"


def main() -> None:
    print("=== SET FISH KEY + VOICE ===\n")
    print(f"Voice ID locked: {VOICE_ID}\n")

    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}

    current = (data.get("fish_api_key") or "").strip()
    if current and not current.startswith("YOUR_"):
        print(f"Current fish key: {current[:6]}…{current[-4:]}")
        ans = input("Keep this key? [Y/n]: ").strip().lower()
        if ans in ("n", "no"):
            current = ""
    if not current or current.startswith("YOUR_"):
        print("Paste your Fish Audio API key (from https://fish.audio ):")
        current = input("> ").strip()
    if not current:
        raise SystemExit("No key entered.")

    data["fish_api_key"] = current
    data["fish_voice_id"] = VOICE_ID
    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    if not data.get("gemini_api_key"):
        print("\n(optional) Gemini key still missing — JARVIS needs it to listen.")
        g = input("Paste Gemini API key now (or Enter to skip): ").strip()
        if g:
            data["gemini_api_key"] = g
    if not data.get("os_system"):
        data["os_system"] = "windows"

    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved → {CFG}")
    print(f"  fish_voice_id = {VOICE_ID}")
    print(f"  fish_api_key  = {current[:6]}…")

    # Download latest fish_tts
    ROOT.joinpath("core").mkdir(exist_ok=True)
    try:
        urllib.request.urlretrieve(
            "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py",
            FISH,
        )
        print("OK core/fish_tts.py")
    except Exception as e:
        print("fish_tts download:", e)

    # Test speak
    print("\nTesting Fish TTS (you should HEAR audio)…")
    try:
        import sys

        sys.path.insert(0, str(ROOT))
        from core.fish_tts import FishAudioTTSEngine

        FishAudioTTSEngine(current, VOICE_ID).speak(
            "Hello sir. This is JARVIS. Fish audio is online."
        )
        print("OK — you should have heard the voice.")
    except Exception as e:
        print("TEST FAILED:", e)
        print("Check key / internet. pip install fish-audio-sdk soundfile pydub")

    # Fix Gemini JARVIS name crash
    if MAIN.exists():
        m = MAIN.read_text(encoding="utf-8")
        if "voice_name=get_voice()" in m:
            m = m.replace(
                "voice_name=get_voice()",
                'voice_name=(_gv if (_gv := get_voice()) in '
                '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
                1,
            )
            print("OK Gemini maps JARVIS → Charon (connect fix)")

        # Ensure fish loads whenever key present
        if "FishAudioTTSEngine" not in m and "self._is_speaking         = False" in m:
            m = m.replace(
                "self._is_speaking         = False",
                f'''self._is_speaking         = False
        self._speak_mute_until    = 0.0
        self._fish_player         = None
        self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey and not _fkey.startswith("YOUR_"):
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, "{VOICE_ID}"))
                self._use_fish_voice = True
                print("[JARVIS] Fish voice ON")
        except Exception as _fe:
            print("[JARVIS] Fish:", _fe)''',
                1,
            )
            print("OK Fish init in main.py")

        old_a = (
            "                    if response.data:\n"
            "                        if self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        new_a = (
            "                    if response.data:\n"
            '                        if getattr(self, "_use_fish_voice", False):\n'
            "                            pass  # Fish speaks\n"
            "                        elif self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        if old_a in m and "Fish speaks" not in m:
            m = m.replace(old_a, new_a, 1)
            print("OK skip Gemini audio when Fish on")

        if "_fish_player.speak" not in m:
            t = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
            if t in m:
                m = m.replace(
                    t,
                    t
                    + '''
                                if getattr(self, "_use_fish_voice", False) and self._fish_player:
                                    _fo = full_out
                                    def _fs(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            self._fish_player.speak(t)
                                        except Exception as e:
                                            print("[JARVIS] Fish speak:", e)
                                        finally:
                                            import time as _t
                                            self._speak_mute_until = _t.monotonic() + 2.0
                                            self.set_speaking(False)
                                    threading.Thread(target=_fs, daemon=True).start()''',
                    1,
                )
                print("OK Fish speak on replies")

        # force voice id string
        m = m.replace("14129c3e320149449d6bada6862f7338", VOICE_ID)
        MAIN.write_text(m, encoding="utf-8")

    print("\n=== DONE ===")
    print("  python main.py")
    print("Must see: [JARVIS] Fish voice ON   (or Fish TTS active)")
    print("Must NOT see: No matching speaker voice found for name: JARVIS")


if __name__ == "__main__":
    main()
