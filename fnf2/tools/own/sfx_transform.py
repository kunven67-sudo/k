"""WRATH's transform sound (the snap in GLARE, over the heartbeat): wet squish, flesh tearing, bones
cracking, goo stretching, then one big wet pull-out and the eye squelching open.
All made in code (numpy + pedalboard), nothing sampled.

  python3 fnf2/tools/own/sfx_transform.py OUT.wav      # 4.8 s, the pull-out lands at 3.2 s

glare.py drops it into the snap (bar 33, so the pull-out hits bar 35 with the boom).
"""
import sys
import numpy as np
import soundfile as sf
import pedalboard as pb
from scipy import signal

SR = 44100
LEN = 4.8
RIP = 3.2          # the big pull-out (= bar 35 in GLARE)
rng = np.random.default_rng(13)


def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))


def bandnoise(n, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), rng.uniform(-1, 1, n))


def reson(x, f, q):
    b, a = signal.iirpeak(min(f, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x)


def glide_sine(n, f0, f1, curve=1.0):
    f = f0 * (f1 / f0) ** (np.linspace(0, 1, n) ** curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


class Buf:
    def __init__(self): self.x = np.zeros(int(LEN * SR) + SR)
    def add(self, t, y, g=1.0):
        i = int(t * SR)
        if i < 0: y, i = y[-i:], 0
        y = y[:len(self.x) - i]
        self.x[i:i + len(y)] += y * g


def bubble(f0=None, tau=None):
    """A wet goo bubble: a short sine that pitches UP as it pops."""
    f0 = f0 or rng.uniform(250, 900)
    tau = tau or rng.uniform(0.008, 0.025)
    n = int(tau * 6 * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 9 * t / (tau * 6))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, tau) * (1 - np.exp(-np.arange(n) / 30))


def squish(dur=None, c=None):
    """One squelch: noise through a moving mouth-like resonance + a few bubbles."""
    dur = dur or rng.uniform(0.05, 0.16)
    n = int(dur * SR)
    c = c or rng.uniform(280, 900)
    nz = rng.uniform(-1, 1, n)
    # cut the burst in pieces with the resonance sliding down (the 'shlorp')
    out = np.zeros(n); hop = 256
    for k in range(0, n, hop):
        f = c * (1 - 0.55 * k / n)
        seg = reson(nz[max(0, k - 512):k + hop], f, 4.5)[-min(hop, n - k):]
        out[k:k + len(seg)] = seg
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 0.7
    y = out * e
    for _ in range(rng.integers(1, 4)):
        b = bubble(c * rng.uniform(0.7, 1.5))
        p = rng.integers(0, max(1, n - len(b) // 2))
        y[p:p + len(b)] += b[:n - p] * 0.35
    return y


def crackle(dur, rate0, rate1, lo=900, hi=5000, gain=1.0):
    """Tearing flesh: lots of tiny wet cracks, getting denser (rate per second)."""
    n = int(dur * SR)
    y = np.zeros(n)
    t = 0.0
    while t < dur:
        r = rate0 + (rate1 - rate0) * (t / dur)
        t += rng.exponential(1 / r)
        i = int(t * SR)
        if i >= n: break
        m = int(rng.uniform(0.002, 0.009) * SR)
        g = bandnoise(m, lo * rng.uniform(0.7, 1.3), hi) * env_exp(m, rng.uniform(0.0008, 0.003))
        y[i:i + m] += g[:n - i] * rng.uniform(0.3, 1.0)
    # fibrous strands stretching under it
    fib = bandnoise(n, 500, 2600) * np.abs(signal.sosfilt(signal.butter(1, 35, 'low', fs=SR, output='sos'), rng.uniform(-1, 1, n))) * 6
    return (y + fib * 0.35) * gain


def bone_crack():
    """A sharp crack: snap transient + short knocking modes + a small thud."""
    n = int(0.25 * SR)
    snap = bandnoise(n, 1800, 9000) * env_exp(n, 0.004)
    modes = sum(np.sin(2 * np.pi * f * np.arange(n) / SR) * env_exp(n, tau) * a
                for f, tau, a in ((rng.uniform(900, 1300), 0.03, .5), (rng.uniform(2000, 2600), 0.018, .35), (rng.uniform(3100, 3800), 0.012, .25)))
    thud = glide_sine(n, 140, 60) * env_exp(n, 0.05) * 0.6
    y = snap * 1.7 + modes * 1.2 + thud
    # a second splinter right after
    d = int(rng.uniform(0.012, 0.03) * SR)
    y[d:] += (bandnoise(n, 2500, 9000) * env_exp(n, 0.003))[:n - d] * 0.6
    return y


def suction_pop():
    """The pull-out: wet suction release, a deep drop and a goo slap."""
    n = int(0.9 * SR)
    pop = glide_sine(n, 900, 70, 0.45) * env_exp(n, 0.07)
    body = signal.sosfilt(signal.butter(2, 400, 'low', fs=SR, output='sos'), rng.uniform(-1, 1, n)) * env_exp(n, 0.12) * 3
    slap = bandnoise(n, 300, 2500) * env_exp(n, 0.03)
    return pop * 0.9 + body * 0.8 + slap * 0.7


def stretch_goo(dur):
    """Thick goo pulling apart: low wet groan + bubbles popping all over it."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 70 + 40 * np.sin(2 * np.pi * 0.7 * t) + 25 * t / dur
    groan = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * 2.5) * 0.25
    groan = signal.sosfilt(signal.butter(2, 600, 'low', fs=SR, output='sos'), groan) * np.linspace(0.2, 1, n)
    y = groan
    for _ in range(int(dur * 28)):
        b = bubble()
        p = rng.integers(0, n - len(b))
        y[p:p + len(b)] += b * rng.uniform(0.15, 0.45)
    return y


def render():
    B = {k: Buf() for k in ('wet', 'tear', 'bone', 'goo', 'pop')}
    # bar 33: it starts inside him - small squishes, the first tears
    t = 0.05
    while t < RIP - 0.2:
        k = t / RIP
        B['wet'].add(t, squish(c=rng.uniform(240, 700 + 450 * k)), 0.7 + 0.6 * k)
        t += rng.uniform(0.06, 0.24) * (1 - 0.55 * k)
    B['tear'].add(0.4, crackle(1.2, 35, 130), 0.7)
    B['tear'].add(1.7, crackle(RIP - 1.7 + 0.05, 110, 600, 700, 6000), 1.0)          # ripping louder and louder
    # bar 34: bones cracking (on the beat, then a messy one)
    for bt in (1.6, 1.8, 2.0, 2.25, 2.4, 2.55, 2.7, 2.8, 2.95, 3.08):
        B['bone'].add(bt, bone_crack(), 1.0 if bt in (1.6, 2.0, 2.4, 2.8) else 0.65)
    B['goo'].add(1.4, stretch_goo(RIP - 1.4), 0.9)
    # bar 35: THE PULL-OUT
    B['tear'].add(RIP - 0.06, crackle(0.12, 1200, 1500, 600, 7000), 1.4)             # last strands snap
    B['pop'].add(RIP, suction_pop(), 1.3)
    B['wet'].add(RIP + 0.02, squish(0.25, 420), 1.3)
    B['wet'].add(RIP + 0.06, squish(0.35, 240), 1.3)                                  # meat slap
    B['pop'].add(RIP + 0.04, bandnoise(int(0.4 * SR), 120, 900) * env_exp(int(0.4 * SR), 0.06) * 2.2, 1.0)
    # after: dripping goo, the eye squelching open
    for _ in range(40):
        tt = RIP + 0.25 + rng.uniform(0, 1.3) ** 1.5
        B['goo'].add(tt, bubble(rng.uniform(350, 1100), rng.uniform(0.01, 0.02)), rng.uniform(0.2, 0.5))
    B['wet'].add(RIP + 0.55, squish(0.4, 300), 0.9)
    B['wet'].add(RIP + 1.0, squish(0.3, 520), 0.6)

    def lvl(x, db):
        r = np.sqrt((x[np.abs(x) > np.abs(x).max() * 0.02] ** 2).mean())
        return x * 10 ** (db / 20) / max(r, 1e-9)
    mix = (lvl(B['wet'].x, -14) + lvl(B['tear'].x, -17) + lvl(B['bone'].x, -14) + lvl(B['goo'].x, -18) + lvl(B['pop'].x, -6))
    mix = mix[:int((LEN + 0.6) * SR)]
    # slightly wide + a small wet room
    d = int(0.007 * SR)
    st = np.stack([mix, np.concatenate([np.zeros(d), mix[:-d]]) * 0.9 + mix * 0.1]).astype(np.float32)
    st = pb.Pedalboard([pb.HighpassFilter(35), pb.Reverb(room_size=0.25, wet_level=0.12, dry_level=1.0, width=0.6),
                        pb.Compressor(threshold_db=-14, ratio=2.5, attack_ms=5, release_ms=120)])(st, SR)
    st = st / np.abs(st).max() * 0.89
    f = int(0.4 * SR); st[:, -f:] *= np.linspace(1, 0, f)
    return st


if __name__ == '__main__':
    out = render()
    sf.write(sys.argv[1], out.T, SR)
    print('wrote', sys.argv[1], round(out.shape[1] / SR, 2), 's')
