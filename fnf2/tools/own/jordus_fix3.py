"""Jordus fix pass 3 (11-05: "looks glitchy/broken, doesn't look like her"), on the built sprite sheets.
  1. her IDLE was cut from a far shot: 25% smaller than her singing poses (she grew + shrank) -> idle x1.25
  2. her idle had no legs (the video's bottom bar hid them) -> her own legs + shoes from her UP pose, behind the skirt
  3. stage bits stuck on both girls (the skate ramp's edge lines, the black stick next to Jordus, bits off to the
     side) -> thin dark lines + pieces not joined to the girl are taken off, every frame
  python3 tools/own/jordus_fix3.py <folder with player.xml/png + opp.xml/png>   (writes them back in place)"""
import os, re, sys, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy import ndimage
D = sys.argv[1]
IDLE_K = 1.25

def load(base):
    root = ET.parse(os.path.join(D, base + '.xml')).getroot(); pages = {}; out = []
    for st in root.iter('SubTexture'):
        a = dict(st.attrib); pg = a.get('page')
        if pg not in pages: pages[pg] = Image.open(os.path.join(D, base + ('~' + pg if pg else '') + '.png')).convert('RGBA')
        x, y, w, h = int(a['x']), int(a['y']), int(a['width']), int(a['height'])
        fw, fh = int(a.get('frameWidth', w)), int(a.get('frameHeight', h))
        full = np.zeros((fh, fw, 4), np.uint8)
        im = np.array(pages[pg].crop((x, y, x + w, y + h)))
        fx, fy = -int(a.get('frameX', 0)), -int(a.get('frameY', 0))
        full[fy:fy + h, fx:fx + w] = im[:max(0, min(h, fh - fy)), :max(0, min(w, fw - fx))]
        out.append([a['name'], full])
    return out, pages

def clean(f):
    """thin dark lines + bits not joined to the girl go"""
    al = f[..., 3] > 40
    if not al.any(): return f
    rgb = f[..., :3].astype(int); dark = rgb.max(-1) < 90
    opened = ndimage.binary_opening(al, structure=np.ones((7, 7)))
    thin = al & ~opened
    lab, n = ndimage.label(thin & dark)
    kill = np.zeros_like(al)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None: continue
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if max(hh, ww) >= 22 and (lab[sl] == i).sum() >= 25: kill[sl] |= lab[sl] == i
    # thicker STRAIGHT dark sticks (the ramp's top edge next to Jordus): long + very thin for their length
    thin2 = al & ~ndimage.binary_opening(al, structure=np.ones((19, 19)))
    lab2, n2 = ndimage.label(thin2 & dark)
    for i, sl in enumerate(ndimage.find_objects(lab2), 1):
        if sl is None: continue
        ys, xs = np.where(lab2[sl] == i)
        if len(xs) < 120: continue
        c = np.cov(np.stack([xs, ys]).astype(float)); ev = np.sort(np.linalg.eigvalsh(c))
        length = 4 * np.sqrt(max(ev[1], 1e-6))
        if length >= 80 and np.sqrt(ev[1] / max(ev[0], 1e-6)) >= 5.5: kill[sl] |= lab2[sl] == i
    # (a stick that touches her hair's outline joins it: find long straight runs in the thin dark bits instead)
    import cv2
    td = ((thin2 & dark & ~kill).astype(np.uint8)) * 255
    segs = cv2.HoughLinesP(td, 1, np.pi / 180, threshold=40, minLineLength=70, maxLineGap=6)
    if segs is not None:
        lm = np.zeros(td.shape, np.uint8)
        for x1, y1, x2, y2 in segs.reshape(-1, 4): cv2.line(lm, (int(x1), int(y1)), (int(x2), int(y2)), 255, 13)
        kill |= (lm > 0) & thin2 & dark
    al2 = al & ~kill
    # pieces not joined to the main body (after cutting thin links): only the big ones stay
    core = ndimage.binary_opening(al2, structure=np.ones((5, 5)))
    lab, n = ndimage.label(core)
    if n > 1:
        sizes = ndimage.sum(core, lab, range(1, n + 1)); big = sizes.max()
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= big * 0.04])
        al2 &= ndimage.binary_dilation(keep, iterations=4)
    out = f.copy(); out[~al2] = 0
    return out

def bbox(a):
    ys, xs = np.where(a[..., 3] > 40); return xs.min(), ys.min(), xs.max(), ys.max()

