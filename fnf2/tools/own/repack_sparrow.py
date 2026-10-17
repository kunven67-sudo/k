"""Make a smaller copy of a Sparrow sheet: keep only some animations, trim every frame to its
pixels, drop exact duplicate frames, scale everything down, and pack it tight again.
The XML keeps frameX/frameY/frameWidth/frameHeight (scaled), so frames still line up the same;
draw the sprite at (old scale / factor) to get the same size on screen.

  python3 repack_sparrow.py in.png in.xml out_base --keep "unhype idle,hype idle" --scale 0.5
"""
import argparse, hashlib, re
import numpy as np
from PIL import Image


def frames_of(xml):
    out = []
    for m in re.finditer(r'<SubTexture\b([^>]*)/?>', xml):
        a = dict(re.findall(r'([\w:-]+)="([^"]*)"', m.group(1)))
        f = {k: float(a[k]) for k in ('x', 'y', 'width', 'height') if k in a}
        f['name'] = a['name']; f['rot'] = a.get('rotated') == 'true'
        if 'frameX' in a:
            f['fx'], f['fy'] = -float(a['frameX']), -float(a['frameY'])
            f['fw'], f['fh'] = float(a['frameWidth']), float(a['frameHeight'])
        else:
            f['fx'] = f['fy'] = 0.0; f['fw'], f['fh'] = f['width'], f['height']
        out.append(f)
    return out


def repack(png, xml_path, out_base, keep=None, scale=0.5, pad=2, max_w=None):
    img = Image.open(png).convert('RGBA')
    xml = open(xml_path, encoding='utf-8-sig').read()
    frames = [f for f in frames_of(xml) if not keep or any(f['name'].startswith(k) for k in keep)]
    pieces, by_hash, entries = [], {}, []
    for f in frames:
        x, y, w, h = int(f['x']), int(f['y']), int(f['width']), int(f['height'])
        cut = img.crop((x, y, x + w, y + h))
        if f['rot']: cut = cut.transpose(Image.ROTATE_90)
        a = np.asarray(cut)[..., 3]
        ys, xs = np.nonzero(a > 0)
        if len(xs):
            bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        else:
            bx0 = by0 = 0; bx1 = by1 = 1
        # trimmed + scaled; offsets snapped so the scaled frame lands where the original did
        ox, oy = f['fx'] + bx0, f['fy'] + by0
        sx0, sy0 = int(np.floor(ox * scale)), int(np.floor(oy * scale))
        sx1, sy1 = int(np.ceil((f['fx'] + bx1) * scale)), int(np.ceil((f['fy'] + by1) * scale))
        tw, th = max(1, sx1 - sx0), max(1, sy1 - sy0)
        # resample from a slightly larger source box so the snapped box matches exactly
        M = int(np.ceil(2 / scale)) + 2       # transparent margin: the snapped box can poke past the cut
        padded = Image.new('RGBA', (cut.width + 2 * M, cut.height + 2 * M), (0, 0, 0, 0)); padded.paste(cut, (M, M))
        src = (sx0 / scale - f['fx'] + M, sy0 / scale - f['fy'] + M, sx1 / scale - f['fx'] + M, sy1 / scale - f['fy'] + M)
        if scale == 1 and all(float(v).is_integer() for v in src):
            small = padded.crop(tuple(int(v) for v in src))          # same size: a plain cut, pixel for pixel
        else:
            small = padded.resize((tw, th), Image.LANCZOS, box=src)
        key = hashlib.sha1(small.tobytes() + bytes(str((tw, th)), 'ascii')).hexdigest()
        if key not in by_hash:
            by_hash[key] = len(pieces); pieces.append(small)
        entries.append((f, by_hash[key], sx0, sy0))
    # shelf pack, tallest first; try a few sheet widths and keep the smallest sheet
    order = sorted(range(len(pieces)), key=lambda i: -pieces[i].size[1])
    def shelf(mw):
        pos, x, y, row_h, W = {}, 0, 0, 0, 0
        for i in order:
            w, h = pieces[i].size
            if x + w + pad > mw: x, y, row_h = 0, y + row_h + pad, 0
            pos[i] = (x, y); x += w + pad; row_h = max(row_h, h); W = max(W, x)
        return pos, W, y + row_h
    widest = max(p.size[0] for p in pieces) + pad
    if max_w is None:
        area = sum((p.size[0] + pad) * (p.size[1] + pad) for p in pieces)
        tries = sorted({max(widest, int(area ** 0.5 * k)) for k in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0)})
        best = None
        for mw in tries:
            pos, W, H = shelf(mw)
            if max(W, H) > 8192: continue
            if best is None or W * H < best[1] * best[2]: best = (pos, W, H)
        pos, W, H = best or shelf(max(widest, int(area ** 0.5)))
    else:
        pos, W, H = shelf(max_w)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for i, p in pos.items(): sheet.paste(pieces[i], p)
    sheet.save(out_base + '.png')
    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="%s.png">' % out_base.split('/')[-1]]
    for f, i, sx0, sy0 in entries:
        px, py = pos[i]; w, h = pieces[i].size
        fw, fh = int(np.ceil(f['fw'] * scale)), int(np.ceil(f['fh'] * scale))
        lines.append('\t<SubTexture name="%s" x="%d" y="%d" width="%d" height="%d" frameX="%d" frameY="%d" frameWidth="%d" frameHeight="%d"/>'
                     % (f['name'], px, py, w, h, -sx0, -sy0, fw, fh))
    lines.append('</TextureAtlas>')
    open(out_base + '.xml', 'w').write('\n'.join(lines) + '\n')
    return sheet.size, len(entries), len(pieces)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('png'); ap.add_argument('xml'); ap.add_argument('out')
    ap.add_argument('--keep', default=''); ap.add_argument('--scale', type=float, default=0.5)
    a = ap.parse_args()
    print(repack(a.png, a.xml, a.out, [k for k in a.keep.split(',') if k], a.scale))
