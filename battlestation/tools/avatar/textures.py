# Repaints the MakeHuman outfit textures: the top becomes plain neutral fabric (tinted in-game),
# the jeans stay as they are. Usage: python3 textures.py <mpfb data dir> <out dir>
import sys, os
import numpy as np
from PIL import Image, ImageFilter

data, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)

def knit(h, w):
    # fine fabric grain so the plain top doesn't look like plastic
    n = rng.normal(0, 1, (h // 4, w // 4)).astype(np.float32)
    im = Image.fromarray(((n * 20) + 128).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    g = (np.asarray(im, np.float32) - 128) / 128
    fine = rng.normal(0, 1, (h, w)).astype(np.float32)
    return g * 0.05 + fine * 0.025

def top_mask(name, h, w):
    v, u = np.mgrid[0:h, 0:w].astype(np.float32)
    v /= h; u /= w
    if name == 'male_casualsuit02':
        return (v < 0.425) | (u > 0.73)
    return (v < 0.42)

for name in ['male_casualsuit02', 'male_casualsuit06']:
    d = Image.open(f'{data}/clothes/{name}/{name}_diffuse.png').convert('RGB')
    ao = Image.open(f'{data}/clothes/{name}/{name}_ao.png').convert('L').resize(d.size, Image.BICUBIC)
    D = np.asarray(d, np.float32) / 255
    A = np.asarray(ao.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    h, w = A.shape
    m = top_mask(name, h, w)
    shade = (0.88 * (0.35 + 0.65 * A) + knit(h, w)).clip(0, 1)
    top = np.repeat(shade[..., None], 3, axis=2)
    # soften the seam where the mask cuts through empty texture space
    mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32)[..., None] / 255
    res = top * mm + D * (1 - mm)
    Image.fromarray((res * 255).clip(0, 255).astype(np.uint8)).save(f'{out}/{name}_diffuse.png')
    print('wrote', name)
