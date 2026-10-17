"""WRATH, stage 2: the GIANT EYE, made from the user's own 5 eye pictures.

The pictures live in git-ignored fnf2/private/ (eye-spiral, eye-redring, eye-blue,
eye-void, eye-veins .png) and are never committed. Each one is turned into FNF-style art:

  * cut out of its background, upscaled smoothly
  * the 3D shading is flattened into 2 flat tones (FNF's base colour + one shadow)
  * a thick black ink outline goes around every spike and the eyeball
  * the iris/pupil is lifted off into its own piece (and the eyeball behind it
    filled in), so the game can make the eye look around

The white spiral picture is the only one with every spike in frame, so its shape is the
template for the spiral, red-ring, blue and black looks (each painted in its own colours
with its own iris from its own picture). The red veiny picture is used whole (its own
shape, beads and veins).

  python3 fnf2/tools/own/wrath_eye.py [--preview DIR]

Writes PNGs + meta.json to fnf2/build/own/shared/images/characters/wrath-eye/.
"""
import argparse, json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRIV = os.path.join(ROOT, 'private')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'characters', 'wrath-eye')
ALMOND_WORLD = 470          # eyeball width in the game (world px); BF is ~420 tall
INK = (6, 5, 8)
OUTLINE = 9                 # ink width in output px


def load(name):
    return np.array(Image.open(os.path.join(PRIV, 'eye-' + name + '.png')).convert('RGB')).astype(np.float32)


def up(a, U):
    return cv2.resize(a, (int(a.shape[1] * U), int(a.shape[0] * U)), interpolation=cv2.INTER_CUBIC)


def smooth_mask(m, sigma):
    """Blocky/jaggy mask -> clean curved edge."""
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), sigma) > 0.5


def biggest(m):
    lab, n = ndimage.label(m)
    if n == 0: return m
    s = ndimage.sum(m, lab, range(1, n + 1))
    return lab == 1 + int(np.argmax(s))


def classes(img, pal, sigma):
    """Every pixel -> nearest palette colour, then each class region smoothed (flat, clean shapes)."""
    b = cv2.GaussianBlur(img, (0, 0), 1.2)
    d = np.stack([((b - np.array(c, np.float32)) ** 2).sum(2) for c in pal], 0)
    k = d.argmin(0)
    soft = np.stack([cv2.GaussianBlur((k == i).astype(np.float32), (0, 0), sigma) for i in range(len(pal))], 0)
    return soft.argmax(0)


def rgba(h, w): return np.zeros((h, w, 4), np.float32)


def put(o, m, col, a=255): o[m] = list(col) + [a]


def ink_outline(o, fill, w=OUTLINE, rim=None, rimw=6):
    d = ndimage.distance_transform_edt(~fill)
    if rim is not None: put(o, (d > w - 1) & (d <= w + rimw), rim)
    put(o, (d > 0) & (d <= w), INK)
    # soft outer edge (anti-aliasing)
    lo = w if rim is None else w + rimw
    o[(d > lo) & (d <= lo + 1.2)] = list(INK if rim is None else rim) + [110]


def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- the template (white spiral picture)
def template():
    src = load('spiral')[130:480, 380:700]
    U = 2.6
    big = up(src, U)
    lum = big.mean(2)
    fg = cv2.GaussianBlur(lum, (0, 0), 2.0) > 60
    lab, n = ndimage.label(fg); sizes = ndimage.sum(fg, lab, range(1, n + 1))
    fg = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2000])
    alm = biggest(fg)
    almf = ndimage.binary_fill_holes(alm)
    holes = almf & ~alm
    ys, xs = np.nonzero(holes)
    icx, icy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    ir = max(np.ptp(xs), np.ptp(ys)) / 2 + 3
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    # eyeball behind the iris: paint it in from around it
    hole = (np.hypot(xx - icx, yy - icy) <= ir + 10).astype(np.uint8) * 255
    lum2 = cv2.inpaint(np.clip(lum, 0, 255).astype(np.uint8), hole, 25, cv2.INPAINT_TELEA).astype(np.float32)
    fill = smooth_mask(fg | almf, 2.5)
    almf = smooth_mask(almf, 2.5)
    t = cv2.GaussianBlur(lum2, (0, 0), 3.5)
    light = t > 205
    light |= np.hypot(xx - icx, yy - icy) <= ir + 40           # no leftover socket shading round the iris
    light = smooth_mask(light, 3.0)
    ays, axs = np.nonzero(almf)
    center = ((axs.min() + axs.max()) / 2, (ays.min() + ays.max()) / 2)
    return dict(lum=lum, fill=fill, alm=almf, light=light, iris=(icx, icy, ir), center=center, width=float(np.ptp(axs)), U=U)


