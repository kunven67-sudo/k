"""WRATH's park (the GLARE stage): a park path with a bench by a chain-link fence, the SCOOPS AHOY
ice cream truck parked on the street behind it, houses across the street.

Built from art that is NOT ours (so it stays private, never committed or published):
  * park (houses + street, trees + fence + bushes + dirt path, bench) - the FNF mod "vs Kurata"
    by obosakura / Norha (GameBanana 504825). Its houses are drawn at sunset; back_day() repaints
    them for the daytime: lifted shadows, no orange cast, glass windows, a blue sky between them
  * daytime sky - "Week 3 [Daytime Reskin]" by Undead_R0c (GameBanana 183324)
  * the truck - the user's own picture (fnf2/private/intro-truck-ref.webp), with chunkier
    hand-inked outlines so it sits in the mod's drawing style

  python3 fnf2/tools/own/park.py
Writes PNGs to fnf2/build/own/shared/images/wrath-park/.
"""
import os, shutil, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'wrath-park')
KURATA = os.environ.get('KURATA', '/home/user/ref/mods/kurata/x/VsKurata-PsychEngine-Windows64/PsychEngine/mods/mods/images')
DAYSKY = os.environ.get('DAYSKY', '/home/user/ref/mods/w3day/x/week3-day/assets/images/philly/sky.png')
sys.path.insert(0, HERE)


def lab_of(rgb):
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    return lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128


def back_day():
    """Kurata's sunset street repainted for the daytime."""
    src = np.array(Image.open(os.path.join(KURATA, 'parkbgback.PNG')).convert('RGBA'))
    rgb = src[..., :3]; H, W = rgb.shape[:2]
    L, A, B = lab_of(rgb)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    Hh, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255

    # the sky gap between the houses (power lines + poles drawn over it)
    poly = np.array([(784, 0), (962, 0), (900, 52), (926, 60), (926, 122), (823, 197), (823, 300), (784, 300)], np.int32)
    inpoly = np.zeros((H, W), np.uint8); cv2.fillPoly(inpoly, [poly], 1); inpoly = inpoly > 0
    th = cv2.morphologyEx(L, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) - L
    wire = inpoly & (th > 12) & (L < 30)
    lb, n = ndimage.label(wire, structure=np.ones((3, 3)))
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(lb), 1):
        keep[i] = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= 14      # long thin lines only
    wire = keep[lb]
    ink = (L < 17) | wire
    sky = inpoly & ~ink & (S > 0.3)
    sky = ndimage.binary_opening(sky, iterations=1) | (sky & ndimage.binary_dilation(ink, iterations=2))
    edge = ndimage.binary_dilation(ink, iterations=2) & sky
    cov = np.where(edge, np.clip((38 - L) / (38 - 13), 0, 1), 0.0)

    sk = Image.open(DAYSKY).convert('RGB')
    sk = np.array(sk.crop((1050, 30, 1500, 700)).resize((200, 340), Image.LANCZOS)).astype(np.float32)
    daysky = np.zeros((H, W, 3), np.float32)
    x0 = 772
    daysky[0:320, x0:x0 + 200] = sk[20:340]

    # houses: lift the shadows, take the orange cast out, lit windows -> glass
    Ln, An, Bn = 100 * (L / 100) ** 0.7, A * 0.5, B * 0.6 + 5
    lab2 = np.stack([Ln * 255 / 100, An + 128, Bn + 128], -1).clip(0, 255).astype(np.uint8)
    day = cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB).astype(np.float32)
    win = (~inpoly) & (Hh >= 18) & (Hh <= 52) & (S > 0.55) & (V > 0.62)
    t = ((V - 0.62) / 0.38).clip(0, 1)[..., None]
    glass = np.array([96, 128, 160], np.float32) * (1 - t) + np.array([178, 206, 228], np.float32) * t
    day[win] = glass[win]
    far = np.zeros((H, W), np.uint8); cv2.fillPoly(far, [np.array([(784, 190), (826, 190), (826, 380), (784, 380)], np.int32)], 1)
    haze = ((inpoly & ~sky) | (far > 0)) & ~ink & (L > 30)
    day[haze] = day[haze] * 0.45 + np.array([182, 198, 214], np.float32) * 0.55 * (L[haze, None] / 75)
    out = day
    out[sky] = daysky[sky] * (1 - cov[sky, None]) + np.array([30, 22, 34], np.float32) * cov[sky, None]
    wc = np.clip((th - 6) / 14, 0, 1) * wire
    wc = np.maximum(wc, cv2.GaussianBlur(wc.astype(np.float32), (0, 0), 0.6) * 0.9)
    m = inpoly & (wc > 0)
    out[m] = out[m] * (1 - wc[m, None]) + np.array([38, 30, 42], np.float32) * wc[m, None]
    return np.dstack([out.clip(0, 255).astype(np.uint8), src[..., 3]])


