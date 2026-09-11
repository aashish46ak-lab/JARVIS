# JARVIS — Python only (Mark-LIII)

Electron HUD is **not** required. Use this folder only.

## First-time setup (Windows)

1. Download this repo ZIP and extract.
2. Double-click **`GET_FULL_PYTHON.bat`** (downloads full Mark-LIII engine into `python/`).
3. Then:

```bat
cd path\to\JARVIS-main\python
python APPLY_PYTHON_FIXES.py
```

4. Edit **`config\api_keys.json`**:

```json
{
  "gemini_api_key": "YOUR_GEMINI_KEY",
  "os_system": "Windows",
  "assistant_name": "JARVIS",
  "user_name": "sir",
  "fish_api_key": "YOUR_FISH_KEY",
  "fish_voice_id": "14129c3e320149449d6bada6862f7338",
  "tts_engine": "fish"
}
```

- Gemini: https://aistudio.google.com/apikey  
- Fish (JARVIS voice / Ame): https://fish.audio  

5. Install + run:

```bat
python setup.py
python main.py
```

Allow **microphone** when Windows asks.

## Fixes included

| Issue | Fix |
|--------|-----|
| "insta khol" opens download page | `actions/open_app.py` opens https://www.instagram.com/ |
| JARVIS hears itself / repeats 3–4× | Fish patch keeps set_speaking + 1.8s post-mute on mic |
| Fish Voice ID | Separate `fish_voice_id` in `api_keys.json` (default = JARVIS Ame) |
| Personality | `core/prompt.txt` — MCU JARVIS, Nepali+English |

## Notes

- Full PC control uses Mark-LIII tools: computer_control, screen_process, browser_control, etc.
- Headphones help reduce echo further.
