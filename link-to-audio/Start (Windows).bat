@echo off
cd /d "%~dp0"
python grab_audio.py %*
if errorlevel 1 pause
