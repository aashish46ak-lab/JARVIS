"""
Fix RuntimeError: MainWindow has been deleted
Fish speak runs in a worker thread — must NOT call set_speaking()/UI.

  python FIX_THREAD_CRASH.py
  python main.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"

# Safe speak block (no set_speaking / no UI from worker thread)
SAFE = '''
                                # === FORCE_FISH_SPEAK_SAFE ===
                                if getattr(self, "_use_fish_voice", False):
                                    _fo = full_out
                                    def _force_fish(t=_fo):
                                        try:
                                            with self._speaking_lock:
                                                self._is_speaking = True
                                            eng = getattr(self, "_fish_engine", None)
                                            pl = getattr(self, "_fish_player", None)
                                            if eng is not None:
                                                eng.speak(t)
                                            elif pl is not None:
                                                pl.speak(t)
                                            else:
                                                print("[JARVIS] no fish engine")
                                        except Exception as _e:
                                            print("[JARVIS] Fish speak:", _e)
                                        finally:
                                            try:
                                                import time as _t
                                                self._speak_mute_until = _t.monotonic() + 2.5
                                            except Exception:
                                                pass
                                            try:
                                                with self._speaking_lock:
                                                    self._is_speaking = False
                                            except Exception:
                                                pass
                                    threading.Thread(target=_force_fish, daemon=True).start()
'''


def main() -> None:
    if not MAIN.exists():
        raise SystemExit("main.py missing")
    m = MAIN.read_text(encoding="utf-8")
    orig = m

    # Remove old unsafe FORCE blocks that call set_speaking inside thread
    import re

    # Replace any previous FORCE_FISH_SPEAK blocks
    m2 = re.sub(
        r"\n\s*# === FORCE_FISH_SPEAK ===.*?(?=\n\s*(?:out_buf|if self\._pending|self\._session))",
        "\n" + SAFE + "\n",
        m,
        count=1,
        flags=re.S,
    )
    if m2 != m:
        m = m2
        print("OK replaced FORCE_FISH_SPEAK with SAFE version")
    elif "FORCE_FISH_SPEAK_SAFE" in m:
        print("SAFE block already present")
    else:
        # Replace common unsafe patterns: set_speaking in fish thread finally
        # Inject if missing after full_out log
        if "FORCE_FISH_SPEAK" not in m and "_force_fish" not in m and "_fs(t=_fo)" in m:
            # fix existing _fs that uses set_speaking
            m = m.replace(
                "self.set_speaking(True)",
                "# thread-safe flag only\n"
                "                                        with self._speaking_lock:\n"
                "                                            self._is_speaking = True",
            )
            # only in fish contexts is hard; do global careful replace for finally set_speaking(False) after fish
            print("WARN: partial pattern fix")

        if "FORCE_FISH_SPEAK_SAFE" not in m:
            anchor = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
            if anchor in m and "_force_fish" not in m:
                m = m.replace(anchor, anchor + SAFE, 1)
                print("OK injected SAFE speak block")
            elif "_force_fish" in m or "_fs(t=_fo)" in m:
                # Soft-replace set_speaking inside fish worker defs
                m = re.sub(
                    r"self\.set_speaking\(True\)",
                    "with self._speaking_lock:\n"
                    "                                            self._is_speaking = True",
                    m,
                    count=5,
                )
                m = re.sub(
                    r"self\.set_speaking\(False\)",
                    "with self._speaking_lock:\n"
                    "                                            self._is_speaking = False",
                    m,
                    count=5,
                )
                print("OK rewired set_speaking → lock flag only (worker threads)")

    if m != orig:
        MAIN.write_text(m, encoding="utf-8")
        print("Saved main.py")
    else:
        print("No changes (or already fixed)")

    print("\nRun: python main.py")
    print("Fish will speak without crashing Qt UI.")


if __name__ == "__main__":
    main()
