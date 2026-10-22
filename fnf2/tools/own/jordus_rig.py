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
  her amp       FNF's real 'larger speaker' (GF's character select speakers), recoloured purple + pink;
                the cap girl gets the same amp in navy + red
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


def cut_parts(name, outer, POLY, ORDER, fix, cent, head_from_auto=False):
    """-> {part: full-size RGBA in the frame's px}"""
    rgba = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    rgb = np.ascontiguousarray(rgba[..., :3])     # (the video picture is kept under the auto cut's alpha)
    H, W = rgb.shape[:2]
    fig = silhouette(rgb, outer)
    fig, src = fix(rgb, fig, rgba)
    lab = assign(fig, POLY, ORDER, (H, W), src)
    full = clean(rgb, lab >= 0, cent)
    out = {}
    for i, n in enumerate(ORDER):
        a = np.zeros((H, W, 4), np.uint8); a[..., :3] = full[..., :3]; a[..., 3] = np.where(lab == i, full[..., 3], 0)
        out[n] = a
    return out


# --- the chill drawing (video frame idle_20)
IDLE_OUTER = [(500, 190), (560, 195), (560, 215), (600, 232), (625, 250), (615, 300), (625, 390), (590, 420), (560, 440), (610, 500),
              (625, 530), (625, 570), (560, 575), (470, 572), (330, 572), (300, 560), (265, 540), (260, 470), (250, 420), (255, 385),
              (280, 360), (285, 320), (270, 290), (285, 255), (330, 215), (400, 195), (470, 195)]
IDLE_POLY = {
    'arm': [(246, 430), (250, 372), (282, 352), (342, 356), (352, 398), (382, 402), (384, 440), (376, 470), (372, 534), (300, 540), (262, 512)],
    'ahoge': [(486, 180), (560, 180), (560, 214), (512, 214), (508, 232), (492, 232)],
    'head': [(260, 205), (640, 205), (640, 420), (600, 420), (515, 428), (505, 432), (476, 430), (472, 402), (380, 400), (376, 428), (334, 430), (262, 420)],
    'armback': [(505, 430), (560, 445), (640, 480), (640, 548), (600, 566), (545, 566), (530, 520), (518, 500), (525, 470)],
    'legL': [(345, 504), (395, 507), (447, 507), (437, 566), (345, 566)],
    'legR': [(447, 507), (480, 507), (525, 500), (545, 566), (437, 566)],
    'torso': [(240, 380), (640, 380), (640, 513), (240, 513)],
}
IDLE_ORDER = ['arm', 'ahoge', 'head', 'armback', 'legL', 'legR', 'torso']


def idle_fix(rgb, fig, rgba):
    H, W = fig.shape
    # the video's black bar above her head (the ahoge pokes into it), the skate ramp's edges behind her
    bar = P.poly_mask((H, W), [(0, 0), (W, 0), (W, 207), (0, 207)]) & ~P.poly_mask((H, W), [(480, 180), (560, 180), (560, 215), (480, 215)])
    ramp = P.poly_mask((H, W), [(585, 290), (630, 280), (630, 330), (598, 318)]) | P.poly_mask((H, W), [(540, 402), (560, 398), (640, 450), (625, 470)])
    fig = fig & ~bar & ~ramp
    # her head from the auto cut (its hair edge is right; the ramp's edge touches it here), minus that edge
    stick = P.poly_mask((H, W), [(549, 391), (605, 418), (600, 436), (541, 426), (541, 400)])
    headfig = (rgba[..., 3] > 100) & ~stick
    return fig, {'head': headfig, 'ahoge': headfig}


# --- the "picked" drawing (video frame down_03)
SEL_OUTER = [(410, 175), (500, 170), (495, 215), (545, 250), (560, 300), (545, 340), (560, 360), (640, 365), (670, 400), (680, 470), (665, 525),
             (600, 530), (560, 520), (560, 560), (370, 565), (300, 540), (240, 535), (175, 530), (170, 470), (200, 440), (250, 430), (240, 400),
             (250, 330), (240, 260), (290, 220), (380, 205)]