def iris_spiral(T):
    """The spiral picture's iris: black disc, white ring, grey ring, dark dot. Rebuilt from its
    average brightness at each distance from the dot, so the rings come out round and flat."""
    icx, icy, ir = T['iris']
    lum = T['lum']
    H, W = lum.shape; yy, xx = np.mgrid[0:H, 0:W]
    disc = np.hypot(xx - icx, yy - icy) <= ir
    cy_, cx_ = ndimage.center_of_mass(disc & (lum > 110))
    r = np.hypot(xx - cx_, yy - cy_)
    prof = ndimage.mean(lum, np.where(disc, r.round().astype(int), -1), range(0, int(ir * 1.3)))
    S = int(ir * 2 + 16); c = S / 2
    oy, ox = np.mgrid[0:S, 0:S]
    rr = np.hypot(ox - c, oy - c)
    r2 = rr                                                     # flat FNF rings: centred on the disc
    white = np.zeros((S, S), bool)
    for k in range(1, len(prof)):
        if prof[k] > 128: white |= np.abs(r2 - k) <= 0.75
    white = (cv2.GaussianBlur(white.astype(np.float32), (0, 0), 1.5) > 0.5) & (rr <= ir * 0.8) & (r2 > ir * 0.12)
    o = rgba(S, S)
    put(o, rr <= ir, (14, 13, 18)); put(o, white, (242, 241, 247))
    ink_outline(o, rr <= ir, 6)
    return o


def iris_from(name, circle, pal, flat, r_out):
    """Iris from another picture: crop its disc, flatten to its palette, size it for the template."""
    src = load(name)
    cx, cy, r = circle
    x0, y0 = int(cx - r - 4), int(cy - r - 4)
    crop = src[y0:int(cy + r + 5), x0:int(cx + r + 5)]
    U = r_out / r
    big = up(crop, U)
    k = classes(big, pal, 2.4)
    H, W = k.shape; yy, xx = np.mgrid[0:H, 0:W]
    c = (r + 4) * U
    disc = np.hypot(xx - c, yy - c) <= r_out
    o = rgba(H, W)
    for i, col in enumerate(flat):
        if col is not None: put(o, disc & (k == i), col)
    ink_outline(o, disc, 6)
    return o


def body_look(T, light, shade, rim=None):
    H, W = T['fill'].shape
    o = rgba(H, W)
    put(o, T['fill'], hexrgb(shade))
    put(o, T['fill'] & T['light'], hexrgb(light))
    ink_outline(o, T['fill'], OUTLINE, hexrgb(rim) if rim else None)
    return o


# ---------------------------------------------------------------- the red veiny picture (used whole)
def veins():
    src = load('veins')[0:403, 260:660]
    U = 2.0
    big = up(src, U)
    r, g, b = big[..., 0], big[..., 1], big[..., 2]
    lum = big.mean(2)
    core = smooth_mask((lum < 80) | ((r > 140) & (g < 90) & (b < 90)), 1.2)
    fill = ndimage.binary_fill_holes(ndimage.binary_closing(core, iterations=3))
    fill = smooth_mask(ndimage.binary_opening(fill, iterations=2), 2.0)
    pcx, pcy, pr = (497 - 260) * U, 192 * U, 66 * U          # the big black pupil
    H, W = lum.shape; yy, xx = np.mgrid[0:H, 0:W]
    hole = (np.hypot(xx - pcx, yy - pcy) <= pr + 6).astype(np.uint8) * 255
    filled = cv2.inpaint(np.clip(big, 0, 255).astype(np.uint8), hole, 30, cv2.INPAINT_TELEA).astype(np.float32)
    pal = [(10, 8, 10), (225, 20, 28), (120, 6, 12), (250, 246, 246), (215, 130, 136)]
    flat = [INK, (216, 22, 31), (136, 10, 18), (252, 245, 245), (236, 160, 168)]
    k = classes(cv2.bilateralFilter(filled, 9, 40, 9), pal, 2.6)
    o = rgba(H, W)
    for i, col in enumerate(flat): put(o, fill & (k == i), col)
    ink_outline(o, fill, 5)
    sc = fill & ((k == 3) | (k == 4) | hole.astype(bool))
    alm = biggest(ndimage.binary_fill_holes(smooth_mask(sc, 3)) & fill)
    ays, axs = np.nonzero(alm)
    S = int(pr * 2 + 16); io = rgba(S, S); oy, ox = np.mgrid[0:S, 0:S]; c = S / 2
    put(io, np.hypot(ox - c, oy - c) <= pr, (8, 6, 9))
    for gx, gy, gr in ((464, 145, 6), (488, 202, 7)):
        gx = (gx - 260) * U - pcx + c; gy = gy * U - pcy + c
        put(io, np.hypot(ox - gx, oy - gy) <= gr * U * 0.9, (255, 255, 255))
    return dict(back=o, alm=alm, iris=io, irisAt=(pcx, pcy), center=((axs.min() + axs.max()) / 2, (ays.min() + ays.max()) / 2), width=float(np.ptp(axs)))


