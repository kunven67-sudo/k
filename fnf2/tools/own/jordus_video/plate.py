import cv2, numpy as np, json, sys
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # cam, H_at
who = sys.argv[1]
X0, Y0, X1, Y1 = {'opp': (10, 60, 390, 480), 'plr': (640, 240, 960, 520)}[who]
BAR = np.pad(np.ones((576 - 172, 1024), np.uint8), ((86, 86), (0, 0)))
# also never trust the strum band (notes), the HUD and the watermark
BAR[0:150, 580:1000] = 0; BAR[470:, :] = 0
cap = cv2.VideoCapture('v.mp4'); f = -1
S = []; V = []; idx = []
while True:
    ok, img = cap.read(); f += 1
    if not ok: break
    if f % 2: continue
    H = H_at(f)
    if H is None: continue
    T = (np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ H)[:2]
    v = cv2.warpAffine(BAR, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_NEAREST)
    if v.mean() < 0.3: continue
    S.append(cv2.warpAffine(img, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_AREA)); V.append(v); idx.append(f)
S = np.stack(S); V = np.stack(V).astype(bool)
print(who, S.shape)
bg = np.zeros(S.shape[1:], np.float32); frac = np.zeros(S.shape[1:3], np.float32); dev = np.zeros(S.shape[1:3], np.float32)
for y0 in range(0, S.shape[1], 24):
    s = S[:, y0:y0+24]; vv = V[:, y0:y0+24]
    q = (s >> 4).astype(np.int32); code = (q[..., 0] << 8) | (q[..., 1] << 4) | q[..., 2]
    junk = -1 - np.broadcast_to(np.arange(vv.shape[0])[:, None, None], vv.shape)
    code = np.where(vv, code, junk)
    srt = np.sort(code, axis=0); N = srt.shape[0]
    cur = np.ones(srt.shape[1:], np.int32); best = np.ones(srt.shape[1:], np.int32); bestc = srt[0].copy()
    for i in range(1, N):
        cur = np.where(srt[i] == srt[i-1], cur + 1, 1)
        upd = cur > best; best = np.where(upd, cur, best); bestc = np.where(upd, srt[i], bestc)
    frac[y0:y0+24] = best / np.maximum(1, vv.sum(0))
    sel = (code == bestc[None]) & vv
    sf = s.astype(np.float32)
    b = (sf * sel[..., None]).sum(0) / np.maximum(1, sel.sum(0))[..., None]
    bg[y0:y0+24] = b
    dev[y0:y0+24] = np.sqrt((((sf - b[None]) ** 2).sum(-1) * sel).sum(0) / np.maximum(1, sel.sum(0)))
np.save(f'plate_{who}.npy', bg); np.save(f'plate_{who}_frac.npy', frac); np.save(f'plate_{who}_dev.npy', dev)
cv2.imwrite(f'plate_{who}.png', bg.astype(np.uint8))
cv2.imwrite(f'plate_{who}_frac.png', (np.clip(frac, 0, 1) * 255).astype(np.uint8))
print('frac p5 %.2f p50 %.2f' % tuple(np.percentile(frac, [5, 50])))
