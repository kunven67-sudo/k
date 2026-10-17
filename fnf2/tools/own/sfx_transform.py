"""WRATH's transform sound (the snap in GLARE, over the heartbeat): real recorded
bone breaks, getting faster and louder, the biggest one when the eye rips out.

The recordings are CC0 packs from OpenGameArt ("Fleshy bone break/snap SFX"),
downloaded into a cache the first time, never committed. Only the crisp,
cracking ones are used, at their real pitch (low/deep breaks sounded like plops).
If fnf2/private/transform-ref.wav exists (a private recording, never committed),
its cracking is the main sound and the CC0 cracks only punch up the pull-out.

  python3 fnf2/tools/own/sfx_transform.py OUT.wav      # 4.8 s, the biggest break lands at 3.2 s
"""
import io, os, sys, urllib.request, zipfile
import numpy as np
import soundfile as sf
import pedalboard as pb
from scipy import signal

SR = 44100
LEN = 4.8
RIP = 3.2          # the big pull-out (= bar 35 in GLARE)
CACHE = os.path.expanduser('~/.cache/fnf2/gore')
# a private bone-crack recording the user gave us (git-ignored); used when it's there
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'private', 'transform-ref.wav')
REF_AT = 0.35      # start of its densest cracking
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
    # only the crisp, cracking breaks (the deep/low ones sounded like plops), at their real pitch
    hp = signal.butter(2, 300, 'high', fs=SR, output='sos')
    crack = [norm(signal.sosfilt(hp, load(('wet_breaks.zip', 'Wet Break %d.wav' % k)))) for k in (10, 5, 8, 9, 3, 2, 7)]

    B = {'bone': Buf()}
    if os.path.exists(REF):
        # the user's own bone-crack recording (private): its densest 4.8 s, swelling up to the pull-out
        x, sr = sf.read(REF)
        x = x.mean(1) if x.ndim > 1 else x
        if sr != SR: x = signal.resample_poly(x, SR, sr)
        seg = x[int(REF_AT * SR):int((REF_AT + LEN) * SR)]
        ramp = np.interp(np.arange(len(seg)) / SR, [0, RIP, LEN], [0.55, 1.0, 0.8])
        f = int(0.03 * SR); seg = seg * ramp; seg[:f] *= np.linspace(0, 1, f)
        B['bone'].add(0, norm(seg), 1.0)
        for j, k in enumerate((0, 1, 2)): B['bone'].add(RIP + 0.015 * j, crack[k], 0.55)
    else:
        # bones breaking: a few cracks, then faster and louder, the biggest one on the pull-out
        hits = [(0.4, .35), (1.0, .45), (1.6, .7), (2.0, .75), (2.25, .55), (2.4, .85), (2.6, .6), (2.8, .9), (2.95, .7), (3.08, .8)]
        for i, (bt, g) in enumerate(hits):
            B['bone'].add(bt, crack[i % len(crack)], g)
        for j, k in enumerate((0, 1, 2)): B['bone'].add(RIP + 0.015 * j, crack[k], 1.3)
        B['bone'].add(RIP + 0.45, crack[3], 0.5); B['bone'].add(RIP + 0.8, crack[4], 0.35)

    def lvl(x, db):
        r = np.sqrt((x[np.abs(x) > np.abs(x).max() * 0.05] ** 2).mean())
        return x * 10 ** (db / 20) / max(r, 1e-9)
    mix = lvl(B['bone'].x, -13)
    mix = mix[:int((LEN + 0.6) * SR)]
    d = int(0.006 * SR)
    st = np.stack([mix, np.concatenate([np.zeros(d), mix[:-d]]) * 0.85 + mix * 0.15]).astype(np.float32)
    st = pb.Pedalboard([pb.HighpassFilter(120),
                        pb.Reverb(room_size=0.2, wet_level=0.08, dry_level=1.0, width=0.5),
                        pb.Compressor(threshold_db=-12, ratio=2, attack_ms=3, release_ms=100)])(st, SR)
    st = st / np.abs(st).max() * 0.89
    f = int(0.4 * SR); st[:, -f:] *= np.linspace(1, 0, f)
    return st


if __name__ == '__main__':
    out = render()
    sf.write(sys.argv[1], out.T, SR)
    print('wrote', sys.argv[1], round(out.shape[1] / SR, 2), 's')
