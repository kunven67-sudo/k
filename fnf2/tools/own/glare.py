"""GLARE - WRATH's own song (original), made in code.

Stage 1: a funky night-street groove while he's still the normal guy.
The snap: the beat tape-stops, a heartbeat while his body tears open (sfx_transform.py), the eye rips out.
Stage 2: heavy and creepy for the giant eye (reese bass, 808, choir, music-box bell).

Instruments are synthesised here (numpy) and mixed with pedalboard effects.
The singing uses syllables cut from FNF's own vocal stems (BF's real "beep"s;
WRATH = a deep male syllable pitched into his range, demonic in stage 2), read
from the asset checkout at build time - the audio never goes in the repo.

  python3 fnf2/tools/own/glare.py [--mp3 FULL.mp3]
writes Inst.ogg + Voices-wrath.ogg + Voices-bf.ogg, the chart + metadata (Easy/Normal/Hard)
into fnf2/build/own (git-ignored), and optionally the full mix as an mp3.
"""
import argparse, json, math, os, subprocess
import numpy as np
import soundfile as sf
import pedalboard as pb
import sfx_transform
from scipy import ndimage, signal

FNF = os.environ.get('FNF_ASSETS', '/home/user/funkincrew/funkin.assets')
SR = 44100
BPM = 150
BEAT = 60 / BPM
RNG = np.random.default_rng(7)


def T(bar, beat=0.0): return (bar * 4 + beat) * BEAT
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def n(s):
    """'A4' -> 69"""
    name, octv = s[:-1], int(s[-1])
    return 12 * (octv + 1) + NOTE[name]


# ---------------------------------------------------------------- oscillators + envelopes
def phase(f, length):
    f = np.broadcast_to(np.asarray(f, float), (length,))
    return np.cumsum(f / SR) % 1.0, f


def saw(f, length):
    """PolyBLEP saw (no harsh aliasing)."""
    ph, ff = phase(f, length)
    dt = ff / SR
    y = 2 * ph - 1
    m1 = ph < dt; t1 = ph[m1] / dt[m1]; y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = ph > 1 - dt; t2 = (ph[m2] - 1) / dt[m2]; y[m2] -= t2 * t2 + t2 + t2 + 1
    return y


def square(f, length, pw=0.5):
    ph, ff = phase(f, length)
    return np.where(ph < pw, 1.0, -1.0) * 0.8


def sine(f, length):
    ph, _ = phase(f, length)
    return np.sin(2 * np.pi * ph)


def noise(length): return RNG.uniform(-1, 1, length)


def adsr(length, a=0.005, d=0.1, s=0.7, r=0.05, hold=None):
    """Envelope over `length` samples; hold = seconds before release (default: all)."""
    e = np.zeros(length)
    A, D, R = int(a * SR) or 1, int(d * SR) or 1, int(r * SR) or 1
    H = length - R if hold is None else min(length - R, int(hold * SR))
    H = max(H, 1)
    i = np.arange(length)
    e = np.where(i < A, i / A, np.where(i < A + D, 1 - (1 - s) * (i - A) / D, s))
    rel = i >= H
    if rel.any():
        lvl = e[H] if H < length else s
        e[rel] = lvl * np.maximum(0, 1 - (i[rel] - H) / R)
    return e


def expdec(length, tau): return np.exp(-np.arange(length) / (tau * SR))


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)


def sweep_lp(x, f_start, f_end, tau):
    """Filter envelope: cross-fade between bright and dark versions (cheap, smooth)."""
    bright, mid, dark = lp(x, f_start), lp(x, math.sqrt(f_start * f_end)), lp(x, f_end)
    k = expdec(len(x), tau)
    w1 = np.clip(k * 2 - 1, 0, 1); w2 = np.clip(1 - abs(k * 2 - 1), 0, 1); w3 = np.clip(1 - k * 2, 0, 1)
    return bright * w1 + mid * w2 + dark * w3


# ---------------------------------------------------------------- drums
def kick(hard=1.0):
    L = int(0.45 * SR)
    f = 46 + 140 * expdec(L, 0.035 * hard)
    body = sine(f, L) * expdec(L, 0.28 + 0.1 * hard)
    click = hp(noise(L), 2500) * expdec(L, 0.003) * 0.25
    return np.tanh((body + click) * (1.0 + 0.4 * hard)) / np.tanh(1.0 + 0.4 * hard)


def snare():
    L = int(0.35 * SR)
    tone = sine(190 + 40 * expdec(L, 0.02), L) * expdec(L, 0.07) * 0.7
    nz = bp(noise(L), 1200, 9000) * expdec(L, 0.085)
    return np.tanh((tone + nz) * 1.6) * 0.8


def clap():
    L = int(0.4 * SR)
    e = np.zeros(L)
    for k in range(3): e[int(k * 0.011 * SR):] += expdec(L - int(k * 0.011 * SR), 0.006 if k < 2 else 0.075)
    return bp(noise(L), 900, 5000) * e * 0.7


