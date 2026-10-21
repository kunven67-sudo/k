# the player's box grew (her LEFT hand went past its edge): every cut frame made for the old box is placed into the new one
import cv2, numpy as np, glob, os
OLD, NEW = (640, 240, 960, 520), (560, 230, 980, 530)
dx, dy = (OLD[0] - NEW[0]) * 2, (OLD[1] - NEW[1]) * 2; W, H = (NEW[2] - NEW[0]) * 2, (NEW[3] - NEW[1]) * 2
n = 0
for d in ('out', 'out_raw', 'out_clean'):
    for p in glob.glob(f'{d}/plr/*.png'):
        a = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        if a.shape[:2] == (H, W): continue
        assert a.shape[:2] == ((OLD[3] - OLD[1]) * 2, (OLD[2] - OLD[0]) * 2), (p, a.shape)
        o = np.zeros((H, W, 4), np.uint8); o[dy:dy + a.shape[0], dx:dx + a.shape[1]] = a
        cv2.imwrite(p, o); n += 1
print('padded', n)
