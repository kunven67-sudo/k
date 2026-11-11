#!/usr/bin/env python3
"""Builds BroDub.ipynb (the Google Colab page) with brodub.py baked in. Run after changing brodub.py."""
import json
from pathlib import Path

HERE = Path(__file__).parent
ENGINE = (HERE / "brodub.py").read_text(encoding="utf-8")

CELL = r'''#@title ▶ BroDub: press the play button
#@markdown **Google Drive** (best on phone): press ▶, tap Allow, put your video in Google Drive > **BroDub**,
#@markdown then go on any app you want. ~25 min later the English one is in **BroDub > English** (+ a ping).<br>
#@markdown **Pick from this phone/PC**: press ▶, pick your video, stay on this tab until it's 100% uploaded.
VIDEO_FROM = "Google Drive" #@param ["Google Drive", "Pick from this phone/PC"]

import json, os, secrets, shutil, subprocess, sys, threading, time, urllib.request
from pathlib import Path
from IPython.display import HTML, display

ENGINE = __ENGINE__
VIDEO = {".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v", ".ts", ".flv", ".3gp"}
ENV = "/content/bd"

if "GPU" not in subprocess.run("nvidia-smi -L", shell=True, capture_output=True, text=True).stdout:
    raise SystemExit("😵 Google didn't give a free GPU this time (they run out sometimes). Wait a bit and press ▶ again.")

Path("/content/brodub.py").write_text(ENGINE, encoding="utf-8")

# Phone ping when it's done (ntfy.sh: free, no account). A new secret name every run.
PING = "brodub-" + secrets.token_hex(8)
display(HTML(f'<a href="https://ntfy.sh/{PING}" target="_blank" style="display:inline-block;margin:6px 0;'
             'padding:12px 18px;border-radius:10px;background:#7c3aed;color:#fff;font:600 16px sans-serif;'
             'text-decoration:none">🔔 Tap me + allow notifications: your phone pings you when it\'s done</a>'))

def ping(title, message, tag):
    body = json.dumps({"topic": PING, "title": title, "message": message, "tags": [tag], "priority": 4}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/", data=body, method="POST"), timeout=15)
    except Exception:
        pass  # no ping is no reason to fail the dub

def setup():
    if Path(ENV, "ready").exists():
        return
    cmds = [
        "pip -q install uv",
        f"uv venv -q -p 3.12 {ENV}",
        f"uv pip install -q -p {ENV}/bin/python torch==2.6.0 torchaudio==2.6.0 chatterbox-tts==0.1.7 "
        "faster-whisper==1.2.1 ctranslate2==4.5.0 demucs==4.1.0",
    ]
    for c in cmds:
        r = subprocess.run(c, shell=True, capture_output=True, text=True)
        if r.returncode:
            setup.error = (r.stderr or r.stdout)[-1500:]
            return
    Path(ENV, "ready").touch()
setup.error = None

worker = threading.Thread(target=setup)
worker.start()

USE_DRIVE = VIDEO_FROM == "Google Drive"
Path("/content/in").mkdir(exist_ok=True)
out_dir = Path("/content/out")

if USE_DRIVE:
    from google.colab import drive
    print("👇 Tap 'Connect to Google Drive' and Allow (BroDub only touches its own BroDub folder)")
    try:
        drive.mount("/content/drive")
    except Exception as e:
        raise SystemExit(f"😵 Google Drive didn't connect ({e}). Press ▶ again and tap Allow, "
                         "or switch to 'Pick from this phone/PC'.")
    INBOX = Path("/content/drive/MyDrive/BroDub")
    DONE = INBOX / "English"
    DONE.mkdir(parents=True, exist_ok=True)

    def todo():
        # every video in BroDub/ that has no English one yet
        return [p for p in sorted(INBOX.iterdir()) if p.is_file() and p.suffix.lower() in VIDEO
                and not (DONE / f"{p.stem} (English dub).mp4").exists()]

    def settled(paths):
        # only take a video once its size stops changing (fully uploaded)
        sizes = {p: p.stat().st_size for p in paths}
        time.sleep(10)
        return [p for p in paths if p.exists() and sizes[p] > 0 and p.stat().st_size == sizes[p]]

    print("✅ Drive connected. If your video isn't in Google Drive > BroDub yet, put it there now.")
    print("📱 You can leave this tab now (TikTok, YouTube, games, anything). Just don't swipe Chrome closed.")
    start = time.time()
    while not (ready := settled(todo())):
        if time.time() - start > 3600:
            ping("BroDub stopped", "No new video showed up in Google Drive > BroDub for an hour. Press ▶ again.", "x")
            raise SystemExit("No new video showed up in Google Drive > BroDub for an hour. Press ▶ again.")
        time.sleep(20)
    videos = []
    for p in ready:
        print(f"📥 Got {p.name}")
        shutil.copy(p, Path("/content/in", p.name))
        videos.append(Path("/content/in", p.name))
else:
    from google.colab import files
    os.chdir("/content/in")
    print("👇 Pick your video (stay on this tab until it's 100% uploaded)")
    videos = [Path("/content/in", n) for n in files.upload()]
    if not videos:
        raise SystemExit("No video picked. Press ▶ again.")

if not Path(ENV, "ready").exists():
    print("⏳ Getting the AI ready (only the first time, about 3 min)...")
worker.join()
if setup.error:
    ping("BroDub broke", "Setting up failed. Open Colab and send Claude a screenshot.", "x")
    raise SystemExit("😵 Setting up failed:\n" + setup.error)

env = dict(os.environ)
nv = Path(ENV, "lib/python3.12/site-packages/nvidia")
env["LD_LIBRARY_PATH"] = f"{nv}/cudnn/lib:{nv}/cublas/lib:" + env.get("LD_LIBRARY_PATH", "")
env["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
env["TQDM_DISABLE"] = "1"
NOISE = ("Selected model", "Separated tracks", "Separating track", "Warning")
errlog = open("/content/brodub-log.txt", "w")
run = subprocess.Popen([f"{ENV}/bin/python", "/content/brodub.py", *map(str, videos), "--out-dir", str(out_dir)],
                       stdout=subprocess.PIPE, stderr=errlog, text=True, env=env)
for line in run.stdout:
    if line.strip() and not line.startswith(NOISE):
        print(line, end="")
if run.wait():
    errlog.close()
    print(open("/content/brodub-log.txt").read()[-3000:])
    ping("BroDub broke", "Something went wrong. Open Colab and send Claude a screenshot.", "x")
    raise SystemExit("😵 Something broke. Send Claude a screenshot of this box.")

made = [out_dir / f"{v.stem} (English dub).mp4" for v in videos]
made = [m for m in made if m.exists()]
names = ", ".join(m.name for m in made)
if USE_DRIVE:
    print("📤 Putting it in Google Drive > BroDub > English...")
    for m in made:
        shutil.copy(m, DONE / m.name)
    drive.flush_and_unmount()  # makes sure it's really saved in Drive before the ping
    ping("Your English video is ready", f"It's in Google Drive > BroDub > English: {names}", "popcorn")
    print("🍿 Done! It's in Google Drive > BroDub > English")
else:
    ping("Your English video is ready", f"Open the BroDub page, it's downloading: {names}", "popcorn")
    print("🍿 Done! Downloading it now...")
    for m in made:
        files.download(str(m))
'''


def main():
    cell = CELL.replace("__ENGINE__", repr(ENGINE))
    nb = {
        "nbformat": 4,
        "nbformat_minor": 0,
        "metadata": {
            "accelerator": "GPU",
            "colab": {"provenance": [], "gpuType": "T4", "name": "BroDub.ipynb"},
            "kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
        },
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {"id": "title"},
                "source": ["# 🎙️ BroDub"],
            },
            {
                "cell_type": "code",
                "metadata": {"id": "run", "cellView": "form"},
                "execution_count": None,
                "outputs": [],
                "source": cell.splitlines(keepends=True),
            },
        ],
    }
    (HERE / "BroDub.ipynb").write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
