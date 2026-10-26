# ALTS

A tiny Windows app that keeps a bunch of Claude accounts logged in at the same time, in one window.

Opening a new browser window always shows the same Claude account, because the window shares its
login with the rest of the browser. ALTS gives every account its **own separate login folder**, so
each one stays logged in on its own.

- Accounts sit in a list on the left. Click one to switch; the others stay logged in behind it.
- **+ Add**: make a new account slot, then log in to Claude in it (use a different email for each).
- Right-click an account (or its `...` button) to rename it, change its color, move it, put it to
  sleep (closes it to free memory, stays logged in) or delete it (wipes its saved login from this PC,
  the Claude account itself is not touched).
- Keys: `Ctrl+1`..`Ctrl+8` jump to an account, `Ctrl+9` the last one, `Ctrl+Tab` / `Ctrl+Shift+Tab`
  next / previous, `Alt+Left` / `Alt+Right` back / forward, `F5` reload.
- Links to other websites open in your normal browser. Claude, Google / Apple login, payments and
  connecting GitHub stay inside the account they belong to.
- Remembers the window size and the last account you used.

## Run it

Double-click `ALTS.exe`. Windows 10 or 11. It uses Microsoft Edge WebView2, which is already on
almost every PC (if it's missing, ALTS offers the download page).

Everything is saved in `%LOCALAPPDATA%\ALTS`: `alts.json` (the list) and `accounts\<id>\` (one login
folder per account).

## Build it yourself

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui -s -w" -o ALTS.exe .
go test ./...
```

The icon, version info and DPI manifest live in `winres/`. After changing them, run
`go-winres make --arch amd64` (from `github.com/tc-hib/go-winres`) to update `rsrc_windows_amd64.syso`.

Code: `accounts.go` (the account list, tested), `main_windows.go` (window + one WebView2 per account),
`win32_windows.go` (Windows calls), `ui/index.html` (the side list).
