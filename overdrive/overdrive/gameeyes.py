"""Game eyes + hands (Piece 3, Windows). OVERDRIVE starts a game it built, takes a picture of ONLY that game's
window (PrintWindow, works even behind other windows), looks at it, and presses keys or clicks INSIDE that window
only (PostMessage to that one window). No keyboard hooks, no global key presses: your other apps never get a key.
Screenshots show up in the chat and in the Live view. Honest limit: games that read keys through raw input or
DirectInput may ignore window key messages; then it can still look, and tell you."""
from __future__ import annotations

import base64
import ctypes
import platform
import struct
import subprocess
import sys
import time
import zlib
from pathlib import Path

from .permissions import Risk
from .tools import ToolResult, ToolSpec

IS_WIN = platform.system() == "Windows"
WM_KEYDOWN, WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP = 0x0100, 0x0101, 0x0201, 0x0202
VK = {**{chr(c): c for c in range(ord("A"), ord("Z") + 1)}, **{str(d): 0x30 + d for d in range(10)},
      "SPACE": 0x20, "ENTER": 0x0D, "ESC": 0x1B, "ESCAPE": 0x1B, "TAB": 0x09, "SHIFT": 0x10, "CTRL": 0x11, "ALT": 0x12,
      "LEFT": 0x25, "UP": 0x26, "RIGHT": 0x27, "DOWN": 0x28, "BACKSPACE": 0x08,
      **{f"F{i}": 0x6F + i for i in range(1, 13)}}


def png_from_bgra(width: int, height: int, bgra: bytes) -> bytes:
    """Encode top-down BGRA pixels as a PNG (no picture library needed)."""
    stride = width * 4
    rows = []
    for y in range(height):
        row = bgra[y * stride:(y + 1) * stride]
        rgb = bytearray(width * 3)
        rgb[0::3], rgb[1::3], rgb[2::3] = row[2::4], row[1::4], row[0::4]
        rows.append(b"\x00" + bytes(rgb))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 6)) + chunk(b"IEND", b""))


def looks_blank(bgra: bytes) -> bool:
    sample = bgra[::4 * 997][:4000]
    return len(set(sample)) <= 2


# ------------------------------------------------------------------ Windows calls (only used on Windows)
def _windows_of(pid: int) -> list[int]:
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    found: list[int] = []
    proto = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def cb(hwnd, _):
        p = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value == pid and user32.IsWindowVisible(hwnd):
            found.append(hwnd)
        return True
    user32.EnumWindows(proto(cb), 0)
    return found


def _window_by_title(part: str) -> list[int]:
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    found: list[int] = []
    proto = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def cb(hwnd, _):
        n = user32.GetWindowTextLengthW(hwnd)
        if n and user32.IsWindowVisible(hwnd):
            buf = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, buf, n + 1)
            if part.lower() in buf.value.lower():
                found.append(hwnd)
        return True
    user32.EnumWindows(proto(cb), 0)
    return found


def _size(hwnd: int) -> tuple[int, int]:
    class RECT(ctypes.Structure):
        _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]
    r = RECT()
    ctypes.windll.user32.GetClientRect(hwnd, ctypes.byref(r))  # type: ignore[attr-defined]
    return r.r - r.l, r.b - r.t


