"""JORDUS's own animations (PRIVATE build only: everything it writes goes to the git-ignored build/mods/jordus).

The Nightly Funkin' girls only exist in a gameplay video (tools/own/jordus.py rebuilt the song from it), so FNF's
"own stuff" for a player (character select, freeplay DJ, results) never existed. This makes it the way FNF's own
character select art is made: cut-out PARTS moved by matrices every frame (an Animate atlas), with FNF's timing.

  her parts     cut by hand out of two video frames (private/jordus/src): idle_20 = the chill drawing (heart eyes,
                mic up, the other arm hanging), down_03 = the "picked" drawing (shades on, tongue out, arms out wide).
                The auto cut (jordus.py) lost parts that are the stage's purple (her jacket + back arm): here the
                silhouette follows her black outline instead, then every part is cleaned to flat colours + solid ink
  her legs      the video never shows her shoes (the black bar always covers them): BF's real dangling leg from
                FNF's character select, recoloured to her light-blue pants + black shoes
  her amp       FNF's real speaker from BF's character select (the box he sits on), recoloured purple + pink;
                the cap girl gets the same box in navy + red, turned the other way
  the cap girl  her real idle from the video (she sat on the skate ramp's ledge: that ledge hid the lower right
                of her rear, filled back in black like her pants), sitting on her amp

Writes (all Animate atlases, stage px like FNF's):
  preload/images/charSelect/nightlyChill   idle (2 bops) / select / deselect / deselect loop start / slidein /
                                            slidein idle point / slideout  (like bfChill)
  preload/images/charSelect/capChill       idle / confirm / deselect  (like gfChill)
  preload/images/freeplay/nightlyDJ        Intro / Idle / Confirm / Fist Pump / Fist Pump Loss / AFK /
                                            To Character Select  (like freeplay-boyfriend)
  shared/images/resultScreen/results-nightly/<rank>   perfect / excellent / great / good / loss: intro + 'loop'
  preload/images/freeplay/icons/nightly-playerpixel + nightly-opppixel   pixel face icons (capsules, grid)

Needs FNF's own assets checkout (FNF_ASSETS, default /home/user/ref/fa) and a jordus.py build (the cap girl's frames).
  python3 tools/own/jordus_rig.py [--preview DIR]
"""
import os, sys, json, math, argparse
import numpy as np, cv2
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import puppet as P
import bench_cut as B
import nene_icons as N

SRC = os.path.join(ROOT, 'private', 'jordus', 'src')
MOD = os.path.join(ROOT, 'build', 'mods', 'jordus')
FA = os.environ.get('FNF_ASSETS', '/home/user/ref/fa')
CS = os.path.join(FA, 'preload', 'images', 'charSelect')
cv2.setRNGSeed(7)


