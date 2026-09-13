"""
1) Download CLEAN main.py from Mark-LIII (fixes all IndentationErrors)
2) Apply ONE Fish talk-back patch (voice id 05b36da8574341d0803391491850db20)
3) Gemini gets Charon only (not JARVIS name)
4) Only your Fish voice speaks

  python RESTORE_AND_FISH.py
  python main.py
"""
from __future__ import annotations

import json
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
CFG = ROOT / "config" / "api_keys.json"
FISH = ROOT / "core" / "fish_tts.py"
VOICE_ID = "05b36da8574341d0803391491850db20"
CLEAN_URL = "https://raw.githubusercontent.com/FatihMakes/Mark-LIII/main/main.py"
FISH_URL = "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py"

SPEAK = '''
                                # FISH_SPEAK_V1
                                if getattr(self, "_use_fish_voice", False) and full_out:
                                    _fo = full_out
                                    def _fish_say(t=_fo):
                                        try:
                                            with self._speaking_lock:
                                                self._is_speaking = True
                                            eng = getattr(self, "_fish_engine", None)
                                            if eng is not None:
                                                eng.speak(t)
                                        except Exception as _e:
                                            print("[JARVIS] Fish:", _e)
                                        finally:
                                            try:
                                                import time as _t
                                                self._speak_mute_until = _t.monotonic() + 2.5
                                            except Exception:
                                                pass
                                            try:
                                                with self._speaking_lock:
                                                    self._is_speaking = False
                                            except Exception:
                                                pass
                                    threading.Thread(target=_fish_say, daemon=True).start()
'''

INIT = f'''self._is_speaking         = False
        # FISH_INIT_V1
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
                print("[JARVIS] Fish voice ready ({VOICE_ID[:8]}…)")
        except Exception as _fe:
            print("[JARVIS] Fish init:", _fe)'''


def main() -> None:
    print("=== RESTORE_AND_FISH ===\n")

    # backup broken main
    if MAIN.exists():
        bak = ROOT / "main.py.broken_backup"
        shutil.copy2(MAIN, bak)
        print("Backup →", bak)

    print("Downloading clean main.py from Mark-LIII…")
    urllib.request.urlretrieve(CLEAN_URL, MAIN)
    print("OK clean main.py")

    ROOT.joinpath("core").mkdir(exist_ok=True)
    urllib.request.urlretrieve(FISH_URL, FISH)
    print("OK fish_tts.py")

    # config: only Fish voice settings
    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    key = (data.get("fish_api_key") or "").strip()
    if not key or key.startswith("YOUR_"):
        print("\nPaste your Fish API key:")
        key = input("> ").strip()
    if not key:
        raise SystemExit("Need fish_api_key")
    data["fish_api_key"] = key
    data["fish_voice_id"] = VOICE_ID
    data["voice_name"] = "Charon"  # Gemini-safe name (Fish still speaks)
    data["tts_engine"] = "fish"
    if not data.get("os_system"):
        data["os_system"] = "windows"
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("OK config (Fish id locked, Gemini voice=Charon)")

    m = MAIN.read_text(encoding="utf-8")

    # Gemini voice: always Charon if invalid
    m = m.replace(
        "voice_name=get_voice()",
        'voice_name=(_gv if (_gv := get_voice()) in '
        '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
        1,
    )

    # init
    if "self._is_speaking         = False" not in m:
        raise SystemExit("clean main unexpected — _is_speaking missing")
    m = m.replace("self._is_speaking         = False", INIT, 1)

    # skip Gemini PCM when fish on
    old_a = (
        "                    if response.data:\n"
        "                        if self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    new_a = (
        "                    if response.data:\n"
        '                        if getattr(self, "_use_fish_voice", False):\n'
        "                            pass  # Fish only\n"
        "                        elif self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    if old_a not in m:
        raise SystemExit("clean main unexpected — response.data block missing")
    m = m.replace(old_a, new_a, 1)

    # speak after full_out log
    anchor = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
    if anchor not in m:
        raise SystemExit("clean main unexpected — full_out log missing")
    m = m.replace(anchor, anchor + SPEAK, 1)

    MAIN.write_text(m, encoding="utf-8")

    try:
        compile(m, str(MAIN), "exec")
        print("Syntax OK")
    except SyntaxError as e:
        print("Syntax FAIL:", e)
        raise SystemExit(1)

    # test audio
    print("\nTesting Fish…")
    import sys

    sys.path.insert(0, str(ROOT))
    from core.fish_tts import FishAudioTTSEngine

    try:
        FishAudioTTSEngine(key, VOICE_ID).speak("Hello sir. JARVIS Fish voice is online.")
        print("TEST OK — you should hear it")
    except Exception as e:
        print("TEST FAIL:", e)
        print("pip install fish-audio-sdk soundfile pydub")

    print("\n=== DONE ===")
    print("  python main.py")
    print("Must see: [JARVIS] Fish voice ready")
    print("Only Fish speaks (Gemini audio muted).")


if __name__ == "__main__":
    main()
