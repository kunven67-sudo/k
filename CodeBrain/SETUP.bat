@echo off
chcp 65001 >nul
title CodeBrain Setup
cd /d "%~dp0"
echo.
echo   =============================================
echo     CodeBrain Setup  -  one click, then relax
echo   =============================================
echo   This installs (all free, no API key):
echo     1. Python 3.12        - runs your code
echo     2. Ollama             - runs the AI brain on YOUR PC
echo     3. pygame + ursina    - for 2D and 3D games
echo     4. Voice              - talk to CodeBrain (optional)
echo     5. The coding brain   - a big download, ONE time only
echo.
pause

where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] winget is missing. Open the Microsoft Store, install "App Installer", then run this again.
    echo     Or install by hand:  https://www.python.org/downloads/  and  https://ollama.com/download
    pause
    exit /b 1
)

rem ---------------------------------------------------------------- 1. Python
echo.
echo [1/6] Looking for Python 3.12...
call :find_python
if not defined PY (
    echo       Not found - installing Python 3.12...
    winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
    call :find_python
)
if not defined PY (
    echo [!] Python didn't install. Get it from https://www.python.org/downloads/
    echo     IMPORTANT: tick "Add python.exe to PATH" in the installer. Then run SETUP.bat again.
    pause
    exit /b 1
)
echo       Using: %PY%

rem ---------------------------------------------------------------- 2. venv + game libraries
echo.
echo [2/6] Making CodeBrain's own Python space + installing pygame and ursina...
if not exist ".venv\Scripts\python.exe" (
    "%PY%" -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
    echo [!] Couldn't create the Python space. Try running SETUP.bat again.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [!] Some game libraries failed to install. CodeBrain still works - try SETUP.bat again later.
)

rem ---------------------------------------------------------------- 3. voice (optional)
echo.
echo [3/6] Installing voice (talk to CodeBrain)...
".venv\Scripts\python.exe" -m pip install -r requirements-voice.txt
if errorlevel 1 (
    echo [!] Voice didn't install. Everything else still works - try SETUP.bat again later.
) else (
    ".venv\Scripts\python.exe" -m codebrain --download-voice
    if errorlevel 1 echo [!] Voice model didn't download yet - it will try again the first time you use the mic.
)

rem ---------------------------------------------------------------- 3. Ollama
echo.
echo [4/6] Looking for Ollama (the brain engine)...
call :find_ollama
if not defined OLLAMA (
    echo       Not found - installing Ollama...
    winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
    call :find_ollama
)
if not defined OLLAMA (
    echo [!] Ollama didn't install. Get it from https://ollama.com/download then run SETUP.bat again.
    pause
    exit /b 1
)
echo       Using: %OLLAMA%

"%OLLAMA%" list >nul 2>&1
if errorlevel 1 (
    echo       Starting Ollama...
    start "" /b "%OLLAMA%" serve >nul 2>&1
)
set /a TRIES=0
:wait_ollama
"%OLLAMA%" list >nul 2>&1
if not errorlevel 1 goto ollama_ready
set /a TRIES+=1
if %TRIES% GEQ 30 (
    echo [!] Ollama isn't answering. Restart your PC and run SETUP.bat again.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_ollama
:ollama_ready

rem ---------------------------------------------------------------- 4. the brain
echo.
echo [5/6] Picking the smartest brain your graphics card can handle...
for /f "delims=" %%m in ('call ".venv\Scripts\python.exe" -m codebrain --pick-model') do set "MODEL=%%m"
if not defined MODEL set "MODEL=qwen2.5-coder:14b"
echo       Brain: %MODEL%
echo       Downloading... (this can take a while the first time - grab a snack)
"%OLLAMA%" pull %MODEL%
if errorlevel 1 (
    echo [!] Download failed. Check your internet and run SETUP.bat again - it continues where it stopped.
    pause
    exit /b 1
)

rem ---------------------------------------------------------------- 5. shortcut
echo.
echo [6/6] Making a Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\CodeBrain.lnk');" ^
  "$s.TargetPath='%~dp0.venv\Scripts\pythonw.exe';$s.Arguments='-m codebrain';$s.WorkingDirectory='%~dp0';" ^
  "$s.IconLocation='%~dp0codebrain\assets\codebrain.ico';" ^
  "$s.Description='CodeBrain - your offline coding coach';$s.Save()" >nul 2>&1

echo.
echo   =============================================
echo     ALL DONE!  Double-click "CodeBrain" on your
echo     Desktop, or CodeBrain.bat in this folder.
echo     Terminal mode: CodeBrain-Terminal.bat
echo     Problems? Double-click DOCTOR.bat
echo   =============================================
echo.
pause
start "" ".venv\Scripts\pythonw.exe" -m codebrain
exit /b 0

rem ================================================================ helpers
:find_python
set "PY="
for /f "delims=" %%i in ('py -3.12 -c "import sys;print(sys.executable)" 2^>nul') do set "PY=%%i"
if defined PY exit /b 0
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    exit /b 0
)
for /f "delims=" %%i in ('python -c "import sys;assert (3,10)<=sys.version_info[:2]<=(3,13);print(sys.executable)" 2^>nul') do set "PY=%%i"
exit /b 0

:find_ollama
set "OLLAMA="
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    exit /b 0
)
for /f "delims=" %%i in ('where ollama 2^>nul') do (
    set "OLLAMA=%%i"
    exit /b 0
)
exit /b 0
