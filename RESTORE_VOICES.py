"""
Restore Gemini assistant voices: Charon, Puck, Kore, Fenrir, Aoede.
Fish only when you choose it / have credit.

  python RESTORE_VOICES.py
  python main.py

Customize → ASSISTANT VOICE → pick Charon/Puck/… (instant, free)
"""
from __future__ import annotations

import json
import re
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
CFG_MGR = ROOT / "memory" / "config_manager.py"
CFG = ROOT / "config" / "api_keys.json"
CLEAN_URL = "https://raw.githubusercontent.com/FatihMakes/Mark-LIII/main/main.py"


def main() -> None:
    print("=== RESTORE_VOICES ===\n")

    # Clean main from Mark-LIII (removes broken fish-only patches)
    if MAIN.exists():
        shutil.copy2(MAIN, ROOT / "main.py.before_restore_voices")
    print("Downloading clean main.py…")
    urllib.request.urlretrieve(CLEAN_URL, MAIN)
    print("OK clean main.py (all Gemini voices work again)")

    m = MAIN.read_text(encoding="utf-8")
    # Safety: never send invalid name to Gemini
    if "voice_name=get_voice()" in m:
        m = m.replace(
            "voice_name=get_voice()",
            'voice_name=(_gv if (_gv := get_voice()) in '
            '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
            1,
        )
        print("OK Gemini voice whitelist")
    MAIN.write_text(m, encoding="utf-8")
    compile(m, str(MAIN), "exec")
    print("Syntax OK")

    # config_manager voices
    if CFG_MGR.exists():
        c = CFG_MGR.read_text(encoding="utf-8")
        c2 = re.sub(
            r"AVAILABLE_VOICES\s*=\s*\[[^\]]*\]",
            'AVAILABLE_VOICES = ["Charon", "Puck", "Kore", "Fenrir", "Aoede"]',
            c,
            count=1,
        )
        c2 = re.sub(
            r'DEFAULT_VOICE\s*=\s*"[^"]*"',
            'DEFAULT_VOICE    = "Charon"',
            c2,
            count=1,
        )
        CFG_MGR.write_text(c2, encoding="utf-8")
        print("OK AVAILABLE_VOICES restored")

    # config: use Charon (native), keep fish key for later if present
    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    data["voice_name"] = "Charon"
    data["tts_engine"] = "gemini"
    # keep fish_api_key / fish_voice_id if user had them — just not forced
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("OK default voice = Charon (Gemini native)")

    print(
        "\n=== DONE ===\n"
        "  python main.py\n"
        "Gear → ASSISTANT VOICE:\n"
        "  Charon / Puck / Kore / Fenrir / Aoede  → talk back works\n"
        "Fish: only after API credit is available (optional later)\n"
    )


if __name__ == "__main__":
    main()
