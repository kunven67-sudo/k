"""Talking "beep bop" blips for WRATH's intro dialogue, cut from FNF's own vocal stems
(read at build time, never committed): BF from his Bopeebo vocals, WRATH with his GLARE
stage-1 voice, GF from her Tutorial vocals. Each speaker gets a set of short syllables at
different pitches; the dialogue plays one per word.

  python3 fnf2/tools/own/intro_voices.py
Writes build/own/shared/sounds/wrath-intro/<who><n>.ogg (+ the Psych dialogue box sounds).
"""
import os, shutil, sys
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glare as Gl

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'build', 'own', 'shared', 'sounds', 'wrath-intro')
PSYCH = os.environ.get('PSYCH', '/home/user/ref/psych')
SR = Gl.SR


def gf_picks(n=5):
    """Find clean sung syllables in GF's tutorial vocals (strong onsets with a steady pitch)."""
    path = os.path.join(Gl.FNF, 'songs', 'tutorial', 'Voices-gf.ogg')
    x, sr = sf.read(path); x = x.mean(1) if x.ndim > 1 else x
    env = np.abs(signal.hilbert(x[: sr * 40]))
    env = signal.savgol_filter(env, 801, 2)
    thr = env.max() * 0.25
    on = np.nonzero((env[1:] > thr) & (env[:-1] <= thr))[0]
    picks = []
    for o in on:
        t = o / sr
        if picks and t - picks[-1][1] < 0.4: continue
        seg = x[o:o + int(0.3 * sr)]
        if len(seg) < 0.2 * sr or Gl.yin_pitch(signal.resample_poly(seg, SR, sr), SR) is None: continue
        picks.append(('tutorial/Voices-gf.ogg', t, 0.24))
        if len(picks) >= n: break
    return picks


def blips(voice, notes, length):
    out = []
    for m in notes:
        y = voice.note(m, length)
        f = np.ones(len(y)); a = min(len(y), int(0.006 * SR)); f[:a] = np.linspace(0, 1, a)
        out.append((y * f * 0.85).astype(np.float32))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    sets = {
        'bf': (Gl.Voice(Gl.BF_SYL), [64, 67, 69, 71, 66, 72, 62, 68], 0.15),
        'wrath': (Gl.Voice(Gl.WRATH_SYL), [57, 60, 59, 62, 55, 64, 58, 61], 0.17),
        'gf': (Gl.Voice(gf_picks()), [69, 72, 71, 74, 67, 76, 70, 73], 0.15),
    }
    for who, (v, notes, L) in sets.items():
        for i, y in enumerate(blips(v, notes, L)):
            sf.write(os.path.join(OUT, '%s%d.ogg' % (who, i)), y, SR, format='OGG', subtype='VORBIS')
        print(who, len(notes), 'blips', len(v.syl), 'source syllables')
    for f in ('dialogue.ogg', 'dialogueClose.ogg'):
        src = os.path.join(PSYCH, 'assets', 'shared', 'sounds', f)
        if os.path.exists(src): shutil.copy(src, os.path.join(OUT, f))


if __name__ == '__main__':
    main()