SEL_POLY = {
    'armL': [(160, 430), (260, 420), (290, 440), (300, 425), (380, 425), (385, 520), (300, 545), (240, 545), (160, 540)],
    'armR': [(518, 360), (600, 350), (690, 380), (690, 540), (610, 540), (560, 520), (540, 470), (520, 440)],
    'ahoge': [(405, 165), (520, 165), (520, 212), (450, 212), (445, 228), (425, 228)],
    'head': [(220, 200), (580, 200), (580, 420), (520, 440), (470, 452), (372, 452), (300, 440), (220, 430)],
    'torso': [(280, 380), (600, 380), (600, 532), (280, 532)],
}
SEL_ORDER = ['armL', 'armR', 'ahoge', 'head', 'torso']


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
    return fig, None


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


def recolor_amp(a, body_stops, metal_stops):
    """the grey speaker -> a colour ramp by brightness; its bluish metal corners -> an accent ramp"""
    a = a.astype(float); rgb = a[..., :3]; L = lum(rgb)
    metal = ((rgb[..., 2] - rgb[..., 0]) > 22) & (L > 70)
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


JORDUS_AMP = dict(body_stops=[(0, (0, 0, 0)), (20, (10, 4, 20)), (40, (40, 20, 72)), (56, (58, 30, 104)), (68, (78, 44, 138)), (90, (110, 70, 170))],
                  metal_stops=[(60, (120, 20, 80)), (100, (232, 70, 150)), (140, (255, 130, 196)), (200, (255, 200, 230))])
CAP_AMP = dict(body_stops=[(0, (0, 0, 0)), (20, (6, 6, 14)), (40, (18, 20, 44)), (56, (26, 28, 62)), (68, (36, 40, 84)), (90, (56, 62, 118))],
               metal_stops=[(60, (110, 10, 24)), (100, (220, 40, 56)), (140, (255, 96, 96)), (200, (255, 170, 170))])
# BF's jeans -> her light-blue pants, his red sneaker -> a black one with light-blue laces
LEG = [((255, 45, 50), (46, 42, 76)), ((171, 22, 74), (24, 20, 46)), ((0, 102, 204), (186, 222, 246)), ((15, 27, 130), (104, 162, 230)),
       ((254, 235, 247), (214, 238, 252)), ((219, 147, 230), (150, 172, 218))]


def bf_leg():
    an = json.load(open(os.path.join(CS, 'bfChill', 'spritemap1.json')))
    sheet = Image.open(os.path.join(CS, 'bfChill', 'spritemap1.png')).convert('RGBA')
    d = next(s['SPRITE'] for s in an['ATLAS']['SPRITES'] if s['SPRITE']['name'] == '7')   # (his leg hanging over the speaker)
    c = sheet.crop((d['x'], d['y'], d['x'] + d['w'], d['y'] + d['h']))
    if d['rotated']: c = c.transpose(Image.ROTATE_90)
    return palette_map(np.asarray(c), LEG)


# ================================================================ the rig
def crop(a):
    ys, xs = np.nonzero(a[..., 3] > 0); x0, y0 = max(0, xs.min() - 1), max(0, ys.min() - 1)
    return a[y0:ys.max() + 2, x0:xs.max() + 2].copy(), int(x0), int(y0)


class Part:
    def __init__(s, name, img, x0, y0): s.name, s.img, s.x0, s.y0 = name, img, x0, y0


# each drawing in its own frame px: HEM = her skirt hem's middle (where she sits), bone pivots, where the legs hang
D = {
    'idle': dict(HEM=(432, 505), bones={'torso': (432, 505), 'head': (430, 398), 'ahoge': (500, 232), 'arm': (365, 445), 'armback': (512, 442)},
                 parts={'armback': 'armback', 'torso': 'torso', 'head': 'head', 'ahoge': 'ahoge', 'arm': 'arm'}, legs=(410, 462),
                 neck=[(340, 372), (482, 372), (484, 414), (468, 420), (380, 420), (340, 412)]),
    'sel': dict(HEM=(452, 524), bones={'torso': (452, 524), 'head': (438, 442), 'ahoge': (447, 214), 'arm': (372, 455), 'armback': (528, 440)},
                parts={'armback': 'armR', 'torso': 'torso', 'head': 'head', 'ahoge': 'ahoge', 'arm': 'armL'}, legs=(428, 478),
                neck=[(360, 418), (490, 418), (492, 462), (470, 470), (372, 470), (358, 460)]),
}
NECK_COL = (232, 168, 104, 255)
LK = 0.60                    # BF's leg art -> her drawing px