# ================================================================ cutting
def silhouette(rgb, poly, ink_v=80, close=1):
    """inside a rough polygon round her: everything the outside reaches without crossing her black outline is
    background (the auto cut lost the purple parts of her that look like the stage; her outline never lies)"""
    H, W = rgb.shape[:2]
    inside = P.poly_mask((H, W), poly)
    ink = rgb.max(2) < ink_v
    if close: ink = cv2.dilate(ink.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=close) > 0
    free = (inside & ~ink).astype(np.uint8)
    _, lab = cv2.connectedComponents(free, connectivity=4)
    edge = inside & ~(cv2.erode(inside.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    bg = np.isin(lab, list(set(np.unique(lab[edge & (free > 0)])) - {0}))
    return inside & ~bg


def assign(fig, POLY, ORDER, shape, src=None, minarea=250):
    """each pixel of her goes to the first part (in ORDER) whose polygon holds it; specks dropped"""
    H, W = shape
    lab = np.full((H, W), -1, int)
    for i, n in enumerate(ORDER):
        f = (src or {}).get(n, fig)
        lab[P.poly_mask((H, W), POLY[n]) & f & (lab < 0)] = i
    for i in range(len(ORDER)):
        n, cc, st, _ = cv2.connectedComponentsWithStats((lab == i).astype(np.uint8), 8)
        for j in range(1, n):
            if st[j, cv2.CC_STAT_AREA] < minarea: lab[cc == j] = -1
    return lab


def palette():
    """her colours (k-means over her video frames): every flat patch snaps to one of them"""
    px = []
    for n in ('idle_20', 'up_03', 'right_03', 'down_03'):
        a = np.array(Image.open(os.path.join(SRC, n + '.png')).convert('RGBA'))
        px.append(a[..., :3][a[..., 3] > 200])
    px = np.concatenate(px)
    _, _, V = B.hsv_of(px.reshape(1, -1, 3))
    px = px[(V > 0.24).ravel()].astype(np.float32)
    rng = np.random.default_rng(1); sample = px[rng.choice(len(px), 60000, replace=False)]
    _, _, cent = cv2.kmeans(sample, 26, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.5), 4, cv2.KMEANS_PP_CENTERS)
    return cent


def clean(img, mask, cent, ink_v=0.20):
    """flat FNF colours + solid ink, worked at 2x (bench_cut.clean with a lower ink cut: her back hair is a dark
    purple that a 0.3 cut turned black)"""
    Hh, Ww = mask.shape
    up = cv2.resize(img, (Ww * 2, Hh * 2), interpolation=cv2.INTER_CUBIC)
    m2 = cv2.resize(mask.astype(np.uint8) * 255, (Ww * 2, Hh * 2), interpolation=cv2.INTER_LINEAR) > 127
    _, _, V = B.hsv_of(up)
    ink = (V < ink_v) & m2
    labc = cv2.cvtColor(cent.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    flat = cv2.cvtColor(up, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    best = np.zeros(len(flat), np.int32); bd = np.full(len(flat), 1e9, np.float32)
    for i, c in enumerate(labc):
        d = ((flat - c) ** 2).sum(1); mm = d < bd; bd[mm] = d[mm]; best[mm] = i
    pl = best.reshape(Hh * 2, Ww * 2)
    out = up.copy(); paint = m2 & ~ink
    gid = np.zeros(pl.shape, np.int64); base = 1
    for lb in np.unique(pl[paint]):
        n, cc = cv2.connectedComponents((paint & (pl == lb)).astype(np.uint8), connectivity=4)
        sel = cc > 0; gid[sel] = cc[sel] + base; base += n
    flatid = gid.ravel(); cnt = np.bincount(flatid, minlength=base).astype(np.float64)
    for ch in range(3):
        mean = np.bincount(flatid, weights=up[..., ch].ravel().astype(np.float64), minlength=base) / np.maximum(cnt, 1)
        o = out[..., ch]; o[gid > 0] = np.clip(mean[gid[gid > 0]], 0, 255)
    out[ink] = (12, 10, 14)
    rgba = np.dstack([out, (m2 * 255).astype(np.uint8)])
    small = cv2.resize(rgba.astype(np.float32), (Ww, Hh), interpolation=cv2.INTER_AREA)
    al = small[..., 3:4] / 255
    prem = cv2.resize(rgba[..., :3].astype(np.float32) * (rgba[..., 3:4] / 255), (Ww, Hh), interpolation=cv2.INTER_AREA)
    rgb2 = np.where(al > 0.01, prem / np.maximum(al, 1e-3), 0)
    return np.dstack([np.clip(rgb2, 0, 255), small[..., 3]]).astype(np.uint8)


def cut_parts(name, outer, POLY, ORDER, fix, cent, post=None, finish=None):
    """-> {part: full-size RGBA in the frame's px}"""
    rgba = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    rgb = np.ascontiguousarray(rgba[..., :3])     # (the video picture is kept under the auto cut's alpha)
    H, W = rgb.shape[:2]
    fig = silhouette(rgb, outer)
    fig, src = fix(rgb, fig, rgba)
    fig = drop_strays(fig)
    lab = assign(fig, POLY, ORDER, (H, W), src)
    lab = tidy(lab, fig=fig, keep=0)
    if post: lab = post(lab, rgb, ORDER)
    lab = tidy(lab)
    full = clean(rgb, lab >= 0, cent)
    out = {}
    for i, n in enumerate(ORDER):
        a = np.zeros((H, W, 4), np.uint8); a[..., :3] = full[..., :3]; a[..., 3] = np.where(lab == i, full[..., 3], 0)
        out[n] = a
    if finish: finish(out)
    return out


def drop_strays(fig):
    """the video's thin lines (the black bar's edge, the skate ramp's edges) stuck to her outline: anything under
    3px thick and longer than a hair tip goes, then every bit that isn't joined to her"""
    op = cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    k, cc, st, _ = cv2.connectedComponentsWithStats((fig & ~op).astype(np.uint8), 8)
    out = fig.copy()
    for j in range(1, k):
        if max(st[j, 2], st[j, 3]) >= 6: out[cc == j] = False
    k, cc, st, _ = cv2.connectedComponentsWithStats(out.astype(np.uint8), 8)
    keep = [j for j in range(1, k) if st[j, 4] >= 150]
    return np.isin(cc, keep)


def strand(rgb, fig, box):
    """the ahoge alone: its cream fill + its own thin ink outline (never the hair's outline under its root)"""
    H, W = rgb.shape[:2]
    inb = P.poly_mask((H, W), box) & fig
    cream = inb & (rgb.min(2) > 150)
    n, cc, st, _ = cv2.connectedComponentsWithStats(cream.astype(np.uint8), 8)
    cream = cc == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    root = np.nonzero(cream)[0].max()
    m = (cv2.dilate(cream.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & inb
    m[root + 1:] = False
    return m


def chin(lab, rgb, head, to, xs, line):
    """head pixels below its chin's ink go to the torso: per column, from a point inside the ink (line(x)),
    down to where the chin's outline ends (smoothed across columns, so the chin's bottom edge stays clean)"""
    ink = rgb.max(2) < 70; H = lab.shape[0]
    ye = {}
    for x in xs:
        y = int(round(line(x)))
        for d in (0, -1, 1, -2, 2, -3, 3, -4, 4):
            if ink[y + d, x]: y += d; break
        else: continue
        y0 = y
        while y < H and ink[y, x]: y += 1
        ye[x] = min(y, y0 + 6)                                 # (the chin's outline only, where it runs into the collar's)
    ks = sorted(ye)
    # a smooth curve through them (the chin's bottom is a curve; columns where the outline runs on would make steps)
    c = np.polyfit(ks, [ye[k] for k in ks], 2)
    fit = {k: np.polyval(c, k) for k in ks}
    for x in ks:
        y = int(round(min(ye[x], fit[x] + 1)))
        col = lab[y:, x]; col[col == head] = to
    return lab


def tidy(lab, keep=0.35, fig=None):
    """each part keeps its big pieces; a small separate bit goes to the part it touches most (or nobody); pixels of
    her that fell between two parts' polygons go to the nearest part (else they'd be a see-through seam)"""
    if fig is not None:
        hole = fig & (lab < 0)
        if hole.any():
            dist, lbl = cv2.distanceTransformWithLabels((lab < 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
            ys, xs = np.nonzero(lab >= 0)
            lut = np.zeros(lbl.max() + 1, int); lut[lbl[ys, xs]] = lab[ys, xs]
            fill = hole & (dist <= 3)
            lab = lab.copy(); lab[fill] = lut[lbl[fill]]
    out = lab.copy()
    for i in range(lab.max() + 1):
        k, cc, st, _ = cv2.connectedComponentsWithStats((lab == i).astype(np.uint8), 8)
        if k <= 2: continue
        big = st[1:, cv2.CC_STAT_AREA].max()
        for j in range(1, k):
            if st[j, cv2.CC_STAT_AREA] >= keep * big: continue
            blob = cc == j
            ring = (cv2.dilate(blob.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & ~blob
            nb = lab[ring]; nb = nb[(nb >= 0) & (nb != i)]
            out[blob] = np.bincount(nb).argmax() if len(nb) else -1
    return out


def underlay(img, cover, reach=16):
    """a part's own flat colours painted a little way in under the parts drawn on top of it (cover), so moving
    those never opens a hole"""
    a = img[..., 3] > 128
    srcm = a & (img[..., :3].max(2) >= 60)
    dist, lbl = cv2.distanceTransformWithLabels((~srcm).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(srcm)
    lut = np.zeros((lbl.max() + 1, 2), int); lut[lbl[ys, xs]] = np.stack([ys, xs], 1)
    reg = cover & ~a & (dist <= reach)
    ny, nx = lut[lbl[reg]].T
    img[reg, :3] = img[ny, nx, :3]; img[reg, 3] = 255
    return img


def dome(img, cut_y, skip=(), T=6, raise_max=10, fit_w=36):
    """the video's black bar cut the top of her head flat: a round top goes back (a circle through her head's
    outline either side of the cut) with an even ink rim; the old thin ink along the cut turns back into hair"""
    al = img[..., 3] > 100; H, W = al.shape
    top = np.array([np.argmax(al[:, x]) if al[:, x].any() else -1 for x in range(W)])
    inskip = lambda x: any(a <= x <= b for a, b in skip)
    cut = [x for x in range(W) if 0 <= top[x] <= cut_y + 2 and not inskip(x)]
    if not cut: return img
    c0, c1 = min(cut), max(cut)
    pts = [(x, top[x]) for x in list(range(c0 - fit_w, c0 - 2)) + list(range(c1 + 3, c1 + fit_w)) if 0 <= x < W and top[x] > cut_y + 2 and not inskip(x)]
    X = np.array(pts, float)
    A = np.c_[X[:, 0], X[:, 1], np.ones(len(X))]; bb = -(X[:, 0] ** 2 + X[:, 1] ** 2)
    D, E, F = np.linalg.lstsq(A, bb, rcond=None)[0]
    cx, cy = -D / 2, -E / 2; r = math.sqrt(max(1, cx * cx + cy * cy - F))
    E = 8
    def ytop(x):
        t = top[min(W - 1, max(0, int(x)))]
        c = min(t, max(t - raise_max, cy - math.sqrt(max(0, r * r - (x - cx) ** 2))))
        w = min(1, max(0, (x - (c0 - E)) / (2 * E))) * min(1, max(0, ((c1 + E) - x) / (2 * E)))
        w = w * w * (3 - 2 * w)
        return t + (c - t) * w
    # hair up to the new top, over the old ink there too: the new rim (even thickness) is the only outline left
    for x in range(c0 - E, c1 + E + 1):
        if not 0 <= x < W or inskip(x) or top[x] < 0: continue
        y0 = int(math.floor(ytop(x)))
        yy = top[x]
        while yy < H and yy < top[x] + 12 and img[yy, x, 3] > 100 and img[yy, x, :3].max() < 110: yy += 1
        if yy + 4 >= H or img[yy + 4, x, 3] <= 100 or img[yy + 4, x, :3].max() < 110: continue
        img[y0:yy + 2, x, :3] = img[yy + 4, x, :3]; img[y0:yy + 2, x, 3] = 255
    # the ink rim, drawn smooth (4x)
    S = 4
    xs = [x / S for x in range((c0 - E) * S, (c1 + E + 1) * S)]
    xs = [x for x in xs if not inskip(int(x))]
    runs, cur = [], []
    for x in xs:
        if cur and x - cur[-1] > 1.01 / S: runs.append(cur); cur = []
        cur.append(x)
    if cur: runs.append(cur)
    mk = Image.new('L', (W * S, H * S)); d = ImageDraw.Draw(mk)
    for run in runs:
        yt = [ytop(x) for x in run]
        d.polygon([(x * S, y * S) for x, y in zip(run, yt)] + [(x * S, (y + T) * S) for x, y in reversed(list(zip(run, yt)))], fill=255)
    rim = np.asarray(mk.resize((W, H), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    a0 = img[..., 3:4].astype(np.float32) / 255
    rgb = img[..., :3].astype(np.float32) * a0 * (1 - rim) + np.array((12, 10, 14), np.float32) * rim
    an = rim + a0 * (1 - rim)
    img[..., :3] = np.where(an > 0, rgb / np.maximum(an, 1e-4), 0).clip(0, 255).astype(np.uint8)
    img[..., 3] = (an[..., 0] * 255).clip(0, 255).astype(np.uint8)
    return img


# --- the chill drawing (video frame idle_20)
IDLE_OUTER = [(500, 190), (560, 195), (560, 215), (600, 232), (625, 250), (615, 300), (625, 390), (590, 420), (560, 440), (610, 500),
              (625, 530), (625, 570), (560, 575), (470, 572), (330, 572), (300, 560), (265, 540), (260, 470), (250, 420), (255, 385),
              (280, 360), (285, 320), (270, 290), (285, 255), (330, 215), (400, 195), (470, 195)]
IDLE_POLY = {
    'arm': [(246, 430), (250, 372), (282, 352), (343, 352), (345, 431), (384, 438), (384, 440), (376, 470), (372, 534), (300, 540), (262, 512)],
    'ahoge': [(486, 180), (560, 180), (560, 214), (512, 214), (508, 232), (492, 232)],
    'head': [(260, 205), (640, 205), (640, 420), (600, 420), (515, 428), (505, 436), (476, 436), (476, 410), (394, 410), (394, 436), (346, 432), (262, 432)],
    'armback': [(505, 430), (560, 445), (640, 480), (640, 548), (600, 566), (545, 566), (530, 520), (518, 500), (525, 470)],
    'legL': [(345, 504), (395, 507), (447, 507), (437, 566), (345, 566)],
    'legR': [(447, 507), (480, 507), (525, 500), (545, 566), (437, 566)],
    'torso': [(240, 380), (640, 380), (640, 513), (530, 513), (530, 530), (476, 530), (476, 513), (240, 513)],
}
IDLE_ORDER = ['ahoge', 'arm', 'head', 'armback', 'torso', 'legL', 'legR']


def idle_fix(rgb, fig, rgba):
    H, W = fig.shape
    # the video's black bar above her head (the ahoge pokes into it), the skate ramp's edges behind her
    bar = P.poly_mask((H, W), [(0, 0), (W, 0), (W, 207), (0, 207)]) & ~P.poly_mask((H, W), [(480, 180), (560, 180), (560, 215), (480, 215)])
    ramp = P.poly_mask((H, W), [(585, 290), (630, 280), (630, 330), (598, 318)]) | P.poly_mask((H, W), [(540, 402), (560, 398), (640, 450), (625, 470)])
    fig = fig & ~bar & ~ramp
    # her head from the auto cut (its hair edge is right; the ramp's edge touches it here), minus that edge
    stick = P.poly_mask((H, W), [(549, 391), (605, 418), (600, 436), (541, 426), (541, 400)])
    headfig = (rgba[..., 3] > 100) & ~stick
    # (the auto cut also lost the dark hair over her left shoulder: the outline-traced figure has it)
    headfig |= fig & P.poly_mask((H, W), [(338, 380), (400, 380), (400, 446), (338, 446)])
    return fig, {'head': headfig, 'ahoge': strand(rgb, headfig, IDLE_POLY['ahoge'])}


def idle_post(lab, rgb, ORDER):
    I = ORDER.index; H, W = lab.shape
    # the chin: the collar under it is the torso's
    lab = chin(lab, rgb, I('head'), I('torso'), range(394, 477), lambda x: 397 - max(0, x - 440) * 0.15)
    # her left shoulder: the jacket's blue is the arm's, her hair (and its outline, drawn over the arm) the head's
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    zone = P.poly_mask((H, W), [(338, 415), (400, 415), (400, 446), (338, 446)])
    lab[zone & (b > 140) & (r < 110) & (g < 110) & np.isin(lab, [I('head'), I('torso')])] = I('arm')
    ink = rgb.max(2) < 70
    lab = hem(lab, rgb, I('torso'), range(372, 493), 470, 514)
    r, g, b_ = (rgb[..., i].astype(int) for i in range(3))
    knee = (r > 170) & (g < 150) & (b_ < 135) & (r - b_ > 60)          # (her knee, between the skirt and the jeans)
    kz = P.poly_mask((H, W), [(372, 494), (500, 494), (500, 520), (372, 520)])
    lab[kz & knee & (lab == I('torso'))] = -1
    # the jacket's lower right keeps going down a little (she sits on it): minus the light jeans in there
    jx = P.poly_mask((H, W), [(476, 506), (530, 506), (530, 530), (476, 530)])
    light = (rgb.astype(int).sum(2) > 450) | ((rgb[..., 2].astype(int) > 200) & (rgb[..., 0].astype(int) > 140))
    lab[jx & light & (lab == I('torso'))] = -1
    return lab


def hem(lab, rgb, torso, xs, y0, y1):
    """her jeans (and a knee) peeking under the skirt (BF's legs are hers): everything below the skirt's hem ink goes"""
    H = lab.shape[0]; ink = rgb.max(2) < 70
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    skirt = (r > 150) & (b > 100) & (b - r < 25) & (g < r + 12)     # (pinks, whites, pleat lines: not the jeans)
    ye = {}
    for x in xs:
        ys = [y for y in range(y0, y1) if skirt[y, x] and lab[y, x] == torso]
        if not ys: continue
        y = max(ys) + 1
        dark = [yy for yy in range(y, min(H, y + 8)) if ink[yy, x]]
        if dark:
            ya = y = dark[0]
            while y < H and y < ya + 6 and rgb[y, x].max() < 120: y += 1
        ye[x] = y
    ks = sorted(ye)
    for x in ks:          # (a pleat line reaching the hem would leave a notch: the hem is smoothed across columns)
        y = int(np.median([ye[k] for k in ks if abs(k - x) <= 4]))
        col = lab[y:, x]; col[col == torso] = -1
    return lab


def idle_finish(pp):
    dome(pp['head'], 210, skip=[(486, 512)])
    seal_bottom(pp['torso'], range(476, 531))
    underlay(pp['torso'], pp['head'][..., 3] > 0, reach=7)          # (more would show as a hump when her head dips)
    underlay(pp['torso'], pp['arm'][..., 3] > 0, reach=24)


# --- the "picked" drawing (video frame down_03)
SEL_OUTER = [(410, 175), (500, 170), (495, 215), (545, 250), (560, 300), (545, 340), (560, 360), (640, 365), (670, 400), (680, 470), (665, 525),
             (600, 530), (560, 520), (560, 560), (370, 565), (300, 540), (240, 535), (175, 530), (170, 470), (200, 440), (250, 430), (240, 400),
             (250, 330), (240, 260), (290, 220), (380, 205)]
SEL_POLY = {
    'armL': [(160, 430), (260, 420), (290, 440), (300, 425), (376, 425), (376, 503), (305, 503), (300, 545), (240, 545), (160, 540)],
    'armR': [(476, 373), (520, 368), (560, 358), (600, 348), (690, 376), (690, 540), (610, 540), (560, 520), (540, 470), (520, 445), (476, 424)],
    'ahoge': [(405, 165), (520, 165), (520, 212), (450, 212), (445, 228), (425, 228)],
    'head': [(220, 200), (580, 200), (580, 420), (520, 440), (470, 452), (372, 452), (300, 440), (220, 430)],
    'torso': [(372, 380), (600, 380), (600, 532), (372, 532)],
}
SEL_ORDER = ['ahoge', 'armL', 'armR', 'head', 'torso']


def sel_fix(rgb, fig, rgba):
    H, W = fig.shape
    fig = fig & ~P.poly_mask((H, W), [(534, 318), (560, 300), (600, 300), (600, 330), (555, 338), (540, 340)])
    # the left sleeve's outline has gaps: closed harder there
    lp = [(165, 425), (300, 420), (372, 424), (380, 520), (300, 548), (160, 548)]
    fig = fig | (silhouette(rgb, lp, close=3) & P.poly_mask((H, W), lp))
    bar = P.poly_mask((H, W), [(0, 0), (W, 0), (W, 212), (0, 212)]) & ~P.poly_mask((H, W), [(425, 160), (500, 160), (500, 214), (425, 214)])
    fig = fig & ~bar
    cream = rgb.min(2) > 150
    ah = P.poly_mask((H, W), [(405, 160), (520, 160), (520, 212), (405, 212)])
    fig = fig & ~(ah & ~(cv2.dilate(cream.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0))
    # the bar's edge left a thin straight line over the hair top: ink there with nothing under it goes
    for y in range(208, 226):
        for x in range(W):
            if fig[y, x] and rgb[y, x].max() < 70 and not fig[min(H - 1, y + 9), x]: fig[y, x] = False
    fig = fig & ~P.poly_mask((H, W), [(652, 448), (700, 448), (700, 475), (652, 475)])
    # below her skirt: her socks + shoes (BF's legs take over)
    fig = fig & ~P.poly_mask((H, W), [(300, 527), (600, 522), (600, 600), (300, 600)])
    return fig, {'ahoge': strand(rgb, fig, SEL_POLY['ahoge'])}


def sel_post(lab, rgb, ORDER):
    I = ORDER.index; H, W = lab.shape
    lab = chin(lab, rgb, I('head'), I('torso'), range(330, 432), lambda x: 423)
    lab = chin(lab, rgb, I('head'), I('torso'), range(432, 461), lambda x: 453)                     # (the cream strand's tip)
    lab = chin(lab, rgb, I('head'), I('torso'), range(461, 481), lambda x: 448 - (x - 461) * 0.8)   # (the red strand's tip)
    # her sleeves reach in under her hair: their colour goes to the arms, not the head
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    sleeve = ((r > 170) & (b > 200) & (g < 170)) | ((b > 170) & (r < 120) & (g < 120))
    sleeve &= np.arange(H)[:, None] >= 360          # (her hair's outline has a purple rim light: only the shoulders)
    lab[sleeve & (lab == I('head')) & (np.arange(W)[None, :] < 400)] = I('armL')
    lab[sleeve & (lab == I('head')) & (np.arange(W)[None, :] >= 400)] = I('armR')
    # under the mic: her jacket + legs were there (cut off straight): the arm ends at the mic's own bottom ink
    mic = (r > 150) & (b > 110) & (g < 130) & (r > g + 60)          # (its pink mesh and the mesh's lines)
    ye = {}
    for x in range(300, 377):
        ys = [y for y in range(430, 515) if mic[y, x]]
        if not ys: continue
        y0 = y = max(ys) + 1
        while y < H and y < y0 + 10 and rgb[y, x].max() < 120: y += 1
        ye[x] = y
    ks = sorted(ye)
    for x in ks:
        y = int(np.median([ye[k] for k in ks if abs(k - x) <= 5]))
        col = lab[y:, x]; col[col == I('armL')] = -1
    corner = lab[497:, 365:382]; corner[np.isin(corner, [I('armL'), I('torso')])] = -1     # (a sliver of jeans there)
    return hem(lab, rgb, I('torso'), range(372, 600), 470, 533)


def split_ink(lab, rgb, frm, to, reach=7):
    """the outline between two parts goes half to each (to whichever part's colour is nearest), so neither
    keeps a strip of the other's outline"""
    ink = rgb.max(2) < 70
    paint = (lab >= 0) & ~ink
    dist, lbl = cv2.distanceTransformWithLabels((~paint).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(paint)
    lut = np.full(lbl.max() + 1, -1, int); lut[lbl[ys, xs]] = lab[ys, xs]
    near = lut[lbl]
    # (biased to the arms: the outline where a sleeve meets her hair is the sleeve's, never a dotted leftover)
    fpaint = paint & np.isin(lab, frm)
    dfrm = cv2.distanceTransform((~fpaint).astype(np.uint8), cv2.DIST_L2, 5)
    out = lab.copy()
    for t in to:
        tp = paint & (lab == t)
        dt = cv2.distanceTransform((~tp).astype(np.uint8), cv2.DIST_L2, 5)
        zone = ink & np.isin(lab, frm) & (dt <= reach) & (dt <= dfrm + 2.5)
        out[zone] = t
    return out


def sel_finish(pp):
    dome(pp['head'], 212, skip=[(424, 452)])
    seal_bottom(pp['torso'], range(300, 600))
    underlay(pp['torso'], pp['head'][..., 3] > 0, reach=7)
    underlay(pp['torso'], pp['armL'][..., 3] > 0, reach=24)
    underlay(pp['armR'], (pp['head'][..., 3] > 0) | (pp['torso'][..., 3] > 0), reach=12)


def seal_bottom(img, xs, T=4):
    """where a part was cut off flat at the bottom (not along her ink), an ink line closes it"""
    for x in xs:
        ys = np.nonzero(img[:, x, 3] > 100)[0]
        if not len(ys): continue
        y = ys.max()
        if img[y, x, :3].max() >= 60:
            img[y - T + 1:y + 1, x, :3] = (12, 10, 14); img[y - T + 1:y + 1, x, 3] = 255


# ================================================================ FNF's own pieces, recoloured
def symbol_image(atlas_dir, symbol):
    """frame 0 of one symbol of an Animate atlas (FNF's character select art) as an RGBA image"""
    an = json.load(open(os.path.join(atlas_dir, 'Animation.json')))
    sm = json.load(open(os.path.join(atlas_dir, 'spritemap1.json')))
    sheet = Image.open(os.path.join(atlas_dir, 'spritemap1.png')).convert('RGBA')
    spr = {}
    for s in sm['ATLAS']['SPRITES']:
        d = s['SPRITE']; c = sheet.crop((d['x'], d['y'], d['x'] + d['w'], d['y'] + d['h']))
        spr[d['name']] = c.transpose(Image.ROTATE_90) if d['rotated'] else c
    SD = {s['SN']: s for s in an['SD']['S']}
    items = []
    def walk(name, M):
        for L in reversed(SD[name]['TL']['L']):           # (the first layer is the top one)
            for e in L['FR'][0]['E']:
                if 'SI' in e: walk(e['SI']['SN'], P.mmul(M, e['SI']['MX']))
                else: items.append((spr[e['ASI']['N']], P.mmul(M, e['ASI']['MX'])))
    walk(symbol, P.M())
    xs, ys = [], []
    for im, m in items:
        w, h = im.size
        for x, y in ((0, 0), (w, 0), (0, h), (w, h)):
            xs.append(m[0] * x + m[2] * y + m[4]); ys.append(m[1] * x + m[3] * y + m[5])
    x0, y0 = math.floor(min(xs)) - 2, math.floor(min(ys)) - 2
    W, H = math.ceil(max(xs)) - x0 + 2, math.ceil(max(ys)) - y0 + 2
    acc = np.zeros((H, W, 4), np.float32)
    for im, m in items:
        a = np.asarray(im).astype(np.float32) / 255; a[..., :3] *= a[..., 3:4]
        Mx = np.array([[m[0], m[2], m[4] - x0], [m[1], m[3], m[5] - y0]], np.float32)
        w = cv2.warpAffine(a, Mx, (W, H), flags=cv2.INTER_LINEAR)
        acc = w + acc * (1 - w[..., 3:4])
    rgb = np.where(acc[..., 3:4] > 1e-4, acc[..., :3] / np.maximum(acc[..., 3:4], 1e-4), 0)
    return (np.dstack([rgb, acc[..., 3:4]]) * 255).clip(0, 255).astype(np.uint8)


def lum(c): return c[..., 0] * 0.299 + c[..., 1] * 0.587 + c[..., 2] * 0.114


def ramp(L, stops):
    xs = np.array([s[0] for s in stops], float); out = np.zeros(L.shape + (3,))
    for ch in range(3): out[..., ch] = np.interp(L, xs, [s[1][ch] for s in stops])
    return out


def recolor_amp(a, body_stops, metal_stops, metal_cut=30):
    """the grey speaker -> a colour ramp by brightness; its bluish light trim -> an accent ramp"""
    a = a.astype(float); rgb = a[..., :3]; L = lum(rgb)
    metal = ((rgb[..., 2] - rgb[..., 0]) > metal_cut) & (L > 70)
    out = ramp(L, body_stops); out[metal] = ramp(L[metal], metal_stops)
    return np.dstack([out, a[..., 3]]).clip(0, 255).astype(np.uint8)


def palette_map(a, pairs):
    """flat FNF art: every pixel = k * one palette colour (anti-aliasing toward the black ink): swap colours, keep k"""
    a = a.astype(float); rgb = a[..., :3].reshape(-1, 3)
    Pc = np.array([p for p, _ in pairs], float); Q = np.array([q for _, q in pairs], float)
    best = np.full(len(rgb), 1e18); outc = np.zeros_like(rgb)
    for i in range(len(Pc)):
        k = np.clip((rgb @ Pc[i]) / max(Pc[i] @ Pc[i], 1), 0, 1.05)
        err = ((rgb - k[:, None] * Pc[i]) ** 2).sum(1)
        m = err < best; best[m] = err[m]; outc[m] = k[m, None] * Q[i]
    blackish = rgb.max(1) < 30; outc[blackish] = rgb[blackish]
    return np.dstack([outc.reshape(a.shape[:2] + (3,)), a[..., 3]]).clip(0, 255).astype(np.uint8)


# BF's own speaker from his character select (a box seen from above, so she can sit ON it): purple with pink trim
# for her, navy with red trim for the cap girl
JORDUS_AMP = dict(body_stops=[(0, (0, 0, 0)), (25, (16, 6, 28)), (52, (52, 22, 92)), (60, (66, 30, 112)), (66, (80, 38, 134)), (75, (98, 50, 160)), (100, (130, 80, 200))],
                  metal_stops=[(60, (120, 20, 80)), (100, (240, 90, 170)), (140, (255, 140, 200)), (200, (255, 200, 230))])
CAP_AMP = dict(body_stops=[(0, (0, 0, 0)), (25, (6, 8, 16)), (52, (20, 24, 50)), (60, (28, 32, 64)), (66, (36, 40, 80)), (75, (46, 52, 100)), (100, (70, 78, 140))],
               metal_stops=[(60, (110, 10, 24)), (100, (230, 50, 64)), (140, (255, 100, 100)), (200, (255, 170, 170))])
AMP_SEAT = (86, 34)         # where on that box (its own px) the middle of her skirt hem sits


def speaker(ramps, flip=False):
    a = recolor_amp(symbol_image(os.path.join(CS, 'bfChill'), 'speaker bf'), **ramps)
    return np.ascontiguousarray(a[:, ::-1]) if flip else a
# BF's jeans -> her light-blue pants, his red sneaker -> a black one with light-blue laces
LEG = [((255, 45, 50), (46, 42, 76)), ((171, 22, 74), (24, 20, 46)), ((0, 102, 204), (186, 222, 246)), ((15, 27, 130), (104, 162, 230)),
       ((254, 235, 247), (214, 238, 252)), ((219, 147, 230), (150, 172, 218))]


def bf_leg():
    an = json.load(open(os.path.join(CS, 'bfChill', 'spritemap1.json')))
    sheet = Image.open(os.path.join(CS, 'bfChill', 'spritemap1.png')).convert('RGBA')
    d = next(s['SPRITE'] for s in an['ATLAS']['SPRITES'] if s['SPRITE']['name'] == '7')   # (his leg hanging over the speaker)
    c = sheet.crop((d['x'], d['y'], d['x'] + d['w'], d['y'] + d['h']))
    if d['rotated']: c = c.transpose(Image.ROTATE_90)
    o = np.asarray(c)
    a = palette_map(o, LEG)
    # his pant leg runs up-left into his body: hers stops at a seam under her skirt (straight down, inked).
    # Only the jeans above his sneaker's top are cut
    red = (o[..., 0].astype(int) > 150) & (o[..., 1] < 80) & (o[..., 3] > 200)
    cut = 60
    for x in range(a.shape[1]):
        ys = np.nonzero(red[:, x])[0]
        top = ys.min() - 3 if len(ys) else a.shape[0]
        if x < cut: a[:top, x, 3] = 0
        elif x < cut + 5:
            m = a[:top, x, 3] > 0; a[:top, x, :3][m] = 0; a[:top, x, 3][m] = 255
    return a


# ================================================================ the rig
def crop(a):
    ys, xs = np.nonzero(a[..., 3] > 0); x0, y0 = max(0, xs.min() - 1), max(0, ys.min() - 1)
    return a[y0:ys.max() + 2, x0:xs.max() + 2].copy(), int(x0), int(y0)


class Part:
    def __init__(s, name, img, x0, y0): s.name, s.img, s.x0, s.y0 = name, img, x0, y0


# each drawing in its own frame px: HEM = her skirt hem's middle (where she sits), bone pivots, where the legs hang
D = {
    'idle': dict(HEM=(432, 505), bones={'torso': (432, 505), 'head': (430, 398), 'ahoge': (495, 224), 'arm': (365, 445), 'armback': (512, 442)},
                 parts={'armback': 'armback', 'torso': 'torso', 'head': 'head', 'ahoge': 'ahoge', 'arm': 'arm'}, legs=(410, 462)),
    'sel': dict(HEM=(452, 524), bones={'torso': (452, 524), 'head': (438, 442), 'ahoge': (431, 223), 'arm': (372, 455), 'armback': (486, 402)},
                parts={'armback': 'armR', 'torso': 'torso', 'head': 'head', 'ahoge': 'ahoge', 'arm': 'armL'}, legs=(428, 478)),
}
LK = 0.60                    # BF's leg art -> her drawing px


class Place:
    """where she + her amp go on an Animate stage: K = her drawing px -> stage px, seat = the stage point of her
    skirt hem, amp_k / amp_bottom = the amp (x, y scale; bottom middle), amp_front = the amp in front of her
    (the DJ booth), legs = show her legs"""
    def __init__(s, K, seat, amp_k, amp_bottom, amp_front=False, legs=True):
        s.K, s.seat, s.amp_k, s.amp_bottom, s.amp_front, s.legs = K, seat, amp_k, amp_bottom, amp_front, legs


def on_amp(amp, amp_k, amp_bottom, dx=0, dy=0, src=AMP_SEAT):
    """the stage point of a spot on the box (its px) -> where her hem goes"""
    h, w = amp.shape[:2]
    return (amp_bottom[0] + (src[0] - w / 2) * amp_k[0] + dx, amp_bottom[1] + (src[1] - h) * amp_k[1] + dy)


class Rig:
    def __init__(s, idle_parts, sel_parts, amp, leg):
        s.sprites, s.parts = {}, {}
        for dn, pp in (('idle', idle_parts), ('sel', sel_parts)):
            for bone, pn in D[dn]['parts'].items():
                img, x0, y0 = crop(pp[pn])
                p = Part(dn + '_' + bone, img, x0, y0); s.sprites[p.name] = img; s.parts[(dn, bone)] = p
        s.amp = amp; s.sprites['amp'] = amp
        s.leg = leg; s.sprites['legL'] = leg; s.sprites['legR'] = leg[:, ::-1].copy()

    def pose(s, dn, pose, body=(0, 0, 1, 1, 0), amp_pose=(0, 0, 1, 1), pl=None):
        """one frame: dn = which drawing, pose = {bone: {rot, sx, sy, dx, dy}} in that drawing's px,
        body = (dx, dy, sx, sy, rot) of all of her about the seat (stage px), amp_pose = (dx, dy, sx, sy) of the amp"""
        d = D[dn]; hx, hy = d['HEM']
        bdx, bdy, bsx, bsy, brot = body
        G = P.mmul(P.T(pl.seat[0] + bdx, pl.seat[1] + bdy), P.mmul(P.local((0, 0), brot, bsx, bsy), P.mmul(P.M(pl.K, 0, 0, pl.K), P.T(-hx, -hy))))
        bones = {'root': (None, (hx, hy)), 'torso': ('root', d['bones']['torso'])}
        for b in ('head', 'arm', 'armback'): bones[b] = ('torso', d['bones'][b])
        bones['ahoge'] = ('head', d['bones']['ahoge'])
        bones['legL'] = ('root', (d['legs'][0], hy)); bones['legR'] = ('root', (d['legs'][1], hy))
        Wm = P.Rig(bones).world(pose)
        adx, ady, asx, asy = amp_pose
        ah, aw = s.amp.shape[:2]
        am = P.mmul(P.T(pl.amp_bottom[0] + adx, pl.amp_bottom[1] + ady), P.mmul(P.M(asx * pl.amp_k[0], 0, 0, asy * pl.amp_k[1]), P.T(-aw / 2, -ah)))
        def part(bone):
            p = s.parts[(dn, bone)]; return ('S', p.name, P.mmul(G, P.mmul(Wm[bone], P.T(p.x0, p.y0))))
        def leg(bone, hipx, flip):
            w = s.leg.shape[1]; topx = w * (0.38 if flip else 0.62)
            local = P.mmul(P.T(hipx, hy - 14), P.mmul(P.M(LK, 0, 0, LK), P.T(-topx, 0)))
            return ('S', 'legR' if flip else 'legL', P.mmul(G, P.mmul(Wm[bone], local)))
        els = [] if pl.amp_front else [('S', 'amp', am)]
        els.append(part('armback'))
        if pl.legs: els += [leg('legL', d['legs'][0], False), leg('legR', d['legs'][1], True)]
        # (her hair hangs over her shoulders: the arms go under the head)
        els += [part('torso'), part('arm'), part('head'), part('ahoge')]
        if pl.amp_front: els.append(('S', 'amp', am))
        return els


# ================================================================ motion
# Timed like FNF's own character select + freeplay art (bfChill / picoChill / freeplay-boyfriend, read frame by frame):
# poses change every 2 frames ("on twos"), the beat lands on frame 0 already in the hit pose, the deepest frame is 2
# frames later, then it eases back and settles by frame 10. Only the head really moves; the body gives a few px,
# arms follow a little, legs stay put, nothing stretches.
def ease(t, k):
    return {'lin': t, 'in': t * t, 'out': 1 - (1 - t) ** 2, 'inout': t * t * (3 - 2 * t)}.get(k, t)


def track(keys, f):
    """keys = [(frame, value, ease into this key)]"""
    if f <= keys[0][0]: return keys[0][1]
    for (f0, v0, _), (f1, v1, e) in zip(keys, keys[1:]):
        if f <= f1: return v0 + (v1 - v0) * ease((f - f0) / max(1e-9, f1 - f0), e)
    return keys[-1][1]


def twos(frames):
    """hold every pose for 2 frames, like FNF's animators (smooth every-frame motion is what made her look floaty)"""
    return [frames[i - i % 2] for i in range(len(frames))]


# the nod (head), the give (body): 1 = the hit
NOD = [(0, 0.80, 'lin'), (2, 1.0, 'out'), (4, 0.42, 'out'), (6, 0.13, 'inout'), (8, 0.03, 'inout'), (10, 0.0, 'inout')]
GIVE = [(0, 1.0, 'lin'), (2, 0.32, 'out'), (4, 0.0, 'out')]


def bop(f, side, big=1.0):
    """one beat of chilling (15 frames): her head dips + tilts toward `side` on the beat and eases back up"""
    k = track(NOD, f) * big; b = track(GIVE, f) * big
    return {'torso': {'dy': 3.5 * b, 'rot': 0.8 * side * b},
            'head': {'dy': 12 * k, 'dx': 1.5 * side * k, 'rot': 3.8 * side * k},
            'ahoge': {'rot': track([(0, -2.0, 'lin'), (2, -3.0, 'lin'), (4, 2.0, 'inout'), (6, 0.8, 'inout'), (8, -0.3, 'inout'), (10, 0, 'inout')], f) * big},
            'arm': {'rot': 3.0 * b + 1.0 * k, 'dy': 3.0 * b},
            'armback': {'rot': -1.2 * b}}


def amp_bump(f):
    """the box gives under her on the beat (BF's speaker does the same on frame 1)"""
    return (0, 0, 1.004, 0.995) if f in (0, 1) else (0, 0, 1, 1)


SEL_HEAD = {'sx': 0.92, 'sy': 0.92}      # (the shades drawing's head was nearer the camera: same size as the other)


def picked(g, lift=0.0):
    """the shades pose, g frames after she snaps into it (BF's confirm: 2 frames a touch past the pose, then it settles)"""
    s = 1.0 if g < 2 else 0.0
    return ({'torso': {'dy': -5 * s, 'rot': -1.0 * s}, 'head': dict(SEL_HEAD, rot=-1.5 - 3 * s, dy=-2 * s),
             'ahoge': {'rot': 5 * s if g < 2 else (-2.5 if g < 4 else 0)},
             'arm': {'rot': -6 * s}, 'armback': {'rot': 6 * s}},
            (0, -lift * s, 1, 1, 0))


def meh(k=1.0):
    """let down (after a deselect): head tilts away, mic droops, the ahoge flops a bit"""
    return {'torso': {'dy': 2 * k, 'rot': -0.8 * k}, 'head': {'dy': 6 * k, 'rot': -5 * k, 'dx': -2 * k},
            'ahoge': {'rot': -9 * k}, 'arm': {'rot': 5 * k, 'dy': 4 * k}, 'armback': {'rot': 2 * k}}


def slump(k, sway=0.0, deep=1.0):
    """sad: she sinks, head hangs, mic droops, the ahoge flops over"""
    return {'torso': {'dy': 6 * k * deep, 'rot': -2 * sway},
            'head': {'dy': 24 * k * deep, 'rot': -10 * k * deep + 2 * sway},
            'ahoge': {'rot': -40 * k + 3 * sway},
            'arm': {'rot': 22 * k * deep, 'dy': 26 * k * deep}, 'armback': {'rot': 8 * k * deep}}


class Timeline:
    def __init__(s): s.frames, s.labels, s.symbols = [], [], {}
    def add(s, label, frames): s.labels.append((label, len(s.frames), len(frames))); s.frames.extend(frames)


# ---------------------------------------------------------------- character select (like bfChill)
def chill(rig):
    amp_k = (0.92, 0.92); amp_bottom = (1018, 642)
    pl = Place(0.90, on_amp(rig.amp, amp_k, amp_bottom), amp_k, amp_bottom)
    E = lambda dn, p, body=(0, 0, 1, 1, 0), amp=(0, 0, 1, 1): rig.pose(dn, p, body, amp, pl=pl)
    T = Timeline()
    # idle: two beats, her head tilts one way then the other (15 frames each, like BF's)
    T.add('idle', twos([E('idle', bop(f, 1), amp=amp_bump(f)) for f in range(15)]) + twos([E('idle', bop(f, -1), amp=amp_bump(f)) for f in range(15)]))
    # select: she snaps into her shades pose (2 frames a touch past it), it settles, the screen holds the last frame
    sel = []
    for g in range(13):
        p, body = picked(g, lift=6)
        sel.append(E('sel', p, body, amp=(0, 0, 1.006, 0.99) if g < 2 else (0, 0, 1, 1)))
    T.add('select', twos(sel))
    # deselect: shades off, let down; it holds (the screen goes back to idle after a second)
    T.add('deselect', twos([E('idle', meh(0.6 if g < 2 else 1.0)) for g in range(6)]))
    T.add('deselect loop start', [E('idle', meh(1.0)) for _ in range(16)])
    # slide in from the right (bfChill's own offsets), smeared on the fast frames; out: a step, then gone
    T.symbols['figure'] = E('idle', bop(14, 1))
    cx = amp_bottom[0]
    def slid(dx, st, alpha=1): return ('I', 'figure', P.mmul(P.T(cx + dx, 0), P.mmul(P.M(st, 0, 0, 1), P.T(-cx, 0))), alpha)
    sl = []
    for dx, st in [(321, 1.75), (167, 1.4), (-24, 1), (-24, 1), (-3, 1), (-3, 1), (-5, 1), (-5, 1)]:
        sl.append([slid(dx + 80, st, 0.22), slid(dx + 40, st, 0.22), slid(dx, st, 0.85)] if st > 1.01 else [slid(dx, st)])
    T.add('slidein', sl)
    # (then the idle from its frame 5 on, like bfChill)
    T.add('slidein idle point', twos([E('idle', bop(f, 1)) for f in range(4, 15)])[1:])
    T.add('slideout', [[slid(-23, 1)], [slid(-151, 1.7, 0.22), slid(-111, 1.7, 0.22), slid(-71, 1.7, 0.85)]])
    return T


# ---------------------------------------------------------------- freeplay DJ (like freeplay-boyfriend): behind her amp
def dj(rig):
    amp_k = (1.02, 1.02); amp_bottom = (226, 742)
    pl = Place(0.86, on_amp(rig.amp, amp_k, amp_bottom, dy=6), amp_k, amp_bottom, amp_front=True, legs=False)
    E = lambda dn, p, body=(0, 0, 1, 1, 0), amp=(0, 0, 1, 1): rig.pose(dn, p, body, amp, pl=pl)
    T = Timeline()
    # Intro: the box slides up, she pops up behind it (a touch too high), drops into place
    intro = []
    for f in range(17):
        amp_dy = track([(0, 230, 'lin'), (4, -8, 'out'), (6, 0, 'inout')], f)
        up = track([(0, 430, 'lin'), (4, 430, 'lin'), (8, -22, 'out'), (10, 4, 'inout'), (12, 0, 'inout')], f)
        p = bop(14, 1); p['ahoge'] = {'rot': track([(0, 0, 'lin'), (8, -8, 'out'), (10, 5, 'inout'), (12, -2, 'inout'), (14, 0, 'inout')], f)}
        intro.append(E('idle', p, body=(0, up, 1, 1, 0), amp=(0, amp_dy, 1, 1)))
    T.add('Intro', twos(intro))
    # Idle: one nod per beat (14 frames at freeplay's tempo), tilting the other way every other loop is not needed:
    # the DJ idle restarts each beat, so it nods one way like BF's
    T.add('Idle', twos([E('idle', bop(f, 1)) for f in range(14)]))
    # Confirm: snaps into her shades pose, settles, then nods once while the song loads
    con = []
    for g in range(28):
        p, body = picked(g, lift=8)
        if g >= 14:
            k = track([(14, 0, 'lin'), (14.01, 0.8, 'lin'), (16, 1.0, 'out'), (18, 0.4, 'out'), (20, 0.12, 'inout'), (22, 0, 'inout')], g)
            p['head'] = dict(SEL_HEAD, rot=-1.5 + 3 * k, dy=8 * k); p['torso'] = {'dy': 2 * k}
        con.append(E('sel', p, body))
    T.add('Confirm', twos(con))
    # Fist Pump: frames 0-3 (a crouch, held while the rank shows), then she snaps up into the shades pose and bounces
    crouch = lambda: E('idle', dict(bop(2, 1, 1.2), torso={'dy': 6, 'rot': 0}), body=(0, 6, 1, 1, 0))
    pump = []
    for g in range(38):
        hop = track([(0, 0, 'lin'), (2, 26, 'out'), (6, 30, 'inout'), (10, 0, 'in'), (12, 0, 'lin'), (14, 10, 'out'), (18, 0, 'in'),
                     (20, 0, 'lin'), (22, 5, 'out'), (26, 0, 'in')], g)
        p, _ = picked(g)
        p['arm'] = {'rot': -8 * min(1, hop / 26 + 0.4)}; p['armback'] = {'rot': 8 * min(1, hop / 26 + 0.4)}
        p['ahoge'] = {'rot': track([(0, 0, 'lin'), (2, -6, 'out'), (6, -4, 'inout'), (10, 6, 'in'), (12, 2, 'out'), (16, -2, 'inout'), (20, 0, 'inout')], g)}
        pump.append(E('sel', p, body=(0, -hop, 1, 1, 0)))
    T.add('Fist Pump', [crouch() for _ in range(4)] + twos(pump))
    lo = [crouch() for _ in range(4)]
    for g in range(56):
        k = track([(0, 0, 'lin'), (6, 1, 'out')], g); sway = math.sin(max(0, g - 6) * 2 * math.pi / 32) * k
        lo.append(E('idle', slump(k, sway, 0.7), body=(0, 18 * k, 1, 1, 0)))
    T.add('Fist Pump Loss', lo[:4] + twos(lo[4:]))
    # AFK: she leans in and dozes off (slow breathing), jerks awake, looks around
    afk = []
    for g in range(96):
        doze = track([(0, 0, 'lin'), (30, 1, 'inout'), (62, 1, 'lin'), (64, -0.2, 'out'), (70, 0.08, 'inout'), (78, 0, 'inout')], g)
        look = track([(0, 0, 'lin'), (66, 0, 'lin'), (72, 5, 'out'), (82, -5, 'inout'), (92, 0, 'inout')], g)
        br = math.sin(g * 2 * math.pi / 24) * max(0, doze)
        p = bop(14, 1)
        p['torso'] = {'dy': 4 * doze + 1.2 * br}
        p['head'] = {'dy': 14 * doze, 'rot': -9 * doze + look}
        p['ahoge'] = {'rot': -22 * max(0, doze) + 2 * br + (10 if 63 <= g <= 65 else 0)}
        p['arm'] = {'rot': 7 * doze, 'dy': 7 * doze}
        afk.append(E('idle', p, body=(0, 10 * max(0, doze), 1, 1, 0)))
    T.add('AFK', twos(afk))
    cs = []
    for g in range(18):       # a little hop, then she ducks behind the box
        up = track([(0, 0, 'lin'), (2, 6, 'out'), (5, -22, 'out'), (9, 40, 'in'), (13, 470, 'in'), (17, 470, 'lin')], g)
        p = bop(14, 1); p['ahoge'] = {'rot': track([(0, 0, 'lin'), (5, -8, 'out'), (9, 8, 'inout')], g)}
        cs.append(E('idle', p, body=(0, up, 1, 1, 0)))
    T.add('To Character Select', twos(cs))
    return T


# ---------------------------------------------------------------- results (like results-bf): one per rank, intro + 'loop'
def results(rig):
    amp_k = (1.2, 1.2); amp_bottom = (1050, 772)
    pl = Place(1.12, on_amp(rig.amp, amp_k, amp_bottom), amp_k, amp_bottom)
    E = lambda dn, p, body=(0, 0, 1, 1, 0), amp=(0, 0, 1, 1): rig.pose(dn, p, body, amp, pl=pl)
    def bounce(n, hop, period):
        out = []
        for g in range(n):
            ph = (g % period) / period
            h = math.sin(ph * math.pi)                         # (up and down once a beat)
            p, _ = picked(9)
            p['head'] = dict(SEL_HEAD, rot=-1.5 + 2.5 * math.sin(ph * 2 * math.pi), dy=-3 * h)
            p['ahoge'] = {'rot': 4 * math.sin(ph * 2 * math.pi - 1.2)}
            p['arm'] = {'rot': -5 * h}; p['armback'] = {'rot': 5 * h}
            out.append(E('sel', p, body=(0, -hop * h, 1, 1, 0), amp=(0, 0, 1.004, 0.995) if g % period in (0, 1) else (0, 0, 1, 1)))
        return twos(out)
    def bops(n, big=1.0):
        out = [E('idle', bop(g % 14, 1 if (g // 14) % 2 == 0 else -1, big), amp=amp_bump(g % 14)) for g in range(n)]
        return twos(out)
    def popin(n=14):
        out = []
        for g in range(n):
            p, body = picked(g, lift=10)
            out.append(E('sel', p, body))
        return twos(out)
    def sad():
        out = []
        for g in range(50):
            k = track([(0, 0, 'lin'), (10, 1, 'out')], g); sway = math.sin(max(0, g - 10) * 2 * math.pi / 40) * k
            out.append(E('idle', slump(k, sway)))
        out = twos(out)
        return out[:10], out[10:]
    ranks = {'perfect': (popin(), bounce(24, 16, 12)), 'excellent': (popin(), bounce(28, 8, 14)),
             'great': (bops(4, 1.3), bops(28, 1.3)), 'good': (bops(4), bops(28)), 'loss': sad()}
    out = {}
    for r, (a, b) in ranks.items():
        T = Timeline(); T.add('intro', a); T.add('loop', b); out[r] = T
    return out


# ---------------------------------------------------------------- the cap girl on the speakers spot (like gfChill)
def cap_chill():
    """her real idle (12 video frames) on her navy amp. confirm = she hops off it and lands; deselect = a little slump"""
    sheet = Image.open(os.path.join(MOD, 'shared', 'images', 'characters', 'nightly', 'opp.png')).convert('RGBA')
    import re
    xml = open(os.path.join(MOD, 'shared', 'images', 'characters', 'nightly', 'opp.xml')).read()
    # (the packer may page big sheets later; jordus.py writes one sheet)
    fr = {m[0]: m[1:] for m in re.findall(r'<SubTexture name="(idle_\d+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"(?: frameX="(-?\d+)" frameY="(-?\d+)" frameWidth="(\d+)" frameHeight="(\d+)")?', xml)}
    def frame(i):
        x, y, w, h, fx, fy, fw, fh = fr['idle_%04d' % i]
        x, y, w, h = map(int, (x, y, w, h)); fx = int(fx or 0); fy = int(fy or 0)
        full = Image.new('RGBA', (int(fw or w), int(fh or h))); full.paste(sheet.crop((x, y, x + w, y + h)), (-fx, -fy))
        a = np.array(full); al = a[..., 3] > 40
        # thin strays (the skate ramp's edges) go; her thin bits (fingers) are joined to her, so they stay
        op = cv2.morphologyEx(al.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        n, cc, st, _ = cv2.connectedComponentsWithStats(op.astype(np.uint8), 8)
        body = cc == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        near = cv2.dilate(body.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        n, cc, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8), 8)
        keep = [j for j in range(1, n) if (near & (cc == j)).any() and st[j, cv2.CC_STAT_AREA] >= 30]
        a[..., 3] = np.where(np.isin(cc, keep) & (cv2.dilate(op.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0), a[..., 3], 0)
        return a
    base = frame(0)
    CK, STORE = 0.56, 0.62
    SEAT_SRC, SEAT = (600, 447), (280, 440)
    sprites, ph = {}, []
    for i in range(12):
        a = frame(i)
        (dx, dy), _ = cv2.phaseCorrelate(base[..., 3].astype(np.float32), a[..., 3].astype(np.float32))   # (her bounce)
        # (the ramp's ledge hid the lower right of her rear: jordus.py rounds it back in, drop_block)
        c, x0, y0 = crop(a); h, w = c.shape[:2]
        sprites['cap%02d' % i] = np.array(Image.fromarray(c).resize((max(1, round(w * STORE)), max(1, round(h * STORE))), Image.LANCZOS))
        ph.append((x0, y0))
    amp = speaker(CAP_AMP, flip=True); sprites['amp'] = amp
    amp_k, amp_bottom = (1.0, 1.0), (293, 644)          # (the box's seat right under her)
    def her(i, dx=0, dy=0, sx=1, sy=1):
        x0, y0 = ph[i]
        G = P.mmul(P.T(SEAT[0] + dx, SEAT[1] + dy), P.mmul(P.M(CK * sx, 0, 0, CK * sy), P.T(-SEAT_SRC[0], -SEAT_SRC[1])))
        return ('S', 'cap%02d' % i, P.mmul(G, P.mmul(P.T(x0, y0), P.M(1 / STORE, 0, 0, 1 / STORE))))
    def ampel(sx=1, sy=1):
        h, w = amp.shape[:2]
        return ('S', 'amp', P.mmul(P.T(*amp_bottom), P.mmul(P.M(amp_k[0] * sx, 0, 0, amp_k[1] * sy), P.T(-w / 2, -h))))
    T = Timeline()
    seq = [min(11, int(f * 12 / 13)) for f in range(15)]      # her bounce held to the beat (90 bpm), two beats
    T.add('idle', [[ampel(), her(k)] for k in seq] * 2)
    con = []
    for f in range(24):
        lift = track([(0, 4, 'lin'), (2, -34, 'out'), (5, -38, 'inout'), (8, 0, 'in'), (10, 0, 'lin')], f)
        sy = track([(0, 0.965, 'lin'), (2, 1.04, 'out'), (6, 1.01, 'inout'), (8, 0.96, 'in'), (10, 1.015, 'out'), (13, 1.0, 'inout')], f)
        asy = track([(0, 0.985, 'lin'), (2, 1.0, 'out'), (8, 1.0, 'lin'), (9, 0.975, 'out'), (12, 1.0, 'inout')], f)
        con.append([ampel(2 - asy, asy), her(seq[min(f, 14)] if f >= 10 else 0, dy=lift, sx=2 - sy, sy=sy)])
    T.add('confirm', twos(con))
    des = []
    for f in range(20):
        k = track([(0, 1, 'lin'), (4, 0.4, 'out'), (12, 0, 'inout')], f)
        des.append([ampel(), her(seq[min(f, 14)], dy=5 * k, sx=1 + 0.02 * k, sy=1 - 0.03 * k)])
    T.add('deselect', twos(des))
    return T, sprites


# ================================================================ writing
def write_atlas(out_dir, name, sprites, T):
    """Animate atlas: sprites + symbols, one keyframe per frame, several label layers (labels may overlap)"""
    os.makedirs(out_dir, exist_ok=True)
    used = {e[1] for f in T.frames for e in f if e[0] == 'S'} | {e[1] for els in T.symbols.values() for e in els if e[0] == 'S'}
    sheet, pos = P.pack_sprites({k: v for k, v in sprites.items() if k in used}, max_w=4096)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(out_dir, 'spritemap1.png'), optimize=True)
    sm = {'ATLAS': {'SPRITES': [{'SPRITE': {'name': n, 'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3], 'rotated': False}} for n, p in pos.items()]},
          'meta': {'app': 'fnf2 jordus_rig.py', 'image': 'spritemap1.png', 'format': 'RGBA8888', 'size': {'w': sheet.shape[1], 'h': sheet.shape[0]}, 'resolution': '1'}}
    json.dump(sm, open(os.path.join(out_dir, 'spritemap1.json'), 'w'), separators=(',', ':'))
    def el(e):
        if e[0] == 'S': return {'ASI': {'N': e[1], 'MX': [round(v, 4) for v in e[2]]}}
        d = {'SI': {'SN': e[1], 'IN': '', 'ST': 'G', 'FF': 0, 'LP': 'SF', 'MX': [round(v, 4) for v in e[2]]}}
        if len(e) > 3 and e[3] != 1: d['SI']['C'] = {'M': 'CA', 'AM': round(e[3], 3)}
        return d
    def timeline(frs):
        depth = max(1, max(len(f) for f in frs)); layers = [[] for _ in range(depth)]
        for i, f in enumerate(frs):
            for s in range(depth): layers[s].append({'I': i, 'DU': 1, 'E': [el(f[s])] if s < len(f) else []})
        return [{'LN': f'L{s}', 'FR': layers[s]} for s in reversed(range(depth))]
    rows = []
    for lab in sorted(T.labels, key=lambda l: l[1]):
        for r in rows:
            if r[-1][1] + r[-1][2] <= lab[1]: r.append(lab); break
        else: rows.append([lab])
    Ls = []
    for ri, r in enumerate(rows):
        FR, cur = [], 0
        for (n, st, ln) in r:
            if st > cur: FR.append({'I': cur, 'DU': st - cur, 'E': []})
            FR.append({'I': st, 'DU': ln, 'N': n, 'E': []}); cur = st + ln
        Ls.append({'LN': 'labels' + (str(ri) if ri else ''), 'FR': FR})
    SD = {'S': [{'SN': sn, 'TL': {'L': timeline([els])}} for sn, els in T.symbols.items()]}
    json.dump({'AN': {'N': name, 'SN': name, 'TL': {'L': Ls + timeline(T.frames)}}, 'SD': SD, 'MD': {'FRT': 24, 'W': 1280, 'H': 720}},
              open(os.path.join(out_dir, 'Animation.json'), 'w'), separators=(',', ':'))
    print('  %-58s %3d frames  sheet %dx%d' % (os.path.relpath(out_dir, MOD), len(T.frames), sheet.shape[1], sheet.shape[0]))


# ---------------------------------------------------------------- pixel icons (capsules + the character select grid)
def pixelate(im, height, cent, ink_lum=48):
    import inspect
    src = inspect.getsource(N.pixelate).replace('ink = lum < 48', 'ink = lum < %d' % ink_lum).replace('def pixelate(', 'def _px(')
    ns = {'np': np, 'Image': Image}; exec(src, ns)
    return ns['_px'](im, height, cent)


def kmeans_palette(*ims, k=16, extra=()):
    px = np.vstack([np.asarray(im).reshape(-1, 4).astype(np.float32) for im in ims]); px = px[px[:, 3] > 200][:, :3]
    rng = np.random.default_rng(1); cent = px[rng.choice(len(px), k, replace=False)]
    for _ in range(25):
        lab = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
        for c in range(len(cent)):
            m = px[lab == c]
            if len(m): cent[c] = m.mean(0)
    return np.vstack([cent, np.array(extra, np.float32).reshape(-1, 3)]).astype(np.float32)


def write_pixel_icon(name, idle, confirm):
    """FNF pixel icon sheet: idle, confirm 1-4 (squash, stretch, settle), confirm-hold; 50x50 frames"""
    sq = lambda im, sx, sy: im.resize((max(1, round(im.width * sx)), max(1, round(im.height * sy))), Image.NEAREST)
    frames = {'i': idle, 'c1': sq(idle, 1.12, 0.86), 'c2': sq(confirm, 0.9, 1.12), 'c3': confirm}
    seq = {'idle': ['i'], 'confirm': ['c1', 'c2', 'c3', 'c3'], 'confirm-hold': ['c3']}
    order = list(frames); W = sum(frames[k].width + 1 for k in order); H = max(frames[k].height for k in order)
    sheet = Image.new('RGBA', (W, H)); x = 0; spot = {}
    for k in order: sheet.paste(frames[k], (x, 0)); spot[k] = (x, frames[k].width, frames[k].height); x += frames[k].width + 1
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<TextureAtlas imagePath="%s.png" width="%d" height="%d">' % (name, W, H)]
    for an, fl in seq.items():
        for i, k in enumerate(fl):
            sx, w, h = spot[k]
            lines.append('  <SubTexture name="%s%04d" x="%d" y="0" width="%d" height="%d" frameX="%d" frameY="%d" frameWidth="50" frameHeight="50"/>'
                         % (an, i + 1 if an != 'confirm-hold' else 4, sx, w, h, -((50 - w) // 2), -(50 - h - 4)))
    lines.append('</TextureAtlas>')
    d = os.path.join(MOD, 'preload', 'images', 'freeplay', 'icons'); os.makedirs(d, exist_ok=True)
    sheet.save(os.path.join(d, name + '.png')); open(os.path.join(d, name + '.xml'), 'w').write('\n'.join(lines) + '\n')
    print('  preload/images/freeplay/icons/%s' % name)


def head_image(rig, dn):
    """her head + ahoge (largest piece only), for the icon"""
    hp, ap = rig.parts[(dn, 'head')], rig.parts[(dn, 'ahoge')]
    x0, y0 = min(hp.x0, ap.x0), min(hp.y0, ap.y0)
    W = max(hp.x0 + hp.img.shape[1], ap.x0 + ap.img.shape[1]) - x0; H = max(hp.y0 + hp.img.shape[0], ap.y0 + ap.img.shape[0]) - y0
    c = Image.new('RGBA', (W, H))
    for p in (hp, ap): c.alpha_composite(Image.fromarray(p.img), (p.x0 - x0, p.y0 - y0))
    a = np.asarray(c).copy()
    n, cc, st, _ = cv2.connectedComponentsWithStats((a[..., 3] > 100).astype(np.uint8), 8)
    a[..., 3] = np.where(cc == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), a[..., 3], 0)
    if dn == 'sel':
        # only down to her chin, without the bit of light purple sleeve beside it
        hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV)
        a[..., 3] = np.where((hsv[..., 0] > 125) & (hsv[..., 0] < 160) & (hsv[..., 2] > 150) & (hsv[..., 1] > 60), 0, a[..., 3])
        a[int(a.shape[0] * 0.93):, :, 3] = 0
    return N.trim(Image.fromarray(a))


def icons(rig):
    hi, hs = head_image(rig, 'idle'), head_image(rig, 'sel')
    cent = kmeans_palette(hi, hs, extra=[[255, 255, 255], [255, 90, 190], [232, 96, 132], [250, 232, 190]])
    write_pixel_icon('nightly-playerpixel', pixelate(hi, 40, cent), pixelate(hs, max(8, min(44, round(40 * hs.height / hi.height))), cent))
    # the cap girl: her head from her idle (her navy cap lifted a little so it doesn't read as black ink)
    sheet = Image.open(os.path.join(MOD, 'shared', 'images', 'characters', 'nightly', 'opp.png')).convert('RGBA')
    import re
    xml = open(os.path.join(MOD, 'shared', 'images', 'characters', 'nightly', 'opp.xml')).read()
    x, y, w, h, fx, fy, fw, fh = re.search(r'<SubTexture name="idle_0000" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"(?: frameX="(-?\d+)" frameY="(-?\d+)" frameWidth="(\d+)" frameHeight="(\d+)")?', xml).groups()
    x, y, w, h = map(int, (x, y, w, h))
    full = Image.new('RGBA', (int(fw or w), int(fh or h))); full.paste(sheet.crop((x, y, x + w, y + h)), (-int(fx or 0), -int(fy or 0)))
    a = np.array(full); Hh, Ww = a.shape[:2]
    m = P.poly_mask((Hh, Ww), [(380, 70), (480, 68), (560, 100), (615, 118), (615, 150), (580, 170), (560, 240), (530, 262), (470, 268), (420, 262), (390, 240), (372, 190), (380, 120)])
    a[..., 3] = np.where(m, a[..., 3], 0)
    rgb = a[..., :3].astype(np.float32); navy = (rgb[..., 2] > rgb[..., 0] + 25) & (rgb[..., 2] > rgb[..., 1] + 15)
    rgb[navy] = np.clip(rgb[navy] * 1.7 + 8, 0, 255); a[..., :3] = rgb.astype(np.uint8)
    hc = N.trim(Image.fromarray(a))
    cc_ = kmeans_palette(hc, k=12, extra=[[255, 255, 255], [255, 40, 60], [30, 40, 140], [255, 60, 110]])
    px = pixelate(hc, 36, cc_, ink_lum=26)
    write_pixel_icon('nightly-opppixel', px, px)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--preview', help='also write a contact sheet of every animation here')
    a = ap.parse_args()
    cent = palette()
    idle = cut_parts('idle_20', IDLE_OUTER, IDLE_POLY, IDLE_ORDER, idle_fix, cent, idle_post, idle_finish)
    sel = cut_parts('down_03', SEL_OUTER, SEL_POLY, SEL_ORDER, sel_fix, cent, sel_post, sel_finish)
    amp = speaker(JORDUS_AMP)
    rig = Rig(idle, sel, amp, bf_leg())
    write_atlas(os.path.join(MOD, 'preload', 'images', 'charSelect', 'nightlyChill'), 'JORDUS character select', rig.sprites, chill(rig))
    T, spr = cap_chill()
    write_atlas(os.path.join(MOD, 'preload', 'images', 'charSelect', 'capChill'), 'cap girl character select', spr, T)
    write_atlas(os.path.join(MOD, 'preload', 'images', 'freeplay', 'nightlyDJ'), 'JORDUS freeplay DJ', rig.sprites, dj(rig))
    for r, T in results(rig).items():
        write_atlas(os.path.join(MOD, 'shared', 'images', 'resultScreen', 'results-nightly', r), 'JORDUS results ' + r, rig.sprites, T)
    icons(rig)


if __name__ == '__main__':
    main()
