"""Props for WRATH's ice cream intro, cut from pictures (all kept private, never committed):

  * scoops  - from the user's own picture (fnf2/private/intro-icecream-ref.webp): BF's bitten
              strawberry scoop + GF's chocolate chip scoop
  * cone    - the top cone of the waffle-cone stack on the ice cream cart in the FNF mod
              "Sweet Treats and Icy Beats" (Aurazona), flipped upright
  * truck   - the ice cream truck from the user's picture (fnf2/private/intro-truck-ref.webp),
              cut out and darkened for the night street

  python3 fnf2/tools/own/intro_props.py
Writes PNGs to fnf2/build/own/shared/images/wrath-intro/.
"""
import os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRIV = os.path.join(ROOT, 'private')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'wrath-intro')
CART = os.environ.get('SWEET_CART', '/home/user/ref/mods/sweet/bin/assets/shared/images/stand.png')
INK = (6, 5, 8)


def smooth(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s) > 0.5


def biggest(m):
    lab, n = ndimage.label(m)
    if not n: return m
    return lab == 1 + int(np.argmax(ndimage.sum(m, lab, range(1, n + 1))))


def cut(rgb, inside, ink_w):
    """inside = mask of the coloured paint; its black outline ring is kept from the picture."""
    inside = smooth(ndimage.binary_fill_holes(ndimage.binary_closing(inside, iterations=3)), 1.5)
    lum = rgb.max(2)
    ring = ndimage.binary_dilation(inside, iterations=ink_w) & ~inside
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[inside, :3] = rgb[inside]; out[inside, 3] = 255
    dark = ring & (lum < 110)
    out[ring, :3] = INK; out[ring, 3] = np.where(dark[ring], 255, 255)
    # anti-aliased outer edge
    edge = ndimage.binary_dilation(inside | ring, iterations=1) & ~(inside | ring)
    out[edge, :3] = INK; out[edge, 3] = 110
    return out


def crop_alpha(a, pad=4):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return a[max(0, ys.min() - pad):ys.max() + pad + 1, max(0, xs.min() - pad):xs.max() + pad + 1]


def scoop(box, test, U=3.0, cut_below=None):
    im = np.array(Image.open(os.path.join(PRIV, 'intro-icecream-ref.webp')).convert('RGB'))
    x0, y0, x1, y1 = box
    c = cv2.resize(im[y0:y1, x0:x1], ((x1 - x0) * int(U), (y1 - y0) * int(U)), interpolation=cv2.INTER_CUBIC)
    c = cv2.bilateralFilter(c, 7, 30, 7)
    r, g, b = [c[..., i].astype(int) for i in range(3)]
    paint = test(r, g, b)
    if cut_below is not None: paint[int(cut_below * U):] = False
    paint = biggest(ndimage.binary_closing(paint, iterations=4))
    return crop_alpha(cut(c, paint, int(3 * U)))


def cone():
    a = np.array(Image.open(CART).convert('RGBA'))
    c = a[740:880, 470:570].copy()                 # top cone of the stack (point up)
    rgb = c[..., :3].astype(int); al = c[..., 3] > 30
    waffle = al & (rgb.max(2) > 95)                 # any paint (waffle + its brown grid), not the black ink
    lab, n = ndimage.label(waffle)
    top, top_y = None, 1e9
    for i in range(1, n + 1):                      # the tall pointy piece at the top
        ys, xs = np.nonzero(lab == i)
        if ys.min() < 40 and len(ys) > 300 and (top is None or ys.min() < top_y): top, top_y = lab == i, ys.min()
    inner = smooth(ndimage.binary_fill_holes(top), 1.0)
    big = cv2.resize(c, (c.shape[1] * 3, c.shape[0] * 3), interpolation=cv2.INTER_CUBIC)
    inner = cv2.resize(inner.astype(np.uint8), (c.shape[1] * 3, c.shape[0] * 3), interpolation=cv2.INTER_NEAREST) > 0
    inner = smooth(inner, 2)
    o = cut(big[..., :3], inner, 9)
    o = crop_alpha(o)[::-1].copy()                 # flip: point down, open top
    return o


