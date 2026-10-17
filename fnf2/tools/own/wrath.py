"""WRATH, stage 2 (after he snaps): a creepy dark copy of BF, made from BF's real
cut-out atlas (FunkinCrew/funkin.assets, read at build time, never committed).

  * every piece repainted: dark purple cap + sneakers, grey skin, grey shirt,
    dark blue pants, hair mint (wrath) or black (wrath-black)
  * hair hangs down over his eyes; ONE big spiky eye sits on top of it. The eye is
    its own symbol (WRATH_EYE, 5 frames = 5 looks) so the game can switch it live
  * no smiling: BF's eyes are wiped off every face piece, the idle smirk becomes a
    clenched-teeth snarl, the singing mouths turn dark red
  * misses: BF's own miss timelines minus his purple overlay drawing, every piece
    tinted purple instead (so the hair + eye stay right)

  python3 fnf2/tools/own/wrath.py [--preview DIR]
"""
import argparse, colorsys, copy, json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import puppet as P

ROOT = os.path.dirname(os.path.dirname(HERE))
FNF = os.environ.get('FNF_ASSETS', '/home/user/funkincrew/funkin.assets')
BF_DIR = os.path.join(FNF, 'shared/images/characters/bf')

HEAD_SYM, HEAD_BMP = 'BF Head defalt', '18'
FACES = ['19', '0', '23', '2', '3', '5', '6', '8', '9', '1', '4', '7', '10']
SNARL_FACES = ['19']                     # BF's idle smirk -> clenched snarl
OVERLAYS = {'miss left f color', 'right note miss colorsawddwa', 'purp mizz combine', 'down miss purp dude'}
KEEP = ['BF idle dance', 'BF NOTE LEFT', 'BF NOTE LEFT MISS', 'BF NOTE RIGHT', 'BF NOTE RIGHT MISS',
        'BF NOTE UP', 'BF NOTE UP MISS', 'BF NOTE DOWN', 'BF NOTE DOWN MISS']
EYE_STYLES = ['redring', 'spiral', 'blue', 'veins', 'void']
EYE_AT = (132, 146)                      # eye centre on BF's head bitmap
HAIR = {
    'wrath': ('#a6e0cf', '#6cae9d', '#4b8a7c'),          # mint (light, mid, streak shade)
    'wrath-black': ('#45424f', '#24222b', '#15141a'),    # gone black
}


# ---------------------------------------------------------------- reading BF's atlas
def load_bf():
    anim = json.load(open(os.path.join(BF_DIR, 'Animation.json'), encoding='utf-8-sig'))
    sm = json.load(open(os.path.join(BF_DIR, 'spritemap1.json'), encoding='utf-8-sig'))
    sheet = np.array(Image.open(os.path.join(BF_DIR, 'spritemap1.png')).convert('RGBA'))
    spr = {}
    for s in sm['ATLAS']['SPRITES']:
        S = s['SPRITE']
        a = sheet[S['y']:S['y'] + S['h'], S['x']:S['x'] + S['w']]
        spr[S['name']] = np.rot90(a, 1).copy() if S.get('rotated') else a.copy()
    return anim, spr


def mx(o):
    if 'MX' in o: return list(o['MX'][:6])
    m = o['M3D']
    return [m[0], m[1], m[4], m[5], m[12], m[13]] if isinstance(m, list) else [m['m00'], m['m01'], m['m10'], m['m11'], m['m30'], m['m31']]


def set_mx(o, m):
    o.pop('M3D', None); o['MX'] = [round(v, 4) for v in m]


def symbols(anim): return {s['SN']: s for s in anim['SD']['S']}


# ---------------------------------------------------------------- repaint
def rgb2hsv(a):
    r, g, b = [a[..., i].astype(float) / 255 for i in range(3)]
    mx_, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = mx_ - mn
    h = np.zeros_like(mx_)
    m = d > 1e-6
    rm, gm, bm = m & (mx_ == r), m & (mx_ == g) & (mx_ != r), m & (mx_ == b) & (mx_ != r) & (mx_ != g)
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    s = np.where(mx_ > 0, d / np.maximum(mx_, 1e-6), 0)
    return h * 60, s, mx_


