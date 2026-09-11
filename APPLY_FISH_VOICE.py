"""
Force Fish Audio voice for JARVIS.
Default voice id: 05b36da8574341d0803391491850db20

Run inside JARVIS-MARK43 / Mark-LIII folder:
  python APPLY_FISH_VOICE.py
  python main.py

Must see in console: [JARVIS] Fish TTS active
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = ROOT / "config" / "api_keys.json"
VOICE_ID = "05b36da8574341d0803391491850db20"


def main() -> None:
    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}

    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    data["fish_voice_id"] = VOICE_ID

    if not (data.get("fish_api_key") or "").strip():
        print("! fish_api_key is EMPTY")
        print("  Edit config/api_keys.json and set:")
        print('  "fish_api_key": "YOUR_FISH_API_KEY"')
        print("  Get key: https://fish.audio")
    else:
        print("  fish_api_key: present")

    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"  voice_name = JARVIS")
    print(f"  fish_voice_id = {VOICE_ID}")
    print(f"  saved → {CFG}")

    # Ensure main has fish hooks; if not, remind SETUP
    main_py = ROOT / "main.py"
    if main_py.exists():
        t = main_py.read_text(encoding="utf-8")
        if "_use_fish_voice" not in t or "FishAudioTTSEngine" not in t:
            print("! main.py missing Fish hooks — run SETUP_MARK43.py once")
        else:
            # force default id string in main if old id still hardcoded
            if "14129c3e320149449d6bada6862f7338" in t:
                main_py.write_text(
                    t.replace("14129c3e320149449d6bada6862f7338", VOICE_ID),
                    encoding="utf-8",
                )
                print("  updated hardcoded voice id in main.py")
            print("  OK main.py has Fish support")

    fish = ROOT / "core" / "fish_tts.py"
    if not fish.exists():
        print("! core/fish_tts.py missing — download it:")
        print("  powershell Invoke-WebRequest .../core/fish_tts.py -OutFile core\\fish_tts.py")
    else:
        ft = fish.read_text(encoding="utf-8")
        if VOICE_ID not in ft:
            fish.write_text(
                ft.replace("14129c3e320149449d6bada6862f7338", VOICE_ID),
                encoding="utf-8",
            )
            print("  updated default id in fish_tts.py")

    print("\nRestart:  python main.py")
    print("Look for: [JARVIS] Fish TTS active")


if __name__ == "__main__":
    main()
