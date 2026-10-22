"""New main menu words made from the real FNF menu letters (PRIVATE build only, written to the git-ignored
build/own folder, never the repo).

Every letter is cut out of FNF's own main menu sheets (STORY MODE, FREEPLAY, OPTIONS, CREDITS), with its own
hand-inked outline (idle = black letters, white outline; selected = white letters, thick black outline), then
the letters are put back together into a new word. Letters FNF never drew are built from parts of real ones
(K = the R's stem + its leg, plus the leg flipped up for the top arm).

  RANK MODE -> preload/images/mainmenu/rankmode.png/.xml ('rankmode idle' x9, 'rankmode selected' x3)
  PRO MODE  -> preload/images/mainmenu/promode.png/.xml (same)

  python3 tools/own/menu_word.py [rankmode,promode]
"""
import os, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FA = os.environ.get('FA', '/home/user/ref/fa')
SRC = os.path.join(FA, 'preload', 'images', 'mainmenu')
OUT = os.path.join(ROOT, 'build', 'own', 'preload', 'images', 'mainmenu')

# letter -> (source word, index of the letter's fill blob in that word, counted left to right)
LETTERS = {
    'R': ('freeplay', 1), 'A': ('freeplay', -2), 'N': ('options', -2),
    'M': ('storymode', 5), 'O': ('storymode', 6), 'D': ('storymode', 7), 'E': ('storymode', 8),
    'P': ('freeplay', 4),
}


# letters that need more than a plain cut: ch -> fn(letter, kind) (other tools add to it)
SPECIAL = {}

# idle letters FNF drew too small/squashed: drawn from the selected letter's shape instead (scale)
FROM_SELECTED = {'A': 0.66, 'P': 0.72}


def frames(name):
    x = open(os.path.join(SRC, name + '.xml'), encoding='utf-8-sig').read()
    return [dict(re.findall(r'(\w+)="([^"]*)"', m.group(1))) for m in re.finditer(r'<SubTexture\b([^>]*)/>', x)]


def unique_frames(name, kind):
    """The distinct pictures of an animation, in order (idle holds each one for 3 frames)."""
    sheet = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    out, seen = [], set()
    for f in frames(name):
        if not re.match(name + ' ' + kind + r'\d+$', f['name']): continue
        x, y, w, h = (int(f[k]) for k in ('x', 'y', 'width', 'height'))
        if (x, y) in seen: continue
        seen.add((x, y))
        fx, fy = -int(f.get('frameX', 0)), -int(f.get('frameY', 0))
        fw, fh = int(f.get('frameWidth', w)), int(f.get('frameHeight', h))
        c = np.zeros((fh, fw, 4), np.uint8); c[fy:fy + h, fx:fx + w] = sheet[y:y + h, x:x + w]
        out.append(c)
    return out


def fill_mask(c, kind):
    lum = c[..., :3].astype(np.float32).mean(-1); a = c[..., 3]
    return (a > 128) & ((lum < 90) if kind == 'idle' else (lum > 170))


def cut_letters(c, kind):
    """Split a word picture into letters: each fill blob + the outline pixels closest to it."""
    fill = fill_mask(c, kind)
    lab, n = ndi.label(fill)
    sizes = ndi.sum(fill, lab, range(1, n + 1))
    keep = [i + 1 for i in range(n) if sizes[i] > 150]
    # small blobs (the dot on the i) join the nearest big blob
    big = np.isin(lab, keep)
    _, (iy, ix) = ndi.distance_transform_edt(~big, return_indices=True)
    owner = lab[iy, ix]
    owner[c[..., 3] == 0] = 0
    objs = ndi.find_objects(lab)
    keep.sort(key=lambda i: objs[i - 1][1].start)
    letters = []
    for i in keep:
        m = owner == i
        # only the piece joined to the letter (drops bits of a neighbour's outline that ended up closest to it)
        ml, mn = ndi.label(m & (c[..., 3] > 24), structure=np.ones((3, 3)))
        if mn > 1:
            core = np.bincount(ml[lab == i].ravel(), minlength=mn + 1); core[0] = 0
            m = ml == core.argmax()
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = c[y0:y1, x0:x1].copy(); rgba[~m[y0:y1, x0:x1]] = 0
        fm = (lab[y0:y1, x0:x1] == i) | (fill[y0:y1, x0:x1] & m[y0:y1, x0:x1])
        fy, fx = np.nonzero(fm)
        letters.append({'rgba': rgba, 'fill': fm, 'x0': x0, 'y0': y0,
                        'fb': (fx.min(), fy.min(), fx.max() + 1, fy.max() + 1)})   # fill box inside the crop
    return letters