# ---------------------------------------------------------------- the dark at the snap
# night (the snap, with TV glitches) -> blood red sky, black clouds, black silhouettes (the eye opens)
# -> black void (in the game). The night + red looks are painted from the mod's own sunset art.
SKY_POLY = np.array([(784, 0), (962, 0), (900, 52), (926, 60), (926, 122), (823, 197), (823, 300), (784, 300)], np.int32)


def sky_masks(rgb):
    """-> (open sky, clouds, power lines) inside the gap between the houses (sunset art)."""
    H, W = rgb.shape[:2]
    L, _, _ = lab_of(rgb)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    S, V = hsv[..., 1] / 255, hsv[..., 2] / 255
    inpoly = np.zeros((H, W), np.uint8); cv2.fillPoly(inpoly, [SKY_POLY], 1); inpoly = inpoly > 0
    th = cv2.morphologyEx(L, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))) - L
    wire = inpoly & (((th > 12) & (L < 30)) | (L < 17))
    sky = inpoly & ~wire & (S > 0.3)
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    cloud = sky & ((V < 0.8) | (b > g + 15))
    return sky & ~cloud, cloud, wire, inpoly


def grade(rgb, Lk, tint, gamma=1.0):
    """Darken (lightness * Lk, with a gamma) and colour toward `tint` (a, b in Lab)."""
    L, A, B = lab_of(rgb)
    Ln = 100 * (np.clip(L * Lk, 0, 100) / 100) ** gamma
    An, Bn = A * tint[2] + tint[0], B * tint[2] + tint[1]
    lab2 = np.stack([Ln * 255 / 100, An + 128, Bn + 128], -1).clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB).astype(np.float32)


def vgrad(h, w, stops):
    """Vertical gradient image from [(t, (r, g, b)), ...]."""
    t = np.linspace(0, 1, h)[:, None]
    ts = [s[0] for s in stops]
    out = np.stack([np.interp(t, ts, [s[1][c] for s in stops]) for c in range(3)], -1)
    return np.repeat(out, w, 1).astype(np.float32)


def back_dark(mode):
    src = np.array(Image.open(os.path.join(KURATA, 'parkbgback.PNG')).convert('RGBA'))
    rgb = src[..., :3]; H, W = rgb.shape[:2]
    open_, cloud, wire, inpoly = sky_masks(rgb)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    Hh, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    win = (~inpoly) & (Hh >= 18) & (Hh <= 52) & (S > 0.55) & (V > 0.62)
    win = ndimage.binary_dilation(win, iterations=1) & (Hh >= 10) & (Hh <= 60) & (S > 0.4)
    rng = np.random.default_rng(11)
    if mode == 'night':
        out = grade(rgb, 0.55, (-2, -20, 0.3), 1.08)
        sky = vgrad(H, W, [(0, (8, 12, 38)), (0.25, (20, 28, 66)), (0.45, (44, 52, 96)), (1, (44, 52, 96))])
        cl = vgrad(H, W, [(0, (26, 30, 58)), (1, (52, 56, 92))]) * (0.75 + 0.35 * V[..., None])
        out[open_] = sky[open_]; out[cloud] = cl[cloud]
        st = (rng.random((H, W)) > 0.9965) & open_ & ~ndimage.binary_dilation(cloud | wire, iterations=2)
        st = ndimage.binary_dilation(st, iterations=rng.integers(0, 2))
        out[st] = (230, 236, 255)
        # the windows stay lit and glow a little at night
        lit = rgb.astype(np.float32) * np.array([1.08, 1.0, 0.8])
        out[win] = lit[win]
        glow = cv2.GaussianBlur(win.astype(np.float32), (0, 0), 7)[..., None]
        out = out + glow * np.array([120, 80, 20]) * 0.55
    else:  # red: the houses lit blood red, the sky a bright red with black clouds
        L, _, _ = lab_of(rgb)
        out = red_ramp(L / 100)
        sky = vgrad(H, W, [(0, (90, 0, 10)), (0.2, (190, 10, 18)), (0.5, (250, 60, 30)), (1, (255, 120, 60))])
        out[open_] = sky[open_]
        out[cloud] = np.array([12, 0, 4]) + sky[cloud] * 0.1
        out[win] = np.array([20, 0, 2])                                  # the lights are out
    return np.dstack([out.clip(0, 255).astype(np.uint8), src[..., 3]])


