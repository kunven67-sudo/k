"""WRATH's transform sound (the snap in GLARE, over the heartbeat): real recorded
gore foley cut up and layered. Meat ripping builds up, bones break, and the
eye tears out with a wet splat, then slime drips.

The recordings are CC0 sound packs from OpenGameArt (downloaded into a cache
the first time, never committed):
  "Ripping into meat", "Fleshy bone break/snap SFX", "Deep bone crack/break SFX",
  "8 wet squish slurp impacts", "Slimy monster or murder sounds", "Squish sounds effects"

  python3 fnf2/tools/own/sfx_transform.py OUT.wav      # 4.8 s, the pull-out lands at 3.2 s
"""
import io, os, sys, urllib.request, zipfile
import numpy as np
import soundfile as sf
import pedalboard as pb
from scipy import signal

SR = 44100
LEN = 4.8
RIP = 3.2          # the big pull-out (= bar 35 in GLARE)
PITCH = 0.88       # everything a bit lower = a bigger, heavier body
CACHE = os.path.expanduser('~/.cache/fnf2/gore')
OGA = 'https://opengameart.org/sites/default/files/'
FILES = ['rippingintomeat_0.mp3', 'wet_breaks.zip', 'deep_breaks.zip', 'independent_nu_ljudbank-wet_squish_slurp_impacts.7z',
         'squish_02.mp3', 'squish_04.mp3', 'squish_06.mp3', 'squishsplat_impact.mp3'] + \
        ['slimy_monster_or_murderd_sound%s.mp3' % s for s in ('', '_1', '_2', '_3', '_4', '_5', '_6', '_7')]
rng = np.random.default_rng(13)


def fetch(name):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        with urllib.request.urlopen(OGA + name) as r: data = r.read()
        open(p, 'wb').write(data)
    return p


def load(src):
    """file path or (archive, member) -> mono float at SR"""
    if isinstance(src, tuple):
        arc, member = src
        if arc.endswith('.zip'): x, sr = sf.read(io.BytesIO(zipfile.ZipFile(fetch(arc)).read(member)))
        else:
            import py7zr
            with py7zr.SevenZipFile(fetch(arc)) as z: x, sr = sf.read(z.read([member])[member])
    else: x, sr = sf.read(fetch(src))
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    return x


def heavy(x, k=PITCH):
    """Pitch + slow down together (tape style) -> bigger and heavier."""
    return signal.resample(x, int(len(x) / k))


def env_db(x, h):
    return 20 * np.log10(np.array([np.sqrt((x[i:i + h] ** 2).mean()) for i in range(0, len(x) - h, h)]) + 1e-9)


def rips(x):
    """Cut the loud tearing moments out of the long meat-ripping recording."""
    h = SR // 50
    db = env_db(x, h)
    out, i = [], 0
    while i < len(db):
        if db[i] > -17:
            a = max(0, i - 3)
            b = i
            while b < len(db) and (db[b] > -27 or b - i < 8) and b - a < 35: b += 1
            seg = x[a * h:b * h].copy()
            f = int(0.01 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-4 * f:] *= np.linspace(1, 0, 4 * f)
            out.append((seg, float(db[i:b].max())))
            i = b + 5
        else: i += 1
    return out


def bed(x, dur):
    """The quiet wet handling between the rips: squelchy meat noise to build on."""
    h = SR // 50
    e = env_db(x, h)
    quiet = [i for i in range(len(e) - 40) if (e[i:i + 40] < -20).all() and (e[i:i + 40] > -34).all()]
    n = int(dur * SR); y = np.zeros(n); pos = 0; f = int(0.05 * SR)
    while pos < n:
        i = quiet[rng.integers(len(quiet))] * h
        seg = x[i:i + int(0.8 * SR)].copy()
        seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        y[pos:pos + len(seg)] += seg[:n - pos]
        pos += len(seg) - f
    return y


class Buf:
    def __init__(self): self.x = np.zeros(int((LEN + 1.5) * SR))
    def add(self, t, y, g=1.0):
        i = int(t * SR)
        y = y[:len(self.x) - i]
        self.x[i:i + len(y)] += y * g


def norm(x): return x / (np.abs(x).max() + 1e-9)


