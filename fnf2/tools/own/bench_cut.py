"""Cut BF + GF out of the user's bench picture (private/bench-ref.webp: 3 panels of BF + GF on a
park bench: eating / licking / brain freeze) so they can sit on the park stage's own bench.

  1. the black ink lines are found, everything between them becomes regions
  2. each region is wood / bench metal / white page, or part of a character (by its colour)
  3. ink lines go with the character when they touch one (the outline around a body), else with the bench
  4. the picture is cleaned up so it reads like FNF art, not a soft AI picture: every region gets
     one flat colour (+ its shade), the ink becomes crisp black with a clean edge

  python3 tools/own/bench_cut.py [--debug]
Writes build/own/shared/images/wrath-park/sit/*.png (git-ignored).
"""
import os, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'private', 'bench-ref.webp')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'wrath-park', 'sit')
DBG = os.environ.get('DBG', '/tmp/claude-0/-home-user/8735ba8d-7a7f-5bd9-a79d-2bb0e2fdd6a4/scratchpad/sit')


def load():
    return np.asarray(Image.open(SRC).convert('RGB'))


def hsv_of(rgb):
    h = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    return h[..., 0] * 2, h[..., 1] / 255, h[..., 2] / 255


def palette_labels(img, k=30):
    """k-means colour palette of the non-ink pixels; every pixel -> its palette colour"""
    H, S, V = hsv_of(img)
    ink = V < 0.24
    px = img[~ink].reshape(-1, 3).astype(np.float32)
    rng = np.random.default_rng(1); sample = px[rng.choice(len(px), min(len(px), 60000), replace=False)]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.5)
    _, _, cent = cv2.kmeans(sample, k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    lab = cv2.cvtColor(cent.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    flat = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    best = np.zeros(len(flat), np.int32); bd = np.full(len(flat), 1e9, np.float32)
    for i, c in enumerate(lab):
        d = ((flat - c) ** 2).sum(1); m = d < bd; bd[m] = d[m]; best[m] = i
    plab = best.reshape(img.shape[:2]); plab[ink] = -1
    return ink, plab, cent


def kind_of_colour(c):
    """0 page, 1 bench, 2 character"""
    h, s, v = [float(x) for x in cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_RGB2HSV)[0, 0]]
    h *= 2; s /= 255; v /= 255
    if s < 0.07 and v > 0.93: return 0
    if s < 0.16 and v <= 0.93: return 3                                      # grey fringe beside the ink lines
    if 6 < h < 34 and 0.45 < s < 0.85 and 0.2 < v < 0.75: return 1           # wood (GF's hair is redder + more saturated)
    if 190 < h < 290 and s < 0.5 and v < 0.5: return 1                       # grey-blue metal legs
    return 2


def regions(img):
    ink, plab, cent = palette_labels(img)
    kinds = np.array([kind_of_colour(c) for c in cent.astype(np.uint8)])
    k = np.full(plab.shape, -1, np.int8)
    k[plab >= 0] = kinds[plab[plab >= 0]]
    # (white inside a body - shirt, soles - is sorted out per person in split_people)
    return ink, k, cent, plab


def fix_fringe(k, plab):
    """little colour regions that only touch wood (the soft dark rim the picture has around the wood,
    shadowed bits between legs) are wood too"""
    out = k.copy()
    for lb in np.unique(plab[plab >= 0]):
        m = (plab == lb) & (k == 2)
        if not m.any(): continue
        n, cc, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] > 4000: continue
            x, y, w, h = stats[i, :4]
            sub = (cc[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2] == i).astype(np.uint8)
            ring = cv2.dilate(sub, np.ones((3, 3), np.uint8)) & (1 - sub)
            kk = k[max(0, y - 2):y + h + 2, max(0, x - 2):x + w + 2]
            nb, nc = ((kk == 1) & (ring > 0)).sum(), ((kk == 2) & (ring > 0)).sum()
            if nb > 0 and nb >= nc: out[cc == i] = 1
    return out


# panels of the picture: (x0, y0, x1, y1) and seeds inside BF and GF (picture pixels)
# white gaps between BF's neck and the bench back (page showing through) that look like part of him
# and between the bench leg and his left sneaker
ERASE = {'eat': [(385, 215), (116, 404)], 'lick': [(1150, 215), (878, 409)], 'freeze': [(487, 902), (482, 893)]}
# bench line ends left on the outline: (x0, y0, x1, y1) boxes where only ink is removed
UNINK = {'lick': [(872, 333, 902, 349)]}
# boxes where everything is removed (a bench edge line poking out of the outline)
CUT = {'freeze': [(714, 800, 777, 812)]}