def red_ramp(l):
    """Lightness 0..1 -> blood-red light (black shadows, deep red mids, hot red-orange highlights)."""
    stops = [(0, (0, 0, 0)), (0.18, (40, 0, 4)), (0.4, (120, 6, 12)), (0.65, (205, 30, 22)), (1, (255, 110, 70))]
    ts = [p[0] for p in stops]
    return np.stack([np.interp(l, ts, [p[1][c] for p in stops]) for c in range(3)], -1).astype(np.float32)


def dark(rgba, mode):
    """Night / blood-red version of a prop (fence + trees + path, bench, truck)."""
    rgb = rgba[..., :3]
    if mode == 'night': out = grade(rgb, 0.52, (-2, -18, 0.35), 1.08)
    else:                                                    # black silhouettes, a red glint on the light bits
        L, _, _ = lab_of(rgb)
        out = red_ramp((L / 100) ** 2.2 * 0.42)
    return np.dstack([out.clip(0, 255).astype(np.uint8), rgba[..., 3]])


def cracks(w=1300, h=280, seed=4):
    """The ground splitting open in the void: jagged black cracks with hot red light deep inside."""
    from PIL import ImageDraw
    rng = np.random.default_rng(seed)
    m, c = Image.new('L', (w, h), 0), Image.new('L', (w, h), 0)
    dm, dc = ImageDraw.Draw(m), ImageDraw.Draw(c)

    def crack(x, y, ang0, length, width, depth):
        ang, pts = ang0, [(x, y)]
        while length > 0 and 4 < y < h - 4:
            step = rng.uniform(12, 30)
            ang = ang0 + 0.55 * (ang - ang0) + rng.normal(0, 0.5)        # zig-zag, but keep heading the same way
            x += np.cos(ang) * step; y += np.sin(ang) * step * 0.4         # flat: the ground is seen at an angle
            pts.append((x, y)); length -= step
            if depth < 2 and rng.random() < 0.12:
                crack(x, y, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 1.0), length * rng.uniform(0.25, 0.45), width * 0.55, depth + 1)
        for i in range(len(pts) - 1):
            k = 1 - i / max(1, len(pts) - 1)
            wd = width * (0.3 + 0.7 * k)
            dm.line([pts[i], pts[i + 1]], fill=255, width=max(2, int(round(wd))))
            if wd > 4: dc.line([pts[i], pts[i + 1]], fill=255, width=max(1, int(round(wd * 0.32))))
    cx, cy = w / 2, h * 0.5
    crack(cx, cy, np.pi, w * 0.46, 14, 0)
    crack(cx, cy, 0.0, w * 0.46, 14, 0)
    for ang in (2.3, 0.8, -2.5, -0.6):
        crack(cx + rng.normal(0, 25), cy, ang, rng.uniform(90, 170), 7, 1)
    a = cv2.GaussianBlur(np.array(m).astype(np.float32) / 255, (0, 0), 0.7)
    core = cv2.GaussianBlur(np.array(c).astype(np.float32) / 255, (0, 0), 0.9)
    glow = np.clip(cv2.GaussianBlur(np.array(c).astype(np.float32) / 255, (0, 0), 10) * 2.2, 0, 1)
    rgb = np.array([200, 14, 10], np.float32) * glow[..., None]
    al = glow * 0.55
    rgb = rgb * (1 - a[..., None]) + np.array([6, 0, 2]) * a[..., None]; al = np.maximum(al, a)
    rgb = rgb * (1 - core[..., None]) + np.array([255, 70, 30]) * core[..., None]
    return np.dstack([rgb.clip(0, 255), al.clip(0, 1) * 255]).astype(np.uint8)


def inked(rgba, seed=5, inner=True):
    """Chunkier, wobbly-width outlines (inner lines + a heavier silhouette), like hand-inked FNF art."""
    t = rgba.astype(np.float32); rgb, al = t[..., :3], t[..., 3] / 255
    L, _, _ = lab_of(rgba[..., :3])
    line = (L < 14) & (al > 0.5)
    rng = np.random.default_rng(seed)
    noise = cv2.GaussianBlur(rng.random(line.shape).astype(np.float32), (0, 0), 9)
    noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-9)
    thick = np.where(noise > 0.55, ndimage.binary_dilation(line, iterations=1), line) & (al > 0.3)
    if not inner: thick[:] = False                       # the picture's own lines are thick enough
    sil = al > 0.5
    ring = lambda k: ndimage.binary_dilation(sil, iterations=k) & ~ndimage.binary_erosion(sil, iterations=1)
    outer = np.where(noise > 0.5, ring(4), ring(3))
    soft = cv2.GaussianBlur((thick | outer).astype(np.float32), (0, 0), 0.6)
    ink = np.array([24, 14, 18], np.float32)
    rgb = rgb * (1 - soft[..., None]) + ink * soft[..., None]
    al = np.maximum(al, soft)
    return np.dstack([rgb, al * 255]).clip(0, 255).astype(np.uint8)