def hsv_fill(mask, out, h, s, v):
    hh = np.full(mask.sum(), h / 360.0)
    rgb = np.array([colorsys.hsv_to_rgb(hq, sq, vq) for hq, sq, vq in zip(hh, np.broadcast_to(s, hh.shape), np.clip(v, 0, 1))])
    if len(rgb): out[mask, :3] = (rgb * 255).round()


def hexhsv(c):
    r, g, b = P.hexrgb(c); h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); return h * 360, s, v


def repaint(a, hair):
    """BF's flat palette -> WRATH's. Shading inside a colour (and its soft edges) is kept by scaling value."""
    out = a.copy()
    h, s, v = rgb2hsv(a)
    vis = a[..., 3] > 0
    ink = v < 0.2
    def put(mask, target, vref):
        th, ts, tv = hexhsv(target)
        m = mask & vis & ~ink
        hsv_fill(m, out, th, ts, tv * v[m] / vref)
    hl, hm, _ = hair
    put((h >= 170) & (h < 200) & (s > 0.35), hl, 1.0)                                      # hair light (cyan)
    put((h >= 200) & (h < 213) & (s > 0.35) & (s < 0.77), hm, 0.92)                         # hair mid (blue)
    put((h >= 205) & (h <= 245) & (s >= 0.77), '#3e5876', 0.85)                             # shorts -> dark blue pants
    put(((h >= 330) | (h < 12)) & (s >= 0.7), '#58485f', 1.0)                               # red cap + sneakers -> dark purple
    put((h >= 15) & (h <= 45) & (s >= 0.1) & (s <= 0.45) & (v > 0.8), '#c9c1cf', 0.99)      # skin -> grey
    put(((h < 15) | (h > 345)) & (s >= 0.3) & (s < 0.55) & (v > 0.85), '#9d92a8', 0.97)     # skin shade
    put(((h < 6) | (h > 354)) & (s >= 0.55) & (s < 0.7) & (v > 0.9), '#8a1d38', 1.0)        # mouth pink -> dark red
    put((s < 0.12) & (v > 0.85), '#d6d2dc', 1.0)                                            # shirt + laces
    put((h >= 270) & (h < 320) & (s >= 0.2) & (s < 0.5), '#a49eb2', 0.9)                    # lilac shading
    return out


# ---------------------------------------------------------------- faces: mouth only, never a smile
def mouth_only(a):
    """Drop the eyes + brows: keep the lowest connected piece (the mouth)."""
    al = a[..., 3] > 30
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=1), structure=np.ones((3, 3)))
    if n == 0: return a, None
    best = max(range(1, n + 1), key=lambda i: np.nonzero(lab == i)[0].mean())
    out = a.copy(); out[..., 3] = np.where(lab == best, a[..., 3], 0)
    ys, xs = np.nonzero(lab == best)
    return out, (xs.min(), ys.min(), xs.max(), ys.max())


def snarl(a, box):
    """Clenched teeth, top lip pulled up in the middle, corners down."""
    H, W = a.shape[:2]
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2 - 2, (y0 + y1) / 2 + 3
    w, h = 32, 11
    top = P.bez((cx - w, cy + 5), (cx - w * 0.35, cy - h * 1.3), (cx + w * 0.35, cy - h * 1.3), (cx + w, cy + 4))
    bot = P.bez((cx + w, cy + 4), (cx + w * 0.4, cy + h * 1.15), (cx - w * 0.4, cy + h * 1.2), (cx - w, cy + 5))
    shape = top + bot[1:]
    p = P.Paint(W, H)
    p.poly(shape, '#f2eef4')
    for t in (0.22, 0.42, 0.62, 0.8):                                   # teeth gaps
        x = cx - w + 2 * w * t
        p.line([(x, cy - h * 0.75), (x, cy + h * 0.85)], 2.8)
    p.line([(cx - w * 0.92, cy + 3.5), (cx + w * 0.92, cy + 3)], 3)     # bite line
    p.line(shape + [shape[0]], 5)
    return P.over(np.zeros_like(a), p.result())


