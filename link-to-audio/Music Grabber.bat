@echo off
setlocal EnableDelayedExpansion
title Music Grabber
chcp 65001 >nul

rem Paste a link, get an MP3. Nothing to install: the first run downloads
rem yt-dlp (the downloader), ffmpeg (MP3 converter) and deno (needed by
rem YouTube) into %LOCALAPPDATA%\MusicGrabber. Songs go to Downloads\Music Grabber.

set "TOOLS=%LOCALAPPDATA%\MusicGrabber"
set "OUT=%USERPROFILE%\Downloads\Music Grabber"
set "YTDLP=%TOOLS%\yt-dlp.exe"
set "FFDIR=%TOOLS%\ffmpeg"
set "DENO=%TOOLS%\deno.exe"

if not exist "%TOOLS%" mkdir "%TOOLS%"
if not exist "%OUT%" mkdir "%OUT%"

where curl >nul 2>nul || (
  echo   This needs Windows 10 or newer.
  pause
  exit /b 1
)

if not exist "%YTDLP%" (
  echo.
  echo   First time setup 1/3: getting the downloader...
  curl -fL --progress-bar -o "%YTDLP%" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" || (
    del "%YTDLP%" 2>nul
    goto setupfail
  )
) else (
  echo   Checking for updates...
  "%YTDLP%" -U >nul 2>nul
)

if not exist "%FFDIR%\ffmpeg.exe" (
  echo.
  echo   First time setup 2/3: getting the MP3 converter ^(about 90 MB, one time only^)...
  curl -fL --progress-bar -o "%TOOLS%\ff.zip" "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip" || goto setupfail
  tar -xf "%TOOLS%\ff.zip" -C "%TOOLS%" || goto setupfail
  if exist "%FFDIR%" rmdir /s /q "%FFDIR%"
  move "%TOOLS%\ffmpeg-master-latest-win64-gpl-shared\bin" "%FFDIR%" >nul
  rmdir /s /q "%TOOLS%\ffmpeg-master-latest-win64-gpl-shared"
  del "%TOOLS%\ff.zip"
)

if not exist "%DENO%" (
  echo.
  echo   First time setup 3/3: getting the YouTube helper ^(about 40 MB, one time only^)...
  curl -fL --progress-bar -o "%TOOLS%\deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip" || goto setupfail
  tar -xf "%TOOLS%\deno.zip" -C "%TOOLS%" || goto setupfail
  del "%TOOLS%\deno.zip"
)

:ask
cls
echo.
echo   ===============  MUSIC GRABBER  ===============
echo.
echo   1. Copy a music link (YouTube, SoundCloud, TikTok...)
echo   2. Right-click in this window (or Ctrl+V) to paste it
echo   3. Press Enter
echo.
echo   Songs are saved to: Downloads\Music Grabber
echo.
set "LINK="
set /p "LINK=  Paste link: "
if not defined LINK goto ask
set "LINK=!LINK:"=!"
echo.

rem TikTok "sound" pages (tiktok.com/music/...) are not supported by the downloader.
if not "!LINK:tiktok.com/music/=!"=="!LINK!" (
  echo   That's a TikTok SOUND page - those can't be downloaded directly.
  echo.
  echo   Do this instead:
  echo     1. On that sound page, tap any video that uses the sound
  echo     2. Click Share, then Copy link
  echo     3. Paste THAT link here - you'll get the same audio as an MP3
  echo.
  echo   Press any key to try again...
  pause >nul
  goto ask
)

"%YTDLP%" "!LINK!" --no-playlist -x --audio-format mp3 --audio-quality 0 --embed-metadata --no-mtime --windows-filenames --ffmpeg-location "%FFDIR%" --js-runtimes "deno:%DENO%" -o "%OUT%\%%(title)s.%%(ext)s"

echo.
if errorlevel 1 (
  echo   That link didn't work. Make sure it plays without logging in.
  echo   ^(Spotify and Apple Music links won't work, they block downloads.^)
) else (
  echo   Done^^! Your song is in Downloads\Music Grabber
  start "" "%OUT%"
)
echo.
echo   Press any key to grab another song...
pause >nul
goto ask

:setupfail
echo.
echo   Setup couldn't download. Check your internet and double-click again.
del "%TOOLS%\ff.zip" "%TOOLS%\deno.zip" 2>nul
pause
exit /b 1
