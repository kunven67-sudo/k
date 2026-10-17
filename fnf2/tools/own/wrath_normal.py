"""WRATH, normal form (the story intro guy): made from a reference drawing
(fnf2/private/wrath-normal-ref.png, never committed) cut into puppet parts,
with sneakers from BF's real atlas art (repainted) and drawn jeans.

  python3 fnf2/tools/own/wrath_normal.py [--preview DIR]

Writes the atlas to fnf2/build/own/shared/images/characters/wrath-normal/
and the character data to fnf2/build/own/preload/data/characters/.
Everything is in picture pixels; the character json scales it to game size.
"""
import argparse, colorsys, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import puppet as P

ROOT = os.path.dirname(os.path.dirname(HERE))           # fnf2/
REF = os.path.join(ROOT, 'private', 'wrath-normal-ref.png')
FNF = os.environ.get('FNF_ASSETS', '/home/user/funkincrew/funkin.assets')
ID = 'wrath-normal'

# ---------------------------------------------------------------- the drawing (picture px)
SEEDS = {
    'head': [(316, 263), (401, 303), (302, 302), (397, 339), (296, 342)],          # hair + face, eyes
    'torso': [(292, 634), (300, 449), (385, 453), (259, 475), (197, 785)],         # sweater + hip arm, neck, collar, hip hand
    'hand': [(651, 496), (693, 516), (587, 599), (643, 647)],                      # mic + hand
    'sleeve': [(517, 644)],
}
BG_GAPS = [(221, 652)]                       # the hole between the hip arm and the body
MIC_HANDLE = [(578, 690), (640, 690), (640, 770), (578, 770)]
NECK = (304, 420)                            # head turns here
SHOULDER = (468, 545)                        # mic arm swings here
WRIST = (590, 660)                           # mic hand bends here
SKIN = '#fcc9a5'
NECK_C = '#e89468'
SLEEVE_C = '#e8a85c'
SCALE = 0.56                                 # picture px -> game px (BF-sized head)


def cut():
    rgba = P.matte_white(REF, BG_GAPS)
    cu = P.Cutter(rgba, SEEDS, priority=['head', 'hand', 'torso', 'sleeve'], force={'hand': MIC_HANDLE})
    return rgba, cu


def mouth_stroke(rgba, cu):
    """The drawn :3 smile: the ink stroke inside the face (it touches no other line)."""
    head = cu.masks['head'] & cu.ink
    lab, n = ndimage.label(head)
    best = None
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if 250 < xs.mean() < 420 and 365 < ys.mean() < 410 and len(xs) > 200: best = lab == i
    return best


def build_parts():
    rgba, cu = cut()
    H, W = rgba.shape[:2]
    parts = {n: cu.part(n) for n in ('head', 'torso', 'hand', 'sleeve')}

    # -- head: lift the smile off (skin painted over it) so mouths can be swapped
    m = mouth_stroke(rgba, cu)
    ring = ndimage.binary_dilation(m, iterations=3) & cu.masks['head']
    smile = rgba.copy(); smile[..., 3] = np.where(ndimage.binary_dilation(m, iterations=2), rgba[..., 3], 0)
    # the smile's soft edge pixels were mixed with skin: keep them as dark ink with their coverage
    skin_l = np.mean(P.hexrgb(SKIN))
    cov = np.clip(1 - smile[..., :3].astype(float).mean(2) / skin_l, 0, 1) ** 0.8
    smile = np.dstack([np.zeros((H, W, 3)), np.where(smile[..., 3] > 0, cov * 255, 0)]).astype(np.uint8)
    head = parts['head']
    head[ring] = P.hexrgb(SKIN) + (255,)
    parts['head'] = head
    parts['mouth_smile'] = smile

    # -- torso: a neck that carries on up under the chin (shows when the head tilts)
    pn = P.Paint(W, H)
    pn.poly([(237, 330), (355, 330), (355, 452), (237, 430)], NECK_C)
    pn.line([(239, 330), (239, 432)], 8.5)
    pn.line([(354, 330), (354, 456)], 7)
    parts['torso'] = P.under(parts['torso'], pn.result())

    # -- sleeve: carries on to the left under the sweater (shows when the arm swings)
    sl = parts['sleeve']
    # bits of the sweater's outline that ended up on the sleeve's hidden edge -> sleeve colour
    near_torso = ndimage.distance_transform_edt(~cu.paint_masks['torso']) <= 18
    stray = (sl[..., 3] > 0) & cu.ink & near_torso
    sl[stray] = P.hexrgb(SLEEVE_C) + (255,)
    # the upper arm behind the sweater: round, with its own outline, so a raised arm shows its underside
    pn = P.Paint(W, H)
    edge = P.smooth([(458, 500), (426, 506), (412, 560), (418, 640), (440, 700), (474, 730), (522, 736), (552, 724)])
    pn.poly(edge + [(540, 700), (500, 640), (474, 560), (466, 530)], SLEEVE_C)
    pn.line(edge, 8)
    parts['sleeve'] = P.over(pn.result(), sl)

    # -- mouths for singing (drawn to match: thick black line, dark inside, pink tongue)
    for nm, spec in MOUTHS.items(): parts['mouth_' + nm] = draw_mouth(W, H, **spec)

    return rgba, parts


