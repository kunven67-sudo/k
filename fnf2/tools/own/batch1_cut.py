"""Cut the user's ChatGPT pictures (batch 1, private/batch1-*.jpg) into single poses for WRATH's Brain Freeze
cutscene (PRIVATE build only, written to the git-ignored build/own folder, never the repo):

  bf-walk      8 frames, BF with his strawberry cone (a bouncy shuffle, used as his walk)
  bf-react     7 poses: startled, angry, throwing the cone, smug, startled 2, angry 2, hop (star eyes)
  gf-sit       8 poses: laugh, annoyed, smug, surprised (x2: two drawings of each)
  gf-walk      8 frames, GF walking with her chocolate chip cone

Every pose gets cleaned so it reads like hand-made FNF art, not a soft AI picture:
  1. cut off the white page (flood fill from the edges stops at the outline, so white shirts stay)
  2. every colour region becomes ONE flat colour from a small palette (+ hard shade), the JPEG fuzz and the soft
     airbrushed gradients go away
  3. the ink becomes solid black with a clean edge (worked at 2x size, then shrunk for smooth lines)

  python3 tools/own/batch1_cut.py [--preview PNG]
"""
import argparse, json, os
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRIV = os.path.join(ROOT, 'private')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'wrath-park', 'b1')
# picture -> pose names in reading order (rows top to bottom, left to right)
PICS = {
    'bf-walk': ('batch1-bf-walk.jpg', ['walk%d' % i for i in range(8)]),
    'bf-react': ('batch1-bf-reactions.jpg', ['startled', 'angry', 'throw', 'smug', 'startled2', 'angry2', 'hop']),
    'gf-sit': ('batch1-gf-sit-reactions.jpg', ['laugh', 'annoyed', 'smug', 'surprised', 'laugh2', 'annoyed2', 'smug2', 'surprised2']),
    'gf-walk': ('batch1-gf-walk.jpg', ['walk%d' % i for i in range(8)]),
}
UP = 2                       # work size
INK = (12, 10, 14)           # FNF ink: near black


