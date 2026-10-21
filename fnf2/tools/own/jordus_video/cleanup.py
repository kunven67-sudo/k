"""Last pass on the cut-out frames (v2). A pixel that matches the stage at that exact spot (in that frame's light) is
stage - but only when it is reachable from OUTSIDE her through other stage-matching pixels. Anything inside her
outlines stays (white soles over the white ramp, black clothes over a black wall used to get punched out, and in
the game those holes showed whatever stage is there = glitchy).  -> out_clean/<who>/<name>.png"""
import cv2, numpy as np, json, glob, re, os, sys
os.chdir('/tmp/claude-0/nf')
st = cv2.imread('stage/stage.png').astype(np.float32)
P = json.load(open('stage/stage.json')); CX0, CY0 = P['x0'], P['y0']
LIT = np.array([1.04, 2.0, 2.0], np.float32)
lit = np.clip(st * LIT, 0, 255)
BOX = {'opp': (10, 60, 460, 492), 'plr': (560, 230, 980, 530)}
JOBS = {'opp': {'idle': 360, 'left': 2384, 'down': 456, 'up': 392, 'right': 3075},
        'plr': {'idle': 3702, 'left': 3677, 'down': 3666, 'up': 592, 'right': 1233}}
from lightstate import light
T = float(os.environ.get('T', 24))
def affine(S, F):
    # least squares F = g*S + o per channel, twice (2nd pass drops the worst 20%: her leftovers, compression)
    g = np.ones(3, np.float32); o = np.zeros(3, np.float32)
    for c in range(3):
        x, y = S[:, c], F[:, c]
        for _ in range(2):
            A = np.stack([x, np.ones_like(x)], 1)
            sol = np.linalg.lstsq(A, y, rcond=None)[0]
            r = np.abs(A @ sol - y); k = r <= np.quantile(r, 0.8)
            x, y = x[k], y[k]
        g[c], o[c] = sol
    return g, o
