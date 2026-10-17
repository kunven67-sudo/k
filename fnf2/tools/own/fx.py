"""Effects for WRATH's scenes, made from FNF's own effect art (PRIVATE build only, written to the
git-ignored build/own folder, never the repo):

  fx/ice-zap      Weekend 1's spray can impact flash, yellow -> icy blue (BF's brain freeze)
  fx/ice-twinkle  Freeplay's little sparkle, orange -> icy white-blue (twinkles round his head)
  fx/ice-sparks   Freeplay's spark burst, white -> ice blue (so it shows on a bright day)
  fx/can-impact   Weekend 1's spray can impact flash, as it is (the cone hitting the trash can)
  fx/dust         Weekend 1's spray paint explosion smoke ring, recoloured to dust, flattened onto the
                  ground (footsteps, landings, the trash can clang)

  fx/eye-note     WRATH's void eye (tools/own/wrath_eye.py) at arrow size: GLARE's DON'T-HIT notes
  sounds/wrath-battle/glitch.ogg + eye-stare.ogg   FNF's TV static + Week 2 thunder, cut and layered

  python3 tools/own/fx.py
"""
import os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FA = os.environ.get('FA', '/home/user/ref/fa')
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'fx')
sys.path.insert(0, HERE)
from repack_sparrow import repack


def recolour(png, xml, out_base, fn, keep=None, scale=0.5, squash=1.0):
    """Recolour every pixel of a Sparrow sheet with fn(rgb, alpha) -> (rgb, alpha), then repack it small."""
    tmp = out_base + '-src'
    im = np.asarray(Image.open(png).convert('RGBA')).astype(np.float32)
    rgb, al = fn(im[..., :3], im[..., 3])
    Image.fromarray(np.dstack([rgb, al]).clip(0, 255).astype(np.uint8)).save(tmp + '.png')
    x = open(xml, encoding='utf-8-sig').read().replace(os.path.basename(png), os.path.basename(tmp) + '.png')
    open(tmp + '.xml', 'w').write(x)
    repack(tmp + '.png', tmp + '.xml', out_base, keep=keep, scale=scale)
    os.remove(tmp + '.png'); os.remove(tmp + '.xml')
    if squash != 1.0: flatten(out_base, squash)


def flatten(base, k):
    """Squash every frame of a sheet vertically (seen lying on the ground), keeping the bottom line."""
    sheet = Image.open(base + '.png').convert('RGBA')
    xml = open(base + '.xml').read()
    out, lines = [], []
    for m in re.finditer(r'<SubTexture\b([^>]*)/>', xml):
        a = dict(re.findall(r'([\w]+)="([^"]*)"', m.group(1)))
        x, y, w, h = (int(a[n]) for n in ('x', 'y', 'width', 'height'))
        out.append((a, sheet.crop((x, y, x + w, y + h)).resize((w, max(1, round(h * k))), Image.LANCZOS)))
    # re-stack: one row each is fine (these sheets are small)
    W = max(p.width for _, p in out) + 2
    H = sum(p.height + 2 for _, p in out)
    s = Image.new('RGBA', (W, H), (0, 0, 0, 0)); y = 0
    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="%s.png">' % os.path.basename(base)]
    for a, p in out:
        s.paste(p, (0, y))
        fy = round(int(a['frameY']) * k); fh = max(1, round(int(a['frameHeight']) * k))
        lines.append('\t<SubTexture name="%s" x="0" y="%d" width="%d" height="%d" frameX="%s" frameY="%d" frameWidth="%s" frameHeight="%d"/>'
                     % (a['name'], y, p.width, p.height, a['frameX'], fy, a['frameWidth'], fh))
        y += p.height + 2
    lines.append('</TextureAtlas>')
    s.save(base + '.png'); open(base + '.xml', 'w').write('\n'.join(lines) + '\n')


