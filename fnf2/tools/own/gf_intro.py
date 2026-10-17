"""Standing GF for WRATH's ice cream intro.

Base art: the "Standing GF!" FNF mod by Luvrgirl (GameBanana 369487), read from a private
download folder (never committed). In her idle she holds a mic at her chest; here the mic is
taken out of every idle frame, an ice cream cone goes in her hand, and her fist is drawn back
over it so she's gripping the cone.

  python3 fnf2/tools/own/gf_intro.py [--preview PNG]
Writes a sparrow sheet + character json to fnf2/build/own/.
"""
import argparse, json, math, os, re
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = os.environ.get('GF_MOD', '/home/user/ref/mods/gf1')
OUT = os.path.join(ROOT, 'build', 'own')
CONE = os.path.join(OUT, 'shared', 'images', 'wrath-intro', 'cone-chocchip.png')
ID = 'gf-icecream'
# frame 0 (picture px): mic grille, fist
GRILLE0 = (0, 196, 62, 253)
FIST0 = (60, 214, 140, 284)
CONE_W = 96                       # cone width in her hand (frame px)


def frames(prefix):
    xml = open(os.path.join(MOD, 'gf_playable.xml'), encoding='utf-8-sig', errors='ignore').read()
    sheet = Image.open(os.path.join(MOD, 'gf_playable.png')).convert('RGBA')
    out = []
    for m in re.finditer(r'<SubTexture name="(%s\d+)"([^/]*)/>' % re.escape(prefix), xml):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(2)))
        x, y, w, h = (int(float(a[k])) for k in ('x', 'y', 'width', 'height'))
        img = np.array(sheet.crop((x, y, x + w, y + h)))
        out.append((m.group(1), img, a))
    return out


def mic_mask(img):
    """The mic: bluish-grey grille + handle bits + its black outline, left of her fist."""
    rgb = img[..., :3].astype(int); al = img[..., 3] > 30
    H, W = al.shape
    blue = al & (rgb[..., 2] > rgb[..., 0] + 12) & (rgb.max(2) < 215)
    blue[:, int(W * 0.5):] = False
    lab, n = ndimage.label(ndimage.binary_dilation(blue, iterations=4))
    if not n: return None, None
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    big = 1 + int(np.argmax(sizes))
    g = lab == big
    ys, xs = np.nonzero(g & blue)
    box = (xs.min(), ys.min(), xs.max(), ys.max())
    hull = cv2.convexHull(np.c_[xs, ys].astype(np.int32))
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [hull], 1)
    m = m > 0
    for i in range(1, n + 1):                      # the handle end poking out the other side of her fist
        if i != big and sizes[i - 1] > 30: m |= lab == i
    skin = (rgb[..., 0] > 200) & (rgb[..., 1] > 150) & (rgb[..., 2] > 140)
    hairc = (rgb[..., 0] > 70) & (rgb[..., 1] < 45) & (rgb[..., 2] < 45) & (rgb[..., 0] > rgb[..., 1] + 30)
    near = ndimage.binary_dilation(m, iterations=16)
    # the grille's own thick outline (black) and grey bits around it, never her hair or skin
    m = (ndimage.binary_dilation(m, iterations=5) | (near & ~hairc & ~skin)) & al
    m &= ~ndimage.binary_dilation(skin, iterations=1)
    return m, box


def fist_mask(img, box):
    rgb = img[..., :3].astype(int); al = img[..., 3] > 30
    x0, y0, x1, y1 = box
    H, W = al.shape
    sel = np.zeros((H, W), bool); sel[max(0, y0):y1, max(0, x0):x1] = True
    skin = sel & al & (rgb[..., 0] > 200) & (rgb[..., 1] > 140) & (rgb[..., 2] > 130) & (rgb[..., 0] > rgb[..., 2] + 10)
    skin = ndimage.binary_opening(skin, iterations=1)
    lab, n = ndimage.label(skin)
    if not n: return np.zeros((H, W), bool)
    keep = lab == 1 + int(np.argmax(ndimage.sum(skin, lab, range(1, n + 1))))
    ink = sel & al & (rgb.max(2) < 90)
    return keep | (ndimage.binary_dilation(keep, iterations=4) & ink)


def paste(dst, src, x, y):
    out = Image.fromarray(dst); out.alpha_composite(Image.fromarray(src), (int(x), int(y))); return np.array(out)