def hat(open_=False):
    L = int((0.32 if open_ else 0.06) * SR)
    metal = sum(square(f, L) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    x = lp(hp(metal * 0.3 + noise(L) * 0.6, 6500, 3), 12500)
    return x * expdec(L, 0.12 if open_ else 0.018) * 0.45


def crash():
    L = int(1.8 * SR)
    metal = sum(square(f, L) for f in (310, 457, 563, 712, 893, 1140))
    return hp(metal * 0.15 + noise(L), 5000, 2) * expdec(L, 0.45) * 0.35


def b808(m, length):
    L = int(length * SR)
    f = mtof(m) * (1 + 1.5 * expdec(L, 0.03))
    return np.tanh(sine(f, L) * adsr(L, 0.002, 0.1, 0.9, 0.08) * 1.6) * 0.8


# ---------------------------------------------------------------- instruments
def funk_bass(m, length):
    L = int(length * SR)
    f = mtof(m)
    x = saw(f, L) * 0.55 + square(f * 0.5, L) * 0.2 + sine(f * 0.5, L) * 0.9
    x = sweep_lp(x, 2600, 380, 0.06)
    return x * adsr(L, 0.002, 0.08, 0.75, 0.04)


def epiano(m, length, vel=1.0):
    """FM electric piano (tine)."""
    L = int(length * SR)
    f = mtof(m)
    t = np.arange(L) / SR
    idx = 2.2 * expdec(L, 0.18) + 0.35
    mod = np.sin(2 * np.pi * f * t) * idx
    x = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * expdec(L, 0.05)
    return x * adsr(L, 0.003, 0.6, 0.35, 0.12) * vel * 0.32


def pluck(m, length):
    L = int(length * SR)
    f = mtof(m)
    x = saw(f, L) * 0.5 + saw(f * 1.004, L) * 0.5
    return sweep_lp(x, 6000, 600, 0.05) * adsr(L, 0.002, 0.15, 0.25, 0.05) * 0.35


def supersaw(m, length, bright=3000, a=0.02):
    L = int(length * SR)
    f = mtof(m)
    x = sum(saw(f * 2 ** (c / 1200), L) for c in (-22, -13, -6, 0, 7, 14, 23)) / 4
    return lp(x, bright) * adsr(L, a, 0.3, 0.8, 0.15) * 0.25


def reese(m, length):
    L = int(length * SR)
    f = mtof(m)
    x = saw(f * 2 ** (-14 / 1200), L) + saw(f * 2 ** (14 / 1200), L)
    x = lp(np.tanh(x * 2.2), 900) + sine(f, L) * 0.6
    return x * adsr(L, 0.004, 0.2, 0.9, 0.06) * 0.45


def choir(m, length):
    """Dark 'aah' pad: saws through vowel formants."""
    L = int(length * SR)
    f = mtof(m)
    src = sum(saw(f * 2 ** (c / 1200) * (1 + 0.003 * np.sin(2 * np.pi * 5.1 * np.arange(L) / SR)), L) for c in (-9, 0, 8))
    x = bp(src, 650, 1100) * 1.0 + bp(src, 1050, 1400) * 0.6 + bp(src, 2400, 2900) * 0.25
    return x * adsr(L, 0.35, 0.4, 0.9, 0.5) * 0.35


def bell(m, length):
    """Music-box / creepy bell (inharmonic FM)."""
    L = int(length * SR)
    f = mtof(m)
    t = np.arange(L) / SR
    x = np.sin(2 * np.pi * f * t + 1.8 * expdec(L, 0.4) * np.sin(2 * np.pi * f * 3.53 * t))
    return x * expdec(L, 0.55) * 0.3


# ---------------------------------------------------------------- voices (syllables from FNF's own stems)
def yin_pitch(x, sr):
    """Steady pitch of a sung syllable (median over its middle), in MIDI."""
    x = x - x.mean()
    W = 2048; hop = 512; out = []
    for s in range(len(x) // 5, len(x) * 3 // 4 - W, hop):
        fr = x[s:s + W]
        d = np.array([np.sum((fr[:W - tau] - fr[tau:]) ** 2) for tau in range(1, sr // 70)])
        cm = d * np.arange(1, len(d) + 1) / np.maximum(np.cumsum(d), 1e-9)
        lo = sr // 900
        cand = np.nonzero(cm[lo:] < 0.15)[0]
        if len(cand):
            tau = lo + cand[0]
            while tau + 1 < len(cm) and cm[tau + 1] < cm[tau]: tau += 1
            out.append(69 + 12 * math.log2(sr / (tau + 1) / 440))
    return float(np.median(out)) if out else None


class Voice:
    def __init__(self, picks):
        """picks = [(stem path, start s, dur s)] -> syllables with their own pitch."""
        self.syl = []
        for path, t0, d in picks:
            x, sr = sf.read(os.path.join(FNF, 'songs', path))
            x = x.mean(1) if x.ndim > 1 else x
            a, b = int((t0 - 0.02) * sr), int((t0 + d + 0.04) * sr)
            s = x[a:b]
            if sr != SR: s = signal.resample_poly(s, SR, sr)
            p = yin_pitch(s, SR)
            if p is None: continue
            # trim to the voiced part, soft edges
            env = np.abs(signal.hilbert(s)); thr = env.max() * 0.06
            on = np.nonzero(env > thr)[0]
            s = s[max(0, on[0] - 200):on[-1] + 400]
            s = s / (np.abs(s).max() + 1e-9)
            self.syl.append((s, p))
        self.k = 0

    def note(self, m, length, shift_formant=0.0):
        s, p = self.syl[self.k % len(self.syl)]; self.k += 1
        ratio = 2 ** ((m - p) / 12)
        # resample = classic FNF chromatic (pitch and timbre move together)
        y = signal.resample(s, max(16, int(len(s) / ratio)))
        L = int(length * SR)
        if len(y) < L * 0.85 and length > 0.3:                  # hold notes: stretch the syllable
            y = pb.time_stretch(y[None, :].astype(np.float32), SR, stretch_factor=len(y) / (L * 0.9))[0]
        y = y[:L]
        f = np.ones(len(y)); r = min(len(y), int(0.03 * SR)); f[-r:] = np.linspace(1, 0, r)
        return y * f


# ---------------------------------------------------------------- arranging
class Track:
    def __init__(self, total):
        self.buf = np.zeros(total)

    def add(self, t, x, g=1.0):
        i = int(t * SR)
        if i >= len(self.buf): return
        x = x[:len(self.buf) - i]
        self.buf[i:i + len(x)] += x * g


def stereo(x, pan=0.0, width=0.0):
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    if width:
        d = int(0.012 * SR * width)
        return np.stack([x * l * 1.414, np.concatenate([np.zeros(d), x[:-d]]) * r * 1.414])
    return np.stack([x * l * 1.414, x * r * 1.414])


def fx(x2, *plugins):
    return pb.Pedalboard(list(plugins))(x2.astype(np.float32), SR)


# ---------------------------------------------------------------- the song map (150 BPM, 70 bars, ~1:53)
# stage 1 (the normal guy)  bars 0-31 + the first half of 32
# the snap                  tape stop at bar 32 beat 2, heartbeat + tearing + bones 33-34, the eye rips out in 35
# stage 2 (the giant eye)   bars 36-67, the ending 68-69
TR1, SNAP, S2, TR2, FIN, OUT, END = 20, 32, 36, 52, 64, 68, 70

S1_CHORDS = [['A3', 'C4', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4'], ['G3', 'B3', 'D4', 'E4'], ['E3', 'G3', 'B3', 'D4']]
S1_ROOTS = ['A1', 'F1', 'G1', 'E1']
S1_TRADE = [['D3', 'F3', 'A3', 'C4'], ['E3', 'G3', 'B3', 'D4'], ['F3', 'A3', 'C4', 'E4'], ['E3', 'G#3', 'B3', 'D4']]
S1_TRADE_ROOTS = ['D1', 'E1', 'F1', 'E1']
S2_CHORDS = [['A3', 'C4', 'E4'], ['Bb3', 'D4', 'F4'], ['A3', 'C4', 'E4'], ['G#3', 'B3', 'E4']]
S2_ROOTS = ['A1', 'Bb1', 'A1', 'E1']
S2_TRADE = [['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3'], ['D3', 'F3', 'A3'], ['E3', 'G#3', 'B3', 'D4']]
S2_TRADE_ROOTS = ['F1', 'E1', 'D1', 'E1']

# melodies: (beat, length, note) over 4 bars. Trading parts are tagged with who sings: w = WRATH, b = BF
WRATH_A = [(0, .5, 'A4'), (.75, .5, 'C5'), (1.5, .5, 'A4'), (2.5, .5, 'E4'), (3, .5, 'G4'), (3.5, .5, 'A4'),
           (4, .75, 'C5'), (5, .5, 'B4'), (5.5, .5, 'A4'), (6, 1, 'G4'), (7, .5, 'E4'),
           (8, .5, 'A4'), (8.75, .5, 'C5'), (9.5, .5, 'D5'), (10.5, .5, 'C5'), (11, .5, 'A4'), (11.5, .5, 'C5'),
           (12, .75, 'D5'), (13, .5, 'C5'), (13.5, .5, 'A4'), (14, 1.5, 'A4')]
BF_A = [(0, .5, 'C5'), (.75, .5, 'E5'), (1.5, .5, 'C5'), (2.5, .5, 'A4'), (3, .5, 'C5'), (3.5, .5, 'D5'),
        (4, .75, 'E5'), (5, .5, 'D5'), (5.5, .5, 'C5'), (6, 1, 'B4'), (7, .5, 'G4'),
        (8, .5, 'A4'), (8.75, .5, 'C5'), (9.5, .5, 'E5'), (10.5, .5, 'D5'), (11, .5, 'C5'), (11.5, .5, 'E5'),
        (12, .75, 'G5'), (13, .5, 'E5'), (13.5, .5, 'D5'), (14, 1.5, 'E5')]
WRATH_A2 = [(0, .25, 'E4'), (.5, .5, 'A4'), (1, .5, 'A4'), (1.5, .5, 'C5'), (2.25, .5, 'B4'), (3, .5, 'A4'), (3.5, .5, 'G4'),
            (4, .5, 'A4'), (4.5, .5, 'C5'), (5, .75, 'E5'), (6, .5, 'D5'), (6.5, .5, 'C5'), (7, .75, 'A4'),
            (8, .5, 'B4'), (8.5, .5, 'D5'), (9, .5, 'B4'), (9.5, .5, 'G4'), (10.5, .5, 'E4'), (11, .5, 'G4'), (11.5, .5, 'B4'),
            (12, .5, 'D5'), (12.5, .5, 'B4'), (13, .5, 'G4'), (13.5, .5, 'E4'), (14, 1.5, 'G4')]
BF_A2 = [(0, .5, 'E5'), (.5, .5, 'C5'), (1, .5, 'E5'), (1.5, .5, 'G5'), (2.25, .5, 'E5'), (3, .5, 'D5'), (3.5, .5, 'C5'),
         (4, .5, 'C5'), (4.5, .5, 'E5'), (5, .75, 'F5'), (6, .5, 'E5'), (6.5, .5, 'C5'), (7, .75, 'A4'),
         (8, .5, 'D5'), (8.5, .5, 'B4'), (9, .5, 'D5'), (9.5, .5, 'G5'), (10.5, .5, 'E5'), (11, .5, 'D5'), (11.5, .5, 'B4'),
         (12, .5, 'B4'), (12.5, .5, 'D5'), (13, .5, 'E5'), (13.5, .5, 'G5'), (14, 1.5, 'E5')]
TRADE_A = [('w', 0, .5, 'D5'), ('w', .5, .5, 'C5'), ('w', 1, .5, 'A4'), ('w', 1.5, .5, 'F4'), ('w', 2, .5, 'A4'), ('w', 3, .75, 'D5'),
           ('b', 4, .5, 'E5'), ('b', 4.5, .5, 'D5'), ('b', 5, .5, 'B4'), ('b', 5.5, .5, 'G4'), ('b', 6, .5, 'B4'), ('b', 7, .75, 'E5'),
           ('w', 8, .5, 'F4'), ('w', 8.5, .5, 'A4'), ('w', 9, .5, 'C5'), ('w', 9.5, .5, 'E5'), ('w', 10, .5, 'C5'), ('w', 10.5, .5, 'A4'), ('w', 11, .75, 'C5'),
           ('b', 12, .5, 'G#4'), ('b', 12.5, .5, 'B4'), ('b', 13, .5, 'D5'), ('b', 13.5, .5, 'E5'), ('b', 14, .5, 'G#4'), ('b', 14.5, .5, 'B4'), ('b', 15, .75, 'E5')]
WRATH_A3 = [(0, .25, 'A4'), (.25, .25, 'C5'), (.5, .25, 'E5'), (.75, .25, 'C5'), (1, .5, 'A4'), (1.5, .25, 'G4'), (1.75, .25, 'A4'), (2, .5, 'C5'), (2.5, .5, 'B4'), (3, .25, 'A4'), (3.25, .25, 'G4'), (3.5, .5, 'E4'),
            (4, .25, 'F4'), (4.25, .25, 'A4'), (4.5, .25, 'C5'), (4.75, .25, 'E5'), (5, .5, 'D5'), (5.5, .5, 'C5'), (6, .25, 'A4'), (6.25, .25, 'C5'), (6.5, .5, 'D5'), (7, .75, 'C5'),
            (8, .25, 'G4'), (8.25, .25, 'B4'), (8.5, .25, 'D5'), (8.75, .25, 'B4'), (9, .5, 'G4'), (9.5, .25, 'E4'), (9.75, .25, 'G4'), (10, .5, 'B4'), (10.5, .5, 'D5'), (11, .25, 'E5'), (11.25, .25, 'D5'), (11.5, .5, 'B4'),
            (12, .25, 'E4'), (12.25, .25, 'G4'), (12.5, .25, 'B4'), (12.75, .25, 'D5'), (13, .5, 'E5'), (13.5, .5, 'D5'), (14, .5, 'B4'), (14.5, 1.25, 'E5')]
BF_A3 = [(0, .25, 'C5'), (.25, .25, 'E5'), (.5, .25, 'G5'), (.75, .25, 'E5'), (1, .5, 'C5'), (1.5, .25, 'B4'), (1.75, .25, 'C5'), (2, .5, 'E5'), (2.5, .5, 'D5'), (3, .25, 'C5'), (3.25, .25, 'B4'), (3.5, .5, 'A4'),
         (4, .25, 'A4'), (4.25, .25, 'C5'), (4.5, .25, 'E5'), (4.75, .25, 'G5'), (5, .5, 'F5'), (5.5, .5, 'E5'), (6, .25, 'C5'), (6.25, .25, 'E5'), (6.5, .5, 'F5'), (7, .75, 'E5'),
         (8, .25, 'B4'), (8.25, .25, 'D5'), (8.5, .25, 'G5'), (8.75, .25, 'D5'), (9, .5, 'B4'), (9.5, .25, 'G4'), (9.75, .25, 'B4'), (10, .5, 'D5'), (10.5, .5, 'E5'), (11, .25, 'G5'), (11.25, .25, 'E5'), (11.5, .5, 'D5'),
         (12, .25, 'G4'), (12.25, .25, 'B4'), (12.5, .25, 'D5'), (12.75, .25, 'E5'), (13, .5, 'G5'), (13.5, .5, 'E5'), (14, .5, 'D5'), (14.5, 1.25, 'E5')]
SNAP_W = [(0, .25, 'A4'), (.25, .25, 'A4'), (.5, .25, 'A4'), (.75, .25, 'A4'), (1, .5, 'C5'), (1.5, .5, 'A4')]    # he glitches, then snaps
WRATH_B = [(0, .5, 'A3'), (.5, .5, 'A3'), (1, .5, 'C4'), (1.5, .5, 'A3'), (2.5, .5, 'Bb3'), (3, 1, 'A3'),
           (4, .5, 'D4'), (4.5, .5, 'C4'), (5, .5, 'Bb3'), (5.5, .5, 'A3'), (6, .5, 'Bb3'), (6.5, 1, 'D4'),
           (8, .5, 'E4'), (8.5, .5, 'D4'), (9, .5, 'C4'), (9.5, .5, 'D4'), (10, .5, 'E4'), (10.5, .5, 'F4'), (11, 1, 'E4'),
           (12, .5, 'G#3'), (12.5, .5, 'B3'), (13, .5, 'D4'), (13.5, .5, 'F4'), (14, 1.5, 'E4')]
BF_B = [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'E5'), (1.5, .5, 'C5'), (2.5, .5, 'D5'), (3, 1, 'C5'),
        (4, .5, 'F5'), (4.5, .5, 'E5'), (5, .5, 'D5'), (5.5, .5, 'C5'), (6, .5, 'D5'), (6.5, 1, 'F5'),
        (8, .5, 'E5'), (8.5, .5, 'F5'), (9, .5, 'E5'), (9.5, .5, 'D5'), (10, .5, 'C5'), (10.5, .5, 'B4'), (11, 1, 'C5'),
        (12, .5, 'B4'), (12.5, .5, 'D5'), (13, .5, 'E5'), (13.5, .5, 'D5'), (14, 1.5, 'E5')]
WRATH_B2 = [(0, .5, 'E4'), (.5, .5, 'E4'), (1, .5, 'F4'), (1.5, .5, 'E4'), (2, .5, 'C4'), (2.5, .5, 'A3'), (3, .5, 'C4'), (3.5, .5, 'E4'),
            (4, .75, 'F4'), (5, .5, 'D4'), (5.5, .5, 'Bb3'), (6, .5, 'D4'), (6.5, .5, 'F4'), (7, .5, 'G4'), (7.5, .5, 'F4'),
            (8, .5, 'E4'), (8.5, .25, 'C4'), (8.75, .25, 'E4'), (9, .5, 'A4'), (9.5, .5, 'G4'), (10, .5, 'F4'), (10.5, .5, 'E4'), (11, .75, 'C4'),
            (12, .5, 'B3'), (12.5, .5, 'G#3'), (13, .5, 'B3'), (13.5, .5, 'D4'), (14, 1.5, 'E4')]
BF_B2 = [(0, .5, 'A4'), (.5, .5, 'A4'), (1, .5, 'Bb4'), (1.5, .5, 'A4'), (2, .5, 'E5'), (2.5, .5, 'C5'), (3, .5, 'E5'), (3.5, .5, 'G5'),
         (4, .75, 'F5'), (5, .5, 'D5'), (5.5, .5, 'Bb4'), (6, .5, 'D5'), (6.5, .5, 'F5'), (7, .5, 'G5'), (7.5, .5, 'F5'),
         (8, .5, 'E5'), (8.5, .25, 'C5'), (8.75, .25, 'E5'), (9, .5, 'G5'), (9.5, .5, 'F5'), (10, .5, 'E5'), (10.5, .5, 'D5'), (11, .75, 'C5'),
         (12, .5, 'B4'), (12.5, .5, 'D5'), (13, .5, 'E5'), (13.5, .5, 'F5'), (14, 1.5, 'E5')]
TRADE_B = [('w', 0, .5, 'F4'), ('w', .5, .5, 'C4'), ('w', 1, .75, 'A3'), ('b', 2, .5, 'F5'), ('b', 2.5, .5, 'C5'), ('b', 3, .75, 'A4'),
           ('w', 4, .5, 'E4'), ('w', 4.5, .5, 'B3'), ('w', 5, .75, 'G#3'), ('b', 6, .5, 'E5'), ('b', 6.5, .5, 'B4'), ('b', 7, .75, 'G#4'),
           ('w', 8, .25, 'D4'), ('w', 8.25, .25, 'F4'), ('w', 8.5, .5, 'D4'), ('w', 9, .75, 'A3'), ('b', 10, .25, 'D5'), ('b', 10.25, .25, 'F5'), ('b', 10.5, .5, 'D5'), ('b', 11, .75, 'A4'),
           ('w', 12, .5, 'E4'), ('w', 12.5, .5, 'D4'), ('w', 13, .5, 'B3'), ('w', 13.5, .5, 'G#3'), ('b', 14, .5, 'G#4'), ('b', 14.5, .5, 'B4'), ('b', 15, .5, 'D5'), ('b', 15.5, .5, 'E5')]
WRATH_B3 = [(0, .25, 'A3'), (.25, .25, 'C4'), (.5, .25, 'E4'), (.75, .25, 'C4'), (1, .25, 'A3'), (1.25, .25, 'C4'), (1.5, .5, 'E4'), (2, .25, 'F4'), (2.25, .25, 'E4'), (2.5, .25, 'C4'), (2.75, .25, 'A3'), (3, .5, 'Bb3'), (3.5, .5, 'A3'),
            (4, .25, 'Bb3'), (4.25, .25, 'D4'), (4.5, .25, 'F4'), (4.75, .25, 'D4'), (5, .25, 'Bb3'), (5.25, .25, 'D4'), (5.5, .5, 'F4'), (6, .25, 'G4'), (6.25, .25, 'F4'), (6.5, .25, 'D4'), (6.75, .25, 'Bb3'), (7, 1, 'D4'),
            (8, .25, 'E4'), (8.25, .25, 'C4'), (8.5, .25, 'E4'), (8.75, .25, 'A4'), (9, .5, 'G4'), (9.5, .25, 'F4'), (9.75, .25, 'E4'), (10, .25, 'F4'), (10.25, .25, 'E4'), (10.5, .25, 'D4'), (10.75, .25, 'C4'), (11, 1, 'A3'),
            (12, .25, 'G#3'), (12.25, .25, 'B3'), (12.5, .25, 'E4'), (12.75, .25, 'B3'), (13, .25, 'G#3'), (13.25, .25, 'B3'), (13.5, .25, 'D4'), (13.75, .25, 'F4'), (14, 1.75, 'E4')]
BF_B3 = [(0, .25, 'A4'), (.25, .25, 'C5'), (.5, .25, 'E5'), (.75, .25, 'C5'), (1, .25, 'A4'), (1.25, .25, 'C5'), (1.5, .5, 'E5'), (2, .25, 'F5'), (2.25, .25, 'E5'), (2.5, .25, 'C5'), (2.75, .25, 'A4'), (3, .5, 'Bb4'), (3.5, .5, 'A4'),
         (4, .25, 'Bb4'), (4.25, .25, 'D5'), (4.5, .25, 'F5'), (4.75, .25, 'D5'), (5, .25, 'Bb4'), (5.25, .25, 'D5'), (5.5, .5, 'F5'), (6, .25, 'G5'), (6.25, .25, 'F5'), (6.5, .25, 'D5'), (6.75, .25, 'Bb4'), (7, 1, 'D5'),
         (8, .25, 'E5'), (8.25, .25, 'C5'), (8.5, .25, 'E5'), (8.75, .25, 'G5'), (9, .5, 'F5'), (9.5, .25, 'E5'), (9.75, .25, 'D5'), (10, .25, 'E5'), (10.25, .25, 'D5'), (10.5, .25, 'C5'), (10.75, .25, 'B4'), (11, 1, 'A4'),
         (12, .25, 'G#4'), (12.25, .25, 'B4'), (12.5, .25, 'E5'), (12.75, .25, 'B4'), (13, .25, 'G#4'), (13.25, .25, 'B4'), (13.5, .25, 'D5'), (13.75, .25, 'F5'), (14, 1.75, 'E5')]
FINAL = [('w', 0, .5, 'A3'), ('w', .5, .5, 'E4'), ('w', 1, 1, 'F4'), ('b', 2, .5, 'A4'), ('b', 2.5, .5, 'E5'), ('b', 3, 1, 'F5'),
         ('w', 4, .5, 'F4'), ('w', 4.5, .5, 'D4'), ('w', 5, 1, 'Bb3'), ('b', 6, .5, 'F5'), ('b', 6.5, .5, 'D5'), ('b', 7, 1, 'Bb4'),
         ('w', 8, .25, 'A3'), ('w', 8.25, .25, 'C4'), ('w', 8.5, .25, 'E4'), ('w', 8.75, .25, 'A4'), ('w', 9, 1, 'G4'),
         ('b', 10, .25, 'A4'), ('b', 10.25, .25, 'C5'), ('b', 10.5, .25, 'E5'), ('b', 10.75, .25, 'G5'), ('b', 11, 1, 'F5'),
         ('w', 12, .5, 'B3'), ('w', 12.5, .5, 'D4'), ('w', 13, 3, 'E4'),                 # the last note: both at once
         ('b', 12, .5, 'G#4'), ('b', 12.5, .5, 'B4'), ('b', 13, 3, 'E5')]
BELL_B = [(0, 1, 'E5'), (1, 1, 'F5'), (2, 1, 'E5'), (3, 1, 'D#5'), (4, 1, 'E5'), (5, 1, 'A5'), (6, 2, 'G#5')]
BELL_B2 = [(0, 1, 'C6'), (1, 1, 'B5'), (2, 1, 'Bb5'), (3, 1, 'A5'), (4, 2, 'E5'), (6, 2, 'F5')]

SONG = [(4, 'w', WRATH_A), (8, 'b', BF_A), (12, 'w', WRATH_A2), (16, 'b', BF_A2), (TR1, None, TRADE_A),
        (24, 'w', WRATH_A3), (28, 'b', BF_A3), (SNAP, 'w', SNAP_W),
        (S2, 'w', WRATH_B), (40, 'b', BF_B), (44, 'w', WRATH_B2), (48, 'b', BF_B2), (TR2, None, TRADE_B),
        (56, 'w', WRATH_B3), (60, 'b', BF_B3), (FIN, None, FINAL)]
# camera: (bar, who) 1 = WRATH, 0 = BF, 2 = the middle (fast trades + the ending)
CAMERA = [(0, 1), (8, 0), (12, 1), (16, 0), (20, 1), (21, 0), (22, 1), (23, 0), (24, 1), (28, 0), (32, 1),
          (40, 0), (44, 1), (48, 0), (TR2, 2), (56, 1), (60, 0), (FIN, 2)]
# glitches: (bar, beat, beats, slice in beats) - the music stutters like it's breaking
GLITCHES = [(27, 3.5, .5, 1 / 8), (31, 3, .5, 1 / 4), (31, 3.5, .25, 1 / 8), (31, 3.75, .25, 1 / 16),
            (47, 3.5, .5, 1 / 8), (59, 3, .5, 1 / 4), (59, 3.5, .5, 1 / 16), (63, 3.5, .5, 1 / 8)]

# voices: syllables from FNF's own stems (path, start s, length s)
BF_SYL = [('bopeebo/Voices-bf.ogg', 17.1, 0.27), ('bopeebo/Voices-bf.ogg', 21.91, 0.22), ('bopeebo/Voices-bf.ogg', 16.79, 0.2), ('bopeebo/Voices-bf.ogg', 7.2, 0.5)]
WRATH_SYL = [('bopeebo/Voices-dad.ogg', 14.7, 0.28), ('bopeebo/Voices-dad.ogg', 15.3, 0.16), ('bopeebo/Voices-dad.ogg', 14.4, 0.2), ('bopeebo/Voices-dad.ogg', 4.8, 0.5)]


def sung():
    """Every sung note: who, beat (from the song start), length (beats), midi (as written), stage."""
    out = []
    for bar, who, ph in SONG:
        for x in ph:
            w, (b, l, nn) = (who, x) if who else (x[0], x[1:])
            out.append({'who': w, 'beat': bar * 4 + b, 'len': l, 'm': n(nn), 'stage': 2 if bar >= S2 else 1})
    out.sort(key=lambda x: (x['beat'], x['who']))
    return out


# ---------------------------------------------------------------- arranging
def s1_chord(bar):
    if TR1 <= bar < TR1 + 4: return S1_TRADE[bar - TR1], S1_TRADE_ROOTS[bar - TR1]
    return S1_CHORDS[bar % 4], S1_ROOTS[bar % 4]


def s2_chord(bar):
    if TR2 <= bar < TR2 + 4: return S2_TRADE[bar - TR2], S2_TRADE_ROOTS[bar - TR2]
    return S2_CHORDS[(bar - S2) % 4], S2_ROOTS[(bar - S2) % 4]


def stage1_bar(tr, bar):
    last = bar == SNAP                     # only the first half plays (then the tape stop)
    trade = TR1 <= bar < TR1 + 4           # half-time while they trade lines
    big = bar >= 24                        # the groove gets heavier right before he snaps
    chord, root = s1_chord(bar)
    r = n(root)
    for st in range(16):
        if last and st >= 8: break
        tt = T(bar, st / 4)
        if trade: kicks, snares = (0, 10), (8,)
        elif bar < 2: kicks, snares = (0, 8), (4, 12)
        elif big: kicks, snares = (0, 7, 8, 10, 14), (4, 12)
        else: kicks, snares = (0, 7, 8, 10), (4, 12)
        if st in kicks: tr['kick'].add(tt, kick(1.2 if big else 1.0), 0.9)
        if st in snares: tr['snare'].add(tt, snare(), 0.8); tr['snare'].add(tt, clap(), 0.35)
        if bar >= 1 and st % 2 == 0: tr['hat'].add(tt, hat(st in (6, 14)), 0.55 if st % 4 else 0.35)
        if (big or bar >= 12 and not trade) and st % 2: tr['hat'].add(tt, hat(), 0.18 if st not in (13, 15) else 0.25)
        elif bar >= 2 and not trade and st in (13, 15): tr['hat'].add(tt, hat(), 0.25)
    if bar in (11, 19):                                                   # little snare fills
        for st in (14, 15): tr['snare'].add(T(bar, st / 4), snare(), 0.45)
    if bar == TR1 + 3:                                                    # roll back into the full groove
        for k in range(8): tr['snare'].add(T(bar, 2 + k / 4), snare(), 0.25 + 0.08 * k)
        L = int(4 * BEAT * SR)
        tr['fx'].add(T(bar), bp(noise(L), 500, 8000) * np.linspace(0, 1, L) ** 2, 0.5)
    if bar >= 1:                                                          # funky bass
        pat = ((0, 2.75, 0), (3, .5, 12), (3.5, .5, 10)) if trade else \
              ((0, .5, 0), (.75, .25, 12), (1.5, .5, 0), (2, .25, 7), (2.5, .5, 12), (3, .25, 10), (3.5, .5, 7))
        if big: pat = pat + ((1.25, .25, 12), (3.75, .25, 12))
        for (b, l, iv) in pat:
            if last and b >= 2: continue
            tr['bass'].add(T(bar, b), funk_bass(r + 12 + iv, l * BEAT * 0.95), 0.7)
    stabs = ((0, 3.8),) if trade else ((0, 1.4), (1.5, .4), (2.5, 1.3))  # e-piano
    for (b, l) in stabs:
        if last and b >= 2: continue
        for nn in chord: tr['keys'].add(T(bar, b), epiano(n(nn), l * BEAT), 0.55)
    if bar >= 2 and not last:                                             # pluck counter-line
        if trade:
            for k, nn in enumerate((chord[0], chord[2], chord[3], chord[2])): tr['pluck'].add(T(bar, k), pluck(n(nn) + 12, 0.9 * BEAT), 0.35)
        elif bar >= 4 or bar == 3:
            arp = [chord[k % 4] for k in (0, 2, 3, 2, 1, 2, 3, 2)]
            for k, nn in enumerate(arp): tr['pluck'].add(T(bar, k / 2), pluck(n(nn) + 12, 0.45 * BEAT), 0.4)
    if big and not last:                                                  # soft saw pad under the A3 part
        for nn in chord: tr['pad'].add(T(bar), supersaw(n(nn), 4 * BEAT, 1600, 0.25), 0.22)
    if bar % 4 == 0 and bar > 0: tr['crash'].add(T(bar), crash(), 0.5 if bar != 24 else 0.7)


def the_snap(tr):
    """Bar 32 beat 2: everything tape-stops. A heartbeat under wet tearing + cracking bones, a rising dread, then the eye rips out."""
    hb = lp(kick(0.4), 160)                                                                      # heartbeat under it
    for beat in (0.0, 2.0): tr['fx'].add(T(SNAP + 1, beat), hb, 1.2); tr['fx'].add(T(SNAP + 1, beat + .45), hb, 0.8)
    for beat in (0.0, 1.0, 2.0, 3.0): tr['fx'].add(T(SNAP + 2, beat), hb, 1.25); tr['fx'].add(T(SNAP + 2, beat + .4), hb, 0.85)
    # his body tearing open (sfx_transform.py): the pull-out lands on bar 35 with the boom
    tr['sfx'].add(T(SNAP + 1), sfx_transform.render().mean(0))
    L = int(8 * BEAT * SR)
    tr['fx'].add(T(SNAP + 2), bp(noise(L), 300, 6000) * np.linspace(0, 1, L) ** 2.5 * 0.6, 0.8)      # dread riser
    tr['choir'].add(T(SNAP + 2), choir(n('A2'), 4 * BEAT), 0.35)                                  # low drone
    tr['choir'].add(T(SNAP + 3), choir(n('A2'), 4 * BEAT), 0.4); tr['choir'].add(T(SNAP + 3), choir(n('Bb2'), 4 * BEAT), 0.3)
    boom = lp(kick(1.8), 120)
    tr['fx'].add(T(SNAP + 3), boom, 1.4)                                                         # the eye opens
    tr['b808'].add(T(SNAP + 3), b808(n('A1'), 2.0), 0.7)
    for (b, l, nn) in ((0, 1, 'E5'), (1, 1, 'F5')): tr['bell'].add(T(SNAP + 3, b), bell(n(nn), l * BEAT + 1.0), 0.45)
    rc = crash()[:int(2 * BEAT * SR)][::-1]                                                      # reverse cymbal into stage 2
    tr['crash'].add(T(S2) - len(rc) / SR, rc, 0.8)


def stage2_bar(tr, bar):
    trade = TR2 <= bar < TR2 + 4
    lvl = 1 if bar < 44 else 2 if bar < 56 else 3
    stop = bar == OUT - 1                  # the last bar: drums cut after beat 1, everyone holds the last note
    chord, root = s2_chord(bar)
    r = n(root)
    kicks = (0, 6, 10) if trade else {1: (0, 3, 10), 2: (0, 3, 10, 14), 3: (0, 3, 6, 10, 13)}[lvl]
    for st in range(16):
        if stop and st >= 4: break
        tt = T(bar, st / 4)
        if st in kicks: tr['kick'].add(tt, kick(1.6), 1.0)
        if st == 8: tr['snare'].add(tt, snare(), 1.0); tr['snare'].add(tt, clap(), 0.6)
        if lvl == 3 and not trade: tr['hat'].add(tt, hat(), 0.45 if st % 2 == 0 else 0.28)
        elif st % 2 == 0 or (bar % 2 and st > 11): tr['hat'].add(tt, hat(), 0.45)
    if lvl >= 2 and bar % 2 == 1 and not trade and not stop:            # trap hat roll
        for k in range(6): tr['hat'].add(T(bar, 3 + k / 6), hat(), 0.2 + 0.05 * k)
    if trade and bar == TR2 + 3:
        for k in range(8): tr['snare'].add(T(bar, 2 + k / 4), snare(), 0.3 + 0.09 * k)
    # 808s
    if stop: pat = ((0, 1, 0),)
    elif trade: pat = ((0, 2.5, 0), (2.5, 1.5, 12))
    elif lvl == 3: pat = ((0, .75, 0), (.75, .75, 12), (1.5, 1, 0), (2.5, .5, 0), (3, .5, 12), (3.5, .5, 0))
    elif lvl == 2: pat = ((0, 2.1, 0), (2.5, 1, 0), (3.5, .5, 12))
    else: pat = ((0, 2.1, 0), (2.5, 1.05, 0))
    for (b, l, iv) in pat: tr['b808'].add(T(bar, b), b808(r + 12 + iv, l * BEAT), 0.9 if b == 0 else 0.75)
    tr['reese'].add(T(bar), reese(r + 12, 4 * BEAT), 0.55)
    for nn in chord:
        tr['choir'].add(T(bar), choir(n(nn), 4 * BEAT), 0.5)
        for b in ((0,) if stop else (0, 1.5, 3) if lvl < 3 else (0, 1.5, 2, 3, 3.5)):
            tr['pad'].add(T(bar, b), supersaw(n(nn), 0.45 * BEAT, 2400, 0.004), 0.35)
    if lvl == 3: tr['choir'].add(T(bar), choir(n(chord[-1]) + 12, 4 * BEAT), 0.3)          # higher voices on top
    if bar % 4 == 0 or (lvl == 3 and bar % 2 == 0): tr['crash'].add(T(bar), crash(), 0.7)
    if stop:
        L = int(3 * BEAT * SR)
        tr['fx'].add(T(bar, 1), bp(noise(L), 400, 7000) * np.linspace(0, 1, L) ** 2, 0.7)
        rc = crash()[:int(2 * BEAT * SR)][::-1]
        tr['crash'].add(T(OUT) - len(rc) / SR, rc, 0.8)


def the_end(tr):
    """One last huge hit, then his old stage-1 tune comes back as a creepy music box."""
    tr['crash'].add(T(OUT), crash(), 0.9)
    tr['kick'].add(T(OUT), kick(1.8), 1.0)
    tr['snare'].add(T(OUT), snare(), 0.8)
    for nn in S2_CHORDS[0]: tr['choir'].add(T(OUT), choir(n(nn), 6 * BEAT), 0.6)
    tr['b808'].add(T(OUT), b808(n('A2'), 3.0), 1.0)
    for (b, l, nn) in WRATH_A[:11]: tr['bell'].add(T(OUT, b), bell(n(nn) + 12, l * BEAT + 1.2), 0.4)


def sing(tr, notes):
    wv, bv = Voice(WRATH_SYL), Voice(BF_SYL)
    for x in notes:
        t, L = x['beat'] * BEAT, x['len'] * BEAT
        if x['who'] == 'b': tr['bf'].add(t, bv.note(x['m'] - 4, L), 0.8)
        elif x['stage'] == 1: tr['wrath'].add(t, wv.note(x['m'] - 5, L), 0.8)
        else:
            tr['wrath'].add(t, wv.note(x['m'] + 2, L), 0.75)
            tr['wrath_lo'].add(t, wv.note(x['m'] - 10, L), 0.7)       # the demon underneath
    # the eye opening: one long scream
    tr['wrath'].add(T(SNAP + 3, 2), wv.note(n('F4'), 2 * BEAT), 0.7)
    tr['wrath_lo'].add(T(SNAP + 3, 2), wv.note(n('Bb2'), 2 * BEAT), 0.9)


# ---------------------------------------------------------------- edits + mastering (same on every stem so they stay in sync)
def stutter(x, t0, dur, sl):
    a, L, s = int(t0 * SR), int(dur * SR), max(64, int(sl * SR))
    piece = x[:, a:a + s].copy()
    f = min(s // 4, int(0.002 * SR))
    piece[:, :f] *= np.linspace(0, 1, f); piece[:, -f:] *= np.linspace(1, 0, f)
    x[:, a:a + L] = np.tile(piece, (1, L // s + 1))[:, :L]


def tape_stop(x, t0, dur, t_end):
    a, L = int(t0 * SR), int(dur * SR)
    seg = x[:, a:a + L * 2].copy()
    pos = np.cumsum(np.linspace(1.0, 0.0, L) ** 1.6)
    pos = pos[pos < seg.shape[1] - 1]
    x[:, a:a + len(pos)] = np.stack([np.interp(pos, np.arange(seg.shape[1]), seg[c]) for c in range(2)]) * np.linspace(1, 0.2, len(pos))
    x[:, a + len(pos):int(t_end * SR)] = 0.0


def master_gain(x, thr=-16.0, ratio=2.0, att=0.015, rel=0.15, makeup=5.8, ceil=-0.5):
    """Gain curve of the master bus (compressor -> makeup -> look-ahead limiter), worked out on the full
    mix and then put on every stem, so Inst + Voices played together sound exactly like the full mix."""
    B = 64
    nb = x.shape[1] // B + 1
    blk = np.pad(x, ((0, 0), (0, nb * B - x.shape[1]))).reshape(2, nb, B)
    lvl = 10 * np.log10((blk ** 2).mean(axis=(0, 2)) + 1e-12)
    want = -np.maximum(0.0, lvl - thr) * (1 - 1 / ratio)
    a_att, a_rel = math.exp(-B / (att * SR)), math.exp(-B / (rel * SR))
    g = np.empty(nb); cur = 0.0
    for i in range(nb):
        a = a_att if want[i] < cur else a_rel
        cur = a * cur + (1 - a) * want[i]; g[i] = cur
    g += makeup
    peak = np.abs(blk).max(axis=(0, 2)) * 10 ** (g / 20)
    need = ndimage.minimum_filter1d(np.minimum(0.0, ceil - 20 * np.log10(peak + 1e-12)), 5)
    a_lim = math.exp(-B / (0.08 * SR)); cur = 0.0
    for i in range(nb):
        cur = min(need[i], a_lim * cur + (1 - a_lim) * need[i]); g[i] += cur
    return 10 ** (np.interp(np.arange(x.shape[1]), np.arange(nb) * B + B / 2, g) / 20)


LEVEL = {'kick': -12, 'snare': -17, 'hat': -29, 'bass': -16, 'keys': -21, 'pluck': -25, 'pad': -23, 'reese': -19,
         'b808': -15, 'choir': -23, 'bell': -22, 'crash': -31, 'fx': -31, 'sfx': -14}


def level(x, db):
    """Loudness of the parts where it actually plays -> target dB."""
    a = np.abs(x); on = a > a.max() * 0.02
    r = np.sqrt((x[on] ** 2).mean()) if on.any() else 1.0
    return x * (10 ** (db / 20) / max(r, 1e-9))


def render():
    """-> (inst, wrath voice, bf voice) stereo stems + the sung notes."""
    total = int((T(END) + 1.6) * SR)
    tr = {k: Track(total) for k in list(LEVEL) + ['wrath', 'wrath_lo', 'bf']}
    for bar in range(0, SNAP + 1): stage1_bar(tr, bar)
    the_snap(tr)
    for bar in range(S2, OUT): stage2_bar(tr, bar)
    for (b, l, nn) in BELL_B: tr['bell'].add(T(S2, b), bell(n(nn), l * BEAT + 1.0), 0.5); tr['bell'].add(T(40, b), bell(n(nn), l * BEAT + 1.0), 0.5)
    for (b, l, nn) in BELL_B2: tr['bell'].add(T(44, b), bell(n(nn), l * BEAT + 1.0), 0.45); tr['bell'].add(T(48, b), bell(n(nn), l * BEAT + 1.0), 0.45)
    for (b, l, nn) in BELL_B: tr['bell'].add(T(FIN, b), bell(n(nn), l * BEAT + 1.0), 0.45)
    the_end(tr)
    notes = sung()
    sing(tr, notes)

    def part(name, pan=0.0, width=0.0, *plugins):
        x = stereo(level(tr[name].buf, LEVEL[name]), pan, width)
        return fx(x, *plugins) if plugins else x
    rev = lambda m=0.2, size=0.5: pb.Reverb(room_size=size, wet_level=m, dry_level=1.0, width=1.0)
    inst = (
        part('kick', 0, 0, pb.Compressor(threshold_db=-10, ratio=3))
        + part('snare', 0, 0, rev(0.07, 0.3))
        + part('hat', 0.15, 0.4)
        + part('bass', 0, 0, pb.Compressor(threshold_db=-14, ratio=4))
        + part('keys', -0.2, 0.6, pb.Chorus(rate_hz=0.6, depth=0.25, mix=0.35), rev(0.25, 0.6))
        + part('pluck', 0.3, 0.5, pb.Delay(delay_seconds=BEAT * 0.75, feedback=0.3, mix=0.25), rev(0.2))
        + part('pad', 0, 0.8, rev(0.2, 0.6))
        + part('reese', 0, 0.3, pb.Distortion(drive_db=8), pb.LowpassFilter(1400))
        + part('b808', 0, 0, pb.Compressor(threshold_db=-12, ratio=3))
        + part('choir', 0, 1.0, rev(0.45, 0.85))
        + part('bell', 0.25, 0.6, pb.Delay(delay_seconds=BEAT * 1.5, feedback=0.35, mix=0.3), rev(0.5, 0.9))
        + part('crash', -0.1, 0.5)
        + part('fx', 0, 0.3, rev(0.3, 0.8))
        + part('sfx', 0, 0.4)
    )
    # WRATH: clean while he's the normal guy, glitchy in the snap bar, a distorted demon as the eye
    s1, g0, s2 = int(T(SNAP) * SR), int(T(SNAP, 2) * SR), int(T(SNAP + 1) * SR)
    w = stereo(tr['wrath'].buf.copy())
    w[:, s1:g0] = fx(w[:, s1:g0], pb.Bitcrush(bit_depth=6))
    w[:, s2:] = fx(w[:, s2:], pb.Distortion(drive_db=10), pb.HighpassFilter(180), pb.Delay(delay_seconds=BEAT * 0.5, feedback=0.25, mix=0.2))
    lo = fx(stereo(tr['wrath_lo'].buf), pb.Distortion(drive_db=16), pb.LowpassFilter(2200), pb.Bitcrush(bit_depth=8))
    wv = level(fx(w, pb.Compressor(threshold_db=-18, ratio=4), rev(0.18, 0.45)), -15) + level(lo, -21)
    bv = level(fx(stereo(tr['bf'].buf), pb.Compressor(threshold_db=-18, ratio=4), rev(0.15, 0.4)), -15)

    stems = [inst, wv, bv]
    for (bar, beat, beats, sl) in GLITCHES:
        for s in stems: stutter(s, T(bar, beat), beats * BEAT, sl * BEAT)
    for s in stems: tape_stop(s, T(SNAP, 2), BEAT, T(SNAP + 1))
    eq = (pb.HighpassFilter(28), pb.LowShelfFilter(cutoff_frequency_hz=90, gain_db=5), pb.HighShelfFilter(cutoff_frequency_hz=5500, gain_db=-4.5))
    stems = [fx(s, *eq) for s in stems]
    g = master_gain(sum(stems))
    stems = [s * g for s in stems]
    return stems, notes


# ---------------------------------------------------------------- the chart (V-Slice format)
def lanes(notes):
    """Arrow per note from the shape of the melody: big jump up = UP, step up = RIGHT,
    big drop = DOWN, step down = LEFT, same pitch = same arrow. Never the same arrow twice
    for two different pitches in a row, so runs roll across the arrows."""
    partner = {2: 3, 3: 2, 1: 0, 0: 1}
    for who in 'wb':
        seq = [x for x in notes if x['who'] == who]
        prev = None
        for i, x in enumerate(seq):
            if prev is None or x['beat'] - (prev['beat'] + prev['len']) > 1.5:      # a new phrase
                ahead = [y['m'] for y in seq[i:i + 8]]
                med = float(np.median(ahead))
                lane = 2 if x['m'] >= med + 3 else 3 if x['m'] >= med else 1 if x['m'] <= med - 3 else 0
            else:
                dm = x['m'] - prev['m']
                if dm == 0: lane = prev['lane']
                else:
                    lane = (2 if dm >= 3 else 3) if dm > 0 else (1 if dm <= -3 else 0)
                    if lane == prev['lane']: lane = partner[lane]
            x['lane'] = lane
            prev = x


def chart(notes):
    lanes(notes)
    out = {'easy': [], 'normal': [], 'hard': []}
    last_easy = {'w': -9.0, 'b': -9.0}
    for x in notes:
        nt = {'t': round(x['beat'] * BEAT * 1000, 2), 'd': x['lane'] + (4 if x['who'] == 'w' else 0)}
        if x['len'] >= 0.75: nt['l'] = round((x['len'] - 0.25) * BEAT * 1000, 2)
        out['hard'].append(nt)
        on8 = abs(x['beat'] * 2 - round(x['beat'] * 2)) < 1e-6
        if on8: out['normal'].append(nt)
        if on8 and x['beat'] - last_easy[x['who']] >= 1 - 1e-6:
            out['easy'].append(nt); last_easy[x['who']] = x['beat']
    events = [{'t': 0, 'e': 'FocusCamera', 'v': 1}]
    for bar, who in CAMERA[1:]: events.append({'t': round(T(bar) * 1000, 2), 'e': 'FocusCamera', 'v': who})
    events.append({'t': round(T(SNAP, 2) * 1000, 2), 'e': 'WrathSnap', 'v': {}})
    events.append({'t': round(T(OUT) * 1000, 2), 'e': 'PlayAnimation', 'v': {'target': 'bf', 'anim': 'hey', 'force': True}})
    events.sort(key=lambda e: e['t'])
    return {'version': '2.0.0', 'scrollSpeed': {'easy': 1.8, 'normal': 2.2, 'hard': 2.6}, 'events': events, 'notes': out,
            'generatedBy': 'FNF 2 - tools/own/glare.py'}


META = {
    'version': '2.2.4', 'songName': 'Glare', 'artist': 'FNF 2', 'charter': 'FNF 2', 'offsets': {},
    'playData': {
        'difficulties': ['easy', 'normal', 'hard'],
        'characters': {'player': 'bf', 'girlfriend': 'gf', 'opponent': 'wrath-normal', 'opponentVocals': ['wrath'], 'playerVocals': ['bf']},
        'stage': 'mainStage', 'noteStyle': 'funkin', 'ratings': {'easy': 3, 'normal': 5, 'hard': 7},
    },
    'generatedBy': 'FNF 2 - tools/own/glare.py',
    'timeChanges': [{'t': 0, 'b': 0, 'bpm': BPM, 'bt': [4, 4, 4, 4]}],
}
LEVEL_FILE = {'version': '1.0.0', 'name': 'WRATH', 'titleAsset': 'storymenu/titles/wrath', 'visible': False,
              'props': [], 'background': '#1a1023', 'songs': ['glare']}


def ogg(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wav = path[:-4] + '.tmp.wav'
    sf.write(wav, x.T, SR)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '6', path], check=True)
    os.remove(wav)


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument('--own', default=os.path.join(here, '..', '..', 'build', 'own'), help='where the song files go')
    ap.add_argument('--mp3', help='also write the full mix (Inst + both voices) here')
    a = ap.parse_args()
    (inst, wv, bv), notes = render()
    full = inst + wv + bv
    print('length', round(full.shape[1] / SR, 1), 's  peak', round(float(np.abs(full).max()), 3))
    ogg(os.path.join(a.own, 'songs/glare/Inst.ogg'), inst)
    ogg(os.path.join(a.own, 'songs/glare/Voices-wrath.ogg'), wv)
    ogg(os.path.join(a.own, 'songs/glare/Voices-bf.ogg'), bv)
    d = os.path.join(a.own, 'preload/data/songs/glare')
    os.makedirs(d, exist_ok=True)
    c = chart(notes)
    json.dump(META, open(os.path.join(d, 'glare-metadata.json'), 'w'), indent=1)
    json.dump(c, open(os.path.join(d, 'glare-chart.json'), 'w'))
    os.makedirs(os.path.join(a.own, 'preload/data/levels'), exist_ok=True)
    json.dump(LEVEL_FILE, open(os.path.join(a.own, 'preload/data/levels/wrath.json'), 'w'), indent=1)
    print('notes', {k: len(v) for k, v in c['notes'].items()})
    if a.mp3:
        wav = a.mp3.rsplit('.', 1)[0] + '.wav'
        sf.write(wav, full.T, SR)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-b:a', '192k', a.mp3], check=True)
        print('wrote', a.mp3)