def capture(hwnd: int) -> tuple[int, int, bytes]:
    user32, gdi32 = ctypes.windll.user32, ctypes.windll.gdi32  # type: ignore[attr-defined]
    w, h = _size(hwnd)
    if w <= 0 or h <= 0:
        raise RuntimeError("the game window is minimized or has no size")
    hdc = user32.GetDC(hwnd)
    mdc = gdi32.CreateCompatibleDC(hdc)
    bmp = gdi32.CreateCompatibleBitmap(hdc, w, h)
    old = gdi32.SelectObject(mdc, bmp)
    try:
        if not user32.PrintWindow(hwnd, mdc, 3):     # PW_CLIENTONLY | PW_RENDERFULLCONTENT
            gdi32.BitBlt(mdc, 0, 0, w, h, hdc, 0, 0, 0x00CC0020)

        class BIH(ctypes.Structure):
            _fields_ = [("biSize", ctypes.c_uint32), ("biWidth", ctypes.c_int32), ("biHeight", ctypes.c_int32),
                        ("biPlanes", ctypes.c_uint16), ("biBitCount", ctypes.c_uint16), ("biCompression", ctypes.c_uint32),
                        ("biSizeImage", ctypes.c_uint32), ("a", ctypes.c_int32), ("b", ctypes.c_int32),
                        ("c", ctypes.c_uint32), ("d", ctypes.c_uint32)]
        bih = BIH(ctypes.sizeof(BIH), w, -h, 1, 32, 0, 0, 0, 0, 0, 0)
        buf = ctypes.create_string_buffer(w * h * 4)
        gdi32.GetDIBits(mdc, bmp, 0, h, buf, ctypes.byref(bih), 0)
        return w, h, buf.raw
    finally:
        gdi32.SelectObject(mdc, old)
        gdi32.DeleteObject(bmp)
        gdi32.DeleteDC(mdc)
        user32.ReleaseDC(hwnd, hdc)


def press(hwnd: int, keys: list[str], hold_ms: int) -> list[str]:
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    unknown = []
    for k in keys:
        vk = VK.get(k.upper())
        if vk is None:
            unknown.append(k)
            continue
        scan = user32.MapVirtualKeyW(vk, 0)
        user32.PostMessageW(hwnd, WM_KEYDOWN, vk, 1 | (scan << 16))
        time.sleep(max(0.02, hold_ms / 1000))
        user32.PostMessageW(hwnd, WM_KEYUP, vk, 1 | (scan << 16) | (1 << 30) | (1 << 31))
        time.sleep(0.03)
    return unknown


def click(hwnd: int, x: int, y: int) -> None:
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    lp = (y << 16) | (x & 0xFFFF)
    user32.PostMessageW(hwnd, WM_LBUTTONDOWN, 1, lp)
    time.sleep(0.05)
    user32.PostMessageW(hwnd, WM_LBUTTONUP, 0, lp)


