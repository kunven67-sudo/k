"""Last pass on the cut-out frames: a pixel that matches the stage at that exact spot (in that frame's light: the
stage flashes bright on beats in two parts of the song) IS stage, so it goes transparent. She is drawn at the same
spot on the same stage in the game, so nothing that differs ever shows through. -> out_clean/<who>/<name>.png"""
import cv2, numpy as np, json, glob, re, os
os.chdir('/tmp/claude-0/nf')
st = cv2.imread('stage/stage.png').astype(np.float32)
P = json.load(open('stage/stage.json')); CX0, CY0 = P['x0'], P['y0']
LIT = np.array([1.04, 2.0, 2.0], np.float32)                # the flash multiplies the stage (BGR), measured on the floor + sky
lit = np.clip(st * LIT, 0, 255)
BOX = {'opp': (10, 60, 460, 492), 'plr': (640, 240, 960, 520)}
JOBS = {'opp': {'idle': 360, 'left': 2384, 'down': 2672, 'up': 2744, 'right': 3075},
        'plr': {'idle': 3702, 'left': 3677, 'down': 3666, 'up': 901, 'right': 3213}}
L = json.load(open('light.json'))
fl = {r['f']: np.mean(r['floor']) for r in L if 'floor' in r}; sk = {r['f']: np.mean(r['sky']) for r in L if 'sky' in r}
def light(f):
    for d in (0, -1, 1, -2, 2):
        if f + d in fl: return float(np.clip((fl[f + d] - 154) / (212 - 154), 0, 1))
    for d in (0, -1, 1, -2, 2):
        if f + d in sk: return float(np.clip((sk[f + d] - 118) / (162 - 118), 0, 1))
    return 0.0
os.makedirs('out_clean/opp', exist_ok=True); os.makedirs('out_clean/plr', exist_ok=True)
for who in ('opp', 'plr'):
    X0, Y0, X1, Y1 = BOX[who]
    ys, xs = (Y0 - CY0) * 2, (X0 - CX0) * 2
    for p in sorted(glob.glob(f'out/{who}/*_[0-9][0-9].png')):
        anim, i = re.match(r'.*/(\w+)_(\d+)\.png', p).groups(); f = JOBS[who][anim] + int(i)
        a = cv2.imread(p, cv2.IMREAD_UNCHANGED); h, w = a.shape[:2]
        e = light(f)
        bg = (st[ys:ys + h, xs:xs + w] * (1 - e) + lit[ys:ys + h, xs:xs + w] * e)
        hh, ww = bg.shape[:2]
        d = np.full((h, w), 999, np.float32)
        d[:hh, :ww] = np.sqrt(((a[:hh, :ww, :3].astype(np.float32) - bg) ** 2).sum(-1))
        al = a[..., 3].copy()
        stage = (d < 22) & (al > 0)
        al[stage] = 0
        m = (al > 128).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, sts, _ = cv2.connectedComponentsWithStats(m, 8)
        if n > 1:
            big = sts[1:, cv2.CC_STAT_AREA].max()
            m = np.isin(lab, [k for k in range(1, n) if sts[k, cv2.CC_STAT_AREA] > 0.02 * big]).astype(np.uint8)
        al = np.minimum(al, (cv2.GaussianBlur(m.astype(np.float32), (3, 3), 0.7) * 255).astype(np.uint8))
        a[..., 3] = al
        cv2.imwrite(p.replace('out/', 'out_clean/'), a)
    print(who, 'done', flush=True)
