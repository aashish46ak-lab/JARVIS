"""
Force JARVIS to talk back with Fish voice.
Voice id: 05b36da8574341d0803391491850db20

  python FIX_TALK_BACK.py
  python main.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
CFG = ROOT / "config" / "api_keys.json"
FISH = ROOT / "core" / "fish_tts.py"
VOICE_ID = "05b36da8574341d0803391491850db20"


def main() -> None:
    if not MAIN.exists():
        raise SystemExit("Run inside JARVIS-MARK43 (main.py missing)")

    # config
    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    key = (data.get("fish_api_key") or "").strip()
    if not key or key.startswith("YOUR_"):
        print("Paste Fish API key:")
        key = input("> ").strip()
        if not key:
            raise SystemExit("Need fish_api_key")
    data["fish_api_key"] = key
    data["fish_voice_id"] = VOICE_ID
    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("OK config fish key + voice id")

    # fish module
    ROOT.joinpath("core").mkdir(exist_ok=True)
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py",
        FISH,
    )
    print("OK fish_tts.py")

    # test
    print("Test speak…")
    import sys

    sys.path.insert(0, str(ROOT))
    from core.fish_tts import FishAudioTTSEngine

    try:
        FishAudioTTSEngine(key, VOICE_ID).speak("Hello sir. JARVIS is ready.")
        print("OK heard test? If silent, fix speakers / key.")
    except Exception as e:
        print("TEST FAIL:", e)
        print("pip install fish-audio-sdk soundfile pydub")

    m = MAIN.read_text(encoding="utf-8")

    # Gemini voice name fix
    if "voice_name=get_voice()" in m:
        m = m.replace(
            "voice_name=get_voice()",
            'voice_name=(_gv if (_gv := get_voice()) in '
            '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
            1,
        )
        print("OK Gemini voice map")

    # Always-on Fish init (replace weak / missing)
    if "FishAudioTTSEngine" not in m:
        if "self._is_speaking         = False" in m:
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
                self._fish_engine = FishAudioTTSEngine(_fkey, "{VOICE_ID}")
                self._use_fish_voice = True
                print("[JARVIS] Fish talk-back ON")
        except Exception as _fe:
            print("[JARVIS] Fish load:", _fe)''',
                1,
            )
            print("OK fish init")
    else:
        # Prefer direct engine.speak (skip TTSPlayer issues)
        m = m.replace("14129c3e320149449d6bada6862f7338", VOICE_ID)
        if "self._fish_engine" not in m and "FishAudioTTSEngine" in m:
            # add _fish_engine alias after fish player if needed
            pass
        print("OK voice id forced in main")

    # Skip Gemini PCM when fish
    if "getattr(self, \"_use_fish_voice\"" not in m and 'getattr(self, "_use_fish_voice"' not in m:
        old_a = (
            "                    if response.data:\n"
            "                        if self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        new_a = (
            "                    if response.data:\n"
            '                        if getattr(self, "_use_fish_voice", False):\n'
            "                            pass\n"
            "                        elif self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        if old_a in m:
            m = m.replace(old_a, new_a, 1)
            print("OK skip Gemini PCM")

    # Speak path — use _fish_engine or _fish_player
    speak_block = '''
                                # FISH_TALK_BACK
                                if getattr(self, "_use_fish_voice", False):
                                    _fo = full_out
                                    def _fs(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            eng = getattr(self, "_fish_engine", None)
                                            if eng is not None:
                                                eng.speak(t)
                                            elif getattr(self, "_fish_player", None):
                                                self._fish_player.speak(t)
                                        except Exception as e:
                                            print("[JARVIS] talk-back FAIL:", e)
                                        finally:
                                            import time as _t
                                            self._speak_mute_until = _t.monotonic() + 2.0
                                            self.set_speaking(False)
                                    threading.Thread(target=_fs, daemon=True).start()
'''
    if "FISH_TALK_BACK" not in m:
        target = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
        if target in m:
            # only inject once after first log of full_out
            m = m.replace(target, target + speak_block, 1)
            print("OK talk-back on every JARVIS line")
        else:
            print("! full_out log line not found")
    else:
        print("· talk-back already present")

    # Ensure _fish_engine created even if old TTSPlayer path exists
    if "FishAudioTTSEngine" in m and "_fish_engine" not in m:
        m = m.replace(
            "self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))",
            f'self._fish_engine = FishAudioTTSEngine(_fkey, "{VOICE_ID}")\n'
            f'                self._fish_player = None',
        )
        m = m.replace(
            "self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, \"%s\"))" % VOICE_ID,
            f'self._fish_engine = FishAudioTTSEngine(_fkey, "{VOICE_ID}")\n'
            f'                self._fish_player = None',
        )

    MAIN.write_text(m, encoding="utf-8")
    print("\nSaved main.py")
    print("Run:  python main.py")
    print("Say hello — JARVIS must speak with Fish voice.")


if __name__ == "__main__":
    main()
