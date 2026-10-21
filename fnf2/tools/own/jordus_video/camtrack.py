import cv2, numpy as np, json
cap = cv2.VideoCapture('v.mp4')
mask = np.full((576,1024), 255, np.uint8)
mask[0:135, 580:1000] = 0; mask[478:576, :] = 0
sift = cv2.SIFT_create(2500)
bf = cv2.BFMatcher(cv2.NORM_L2)
def feat(a): return sift.detectAndCompute(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY), mask)
def match(A, B):
    (ka, da), (kb, db) = A, B
    if da is None or db is None or len(ka) < 10 or len(kb) < 10: return None, 0
    mm = bf.knnMatch(da, db, k=2)
    m = [p[0] for p in mm if len(p) == 2 and p[0].distance < 0.75 * p[1].distance]
    if len(m) < 12: return None, 0
    pa = np.float32([ka[x.queryIdx].pt for x in m]); pb = np.float32([kb[x.trainIdx].pt for x in m])
    M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=2.5)
    if M is None: return None, 0
    return M, int(inl.sum())
def to3(M): return np.vstack([M, [0, 0, 1]])
br = np.load('bright.npy')
F = len(br)
REF_T = 90.0
cap.set(cv2.CAP_PROP_POS_FRAMES, int(REF_T * 30)); ok, ref = cap.read()
R = feat(ref)
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
out = {}
prev = None   # (features, H frame->ref)
for f in range(F):
    ok, img = cap.read()
    if not ok: break
    if f % 2: continue
    if br[f] < 15 or f > 125 * 30: continue
    A = feat(img)
    M, ni = match(A, R)            # frame -> ref
    H = None; how = 'ref'
    if M is not None and ni >= 40: H = to3(M)
    elif prev is not None:
        M2, n2 = match(A, prev[0])  # frame -> prev frame
        if M2 is not None and n2 >= 30: H = prev[1] @ to3(M2); ni = n2; how = 'chain'
    if H is not None:
        out[f] = dict(H=H[:2].tolist(), n=ni, how=how)
        prev = (A, H)
json.dump(out, open('cam.json', 'w'))
print(len(out), 'frames tracked of', F // 2)
