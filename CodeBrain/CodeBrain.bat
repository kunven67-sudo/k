@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
    echo CodeBrain isn't set up yet. Double-click SETUP.bat first!
    pause
    exit /b 1
)
start "" ".venv\Scripts\pythonw.exe" -m codebrain
