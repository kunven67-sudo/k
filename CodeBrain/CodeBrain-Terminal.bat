@echo off
chcp 65001 >nul
title CodeBrain Terminal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo CodeBrain isn't set up yet. Double-click SETUP.bat first!
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m codebrain --cli
pause
