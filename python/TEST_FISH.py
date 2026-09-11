"""Test Fish JARVIS voice only.
Run from python folder:
  python TEST_FISH.py
"""
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
        print("Get key: https://fish.audio → API Keys")
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
    for model in ["s1", "s2-pro", "s2.1-pro", "s2.1-pro-free"]:
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
        print("FAILED — check API key / credits on fish.audio")
        return

    # Play if possible
    try:
        from core.tts import _play_audio_bytes
        _play_audio_bytes(out.read_bytes())
        print("Played OK")
    except Exception as e:
        print("File saved but play failed:", e)
        print("Open fish_test.mp3 manually to hear voice")

if __name__ == "__main__":
    main()
