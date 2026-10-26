# 📡 BroCast

Show your Android phone's screen **with sound** on any TV or PC with a web browser. Same Wi-Fi, no cables, and no app needed on the TV.

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
- Laggy? Pick **🔋 Saver**, or move closer to the router.
- On shared Wi-Fi (dorm, café), turn on **🔒 Require a PIN**.
- If the page won't load: check both devices are on the same Wi-Fi (not a "guest" network, which blocks devices from seeing each other), or try the other address the app lists.

## How it works

The app captures the screen (Android `MediaProjection`), turns frames into JPEGs, and runs a tiny web server on the phone. The TV's browser shows them as an MJPEG stream. If a browser can't handle MJPEG, it switches to grabbing single frames automatically.

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

The release signing key (`app/brocast-release.jks`) is in the repo on purpose, so every rebuild can update the installed app. Don't reuse it for anything else.