def make_k(r, kind):
    """K from an R: keep the stem, drop the bowl, put the leg back + a flipped copy of the leg as the top arm."""
    rgba, fill = r['rgba'], r['fill']
    fx0, fy0, fx1, fy1 = r['fb']
    # the bowl's hole tells where the stem ends (its left side) and where the leg starts (under it)
    hole = ndi.binary_fill_holes(fill) & ~fill
    hy, hx = np.nonzero(hole)
    if len(hx): stem_r, waist = int(hx.min()), int(hy.max()) + 1
    else: stem_r, waist = fx0 + (fx1 - fx0) // 3, (fy0 + fy1) // 2
    h, w = fill.shape
    out = np.zeros_like(rgba); out_fill = np.zeros_like(fill)
    out[:, :stem_r] = rgba[:, :stem_r]; out_fill[:, :stem_r] = fill[:, :stem_r]
    out[waist:, stem_r:] = rgba[waist:, stem_r:]; out_fill[waist:, stem_r:] = fill[waist:, stem_r:]
    # the top arm = the leg flipped, stretched up to the top of the letter
    leg, legf = rgba[waist:, stem_r:], fill[waist:, stem_r:]
    span = waist
    if span > 4 and leg.shape[0] > 4:
        a = np.asarray(Image.fromarray(np.ascontiguousarray(leg[::-1])).resize((leg.shape[1], span), Image.LANCZOS))
        armf = np.asarray(Image.fromarray((legf[::-1] * 255).astype(np.uint8)).resize((leg.shape[1], span), Image.LANCZOS)) > 127
        dst = out[:waist, stem_r:]
        al = a[..., 3:4].astype(np.float32) / 255
        mixed = (a.astype(np.float32) * al + dst.astype(np.float32) * (1 - al))
        mixed[..., 3] = np.maximum(dst[..., 3], a[..., 3])
        out[:waist, stem_r:] = mixed.astype(np.uint8)
        out_fill[:waist, stem_r:] |= armf
    # the old fill pixels of the stem's right edge stay fill (no outline line through the middle of the K)
    k = dict(r); k['rgba'] = out; k['fill'] = out_fill
    fy, fx = np.nonzero(out_fill)
    k['fb'] = (fx.min(), fy.min(), fx.max() + 1, fy.max() + 1)
    return k


