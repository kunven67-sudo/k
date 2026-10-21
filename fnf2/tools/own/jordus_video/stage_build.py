"""Finish the stage picture: under the girls, take the colour from the cut-out frames where she wasn't there;
what was never seen gets painted in from around it; then the anime upscaler, 2x the reference frame."""
import cv2, numpy as np, json, glob, os, sys, re
os.chdir('/tmp/claude-0/nf'); sys.path.insert(0, 'tools')
from esrgan import upscale_fast
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # cam + H_at
P = json.load(open('pano.json')); CX0, CY0, CX1, CY1 = P['x0'], P['y0'], P['x1'], P['y1']
W, Hh = CX1 - CX0, CY1 - CY0
pano = np.load('pano.npy'); cnt = np.load('pano_cnt.npy')
BOX = {'opp': (10, 60, 390, 492), 'plr': (640, 240, 960, 520)}
JOBS = {'opp': {'idle': 360, 'left': 2384, 'down': 2672, 'up': 2744, 'right': 3075},
        'plr': {'idle': 3702, 'left': 3677, 'down': 3666, 'up': 901, 'right': 3213}}
cap = cv2.VideoCapture('v.mp4')
union = np.zeros((Hh, W), bool)
acc = np.zeros((Hh, W, 3), np.float64); n = np.zeros((Hh, W), np.float64)
for who in ('opp', 'plr'):
    X0, Y0, X1, Y1 = BOX[who]
    for p in sorted(glob.glob(f'out/{who}/*_[0-9][0-9].png')):
        anim, i = re.match(r'.*/(\w+)_(\d+)\.png', p).groups(); f = JOBS[who][anim] + int(i)
        a = cv2.imread(p, cv2.IMREAD_UNCHANGED)[..., 3]
        a = cv2.resize(a, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_AREA) > 20
        a = cv2.dilate(a.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0       # (a little margin: her edges)
        m = np.zeros((Hh, W), bool); m[Y0 - CY0:Y1 - CY0, X0 - CX0:X1 - CX0] = a[:Hh - (Y0 - CY0), :W - (X0 - CX0)]
        union |= m
        cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, img = cap.read()
        T = (np.array([[1, 0, -CX0], [0, 1, -CY0], [0, 0, 1]]) @ H_at(f))[:2]
        wimg = cv2.warpAffine(img, T, (W, Hh), flags=cv2.INTER_AREA)
        BAR = np.zeros((576, 1024), np.uint8); BAR[86:490] = 1; BAR[0:160, 570:1010] = 0; BAR[:, 590:965] = 0
        v = cv2.warpAffine(BAR, T, (W, Hh), flags=cv2.INTER_NEAREST) > 0
        use = v & ~m
        acc[use] += wimg[use]; n[use] += 1
# both girls' boxes: union of every pose she takes = where the mode could be her
ch = union.copy()
fill = ch & (n >= 2)
out = pano.copy()
out[fill] = (acc[fill] / n[fill][:, None])
hole = ((ch & (n < 2)) | (cnt == 0)).astype(np.uint8)
img = cv2.inpaint(out.astype(np.uint8), hole, 6, cv2.INPAINT_TELEA)
cv2.imwrite('stage_ref.png', img)
os.makedirs('stage', exist_ok=True)
up = upscale_fast(img)
st = cv2.resize(up, (W * 2, Hh * 2), interpolation=cv2.INTER_AREA)
cv2.imwrite('stage/stage.png', st)
json.dump(dict(x0=CX0, y0=CY0, k=2), open('stage/stage.json', 'w'))
cv2.imwrite('stage_holes.png', hole * 255)
print('stage', st.shape, 'filled under the girls', int(fill.sum()), 'painted', int(hole.sum()))
