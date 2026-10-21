"""A clean stage behind her: ~100 wide-shot frames in all her poses, each masked by the cut-out model (her +
a margin), the stage colour per pixel = median of the frames where she wasn't there."""
import cv2, numpy as np, json, os, sys
os.chdir('/tmp/claude-0/nf')
from rembg import new_session, remove
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])
who = sys.argv[1] if len(sys.argv) > 1 else 'opp'
X0, Y0, X1, Y1 = {'opp': (10, 60, 390, 492), 'plr': (640, 240, 960, 520)}[who]
P = json.load(open('pose_pred.json'))
sys.path.insert(0, '/tmp/claude-0/nf'); from lightstate import light
pick = []
for cls in range(4):
    c = [i for i, p, cf in zip(P['i'], P['p'], P['conf']) if p == cls and cf >= 0.8 and i in Hs and abs(np.hypot(Hs[i][0, 0], Hs[i][1, 0]) - 1) < 0.06 and light(i) < 0.08]
    pick += c[::max(1, len(c) // 26)][:26]
print('frames', len(pick))
import onnxruntime as ort
from rembg.sessions.birefnet_general_lite import BiRefNetSessionGeneralLite
_so = ort.SessionOptions(); _so.enable_cpu_mem_arena = False; _so.enable_mem_pattern = False   # (the arena leaks: OOM after ~22 frames)
sess = BiRefNetSessionGeneralLite('birefnet-general-lite', _so, providers=['CPUExecutionProvider'])
cap = cv2.VideoCapture('v.mp4')
BAR = np.zeros((576, 1024), np.uint8); BAR[86:490] = 1; BAR[0:160, 570:1010] = 0
S, M = [], []
for f in sorted(pick):
    cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, img = cap.read()
    T = (np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ Hs[f])[:2]
    nat = cv2.warpAffine(img, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR)
    v = cv2.warpAffine(BAR, T, (X1 - X0, Y1 - Y0), flags=cv2.INTER_NEAREST) > 0
    m = np.array(remove(nat[:, :, ::-1].copy(), session=sess, only_mask=True)) > 60
    m = cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    S.append(nat); M.append(v & ~m)
S = np.stack(S).astype(np.float32); M = np.stack(M)
Sm = np.where(M[..., None], S, np.nan)
plate = np.nanmedian(Sm, axis=0); n = M.sum(0)
dev = np.nanmedian(np.abs(Sm - plate[None]), axis=0).max(-1)
np.save(f'plate2_{who}.npy', np.nan_to_num(plate)); np.save(f'plate2_{who}_n.npy', n); np.save(f'plate2_{who}_dev.npy', np.nan_to_num(dev, nan=99))
cv2.imwrite(f'plate2_{who}.png', np.nan_to_num(plate).astype(np.uint8)); cv2.imwrite(f'plate2_{who}_n.png', (np.clip(n / 10, 0, 1) * 255).astype(np.uint8))
print('known', round(float((n >= 3).mean()), 3))