class Place:
    """where she + her amp go on an Animate stage: K = her drawing px -> stage px, seat = the stage point of her
    skirt hem, amp_k / amp_bottom = the amp (x, y scale; bottom middle), amp_front = the amp in front of her
    (the DJ booth), legs = show her legs"""
    def __init__(s, K, seat, amp_k, amp_bottom, amp_front=False, legs=True):
        s.K, s.seat, s.amp_k, s.amp_bottom, s.amp_front, s.legs = K, seat, amp_k, amp_bottom, amp_front, legs


class Rig:
    def __init__(s, idle_parts, sel_parts, amp, leg):
        s.sprites, s.parts = {}, {}
        for dn, pp in (('idle', idle_parts), ('sel', sel_parts)):
            for bone, pn in D[dn]['parts'].items():
                img, x0, y0 = crop(pp[pn])
                if bone == 'torso':
                    # a neck under the head (the torso's top), so lifting the head never opens a gap under her chin
                    pad = 60; big = np.zeros((img.shape[0] + pad, img.shape[1], 4), np.uint8); big[pad:] = img; img = big; y0 -= pad
                    S = 4; Hh, Ww = img.shape[:2]
                    nk = Image.new('RGBA', (Ww * S, Hh * S)); ImageDraw.Draw(nk).polygon([((x - x0) * S, (y - y0) * S) for x, y in D[dn]['neck']], fill=NECK_COL)
                    img = P.over(np.array(nk.resize((Ww, Hh), Image.LANCZOS)), img)
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
        els += [part('torso'), part('head'), part('ahoge')]
        if pl.amp_front: els.append(('S', 'amp', am))
        els.append(part('arm'))
        return els


# ================================================================ motion
def ease(t, k):
    return {'lin': t, 'in': t * t, 'out': 1 - (1 - t) ** 2, 'inout': t * t * (3 - 2 * t)}.get(k, t)


def track(keys, f):
    """keys = [(frame, value, ease into this key)]"""
    if f <= keys[0][0]: return keys[0][1]
    for (f0, v0, _), (f1, v1, e) in zip(keys, keys[1:]):
        if f <= f1: return v0 + (v1 - v0) * ease((f - f0) / max(1e-9, f1 - f0), e)
    return keys[-1][1]


def bop(f, side):
    """one beat of chilling (15 frames at 24 fps): a dip on the beat, spring up, settle. side = which leg kicks"""
    sq = track([(0, 0.955, 'lin'), (1, 0.972, 'out'), (3, 1.018, 'out'), (5, 1.006, 'inout'), (9, 1.0, 'inout')], f)
    head_dy = track([(0, 9, 'lin'), (1, 6, 'out'), (3, -2, 'out'), (5, -1, 'inout'), (8, 0, 'inout')], f)
    head_rot = side * track([(0, -1.0, 'lin'), (2, 2.6, 'out'), (6, 1.6, 'inout'), (14, 1.0, 'inout')], f)
    ah = track([(0, -14, 'lin'), (1, -6, 'out'), (3, 14, 'out'), (5, -7, 'inout'), (7, 4, 'inout'), (9, -2, 'inout'), (11, 0, 'inout')], f)
    arm_rot = track([(0, 6, 'lin'), (2, -4, 'out'), (5, -1, 'inout'), (9, 0, 'inout')], f)
    arm_dy = track([(0, 6, 'lin'), (2, -3, 'out'), (6, 0, 'inout')], f)
    back_rot = track([(0, -2.5, 'lin'), (3, 1.2, 'out'), (8, 0, 'inout')], f)
    kick = track([(0, 0.0, 'lin'), (2, 1.0, 'out'), (6, 0.55, 'inout'), (12, 0.0, 'inout')], f)
    other = track([(0, 0.25, 'lin'), (3, 0.0, 'out')], f)
    kl, kr = (kick, other) if side > 0 else (other, kick)
    return {'torso': {'sy': sq, 'sx': 2 - sq}, 'head': {'dy': head_dy, 'rot': head_rot}, 'ahoge': {'rot': ah},
            'arm': {'rot': arm_rot, 'dy': arm_dy}, 'armback': {'rot': back_rot},
            'legL': {'rot': 10 * kl, 'sy': 1 - 0.22 * kl, 'dy': -5 * kl}, 'legR': {'rot': -10 * kr, 'sy': 1 - 0.22 * kr, 'dy': -5 * kr}}


SEL_HEAD = {'sx': 0.92, 'sy': 0.92}      # (the shades drawing's head was nearer the camera: same size as the other)


