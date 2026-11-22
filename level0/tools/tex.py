# Builds LEVEL 0 textures from CC0 scans (ambientCG + Poly Haven).
# Run: python3 tools/tex.py <src-dir> ; src-dir has cand/ (ambientCG 1K-JPG unzipped), ph/ and ph2/ (Poly Haven)
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)

def load(p, size=None, mode='RGB'):
    im = Image.open(os.path.join(SRC, p)).convert(mode)
    if size: im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0

def save(a, name, q=90):
    a = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, name), quality=q)
    print(name, a.shape)

def lum(a): return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

def tileable_blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    w, h = im.size
    big = Image.new(im.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3): big.paste(im, (i * w, j * h))
    big = big.filter(ImageFilter.GaussianBlur(r)).crop((w, h, 2 * w, 2 * h))
    return np.asarray(big).astype(np.float32) / 255.0

# ---------- CARPET: Carpet016 scan, warmed to the old damp tan, real normal ----------
c = load('cand/Carpet016/Carpet016_1K-JPG_Color.jpg')
c = c * np.array([0.90, 0.80, 0.52])          # a touch more yellow
c = np.clip((c - 0.5) * 0.9 + 0.5 - 0.04, 0, 1)
save(c, 'carpet_col.jpg')
save(load('cand/Carpet016/Carpet016_1K-JPG_NormalGL.jpg'), 'carpet_nrm.jpg')

# large damp stains: luminance of the dirty_carpet scan, blurred, used at a big scale
d = lum(load('cand/Wallpaper002C/Wallpaper002C_1K-JPG_Color.jpg', 512))
d = tileable_blur(d, 4)
d = (d - d.mean()) / (d.std() + 1e-5)
stain = np.clip(0.5 + d * 0.22, 0, 1)
save(np.stack([stain] * 3, -1), 'carpet_stain.jpg')

# ---------- CEILING: OfficeCeiling001 tile grid x stucco speckle, slightly yellowed ----------
g = load('cand/OfficeCeiling001/OfficeCeiling001_1K-JPG_Color.jpg')
st = lum(load('ph2/white_stucco_diff_1k.jpg'))
st = st / st.mean()
st = np.clip(1 + (st - 1) * 0.55, 0.6, 1.3)
ceil = g * st[..., None] * np.array([0.90, 0.85, 0.66])
save(np.clip(ceil, 0, 1), 'ceil_col.jpg')
save(load('cand/OfficeCeiling001/OfficeCeiling001_1K-JPG_NormalGL.jpg'), 'ceil_nrm.jpg')

# ---------- LIGHT PANEL: two prismatic panels from OfficeCeiling004 (one 0.6 x 1.2 m fixture) ----------
p = Image.open(os.path.join(SRC, 'cand/OfficeCeiling004/OfficeCeiling004_1K-JPG_Color.jpg')).convert('RGB')
cell = 1024 / 6
crop = p.crop((int(cell * 0) + 2, int(cell * 0) + 2, int(cell * 2) - 2, int(cell * 1) - 2)).resize((512, 256), Image.LANCZOS)
pa = np.asarray(crop).astype(np.float32) / 255.0
L = lum(pa)
warm = np.array([1.0, 0.97, 0.86])
panel = np.clip(L[..., None] * warm * 1.05, 0, 1)
save(panel, 'panel_col.jpg')

# ---------- WALLPAPER: mono-yellow stripe print on a real paper scan ----------
S = 1024 * 2          # supersampled; texture covers 0.8 m x 0.8 m of wall
per = S // 8          # 10 cm stripe period
img = Image.new('L', (S, S), 255)
dr = ImageDraw.Draw(img)
for k in range(8):
    x0 = k * per
    dr.rectangle([x0, 0, x0 + 5, S], fill=200)                 # thin divider line
    dr.rectangle([x0 + per // 2 - 2, 0, x0 + per // 2 + 2, S], fill=228)
    cx = x0 + per // 4
    cx2 = x0 + 3 * per // 4
    step = per // 2
    for y in range(-step, S + step, step):
        for xx, yy in ((cx, y), (cx2, y + step // 2)):
            w, h = per // 6, step // 4
            dr.line([(xx - w, yy + h), (xx, yy), (xx + w, yy + h)], fill=205, width=7)
            dr.line([(xx - w, yy + h + 14), (xx, yy + 14), (xx + w, yy + h + 14)], fill=218, width=5)
img = img.filter(ImageFilter.GaussianBlur(2.2)).resize((1024, 1024), Image.LANCZOS)
pat = np.asarray(img).astype(np.float32) / 255.0
base = np.array([0.82, 0.70, 0.30])
paper = lum(load('cand/Wallpaper001A/Wallpaper001A_1K-JPG_Color.jpg'))
paper = paper / paper.mean()
paper = np.clip(1 + (paper - 1) * 1.4, 0.75, 1.2)
stains = lum(load('cand/Wallpaper002B/Wallpaper002B_1K-JPG_Color.jpg'))
stains = np.clip((stains - stains.mean()) / (stains.std() + 1e-5), -3, 3)
dirt = np.clip(1 + np.minimum(stains, 0) * 0.018, 0.93, 1.0)
wall = base * pat[..., None] * paper[..., None] * dirt[..., None]
# faint brown water tint in the darkest stain spots
wall = wall * (1 - 0.015 * np.clip(-stains, 0, 2)[..., None] * np.array([0.0, 0.3, 0.9]))
save(np.clip(wall, 0, 1), 'wall_col.jpg')
save(load('cand/Wallpaper001A/Wallpaper001A_1K-JPG_NormalGL.jpg'), 'wall_nrm.jpg')
