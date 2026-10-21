# every note of a lane: how much arrow sits on her body box in its first frames, is her whole body on screen, flash?
import json, numpy as np, sys, cv2
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])
from arrows import boxes
from lightstate import light
plr = json.load(open('player_chart.json')); SH = 0.048
BODY = (600, 255, 900, 505)     # her body (ref px), roughly
def over(f):
    H = H_at(f)
    if H is None: return None, None
    Hi = np.linalg.inv(H)
    c = np.array([[BODY[0], BODY[1], 1], [BODY[2], BODY[3], 1]]) @ Hi.T
    x0, y0, x1, y1 = c[0][0], c[0][1], c[1][0], c[1][1]
    a = 0
    for bx0, by0, bx1, by1, k in boxes(f):
        if k == 'splash': continue
        w = max(0, min(x1, bx1) - max(x0, bx0)); h = max(0, min(y1, by1) - max(y0, by0)); a += w * h
    return a / ((x1 - x0) * (y1 - y0)), (y1 <= 490 and x0 >= 0 and x1 <= 1024)
lane = int(sys.argv[1]); rows = []
for p in plr:
    if p['lane'] != lane: continue
    f0 = int(round((p['t'] + SH) * 30)); nxt = min([q['t'] for q in plr if q['t'] > p['t'] + 0.01] + [999])
    ov = [over(f0 + d) for d in range(1, 7)]
    if any(o[0] is None for o in ov): continue
    s = sum(o[0] for o in ov[:3]); full = all(o[1] for o in ov); li = max(light(f0 + d) for d in range(1, 7))
    rows.append((round(s, 3), full, round(li, 2), round(p['t'], 2), f0, round(nxt - p['t'], 2), [round(o[0], 2) for o in ov]))
rows.sort(key=lambda r: (not r[1], r[2] > 0.05, r[0]))
for r in rows[:14]: print(r)
