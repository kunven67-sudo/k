#!/bin/sh
# the god's voice = Jim's voice, slowed + layered an octave-ish down + a thin high layer + a long echo (run after voices.py)
cd "$(dirname "$0")/../assets/voice" && for f in g5_*.mp3; do ffmpeg -v error -y -i "$f" -filter_complex "[0]asplit=3[a][b][c];[b]asetrate=24000*0.78,aresample=24000,atempo=1.282[low];[c]asetrate=24000*1.25,aresample=24000,atempo=0.8,volume=0.25[hi];[a][low][hi]amix=inputs=3:weights=0.7 1 0.4,aecho=0.8:0.75:90|170:0.35|0.22,volume=1.6" -c:a libmp3lame -q:a 4 /tmp/god.mp3 && mv /tmp/god.mp3 "$f"; done
