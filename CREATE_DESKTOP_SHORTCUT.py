"""
Create Desktop shortcut to start JARVIS.

  python CREATE_DESKTOP_SHORTCUT.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"


def main() -> None:
    if not MAIN.exists():
        raise SystemExit("main.py not found")

    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        desktop = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
    desktop.mkdir(parents=True, exist_ok=True)

    python = sys.executable
    pyw = Path(python).with_name("pythonw.exe")
    # Use console python so user sees Fish / errors
    exe = python

    bat = desktop / "JARVIS.bat"
    bat.write_text(
        "@echo off\r\n"
        f'cd /d "{ROOT}"\r\n'
        "title JARVIS MARK 43\r\n"
        f'"{exe}" "{MAIN}"\r\n'
        "if errorlevel 1 pause\r\n",
        encoding="utf-8",
    )
    print(f"OK Desktop launcher: {bat}")
    print("Double-click JARVIS.bat on Desktop to open JARVIS.")

    # Optional .lnk via PowerShell
    try:
        import subprocess

        lnk = desktop / "JARVIS.lnk"
        ps = f'''
$W = New-Object -ComObject WScript.Shell
$S = $W.CreateShortcut("{lnk}")
$S.TargetPath = "{exe}"
$S.Arguments = "\"{MAIN}\""
$S.WorkingDirectory = "{ROOT}"
$S.WindowStyle = 1
$S.Description = "JARVIS MARK 43"
$S.Save()
'''
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            check=False,
            capture_output=True,
        )
        if lnk.exists():
            print(f"OK shortcut: {lnk}")
    except Exception as e:
        print("lnk optional failed:", e)


if __name__ == "__main__":
    main()
