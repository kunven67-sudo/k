"""Character select nametags for the new playable characters (PRIVATE build only, written to the git-ignored
build/own folder, never the repo).

FNF's nametags (BOYFRIEND, PICO) are hand-lettered: chunky letters, a black ink outline, a white outline
around everything. The new ones are made the same way from FNF's own hand-inked main menu letters (cut out by
menu_word.py, K built from the R): the letters take the character's colour, their ink outline turns black,
then the white outline goes around the whole word.

  NENE (pink), TANKMAN (army green)   (Darnell's comes with his mod: darnell_mix.py)
    -> preload/images/charSelect/<name>Nametag.png

  python3 tools/own/nametags.py
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import menu_word as mw

mw.LETTERS.update({'PL': ('freeplay', -3), 'T': ('storymode', 1)})


def split_l(letter, kind):
    """FREEPLAY's P and L touch, so they cut out as one piece: split it at the thinnest column between them,
    keep the L, and give it its outline back from its shape."""
    pl = letter('PL')
    f = pl['fill']
    h, w = f.shape
    cols = f.sum(0).astype(float)
    lo, hi = int(w * 0.3), int(w * 0.6)
    cut = lo + int(np.argmin(cols[lo:hi]))
    right = np.zeros_like(f); right[:, cut:] = f[:, cut:]
    lab, n = ndi.label(right)
    if n > 1: right = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    L = mw.idle_from_selected({'fill': right}, 1.0, r=6.5)
    if kind == 'idle': return L
    return L


mw.SPECIAL['L'] = split_l
OUT = os.path.join(mw.ROOT, 'build', 'own', 'preload', 'images', 'charSelect')
TAGS = {
    'nene': ('NENE', (255, 95, 162)),
    'tankman': ('TANKMAN', (150, 168, 70)),
}


def nametag(word, col, fi=1):
    # the idle menu letters: black letters with a white ink outline. The black becomes the character's colour,
    # the white outline becomes the black ink line (FNF nametags have a thin black line, then white around it)
    im = mw.build_word(word, 'idle', fi)
    c = np.asarray(im).astype(np.float32)
    a = c[..., 3]
    t = np.clip(c[..., :3].mean(-1) / 255, 0, 1)[..., None]      # 0 = letter fill, 1 = outline
    out = c.copy()
    out[..., :3] = np.array(col, np.float32) * (1 - t)
    # white outline around the whole word (FNF nametags: ~7 px at full size)
    solid = a > 100
    ring = (ndi.distance_transform_edt(~solid) <= 7)
    pad = 10
    H, W = solid.shape
    full = np.zeros((H + pad * 2, W + pad * 2, 4), np.float32)
    ringp = np.pad(ndi.distance_transform_edt(~np.pad(solid, pad)) <= 7, 0)
    full[ringp] = (255, 255, 255, 255)
    inner = full[pad:pad + H, pad:pad + W]
    k = out[..., 3:4] / 255
    inner[..., :3] = inner[..., :3] * (1 - k) + out[..., :3] * k
    inner[..., 3] = np.maximum(inner[..., 3], out[..., 3])
    full[pad:pad + H, pad:pad + W] = inner
    img = Image.fromarray(full.clip(0, 255).astype(np.uint8))
    return img.crop(img.getbbox())


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (word, col) in TAGS.items():
        im = nametag(word, col)
        im.save(os.path.join(OUT, name + 'Nametag.png'))
        print(name, im.size)


if __name__ == '__main__':
    main()
