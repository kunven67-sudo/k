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
        # (only the part with something in it goes through the upscaler: much faster)
        out = np.zeros((round((y1 - y0) * S), round((x1 - x0) * S), 3), np.uint8)
        ys, xs = np.nonzero(crop.max(-1) > 12)
        if len(xs):
            a0, b0 = max(0, xs.min() - 8), max(0, ys.min() - 8); a1, b1 = min(crop.shape[1], xs.max() + 9), min(crop.shape[0], ys.max() + 9)
            up = upscale_fast(crop[b0:b1, a0:a1])
            X0, Y0 = round(a0 * S), round(b0 * S)
            part = cv2.resize(up, (min(out.shape[1] - X0, round((a1 - a0) * S)), min(out.shape[0] - Y0, round((b1 - b0) * S))), interpolation=cv2.INTER_AREA)
            out[Y0:Y0 + part.shape[0], X0:X0 + part.shape[1]] = part
        # black is see-through (the game over screen is black too, this just keeps the sheet small + clean)
        al = np.clip((out.max(-1).astype(np.float32) - 6) * 12, 0, 255).astype(np.uint8)
        cv2.imwrite(p, np.dstack([out, al]))
    print(a, e - s, flush=True)
json.dump(dict(x=round(x0 * S), y=round(y0 * S), w=round((x1 - x0) * S), h=round((y1 - y0) * S), fps=30), open('death/box.json', 'w'))
# sound: the shock (2.40 -> 6.45 s, the music starts at 6.5), the music (one loop, seam picked where it matches best)
import soundfile as sf
a, sr = sf.read('a.wav')
sf.write('death/sfx.wav', a[int((C0 + 2.40) * sr):int((C0 + 6.45) * sr)], sr)
# the music: its beat repeats every 4.185 s (2 bars at ~115 BPM, from the onset autocorrelation: the TikTok's
# compression blurs any exact sample match); one loop from where it starts, the bit just past the end blended into
# the start so the seam is smooth
st, L, xf = int((C0 + 6.5076) * sr), int(4.185 * sr), int(0.06 * sr)
loop = a[st:st + L].copy(); tail = a[st + L:st + L + xf]
k = np.linspace(0, 1, xf)[:, None]
loop[:xf] = loop[:xf] * k + tail * (1 - k)
print('music loop', round(L / sr, 4), 's', flush=True)
sf.write('death/loop.wav', loop, sr)
