"""The mod's game over, out of the end of the video (the TikTok's last seconds): the player gets shocked (skeleton
flash), turns blue, a pink '?' of smoke loops over her; on retry the smoke goes and she sits up.
-> death/<anim>_<nn>.png at game-screen size (video x1.25, anime upscaler x4 then down), cropped to one box, + box.json
   + death/sfx.wav (the shock) + death/loop.wav (the game over music, one loop)"""
import cv2, numpy as np, json, os, sys
sys.path.insert(0, '/tmp/claude-0/nf/tools')
from esrgan import upscale_fast
os.chdir('/tmp/claude-0/nf')
C0 = 131.0                      # the clip starts here (video seconds); frame numbers below are video frames (30 fps)
F0 = int(round(C0 * 30))
ANIM = {'firstDeath': (F0 + 74, F0 + 180),     # 2.47 s -> 6.0 s: shock, skeleton flash, blue, smoke rises
        'deathLoop': (F0 + 180, F0 + 215),     # one loop of the smoke: 35 frames (it repeats every 35)
        'deathConfirm': (F0 + 444, F0 + 478)}  # 14.8 s -> 15.93 s: smoke gone, she sits up, fades
WM = (820, 450, 1024, 576)       # the TikTok mark
cap = cv2.VideoCapture('v.mp4')
def frame(f):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, im = cap.read(); im[WM[1]:WM[3], WM[0]:WM[2]] = 0; return im
# one box for every frame
x0 = y0 = 9999; x1 = y1 = 0
for a, (s, e) in ANIM.items():
    for f in range(s, e):
        m = frame(f).max(-1) > 24
        ys, xs = np.nonzero(m)
        if len(xs): x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max() + 1), max(y1, ys.max() + 1)
x0, y0 = max(0, x0 - 6), max(0, y0 - 6); x1, y1 = min(1024, x1 + 6), min(576, y1 + 6)
print('box', x0, y0, x1, y1, flush=True)
S = 1280 / 1024
for a, (s, e) in ANIM.items():
    for i, f in enumerate(range(s, e)):
        p = f'death/{a}_{i:02d}.png'
        if os.path.exists(p): continue
        crop = frame(f)[y0:y1, x0:x1]
        up = upscale_fast(crop)
        out = cv2.resize(up, (round((x1 - x0) * S), round((y1 - y0) * S)), interpolation=cv2.INTER_AREA)
        # black is see-through (the game over screen is black too, this just keeps the sheet small + clean)
        al = np.clip((out.max(-1).astype(np.float32) - 6) * 12, 0, 255).astype(np.uint8)
        cv2.imwrite(p, np.dstack([out, al]))
    print(a, e - s, flush=True)
json.dump(dict(x=round(x0 * S), y=round(y0 * S), w=round((x1 - x0) * S), h=round((y1 - y0) * S), fps=30), open('death/box.json', 'w'))
# sound: the shock (2.40 -> 6.45 s, the music starts at 6.5), the music (one loop, seam picked where it matches best)
import soundfile as sf
a, sr = sf.read('a.wav')
sf.write('death/sfx.wav', a[int((C0 + 2.40) * sr):int((C0 + 6.45) * sr)], sr)
st = int((C0 + 6.50) * sr); best = None
m = a.mean(1)
for L in range(int(4.30 * sr), int(4.52 * sr), 16):
    w = 2048; d = np.abs(m[st:st + w] - m[st + L:st + L + w]).mean()
    if best is None or d < best[0]: best = (d, L)
print('music loop', round(best[1] / sr, 4), 's', flush=True)
sf.write('death/loop.wav', a[st:st + best[1]], sr)