def dip(rig, pl, k, amp=True):
    """the frames before she pops into the shades pose: squash down, head ducks, ahoge flicks back"""
    p = bop(0, 1); p['torso'] = {'sy': 1 - 0.07 * k, 'sx': 1 + 0.05 * k}; p['head'] = {'dy': 10 * k, 'rot': -3 * k}
    p['ahoge'] = {'rot': -16 * k}; p['arm'] = {'rot': 8 * k, 'dy': 6 * k}
    return rig.pose('idle', p, body=(0, 2 * k, 1, 1, 0), amp_pose=(0, 0, 1 + 0.02 * k, 1 - 0.03 * k) if amp else (0, 0, 1, 1), pl=pl)


def pop(rig, pl, g, lift0=-26):
    """g frames after the pop: hop up in the shades pose, land with a squash, settle"""
    lift = track([(0, lift0, 'lin'), (1, lift0 * 0.77, 'out'), (2, lift0 * 0.35, 'in'), (3, 0, 'in'), (5, 0, 'lin')], g)
    sy = track([(0, 1.10, 'lin'), (1, 1.06, 'out'), (3, 0.93, 'in'), (4, 0.97, 'out'), (6, 1.01, 'inout'), (9, 1.0, 'inout')], g)
    hd = track([(0, -8, 'lin'), (2, -4, 'out'), (3, 6, 'in'), (5, -2, 'out'), (8, 0, 'inout')], g)
    ah = track([(0, 18, 'lin'), (2, -10, 'out'), (3, 16, 'in'), (5, -8, 'out'), (7, 4, 'inout'), (10, 0, 'inout')], g)
    arm = track([(0, -10, 'lin'), (2, -4, 'out'), (3, 4, 'in'), (5, -2, 'out'), (8, 0, 'inout')], g)
    legk = track([(0, 1.0, 'lin'), (3, 0.2, 'in'), (5, 0.6, 'out'), (8, 0.0, 'inout')], g)
    asq = track([(0, 1.0, 'lin'), (3, 1.0, 'lin'), (4, 0.95, 'out'), (6, 1.0, 'inout')], g)
    p = {'torso': {'sy': sy, 'sx': 2 - sy}, 'head': dict(SEL_HEAD, dy=hd, rot=2), 'ahoge': {'rot': ah}, 'arm': {'rot': arm}, 'armback': {'rot': -arm},
         'legL': {'rot': 14 * legk, 'sy': 1 - 0.25 * legk, 'dy': -6 * legk}, 'legR': {'rot': -14 * legk, 'sy': 1 - 0.25 * legk, 'dy': -6 * legk}}
    return rig.pose('sel', p, body=(0, lift, 1, 1, 0), amp_pose=(0, 0, 2 - asq, asq), pl=pl)


def slump(k, sway=0.0, deep=1.0):
    """sad: she sinks, head hangs, mic droops, the ahoge flops over"""
    p = bop(14, 1)
    p['torso'] = {'sy': 1 - 0.10 * k * deep, 'sx': 1 + 0.05 * k * deep, 'rot': -3 * sway}
    p['head'] = {'dy': 34 * k * deep, 'rot': -15 * k * deep + 2.5 * sway}
    p['ahoge'] = {'rot': -75 * k + 5 * sway}
    p['arm'] = {'rot': 34 * k * deep, 'dy': 40 * k * deep}; p['armback'] = {'rot': 14 * k * deep}
    p['legL'] = {'rot': -4 * k}; p['legR'] = {'rot': 4 * k}
    return p


class Timeline:
    def __init__(s): s.frames, s.labels, s.symbols = [], [], {}
    def add(s, label, frames): s.labels.append((label, len(s.frames), len(frames))); s.frames.extend(frames)