# ---------------------------------------------------------------- mouths
def _ell(cx, cy, rx, ry, n=40):
    import math
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


MOUTHS = {
    # top lip (left -> right) and bottom lip (right -> left) as bezier controls
    'ee': dict(top=[(281, 377), (305, 386), (360, 385), (392, 371)], bot=[(392, 371), (378, 401), (312, 407), (281, 377)], teeth=8, tongue=(338, 404, 22, 9)),
    'ah': dict(top=[(287, 379), (310, 383), (356, 383), (381, 378)], bot=[(381, 378), (378, 412), (296, 413), (287, 379)], teeth=0, tongue=(334, 407, 25, 10)),
    'aa': dict(top=[(293, 372), (315, 375), (352, 373), (375, 369)], bot=[(375, 369), (380, 420), (292, 423), (293, 372)], teeth=7, tongue=(334, 412, 23, 11)),
    'oh': dict(top=[(299, 386), (301, 366), (336, 365), (340, 386)], bot=[(340, 386), (340, 410), (300, 410), (299, 386)], teeth=0, tongue=(320, 404, 13, 6)),
    'miss': dict(top=[(292, 396), (308, 377), (358, 376), (378, 395)], bot=[(378, 395), (360, 402), (310, 403), (292, 396)], teeth=6, tongue=None),
    'hey': dict(top=[(281, 374), (310, 378), (362, 377), (392, 371)], bot=[(392, 371), (386, 418), (290, 420), (281, 374)], teeth=8, tongue=(337, 410, 27, 11)),
}


def draw_mouth(W, H, top, bot, teeth=0, tongue=None, line=6.5):
    path = P.bez(*top) + P.bez(*bot)[1:]
    shape = P.Paint(W, H); shape.poly(path, (255, 255, 255, 255))
    mask = np.array(shape.img)[..., 3]
    inner = P.Paint(W, H)
    inner.poly(path, '#6a1529')
    if teeth:
        band = P.bez(*top) + [(x, y + teeth) for x, y in reversed(P.bez(*top))]
        inner.poly(band, '#ffffff')
    if tongue:
        cx, cy, rx, ry = tongue
        inner.poly(_ell(cx, cy, rx, ry), '#ff6b80')
    big = np.array(inner.img); big[..., 3] = np.minimum(big[..., 3], mask)
    inner.img = Image.fromarray(big, 'RGBA'); inner.d = P.ImageDraw.Draw(inner.img)
    inner.line(path + [path[0]], line)
    return inner.result()


# ---------------------------------------------------------------- sneakers from BF + long jeans
SHOE_SRC, SHOE_DROP = '20', [1, 2, 3, 4]        # BF's idle body bitmap minus shirt, logo, arm, shorts
SHOE_K = 1.6                                    # BF art px -> picture px
SHOE_X = 335 - 170 * SHOE_K                     # BF x 170 (between his feet) under the body's middle
SHOE_Y = 1010 - 140 * SHOE_K                    # BF y 140 (shoe tops) at picture y 1010
PANTS = '#4f5873'
PANTS_SHADE = '#394058'


