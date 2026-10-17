"""Sounds + music for WRATH's Brain Freeze cutscene in the park.

  * music  - the ice cream truck's tinny music-box jingle = WRATH's own GLARE tune, but cheerful
             (A major) and played through an old truck speaker. A little hint of who's coming.
  * voices - talking blips (one per couple of letters): BF from his real FNF voice (Week 7's beep
             + his Bopeebo syllables), GF from her Tutorial vocals, WRATH from his GLARE voice.
             Pitched up from the first intro (the user said the old ones were too deep).
  * sfx    - real CC0 recordings (OpenGameArt, see private/CREDITS-mods.txt): crunchy bite (starninjas
             "7 eating crunches"), metal clang for the trash can (bart "metal clang sounds"), ice
             crackle for the brain freeze (bart "ice spells"); plus small made ones (shiver, chatter).

  python3 fnf2/tools/own/park_audio.py
Writes build/own/shared/sounds/wrath-park/*.ogg + build/own/shared/music/wrath-park/jingle.ogg.
"""
import os, sys
import numpy as np
import soundfile as sf
from scipy import signal
import pedalboard as pb

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glare as Gl
import intro_voices as IV

ROOT = os.path.dirname(os.path.dirname(HERE))
SND = os.path.join(ROOT, 'build', 'own', 'shared', 'sounds', 'wrath-park')
MUS = os.path.join(ROOT, 'build', 'own', 'shared', 'music', 'wrath-park')
SFX = os.environ.get('SFX', '/home/user/ref/sfx')
SR = Gl.SR
RNG = np.random.default_rng(3)


def load(path):
    x, sr = sf.read(path, always_2d=True); x = x.mean(1)
    if sr != SR: x = signal.resample_poly(x, SR, sr)
    return x


def trim(x, thr=0.02, pre=0.005, post=0.05):
    env = np.abs(x); on = np.nonzero(env > env.max() * thr)[0]
    if not len(on): return x
    return x[max(0, on[0] - int(pre * SR)):on[-1] + int(post * SR)]


def fade(x, a=0.004, r=0.03):
    x = x.copy(); A, R = min(len(x), int(a * SR)), min(len(x), int(r * SR))
    x[:A] *= np.linspace(0, 1, A); x[-R:] *= np.linspace(1, 0, R); return x


def norm(x, peak=0.9): return x / (np.abs(x).max() + 1e-9) * peak


def save(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, np.clip(x, -1, 1).astype(np.float32), SR, format='OGG', subtype='VORBIS')


# ---------------------------------------------------------------- the jingle
MAJOR = {'C': 'C#', 'F': 'F#', 'G': 'G#'}                 # A minor -> A major


def to_major(nn):
    note, octv = nn[:-1], nn[-1]
    return MAJOR.get(note, note) + octv


def box(m, length):
    """Music box tine: bright, harmonic, quick decay, a little metallic."""
    L = int(length * SR); f = Gl.mtof(m); t = np.arange(L) / SR
    x = np.sin(2 * np.pi * f * t + 0.9 * Gl.expdec(L, 0.08) * np.sin(2 * np.pi * f * 4 * t))
    x += 0.35 * np.sin(2 * np.pi * f * 2 * t) * Gl.expdec(L, 0.2) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * Gl.expdec(L, 0.05)
    return x * Gl.expdec(L, 0.45) * 0.3


def pizz(m, length):
    L = int(length * SR); f = Gl.mtof(m); t = np.arange(L) / SR
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return x * Gl.expdec(L, 0.16) * 0.4


def jingle():
    bpm = 116; beat = 60 / bpm
    mel = [(b, l, to_major(nn)) for b, l, nn in Gl.WRATH_A]
    bars = 4; loops = 2
    total = int(bars * 4 * beat * loops * SR) + SR
    buf = np.zeros(total)
    def add(t, x, g=1.0):
        i = int(t * SR); x = x[:len(buf) - i]; buf[i:i + len(x)] += x * g
    chords = [['A3', 'C#4', 'E4'], ['D4', 'F#4', 'A4'], ['E3', 'G#3', 'B3'], ['A3', 'C#4', 'E4']]
    roots = ['A2', 'D2', 'E2', 'A2']
    for lp in range(loops):
        t0 = lp * bars * 4 * beat
        for b, l, nn in mel:
            add(t0 + b * beat, box(Gl.n(nn) + 12, l * beat + 0.6), 0.9)
        for bar in range(bars):
            for k in range(4):
                tb = t0 + (bar * 4 + k) * beat
                add(tb, pizz(Gl.n(roots[bar]) + (12 if k % 2 else 0), beat * 0.9), 0.55)
                if k % 2:
                    for c in chords[bar]: add(tb, box(Gl.n(c) + 12, beat * 0.8), 0.18)
                # tiny shaker
                sh = Gl.hp(RNG.uniform(-1, 1, int(0.05 * SR)), 6000) * Gl.expdec(int(0.05 * SR), 0.012)
                add(tb + beat / 2, sh, 0.08); add(tb, sh, 0.05)
    x = buf[:int(bars * 4 * beat * loops * SR)]
    # through an old truck speaker: band-limited, a little wobble + saturation, small room
    wob = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * np.arange(len(x)) / SR)
    idx = np.clip(np.cumsum(wob), 0, len(x) - 1)
    x = np.interp(idx, np.arange(len(x)), x)
    x = pb.Pedalboard([pb.HighpassFilter(380), pb.LowpassFilter(5200), pb.Distortion(drive_db=6), pb.Reverb(room_size=0.25, wet_level=0.12, dry_level=0.9)])(x[None, :].astype(np.float32), SR)[0]
    return norm(x, 0.7)