# ---------------------------------------------------------------- character select (like bfChill)
def chill(rig):
    amp_k = (0.70, 0.54); amp_bottom = (990, 632)
    pl = Place(0.80, (amp_bottom[0] - 10, amp_bottom[1] - rig.amp.shape[0] * amp_k[1] + 16), amp_k, amp_bottom)
    T = Timeline()
    # idle: two beats (bops on each), the kicking leg swaps each beat
    T.add('idle', [rig.pose('idle', bop(f, 1), pl=pl) for f in range(16)] + [rig.pose('idle', bop(f, -1), pl=pl) for f in range(14)])
    # select: dip, then POP into her shades pose with a hop off the amp, land, hold (the screen holds the last frame)
    T.add('select', [dip(rig, pl, (f + 1) / 2) for f in range(2)] + [pop(rig, pl, g) for g in range(11)])
    # deselect: shades off, a little slump back into chilling; then a slow sway while the screen waits
    des = []
    for f in range(6):
        k = track([(0, 1, 'lin'), (5, 0, 'out')], f)
        p = bop(9, 1); p['torso'] = {'sy': 1 - 0.06 * k, 'sx': 1 + 0.04 * k}; p['head'] = {'dy': 8 * k, 'rot': -5 * k}; p['ahoge'] = {'rot': 12 * k}
        des.append(rig.pose('idle', p, pl=pl))
    T.add('deselect', des)
    loop = []
    for f in range(16):
        t = f / 16 * 2 * math.pi; p = bop(12, 1)
        p['head'] = {'rot': -2.0 * math.sin(t), 'dy': 1.5 * (1 - math.cos(t))}; p['ahoge'] = {'rot': 4 * math.sin(t - 0.8)}
        loop.append(rig.pose('idle', p, pl=pl))
    T.add('deselect loop start', loop)
    # slide in from the right (bfChill's own offsets), smeared on the fast frames; out: a step, then gone
    T.symbols['figure'] = rig.pose('idle', bop(9, 1), pl=pl)
    cx = amp_bottom[0]
    def slid(dx, st, alpha=1): return ('I', 'figure', P.mmul(P.T(cx + dx, 0), P.mmul(P.M(st, 0, 0, 1), P.T(-cx, 0))), alpha)
    sl = []
    for dx, st in [(321, 1.75), (167, 1.4), (-24, 1), (-24, 1), (-3, 1), (-3, 1), (-5, 1), (-5, 1)]:
        sl.append([slid(dx + 80, st, 0.22), slid(dx + 40, st, 0.22), slid(dx, st, 0.85)] if st > 1.01 else [slid(dx, st)])
    T.add('slidein', sl)
    T.add('slidein idle point', [rig.pose('idle', bop(f + 5, 1), pl=pl) for f in range(10)])
    T.add('slideout', [[slid(-23, 1)], [slid(-151, 1.7, 0.22), slid(-111, 1.7, 0.22), slid(-71, 1.7, 0.85)]])
    return T


