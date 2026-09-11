"""
MARK LIII — one-time setup.

Installs the Python dependencies for THIS operating system only: the OS-specific
packages in requirements.txt carry `sys_platform` markers, so a macOS or Linux
user never pulls Windows-only libraries (and vice-versa). Then it fetches the
Playwright browsers needed for web automation (current-OS builds only).

The optional local wake word ("Hey Jarvis") is NOT installed here — it's a
one-click, opt-in download from ⚙ → WAKE WORD inside the app.
"""
import platform
import subprocess
import sys
from pathlib import Path

OS = platform.system()  # "Windows" | "Darwin" | "Linux"


def _run(label: str, args: list[str]) -> None:
    print(f"\n▶ {label}")
    subprocess.run(args, check=True)


def main() -> None:
    print(f"⚙  MARK LIII setup — detected OS: {OS or 'unknown'}")

    _run("Installing Python dependencies (OS-specific extras auto-filtered)…",
         [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

    _run("Installing Playwright browsers (chromium + firefox)…",
         [sys.executable, "-m", "playwright", "install", "chromium", "firefox"])

    if OS == "Windows":
        try:
            import win32com.client  # noqa: F401
        except ImportError:
            postinstall = Path(sys.executable).parent / "Scripts" / "pywin32_postinstall.py"
            print(
                "\n⚠️  pywin32 did not register correctly. To fix:\n"
                f'    "{sys.executable}" -m pip install --force-reinstall pywin32\n'
                f'    "{sys.executable}" "{postinstall}" -install'
            )
    elif OS == "Linux":
        print("\nℹ️  Linux: install pulseaudio-utils, brightnessctl, xdg-utils as needed.")
    elif OS == "Darwin":
        print("\nℹ️  macOS: uses osascript / LaunchAgents — no extra tools required.")

    print("\n✅ Setup complete!")
    print("  1) Create config/api_keys.json with gemini_api_key")
    print("  2) python main.py")


if __name__ == "__main__":
    main()
