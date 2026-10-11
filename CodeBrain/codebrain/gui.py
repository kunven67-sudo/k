"""CodeBrain 🧠 window app: chat on the left, code editor + output on the right. Dark + green."""

import base64
import queue
import sys
import threading
import time
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk

from codebrain import lessons as L
from codebrain.assistant import Assistant
from codebrain.codeblocks import best_code
from codebrain import project as P
from codebrain.config import MODEL_BY_VRAM
from codebrain.highlight import IndexMapper, spans
from codebrain.memory import CATEGORIES
from codebrain.paths import home_dir, projects_dir
from codebrain.runner import CodeRun, error_line_number, python_exe
from codebrain.snippets import CATEGORIES as SNIPPET_CATEGORIES
from codebrain.snippets import Snippets, snippet_part
from codebrain.voice import PushToTalk, Speaker, missing_parts

ASSETS = Path(__file__).with_name("assets")

# ---------- theme: dark + green 💚 ----------
BG = "#0b0f0c"
PANEL = "#111813"
PANEL2 = "#16201a"
BORDER = "#1f3326"
GREEN = "#39ff88"
GREEN_DIM = "#1f9d55"
TEXT = "#d8ffe6"
MUTED = "#7f9a88"
RED = "#ff5f5f"
YELLOW = "#ffd75e"
BLUE = "#6cc4ff"
PURPLE = "#c792ea"
ORANGE = "#ffab5e"

IS_WIN = sys.platform == "win32"
MONO = "Consolas" if IS_WIN else "DejaVu Sans Mono"
UI = "Segoe UI" if IS_WIN else "DejaVu Sans"

WELCOME = """Hey! I'm CodeBrain 🧠, your coding coach. I run 100% on your PC, so there's no API key and no internet needed.

Here's what I can do:
• 💬 Ask me anything about coding: "how do I make a window?", "make a 2D platformer"
• ▶️ Press Run (F5) to test your code. I only run code when YOU press it.
• 🐛 Code crashed? Press Bug Detective and I'll explain + fix it
• 🔍 Select some code and press Explain
• 📸 Game looks weird? Run it, then press Look and I'll SEE it and help fix it
• 📚 Open Lessons to learn step by step. Your zombie game + 4D maze guides are in there too 🧟🌀
• 📦 Snippets = ready-made game code (jump, sprint, shooting...) you can drop in
• 🎤 Hold the mic button (or F2) and talk to me. 🔊 I can read my answers out loud too
• 🧠 I remember you, your projects and every bug we fixed

Let's build something 🔥"""


