"""
Link -> Audio
Paste a link to anything with sound (YouTube, SoundCloud, Bandcamp, TikTok, ...)
and get an MP3 saved to a "Downloads" folder next to this file.

Run it:   python grab_audio.py
   or:    python grab_audio.py <link> [<link> ...]

The first run installs what it needs (yt-dlp + a bundled ffmpeg) automatically.
"""

import os
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "Downloads")


def ensure_packages():
    """Install yt-dlp and a bundled ffmpeg the first time the script runs."""
    needed = []
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        needed.append("yt-dlp")
    try:
        import imageio_ffmpeg  # noqa: F401
    except ImportError:
        needed.append("imageio-ffmpeg")
    if needed:
        print("First run: installing " + ", ".join(needed) + " ...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--user", "--upgrade", *needed]
        )
        import site
        import importlib

        site.addsitedir(site.getusersitepackages())
        importlib.invalidate_caches()


def ffmpeg_path():
    """Use a system ffmpeg if there is one, otherwise the bundled one."""
    import shutil

    found = shutil.which("ffmpeg")
    if found:
        return found
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


class _Quiet:
    """Keep yt-dlp from printing its own errors; we show a friendlier one."""

    def debug(self, msg):
        pass

    warning = info = error = debug


def download(url, fmt="mp3", on_progress=print):
    """Download the audio from `url`. Returns the saved file path."""
    import yt_dlp

    os.makedirs(OUT_DIR, exist_ok=True)

    def hook(d):
        if d["status"] == "downloading":
            pct = d.get("_percent_str", "").strip()
            on_progress(f"Downloading... {pct}")
        elif d["status"] == "finished":
            on_progress("Converting to " + fmt.upper() + "...")

    opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(OUT_DIR, "%(title)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "logger": _Quiet(),
        "progress_hooks": [hook],
        "ffmpeg_location": ffmpeg_path(),
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": fmt, "preferredquality": "192"},
            {"key": "FFmpegMetadata"},
        ],
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        base = os.path.splitext(ydl.prepare_filename(info))[0]
    return base + "." + fmt


def open_folder(path):
    if sys.platform.startswith("win"):
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])


# ---------------------------------------------------------------- window mode
def run_window():
    import tkinter as tk
    from tkinter import ttk

    root = tk.Tk()
    root.title("Link -> Audio")
    root.geometry("520x210")
    root.resizable(False, False)

    tk.Label(root, text="Paste a link:", font=("Segoe UI", 12, "bold")).pack(pady=(14, 4))
    entry = tk.Entry(root, width=60, font=("Segoe UI", 11))
    entry.pack(padx=16)
    entry.focus()

    row = tk.Frame(root)
    row.pack(pady=10)
    fmt_var = tk.StringVar(value="mp3")
    ttk.Combobox(row, textvariable=fmt_var, values=["mp3", "m4a", "wav"],
                 width=6, state="readonly").pack(side="left", padx=6)
    go = tk.Button(row, text="Download", width=14, bg="#1db954", fg="white",
                   font=("Segoe UI", 11, "bold"))
    go.pack(side="left", padx=6)
    tk.Button(row, text="Open folder", width=12,
              command=lambda: (os.makedirs(OUT_DIR, exist_ok=True), open_folder(OUT_DIR))
              ).pack(side="left", padx=6)

    status = tk.Label(root, text="", font=("Segoe UI", 10), wraplength=480)
    status.pack(pady=6)

    def set_status(msg):
        root.after(0, lambda: status.config(text=msg))

    def worker(url, fmt):
        try:
            path = download(url, fmt, set_status)
            set_status("Done! Saved: " + os.path.basename(path))
        except Exception as e:  # show any failure in the window
            set_status("Didn't work: " + str(e).splitlines()[-1][:200])
        finally:
            root.after(0, lambda: go.config(state="normal"))

    def start(_event=None):
        url = entry.get().strip()
        if not url:
            set_status("Paste a link first!")
            return
        go.config(state="disabled")
        set_status("Starting...")
        threading.Thread(target=worker, args=(url, fmt_var.get()), daemon=True).start()

    go.config(command=start)
    entry.bind("<Return>", start)
    root.mainloop()


# --------------------------------------------------------------- console mode
def run_console(urls):
    def grab(url):
        try:
            path = download(url, on_progress=lambda m: print("  " + m, end="\r", flush=True))
            print("\n  Done! Saved: " + path)
        except Exception as e:
            print("\n  Didn't work: " + str(e).splitlines()[-1])

    if urls:
        for u in urls:
            grab(u)
        return
    print("Link -> Audio   (files go to: " + OUT_DIR + ")")
    while True:
        url = input("\nPaste a link (or just press Enter to quit): ").strip()
        if not url:
            break
        grab(url)


if __name__ == "__main__":
    ensure_packages()
    args = sys.argv[1:]
    if args:
        run_console(args)
    else:
        try:
            run_window()
        except Exception:  # no tkinter / no display -> fall back to typing
            run_console([])
