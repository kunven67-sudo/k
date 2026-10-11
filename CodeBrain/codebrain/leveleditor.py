"""🗺️ Level editors: paint 2D tile levels and 4D maze slices. Saved as simple text files your game can read.

2D level file (levels/level1.txt):           4D maze file (levels/maze_4d.txt):
    ####################                         === w=0 ===
    #P.....C.....E.....#                         ############
    ####################                         #P.........#
                                                 ...
                                                 === w=1 ===
                                                 ...
"""

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk

TILES_2D = {  # char: (name, color)
    "#": ("Wall", "#7f8c8d"),
    ".": ("Empty", None),
    "P": ("Player start", "#39ff88"),
    "C": ("Coin", "#ffd75e"),
    "E": ("Enemy", "#ff5f5f"),
    "S": ("Spikes", "#ffab5e"),
    "D": ("Door", "#a0522d"),
    "G": ("Goal", "#6cc4ff"),
}
TILES_4D = {
    "#": ("Wall", "#7f8c8d"),
    ".": ("Floor", None),
    "P": ("Player start", "#39ff88"),
    "K": ("Key", "#ffd75e"),
    "X": ("Exit", "#6cc4ff"),
}
ONLY_ONE = {"P", "X"}          # tiles there can only be one of (in the whole level / maze)
SLICE_TINTS = ["#7f8c8d", "#8e7cc3", "#5fa8a8", "#c29a5b"]    # each w-slice has its own wall color
SIZES_2D = ((20, 15), (30, 20), (40, 25))
SIZES_4D = (10, 14, 18)
SLICES = 4


# ====================================================================== files (pure functions, easy to test)
def blank_level(cols, rows, border=True):
    grid = [["." for _ in range(cols)] for _ in range(rows)]
    if border:
        for x in range(cols):
            grid[0][x] = grid[rows - 1][x] = "#"
        for y in range(rows):
            grid[y][0] = grid[y][cols - 1] = "#"
    return grid


def level_to_text(grid):
    return "\n".join("".join(row) for row in grid) + "\n"


def parse_level_text(text):
    rows = [list(line.rstrip("\n")) for line in text.splitlines() if line.strip() and not line.startswith(";")]
    width = max((len(r) for r in rows), default=0)
    return [r + ["."] * (width - len(r)) for r in rows]


def maze_to_text(slices):
    parts = ["; 4D maze made with CodeBrain. Each block is one slice of the 4th dimension (w)."]
    for w, grid in enumerate(slices):
        parts.append(f"=== w={w} ===")
        parts.append(level_to_text(grid).rstrip("\n"))
    return "\n".join(parts) + "\n"


def parse_maze_text(text):
    slices, current = [], None
    for line in text.splitlines():
        if line.startswith("=== w="):
            current = []
            slices.append(current)
        elif current is not None and line.strip() and not line.startswith(";"):
            current.append(list(line))
    return [parse_level_text(level_to_text(s)) for s in slices]


def as_python(name, grid=None, slices=None):
    """The level as Python code you can paste into your game."""
    if slices is not None:
        lines = [f"{name} = ["]
        for w, g in enumerate(slices):
            lines.append(f"    [  # w = {w}")
            lines += [f'        "{"".join(r)}",' for r in g]
            lines.append("    ],")
        return "\n".join(lines + ["]"]) + "\n"
    return f"{name} = [\n" + "".join(f'    "{"".join(r)}",\n' for r in grid) + "]\n"


# ====================================================================== window
class LevelEditorWindow:
    def __init__(self, app, folder):
        self.app = app
        self.folder = Path(folder)
        self.win = app._toplevel("🗺️ Level Editor", "1180x760")
        tabs = ttk.Notebook(self.win)
        tabs.pack(fill="both", expand=True, padx=8, pady=8)
        self.ed2d = GridTab(tabs, self, "2d")
        self.ed4d = GridTab(tabs, self, "4d")
        tabs.add(self.ed2d.frame, text="🧱 2D level")
        tabs.add(self.ed4d.frame, text="🌀 4D maze")


