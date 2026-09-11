# Fish Audio JARVIS voice

Default Mark/Gemini Live voice is **not** Fish. To use your JARVIS Fish voice:

## 1. Get Fish API key
https://fish.audio → account → API key

## 2. Edit `config/api_keys.json`

```json
{
  "gemini_api_key": "your_gemini_key",
  "os_system": "Windows",
  "assistant_name": "JARVIS",
  "user_name": "sir",
  "fish_api_key": "your_fish_key",
  "fish_voice_id": "14129c3e320149449d6bada6862f7338",
  "tts_engine": "fish"
}
```

## 3. Install patched files

From this repo, copy into your local `python/` folder:
- `core/tts.py` (Fish engine)
- Run `python patch_fish_main.py` (or use updated `main.py`)

## 4. Restart

```bat
cd python
python main.py
```

Console should show: `Fish Audio JARVIS voice enabled`

Gemini still **understands** you (Live API). **Speech out** uses Fish voice id `14129c3e320149449d6bada6862f7338` when `fish_api_key` is set.
