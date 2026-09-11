@echo off
cd /d "%~dp0"
if not exist main.py (
  echo Put this bat inside your python folder ^(where main.py is^) then run again.
  pause
  exit /b 1
)
echo [1/5] Fish TTS engine...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/core/fish_tts.py' -OutFile 'core\fish_tts.py'"
echo [2/5] Fish main patch...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/patch_fish_main.py' -OutFile 'patch_fish_main.py'"
python patch_fish_main.py
echo [3/5] HUD dotted+red core...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/patch_hud_3d.py' -OutFile 'patch_hud_3d.py'"
python patch_hud_3d.py
echo [4/5] Test script...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/TEST_FISH.py' -OutFile 'TEST_FISH.py'"
echo [5/5] api_keys fish fields...
python -c "import json,pathlib;p=pathlib.Path('config/api_keys.json');d=json.loads(p.read_text(encoding='utf-8')) if p.exists() else {};d.setdefault('fish_api_key',d.get('fish_api_key','PASTE_FISH_KEY'));d['fish_voice_id']='14129c3e320149449d6bada6862f7338';d['tts_engine']='fish';d.setdefault('assistant_name','JARVIS');d.setdefault('user_name','sir');p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(d,indent=2),encoding='utf-8');print('Wrote',p)"
echo.
echo === EDIT config\api_keys.json — set fish_api_key from https://fish.audio ===
echo Then:
echo   python TEST_FISH.py
echo   python main.py
pause
