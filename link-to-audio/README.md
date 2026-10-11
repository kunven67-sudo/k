# 🎵 Link → Audio

Paste a link to anything with sound and get an MP3 you can keep and share.
Works with YouTube, SoundCloud, Bandcamp, TikTok, Twitter/X, Vimeo, direct audio links, and [loads more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

## How to use

1. Install **Python** once: https://www.python.org/downloads/
   (on Windows, tick **"Add Python to PATH"** during install)
2. Double-click:
   - Windows → `Start (Windows).bat`
   - Mac → `Start (Mac).command`
   - Or run `python grab_audio.py`
3. Paste the link, hit **Download** (or Enter). Pick mp3 / m4a / wav if you want.
4. Your file lands in the `Downloads` folder right here. Hit **Open folder** to see it.

The first run takes a minute because it installs what it needs automatically.

You can also skip the window: `python grab_audio.py <link> <another link>`

## If a link stops working
Sites change stuff all the time. Update the downloader:
```
python -m pip install --user -U yt-dlp
```

Only download stuff you're allowed to (your own uploads, free/Creative Commons music, etc.).