# ---------------------------------------------------------------- voices
def voices():
    out = {}
    bf_beep = trim(load(os.path.join(Gl.FNF, 'week7', 'sounds', 'bfBeep.ogg')))
    out['bf-beep'] = fade(norm(bf_beep, 0.85))
    sets = {
        'bf': (Gl.Voice(Gl.BF_SYL), [66, 69, 71, 73, 68, 74, 64, 70], 0.13),
        'wrath': (Gl.Voice(Gl.WRATH_SYL), [64, 67, 66, 69, 62, 71, 65, 68], 0.12),
        'gf': (Gl.Voice(IV.gf_picks()), [74, 77, 76, 79, 72, 81, 75, 78], 0.11),
    }
    for who, (v, notes, L) in sets.items():
        for i, y in enumerate(IV.blips(v, notes, L)): out['%s%d' % (who, i)] = fade(y, 0.003, 0.02)
    # GF laughing: her blips in a quick bouncing "ha-ha-ha-ha"
    v = Gl.Voice(IV.gf_picks())
    laugh = np.zeros(int(1.4 * SR))
    for k, m in enumerate([81, 79, 81, 78, 79, 76]):
        y = v.note(m, 0.1) * (1 - k * 0.08)
        i = int(k * 0.19 * SR); laugh[i:i + len(y)] += fade(y, 0.002, 0.03)
    out['gf-laugh'] = norm(laugh, 0.8)
    return out


# ---------------------------------------------------------------- sfx
def shiver():
    """Teeth chattering: quick tiny clicks, shaky rhythm."""
    L = int(1.6 * SR); x = np.zeros(L); t = 0.0
    while t < 1.5:
        c = Gl.bp(RNG.uniform(-1, 1, int(0.012 * SR)), 2500, 7000) * Gl.expdec(int(0.012 * SR), 0.002)
        i = int(t * SR); x[i:i + len(c)] += c * RNG.uniform(0.5, 1.0) * (1 - t / 1.8)
        t += RNG.uniform(0.045, 0.07)
    return norm(x, 0.5)


def sparkle():
    """Ice sparkle: a quick run of high glassy chimes."""
    L = int(1.2 * SR); x = np.zeros(L)
    for k, m in enumerate([96, 100, 103, 108, 101, 105]):
        y = box(m, 0.6) * (1 - k * 0.1)
        i = int(k * 0.05 * SR); x[i:i + len(y)] += y
    return norm(pb.Pedalboard([pb.Reverb(room_size=0.6, wet_level=0.35)])(x[None, :].astype(np.float32), SR)[0], 0.55)


def whoosh(length=0.35, lo=400, hi=3000):
    L = int(length * SR); t = np.linspace(0, 1, L)
    nz = RNG.uniform(-1, 1, L)
    out = np.zeros(L); seg = 512
    for s in range(0, L, seg):
        k = s / L; fc = lo + (hi - lo) * np.sin(np.pi * k)
        out[s:s + seg] = Gl.bp(nz[s:s + seg + 0], max(60, fc * 0.6), fc * 1.4)[:len(out[s:s + seg])]
    return norm(out * np.sin(np.pi * t) ** 1.5, 0.45)


def puff():
    L = int(0.4 * SR)
    x = Gl.lp(RNG.uniform(-1, 1, L), 900) * Gl.expdec(L, 0.08)
    return norm(x, 0.5)


def sfx():
    out = {}
    cr = [trim(load(os.path.join(SFX, 'crunch', 'crunch.%d.ogg' % i))) for i in (3, 4, 6)]
    out['crunch'] = fade(norm(cr[0], 0.95), 0.002, 0.08)
    out['crunch2'] = fade(norm(cr[1], 0.85), 0.002, 0.08)
    ice = trim(load(os.path.join(SFX, 'ice', 'ice.wav')))
    out['freeze'] = fade(norm(ice[:int(1.1 * SR)], 0.7), 0.002, 0.2)
    out['sparkle'] = sparkle()
    out['shiver'] = shiver()
    # the trash can: pick the clang with the most energy in its first half second
    best = None
    for i in range(1, 12):
        p = os.path.join(SFX, 'clangs', 'clang - Marker #%d.wav' % i)
        if not os.path.exists(p): continue
        c = trim(load(p))[:int(1.6 * SR)]
        e = np.sqrt(np.mean(c[:int(0.4 * SR)] ** 2))
        if best is None or e > best[0]: best = (e, c, i)
    out['clang'] = fade(norm(best[1], 0.95), 0.002, 0.3)
    out['whoosh'] = whoosh()
    out['whip'] = whoosh(0.22, 800, 5000)
    out['puff'] = puff()
    out['toss'] = whoosh(0.3, 600, 2400) * 0.7
    print('clang from marker', best[2])
    return out


def main():
    save(os.path.join(MUS, 'jingle.ogg'), jingle())
    for k, v in voices().items(): save(os.path.join(SND, k + '.ogg'), v)
    for k, v in sfx().items(): save(os.path.join(SND, k + '.ogg'), v)
    print('wrote', sorted(os.listdir(SND)))


if __name__ == '__main__':
    main()
