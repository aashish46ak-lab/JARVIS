@echo off
cd /d "%~dp0"
title JARVIS MARK 43
echo Starting JARVIS...
python main.py
if errorlevel 1 pause
