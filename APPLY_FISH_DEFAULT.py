"""
Make Fish Audio the DEFAULT voice (JARVIS first).
Onboarding saves Gemini + Fish API key + Voice ID.

Run inside Mark-LIII / JARVIS-MARK43 folder:
  python APPLY_FISH_DEFAULT.py
  python main.py

Default Fish voice id: 05b36da8574341d0803391491850db20
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui.py"
MAIN = ROOT / "main.py"
CFG_MGR = ROOT / "memory" / "config_manager.py"
CFG = ROOT / "config" / "api_keys.json"
VOICE_ID = "05b36da8574341d0803391491850db20"


def patch_config_manager() -> None:
    if not CFG_MGR.exists():
        print("! config_manager missing")
        return
    m = CFG_MGR.read_text(encoding="utf-8")
    m2 = re.sub(
        r"AVAILABLE_VOICES\s*=\s*\[[^\]]*\]",
        'AVAILABLE_VOICES = ["JARVIS", "Charon", "Puck", "Kore", "Fenrir", "Aoede"]',
        m,
        count=1,
    )
    m2 = re.sub(
        r'DEFAULT_VOICE\s*=\s*"[^"]*"',
        'DEFAULT_VOICE    = "JARVIS"',
        m2,
        count=1,
    )
    if m2 != m:
        CFG_MGR.write_text(m2, encoding="utf-8")
        print("  OK JARVIS first + DEFAULT_VOICE=JARVIS")
    else:
        print("  · voices already patched or pattern differ")


def patch_onboarding() -> None:
    if not UI.exists():
        print("! ui.py missing")
        return
    m = UI.read_text(encoding="utf-8")

    if "FISH API KEY (JARVIS voice)" in m:
        print("  · onboarding already has Fish fields")
    else:
        # Inject Fish fields after Gemini key input block — after placeholder AIza
        needle = 'self._key_input.setPlaceholderText("AIza…")'
        if needle not in m:
            needle = 'self._key_input.setPlaceholderText("AIza'  # partial
        if "self._key_input.setPlaceholderText" in m and "_fish_key_input" not in m:
            # After gemini key widget stylesheet ends is hard; inject before OS section
            # Find "OPERATING SYSTEM" or similar
            for marker in (
                'layout.addWidget(_lbl("OPERATING SYSTEM"',
                'layout.addWidget(_lbl("OS"',
                '"WINDOWS"',
            ):
                if marker in m:
                    inject = '''
        layout.addSpacing(6)
        layout.addWidget(_lbl("FISH API KEY (JARVIS voice)", 8, color=C.TEXT_DIM,
                               align=Qt.AlignmentFlag.AlignLeft))
        self._fish_key_input = QLineEdit()
        self._fish_key_input.setEchoMode(QLineEdit.EchoMode.Password)
        self._fish_key_input.setPlaceholderText("Fish Audio API key")
        self._fish_key_input.setFont(QFont("Courier New", 10))
        self._fish_key_input.setFixedHeight(32)
        self._fish_key_input.setStyleSheet(self._key_input.styleSheet())
        layout.addWidget(self._fish_key_input)
        layout.addWidget(_lbl("FISH VOICE ID", 8, color=C.TEXT_DIM,
                               align=Qt.AlignmentFlag.AlignLeft))
        self._fish_vid_input = QLineEdit("05b36da8574341d0803391491850db20")
        self._fish_vid_input.setFont(QFont("Courier New", 9))
        self._fish_vid_input.setFixedHeight(28)
        self._fish_vid_input.setStyleSheet(self._key_input.styleSheet())
        layout.addWidget(self._fish_vid_input)
'''
                    m = m.replace(marker, inject + "\n        " + marker, 1)
                    print("  OK onboarding Fish key + voice id fields")
                    break
            else:
                print("  ! could not find OS marker for onboarding inject")

        # Expand done signal / submit to pass fish keys — change signal is complex.
        # Instead patch _submit to stash on overlay and _on_setup_done to read attrs.
        if "def _submit(self):" in m and "_fish_key_input" in m:
            old_sub = '''    def _submit(self):
        key = self._key_input.text().strip()
        if not key:
            self._key_input.setStyleSheet(
                self._key_input.styleSheet() +
                f" QLineEdit {{ border: 1px solid {C.RED}; }}"
            )
            return
        self.done.emit(key, self._sel_os)'''
            new_sub = '''    def _submit(self):
        key = self._key_input.text().strip()
        if not key:
            self._key_input.setStyleSheet(
                self._key_input.styleSheet() +
                f" QLineEdit {{ border: 1px solid {C.RED}; }}"
            )
            return
        try:
            self._saved_fish_key = self._fish_key_input.text().strip()
            self._saved_fish_vid = (self._fish_vid_input.text().strip()
                                    or "05b36da8574341d0803391491850db20")
        except Exception:
            self._saved_fish_key = ""
            self._saved_fish_vid = "05b36da8574341d0803391491850db20"
        self.done.emit(key, self._sel_os)'''
            if old_sub in m:
                m = m.replace(old_sub, new_sub, 1)
                print("  OK _submit saves Fish fields")
            else:
                print("  · _submit pattern differ — Fish still in config via APPLY")

        old_done = '''    def _on_setup_done(self, key: str, os_name: str):
        os.makedirs(CONFIG_DIR, exist_ok=True)
        API_FILE.write_text(
            json.dumps({"gemini_api_key": key, "os_system": os_name}, indent=4),
            encoding="utf-8",
        )'''
        new_done = '''    def _on_setup_done(self, key: str, os_name: str):
        os.makedirs(CONFIG_DIR, exist_ok=True)
        _payload = {
            "gemini_api_key": key,
            "os_system": os_name,
            "voice_name": "JARVIS",
            "tts_engine": "fish",
            "fish_voice_id": "05b36da8574341d0803391491850db20",
        }
        try:
            ov = getattr(self, "_overlay", None)
            if ov is not None:
                fk = getattr(ov, "_saved_fish_key", "") or ""
                fv = getattr(ov, "_saved_fish_vid", "") or "05b36da8574341d0803391491850db20"
                if fk:
                    _payload["fish_api_key"] = fk
                _payload["fish_voice_id"] = fv
        except Exception:
            pass
        API_FILE.write_text(
            json.dumps(_payload, indent=4),
            encoding="utf-8",
        )'''
        if old_done in m:
            m = m.replace(old_done, new_done, 1)
            print("  OK setup saves Fish as default")
        else:
            print("  · _on_setup_done pattern differ")

    # taller overlay
    m = m.replace("_OW, _OH = 460, 390", "_OW, _OH = 460, 520", 1)
    m = m.replace("ow, oh = 460, 390", "ow, oh = 460, 520", 1)

    UI.write_text(m, encoding="utf-8")
    print("  OK ui.py")


def patch_main_fish() -> None:
    if not MAIN.exists():
        print("! main.py missing")
        return
    m = MAIN.read_text(encoding="utf-8")
    # Always prefer fish when key present (even if voice_name wrong)
    if "FishAudioTTSEngine" not in m:
        if "self._is_speaking         = False" in m:
            m = m.replace(
                "self._is_speaking         = False",
                f'''self._is_speaking         = False
        self._speak_mute_until    = 0.0
        self._fish_player         = None
        self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get("fish_voice_id") or "{VOICE_ID}").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] Fish TTS DEFAULT active id=%s" % _vid[:8])
        except Exception as _fe:
            print("[JARVIS] Fish:", _fe)''',
                1,
            )
            print("  OK main Fish default when key present")

        old_a = (
            "                    if response.data:\n"
            "                        if self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        new_a = (
            "                    if response.data:\n"
            '                        if getattr(self, "_use_fish_voice", False):\n'
            "                            pass  # Fish default\n"
            "                        elif self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        if old_a in m:
            m = m.replace(old_a, new_a, 1)

        if "_fish_player.speak" not in m:
            m = m.replace(
                'self.ui.write_log(f"{self._asst_name}: {full_out}")',
                '''self.ui.write_log(f"{self._asst_name}: {full_out}")
                                if getattr(self, "_use_fish_voice", False) and self._fish_player:
                                    _fo = full_out
                                    def _fs(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            self._fish_player.speak(t)
                                        except Exception as e:
                                            print("[JARVIS] Fish speak:", e)
                                        finally:
                                            import time as _t
                                            self._speak_mute_until = _t.monotonic() + 2.0
                                            self.set_speaking(False)
                                    threading.Thread(target=_fs, daemon=True).start()''',
                1,
            )
            print("  OK Fish speak path")
    else:
        # ensure voice id default string updated
        m = m.replace("14129c3e320149449d6bada6862f7338", VOICE_ID)
        # Prefer fish whenever key exists (not only voice_name==JARVIS)
        m = m.replace(
            'if _vn == "JARVIS" and _fkey:',
            "if _fkey:  # Fish is default whenever key is set",
        )
        print("  OK Fish always if key set")

    MAIN.write_text(m, encoding="utf-8")


def write_config_defaults() -> None:
    CFG.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if CFG.exists():
        try:
            data = json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    data["voice_name"] = "JARVIS"
    data["tts_engine"] = "fish"
    data["fish_voice_id"] = VOICE_ID
    CFG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    has = bool((data.get("fish_api_key") or "").strip())
    print(f"  config: JARVIS default, voice_id={VOICE_ID[:8]}…, fish_key={'YES' if has else 'NO — set in onboarding or api_keys.json'}")


def main() -> None:
    print("=== APPLY_FISH_DEFAULT ===\n")
    print("[1] voices")
    patch_config_manager()
    print("[2] onboarding")
    patch_onboarding()
    print("[3] main")
    patch_main_fish()
    print("[4] config")
    write_config_defaults()
    print(
        "\nDONE.\n"
        "  python main.py\n"
        "First run: enter Gemini + Fish API key (voice id prefilled).\n"
        "Fish is DEFAULT. Other voices: Charon/Puck/… in Customize.\n"
    )


if __name__ == "__main__":
    main()
