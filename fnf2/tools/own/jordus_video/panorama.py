"""The whole stage as one picture in ref coords (the 90 s frame's pixels): every 8th tracked frame warped in,
per-pixel most-common colour (characters move, notes fly by, so the stage wins), HUD areas never used."""
import cv2, numpy as np, json, os
os.chdir('/tmp/claude-0/nf')
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # cam + H_at
# canvas: union of everything the camera ever showed (between the bars)
keys = sorted(int(k) for k in cam)
xs, ys = [], []
for k in keys:
    H = Hs[k]
    for p in ((0, 86), (1024, 86), (0, 490), (1024, 490)):
        q = H @ [p[0], p[1], 1]; xs.append(q[0]); ys.append(q[1])
CX0, CY0 = int(np.floor(min(xs))) - 2, int(np.floor(min(ys))) - 2
CX1, CY1 = int(np.ceil(max(xs))) + 2, int(np.ceil(max(ys))) + 2
print('canvas', CX0, CY0, CX1, CY1)
VALID = np.zeros((576, 1024), np.uint8); VALID[86:490] = 1
VALID[0:160, 570:1010] = 0; VALID[455:, 0:210] = 0; VALID[455:, 830:] = 0     # arrows, TikTok mark corners
cap = cv2.VideoCapture('v.mp4'); f = -1
W, Hh = CX1 - CX0, CY1 - CY0
stack, vals = [], []
br = np.load('bright.npy')
import sys; sys.path.insert(0, '/tmp/claude-0/nf'); from lightstate import light
while True:
    ok, img = cap.read(); f += 1
    if not ok: break
    if f % 8 or f not in Hs or br[f] < 40 or light(f) > 0.08: continue      # (normal light only: the flash goes on top in the game)
    T = (np.array([[1, 0, -CX0], [0, 1, -CY0], [0, 0, 1]]) @ Hs[f])[:2]
    # notes: mask the 4 lane columns over the whole height too
    v = VALID
    stack.append(cv2.warpAffine(img, T, (W, Hh), flags=cv2.INTER_AREA))
    vals.append(cv2.warpAffine(v, T, (W, Hh), flags=cv2.INTER_NEAREST))
S = np.stack(stack); V = np.stack(vals).astype(bool)
print('frames', S.shape)
bg = np.zeros(S.shape[1:], np.float32); frac = np.zeros(S.shape[1:3], np.float32); cnt = V.sum(0)
for y0 in range(0, Hh, 16):
    s = S[:, y0:y0+16]; vv = V[:, y0:y0+16]
    q = (s >> 4).astype(np.int32); code = (q[..., 0] << 8) | (q[..., 1] << 4) | q[..., 2]
    code = np.where(vv, code, -1 - np.broadcast_to(np.arange(vv.shape[0])[:, None, None], vv.shape))
    srt = np.sort(code, axis=0)
    cur = np.ones(srt.shape[1:], np.int32); best = np.ones(srt.shape[1:], np.int32); bestc = srt[0].copy()
    for i in range(1, srt.shape[0]):
        cur = np.where(srt[i] == srt[i-1], cur + 1, 1)
        upd = cur > best; best = np.where(upd, cur, best); bestc = np.where(upd, srt[i], bestc)
    frac[y0:y0+16] = best / np.maximum(1, vv.sum(0))
    sel = (code == bestc[None]) & vv
    bg[y0:y0+16] = (s.astype(np.float32) * sel[..., None]).sum(0) / np.maximum(1, sel.sum(0))[..., None]
np.save('pano.npy', bg); np.save('pano_frac.npy', frac); np.save('pano_cnt.npy', cnt)
json.dump(dict(x0=CX0, y0=CY0, x1=CX1, y1=CY1), open('pano.json', 'w'))
cv2.imwrite('pano.png', bg.astype(np.uint8)); cv2.imwrite('pano_frac.png', (np.clip(frac, 0, 1) * 255).astype(np.uint8))
