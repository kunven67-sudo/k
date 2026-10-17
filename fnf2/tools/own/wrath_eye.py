"""WRATH, stage 2: the GIANT EYE (pieces for src/31-wrath-eye.js).

Built from real FNF art (FunkinCrew/funkin.assets, read at build time, never committed)
plus hand-inked drawing in FNF's style:

  * ARMS: the Monster's (week 2) real arms, cut off his body for every pose
    (idle, left, down, up, right + their 2-frame "boil" holds). They grow out of
    WRATH's black goo. A purple rim light is painted on so they match the goo.
  * MIC: BF's real mic, repainted dark like WRATH's stage-1 mic.
  * EYE: drawn here, hand-inked (wobbly lines that go thick and thin, choppy cel
    shading), 5 looks from the user's eye pictures: void, spiral, redring, blue, veins.

  python3 fnf2/tools/own/wrath_eye.py [--preview DIR]

Writes PNGs + meta.json to fnf2/build/own/shared/images/characters/wrath-eye/.
"""
import argparse, json, math, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FNF = os.environ.get('FNF_ASSETS', '/home/user/funkincrew/funkin.assets')
CHARS = os.path.join(FNF, 'shared/images/characters')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'characters', 'wrath-eye')
SS = 1.35            # art is made at this scale (matches the eye buffer in the game)


def load_sprites(name):
    d = os.path.join(CHARS, name)
    sm = json.load(open(os.path.join(d, 'spritemap1.json'), encoding='utf-8-sig'))
    sheet = np.array(Image.open(os.path.join(d, 'spritemap1.png')).convert('RGBA'))
    out = {}
    for s in sm['ATLAS']['SPRITES']:
        S = s['SPRITE']
        a = sheet[S['y']:S['y'] + S['h'], S['x']:S['x'] + S['w']]
        out[S['name']] = np.rot90(a, 1).copy() if S.get('rotated') else a.copy()
    return out


# ---------------------------------------------------------------- arms (from the Monster)
# Monster body bitmaps per pose: [hit frame, boil hold frames...]
POSES = {
    'idle': ['57', '58', '59'],
    'idleBop': ['30', '31', '32', '33'],
    'L': ['12', '39', '40'],
    'R': ['17', '42', '43'],
    'U': ['23', '45', '46'],
    'D': ['29', '48', '49'],
}
RIM = np.array([92, 72, 168], float)        # purple rim light (the goo's shine)
LITE = np.array([150, 132, 226], float)


def cut_arms(a):
    """Body bitmap -> list of arm pieces. The torso is found by an opening (arms are
    thin, the torso is thick); everything thin above the hips is an arm."""
    al = a[..., 3] > 40
    H, W = al.shape
    pink = (a[..., 0] > 150) & (a[..., 2] > 90) & (a[..., 1] < 120) & al
    ys, xs = np.nonzero(pink)
    neck = (float(xs.mean()), float(ys.max()))           # bottom of the pink neck stump
    yy, xx = np.mgrid[0:H, 0:W]
    disk = (yy - 0) ** 0  # placeholder to keep numpy happy
    r = 34
    se = (np.add.outer((np.arange(-r, r + 1)) ** 2, (np.arange(-r, r + 1)) ** 2) <= r * r)
    torso = ndimage.binary_opening(al, structure=se)
    # keep only the torso piece that holds the neck (legs/feet can survive the opening too)
    lab, n = ndimage.label(torso)
    best, bd = 0, 1e9
    for i in range(1, n + 1):
        ty, tx = np.nonzero(lab == i)
        dd = np.min(np.hypot(tx - neck[0], ty - neck[1]))
        if dd < bd: best, bd = i, dd
    torso = lab == best
    hips = neck[1] + (H - neck[1]) * 0.42
    thin = al & ~ndimage.binary_dilation(torso, iterations=3) & ~pink
    thin &= ~ndimage.binary_dilation(pink, iterations=6)
    lab, n = ndimage.label(thin)
    arms = []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 1500: continue
        ty, tx = np.nonzero(m)
        if ty.mean() > hips: continue                        # legs
        # root = the arm pixels touching the torso; hand = farthest point from the root
        touch = m & ndimage.binary_dilation(torso, iterations=6)
        if touch.sum() == 0: continue
        ry, rx = np.nonzero(touch); root = (float(rx.mean()), float(ry.mean()))
        dd = np.hypot(tx - root[0], ty - root[1]); k = int(np.argmax(dd))
        hand = (float(tx[k]), float(ty[k]))
        y0, y1, x0, x1 = ty.min(), ty.max() + 1, tx.min(), tx.max() + 1
        piece = a[y0:y1, x0:x1].copy()
        mm = ndimage.binary_dilation(m, iterations=2)[y0:y1, x0:x1]
        piece[..., 3] = np.where(mm, piece[..., 3], 0)
        # the cut end gets a soft fade so it melts into the goo
        piece = rim_light(piece)
        arms.append({'img': piece, 'x': int(x0), 'y': int(y0), 'root': root, 'hand': hand,
                     'side': 'R' if root[0] > neck[0] else 'L'})
    arms.sort(key=lambda d: d['side'])
    return neck, arms


