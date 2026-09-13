"""
Repair IndentationError in main.py fish talk-back blocks.

  python FIX_INDENT.py
  python main.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"

SAFE_BLOCK = r'''
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
    text = MAIN.read_text(encoding="utf-8")

    # 1) Strip ALL previous fish speak injects (broken or not)
    patterns = [
        r"\n[ \t]*# === FORCE_FISH_SPEAK(?:_SAFE)? ===.*?(?=\n[ \t]*out_buf\s*=\s*\[\])",
        r"\n[ \t]*# FISH_TALK_BACK.*?(?=\n[ \t]*out_buf\s*=\s*\[\])",
        r"\n[ \t]*if getattr\(self, \"_use_fish_voice\".*?threading\.Thread\(target=_force_fish.*?\n",
        r"\n[ \t]*if getattr\(self, \"_use_fish_voice\".*?threading\.Thread\(target=_fs.*?\n",
    ]
    cleaned = text
    for p in patterns:
        cleaned2 = re.sub(p, "\n", cleaned, flags=re.S)
        if cleaned2 != cleaned:
            print("Removed old block:", p[:40], "…")
            cleaned = cleaned2

    # Also remove orphaned broken try/with fragments near full_out (heuristic)
    # Fix empty try blocks: try:\n    with → ensure body
    cleaned = re.sub(
        r"try:\s*\n(\s*)with self\._speaking_lock:",
        r"try:\n\1    with self._speaking_lock:",
        cleaned,
    )

    # 2) Inject ONE clean block after full_out log lines, before out_buf = []
    if "FORCE_FISH_SPEAK_SAFE" not in cleaned:
        m = re.search(
            r"(full_out\s*=\s*\" \"\.join\(out_buf\)\.strip\(\)\s*\n"
            r"\s*if full_out:\s*\n"
            r".*?write_log\(f\"\{self\._asst_name\}: \{full_out\}\"\).*?\n"
            r".*?)(\s*out_buf\s*=\s*\[\])",
            cleaned,
            flags=re.S,
        )
        if m:
            cleaned = cleaned[: m.end(1)] + SAFE_BLOCK + "\n" + m.group(2) + cleaned[m.end(2) :]
            print("Injected SAFE block before out_buf = []")
        else:
            # fallback: after first write_log full_out
            anchor = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
            idx = cleaned.find(anchor)
            if idx != -1:
                # find out_buf = [] after idx
                j = cleaned.find("out_buf = []", idx)
                if j != -1:
                    cleaned = cleaned[:j] + SAFE_BLOCK + "\n" + cleaned[j:]
                    print("Injected SAFE block (fallback)")
                else:
                    print("WARN: out_buf = [] not found")
            else:
                print("WARN: full_out log not found")
    else:
        print("SAFE block already present")

    MAIN.write_text(cleaned, encoding="utf-8")
    print("Saved", MAIN)

    # syntax check
    try:
        compile(cleaned, str(MAIN), "exec")
        print("Syntax OK")
    except SyntaxError as e:
        print("Still broken:", e)
        print("Line", e.lineno)
        raise SystemExit(1)

    print("\nRun: python main.py")


if __name__ == "__main__":
    main()