# ---------------------------------------------------------------- hair over the eyes (head bitmap px)
BANGS = [(58, 104), (254, 106), (250, 148), (238, 196), (222, 152), (210, 170), (196, 150), (180, 170),
         (166, 150), (150, 172), (136, 150), (112, 196), (100, 150), (80, 186), (72, 146), (56, 154)]
SHARDS = [[(66, 110), (122, 108), (90, 162)], [(130, 110), (182, 110), (152, 146)], [(196, 112), (244, 114), (234, 172)]]


def bangs(head, hair):
    H, W = head.shape[:2]
    hl, hm, hs = hair
    p = P.Paint(W, H)
    pts = P.smooth(BANGS[:2], 4) + BANGS[2:]
    p.poly(pts, hm)
    for sh in SHARDS: p.poly(sh, hl)                                    # angular light shards, like BF's hair
    p.line(BANGS[1:] + [BANGS[-1]], 6)                                   # outline the hanging edge only
    return P.over(head, p.result())


# ---------------------------------------------------------------- the one eye (5 looks from the user's pictures)
def almond(cx, cy, w, ht, hb, n=24):
    top = P.bez((cx - w, cy), (cx - w * 0.45, cy - ht * 1.35), (cx + w * 0.45, cy - ht * 1.35), (cx + w, cy), n)
    bot = P.bez((cx + w, cy), (cx + w * 0.45, cy + hb * 1.35), (cx - w * 0.45, cy + hb * 1.35), (cx - w, cy), n)
    return top + bot[1:]


def spikes(cx, cy, w, ht, hb, top_n=7, bot_n=5, lt=20, lb=12):
    out = []
    edge_t = P.bez((cx - w, cy), (cx - w * 0.45, cy - ht * 1.35), (cx + w * 0.45, cy - ht * 1.35), (cx + w, cy), 60)
    edge_b = P.bez((cx + w, cy), (cx + w * 0.45, cy + hb * 1.35), (cx - w * 0.45, cy + hb * 1.35), (cx - w, cy), 60)
    for edge, n, L in ((edge_t, top_n, lt), (edge_b, bot_n, lb)):
        for k in range(n):
            t = (k + 0.5) / n
            i = int(t * (len(edge) - 2))
            (x0, y0), (x1, y1) = edge[i], edge[i + 1]
            tx, ty = x1 - x0, y1 - y0; d = math.hypot(tx, ty) or 1; tx, ty = tx / d, ty / d
            nx, ny = ty, -tx                                       # outward normal (edges run clockwise)
            ln = L * (0.75 + 0.5 * math.sin(math.pi * t))
            bw = 7.5
            px, py = edge[i]
            out.append([(px - tx * bw, py - ty * bw), (px + nx * ln, py + ny * ln), (px + tx * bw, py + ty * bw)])
    return out


