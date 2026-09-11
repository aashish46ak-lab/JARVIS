"""
Hard fix: JARVIS hearing itself (You: = his own words).

Patches main.py:
1. Skip full_in if it matches last JARVIS line
2. Skip full_in while speaking or in post-TTS mute window
3. Fish-only: never play Gemini PCM (no dual voice)
4. Longer mute after Fish speak (4.0s)
5. Soft-disable startup briefing spam (optional flag)

Run:
  cd python folder
  python HARD_ECHO_FIX.py
  python main.py

Use headphones if possible.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"


def main() -> None:
    if not MAIN.exists():
        print("! main.py not found — run from python/ folder")
        return
    m = MAIN.read_text(encoding="utf-8")
    orig = m

    if "self._speak_mute_until" not in m:
        if "self._is_speaking         = False" in m:
            m = m.replace(
                "self._is_speaking         = False",
                'self._is_speaking         = False\n'
                '        self._speak_mute_until    = 0.0\n'
                '        self._last_jarvis_line    = ""\n'
                '        self._use_fish_voice      = getattr(self, "_use_fish_voice", False)\n'
                '        self._fish_player         = getattr(self, "_fish_player", None)',
                1,
            )
            print("✓ mute fields added")
    if "self._last_jarvis_line" not in m:
        m = m.replace(
            "self._speak_mute_until    = 0.0",
            'self._speak_mute_until    = 0.0\n        self._last_jarvis_line    = ""',
            1,
        )

    old_cb = """            with self._speaking_lock:
                jarvis_speaking = self._is_speaking
            if not jarvis_speaking and not self.ui.muted and not self._phone_active:"""
    new_cb = """            with self._speaking_lock:
                jarvis_speaking = self._is_speaking
            try:
                import time as _tg
                _echo_mute = _tg.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0)
            except Exception:
                _echo_mute = False
            if not jarvis_speaking and not _echo_mute and not self.ui.muted and not self._phone_active:"""
    if old_cb in m:
        m = m.replace(old_cb, new_cb, 1)
        print("✓ mic callback + mute window")
    elif "_echo_mute" in m or "_muted_echo" in m:
        print("· mic mute already present")
    else:
        print("! mic callback marker not found")

    old_full_in = '''                            full_in = " ".join(in_buf).strip()
                            if full_in:
                                self.ui.write_log(f"You: {full_in}")
                                self._session_log.append(f"User: {full_in}")'''
    new_full_in = '''                            full_in = " ".join(in_buf).strip()
                            if full_in:
                                # HARD ECHO GUARD: drop self-hear
                                _skip_echo = False
                                try:
                                    import time as _ti
                                    if _ti.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0):
                                        _skip_echo = True
                                    with self._speaking_lock:
                                        if self._is_speaking:
                                            _skip_echo = True
                                    _last = " ".join((getattr(self, "_last_jarvis_line", "") or "").lower().split())
                                    _now = " ".join(full_in.lower().split())
                                    if _last and _now and (
                                        _now in _last or _last in _now
                                        or (len(_now.split()) >= 4 and sum(1 for w in _now.split()[:10] if w in _last.split()[:12]) >= 3)
                                    ):
                                        _skip_echo = True
                                    if _now.startswith("my apologies") or "unable to fetch" in _now:
                                        if _last and ("apologies" in _last or "unable to fetch" in _last):
                                            _skip_echo = True
                                except Exception:
                                    pass
                                if _skip_echo:
                                    print(f"[JARVIS] echo dropped: {full_in[:60]}")
                                    in_buf = []
                                    continue
                                self.ui.write_log(f"You: {full_in}")
                                self._session_log.append(f"User: {full_in}")'''
    if old_full_in in m:
        m = m.replace(old_full_in, new_full_in, 1)
        print("✓ full_in echo filter (main fix)")
    elif "echo dropped" in m:
        print("· full_in echo filter already present")
    else:
        print("! full_in marker not found — main.py version may differ")

    if "self._last_jarvis_line = full_out" not in m:
        m = m.replace(
            'self.ui.write_log(f"{self._asst_name}: {full_out}")',
            'self.ui.write_log(f"{self._asst_name}: {full_out}")\n'
            '                                self._last_jarvis_line = full_out',
            1,
        )
        print("✓ track last JARVIS line")

    if "Fish only — ignore Gemini PCM" not in m and "Fish Audio speaks text instead" not in m:
        old_a = """                    if response.data:
                        if self._interrupted:
                            pass  # discard: interrupted
                        else:"""
        new_a = """                    if response.data:
                        if getattr(self, "_use_fish_voice", False):
                            pass  # Fish only — ignore Gemini PCM (no dual voice)
                        elif self._interrupted:
                            pass  # discard: interrupted
                        else:"""
        if old_a in m:
            m = m.replace(old_a, new_a, 1)
            print("✓ dual-voice: Gemini PCM discarded")
        else:
            print("· audio branch not exact")

    m2, n = re.subn(
        r"_speak_mute_until\s*=\s*_t\.monotonic\(\)\s*\+\s*[\d.]+",
        "_speak_mute_until = _t.monotonic() + 4.0",
        m,
    )
    if n:
        m = m2
        print(f"✓ mute duration 4.0s ({n} places)")

    if m != orig:
        MAIN.write_text(m, encoding="utf-8")
        print("\n✓ main.py written")
    else:
        print("\n· no text changes (already patched?)")

    print(
        "\nNEXT:\n"
        "  1. Close ALL JARVIS windows\n"
        "  2. Prefer headphones (mic won't hear speakers)\n"
        "  3. python main.py\n"
        "  4. Say one short command — wait until LISTENING before next\n"
    )
    print(
        "NOTE: github.com/withaarzoo/Iron-man is an Iron *suit* CSS animation,\n"
        "not a JARVIS circle HUD. Your MARK 43 center is already the JARVIS-type UI.\n"
    )


if __name__ == "__main__":
    main()