class CodeBrainApp:
    def __init__(self, root):
        self.root = root
        self.ai = Assistant()
        self.ui_queue = queue.Queue()
        self.current_path = None
        self.run = None
        self.last_result = None
        self.thinking = False
        self.cancel_thinking = False
        self.font_size = int(self.ai.config.get("font_size", 12))
        self.run_from_editor = True
        self.snippets = Snippets()
        self.speaker = Speaker()
        self.voice_missing = missing_parts()
        self.ptt = None if self.voice_missing else PushToTalk(self.ai.config.get("voice_model", "base.en"))
        self._ptt_release_job = None

        root.title("CodeBrain 🧠")
        try:
            self._icon = tk.PhotoImage(file=str(ASSETS / "codebrain.png"))
            root.iconphoto(True, self._icon)
            if IS_WIN:
                root.iconbitmap(default=str(ASSETS / "codebrain.ico"))
        except tk.TclError:
            pass
        root.geometry("1400x860")
        root.minsize(900, 560)
        root.configure(bg=BG)
        self._style()
        self._build_menu()
        self._build_layout()
        self._bind_keys()
        self._utf16 = self._detect_tk_utf16()

        self.chat_add("bot", WELCOME)
        self.refresh_xp()
        self.new_file(ask=False)
        self.set_status("Waking up the brain...", YELLOW)
        threading.Thread(target=self._startup, daemon=True).start()
        if self.ptt:
            self.ptt.preload()      # get the voice model ready in the background
        root.after(30, self._poll)
        root.protocol("WM_DELETE_WINDOW", self.on_close)

    # ================================================================ setup
    def _style(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(".", background=BG, foreground=TEXT, fieldbackground=PANEL, bordercolor=BORDER,
                        font=(UI, 10))
        style.configure("TFrame", background=BG)
        style.configure("Panel.TFrame", background=PANEL)
        style.configure("TLabel", background=BG, foreground=TEXT)
        style.configure("Panel.TLabel", background=PANEL, foreground=TEXT)
        style.configure("Muted.TLabel", background=BG, foreground=MUTED)
        style.configure("Title.TLabel", background=BG, foreground=GREEN, font=(UI, 16, "bold"))
        style.configure("TButton", background=PANEL2, foreground=GREEN, bordercolor=GREEN_DIM,
                        focusthickness=0, padding=(8, 4), font=(UI, 10, "bold"))
        style.map("TButton", background=[("active", BORDER), ("disabled", PANEL)],
                  foreground=[("disabled", MUTED)])
        style.configure("Run.TButton", background=GREEN_DIM, foreground="#001a0a")
        style.map("Run.TButton", background=[("active", GREEN), ("disabled", PANEL)])
        style.configure("Alert.TButton", background="#4a1515", foreground=RED, bordercolor=RED)
        style.configure("green.Horizontal.TProgressbar", troughcolor=PANEL, background=GREEN,
                        bordercolor=BORDER, lightcolor=GREEN, darkcolor=GREEN_DIM)
        style.configure("TNotebook", background=BG, bordercolor=BORDER)
        style.configure("TNotebook.Tab", background=PANEL, foreground=MUTED, padding=(12, 4))
        style.map("TNotebook.Tab", background=[("selected", PANEL2)], foreground=[("selected", GREEN)])
        style.configure("Treeview", background=PANEL, foreground=TEXT, fieldbackground=PANEL, rowheight=26)
        style.map("Treeview", background=[("selected", GREEN_DIM)], foreground=[("selected", "#001a0a")])
        style.configure("TRadiobutton", background=BG, foreground=TEXT)
        style.configure("TCheckbutton", background=BG, foreground=TEXT)
        style.configure("TCombobox", fieldbackground=PANEL, foreground=TEXT, background=PANEL2)
        style.configure("TPanedwindow", background=BORDER)

    def _menu(self, parent):
        return tk.Menu(parent, tearoff=0, bg=PANEL, fg=TEXT, activebackground=GREEN_DIM,
                       activeforeground="#001a0a")

    def _build_menu(self):
        bar = self._menu(self.root)
        f = self._menu(bar)
        f.add_command(label="New file          Ctrl+N", command=self.new_file)
        f.add_command(label="🎮 New game project (its own folder)...", command=self.new_project)
        f.add_command(label="Open...           Ctrl+O", command=self.open_file)
        f.add_command(label="Save              Ctrl+S", command=self.save_file)
        f.add_command(label="Save as...", command=lambda: self.save_file(save_as=True))
        f.add_separator()
        f.add_command(label="📂 Open my projects folder", command=self.open_projects_folder)
        f.add_separator()
        f.add_command(label="Quit", command=self.on_close)
        bar.add_cascade(label="File", menu=f)

        b = self._menu(bar)
        b.add_command(label="📚 Lessons", command=self.open_lessons)
        b.add_command(label="📦 Snippets", command=self.open_snippets)
        b.add_command(label="🧠 Memory viewer", command=self.open_memory)
        b.add_command(label="🧹 New chat (forget this conversation)", command=self.clear_chat)
        b.add_separator()
        b.add_command(label="⚙️ Settings", command=self.open_settings)
        b.add_command(label="🩺 Doctor (check everything)", command=self.open_doctor)
        bar.add_cascade(label="CodeBrain", menu=b)

        v = self._menu(bar)
        v.add_command(label="Bigger text   Ctrl+=", command=lambda: self.zoom(1))
        v.add_command(label="Smaller text  Ctrl+-", command=lambda: self.zoom(-1))
        bar.add_cascade(label="View", menu=v)
        self.root.config(menu=bar)

    def _text(self, parent, mono=True, **kw):
        t = tk.Text(parent, bg=PANEL, fg=TEXT, insertbackground=GREEN, selectbackground=GREEN_DIM,
                    selectforeground="#001a0a", relief="flat", borderwidth=0, highlightthickness=1,
                    highlightbackground=BORDER, highlightcolor=GREEN_DIM, padx=10, pady=8,
                    font=(MONO if mono else UI, self.font_size), **{"wrap": "word", **kw})
        return t

    def _scrolled(self, parent, text):
        sb = ttk.Scrollbar(parent, orient="vertical", command=text.yview)
        text.configure(yscrollcommand=sb.set)
        return sb

    def _build_layout(self):
        # ---- top bar
        top = ttk.Frame(self.root, padding=(12, 8))
        top.pack(fill="x")
        ttk.Label(top, text="🧠 CodeBrain", style="Title.TLabel").pack(side="left")
        self.status_label = tk.Label(top, text="", bg=BG, fg=MUTED, font=(UI, 10))
        self.status_label.pack(side="right")
        ttk.Button(top, text="⚙️", width=3, command=self.open_settings).pack(side="right", padx=(0, 12))
        self.speak_btn = ttk.Button(top, text="", width=8, command=self.toggle_speak)
        self.speak_btn.pack(side="right", padx=4)
        self._update_speak_btn()
        ttk.Button(top, text="🧠 Memory", command=self.open_memory).pack(side="right", padx=4)
        ttk.Button(top, text="📦 Snippets", command=self.open_snippets).pack(side="right", padx=4)
        ttk.Button(top, text="📚 Lessons", command=self.open_lessons).pack(side="right", padx=4)
        xpbox = ttk.Frame(top)
        xpbox.pack(side="left", padx=24)
        self.xp_label = ttk.Label(xpbox, text="", font=(UI, 10, "bold"))
        self.xp_label.pack(anchor="w")
        self.xp_bar = ttk.Progressbar(xpbox, length=260, style="green.Horizontal.TProgressbar")
        self.xp_bar.pack(anchor="w", pady=(2, 0))

        main = ttk.PanedWindow(self.root, orient="horizontal")
        main.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.root.after(200, lambda: main.sashpos(0, int(self.root.winfo_width() * 0.42)))

        # ---- left: chat
        left = ttk.Frame(main)
        main.add(left, weight=2)
        chat_frame = ttk.Frame(left)
        chat_frame.pack(fill="both", expand=True)
        self.chat = self._text(chat_frame, mono=False, state="disabled", cursor="arrow")
        self._scrolled(chat_frame, self.chat).pack(side="right", fill="y")
        self.chat.pack(side="left", fill="both", expand=True)
        self.chat.tag_configure("you_name", foreground=BLUE, font=(UI, self.font_size, "bold"), spacing1=12)
        self.chat.tag_configure("bot_name", foreground=GREEN, font=(UI, self.font_size, "bold"), spacing1=12)
        self.chat.tag_configure("you", foreground=TEXT)
        self.chat.tag_configure("bot", foreground=TEXT)
        self.chat.tag_configure("code", font=(MONO, self.font_size - 1), background="#07140b",
                                foreground="#b8ffd0", lmargin1=14, lmargin2=14)
        self.chat.tag_configure("fence", foreground=MUTED, font=(MONO, self.font_size - 2))
        self.chat.tag_configure("bold", font=(UI, self.font_size, "bold"), foreground="#ffffff")
        self.chat.tag_configure("inline", font=(MONO, self.font_size - 1), foreground=GREEN, background="#07140b")
        self.chat.tag_configure("note", foreground=YELLOW, font=(UI, self.font_size - 1, "italic"))
        self.chat.tag_configure("error", foreground=RED)

        box = ttk.Frame(left, padding=(0, 6, 0, 0))
        box.pack(fill="x")
        btns = ttk.Frame(box)
        btns.pack(side="right", padx=(6, 0))      # packed first so the buttons always get room
        self.entry = self._text(box, mono=False, height=3, width=20)
        self.entry.pack(side="left", fill="both", expand=True)
        self.send_btn = ttk.Button(btns, text="Send ➤", command=self.send, style="Run.TButton")
        self.send_btn.pack(fill="x")
        self.stop_think_btn = ttk.Button(btns, text="⏹ Stop", command=self.stop_thinking, state="disabled")
        self.stop_think_btn.pack(fill="x", pady=(4, 0))
        self.mic_btn = ttk.Button(btns, text="🎤 Hold")
        self.mic_btn.pack(fill="x", pady=(4, 0))
        self.mic_btn.bind("<ButtonPress-1>", lambda e: self.mic_down())
        self.mic_btn.bind("<ButtonRelease-1>", lambda e: self.mic_up())
        ttk.Label(left, text="Enter = send   •   Shift+Enter = new line   •   hold F2 or 🎤 = talk",
                  style="Muted.TLabel").pack(anchor="w")

        # ---- right: editor + output
        right = ttk.PanedWindow(main, orient="vertical")
        main.add(right, weight=3)

        ed = ttk.Frame(right)
        right.add(ed, weight=3)
        tools = ttk.Frame(ed, padding=(0, 0, 0, 6))
        tools.pack(fill="x")
        self.run_btn = ttk.Button(tools, text="▶ Run (F5)", style="Run.TButton", command=self.run_code)
        self.run_btn.pack(side="left")
        self.stop_btn = ttk.Button(tools, text="■ Stop", command=self.stop_code, state="disabled")
        self.stop_btn.pack(side="left", padx=4)
        self.bug_btn = ttk.Button(tools, text="🐛 Bug Detective", command=self.bug_detective, state="disabled")
        self.bug_btn.pack(side="left", padx=4)
        ttk.Button(tools, text="🔍 Explain", command=self.explain).pack(side="left", padx=4)
        ttk.Button(tools, text="📸 Look", command=self.look).pack(side="left", padx=4)
        filerow = ttk.Frame(ed, padding=(0, 0, 0, 4))
        filerow.pack(fill="x")
        ttk.Button(filerow, text="💾 Save", command=self.save_file).pack(side="right")
        ttk.Button(filerow, text="📂 Open", command=self.open_file).pack(side="right", padx=4)
        ttk.Button(filerow, text="📄 New", command=self.new_file).pack(side="right")
        self.file_label = ttk.Label(filerow, text="", style="Muted.TLabel")
        self.file_label.pack(side="left", fill="x", expand=True)

        edbox = ttk.Frame(ed)
        edbox.pack(fill="both", expand=True)
        self.lines = tk.Text(edbox, width=4, bg=BG, fg=MUTED, relief="flat", borderwidth=0,
                             highlightthickness=0, padx=6, pady=8, font=(MONO, self.font_size),
                             state="disabled", cursor="arrow", takefocus=0)
        self.lines.pack(side="left", fill="y")
        self.editor = self._text(edbox, undo=True, maxundo=-1, autoseparators=True, wrap="none")
        self.editor.configure(yscrollcommand=self._editor_scrolled)
        sb = ttk.Scrollbar(edbox, orient="vertical", command=self._scroll_both)
        sb.pack(side="right", fill="y")
        self.editor_sb = sb
        self.editor.pack(side="left", fill="both", expand=True)
        for tag, color in (("keyword", GREEN), ("builtin", BLUE), ("number", ORANGE), ("defname", PURPLE),
                           ("string", YELLOW), ("comment", MUTED)):
            self.editor.tag_configure(tag, foreground=color)
        self.editor.tag_configure("errline", background="#4a1515")

        out = ttk.Frame(right)
        right.add(out, weight=1)
        ttk.Label(out, text="Output", style="Muted.TLabel").pack(anchor="w", pady=(6, 0))
        outbox = ttk.Frame(out)
        outbox.pack(fill="both", expand=True)
        self.output = self._text(outbox, state="disabled", height=8)
        self._scrolled(outbox, self.output).pack(side="right", fill="y")
        self.output.pack(side="left", fill="both", expand=True)
        self.output.tag_configure("err", foreground=RED)
        self.output.tag_configure("info", foreground=GREEN)
        self.output.tag_configure("typed", foreground=BLUE)
        inbox = ttk.Frame(out, padding=(0, 4, 0, 0))
        inbox.pack(fill="x")
        ttk.Label(inbox, text="⌨ Type input for your program:", style="Muted.TLabel").pack(side="left")
        self.stdin_entry = tk.Entry(inbox, bg=PANEL, fg=TEXT, insertbackground=GREEN, relief="flat",
                                    highlightthickness=1, highlightbackground=BORDER, font=(MONO, self.font_size))
        self.stdin_entry.pack(side="left", fill="x", expand=True, padx=6)
        self.stdin_entry.bind("<Return>", self.send_stdin)

    def _bind_keys(self):
        r = self.root
        r.bind("<F5>", lambda e: self.run_code())
        r.bind("<KeyPress-F2>", self._f2_down)
        r.bind("<KeyRelease-F2>", self._f2_up)
        r.bind("<Control-s>", lambda e: (self.save_file(), "break")[1])
        r.bind("<Control-o>", lambda e: (self.open_file(), "break")[1])
        r.bind("<Control-n>", lambda e: (self.new_file(), "break")[1])
        r.bind("<Control-equal>", lambda e: self.zoom(1))
        r.bind("<Control-minus>", lambda e: self.zoom(-1))
        self.entry.bind("<Return>", self._entry_return)
        ed = self.editor
        ed.bind("<Return>", self._auto_indent)
        ed.bind("<Tab>", self._tab)
        ed.bind("<Shift-Tab>", self._untab)
        ed.bind("<ISO_Left_Tab>", self._untab)
        ed.bind("<BackSpace>", self._smart_backspace)
        ed.bind("<<Modified>>", self._on_modified)
        ed.bind("<KeyRelease>", lambda e: self._update_lines())
        ed.bind("<MouseWheel>", lambda e: self.root.after(1, self._update_lines))
        ed.bind("<Button-4>", lambda e: self.root.after(1, self._update_lines))
        ed.bind("<Button-5>", lambda e: self.root.after(1, self._update_lines))

    def _detect_tk_utf16(self):
        """Does this Tk count an emoji as 2 characters? (needed to color code correctly)"""
        probe = tk.Text(self.root)
        probe.insert("1.0", "\U0001F600")
        cols = int(probe.index("1.end").split(".")[1])
        probe.destroy()
        return cols == 2

    # ================================================================ background work
    def _startup(self):
        def progress(text):
            self.ui(lambda: self.set_status("🧠 " + text, YELLOW))
        try:
            self.ai.brain.ensure_ready(on_progress=progress)
            self.ui(lambda: self.set_status(f"🧠 Brain ready: {self.ai.brain.model}", GREEN))
        except Exception as e:
            msg = str(e)
            self.ui(lambda: (self.set_status("🧠 Brain offline", RED),
                             self.chat_add("note", f"⚠️ {msg}\n(You can still write + run code. "
                                                   f"Chat starts working once the brain is ready.)")))

    def ui(self, fn):
        """Ask the main thread to run fn (Tk only likes being touched from one thread)."""
        self.ui_queue.put(fn)

    def _poll(self):
        try:
            while True:
                self.ui_queue.get_nowait()()
        except queue.Empty:
            pass
        if self.run:
            self._drain_run()
        self.root.after(30, self._poll)

    def set_status(self, text, color=MUTED):
        self.status_label.configure(text=text, fg=color)

    def refresh_xp(self):
        xp = self.ai.xp
        have, need = xp.progress()
        self.xp_label.configure(text=f"⭐ Level {xp.level}  {xp.title}   ({xp.total} XP)")
        self.xp_bar.configure(maximum=need, value=have)

    def celebrate(self, msg):
        if msg:
            self.chat_add("note", msg)
            self.refresh_xp()

    # ================================================================ chat
    def chat_add(self, who, text):
        self.chat.configure(state="normal")
        if who == "you":
            self.chat.insert("end", "\n🧑 You\n", "you_name")
            self.chat.insert("end", text + "\n", "you")
        elif who == "bot":
            self.chat.insert("end", "\n🧠 CodeBrain\n", "bot_name")
            start = self.chat.index("end-1c")
            self.chat.insert("end", text + "\n", "bot")
            self._format_code(start)
        else:
            self.chat.insert("end", "\n" + text + "\n", who)
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def _format_code(self, start):
        """Color the ``` code blocks in the message that starts at `start`."""
        self.chat.configure(state="normal")
        first = int(start.split(".")[0])
        last = int(self.chat.index("end-1c").split(".")[0])
        in_code = False
        for n in range(first, last + 1):
            line = self.chat.get(f"{n}.0", f"{n}.end")
            if line.strip().startswith("```"):
                self.chat.tag_add("fence", f"{n}.0", f"{n}.end")
                in_code = not in_code
            elif in_code:
                self.chat.tag_add("code", f"{n}.0", f"{n}.end+1c")
            else:
                self._markdown_line(n)
        self.chat.configure(state="disabled")

    def _markdown_line(self, n):
        """Turn **bold** and `code` into nice text (removes the * and ` marks)."""
        for pattern, mark, tag in ((r"\*\*[^*\n]+\*\*", 2, "bold"), (r"`[^`\n]+`", 1, "inline")):
            start = f"{n}.0"
            while True:
                count = tk.IntVar()
                idx = self.chat.search(pattern, start, stopindex=f"{n}.end", regexp=True, count=count)
                if not idx or not count.get():
                    break
                end = f"{idx}+{count.get()}c"
                self.chat.delete(f"{end}-{mark}c", end)
                self.chat.delete(idx, f"{idx}+{mark}c")
                inner_end = f"{idx}+{count.get() - 2 * mark}c"
                self.chat.tag_add(tag, idx, inner_end)
                start = inner_end

    def _entry_return(self, event):
        if event.state & 0x1:  # Shift held -> new line
            return None
        self.send()
        return "break"

    def send(self):
        text = self.entry.get("1.0", "end").strip()
        if not text or self.thinking:
            return
        self.entry.delete("1.0", "end")
        self.speaker.stop()
        self.chat_add("you", text)
        code = self.editor.get("1.0", "end-1c")
        name = Path(self.current_path).name if self.current_path else "untitled.py"
        path = self.current_path
        self._think(lambda on_token: self.ai.ask(text, on_token, name, code, path), kind="chat")

    def ask_codebrain(self, text):
        """Send a message as if you typed it (used by Lessons)."""
        if self.thinking:
            messagebox.showinfo("CodeBrain", "I'm still thinking about the last thing! One sec 🧠")
            return
        self.entry.delete("1.0", "end")
        self.entry.insert("1.0", text)
        self.send()

    def _think(self, job, kind):
        """Run a brain job in the background and stream the answer into the chat."""
        self.thinking = True
        self.cancel_thinking = False
        self.send_btn.configure(state="disabled")
        self.stop_think_btn.configure(state="normal")
        self.set_status("🧠 Thinking...", YELLOW)

        self.chat.configure(state="normal")
        self.chat.insert("end", "\n🧠 CodeBrain\n", "bot_name")
        self.chat.mark_set("reply_start", "end-1c")
        self.chat.mark_gravity("reply_start", "left")
        self.chat.configure(state="disabled")

        def on_token(tok):
            if self.cancel_thinking:
                raise InterruptedError
            self.ui(lambda: self._append_token(tok))

        def worker():
            try:
                result = job(on_token)
                self.ui(lambda: self._done_thinking(result, kind))
            except InterruptedError:
                self.ui(lambda: self._done_thinking(None, kind, stopped=True))
            except Exception as e:
                err = str(e)
                self.ui(lambda: self._done_thinking(None, kind, error=err))

        threading.Thread(target=worker, daemon=True).start()

    def _append_token(self, tok):
        self.chat.configure(state="normal")
        self.chat.insert("end", tok, "bot")
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def _done_thinking(self, result, kind, stopped=False, error=None):
        self.thinking = False
        self.send_btn.configure(state="normal")
        self.stop_think_btn.configure(state="disabled")
        self.chat.configure(state="normal")
        self.chat.insert("end", "\n")
        self.chat.configure(state="disabled")
        if error:
            self.chat_add("error", f"⚠️ {error}")
            self.set_status("🧠 Brain problem - see chat", RED)
            return
        if stopped:
            self.chat_add("note", "(stopped)")
            self.set_status("🧠 Ready", GREEN)
            return
        self.set_status("🧠 Ready", GREEN)
        self._format_code(self.chat.index("reply_start"))

        reply, level_up = result[0], result[-1]
        if kind == "chat" and result[1]:
            for item in result[1]:
                self.chat_add("note", f"🧠 Saved to memory: {item['text']}")
        files = P.file_blocks(reply)
        if files:
            for name, file_code in files:
                self._add_code_button(file_code, label=f"📥 Save as {name}",
                                      command=lambda n=name, c=file_code: self.save_project_file(n, c))
        else:
            code = best_code(reply)
            if code:
                self._add_code_button(code)
        if self.ai.config.get("speak_answers", True):
            self.speaker.say(reply)
        self.celebrate(level_up)
        self.refresh_xp()

    # ================================================================ voice
    def _update_speak_btn(self):
        on = self.ai.config.get("speak_answers", True)
        self.speak_btn.configure(text="🔊 On" if on else "🔇 Off")

    def toggle_speak(self):
        on = not self.ai.config.get("speak_answers", True)
        self.ai.config["speak_answers"] = on
        if not on:
            self.speaker.stop()
        elif not self.speaker.available:
            messagebox.showinfo("Talk back", "I couldn't find a voice on this PC to talk with.")
        self._update_speak_btn()

    def mic_down(self):
        if not self.ptt:
            messagebox.showinfo("Voice", "Voice isn't installed yet (missing: " + ", ".join(self.voice_missing) +
                                ").\nRun SETUP.bat again to add it.")
            return
        if self.thinking or self.ptt.listening:
            return
        self.speaker.stop()
        try:
            self.ptt.press()
        except Exception as e:
            self.set_status(f"🎤 {e}", RED)
            return
        self.mic_btn.configure(text="🔴 Listening")
        self.set_status("🎤 Listening... let go when you're done", RED)

    def mic_up(self):
        if not self.ptt or not self.ptt.listening:
            return
        self.mic_btn.configure(text="🎤 Hold")
        self.set_status("✍️ Turning your voice into text... (first time takes longer)", YELLOW)
        self.ptt.release(on_text=lambda t: self.ui(lambda: self._voice_text(t)),
                         on_error=lambda m: self.ui(lambda: self.set_status("🎤 " + m, RED)))

    def _voice_text(self, text):
        if not text:
            self.set_status("🎤 I didn't hear anything. Hold the button while you talk!", YELLOW)
            return
        self.set_status("🧠 Ready", GREEN)
        existing = self.entry.get("1.0", "end-1c").strip()
        self.entry.insert("end", (" " if existing else "") + text)
        if self.ai.config.get("voice_auto_send", True):
            self.send()

    def _f2_down(self, _event):
        if self._ptt_release_job:            # key auto-repeat: still holding, ignore
            self.root.after_cancel(self._ptt_release_job)
            self._ptt_release_job = None
            return
        self.mic_down()

    def _f2_up(self, _event):
        self._ptt_release_job = self.root.after(120, self._f2_really_up)

    def _f2_really_up(self):
        self._ptt_release_job = None
        self.mic_up()

    def _add_code_button(self, code, label="📥 Put this code in the editor", command=None):
        btn = tk.Button(self.chat, text=label, bg=GREEN_DIM, fg="#001a0a",
                        activebackground=GREEN, relief="flat", font=(UI, 10, "bold"), cursor="hand2",
                        command=command or (lambda: self.put_in_editor(code)))
        self.chat.configure(state="normal")
        self.chat.window_create("end", window=btn, padx=4, pady=4)
        self.chat.insert("end", "\n")
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def stop_thinking(self):
        self.cancel_thinking = True

    def clear_chat(self):
        self.ai.reset()
        self.chat.configure(state="normal")
        self.chat.delete("1.0", "end")
        self.chat.configure(state="disabled")
        self.chat_add("bot", "Fresh chat! 🧹 (I still remember you + your projects in my long-term memory.)")

    # ================================================================ editor
    def save_project_file(self, name, code):
        """📥 Save as <name>: write one file of a multi-file answer into your game's folder."""
        folder = P.project_folder(self.current_path) if self.current_path else projects_dir()
        target = P.safe_target(folder, name)
        if target is None:
            messagebox.showerror("Can't save", f"'{name}' is outside your project folder, so I won't save it there.")
            return
        if self.current_path and target == Path(self.current_path).resolve():
            self.put_in_editor(code)
            return
        if target.exists() and not messagebox.askyesno("Replace file?", f"{target.name} already exists. Replace it?"):
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(code.rstrip("\n") + "\n", encoding="utf-8")
        self.chat_add("note", f"💾 Saved {target.relative_to(folder)} in {folder.name}/")

    def new_project(self):
        if not self._confirm_discard():
            return
        name = simpledialog.askstring("New game project", "Name your game (example: zombie_game):")
        if not name:
            return
        safe = "".join(ch if ch.isalnum() or ch in "-_ " else "_" for ch in name).strip().replace(" ", "_")
        folder = projects_dir() / (safe or "my_game")
        folder.mkdir(parents=True, exist_ok=True)
        main = folder / "main.py"
        if not main.exists():
            main.write_text(f'# {name} - start here! Press Run (F5).\nprint("Welcome to {name}! 🎮")\n',
                            encoding="utf-8")
        self.load_path(main)
        self.chat_add("note", f"🎮 New project '{folder.name}'. Every file you make in this folder, "
                              "I can read when you ask me about it.")

    # ================================================================ eyes 👀
    def look(self):
        if self.thinking:
            return
        brain = self.ai.brain
        if not brain.is_running():
            messagebox.showinfo("Eyes", "My brain (Ollama) isn't running yet, so I can't look. Try again in a moment!")
            return
        if not brain.has_model(brain.vision_model):
            if messagebox.askyesno("Download my eyes? 👀",
                                   f"To SEE your game I need my eyes: '{brain.vision_model}' "
                                   "(about 6 GB, one time only, then offline).\n\nDownload now?"):
                self._download_eyes()
            return
        question = self.entry.get("1.0", "end").strip()
        self.entry.delete("1.0", "end")
        try:
            from codebrain.screenshot import to_png
            img = self._take_screenshot()
        except Exception as e:
            messagebox.showerror("Screenshot", f"I couldn't take a screenshot: {e}")
            return
        png, thumb = to_png(img), to_png(img, max_side=360)
        self.speaker.stop()
        self.chat_add("you", "📸 " + (question or "Look at my game. Does anything look wrong?"))
        self._chat_image(thumb)
        code = self.editor.get("1.0", "end-1c")
        name = Path(self.current_path).name if self.current_path else "untitled.py"
        path = self.current_path
        status = lambda t: self.ui(lambda: self.set_status(t, YELLOW))
        self._think(lambda on_token: self.ai.look(png, question, on_token, name, code, path, status), kind="chat")

    def _take_screenshot(self):
        """Your running game's window if there is one, otherwise the whole screen (with me hidden)."""
        from codebrain.screenshot import grab_screen, grab_window_of_pid
        img = None
        if self.run and self.run.running:
            img = grab_window_of_pid(self.run.proc.pid)
        if img is None:
            self.root.iconify()
            self.root.update()
            time.sleep(0.7)
            try:
                img = grab_screen()
            finally:
                self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        return img

    def _chat_image(self, png):
        photo = tk.PhotoImage(data=base64.b64encode(png).decode("ascii"))
        self._chat_images = getattr(self, "_chat_images", []) + [photo]   # Tk forgets images nobody holds
        self.chat.configure(state="normal")
        self.chat.image_create("end", image=photo, padx=4, pady=4)
        self.chat.insert("end", "\n")
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def _download_eyes(self):
        brain = self.ai.brain
        model = brain.vision_model

        def work():
            try:
                brain.pull_model(lambda t: self.ui(lambda: self.set_status("👀 " + t, YELLOW)), model=model)
                self.ui(lambda: (self.set_status("👀 Eyes ready!", GREEN),
                                 self.chat_add("note", "👀 My eyes are ready! Run your game and press 📸 Look.")))
            except Exception as e:
                err = str(e)
                self.ui(lambda: self.set_status("👀 Eyes download failed: " + err, RED))

        threading.Thread(target=work, daemon=True).start()

    def put_in_editor(self, code):
        current = self.editor.get("1.0", "end-1c").strip()
        if current and current != code.strip():
            if not messagebox.askyesno("Replace code?", "Replace the code in the editor with this code?\n"
                                                        "(You can undo with Ctrl+Z.)"):
                return
        self.editor.edit_separator()
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", code)
        self.editor.edit_separator()
        self._rehighlight()
        self.editor.focus_set()

    def _on_modified(self, _event=None):
        if self.editor.edit_modified():
            self.editor.tag_remove("errline", "1.0", "end")
            if hasattr(self, "_hl_job"):
                self.root.after_cancel(self._hl_job)
            self._hl_job = self.root.after(150, self._rehighlight)
            self._update_title(modified=True)
            self.editor.edit_modified(False)

    def _rehighlight(self):
        code = self.editor.get("1.0", "end-1c")
        for tag in ("keyword", "builtin", "number", "defname", "string", "comment"):
            self.editor.tag_remove(tag, "1.0", "end")
        mapper = IndexMapper(code, self._utf16)
        for tag, a, b in spans(code):
            self.editor.tag_add(tag, mapper.index(a), mapper.index(b))
        self._update_lines()

    def _update_lines(self):
        count = int(self.editor.index("end-1c").split(".")[0])
        self.lines.configure(state="normal", width=max(3, len(str(count))))
        self.lines.delete("1.0", "end")
        self.lines.insert("1.0", "\n".join(str(i) for i in range(1, count + 1)))
        self.lines.configure(state="disabled")
        self.lines.yview_moveto(self.editor.yview()[0])

    def _editor_scrolled(self, first, last):
        self.editor_sb.set(first, last)
        self.lines.yview_moveto(first)

    def _scroll_both(self, *args):
        self.editor.yview(*args)
        self.lines.yview_moveto(self.editor.yview()[0])

    def _auto_indent(self, _event):
        line = self.editor.get("insert linestart", "insert")
        indent = line[: len(line) - len(line.lstrip())]
        if line.rstrip().endswith(":"):
            indent += "    "
        self.editor.insert("insert", "\n" + indent)
        self.editor.see("insert")
        self._update_lines()
        return "break"

    def _selected_lines(self):
        try:
            first = int(self.editor.index("sel.first").split(".")[0])
            last_idx = self.editor.index("sel.last")
            last = int(last_idx.split(".")[0])
            if last_idx.endswith(".0") and last > first:
                last -= 1
            return first, last
        except tk.TclError:
            return None

    def _tab(self, _event):
        sel = self._selected_lines()
        if sel and sel[0] != sel[1]:
            for n in range(sel[0], sel[1] + 1):
                self.editor.insert(f"{n}.0", "    ")
        else:
            self.editor.insert("insert", "    ")
        return "break"

    def _untab(self, _event):
        sel = self._selected_lines() or (int(self.editor.index("insert").split(".")[0]),) * 2
        for n in range(sel[0], sel[1] + 1):
            line = self.editor.get(f"{n}.0", f"{n}.end")
            spaces = len(line) - len(line.lstrip(" "))
            if spaces:
                self.editor.delete(f"{n}.0", f"{n}.{min(4, spaces)}")
        return "break"

    def _smart_backspace(self, _event):
        if self.editor.tag_ranges("sel"):
            return None
        before = self.editor.get("insert linestart", "insert")
        if before and before.strip(" ") == "" and len(before) >= 4:
            remove = len(before) % 4 or 4
            self.editor.delete(f"insert-{remove}c", "insert")
            return "break"
        return None

    def zoom(self, step):
        self.font_size = max(8, min(28, self.font_size + step))
        self.ai.config["font_size"] = self.font_size
        for w in (self.editor, self.lines, self.output, self.entry):
            w.configure(font=(MONO if w is not self.entry else UI, self.font_size))
        self.chat.configure(font=(UI, self.font_size))
        self.chat.tag_configure("code", font=(MONO, self.font_size - 1))
        for t in ("you_name", "bot_name"):
            self.chat.tag_configure(t, font=(UI, self.font_size, "bold"))

    # ================================================================ files
    def _update_title(self, modified=False):
        name = str(self.current_path) if self.current_path else "untitled.py (not saved yet)"
        self.file_label.configure(text=("● " if modified else "") + "📄 " + name)

    def _confirm_discard(self):
        if self.file_label.cget("text").startswith("●") and self.editor.get("1.0", "end-1c").strip():
            answer = messagebox.askyesnocancel("Save first?", "Save your changes first?")
            if answer is None:
                return False
            if answer:
                return self.save_file()
        return True

    def new_file(self, ask=True):
        if ask and not self._confirm_discard():
            return
        self.current_path = None
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", "# My program\nprint(\"Hello from CodeBrain! 🧠\")\n")
        self.editor.edit_reset()
        self._rehighlight()
        self._update_title()
        if ask:
            self.ai.xp.add("new_file")
            self.refresh_xp()

    def load_path(self, path):
        try:
            code = Path(path).read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            messagebox.showerror("Can't open", str(e))
            return
        self.current_path = Path(path)
        self.editor.delete("1.0", "end")
        self.editor.insert("1.0", code)
        self.editor.edit_reset()
        self._rehighlight()
        self._update_title()

    def open_file(self):
        if not self._confirm_discard():
            return
        path = filedialog.askopenfilename(initialdir=str(projects_dir()),
                                          filetypes=[("Python files", "*.py"), ("All files", "*.*")])
        if path:
            self.load_path(path)

    def save_file(self, save_as=False):
        if save_as or not self.current_path:
            path = filedialog.asksaveasfilename(initialdir=str(projects_dir()), defaultextension=".py",
                                                initialfile="my_program.py",
                                                filetypes=[("Python files", "*.py")])
            if not path:
                return False
            self.current_path = Path(path)
        code = self.editor.get("1.0", "end-1c")
        try:
            self.current_path.write_text(code, encoding="utf-8")
        except OSError as e:
            messagebox.showerror("Can't save", str(e))
            return False
        self._update_title()
        return True

    def open_projects_folder(self):
        folder = str(projects_dir())
        try:
            if IS_WIN:
                import os
                os.startfile(folder)
            else:
                import subprocess
                subprocess.Popen(["xdg-open" if sys.platform != "darwin" else "open", folder])
        except Exception:
            messagebox.showinfo("Projects folder", folder)

    # ================================================================ running code
    def out(self, text, tag=None):
        self.output.configure(state="normal")
        self.output.insert("end", text, tag)
        self.output.configure(state="disabled")
        self.output.see("end")

    def run_code(self):
        if self.run and self.run.running:
            return
        if not self.save_file():
            return
        self.run_file(self.current_path, from_editor=True)

    def run_file(self, path, from_editor=False):
        if self.run and self.run.running:
            messagebox.showinfo("Busy", "Something is already running. Press ■ Stop first.")
            return
        self.output.configure(state="normal")
        self.output.delete("1.0", "end")
        self.output.configure(state="disabled")
        if from_editor:
            self.editor.tag_remove("errline", "1.0", "end")
        self.out(f"▶ Running {Path(path).name}...\n", "info")
        try:
            self.run = CodeRun(path)
        except OSError as e:
            self.out(f"Couldn't start Python: {e}\n", "err")
            return
        self.run_from_editor = from_editor
        self.run_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.bug_btn.configure(state="disabled", style="TButton")
        self.stdin_entry.focus_set()

    def _drain_run(self):
        try:
            while True:
                kind, payload = self.run.events.get_nowait()
                if kind == "out":
                    self.out(payload)
                elif kind == "err":
                    self.out(payload, "err")
                else:
                    self._run_finished(payload)
                    return
        except queue.Empty:
            pass

    def _run_finished(self, result):
        self.run = None
        self.last_result = result
        self.run_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        if not self.run_from_editor:
            if result.crashed:
                self.out("\n💥 This demo crashed. Copy the error into the chat and I'll help!\n", "err")
            else:
                self.out("\n✅ Demo finished.\n" if not result.stopped else "\n■ Stopped.\n", "info")
            return
        if result.stopped:
            self.out("\n■ Stopped.\n", "info")
        elif result.crashed:
            self.out("\n💥 Your program crashed. Press 🐛 Bug Detective and I'll explain + fix it!\n", "err")
            self.bug_btn.configure(state="normal", style="Alert.TButton")
            line = error_line_number(result.error_text, self.current_path.name)
            if line:
                self.editor.tag_add("errline", f"{line}.0", f"{line}.end+1c")
                self.editor.see(f"{line}.0")
        else:
            self.out("\n✅ Finished with no errors!\n", "info")
        self.celebrate(self.ai.after_run(result))

    def stop_code(self):
        if self.run:
            self.run.stop()

    def send_stdin(self, _event=None):
        text = self.stdin_entry.get()
        self.stdin_entry.delete(0, "end")
        if self.run and self.run.running:
            self.out(text + "\n", "typed")
            self.run.send_input(text)

    def bug_detective(self):
        if not self.last_result or not self.last_result.crashed:
            messagebox.showinfo("Bug Detective", "No crash to investigate! Run your code first. 🔍")
            return
        if self.thinking:
            return
        self.bug_btn.configure(state="disabled", style="TButton")
        code = self.editor.get("1.0", "end-1c")
        error = self.last_result.error_text
        name = self.current_path.name if self.current_path else "untitled.py"
        self.chat_add("you", "🐛 Bug Detective: why did my code crash?")
        path = self.current_path
        self._think(lambda on_token: self.ai.bug_detective(code, error, name, on_token, path), kind="bug")

    def explain(self):
        if self.thinking:
            return
        try:
            code = self.editor.get("sel.first", "sel.last")
        except tk.TclError:
            code = self.editor.get("1.0", "end-1c")
        if not code.strip():
            return
        preview = code.strip().splitlines()[0][:60]
        self.chat_add("you", f"🔍 Explain this code: {preview}{'...' if len(code) > 60 else ''}")
        self._think(lambda on_token: self.ai.explain(code, on_token), kind="explain")

    # ================================================================ windows
    def _toplevel(self, title, size):
        win = tk.Toplevel(self.root, bg=BG)
        win.title(title)
        win.geometry(size)
        win.transient(self.root)
        return win

    def open_lessons(self):
        LessonsWindow(self)

    def open_memory(self):
        MemoryWindow(self)

    def open_settings(self):
        SettingsWindow(self)

    def open_snippets(self):
        SnippetsWindow(self)

    def open_doctor(self):
        import subprocess
        flags = subprocess.CREATE_NEW_CONSOLE if IS_WIN else 0
        try:
            subprocess.Popen([python_exe(), "-m", "codebrain", "--doctor", "--pause"],
                             cwd=str(Path(__file__).resolve().parent.parent), creationflags=flags)
        except OSError as e:
            messagebox.showerror("Doctor", str(e))

    def on_close(self):
        if self.run and self.run.running:
            self.run.stop()
        if self._confirm_discard():
            self.speaker.stop()
            self.root.destroy()


class LessonsWindow:
    def __init__(self, app):
        self.app = app
        self.win = app._toplevel("📚 CodeBrain Lessons", "1100x720")
        pane = ttk.PanedWindow(self.win, orient="horizontal")
        pane.pack(fill="both", expand=True, padx=8, pady=8)

        self.tree = ttk.Treeview(pane, show="tree")
        self.tree.column("#0", width=330, minwidth=250)
        pane.add(self.tree, weight=0)
        self.tree.bind("<<TreeviewSelect>>", lambda e: self.show())

        right = ttk.Frame(pane, padding=(12, 0))
        pane.add(right, weight=3)
        self.title = ttk.Label(right, text="", style="Title.TLabel")
        self.title.pack(anchor="w")
        self.body = app._text(right, mono=False, height=14, state="disabled")
        self.body.pack(fill="both", expand=True, pady=6)
        self.body.tag_configure("challenge", foreground=YELLOW)

        self.buttons = ttk.Frame(right)
        self.buttons.pack(fill="x")
        self.quiz_frame = ttk.Frame(right, padding=(0, 10, 0, 0))
        self.quiz_frame.pack(fill="x")
        self.fill_tree()

    def fill_tree(self):
        done = set(self.app.ai.xp.data["lessons_done"])
        self.tree.delete(*self.tree.get_children())
        first_open = None
        for track in L.TRACKS:
            parent = self.tree.insert("", "end", text=track, open=True)
            for lesson in L.in_track(track):
                mark = "✅ " if lesson["id"] in done else "⬜ "
                self.tree.insert(parent, "end", iid=lesson["id"], text=mark + lesson["title"])
                if first_open is None and lesson["id"] not in done:
                    first_open = lesson["id"]
        if first_open:
            self.tree.selection_set(first_open)
            self.tree.see(first_open)

    def show(self):
        sel = self.tree.selection()
        lesson = L.by_id(sel[0]) if sel else None
        if not lesson:
            return
        self.lesson = lesson
        self.title.configure(text=lesson["title"])
        self.body.configure(state="normal")
        self.body.delete("1.0", "end")
        self.body.insert("1.0", lesson["text"] + "\n")
        if lesson.get("challenge"):
            self.body.insert("end", "\n🏆 CHALLENGE: " + lesson["challenge"] + "\n", "challenge")
        self.body.configure(state="disabled")

        for w in self.buttons.winfo_children() + self.quiz_frame.winfo_children():
            w.destroy()
        if lesson.get("code"):
            ttk.Button(self.buttons, text="📥 Load example into editor", style="Run.TButton",
                       command=self.load_example).pack(side="left")
            ttk.Button(self.buttons, text="🧠 Explain it to me more", command=lambda: self.app.ask_codebrain(
                f"I'm on the lesson '{lesson['title']}'. Explain it to me in a different way with a new example.")
            ).pack(side="left", padx=6)
        if lesson.get("ask"):
            ttk.Button(self.buttons, text="🧠 Ask CodeBrain to teach me", style="Run.TButton",
                       command=lambda: self.app.ask_codebrain(lesson["ask"])).pack(side="left")
            ttk.Button(self.buttons, text="I did it ✅", command=self.complete).pack(side="left", padx=6)
        if lesson.get("quiz"):
            self.build_quiz(lesson["quiz"])

    def build_quiz(self, quiz):
        ttk.Label(self.quiz_frame, text="❓ QUIZ: " + quiz["q"], font=(UI, 11, "bold")).pack(anchor="w")
        self.choice = tk.IntVar(value=-1)
        for i, opt in enumerate(quiz["options"]):
            ttk.Radiobutton(self.quiz_frame, text=opt, variable=self.choice, value=i).pack(anchor="w", padx=12)
        ttk.Button(self.quiz_frame, text="Check answer", command=self.check).pack(anchor="w", pady=6)
        self.feedback = ttk.Label(self.quiz_frame, text="", wraplength=700)
        self.feedback.pack(anchor="w")

    def check(self):
        quiz = self.lesson["quiz"]
        if self.choice.get() == -1:
            return
        if self.choice.get() == quiz["answer"]:
            self.feedback.configure(text="✅ Correct! " + quiz["why"], foreground=GREEN)
            self.app.celebrate(self.app.ai.xp.add("quiz_right"))
            self.complete()
        else:
            self.feedback.configure(text="❌ Not quite, try again! (Hint: read the lesson text again 😉)",
                                    foreground=RED)

    def complete(self):
        msg = self.app.ai.xp.finish_lesson(self.lesson["id"])
        self.app.refresh_xp()
        self.app.celebrate(msg)
        lid = self.lesson["id"]
        current = self.tree.item(lid, "text")
        self.tree.item(lid, text="✅ " + current[2:])

    def load_example(self):
        if not self.app._confirm_discard():
            return
        folder = projects_dir() / "lessons"
        folder.mkdir(exist_ok=True)
        path = folder / f"lesson_{self.lesson['id']}.py"
        path.write_text(self.lesson["code"], encoding="utf-8")
        self.app.load_path(path)
        self.app.root.lift()
        self.app.editor.focus_set()


class MemoryWindow:
    LABELS = {"profile": "🧑 About you", "fixes": "🐛 Bug lessons", "projects": "🎮 Projects", "notes": "📝 Notes"}

    def __init__(self, app):
        self.app = app
        self.mem = app.ai.memory
        self.win = app._toplevel("🧠 CodeBrain Memory", "900x560")
        ttk.Label(self.win, text="Everything I remember. Delete anything you want me to forget.",
                  style="Muted.TLabel", padding=8).pack(anchor="w")
        self.tabs = ttk.Notebook(self.win)
        self.tabs.pack(fill="both", expand=True, padx=8)
        self.lists = {}
        for cat in CATEGORIES:
            frame = ttk.Frame(self.tabs)
            lb = tk.Listbox(frame, bg=PANEL, fg=TEXT, selectbackground=GREEN_DIM, selectforeground="#001a0a",
                            relief="flat", highlightthickness=0, font=(UI, 11), activestyle="none")
            lb.pack(fill="both", expand=True, padx=4, pady=4)
            lb.bind("<Double-Button-1>", lambda e, c=cat: self.details(c))
            self.tabs.add(frame, text=self.LABELS[cat])
            self.lists[cat] = lb
        bar = ttk.Frame(self.win, padding=8)
        bar.pack(fill="x")
        ttk.Button(bar, text="➕ Add", command=self.add).pack(side="left")
        ttk.Button(bar, text="👁 Details", command=lambda: self.details(self.current())).pack(side="left", padx=6)
        ttk.Button(bar, text="🗑 Forget selected", style="Alert.TButton", command=self.delete).pack(side="left")
        self.refresh()

    def current(self):
        return CATEGORIES[self.tabs.index("current")]

    @staticmethod
    def label(cat, item):
        if cat == "fixes":
            mark = "✅" if item.get("confirmed") else "⏳"
            return f"{mark} {item['error'][:70]}  →  {item['lesson'][:90]}"
        if cat == "projects":
            return f"{item['name']}: {item['description']}"
        return item["text"]

    def refresh(self):
        for cat, lb in self.lists.items():
            lb.delete(0, "end")
            for item in self.mem.data[cat]:
                lb.insert("end", self.label(cat, item))

    def selected(self):
        cat = self.current()
        sel = self.lists[cat].curselection()
        return (cat, self.mem.data[cat][sel[0]]) if sel else (cat, None)

    def details(self, cat):
        _, item = self.selected()
        if not item:
            return
        text = "\n".join(f"{k}: {v}" for k, v in item.items() if k != "id")
        messagebox.showinfo("Memory", text, parent=self.win)

    def add(self):
        cat = self.current()
        if cat == "projects":
            name = simpledialog.askstring("New project", "Project name:", parent=self.win)
            if not name:
                return
            desc = simpledialog.askstring("New project", "What is it? (one line)", parent=self.win) or ""
            self.mem.add_project(name, desc)
        elif cat == "fixes":
            messagebox.showinfo("Bug lessons", "These get added automatically by 🐛 Bug Detective!", parent=self.win)
            return
        else:
            text = simpledialog.askstring("Remember", "What should I remember?", parent=self.win)
            if not text:
                return
            self.mem.remember_fact(text) if cat == "profile" else self.mem.add_note(text)
        self.refresh()

    def delete(self):
        _, item = self.selected()
        if item and messagebox.askyesno("Forget?", "Forget this memory forever?", parent=self.win):
            self.mem.forget(item["id"])
            self.refresh()


class SnippetsWindow:
    def __init__(self, app):
        self.app = app
        self.lib = app.snippets
        self.snippet = None
        self.win = app._toplevel("📦 Code Snippets", "1150x720")
        ttk.Label(self.win, text="Ready-made pieces of game code. ▶ Try it to see it work, 📥 Insert to drop "
                                 "the useful part into your code at the cursor.", style="Muted.TLabel",
                  padding=8).pack(anchor="w")
        pane = ttk.PanedWindow(self.win, orient="horizontal")
        pane.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.tree = ttk.Treeview(pane, show="tree")
        self.tree.column("#0", width=300, minwidth=220)
        pane.add(self.tree, weight=0)
        self.tree.bind("<<TreeviewSelect>>", lambda e: self.show())

        right = ttk.Frame(pane, padding=(12, 0))
        pane.add(right, weight=3)
        self.title = ttk.Label(right, text="", style="Title.TLabel")
        self.title.pack(anchor="w")
        self.desc = ttk.Label(right, text="", wraplength=760, style="Muted.TLabel")
        self.desc.pack(anchor="w", pady=(2, 6))
        bar = ttk.Frame(right)
        bar.pack(fill="x", pady=(0, 6))
        ttk.Button(bar, text="📥 Insert at cursor", style="Run.TButton", command=self.insert).pack(side="left")
        ttk.Button(bar, text="▶ Try it", command=self.try_it).pack(side="left", padx=6)
        ttk.Button(bar, text="📋 Copy", command=self.copy).pack(side="left")
        ttk.Button(bar, text="🔍 Explain", command=self.explain).pack(side="left", padx=6)
        self.del_btn = ttk.Button(bar, text="🗑 Delete", style="Alert.TButton", command=self.delete)
        self.del_btn.pack(side="right")
        box = ttk.Frame(right)
        box.pack(fill="both", expand=True)
        self.code = app._text(box, wrap="none", state="disabled")
        app._scrolled(box, self.code).pack(side="right", fill="y")
        self.code.pack(side="left", fill="both", expand=True)
        for tag, color in (("keyword", GREEN), ("builtin", BLUE), ("number", ORANGE), ("defname", PURPLE),
                           ("string", YELLOW), ("comment", MUTED)):
            self.code.tag_configure(tag, foreground=color)
        self.code.tag_configure("dim", foreground="#4a5a50")
        ttk.Button(right, text="⭐ Save what I selected in the editor as my own snippet",
                   command=self.save_selection).pack(anchor="w", pady=(8, 0))
        self.fill()

    def fill(self, select=None):
        self.tree.delete(*self.tree.get_children())
        for cat in SNIPPET_CATEGORIES:
            items = self.lib.in_category(cat)
            parent = self.tree.insert("", "end", text=f"{cat} ({len(items)})", open=True)
            for s in items:
                self.tree.insert(parent, "end", iid=s["id"], text=s["name"])
        first = select or (self.lib.all()[0]["id"] if self.lib.all() else None)
        if first:
            self.tree.selection_set(first)
            self.tree.see(first)

    def show(self):
        sel = self.tree.selection()
        snippet = self.lib.get(sel[0]) if sel else None
        if not snippet:
            return
        self.snippet = snippet
        self.title.configure(text=snippet["name"])
        lib = f"  [{snippet['lib']}]" if snippet.get("lib") else ""
        self.desc.configure(text=snippet["description"] + lib)
        self.del_btn.configure(state="normal" if snippet.get("user") else "disabled")
        code = snippet["code"]
        self.code.configure(state="normal")
        self.code.delete("1.0", "end")
        self.code.insert("1.0", code)
        mapper = IndexMapper(code, self.app._utf16)
        for tag, a, b in spans(code):
            self.code.tag_add(tag, mapper.index(a), mapper.index(b))
        # dim the demo part so the useful snippet part stands out
        part = snippet_part(code)
        start = code.find(part)
        if part != code.strip("\n") and start >= 0:
            self.code.tag_add("dim", "1.0", mapper.index(start))
            self.code.tag_add("dim", mapper.index(start + len(part)), "end")
            self.code.see(mapper.index(start))
        self.code.configure(state="disabled")

    def insert(self):
        if not self.snippet:
            return
        ed = self.app.editor
        ed.edit_separator()
        ed.insert("insert", "\n" + snippet_part(self.snippet["code"]) + "\n")
        ed.edit_separator()
        self.app._rehighlight()
        self.app.root.lift()
        ed.focus_set()

    def try_it(self):
        if not self.snippet:
            return
        folder = projects_dir() / "snippets"
        folder.mkdir(exist_ok=True)
        path = folder / f"try_{self.snippet['id']}.py"
        path.write_text(self.snippet["code"], encoding="utf-8")
        self.app.run_file(path)

    def copy(self):
        if self.snippet:
            self.win.clipboard_clear()
            self.win.clipboard_append(snippet_part(self.snippet["code"]))

    def explain(self):
        if not self.snippet or self.app.thinking:
            return
        part = snippet_part(self.snippet["code"])
        self.app.chat_add("you", f"🔍 Explain the '{self.snippet['name']}' snippet")
        self.app._think(lambda on_token: self.app.ai.explain(part, on_token), kind="explain")
        self.app.root.lift()

    def delete(self):
        if self.snippet and self.snippet.get("user") and messagebox.askyesno(
                "Delete?", f"Delete your snippet '{self.snippet['name']}'?", parent=self.win):
            self.lib.delete(self.snippet["id"])
            self.snippet = None
            self.fill()

    def save_selection(self):
        try:
            code = self.app.editor.get("sel.first", "sel.last")
        except tk.TclError:
            messagebox.showinfo("Save snippet", "First select (highlight) some code in the editor!", parent=self.win)
            return
        name = simpledialog.askstring("Save snippet", "Name for this snippet:", parent=self.win)
        if not name:
            return
        desc = simpledialog.askstring("Save snippet", "What does it do? (optional)", parent=self.win) or ""
        item = self.lib.add(name, code, desc)
        self.fill(select=item["id"])


class SettingsWindow:
    def __init__(self, app):
        self.app = app
        cfg = app.ai.config
        self.win = app._toplevel("⚙️ Settings", "580x600")
        f = ttk.Frame(self.win, padding=16)
        f.pack(fill="both", expand=True)

        ttk.Label(f, text="🧠 Brain (AI model)", font=(UI, 11, "bold")).pack(anchor="w")
        models = sorted(set(app.ai.brain.installed_models() + [m for _, m in MODEL_BY_VRAM] + [cfg["model"]]))
        self.model = tk.StringVar(value=cfg["model"])
        ttk.Combobox(f, textvariable=self.model, values=models, width=40).pack(anchor="w", pady=(2, 0))
        ttk.Label(f, text="14b = great for 12-16 GB graphics cards. 32b = smarter but needs 24 GB.\n"
                          "A new model downloads automatically the first time.",
                  style="Muted.TLabel").pack(anchor="w", pady=(2, 10))

        ttk.Label(f, text="🏫 How should I help?", font=(UI, 11, "bold")).pack(anchor="w")
        self.mode = tk.StringVar(value=cfg["teach_mode"])
        for value, label in (("teach", "Teach me (code + explanations)"), ("code", "Just give me code"),
                             ("hints", "Hints only (I write the code)")):
            ttk.Radiobutton(f, text=label, value=value, variable=self.mode).pack(anchor="w", padx=12)

        ttk.Label(f, text="📈 My skill level", font=(UI, 11, "bold")).pack(anchor="w", pady=(10, 0))
        self.skill = tk.StringVar(value=cfg["skill_level"])
        ttk.Combobox(f, textvariable=self.skill, width=40,
                     values=["total beginner", "a little experience", "pretty good", "advanced"]).pack(anchor="w")

        ttk.Label(f, text="📏 Memory size (context). Bigger = sees more code but uses more VRAM",
                  font=(UI, 11, "bold")).pack(anchor="w", pady=(10, 0))
        self.ctx = tk.StringVar(value=str(cfg["context_size"]))
        ttk.Combobox(f, textvariable=self.ctx, values=["4096", "8192", "16384", "32768"], width=12).pack(anchor="w")

        ttk.Label(f, text="🎤 Voice", font=(UI, 11, "bold")).pack(anchor="w", pady=(10, 0))
        self.voice_model = tk.StringVar(value=cfg.get("voice_model", "base.en"))
        vrow = ttk.Frame(f)
        vrow.pack(anchor="w")
        for value, label in (("base.en", "Fast"), ("small.en", "Understands me better")):
            ttk.Radiobutton(vrow, text=label, value=value, variable=self.voice_model).pack(side="left", padx=(12, 0))
        self.auto_send = tk.BooleanVar(value=cfg.get("voice_auto_send", True))
        ttk.Checkbutton(f, text="Send my message as soon as I stop talking", variable=self.auto_send).pack(anchor="w", padx=12)

        ttk.Button(f, text="💾 Save", style="Run.TButton", command=self.save).pack(anchor="e", pady=16)

    def save(self):
        cfg = self.app.ai.config
        old_model = cfg["model"]
        cfg["model"] = self.model.get().strip() or old_model
        cfg["teach_mode"] = self.mode.get()
        cfg["skill_level"] = self.skill.get().strip() or "total beginner"
        try:
            cfg["context_size"] = int(self.ctx.get())
        except ValueError:
            pass
        cfg["voice_auto_send"] = bool(self.auto_send.get())
        if self.voice_model.get() != cfg.get("voice_model"):
            cfg["voice_model"] = self.voice_model.get()
            if self.app.ptt:
                self.app.ptt = PushToTalk(cfg["voice_model"])
                self.app.ptt.preload()
        self.win.destroy()
        if cfg["model"] != old_model:
            self.app.set_status("Switching brain...", YELLOW)
            threading.Thread(target=self.app._startup, daemon=True).start()


def run_gui():
    if IS_WIN:
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)   # sharp text on big screens
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("CodeBrain")  # our icon in the taskbar
        except Exception:
            pass
    root = tk.Tk()
    CodeBrainApp(root)
    root.mainloop()
