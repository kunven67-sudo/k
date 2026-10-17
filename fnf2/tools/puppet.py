"""FNF 2 puppet tools: turn a drawing into cut-out parts and an Animate atlas.

Real FNF characters (BF, Pico...) are Adobe Animate atlases: separate pieces
(head, face, body, arms) moved by matrices every frame. These helpers do the
same for our own characters:

  * cut a flat drawing into parts (by colour regions + seed points),
    giving each black outline to the right part,
  * paint the bits that hide behind other parts (neck under the head...),
  * pose the parts on a simple bone tree and bake every frame into an
    Animation.json + spritemap that G.Atlas (03-gfx.js) plays like BF's.

Source drawings and the made atlases stay in git-ignored folders
(fnf2/private, fnf2/build) - only this code is committed.
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

INK_V = 70        # max(r,g,b) below this = black ink line


# ------------------------------------------------------------------ loading
def matte_white(path, extra_bg=()):
    """Flat drawing on white -> RGBA. White connected to the border (and any
    extra_bg seed points, e.g. a gap between an arm and the body) becomes
    transparent; anti-aliased outline pixels next to it fade properly."""
    im = np.array(Image.open(path).convert('RGB')).astype(float)
    H, W, _ = im.shape
    mx, mn = im.max(2), im.min(2)
    white = (mn > 225) & (mx - mn < 30)
    lab, _ = ndimage.label(white)
    ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    for x, y in extra_bg:
        if lab[y, x]: ids.add(lab[y, x])
    bg = np.isin(lab, list(ids))
    band = ndimage.binary_dilation(bg, iterations=3) & ~bg
    a = np.ones((H, W)); a[bg] = 0
    rgb = im.copy()
    gray = band & (mx - mn < 40)
    a[gray] = np.clip(1 - mx[gray] / 255.0, 0, 1)
    rgb[gray] = 0
    col = band & ~gray
    aa = np.maximum(np.clip(1 - mn[col] / 255.0, 0, 1), 0.01)
    for c in range(3):
        ch = rgb[..., c]; ch[col] = np.clip((ch[col] - (1 - aa) * 255) / aa, 0, 255)
    a[col] = np.clip(aa * 1.6, 0, 1)
    return np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ------------------------------------------------------------------ cutting
class Cutter:
    """Split an RGBA drawing into named parts.

    parts = {name: [(x, y) seed points inside its colour regions]}
    priority = part names in order: an outline between two parts goes to the
    first one (the part drawn on top), so moving parts never show a
    stray line from the part underneath.
    """
    def __init__(self, rgba, parts, priority, force=None, reach=12):
        self.rgba = rgba
        H, W = rgba.shape[:2]
        rgb, a = rgba[..., :3].astype(int), rgba[..., 3]
        solid = a > 8
        self.ink = solid & (rgb.max(2) < INK_V)
        paint = (a > 128) & ~self.ink
        lab, n = ndimage.label(paint)
        owner = np.full(n + 1, -1)
        names = list(parts)
        for pi, nm in enumerate(names):
            for x, y in parts[nm]:
                if lab[y, x] == 0: raise ValueError(f'seed {nm} {(x, y)} is not on paint')
                owner[lab[y, x]] = pi
        # unseeded small regions (glints, specks) join the nearest seeded paint
        seeded = owner[lab] >= 0
        seeded[lab == 0] = False
        _, (iy, ix) = ndimage.distance_transform_edt(~seeded, return_indices=True)
        reg_owner = owner.copy()
        for r in range(1, n + 1):
            if owner[r] >= 0: continue
            ys, xs = np.nonzero(lab == r)
            reg_owner[r] = owner[lab[iy[ys[0], xs[0]], ix[ys[0], xs[0]]]]
        pmask = {nm: np.isin(lab, np.nonzero(reg_owner == pi)[0]) & (lab > 0) for pi, nm in enumerate(names)}
        # outlines: within `reach` of a part's paint -> candidates; take the top part
        dist = {nm: ndimage.distance_transform_edt(~pmask[nm]) for nm in names}
        rest = solid & ~paint
        assigned = np.zeros((H, W), bool)
        masks = {nm: pmask[nm].copy() for nm in names}
        for nm in priority:
            m = rest & ~assigned & (dist[nm] <= reach)
            masks[nm] |= m; assigned |= m
        # what's left (thick dark areas like a mic handle): nearest part
        left = rest & ~assigned
        if left.any():
            stack = np.stack([dist[nm] for nm in names])
            near = stack.argmin(0)
            for pi, nm in enumerate(names): masks[nm] |= left & (near == pi)
        for nm, poly in (force or {}).items():
            fm = poly_mask((H, W), poly) & solid
            for o in names: masks[o] &= ~fm
            masks[nm] |= fm
        self.masks = masks
        self.paint_masks = pmask

    def part(self, name):
        out = self.rgba.copy()
        out[..., 3] = np.where(self.masks[name], out[..., 3], 0)
        return out


def poly_mask(shape, poly):
    img = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(img).polygon([tuple(p) for p in poly], fill=255)
    return np.array(img) > 0


# ------------------------------------------------------------------ painting (supersampled, smooth edges)
class Paint:
    """Draw shapes at 4x and paste them down smoothly onto an RGBA array."""
    S = 4

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new('RGBA', (w * self.S, h * self.S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def _p(self, pts): return [(x * self.S, y * self.S) for x, y in pts]

    def poly(self, pts, fill):
        self.d.polygon(self._p(pts), fill=fill if isinstance(fill, tuple) else hexrgb(fill) + (255,))

    def line(self, pts, width, fill='#000000'):
        f = hexrgb(fill) + (255,)
        P = self._p(pts); w = int(width * self.S)
        self.d.line(P, fill=f, width=w, joint='curve')
        r = w / 2
        for x, y in (P[0], P[-1]): self.d.ellipse([x - r, y - r, x + r, y + r], fill=f)

    def result(self):
        return np.array(self.img.resize((self.w, self.h), Image.LANCZOS))


def bez(p0, p1, p2, p3=None, n=24):
    """Quadratic (3 pts) or cubic (4 pts) bezier as a polyline."""
    out = []
    for i in range(n + 1):
        t = i / n
        if p3 is None:
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        else:
            x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
            y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
        out.append((x, y))
    return out


def smooth(pts, n=8):
    """Catmull-Rom curve through the points (open path)."""
    pts = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-2])
    return out


def purple(rgba, keep=0.32):
    """FNF miss look: every colour pulled into a purple ramp (outlines stay black)."""
    out = rgba.copy().astype(float)
    lum = out[..., 0] * 0.3 + out[..., 1] * 0.59 + out[..., 2] * 0.11
    t = (lum / 255.0)[..., None]
    lo, hi = np.array([34, 16, 62], float), np.array([222, 205, 255], float)
    ramp = lo + (hi - lo) * t
    out[..., :3] = out[..., :3] * keep + ramp * (1 - keep)
    return out.clip(0, 255).astype(np.uint8)


def over(dst, src):
    """Alpha-composite RGBA array src over dst (same size), returns new array."""
    a = Image.fromarray(dst, 'RGBA'); a.alpha_composite(Image.fromarray(src, 'RGBA'))
    return np.array(a)


def under(dst, src):
    return over(src, dst)


def crop_alpha(rgba, pad=2):
    """-> (cropped array, x0, y0) trimmed to its visible pixels."""
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    if not len(xs): return rgba[:1, :1], 0, 0
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(rgba.shape[1], xs.max() + 1 + pad), min(rgba.shape[0], ys.max() + 1 + pad)
    return rgba[y0:y1, x0:x1], x0, y0


def tint(rgba, color, amount):
    """Multiply-tint toward a colour (FNF misses go purple-dark)."""
    out = rgba.copy().astype(float)
    c = np.array(hexrgb(color), float) / 255.0
    out[..., :3] = out[..., :3] * ((1 - amount) + amount * c)
    return out.clip(0, 255).astype(np.uint8)


# ------------------------------------------------------------------ matrices (Animate 2x3: a b c d tx ty)
def M(a=1, b=0, c=0, d=1, tx=0, ty=0): return [a, b, c, d, tx, ty]
def mmul(p, l):
    return [p[0] * l[0] + p[2] * l[1], p[1] * l[0] + p[3] * l[1], p[0] * l[2] + p[2] * l[3], p[1] * l[2] + p[3] * l[3],
            p[0] * l[4] + p[2] * l[5] + p[4], p[1] * l[4] + p[3] * l[5] + p[5]]
def T(x, y): return M(tx=x, ty=y)


def local(pivot, rot=0, sx=1, sy=1, skx=0, dx=0, dy=0):
    """Transform about a pivot: move to pivot, scale/skew/rotate, move back, then shift."""
    r = math.radians(rot); k = math.tan(math.radians(skx))
    A = mmul(M(math.cos(r), math.sin(r), -math.sin(r), math.cos(r)), mmul(M(1, 0, k, 1), M(sx, 0, 0, sy)))
    return mmul(T(pivot[0] + dx, pivot[1] + dy), mmul(A, T(-pivot[0], -pivot[1])))


# ------------------------------------------------------------------ rig + atlas
class Rig:
    """Bones: name -> (parent, pivot). Every drawable piece hangs on a bone.
    A pose gives each bone {rot, sx, sy, skx, dx, dy} about its pivot; the
    child bones follow their parents, like Animate symbols inside symbols."""
    def __init__(self, bones):
        self.bones = bones

    def world(self, pose):
        out = {}
        def get(n):
            if n in out: return out[n]
            parent, piv = self.bones[n]
            p = pose.get(n, {})
            m = local(piv, p.get('rot', 0), p.get('sx', 1), p.get('sy', 1), p.get('skx', 0), p.get('dx', 0), p.get('dy', 0))
            if parent: m = mmul(get(parent), m)
            out[n] = m; return m
        for n in self.bones: get(n)
        return out


def ease(t, kind='out'):
    if kind == 'in': return t * t
    if kind == 'inout': return t * t * (3 - 2 * t)
    if kind == 'back':
        c = 1.70158; t -= 1; return 1 + (c + 1) * t ** 3 + c * t * t
    return 1 - (1 - t) ** 2


def mix_pose(a, b, t):
    out = {}
    for n in set(a) | set(b):
        pa, pb = a.get(n, {}), b.get(n, {})
        q = {}
        for k in set(pa) | set(pb):
            d = 1 if k in ('sx', 'sy') else 0
            q[k] = pa.get(k, d) + (pb.get(k, d) - pa.get(k, d)) * t
        out[n] = q
    return out


def pack_sprites(images, pad=2, max_w=2048):
    """Shelf-pack named RGBA arrays into one sheet -> (sheet array, {name: (x, y, w, h)})."""
    items = sorted(images.items(), key=lambda kv: -kv[1].shape[0])
    x = y = shelf = 0; pos = {}
    area = sum((im.shape[0] + pad) * (im.shape[1] + pad) for _, im in items)
    W = min(max_w, max(max(im.shape[1] for _, im in items) + pad, int(area ** 0.5 * 1.2), 256))
    for nm, im in items:
        h, w = im.shape[:2]
        if x + w + pad > W: x = 0; y += shelf + pad; shelf = 0
        pos[nm] = (x, y, w, h); x += w + pad; shelf = max(shelf, h)
    H = y + shelf + pad
    sheet = np.zeros((H, W, 4), np.uint8)
    for nm, im in items:
        px, py, w, h = pos[nm]; sheet[py:py + h, px:px + w] = im
    return sheet, pos


def write_atlas(out_dir, name, sprites, anims, fps=24):
    """sprites: {sprite name: RGBA array}
    anims: list of (label, frames); frames = list of [ (sprite name, matrix), ... bottom to top ]
    Writes Animation.json + spritemap1.json/png in the real Animate export format."""
    os.makedirs(out_dir, exist_ok=True)
    sheet, pos = pack_sprites(sprites)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(out_dir, 'spritemap1.png'), optimize=True)
    sm = {'ATLAS': {'SPRITES': [{'SPRITE': {'name': n, 'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3], 'rotated': False}} for n, p in pos.items()]},
          'meta': {'app': 'fnf2 puppet.py', 'image': 'spritemap1.png', 'format': 'RGBA8888', 'size': {'w': sheet.shape[1], 'h': sheet.shape[0]}, 'resolution': '1'}}
    json.dump(sm, open(os.path.join(out_dir, 'spritemap1.json'), 'w'), separators=(',', ':'))
    # one layer per drawing slot (top slot = layer 0, like Animate), one keyframe per frame
    depth = max(len(f) for _, frames in anims for f in frames)
    label_frames, layers = [], [[] for _ in range(depth)]
    i = 0
    for label, frames in anims:
        label_frames.append({'I': i, 'DU': len(frames), 'N': label, 'E': []})
        for f in frames:
            for slot in range(depth):
                els = []
                if slot < len(f):
                    sn, m = f[slot]
                    els.append({'ASI': {'N': sn, 'MX': [round(v, 4) for v in m]}})
                layers[slot].append({'I': i, 'DU': 1, 'E': els})
            i += 1
    L = [{'LN': 'labels', 'FR': label_frames}] + [{'LN': f'part{s}', 'FR': layers[s]} for s in reversed(range(depth))]
    anim = {'AN': {'N': name, 'SN': name, 'TL': {'L': L}}, 'SD': {'S': []}, 'MD': {'FRT': fps}}
    json.dump(anim, open(os.path.join(out_dir, 'Animation.json'), 'w'), separators=(',', ':'))
    return sheet.shape
