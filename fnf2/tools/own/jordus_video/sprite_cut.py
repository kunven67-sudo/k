"""Cut one character's animation frames out of the video: ESRGAN x4 on the source frame, warp into ref x2 world
coords (camera removed), BiRefNet mask + stage-plate check, clean edges. -> out/<who>/<anim>_<n>.png (same size)."""
import cv2, numpy as np, json, sys, os
sys.path.insert(0, '/tmp/claude-0/nf/tools')
from esrgan import upscale_fast as upscale
from rembg import new_session, remove
os.chdir('/tmp/claude-0/nf')
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # cam + H_at
BOX = {'opp': (10, 60, 390, 492), 'plr': (640, 240, 960, 520)}
K = 2   # output scale vs ref coords
sess = new_session('birefnet-general-lite', providers=['CPUExecutionProvider'])
cap = cv2.VideoCapture('v.mp4')
def frame(f):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, img = cap.read(); return img
def cut(who, f, name, dbg=False):
    X0, Y0, X1, Y1 = BOX[who]; W, Hh = X1 - X0, Y1 - Y0
    img = frame(f); H = H_at(f)
    plate = np.load(f'plate_{who}.npy'); pfrac = np.load(f'plate_{who}_frac.npy'); pdev = np.load(f'plate_{who}_dev.npy')
    if plate.shape[0] < Hh:     # (box grew after the plate was made: no stage check there)
        e = Hh - plate.shape[0]
        plate = np.pad(plate, ((0, e), (0, 0), (0, 0))); pfrac = np.pad(pfrac, ((0, e), (0, 0))); pdev = np.pad(pdev, ((0, e), (0, 0)))
    T = (np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ H)                      # frame -> box (ref px)
    # native warp for the mask
    nat = cv2.warpAffine(img, T[:2], (W, Hh), flags=cv2.INTER_LINEAR)
    BAR = np.zeros((576, 1024), np.uint8); BAR[86:490] = 1
    valid = cv2.warpAffine(BAR, T[:2], (W, Hh), flags=cv2.INTER_NEAREST) > 0
    m = np.array(remove(nat[:, :, ::-1].copy(), session=sess, only_mask=True)).astype(np.float32) / 255
    d = np.sqrt(((nat.astype(np.float32) - plate) ** 2).sum(-1))
    pv = plate.max(-1)                       # only bright background can be trusted (her outfit is black)
    isbg = (pfrac > 0.4) & (pv > 110) & (d < np.maximum(28, 2.5 * pdev + 10))
    if who == 'plr': isbg[:] = False        # (she never leaves her spot: the plate there is her own legs)
    m[isbg] = np.minimum(m[isbg], 0.15)
    m[~valid] = 0
    mb = (m > 0.5).astype(np.uint8)
    if who == 'opp':
        # her glowing goggles (the mask model thinks glow is background): add glowing goggle colours near her
        hsv = cv2.cvtColor(nat, cv2.COLOR_BGR2HSV); hu, sa, va = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        glow = (sa > 150) & (va > 190) & (((hu >= 42) & (hu <= 102)) | ((hu >= 140) & (hu <= 168)) | (hu <= 5) | (hu >= 176))
        near = cv2.dilate(mb, np.ones((25, 25), np.uint8)) > 0
        gl = (glow & near & valid).astype(np.uint8)
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(gl, 8)
        for i in range(1, n2):
            if st2[i, cv2.CC_STAT_AREA] >= 12: mb[lab2 == i] = 1
    n, lab, st, _ = cv2.connectedComponentsWithStats(mb, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.03 * big]
        mb = np.isin(lab, keep).astype(np.uint8)
    # thin bits that are really the stage (the ramp's black edge behind her): thin = what an opening takes away;
    # those that look like the stage plate there go
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    thin = (mb > 0) & (cv2.morphologyEx(mb, cv2.MORPH_OPEN, k) == 0)
    stagey = (pfrac > 0.3) & (d < np.maximum(34, 2.5 * pdev + 14))
    if who == 'plr': stagey &= plate.max(-1) < 90    # (only the dark lines behind her)
    mb[thin & stagey] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(mb, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        mb = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.03 * big]).astype(np.uint8)
    # fill holes
    ff = mb.copy(); h2, w2 = ff.shape; fm = np.zeros((h2 + 2, w2 + 2), np.uint8); cv2.floodFill(ff, fm, (0, 0), 1)
    holes = (ff == 0); mb[holes & (m > 0.2)] = 1
    # upscaled colour: region of the source frame that covers the box
    Ti = np.linalg.inv(T); cs = np.array([[0, 0, 1], [W, 0, 1], [0, Hh, 1], [W, Hh, 1]]) @ Ti.T
    rx0 = int(max(0, cs[:, 0].min() - 8)); ry0 = int(max(0, cs[:, 1].min() - 8))
    rx1 = int(min(1024, cs[:, 0].max() + 8)); ry1 = int(min(576, cs[:, 1].max() + 8))
    up = upscale(img[ry0:ry1, rx0:rx1])
    # up px -> frame px -> box px -> out px
    U = np.array([[0.25, 0, rx0], [0, 0.25, ry0], [0, 0, 1]])
    M = np.diag([K, K, 1]) @ T @ U
    col = cv2.warpAffine(up, M[:2], (W * K, Hh * K), flags=cv2.INTER_AREA)
    a = cv2.resize(mb.astype(np.float32), (W * K, Hh * K), interpolation=cv2.INTER_LINEAR)
    a = cv2.GaussianBlur(a, (3, 3), 0.8)
    a = np.clip((a - 0.35) / 0.3, 0, 1)
    out = np.dstack([col, (a * 255).astype(np.uint8)])
    os.makedirs(f'out/{who}', exist_ok=True)
    cv2.imwrite(f'out/{who}/{name}.png', out)
    if dbg:
        vis = nat.copy(); vis[mb == 0] = (vis[mb == 0] * 0.25 + np.array([0, 180, 0]) * 0.75).astype(np.uint8)
        cv2.imwrite(f'out/{who}/dbg_{name}.png', vis)
    return out
if __name__ == '__main__':
    who, f, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    cut(who, f, name, dbg=True)
