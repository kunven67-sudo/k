#!/bin/sh
# the video's sound -> a.wav -> demucs (voices / everything else); and how bright every frame is (blackouts)
cd "${FNF_JORDUS_WORK:-/tmp/claude-0/nf}"
ffmpeg -v error -y -i v.mp4 -vn -ac 2 -ar 44100 a.wav
python3 -m demucs -n htdemucs --two-stems=vocals -o sep a.wav
python3 - <<'PY'
import cv2, numpy as np
cap = cv2.VideoCapture('v.mp4'); br = []
while True:
    ok, f = cap.read()
    if not ok: break
    br.append(f[::4, ::4].mean())
np.save('bright.npy', np.array(br))
PY
