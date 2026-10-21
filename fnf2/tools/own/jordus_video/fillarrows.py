"""The player's cut-out frames have the scrolling arrows in them (they fly over her in every shot). Where an arrow
was (its spot is known from the chart, frame by frame), the pixels come from the nearest frame of the same pose
where that spot was clear (the pose holds still after its first frames). Works on the raw cuts in out/ (the
originals are kept in out_raw/), cleanup.py runs after.   python3 fillarrows.py up,right,down,left,idle"""
import cv2, numpy as np, os, sys, shutil, glob
os.chdir('/tmp/claude-0/nf')
exec(open('goggles.py').read().split("X0, Y0, X1, Y1")[0])      # H_at
from arrows import boxes
START = {'idle': 3702, 'left': 268, 'down': 1708, 'up': 592, 'right': 1233}
X0, Y0, X1, Y1 = 560, 230, 980, 530; K = 2; W, Hh = (X1 - X0) * K, (Y1 - Y0) * K
def mask(f):
    m = np.zeros((576, 1024), np.uint8)
    for x0, y0, x1, y1, kind in boxes(f, pad=4):
        cv2.rectangle(m, (int(x0), int(y0)), (int(x1), int(y1)), 1, -1)
    H = H_at(f)
    M = np.diag([K, K, 1]) @ np.array([[1, 0, -X0], [0, 1, -Y0], [0, 0, 1]]) @ H
    return cv2.warpAffine(m, M[:2], (W, Hh), flags=cv2.INTER_NEAREST) > 0
# which frames of each pose look alike (measured: under 5 % of her pixels change inside a group). A spot under an
# arrow only takes pixels from the same group, nearest frame first (other groups are a different moment of the pose)
GROUPS = {'up': [[1], [2, 3, 4, 5, 6]], 'right': [[1, 2], [3, 4, 5, 6, 7, 8]], 'left': [[1, 2, 3, 4, 5, 6]],
          'down': [[1, 2], [3, 4, 5, 6]]}
FALLBACK = {'right'}     # (her RIGHT snap: the arrow sits on her skirt, which doesn't move in the snap)
os.makedirs('out_raw/plr', exist_ok=True)
for anim in sys.argv[1].split(','):
    for p in glob.glob(f'out/plr/{anim}_[0-9][0-9].png'):
        q = 'out_raw/plr/' + os.path.basename(p)
        if not os.path.exists(q): shutil.copyfile(p, q)
    for grp in GROUPS[anim]:
        grp = [i for i in grp if os.path.exists(f'out_raw/plr/{anim}_{i:02d}.png')]
        ims = {i: cv2.imread(f'out_raw/plr/{anim}_{i:02d}.png', cv2.IMREAD_UNCHANGED) for i in grp}
        ms = {i: cv2.dilate(mask(START[anim] + i).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0 for i in grp}
        for i in grp:
            im, m = ims[i], ms[i]; out = im.copy(); todo = m.copy(); used = []
            for j in sorted([j for j in grp if j != i], key=lambda j: abs(j - i)):
                take = todo & ~ms[j]
                if take.any(): out[take] = ims[j][take]; todo &= ~take; used.append(j)
                if not todo.any(): break
            # (what no frame of the group can give: from the other groups of the pose, nearest first; their pose is
            # a bit different, so this only happens where the arrow sat on a part that doesn't move in the snap)
            if todo.any() and anim in FALLBACK:
                others = [j for g in GROUPS[anim] if g is not grp for j in g if os.path.exists(f'out_raw/plr/{anim}_{j:02d}.png')]
                for j in sorted(others, key=lambda j: abs(j - i)):
                    mj = cv2.dilate(mask(START[anim] + j).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
                    imj = cv2.imread(f'out_raw/plr/{anim}_{j:02d}.png', cv2.IMREAD_UNCHANGED)
                    take = todo & ~mj
                    if take.any(): out[take] = imj[take]; todo &= ~take; used.append(j)
                    if not todo.any(): break
            her = im[..., 3] > 0
            cv2.imwrite(f'out/plr/{anim}_{i:02d}.png', out)
            if m.any(): print(anim, i, 'arrow px on her', int((m & her).sum()), 'from', used[:4], 'left over on her', int((todo & her).sum()))