def rim_light(p):
    """Paint a choppy purple rim on the lit (upper-left) edge of a black shape, like FNF shading."""
    al = p[..., 3] > 100
    inner = ndimage.binary_erosion(al, iterations=7)
    dark = al & (p[..., :3].max(2) < 90)
    shift = np.zeros_like(al)
    sx, sy = 9, 11                                            # light from the upper left
    shift[sy:, sx:] = al[:-sy, :-sx]
    band = al & ~shift & inner & dark                         # where the shape's upper-left edge is
    band = ndimage.binary_opening(band, iterations=1)
    out = p.astype(float)
    out[band, :3] = out[band, :3] * 0.25 + RIM * 0.75
    core = band & ~ndimage.binary_dilation(~band, iterations=3)
    out[core, :3] = out[core, :3] * 0.3 + LITE * 0.7
    return out.clip(0, 255).astype(np.uint8)


# ---------------------------------------------------------------- the mic (BF's real one)
def mic_piece(bf):
    """BF's real mic head (the grille ball, from his fist+mic piece) on a hand-inked dark handle.
    Head up, handle down; the grip point is written to meta."""
    a = bf['22']
    rgb = a[..., :3].astype(int); al = a[..., 3] > 30
    navy = al & (rgb[..., 2] > rgb[..., 0] + 12) & (rgb.max(2) < 170)
    lab, n = ndimage.label(ndimage.binary_closing(navy, iterations=3))
    big = lab == (1 + int(np.argmax(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)))))
    ys, xs = np.nonzero(big)
    cx, cy = xs.mean(), ys.mean(); R = float(np.percentile(np.hypot(xs - cx, ys - cy), 97)) + 7
    H, W = al.shape; yy, xx = np.mgrid[0:H, 0:W]
    disk = np.hypot(xx - cx, yy - cy) <= R
    peach = (rgb[..., 0] > rgb[..., 2] + 25) & (rgb.max(2) > 120)       # BF's fist
    head = a.copy(); head[..., 3] = np.where(disk & al & ~ndimage.binary_dilation(peach, iterations=2), head[..., 3], 0)
    # repaint: navy -> WRATH's dark purple-grey
    f = head[..., :3].astype(float); v = f.max(2, keepdims=True) / 255.0
    f = np.where(v > 0.22, np.array([104, 94, 122], float) * (v / 0.5), f)
    head[..., :3] = f.clip(0, 255).astype(np.uint8)
    x0, y0 = int(cx - R), int(cy - R); head = head[max(0, y0):int(cy + R) + 1, max(0, x0):int(cx + R) + 1]
    hr = head.shape[0] / 2
    # handle below the head (in head-radius units), hand-inked
    Wt, Ht = int(hr * 2 + 8), int(hr * 2 + hr * 2.6)
    c = Ink(Wt, Ht, 1.0, -Wt / 2, -hr - 4, sup=3)
    hw = hr * 0.42
    body = wob([(-hw, 0), (hw, 0), (hw * 0.82, hr * 2.4), (-hw * 0.82, hr * 2.4)], 1.0, 3, 20)
    c.fill(body, '#2a2631')
    c.stroke([(-hw * 0.25, hr * 0.5), (-hw * 0.2, hr * 2.0)], 3, 5, col='#5a5466')
    c.stroke(body, 3.5, 6, closed=True)
    collar = wob([(-hw * 1.25, hr * 0.55), (hw * 1.25, hr * 0.55), (hw * 1.2, hr * 0.95), (-hw * 1.2, hr * 0.95)], 0.8, 5, 20)
    c.fill(collar, '#59536a'); c.stroke(collar, 3, 5, closed=True)
    out = c.image()
    hd = Image.fromarray(head)
    out.alpha_composite(hd, (int(Wt / 2 - hd.width / 2), 0))
    return np.array(out), {'grip': [Wt / 2, hr * 2 + hr * 1.5], 'head': [Wt / 2, hr]}