def truck():
    """-> (truck with its serving window cut out, the window's inside) - Kenny stands between them."""
    import intro_props
    t = inked(intro_props.truck(night=False))
    L, _, _ = lab_of(t[..., :3])
    # the serving window: flood the dark inside from a seed, stopping at the ink lines
    box = np.zeros(L.shape, bool); box[150:330, 105:300] = True
    inside = box & (L > 15) & (L < 62) & (t[..., 3] > 200)
    lb, _ = ndimage.label(inside)
    win = ndimage.binary_fill_holes(lb == lb[240, 200])
    win = ndimage.binary_closing(win, iterations=3) & box
    soft = cv2.GaussianBlur(win.astype(np.float32), (0, 0), 0.8)
    inner = t.copy(); inner[..., 3] = (soft * 255).astype(np.uint8)
    outer = t.copy(); outer[..., 3] = (t[..., 3] * (1 - soft)).astype(np.uint8)
    return outer, inner


# the stage, in world px. The park art is drawn at 1286x730 and shown at 1.5x (like vs Kurata),
# so a park pixel (px, py) sits at world (px * 1.5 - 300, py * 1.5 - 150) on the scroll-1 layers.
KENNY = os.environ.get('KENNY', '/home/user/ref/mods/sweet/bin/assets/shared/images/characters/kenny')
TRUCK_SC, TRUCK_POS, TRUCK_SCROLL = 1.21, (330, -40), 0.75


def stage_json():
    P = 'wrath-park/'
    prop = lambda name, path, pos, scale, scroll, z, **kw: dict(dict(name=name, assetPath=path, position=list(pos),
                                                                      scale=[scale, scale], scroll=[scroll, scroll], zIndex=z, animations=[]), **kw)
    props = [
        dict(name='sky', assetPath='#9fc7ee', position=[-800, -800], scale=[4000, 2600], scroll=[0, 0], zIndex=0),
        prop('back', P + 'back-day', at('back'), 1.5, 0.6, 10),
        prop('truckInside', P + 'truck-inside', TRUCK_POS, TRUCK_SC, TRUCK_SCROLL, 20),
        prop('kenny', P + 'kenny', (TRUCK_POS[0] + 70, TRUCK_POS[1] + 120), 0.42, TRUCK_SCROLL, 21, animType='sparrow',
             animations=[dict(name='idle', prefix='unhype idle', frameRate=24, looped=True),
                         dict(name='hype', prefix='hype idle', frameRate=24, looped=True),
                         dict(name='serve', prefix='unhype up', frameRate=24, looped=False)],
             startingAnimation='idle', danceEvery=0),
        prop('truck', P + 'truck', TRUCK_POS, TRUCK_SC, TRUCK_SCROLL, 22),
        prop('front', P + 'front', at('front'), 1.5, 0.9, 30),
        prop('bench', P + 'bench', (-300, -150), 1.5, 1.0, 50),
        prop('trashcan', P + 'trashcan', (1300, 555), 0.47, 1.0, 55),
    ]
    chars = {'bf': dict(zIndex=300, position=[1125, 880], cameraOffsets=[-180, -60]),
             'dad': dict(zIndex=200, position=[265, 880], cameraOffsets=[200, -60]),
             'gf': dict(zIndex=100, position=[693, 815], cameraOffsets=[0, 0])}
    return dict(version='1.0.1', name='WRATH Park', cameraZoom=0.78, props=props, characters=chars)


# the mod's park is drawn for a closer camera: grow the layers (mirrored at the edges, so there's no
# seam) so the zoomed-out camera never runs off them. Park px are shown at 1.5x.
GROW = {'back': (520, 520, 160, 120), 'front': (430, 430, 0, 190)}      # left, right, top, bottom (park px)


def grow(rgba, key):
    l, r, t, b = GROW[key]
    return np.pad(rgba, ((t, b), (l, r), (0, 0)), mode='symmetric')


def at(key, pos=(-300, -150)):
    l, _, t, _ = GROW[key]
    return (pos[0] - l * 1.5, pos[1] - t * 1.5)


