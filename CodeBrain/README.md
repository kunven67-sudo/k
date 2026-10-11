# 🧠 CodeBrain

Your own AI coding coach that runs **100% on your PC**.
No API key, no account, no internet needed after setup. 💚

It only does one thing, **coding**, and it's built to teach you how to make games:
2D, 3D, first-person, and even 4D 🤯.

---

## 🚀 How to start (Windows 11)

1. Download this folder (green **Code** button on GitHub → **Download ZIP**, then unzip it).
2. Open the `CodeBrain` folder and **double-click `SETUP.bat`**.
   - It installs Python, Ollama (the brain engine), pygame + ursina (game stuff),
     and the coding brain itself.
   - The brain is a big download (~9 GB) but **only once**. Grab a snack 🍕
3. Done! Double-click **CodeBrain** on your Desktop.

| File | What it does |
|---|---|
| `SETUP.bat` | Installs everything (run it once) |
| `CodeBrain.bat` | Opens the window app 🪟 |
| `CodeBrain-Terminal.bat` | Hacker terminal mode 💻 |

> If Windows shows a blue "Windows protected your PC" box, click **More info → Run anyway**.
> That shows up for any `.bat` file downloaded from the internet.

---

## 🧠 The brain

CodeBrain uses **Qwen2.5-Coder**, a free coding AI that runs on your graphics card through
[Ollama](https://ollama.com). Setup picks the smartest size your card can handle:

| Your graphics card memory | Brain |
|---|---|
| 24 GB+ | `qwen2.5-coder:32b` (BIG brain 🔥) |
| 12-16 GB | `qwen2.5-coder:14b` ← you |
| 8 GB | `qwen2.5-coder:7b` |
| less | `qwen2.5-coder:3b` |

You can switch brains anytime in ⚙️ Settings. A new one downloads automatically.

**Real talk:** it's smart at coding, but it's not as smart as the giant AIs in the cloud.
It can still make mistakes, and that's why it has ▶️ Run and 🐛 Bug Detective: you test
everything, and it learns from what breaks.

---

## ✨ What it can do

- 💬 **Chat**: "how do I make a window?", "make me a 2D platformer", "why is my zombie not moving?"
  It sees the code in your editor, so you can just ask "what's wrong with my code?"
- ▶️ **Run (F5)**: tests your code. It **only runs when you press it**, never by itself.
  If your program asks a question with `input()`, type the answer in the box under Output.
- 🐛 **Bug Detective**: when your code crashes, the line turns red. Press Bug Detective and it
  explains what went wrong in simple words, then gives you fixed code.
- 🔍 **Explain**: highlight any code (or nothing = the whole file) and it explains it piece by piece.
- 📥 **Put this code in the editor**: one click puts the AI's code into your file (Ctrl+Z to undo).
- 📚 **Lessons**: Python basics → 2D windows → how 3D works → a spinning **4D cube** → your zombie game guide.
- 🧠 **Memory** (it learns!):
  - **About you**: say "my name is…" or "I like…" and it remembers.
  - **Bug lessons**: every bug it fixes gets saved. When the fix works, it's marked ✅ and it
    won't make that mistake again.
  - **Projects**: it knows the files in your projects folder and your game plans.
  - **Notes**: start a message with "remember …" and it's saved forever.
  - Open 🧠 Memory to see everything and delete anything.
- ⭐ **XP + levels**: earn XP for running code, fixing bugs and finishing lessons.
  You go from Code Baby 👶 all the way to Code Legend 🏆.

Your stuff lives in a **CodeBrain folder on your Desktop**:
`projects/` (your code) and `brain/` (memories, XP, settings).

---

## 🧟 Your zombie game

The **Build Your Zombie Game** lessons walk you through *Graveyard Zombies*, the 3D first-person
shooter you designed. There's a graveyard at night, zombies with glowing eyes, a laser + sword,
a boss every 5 waves, an upgrade shop, a minimap and more.
There's **no finished game code in here on purpose**: you build it yourself, step by step,
and CodeBrain coaches you. 💪

---

## ⌨️ Shortcuts

| Key | Does |
|---|---|
| F5 | Run |
| Ctrl+S / Ctrl+O / Ctrl+N | Save / Open / New |
| Enter / Shift+Enter | Send chat / new line |
| Tab / Shift+Tab | Indent / un-indent |
| Ctrl+= / Ctrl+- | Bigger / smaller text |

Terminal mode: type `/help`.

---

## 🛠️ Problems?

- **"Brain offline"**: open **Ollama** from the Start menu, then restart CodeBrain. Or run `SETUP.bat` again.
- **Slow answers**: the first answer is slow while the brain loads into your graphics card
  (~10-30 seconds). After that it's fast. Try the `7b` brain in ⚙️ Settings if it's always slow.
- **Something broke**: run `SETUP.bat` again. It's safe and only fixes what's missing.

For developers: `python -m unittest discover -s tests` runs the tests.
