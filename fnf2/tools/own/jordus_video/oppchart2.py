import json, numpy as np, collections
P = json.load(open('pose_pred.json')); rows = json.load(open('goggles.json')); diffs = json.load(open('oppdiff.json'))
F = len(rows)
lab = [None] * F
for i, p, c in zip(P['i'], P['p'], P['conf']): lab[i] = p if c >= 0.6 else None
for f in range(1, F - 1):
    if lab[f] is not None and lab[f-1] is not None and lab[f-1] == lab[f+1] and lab[f] != lab[f-1]: lab[f] = lab[f-1]
ev = []
for f in range(1, F):
    l = lab[f]; lp = lab[f-1]
    if l is None: continue
    new = (lp is not None and l != lp) or (lp is None and l != 3) or \
          (l == lp and diffs[f] is not None and diffs[f] > 30 and (diffs[f-1] or 0) < 30)
    if not new: continue
    g = f
    while g + 1 < F and lab[g+1] == l and not (diffs[g+1] and diffs[g+1] > 30): g += 1
    ev.append((f, l, g - f + 1))
SHIFT = 0.065; B0 = -0.085; STEP = 0.06
out = []
for f, l, n in ev:
    t = f / 30 - SHIFT; k = round((t - B0) / STEP); dur = n / 30
    sus = round(round((dur - 0.3) / STEP) * STEP, 3) if (l != 3 and dur > 0.62) else 0.0
    out.append(dict(t=round(B0 + k*STEP, 4), lane=l, sus=sus, run=round(dur, 3), idle=bool(l == 3 and dur > 1.2)))
json.dump(out, open('opp_chart.json', 'w'))
print(len(out), 'events', collections.Counter(o['lane'] for o in out), 'idle', sum(o['idle'] for o in out), 'holds', sum(1 for o in out if o['sus']))
for s in range(17):
    a = B0 + s*16*0.48; b = a + 16*0.48
    print('%2d %6.2f %s' % (s, a, ''.join(('i' if o['idle'] else 'LDUR'[o['lane']]) for o in out if a <= o['t'] < b)))
