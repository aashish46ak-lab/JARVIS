"""
FORCE Fish talk-back. Run in JARVIS-MARK43:

  python FORCE_TALK.py
  python main.py

Voice id: 05b36da8574341d0803391491850db20
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
CFG = ROOT / "config" / "api_keys.json"
FISH = ROOT / "core" / "fish_tts.py"
VOICE_ID = "05b36da8574341d0803391491850db20"

SPEAK_INJECT = '''
                                # === FORCE_FISH_SPEAK ===
                                if getattr(self, "_use_fish_voice", False):
                                    _fo = full_out
                                    def _force_fish(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            eng = getattr(self, "_fish_engine", None)
                                            if eng is not None:
                                                eng.speak(t)
                                            else:
                                                print("[JARVIS] no _fish_engine")
                                        except Exception as _e:
                                            print("[JARVIS] FORCE speak error:", _e)
                                        finally:
                                            import time as _t
                                            self._speak_mute_until = _t.monotonic() + 2.0
                                            self.set_speaking(False)
                                    threading.Thread(target=_force_fish, daemon=True).start()
'''

INIT_INJECT = f'''self._is_speaking         = False
        # === FORCE_FISH_INIT ===
        self._speak_mute_until    = 0.0
        self._fish_engine         = None
        self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey and not _fkey.startswith("YOUR_"):
                from core.fish_tts import FishAudioTTSEngine
                self._fish_engine = FishAudioTTSEngine(_fkey, "{VOICE_ID}")
                self._use_fish_voice = True
                print("[JARVIS] FORCE Fish talk-back ready")
        except Exception as _fe:
            print("[JARVIS] FORCE Fish init fail:", _fe)'''


def main() -> None:
    print("=== FORCE_TALK ===\n")
    if not MAIN.exists():
        raise SystemExit("main.py missing")

    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}

    key = (data.get("fish_api_key") or "").strip()
    if not key or key.startswith("YOUR_"):
        print("Enter Fish API key:")
        key = input("> ").strip()
    if not key:
        raise SystemExit("fish_api_key required")

    data["fish_api_key"] = key
    data["fish_voice_id"] = VOICE_ID
    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("1) config OK")

    ROOT.joinpath("core").mkdir(exist_ok=True)
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py",
        FISH,
    )
    print("2) fish_tts.py OK")

    import sys

    sys.path.insert(0, str(ROOT))
    from core.fish_tts import FishAudioTTSEngine

    print("3) test audio…")
    try:
        FishAudioTTSEngine(key, VOICE_ID).speak("Hello sir. Talk back is working.")
        print("   TEST OK (did you hear it?)")
    except Exception as e:
        print("   TEST FAILED:", e)
        print("   pip install fish-audio-sdk soundfile pydub")
        raise SystemExit(1)

    m = MAIN.read_text(encoding="utf-8")

    # Gemini voice
    if "voice_name=get_voice()" in m:
        m = m.replace(
            "voice_name=get_voice()",
            'voice_name=(_gv if (_gv := get_voice()) in '
            '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
            1,
        )
        print("4) Gemini JARVIS→Charon OK")
    else:
        print("4) Gemini map already ok or different")

    # Init
    if "FORCE_FISH_INIT" not in m:
        if "self._is_speaking         = False" in m:
            m = m.replace("self._is_speaking         = False", INIT_INJECT, 1)
            print("5) Fish init injected")
        else:
            print("5) FAIL: _is_speaking marker missing")
    else:
        print("5) Fish init already there")

    # Skip Gemini audio
    old_audio = (
        "                    if response.data:\n"
        "                        if self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    new_audio = (
        "                    if response.data:\n"
        '                        if getattr(self, "_use_fish_voice", False):\n'
        "                            pass  # Fish speaks instead\n"
        "                        elif self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    if "Fish speaks instead" not in m:
        if old_audio in m:
            m = m.replace(old_audio, new_audio, 1)
            print("6) skip Gemini PCM OK")
        else:
            print("6) WARN: audio branch not found")
    else:
        print("6) PCM skip already ok")

    # Speak inject before out_buf = []
    if "FORCE_FISH_SPEAK" not in m:
        anchor = (
            '                                self.ui.write_log(f"{self._asst_name}: {full_out}")\n'
            '                                self._session_log.append(f"{self._asst_name}: {full_out}")'
        )
        if anchor in m:
            m = m.replace(
                anchor,
                anchor + SPEAK_INJECT,
                1,
            )
            print("7) FORCE speak injected")
        else:
            # try shorter
            short = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
            if short in m:
                m = m.replace(short, short + SPEAK_INJECT, 1)
                print("7) FORCE speak injected (short)")
            else:
                print("7) FAIL: full_out log not found")
    else:
        print("7) speak already injected")

    MAIN.write_text(m, encoding="utf-8")
    print("\n=== SAVED main.py ===")
    print("Now run:  python main.py")
    print("Look for: [JARVIS] FORCE Fish talk-back ready")
    print("Say hello — must hear Fish voice.")


if __name__ == "__main__":
    main()
