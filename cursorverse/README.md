# 🖱️ CursorVerse

A Windows app that changes your cursor everywhere, adds trails and click effects, plays sounds when you type, lets you click with your voice, plays music, and has its own browser with custom backgrounds.

## ✨ What's inside

| | |
|---|---|
| 🖱️ **100 cursors** | Gaming/neon, weapons/fantasy, cute/animals/food and pixel/retro. Lots of them are animated. |
| 🎨 **Customizer** | Tint, rainbow, hue, glow, outline, size, and animations (pulse, spin, bounce, wobble, swing, float, shake, flicker). |
| ✏️ **Pixel editor** | Draw your own cursor frame by frame, start from any built-in one, or upload a PNG/GIF (GIFs become animated cursors). |
| ✨ **Effects** | 16 trails, 12 click effects and 8 "you stopped moving" effects, drawn over every app. |
| 🔊 **Typing sounds** | 20 packs: mechanical, typewriter, 8-bit and funny (yes, a duck). You can also add your own sounds. |
| 🎤 **Voice control** | Say "click", "right click", "click P", "click papa", "click enter", "click copy" and more, or make your own ("click gg"). You set the delay (ms / seconds / minutes), and it can ask "Did you say P?" and wait for yes or no. Normal talking is ignored, and it pauses while another app (Discord, voice typing) uses the mic. It works offline with Windows speech. |
| 🎵 **Music** | 12 original songs made live by the app (lofi, 8-bit, synthwave, ambient/rain), plus your own MP3s. |
| 🌐 **Browser** | Tabs, speed dial, history, an ad blocker, and animated/picture/video backgrounds with blur and dim. |
| 🎯 **Pick your apps** | Run everything on your whole PC, or only in the apps you choose. |
| 💾 **Presets** | Gaming, Chill, Fantasy, Retro, Cute and Chaos modes, plus your own saved presets and a 🎲 random button. |
| ⚙️ **Extras** | Three themes (Dark Neon, Glassy, Pixel Retro), hotkeys, start with Windows, and a tray icon. |

## 🔄 Updating

⚙️ Settings → **Updates** → **Update now**. CursorVerse downloads the new version from this repo's Releases, checks its SHA-256, swaps it in and restarts. All your settings, cursors and files stay. A glowing **⬆ Update** button also shows up at the top when a new version is out.

## ❓ Help

Every page has a **❓ What does this do?** button. The **❓ Help** page has "How do I...?" answers and a search box, and there's a guided tour on first launch (replay it from Help or Settings).

## 📦 Getting the .exe

Every push builds a portable **`CursorVerse-x.y.z-Portable.exe`** on GitHub:

- **Releases** (right side of the repo page) → newest `CursorVerse x.y.z` → download the `.exe`
- or **Actions** tab → *CursorVerse Windows build* → latest run → **Artifacts** → `CursorVerse-Portable`

Double-click the exe and it runs. There's no installer. The first launch takes a few seconds while it unpacks.

> Windows SmartScreen may say "Windows protected your PC" because the exe isn't code-signed. Click **More info → Run anyway**.

## ⌨️ Default hotkeys

| Keys | Does |
|---|---|
| Ctrl+Alt+C | Cursor on/off |
| Ctrl+Alt+E | Effects on/off |
| Ctrl+Alt+S | Typing sounds on/off |
| Ctrl+Alt+V | Voice control on/off |
| Ctrl+Alt+M | Play / pause music |
| Ctrl+Alt+N | Next song |
| Ctrl+Alt+R | Random combo |
| Ctrl+Alt+O | Open CursorVerse |

You can change all of them in ⚙️ Settings. They use Ctrl+Alt because Ctrl+Shift+S/R/N/C already mean Save As, hard reload, incognito and inspect in lots of apps.

## 🔒 Privacy

- Typing sounds only react to the fact that *a* key was pressed. Keystrokes are never saved or sent.
- Voice control uses Windows' built-in offline recognizer, listening only for the command list. Audio never leaves your PC.
- If the app ever crashes, your normal cursor comes back on the next launch. The tray menu also has a **Put normal cursor back** option.

## 🛠️ For developers

```bash
cd cursorverse
npm install
npm start          # run it
npm test           # unit tests (cursor files, voice commands, URL bar)
npm run dist       # build the portable exe (Windows native modules needed)
```

Layout:

- `src/main`: Electron main process (settings, tray, hotkeys, cursor swapping via koffi, effects overlay, voice)
- `src/renderer/ui`: the app window; `engine`: hidden window for sounds, music and cursor building; `overlay`: effects and voice bubble
- `src/shared`: cursor library, `.cur`/`.ani` encoder, effects, backgrounds, sound packs, music, voice commands