def bf2pic(x, y): return (SHOE_X + x * SHOE_K, SHOE_Y + y * SHOE_K)


def bf_sprite(name):
    base = os.path.join(FNF, 'shared/images/characters/bf')
    sm = json.load(open(os.path.join(base, 'spritemap1.json'), encoding='utf-8-sig'))
    im = Image.open(os.path.join(base, 'spritemap1.png')).convert('RGBA')
    for s in sm['ATLAS']['SPRITES']:
        S = s['SPRITE']
        if S['name'] == name: return np.array(im.crop((S['x'], S['y'], S['x'] + S['w'], S['y'] + S['h'])))
    raise KeyError(name)


def repaint_shoes(a):
    out = a.copy()
    rgb = a[..., :3].astype(float) / 255.0
    for y, x in zip(*np.nonzero(a[..., 3] > 0)):
        r, g, b = rgb[y, x]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        h *= 360
        if v < 0.28: continue                                         # outline
        if (h >= 330 or h <= 15) and s > 0.45:                        # red sneakers -> blue sneakers
            nr, ng, nb = colorsys.hsv_to_rgb(221 / 360, min(1, s * 0.82), min(1, v * 0.92))
        elif 270 <= h < 330 and s <= 0.45:                            # soles + laces (lilac white) -> clean white/grey
            nr, ng, nb = colorsys.hsv_to_rgb(228 / 360, s * 0.35, min(1, v * 1.01))
        else:
            continue
        out[y, x, :3] = (np.array([nr, ng, nb]) * 255).round()
    return out


def bf_shoes():
    a = bf_sprite(SHOE_SRC)
    rgb = a[..., :3].astype(int); al = a[..., 3]
    ink = (al > 8) & (rgb.max(2) < 70)
    paint = (al > 128) & ~ink
    lab, n = ndimage.label(paint)
    keep = (lab > 0) & ~np.isin(lab, SHOE_DROP)
    near = ndimage.distance_transform_edt(~keep)
    keep_all = keep | ((al > 8) & ~paint & (near <= 11))
    lab2, n2 = ndimage.label(keep_all)
    if n2 > 1:                                                        # loose ink scraps
        sz = ndimage.sum(np.ones_like(lab2), lab2, range(1, n2 + 1))
        keep_all &= np.isin(lab2, [i + 1 for i in range(n2) if sz[i] >= 400])
    b = a.copy(); b[..., 3] = np.where(keep_all, al, 0)
    return repaint_shoes(b)


def draw_pants(W, H):
    """Two jean legs from under the sweater into the sneakers, bunched at the bottom."""
    L_out = P.bez((252, 740), (246, 830), (214, 930), (186, 1004))
    L_cuff = P.smooth([(186, 1004), (222, 1019), (258, 1009), (296, 1024), (332, 1014)], 8)
    L_in = P.bez((332, 1014), (334, 960), (342, 905), (352, 874))
    R_in = P.bez((352, 874), (362, 912), (372, 975), (378, 1040))
    R_cuff = P.smooth([(378, 1040), (420, 1054), (462, 1044), (504, 1060), (544, 1040)], 8)
    R_out = P.bez((544, 1040), (522, 930), (490, 840), (480, 740))
    outline = L_out + L_cuff[1:] + L_in[1:] + R_in[1:] + R_cuff[1:] + R_out[1:]
    p = P.Paint(W, H)
    p.poly(outline, PANTS)
    # shade on the left of each leg (light comes from the right, like the sweater)
    p.poly(L_out + [(216, 1014), (238, 930), (266, 840), (276, 740)], PANTS_SHADE)
    p.poly(R_in + [(400, 1046), (386, 970), (372, 900), (360, 868)], PANTS_SHADE)
    # folds: bunching above the shoes + knee creases
    for f in ([(194, 968), (222, 958), (246, 974)], [(326, 958), (306, 944), (288, 948)], [(266, 884), (292, 896)],
              [(536, 988), (510, 974), (486, 986)], [(386, 970), (406, 956), (424, 958)], [(430, 876), (456, 890)]):
        p.line(P.smooth(f, 6), 6)
    p.line(outline, 9)
    return p.result()


