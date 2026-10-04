# ⌨️ Keyboard AI

Claude types for you, right into whatever window you click: Notepad, Google Docs, Word, a chat box, anything.

Tell it *"tell me everything about Earth"* and it writes a section, then keeps going deeper and deeper, section after section, until it has covered everything (or you stop it).

## Setup (one time)

1. Install Python 3.10+ from https://python.org
2. Get an API key at https://console.anthropic.com and set it:
   - Windows: `setx ANTHROPIC_API_KEY "your-key-here"` (then open a new terminal)
   - Mac/Linux: `export ANTHROPIC_API_KEY="your-key-here"`
3. Install the libraries:
   ```
   pip install -r requirements.txt
   ```

## Use it

```
python keyboard_ai.py "tell me everything about Earth"
```

You get 5 seconds to click into the window you want it to type in. Then it starts typing.

**Press ESC any time to stop it.** 🛑

## Options

| Option | What it does |
| --- | --- |
| `--rounds 10` | Stop after 10 sections (default: no limit, it keeps going until it's done) |
| `--delay 0.03` | Type slower (seconds between keys) |
| `--countdown 10` | More time to click into the window |
| `--newline shift-enter` | For chat apps where Enter would send the message |

## Notes

- Mac: allow your terminal under System Settings → Privacy & Security → **Accessibility** and **Input Monitoring**, or it can't type.
- Each section costs a little API money, and "no limit" mode can write a lot. Use `--rounds` if you want a cap.
