"""
Add JARVIS to Windows startup (runs main.py when you log in).
Run inside JARVIS-MARK43 folder:
  python INSTALL_STARTUP.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"


def main() -> None:
    if not MAIN.exists():
        raise SystemExit("main.py not found — run inside JARVIS-MARK43")

    python = sys.executable
    # VBS silent launcher (no black console flash optional — use pythonw if available)
    pyw = Path(python).with_name("pythonw.exe")
    exe = str(pyw if pyw.exists() else python)

    startup = Path(os.environ["APPDATA"]) / r"Microsoft\Windows\Start Menu\Programs\Startup"
    startup.mkdir(parents=True, exist_ok=True)

    bat = startup / "JARVIS-MARK43.bat"
    bat.write_text(
        f'@echo off\r\n'
        f'cd /d "{ROOT}"\r\n'
        f'start "" "{exe}" "{MAIN}"\r\n',
        encoding="utf-8",
    )
    print(f"OK startup: {bat}")
    print("JARVIS will start when you log into Windows.")
    print("To remove: delete that .bat from Startup folder.")


if __name__ == "__main__":
    main()