def draw_eye(style, size=150):
    c = size / 2
    w, ht, hb = 44, 22, 18
    p = P.Paint(size, size)
    glow = {'redring': '#ff2a3c', 'veins': '#ff2040', 'void': '#ff2a3c', 'blue': '#4a62ff', 'spiral': '#ffffff'}[style]
    spike_c = {'redring': '#26242c', 'spiral': '#f4f4f6', 'blue': '#3446d6', 'veins': '#d81a32', 'void': '#121116'}[style]
    sclera = {'redring': '#3a3842', 'spiral': '#ffffff', 'blue': '#3c50e6', 'veins': '#fff4f2', 'void': '#0d0c10'}[style]
    # soft glow behind
    gp = P.Paint(size, size)
    gp.poly(almond(c, c, w + 14, ht + 12, hb + 12), P.hexrgb(glow) + (150,))
    from PIL import ImageFilter
    glow_img = Image.fromarray(gp.result(), 'RGBA').filter(ImageFilter.GaussianBlur(7))
    for sp in spikes(c, c, w, ht, hb):
        p.poly(sp, spike_c); p.line(sp + [sp[0]], 3.2)
    p.poly(almond(c, c, w, ht, hb), sclera)
    if style == 'veins':
        for a0 in (-2.6, -2.2, 2.4, 2.8, -0.5, 0.4):
            x0, y0 = c + w * 0.95 * math.cos(a0), c + hb * 0.9 * math.sin(a0)
            p.line(P.smooth([(x0, y0), ((x0 + c) / 2 + 4, (y0 + c) / 2 - 3), (c + (x0 - c) * 0.38, c + (y0 - c) * 0.38)], 4), 1.8, '#d81a32')
    # iris + pupil
    if style == 'redring':
        p.poly(_circle(c + 4, c, 17), '#cfcdd6'); p.line(_circle(c + 4, c, 17) + [(c + 21, c)], 2.5)
        p.line(_circle(c + 4, c, 9.5) + [_circle(c + 4, c, 9.5)[0]], 4.2, '#ff2a3c')
    elif style == 'void':
        p.poly(_circle(c + 3, c, 18), '#8f8d98'); p.line(_circle(c + 3, c, 18) + [_circle(c + 3, c, 18)[0]], 2.5)
        p.line(_circle(c + 3, c, 10) + [_circle(c + 3, c, 10)[0]], 4.6, '#ff3446')
    elif style == 'spiral':
        p.poly(_circle(c + 2, c, 17), '#6d6d74')
        p.line([(c + 2 + r * math.cos(t), c + r * math.sin(t)) for t, r in ((i * 0.25, 1 + i * 0.42) for i in range(36))], 2.6)
        p.line(_circle(c + 2, c, 17) + [_circle(c + 2, c, 17)[0]], 2.5)
    elif style == 'blue':
        for r, col in ((17, '#22297c'), (12, '#3c50e6'), (7, '#22297c')):
            p.poly(_circle(c + 2, c, r), col)
        p.line(_circle(c + 2, c, 17) + [_circle(c + 2, c, 17)[0]], 2.5)
    elif style == 'veins':
        p.poly(_circle(c + 3, c, 16), '#0b0b0d')
        p.poly(_circle(c - 2, c - 6, 4), '#ffffff')
    p.line(almond(c, c, w, ht, hb) + [almond(c, c, w, ht, hb)[0]], 4.5)
    eye = Image.fromarray(p.result(), 'RGBA')
    out = Image.new('RGBA', (size, size)); out.alpha_composite(glow_img); out.alpha_composite(eye)
    return np.array(out)


def _circle(cx, cy, r, n=40): return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


# ---------------------------------------------------------------- building the atlas
def element_names(tl):
    for L in tl['L']:
        for F in L['FR']:
            for E in F['E']: yield E


def rename_tree(sym_by_name, root, suffix, keep_out=()):
    """Copy a symbol and everything it uses, every name + bitmap with `suffix`."""
    made, bitmaps = {}, set()
    def go(name):
        if name in made: return
        S = copy.deepcopy(sym_by_name[name]); S['SN'] = name + suffix; made[name] = S
        for L in S['TL']['L']:
            for F in L['FR']:
                F['E'] = [E for E in F['E'] if not ('SI' in E and E['SI']['SN'] in keep_out)]
                for E in F['E']:
                    if 'SI' in E:
                        go(E['SI']['SN']); E['SI']['SN'] += suffix
                    else:
                        bitmaps.add(E['ASI']['N']); E['ASI']['N'] += suffix
    go(root)
    return list(made.values()), bitmaps


def hold_shaken(S, shake=(0, 7, -5, 3, 0)):
    """BF's misses show his purple overlay drawing after frame 0; without it, hold the frame-0 pose
    (tinted) for the whole miss, with a quick flinch shake on twos."""
    total = max(F['I'] + F['DU'] for L in S['TL']['L'] for F in L['FR'])
    for L in S['TL']['L']:
        first = next((F for F in L['FR'] if F['E']), None)
        if not first: L['FR'] = [{'I': 0, 'DU': total, 'E': []}]; continue
        frames = []
        for k, dx in enumerate(shake):
            i = k * 2
            if i >= total: break
            last = k == len(shake) - 1
            els = copy.deepcopy(first['E'])
            for E in els:
                o = E.get('SI') or E.get('ASI'); m = mx(o); m[4] += dx; set_mx(o, m)
            frames.append({'I': i, 'DU': (total - i) if last else 2, 'E': els})
        L['FR'] = frames


