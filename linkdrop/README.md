# LINKDROP

Paste a TikTok link, get the video. A phone-first web app in one HTML file.

## What it does

- **PASTE** reads the TikTok link you copied and starts downloading right away.
- **Many links at once**: paste a whole list into the box and they download one after another.
- **What to save**: HD (no watermark), normal video (no watermark), video with the TikTok watermark, or MP3 (just the sound).
- **Photo slideshows**: saves every picture plus the sound (one ZIP, separate files, or straight to Photos on iPhone).
- **Grabs copied links by itself**: on Android Chrome, after you tap PASTE once and allow it, coming back to LINKDROP picks up the link you copied.
- **Share from TikTok** (Android, installed): TikTok Share > LINKDROP and it starts downloading.
- **History** with thumbnails, search, and "get it again" in another type.
- **ZIP all**, **Save all**, Watch inside the app, retry when something fails.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app. Works on its own. |
| `manifest.json`, `sw.js`, `icon-*.png` | Only needed to install it as an app and get the TikTok Share button. |

## How it gets the video

LINKDROP asks the free [tikwm.com](https://www.tikwm.com) API where the video file is, then downloads that file straight from TikTok's servers into the phone. Nothing gets uploaded. The free API allows about one lookup per second, so big batches go one by one.

Only save videos you're allowed to keep (your own, or ones the creator lets people download).
