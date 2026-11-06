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
  - **Tasks**: Claude's to-do list (doing / next / done). It lives in Claude's memory on GitHub, so it stays
    when a chat stops; it refreshes every minute while open.
  - **Top / Bottom**: jump to the start or end of the chat (loading the hidden parts).
  - **Files**: every file Claude sent you that you downloaded in ALTS (see *Claude's files* below).
  - Under the buttons: how many messages and words the chat has. Under each account: how much of this
    session's and this week's usage is used (when claude.ai shares it). ALTS also writes that to
    `%LOCALAPPDATA%\ALTS\usage.json`, where the LINK tray app picks it up so Claude can pace itself.
- Keys: `Ctrl+1`..`Ctrl+8` jump to an account, `Ctrl+9` the last one, `Ctrl+Tab` / `Ctrl+Shift+Tab`
  next / previous, `Alt+Left` / `Alt+Right` back / forward, `F5` reload, `Ctrl+Shift+G` copy chat.
- Links to other websites open in your normal browser.

## ALTS Clipboard (Win+V)

Windows' own clipboard history is replaced by ALTS Clipboard. It runs on its own in the background
(`ALTS.exe --clip`, starts with Windows, keeps working after ALTS closes) and press **Win+V** anywhere:

- **Clipboard**: everything you copied, text and pictures, newest first. Click one (or arrow keys + Enter)
  and it pastes right into the app you were in. Star = pin (kept forever), x = delete. Keeps the last 200
  (40 pictures). Password apps that say "don't keep this" are skipped.
- **Stickers**: funny 3D stickers (Microsoft's Fluent Emoji 3D, MIT license) that paste as pictures,
  plus your own: copy any picture, open Win+V, press the smiley on it.
- **Emoji**: every emoji with search ("skull", "fire"...), recent ones on top.
- Gear: start with Windows on/off, "Copy not working? Check it" (names the app that's holding the clipboard
  open, which is what breaks copying), clear history, turn it off.
- Lives in `%LOCALAPPDATA%\ALTS\clip`. `get-stickers.sh` re-downloads the starter stickers + emoji list.

## In the chat box (1.5.0)

Left of the chat box: **emoji + stickers**, **Send later** (saves what you typed; when your usage limit is
back ALTS makes a sound, pops up and shows them with a Send button), **Fresh chat** (Claude writes a handoff,
then a new chat starts that already knows what you were doing). Above it: **quick buttons** for things you
say a lot (+ adds one, right-click removes). A warning shows when a chat gets so long that every message
costs a lot more usage. Common typos get fixed as you type (Ctrl+Z undoes it), and misspelled words get
the red line + right-click fixes. The gear at the bottom of the side list switches ALTS's look.

**Files panel Download** (Claude Code chats): claude.ai's Files panel only shows pictures and text. Click any
file there (an .exe, .zip...) and ALTS adds a **Download** button. The very first time, open any picture in that
list once: ALTS watches how claude.ai loads it and then gets any file the same way, into Downloads with no
Windows warning. What it learned and each download is noted in `files.log`.

## Claude's files (no "this could harm your PC" warnings)

Windows marks every download as "from the internet". That mark is what makes it warn: Edge's "this
file could harm your device", the blue "Windows protected your PC" box, the "Open File - Security
Warning" box. ALTS takes that mark off **only** for files that come from Claude inside ALTS:

- A download counts as Claude's when the account is on claude.ai and the file comes from Claude's own
  sites (claude.ai, anthropic.com, Claude's preview sandbox) or is made by the claude.ai page itself.
- Those go to your normal `Downloads` folder, and the moment they finish ALTS removes the mark, so they open
  like a file you made yourself. WebView2's own download check is off in ALTS's accounts only; Edge and
  the rest of Windows keep theirs.
- ALTS keeps each file's SHA-256 fingerprint. When you open one from **Files** and it isn't exactly what
  Claude sent anymore, ALTS puts the mark back first, so Windows checks it like any other file.
- Downloads from anywhere else keep the mark and go where WebView2 always puts them.
- Windows Security's real virus scan still runs on everything. ALTS never turns it off.
- **Fix my old Claude files** looks in Downloads and on the Desktop for files you got from Claude before
  (going by Windows' own note of where each download came from) and takes the mark off those too, plus
  files that came out of those zips. Nothing else is touched. OneDrive files that aren't on the PC are skipped.
- The list lives in `%LOCALAPPDATA%\ALTS\files.json`; every download decision is noted in `files.log`. Claude, Google / Apple login, payments and
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
`tasks.go` (the Tasks list), `files.go` (which files are Claude's, the list, tested) +
`files_windows.go` (the download hook and the Files box).