def idle_from_selected(L, s, r=9.5):
    """An idle letter (black fill, white outline) drawn from a selected letter's shape, s = scale."""
    f = L['fill']
    h, w = f.shape
    pad = int(r * 2 / s) + 4
    fp = np.pad(f, pad)
    big = np.asarray(Image.fromarray((fp * 255).astype(np.uint8)).resize((round(fp.shape[1] * s * 2), round(fp.shape[0] * s * 2)), Image.LANCZOS)) > 127
    ring = ndi.distance_transform_edt(~big) <= r * 2
    rgba = np.zeros(big.shape + (4,), np.uint8)
    rgba[ring] = (255, 255, 255, 255); rgba[big] = (0, 0, 0, 255)
    im = Image.fromarray(rgba).resize((big.shape[1] // 2, big.shape[0] // 2), Image.LANCZOS)
    small = np.asarray(Image.fromarray((big * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS)) > 127
    rgba = np.asarray(im).copy()
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba, small = rgba[y0:y1, x0:x1], small[y0:y1, x0:x1]
    fy, fx = np.nonzero(small)
    return {'rgba': rgba, 'fill': small, 'x0': 0, 'y0': 0, 'fb': (fx.min(), fy.min(), fx.max() + 1, fy.max() + 1)}


def scaled(L, s):
    if abs(s - 1) < 0.02: return L
    h, w = L['fill'].shape
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    rgba = np.asarray(Image.fromarray(L['rgba']).resize((nw, nh), Image.LANCZOS))
    fill = np.asarray(Image.fromarray((L['fill'] * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)) > 127
    fy, fx = np.nonzero(fill)
    return dict(L, rgba=rgba, fill=fill, fb=(fx.min(), fy.min(), fx.max() + 1, fy.max() + 1))


def build_word(word, kind, fi):
    """One picture of `word` from frame fi of the source words."""
    cache = {}
    def letter(ch):
        if ch == 'K': return make_k(letter('R'), kind)
        if ch in SPECIAL: return SPECIAL[ch](letter, kind)
        name, idx = LETTERS[ch]
        if ch in FROM_SELECTED and kind == 'idle':
            fs = unique_frames(name, 'selected')
            sel = cut_letters(fs[fi % len(fs)], 'selected')[idx]
            return idle_from_selected(sel, FROM_SELECTED[ch])
        if name not in cache:
            fs = unique_frames(name, kind)
            cache[name] = cut_letters(fs[fi % len(fs)], kind)
        return cache[name][idx]
    # target letter height: the STORY MODE letters
    ref = [letter(c) for c in 'MDE']
    cap = float(np.median([L['fb'][3] - L['fb'][1] for L in ref]))
    overlap = 14 if kind == 'idle' else 22
    gap = 26 if kind == 'idle' else 34
    placed, x = [], 0
    for ch in word:
        if ch == ' ': x += gap; continue
        L = letter(ch)
        hgt = L['fb'][3] - L['fb'][1]
        if ch in 'NRAK' and hgt: L = scaled(L, min(1.12, max(0.9, cap / hgt)))
        fx0, fy0, fx1, fy1 = L['fb']
        px = x - fx0 - (overlap if placed else 0) + (0 if placed else 10)
        cy = (fy0 + fy1) / 2
        placed.append((L, px, cy))
        x = px + fx1
    # line the letter middles up (each bobs a little, like FNF's), then move everything inside the picture
    jit = [((i * 37 + fi * 13) % 7) - 3 for i in range(len(placed))]
    spots = [(L, px, -cy + jit[i]) for i, (L, px, cy) in enumerate(placed)]
    dx = 8 - min(px for _, px, _ in spots); dy = 8 - min(py for _, _, py in spots)
    spots = [(L, int(round(px + dx)), int(round(py + dy))) for L, px, py in spots]
    Wd = max(px + L['rgba'].shape[1] for L, px, _ in spots) + 8
    H = max(py + L['rgba'].shape[0] for L, _, py in spots) + 8
    canvas = Image.new('RGBA', (Wd, H), (0, 0, 0, 0))
    # pass 0: one solid outline under the whole word (closes the notches where two cut letters meet)
    al = np.zeros((H, Wd), np.float32)
    for L, px, py in spots:
        a = L['rgba'][..., 3].astype(np.float32); hh, ww = a.shape
        al[py:py + hh, px:px + ww] = np.maximum(al[py:py + hh, px:px + ww], a)
    al = ndi.grey_closing(al, footprint=disk(7 if kind == 'idle' else 10))
    under = np.zeros((H, Wd, 4), np.uint8)
    under[..., :3] = 255 if kind == 'idle' else 0; under[..., 3] = al.clip(0, 255).astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(under))
    # pass 1: every letter with its outline; pass 2: the fills again on top, so no outline cuts into a letter
    for L, px, py in spots: canvas.alpha_composite(Image.fromarray(L['rgba']), (px, py))
    for L, px, py in spots:
        m = ndi.binary_dilation(L['fill'], iterations=2)
        top = L['rgba'].copy(); top[~m] = 0
        canvas.alpha_composite(Image.fromarray(top), (px, py))
    # anything see-through that's closed in by the word (gaps where cut letters meet, letter holes) = outline colour
    c = np.asarray(canvas).copy()
    solid = c[..., 3] > 200
    holes = ndi.binary_dilation(ndi.binary_fill_holes(solid) & ~solid, iterations=1) & ~solid
    k = c[..., 3:4].astype(np.float32) / 255
    col = np.array([255, 255, 255] if kind == 'idle' else [0, 0, 0], np.float32)
    c[..., :3] = np.where(holes[..., None], c[..., :3] * k + col * (1 - k), c[..., :3]).astype(np.uint8)
    c[..., 3] = np.where(holes, 255, c[..., 3])
    return Image.fromarray(c)


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def write_sheet(name, anims):
    """anims = [(anim name, [pictures], hold)] -> one Sparrow sheet, pictures stacked."""
    pics = [p for _, ps, _ in anims for p in ps]
    W = max(p.width for p in pics); H = sum(p.height + 4 for p in pics)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="%s.png">' % name]
    y = 0
    for an, ps, hold in anims:
        fw, fh = max(p.width for p in ps), max(p.height for p in ps)
        spots = []
        for p in ps:
            sheet.paste(p, (0, y)); spots.append((y, p)); y += p.height + 4
        n = 0
        for i in range(len(ps) * hold):
            py, p = spots[i // hold]
            lines.append('\t<SubTexture name="%s%04d" x="0" y="%d" width="%d" height="%d" frameX="0" frameY="0" frameWidth="%d" frameHeight="%d"/>'
                         % (an, n, py, p.width, p.height, fw, fh)); n += 1
    lines.append('</TextureAtlas>')
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, name + '.png'))
    open(os.path.join(OUT, name + '.xml'), 'w').write('\n'.join(lines) + '\n')


def main(words=(('RANK MODE', 'rankmode'), ('PRO MODE', 'promode'))):
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else None
    for word, name in words:
        if out and name not in out.split(','): continue
        idle = [build_word(word, 'idle', i) for i in range(3)]
        sel = [build_word(word, 'selected', i) for i in range(3)]
        write_sheet(name, [(name + ' idle', idle, 3), (name + ' selected', sel, 1)])
        print('wrote', os.path.join(OUT, name + '.png'), idle[0].size, sel[0].size)


if __name__ == '__main__':
    main()
