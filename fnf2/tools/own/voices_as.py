"""Singing voices for the new playable characters (PRIVATE build only, written to the git-ignored build/own folder).

Darnell, Nene and Tankman sing BF's part of the songs until they get weeks of their own. FNF has no tracks
of them singing these melodies, so BF's own vocal track is changed into their voice: Rubber Band (pedalboard)
moves the pitch AND the voice's body (formants) together, so it sounds like a bigger / smaller person, not
like BF singing lower:

  Darnell  -3 semitones   (deeper, older)
  Tankman  -5 semitones   (big deep voice)
  Nene     +4 semitones   (higher, smaller)

Mono .ogg files, high quality (the asset packer makes the small mp3 the game carries):
  songs/<song>/Voices-as-<char>[-erect].ogg

  python3 tools/own/voices_as.py [char ...]
"""
import os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
import pedalboard

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FA = os.environ.get('FA', '/home/user/ref/fa')
OWN = os.path.join(ROOT, 'build', 'own')
CHARS = {'darnell': -3.0, 'tankman': -5.0, 'nene': 4.0}
# BF's vocal tracks in the game (FNF's + our own GLARE). Sky's songs are left out: the mod has one vocal
# track for both singers.
TRACKS = [
    ('tutorial', ''), ('bopeebo', ''), ('bopeebo', '-erect'), ('fresh', ''), ('fresh', '-erect'),
    ('dadbattle', ''), ('dadbattle', '-erect'), ('glare', ''),
]


def source(song, v):
    for base in (os.path.join(OWN, 'songs'), os.path.join(FA, 'songs')):
        p = os.path.join(base, song, 'Voices-bf' + v + '.ogg')
        if os.path.exists(p): return p
    return None


def make(song, v, char, st):
    src = source(song, v)
    if not src: return None
    audio, sr = sf.read(src, dtype='float32', always_2d=True)
    mono = audio.mean(1).astype(np.float32)
    out = pedalboard.time_stretch(mono[None, :], sr, stretch_factor=1.0, pitch_shift_in_semitones=st,
                                  high_quality=True, preserve_formants=False)[0]
    # same length as the original (the song lines up with the chart)
    n = len(mono)
    out = out[:n] if len(out) >= n else np.pad(out, (0, n - len(out)))
    peak = float(np.abs(out).max()) or 1.0
    if peak > 0.99: out *= 0.99 / peak
    dst = os.path.join(OWN, 'songs', song, 'Voices-as-' + char + v + '.ogg')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        sf.write(t.name, out, sr, subtype='PCM_16')
        tmp = t.name
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', '6', '-ac', '1', dst], check=True)
    os.unlink(tmp)
    return dst


def main():
    want = sys.argv[1:] or list(CHARS)
    total = 0
    for char in want:
        for song, v in TRACKS:
            d = make(song, v, char, CHARS[char])
            if d: total += os.path.getsize(d); print(char, song + v, os.path.getsize(d) // 1024, 'KB')
    print('total', total // 1024, 'KB')


if __name__ == '__main__':
    main()
