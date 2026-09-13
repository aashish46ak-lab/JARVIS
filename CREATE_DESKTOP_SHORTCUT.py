"""Put JARVIS.bat on Desktop."""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"


def main() -> None:
    desktop = Path.home() / "Desktop"
    if not desktop.is_dir():
        desktop = Path(os.environ.get("USERPROFILE", "")) / "Desktop"
    desktop.mkdir(parents=True, exist_ok=True)

    bat = desktop / "JARVIS.bat"
    bat.write_text(
        "@echo off\r\n"
        f'cd /d "{ROOT}"\r\n'
        "title JARVIS MARK 43\r\n"
        f'"{sys.executable}" "{MAIN}"\r\n'
        "if errorlevel 1 pause\r\n",
        encoding="utf-8",
    )
    print("Desktop:", bat)


if __name__ == "__main__":
    main()