class GridTab:
    """One editor tab. mode '2d' = one grid. mode '4d' = 4 grids (slices), one shown at a time."""

    def __init__(self, notebook, owner, mode):
        self.owner, self.app, self.mode = owner, owner.app, mode
        self.tiles = TILES_2D if mode == "2d" else TILES_4D
        self.brush = tk.StringVar(value="#")
        self.slice = tk.IntVar(value=0)
        self.ghost = tk.BooleanVar(value=True)
        self.name = "level1" if mode == "2d" else "maze"
        self.frame = ttk.Frame(notebook, padding=10)
        self.new(*(SIZES_2D[0] if mode == "2d" else (SIZES_4D[1],) * 2), ask=False)

        top = ttk.Frame(self.frame)
        top.pack(fill="x")
        ttk.Label(top, text="Paint:").pack(side="left")
        for ch, (label, color) in self.tiles.items():
            sw = tk.Label(top, text=ch, width=2, bg=color or "#1e2320", fg="#000000" if color else "#d8ffe6",
                          font=("TkFixedFont", 10, "bold"))
            sw.pack(side="left", padx=(8, 1))
            ttk.Radiobutton(top, text=label, value=ch, variable=self.brush).pack(side="left")
        if mode == "4d":
            row = ttk.Frame(self.frame, padding=(0, 6))
            row.pack(fill="x")
            ttk.Label(row, text="Slice of the 4th dimension:").pack(side="left")
            for w in range(SLICES):
                ttk.Radiobutton(row, text=f"w = {w}", value=w, variable=self.slice,
                                command=self.draw).pack(side="left", padx=4)
            ttk.Checkbutton(row, text="👻 Show next slice's walls (faint)", variable=self.ghost,
                            command=self.draw).pack(side="left", padx=16)
            ttk.Button(row, text="📋 Copy this slice to the next", command=self.copy_slice).pack(side="left")

        self.canvas = tk.Canvas(self.frame, width=900, height=560, bg=self.app.theme["panel"], highlightthickness=0)
        self.canvas.pack(anchor="w", pady=6)
        self.canvas.bind("<Button-1>", lambda e: self.paint(e, erase=False))
        self.canvas.bind("<B1-Motion>", lambda e: self.paint(e, erase=False))
        self.canvas.bind("<Button-3>", lambda e: self.paint(e, erase=True))
        self.canvas.bind("<B3-Motion>", lambda e: self.paint(e, erase=True))

        btns = ttk.Frame(self.frame)
        btns.pack(anchor="w")
        sizes = [f"{c}x{r}" for c, r in SIZES_2D] if mode == "2d" else [f"{n}x{n}" for n in SIZES_4D]
        ttk.Label(btns, text="New size:").pack(side="left")
        self.size_box = ttk.Combobox(btns, values=sizes, width=7, state="readonly")
        self.size_box.set(sizes[0] if mode == "2d" else sizes[1])
        self.size_box.pack(side="left", padx=(2, 4))
        ttk.Button(btns, text="📄 New", command=self.new_from_box).pack(side="left")
        ttk.Button(btns, text="📂 Open", command=self.open).pack(side="left", padx=4)
        ttk.Button(btns, text="💾 Save", style="Run.TButton", command=self.save).pack(side="left")
        ttk.Button(btns, text="📋 Copy as Python", command=self.copy_python).pack(side="left", padx=4)
        ttk.Button(btns, text="🧠 How do I load this in my game?", command=self.ask).pack(side="left")
        self.status = ttk.Label(self.frame, text="Left click = paint, right click = erase", style="Muted.TLabel")
        self.status.pack(anchor="w", pady=(6, 0))
        self.draw()

    # ------------------------------------------------------------------ data
    @property
    def grid(self):
        return self.slices[self.slice.get()] if self.mode == "4d" else self.slices[0]

    def new(self, cols, rows, ask=True):
        if ask and not messagebox.askyesno("New?", "Start a new empty level? (Save first if you want to keep it.)",
                                           parent=self.owner.win):
            return
        count = SLICES if self.mode == "4d" else 1
        self.slices = [blank_level(cols, rows) for _ in range(count)]
        if hasattr(self, "canvas"):
            self.draw()

    def new_from_box(self):
        cols, rows = (int(n) for n in self.size_box.get().split("x"))
        self.new(cols, rows)

    def copy_slice(self):
        w = self.slice.get()
        if w < SLICES - 1:
            self.slices[w + 1] = [[("." if ch in ONLY_ONE else ch) for ch in row] for row in self.slices[w]]
            self.status.configure(text=f"Copied w={w} into w={w + 1} (then change some walls!)")

    # ------------------------------------------------------------------ drawing
    def cell_size(self):
        rows, cols = len(self.grid), len(self.grid[0])
        return max(8, min(900 // cols, 560 // rows))

    def draw(self):
        c, g = self.cell_size(), self.grid
        self.canvas.delete("all")
        w = self.slice.get()
        nxt = self.slices[w + 1] if self.mode == "4d" and self.ghost.get() and w + 1 < SLICES else None
        for y, row in enumerate(g):
            for x, ch in enumerate(row):
                name, color = self.tiles.get(ch, ("?", "#ff00ff"))
                if ch == "#" and self.mode == "4d":
                    color = SLICE_TINTS[w]
                fill = color or ("#1e2320" if (x + y) % 2 else "#222823")
                if color is None and nxt is not None and nxt[y][x] == "#":
                    fill = "#3a3346"                                    # 👻 a wall in the next slice
                self.canvas.create_rectangle(x * c, y * c, x * c + c, y * c + c, fill=fill, outline="#101410")
                if ch not in "#." and c >= 14:
                    self.canvas.create_text(x * c + c / 2, y * c + c / 2, text=ch, fill="#000000",
                                            font=("TkFixedFont", max(8, c // 2), "bold"))

    def paint(self, event, erase):
        c = self.cell_size()
        x, y = event.x // c, event.y // c
        g = self.grid
        if not (0 <= y < len(g) and 0 <= x < len(g[0])):
            return
        ch = "." if erase else self.brush.get()
        if ch in ONLY_ONE:          # only one player start / exit: remove the old one everywhere
            for s in self.slices:
                for row in s:
                    for i, old in enumerate(row):
                        if old == ch:
                            row[i] = "."
        if g[y][x] != ch:
            g[y][x] = ch
            self.draw()

    # ------------------------------------------------------------------ files
    def text(self):
        return maze_to_text(self.slices) if self.mode == "4d" else level_to_text(self.slices[0])

    def save(self):
        default = self.name
        name = simpledialog.askstring("Save level", "Name for this level:", parent=self.owner.win,
                                      initialvalue=default)
        if not name:
            return
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name.strip()) or default
        suffix = "_4d.txt" if self.mode == "4d" and not safe.endswith("_4d") else ".txt"
        path = self.owner.folder / f"{safe}{suffix}"
        if path.exists() and not messagebox.askyesno("Replace?", f"{path.name} already exists. Replace it?",
                                                     parent=self.owner.win):
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.text(), encoding="utf-8")
        self.name = path.stem
        self.saved = path
        self.status.configure(text=f"✅ Saved {path}")

    def open(self):
        path = filedialog.askopenfilename(parent=self.owner.win, initialdir=str(self.owner.folder),
                                          filetypes=[("Level files", "*.txt")])
        if not path:
            return
        text = Path(path).read_text(encoding="utf-8", errors="replace")
        if self.mode == "4d":
            slices = parse_maze_text(text)
            if not slices:
                messagebox.showerror("Not a 4D maze", "That file has no '=== w=0 ===' slices.", parent=self.owner.win)
                return
            while len(slices) < SLICES:
                slices.append(blank_level(len(slices[0][0]), len(slices[0])))
            self.slices = slices[:SLICES]
        else:
            grid = parse_level_text(text)
            if not grid:
                return
            self.slices = [grid]
        self.name = Path(path).stem
        self.draw()

    def copy_python(self):
        code = as_python("MAZE" if self.mode == "4d" else "LEVEL",
                         grid=None if self.mode == "4d" else self.slices[0],
                         slices=self.slices if self.mode == "4d" else None)
        self.owner.win.clipboard_clear()
        self.owner.win.clipboard_append(code)
        self.status.configure(text="📋 Copied! Paste it into your game with Ctrl+V")

    def ask(self):
        saved = getattr(self, "saved", None)
        file = f"levels/{saved.name}" if saved else "a level file in my levels folder"
        legend = ", ".join(f"'{ch}' = {name}" for ch, (name, _c) in self.tiles.items())
        if self.mode == "4d":
            text = (f"I made a 4D maze in {file}. It's a text file: each '=== w=N ===' line starts one slice "
                    f"of the 4th dimension, then rows of characters: {legend}. Teach me how to load it into my "
                    "4D maze game and build the walls of each slice.")
        else:
            text = (f"I made a 2D level in {file}. It's a text file with one row per line: {legend}. "
                    "Teach me how to load it and draw it as tiles in my game.")
        self.app.ask_codebrain(text)
        self.app.root.lift()
