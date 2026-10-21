import cv2, numpy as np, sys
sys.path.insert(0, 'tools'); from esrgan import upscale_fast
cap = cv2.VideoCapture('v.mp4')
def frame(t): cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t*30))); ok, f = cap.read(); return f
def cut(f, box, keep):
    x0, y0, x1, y1 = box
    c = f[y0:y1, x0:x1]; h = cv2.cvtColor(c, cv2.COLOR_BGR2HSV)
    hu, s, v = h[..., 0].astype(int), h[..., 1].astype(int), h[..., 2].astype(int)
    m = keep(hu, s, v).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    # the health bar runs in from the left edge behind the icon: clear each row's run that starts at the edge
    for y in range(m.shape[0]):
        if m[y, 0] or m[y, 1]:
            x = 0
            while x < m.shape[1] and (m[y, x] or (x + 1 < m.shape[1] and m[y, x + 1])): m[y, x] = 0; x += 1
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    m = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.012 * st[big, cv2.CC_STAT_AREA]]).astype(np.uint8)
    ff = m.copy(); fm = np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8); cv2.floodFill(ff, fm, (0, 0), 1); m[ff == 0] = 1
    out = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    up = upscale_fast(c); m4 = cv2.resize(m, (up.shape[1], up.shape[0]), interpolation=cv2.INTER_LINEAR)
    o4 = cv2.resize(out.astype(np.float32), (up.shape[1], up.shape[0]), interpolation=cv2.INTER_LINEAR)
    rgb = up.copy(); ring = (o4 > 0.5) & (m4 < 0.5); rgb[ring] = (10, 8, 12)
    a = np.clip((o4 - 0.3) / 0.4, 0, 1)
    return np.dstack([rgb, (a * 255).astype(np.uint8)])
red = lambda hu, s, v: ((hu <= 12) | (hu >= 168)) & (s > 110) & (v > 80)
pinkwhite = lambda hu, s, v: (v > 110) & ~((hu >= 95) & (hu <= 150) & (s > 60)) & ~((hu >= 30) & (hu <= 92) & (s > 70)) & ~(((hu <= 12) | (hu >= 170)) & (s > 175))
def square(im, size=150, pad=6):
    ys, xs = np.where(im[..., 3] > 10); im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = (size - 2 * pad) / max(im.shape[:2]); im = cv2.resize(im, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    out = np.zeros((size, size, 4), np.uint8); y = size - pad - im.shape[0]; x = (size - im.shape[1]) // 2
    out[y:y + im.shape[0], x:x + im.shape[1]] = im; return out
f1, f2 = frame(1.75), frame(60.0)
opp_n = square(cut(f1, (410, 474, 526, 552), red)); opp_l = square(cut(f2, (160, 474, 278, 552), red))
plr_n = square(cut(f2, (252, 474, 362, 552), pinkwhite))
cv2.imwrite('icons/icon-nightly-opp.png', np.hstack([opp_n, opp_l]))
cv2.imwrite('icons/icon-nightly-player.png', np.hstack([plr_n, plr_n]))
def show(p):
    a = cv2.imread(p, cv2.IMREAD_UNCHANGED); al = a[..., 3:4] / 255.; bg = np.full_like(a[..., :3], 90)
    return (a[..., :3] * al + bg * (1 - al)).astype(np.uint8)
cv2.imwrite('icons/preview.png', np.hstack([show('icons/icon-nightly-opp.png'), show('icons/icon-nightly-player.png')]))
