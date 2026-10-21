import cv2, numpy as np, json
cam = json.load(open('cam.json'))
keys = sorted(int(k) for k in cam)
Hs = {k: np.vstack([np.array(cam[str(k)]['H']), [0, 0, 1]]) for k in keys}
def H_at(f):
    if f in Hs: return Hs[f]
    a = max([k for k in keys if k < f], default=None); b = min([k for k in keys if k > f], default=None)
    if a is None or b is None or b - a > 4: return None
    w = (f - a) / (b - a); return Hs[a] * (1 - w) + Hs[b] * w
X0, Y0, X1, Y1 = 30, 80, 370, 450
BAR = np.pad(np.ones((576 - 172, 1024), np.uint8), ((86, 86), (0, 0)))
def warp(img, f):
    H = H_at(f)
    if H is None: return None, None
    T = (np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ H)[:2]
    c = cv2.warpAffine(img, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR)
    v = cv2.warpAffine(BAR, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_NEAREST)
    return c, v
cap = cv2.VideoCapture('v.mp4')
frames = []
while True:
    ok, img = cap.read()
    if not ok: break
    frames.append(img)
# background: per-pixel median of warped frames (every 9th frame), only valid pixels
stack = []; vals = []
for f in range(0, len(frames), 9):
    c, v = warp(frames[f], f)
    if c is not None: stack.append(c.astype(np.float32)); vals.append(v)
stack = np.stack(stack); vals = np.stack(vals).astype(bool)
stack[~vals] = np.nan
bg = np.nanmedian(stack, axis=0); bg = np.nan_to_num(bg, nan=0).astype(np.float32)
cv2.imwrite('opp_bg.png', bg.astype(np.uint8))
rows = []
for f, img in enumerate(frames):
    c, v = warp(img, f)
    if c is None: rows.append(None); continue
    h = cv2.cvtColor(c, cv2.COLOR_BGR2HSV); hu, s, vv = h[..., 0].astype(int), h[..., 1].astype(int), h[..., 2].astype(int)
    diff = np.abs(c.astype(np.float32) - bg).sum(2) > 90
    ok = (v > 0) & diff
    r = {'valid': float(v.mean())}
    r['U'] = int((ok & (hu >= 48) & (hu <= 78) & (s >= 200) & (vv >= 150)).sum())
    r['D'] = int((ok & (hu >= 82) & (hu <= 100) & (s >= 170) & (vv >= 200)).sum())
    r['L'] = int((ok & (hu >= 143) & (hu <= 162) & (s >= 160) & (vv >= 245)).sum())
    r['R'] = int((ok & ((hu <= 5) | (hu >= 177)) & (s >= 200) & (vv >= 250)).sum())
    rows.append(r)
json.dump(rows, open('goggles.json', 'w'))
print(len(rows))