PANELS = {
    'eat': dict(box=(40, 0, 760, 494), bf=[(230, 200), (250, 280), (160, 430), (340, 440), (150, 300), (250, 70), (170, 150),
                                           (320, 107), (357, 197), (397, 180), (307, 233), (333, 280), (320, 353), (287, 353)],
                gf=[(480, 170), (560, 250), (520, 330), (450, 400), (520, 450), (650, 300), (430, 250), (560, 60), (470, 285), (600, 330)]),
    'lick': dict(box=(790, 0, 1530, 494), bf=[(995, 200), (1015, 280), (925, 430), (1105, 440), (915, 300), (1015, 70), (935, 150),
                                              (1085, 107), (1122, 197), (1162, 180), (1072, 233), (1098, 280), (1085, 353), (1052, 353)],
                 gf=[(1245, 170), (1325, 250), (1285, 330), (1215, 400), (1285, 450), (1415, 300), (1195, 250), (1325, 60), (1235, 285), (1365, 330)]),
    'freeze': dict(box=(400, 494, 1140, 1024), bf=[(580, 700), (620, 790), (520, 930), (700, 930), (680, 610), (510, 780), (560, 620),
                                                   (727, 627), (627, 587), (693, 747), (680, 840), (627, 707)],
                   gf=[(885, 690), (930, 760), (880, 850), (820, 900), (900, 950), (1050, 800), (820, 700), (900, 580), (875, 805), (1005, 850)]),
}


