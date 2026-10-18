"""Nene's icons (PRIVATE build only, written to the git-ignored build/own folder).

FNF never drew Nene a health icon or a pixel icon (she was never playable). Both are made from her REAL art:
her head is rendered straight out of her gameplay atlas (shared/images/characters/nene) with the body,
arms, legs and knife symbols left out, so it's a clean cut of FNF's own drawing.

  health icon  preload/images/icons/icon-nene.png   300x150: normal (her smug tongue-out face) + losing
                (hair blown back, wincing), facing right like every FNF health icon
  pixel icon   preload/images/freeplay/icons/nenepixel.png/.xml   the freeplay capsule + character select
                grid icon: shrunk to ~38 px, flat colours, hard edges, a 1 px dark outline, 50x50 frames like
                FNF's own (idle, confirm 1-4, confirm-hold), facing left

Needs a previous build (build/fnf2.html) to render from:
  python3 tools/own/nene_icons.py
"""
import os, subprocess, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OWN = os.path.join(ROOT, 'build', 'own', 'preload', 'images')
ATLAS = 'shared/images/characters/nene'
# everything that isn't her head
HIDE = ['thigh', 'nene knee', 'back arm', 'Nene body', 'nene right leg', 'back arm ', 'knife hand', 'fist cute nene',
        'pussy pink', 'r leg curl nene', 'l leg curl nene', 'laughing hand', 'knife hand 2', 'leg forward', 'back arm 3',
        'back arm 2', 'arm straight ', 'arm cringe nene', 'r leg spasm', 'l leg spasm', 'r leg bend', 'thigh nene ',
        'shin nene', 'shoe side nene ', 'palm  arm part nene', 'palm face full arm nene', 'nene leg extended',
        'nene shoe forward', 'hearts aflutter', 'spit1', 'spit2']
NORMAL, LOSING = 0, 110                  # Idle frame 0 / Hair Blow (head knocked back)
PIX = {'idle': [0], 'confirm': [0, 84, 86, 88], 'confirm-hold': [88]}


def render(frames, scale):
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, 'f.png')
    env = dict(os.environ, HIDE='|'.join(HIDE))
    subprocess.run(['node', os.path.join(HERE, 'render_frame.js'), os.path.join(ROOT, 'build', 'fnf2.html'), ATLAS,
                    ','.join(map(str, frames)), out, str(scale)], check=True, env=env)
    res = {}
    for f in frames:
        p = out if len(frames) == 1 else out.replace('.png', '_%d.png' % f)
        res[f] = trim(Image.open(p).convert('RGBA'))
    return res


