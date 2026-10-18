"""Character select pictures, lighter (PRIVATE build only, written to the git-ignored build/own folder).

FNF's 'locked' static TV guy (charSelect/lockedChill) is one 8192x2639 sprite sheet: 86 MB once decoded,
a big hitch on a 2 GB graphics card for something that only shows on locked slots. Every piece is cut out,
turned upright, shrunk to half size and packed again; each piece's matrix in the animation grows by the same
amount, so it draws exactly as big as before (just a little softer: it's TV static anyway).

  python3 tools/own/charsel.py
"""
import json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FA = os.environ.get('FA', '/home/user/ref/fa')


def half_atlas(src, dst, scale=0.5, sheet_w=4096):
    anim = json.load(open(os.path.join(src, 'Animation.json'), encoding='utf-8-sig'))
    sm = json.load(open(os.path.join(src, 'spritemap1.json'), encoding='utf-8-sig'))
    img = np.asarray(Image.open(os.path.join(src, sm['meta']['image'] if 'meta' in sm else 'spritemap1.png')).convert('RGBA'))
    pieces, factor = [], {}
    for e in sm['ATLAS']['SPRITES']:
        s = e['SPRITE']
        r = img[s['y']:s['y'] + s['h'], s['x']:s['x'] + s['w']]
        if s.get('rotated'): r = np.rot90(r, 1)          # stored turned: stand it upright (as the renderer draws it)
        eh, ew = r.shape[:2]
        w2, h2 = max(1, math.ceil(ew * scale)), max(1, math.ceil(eh * scale))
        p = Image.fromarray(np.ascontiguousarray(r)).resize((w2, h2), Image.LANCZOS)
        pieces.append((s['name'], p))
        factor[s['name']] = (ew / w2, eh / h2)
    # shelf packing, tallest first, 1 px gaps
    order = sorted(pieces, key=lambda t: -t[1].height)
    x = y = shelf = 0; spots = {}
    for name, p in order:
        if x + p.width > sheet_w: x = 0; y += shelf + 1; shelf = 0
        spots[name] = (x, y); x += p.width + 1; shelf = max(shelf, p.height)
    H = y + shelf
    sheet = Image.new('RGBA', (sheet_w, H), (0, 0, 0, 0))
    sprites = []
    for name, p in pieces:
        sx, sy = spots[name]; sheet.paste(p, (sx, sy))
        sprites.append({'SPRITE': {'name': name, 'x': sx, 'y': sy, 'w': p.width, 'h': p.height, 'rotated': False}})
    # every use of a piece: its matrix grows by the shrink factor (columns scaled: M' = M * diag(fx, fy))
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('ASI', 'ATLAS_SPRITE_instance') and isinstance(v, dict):
                    fx, fy = factor.get(v.get('N') or v.get('name'), (1, 1))
                    m = v.get('M3D') or v.get('Matrix3D')
                    if isinstance(m, list): m[0] *= fx; m[1] *= fx; m[4] *= fy; m[5] *= fy
                    elif isinstance(m, dict): m['m00'] *= fx; m['m01'] *= fx; m['m10'] *= fy; m['m11'] *= fy
                    elif 'MX' in v: v['MX'][0] *= fx; v['MX'][1] *= fx; v['MX'][2] *= fy; v['MX'][3] *= fy
                else: walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(anim)
    os.makedirs(dst, exist_ok=True)
    sheet.save(os.path.join(dst, 'spritemap1.png'))
    meta = dict(sm.get('meta', {})); meta['size'] = {'w': sheet_w, 'h': H}; meta['image'] = 'spritemap1.png'
    json.dump({'ATLAS': {'SPRITES': sprites}, 'meta': meta}, open(os.path.join(dst, 'spritemap1.json'), 'w'))
    json.dump(anim, open(os.path.join(dst, 'Animation.json'), 'w'), separators=(',', ':'))
    return img.shape[1] * img.shape[0] * 4, sheet_w * H * 4


def main():
    src = os.path.join(FA, 'preload', 'images', 'charSelect', 'lockedChill')
    dst = os.path.join(ROOT, 'build', 'own', 'preload', 'images', 'charSelect', 'lockedChill')
    a, b = half_atlas(src, dst)
    print('lockedChill %d MB -> %d MB' % (a / 1e6, b / 1e6))


if __name__ == '__main__':
    main()
