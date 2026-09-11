"""
Install the cyan SVG J.A.R.V.I.S. HUD as the center visual in Mark-LIII ui.py.

Run from python folder:
    python INSTALL_JARVIS_HUD.py
    pip install PyQt6-WebEngine
    python main.py
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui.py"
HUD_DIR = ROOT / "hud_jarvis"
HUD_HTML = HUD_DIR / "index.html"


def ensure_html() -> Path:
    HUD_DIR.mkdir(parents=True, exist_ok=True)
    local = Path(__file__).resolve().parent / "jarvis_hud.html"
    candidates = [local, ROOT / "jarvis_hud.html", HUD_HTML]
    for c in candidates:
        if c.exists() and c.stat().st_size > 500:
            if c != HUD_HTML:
                HUD_HTML.write_text(c.read_text(encoding="utf-8", errors="ignore"), encoding="utf-8")
            print(f"  OK HUD html: {HUD_HTML}")
            return HUD_HTML

    url = "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/hud_jarvis/index.html"
    try:
        print("  downloading HUD from GitHub...")
        urllib.request.urlretrieve(url, HUD_HTML)
        if HUD_HTML.stat().st_size > 500:
            print("  OK downloaded")
            return HUD_HTML
    except Exception as e:
        print("  download failed:", e)

    raise SystemExit(
        "jarvis_hud.html missing. Save the HTML as:\n"
        f"  {HUD_HTML}\n"
        "then run this script again."
    )


def patch_ui(html_path: Path) -> None:
    if not UI.exists():
        raise SystemExit("ui.py not found — run inside python/")
    m = UI.read_text(encoding="utf-8")

    path = str(html_path.resolve()).replace("\\", "\\\\")

    if "JARVIS_SVG_HUD" in m:
        print("  visual already patched (JARVIS_SVG_HUD)")
        return

    marker = "self.hud = HudCanvas(face_path, _display)"
    if marker not in m:
        if "self.hud = HudCanvas" in m:
            idx = m.find("self.hud = HudCanvas")
            end = m.find("\n", idx)
            line = m[idx:end]
            inject = line + "\n" + _web_inject(path)
            m = m.replace(line, inject, 1)
            UI.write_text(m, encoding="utf-8")
            print("  OK ui.py patched (after existing HudCanvas)")
            return
        raise SystemExit("HudCanvas marker not found in ui.py")

    inject = marker + "\n" + _web_inject(path)
    m = m.replace(marker, inject, 1)
    UI.write_text(m, encoding="utf-8")
    print("  OK ui.py → SVG J.A.R.V.I.S. HUD")


def _web_inject(path: str) -> str:
    return f'''        # JARVIS_SVG_HUD — cyan multi-ring interface
        try:
            try:
                from PyQt6.QtWebEngineWidgets import QWebEngineView
                from PyQt6.QtCore import QUrl
            except ImportError:
                from PyQt5.QtWebEngineWidgets import QWebEngineView
                from PyQt5.QtCore import QUrl
            _jv = QWebEngineView()
            _jv.setUrl(QUrl.fromLocalFile(r"{path}"))
            _jv.setMinimumSize(320, 320)
            self.hud = _jv
            print("[JARVIS] SVG J.A.R.V.I.S. HUD loaded")
        except Exception as _e:
            print("[JARVIS] WebEngine needed for HUD:", _e)
            print("[JARVIS] pip install PyQt6-WebEngine")
'''


def main() -> None:
    print("=== INSTALL_JARVIS_HUD ===")
    html = ensure_html()
    patch_ui(html)
    print(
        "\nNext:\n"
        "  pip install PyQt6-WebEngine\n"
        "  python main.py\n"
    )


if __name__ == "__main__":
    main()
