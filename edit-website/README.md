# Edit Website

Edit any website live, right in your browser. You can:

- see its code
- change its background
- add effects, buttons and your own stuff
- make things do stuff when they're clicked

Only you see the changes, and they come back the next time you open the page.

## Get it

Open **`edit-website.html`**. It has two ways to use the editor, plus a fake shop to practice on.

### 1. Bookmark button (Chrome / Edge)

1. Show the bookmarks bar: `Ctrl + Shift + B`
2. Drag the green **Edit Website** button onto the bar.
3. Go to any website and click the bookmark. Click it again to hide the editor.

### 2. Chrome extension (works on the strictest sites)

1. Unzip `edit-website-extension.zip`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `edit-website-extension` folder.
4. Pin it. Click the icon or press `Alt + Shift + E` on any site.

Optional settings in the extension's **Details** page:
- **Allow User Scripts**: your own JavaScript runs on every site.
- **Allow access to file URLs**: you can edit `.html` files on your PC.

## What's in the editor

| Tab | What it does |
| --- | --- |
| **Pick** | Click anything on the page. You can: <br>• edit its words, delete it, copy it or hide it <br>• move it (green square) and resize it (corner) <br>• change colors, borders, text size, zoom, spin, round corners and fonts <br>• swap its picture or give it a glow <br>• make it do stuff when it's clicked |
| **Code** | The page's code as a tree, like Inspect. Click a line to find it on the page. Type in the code box and the page changes as you type. There's a search box too. |
| **Background** | Colors, gradients, your own picture/GIF/video, or 12 animated backgrounds. Darken, blur, see-through and text-glow sliders keep the words readable. |
| **Effects** | Gravity (throw stuff around), snow, rain, confetti, rainbow, night vision, upside down, earthquake, dance party with music, Comic Sans, click fireworks and more. |
| **Add** | Add your own text, buttons, pictures, videos, popups, sticky notes, links, shapes and news tickers. You can also replace every word or every picture on the page. |
| **CSS / JS** | Write your own styles (they apply while you type) and JavaScript (with Run and output). |
| **Save** | Auto-save, history, backups, and **Download edited site**. That makes one `.html` file that works offline; press `Alt+Shift+E` inside it to keep editing. |

Keys: `Ctrl+Z` undo, `Ctrl+Y` redo, `Del` delete, arrows nudge (hold `Shift` for 10px), `Esc` stop.

## How it handles strict sites

Sites like YouTube, Google and GitHub block a lot of the usual tricks (Content Security Policy and Trusted Types). The editor works around them:

- It builds its own buttons and boxes piece by piece, without `innerHTML`.
- If a site blocks `innerHTML`, it turns your code into page elements with its own small HTML parser.
- Its styles use `adoptedStyleSheets` and inline styles, which these sites can't block.
- If a site blocks `data:` pictures, it draws them on a canvas instead.
- Its sounds are made with the Web Audio API, so they can't be blocked either.

The extension runs your JavaScript through Chrome's user-scripts API, so even strict sites can't block that.

## For developers

```
npm install
npm run build   # src/ -> edit-website.html, extension/, edit-website-extension.zip
npm test        # Chromium tests: normal page, closed editor, CSP + Trusted Types page, extension
```

- The source is in `src/core/`. The files are joined in name order into one function.
- `src/install.html` is the template for the page with the bookmark button.
- `src/extension/` has the manifest and the extension's background script.
