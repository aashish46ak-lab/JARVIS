"""
One-shot: brand Mark 43 + By Ashish, Instagram open fix, Fish echo mute, prompt.
Run from the python folder (where main.py lives):

    python APPLY_ALL.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def brand_ui() -> None:
    ui = ROOT / "ui.py"
    if not ui.exists():
        print("! ui.py missing — skip branding")
        return
    m = ui.read_text(encoding="utf-8")
    changed = False

    if 'APP_VERSION  = "MARK LIII"' in m:
        m = m.replace('APP_VERSION  = "MARK LIII"', 'APP_VERSION  = "MARK 43"', 1)
        changed = True
    elif 'APP_VERSION = "MARK LIII"' in m:
        m = m.replace('APP_VERSION = "MARK LIII"', 'APP_VERSION = "MARK 43"', 1)
        changed = True
    elif 'APP_VERSION  = "MARK 43"' in m or 'APP_VERSION = "MARK 43"' in m:
        print("  · APP_VERSION already MARK 43")
    else:
        import re
        m2, n = re.subn(
            r'APP_VERSION\s*=\s*"[^"]*"',
            'APP_VERSION  = "MARK 43"',
            m,
            count=1,
        )
        if n:
            m = m2
            changed = True
            print("  · APP_VERSION set via regex")
        else:
            print("  ! APP_VERSION marker not found")

    if "By FatihMakes" in m:
        m = m.replace("By FatihMakes", "By Ashish", 1)
        changed = True
    elif "By Ashish" in m:
        print("  · Footer already By Ashish")
    else:
        print("  ! By FatihMakes not found (footer may differ)")

    if changed:
        ui.write_text(m, encoding="utf-8")
        print("  ✓ ui.py → MARK 43 + By Ashish")
    else:
        print("  · ui.py branding unchanged")


def fix_instagram() -> None:
    script = ROOT / "fix_open_app_instagram.py"
    if script.exists():
        print("  → fix_open_app_instagram.py")
        import runpy
        try:
            runpy.run_path(str(script), run_name="__main__")
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"  ! exit {e.code}")
        except Exception as e:
            print(f"  ! {e}")
        return

    p = ROOT / "actions" / "open_app.py"
    if not p.exists():
        print("  ! actions/open_app.py missing")
        return
    m = p.read_text(encoding="utf-8")
    if "__WEB__:https://www.instagram.com/" in m:
        print("  · Instagram already web-open")
        return
    if "import webbrowser" not in m:
        m = m.replace("import shutil", "import shutil\nimport webbrowser")
    old = '"instagram":          {"Windows": "Instagram",               "Darwin": "Instagram",            "Linux": "firefox"},'
    new = (
        '"instagram":          {"Windows": "__WEB__:https://www.instagram.com/", '
        '"Darwin": "__WEB__:https://www.instagram.com/", '
        '"Linux": "__WEB__:https://www.instagram.com/"},'
    )
    if old not in m:
        print("  ! instagram alias not found")
        return
    m = m.replace(old, new, 1)
    needle = '    print(f"[open_app] Launching: \'{app_name}\' → \'{normalized}\' ({_SYSTEM})")'
    if needle in m and 'startswith("__WEB__:")' not in m:
        m = m.replace(
            needle,
            needle
            + "\n    if isinstance(normalized, str) and normalized.startswith(\"__WEB__:\"):\n"
            "        url = normalized.split(\"__WEB__:\", 1)[1]\n"
            "        webbrowser.open(url)\n"
            "        return f\"Opened {url}.\"",
            1,
        )
    p.write_text(m, encoding="utf-8")
    print("  ✓ open_app Instagram → browser")


def patch_fish() -> None:
    script = ROOT / "patch_fish_main.py"
    if not script.exists():
        print("  · patch_fish_main.py not present — skip")
        return
    if not (ROOT / "main.py").exists():
        print("  ! main.py missing")
        return
    print("  → patch_fish_main.py")
    import runpy
    try:
        runpy.run_path(str(script), run_name="__main__")
    except SystemExit as e:
        if e.code not in (0, None):
            print(f"  ! exit {e.code}")
    except Exception as e:
        print(f"  ! {e}")


def ensure_prompt() -> None:
    dest = ROOT / "core" / "prompt.txt"
    if not dest.exists():
        print("  ! core/prompt.txt missing")
        return
    text = dest.read_text(encoding="utf-8")
    if "insta khol" in text and "Ashish" in text:
        print("  · prompt.txt already customized")
        return
    if "instagram.com" not in text.lower():
        print("  · prompt present (download latest from GitHub for full custom)")
    else:
        print("  ✓ prompt.txt OK")


def ensure_keys() -> None:
    cfg = ROOT / "config" / "api_keys.json"
    if not cfg.exists():
        print("  ! config/api_keys.json missing")
        return
    try:
        data = json.loads(cfg.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  ! api_keys.json read error: {e}")
        return
    changed = False
    if not data.get("fish_voice_id"):
        data["fish_voice_id"] = "14129c3e320149449d6bada6862f7338"
        changed = True
    if "fish_api_key" not in data:
        data["fish_api_key"] = ""
        changed = True
    if data.get("assistant_name") in (None, ""):
        data["assistant_name"] = "JARVIS"
        changed = True
    if data.get("user_name") in (None, ""):
        data["user_name"] = "sir"
        changed = True
    if changed:
        cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print("  ✓ api_keys.json fields ensured")
    else:
        print("  · api_keys.json OK (Fish already set — good)")


def main() -> int:
    print("=== JARVIS / MARK 43 — APPLY ALL ===\n")
    print("[1] Branding")
    brand_ui()
    print("[2] Instagram / open_app")
    fix_instagram()
    print("[3] Fish echo mute")
    patch_fish()
    print("[4] Prompt")
    ensure_prompt()
    print("[5] API keys")
    ensure_keys()
    print(
        "\n=== DONE ===\n"
        "Run:\n"
        "  python main.py\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
