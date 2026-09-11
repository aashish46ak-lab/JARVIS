"""Apply Fish voice hooks to main.py. Run from python folder: python patch_fish_main.py"""
from pathlib import Path

p = Path(__file__).resolve().parent / "main.py"
m = p.read_text(encoding="utf-8")
if "_speak_mute_until" in m:
    print("Already patched (Fish + echo mute)")
    raise SystemExit(0)

had_fish = "_use_fish_voice" in m

if not had_fish:
    old_init = "self._is_speaking         = False"
    new_init = '''self._is_speaking         = False
        self._fish_player         = None
        self._use_fish_voice      = False
        self._speak_mute_until    = 0.0  # monotonic deadline — ignore mic echo after TTS
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] Fish Audio JARVIS voice enabled (id=%s)" % _vid[:8])
        except Exception as _fe:
            print(f"[JARVIS] Fish voice not loaded: {_fe}")'''
    if old_init not in m:
        raise SystemExit("init marker not found")
    m = m.replace(old_init, new_init, 1)

    old_audio = """                    if response.data:
                        if self._interrupted:
                            pass  # discard: interrupted
                        else:"""
    new_audio = """                    if response.data:
                        if getattr(self, "_use_fish_voice", False):
                            pass  # Fish Audio speaks text instead of Gemini voice
                        elif self._interrupted:
                            pass  # discard: interrupted
                        else:"""
    if old_audio not in m:
        raise SystemExit("audio marker not found")
    m = m.replace(old_audio, new_audio, 1)

    old_out = '''                            full_out = " ".join(out_buf).strip()
                            if full_out:
                                self.ui.write_log(f"{self._asst_name}: {full_out}")
                                self._session_log.append(f"{self._asst_name}: {full_out}")
                                if self._dashboard:
                                    asyncio.create_task(self._dashboard.broadcast({
                                        "type": "log", "speaker": "jarvis",
                                        "text": full_out,
                                        "ts": datetime.now().isoformat(),
                                    }))
                            out_buf = []'''
    new_out = '''                            full_out = " ".join(out_buf).strip()
                            if full_out:
                                self.ui.write_log(f"{self._asst_name}: {full_out}")
                                self._session_log.append(f"{self._asst_name}: {full_out}")
                                if self._dashboard:
                                    asyncio.create_task(self._dashboard.broadcast({
                                        "type": "log", "speaker": "jarvis",
                                        "text": full_out,
                                        "ts": datetime.now().isoformat(),
                                    }))
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
                                                self._speak_mute_until = _t.monotonic() + 1.8
                                            except Exception:
                                                pass
                                            self.set_speaking(False)
                                    threading.Thread(target=_fish_speak, daemon=True).start()
                            out_buf = []'''
    if old_out not in m:
        raise SystemExit("full_out marker not found")
    m = m.replace(old_out, new_out, 1)
else:
    if "self._speak_mute_until" not in m:
        m = m.replace(
            "self._use_fish_voice      = False",
            "self._use_fish_voice      = False\n        self._speak_mute_until    = 0.0",
            1,
        )
    if "_speak_mute_until = _t.monotonic()" not in m and "self._fish_player.speak(t)" in m:
        m = m.replace(
            """                                        finally:
                                            self.set_speaking(False)""",
            """                                        finally:
                                            try:
                                                import time as _t
                                                self._speak_mute_until = _t.monotonic() + 1.8
                                            except Exception:
                                                pass
                                            self.set_speaking(False)""",
            1,
        )

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
    print("Mic echo gate strengthened")
elif "_muted_echo" in m:
    print("Mic echo gate already present")
else:
    print("WARN: mic gate marker not found — check main.py version")

p.write_text(m, encoding="utf-8")
print("Patched main.py for Fish Audio + post-speak mute")