def bycolour(S, F, ext, k=24):
    # the flash doesn't light every colour the same (the navy wall gets much bluer than the floor): the stage's own
    # colours are grouped, and each group takes the colour it has in this frame where she isn't
    flat = S.reshape(-1, 3)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    samp = flat[np.random.RandomState(0).choice(len(flat), min(len(flat), 40000), replace=False)]
    _, _, cen = cv2.kmeans(samp.astype(np.float32), k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
    lab = np.argmin(((flat[:, None, :] - cen[None]) ** 2).sum(-1), 1).reshape(S.shape[:2])
    out = S.copy()
    for c in range(k):
        m = lab == c; e = m & ext
        if e.sum() >= 150: out[m] = S[m] + (np.median(F[e], 0) - np.median(S[e], 0))
    return np.clip(out, 0, 255)
def fitted(S, F, ext, tile=96):
    h, w = ext.shape
    if ext.sum() < 500: return S
    G0, O0 = affine(S[ext], F[ext])
    ny, nx = (h + tile - 1) // tile, (w + tile - 1) // tile
    Gm = np.zeros((ny, nx, 3), np.float32); Om = np.zeros((ny, nx, 3), np.float32)
    for i in range(ny):
        for j in range(nx):
            y0, x0 = max(0, i * tile - tile // 2), max(0, j * tile - tile // 2)
            sl = (slice(y0, min(h, i * tile + tile + tile // 2)), slice(x0, min(w, j * tile + tile + tile // 2)))
            e = ext[sl]
            if e.sum() >= 400: Gm[i, j], Om[i, j] = affine(S[sl][e], F[sl][e])
            else: Gm[i, j], Om[i, j] = G0, O0
    Gu = cv2.resize(Gm, (w, h), interpolation=cv2.INTER_LINEAR); Ou = cv2.resize(Om, (w, h), interpolation=cv2.INTER_LINEAR)
    return np.clip(S * Gu + Ou, 0, 255)
only = sys.argv[1:]
os.makedirs('out_clean/opp', exist_ok=True); os.makedirs('out_clean/plr', exist_ok=True)
for who in ('opp', 'plr'):
    X0, Y0, X1, Y1 = BOX[who]
    ys, xs = (Y0 - CY0) * 2, (X0 - CX0) * 2
    for p in sorted(glob.glob(f'out/{who}/*_[0-9][0-9].png')):
        name = p.split('/')[-1][:-4]
        if only and f'{who}/{name}' not in only: continue
        anim, i = re.match(r'(\w+)_(\d+)', name).groups(); f = JOBS[who][anim] + int(i)
        a = cv2.imread(p, cv2.IMREAD_UNCHANGED); h, w = a.shape[:2]
        e = light(f)
        bg = np.zeros((h, w, 3), np.float32); hh, ww = min(h, st.shape[0] - ys), min(w, st.shape[1] - xs)
        bg[:hh, :ww] = st[ys:ys + hh, xs:xs + ww] * (1 - e) + lit[ys:ys + hh, xs:xs + ww] * e
        # (the light guess can be off a bit: the closest of normal / lit / this frame's light counts, plus the stage
        # fitted to this very frame: where she isn't, the frame IS the stage in this frame's light, so stage -> frame
        # colours get fitted (per channel, gain + offset) tile by tile and used as the stage under her too)
        d = np.full((h, w), 999, np.float32)
        px = a[:hh, :ww, :3].astype(np.float32)
        S = st[ys:ys + hh, xs:xs + ww]
        for b in (bg[:hh, :ww], S, lit[ys:ys + hh, xs:xs + ww], fitted(S, px, a[:hh, :ww, 3] <= 8), bycolour(S, px, a[:hh, :ww, 3] <= 8, ), ):
            d[:hh, :ww] = np.minimum(d[:hh, :ww], np.sqrt(((px - b) ** 2).sum(-1)))
        al = a[..., 3].copy()
        cand = ((d < T) & (al > 0)).astype(np.uint8)
        outside = (al <= 8).astype(np.uint8)
        # her black outline is a wall the flood can't cross (made a bit thicker so 1-px gaps don't leak); dark stage
        # bits stay (black on black: same in any light)
        dark = (a[..., :3].max(-1) < 60).astype(np.uint8)
        wall = cv2.dilate(dark, np.ones((3, 3), np.uint8), iterations=2)
        cand = cand & (1 - wall)
        # flood: stage-matching pixels connected (4-way) to the outside
        n, lab = cv2.connectedComponents(cand, connectivity=4)
        touch = cv2.dilate(outside, np.ones((3, 3), np.uint8)) & cand
        keep_ids = np.unique(lab[touch > 0]); keep_ids = keep_ids[keep_ids > 0]
        stage = np.isin(lab, keep_ids)
        # (then the rim next to the wall: stage-matching, not dark, within 3 px of what went)
        rim = cv2.dilate(stage.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=3) > 0
        stage |= rim & (d < T) & (dark == 0) & (al > 0)
        al[stage] = 0
        purple_gone = np.zeros(al.shape, bool)
        if who == 'opp':
            # she never wears purple / lavender: big purple pieces (or ones touching the outside) are the floor and
            # the ramp seen between her legs and arms. They'd stay dark when the stage flashes, so they go and the
            # stage shows there. (small purple bits on her jacket are the flash's tint on her: they stay)
            hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_BGR2HSV); hh, ss, vv = [hsv[..., c].astype(int) for c in range(3)]
            pm = ((hh >= 118) & (hh <= 160) & (ss >= 45) & (vv >= 120) & (al > 0)).astype(np.uint8)
            n3, lab3, st3, _ = cv2.connectedComponentsWithStats(pm, 8)
            near_out = cv2.dilate((al == 0).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            for c3 in range(1, n3):
                comp = lab3 == c3; area = st3[c3, cv2.CC_STAT_AREA]
                if area >= 300 or (area >= 30 and (comp & near_out).any()):
                    g3 = cv2.dilate(comp.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                    al[g3] = 0; purple_gone |= g3
        m = (al > 128).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, sts, _ = cv2.connectedComponentsWithStats(m, 8)
        if n > 1:
            big = sts[1:, cv2.CC_STAT_AREA].max()
            m = np.isin(lab, [k for k in range(1, n) if sts[k, cv2.CC_STAT_AREA] > 0.02 * big]).astype(np.uint8)
            if who == 'plr':
                # (pieces floating apart from her are left over from the arrows' streaks above her head: they go)
                bi = 1 + int(np.argmax(sts[1:, cv2.CC_STAT_AREA]))
                near = cv2.dilate((lab == bi).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
                for k in range(1, n):
                    if k != bi and not (near & (lab == k)).any(): m[lab == k] = 0
        # holes inside her (fully enclosed transparent bits) get filled back from the raw cut
        inv = (1 - m).astype(np.uint8)
        n2, lab2, sts2, _ = cv2.connectedComponentsWithStats(inv, 4)
        border = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])))
        holes = np.isin(lab2, [k for k in range(1, n2) if k not in border and sts2[k, cv2.CC_STAT_AREA] < 4000]) & (a[..., 3] > 128)
        if who == 'opp': holes &= ~purple_gone
        m[holes] = 1
        al = np.where(m > 0, np.maximum(al, np.where(holes, a[..., 3], 0)), 0).astype(np.uint8)
        al = np.minimum(al, (cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7) * 255).astype(np.uint8))
        a[..., 3] = al
        cv2.imwrite(p.replace('out/', 'out_clean/'), a)
    print(who, 'done', flush=True)
