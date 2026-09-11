"""
NUCLEAR echo fix + Iron Man suit center visual for Mark-LIII.

  cd python folder
  python FIX_ALL_NOW.py
  python main.py

Headphones recommended.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"
UI = ROOT / "ui.py"
HUD = ROOT / "hud_ironman"


def download_ironman() -> Path:
    HUD.mkdir(parents=True, exist_ok=True)
    css, idx = HUD / "style.css", HUD / "index.html"
    base = "https://raw.githubusercontent.com/withaarzoo/Iron-man/main/"
    if not css.exists() or css.stat().st_size < 1000:
        print("  downloading style.css...")
        urllib.request.urlretrieve(base + "style.css", css)
    if not idx.exists() or idx.stat().st_size < 500:
        print("  downloading index.html...")
        urllib.request.urlretrieve(base + "index.html", idx)
    html = idx.read_text(encoding="utf-8", errors="ignore")
    if "02060c" not in html:
        html = html.replace(
            "</head>",
            "<style>html,body{background:#02060c!important;background-image:none!important;"
            "overflow:hidden!important;margin:0}.wrapper,.iron-man-wrapper{transform:scale(1.4);"
            "transform-origin:center}</style></head>",
        )
        idx.write_text(html, encoding="utf-8")
    print("  OK Iron Man assets ready")
    return idx


def nuclear_echo() -> None:
    if not MAIN.exists():
        print("! main.py missing")
        return
    m = MAIN.read_text(encoding="utf-8")
    orig = m

    if "_speak_mute_until" not in m and "self._is_speaking         = False" in m:
        m = m.replace(
            "self._is_speaking         = False",
            'self._is_speaking         = False\n'
            '        self._speak_mute_until    = 0.0\n'
            '        self._last_jarvis_line    = ""\n'
            '        self._fish_player         = None\n'
            '        self._use_fish_voice      = False',
            1,
        )
        print("  OK mute fields")

    if "self._last_jarvis_line" not in m and "self._speak_mute_until" in m:
        m = m.replace(
            "self._speak_mute_until    = 0.0",
            'self._speak_mute_until    = 0.0\n        self._last_jarvis_line    = ""',
            1,
        )

    if "FishAudioTTSEngine" not in m and "self._use_fish_voice      = False" in m:
        m = m.replace(
            "self._use_fish_voice      = False",
            '''self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] Fish-only ON")
        except Exception as _fe:
            print("[JARVIS] Fish load:", _fe)''',
            1,
        )
        print("  OK Fish loader")

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
    if old_cb in m:
        m = m.replace(old_cb, new_cb, 1)
        print("  OK mic gate")
    elif "_echo_mute" in m or "_muted_echo" in m:
        print("  mic gate already ok")

    if "echo dropped" not in m:
        old_fi = (
            '                            full_in = " ".join(in_buf).strip()\n'
            "                            if full_in:\n"
            '                                self.ui.write_log(f"You: {full_in}")\n'
            '                                self._session_log.append(f"User: {full_in}")'
        )
        new_fi = (
            '                            full_in = " ".join(in_buf).strip()\n'
            "                            if full_in:\n"
            "                                _skip_echo = False\n"
            "                                try:\n"
            "                                    import time as _ti\n"
            '                                    if _ti.monotonic() < float(getattr(self, "_speak_mute_until", 0) or 0):\n'
            "                                        _skip_echo = True\n"
            "                                    with self._speaking_lock:\n"
            "                                        if self._is_speaking:\n"
            "                                            _skip_echo = True\n"
            '                                    _last = " ".join((getattr(self, "_last_jarvis_line", "") or "").lower().split())\n'
            '                                    _now = " ".join(full_in.lower().split())\n'
            "                                    if _last and _now and (_now in _last or _last in _now):\n"
            "                                        _skip_echo = True\n"
            '                                    if "my apologies" in _now or "unable to fetch" in _now:\n'
            "                                        _skip_echo = True\n"
            "                                except Exception:\n"
            "                                    pass\n"
            "                                if _skip_echo:\n"
            '                                    print(f"[JARVIS] echo dropped: {full_in[:70]}")\n'
            "                                    in_buf = []\n"
            "                                    continue\n"
            '                                self.ui.write_log(f"You: {full_in}")\n'
            '                                self._session_log.append(f"User: {full_in}")'
        )
        if old_fi in m:
            m = m.replace(old_fi, new_fi, 1)
            print("  OK full_in echo filter")
        else:
            print("  ! full_in pattern not found")

    if "self._last_jarvis_line = full_out" not in m:
        m = m.replace(
            'self.ui.write_log(f"{self._asst_name}: {full_out}")',
            'self.ui.write_log(f"{self._asst_name}: {full_out}")\n'
            "                                self._last_jarvis_line = full_out",
            1,
        )
        print("  OK last line track")

    if "ignore Gemini PCM" not in m and "Fish Audio speaks text" not in m:
        old_a = (
            "                    if response.data:\n"
            "                        if self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        new_a = (
            "                    if response.data:\n"
            '                        if getattr(self, "_use_fish_voice", False):\n'
            "                            pass  # Fish only — ignore Gemini PCM\n"
            "                        elif self._interrupted:\n"
            "                            pass  # discard: interrupted\n"
            "                        else:"
        )
        if old_a in m:
            m = m.replace(old_a, new_a, 1)
            print("  OK no dual voice")

    if "_fish_player.speak" not in m and "self._last_jarvis_line = full_out" in m:
        m = m.replace(
            "self._last_jarvis_line = full_out",
            '''self._last_jarvis_line = full_out
                                if getattr(self, "_use_fish_voice", False) and getattr(self, "_fish_player", None):
                                    _fo = full_out
                                    def _fish_speak(t=_fo):
                                        try:
                                            self.set_speaking(True)
                                            try:
                                                self.ui.muted = True
                                            except Exception:
                                                pass
                                            self._fish_player.speak(t)
                                        except Exception as _e:
                                            print("[JARVIS] Fish:", _e)
                                        finally:
                                            try:
                                                import time as _t
                                                self._speak_mute_until = _t.monotonic() + 5.0
                                            except Exception:
                                                pass
                                            try:
                                                self.ui.muted = False
                                            except Exception:
                                                pass
                                            self.set_speaking(False)
                                    threading.Thread(target=_fish_speak, daemon=True).start()''',
            1,
        )
        print("  OK Fish speak + 5s mute")

    m = re.sub(
        r"_speak_mute_until\s*=\s*_t\.monotonic\(\)\s*\+\s*[\d.]+",
        "_speak_mute_until = _t.monotonic() + 5.0",
        m,
    )

    if "get_brief_enabled()" in m and "HARD_ECHO_NO_BRIEF" not in m:
        m = m.replace(
            "get_brief_enabled()",
            "(False and get_brief_enabled())  # HARD_ECHO_NO_BRIEF",
            1,
        )
        print("  OK briefing off")

    if m != orig:
        MAIN.write_text(m, encoding="utf-8")
        print("  OK main.py saved")
    else:
        print("  main.py unchanged")


def patch_visual(html_path: Path) -> None:
    if not UI.exists():
        print("! ui.py missing")
        return
    m = UI.read_text(encoding="utf-8")
    if "IRONMAN_HUD" in m:
        print("  visual already set")
        return
    marker = "self.hud = HudCanvas(face_path, _display)"
    if marker not in m:
        print("  ! HudCanvas marker missing")
        return
    path = str(html_path.resolve()).replace("\\", "\\\\")
    inject = (
        "self.hud = HudCanvas(face_path, _display)\n"
        "        # IRONMAN_HUD\n"
        "        try:\n"
        "            try:\n"
        "                from PyQt6.QtWebEngineWidgets import QWebEngineView\n"
        "                from PyQt6.QtCore import QUrl\n"
        "            except ImportError:\n"
        "                from PyQt5.QtWebEngineWidgets import QWebEngineView\n"
        "                from PyQt5.QtCore import QUrl\n"
        "            _im = QWebEngineView()\n"
        f'            _im.setUrl(QUrl.fromLocalFile(r"{path}"))\n'
        "            _im.setMinimumSize(300, 300)\n"
        "            self.hud = _im\n"
        '            print("[JARVIS] Iron Man suit HUD loaded")\n'
        "        except Exception as _hud_e:\n"
        '            print("[JARVIS] WebEngine unavailable, rings kept:", _hud_e)\n'
    )
    m = m.replace(marker, inject, 1)
    m = m.replace(
        "Qt.AlignmentFlag.AlignCenter, self._assistant_name)",
        'Qt.AlignmentFlag.AlignCenter, "J.A.R.V.I.S.")',
        1,
    )
    UI.write_text(m, encoding="utf-8")
    print("  OK Iron Man / JARVIS visual")


def main() -> None:
    print("=== FIX_ALL_NOW ===\n[1] assets")
    html = download_ironman()
    print("[2] echo")
    nuclear_echo()
    print("[3] visual")
    patch_visual(html)
    cfg = ROOT / "config" / "api_keys.json"
    if cfg.exists():
        d = json.loads(cfg.read_text(encoding="utf-8"))
        d["tts_engine"] = "fish"
        d.setdefault("fish_voice_id", "14129c3e320149449d6bada6862f7338")
        cfg.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
        print("[4] config fish")
    print(
        "\nDONE. Close all JARVIS windows. Headphones on.\n"
        "  python main.py\n"
        "If no suit: pip install PyQt6-WebEngine\n"
    )


if __name__ == "__main__":
    main()
