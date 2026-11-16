# SOUNDGUARD

Windows app that keeps headphones and a mic working. It runs in the background from logon
(a scheduled task with admin rights, so it can restart the Windows Audio service without asking)
and fixes things live:

- sound or mic muted, volume at zero -> unmute / turn up (and leave it alone if you mute it again)
- headphones plugged in -> sound + calls go to them; USB headset adapters too
- calls going to another device (a TV) -> moved to the headphones
- Stereo Mix picked as the mic -> switched to the real mic
- Realtek says the mic is "unplugged" while headphones are in -> "push the plug all the way in" notification
- sound frozen (apps play, the device clock doesn't move) -> restart the Windows Audio service (2 s blip)
- driver really stuck -> a small popup "restart when you're done", never restarts by itself, waits while a full screen game runs

The frozen check plays silence and watches the device clock (WASAPI), so nobody hears anything.

## Build

    go-winres make --in winres/winres.json --arch amd64 --out rsrc   # only when icons/manifest change
    GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui" -o SoundGuard.exe .

## Test

    go test ./...                      # the brain, with a pretend PC
    go build -o sgdemo . && SG_BIN=./sgdemo node tests/shots.js out 1   # window previews (Linux)
    SoundGuard.exe -selftest out.json  # real Windows run (CI: .github/workflows/soundguard.yml)
