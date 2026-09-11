"""
Apply Aashish JARVIS fixes on top of Mark-LIII (python/ folder).

Run from the python folder AFTER GET_FULL_PYTHON.bat (or after extracting Mark-LIII):

    cd path\\to\\JARVIS-main\\python
    python APPLY_PYTHON_FIXES.py

What it does:
  1. Copies fixed open_app.py (Instagram → website, not Store download)
  2. Installs Fish TTS module + patches main.py speaking gate
  3. Installs custom prompt.txt
  4. Ensures api_keys.json has fish_voice_id / fish_api_key fields
  5. Optionally patches HUD rings (if patch_hud_3d.py present)
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"  ✓ {dest.relative_to(ROOT)}")


def main() -> int:
    print("=== JARVIS Python fixes ===\n")

    src_open = ROOT / "actions" / "open_app.py"
    if not src_open.exists():
        alt = ROOT / "open_app.py"
        if alt.exists():
            dest = ROOT / "actions" / "open_app.py"
            dest.parent.mkdir(parents=True, exist_ok=True)
            _copy(alt, dest)
        else:
            print("  ! open_app.py not found — skip")
    else:
        print(f"  ✓ actions/open_app.py already in place")

    prompt_src = ROOT / "core" / "prompt.txt"
    if prompt_src.exists():
        print(f"  ✓ core/prompt.txt present ({prompt_src.stat().st_size} bytes)")
    else:
        print("  ! core/prompt.txt missing")

    fish = ROOT / "core" / "fish_tts.py"
    if fish.exists():
        print(f"  ✓ core/fish_tts.py present")
    else:
        print("  ! core/fish_tts.py missing — Fish voice will not work")

    patch = ROOT / "patch_fish_main.py"
    if patch.exists() and (ROOT / "main.py").exists():
        print("  → running patch_fish_main.py …")
        import runpy
        try:
            runpy.run_path(str(patch), run_name="__main__")
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"  ! patch exited {e.code}")
        except Exception as e:
            print(f"  ! patch error: {e}")
    else:
        print("  · patch_fish_main.py or main.py not ready yet")

    hud = ROOT / "patch_hud_3d.py"
    if hud.exists() and (ROOT / "ui.py").exists():
        print("  → running patch_hud_3d.py …")
        import runpy
        try:
            runpy.run_path(str(hud), run_name="__main__")
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"  ! hud patch exited {e.code}")
        except Exception as e:
            print(f"  ! hud patch error: {e}")
    else:
        print("  · HUD patch skipped (optional)")

    cfg_path = ROOT / "config" / "api_keys.json"
    example = ROOT / "config" / "api_keys.json.example"
    if not cfg_path.exists() and example.exists():
        shutil.copy2(example, cfg_path)
        print("  ✓ created config/api_keys.json from example")

    if cfg_path.exists():
        try:
            data = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            data = {}
        changed = False
        if "fish_voice_id" not in data:
            data["fish_voice_id"] = "14129c3e320149449d6bada6862f7338"
            changed = True
        if "fish_api_key" not in data:
            data["fish_api_key"] = data.get("fish_api_key", "")
            changed = True
        if "tts_engine" not in data:
            data["tts_engine"] = "fish"
            changed = True
        if "assistant_name" not in data:
            data["assistant_name"] = "JARVIS"
            changed = True
        if "user_name" not in data:
            data["user_name"] = "sir"
            changed = True
        if changed:
            cfg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
            print("  ✓ api_keys.json — fish_voice_id / tts_engine fields ensured")
        else:
            print("  ✓ api_keys.json already has fish fields")
        if not (data.get("gemini_api_key") or "").strip() or "PASTE" in (data.get("gemini_api_key") or ""):
            print("  ! Paste your Gemini API key into config/api_keys.json")
        if not (data.get("fish_api_key") or "").strip():
            print("  ! Optional: paste Fish API key for JARVIS voice (fish.audio)")
    else:
        print("  ! config/api_keys.json missing")

    print(
        "\n=== NEXT ===\n"
        "1. Edit config\\api_keys.json  (gemini_api_key + optional fish_api_key)\n"
        "2. python setup.py\n"
        "3. python main.py\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