# ---------------------------------------------------------------- rig + animations
HIPS = (340, 800)
CUFF = (360, 1012)                     # pants squash toward the shoes
PANTS_LEN = CUFF[1] - HIPS[1]
FEET = bf2pic(170, 247)
BONES = {
    'root': (None, FEET),
    'shoes': ('root', FEET),
    'pants': ('root', CUFF),
    'body': ('root', HIPS),
    'head': ('body', NECK),
    'arm': ('body', SHOULDER),
    'wrist': ('arm', WRIST),
}


def legs(sy=1.0, sx=1.0, body=None):
    """Pants squash/stretch toward the shoes; the body rides on top of them."""
    b = dict(body or {})
    b['dy'] = b.get('dy', 0) + (1 - sy) * PANTS_LEN
    return dict(pants=dict(sx=sx, sy=sy), body=b)


def pose(*ds):
    out = {}
    for d in ds:
        for k, v in d.items(): out.setdefault(k, {}).update(v)
    return out


# pose keys: (frame, pose) - poses give bones {rot, sx, sy, skx, dx, dy}; values hold until the next key (Animate on twos)
def anims():
    A = {}
    A['Idle'] = (14, 'smile', [
        (0, pose(legs(0.955, 1.03, dict(sx=1.02, sy=0.97)), dict(head=dict(dy=22, rot=-4), arm=dict(rot=5), wrist=dict(rot=6)))),
        (2, pose(legs(0.975, 1.015, dict(sx=1.01, sy=0.985)), dict(head=dict(dy=17, rot=-5), arm=dict(rot=4), wrist=dict(rot=4)))),
        (4, pose(legs(0.992, 1.004), dict(head=dict(dy=8, rot=-3), arm=dict(rot=2), wrist=dict(rot=2)))),
        (6, dict(head=dict(dy=1, rot=-0.5), arm=dict(rot=-1), wrist=dict(rot=-1))),
        (8, dict()),
    ])
    LEFT = [pose(dict(root=dict(dx=-46, skx=6), body=dict(rot=-4), head=dict(rot=-7, dx=-6), arm=dict(rot=-22), wrist=dict(rot=-22))),
            pose(dict(root=dict(dx=-38, skx=5), body=dict(rot=-3), head=dict(rot=-5, dx=-4), arm=dict(rot=-18), wrist=dict(rot=-17)))]
    RIGHT = [pose(dict(root=dict(dx=46, skx=-6), body=dict(rot=4), head=dict(rot=7, dx=5), arm=dict(rot=12), wrist=dict(rot=-20))),
             pose(dict(root=dict(dx=38, skx=-5), body=dict(rot=3), head=dict(rot=5, dx=3), arm=dict(rot=9), wrist=dict(rot=-14)))]
    UP = [pose(legs(1.08, 0.96, dict(sx=0.97, sy=1.06)), dict(head=dict(rot=-10, dy=-16), arm=dict(rot=-20), wrist=dict(rot=-32))),
          pose(legs(1.05, 0.975, dict(sx=0.985, sy=1.035)), dict(head=dict(rot=-8, dy=-11), arm=dict(rot=-17), wrist=dict(rot=-27)))]
    DOWN = [pose(legs(0.8, 1.09, dict(sx=1.05, sy=0.92)), dict(head=dict(rot=5, dy=20), arm=dict(rot=16), wrist=dict(rot=10))),
            pose(legs(0.85, 1.06, dict(sx=1.03, sy=0.95)), dict(head=dict(rot=4, dy=14), arm=dict(rot=13), wrist=dict(rot=8)))]
    for lab, keys, mouth in (('Left', LEFT, 'oh'), ('Down', DOWN, 'ah'), ('Up', UP, 'aa'), ('Right', RIGHT, 'ee')):
        A[lab] = (8, mouth, [(0, keys[0]), (2, keys[1])])
        # miss: same pose, pulled back with a flinch, tinted like BF's misses
        flinch = P.mix_pose(keys[1], {}, 0.35)
        hurt = P.mix_pose(flinch, dict(head=dict(rot=-6 if lab != 'Left' else 6, dy=10), body=dict(sy=0.97)), 1)
        A[lab + ' Miss'] = (24, 'miss', [(0, hurt), (2, P.mix_pose(hurt, dict(head=dict(dy=6)), 0.5)), (4, flinch)])
    A['Hey'] = (26, 'hey', [
        (0, pose(legs(1.04, 0.98, dict(sy=1.03)), dict(head=dict(rot=4, dy=-10), arm=dict(rot=-26), wrist=dict(rot=-40)))),
        (2, pose(legs(1.02, 0.99, dict(sy=1.015)), dict(head=dict(rot=3, dy=-7), arm=dict(rot=-23), wrist=dict(rot=-36)))),
        (4, dict(head=dict(rot=3, dy=-6), arm=dict(rot=-22), wrist=dict(rot=-34))),
    ])
    return A


