@echo off
cd /d "%~dp0"
python --version || (echo Install Python 3.11+ with PATH & pause & exit /b 1)
python setup.py
echo Edit config\api_keys.json then: python main.py
pause
