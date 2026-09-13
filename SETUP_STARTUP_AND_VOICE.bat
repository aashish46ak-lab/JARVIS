@echo off
cd /d "%~dp0"
echo === JARVIS MARK43: startup + Fish voice ===

pip install fish-audio-sdk soundfile pydub requests -q

powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/FIX_GEMINI_VOICE.py' -OutFile 'FIX_GEMINI_VOICE.py'"
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/APPLY_FISH_DEFAULT.py' -OutFile 'APPLY_FISH_DEFAULT.py'"
powershell -Command "New-Item -ItemType Directory -Force -Path core | Out-Null; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/core/fish_tts.py' -OutFile 'core\fish_tts.py'"
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/INSTALL_STARTUP.py' -OutFile 'INSTALL_STARTUP.py'"

python APPLY_FISH_DEFAULT.py
python FIX_GEMINI_VOICE.py
python INSTALL_STARTUP.py

echo.
echo Done. Edit config\api_keys.json if needed, then:
echo   python main.py
pause