# ---------------------------------------------------------------- freeplay DJ (like freeplay-boyfriend): behind her amp
def dj(rig):
    pl = Place(0.75, (222, 560), (0.92, 0.72), (215, 736), amp_front=True, legs=False)
    E = lambda dn, p, body=(0, 0, 1, 1, 0), amp=(0, 0, 1, 1): rig.pose(dn, p, body, amp, pl=pl)
    T = Timeline()
    intro = []
    for f in range(17):       # the amp slides up, she pops up from behind it
        amp_dy = track([(0, 220, 'lin'), (4, -10, 'out'), (6, 0, 'inout')], f)
        up = track([(0, 420, 'lin'), (3, 420, 'lin'), (8, -34, 'out'), (11, 6, 'inout'), (14, 0, 'inout')], f)
        sy = track([(0, 1, 'lin'), (3, 1, 'lin'), (7, 1.08, 'out'), (10, 0.95, 'inout'), (13, 1.0, 'inout')], f)
        p = bop(9, 1); p['torso'] = {'sy': sy, 'sx': 2 - sy}
        p['ahoge'] = {'rot': track([(0, 0, 'lin'), (7, -20, 'out'), (10, 16, 'inout'), (13, -6, 'inout'), (16, 0, 'inout')], f)}
        intro.append(E('idle', p, body=(0, up, 1, 1, 0), amp=(0, amp_dy, 1, 1)))
    T.add('Intro', intro)
    T.add('Idle', [E('idle', bop(f, 1 if f < 7 else -1)) for f in range(14)])
    con = [dip(rig, pl, (f + 1) / 2, amp=False) for f in range(2)]
    for g in range(26):
        f = pop(rig, pl, g, lift0=-30)
        if g > 8:     # (then a little head bounce while the song loads)
            p = {'torso': {'sy': 1, 'sx': 1}, 'head': dict(SEL_HEAD, dy=2.5 * math.sin((g - 8) * math.pi / 7), rot=2), 'ahoge': {'rot': 3 * math.sin((g - 8) * math.pi / 7)}}
            f = E('sel', p)
        con.append(f)
    T.add('Confirm', con)
    def cheer(g, n):
        h = abs(math.sin(g * math.pi / 9)) * (1 if g < n - 11 else max(0, 1 - (g - (n - 11)) / 9))
        sy = 1 + 0.06 * h - 0.05 * max(0, math.cos(g * math.pi / 9)) * (1 if g < n - 11 else 0)
        p = {'torso': {'sy': sy, 'sx': 2 - sy}, 'head': dict(SEL_HEAD, rot=3 * math.sin(g * math.pi / 9)), 'ahoge': {'rot': 14 * math.sin(g * math.pi / 9 + 1.2)},
             'arm': {'rot': -12 * h}, 'armback': {'rot': 10 * h}}
        return E('sel', p, body=(0, -30 * h, 1, 1, 0))
    # Fist Pump: frames 0-4 repeat while the new rank shows, then she pops up cheering
    T.add('Fist Pump', [E('idle', bop(f * 2, 1)) for f in range(4)] + [cheer(g, 38) for g in range(38)])
    lo = [E('idle', bop(f * 2, 1)) for f in range(4)]
    for g in range(56):
        k = track([(0, 0, 'lin'), (6, 1, 'out')], g); sway = math.sin(g * 2 * math.pi / 28) * k
        lo.append(E('idle', slump(k, sway, 0.6), body=(0, 26 * k, 1, 1, 0)))
    T.add('Fist Pump Loss', lo)
    afk = []
    for g in range(96):       # she leans on the amp and dozes off, jerks awake, looks around
        doze = track([(0, 0, 'lin'), (30, 1, 'inout'), (62, 1, 'lin'), (64, -0.25, 'out'), (70, 0.1, 'inout'), (78, 0, 'inout')], g)
        look = track([(0, 0, 'lin'), (66, 0, 'lin'), (72, 6, 'out'), (82, -6, 'inout'), (92, 0, 'inout')], g)
        br = math.sin(g * 2 * math.pi / 20) * max(0, doze)
        p = bop(14, 1)
        p['torso'] = {'sy': 1 - 0.04 * doze + 0.01 * br, 'sx': 1 + 0.03 * doze}
        p['head'] = {'dy': 18 * doze, 'rot': -12 * doze + look}
        p['ahoge'] = {'rot': -40 * max(0, doze) + 3 * br + (18 if 63 <= g <= 65 else 0)}
        p['arm'] = {'rot': 10 * doze, 'dy': 10 * doze}
        afk.append(E('idle', p, body=(0, 14 * max(0, doze), 1, 1, 0)))
    T.add('AFK', afk)
    cs = []
    for g in range(18):       # a quick hop, then she ducks behind the amp
        up = track([(0, 0, 'lin'), (2, 12, 'out'), (5, -40, 'out'), (9, 60, 'in'), (13, 460, 'in'), (17, 460, 'lin')], g)
        sy = track([(0, 1, 'lin'), (2, 0.92, 'out'), (5, 1.1, 'out'), (9, 1.0, 'inout')], g)
        p = bop(9, 1); p['torso'] = {'sy': sy, 'sx': 2 - sy}; p['ahoge'] = {'rot': track([(0, 0, 'lin'), (5, -25, 'out'), (9, 20, 'inout')], g)}
        cs.append(E('idle', p, body=(0, up, 1, 1, 0)))
    T.add('To Character Select', cs)
    return T


