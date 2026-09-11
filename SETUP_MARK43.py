"""
MARK 43 setup on top of Mark-LIII (run inside the Mark-LIII folder).

  1) git clone https://github.com/FatihMakes/Mark-LIII.git JARVIS-MARK43
  2) cd JARVIS-MARK43 && pip install -r requirements.txt && pip install PyQt6-WebEngine
  3) python SETUP_MARK43.py
  4) python main.py

Adds:
  - Voice list: Charon, Puck, Kore, Fenrir, Aoede, JARVIS
  - JARVIS click → Fish API key + Voice ID save (config/api_keys.json)
  - Fish TTS when voice is JARVIS
  - Cyan SVG HUD center
  - Light echo mute
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
UI = ROOT / "ui.py"
CFG_MGR = ROOT / "memory" / "config_manager.py"
HUD_DIR = ROOT / "hud_jarvis"
HUD_HTML = HUD_DIR / "index.html"
BASE_HUD = "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/hud_jarvis/index.html"


def die(msg: str) -> None:
    raise SystemExit(msg)


def ensure_mark() -> None:
    if not MAIN.exists() or not UI.exists():
        die("Run this inside a Mark-LIII clone (main.py / ui.py missing).")


def install_hud_html() -> Path:
    HUD_DIR.mkdir(parents=True, exist_ok=True)
    if not HUD_HTML.exists() or HUD_HTML.stat().st_size < 500:
        print("  downloading cyan HUD…")
        try:
            urllib.request.urlretrieve(BASE_HUD, HUD_HTML)
        except Exception as e:
            die(f"HUD download failed: {e}")
    print("  OK HUD", HUD_HTML)
    return HUD_HTML


def patch_voices() -> None:
    if not CFG_MGR.exists():
        die("memory/config_manager.py missing")
    m = CFG_MGR.read_text(encoding="utf-8")
    # Expand AVAILABLE_VOICES with JARVIS
    m2 = re.sub(
        r'AVAILABLE_VOICES\s*=\s*\[[^\]]*\]',
        'AVAILABLE_VOICES = ["Charon", "Puck", "Kore", "Fenrir", "Aoede", "JARVIS"]',
        m,
        count=1,
    )
    # get_voice must accept JARVIS
    if 'return v if v in AVAILABLE_VOICES else DEFAULT_VOICE' in m2:
        pass  # already works with expanded list
    if m2 != m:
        CFG_MGR.write_text(m2, encoding="utf-8")
        print("  OK voices + JARVIS in config_manager")
    else:
        print("  · config_manager voices already set or pattern differ")


def patch_ui_fish_dialog() -> None:
    m = UI.read_text(encoding="utf-8")
    if "JARVIS_FISH_DIALOG" in m:
        print("  · ui fish dialog already present")
    else:
        # After _on_voice_pick, open fish panel when JARVIS selected
        old = """    def _on_voice_pick(self, name: str):
        self._sel_voice = name
        self._refresh_voice_btns()"""
        # Try common variants
        if old not in m:
            # looser search
            if "def _on_voice_pick" in m:
                # inject at start of method body via regex
                m = re.sub(
                    r"(def _on_voice_pick\(self, name: str\):\n)",
                    r"\1        # JARVIS_FISH_DIALOG\n"
                    r"        if name == \"JARVIS\":\n"
                    r"            try:\n"
                    r"                self._open_fish_dialog()\n"
                    r"            except Exception as _e:\n"
                    r"                print(\"[customise] fish dialog:\", _e)\n",
                    m,
                    count=1,
                )
                print("  OK _on_voice_pick → JARVIS opens Fish dialog")
            else:
                print("  ! _on_voice_pick not found")
        else:
            m = m.replace(
                old,
                old.replace(
                    "        self._sel_voice = name\n        self._refresh_voice_btns()",
                    "        self._sel_voice = name\n"
                    "        if name == \"JARVIS\":\n"
                    "            try:\n"
                    "                self._open_fish_dialog()\n"
                    "            except Exception as _e:\n"
                    "                print(\"[customise] fish dialog:\", _e)\n"
                    "        self._refresh_voice_btns()",
                ),
                1,
            )
            print("  OK voice pick JARVIS dialog")

        # Add methods before class end — attach after _on_voice_pick method roughly
        if "def _open_fish_dialog" not in m:
            helper = '''
    def _open_fish_dialog(self):
        """JARVIS voice: Fish API key + Voice ID."""
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox
        try:
            from PyQt6.QtWidgets import QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox
        except ImportError:
            from PyQt5.QtWidgets import QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox
        dlg = QDialog(self)
        dlg.setWindowTitle("JARVIS — Fish Audio")
        lay = QVBoxLayout(dlg)
        lay.addWidget(QLabel("Fish API key"))
        key = QLineEdit()
        key.setEchoMode(QLineEdit.EchoMode.Password if hasattr(QLineEdit, "EchoMode") else QLineEdit.Password)
        lay.addWidget(key)
        lay.addWidget(QLabel("Fish Voice ID"))
        vid = QLineEdit("14129c3e320149449d6bada6862f7338")
        lay.addWidget(vid)
        try:
            import json as _j
            from pathlib import Path as _P
            _p = _P(__file__).resolve().parent / "config" / "api_keys.json"
            if _p.exists():
                _d = _j.loads(_p.read_text(encoding="utf-8"))
                if _d.get("fish_api_key"):
                    key.setText(str(_d["fish_api_key"]))
                if _d.get("fish_voice_id"):
                    vid.setText(str(_d["fish_voice_id"]))
        except Exception:
            pass
        btn = QPushButton("Save")
        def _save():
            try:
                import json as _j
                from pathlib import Path as _P
                _p = _P(__file__).resolve().parent / "config" / "api_keys.json"
                _d = {}
                if _p.exists():
                    _d = _j.loads(_p.read_text(encoding="utf-8"))
                _d["fish_api_key"] = key.text().strip()
                _d["fish_voice_id"] = vid.text().strip() or "14129c3e320149449d6bada6862f7338"
                _d["voice_name"] = "JARVIS"
                _d["tts_engine"] = "fish"
                _p.parent.mkdir(parents=True, exist_ok=True)
                _p.write_text(_j.dumps(_d, indent=2) + "\\n", encoding="utf-8")
                QMessageBox.information(dlg, "Saved", "Fish voice saved. Restart session to apply.")
                dlg.accept()
            except Exception as e:
                QMessageBox.warning(dlg, "Error", str(e))
        btn.clicked.connect(_save)
        lay.addWidget(btn)
        dlg.exec() if hasattr(dlg, "exec") else dlg.exec_()
'''
            # Insert helper before last occurrence of class-level def near CustomiseOverlay
            if "def _on_voice_pick" in m:
                # find end of _on_voice_pick by next def at same indent
                idx = m.find("def _on_voice_pick")
                # insert helper after the method — find next "\n    def " after idx+20
                nxt = m.find("\n    def ", idx + 20)
                if nxt == -1:
                    nxt = m.find("\n\nclass ", idx)
                if nxt != -1:
                    m = m[:nxt] + "\n" + helper + m[nxt:]
                    print("  OK _open_fish_dialog method")
                else:
                    print("  ! could not inject fish dialog method")

    # HUD replace
    if "JARVIS_SVG_HUD" not in m:
        marker = "self.hud = HudCanvas(face_path, _display)"
        if marker in m:
            path = str(HUD_HTML.resolve()).replace("\\", "\\\\")
            inject = (
                marker
                + "\n"
                + "        # JARVIS_SVG_HUD\n"
                + "        try:\n"
                + "            try:\n"
                + "                from PyQt6.QtWebEngineWidgets import QWebEngineView\n"
                + "                from PyQt6.QtCore import QUrl\n"
                + "            except ImportError:\n"
                + "                from PyQt5.QtWebEngineWidgets import QWebEngineView\n"
                + "                from PyQt5.QtCore import QUrl\n"
                + "            _jv = QWebEngineView()\n"
                + f'            _jv.setUrl(QUrl.fromLocalFile(r"{path}"))\n'
                + "            _jv.setMinimumSize(320, 320)\n"
                + "            self.hud = _jv\n"
                + '            print("[JARVIS] cyan SVG HUD loaded")\n'
                + "        except Exception as _e:\n"
                + '            print("[JARVIS] HUD WebEngine:", _e)\n'
            )
            m = m.replace(marker, inject, 1)
            print("  OK cyan HUD in center")
        else:
            print("  ! HudCanvas marker missing")

    # MARK 43
    m = re.sub(r'APP_VERSION\s*=\s*"[^"]*"', 'APP_VERSION  = "MARK 43"', m, count=1)

    UI.write_text(m, encoding="utf-8")
    print("  OK ui.py saved")


def patch_main_fish_echo() -> None:
    m = MAIN.read_text(encoding="utf-8")
    if "_speak_mute_until" not in m:
        m = m.replace(
            "self._is_speaking         = False",
            "self._is_speaking         = False\n"
            "        self._speak_mute_until    = 0.0\n"
            "        self._fish_player         = None\n"
            "        self._use_fish_voice      = False",
            1,
        )
        # load fish if voice_name JARVIS
        m = m.replace(
            "self._use_fish_voice      = False",
            '''self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _vn = (_fcfg.get("voice_name") or "").strip()
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _vn == "JARVIS" and _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] Fish TTS active")
        except Exception as _fe:
            print("[JARVIS] Fish:", _fe)''',
            1,
        )
        print("  OK Fish init when voice=JARVIS")

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
        print("  OK mic echo mute")

    # Gemini PCM skip when fish
    old_a = (
        "                    if response.data:\n"
        "                        if self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    new_a = (
        "                    if response.data:\n"
        '                        if getattr(self, "_use_fish_voice", False):\n'
        "                            pass  # Fish TTS\n"
        "                        elif self._interrupted:\n"
        "                            pass  # discard: interrupted\n"
        "                        else:"
    )
    if old_a in m and "Fish TTS" not in m:
        m = m.replace(old_a, new_a, 1)
        print("  OK no dual voice")

    if "_fish_player.speak" not in m and 'self.ui.write_log(f"{self._asst_name}: {full_out}")' in m:
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

    # post-speak mute for native voice
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
    if old_fin in m and "_speak_mute_until = _t.monotonic() + 1.2" not in m:
        m = m.replace(old_fin, new_fin, 1)
        print("  OK post-speak mute")

    MAIN.write_text(m, encoding="utf-8")
    print("  OK main.py")


def ensure_fish_module() -> None:
    dest = ROOT / "core" / "fish_tts.py"
    if dest.exists():
        print("  · fish_tts.py exists")
        return
    # minimal fetch from previous jarvis repo path if any
    url = "https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/core/fish_tts.py"
    try:
        urllib.request.urlretrieve(url, dest)
        print("  OK fish_tts.py")
    except Exception:
        # inline minimal stub note
        print("  ! fish_tts.py not downloaded — copy from Mark tools or install later")


def main() -> None:
    print("=== SETUP_MARK43 ===\n")
    ensure_mark()
    print("[1] HUD")
    install_hud_html()
    print("[2] voices")
    patch_voices()
    print("[3] ui")
    patch_ui_fish_dialog()
    print("[4] main")
    patch_main_fish_echo()
    print("[5] fish module")
    ensure_fish_module()
    print(
        "\n=== DONE ===\n"
        "  python main.py\n"
        "Gear → ASSISTANT VOICE → JARVIS → enter Fish key + voice ID → Save\n"
        "Other voices (Charon/Puck/…) = fast Gemini native\n"
    )


if __name__ == "__main__":
    main()
