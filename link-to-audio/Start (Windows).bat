@echo off
cd /d "%~dp0"

rem Prefer the "py" launcher that the python.org installer adds, fall back to "python".
where py >nul 2>nul && (py grab_audio.py %* & goto end)
python --version >nul 2>nul && (python grab_audio.py %* & goto end)

echo.
echo   Python is not installed yet!
echo   Opening the download page... install it, then double-click this file again.
echo   (Tick "Add python.exe to PATH" on the first install screen.)
echo.
start https://www.python.org/downloads/windows/
pause
exit /b

:end
if errorlevel 1 pause