ORDER = ('shoes', 'pants', 'sleeve', 'torso', 'head', 'MOUTH', 'hand')


def frames_for(rig, slots, spec, miss):
    n, mouth, keys = spec
    out = []
    for f in range(n):
        k = max(i for i, (kf, _) in enumerate(keys) if kf <= f)
        Wd = rig.world(keys[k][1])
        t = '_miss' if miss else ''
        fr = []
        for nm in ORDER:
            nm = 'mouth_' + mouth if nm == 'MOUTH' else nm
            bone, x0, y0, extra = slots[nm]
            fr.append((nm + t, P.mmul(Wd[bone], P.mmul(P.T(x0, y0), extra))))
        out.append(fr)
    return out


def build():
    global _parts_cache
    rgba, parts = build_parts()
    _parts_cache = (rgba, dict(parts))
    H, W = rgba.shape[:2]
    parts['pants'] = draw_pants(W, int(FEET[1]) + 40)
    sprites, slots = {}, {}
    for nm, im in parts.items():
        c, x0, y0 = P.crop_alpha(im)
        bone = {'torso': 'body', 'sleeve': 'arm', 'hand': 'wrist', 'pants': 'pants'}.get(nm, 'head')
        sprites[nm] = c; slots[nm] = (bone, x0, y0, P.M())
    c, x0, y0 = P.crop_alpha(bf_shoes())
    sprites['shoes'] = c
    slots['shoes'] = ('shoes', 0, 0, P.mmul(P.T(SHOE_X + x0 * SHOE_K, SHOE_Y + y0 * SHOE_K), P.M(SHOE_K, 0, 0, SHOE_K)))
    # misses: every piece pulled into BF's miss purple
    for nm in list(sprites): sprites[nm + '_miss'] = P.purple(sprites[nm]); slots[nm + '_miss'] = slots[nm]
    return sprites, slots


ANIM_ORDER = ['Idle', 'Left', 'Down', 'Up', 'Right', 'Left Miss', 'Down Miss', 'Up Miss', 'Right Miss', 'Hey']


def all_frames():
    sprites, slots = build()
    rig = P.Rig(BONES)
    A = anims()
    return sprites, [(lab, frames_for(rig, slots, A[lab], lab.endswith('Miss'))) for lab in ANIM_ORDER]


def render(sprites, frame, box=(-120, 0, 940, 1240), bg=(120, 130, 150, 255)):
    x0, y0, x1, y1 = box
    out = Image.new('RGBA', (x1 - x0, y1 - y0), bg)
    for nm, m in frame:
        im = Image.fromarray(sprites[nm], 'RGBA')
        a, b, c, d, tx, ty = P.mmul(P.T(-x0, -y0), m)
        det = a * d - b * c
        inv = (d / det, -c / det, (c * ty - d * tx) / det, -b / det, a / det, (b * tx - a * ty) / det)
        out.alpha_composite(im.transform(out.size, Image.AFFINE, inv, resample=Image.BICUBIC))
    return out


