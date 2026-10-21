"""Cut one character's animation frames out of the video: ESRGAN x4 on the source frame, warp into ref x2 world
coords (camera removed), BiRefNet mask + stage-plate check, clean edges. -> out/<who>/<anim>_<n>.png (same size)."""
import cv2, numpy as np, json, sys, os
sys.path.insert(0, '/tmp/claude-0/nf/tools')
from esrgan import upscale_fast as upscale
from rembg import new_session, remove
os.chdir('/tmp/claude-0/nf')
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # cam + H_at
BOX = {'opp': (10, 60, 460, 492), 'plr': (560, 230, 980, 530)}
# (the stage plates were made for the first, smaller boxes: they get placed into the bigger box)
PLATE_BOX = {'opp': (10, 60, 460, 492), 'plr': (640, 240, 960, 520)}
K = 2   # output scale vs ref coords
import onnxruntime as ort
from rembg.sessions.birefnet_general_lite import BiRefNetSessionGeneralLite
_so = ort.SessionOptions(); _so.enable_cpu_mem_arena = False; _so.enable_mem_pattern = False   # (the arena leaks: OOM after ~22 frames)
sess = BiRefNetSessionGeneralLite('birefnet-general-lite', _so, providers=['CPUExecutionProvider'])
cap = cv2.VideoCapture('v.mp4')
def frame(f):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, img = cap.read(); return img
def cut(who, f, name, dbg=False):
    X0, Y0, X1, Y1 = BOX[who]; W, Hh = X1 - X0, Y1 - Y0
    img = frame(f); H = H_at(f)
    plate = np.load(f'plate_{who}.npy'); pfrac = np.load(f'plate_{who}_frac.npy'); pdev = np.load(f'plate_{who}_dev.npy')
    if plate.shape[:2] != (Hh, W):     # (box grew after the plate was made: no stage check outside the old box)
        px0, py0 = PLATE_BOX[who][0] - X0, PLATE_BOX[who][1] - Y0
        def place(a):
            o = np.zeros((Hh, W) + a.shape[2:], a.dtype); h, w = min(a.shape[0], Hh - py0), min(a.shape[1], W - px0)
            o[py0:py0 + h, px0:px0 + w] = a[:h, :w]; return o
        plate, pfrac, pdev = place(plate), place(pfrac), place(pdev)
    T = (np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ H)                      # frame -> box (ref px)
    # native warp for the mask
    nat = cv2.warpAffine(img, T[:2], (W, Hh), flags=cv2.INTER_LINEAR)
    BAR = np.zeros((576, 1024), np.uint8); BAR[86:490] = 1
    valid = cv2.warpAffine(BAR, T[:2], (W, Hh), flags=cv2.INTER_NEAREST) > 0
    m = np.array(remove(nat[:, :, ::-1].copy(), session=sess, only_mask=True)).astype(np.float32) / 255
    m[~valid] = 0
    mb = (m > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mb, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        mb = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.03 * big]).astype(np.uint8)
    # upscaled colour: region of the source frame that covers the box
    Ti = np.linalg.inv(T); cs = np.array([[0, 0, 1], [W, 0, 1], [0, Hh, 1], [W, Hh, 1]]) @ Ti.T
    rx0 = int(max(0, cs[:, 0].min() - 8)); ry0 = int(max(0, cs[:, 1].min() - 8))
    rx1 = int(min(1024, cs[:, 0].max() + 8)); ry1 = int(min(576, cs[:, 1].max() + 8))
    up = upscale(img[ry0:ry1, rx0:rx1])
    U = np.array([[0.25, 0, rx0], [0, 0.25, ry0], [0, 0, 1]])
    M = np.diag([K, K, 1]) @ T @ U
    col = cv2.warpAffine(up, M[:2], (W * K, Hh * K), flags=cv2.INTER_AREA)
    # her black outline is the edge: everything the background reaches without crossing black goes (the dark
    # buildings, the white ramp, halos), done big where the upscaler made the outlines solid lines
    M2 = cv2.resize(mb, (W * K, Hh * K), interpolation=cv2.INTER_NEAREST)
    valid2 = cv2.resize(valid.astype(np.uint8), (W * K, Hh * K), interpolation=cv2.INTER_NEAREST) > 0
    v2 = cv2.cvtColor(col, cv2.COLOR_BGR2HSV)[..., 2]
    black = cv2.dilate((v2 < 70).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    reach = ((~black & (M2 > 0)) | (M2 == 0)).astype(np.uint8)
    n3, lab3 = cv2.connectedComponents(reach, connectivity=4)
    outside = np.unique(lab3[(M2 == 0) & valid2])
    # (not used: through tiny gaps in an outline it ate faces and hair; leftovers sit on the same stage anyway and
    # cleanup.py removes what matches the stage)
    if who == 'plr':
        # thin bits that are really the stage (the ramp's black edge behind her)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
        thin = (M2 > 0) & (cv2.morphologyEx(M2, cv2.MORPH_OPEN, k) == 0)
        pl2 = cv2.resize(plate, (W * K, Hh * K)); pf2 = cv2.resize(pfrac, (W * K, Hh * K))
        dd = np.sqrt(((col.astype(np.float32) - pl2) ** 2).sum(-1))
        M2[thin & (pf2 > 0.3) & (dd < 45) & (pl2.max(-1) < 90)] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(M2, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        M2 = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.02 * big]).astype(np.uint8)
    if who == 'opp':
        # her glowing goggles (glow is not inside an outline): glowing goggle colours near her come back
        hsv = cv2.cvtColor(col, cv2.COLOR_BGR2HSV); hu, sa, va = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        glow = (sa > 150) & (va > 190) & (((hu >= 42) & (hu <= 102)) | ((hu >= 140) & (hu <= 168)) | (hu <= 5) | (hu >= 176))
        near = cv2.dilate(M2, np.ones((41, 41), np.uint8)) > 0
        gl = (glow & near & valid2).astype(np.uint8)
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(gl, 8)
        for i in range(1, n2):
            if st2[i, cv2.CC_STAT_AREA] >= 50 and (M2[lab2 == i] > 0).any() or st2[i, cv2.CC_STAT_AREA] >= 400: M2[lab2 == i] = 1
    # holes inside her (enclosed) are hers
    ff = M2.copy(); fm = np.zeros((M2.shape[0] + 2, M2.shape[1] + 2), np.uint8); cv2.floodFill(ff, fm, (0, 0), 1)
    M2[(ff == 0)] = 1
    a = cv2.GaussianBlur(M2.astype(np.float32), (3, 3), 0.7)
    a = np.clip((a - 0.3) / 0.4, 0, 1)
    out = np.dstack([col, (a * 255).astype(np.uint8)])
    os.makedirs(f'out/{who}', exist_ok=True)
    cv2.imwrite(f'out/{who}/{name}.png', out)
    if dbg:
        vis = col.copy(); vis[M2 == 0] = (vis[M2 == 0] * 0.25 + np.array([0, 180, 0]) * 0.75).astype(np.uint8)
        cv2.imwrite(f'out/{who}/dbg_{name}.png', vis)
    return out
if __name__ == '__main__':
    who, f, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    cut(who, f, name, dbg=True)