def goo_texture(mon):
    """A tile of the Monster's scribbly black body to fill WRATH's goo."""
    a = mon['57']
    t = a[200:330, 190:320].copy()
    t[..., 3] = 255
    return np.concatenate([np.concatenate([t, t[:, ::-1]], 1), np.concatenate([t[::-1], t[::-1, ::-1]], 1)], 0)   # mirrored = seamless


# ---------------------------------------------------------------- hand-inked eye
AW, AT, AB = 236, 120, 104
BOX = (-360, -300, 720, 590)                  # x, y, w, h in eye space
LOOKS = {
    'void': dict(body='#201e29', shade='#0d0c12', lite='#4d495c', sclera='#18171e', scShade='#0b0a0f', gloss=(196, 192, 212), rim='#a29db6', iris='ring', disc='#c5c1cd', discShade='#8c8897', ring='#ff2b2b', R=74),
    'spiral': dict(body='#f4f3f8', shade='#b8b6c8', lite='#ffffff', sclera='#f7f6fb', scShade='#c6c4d6', gloss=(255, 255, 255), iris='spiral', R=76),
    'redring': dict(body='#4a4851', shade='#2c2b32', lite='#706d7a', sclera='#413f47', scShade='#2a2930', gloss=(212, 208, 224), iris='ring', disc='#d8d4dc', discShade='#a09ba9', ring='#ff2020', R=82),
    'blue': dict(body='#4b48e8', shade='#2d29b0', lite='#8683ff', sclera='#4d49e6', scShade='#3430b8', gloss=(206, 210, 255), iris='rings', R=98),
    'veins': dict(body='#d8161f', shade='#880a12', lite='#ff6a6a', sclera='#fcf5f5', scShade='#f0aab0', gloss=(255, 255, 255), iris='pupil', R=86, beads=True, veins=True),
}


def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Noise:
    """Smooth 1D noise for wobbling hand-drawn lines."""
    def __init__(self, seed):
        r = np.random.RandomState(seed)
        self.v = r.uniform(-1, 1, 512)
    def __call__(self, t):
        t = t % 512; i = int(t); f = t - i; f = f * f * (3 - 2 * f)
        return self.v[i] * (1 - f) + self.v[(i + 1) % 512] * f


