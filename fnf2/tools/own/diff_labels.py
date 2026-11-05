"""BABY / INSANE / GOD difficulty labels made from FNF's own difficulty pictures (the letters cut out of EASY, NORMAL,
HARD + the OG one, recoloured; B = the top of an R + the same flipped, I = the left post of an H).
  python3 tools/own/diff_labels.py <folder with the unpacked pictures> <out folder>
Writes <out>/freeplay/freeplay<diff>.png (filled) + <out>/storymenu/difficulties/<diff>.png (outlined)."""
import os, sys
import numpy as np
from PIL import Image
D, OUT = sys.argv[1:3]
COLOR = {'baby': (127, 216, 255), 'insane': (255, 138, 31), 'god': (255, 210, 58)}

def load(n): return np.array(Image.open(os.path.join(D, n)).convert('RGBA')).astype(np.float32)

def cut(img, x0, x1):
    a = img[:, x0:x1].copy()
    # keep only the biggest blob (bits of the next letter's outline go)
    from scipy import ndimage
    m = a[..., 3] > 30
    lab, n = ndimage.label(m)
    if n > 1:
        # (bits of the next letter touch the cut's edge; a letter's own inner outlines (the hole of an O) don't)
        sizes = ndimage.sum(m, lab, range(1, n + 1)); top = sizes.max(); keep = np.zeros_like(m)
        for i in range(1, n + 1):
            xs = np.where((lab == i).any(0))[0]
            edge = xs[0] <= 1 or xs[-1] >= m.shape[1] - 2
            if sizes[i - 1] == top or not (edge and sizes[i - 1] < top * 0.3): keep |= lab == i
        a[~ndimage.binary_dilation(keep, iterations=2)] = 0
    cols = np.where(a[..., 3].max(0) > 30)[0]
    return a[:, cols[0]:cols[-1] + 1]

def recolor(a, rgb):
    mx = a[..., :3].max(-1); on = a[..., 3] > 200
    ref = np.percentile(mx[on], 95) if on.any() else 255     # (each letter's own fill = full colour: OG's teal G was darker)
    v = np.clip(mx[..., None] / max(ref, 1), 0, 1)
    out = a.copy(); out[..., :3] = np.array(rgb, np.float32) * v
    return out

def word(letters, gap=-2, height=None):
    H = max(l.shape[0] for l in letters)
    W = sum(l.shape[1] for l in letters) + gap * (len(letters) - 1)
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0
    for l in letters:
        im = Image.fromarray(np.clip(l, 0, 255).astype(np.uint8))
        c.alpha_composite(im, (x, H - l.shape[0])); x += l.shape[1] + gap
    return c

def B_from(R):
    # the R's top (post + bowl, down to where the bowl closes) squashed to half height, + the same upside down: a B
    h, w = R.shape[:2]; top = R[: int(h * 0.6)]
    hh = (h + 1) // 2 + 1
    half = np.array(Image.fromarray(np.clip(top, 0, 255).astype(np.uint8)).resize((w, hh), Image.LANCZOS)).astype(np.float32)
    return np.concatenate([half, half[::-1]], 0)[:h]

def I_from(H):
    # the left post of the H (+ its outline)
    a = H.copy(); al = a[..., 3] > 30
    cols = al.sum(0)
    # the post ends where the middle bar starts: the first column after the left edge with a much shorter run
    w = a.shape[1]; post = int(w * 0.36)
    for x in range(int(w * 0.2), int(w * 0.5)):
        if cols[x] < cols[:x].max() * 0.6: post = x; break
    I = a[:, :post + 3].copy()
    # close the right side with the outline: copy the left edge's outline column, mirrored
    edge = a[:, :6][:, ::-1]
    return np.concatenate([I[:, : -3] if I.shape[1] > 6 else I, edge], 1)

def letters(kind):
    if kind == 'fp':
        E, N, Hd, O = load('freeplay_freeplayeasy.webp'), load('freeplay_freeplaynormal.webp'), load('freeplay_freeplayhard.webp'), load('freeplay_freeplayog.png')
        L = {'E': cut(E, 0, 54), 'A': cut(E, 54, 108), 'S': cut(E, 108, 154), 'Y': cut(E, 154, 203),
             'N': cut(N, 0, 55), 'O': cut(N, 55, 100), 'R': cut(N, 100, 157), 'H': cut(Hd, 0, 54), 'D': cut(Hd, 159, 210)}
        og = O; c = np.where(og[..., 3].max(0) > 30)[0]; mid = (c[0] + c[-1]) // 2
        L['G'] = cut(og, mid - 2, c[-1] + 1)
    else:
        E, N, Hd, O = load('storymenu_difficulties_easy.webp'), load('storymenu_difficulties_normal.webp'), load('storymenu_difficulties_hard.webp'), load('storymenu_difficulties_og.png')
        L = {'E': cut(E, 0, 53), 'A': cut(E, 53, 103), 'N': cut(N, 0, 52), 'O': cut(N, 53, 100), 'R': cut(N, 100, 152),
             'H': cut(Hd, 0, 53), 'G': cut(O, 102, 156)}
        # S + Y share a run: split where the outline is thinnest
        L['S'], L['Y'] = cut(E, 103, 149), cut(E, 148, E.shape[1])     # (where the outlines are thinnest)
        L['D'] = cut(Hd, 158, Hd.shape[1])
    L['B'] = B_from(L['R']); L['I'] = I_from(L['H'])
    return L

for kind, sub in (('fp', 'freeplay/freeplay{}.png'), ('st', 'storymenu/difficulties/{}.png')):
    L = letters(kind)
    for diff, txt in (('baby', 'BABY'), ('insane', 'INSANE'), ('god', 'GOD')):
        im = word([recolor(L[ch], COLOR[diff]) for ch in txt])
        maxw = 250 if kind == 'fp' else 320
        if im.width > maxw: im = im.resize((maxw, im.height), Image.LANCZOS)
        p = os.path.join(OUT, sub.format(diff)); os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p)
        print(p, im.size)