def split_people(img, k, ink, panel):
    """-> (bf mask, gf mask, bench mask) for one panel. Ink goes with whoever it touches; white
    parts inside a body (shirt, soles, cone tip) count as body even where they touch the page."""
    from scipy import ndimage
    from skimage.segmentation import watershed
    x0, y0, x1, y1 = panel['box']
    sub = img[y0:y1, x0:x1]; kk = k[y0:y1, x0:x1]; ik = ink[y0:y1, x0:x1]
    char = (kk == 2)
    near = cv2.dilate(char.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) > 0
    body = char | (ik & near)
    people = body & ~(kk == 1)
    # who owns what: every colour patch between the ink lines is one piece. Pieces with a seed in
    # them are BF's or GF's; every other piece goes to whoever owns the pieces nearest to it
    # (a flood would run along the ink lines, which all join up, and grab the wrong person's bits)
    piece = people & ~ik
    n, cc = cv2.connectedComponents(piece.astype(np.uint8), connectivity=4)
    owner = np.zeros(n, np.int32)
    for lab, pts in ((1, panel['bf']), (2, panel['gf'])):
        for (x, y) in pts:
            c = cc[y - y0, x - x0]
            if c > 0: owner[c] = lab
    for _ in range(6):
        own = owner[cc] * (cc > 0)
        if (owner[1:] > 0).all(): break
        _, (iy, ix) = ndimage.distance_transform_edt(own == 0, return_indices=True)
        nearest = own[iy, ix]
        votes = np.bincount((cc * 3 + nearest).ravel(), minlength=n * 3).reshape(n, 3)
        todo = (owner == 0) & (votes[:, 1:].sum(1) > 0); todo[0] = False
        owner[todo] = 1 + votes[todo, 1:].argmax(1)
    ws = owner[cc] * (cc > 0)
    # white patches (shirt, ice cream shine, soles) that aren't the page around everything: whoever's
    # colours touch them; but a white gap that wood touches is between two bench slats
    wn, wc = cv2.connectedComponents((kk == 0).astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([wc[0], wc[-1], wc[:, 0], wc[:, -1]]).tolist()))
    erase = ERASE.get(panel.get('name'), [])
    for i in range(1, wn):
        if i in border: continue
        m = (wc == i).astype(np.uint8)
        x, y, w, h = cv2.boundingRect(m)
        if any((abs(x + x0 + w // 2 - ex) <= 6 and abs(y + y0 + h // 2 - ey) <= 6) or
               (0 <= ey - y0 < m.shape[0] and 0 <= ex - x0 < m.shape[1] and m[ey - y0, ex - x0]) for ex, ey in erase): continue
        for r in (8, 14):
            pad = r + 1; ys, xs = slice(max(0, y - pad), y + h + pad), slice(max(0, x - pad), x + w + pad)
            ring = (cv2.dilate(m[ys, xs], cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0) & ~(m[ys, xs] > 0)
            o = ws[ys, xs][ring]; kr = kk[ys, xs][ring]
            nb, n1, n2 = (kr == 1).sum(), ((o == 1) & (kr == 2)).sum(), ((o == 2) & (kr == 2)).sum()
            if nb + n1 + n2 == 0: continue
            if nb >= n1 + n2: break
            ws[m > 0] = 1 if n1 >= n2 else 2
            if os.environ.get('LISTW'): print(panel.get('name'), 'white ->', 1 if n1 >= n2 else 2, 'at', x + x0 + w // 2, y + y0 + h // 2, 'size', w, h, 'area', int(m.sum()))
            break
    people = people | (ws > 0)
    _, (iy, ix) = ndimage.distance_transform_edt(ws == 0, return_indices=True)
    ws = np.where(ik & people, ws[iy, ix], ws)
    def main_part(m):
        # only the pieces joined to the body (drops loose bits: a lightning bolt, a slat end)
        n, cc, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        if n <= 1: return m
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        keep = [i for i in range(1, n) if i == big or st[i, cv2.CC_STAT_AREA] > 0.02 * st[big, cv2.CC_STAT_AREA]]
        return np.isin(cc, keep)
    bench = (kk == 1) | (ik & ~people)
    out = []
    for m in (main_part(ws == 1), main_part(ws == 2)):
        # rebuild the outline from the coloured parts: ink only where it hugs them (drops bench
        # lines that touched the body), then the soft grey edge pixels for smooth edges
        colour = m & ((kk == 2) | (kk == 0))
        # ink: the outline right around the colours, plus bigger ink shapes inside the body (eyes)
        # as long as they're away from the bench's wood (that's how bench lines get left out)
        dcol = ndimage.distance_transform_edt(~colour)
        dwood = ndimage.distance_transform_edt(kk != 1)
        near7 = colour | (ik & (dcol <= 7))
        inside = ndimage.binary_fill_holes(cv2.morphologyEx(near7.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0)
        m2 = near7 | (ik & inside & (dwood > 5))
        grow = cv2.dilate(m2.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        m3 = main_part(m2 | (grow & (kk == 3)))
        # pin-holes (eye shines, mouth) are part of them
        holes = ndimage.binary_fill_holes(m3) & ~m3
        hn, hc, hs, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), connectivity=4)
        small = np.isin(hc, [i for i in range(1, hn) if hs[i, cv2.CC_STAT_AREA] < 400])
        m4 = m3 | small
        for (ax, ay, bx, by) in CUT.get(panel.get('name'), []):
            m4[ay - y0:by - y0, ax - x0:bx - x0] = False
        for (ax, ay, bx, by) in UNINK.get(panel.get('name'), []):
            box = np.zeros_like(m4); box[ay - y0:by - y0, ax - x0:bx - x0] = True
            m4 &= ~(box & ((kk == -1) | (kk == 3)))
        # loose bench lines left touching the outline: thin bits sticking out more than a few
        # pixels past the solid body get cut off
        core = cv2.morphologyEx(m4.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
        keep = cv2.dilate(core.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
        out.append(main_part(m4 & (keep | colour)))
    return out[0], out[1], bench, (x0, y0)


def clean(img, mask, cent):
    """the cut-out as clean FNF-style art: flat colours, solid black ink, smooth edges.
    Worked at 2x then shrunk, so the edges come out anti-aliased instead of jaggy."""
    H, W = mask.shape
    up = cv2.resize(img, (W * 2, H * 2), interpolation=cv2.INTER_CUBIC)
    m2 = cv2.resize(mask.astype(np.uint8) * 255, (W * 2, H * 2), interpolation=cv2.INTER_LINEAR) > 127
    _, S, V = hsv_of(up)
    ink = (V < 0.30) & m2
    labc = cv2.cvtColor(cent.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    flat = cv2.cvtColor(up, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    best = np.zeros(len(flat), np.int32); bd = np.full(len(flat), 1e9, np.float32)
    for i, c in enumerate(labc):
        d = ((flat - c) ** 2).sum(1); mm = d < bd; bd[mm] = d[mm]; best[mm] = i
    pl = best.reshape(H * 2, W * 2)
    out = up.copy()
    paint = m2 & ~ink
    # one flat colour per patch (a patch = touching pixels of the same palette colour): its mean
    gid = np.zeros(pl.shape, np.int64); base = 1
    for lb in np.unique(pl[paint]):
        n, cc = cv2.connectedComponents((paint & (pl == lb)).astype(np.uint8), connectivity=4)
        sel = cc > 0; gid[sel] = cc[sel] + base; base += n
    flatid = gid.ravel(); cnt = np.bincount(flatid, minlength=base).astype(np.float64)
    for ch in range(3):
        mean = np.bincount(flatid, weights=up[..., ch].ravel().astype(np.float64), minlength=base) / np.maximum(cnt, 1)
        o = out[..., ch]; o[gid > 0] = np.clip(mean[gid[gid > 0]], 0, 255)
    out[ink] = (12, 10, 14)
    a = (m2.astype(np.float32) * 255)
    rgba = np.dstack([out, a.astype(np.uint8)])
    small = cv2.resize(rgba.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
    # un-premultiply the colour where the edge is see-through
    al = small[..., 3:4] / 255
    prem = cv2.resize((rgba[..., :3].astype(np.float32) * (rgba[..., 3:4] / 255)), (W, H), interpolation=cv2.INTER_AREA)
    rgb = np.where(al > 0.01, prem / np.maximum(al, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), small[..., 3]]).astype(np.uint8)


def crop(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgba[y0:y1, x0:x1], (int(x0), int(y0))


def main():
    import json
    img = load()
    ink, k, cent, plab = regions(img)
    k = fix_fringe(k, plab)
    k = fix_fringe(k, plab)
    inkm = k == -1
    os.makedirs(DBG, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    meta = {}
    sheet = []
    for name, pan in PANELS.items():
        pan['name'] = name
        bf, gf, bench, (x0, y0) = split_people(img, k, inkm, pan)
        sub = img[pan['box'][1]:pan['box'][3], pan['box'][0]:pan['box'][2]]
        for who, m in (('bf', bf), ('gf', gf)):
            if who == 'gf' and name != 'freeze': continue        # GF is the same in all three: take the cleanest one
            art, (cx, cy) = crop(clean(sub, m, cent))
            Image.fromarray(art).save(os.path.join(OUT, f'{who}-{name}.png'))
            meta[f'{who}-{name}'] = dict(x=x0 + cx, y=y0 + cy, w=art.shape[1], h=art.shape[0])
            sheet.append(art)
        # GF's place in this panel (she's the anchor: everything is put relative to her)
        ys, xs = np.nonzero(gf)
        meta[f'gfpos-{name}'] = dict(x=int(x0 + xs.min()), y=int(y0 + ys.min()))
    # the blue brain-freeze bolts over his head (panel 3): blue shapes + their ink, not BF himself
    bfm = np.zeros(k.shape, bool)
    pan = PANELS['freeze']; b, _, _, (x0, y0) = split_people(img, k, inkm, pan)
    bfm[y0:y0 + b.shape[0], x0:x0 + b.shape[1]] = b
    H_, S_, V_ = hsv_of(img)
    blue = (H_ > 200) & (H_ < 250) & (S_ > 0.5) & (V_ > 0.3) & ~bfm
    box = np.zeros(k.shape, bool); box[495:650, 640:800] = True
    blue &= box
    n, cc, st, _ = cv2.connectedComponentsWithStats(blue.astype(np.uint8), connectivity=8)
    bm = np.isin(cc, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 80])
    ring = cv2.dilate(bm.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
    bm = (bm | (ring & (k == -1)) | (ring & (k == 3))) & ~bfm
    bx0, by0, bx1, by1 = 640, 495, 800, 650
    art, (cx, cy) = crop(clean(img[by0:by1, bx0:bx1], bm[by0:by1, bx0:bx1], cent))
    Image.fromarray(art).save(os.path.join(OUT, 'bolts.png'))
    meta['bolts'] = dict(x=bx0 + cx, y=by0 + cy, w=art.shape[1], h=art.shape[0])
    sheet.append(art)
    # the cone BF throws: the intro's strawberry cone made vanilla like the one in the picture
    cone = np.asarray(Image.open(os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'wrath-intro', 'cone-strawberry.png')).convert('RGBA')).copy()
    hsv = cv2.cvtColor(cone[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    h2 = hsv[..., 0] * 2
    pink = ((h2 > 300) | (h2 < 18)) & (hsv[..., 1] > 50) & (cone[..., 3] > 0)
    hsv[..., 0][pink] = 21; hsv[..., 1][pink] = hsv[..., 1][pink] * 0.28
    hsv[..., 2][pink] = np.clip(hsv[..., 2][pink] * 1.05 + 12, 0, 255)
    cone[..., :3] = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    Image.fromarray(cone).save(os.path.join(OUT, 'cone-vanilla.png'))
    json.dump(meta, open(os.path.join(OUT, 'sit.json'), 'w'), indent=1)
    # preview on a mid grey
    W = sum(a.shape[1] for a in sheet) + 20 * len(sheet); Hh = max(a.shape[0] for a in sheet)
    pv = Image.new('RGBA', (W, Hh), (128, 132, 140, 255)); x = 0
    for a in sheet: pv.alpha_composite(Image.fromarray(a), (x, 0)); x += a.shape[1] + 20
    pv.convert('RGB').save(os.path.join(DBG, 'cutouts.png'))
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