def on_cone(sc, cn, overlap=0.32, width=1.15):
    """Scoop sitting in the cone: scoop scaled to the cone's width, its bottom drips over the rim."""
    k = cn.shape[1] * width / sc.shape[1]
    s2 = np.array(Image.fromarray(sc).resize((int(sc.shape[1] * k), int(sc.shape[0] * k)), Image.LANCZOS))
    H = int(s2.shape[0] * (1 - overlap)) + cn.shape[0]; W = max(s2.shape[1], cn.shape[1])
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(Image.fromarray(cn), ((W - cn.shape[1]) // 2, H - cn.shape[0]))
    out.alpha_composite(Image.fromarray(s2), ((W - s2.shape[1]) // 2, 0))
    return out


def truck():
    im = np.array(Image.open(os.path.join(PRIV, 'intro-truck-ref.webp')).convert('RGB'))
    mask = np.zeros(im.shape[:2], np.uint8)
    rect = (392, 38, 1150 - 392, 562 - 38)
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(im, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    fg = (mask == 1) | (mask == 3)
    fg = biggest(smooth(ndimage.binary_opening(fg, iterations=2), 1.5))
    fg = ndimage.binary_fill_holes(fg)
    # drop the picture's road shadow under the body: keep only the wheels + bumpers below it
    H, W = fg.shape; yy, xx = np.mgrid[0:H, 0:W]
    below = yy > 507
    keep = (np.hypot(xx - 540, yy - 495) <= 63) | (np.hypot(xx - 987, yy - 495) <= 63)
    keep |= (yy <= 524) & ((xx < 456) | (xx > 1054))
    fg &= ~below | keep
    fg = biggest(fg)
    o = np.zeros(im.shape[:2] + (4,), np.uint8)
    # a soft contact shadow on the street under it
    sh = np.clip(1 - np.hypot((xx - 765) / 400.0, (yy - 553) / 16.0), 0, 1) ** 0.7
    o[..., 3] = (sh * 150).astype(np.uint8)
    # night: cooler + darker, like the street's own props
    night = (im.astype(np.float32) * np.array([0.6, 0.64, 0.82])).clip(0, 255).astype(np.uint8)
    o[fg, :3] = night[fg]; o[fg, 3] = 255
    e = ndimage.binary_dilation(fg, iterations=1) & ~fg
    o[e, :3] = INK; o[e, 3] = 120
    return crop_alpha(o, 2)


def main():
    os.makedirs(OUT, exist_ok=True)
    pink = scoop((585, 395, 680, 500), lambda r, g, b: ((r > 190) & (g < 175) & (b > 110) & (r > g + 40)) | ((r > 150) & (g < 90) & (b < 110)), cut_below=88)
    choc = scoop((770, 315, 870, 425), lambda r, g, b: ((r > 150) & (g > 130) & (b < 150) & (r - b > 25) & (r < 235)) | ((r < 120) & (g < 90) & (b < 70) & (r > 40)), cut_below=95)
    cn = cone()
    on_cone(pink, cn).save(os.path.join(OUT, 'cone-strawberry.png'))
    on_cone(choc, cn).save(os.path.join(OUT, 'cone-chocchip.png'))
    Image.fromarray(truck()).save(os.path.join(OUT, 'truck.png'))
    # FNF-style dialogue box + BF/GF dialogue portraits from Psych Engine (ShadowMario & co.)
    PSY = os.environ.get('PSYCH', '/home/user/ref/psych')
    dd = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'dialogue'); os.makedirs(dd, exist_ok=True)
    import shutil
    for f in ('speech_bubble.png', 'speech_bubble.xml'): shutil.copy(os.path.join(PSY, 'assets/shared/images', f), os.path.join(dd, f))
    for f in ('BF_Dialogue.png', 'BF_Dialogue.xml', 'GF_Dialogue.png', 'GF_Dialogue.xml', 'bf.json', 'gf.json'):
        shutil.copy(os.path.join(PSY, 'assets/shared/images/dialogue', f), os.path.join(dd, f))
    for f in sorted(os.listdir(OUT)): print(f, Image.open(os.path.join(OUT, f)).size)


if __name__ == '__main__':
    main()
