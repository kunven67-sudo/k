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
IRIS = 0.2                  # iris radius : eyeball width, big like the red picture's pupil


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
    t[np.hypot(xx - icx, yy - icy) <= ir + 40] = np.maximum(t[np.hypot(xx - icx, yy - icy) <= ir + 40], 230)
    return dict(t=t, lum=lum, fill=fill, alm=almf, light=light, iris=(icx, icy, ir), center=center, width=float(np.ptp(axs)), U=U)


def glints(o, c, R):
    """Two white shine spots, like the red picture's pupil."""
    H, W = o.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    for gx, gy, gr in ((-0.36, -0.42, 0.13), (0.3, 0.08, 0.07)):
        put(o, np.hypot(xx - c - gx * R, yy - c - gy * R) <= gr * R, (255, 255, 255))


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
    glints(o, c, ir)
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
    glints(o, c, r_out)
    ink_outline(o, disc, 6)
    return o


def body_look(T, P):
    """Rich look (like the red veiny picture): 4 tones from the picture's own shading, white shine
    spots, a coloured rim round the eyeball, ink outline and a soft coloured glow round everything."""
    H, W = T['fill'].shape
    o = rgba(H, W)
    t, fill, alm = T['t'], T['fill'], T['alm']
    # soft glow behind (baked once here, so the game never blurs anything)
    d = ndimage.distance_transform_edt(~fill)
    g = np.clip(1 - (d - OUTLINE) / 26.0, 0, 1) * (d > OUTLINE)
    gc = np.array(hexrgb(P['glow']), np.float32)
    o[..., :3] = gc; o[..., 3] = 150 * g ** 1.6
    lv = [(t < 165), (t >= 165) & (t < 215), (t >= 215) & (t < 251), t >= 251]
    for m, col in zip(lv, (P['shade'], P['mid'], P['light'], P['light'])):
        put(o, fill & smooth_mask(m, 2.2), hexrgb(col))
    # shine: the brightest spots of the 3D picture, shrunk to clean blobs
    hl = smooth_mask(ndimage.binary_erosion(t >= 253.5, iterations=6), 3.0) & fill
    put(o, hl, hexrgb(P['hl']))
    # coloured rim inside the eyeball's outline + a thin one inside every spike
    da = ndimage.distance_transform_edt(alm)
    put(o, alm & (da <= 13), hexrgb(P['rim']))
    df = ndimage.distance_transform_edt(fill)
    put(o, fill & ~alm & (df <= 4.5), hexrgb(P['rim']))
    ink_outline(o, fill, OUTLINE)
    o[..., 3] = np.maximum(o[..., 3], 0)
    # the glow must stay under the outline + art
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
    d = ndimage.distance_transform_edt(~fill)                 # its red glow, like the picture
    g = np.clip(1 - (d - 5) / 24.0, 0, 1) * (d > 5)
    o[..., :3] = (255, 60, 70); o[..., 3] = 160 * g ** 1.6
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


# ---------------------------------------------------------------- goo (from real art, repainted black)
GOO = [(14, 12, 20), (40, 32, 66), (91, 74, 154), (200, 188, 255)]      # base, dark shine, shine, highlight
FNF = os.environ.get('FNF_ASSETS', '/home/user/funkincrew/funkin.assets')


def goo_paint(a, lumcuts, mean=False):
    """Any art -> black goo: dark parts = goo, brighter parts = purple shine, alpha kept."""
    rgb = a[..., :3].astype(np.float32); al = a[..., 3]
    lum = rgb.mean(2) if mean else rgb.max(2)
    o = np.zeros(a.shape, np.float32); o[..., 3] = al
    o[..., :3] = GOO[0]
    for cut, col in zip(lumcuts, GOO[1:]):
        o[lum >= cut, :3] = col
    o[(rgb.max(2) < 40) & (al > 0), :3] = INK
    return o


def goo_drop(V):
    """A goo drop = the big shiny bead off the red veiny picture, repainted."""
    b = V['back']; cx, cy, r = 310, 172, 50
    crop = b[cy - r:cy + r, cx - r:cx + r].copy()
    yy, xx = np.mgrid[0:2 * r, 0:2 * r]
    crop[np.hypot(xx - r, yy - r) > r - 3, 3] = 0
    crop[(crop[..., 3] < 200)] = 0                          # drop its glow, keep the ball + outline
    return goo_paint(crop, (120, 200, 250))


def goo_puddle():
    """WRATH's goo pool: the shape of the real philly streets puddle, filled with goo."""
    a = np.array(Image.open(os.path.join(FNF, 'weekend1/images/phillyStreets/puddle.png')).convert('RGBA'))
    a = a[:, 1200:]                                          # the puddles on the right
    al = a[..., 3] > 20
    fill = smooth_mask(al, 1.5)
    H, W = fill.shape; o = rgba(H, W)
    put(o, fill, GOO[0])
    # shine along the top edge (the puddle catching the street light)
    sh = fill & ~np.roll(fill, 9, axis=0)
    put(o, smooth_mask(sh, 1.5) & fill, GOO[1])
    sh2 = fill & ~np.roll(fill, 4, axis=0) & (np.mgrid[0:H, 0:W][1] < W * 0.55)
    put(o, sh2, GOO[2])
    ink_outline(o, fill, 4)
    return o


