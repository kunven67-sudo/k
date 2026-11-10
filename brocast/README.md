# 📡 BroCast 3

Show your Android phone's screen **with sound** on your TV (web browser) or PC (the BroCast app). Same Wi-Fi, no cables.

**New in 3.0: just share, and no more freezing.**
- **The anime freeze is fixed.** The picture used to stop for a second or two while the sound
  kept going. Cause: browsers treat a frame that comes more than twice "the last
  frame's length" late as a break in the video, and throw away everything up to the next full
  picture (up to 2 s). Phones make frames unevenly (24 fps anime on a 120 Hz screen, dropped
  frames, a repeated frame after 100 ms of still picture), so that happened all the time. Now every
  frame starts exactly where the one before ends: the browser never sees a break.
- **Rides out Wi-Fi hiccups.** The TV page keeps a small cushion (about 0.3 s, bigger by itself on
  choppy Wi-Fi), and the phone lets frames wait up to 1.2 s instead of 0.3 s before skipping.
- **Adjusts to your Wi-Fi like YouTube does.** When frames start waiting, the phone uses fewer bits
  (sharper again once the Wi-Fi keeps up). Constant bitrate, so a busy fight scene doesn't suddenly
  send 3x the data.
- **BroCast for PC** (`pc/`): a tiny Windows app (under 1 MB) that finds your phone by itself and
  plays the video on your graphics card. No browser (Edge eats CPU).
- Freeze and Translate are gone: it just shares. BroCast 3 is a new app (its old signing keys are
  gone), so it installs next to BroCast 1/2 and offers to remove them.

Measured on the test rig (fake phone, anime-style clip with a 1 s fight scene every 5 s, Wi-Fi that
cuts out for 0.15-0.45 s every 1.5-3.5 s, 40 s): BroCast 2.1 stopped **22 times, 14.3 s frozen**;
BroCast 3 stops 2-4 times while it learns the Wi-Fi, under 1.3 s in total, never longer than 0.6 s.

## Install (one time)

1. Get `BroCast.apk` onto your phone (download it on the phone, or copy it over from your PC).
2. Tap it. Android asks to allow installing from that app (Chrome, Files, etc.): allow it.
3. If Play Protect says "unknown developer", tap **More details → Install anyway**. It's unknown because it's your own app, not from the Play Store.

## Use it

1. Phone and TV/PC on the **same Wi-Fi** 📶
2. Open BroCast 3 → **Start sharing** → allow it (pick **Entire screen** if Android asks).
   With sound on, Android also asks to **"record audio"**: allow it. That's Android's name for grabbing the sound apps play; the microphone is never used.
3. **PC:** open **BroCast.exe**. It finds your phone by itself (or press **T** and type the address).
   **TV:** open the **web browser** and type the address BroCast shows, like `192.168.1.23:8080`
   - Samsung TV: the **Internet** app · LG: **Web Browser** · Fire TV: **Silk**
4. Press **Full screen** (or **F** / **Enter**; on the PC also **F11** or double-click) 🍿 On a TV
   that first press also turns the sound on: browsers don't allow sound until you press something
   once. **M** mutes on the PC.

Stop from the app or from the notification.

## Good to know

- **Sound needs Android 10+.** Your phone keeps playing the sound too, so turn the phone's volume down to avoid an echo (if the TV goes quiet too, leave the phone a little louder).
- Some apps don't share their sound, and phone calls never do.
- Netflix, Disney+, banking apps etc. block screen capture, so they show black. That's them, not BroCast.
- Laggy? Pick **🔋 Saver**, or move closer to the router. **💎 Sharp** is 60 fps.
- Browsers that can't play the video (very old TVs) get pictures instead, automatically.
- On shared Wi-Fi (dorm, café), turn on **🔒 Require a PIN**.
- If the page won't load: check both devices are on the same Wi-Fi (not a "guest" network, which blocks devices from seeing each other), or try the other address the app lists.

## How it works

The app captures the screen (Android `MediaProjection`) straight into the phone's hardware H.264
encoder and runs a tiny web server on the phone. Each encoded frame becomes a small fragmented-MP4
piece, sent over a WebSocket (`/video`); the page feeds them to the browser's own video player
(Media Source Extensions). The page keeps the picture at the live edge (it jumps ahead or plays a
bit faster if it falls behind), and has watchdogs: no data while the phone is making frames ->
reconnect; data but the player stuck -> restart the player; the player failing again and again ->
pictures instead.

Timeline: every frame's start time is the previous frame's start plus its length (each frame lasts
as long as the gap before it, kept within 4-100 ms). Players never see a hole, so they never drop
frames waiting for a key frame.

On the phone, every viewer has its own queue. Frames may wait up to 1.2 s (Wi-Fi hiccups); the
longest wait steers the encoder's bitrate (`BitrateGovernor`: down 25% when frames wait 250 ms,
40% after a skip, back up 15% at a time after 3 s of calm, never below 30% of the picked quality).
Only a viewer that's still 1.2 s behind skips ahead, and then a key frame is asked for right away.
A connection whose writes stay stuck for 10 s is closed so the page reconnects.

The PC app (`pc/`, C++ on Windows' own parts only): finds phones by asking every address on its
local networks for `/status` (8080 first), reads `/video` and `/audio` like the page does, keeps
the frames compressed in a queue until just before their turn (a cushion that learns your Wi-Fi's
worst hiccup of the last minute), decodes with Media Foundation on the graphics card (DXVA, falls
back to the CPU), draws with Direct3D 11 and plays sound with WASAPI, nudging its speed by up to
2% to stay in step with the picture.

Pictures mode: while a browser that can't play the video is watching (or if the phone's encoder
doesn't work), the screen goes into JPEGs instead and the page shows them as an MJPEG stream. If a
browser can't handle MJPEG either, it switches to grabbing single frames automatically.

Browsers only allow the faster WebCodecs video API on https pages, and the phone's page is plain
http on your Wi-Fi, which is why it uses the video player (MSE) route.

Sound comes from Android's playback capture (`AudioPlaybackCapture`, Android 10+) as 20 ms chunks of 48 kHz stereo PCM over a WebSocket (`/audio`). The page plays them with Web Audio about 0.1 s behind real time, which keeps it smooth and in step with the picture.

```
core/   web server + TV page (plain Kotlin, tested on a PC)
app/    the Android app (screen capture, service, UI)
pc/     BroCast for PC (Windows app) + its tests
tools/  browser end-to-end tests + Android API checker
```

## Build & test

Needs JDK 17+ and the Android SDK (platform 36).

```bash
./gradlew :app:assembleRelease          # -> app/build/outputs/apk/release/app-release.apk
./gradlew :core:test :app:testDebugUnitTest :app:lintRelease
./gradlew :core:runDevServer --args="--port 8080"   # fake phone: open http://localhost:8080
./gradlew :core:writeTestClasspath && node tools/e2e.js   # needs Playwright
ONLY=choppy node tools/e2e.js          # just the choppy Wi-Fi + anime test
pc/build.sh && pc/build/pc_test 127.0.0.1:8080   # PC app (MinGW-w64) + its tests against a dev server
```

Release signing: put the private key at `app/brocast-release.jks` and its password in
`app/release-key.properties` (`storePassword=...`). Both are git-ignored and never go in the repo.
Every update must be signed with the same key, or Android won't install it over the old one.
Without them, release builds are signed with the debug key.
