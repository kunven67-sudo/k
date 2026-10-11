@echo off
chcp 65001 >nul
title CodeBrain Doctor
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo.
    echo   [X] CodeBrain isn't set up yet ^(no .venv folder^).
    echo       Double-click SETUP.bat first. If SETUP.bat fails, read the message it shows.
    echo.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m codebrain --doctor
echo.
pause