# ---------------------------------------------------------------- results (like results-bf): one per rank, intro + 'loop'
def results(rig):
    amp_k = (0.98, 0.76); amp_bottom = (1045, 770)
    pl = Place(1.12, (1032, amp_bottom[1] - rig.amp.shape[0] * amp_k[1] + 22), amp_k, amp_bottom)
    def bounce(n, hop, period):
        out = []
        for g in range(n):
            h = abs(math.sin(g * math.pi / period)); sy = 1 + 0.05 * h - 0.05 * max(0, math.cos(g * math.pi / period))
            p = {'torso': {'sy': sy, 'sx': 2 - sy}, 'head': dict(SEL_HEAD, rot=3 * math.sin(g * math.pi / period)),
                 'ahoge': {'rot': 14 * math.sin(g * math.pi / period + 1.2)}, 'arm': {'rot': -10 * h}, 'armback': {'rot': 8 * h},
                 'legL': {'rot': 14 * h, 'sy': 1 - 0.2 * h}, 'legR': {'rot': -14 * h, 'sy': 1 - 0.2 * h}}
            out.append(rig.pose('sel', p, body=(0, -hop * h, 1, 1, 0), pl=pl))
        return out
    def bops(n, big=1.0):
        out = []
        for g in range(n):
            p = bop(g % 14, 1 if (g // 14) % 2 == 0 else -1)
            if big > 1: p['head'] = dict(p['head'], dy=p['head']['dy'] * big); p['arm'] = {'rot': p['arm']['rot'] * 1.6 - 6, 'dy': p['arm']['dy']}
            out.append(rig.pose('idle', p, pl=pl))
        return out
    popin = lambda: [dip(rig, pl, (f + 1) / 2) for f in range(2)] + [pop(rig, pl, g, lift0=-44) for g in range(12)]
    def sad():
        out = []
        for g in range(50):
            k = track([(0, 0, 'lin'), (10, 1, 'out')], g); sway = math.sin(max(0, g - 10) * 2 * math.pi / 40) * k
            out.append(rig.pose('idle', slump(k, sway), pl=pl))
        return out[:10], out[10:]
    ranks = {'perfect': (popin(), bounce(24, 30, 12)), 'excellent': (popin(), bounce(28, 14, 14)),
             'great': (bops(4), bops(28, 1.6)), 'good': (bops(4), bops(28)), 'loss': sad()}
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
        # thin strays (the skate ramp's edges) go, everything thick stays
        op = cv2.morphologyEx(al.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)) > 0
        a[..., 3] = np.where(cv2.dilate(op.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0, a[..., 3], 0)
        n, cc, st, _ = cv2.connectedComponentsWithStats((a[..., 3] > 40).astype(np.uint8), 8)
        a[..., 3] = np.where(cc == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), a[..., 3], 0)
        return a
    base = frame(0)
    CK, STORE = 0.56, 0.62
    SEAT_SRC, SEAT = (600, 447), (280, 440)
    sprites, ph = {}, []
    for i in range(12):
        a = frame(i)
        (dx, dy), _ = cv2.phaseCorrelate(base[..., 3].astype(np.float32), a[..., 3].astype(np.float32))   # (her bounce)
        # the ramp's ledge hid the lower right of her rear: filled back in (her pants are flat black)
        H, W = a.shape[:2]
        m = P.poly_mask((H, W), [(744 + dx, 368 + dy), (752 + dx, 392 + dy), (752 + dx, 420 + dy), (744 + dx, 452 + dy), (628 + dx, 452 + dy), (640 + dx, 436 + dy), (700 + dx, 412 + dy)])
        a[m & (a[..., 3] < 200)] = (8, 8, 14, 255)
        c, x0, y0 = crop(a); h, w = c.shape[:2]
        sprites['cap%02d' % i] = np.array(Image.fromarray(c).resize((max(1, round(w * STORE)), max(1, round(h * STORE))), Image.LANCZOS))
        ph.append((x0, y0))
    amp = recolor_amp(symbol_image(os.path.join(CS, 'gfChill'), 'larger speaker'), **CAP_AMP); sprites['amp'] = amp
    amp_k, amp_bottom = (0.70, 0.67), (358, 614)
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
        sy = track([(0, 0.93, 'lin'), (2, 1.08, 'out'), (6, 1.02, 'inout'), (8, 0.92, 'in'), (10, 1.03, 'out'), (13, 1.0, 'inout')], f)
        asy = track([(0, 0.97, 'lin'), (2, 1.0, 'out'), (8, 1.0, 'lin'), (9, 0.95, 'out'), (12, 1.0, 'inout')], f)
        con.append([ampel(2 - asy, asy), her(seq[min(f, 14)] if f >= 10 else 0, dy=lift, sx=2 - sy, sy=sy)])
    T.add('confirm', con)
    des = []
    for f in range(20):
        k = track([(0, 1, 'lin'), (4, 0.4, 'out'), (12, 0, 'inout')], f)
        des.append([ampel(), her(seq[min(f, 14)], dy=6 * k, sx=1 + 0.04 * k, sy=1 - 0.06 * k)])
    T.add('deselect', des)
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
    idle = cut_parts('idle_20', IDLE_OUTER, IDLE_POLY, IDLE_ORDER, idle_fix, cent)
    sel = cut_parts('down_03', SEL_OUTER, SEL_POLY, SEL_ORDER, sel_fix, cent)
    amp = recolor_amp(symbol_image(os.path.join(CS, 'gfChill'), 'larger speaker'), **JORDUS_AMP)
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