# ------------------------------------------------------------------ the tool
def make_game_eyes_tool(od) -> ToolSpec:
    games: dict[str, dict] = {}

    def launch(path: Path, args: list[str]) -> subprocess.Popen:
        ext = path.suffix.lower()
        if ext in (".py", ".pyw"):
            cmd = ["pyw" if ext == ".pyw" else "py", str(path), *args]
        elif ext in (".exe", ".bat", ".cmd"):
            cmd = [str(path), *args]
        else:
            raise ValueError("game_eyes starts .exe, .bat or .py games (for a web game, open it yourself and use window_title)")
        return subprocess.Popen(cmd, cwd=str(path.parent), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)

    def find(g: dict) -> int | None:
        if g.get("title"):
            hits = _window_by_title(g["title"])
        else:
            hits = _windows_of(g["proc"].pid) if g.get("proc") else []
        if not hits:
            return None
        return max(hits, key=lambda h: (lambda s: s[0] * s[1])(_size(h)))

    async def handler(args: dict, ctx) -> ToolResult:
        import asyncio
        if not IS_WIN:
            return ToolResult(text="Game eyes only work on Windows (that's where your games run).", is_error=True)
        act = args["action"]
        gid = args.get("game", "game")
        if act == "start":
            if not args.get("path") and not args.get("window_title"):
                return ToolResult(text="Give path (the game's .exe/.bat/.py in the workspace) or window_title.", is_error=True)
            g: dict = {"title": args.get("window_title", "")}
            if args.get("path"):
                path = ctx.workspace.resolve(args["path"])
                if not path.is_file():
                    return ToolResult(text=f"There's no file at {args['path']}.", is_error=True)
                g["proc"] = await asyncio.to_thread(launch, path, list(args.get("args") or []))
            games[gid] = g
            await asyncio.sleep(min(30, float(args.get("wait_s", 5))))
            if g.get("proc") and g["proc"].poll() is not None:
                return ToolResult(text=f"The game closed by itself right away (exit code {g['proc'].returncode}). "
                                       "That's a crash: check its log.", is_error=True)
            act = "look"
        g = games.get(gid)
        if g is None:
            return ToolResult(text="Start the game first (action start).", is_error=True)
        if act == "close":
            if g.get("proc") and g["proc"].poll() is None:
                g["proc"].terminate()
            games.pop(gid, None)
            return ToolResult(text="Closed the game.")
        hwnd = await asyncio.to_thread(find, g)
        if hwnd is None:
            crashed = g.get("proc") and g["proc"].poll() is not None
            return ToolResult(text="The game crashed (its window is gone)." if crashed else
                              "Can't find the game's window yet. Wait a bit and look again.", is_error=True)
        note = ""
        if act == "keys":
            unknown = await asyncio.to_thread(press, hwnd, list(args.get("keys") or []), int(args.get("hold_ms", 120)))
            note = f"Pressed {', '.join(args.get('keys') or [])} inside the game window." + (f" Unknown keys: {unknown}." if unknown else "")
            await asyncio.sleep(0.4)
        elif act == "click":
            await asyncio.to_thread(click, hwnd, int(args.get("x", 0)), int(args.get("y", 0)))
            note = f"Clicked at {args.get('x')},{args.get('y')} inside the game window."
            await asyncio.sleep(0.4)
        w, h, px = await asyncio.to_thread(capture, hwnd)
        png = await asyncio.to_thread(png_from_bgra, w, h, px)
        pics = []
        if ctx.pictures is not None:
            pics.append({"file": ctx.pictures.put(png), "title": f"Game screenshot ({w}x{h})", "license": "your game",
                         "source": "game eyes", "caption": "What OVERDRIVE sees in the game"})
        blank = " The picture is all one color: the game might show a black or blank screen (a bug?)." if looks_blank(px) else ""
        return ToolResult(text=(note + " " if note else "") + f"Screenshot of the game window ({w}x{h}) attached.{blank}",
                          data={"pictures": pics}, images=[png])

    return ToolSpec(
        name="game_eyes", title="Look at and play a game",
        description=("Start a game you built and look at it / play it: action start (path to its .exe/.bat/.py in the "
                     "workspace, or window_title for one already open), look (screenshot of its window, you see it), "
                     "keys (press keys like W, SPACE, LEFT inside its window only, then look), click (x,y inside the "
                     "window, then look), close. Use it to find visible bugs: black screens, broken menus, things off-screen."),
        schema={"type": "object", "properties": {
            "action": {"type": "string", "enum": ["start", "look", "keys", "click", "close"]},
            "game": {"type": "string", "maxLength": 40}, "path": {"type": "string", "maxLength": 400},
            "args": {"type": "array", "items": {"type": "string", "maxLength": 200}, "maxItems": 10},
            "window_title": {"type": "string", "maxLength": 120},
            "wait_s": {"type": "number", "minimum": 0, "maximum": 30},
            "keys": {"type": "array", "items": {"type": "string", "maxLength": 12}, "maxItems": 30},
            "hold_ms": {"type": "integer", "minimum": 20, "maximum": 5000},
            "x": {"type": "integer", "minimum": 0, "maximum": 10000}, "y": {"type": "integer", "minimum": 0, "maximum": 10000}},
            "required": ["action"], "additionalProperties": False},
        risk=lambda a: Risk.RUN if a.get("action") == "start" else Risk.READ, handler=handler, status="experimental",
        selftest="test_game_eyes_parts",
        limitations=["Windows only.", "Keys go to the game window only; games that use raw input may ignore them.",
                     "Web games: open them yourself and use window_title (keys may not reach the page)."])
