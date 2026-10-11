"""🔊 Sound & Music maker window: sliders for sound effects + a beat grid for music. Saves .wav files."""

import tempfile
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, simpledialog, ttk

from codebrain import synth

SLIDERS = [  # key, label, low, high
    ("freq_start", "Start pitch (Hz)", 40, 5000),
    ("freq_end", "End pitch (Hz)", 40, 5000),
    ("duration", "Length (seconds)", 0.03, 2.0),
    ("attack", "Fade in (seconds)", 0.0, 0.5),
    ("decay", "Fade out speed", 0.2, 4.0),
    ("vibrato_depth", "Wobble amount", 0.0, 0.5),
    ("vibrato_speed", "Wobble speed", 1.0, 30.0),
    ("arp_factor", "Pitch jump (1 = none)", 0.5, 2.0),
    ("arp_time", "Pitch jump when (0-1)", 0.0, 1.0),
    ("duty", "Square thickness", 0.05, 0.95),
    ("volume", "Volume", 0.1, 1.0),
]


def _safe_name(text, default):
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in (text or "").strip()) or default


class SoundMakerWindow:
    def __init__(self, app, folder):
        self.app = app
        self.folder = Path(folder)
        self.tmp = Path(tempfile.gettempdir()) / "codebrain_preview.wav"
        self.params = synth.preset("🔫 Laser")
        self.vars = {}
        self.win = app._toplevel("🔊 Sound & Music Maker", "1080x700")
        self.win.protocol("WM_DELETE_WINDOW", self.close)
        tabs = ttk.Notebook(self.win)
        tabs.pack(fill="both", expand=True, padx=8, pady=8)
        sfx = ttk.Frame(tabs, padding=10)
        music = ttk.Frame(tabs, padding=10)
        tabs.add(sfx, text="🔫 Sound effects")
        tabs.add(music, text="🎵 Music")
        self.build_sfx(sfx)
        self.build_music(music)
        self.status = ttk.Label(self.win, text=f"Saves into: {self.folder}", style="Muted.TLabel", padding=(10, 0, 10, 8))
        self.status.pack(anchor="w")

    # ================================================================ sound effects
    def build_sfx(self, root):
        left = ttk.Frame(root)
        left.pack(side="left", fill="y")
        ttk.Label(left, text="Start from:").pack(anchor="w")
        for name in synth.PRESETS:
            ttk.Button(left, text=name, command=lambda n=name: self.load_preset(n)).pack(fill="x", pady=1)
        right = ttk.Frame(root, padding=(20, 0))
        right.pack(side="left", fill="both", expand=True)
        row = ttk.Frame(right)
        row.pack(anchor="w", pady=(0, 6))
        ttk.Label(row, text="Wave:").pack(side="left")
        self.wave = tk.StringVar(value=self.params["wave"])
        for w in synth.WAVES:
            ttk.Radiobutton(row, text=w, value=w, variable=self.wave).pack(side="left", padx=4)
        grid = ttk.Frame(right)
        grid.pack(anchor="w")
        for r, (key, label, low, high) in enumerate(SLIDERS):
            ttk.Label(grid, text=label).grid(row=r, column=0, sticky="w", pady=2)
            var = tk.DoubleVar(value=self.params[key])
            self.vars[key] = var
            ttk.Scale(grid, from_=low, to=high, variable=var, length=380).grid(row=r, column=1, padx=8)
            value = ttk.Label(grid, width=7)
            value.grid(row=r, column=2, sticky="w")
            var.trace_add("write", lambda *_a, v=var, l=value: l.configure(text=f"{v.get():.2f}"))
            value.configure(text=f"{var.get():.2f}")
        btns = ttk.Frame(right)
        btns.pack(anchor="w", pady=12)
        ttk.Button(btns, text="▶ Play", style="Run.TButton", command=self.play_sfx).pack(side="left")
        ttk.Button(btns, text="🎲 Make a different version", command=self.wiggle).pack(side="left", padx=6)
        ttk.Button(btns, text="💾 Save .wav", command=self.save_sfx).pack(side="left")
        ttk.Button(right, text="🧠 How do I play this sound in my game?", command=self.ask_sfx).pack(anchor="w")

    def read_params(self):
        params = {k: v.get() for k, v in self.vars.items()}
        params["wave"] = self.wave.get()
        return params

    def write_params(self, params):
        self.wave.set(params["wave"])
        for key, var in self.vars.items():
            var.set(params[key])

    def load_preset(self, name):
        self.write_params(synth.preset(name))
        self.play_sfx()

    def wiggle(self):
        self.write_params(synth.mutate(self.read_params()))
        self.play_sfx()

    def play_sfx(self):
        synth.write_wav(self.tmp, synth.make_sfx(self.read_params()))
        if not synth.play_wav(self.tmp):
            self.status.configure(text="(Couldn't find a way to play sound on this PC, but saving still works.)")

    def save_sfx(self):
        name = simpledialog.askstring("Save sound", "Name your sound (example: laser):", parent=self.win)
        if not name:
            return
        path = self.folder / "sounds" / f"{_safe_name(name, 'sound')}.wav"
        if path.exists() and not messagebox.askyesno("Replace?", f"{path.name} already exists. Replace it?",
                                                     parent=self.win):
            return
        synth.write_wav(path, synth.make_sfx(self.read_params()))
        self.last_sfx = path
        self.status.configure(text=f"✅ Saved {path}")

    def ask_sfx(self):
        name = getattr(self, "last_sfx", None)
        file = f"assets/sounds/{name.name}" if name else "a .wav sound file in assets/sounds/"
        self._ask(f"I made a sound effect ({file}). Show me how to load it and play it in my game when something "
                  "happens (like when I shoot).")

    # ================================================================ music
    def build_music(self, root):
        top = ttk.Frame(root)
        top.pack(fill="x")
        ttk.Label(top, text="Start from:").pack(side="left")
        for name in synth.MUSIC_PRESETS:
            ttk.Button(top, text=name, command=lambda n=name: self.load_music(n)).pack(side="left", padx=3)
        ttk.Button(top, text="🧹 Clear", command=self.clear_music).pack(side="left", padx=10)

        opts = ttk.Frame(root, padding=(0, 8))
        opts.pack(fill="x")
        ttk.Label(opts, text="Speed (BPM):").pack(side="left")
        self.bpm = tk.IntVar(value=110)
        ttk.Scale(opts, from_=60, to=180, variable=self.bpm, length=200,
                  command=lambda v: self.bpm_label.configure(text=str(int(float(v))))).pack(side="left", padx=4)
        self.bpm_label = ttk.Label(opts, text="110", width=4)
        self.bpm_label.pack(side="left")
        ttk.Label(opts, text="   Instrument:").pack(side="left")
        self.instrument = tk.StringVar(value="square")
        for w in ("square", "triangle", "saw", "sine"):
            ttk.Radiobutton(opts, text=w, value=w, variable=self.instrument).pack(side="left", padx=3)
        ttk.Label(opts, text="   Repeat:").pack(side="left")
        self.bars = ttk.Combobox(opts, values=[1, 2, 4, 8], width=3, state="readonly")
        self.bars.set(4)
        self.bars.pack(side="left")
        ttk.Label(opts, text="times").pack(side="left", padx=3)

        self.cell = 34
        rows = len(synth.NOTE_NAMES) + len(synth.DRUMS)
        self.grid = tk.Canvas(root, width=110 + synth.STEPS * self.cell, height=rows * self.cell + 8,
                              bg=self.app.theme["panel"], highlightthickness=0)
        self.grid.pack(anchor="w", pady=6)
        self.grid.bind("<Button-1>", self.toggle)
        self.pattern = synth.empty_pattern()
        self.draw_grid()

        btns = ttk.Frame(root)
        btns.pack(anchor="w", pady=6)
        ttk.Button(btns, text="▶ Play", style="Run.TButton", command=self.play_music).pack(side="left")
        ttk.Button(btns, text="■ Stop", command=synth.stop).pack(side="left", padx=6)
        ttk.Button(btns, text="💾 Save .wav", command=self.save_music).pack(side="left")
        ttk.Button(btns, text="🧠 How do I loop this music in my game?", command=self.ask_music).pack(side="left", padx=6)

    def _rows(self):
        return [("note", i, n) for i, n in enumerate(synth.NOTE_NAMES)] + \
               [("drum", i, d) for i, d in enumerate(synth.DRUMS)]

    def draw_grid(self):
        c = self.cell
        self.grid.delete("all")
        for r, (kind, i, label) in enumerate(self._rows()):
            y = r * c + (8 if kind == "drum" else 0)
            self.grid.create_text(100, y + c / 2, text=label, anchor="e", fill="#d8ffe6", font=("TkDefaultFont", 10))
            on_color = "#39ff88" if kind == "note" else "#ffab5e"
            cells = self.pattern["notes" if kind == "note" else "drums"][i]
            for s in range(synth.STEPS):
                x = 110 + s * c
                off = "#1d2a22" if (s // 4) % 2 == 0 else "#16201a"     # groups of 4 = one beat
                self.grid.create_rectangle(x + 2, y + 2, x + c - 2, y + c - 2, outline="",
                                           fill=on_color if cells[s] else off)

    def toggle(self, event):
        c = self.cell
        step = (event.x - 110) // c
        notes = len(synth.NOTE_NAMES)
        r = event.y // c if event.y < notes * c else (event.y - 8) // c
        if not 0 <= step < synth.STEPS or not 0 <= r < notes + len(synth.DRUMS):
            return
        kind, i = ("notes", r) if r < notes else ("drums", r - notes)
        self.pattern[kind][i][step] = not self.pattern[kind][i][step]
        self.draw_grid()

    def load_music(self, name):
        self.pattern, bpm, instrument = synth.preset_pattern(name)
        self.bpm.set(bpm)
        self.bpm_label.configure(text=str(bpm))
        self.instrument.set(instrument)
        self.draw_grid()
        self.play_music()

    def clear_music(self):
        self.pattern = synth.empty_pattern()
        self.draw_grid()

    def render_music(self, bars=None):
        return synth.make_music(self.pattern, int(self.bpm.get()), self.instrument.get(),
                                bars=bars or int(self.bars.get()))

    def play_music(self):
        synth.write_wav(self.tmp, self.render_music(bars=2))
        synth.play_wav(self.tmp)

    def save_music(self):
        name = simpledialog.askstring("Save music", "Name your song (example: graveyard_theme):", parent=self.win)
        if not name:
            return
        path = self.folder / "music" / f"{_safe_name(name, 'song')}.wav"
        if path.exists() and not messagebox.askyesno("Replace?", f"{path.name} already exists. Replace it?",
                                                     parent=self.win):
            return
        synth.write_wav(path, self.render_music())
        self.last_music = path
        self.status.configure(text=f"✅ Saved {path}")

    def ask_music(self):
        name = getattr(self, "last_music", None)
        file = f"assets/music/{name.name}" if name else "a .wav song in assets/music/"
        self._ask(f"I made background music ({file}). Show me how to play it on a loop in my game, "
                  "and how to make it quieter than the sound effects.")

    def _ask(self, text):
        code = self.app.editor.get("1.0", "end-1c")
        lib = "ursina (3D)" if "ursina" in code else "pygame (2D)"
        self.app.ask_codebrain(f"{text} My game uses {lib}.")
        self.app.root.lift()

    def close(self):
        synth.stop()
        self.win.destroy()
