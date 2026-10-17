"""WRATH's transform sound (the snap in GLARE, over the heartbeat): ONLY bones
creaking and cracking - no flesh, no blood. Slow creaks first, then cracks
coming faster and louder, the biggest crunch when the eye rips out.

Real recordings from OpenGameArt, downloaded into a cache (never committed),
all at their real pitch:
  "Crunching Bones" by spookymodem (CC-BY 3.0)
  "A Lotta Bones Sound FX" by nerdzmasterz (CC-BY 3.0)
  "Cracking sounds" by varkalandar (CC-BY 3.0)
  "Bones 2" (CC0)

  python3 fnf2/tools/own/sfx_transform.py OUT.wav      # 4.8 s, the biggest crunch lands at 3.2 s
"""
import os, sys, urllib.request
import numpy as np
import soundfile as sf
import pedalboard as pb
from scipy import signal

SR = 44100
LEN = 4.8
RIP = 3.2          # the eye rips out (= bar 35 in GLARE)
CACHE = os.path.expanduser('~/.cache/fnf2/bones')
OGA = 'https://opengameart.org/sites/default/files/'
CRUNCH, RATTLE, CRACKS1, CRACKS2, CREAK = ('Crunching%20Bones.wav', 'bonessoundfx.ogg', 'multiple_cracks_1.wav',
                                          'multiple_cracks_2.wav', 'bones-2.wav')


def load(name):
    p = os.path.join(CACHE, name.replace('%20', '_'))
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        with urllib.request.urlopen(OGA + name) as r: data = r.read()
        open(p, 'wb').write(data)
    x, sr = sf.read(p)
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    return x


def norm(x): return x / (np.abs(x).max() + 1e-9)


def events(x, thr=-34, pad=0.03, maxlen=0.6):
    """Cut a recording into its separate cracks/crunches (loudest last)."""
    h = SR // 100
    db = 20 * np.log10(np.array([np.sqrt((x[i:i + h] ** 2).mean()) for i in range(0, len(x) - h, h)]) + 1e-9)
    out, i = [], 0
    while i < len(db):
        if db[i] > thr:
            b = i
            while b < len(db) and db[b] > thr - 8 and (b - i) * h < maxlen * SR: b += 1
            a0, b0 = max(0, i * h - int(pad * SR)), min(len(x), b * h + int(pad * SR))
            seg = x[a0:b0].copy()
            f = int(0.004 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f * 4:] *= np.linspace(1, 0, f * 4)
            out.append((float(db[i:b].max()), seg))
            i = b + 2
        else: i += 1
    return [s for _, s in sorted(out, key=lambda e: e[0])]


class Buf:
    def __init__(self): self.x = np.zeros(int((LEN + 1.0) * SR))
    def add(self, t, y, g=1.0):
        i = int(t * SR)
        y = y[:len(self.x) - i]
        self.x[i:i + len(y)] += y * g


def render():
    crunch = load(CRUNCH)
    cracks = events(crunch) + events(load(RATTLE)) + events(load(CRACKS1)) + events(load(CRACKS2))
    cracks = [norm(c) for c in cracks if len(c) > 0.03 * SR]
    rng = np.random.default_rng(5)
    B = Buf()
    # slow creaking joints under everything, louder as it goes
    creak = norm(load(CREAK))
    t = 0.0
    while t < RIP:
        B.add(t, creak * np.interp(t, [0, RIP], [0.3, 0.6]))
        t += len(creak) / SR - 0.15
    # cracks: a few slow ones, then faster and louder
    t = 0.3
    while t < RIP - 0.12:
        k = t / RIP
        c = cracks[int(rng.integers(0, max(1, int(len(cracks) * (0.4 + 0.5 * k)))))]
        B.add(t, c, 0.6 + 0.4 * k)
        t += rng.uniform(0.35, 0.6) * (1 - 0.65 * k)
    # the eye rips out: the 3 loudest crunches stacked
    for j, c in enumerate(cracks[-3:]): B.add(RIP + 0.012 * j, c, 1.2)
    B.add(RIP + 0.4, cracks[-4], 0.45); B.add(RIP + 0.75, cracks[-6], 0.3)

    mix = B.x[:int((LEN + 0.6) * SR)]
    d = int(0.006 * SR)
    st = np.stack([mix, np.concatenate([np.zeros(d), mix[:-d]]) * 0.85 + mix * 0.15]).astype(np.float32)
    st = pb.Pedalboard([pb.HighpassFilter(150), pb.Reverb(room_size=0.15, wet_level=0.06, dry_level=1.0, width=0.5),
                        pb.Compressor(threshold_db=-14, ratio=2, attack_ms=2, release_ms=80)])(st, SR)
    st = st / np.abs(st).max() * 0.89
    f = int(0.4 * SR); st[:, -f:] *= np.linspace(1, 0, f)
    return st


if __name__ == '__main__':
    out = render()
    sf.write(sys.argv[1], out.T, SR)
    print('wrote', sys.argv[1], round(out.shape[1] / SR, 2), 's')
