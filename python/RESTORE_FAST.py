"""
Restore clean Mark-LIII from https://github.com/FatihMakes/Mark-LIII
Speed-first: Gemini native voice (instant), light echo guard only.
Fish is OFF by default (Fish TTS is slower).

  cd python folder
  python RESTORE_FAST.py
  python main.py
"""
from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
UI = ROOT / "ui.py"
BACKUP = ROOT / "_backup_before_restore"
BASE = "https://raw.githubusercontent.com/FatihMakes/Mark-LIII/main/"


def main() -> None:
    print("=== RESTORE_FAST (clean Mark-LIII) ===\n")
    BACKUP.mkdir(exist_ok=True)
    for f in (MAIN, UI):
        if f.exists():
            shutil.copy2(f, BACKUP / f.name)
            print(f"  backed up {f.name}")

    for name, dest in (("main.py", MAIN), ("ui.py", UI)):
        print(f"  downloading {name}…")
        urllib.request.urlretrieve(BASE + name, dest)
        print(f"  OK {dest.stat().st_size} bytes")

    m = MAIN.read_text(encoding="utf-8")

    if "_speak_mute_until" not in m:
        m = m.replace(
            "self._is_speaking         = False",
            "self._is_speaking         = False\n"
            "        self._speak_mute_until    = 0.0\n"
            '        self._last_jarvis_line    = ""',
            1,
        )

    old_cb = (
        "            with self._speaking_lock:\n"
        "                jarvis_speaking = self._is_speaking\n"
        "            if not jarvis_speaking and not self.ui.muted and not self._phone_active:"
    )
    new_cb = (
        "            with self._speaking_lock:\n"
        "                jarvis_speaking = self._is_speaking\n"
        "            try:\n"
        "                import time as _tg\n"
        '                _echo_mute = _tg.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0)\n'
        "            except Exception:\n"
        "                _echo_mute = False\n"
        "            if not jarvis_speaking and not _echo_mute and not self.ui.muted and not self._phone_active:"
    )
    if old_cb in m and "_echo_mute" not in m:
        m = m.replace(old_cb, new_cb, 1)
        print("  + mic mute while speaking")

    if "self.set_speaking(False)" in m and "_speak_mute_until = _t.monotonic()" not in m:
        old_fin = """            self.set_speaking(False)
            stream.stop()
            stream.close()"""
        new_fin = """            try:
                import time as _t
                self._speak_mute_until = _t.monotonic() + 1.2
            except Exception:
                pass
            self.set_speaking(False)
            stream.stop()
            stream.close()"""
        if old_fin in m:
            m = m.replace(old_fin, new_fin, 1)
            print("  + 1.2s post-speak mute")

    if 'self.ui.write_log(f"{self._asst_name}: {full_out}")' in m and "_last_jarvis_line = full_out" not in m:
        m = m.replace(
            'self.ui.write_log(f"{self._asst_name}: {full_out}")',
            'self.ui.write_log(f"{self._asst_name}: {full_out}")\n'
            "                                self._last_jarvis_line = full_out",
            1,
        )

    old_fi = (
        '                            full_in = " ".join(in_buf).strip()\n'
        "                            if full_in:\n"
        '                                self.ui.write_log(f"You: {full_in}")\n'
        '                                self._session_log.append(f"User: {full_in}")'
    )
    new_fi = (
        '                            full_in = " ".join(in_buf).strip()\n'
        "                            if full_in:\n"
        "                                _skip = False\n"
        "                                try:\n"
        "                                    import time as _ti\n"
        '                                    if _ti.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0):\n'
        "                                        _skip = True\n"
        "                                    with self._speaking_lock:\n"
        "                                        if self._is_speaking:\n"
        "                                            _skip = True\n"
        "                                except Exception:\n"
        "                                    pass\n"
        "                                if _skip:\n"
        '                                    print("[JARVIS] echo dropped")\n'
        "                                    in_buf = []\n"
        "                                    continue\n"
        '                                self.ui.write_log(f"You: {full_in}")\n'
        '                                self._session_log.append(f"User: {full_in}")'
    )
    if old_fi in m and "echo dropped" not in m:
        m = m.replace(old_fi, new_fi, 1)
        print("  + drop self-hear transcripts")

    MAIN.write_text(m, encoding="utf-8")
    print("  OK main.py restored + light echo")

    ui = UI.read_text(encoding="utf-8")
    import re
    ui2 = re.sub(r'APP_VERSION\s*=\s*"[^"]*"', 'APP_VERSION  = "MARK 43"', ui, count=1)
    if ui2 != ui:
        UI.write_text(ui2, encoding="utf-8")
        print("  OK ui MARK 43")

    print(
        "\n=== DONE ===\n"
        "Backup: _backup_before_restore/\n"
        "Gemini native voice = fast replies\n"
        "  python main.py\n"
        "\n"
        "Headphones reduce echo.\n"
        "Fish later (slower): only if you need custom voice.\n"
    )


if __name__ == "__main__":
    main()