def write(base, frames):
    # shelf-pack every frame (trimmed) into pages of up to 2048 x 2048, like the old sheets
    items = []
    for name, f in frames:
        if (f[..., 3] > 0).any():
            x0, y0, x1, y1 = bbox(f) if (f[..., 3] > 40).any() else (0, 0, 1, 1)
        else: x0, y0, x1, y1 = 0, 0, 1, 1
        items.append((name, f[y0:y1 + 1, x0:x1 + 1], x0, y0, f.shape[1], f.shape[0]))
    MAXW = 2048; pages = []; place = {}
    cur = []; x = y = rowh = 0; pw = ph = 0
    for name, t, fx, fy, fw, fh in items:
        h, w = t.shape[:2]
        if x + w > MAXW: x = 0; y += rowh + 2; rowh = 0
        if y + h > 2048: pages.append((cur, pw, ph)); cur = []; x = y = rowh = 0; pw = ph = 0
        cur.append((name, t, x, y, fx, fy, fw, fh)); x += w + 2; rowh = max(rowh, h); pw = max(pw, x); ph = max(ph, y + h)
    if cur: pages.append((cur, pw, ph))
    for fn in os.listdir(D):
        if re.match(re.escape(base) + r'(~\d+)?\.png$', fn): os.remove(os.path.join(D, fn))
    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="sheet.png">']
    for pi, (cur, pw, ph) in enumerate(pages):
        sheet = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        for name, t, x, y, fx, fy, fw, fh in cur:
            sheet.paste(Image.fromarray(t), (x, y))
            lines.append(f'  <SubTexture name="{name}" x="{x}" y="{y}" width="{t.shape[1]}" height="{t.shape[0]}" frameX="{-fx}" frameY="{-fy}" frameWidth="{fw}" frameHeight="{fh}"' + (f' page="{pi}"' if pi else '') + '/>')
        sheet.save(os.path.join(D, base + ('~' + str(pi) if pi else '') + '.png'), optimize=True)
    lines.append('</TextureAtlas>')
    open(os.path.join(D, base + '.xml'), 'w').write('\n'.join(lines) + '\n')
    print(base, len(items), 'frames in', len(pages), 'pages')

# ---------------------------------------------------------------- the cap girl: clean only
opp, _ = load('opp')
write('opp', [(n, clean(f)) for n, f in opp])

# ---------------------------------------------------------------- Jordus
pl, _ = load('player')
F = {n: f for n, f in pl}
up = clean(F['singUP_0000'])
# her legs in the UP pose: everything under the skirt's hem (the lowest rows of the pink/white pleats)
ux0, uy0, ux1, uy1 = bbox(up)
rgb = up[..., :3].astype(int)
skirt = (rgb[..., 0] > 200) & (rgb[..., 2] > 150) & (rgb[..., 1] > 120) & (up[..., 3] > 200)   # white-pink pleats
rows = np.where(skirt[:, ux0:ux1 + 1].sum(1) > 25)[0]
hem_up = int(rows.max()) if len(rows) else uy1 - 85
legs = up.copy(); legs[:hem_up - 14] = 0
lx = np.where(legs[..., 3] > 40)[1]; legs_cx = (lx.min() + lx.max()) / 2
print('UP pose: hem at', hem_up, 'feet at', uy1)
out = []
for name, f in pl:
    if not name.startswith('idle_'): out.append((name, clean(f))); continue
    g = clean(f)
    x0, y0, x1, y1 = bbox(g)
    # the bottom bar's straight cut: drop the last rows (cut-off legs), keep down to the hem
    r = g[..., :3].astype(int)
    sk = (r[..., 0] > 200) & (r[..., 2] > 150) & (r[..., 1] > 120) & (g[..., 3] > 200)
    rows = np.where(sk[:, x0:x1 + 1].sum(1) > 15)[0]
    hem = int(rows.max()) if len(rows) else y1 - 18
    g[hem + 3:] = 0
    cx = (x0 + x1) / 2
    # x1.25 around the hem's middle, the hem landing where the UP pose's hem is
    H, W = g.shape[:2]
    big = np.array(Image.fromarray(g).resize((int(W * IDLE_K), int(H * IDLE_K)), Image.LANCZOS))
    ox, oy = int(round(legs_cx - cx * IDLE_K)), int(round(hem_up - hem * IDLE_K))
    canvas = np.zeros_like(g)
    # legs first (behind), under the middle of her skirt
    canvas[:] = legs
    sx0, sy0 = max(0, -ox), max(0, -oy); dx0, dy0 = max(0, ox), max(0, oy)
    w = min(big.shape[1] - sx0, W - dx0); h = min(big.shape[0] - sy0, H - dy0)
    top = big[sy0:sy0 + h, sx0:sx0 + w].astype(np.float32); bot = canvas[dy0:dy0 + h, dx0:dx0 + w].astype(np.float32)
    a = top[..., 3:4] / 255.0
    comp = top * a + bot * (1 - a); comp[..., 3] = np.maximum(top[..., 3], bot[..., 3])
    canvas[dy0:dy0 + h, dx0:dx0 + w] = np.clip(comp, 0, 255).astype(np.uint8)
    out.append((name, clean(canvas)))      # (again at the new size: the stick next to her fist)
write('player', out)
