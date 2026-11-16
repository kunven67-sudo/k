# Makes SOUNDGUARD's icons (app + tray ok/warn/bad). python3 tools/icons.py
from PIL import Image, ImageDraw
import os
S = 1024
def bez(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        a = (1-t)**3; b = 3*(1-t)**2*t; c = 3*(1-t)*t*t; d = t**3
        out.append((a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]))
    return out
def shield(scale, ox, oy):
    # same shape as the UI's shield (24 unit box)
    pts = [(12, 2.2), (4, 5.3), (4, 11.4)]
    pts += bez((4, 11.4), (4, 16.4), (7.4, 20.7), (12, 21.8))[1:]
    pts += bez((12, 21.8), (16.6, 20.7), (20, 16.4), (20, 11.4))[1:]
    pts += [(20, 5.3)]
    return [(ox + x*scale, oy + y*scale) for x, y in pts]
def bars(scale, ox, oy):
    # 4 sound bars (x, y1, y2) in 24 units
    return [((ox + x*scale), oy + a*scale, oy + b*scale) for x, a, b in [(8.2, 11.2, 12.4), (10.7, 9, 14.6), (13.3, 8, 15.6), (15.8, 10.2, 13.4)]]
def grad(w, h, c1, c2):
    g = Image.new('RGBA', (w, h))
    px = g.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(c1[i]*(1-t) + c2[i]*t) for i in range(3)) + (255,)
        for x in range(w):
            px[x, y] = c
    return g
def app_icon():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((40, 40, S-40, S-40), radius=210, fill=(12, 16, 21, 255), outline=(38, 48, 60, 255), width=10)
    sc = 36; ox = S/2 - 12*sc; oy = S/2 - 12*sc + 10
    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.polygon(shield(sc, ox, oy), fill=255)
    inner = Image.new('L', (S, S), 0)
    ImageDraw.Draw(inner).polygon(shield(sc*0.86, ox + 12*sc*0.14, oy + 12*sc*0.14), fill=255)
    ring = Image.eval(mask, lambda v: v)
    ring.paste(0, (0, 0), inner)
    g = grad(S, S, (63, 225, 151), (53, 208, 238))
    im.paste(g, (0, 0), ring)
    d = ImageDraw.Draw(im)
    for x, a, b in bars(sc, ox, oy):
        d.rounded_rectangle((x - 0.95*sc, a - 0.6*sc, x + 0.95*sc, b + 0.6*sc), radius=int(0.95*sc), fill=(63, 225, 151, 255))
    # glow
    return im
def tray_icon(col):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    sc = S / 22.5; ox = S/2 - 12*sc; oy = S/2 - 12*sc + 6
    d.polygon(shield(sc, ox, oy), fill=col + (255,))
    for x, a, b in bars(sc, ox, oy):
        d.rounded_rectangle((x - 0.95*sc, a - 0.55*sc, x + 0.95*sc, b + 0.55*sc), radius=int(0.95*sc), fill=(10, 13, 17, 255))
    return im
def save_ico(im, path, sizes):
    ims = [im.resize((s, s), Image.LANCZOS) for s in sizes]
    ims[0].save(path, format='ICO', sizes=[(s, s) for s in sizes], append_images=ims[1:])
    return ims
os.makedirs('winres', exist_ok=True)
app = app_icon()
app.resize((256, 256), Image.LANCZOS).save('winres/icon.png')
save_ico(app, 'winres/app.ico', [256, 128, 64, 48, 32, 24, 20, 16])
for name, col in [('ok', (63, 225, 151)), ('warn', (255, 182, 72)), ('bad', (255, 90, 95))]:
    t = tray_icon(col)
    t.resize((256, 256), Image.LANCZOS).save('winres/tray-%s.png' % name)
print('icons ok')
