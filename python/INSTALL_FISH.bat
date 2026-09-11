@echo off
cd /d "%~dp0"
echo === Install Fish Audio JARVIS voice files ===

if not exist main.py (
  echo Run this from inside your python folder ^(where main.py is^).
  echo Or: copy this bat into python\ then run it.
  pause
  exit /b 1
)

echo Downloading fish_tts.py ...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/core/fish_tts.py' -OutFile 'core\fish_tts.py'"

echo Downloading patch_fish_main.py ...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/patch_fish_main.py' -OutFile 'patch_fish_main.py'"

echo Patching main.py ...
python patch_fish_main.py

echo Updating api_keys.json fields ...
python -c "import json,pathlib;p=pathlib.Path('config/api_keys.json');d=json.loads(p.read_text()) if p.exists() else {};d.setdefault('fish_api_key','PASTE_FISH_API_KEY');d.setdefault('fish_voice_id','14129c3e320149449d6bada6862f7338');d.setdefault('tts_engine','fish');p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(d,indent=2));print('OK',p)"

echo.
echo NEXT: edit config\api_keys.json — set fish_api_key from https://fish.audio
echo Then: python main.py
echo Console should say: Fish Audio JARVIS voice enabled
pause
