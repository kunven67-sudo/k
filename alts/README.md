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

## ALTS Clipboard (Win+V or Ctrl+Alt+V)

`ALTS-Clip.exe` is its own small app: keep it in the same folder as `ALTS.exe` (ALTS starts it), it
starts with Windows and keeps working after ALTS closes. It asks Windows for **Win+V** the normal way
(no keyboard watching); if Windows keeps Win+V for itself it uses **Ctrl+Alt+V** and says so once.

- **Clipboard**: everything you copied, text and pictures, newest first. Click one (or arrow keys + Enter)
  and it pastes right into the app you were in. Star = pin (kept forever), x = delete. Keeps the last 200
  (40 pictures). Password apps that say "don't keep this" are skipped.
- **Stickers**: meme pictures (the 100 most popular ones on imgflip.com, which ALTS Clipboard downloads onto
  your PC the first time and freshens every few days; nothing is shipped inside the app), plus your own: copy any
  picture, open the Clipboard, press the smiley on it. Click one and it pastes as a picture.
- **Emoji**: every emoji with search ("skull", "fire"...), recent ones on top.
- Gear: start with Windows on/off, "Copy not working? Check it" (names the app that's holding the clipboard
  open, which is what breaks copying), clear history, turn it off.
- Lives in `%LOCALAPPDATA%\ALTS\clip`. `get-emoji.sh` rebuilds the emoji list.

## In the chat box (1.5.0)

Left of the chat box: **emoji + stickers**, **quick buttons** (the lightning button: things you say a lot,
one click sends them; + adds one, x removes one), **Send later** (saves what you typed; when your usage limit
is back ALTS makes a sound, pops up and shows them with a Send button), **Fresh chat** (Claude writes a
handoff, then a new chat starts that already knows what you were doing). Nothing sits over claude.ai's own
buttons. A note shows when a chat gets so long that every message costs a lot more usage. Common typos get
fixed as you type (Ctrl+Z undoes it), and misspelled words get the red line + right-click fixes. The gear at
the bottom of the side list switches ALTS's look.

**Stickers (1.7.0)**, in the chat-box picker and in Win+V: star any sticker (⭐) and it shows first, in both places.
**+ Your pics** turns any picture on your PC into a sticker. **GIPHY**: add a free key (the picker's "Add GIPHY key"
button says how) and searching finds stickers for anything; click one to send it, ⬇ to keep it with your stickers
(Win+V pastes a kept one as a still picture: the clipboard can't hold a moving one). Kept ones live in
`%LOCALAPPDATA%\ALTS\clip\giphy`, favorites in `clip\favs.json`. Same features as ALTS for phone 2.0.

**Download links**: click a link in a chat to a file on GitHub (an .exe, .zip, .apk... raw, blob or release
link) and ALTS downloads it into your Downloads folder itself, with a progress note, instead of opening Edge.
Files from a GitHub account you said is yours (it asks once) open with no Windows warning; from anywhere else
Windows checks them like any download. A private repo works when the GitHub CLI on this PC is signed in.

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

## ALTS for phone 2.0 (`android/`)

The PC app on your phone, same look and the same mods (it runs the same `ui/page.js` + `ui/extras.js`):

- **Accounts** like the PC side list, each with its own login (Android WebView profiles). Tap the pill at
  the top for the ALTS sheet: switch, **+ Add**, hold one to rename/remove. Each account's usage bars stay.
- **Stickers** (the picture button above the chat box, or the sheet): the 100 most popular meme pictures
  are built in (work offline, freshened from imgflip every 3 days), plus **your own pics** (+ Your pics),
  plus **GIPHY search** once you paste a free key in Settings. Star any sticker: favorites sit first and
  have their own tab. Tap = it goes into the chat as a picture. No emoji tab and no clipboard on purpose
  (the phone keyboard has those).
- **Save this chat** (kept inside ALTS, searchable even offline, plus a copy in `Download/ALTS`),
  **Saved chats** with search, **Continue on** another account, **Send later** (a phone notification when
  your limit resets), **Fresh chat**, quick buttons, Top/Bottom, message + word counter.
- Safety: only ALTS's own script on claude.ai can use the app's bridge (a new key every start). Artifacts
  and other pages can't read your saved chats or touch your accounts.
- It's a separate app from ALTS 1.x (that one's signing key is gone): install it, sign in, then the sheet
  offers to remove the old one.

Build: `ANDROID_HOME=... KEYSTORE=... android/build.sh` (no Android Studio; the first run downloads
androidx.webkit and the meme pack into `android/build-cache/`). Tests: `android/test/StoreTest.java` (the
logic, on a normal computer with org.json) and `node android/test/phone_ui.js` (the real page code in a
phone-sized Chromium on a fake claude.ai, every button).

## Run it

Double-click `ALTS.exe`. Windows 10 or 11. It uses Microsoft Edge WebView2, which is already on
almost every PC (if it's missing, ALTS offers the download page).

Everything is saved in `%LOCALAPPDATA%\ALTS`: `alts.json` (the list) and `accounts\<id>\` (one login
folder per account).

## Build it yourself

```
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui -s -w" -o ALTS.exe .
GOOS=windows GOARCH=amd64 go build -tags clip -trimpath -ldflags "-H windowsgui -s -w" -o ALTS-Clip.exe .
go test ./...
```

The icon, version info and DPI manifest live in `winres/`. After changing them, run
`go-winres make --arch amd64` (from `github.com/tc-hib/go-winres`) to update `rsrc_windows_amd64.syso`.

Code: `accounts.go` (the account list, tested), `main_windows.go` (window + one WebView2 per account),
`win32_windows.go` (Windows calls), `ui/index.html` (the side list), `ui/grab.js` (Copy), `ui/page.js`
(the helper inside claude.ai pages), `page_windows.go` + `chats.go` (saving, search, Continue, GitHub),
`tasks.go` (the Tasks list), `files.go` (which files are Claude's, the list, tested) +
`files_windows.go` (the download hook and the Files box).
