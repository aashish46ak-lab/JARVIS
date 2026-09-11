"""
Use interactive 3D human face as JARVIS center UI.
Source: https://github.com/tejusrevi/interactive-human-face
Live:   https://tejus-revi.web.app/

Run inside JARVIS-MARK43 / Mark-LIII folder:
  pip install PyQt6-WebEngine
  python INSTALL_FACE.py
  python main.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui.py"
FACE_DIR = ROOT / "hud_face"
FACE_HTML = FACE_DIR / "index.html"

# Hosted demo from the repo author (Three.js head follows cursor)
FACE_URL = "https://tejus-revi.web.app/"

HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>JARVIS Face</title>
<style>
  html,body{{margin:0;height:100%;background:#020608;overflow:hidden}}
  iframe{{border:0;width:100%;height:100%;background:#020608}}
  .fallback{{color:#6fe3ff;font-family:Consolas,monospace;text-align:center;padding-top:40vh}}
</style>
</head>
<body>
<iframe src="{FACE_URL}" allow="accelerometer; gyroscope" title="JARVIS Face"></iframe>
</body>
</html>
"""


def main() -> None:
    if not UI.exists():
        raise SystemExit("ui.py missing — run inside Mark-LIII / JARVIS-MARK43")

    FACE_DIR.mkdir(parents=True, exist_ok=True)
    FACE_HTML.write_text(HTML, encoding="utf-8")
    print("OK face html →", FACE_HTML)

    m = UI.read_text(encoding="utf-8")
    path = str(FACE_HTML.resolve()).replace("\\", "\\\\")

    # Remove older HUD injections markers by placing FACE after HudCanvas
    if "JARVIS_FACE_3D" in m:
        print("Face already installed")
        return

    marker = "self.hud = HudCanvas(face_path, _display)"
    if marker not in m:
        if "self.hud = HudCanvas" in m:
            idx = m.find("self.hud = HudCanvas")
            end = m.find("\n", idx)
            line = m[idx:end]
        else:
            raise SystemExit("HudCanvas line not found in ui.py")
    else:
        line = marker

    inject = f'''{line}
        # JARVIS_FACE_3D — tejusrevi interactive-human-face
        try:
            try:
                from PyQt6.QtWebEngineWidgets import QWebEngineView
                from PyQt6.QtCore import QUrl
            except ImportError:
                from PyQt5.QtWebEngineWidgets import QWebEngineView
                from PyQt5.QtCore import QUrl
            _face = QWebEngineView()
            # Prefer local wrapper (iframe → hosted Three.js face)
            _face.setUrl(QUrl.fromLocalFile(r"{path}"))
            _face.setMinimumSize(360, 360)
            self.hud = _face
            print("[JARVIS] 3D face HUD loaded (interactive-human-face)")
        except Exception as _fe:
            print("[JARVIS] Face WebEngine failed:", _fe)
            print("[JARVIS] pip install PyQt6-WebEngine")
'''
    m = m.replace(line, inject, 1)
    UI.write_text(m, encoding="utf-8")
    print("OK ui.py patched")
    print("\nNext:")
    print("  pip install PyQt6-WebEngine")
    print("  python main.py")
    print("Center = 3D head that follows mouse (needs internet first load).")


if __name__ == "__main__":
    main()
