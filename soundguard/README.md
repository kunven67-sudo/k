# SoundGuard

Keeps headphones and a mic working on Windows, by itself.

- Runs in the background (tray icon), starts with Windows (one-time Yes on first open).
- Every second: picks the headphones + mic (USB headset first), unmutes them, puts volume back,
  keeps them as the default device (games, apps and calls), turns them back on if Windows turned them off,
  starts Windows Audio if it stopped, allows the mic again if privacy blocks it.
- Silent sound-engine check: opens a silent stream and checks Windows really pulls sound out of it.
  Stuck = restart Windows Audio (2 second blip). Still stuck = asks you to restart the PC when you're done.
  Never restarts the PC or touches games by itself.
- Window: live headphone + mic meters, test sound (left/right), what's playing, activity log.

Build: `GOOS=windows go build -trimpath -ldflags "-H windowsgui -s -w" -o SoundGuard.exe .`
Resources: `go-winres make --in winres.json --arch amd64` (icon/make.js renders the icons).
Linux UI test with a pretend PC: `go run . 18777` (POST /api/fake breaks things on purpose).
Windows test: `SoundGuard.exe -selftest out.json` (CI: .github/workflows/soundguard.yml).
