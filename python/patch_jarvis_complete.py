"""
Complete JARVIS polish for Mark-LIII python/ tree.

  - Center HUD → cyan multi-ring look with J.A.R.V.I.S. text (image style)
  - MARK 43 badge (not LIII)
  - Remove footer credit (By FatihMakes / By Ashish)
  - Customise panel: JARVIS Fish API key + Voice ID fields
  - open_app: Instagram web + prevent double-launch spam
  - Startup identity in prompt

Run from python folder:
    python patch_jarvis_complete.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def _patch_ui() -> None:
    ui = ROOT / "ui.py"
    if not ui.exists():
        print("! ui.py missing")
        return
    m = ui.read_text(encoding="utf-8")
    orig = m

    m = re.sub(r'APP_VERSION\s*=\s*"[^"]*"', 'APP_VERSION  = "MARK 43"', m, count=1)

    m = m.replace('lay.addWidget(_fl("By FatihMakes", C.PRI_DIM))', 'lay.addWidget(_fl("", C.PRI_DIM))')
    m = m.replace('lay.addWidget(_fl("By Ashish", C.PRI_DIM))', 'lay.addWidget(_fl("", C.PRI_DIM))')

    old_text = '''            p.setPen(QPen(qcol(C.PRI, min(255, int(self._halo * 2))), 1))
            p.setFont(QFont("Courier New", 13, QFont.Weight.Bold))
            p.drawText(QRectF(cx - 80, cy - 14, 160, 28),
                       Qt.AlignmentFlag.AlignCenter, self._assistant_name)'''
    new_text = '''            p.setPen(QPen(qcol(C.PRI, min(255, int(self._halo * 2))), 1))
            p.setFont(QFont("Segoe UI", max(11, int(fw * 0.045)), QFont.Weight.Bold))
            _label = "J.A.R.V.I.S."
            p.drawText(QRectF(cx - fw * 0.28, cy - 16, fw * 0.56, 32),
                       Qt.AlignmentFlag.AlignCenter, _label)'''
    if old_text in m:
        m = m.replace(old_text, new_text, 1)
        print("  ✓ center label → J.A.R.V.I.S.")
    else:
        print("  · center label marker not exact (may already be patched)")

    old_arcs = '''        for idx, (r_frac, w_r, arc_l, gap) in enumerate(
            [(0.48, 3, 115, 78), (0.40, 2, 78, 55), (0.32, 1, 56, 40)]
        ):'''
    new_arcs = '''        for idx, (r_frac, w_r, arc_l, gap) in enumerate(
            [(0.52, 3, 90, 30), (0.46, 2, 70, 35), (0.40, 2, 55, 40), (0.34, 1, 40, 50)]
        ):'''
    if old_arcs in m:
        m = m.replace(old_arcs, new_arcs, 1)
        m = m.replace(
            "base   = self._rings[idx]",
            "base   = self._rings[idx % max(1, len(self._rings))]",
            1,
        )
        print("  ✓ denser arc rings")

    if "FISH API KEY" not in m and "self._refresh_voice_btns()" in m:
        inject = '''
        self._refresh_voice_btns()

        # ── JARVIS TTS (Fish Audio) — separate from Gemini Live voices ───────
        lay.addSpacing(6)
        lay.addWidget(_lbl("JARVIS VOICE  (Fish Audio TTS)", 8, color=C.TEXT_DIM,
                            align=Qt.AlignmentFlag.AlignLeft))
        lay.addWidget(_lbl("API key + Voice ID — saved to config/api_keys.json", 7,
                            color=C.TEXT_MED, align=Qt.AlignmentFlag.AlignLeft))
        try:
            import json as _json
            from pathlib import Path as _P
            _cfgp = _P(__file__).resolve().parent / "config" / "api_keys.json"
            _fc = _json.loads(_cfgp.read_text(encoding="utf-8")) if _cfgp.exists() else {}
        except Exception:
            _fc = {}
        self._fish_key_input = QLineEdit(str(_fc.get("fish_api_key") or ""))
        self._fish_key_input.setEchoMode(QLineEdit.EchoMode.Password)
        self._fish_key_input.setPlaceholderText("Fish API key")
        self._fish_key_input.setFont(QFont("Courier New", 9))
        self._fish_key_input.setFixedHeight(30)
        self._fish_key_input.setStyleSheet(_fs)
        lay.addWidget(self._fish_key_input)
        self._fish_vid_input = QLineEdit(
            str(_fc.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338")
        )
        self._fish_vid_input.setPlaceholderText("Fish Voice ID (JARVIS default)")
        self._fish_vid_input.setFont(QFont("Courier New", 9))
        self._fish_vid_input.setFixedHeight(30)
        self._fish_vid_input.setStyleSheet(_fs)
        lay.addWidget(self._fish_vid_input)
'''
        m = m.replace(
            "        lay.addLayout(voice_row)\n        self._refresh_voice_btns()\n",
            "        lay.addLayout(voice_row)" + inject,
            1,
        )
        m = m.replace("_OW, _OH = 400, 588", "_OW, _OH = 400, 720", 1)
        print("  ✓ Customise → JARVIS Fish API + Voice ID fields")

        old_save = '''    def _save(self):
        name = self._name_input.text().strip() or "JARVIS"
        user = self._user_input.text().strip()
        self.saved.emit(name, user, self._sel_color or DEFAULT_UI_COLOR, self._sel_voice)
        self.hide()'''
        new_save = '''    def _save(self):
        name = self._name_input.text().strip() or "JARVIS"
        user = self._user_input.text().strip()
        try:
            import json as _json
            from pathlib import Path as _P
            _cfgp = _P(__file__).resolve().parent / "config" / "api_keys.json"
            _data = {}
            if _cfgp.exists():
                _data = _json.loads(_cfgp.read_text(encoding="utf-8"))
            if hasattr(self, "_fish_key_input"):
                _fk = self._fish_key_input.text().strip()
                if _fk:
                    _data["fish_api_key"] = _fk
                _data["fish_voice_id"] = (
                    self._fish_vid_input.text().strip()
                    or "14129c3e320149449d6bada6862f7338"
                )
                _data["tts_engine"] = "fish"
                _data["assistant_name"] = name
                if user:
                    _data["user_name"] = user
                _cfgp.parent.mkdir(parents=True, exist_ok=True)
                _cfgp.write_text(_json.dumps(_data, indent=2) + "\\n", encoding="utf-8")
        except Exception as _e:
            print(f"[customise] fish key save: {_e}")
        self.saved.emit(name, user, self._sel_color or DEFAULT_UI_COLOR, self._sel_voice)
        self.hide()'''
        if old_save in m:
            m = m.replace(old_save, new_save, 1)
            print("  ✓ Customise save → writes Fish keys")
        else:
            print("  · _save() marker not exact")

    if m != orig:
        ui.write_text(m, encoding="utf-8")
        print("  ✓ ui.py written")
    else:
        print("  · ui.py no text changes applied")


def _patch_open_app() -> None:
    p = ROOT / "actions" / "open_app.py"
    if not p.exists():
        print("! open_app.py missing")
        return
    m = p.read_text(encoding="utf-8")
    if "__WEB__:https://www.instagram.com/" not in m:
        fix = ROOT / "fix_open_app_instagram.py"
        if fix.exists():
            import runpy
            try:
                runpy.run_path(str(fix), run_name="__main__")
            except SystemExit:
                pass
            m = p.read_text(encoding="utf-8")

    if "_LAST_OPEN" not in m:
        m = m.replace(
            "_SYSTEM = platform.system()",
            '_SYSTEM = platform.system()\n_LAST_OPEN = {"name": "", "t": 0.0}',
            1,
        )
        marker = '    print(f"[open_app] Launching: \'{app_name}\' → \'{normalized}\' ({_SYSTEM})")'
        if marker in m:
            deb = marker + '''
    try:
        _now = time.time()
        if _LAST_OPEN["name"] == str(normalized) and (_now - float(_LAST_OPEN["t"])) < 8.0:
            return f"Already opened {app_name}."
        _LAST_OPEN["name"] = str(normalized)
        _LAST_OPEN["t"] = _now
    except Exception:
        pass'''
            m = m.replace(marker, deb, 1)
            print("  ✓ open_app debounce (no double open)")
        p.write_text(m, encoding="utf-8")
    else:
        print("  · open_app debounce already present")


def _patch_prompt() -> None:
    dest = ROOT / "core" / "prompt.txt"
    text = '''🧠 JARVIS CORE PROTOCOL (Ashish build — MARK 43)

IDENTITY: You are J.A.R.V.I.S. Address the user as "sir".
MCU style: calm, precise, lightly witty. No markdown asterisks when speaking.

FIRST MESSAGE / SESSION START:
When the session begins or the user first greets you, say something like:
"Hello, sir. This is JARVIS. All systems are online."
Then briefly offer help (one short follow-up question is fine). Do not repeat the full intro every turn.

LANGUAGE: English + Nepali mixed speech is normal. Reply in the user's language.

OPEN APPS / SITES:
- "insta khol" / instagram / ig → open_app app_name=instagram (website, never download page)
- youtube / yt, chrome, whatsapp similarly via open_app
- Call open_app ONCE per request. Never open the same thing twice unless the user asks again.

VISION: screen_process once per request. Wait for result.
TOOLS: one clear call. No retry loops.
CONFIRMATION: shutdown/restart need HUD confirm.

PC CONTROL: computer_control, screen_process, browser tools for clicks/typing when needed.
Be honest if you cannot see the screen until vision runs.

CRITICAL: Do not treat your own spoken audio as a new user command.
'''
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    print("  ✓ core/prompt.txt")


def _patch_fish() -> None:
    script = ROOT / "patch_fish_main.py"
    if script.exists() and (ROOT / "main.py").exists():
        import runpy
        try:
            runpy.run_path(str(script), run_name="__main__")
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"  ! fish patch exit {e.code}")
        except Exception as e:
            print(f"  ! fish patch: {e}")
    else:
        print("  · fish patch skipped")


def main() -> None:
    print("=== patch_jarvis_complete ===\n")
    print("[1] UI look + branding + Fish fields")
    _patch_ui()
    print("[2] open_app")
    _patch_open_app()
    print("[3] prompt")
    _patch_prompt()
    print("[4] Fish mute")
    _patch_fish()
    print("\nDone. Run:  python main.py")


if __name__ == "__main__":
    main()