def icon(sprites, path):
    """Health icon (2 frames of 150x150: fine, losing) from his own head, with a fat icon outline."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet = Image.new('RGBA', (300, 150))
    for i, (mouth, rot) in enumerate((('smile', 0), ('miss', -8))):
        rgba, parts = _parts_cache
        H, W = rgba.shape[:2]
        im = Image.new('RGBA', (W, H))
        for nm in ('head', 'mouth_' + mouth): im.alpha_composite(Image.fromarray(parts[nm], 'RGBA'))
        im = im.rotate(rot, resample=Image.BICUBIC, center=NECK)
        a = np.array(im); c, _, _ = P.crop_alpha(a, 0)
        k = 136 / max(c.shape[:2])
        t = Image.fromarray(c, 'RGBA').resize((max(1, round(c.shape[1] * k)), max(1, round(c.shape[0] * k))), Image.LANCZOS)
        al = np.array(t)[..., 3] > 40
        ring = ndimage.binary_dilation(al, iterations=3) & ~al
        o = np.zeros((150, 150, 4), np.uint8)
        ox, oy = (150 - t.width) // 2, (150 - t.height) // 2 + 4
        o[oy:oy + t.height, ox:ox + t.width][ring] = (0, 0, 0, 255)
        oi = Image.fromarray(o, 'RGBA'); oi.alpha_composite(t, (ox, oy))
        sheet.alpha_composite(oi, (i * 150, 0))
    sheet.save(path)


_parts_cache = None


def write(out_root):
    sprites, seq = all_frames()
    d = os.path.join(out_root, 'shared/images/characters', ID)
    size = P.write_atlas(d, ID, sprites, seq)
    names = {'Idle': 'idle', 'Left': 'singLEFT', 'Down': 'singDOWN', 'Up': 'singUP', 'Right': 'singRIGHT',
             'Left Miss': 'singLEFTmiss', 'Down Miss': 'singDOWNmiss', 'Up Miss': 'singUPmiss', 'Right Miss': 'singRIGHTmiss', 'Hey': 'hey'}
    ch = {'version': '1.0.0', 'name': 'WRATH', 'renderType': 'animateatlas', 'assetPath': 'shared:characters/' + ID,
          'scale': SCALE, 'flipX': False, 'offsets': [0, 0], 'cameraOffsets': [0, 0], 'singTime': 8,
          'healthIcon': {'id': ID}, 'healthColor': '#4a78d0',
          'animations': [{'name': v, 'prefix': k} for k, v in names.items()]}
    icon(sprites, os.path.join(out_root, 'preload/images/icons', 'icon-' + ID + '.png'))
    cd = os.path.join(out_root, 'preload/data/characters'); os.makedirs(cd, exist_ok=True)
    json.dump(ch, open(os.path.join(cd, ID + '.json'), 'w'), indent=1)
    print('atlas', size, 'frames', sum(len(f) for _, f in seq))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview')
    ap.add_argument('--poses', help='render the key poses to this png')
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'own'))
    a = ap.parse_args()
    if a.poses:
        sprites, seq = all_frames()
        tiles = []
        for lab, frames in seq:
            for fi in sorted(set([0, 2, len(frames) - 1])):
                t = render(sprites, frames[fi]); t.thumbnail((360, 380)); tiles.append((lab + ' ' + str(fi), t))
        cols = 9; tw, th = tiles[0][1].size
        sheet = Image.new('RGB', (cols * tw, -(-len(tiles) // cols) * (th + 16)), (60, 60, 70))
        from PIL import ImageDraw
        dr = ImageDraw.Draw(sheet)
        for k, (lab, t) in enumerate(tiles):
            x, y = (k % cols) * tw, (k // cols) * (th + 16)
            sheet.paste(t.convert('RGB'), (x, y + 16)); dr.text((x + 4, y + 2), lab, fill=(255, 255, 255))
        sheet.save(a.poses)
    elif not a.preview:
        write(a.out)
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
        rgba, parts = build_parts()
        H, W = rgba.shape[:2]
        for nm, im in list(parts.items()) + [('shoes', bf_shoes())]:
            b = Image.new('RGBA', (im.shape[1], im.shape[0]), (120, 130, 150, 255)); b.alpha_composite(Image.fromarray(im, 'RGBA'))
            c, x0, y0 = P.crop_alpha(im, 6)
            b.crop((x0, y0, x0 + c.shape[1], y0 + c.shape[0])).convert('RGB').save(os.path.join(a.preview, nm + '.png'))
