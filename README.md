# JARVIS — MARK 43

Built on [FatihMakes/Mark-LIII](https://github.com/FatihMakes/Mark-LIII).

## What you get

- Full Mark-LIII PC control (fast Gemini Live voice)
- Voices: **Charon, Puck, Kore, Fenrir, Aoede** + **JARVIS** (Fish Audio)
- Click **JARVIS** → enter Fish API key + Voice ID → Save
- Center UI: cyan animated J.A.R.V.I.S. rings (your HTML)
- Light echo mute while speaking

## Install (Windows)

```bat
cd %USERPROFILE%\Downloads
git clone https://github.com/FatihMakes/Mark-LIII.git JARVIS-MARK43
cd JARVIS-MARK43
pip install -r requirements.txt
pip install PyQt6-WebEngine
```

Put **Gemini API key** in `config\api_keys.json`.

```bat
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/SETUP_MARK43.py' -OutFile 'SETUP_MARK43.py'"
python SETUP_MARK43.py
python main.py
```

Customize (gear) → pick voice. **JARVIS** opens Fish key/ID fields.

Headphones recommended (less echo).

## Credit

Engine: Mark-LIII · MARK 43 / HUD: Ashish