def save(o, path):
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8), 'RGBA').save(path)


def mask_img(m):
    m = ndimage.binary_erosion(m, iterations=2)
    o = np.zeros(m.shape + (4,), np.uint8); o[m] = (255, 255, 255, 255)
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--preview', default=None)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.out):
        if f.endswith('.png') or f.endswith('.json'): os.remove(os.path.join(a.out, f))
    T = template()
    W = T['width']
    meta = {'looks': {}}
    def look(name, back, iris, irisAt, center, width, mask):
        save(back, os.path.join(a.out, 'back-' + name + '.png'))
        save(iris, os.path.join(a.out, 'iris-' + name + '.png'))
        meta['looks'][name] = {'back': 'back-' + name, 'iris': 'iris-' + name, 'mask': mask,
                               'center': [round(center[0], 1), round(center[1], 1)], 'irisAt': [round(irisAt[0], 1), round(irisAt[1], 1)],
                               'scale': round(ALMOND_WORLD / width, 4), 'size': [back.shape[1], back.shape[0]], 'almondW': round(width, 1)}
    save(mask_img(T['alm']), os.path.join(a.out, 'mask-template.png'))
    ic = T['iris'][:2]
    look('spiral', body_look(T, '#f4f3f8', '#b8b6c8'), iris_spiral(T), ic, T['center'], W, 'mask-template')
    # each iris keeps its own picture's iris : eyeball size
    rr = iris_from('redring', (625, 418, 96), [(40, 40, 44), (200, 196, 204), (140, 132, 140), (255, 20, 20), (170, 110, 110), (190, 80, 80)],
                   [(66, 64, 72), (214, 210, 218), (160, 154, 166), (255, 34, 34), (196, 186, 196), (196, 186, 196)], W * 0.128)
    look('redring', body_look(T, '#57555e', '#35343b'), rr, ic, T['center'], W, 'mask-template')
    bl = iris_from('blue', (531, 403, 104), [(62, 60, 200), (44, 44, 50), (80, 80, 86), (22, 22, 26), (50, 50, 150)],
                   [(96, 92, 255), (58, 56, 66), (84, 82, 94), (26, 25, 30), (96, 92, 255)], W * 0.14)
    look('blue', body_look(T, '#4b48e8', '#2f2bb4'), bl, ic, T['center'], W, 'mask-template')
    vd = iris_from('void', (610, 566, 168), [(20, 20, 22), (190, 190, 192), (130, 130, 134), (255, 30, 30), (80, 80, 84)],
                   [(22, 21, 26), (200, 198, 206), (146, 142, 154), (255, 38, 38), (92, 90, 100)], W * 0.15)
    look('void', body_look(T, '#2a2832', '#141318', '#aaa5bc'), vd, ic, T['center'], W, 'mask-template')
    V = veins()
    save(mask_img(V['alm']), os.path.join(a.out, 'mask-veins.png'))
    look('veins', V['back'], V['iris'], V['irisAt'], V['center'], V['width'], 'mask-veins')
    json.dump(meta, open(os.path.join(a.out, 'meta.json'), 'w'), indent=1)
    for n, L in meta['looks'].items(): print(n, L['size'], 'scale', L['scale'])
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
        tiles = []
        for n, L in meta['looks'].items():
            b = Image.open(os.path.join(a.out, L['back'] + '.png')); i = Image.open(os.path.join(a.out, L['iris'] + '.png'))
            m = np.array(Image.open(os.path.join(a.out, L['mask'] + '.png')).split()[3])
            t = Image.new('RGBA', b.size, (70, 66, 92, 255)); t.alpha_composite(b)
            layer = Image.new('RGBA', b.size, (0, 0, 0, 0)); layer.alpha_composite(i, (int(L['irisAt'][0] - i.width / 2), int(L['irisAt'][1] - i.height / 2)))
            layer.putalpha(Image.fromarray(np.minimum(np.array(layer.split()[3]), m)))
            t.alpha_composite(layer); t = t.resize((int(t.width * L['scale']), int(t.height * L['scale'])))
            tiles.append(t)
        Wt = sum(t.width for t in tiles); Ht = max(t.height for t in tiles)
        S = Image.new('RGBA', (Wt, Ht), (70, 66, 92, 255)); x = 0
        for t in tiles: S.alpha_composite(t, (x, 0)); x += t.width
        S.save(os.path.join(a.preview, 'eyes.png')); print('preview', S.size)


if __name__ == '__main__':
    main()
