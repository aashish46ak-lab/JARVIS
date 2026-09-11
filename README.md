# JARVIS — MARK 43 (Ashish)

PC voice assistant based on **[Mark-LIII](https://github.com/FatihMakes/Mark-LIII)**.

- Fast Gemini Live replies
- Light echo guard (mic mute while speaking)
- Optional cyan SVG J.A.R.V.I.S. HUD
- MARK 43 branding

## Recommended: clean install from Mark-LIII

```bat
cd %USERPROFILE%\Downloads
git clone https://github.com/FatihMakes/Mark-LIII.git JARVIS-MARK43
cd JARVIS-MARK43
pip install -r requirements.txt
```

Put your **Gemini API key** in `config\api_keys.json`.

```bat
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/RESTORE_FAST.py' -OutFile 'RESTORE_FAST.py'"
python RESTORE_FAST.py
python main.py
```

## Optional cyan HUD

```bat
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/INSTALL_JARVIS_HUD.py' -OutFile 'INSTALL_JARVIS_HUD.py'"
powershell -Command "New-Item -ItemType Directory -Force -Path hud_jarvis | Out-Null; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/hud_jarvis/index.html' -OutFile 'hud_jarvis\index.html'"
pip install PyQt6-WebEngine
python INSTALL_JARVIS_HUD.py
python main.py
```

## Tips

- Headphones reduce echo
- Run only one `python main.py`
- Fish TTS is optional and slower — skip for instant voice

## Credit

Engine: [FatihMakes/Mark-LIII](https://github.com/FatihMakes/Mark-LIII)  
HUD / MARK 43: Ashish
