"""Her pose on every frame: kNN on posefeat.py's features, taught only by WIDE shots where her goggle colour is
clear (zoomed shots hide her goggles under the bottom bar, and her red jacket then reads as red goggles)."""
import numpy as np, json
from numpy.linalg import norm
X = np.load('pose_X.npy'); I = np.load('pose_i.npy'); rows = json.load(open('goggles.json'))
lab = []
for i in I:
    r = rows[i]
    if not r or r['valid'] < 0.97: lab.append(-1); continue
    v = np.array([r['L'], r['D'], r['U'], r['R']]); o = np.argsort(-v)
    lab.append(int(o[0]) if v[o[0]] > 250 and v[o[1]] < 0.25 * v[o[0]] else -1)
lab = np.array(lab); C = X[lab >= 0]; y = lab[lab >= 0]; Cn = C / (norm(C, axis=1, keepdims=True) + 1e-6)
Xn = X / (norm(X, axis=1, keepdims=True) + 1e-6); nn = np.argsort(-(Xn @ Cn.T), axis=1)[:, :5]
p = [int(np.bincount(y[n], minlength=4).argmax()) for n in nn]; c = [float(np.bincount(y[n], minlength=4).max() / 5) for n in nn]
json.dump({'i': I.tolist(), 'p': p, 'conf': c}, open('pose_pred.json', 'w'))
