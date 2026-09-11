"""Test Fish JARVIS voice. Run: python TEST_FISH.py"""
import json
from pathlib import Path

CFG = Path(__file__).parent / "config" / "api_keys.json"

def main():
    if not CFG.exists():
        print("Missing config/api_keys.json")
        return
    d = json.loads(CFG.read_text(encoding="utf-8"))
    key = (d.get("fish_api_key") or "").strip()
    vid = (d.get("fish_voice_id") or "14129c3e320149449d6bada6862f7338").strip()
    if not key or key.startswith("PASTE"):
        print("ERROR: Set fish_api_key in config/api_keys.json")
        return
    print("Key length:", len(key))
    print("Voice id:", vid)

    import requests
    payload = {
        "text": "Good evening, sir. I am JARVIS. Fish Audio voice test successful.",
        "reference_id": vid,
        "format": "mp3",
        "normalize": True,
        "latency": "balanced",
    }
    out = Path(__file__).parent / "fish_test.mp3"
    ok = False
    for model in ["s2.1-pro-free", "s1", "s2-pro", "s2.1-pro"]:
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "model": model,
        }
        print("Trying model", model, "...")
        r = requests.post("https://api.fish.audio/v1/tts", json=payload, headers=headers, timeout=90)
        print("  status", r.status_code, "bytes", len(r.content))
        if r.status_code == 200 and len(r.content) > 500:
            out.write_bytes(r.content)
            print("Saved", out)
            ok = True
            break
        print("  body", r.text[:200])

    if not ok:
        print("FAILED")
        return

    try:
        from core.fish_tts import _play_mp3
        _play_mp3(out.read_bytes())
        print("Played OK")
    except Exception as e:
        print("Play helper failed:", e)
        try:
            import os
            os.startfile(str(out))
            print("Opened fish_test.mp3 in default player")
        except Exception as e2:
            print("Open manually:", out, e2)

if __name__ == "__main__":
    main()