def ice(rgb, al):
    """Yellow/orange -> icy blue; white stays white (a hair of blue)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sat = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) / 255
    icy = np.stack([lum * 0.45, lum * 0.86, lum * 1.12], -1)
    white = np.stack([lum * 0.93, lum * 0.98, lum * 1.0], -1)
    k = np.clip(sat * 2.2, 0, 1)[..., None]
    return np.clip(white * (1 - k) + icy * k, 0, 255), al


def blue(rgb, al):
    """White streaks -> light ice blue."""
    return rgb * np.array([0.5, 0.82, 1.0], np.float32), al


def dust(rgb, al):
    """The explosion's smoke ring -> dusty tan clouds (2 tones, like FNF's), red bits -> the dark tone."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    hot = (r > g + 50) & (r > b + 20)                                   # the red/orange flame bits
    light = np.array([238, 226, 206], np.float32); darkc = np.array([183, 165, 140], np.float32)
    k = np.clip((lum - 90) / 70, 0, 1)[..., None]
    out = darkc * (1 - k) + light * k
    out[hot] = darkc
    return out, al


def eye_note():
    """The void eye (spikes + eyeball + red ring iris) shrunk to the size of an FNF arrow."""
    d = os.path.join(ROOT, 'build', 'own', 'shared', 'images', 'characters', 'wrath-eye')
    m = __import__('json').load(open(os.path.join(d, 'meta.json')))['looks']['void']
    back = Image.open(os.path.join(d, m['back'] + '.png')).convert('RGBA')
    iris = Image.open(os.path.join(d, m['iris'] + '.png')).convert('RGBA')
    cx, cy = m['irisAt']
    back.alpha_composite(iris, (int(round(cx - iris.width / 2)), int(round(cy - iris.height / 2))))
    back = back.crop(back.getbbox())
    w = 200; back = back.resize((w, round(back.height * w / back.width)), Image.LANCZOS)
    back.save(os.path.join(OUT, 'eye-note.png'))


def sounds():
    import subprocess
    sd = os.path.join(ROOT, 'build', 'own', 'shared', 'sounds', 'wrath-battle'); os.makedirs(sd, exist_ok=True)
    static = os.path.join(FA, 'preload', 'sounds', 'static loop.ogg')
    thunder = os.path.join(FA, 'week2', 'sounds', 'thunder_1.ogg')
    run = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
    # a short burst of TV static (teleports, glitch notes)
    run('-i', static, '-af', 'atrim=0.3:0.48,afade=t=in:d=0.01,afade=t=out:st=0.08:d=0.1,volume=0.8', '-c:a', 'libvorbis', '-q:a', '5', os.path.join(sd, 'glitch.ogg'))
    # the eye stares at you: static cutting out over a deep, slowed thunder roll
    run('-i', static, '-i', thunder, '-filter_complex',
        '[0]atrim=1.2:1.9,afade=t=out:st=0.25:d=0.45,volume=0.55[a];'
        '[1]asetrate=44100*0.7,aresample=44100,atrim=0:2.4,afade=t=out:st=1.2:d=1.2,volume=1.3[b];'
        '[a][b]amix=inputs=2:normalize=0', '-c:a', 'libvorbis', '-q:a', '5', os.path.join(sd, 'eye-stare.ogg'))


def main():
    os.makedirs(OUT, exist_ok=True)
    w1 = os.path.join(FA, 'weekend1', 'images')
    recolour(os.path.join(w1, 'CanImpactParticle.png'), os.path.join(w1, 'CanImpactParticle.xml'), os.path.join(OUT, 'ice-zap'), ice, scale=0.6)
    fp = os.path.join(FA, 'preload', 'images', 'freeplay')
    recolour(os.path.join(w1, 'CanImpactParticle.png'), os.path.join(w1, 'CanImpactParticle.xml'), os.path.join(OUT, 'can-impact'), lambda rgb, al: (rgb, al), scale=0.6)
    recolour(os.path.join(fp, 'sparkle.png'), os.path.join(fp, 'sparkle.xml'), os.path.join(OUT, 'ice-twinkle'), ice, scale=1.0)
    recolour(os.path.join(fp, 'sparks.png'), os.path.join(fp, 'sparks.xml'), os.path.join(OUT, 'ice-sparks'), blue, scale=0.5)
    # the smoke only (frames 5..12: no white flash, no fire, no solid ring), small + flat on the ground
    keep = ['explosion round 1 short%04d' % i for i in range(5, 13)]
    recolour(os.path.join(w1, 'spraypaintExplosionEZ.png'), os.path.join(w1, 'spraypaintExplosionEZ.xml'), os.path.join(OUT, 'dust'), dust,
             keep=keep, scale=0.22, squash=0.5)
    eye_note()
    sounds()
    print('wrote', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
