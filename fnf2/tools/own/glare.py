"""GLARE - WRATH's own song (original), made in code.

Stage 1: a funky night-street groove while he's still the normal guy.
The snap: the beat tape-stops, a heartbeat, the eye opens.
Stage 2: heavy and creepy for the giant eye (reese bass, 808, choir, music-box bell).

Instruments are synthesised here (numpy) and mixed with pedalboard effects.
The singing uses syllables cut from FNF's own vocal stems (BF's real "beep"s;
WRATH = a deep male syllable pitched into his range, demonic in stage 2), read
from the asset checkout at build time - the audio never goes in the repo.

  python3 fnf2/tools/own/glare.py --test OUT.mp3      # the short test mix
"""
import argparse, math, os, subprocess
import numpy as np
import soundfile as sf
import pedalboard as pb
from scipy import signal

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


# chords per bar (voicings) and bass roots
S1_CHORDS = [['A3', 'C4', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4'], ['G3', 'B3', 'D4', 'E4'], ['E3', 'G3', 'B3', 'D4']]
S1_ROOTS = ['A1', 'F1', 'G1', 'E1']
S2_CHORDS = [['A3', 'C4', 'E4'], ['Bb3', 'D4', 'F4'], ['A3', 'C4', 'E4'], ['G#3', 'B3', 'E4']]
S2_ROOTS = ['A1', 'Bb1', 'A1', 'E1']

# melodies: (beat, length, note) over 4 bars
WRATH_A = [(0, .5, 'A4'), (.75, .5, 'C5'), (1.5, .5, 'A4'), (2.5, .5, 'E4'), (3, .5, 'G4'), (3.5, .5, 'A4'),
           (4, .75, 'C5'), (5, .5, 'B4'), (5.5, .5, 'A4'), (6, 1, 'G4'), (7, .5, 'E4'),
           (8, .5, 'A4'), (8.75, .5, 'C5'), (9.5, .5, 'D5'), (10.5, .5, 'C5'), (11, .5, 'A4'), (11.5, .5, 'C5'),
           (12, .75, 'D5'), (13, .5, 'C5'), (13.5, .5, 'A4'), (14, 1.5, 'A4')]
BF_A = [(0, .5, 'C5'), (.75, .5, 'E5'), (1.5, .5, 'C5'), (2.5, .5, 'A4'), (3, .5, 'C5'), (3.5, .5, 'D5'),
        (4, .75, 'E5'), (5, .5, 'D5'), (5.5, .5, 'C5'), (6, 1, 'B4'), (7, .5, 'G4'),
        (8, .5, 'A4'), (8.75, .5, 'C5'), (9.5, .5, 'E5'), (10.5, .5, 'D5'), (11, .5, 'C5'), (11.5, .5, 'E5'),
        (12, .75, 'G5'), (13, .5, 'E5'), (13.5, .5, 'D5'), (14, 1.5, 'E5')]
WRATH_B = [(0, .5, 'A3'), (.5, .5, 'A3'), (1, .5, 'C4'), (1.5, .5, 'A3'), (2.5, .5, 'Bb3'), (3, 1, 'A3'),
           (4, .5, 'D4'), (4.5, .5, 'C4'), (5, .5, 'Bb3'), (5.5, .5, 'A3'), (6, .5, 'Bb3'), (6.5, 1, 'D4'),
           (8, .5, 'E4'), (8.5, .5, 'D4'), (9, .5, 'C4'), (9.5, .5, 'D4'), (10, .5, 'E4'), (10.5, .5, 'F4'), (11, 1, 'E4'),
           (12, .5, 'G#3'), (12.5, .5, 'B3'), (13, .5, 'D4'), (13.5, .5, 'F4'), (14, 1.5, 'E4')]
BF_B = [(0, .5, 'A4'), (.5, .5, 'C5'), (1, .5, 'E5'), (1.5, .5, 'C5'), (2.5, .5, 'D5'), (3, 1, 'C5'),
        (4, .5, 'F5'), (4.5, .5, 'E5'), (5, .5, 'D5'), (5.5, .5, 'C5'), (6, .5, 'D5'), (6.5, 1, 'F5'),
        (8, .5, 'E5'), (8.5, .5, 'F5'), (9, .5, 'E5'), (9.5, .5, 'D5'), (10, .5, 'C5'), (10.5, .5, 'B4'), (11, 1, 'C5'),
        (12, .5, 'B4'), (12.5, .5, 'D5'), (13, .5, 'E5'), (13.5, .5, 'D5'), (14, 1.5, 'E5')]
BELL_B = [(0, 1, 'E5'), (1, 1, 'F5'), (2, 1, 'E5'), (3, 1, 'D#5'), (4, 1, 'E5'), (5, 1, 'A5'), (6, 2, 'G#5')]

# voices: syllables from FNF's own stems (path, start s, length s)
BF_SYL = [('bopeebo/Voices-bf.ogg', 17.1, 0.27), ('bopeebo/Voices-bf.ogg', 21.91, 0.22), ('bopeebo/Voices-bf.ogg', 16.79, 0.2), ('bopeebo/Voices-bf.ogg', 7.2, 0.5)]
WRATH_SYL = [('bopeebo/Voices-dad.ogg', 14.7, 0.28), ('bopeebo/Voices-dad.ogg', 15.3, 0.16), ('bopeebo/Voices-dad.ogg', 14.4, 0.2), ('bopeebo/Voices-dad.ogg', 4.8, 0.5)]

# song map (bars): 0-3 intro, 4-7 WRATH, 8-11 BF, 12-13 the snap, 14-17 WRATH (eye), 18-21 BF, 22 ending
INTRO, W1, B1, SNAP, W2, B2, END = 0, 4, 8, 12, 14, 18, 22


def render_test():
    total = int((T(END + 2)) * SR)
    tr = {k: Track(total) for k in ('kick', 'snare', 'hat', 'bass', 'keys', 'pluck', 'pad', 'reese', 'b808', 'choir', 'bell', 'crash', 'fx', 'wrath', 'wrath_lo', 'bf')}

    # ---- stage 1 groove (bars 0-11, stops mid bar 12)
    for bar in range(0, SNAP + 1):
        last = bar == SNAP
        for st in range(16):
            tt = T(bar, st / 4)
            if last and st >= 8: break
            if st in (0, 7, 8, 10) and not (bar < 2 and st in (7, 10)): tr['kick'].add(tt, kick(), 0.9)
            if st in (4, 12): tr['snare'].add(tt, snare(), 0.8); tr['snare'].add(tt, clap(), 0.35)
            if bar >= 1 and st % 2 == 0: tr['hat'].add(tt, hat(st % 4 == 2 and st in (6, 14)), 0.55 if st % 4 else 0.35)
            if bar >= 2 and st in (13, 15): tr['hat'].add(tt, hat(), 0.25)
        ci = bar % 4
        if bar >= 1:
            # funky bass: root, octave pops, walk-up
            r = n(S1_ROOTS[ci])
            for (b, l, iv) in ((0, .5, 0), (.75, .25, 12), (1.5, .5, 0), (2, .25, 7), (2.5, .5, 12), (3, .25, 10), (3.5, .5, 7)):
                if last and b >= 2: break
                tr['bass'].add(T(bar, b), funk_bass(r + 12 + iv, l * BEAT * 0.95), 0.7)
        for (b, l) in ((0, 1.4), (1.5, .4), (2.5, 1.3)):           # e-piano stabs
            if last and b >= 2: break
            for nn in S1_CHORDS[ci]: tr['keys'].add(T(bar, b), epiano(n(nn), l * BEAT), 0.55)
        if bar >= W1 and not last:                                  # little pluck counter-line
            arp = [S1_CHORDS[ci][k % 4] for k in (0, 2, 3, 2, 1, 2, 3, 2)]
            for k, nn in enumerate(arp): tr['pluck'].add(T(bar, k / 2), pluck(n(nn) + 12, 0.45 * BEAT), 0.4)
        if bar % 4 == 0 and bar > 0: tr['crash'].add(T(bar), crash(), 0.5)

    # ---- the snap: tape-stop the beat in bar 12, then heartbeat + rising dread into bar 14
    snap_t = T(SNAP, 2)
    hb = lp(kick(0.4), 160)
    for beat, g in ((0.0, 1.2), (0.45, 0.8), (2.0, 1.2), (2.45, 0.8)):          # lub-dub, lub-dub
        tr['fx'].add(T(SNAP + 1, beat), hb, g)
    L = int(4 * BEAT * SR)
    tr['fx'].add(T(SNAP + 1), bp(noise(L), 300, 6000) * np.linspace(0, 1, L) ** 2.5 * 0.6, 0.7)   # dread riser

    # ---- stage 2: heavy (bars 14-21)
    for bar in range(W2, END):
        ci = (bar - W2) % 4
        for st in range(16):
            tt = T(bar, st / 4)
            if st in (0, 3, 10): tr['kick'].add(tt, kick(1.6), 1.0)
            if st == 8: tr['snare'].add(tt, snare(), 1.0); tr['snare'].add(tt, clap(), 0.6)
            if st % 2 == 0 or (bar % 2 and st > 11): tr['hat'].add(tt, hat(), 0.45)
        r = n(S2_ROOTS[ci])
        tr['b808'].add(T(bar, 0), b808(r + 12, 0.7 * BEAT * 3), 0.9)
        tr['b808'].add(T(bar, 2.5), b808(r + 12, 0.7 * BEAT * 1.5), 0.7)
        tr['reese'].add(T(bar), reese(r + 12, 4 * BEAT), 0.55)
        for nn in S2_CHORDS[ci]:
            tr['choir'].add(T(bar), choir(n(nn), 4 * BEAT), 0.5)
            for b in (0, 1.5, 3):
                tr['pad'].add(T(bar, b), supersaw(n(nn), 0.45 * BEAT, 2400, 0.004), 0.35)
        if bar % 4 == 0: tr['crash'].add(T(bar), crash(), 0.7)
    for start in (W2, B2):
        for (b, l, nn) in BELL_B:
            tr['bell'].add(T(start, b), bell(n(nn), l * BEAT + 1.0), 0.5)
    tr['crash'].add(T(END), crash(), 0.9)
    tr['kick'].add(T(END), kick(1.8), 1.0)
    for nn in S2_CHORDS[0]: tr['choir'].add(T(END), choir(n(nn), 4 * BEAT), 0.6)
    tr['b808'].add(T(END), b808(n('A2'), 3.0), 1.0)

    # ---- voices
    wv, bv = Voice(WRATH_SYL), Voice(BF_SYL)
    for (b, l, nn) in WRATH_A: tr['wrath'].add(T(W1, b), wv.note(n(nn) - 5, l * BEAT), 0.8)
    for (b, l, nn) in BF_A: tr['bf'].add(T(B1, b), bv.note(n(nn) - 4, l * BEAT), 0.8)
    for (b, l, nn) in WRATH_B:
        tr['wrath'].add(T(W2, b), wv.note(n(nn) + 2, l * BEAT), 0.75)
        tr['wrath_lo'].add(T(W2, b), wv.note(n(nn) - 10, l * BEAT), 0.7)      # the demon underneath
    for (b, l, nn) in BF_B: tr['bf'].add(T(B2, b), bv.note(n(nn) - 4, l * BEAT), 0.8)

    # ---- mix
    s2 = int(T(W2) * SR)
    LEVEL = {'kick': -12, 'snare': -17, 'hat': -29, 'bass': -16, 'keys': -21, 'pluck': -25, 'pad': -23, 'reese': -19,
             'b808': -15, 'choir': -23, 'bell': -22, 'crash': -31, 'fx': -31}
    def level(x, db):
        # loudness of the parts where it actually plays -> target dB
        a = np.abs(x); on = a > a.max() * 0.02
        r = np.sqrt((x[on] ** 2).mean()) if on.any() else 1.0
        return x * (10 ** (db / 20) / max(r, 1e-9))
    def part(name, pan=0.0, width=0.0, *plugins):
        x = stereo(level(tr[name].buf, LEVEL[name]), pan, width)
        return fx(x, *plugins) if plugins else x
    rev = lambda m=0.2, size=0.5: pb.Reverb(room_size=size, wet_level=m, dry_level=1.0, width=1.0)
    mix = (
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
    )
    # tape stop: the whole groove slows to nothing over one beat at the snap
    a = int(snap_t * SR); L = int(BEAT * 1.0 * SR)
    seg = mix[:, a:a + L * 2]
    rate = np.linspace(1.0, 0.0, L) ** 1.6
    pos = np.cumsum(rate); pos = pos[pos < seg.shape[1] - 1]
    stop = np.stack([np.interp(pos, np.arange(seg.shape[1]), seg[c]) for c in range(2)]) * np.linspace(1, 0.2, len(pos))
    mix[:, a:a + len(pos)] = stop
    mix[:, a + len(pos):int(T(SNAP + 1) * SR)] *= 0.0
    # voices on top (with the eye's stage-2 voice demonic)
    voc1 = stereo(tr['wrath'].buf.copy())
    voc1[:, s2:] = fx(voc1[:, s2:], pb.Distortion(drive_db=10), pb.HighpassFilter(180), pb.Delay(delay_seconds=BEAT * 0.5, feedback=0.25, mix=0.2))
    lo = fx(stereo(tr['wrath_lo'].buf), pb.Distortion(drive_db=16), pb.LowpassFilter(2200), pb.Bitcrush(bit_depth=8))
    voc = (level(fx(voc1, pb.Compressor(threshold_db=-18, ratio=4), rev(0.18, 0.45)), -15) + level(lo, -21)
           + level(fx(stereo(tr['bf'].buf), pb.Compressor(threshold_db=-18, ratio=4), rev(0.15, 0.4)), -15))
    out = mix + voc
    out = fx(out, pb.HighpassFilter(28), pb.LowShelfFilter(cutoff_frequency_hz=90, gain_db=5), pb.HighShelfFilter(cutoff_frequency_hz=5500, gain_db=-4.5),
             pb.Compressor(threshold_db=-16, ratio=2, attack_ms=15, release_ms=150), pb.Gain(4), pb.Limiter(threshold_db=-1.0))
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--test', required=True)
    a = ap.parse_args()
    out = render_test()
    wav = a.test.rsplit('.', 1)[0] + '.wav'
    sf.write(wav, out.T, SR)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-b:a', '192k', a.test], check=True)
    print('wrote', a.test, round(out.shape[1] / SR, 1), 's')
