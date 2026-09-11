"""
Fish-only voice + hard echo fix for Mark-LIII main.py / ui.py.

- Only Fish Audio speaks (Gemini/Charon audio output discarded)
- Mic ignored while speaking + 3.5s after TTS ends
- Drop transcripts that match last JARVIS line (self-hear)
- Customise: hide Charon/Puck/etc pills — Fish fields only
- api_keys: tts_engine=fish

Run from python folder:
    python FIX_VOICE_ECHO.py
    python main.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def force_fish_config() -> None:
    cfg = ROOT / "config" / "api_keys.json"
    if not cfg.exists():
        print("! config/api_keys.json missing — create it with fish_api_key")
        return
    try:
        data = json.loads(cfg.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"! api_keys read: {e}")
        return
    data["tts_engine"] = "fish"
    if not data.get("fish_voice_id"):
        data["fish_voice_id"] = "14129c3e320149449d6bada6862f7338"
    data["assistant_name"] = data.get("assistant_name") or "JARVIS"
    cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    has_key = bool((data.get("fish_api_key") or "").strip())
    print(f"  ✓ tts_engine=fish, voice_id set, api_key={'yes' if has_key else 'EMPTY — add key'}")


def patch_main_echo() -> None:
    p = ROOT / "main.py"
    if not p.exists():
        print("! main.py missing")
        return
    m = p.read_text(encoding="utf-8")
    orig = m

    if "_speak_mute_until" not in m:
        if "self._is_speaking         = False" in m:
            m = m.replace(
                "self._is_speaking         = False",
                """self._is_speaking         = False
        self._fish_player         = None
        self._use_fish_voice      = False
        self._speak_mute_until    = 0.0
        self._last_jarvis_line    = \"\"
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding=\"utf-8\").read())
            _fkey = (_fcfg.get(\"fish_api_key\") or \"\").strip()
            if _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get(\"fish_voice_id\") or \"14129c3e320149449d6bada6862f7338\").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print(\"[JARVIS] Fish-only voice ON (id=%s)\" % _vid[:8])
        except Exception as _fe:
            print(f\"[JARVIS] Fish voice not loaded: {_fe}\")""",
                1,
            )
            print("  ✓ Fish init injected")
        else:
            print("  ! speaking init marker missing")
    else:
        if "self._last_jarvis_line" not in m:
            m = m.replace(
                "self._speak_mute_until    = 0.0",
                'self._speak_mute_until    = 0.0\n        self._last_jarvis_line    = ""',
                1,
            )
        m = re.sub(
            r"_speak_mute_until\s*=\s*_t\.monotonic\(\)\s*\+\s*[\d.]+",
            "_speak_mute_until = _t.monotonic() + 3.5",
            m,
        )
        print("  · mute window → 3.5s after TTS")

    if "Fish Audio speaks text instead of Gemini voice" not in m and "Fish only — ignore Gemini PCM" not in m:
        old_audio = """                    if response.data:
                        if self._interrupted:
                            pass  # discard: interrupted
                        else:"""
        new_audio = """                    if response.data:
                        if getattr(self, "_use_fish_voice", False):
                            pass  # Fish only — ignore Gemini PCM
                        elif self._interrupted:
                            pass  # discard: interrupted
                        else:"""
        if old_audio in m:
            m = m.replace(old_audio, new_audio, 1)
            print("  ✓ Gemini audio discarded when Fish ON")
        else:
            print("  · audio branch marker not found (may already differ)")

    marker = 'self.ui.write_log(f"{self._asst_name}: {full_out}")'
    if marker in m and "_fish_speak" not in m:
        inject_after = '''self.ui.write_log(f"{self._asst_name}: {full_out}")
                                self._last_jarvis_line = full_out
                                if getattr(self, "_use_fish_voice", False) and getattr(self, "_fish_player", None):
                                    _fo = full_out
                                    def _fish_speak(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            self._fish_player.speak(t)
                                        except Exception as _e:
                                            print(f"[JARVIS] Fish speak error: {_e}")
                                        finally:
                                            try:
                                                import time as _t
                                                self._speak_mute_until = _t.monotonic() + 3.5
                                            except Exception:
                                                pass
                                            self.set_speaking(False)
                                    threading.Thread(target=_fish_speak, daemon=True).start()'''
        m = m.replace(marker, inject_after, 1)
        print("  ✓ Fish speak + last_line + 3.5s mute")
    else:
        if "self._last_jarvis_line = full_out" not in m and "_fish_speak" in m:
            m = m.replace(
                'if getattr(self, "_use_fish_voice", False) and getattr(self, "_fish_player", None):',
                'self._last_jarvis_line = full_out\n                                if getattr(self, "_use_fish_voice", False) and getattr(self, "_fish_player", None):',
                1,
            )
        print("  · Fish speak path present")

    old_gate = """            with self._speaking_lock:
                jarvis_speaking = self._is_speaking
            if not jarvis_speaking and not self.ui.muted and not self._phone_active:"""
    new_gate = """            with self._speaking_lock:
                jarvis_speaking = self._is_speaking
            try:
                import time as _tgate
                _muted_echo = _tgate.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0)
            except Exception:
                _muted_echo = False
            if not jarvis_speaking and not _muted_echo and not self.ui.muted and not self._phone_active:"""
    if old_gate in m:
        m = m.replace(old_gate, new_gate, 1)
        print("  ✓ mic gate: speaking + post-TTS mute")
    elif "_muted_echo" in m:
        print("  · mic gate already has mute")
    else:
        print("  ! mic gate marker not found")

    if "def _is_echo_of_self" not in m and "def set_speaking(" in m:
        helper = '''
    def _is_echo_of_self(self, text: str) -> bool:
        """True if mic likely heard JARVIS's own last line."""
        try:
            t = " ".join((text or "").lower().split())
            last = " ".join((getattr(self, "_last_jarvis_line", "") or "").lower().split())
            if not t or not last:
                return False
            if t in last or last in t:
                return True
            tw, lw = t.split()[:8], last.split()[:8]
            if len(tw) >= 4 and sum(1 for w in tw if w in lw) >= max(3, len(tw) // 2):
                return True
        except Exception:
            pass
        return False
'''
        idx = m.find("def set_speaking(")
        m = m[:idx] + helper + "\n    " + m[idx:]
        print("  ✓ _is_echo_of_self helper")

    if m != orig:
        p.write_text(m, encoding="utf-8")
        print("  ✓ main.py saved")
    else:
        print("  · main.py unchanged")


def patch_ui_fish_only() -> None:
    ui = ROOT / "ui.py"
    if not ui.exists():
        print("! ui.py missing")
        return
    m = ui.read_text(encoding="utf-8")
    orig = m

    if "ASSISTANT VOICE" in m and "FISH-ONLY" not in m:
        old = """        lay.addWidget(_lbl("ASSISTANT VOICE", 8, color=C.TEXT_DIM,
                            align=Qt.AlignmentFlag.AlignLeft))
        self._sel_voice   = (voice or DEFAULT_VOICE)
        if self._sel_voice not in AVAILABLE_VOICES:
            self._sel_voice = DEFAULT_VOICE
        self._voice_btns: dict[str, QPushButton] = {}
        voice_row = QHBoxLayout(); voice_row.setSpacing(4)
        for _v in AVAILABLE_VOICES:
            b = QPushButton(_v)
            b.setCheckable(True)
            b.setFixedHeight(28)
            b.setFont(QFont("Courier New", 8, QFont.Weight.Bold))
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            b.clicked.connect(lambda _=False, name=_v: self._on_voice_pick(name))
            self._voice_btns[_v] = b
            voice_row.addWidget(b)
        lay.addLayout(voice_row)
        self._refresh_voice_btns()"""
        new = """        # FISH-ONLY: Charon/Puck/Kore etc removed — speaking is Fish Audio only
        lay.addWidget(_lbl("SPEAKING VOICE = FISH AUDIO ONLY", 8, color=C.TEXT_DIM,
                            align=Qt.AlignmentFlag.AlignLeft))
        lay.addWidget(_lbl("Charon / Gemini voices disabled (stops double-speak + echo)", 7,
                            color=C.TEXT_MED, align=Qt.AlignmentFlag.AlignLeft))
        self._sel_voice = "Charon"
        self._voice_btns = {}
        self._refresh_voice_btns = lambda: None"""
        if old in m:
            m = m.replace(old, new, 1)
            print("  ✓ removed Charon/Puck voice pills")
        else:
            print("  · voice pills block not exact — skip UI strip")

    if m != orig:
        ui.write_text(m, encoding="utf-8")
        print("  ✓ ui.py saved")
    else:
        print("  · ui.py unchanged")


def patch_prompt() -> None:
    dest = ROOT / "core" / "prompt.txt"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        """You are J.A.R.V.I.S. Address the user as sir.
MCU style: calm, precise. No markdown when speaking.

CRITICAL — ECHO / SELF-HEAR:
Your voice is played on speakers. NEVER treat your own words as a new user command.
If you just spoke, wait. Do not open apps twice. One tool call per request.

Voice: Fish Audio only (not Charon). One reply per user turn.

Apps: insta/instagram → open once via open_app instagram (website).
""",
        encoding="utf-8",
    )
    print("  ✓ prompt echo rules")


def main() -> None:
    print("=== FIX_VOICE_ECHO (Fish only + no self-reply loop) ===\n")
    print("[1] config")
    force_fish_config()
    print("[2] main.py")
    patch_main_echo()
    print("[3] ui.py")
    patch_ui_fish_only()
    print("[4] prompt")
    patch_prompt()
    print(
        "\n=== DONE ===\n"
        "1. Headphones recommended (stops speaker→mic echo)\n"
        "2. Only ONE python main.py window\n"
        "3. Run:  python main.py\n"
    )


if __name__ == "__main__":
    main()
