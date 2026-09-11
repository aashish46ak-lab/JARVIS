"""
Patch actions/open_app.py so Instagram/YouTube/etc open in the browser
instead of the Microsoft Store download page.

Run from python folder:
    python fix_open_app_instagram.py
"""
from pathlib import Path

p = Path(__file__).resolve().parent / "actions" / "open_app.py"
if not p.exists():
    raise SystemExit(f"Not found: {p} — run GET_FULL_PYTHON.bat first")

m = p.read_text(encoding="utf-8")
if "__WEB__:https://www.instagram.com/" in m:
    print("Already fixed")
    raise SystemExit(0)

if "import webbrowser" not in m:
    m = m.replace("import shutil", "import shutil\nimport webbrowser")

old = '"instagram":          {"Windows": "Instagram",               "Darwin": "Instagram",            "Linux": "firefox"},'
new = (
    '"instagram":          {"Windows": "__WEB__:https://www.instagram.com/", "Darwin": "__WEB__:https://www.instagram.com/", "Linux": "__WEB__:https://www.instagram.com/"},\n'
    '    "insta":              {"Windows": "__WEB__:https://www.instagram.com/", "Darwin": "__WEB__:https://www.instagram.com/", "Linux": "__WEB__:https://www.instagram.com/"},\n'
    '    "ig":                 {"Windows": "__WEB__:https://www.instagram.com/", "Darwin": "__WEB__:https://www.instagram.com/", "Linux": "__WEB__:https://www.instagram.com/"},\n'
    '    "youtube":            {"Windows": "__WEB__:https://www.youtube.com/", "Darwin": "__WEB__:https://www.youtube.com/", "Linux": "__WEB__:https://www.youtube.com/"},\n'
    '    "yt":                 {"Windows": "__WEB__:https://www.youtube.com/", "Darwin": "__WEB__:https://www.youtube.com/", "Linux": "__WEB__:https://www.youtube.com/"},'
)
if old not in m:
    raise SystemExit("instagram alias line not found — open_app.py layout changed")
m = m.replace(old, new, 1)

needle = '    print(f"[open_app] Launching: \'{app_name}\' → \'{normalized}\' ({_SYSTEM})")'
hook = '''    print(f"[open_app] Launching: '{app_name}' → '{normalized}' ({_SYSTEM})")
    if isinstance(normalized, str) and normalized.startswith("__WEB__:"):
        url = normalized.split("__WEB__:", 1)[1]
        webbrowser.open(url)
        return f"Opened {url}."'''
if needle not in m:
    raise SystemExit("launch print marker not found")
if 'startswith("__WEB__:")' not in m:
    m = m.replace(needle, hook, 1)

p.write_text(m, encoding="utf-8")
print("Fixed open_app.py — Instagram/YouTube open in browser")