class Ink:
    """A supersampled canvas in eye space: fill polygons, then ink them with lines
    that wobble and go thick/thin like a brush."""
    def __init__(self, w, h, scale, ox, oy, sup=3):
        self.k = scale * sup; self.sup = sup
        self.ox, self.oy = ox, oy
        self.W, self.H = int(w * scale * sup), int(h * scale * sup)
        self.rgba = np.zeros((self.H, self.W, 4), np.float32)
        self.seed = 1

    def P(self, pts): return [((x - self.ox) * self.k, (y - self.oy) * self.k) for x, y in pts]

    def mask(self, pts):
        im = Image.new('L', (self.W, self.H), 0)
        ImageDraw.Draw(im).polygon(self.P(pts), fill=255)
        return np.array(im, np.float32) / 255.0

    def paint(self, m, col, alpha=1.0):
        c = np.array(hexrgb(col) if isinstance(col, str) else col, np.float32)
        a = (m * alpha)[..., None]
        self.rgba[..., :3] = self.rgba[..., :3] * (1 - a) + c * a
        self.rgba[..., 3:] = self.rgba[..., 3:] * (1 - a) + 255 * a

    def fill(self, pts, col, clip=None, alpha=1.0):
        m = self.mask(pts)
        if clip is not None: m = m * clip
        self.paint(m, col, alpha); return m

    def stroke(self, pts, w0, w1=None, closed=False, col='#050407', clip=None, wob=1.6, taper=True):
        """Brush line: width wanders between w0 and w1 (eye px), ends taper."""
        w1 = w0 if w1 is None else w1
        nz = Noise(self.seed); self.seed += 7
        if closed: pts = list(pts) + [pts[0]]
        L = [0.0]
        for i in range(1, len(pts)): L.append(L[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
        tot = L[-1] or 1
        im = Image.new('L', (self.W, self.H), 0); d = ImageDraw.Draw(im)
        prev = None
        for i, (x, y) in enumerate(pts):
            s = L[i] / tot
            w = w0 + (w1 - w0) * (0.5 + 0.5 * nz(L[i] / 40.0))
            if taper and not closed: w *= min(1, 0.35 + 3.0 * min(s, 1 - s))
            # small sideways wobble
            if 0 < i < len(pts) - 1:
                dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]; dl = math.hypot(dx, dy) or 1
                o = nz(L[i] / 25.0 + 100) * wob
                x, y = x - dy / dl * o, y + dx / dl * o
            X, Y = (x - self.ox) * self.k, (y - self.oy) * self.k; R = w * self.k / 2
            d.ellipse([X - R, Y - R, X + R, Y + R], fill=255)
            if prev is not None:
                px, py, pr = prev
                # quad between circles
                dx, dy = X - px, Y - py; dl = math.hypot(dx, dy) or 1; nx, ny = -dy / dl, dx / dl
                d.polygon([(px + nx * pr, py + ny * pr), (X + nx * R, Y + ny * R), (X - nx * R, Y - ny * R), (px - nx * pr, py - ny * pr)], fill=255)
            prev = (X, Y, R)
        m = np.array(im, np.float32) / 255.0
        if clip is not None: m = m * clip
        self.paint(m, col)
        return m

    def image(self):
        a = self.rgba
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
        return im.resize((self.W // self.sup, self.H // self.sup), Image.LANCZOS)


def wob(pts, amp, seed, freq=60.0):
    """Hand-drawn shapes are never perfect: push the outline in/out a little."""
    nz = Noise(seed); out = []
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    L = 0
    for i, (x, y) in enumerate(pts):
        if i: L += math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
        dx, dy = x - cx, y - cy; dl = math.hypot(dx, dy) or 1
        o = nz(L / freq) * amp
        out.append((x + dx / dl * o, y + dy / dl * o))
    return out


def alm_y(u, top): return (-AT if top else AB) * max(0.0, 1 - u * u) ** 1.12


def almond(k=1.0, n=90):
    top = [(u * AW * k, alm_y(u, True) * k) for u in np.linspace(-1, 1, n)]
    bot = [(u * AW * k, alm_y(u, False) * k) for u in np.linspace(1, -1, n)][1:-1]
    return top + bot


def spikes():
    out = []
    rs = np.random.RandomState(5)
    def add(u, top):
        x, y = u * AW, alm_y(u, top); e = 0.002
        tx, ty = 2 * e * AW, alm_y(u + e, top) - alm_y(u - e, top); tl = math.hypot(tx, ty); tx /= tl; ty /= tl
        nx, ny = ty, -tx
        if (top and ny > 0) or (not top and ny < 0): nx, ny = -nx, -ny
        rl = math.hypot(x, y * 1.6) or 1
        dx, dy = nx * 0.45 + x / rl * 0.55, ny * 0.45 + y * 1.6 / rl * 0.55; dl = math.hypot(dx, dy); dx /= dl; dy /= dl
        ang = math.atan2(dy, dx) + rs.uniform(-0.09, 0.09); dx, dy = math.cos(ang), math.sin(ang)
        a = abs(u); gap = 16 + a * 6
        out.append(dict(u=u, top=top, bx=x + dx * gap, by=y + dy * gap, dx=dx, dy=dy,
                        len=((128 if top else 112) - 38 * a * a) * rs.uniform(0.88, 1.1), w=(66 - 14 * a) * rs.uniform(0.9, 1.08), bend=rs.uniform(-0.12, 0.12)))
    for u in (-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9): add(u, True)
    for u in (-0.76, -0.46, -0.155, 0.155, 0.46, 0.76): add(u, False)
    for s in (-1, 1): out.append(dict(u=s, top=True, bx=s * (AW + 20), by=-6, dx=s, dy=-0.12, len=92, w=52, bend=0.06 * s, corner=True))
    return out


def spike_pts(s, n=14):
    """A slightly curved cone: two curved sides to the tip, rounded base."""
    nx, ny = -s['dy'], s['dx']
    tip = (s['bx'] + s['dx'] * s['len'] + nx * s['bend'] * s['len'], s['by'] + s['dy'] * s['len'] + ny * s['bend'] * s['len'])
    b1 = (s['bx'] + nx * s['w'] / 2, s['by'] + ny * s['w'] / 2)
    b2 = (s['bx'] - nx * s['w'] / 2, s['by'] - ny * s['w'] / 2)
    side = lambda A, sgn: [(A[0] + (tip[0] - A[0]) * t + nx * sgn * math.sin(t * math.pi) * s['w'] * 0.08,
                            A[1] + (tip[1] - A[1]) * t + ny * sgn * math.sin(t * math.pi) * s['w'] * 0.08) for t in np.linspace(0, 1, n)]
    base = [(s['bx'] + nx * s['w'] / 2 * math.cos(t) - s['dx'] * s['w'] * 0.28 * math.sin(t),
             s['by'] + ny * s['w'] / 2 * math.cos(t) - s['dy'] * s['w'] * 0.28 * math.sin(t)) for t in np.linspace(math.pi, 0, 10)]
    # base goes b2 -> b1 bulging toward the eye
    return side(b1, 1) + side(b2, -1)[::-1] + base[1:-1], tip, b1, b2


LIGHT = (-0.55, -0.83)
INK = '#050407'


def draw_back(look):
    L = LOOKS[look]
    x, y, w, h = BOX
    c = Ink(w, h, SS, x, y)
    for i, s in enumerate(spikes()):
        if L.get('beads') and not s.get('corner') and s['u'] < -0.4:
            r = 20 + (1 - abs(s['u'])) * 16
            for (cx, cy, rr) in [(s['bx'] + s['dx'] * (r + 2), s['by'] + s['dy'] * (r + 2), r)] + ([(s['bx'] + s['dx'] * (2.6 * r + 8), s['by'] + s['dy'] * (2.6 * r + 8), r * 0.55)] if s['u'] < -0.7 else []):
                circ = wob([(cx + math.cos(t) * rr, cy + math.sin(t) * rr) for t in np.linspace(0, 2 * math.pi, 40, endpoint=False)], 1.2, i * 3 + 1)
                m = c.fill(circ, L['shade'])
                c.fill([(cx - rr * 0.16 + math.cos(t) * rr * 0.74, cy - rr * 0.2 + math.sin(t) * rr * 0.74) for t in np.linspace(0, 2 * math.pi, 30)], L['body'], clip=m)
                c.fill([(cx - rr * 0.4 + math.cos(t) * rr * 0.2, cy - rr * 0.42 + math.sin(t) * rr * 0.2) for t in np.linspace(0, 2 * math.pi, 16)], L['lite'], clip=m)
                c.stroke(circ, 6, 8.5, closed=True)
            continue
        pts, tip, b1, b2 = spike_pts(s)
        pts = wob(pts, 1.3, i * 11 + 3, 30)
        if L.get('rim'): c.stroke(pts, 15, 19, closed=True, col=L['rim'], wob=0.6)
        m = c.fill(pts, L['shade'])
        nx, ny = -s['dy'], s['dx']
        ls = 1 if nx * LIGHT[0] + ny * LIGHT[1] > 0 else -1
        A = b1 if ls > 0 else b2
        mid = (s['bx'] - s['dx'] * s['w'] * 0.12 - nx * ls * s['w'] * 0.1, s['by'] - s['dy'] * s['w'] * 0.12 - ny * ls * s['w'] * 0.1)
        # choppy shading: the lit half has a zig-zag edge, like FNF's cut-in shadows
        zig = []
        for t in np.linspace(0, 1, 6):
            px, py = tip[0] + (mid[0] - tip[0]) * t, tip[1] + (mid[1] - tip[1]) * t
            o = (5 if int(t * 5) % 2 else -3) * (t * 0.8 + 0.2)
            zig.append((px + nx * ls * o, py + ny * ls * o))
        c.fill([A, tip] + zig[1:] + [(A[0] - s['dx'] * s['w'] * 0.25, A[1] - s['dy'] * s['w'] * 0.25)], L['body'], clip=m)
        c.stroke([(A[0] - nx * ls * s['w'] * 0.18 + s['dx'] * s['len'] * 0.14, A[1] - ny * ls * s['w'] * 0.18 + s['dy'] * s['len'] * 0.14),
                  (tip[0] - s['dx'] * s['len'] * 0.34 + nx * ls * s['w'] * 0.04, tip[1] - s['dy'] * s['len'] * 0.34 + ny * ls * s['w'] * 0.04)], 3, 6, col=L['lite'], clip=m)
        c.stroke(pts, 6, 10, closed=True)
    # eyeball
    al = almond()
    if L.get('rim'): c.stroke(al, 18, 24, closed=True, col=L['rim'], wob=0.6)
    m = c.fill(al, L['sclera'])
    # bottom shade: choppy crescent
    sh = [(px - 6, py - 20 + (6 if i % 9 < 4 else 0) * (py > 0)) for i, (px, py) in enumerate(almond(0.97))]
    full = c.mask(al)
    inner = c.mask(sh)
    c.paint(full * (1 - inner) * (c.mask([(-AW * 2, -10), (AW * 2, -10), (AW * 2, AB * 2), (-AW * 2, AB * 2)])), L['scShade'])
    if L.get('veins'):
        rs = np.random.RandomState(77)
        c.stroke(al, 30, 46, closed=True, col=(240, 140, 148), clip=m)
        for i in range(17):
            u = rs.uniform(-0.95, 0.95); top = rs.rand() < 0.5
            px, py = u * AW, alm_y(u, top) * 0.98; a = math.atan2(-py, -px) + rs.uniform(-0.45, 0.45)
            pts = [(px, py)]
            for k in range(6):
                px += math.cos(a) * rs.uniform(12, 22); py += math.sin(a) * rs.uniform(12, 22); a += rs.uniform(-0.4, 0.4); pts.append((px, py))
                if rs.rand() < 0.35:
                    b = a + (0.9 if rs.rand() < 0.5 else -0.9)
                    c.stroke([(px, py), (px + math.cos(b) * 16, py + math.sin(b) * 16)], 2.2, 1.2, col='#c8121b', clip=m, wob=0.8)
            c.stroke(pts, 4.2, 1.4, col='#c8121b', clip=m, wob=0.8)
        c.stroke(al, 13, 18, closed=True, col=L['body'], clip=m)
    return c.image()


def draw_line(look):
    """The eyeball's own ink outline (drawn over the lids in the game)."""
    x, y, w, h = BOX
    c = Ink(w, h, SS, x, y)
    c.stroke(almond(), 7, 12.5, closed=True)
    return c.image()


def draw_gloss(look):
    L = LOOKS[look]
    x, y, w, h = BOX
    c = Ink(w, h, SS, x, y)
    c.seed = 40
    arc = [(u * AW * 0.9, alm_y(u, True) * 0.78) for u in np.linspace(-0.66, -0.26, 20)]
    c.stroke(arc, 4, 10, col=L['gloss'])
    c.fill([(-AW * 0.17 + math.cos(t) * 6, -AT * 0.72 + math.sin(t) * 6) for t in np.linspace(0, 2 * math.pi, 14)], L['gloss'])
    return c.image()


def draw_iris(look):
    L = LOOKS[look]; R = L['R']; P = R + 16
    c = Ink(P * 2, P * 2, SS, -P, -P)
    circ = lambda r, cx=0, cy=0, n=60: [(cx + math.cos(t) * r, cy + math.sin(t) * r) for t in np.linspace(0, 2 * math.pi, n, endpoint=False)]
    if L['iris'] == 'ring':
        m = c.fill(wob(circ(R), 1.0, 9), L['discShade'])
        c.fill(circ(R * 0.88, -R * 0.08, -R * 0.1), L['disc'], clip=m)
        ring = circ(R * 0.52, R * 0.12, R * 0.05, 80)
        for wgt, al in ((R * 0.42, 0.18), (R * 0.3, 0.3)):
            mm = c.stroke(ring, wgt, wgt, closed=True, col=L['ring'], clip=m, wob=0.3)
        c.rgba[..., 3] = c.rgba[..., 3]
        c.stroke(ring, R * 0.15, R * 0.17, closed=True, col=L['ring'], clip=m, wob=0.6)
        c.stroke(ring, R * 0.04, R * 0.06, closed=True, col=(255, 210, 210), clip=m, wob=0.6)
        c.stroke(wob(circ(R), 1.0, 9), 4, 6.5, closed=True)
        # soft glow is baked in the game (glow sprite); keep the ring crisp here
    elif L['iris'] == 'spiral':
        m = c.fill(wob(circ(R), 1.0, 4), '#0d0c11')
        sp = []
        for t in np.linspace(0, 1, 160):
            a = t * 2 * math.pi * 2.6; r = 6 + t * (R - 15); sp.append((math.cos(a) * r, math.sin(a) * r))
        c.stroke(sp, R * 0.13, R * 0.19, col='#f2f1f7', clip=m, taper=False, wob=0.8)
        c.fill(circ(R * 0.12), '#f2f1f7')
        c.stroke(wob(circ(R), 1.0, 4), 5, 7, closed=True)
    elif L['iris'] == 'rings':
        m = c.fill(wob(circ(R), 1.2, 6), '#26242c')
        c.fill(circ(R * 0.9, -R * 0.06, -R * 0.08), '#3d3b45', clip=m)
        c.stroke(circ(R * 0.68), R * 0.13, R * 0.17, closed=True, col='#4a46df', clip=m, wob=0.7)
        c.stroke(circ(R * 0.4), R * 0.11, R * 0.14, closed=True, col='#5b57f0', clip=m, wob=0.7)
        c.fill(circ(R * 0.2), '#1c1b21')
        c.fill(circ(R * 0.1, -R * 0.34, -R * 0.42, 16), (190, 195, 255))
        c.stroke(wob(circ(R), 1.2, 6), 4.5, 7, closed=True)
    else:
        c.fill(wob(circ(R), 1.4, 2), '#070609')
        c.stroke(wob(circ(R), 1.4, 2), 3, 5, closed=True, col='#5a0a10')
        def star(x, y, r):
            c.fill([(x + math.cos(i * math.pi / 4) * (r if i % 2 == 0 else r * 0.35), y + math.sin(i * math.pi / 4) * (r if i % 2 == 0 else r * 0.35)) for i in range(8)], '#ffffff')
        star(R * 0.02, -R * 0.62, 10); star(R * 0.3, R * 0.05, 7)
    return c.image()


# ---------------------------------------------------------------- write
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--preview', default=None)
    ap.add_argument('--skip-eye', action='store_true', help='keep the eye PNGs already made (slow)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    old = os.path.join(a.out, 'meta.json')
    meta = {'box': BOX, 'ss': SS, 'almond': [AW, AT, AB], 'looks': {}, 'poses': {}}
    for look, L in LOOKS.items():
        if a.skip_eye: break
        for part, fn in (('back', draw_back), ('iris', draw_iris), ('gloss', draw_gloss), ('line', draw_line)):
            if part == 'line' and look != 'void': continue
            fn(look).save(os.path.join(a.out, f'{part}-{look}.png'))
    for look, L in LOOKS.items():
        meta['looks'][look] = {k: L[k] for k in ('body', 'shade', 'lite', 'R') if k in L}
        print('eye', look)
    mon = load_sprites('monster')
    for pose, frames in POSES.items():
        meta['poses'][pose] = []
        for fr in frames:
            neck, arms = cut_arms(mon[fr])
            entry = {'neck': neck, 'arms': []}
            for i, arm in enumerate(arms):
                fn = f'arm-{fr}-{arm["side"]}{i}.png'
                Image.fromarray(arm['img']).save(os.path.join(a.out, fn))
                entry['arms'].append({'file': fn, 'x': arm['x'], 'y': arm['y'], 'root': arm['root'], 'hand': arm['hand'], 'side': arm['side']})
            meta['poses'][pose].append(entry)
            print('arms', pose, fr, [(x['side'], x['img'].shape[:2]) for x in arms])
    bf = load_sprites('bf')
    mic, mm = mic_piece(bf); Image.fromarray(mic).save(os.path.join(a.out, 'mic.png')); meta['mic'] = mm
    Image.fromarray(goo_texture(mon)).save(os.path.join(a.out, 'goo.png'))
    json.dump(meta, open(os.path.join(a.out, 'meta.json'), 'w'), indent=1)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