def render():
    meat = load(FILES[0])
    R = sorted(rips(meat), key=lambda r: r[1])                     # quietest -> loudest rip
    wet = [norm(heavy(load(('wet_breaks.zip', 'Wet Break %d.wav' % k)))) for k in range(1, 11)]
    deep = [norm(heavy(load(('deep_breaks.zip', 'Deep Break %d.wav' % k)))) for k in range(1, 11)]
    try: splat = [norm(heavy(load((FILES[3], 'impsplat/impactsplat0%d.mp3.flac' % k)), 0.8)) for k in (1, 3, 5, 8)]
    except Exception: splat = [norm(heavy(load('squishsplat_impact.mp3'), 0.8))]
    slime = [norm(heavy(load(f), 0.8)) for f in FILES[8:]]
    squish = [norm(heavy(load(f), 0.85)) for f in FILES[4:8]]

    B = {k: Buf() for k in ('bed', 'rip', 'bone', 'splat', 'slime')}
    # it starts inside him: wet meat squelching that gets louder
    b = norm(heavy(bed(meat, RIP + 0.3)))
    B['bed'].add(0.0, b * np.linspace(0.2, 0.8, len(b)) ** 1.5)
    # rips tearing more and more often, getting louder, the loudest saved for the pull-out
    small, big = R[:len(R) // 2], R[len(R) // 2:-1]
    t, k = 0.25, 0
    while t < RIP - 0.25:
        prog = t / RIP
        pool = small if prog < 0.45 else big
        B['rip'].add(t, norm(heavy(pool[k % len(pool)][0])), 0.3 + 0.7 * prog)
        t += rng.uniform(0.32, 0.5) * (1 - 0.5 * prog); k += 1
    # bones breaking (the 4 big ones on the beat at 150 BPM, smaller ones in between)
    for i, (bt, g) in enumerate(((1.6, 1.0), (2.0, 1.0), (2.25, 0.6), (2.4, 1.0), (2.6, 0.55), (2.8, 1.0), (3.0, 0.7))):
        B['bone'].add(bt, (wet if i % 2 == 0 else deep)[i], g)
        if g == 1.0: B['bone'].add(bt + 0.01, deep[(i + 5) % 10], 0.5)
    # THE PULL-OUT: the loudest rip + a deep break + wet splats
    B['rip'].add(RIP - 0.08, norm(heavy(R[-1][0])), 2.2)
    B['bone'].add(RIP, deep[2], 1.6)
    B['splat'].add(RIP + 0.03, splat[0], 1.8)
    B['splat'].add(RIP + 0.08, squish[3], 1.1)
    # the eye squelches out: slime + splats dripping
    for j, dt in enumerate((0.3, 0.55, 0.8, 1.05, 1.3)):
        B['slime'].add(RIP + dt, slime[j % len(slime)], 0.9 - 0.12 * j)
    for j, dt in enumerate((0.45, 0.95)):
        B['splat'].add(RIP + dt, splat[(j + 1) % len(splat)], 0.5 - 0.15 * j)
    B['slime'].add(RIP + 0.2, squish[0], 0.6)

    def lvl(x, db):
        r = np.sqrt((x[np.abs(x) > np.abs(x).max() * 0.05] ** 2).mean())
        return x * 10 ** (db / 20) / max(r, 1e-9)
    mix = lvl(B['bed'].x, -22) + lvl(B['rip'].x, -15) + lvl(B['bone'].x, -13) + lvl(B['splat'].x, -12) + lvl(B['slime'].x, -16)
    mix = mix[:int((LEN + 0.6) * SR)]
    d = int(0.006 * SR)
    st = np.stack([mix, np.concatenate([np.zeros(d), mix[:-d]]) * 0.85 + mix * 0.15]).astype(np.float32)
    st = pb.Pedalboard([pb.HighpassFilter(40), pb.LowShelfFilter(cutoff_frequency_hz=180, gain_db=3),
                        pb.Reverb(room_size=0.2, wet_level=0.08, dry_level=1.0, width=0.5),
                        pb.Compressor(threshold_db=-12, ratio=2, attack_ms=3, release_ms=100)])(st, SR)
    st = st / np.abs(st).max() * 0.89
    f = int(0.4 * SR); st[:, -f:] *= np.linspace(1, 0, f)
    return st


if __name__ == '__main__':
    out = render()
    sf.write(sys.argv[1], out.T, SR)
    print('wrote', sys.argv[1], round(out.shape[1] / SR, 2), 's')