def build(cid, out_root, hair_key=None):
    hair = HAIR[hair_key or cid]
    anim, spr = load_bf()
    syms = symbols(anim)
    used = set()
    for name in KEEP:
        stack = [name]
        while stack:
            n = stack.pop()
            if n in used: continue
            used.add(n)
            for E in element_names(syms[n]['TL']):
                if 'SI' in E and E['SI']['SN'] not in OVERLAYS: stack.append(E['SI']['SN'])
    bitmaps = {E['ASI']['N'] for n in used for E in element_names(syms[n]['TL']) if 'ASI' in E}

    # pieces
    out = {}
    for b in bitmaps:
        a = spr[b]
        if b in FACES:
            a, box = mouth_only(a)
            if b in SNARL_FACES and box: a = snarl(a, box)
        a = repaint(a, hair)
        if b == HEAD_BMP: a = bangs(a, hair)
        out[b] = a
    for i, st in enumerate(EYE_STYLES): out['eye_' + st] = draw_eye(st)

    # the eye lives inside the head symbol, so it follows the head in every pose
    head = syms[HEAD_SYM]
    inner = mx(head['TL']['L'][0]['FR'][0]['E'][0]['ASI'])
    es = out['eye_redring'].shape[0]
    eye_m = P.mmul(inner, P.T(EYE_AT[0] - es / 2, EYE_AT[1] - es / 2))
    head['TL']['L'].insert(0, {'LN': 'eye', 'FR': [{'I': 0, 'DU': 1, 'E': [{'SI': {'SN': 'WRATH_EYE', 'FF': 0, 'ST': 'G', 'LP': 'SF', 'MX': [round(v, 4) for v in eye_m]}}]}]})
    eye_sym = {'SN': 'WRATH_EYE', 'TL': {'L': [{'LN': 'looks', 'FR': [{'I': i, 'DU': 1, 'E': [{'ASI': {'N': 'eye_' + st, 'MX': [1, 0, 0, 1, 0, 0]}}]} for i, st in enumerate(EYE_STYLES)]}]}}
    keep_syms = [copy.deepcopy(syms[n]) for n in used if n not in OVERLAYS] + [eye_sym]
    by = {s['SN']: s for s in keep_syms}

    # misses: BF's own miss timelines, purple overlay dropped, every piece tinted
    miss_syms = []
    for d in ('LEFT', 'RIGHT', 'UP', 'DOWN'):
        made, bms = rename_tree(by, 'BF NOTE %s MISS' % d, '_m', OVERLAYS)
        hold_shaken(made[0])
        for S in made:
            if S['SN'] not in {m['SN'] for m in miss_syms}: miss_syms.append(S)
        for b in bms:
            if b + '_m' not in out: out[b + '_m'] = P.purple(out[b])
    for S in list(by.values()):
        if S['SN'].endswith(' MISS'): del by[S['SN']]
    all_syms = list(by.values()) + miss_syms

    # main timeline: labels -> symbols
    seq = [('Idle', 'BF idle dance', 14), ('Left', 'BF NOTE LEFT', 8), ('Left Miss', 'BF NOTE LEFT MISS_m', 34),
           ('Right', 'BF NOTE RIGHT', 7), ('Right Miss', 'BF NOTE RIGHT MISS_m', 46), ('Up', 'BF NOTE UP', 7),
           ('Up Miss', 'BF NOTE UP MISS_m', 24), ('Down', 'BF NOTE DOWN', 7), ('Down Miss', 'BF NOTE DOWN MISS_m', 29),
           ('Hey', 'BF NOTE UP', 26)]
    # each pose sits where BF's own main timeline puts it (otherwise he jumps between poses)
    place = {}
    for L in anim['AN']['TL']['L']:
        for F in L['FR']:
            for E in F['E']:
                if 'SI' in E: place.setdefault(E['SI']['SN'], mx(E['SI']))
    labels, inst, i = [], [], 0
    for lab, sym, du in seq:
        labels.append({'I': i, 'DU': du, 'N': lab, 'E': []})
        m = place.get(sym.replace('_m', ''), [1, 0, 0, 1, 0, 0])
        inst.append({'I': i, 'DU': du, 'E': [{'SI': {'SN': sym, 'FF': 0, 'ST': 'G', 'LP': 'PO', 'MX': [round(v, 4) for v in m]}}]})
        i += du
    anim2 = {'AN': {'N': cid, 'SN': cid, 'TL': {'L': [{'LN': 'labels', 'FR': labels}, {'LN': 'body', 'FR': inst}]}},
             'SD': {'S': all_syms}, 'MD': {'FRT': 24}}
    d = os.path.join(out_root, 'shared/images/characters', cid)
    os.makedirs(d, exist_ok=True)
    sheet, pos = P.pack_sprites(out)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(d, 'spritemap1.png'), optimize=True)
    json.dump({'ATLAS': {'SPRITES': [{'SPRITE': {'name': n, 'x': p[0], 'y': p[1], 'w': p[2], 'h': p[3], 'rotated': False}} for n, p in pos.items()]},
               'meta': {'app': 'fnf2 wrath.py', 'image': 'spritemap1.png', 'size': {'w': sheet.shape[1], 'h': sheet.shape[0]}, 'resolution': '1'}},
              open(os.path.join(d, 'spritemap1.json'), 'w'), separators=(',', ':'))
    json.dump(anim2, open(os.path.join(d, 'Animation.json'), 'w'), separators=(',', ':'))

    # character data: BF's art faces left, so as the opponent he's flipped and LEFT/RIGHT swap (like Pico)
    bd = json.load(open(os.path.join(FNF, 'preload/data/characters/bf.json')))
    names = {'Idle': 'idle', 'Right': 'singLEFT', 'Down': 'singDOWN', 'Up': 'singUP', 'Left': 'singRIGHT',
             'Right Miss': 'singLEFTmiss', 'Down Miss': 'singDOWNmiss', 'Up Miss': 'singUPmiss', 'Left Miss': 'singRIGHTmiss', 'Hey': 'hey'}
    ch = {'version': '1.0.0', 'name': 'WRATH', 'renderType': 'animateatlas', 'assetPath': 'shared:characters/' + cid,
          'flipX': True, 'offsets': bd.get('offsets', [0, 0]), 'cameraOffsets': bd.get('cameraOffsets', [0, 0]),
          'healthIcon': {'id': cid}, 'healthColor': hair[1], 'fx': 'wrath',
          'animations': [{'name': v, 'prefix': k} for k, v in names.items()]}
    cd = os.path.join(out_root, 'preload/data/characters'); os.makedirs(cd, exist_ok=True)
    json.dump(ch, open(os.path.join(cd, cid + '.json'), 'w'), indent=1)
    icon(out, os.path.join(out_root, 'preload/images/icons', 'icon-' + cid + '.png'))
    print(cid, 'atlas', sheet.shape, 'symbols', len(all_syms), 'pieces', len(out))
    return out


