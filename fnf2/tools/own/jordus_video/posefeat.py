import numpy as np, cv2, json
exec(open('goggles.py').read().split("cap = cv2.VideoCapture")[0])
cap = cv2.VideoCapture('v.mp4')
FX0, FY0, FX1, FY1 = 40 - X0, 112 - Y0, 360 - X0, 348 - Y0    # always-visible part of her box
feats = []; f = -1
while True:
    ok, img = cap.read(); f += 1
    if not ok: break
    c, v = warp(img, f)
    if c is None or v[FY0:FY1, FX0:FX1].mean() < 0.97: feats.append(None); continue
    g = cv2.cvtColor(c[FY0:FY1, FX0:FX1], cv2.COLOR_BGR2HSV)
    dark = (g[..., 2] < 70).astype(np.float32)            # her black outfit + outlines
    white = ((g[..., 1] < 60) & (g[..., 2] > 200)).astype(np.float32)   # hands, shoes, face
    red = (((g[..., 0] < 8) | (g[..., 0] > 170)) & (g[..., 1] > 150) & (g[..., 2] > 150)).astype(np.float32)
    ft = np.concatenate([cv2.resize(x, (32, 24), interpolation=cv2.INTER_AREA).ravel() for x in (dark, white, red)])
    feats.append(ft)
idx = [i for i, x in enumerate(feats) if x is not None]
np.save('pose_X.npy', np.stack([feats[i] for i in idx])); np.save('pose_i.npy', np.array(idx))
print(len(idx), 'frames with features')
