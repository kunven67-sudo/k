#!/usr/bin/env python3
"""Builds BroDub.ipynb (the Google Colab page) with brodub.py baked in. Run after changing brodub.py."""
import json
from pathlib import Path

HERE = Path(__file__).parent
ENGINE = (HERE / "brodub.py").read_text(encoding="utf-8")

CELL = r'''#@title ▶ BroDub: press the play button
#@markdown Pick a video and it comes back in English, with the characters' own voices. About 20-30 min for one 24 min episode.
use_google_drive = False #@param {type:"boolean"}
#@markdown ☝️ For big videos or a lot of episodes: tick this, put the videos in Google Drive in a folder called **BroDub**, and the English ones show up in **BroDub/English**.

import os, subprocess, sys, threading
from pathlib import Path

ENGINE = __ENGINE__
VIDEO = {".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v", ".ts", ".flv", ".3gp"}
ENV = "/content/bd"

if "GPU" not in subprocess.run("nvidia-smi -L", shell=True, capture_output=True, text=True).stdout:
    raise SystemExit("😵 Google didn't give a free GPU this time (they run out sometimes). Wait a bit and press ▶ again.")

Path("/content/brodub.py").write_text(ENGINE, encoding="utf-8")

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

if use_google_drive:
    from google.colab import drive
    drive.mount("/content/drive")
    folder = Path("/content/drive/MyDrive/BroDub")
    out_dir = folder / "English"
    out_dir.mkdir(parents=True, exist_ok=True)
    videos = sorted(p for p in folder.iterdir() if p.suffix.lower() in VIDEO
                    and not (out_dir / f"{p.stem} (English dub).mp4").exists())
    if not videos:
        raise SystemExit("📂 No new videos in Google Drive > BroDub. Put some there and press ▶ again.")
else:
    from google.colab import files
    Path("/content/in").mkdir(exist_ok=True)
    os.chdir("/content/in")
    print("👇 Pick your video")
    videos = [Path("/content/in", n) for n in files.upload()]
    out_dir = Path("/content/out")
    if not videos:
        raise SystemExit("No video picked. Press ▶ again.")

if not Path(ENV, "ready").exists():
    print("⏳ Getting the AI ready (only the first time, about 3 min)...")
worker.join()
if setup.error:
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
    raise SystemExit("😵 Something broke. Send Claude a screenshot of this box.")

made = [out_dir / f"{v.stem} (English dub).mp4" for v in videos]
made = [m for m in made if m.exists()]
if use_google_drive:
    print(f"🍿 Done! Your English videos are in Google Drive > BroDub > English ({len(made)} new)")
else:
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
                "source": ["# 🎙️ BroDub\n", "Foreign voices ➜ English, in the same character's voice. Runs on Google's free GPU."],
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