def build(cone_path, preview=None):
    cone = Image.open(cone_path)
    k = CONE_W / cone.width
    cone = cone.resize((CONE_W, int(cone.height * k)), Image.LANCZOS).rotate(12, resample=Image.BICUBIC, expand=True)
    cone = np.array(cone)
    fr = frames('Idle')
    _, g0 = mic_mask(fr[0][1])
    out = []
    for name, img, a in fr:
        m, g = mic_mask(img)
        dx, dy = (g[0] - g0[0], g[1] - g0[1]) if g else (0, 0)
        fist = fist_mask(img, (FIST0[0] + dx, FIST0[1] + dy, FIST0[2] + dx, FIST0[3] + dy))
        im = img.copy()
        if m is not None:
            # take the mic out: her outline is bridged across the hole (closing), inside = her hair
            # colour with an ink edge, outside = see-through
            sil = (im[..., 3] > 30) & ~m
            r = 22
            disk = np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r
            closed = ndimage.binary_closing(np.pad(sil, r), structure=disk)[r:-r, r:-r] | sil
            rgbv = im[..., :3].astype(int)
            hair = sil & (rgbv[..., 0] > 70) & (rgbv[..., 0] < 150) & (rgbv[..., 1] < 40) & (rgbv[..., 2] < 40)
            near = hair & ndimage.binary_dilation(m, iterations=25)
            hc = np.median(im[near][:, :3], axis=0).astype(np.uint8) if near.any() else np.array([105, 16, 14], np.uint8)
            inside = m & closed
            edge = inside & ~ndimage.binary_erosion(closed, iterations=5)
            fist_cx = (FIST0[0] + FIST0[2]) / 2 + dx
            xx = np.arange(im.shape[1])[None, :].repeat(im.shape[0], 0)
            right = m & (xx > fist_cx)                     # handle end: over her dress, paint it in from around
            left = inside & ~right
            rv = im[..., :3].astype(int)
            dress = (im[..., 3] > 200) & ~m & (rv[..., 0] > 110) & (rv[..., 1] < 70) & (rv[..., 2] > 35)
            right = right | (ndimage.binary_dilation(right, iterations=3) & ~dress & ~fist & (im[..., 3] > 30)
                             & (xx > fist_cx + 6))     # the handle's black outline too
            _, (iy, ix) = ndimage.distance_transform_edt(~dress, return_indices=True)
            soft = im[iy, ix, :3]                          # nearest crisp colour (no blur)
            im[m & ~right] = 0
            im[left, :3] = hc; im[left, 3] = 255
            im[edge & ~right, :3] = (6, 5, 8)
            im[right, :3] = soft[right]
            # stray bits of the mic's outline left out in the air
            x0, y0, x1, y1 = g
            zone = np.zeros_like(m); zone[max(0, y0 - 14):y1 + 14, max(0, x0 - 14):min(im.shape[1], x1 + 14)] = True
            im[zone & ~closed, 3] = 0
            # anything left floating (not attached to her) goes
            lab, n = ndimage.label(im[..., 3] > 20)
            if n > 1:
                sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
                im[(lab > 0) & (lab != 1 + int(np.argmax(sz)))] = 0
        # the cone stands in her fist: tip below it, scoop up by her shoulder (frame grows upward if needed)
        PT = 70
        im = np.pad(im, ((PT, 0), (0, 0), (0, 0))); orig = np.pad(img, ((PT, 0), (0, 0), (0, 0))); fist = np.pad(fist, ((PT, 0), (0, 0)))
        fx = (FIST0[0] + FIST0[2]) / 2 + dx - 16; fy = FIST0[1] + dy + 30 + PT
        im = paste(im, cone, fx - cone.shape[1] / 2, fy - cone.shape[0] * 0.66)
        im[fist] = orig[fist]                                  # her fingers back over the cone
        pad_l, pad_t = 0, PT
        out.append((name, im, a, pad_l, pad_t))
    return out


def write(out, char_name='GF'):
    d = os.path.join(OUT, 'shared', 'images', 'characters'); os.makedirs(d, exist_ok=True)
    pad = 2
    W = sum(o[1].shape[1] + pad for o in out); H = max(o[1].shape[0] for o in out)
    sheet = Image.new('RGBA', (W, H)); x = 0
    subs = []
    for name, im, a, pl, pt in out:
        sheet.alpha_composite(Image.fromarray(im), (x, 0))
        # the padding is part of the image now: the frame grows by it, the image starts at its corner
        fxv = float(a.get('frameX', 0)); fyv = float(a.get('frameY', 0))
        fw = float(a.get('frameWidth', im.shape[1] - pl)) + pl; fh = float(a.get('frameHeight', im.shape[0] - pt)) + pt
        subs.append('\t<SubTexture name="%s" x="%d" y="0" width="%d" height="%d" frameX="%d" frameY="%d" frameWidth="%d" frameHeight="%d"/>'
                    % (name, x, im.shape[1], im.shape[0], fxv, fyv, fw, fh))
        x += im.shape[1] + pad
    sheet.save(os.path.join(d, ID + '.png'))
    open(os.path.join(d, ID + '.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<TextureAtlas imagePath="%s.png">\n%s\n</TextureAtlas>\n' % (ID, '\n'.join(subs)))
    ch = {'version': '1.0.0', 'name': char_name, 'renderType': 'sparrow', 'assetPath': 'shared:characters/' + ID,
          'scale': 1.0, 'flipX': False, 'offsets': [0, 0], 'cameraOffsets': [0, 0], 'danceEvery': 2,
          'healthIcon': {'id': 'gf'}, 'animations': [{'name': 'idle', 'prefix': 'Idle', 'frameRate': 24, 'looped': False, 'offsets': [0, 0]}]}
    cd = os.path.join(OUT, 'preload', 'data', 'characters'); os.makedirs(cd, exist_ok=True)
    json.dump(ch, open(os.path.join(cd, ID + '.json'), 'w'), indent=1)
    return sheet


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--preview')
    a = ap.parse_args()
    out = build(CONE)
    write(out)
    print(ID, len(out), 'frames')
    if a.preview:
        tiles = [Image.fromarray(o[1]) for o in out[::3]]
        W = sum(t.width for t in tiles); H = max(t.height for t in tiles)
        S = Image.new('RGBA', (W, H), (60, 66, 90, 255)); x = 0
        for t in tiles: S.alpha_composite(t, (x, H - t.height)); x += t.width
        S.save(a.preview)
