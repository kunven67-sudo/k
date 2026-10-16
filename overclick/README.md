# OVERCLICK

A real auto clicker for Windows 10/11. It clicks your actual mouse in any game or app.

## Run it

1. Download `OVERCLICK.exe` and double-click it. Nothing to install.
2. Windows may say "Windows protected your PC" because the app isn't signed.
   Click **More info**, then **Run anyway**.

## How it works

- **F6** starts and stops it from anywhere, even inside a game (you can change the key in Settings).
- **Esc** is the emergency stop while it's clicking.
- It never clicks its own window, so the big button always works for stopping.

### Speed modes

| Mode | Speed |
| --- | --- |
| Custom | Any speed you type, up to 50 clicks/sec |
| Normal | 10 clicks/sec |
| Fast | 25 clicks/sec |
| Turbo | 50 clicks/sec |
| Insane | 100 clicks/sec |
| MAX POWER | Any speed you type: seconds, milliseconds, minutes or clicks/sec. **0 = as fast as your PC can go** |

Insane and MAX POWER show a warning the first time you pick them.

### Auto clickers

Add up to 20 auto clickers. Each one can:

- click **where your mouse is**, or a **fixed spot** (drag its numbered target on your screen, or press **Pick spot** and click where it should go)
- use the left, right or middle button, single or double click
- follow the main speed or have **its own speed**

You can also make it stop by itself after a number of clicks or an amount of time.

Settings are saved in `%APPDATA%\OVERCLICK\settings.json`.

## Build it yourself

Needs Go 1.24+. Works from Linux, macOS or Windows:

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui -s -w" -o OVERCLICK.exe .
go test ./...
```

The icon, version info and DPI manifest live in `winres/`. After changing them, run
`go-winres make --arch amd64` (from `github.com/tc-hib/go-winres`) to update `rsrc_windows_amd64.syso`.

The window is HTML (`ui/index.html`) shown with Microsoft Edge WebView2, which comes with Windows 11
and updated Windows 10. Font: Chakra Petch (SIL Open Font License, see `ui/fonts/OFL.txt`).
