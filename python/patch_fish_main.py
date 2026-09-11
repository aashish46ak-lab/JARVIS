"""Apply Fish voice hooks to main.py. Run from python folder: python patch_fish_main.py"""
from pathlib import Path
p = Path(__file__).resolve().parent / "main.py"
m = p.read_text(encoding="utf-8")
if "_use_fish_voice" in m:
    print("Already patched")
    raise SystemExit(0)

old_init = "self._is_speaking         = False"
new_init = '''self._is_speaking         = False
        self._fish_player         = None
        self._use_fish_voice      = False
        try:
            _fcfg = json.loads(open(API_CONFIG_PATH, encoding="utf-8").read())
            _fkey = (_fcfg.get("fish_api_key") or "").strip()
            if _fkey:
                from core.fish_tts import FishAudioTTSEngine
                from core.tts import TTSPlayer
                _vid = (_fcfg.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338").strip()
                self._fish_player = TTSPlayer(FishAudioTTSEngine(_fkey, _vid))
                self._use_fish_voice = True
                print("[JARVIS] Fish Audio JARVIS voice enabled")
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
                                            self.set_speaking(False)
                                    threading.Thread(target=_fish_speak, daemon=True).start()
                            out_buf = []'''
if old_out not in m:
    raise SystemExit("full_out marker not found")
m = m.replace(old_out, new_out, 1)
p.write_text(m, encoding="utf-8")
print("Patched main.py for Fish Audio")
