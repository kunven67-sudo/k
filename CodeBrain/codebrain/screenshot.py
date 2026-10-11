"""📸 Screenshots for CodeBrain's eyes: your game window, or the whole screen."""

import io
import sys
import time


def grab_screen():
    from PIL import ImageGrab
    try:
        return ImageGrab.grab(all_screens=True)
    except TypeError:          # older Pillow / non-Windows
        return ImageGrab.grab()


def grab_window_of_pid(pid):
    """Screenshot the biggest window that belongs to process `pid` (Windows only). None if not found."""
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes

    from PIL import ImageGrab

    user32 = ctypes.windll.user32
    windows = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def callback(hwnd, _lparam):
        if user32.IsWindowVisible(hwnd):
            owner = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
            if owner.value == pid:
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                area = (rect.right - rect.left) * (rect.bottom - rect.top)
                if area > 100 * 100:
                    windows.append((area, hwnd, (rect.left, rect.top, rect.right, rect.bottom)))
        return True

    user32.EnumWindows(callback, 0)
    if not windows:
        return None
    _area, hwnd, _ = max(windows)
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)          # SW_RESTORE: un-minimize it
    user32.SetForegroundWindow(hwnd)        # bring the game to the front
    time.sleep(0.5)
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    try:
        return ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True)
    except TypeError:
        return ImageGrab.grab(bbox=(rect.left, rect.top, rect.right, rect.bottom))


def to_png(img, max_side=1280):
    """Shrink big screenshots (the eyes don't need 4K) and return PNG bytes."""
    img = img.convert("RGB")
    scale = max_side / max(img.size)
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
