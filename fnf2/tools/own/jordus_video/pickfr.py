import json, numpy as np
cam = json.load(open('cam.json'))
def camat(f):
    for d in (0, 1, -1, 2, -2):
        k = str(f + d)
        if k in cam: H = np.vstack([np.array(cam[k]['H']), [0, 0, 1]]); return np.hypot(H[0,0], H[1,0]), H @ [512, 288, 1], H
    return None, None, None
plr = json.load(open('player_chart.json'))
SH = 0.048
notes = [(p['t'] + SH, p['lane'], p['sus']) for p in plr]
LX = [636, 728, 821, 914]
BOX = (690, 262, 892, 505)
def clear(f):
    s, c, H = camat(f)
    if s is None: return False
    Hi = np.linalg.inv(H)
    pts = np.array([[BOX[0], BOX[1], 1], [BOX[2], BOX[3], 1]]) @ Hi.T
    x0, y0, x1, y1 = pts[0][0], pts[0][1], pts[1][0], pts[1][1]
    if x0 < 0 or x1 > 1024: return False
    t = f / 30
    for th, lane, sus in notes:
        if th + sus < t - 0.02 or th > t + 0.8: continue
        lx = LX[lane]
        if lx + 45 < x0 or lx - 45 > x1: continue
        ya = 75 + (th - t) * 1110 - 45; yb = 75 + (th + sus - t) * 1110 + 45
        if th < t - 0.02: ya = 75
        if yb > y0 and ya < y1: return False
    return True
res = {}
for lane in range(4):
    c = []
    for i, p in enumerate(plr):
        if p['lane'] != lane: continue
        f0 = int(round((p['t'] + SH) * 30))
        nxt = min([q['t'] for q in plr if q['t'] > p['t'] + 0.01] + [999])
        n = max(3, min(12, int((nxt - p['t']) * 30)))
        ok = [clear(f0 + d) for d in range(n)]
        good = 0
        while good < n and ok[good]: good += 1
        if good >= 4: c.append((good, round(nxt - p['t'], 2), p['t'], f0, round(camat(f0)[0], 2)))
    c.sort(key=lambda x: (-x[0], x[4])); print(lane, c[:8]); res[lane] = c
json.dump(res, open('pick_plr.json', 'w'))