def from_white(path, box=None):
    """Cut a prop out of a picture on a white background (the user's own pictures): flood the white
    from the edges, drop the picture's own grey floor shadow, keep the object + its ink."""
    im = np.array(Image.open(path).convert('RGB'))
    if box: im = im[box[1]:box[3], box[0]:box[2]]
    H, W = im.shape[:2]
    L, A, B = lab_of(im)
    chroma = np.hypot(A, B)
    bg = (L > 88) & (chroma < 10)
    shadow = (L > 60) & (L <= 88) & (chroma < 18) & (B < 2)          # the soft blue-grey floor shadow
    m = (bg | shadow).astype(np.uint8)
    lab, _ = ndimage.label(m)
    edge_ids = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    outside = np.isin(lab, list(edge_ids))
    obj = ndimage.binary_fill_holes(~outside)
    lb, n = ndimage.label(obj)
    if n > 1: obj = lb == (np.argmax(np.bincount(lb.ravel())[1:]) + 1)
    soft = cv2.GaussianBlur(obj.astype(np.float32), (0, 0), 0.7)
    o = np.dstack([im, (soft * 255).astype(np.uint8)])
    ys, xs = np.nonzero(obj)
    return o[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]


def main():
    os.makedirs(OUT, exist_ok=True)
    rd = lambda n: np.array(Image.open(os.path.join(KURATA, n + '.PNG')).convert('RGBA'))
    Image.fromarray(grow(rd('parkbgback'), 'back')).save(os.path.join(OUT, 'back-sunset.png'))
    Image.fromarray(grow(rd('parkbgfront'), 'front')).save(os.path.join(OUT, 'front.png'))
    shutil.copyfile(os.path.join(KURATA, 'parkbgbench.PNG'), os.path.join(OUT, 'bench.png'))
    Image.fromarray(cracks()).save(os.path.join(OUT, 'cracks.png'))
    tc = os.path.join(ROOT, 'private', 'trashcan-ref.jpg')
    if os.path.exists(tc):
        can = inked(from_white(tc), inner=False)
        # a soft contact shadow on the path under it
        h, w = can.shape[:2]; pad = 40
        out = np.zeros((h + pad, w + 2 * pad, 4), np.float32)
        yy, xx = np.mgrid[0:h + pad, 0:w + 2 * pad]
        sh = np.clip(1 - np.hypot((xx - (w / 2 + pad)) / (w * 0.62), (yy - (h - 6)) / 26.0), 0, 1) ** 0.8
        out[..., :3] = (40, 24, 20); out[..., 3] = sh * 120
        a = can[..., 3:4].astype(np.float32) / 255
        reg = out[:h, pad:pad + w]
        reg[..., :3] = reg[..., :3] * (1 - a) + can[..., :3] * a
        reg[..., 3:4] = reg[..., 3:4] * (1 - a) + 255 * a
        can = out.clip(0, 255).astype(np.uint8)
        Image.fromarray(can).save(os.path.join(OUT, 'trashcan.png'))
        for mode in ('night', 'red'): Image.fromarray(dark(can, mode)).save(os.path.join(OUT, 'trashcan-%s.png' % mode))
    Image.fromarray(grow(back_day(), 'back')).save(os.path.join(OUT, 'back-day.png'))
    for mode in ('night', 'red'):
        Image.fromarray(grow(back_dark(mode), 'back')).save(os.path.join(OUT, 'back-%s.png' % mode))
        Image.fromarray(dark(grow(rd('parkbgfront'), 'front'), mode)).save(os.path.join(OUT, 'front-%s.png' % mode))
        Image.fromarray(dark(rd('parkbgbench'), mode)).save(os.path.join(OUT, 'bench-%s.png' % mode))
    outer, inner = truck()
    Image.fromarray(outer).save(os.path.join(OUT, 'truck.png'))
    Image.fromarray(inner).save(os.path.join(OUT, 'truck-inside.png'))
    for mode in ('night', 'red'):
        Image.fromarray(dark(outer, mode)).save(os.path.join(OUT, 'truck-%s.png' % mode))
        lit = inner.copy()
        if mode == 'night': lit[..., :3] = (inner[..., :3].astype(np.float32) * [1.25, 1.05, 0.7] + [60, 40, 0]).clip(0, 255).astype(np.uint8)
        else: lit = dark(inner, mode)
        Image.fromarray(lit).save(os.path.join(OUT, 'truck-inside-%s.png' % mode))
    for ext in ('.png', '.xml'): shutil.copyfile(KENNY + ext, os.path.join(OUT, 'kenny' + ext))
    sd = os.path.join(ROOT, 'build', 'own', 'preload', 'data', 'stages'); os.makedirs(sd, exist_ok=True)
    import json
    json.dump(stage_json(), open(os.path.join(sd, 'wrathPark.json'), 'w'), indent=1)
    print('wrote', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
