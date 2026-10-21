import numpy as np, json
W = np.load('kW.npy').astype(int); N = np.load('kN.npy').astype(int)
F = W.shape[0]; FPS = 30.0; V = 1110.0; TOP0 = 39; HEAD = 72
def runs(col, thr=4):
    on = col > thr; out = []; y = 0; L = len(col)
    while y < L:
        if on[y]:
            s = y
            while y < L and (on[y] or (y+1 < L and on[y+1]) or (y+2 < L and on[y+2])): y += 1   # bridge 1-2 px gaps
            out.append((s, y)); continue
        y += 1
    return out
obs = {i: [] for i in range(4)}   # (t_hit, sustain_s or None, frame)
for f in range(F):
    t = f / FPS
    for i in range(4):
        for (a, b) in runs(N[f, i]):
            if a < TOP0 + 45: continue                 # touching / at the strum: already hit or the strum itself
            if b - a < 40: continue
            if W[f, i, a:a+40].max() < 35: continue    # needs a wide arrow head at the top
            th = t + (a - TOP0) / V
            sus = None
            if b < 484: sus = max(0.0, (b - (a + HEAD/2)) / V)
            obs[i].append((th, sus, f))
notes = []
for i in range(4):
    o = sorted(obs[i], key=lambda x: x[0])
    groups = []
    for th, sus, f in o:
        if groups and th - groups[-1][-1][0] < 0.045: groups[-1].append((th, sus, f))
        else: groups.append([(th, sus, f)])
    for g in groups:
        if len(g) < 3: continue
        ts = np.array([x[0] for x in g]); ss = [x[1] for x in g if x[1] is not None]
        sus = float(np.median(ss)) if ss else None
        notes.append(dict(t=float(np.median(ts)), lane=i, n=len(g), spread=float(ts.std()), sus=sus, susmax=float(max(ss)) if ss else None))
notes.sort(key=lambda n: n['t'])
json.dump(notes, open('raw_notes.json', 'w'), indent=0)
print(len(notes), 'notes')
for n in notes[:40]: print(round(n['t'],3), n['lane'], n['n'], round(n['spread']*1000,1), None if n['sus'] is None else round(n['sus'],3))
import collections
print(collections.Counter(n['lane'] for n in notes))
print('first', notes[0]['t'], 'last', notes[-1]['t'])
print('holds', sum(1 for n in notes if n['sus'] and n['sus'] > 0.09))
