"""
Fix: Gemini rejects voice name JARVIS.
Map JARVIS → Charon for Live API only. Fish still uses your voice id.

  python FIX_GEMINI_VOICE.py
  python main.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAIN = ROOT / "main.py"


def main() -> None:
    if not MAIN.exists():
        raise SystemExit("main.py missing — run inside JARVIS-MARK43")
    m = MAIN.read_text(encoding="utf-8")
    orig = m

    # Replace get_voice() inside PrebuiltVoiceConfig only
    old = """            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=get_voice()
                    )
                )
            ),"""
    new = """            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        # Gemini only allows Charon/Puck/Kore/Fenrir/Aoede
                        # JARVIS = Fish TTS; map to Charon for Live connect
                        voice_name=(_gv if (_gv := get_voice()) in
                            ("Charon", "Puck", "Kore", "Fenrir", "Aoede")
                            else "Charon")
                    )
                )
            ),"""
    if old in m:
        m = m.replace(old, new, 1)
        print("OK Gemini voice mapped (JARVIS → Charon for API)")
    elif "JARVIS → Charon" in m or "else \"Charon\"" in m:
        print("Already fixed")
    else:
        # looser replace
        if "voice_name=get_voice()" in m:
            m = m.replace(
                "voice_name=get_voice()",
                'voice_name=(_gv if (_gv := get_voice()) in '
                '("Charon", "Puck", "Kore", "Fenrir", "Aoede") else "Charon")',
                1,
            )
            print("OK voice_name=get_voice() patched")
        else:
            print("! pattern not found — paste main.py speech_config section")

    if m != orig:
        MAIN.write_text(m, encoding="utf-8")
        print("Saved main.py")

    print("\nRun:  python main.py")
    print("Expect: [JARVIS] Fish TTS active  (and no 1007 JARVIS error)")


if __name__ == "__main__":
    main()
