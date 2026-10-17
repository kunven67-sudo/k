"""BF for WRATH's ice cream intro: BF's real atlas (funkin.assets, read at build time, never
committed) with the mic in his idle fist swapped for a strawberry ice cream cone.
Only used in the intro cutscene - in the battle BF has his mic like normal.

  python3 fnf2/tools/own/bf_intro.py [--preview PNG]
"""
import argparse, copy, json, math, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import puppet as P
import wrath as Wm

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'build', 'own')
CONE = os.path.join(OUT, 'shared', 'images', 'wrath-intro', 'cone-strawberry.png')
ID = 'bf-icecream'
ARM = '21'                      # BF's idle arm + mic fist
CONE_W, CONE_ROT = 70, 18       # cone width in arm px, tilt (degrees, + = top leans left)
TIP_AT = (78, 92)               # where the cone's tip goes (hidden in the fist), arm px
INK = (6, 5, 8)


def no_mic(a):
    rgb = a[..., :3].astype(int); al = a[..., 3] > 30
    H, W = al.shape
    navy = al & (rgb[..., 2] > rgb[..., 0] + 12) & (rgb.max(2) < 200)
    navy[:, W // 2:] = False
    ys, xs = np.nonzero(navy)
    hull = cv2.convexHull(np.c_[xs, ys].astype(np.int32))
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [hull], 1)
    skin = al & (rgb[..., 0] > 200) & (rgb[..., 1] > 120)
    m = ndimage.binary_dilation(m > 0, iterations=13) & al & ~ndimage.binary_dilation(skin, iterations=2)
    out = a.copy(); out[m] = 0
    lab, n = ndimage.label(out[..., 3] > 20)                 # drop leftover bits of the mic outline
    if n > 1:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        out[(lab > 0) & (lab != 1 + int(np.argmax(sz)))] = 0
    # the fist loses a bit of outline where the mic was: ink it back
    keep = out[..., 3] > 30
    ring = ndimage.binary_dilation(keep & skin, iterations=5) & ~keep & ndimage.binary_dilation(m, iterations=1)
    out[ring] = INK + (255,)
    return out


def build_arm():
    anim, spr = Wm.load_bf()
    arm = no_mic(spr[ARM])
    cone = Image.open(CONE)
    k = CONE_W / cone.width
    cone = cone.resize((CONE_W, int(cone.height * k)), Image.LANCZOS)
    tip = (cone.width / 2, cone.height)                      # tip = bottom middle
    rc = cone.rotate(CONE_ROT, resample=Image.BICUBIC, expand=True, center=None)
    # where the tip ends up after rotating about the centre
    cx, cy = cone.width / 2, cone.height / 2
    r = math.radians(CONE_ROT)
    tx, ty = tip[0] - cx, tip[1] - cy
    rtx, rty = tx * math.cos(r) + ty * math.sin(r), -tx * math.sin(r) + ty * math.cos(r)
    tip_r = (rc.width / 2 + rtx, rc.height / 2 + rty)
    ox, oy = TIP_AT[0] - tip_r[0], TIP_AT[1] - tip_r[1]
    padL, padT = max(0, int(math.ceil(-ox))), max(0, int(math.ceil(-oy)))
    H, W = arm.shape[:2]
    canvas = Image.new('RGBA', (W + padL, H + padT))
    canvas.alpha_composite(rc, (int(ox + padL), int(oy + padT)))   # cone behind ...
    canvas.alpha_composite(Image.fromarray(arm), (padL, padT))      # ... the fist over it
    return anim, spr, np.array(canvas), padL, padT


def write(out_root):
    anim, spr, arm, padL, padT = build_arm()
    anim = copy.deepcopy(anim)
    spr = dict(spr); spr[ARM] = arm
    # every place the arm bitmap is used shifts by the padding (in the bitmap's own space)
    for S in anim['SD']['S']:
        for L in S['TL']['L']:
            for F in L['FR']:
                for E in F['E']:
                    if 'ASI' in E and E['ASI']['N'] == ARM:
                        m = Wm.mx(E['ASI'])
                        m[4] -= m[0] * padL + m[2] * padT; m[5] -= m[1] * padL + m[3] * padT
                        Wm.set_mx(E['ASI'], m)
    d = os.path.join(out_root, 'shared/images/characters', ID); os.makedirs(d, exist_ok=True)
    sheet, pos = P.pack_sprites(spr)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(d, 'spritemap1.png'), optimize=True)
    json.dump({'ATLAS': {'SPRITES': [{'SPRITE': {'name': n, 'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3], 'rotated': False}} for n, p in pos.items()]},
               'meta': {'app': 'fnf2 bf_intro.py', 'image': 'spritemap1.png', 'size': {'w': sheet.shape[1], 'h': sheet.shape[0]}, 'resolution': '1'}},
              open(os.path.join(d, 'spritemap1.json'), 'w'), separators=(',', ':'))
    json.dump(anim, open(os.path.join(d, 'Animation.json'), 'w'), separators=(',', ':'))
    bd = json.load(open(os.path.join(Wm.FNF, 'preload/data/characters/bf.json')))
    ch = copy.deepcopy(bd)
    ch['name'] = 'Boyfriend'; ch['assetPath'] = 'shared:characters/' + ID
    ch['animations'] = [a for a in bd['animations'] if a['name'] in ('idle', 'hey')]
    ch['healthIcon'] = {'id': 'bf'}
    cd = os.path.join(out_root, 'preload/data/characters'); os.makedirs(cd, exist_ok=True)
    json.dump(ch, open(os.path.join(cd, ID + '.json'), 'w'), indent=1)
    return arm


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--preview'); a = ap.parse_args()
    arm = write(OUT)
    print(ID, 'arm', arm.shape)
    if a.preview:
        im = Image.fromarray(arm); bg = Image.new('RGBA', im.size, (90, 100, 120, 255)); bg.alpha_composite(im)
        bg.resize((im.width * 2, im.height * 2)).save(a.preview)