def goo_splash():
    """Weekend 1's spray paint explosion (only its flying blobs, not the fire flash), repainted goo."""
    import re
    base = os.path.join(FNF, 'weekend1/images/SpraypaintExplosion')
    xml = open(base + '.xml', encoding='utf-8-sig').read(); sheet = np.array(Image.open(base + '.png').convert('RGBA'))
    fr = re.findall(r'name="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" frameX="(-?\d+)" frameY="(-?\d+)" frameWidth="(\d+)" frameHeight="(\d+)"', xml)
    out = []
    for name, x, y, w, h, fx, fy, fw, fh in fr[2:10:2]:
        x, y, w, h, fx, fy, fw, fh = map(int, (x, y, w, h, fx, fy, fw, fh))
        full = np.zeros((fh, fw, 4), np.uint8)
        full[-fy:-fy + h, -fx:-fx + w] = sheet[y:y + h, x:x + w]
        g = goo_paint(full, (150, 205, 245), mean=True).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(g, 'RGBA').resize((fw // 2, fh // 2), Image.LANCZOS)
        out.append(np.array(im))
    return out


def drip_points(back):
    """Spike tips along the bottom edge (where goo drips from), in image px."""
    from scipy.signal import find_peaks
    al = back[..., 3] > 200
    H, W = al.shape
    bottom = np.array([np.nonzero(al[:, x])[0].max() if al[:, x].any() else 0 for x in range(W)], float)
    pk, _ = find_peaks(bottom, prominence=25, distance=30)
    return [[int(x), int(bottom[x]) - 6] for x in pk if bottom[x] > H * 0.55]


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
                               'scale': round(ALMOND_WORLD / width, 4), 'size': [back.shape[1], back.shape[0]], 'almondW': round(width, 1),
                               'drips': drip_points(back)}
    save(mask_img(T['alm']), os.path.join(a.out, 'mask-template.png'))
    ic = T['iris'][:2]
    sp = iris_spiral(T); k = IRIS * W / T['iris'][2]
    sp = np.array(Image.fromarray(np.clip(sp, 0, 255).astype(np.uint8), 'RGBA').resize((int(sp.shape[1] * k), int(sp.shape[0] * k)), Image.LANCZOS)).astype(np.float32)
    look('spiral', body_look(T, dict(hl='#ffffff', light='#eeedf5', mid='#c6c4d6', shade='#8a87a3', rim='#a29fc0', glow='#d4cbff')), sp, ic, T['center'], W, 'mask-template')
    # each iris keeps its own picture's iris : eyeball size
    rr = iris_from('redring', (625, 418, 96), [(40, 40, 44), (200, 196, 204), (140, 132, 140), (255, 20, 20), (170, 110, 110), (190, 80, 80)],
                   [(66, 64, 72), (214, 210, 218), (160, 154, 166), (255, 34, 34), (196, 186, 196), (196, 186, 196)], W * IRIS)
    look('redring', body_look(T, dict(hl='#c2bfcc', light='#6c6a76', mid='#4c4a54', shade='#2c2b32', rim='#a8121c', glow='#ff2a2a')), rr, ic, T['center'], W, 'mask-template')
    bl = iris_from('blue', (531, 403, 104), [(62, 60, 200), (44, 44, 50), (80, 80, 86), (22, 22, 26), (50, 50, 150)],
                   [(96, 92, 255), (58, 56, 66), (84, 82, 94), (26, 25, 30), (96, 92, 255)], W * IRIS)
    look('blue', body_look(T, dict(hl='#d6d5ff', light='#6f6cff', mid='#4a47e6', shade='#2a27a4', rim='#24208a', glow='#5c6dff')), bl, ic, T['center'], W, 'mask-template')
    vd = iris_from('void', (610, 566, 168), [(20, 20, 22), (190, 190, 192), (130, 130, 134), (255, 30, 30), (80, 80, 84)],
                   [(22, 21, 26), (200, 198, 206), (146, 142, 154), (255, 38, 38), (92, 90, 100)], W * IRIS)
    look('void', body_look(T, dict(hl='#9b97ab', light='#3d3b48', mid='#272530', shade='#121116', rim='#aaa5bc', glow='#cfcadf')), vd, ic, T['center'], W, 'mask-template')
    V = veins()
    save(mask_img(V['alm']), os.path.join(a.out, 'mask-veins.png'))
    look('veins', V['back'], V['iris'], V['irisAt'], V['center'], V['width'], 'mask-veins')
    save(goo_drop(V), os.path.join(a.out, 'goo-drop.png'))
    save(goo_puddle(), os.path.join(a.out, 'goo-puddle.png'))
    sp = goo_splash()
    for i, f in enumerate(sp): save(f, os.path.join(a.out, 'goo-splash-%d.png' % i))
    meta['splash'] = len(sp)
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
