# BroCast for PC

Watch your phone's BroCast 3 screen on a Windows 10/11 PC, without a browser.

- Open `BroCast.exe`. It finds your phone on the Wi-Fi by itself (same Wi-Fi, phone sharing).
  Two phones sharing? It asks which. Not found? Press **T** and type the address the phone shows.
- **F**, **F11**, **Enter** or double-click: full screen. **Esc**: leave it. **M**: sound on/off.
- PIN on the phone? It asks for it once per start.
- Windows may say "Windows protected your PC" the first time (it's not from the Store):
  **More info -> Run anyway**.

Built only on Windows' own parts, so it's one small file: Media Foundation decodes the H.264 on
the graphics card (DXVA; the CPU if that ever fails), Direct3D 11 draws it, WASAPI plays the sound.
The frames wait compressed until just before their turn (a cushion that grows on choppy Wi-Fi and
shrinks back when it's calm), and the sound waits as long as the picture so mouths match.

Log: `%LOCALAPPDATA%\BroCast\pc.log` (what it found, decoder, a stats line a minute).
Settings: `%APPDATA%\BroCast\pc-settings.txt` (the last phone, muted or not).

## Build and test

```bash
apt install g++-mingw-w64-x86-64
./build.sh                       # -> build/BroCast.exe (+ build/pc_test, the Linux tests)
build/pc_test                    # unit checks
build/pc_test 127.0.0.1:8080 127.0.0.1:8081 out.h264   # + live checks against dev servers (8081 with --pin 4821)
```

Start dev servers with `./gradlew :core:writeTestClasspath` and
`java -cp "$(cat core/build/test-classpath.txt)" com.brocast.core.DevServerKt --port 8080 --video`.
The whole app also runs under Wine (CPU decoding there), which is how it was tested here.

```
src/net.*      sockets, HTTP, WebSocket client, LAN scan        (portable, tested on Linux)
src/fmp4.*     the phone's fragmented MP4 + H.264 SPS reading    (portable)
src/sync.*     when to show each frame, how long sound waits     (portable)
src/app.cpp    window, screens, threads
src/decoder.*  Media Foundation H.264
src/gfx.*      Direct3D 11 + the menus' canvas
src/audio.*    WASAPI
```