def trim(im):
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def health_icons():
    heads = render([NORMAL, LOSING], 0.62)
    sheet = Image.new('RGBA', (300, 150), (0, 0, 0, 0))
    ref = heads[NORMAL]
    k = min(138 / ref.width, 138 / ref.height)            # same size for both faces
    for i, f in enumerate([NORMAL, LOSING]):
        h = heads[f].transpose(Image.FLIP_LEFT_RIGHT)     # health icons face right
        w2, h2 = round(h.width * k), round(h.height * k)
        if w2 > 146 or h2 > 146: s = min(146 / w2, 146 / h2); w2, h2 = round(w2 * s), round(h2 * s)
        h = h.resize((w2, h2), Image.LANCZOS)
        sheet.alpha_composite(h, (i * 150 + (150 - w2) // 2, (150 - h2) // 2 + 4))
    os.makedirs(os.path.join(OWN, 'icons'), exist_ok=True)
    sheet.save(os.path.join(OWN, 'icons', 'icon-nene.png'))


def pixelate(im, height, palette):
    """Shrink keeping her ink lines: a block that is ~1/4 ink becomes an ink pixel (thin lines and eyes would
    blur away otherwise), the rest takes the block's most common colour, snapped to her palette."""
    src = np.asarray(im).astype(np.float32)
    k = height / im.height
    w = max(1, round(im.width * k))
    ys = np.linspace(0, im.height, height + 1).astype(int); xs = np.linspace(0, im.width, w + 1).astype(int)
    out = np.zeros((height, w, 4), np.uint8)
    ink_col = np.array([22, 13, 30], np.float32)
    for j in range(height):
        for i in range(w):
            b = src[ys[j]:max(ys[j] + 1, ys[j + 1]), xs[i]:max(xs[i] + 1, xs[i + 1])].reshape(-1, 4)
            op = b[:, 3] > 128
            if op.mean() < 0.42: continue
            c = b[op][:, :3]
            lum = c @ np.array([0.3, 0.59, 0.11])
            ink = lum < 48
            if ink.mean() > 0.26: col = ink_col
            else:
                cc = c[~ink] if (~ink).any() else c
                d = ((cc[:, None, :] - palette[None]) ** 2).sum(-1).argmin(1)
                col = palette[np.bincount(d, minlength=len(palette)).argmax()]
            out[j, i, :3] = np.clip(col, 0, 255); out[j, i, 3] = 255
    # pad 1 px, then a 1 px dark outline all around the shape (like FNF's pixel icons)
    out = np.pad(out, ((1, 1), (1, 1), (0, 0)))
    al = out[:, :, 3] > 0
    grow = al.copy()
    grow[1:] |= al[:-1]; grow[:-1] |= al[1:]; grow[:, 1:] |= al[:, :-1]; grow[:, :-1] |= al[:, 1:]
    edge = grow & ~al
    out[edge] = (24, 14, 33, 255)
    return Image.fromarray(out)


def pixel_icons():
    frames = sorted({f for v in PIX.values() for f in v})
    heads = render(frames, 0.5)
    # her colours: a small palette from the idle head (k-means on the opaque pixels)
    a = np.asarray(heads[0]).reshape(-1, 4).astype(np.float32)
    px = a[a[:, 3] > 200][:, :3]
    rng = np.random.default_rng(1)
    cent = px[rng.choice(len(px), 14, replace=False)]
    for _ in range(25):
        lab = ((px[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
        for c in range(len(cent)):
            m = px[lab == c]
            if len(m): cent[c] = m.mean(0)
    # her eye whites + tongue are tiny on the idle head: make sure the palette has them
    cent = np.vstack([cent, [[255, 255, 255], [232, 96, 132]]]).astype(np.float32)
    ref_h = heads[0].height
    pix = {}
    for f in frames:
        h = round(36 * heads[f].height / ref_h)            # the idle head ~36 px tall, others in proportion
        pix[f] = pixelate(heads[f], max(8, min(44, h)), cent)
    # one sheet: frames side by side, Sparrow XML with 50x50 frames (head centred, sitting a bit low)
    order = frames
    W = sum(pix[f].width + 1 for f in order); H = max(pix[f].height for f in order)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0; spot = {}
    for f in order:
        sheet.paste(pix[f], (x, 0)); spot[f] = (x, 0, pix[f].width, pix[f].height); x += pix[f].width + 1
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<TextureAtlas imagePath="nenepixel.png" width="%d" height="%d">' % (W, H)]
    for name, fl in PIX.items():
        for i, f in enumerate(fl):
            n = i + 1 if name != 'confirm-hold' else 4
            sx, sy, w, h = spot[f]
            fx, fy = -((50 - w) // 2), -(50 - h - 4)
            lines.append('  <SubTexture name="%s%04d" x="%d" y="%d" width="%d" height="%d" frameX="%d" frameY="%d" frameWidth="50" frameHeight="50"/>' % (name, n, sx, sy, w, h, fx, fy))
    lines.append('</TextureAtlas>')
    d = os.path.join(OWN, 'freeplay', 'icons'); os.makedirs(d, exist_ok=True)
    sheet.save(os.path.join(d, 'nenepixel.png'))
    open(os.path.join(d, 'nenepixel.xml'), 'w').write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    health_icons()
    pixel_icons()
    print('nene icons done')
