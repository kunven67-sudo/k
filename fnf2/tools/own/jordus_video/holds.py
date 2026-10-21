import numpy as np, json
W = np.load('kW.npy').astype(int); N = np.load('kN.npy').astype(int)
F = W.shape[0]; FPS = 30.0; V = 1110.0; SC = 75     # strum center y
raw = json.load(open('raw_notes.json'))
def runs(col, thr=4):
    on = col > thr; out = []; y = 0; L = len(col)
    while y < L:
        if on[y]:
            s = y
            while y < L and (on[y] or (y+1 < L and on[y+1]) or (y+2 < L and on[y+2])): y += 1
            out.append((s, y)); continue
        y += 1
    return out
votes = {i: [] for i in range(4)}
for f in range(F):
    t = f / FPS
    for i in range(4):
        for (a, b) in runs(N[f, i]):
            if a > 135: continue             # must start at the strum (lit strums are whiter, so the run may start under it)
            if b < 150 or b > 484: continue  # trail sticking out below the strum, end above the bottom bar
            # trail below the strum must be narrow (not an arrow head sitting right under the strum)
            seg = W[f, i, 120:b]
            if seg.mean() > 34: continue
            votes[i].append(t + (b - SC) / V)
res = []
for n in raw:
    i = n['lane']; t = n['t']
    # next note in the same lane
    nxt = min([m['t'] for m in raw if m['lane'] == i and m['t'] > t + 0.01] + [1e9])
    vs = np.array([v for v in votes[i] if t + 0.06 < v < nxt + 0.02])
    sus = 0.0
    if len(vs) >= 3:
        sus = float(np.median(vs)) - t
    res.append(dict(t=t, lane=i, sus=sus, nv=len(vs)))
json.dump(res, open('raw_holds.json', 'w'))
hs = [r for r in res if r['sus'] > 0.09]
print(len(hs), 'holds')
for r in hs: print(round(r['t'], 2), r['lane'], round(r['sus'], 3), r['nv'])
