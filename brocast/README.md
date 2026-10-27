# 📡 BroCast 2

Show your Android phone's screen **with sound** on any TV or PC with a web browser. Same Wi-Fi, no cables, and no app needed on the TV.

**New in 2.0:** the picture goes out as real video (H.264 from the phone's video chip) instead of one
photo per frame. That's about 5-10x less Wi-Fi, so videos and anime don't freeze anymore. If the
picture ever does get stuck, the TV/PC page notices within a few seconds and reconnects by itself.
2.0 installs as a separate app ("BroCast 2"); it offers to remove the old one.

## Install (one time)

1. Get `BroCast.apk` onto your phone (download it on the phone, or copy it over from your PC).
2. Tap it. Android asks to allow installing from that app (Chrome, Files, etc.): allow it.
3. If Play Protect says "unknown developer", tap **More details → Install anyway**. It's unknown because it's your own app, not from the Play Store.

## Use it

1. Phone and TV/PC on the **same Wi-Fi** 📶
2. Open BroCast → **Start sharing** → allow it (pick **Entire screen** if Android asks).
   With sound on, Android also asks to **"record audio"**: allow it. That's Android's name for grabbing the sound apps play; the microphone is never used.
3. On the TV/PC, open the **web browser** and type the address BroCast shows, like `192.168.1.23:8080`
   - Samsung TV: the **Internet** app · LG: **Web Browser** · Fire TV: **Silk** · PC: any browser
4. Press **Full screen** (or press **F** / **Enter**) 🍿 That first press/click also turns the sound on: browsers don't allow sound until you click or press something once.

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

On the phone, every viewer has its own short queue. A viewer whose Wi-Fi can't keep up skips to
the next key frame instead of falling behind, and a connection whose writes stay stuck for 10 s is
closed so the page reconnects.

Pictures mode: while a browser that can't play the video is watching (or if the phone's encoder
doesn't work), the screen goes into JPEGs instead and the page shows them as an MJPEG stream. If a
browser can't handle MJPEG either, it switches to grabbing single frames automatically.

Browsers only allow the faster WebCodecs video API on https pages, and the phone's page is plain
http on your Wi-Fi, which is why it uses the video player (MSE) route.

Sound comes from Android's playback capture (`AudioPlaybackCapture`, Android 10+) as 20 ms chunks of 48 kHz stereo PCM over a WebSocket (`/audio`). The page plays them with Web Audio about 0.1 s behind real time, which keeps it smooth and in step with the picture.

```
core/   web server + TV page (plain Kotlin, tested on a PC)
app/    the Android app (screen capture, service, UI)
tools/  browser end-to-end tests + Android API checker
```

## Build & test

Needs JDK 17+ and the Android SDK (platform 36).

```bash
./gradlew :app:assembleRelease          # -> app/build/outputs/apk/release/app-release.apk
./gradlew :core:test :app:testDebugUnitTest :app:lintRelease
./gradlew :core:runDevServer --args="--port 8080"   # fake phone: open http://localhost:8080
./gradlew :core:writeTestClasspath && node tools/e2e.js   # needs Playwright
```

Release signing: put the private key at `app/brocast-release.jks` and its password in
`app/release-key.properties` (`storePassword=...`). Both are git-ignored and never go in the repo.
Every update must be signed with the same key, or Android won't install it over the old one.
Without them, release builds are signed with the debug key.