def page_mask(rgb):
    """True where the white page is (connected to the picture's edge through light, unsaturated pixels)"""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    light = ((hsv[..., 2] > 215) & (hsv[..., 1] < 40)).astype(np.uint8)
    h, w = light.shape
    n, cc = cv2.connectedComponents(light, connectivity=4)
    edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))) - {0}
    page = np.isin(cc, list(edge))
    # the soft grey halo JPEG leaves around the outline counts as page too
    halo = (hsv[..., 2] > 170) & (hsv[..., 1] < 30) & (cv2.dilate(page.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    return page | halo


def figures(rgb, names):
    """separate figures, in reading order; little bits (the thrown cone, motion lines) join the nearest figure"""
    fg = (~page_mask(rgb)).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, cc, st, cen = cv2.connectedComponentsWithStats(fg, connectivity=8)
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 8000]
    # two figures joined by a thin bridge (JPEG fuzz between BF's throwing hand and the next pose): shrink the
    # widest blob until it falls apart in two, then grow both halves back over it (watershed)
    while len(big) < len(names):
        from skimage.segmentation import watershed
        i = max(big, key=lambda i: st[i, cv2.CC_STAT_WIDTH])
        M = (cc == i).astype(np.uint8)
        for k in range(1, 25):
            E = cv2.erode(M, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
            m2, lab2, st2, _ = cv2.connectedComponentsWithStats(E, connectivity=8)
            parts = [j for j in range(1, m2) if st2[j, cv2.CC_STAT_AREA] > 3000]
            if len(parts) >= 2: break
        else: raise SystemExit('could not split a joined figure')
        markers = np.zeros(M.shape, np.int32)
        for q, j in enumerate(parts[:2]): markers[lab2 == j] = q + 1
        ws = watershed(-cv2.distanceTransform(M, cv2.DIST_L2, 5), markers, mask=M > 0)
        right = ws == 2
        cc[right] = n
        st = np.vstack([st, [0, 0, int(np.ptp(np.where(right)[1])), 0, int(right.sum())]])
        cen = np.vstack([cen, [np.where(right)[1].mean(), np.where(right)[0].mean()]])
        left = cc == i; cen[i] = [np.where(left)[1].mean(), np.where(left)[0].mean()]
        st[i, cv2.CC_STAT_WIDTH] = int(np.ptp(np.where(left)[1])); big.append(n); n += 1
    small = [i for i in range(1, n) if 60 < st[i, cv2.CC_STAT_AREA] <= 8000]
    # reading order: rows by centre y (picture is 2 rows), then x
    h = rgb.shape[0]
    big.sort(key=lambda i: (int(cen[i][1] > h / 2), cen[i][0]))
    if len(big) != len(names): raise SystemExit('found %d figures, expected %d' % (len(big), len(names)))
    masks = {i: cc == i for i in big}
    for j in small:
        k = min(big, key=lambda i: np.hypot(*(cen[i] - cen[j])))
        masks[k] |= cc == j
    return [(nm, masks[i]) for nm, i in zip(names, big)]


def clean(rgb, mask):
    """one figure -> RGBA, flat colours + solid ink, cropped"""
    ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
    y0, x0 = max(0, y0), max(0, x0)
    sub = rgb[y0:y1, x0:x1]; m = mask[y0:y1, x0:x1].astype(np.uint8)
    big = cv2.resize(sub, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    mb = cv2.resize(m * 255, None, fx=UP, fy=UP, interpolation=cv2.INTER_LINEAR) > 127
    big = cv2.bilateralFilter(big, 9, 30, 7)                     # JPEG fuzz off, edges kept
    hsv = cv2.cvtColor(big, cv2.COLOR_RGB2HSV)
    ink = (big.max(2) < 78) & (hsv[..., 1] < 150) | (big.max(2) < 52)
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    ink &= mb
    # palette of the coloured parts
    col = mb & ~ink
    lab = cv2.cvtColor(big, cv2.COLOR_RGB2LAB).astype(np.float32)
    px = lab[col]
    rng = np.random.default_rng(3); smp = px[rng.choice(len(px), min(len(px), 40000), replace=False)]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    _, _, cent = cv2.kmeans(smp, 16, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    # merge colours that are almost the same (keeps one shade step, drops airbrush steps)
    keep = []
    for c in sorted(cent.tolist(), key=lambda c: -((smp - c) ** 2).sum(1).__lt__(200).sum()):
        if all(np.linalg.norm(np.subtract(c, k)) > 13 for k in keep): keep.append(c)
    cent = np.array(keep, np.float32)
    d = ((lab[..., None, :] - cent[None, None]) ** 2).sum(-1)
    L = d.argmin(-1).astype(np.uint8)
    L[~col] = 255
    # mode filter: every pixel takes the most common colour around it (clean flat shapes, smooth borders)
    votes = np.zeros(L.shape + (len(cent),), np.float32)
    for i in range(len(cent)): votes[..., i] = cv2.blur((L == i).astype(np.float32), (7, 7))
    L2 = votes.argmax(-1).astype(np.uint8)
    out = np.zeros(big.shape[:2] + (3,), np.float32)
    cr = cv2.cvtColor(cent.reshape(1, -1, 3).clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    out[:] = cr[L2]
    # ink on top, edges softened a touch so lines aren't jaggy
    inkf = cv2.GaussianBlur(ink.astype(np.float32), (3, 3), 0.6)
    out = out * (1 - inkf[..., None]) + np.array(INK, np.float32) * inkf[..., None]
    # the outer edge: always ink (FNF characters have a solid outline all the way round)
    edge = mb.astype(np.uint8) - cv2.erode(mb.astype(np.uint8), np.ones((5, 5), np.uint8))
    out[edge > 0] = INK
    a = cv2.GaussianBlur(mb.astype(np.float32), (3, 3), 0.7) * 255
    rgba = np.dstack([out.clip(0, 255), a]).astype(np.uint8)
    small = cv2.resize(rgba, (rgba.shape[1] // UP, rgba.shape[0] // UP), interpolation=cv2.INTER_AREA)
    return small, (x0, y0)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--preview'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    meta, shown = {}, []
    for key, (fn, names) in PICS.items():
        rgb = np.asarray(Image.open(os.path.join(PRIV, fn)).convert('RGB'))
        for nm, m in figures(rgb, names):
            im, (x0, y0) = clean(rgb, m)
            Image.fromarray(im).save(os.path.join(OUT, '%s-%s.png' % (key, nm)))
            # where it sat in the picture (feet line + centre) so poses can be lined up
            ys, xs = np.where(im[..., 3] > 128)
            meta['%s-%s' % (key, nm)] = {'w': im.shape[1], 'h': im.shape[0], 'src': [int(x0), int(y0)], 'feet': int(ys.max()), 'cx': int(xs.mean())}
            shown.append(im)
        print(key, len(names), 'poses')
    json.dump(meta, open(os.path.join(OUT, 'poses.json'), 'w'), indent=1)
    if a.preview:
        H = max(s.shape[0] for s in shown); W = sum(s.shape[1] for s in shown[:8]) + 80
        rows = [shown[i:i + 8] for i in range(0, len(shown), 8)]
        sheet = Image.new('RGBA', (max(sum(s.shape[1] + 10 for s in r) for r in rows), sum(max(s.shape[0] for s in r) + 10 for r in rows)), (96, 120, 150, 255))
        y = 0
        for r in rows:
            x = 0
            for s in r: sheet.alpha_composite(Image.fromarray(s), (x, y)); x += s.shape[1] + 10
            y += max(s.shape[0] for s in r) + 10
        sheet.save(a.preview); print('preview', a.preview)


if __name__ == '__main__':
    main()