def icon(out, path):
    """Health icon from the head + its eye (frame 2: eye dims, head tilts)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet = Image.new('RGBA', (300, 150))
    for i, (st, rot) in enumerate((('redring', 0), ('void', -10))):
        head = Image.fromarray(out[HEAD_BMP], 'RGBA')
        e = Image.fromarray(out['eye_' + st], 'RGBA')
        head.alpha_composite(e, (int(EYE_AT[0] - e.width / 2), int(EYE_AT[1] - e.height / 2)))
        head = head.rotate(rot, resample=Image.BICUBIC, expand=True)
        k = 140 / max(head.size)
        t = head.resize((round(head.width * k), round(head.height * k)), Image.LANCZOS)
        sheet.alpha_composite(t, (i * 150 + (150 - t.width) // 2, (150 - t.height) // 2))
    sheet.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'own'))
    ap.add_argument('--preview', help='write the head/eyes/faces previews here')
    a = ap.parse_args()
    for cid in HAIR:
        out = build(cid, a.out)
        if a.preview:
            os.makedirs(a.preview, exist_ok=True)
            for n in [HEAD_BMP] + FACES + ['eye_' + s for s in EYE_STYLES]:
                if n in out:
                    b = Image.new('RGBA', out[n].shape[1::-1], (120, 130, 150, 255)); b.alpha_composite(Image.fromarray(out[n], 'RGBA'))
                    b.convert('RGB').save(os.path.join(a.preview, cid + '_' + n + '.png'))
