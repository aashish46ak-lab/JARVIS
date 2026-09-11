@echo off
cd /d "%~dp0"
echo === JARVIS: downloading full Python engine (Mark-LIII) ===
echo.

where tar >nul 2>&1
if errorlevel 1 (
  echo ERROR: need Windows 10+ tar, or extract ZIP manually.
  pause
  exit /b 1
)

echo Downloading...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/FatihMakes/Mark-LIII/archive/refs/heads/main.zip' -OutFile '%TEMP%\mark-liii.zip'"
if errorlevel 1 (
  echo Download failed. Open browser: https://github.com/FatihMakes/Mark-LIII/archive/refs/heads/main.zip
  pause
  exit /b 1
)

echo Extracting...
if exist python_old rmdir /s /q python_old
if exist python ren python python_old
powershell -NoProfile -Command "Expand-Archive -Path '%TEMP%\mark-liii.zip' -DestinationPath '%TEMP%\mark-liii-extract' -Force"

xcopy /E /I /Y "%TEMP%\mark-liii-extract\Mark-LIII-main\*" "python\"

echo Writing your JARVIS prompt...
if not exist python\core mkdir python\core
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/aashish46ak-lab/JARVIS/main/python/core/prompt.txt' -OutFile 'python\core\prompt.txt'" 2>nul

if not exist python\config mkdir python\config
if not exist python\config\api_keys.json (
  echo {> python\config\api_keys.json
  echo   "gemini_api_key": "PASTE_KEY_FROM_https://aistudio.google.com/apikey",>> python\config\api_keys.json
  echo   "os_system": "Windows",>> python\config\api_keys.json
  echo   "assistant_name": "JARVIS",>> python\config\api_keys.json
  echo   "user_name": "sir">> python\config\api_keys.json
  echo }>> python\config\api_keys.json
  echo Created python\config\api_keys.json — paste your Gemini key inside.
)

echo.
echo === NEXT ===
echo 1. Edit python\config\api_keys.json — paste Gemini API key
echo 2. cd python
echo 3. python setup.py
echo 4. python main.py
echo.
pause
