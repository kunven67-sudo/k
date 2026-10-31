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
- Chat buttons (under the arrows):
  - **Save**: saves the open chat as a file that looks just like it (every picture and every folded part
    included, plus a plain-text copy) in `%LOCALAPPDATA%\ALTS\Saved chats\<account>`. Saving the same chat
    again replaces it.
  - **Continue**: saves the chat, opens a new chat on the account you pick, and puts a message plus the
    whole old chat (as a file) in the box. You press Enter.
  - **Copy** (`Ctrl+Shift+G`): copies the whole chat to paste somewhere.
  - **Saved chats**: search every saved chat, save all the chats in the list at once, open the folder, and
    optionally send saved chats to a GitHub repo you pick (uses the official GitHub CLI; ALTS sets it up).
  - **Pins**: select text in a chat and press Pin; the Pins button lists them and jumps back.
  - **Eyes** (on by default): when you start typing a message, a picture of your screen (what you were
    using before ALTS) and a grid of the last minutes go with it. Pictures are kept 10 minutes, only in
    memory, and only new ones are sent. **5s** / `Ctrl+Alt+5` records 5 seconds of screen for the next
    message.
  - **Top / Bottom**: jump to the start or end of the chat (loading the hidden parts).
  - Under the buttons: how many messages and words the chat has. Under each account: how much of this
    session's and this week's usage is used (when claude.ai shares it).
- Keys: `Ctrl+1`..`Ctrl+8` jump to an account, `Ctrl+9` the last one, `Ctrl+Tab` / `Ctrl+Shift+Tab`
  next / previous, `Alt+Left` / `Alt+Right` back / forward, `F5` reload, `Ctrl+Shift+G` copy chat, `Ctrl+Alt+5` record.
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
`win32_windows.go` (Windows calls), `ui/index.html` (the side list), `ui/grab.js` (Copy), `ui/page.js`
(the helper inside claude.ai pages), `page_windows.go` + `chats.go` (saving, search, Continue, GitHub),
`eyes.go` + `eyes_windows.go` (Eyes).
