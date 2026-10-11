"""🎨 Pixel art editor: draw sprites and save them as PNGs right into your game folder."""

import tkinter as tk
from pathlib import Path
from tkinter import colorchooser, filedialog, messagebox, simpledialog, ttk

# PICO-8 palette: 16 colors that always look good together
PALETTE = ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
           "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"]
CANVAS_PX = 512
SIZES = (16, 32, 64)


class PixelArtWindow:
    def __init__(self, app, folder):
        self.app = app
        self.folder = Path(folder)
        self.size = 32
        self.color = "#00e436"
        self.tool = tk.StringVar(value="pencil")
        self.mirror = tk.BooleanVar(value=False)
        self.undo_stack = []
        self.name = "sprite.png"
        self.pixels = self._blank()

        self.win = app._toplevel("🎨 Pixel Art", "1000x700")
        theme = app.theme
        top = ttk.Frame(self.win, padding=8)
        top.pack(fill="x")
        for value, label in (("pencil", "✏️ Pencil"), ("eraser", "🧽 Eraser"), ("fill", "🪣 Fill"),
                             ("picker", "💧 Pick color")):
            ttk.Radiobutton(top, text=label, value=value, variable=self.tool).pack(side="left", padx=4)
        ttk.Checkbutton(top, text="🪞 Mirror", variable=self.mirror).pack(side="left", padx=10)
        ttk.Label(top, text="Size:").pack(side="left", padx=(16, 2))
        self.size_box = ttk.Combobox(top, values=[f"{s}x{s}" for s in SIZES], width=7, state="readonly")
        self.size_box.set("32x32")
        self.size_box.pack(side="left")
        self.size_box.bind("<<ComboboxSelected>>", self.change_size)

        body = ttk.Frame(self.win, padding=8)
        body.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(body, width=CANVAS_PX, height=CANVAS_PX, bg=theme["panel"], highlightthickness=1,
                                highlightbackground=theme["border"], cursor="crosshair")
        self.canvas.pack(side="left")
        side = ttk.Frame(body, padding=(16, 0))
        side.pack(side="left", fill="y")

        ttk.Label(side, text="Colors (right-click a pixel = erase)").pack(anchor="w")
        pal = ttk.Frame(side)
        pal.pack(anchor="w", pady=4)
        for i, c in enumerate(PALETTE):
            b = tk.Button(pal, bg=c, activebackground=c, width=3, relief="flat", command=lambda c=c: self.pick(c))
            b.grid(row=i // 8, column=i % 8, padx=1, pady=1)
        row = ttk.Frame(side)
        row.pack(anchor="w", pady=4)
        self.swatch = tk.Label(row, bg=self.color, width=6, relief="solid", bd=1)
        self.swatch.pack(side="left")
        ttk.Button(row, text="🎨 Other color...", command=self.custom_color).pack(side="left", padx=6)

        ttk.Label(side, text="Preview (real size + 4x)").pack(anchor="w", pady=(14, 2))
        self.preview = tk.Canvas(side, width=300, height=270, bg=theme["panel"], highlightthickness=0)
        self.preview.pack(anchor="w")

        btns = ttk.Frame(side)
        btns.pack(anchor="w", pady=10)
        ttk.Button(btns, text="💾 Save PNG", style="Run.TButton", command=self.save).grid(row=0, column=0, sticky="we")
        ttk.Button(btns, text="📂 Open PNG", command=self.open).grid(row=0, column=1, sticky="we", padx=4)
        ttk.Button(btns, text="↩ Undo (Ctrl+Z)", command=self.undo).grid(row=1, column=0, sticky="we", pady=4)
        ttk.Button(btns, text="🧹 Clear", command=self.clear).grid(row=1, column=1, sticky="we", padx=4, pady=4)
        ttk.Button(side, text="🧠 How do I put this in my game?", command=self.ask_how).pack(anchor="w", pady=4)
        self.info = ttk.Label(side, text=f"Saves into: {self.folder}", style="Muted.TLabel", wraplength=320)
        self.info.pack(anchor="w", pady=(6, 0))

        self.canvas.bind("<Button-1>", lambda e: self.press(e, erase=False))
        self.canvas.bind("<B1-Motion>", lambda e: self.paint(e, erase=False))
        self.canvas.bind("<Button-3>", lambda e: self.press(e, erase=True))
        self.canvas.bind("<B3-Motion>", lambda e: self.paint(e, erase=True))
        self.win.bind("<Control-z>", lambda e: self.undo())
        self.redraw()

    # ------------------------------------------------------------------ data
    def _blank(self):
        return [[None] * self.size for _ in range(self.size)]

    @property
    def cell(self):
        return CANVAS_PX // self.size

    def snapshot(self):
        self.undo_stack.append([row[:] for row in self.pixels])
        self.undo_stack = self.undo_stack[-60:]

    def undo(self):
        if self.undo_stack:
            self.pixels = self.undo_stack.pop()
            self.redraw()

    def clear(self):
        self.snapshot()
        self.pixels = self._blank()
        self.redraw()

    def change_size(self, _event=None):
        new = int(self.size_box.get().split("x")[0])
        if new == self.size:
            return
        if any(any(row) for row in self.pixels) and not messagebox.askyesno(
                "Change size?", "Changing the size clears your drawing. OK?", parent=self.win):
            self.size_box.set(f"{self.size}x{self.size}")
            return
        self.size = new
        self.undo_stack = []
        self.pixels = self._blank()
        self.redraw()

    # ------------------------------------------------------------------ drawing
    @staticmethod
    def _checker(x, y):
        return "#2a2f2c" if (x + y) % 2 else "#1e2320"     # checkerboard = see-through

    def redraw(self):
        """Rebuild every square (only when the whole picture changes). Painting just recolors squares."""
        c, n = self.cell, self.size
        self.canvas.delete("all")
        self.preview.delete("all")
        self.rects, self.small = [], []
        for y in range(n):
            row, small_row = [], []
            for x in range(n):
                color = self.pixels[y][x]
                row.append(self.canvas.create_rectangle(x * c, y * c, x * c + c, y * c + c,
                                                        fill=color or self._checker(x, y), outline=""))
                pair = []
                for scale, ox in ((1, 0), (4, 80)):
                    pair.append(self.preview.create_rectangle(ox + x * scale, y * scale, ox + x * scale + scale,
                                                              y * scale + scale, fill=color or "", outline="",
                                                              state="normal" if color else "hidden"))
                small_row.append(pair)
            self.rects.append(row)
            self.small.append(small_row)
        if c >= 8:
            for i in range(n + 1):
                self.canvas.create_line(i * c, 0, i * c, n * c, fill="#101410")
                self.canvas.create_line(0, i * c, n * c, i * c, fill="#101410")

    def set_pixel(self, x, y, color):
        self.pixels[y][x] = color
        self.canvas.itemconfigure(self.rects[y][x], fill=color or self._checker(x, y))
        for item in self.small[y][x]:
            self.preview.itemconfigure(item, fill=color or "", state="normal" if color else "hidden")

    def _xy(self, event):
        x, y = event.x // self.cell, event.y // self.cell
        return (x, y) if 0 <= x < self.size and 0 <= y < self.size else None

    def press(self, event, erase):
        self.snapshot()
        self.paint(event, erase)

    def paint(self, event, erase):
        spot = self._xy(event)
        if not spot:
            return
        x, y = spot
        tool = "eraser" if erase else self.tool.get()
        if tool == "picker":
            if self.pixels[y][x]:
                self.pick(self.pixels[y][x])
            return
        if tool == "fill":
            self.flood(x, y, self.color)
        else:
            color = None if tool == "eraser" else self.color
            self.set_pixel(x, y, color)
            if self.mirror.get():
                self.set_pixel(self.size - 1 - x, y, color)

    def flood(self, x, y, color):
        target = self.pixels[y][x]
        if target == color:
            return
        stack = [(x, y)]
        while stack:
            cx, cy = stack.pop()
            if 0 <= cx < self.size and 0 <= cy < self.size and self.pixels[cy][cx] == target:
                self.set_pixel(cx, cy, color)
                stack += [(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]

    def pick(self, color):
        self.color = color
        self.swatch.configure(bg=color)
        if self.tool.get() in ("eraser", "picker"):
            self.tool.set("pencil")

    def custom_color(self):
        result = colorchooser.askcolor(color=self.color, parent=self.win)
        if result and result[1]:
            self.pick(result[1])

    # ------------------------------------------------------------------ files
    def to_image(self):
        from PIL import Image
        img = Image.new("RGBA", (self.size, self.size), (0, 0, 0, 0))
        for y in range(self.size):
            for x in range(self.size):
                c = self.pixels[y][x]
                if c:
                    img.putpixel((x, y), (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255))
        return img

    def save(self):
        name = simpledialog.askstring("Save sprite", "Name your sprite (example: zombie):", parent=self.win,
                                      initialvalue=Path(self.name).stem)
        if not name:
            return
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name.strip()) or "sprite"
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self.folder / f"{safe}.png"
        if path.exists() and not messagebox.askyesno("Replace?", f"{path.name} already exists. Replace it?",
                                                     parent=self.win):
            return
        try:
            self.to_image().save(path)
        except Exception as e:
            messagebox.showerror("Can't save", str(e), parent=self.win)
            return
        self.name = path.name
        self.info.configure(text=f"✅ Saved {path}")

    def open(self):
        path = filedialog.askopenfilename(parent=self.win, initialdir=str(self.folder),
                                          filetypes=[("PNG pictures", "*.png")])
        if not path:
            return
        try:
            from PIL import Image
            img = Image.open(path).convert("RGBA")
        except Exception as e:
            messagebox.showerror("Can't open", str(e), parent=self.win)
            return
        if max(img.size) > 64:
            messagebox.showinfo("Too big", "Pixel art here is 64x64 max. That picture is "
                                           f"{img.width}x{img.height}.", parent=self.win)
            return
        self.size = next(s for s in SIZES if s >= max(img.size))
        self.size_box.set(f"{self.size}x{self.size}")
        self.pixels = self._blank()
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = img.getpixel((x, y))
                if a > 0:
                    self.pixels[y][x] = f"#{r:02x}{g:02x}{b:02x}"
        self.undo_stack = []
        self.name = Path(path).name
        self.redraw()

    def ask_how(self):
        code = self.app.editor.get("1.0", "end-1c")
        lib = "ursina (3D)" if "ursina" in code else "pygame (2D)"
        self.app.ask_codebrain(
            f"I drew a {self.size}x{self.size} pixel art sprite and saved it as assets/{self.name} in my game "
            f"folder. Show me how to load it and show it in my game. My game uses {lib}. Make it scaled up so it "
            "isn't tiny, and keep the pixels sharp (not blurry).")
        self.app.root.lift()
