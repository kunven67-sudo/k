"""Video songs for FNF 2 (PRIVATE build only: written to the git-ignored build/mods/videosongs, never the repo).

A video song plays a video behind the arrows instead of a stage (Options > Video songs = Characters puts your
picked player on a stage made from the video instead). You sing every sung line; whenever the people in the
video TALK, arrows play by themselves on the other side.

  Into Our Lives   two TikToks by kip.zig (Minecraft animation, the user's picks in fnf2/private/):
                   video-song-5.mp4 = the zombie + the robot talking about trying "that FNF stuff" over the beat,
                   video-song-4.mp4 = the whole song. Both are the same beat (clip 4 = clip 5 + 3.0824 s), so the
                   talk plays first, then the song comes in from its quiet intro.

What it does:
  video   the sharp part of the TikTok frame (576x324 at y 350; the blurred bars + the TikTok name are cut off).
          The first ~5 s of both clips have the TikTok logo ON the picture, so those seconds show the clean frames
          right after it (same shot), slowed down to fill the gap. Joined, upscaled to 960x540, WebM.
  audio   demucs (htdemucs) splits voices from the beat: Inst = the beat, Voices-talk = the talk (other side),
          Voices-player = the singing (yours: goes quiet on a miss).
  chart   notes from the vocals: syllable onsets (librosa), pitch (pYIN) -> lanes follow the melody inside each
          phrase, long held notes -> holds, snapped to the beat grid (16ths or triplets) when close.
          HARD = every syllable, NORMAL + EASY thinned. The talk's notes are the same on every difficulty.
  extras  a stage picture from the video (Characters mode), health/freeplay icons from the robot's face.

  python3 tools/own/video_song.py
"""
import json, os, shutil, subprocess, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRIV = os.environ.get('FNF_PRIVATE', os.path.join(ROOT, 'private'))
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'videosongs')
WORK = os.environ.get('VS_WORK', '/tmp/claude-0/vs')

SID = 'into-our-lives'
V_TALK, V_SONG = os.path.join(PRIV, 'video-song-5.mp4'), os.path.join(PRIV, 'video-song-4.mp4')
BEAT = 0.580667                  # 103.33 bpm (autocorrelation over the whole song)
OFF = 3.0824                     # song clip time = talk clip time + OFF
J_TALK, J_SONG = 19.62, 3.30     # the talk ends here (talk clip) -> the song comes in from here (song clip)
SONG_GRID0 = 0.0232              # first beat of the song clip's grid
CLEAN_FROM = 5.0                 # the TikTok logo is on the picture before this (both clips)
BAND = (0, 350, 576, 324)        # x, y, w, h of the sharp picture inside the 576x1024 TikTok frame
FIRST_TALK_ARROWS = 7.0          # the first line ("people really like that FNF stuff") gets no arrows
SR = 44100


def c_from_song(t): return J_TALK + (t - J_SONG)        # song clip time -> combined time


def out(*p):
    q = os.path.join(OWN, *p); os.makedirs(os.path.dirname(q), exist_ok=True); return q


def run(cmd): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# ---------------------------------------------------------------- stems
def stems():
    """voc/inst of both clips (44.1 kHz stereo), split once by demucs and kept in WORK."""
    os.makedirs(WORK, exist_ok=True)
    need = [n for n in ('4', '5') if not (os.path.exists(f'{WORK}/voc{n}.wav') and os.path.exists(f'{WORK}/inst{n}.wav'))]
    if need:
        import torch
        from demucs.pretrained import get_model
        from demucs.apply import apply_model
        m = get_model('htdemucs'); m.eval()
        for n in need:
            src = V_SONG if n == '4' else V_TALK
            run(['ffmpeg', '-y', '-i', src, '-vn', '-c:a', 'pcm_s16le', '-ar', str(SR), f'{WORK}/full{n}.wav'])
            a, _ = sf.read(f'{WORK}/full{n}.wav', dtype='float32')
            if a.ndim == 1: a = np.stack([a, a], 1)
            with torch.no_grad(): o = apply_model(m, torch.tensor(a.T)[None], device='cpu', split=True, overlap=0.25, progress=False)[0]
            vi = m.sources.index('vocals')
            sf.write(f'{WORK}/voc{n}.wav', o[vi].numpy().T, SR); sf.write(f'{WORK}/inst{n}.wav', (o.sum(0) - o[vi]).numpy().T, SR)
    load = lambda f: sf.read(f, dtype='float32')[0]
    return {k: load(f'{WORK}/{k}.wav') for k in ('voc4', 'inst4', 'voc5', 'inst5')}


def fade(a, n, out_=True):
    a = a.copy(); r = np.linspace(1, 0, n) if out_ else np.linspace(0, 1, n)
    if out_: a[-n:] *= r[:, None]
    else: a[:n] *= r[:, None]
    return a


def audio(S):
    """Inst + the two voice tracks on the combined timeline (talk, then the song)."""
    jt, js = int(J_TALK * SR), int(J_SONG * SR)
    xf = int(0.12 * SR)
    inst = np.concatenate([fade(S['inst5'][:jt], xf), fade(S['inst4'][js:], int(0.03 * SR), False)])
    talk = np.concatenate([fade(S['voc5'][:jt], int(0.04 * SR)), np.zeros_like(S['voc4'][js:])])
    sing = np.concatenate([np.zeros_like(S['voc5'][:jt]), S['voc4'][js:]])
    d = out('songs', SID, 'x')
    for name, a in (('Inst', inst), ('Voices-talk', talk), ('Voices-player', sing)):
        w = os.path.join(WORK, name + '.wav'); sf.write(w, a, SR)
        run(['ffmpeg', '-y', '-i', w, '-c:a', 'libvorbis', '-q:a', '6', os.path.join(os.path.dirname(d), name + '.ogg')])
    return len(inst) / SR


# ---------------------------------------------------------------- video
def video(total):
    """the sharp picture of both clips, the logo seconds replaced by the clean ones slowed down, 960x540 WebM."""
    x, y, w, h = BAND
    crop, scale = f'crop={w}:{h}:{x}:{y}', 'scale=960:540:flags=lanczos,setsar=1'
    tmp = os.path.join(WORK, 'vparts'); os.makedirs(tmp, exist_ok=True)
    # talk: the clean 5.0-19.62 s stretched over 0-19.62 s; song: clean 5.0-6.65 s over 3.30-6.65 s, then as it is
    parts = [
        (V_TALK, CLEAN_FROM, J_TALK, J_TALK),
        (V_SONG, CLEAN_FROM, 6.65, 6.65 - J_SONG),
        (V_SONG, 6.65, None, None),
    ]
    files = []
    for i, (src, a, b, dur) in enumerate(parts):
        f = os.path.join(tmp, f'p{i}.mp4')
        cmd = ['ffmpeg', '-y', '-ss', str(a)] + (['-to', str(b)] if b else []) + ['-i', src, '-an']
        if dur:
            k = dur / (b - a)
            vf = f'{crop},setpts={k:.6f}*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir,{scale}'
        else:
            vf = f'{crop},fps=30,{scale}'
        run(cmd + ['-vf', vf, '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f])
        files.append(f)
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{f}'\n" for f in files))
    joined = os.path.join(tmp, 'joined.mp4')
    run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined])
    dst = out('videos', SID + '.webm')
    run(['ffmpeg', '-y', '-i', joined, '-t', f'{total:.3f}', '-c:v', 'libvpx-vp9', '-b:v', '1300k', '-crf', '33',
         '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', dst])
    return dst


# ---------------------------------------------------------------- chart
def vocal_notes(y, t0, t1, shift, sr=22050, min_gap=0.11, rel_db=-30):
    """syllables of a vocal stem between t0 and t1 (clip time), as combined-timeline notes with pitch + length."""
    import librosa
    seg = y[int(t0 * SR):int(t1 * SR)]
    seg = librosa.resample(seg.mean(1) if seg.ndim > 1 else seg, orig_sr=SR, target_sr=sr)
    hop = 256
    ons = librosa.onset.onset_detect(y=seg, sr=sr, hop_length=hop, backtrack=False, units='frames', delta=0.06, wait=2)
    rms = librosa.feature.rms(y=seg, frame_length=1024, hop_length=hop)[0]
    thr = np.percentile(rms[rms > 0], 95) * (10 ** (rel_db / 20))
    f0, voiced, _ = librosa.pyin(seg, fmin=70, fmax=1000, sr=sr, frame_length=2048, hop_length=hop)
    fps = sr / hop
    notes, last = [], -1e9
    for k, fr in enumerate(ons):
        if rms[fr:fr + 4].max() < thr: continue
        t = fr / fps
        if t - last < min_gap: continue
        nxt = ons[k + 1] if k + 1 < len(ons) else len(rms)
        # voiced run from the onset (a held syllable stays voiced)
        e = fr
        while e < len(voiced) - 1 and (voiced[e] or voiced[e + 1]) and rms[e] > thr * 0.5: e += 1
        p = f0[fr:fr + 8]; p = p[~np.isnan(p)]
        pitch = float(np.median(12 * np.log2(p / 440))) if len(p) else None
        notes.append(dict(t=t + t0 + shift, len=(min(e, nxt) - fr) / fps, pitch=pitch, gap=(nxt - fr) / fps))
        last = t
    return notes


def snap(t, grid0):
    """onto the beat grid when close: 16ths first, then triplets (8th/16th)."""
    for div, tol in ((4, 0.04), (6, 0.03)):
        step = BEAT / div; q = grid0 + round((t - grid0) / step) * step
        if abs(q - t) <= tol: return q
    return t


def lanes(notes):
    """lanes follow the melody inside each phrase: the lowest notes left/down, the highest up/right; no lane more
    than 3 times in a row, no quick jacks."""
    out, phrase = [], []
    def flush():
        if not phrase: return
        ps = [n['pitch'] for n in phrase if n['pitch'] is not None]
        lo, hi = (min(ps), max(ps)) if ps else (0, 0)
        prev, run_ = None, 0
        for n in phrase:
            if n['pitch'] is None or hi - lo < 0.8: lane = (prev + 1) % 4 if prev is not None else 0
            else: lane = min(3, int((n['pitch'] - lo) / (hi - lo + 1e-6) * 4))
            if lane == prev:
                run_ += 1
                if run_ >= 3 or (out and n['t'] - out[-1]['t'] < 0.16): lane = (lane + (1 if lane < 3 else -1)) % 4; run_ = 0
            else: run_ = 0
            n['lane'] = lane; prev = lane; out.append(n)
        phrase.clear()
    for n in notes:
        if phrase and n['t'] - phrase[-1]['t'] > 0.6: flush()
        phrase.append(n)
    flush()
    return out


def to_chart(notes, side, hold_min):
    base = 0 if side == 'player' else 4
    res = []
    for n in notes:
        q = dict(t=round(n['t'] * 1000, 2), d=base + n['lane'])
        if n['len'] >= hold_min: q['l'] = round((n['len'] - 0.06) * 1000, 2)
        res.append(q)
    return res


def thin(notes, min_gap, hold_min):
    out, last = [], -1e9
    for n in notes:
        if n['t'] - last < min_gap: continue
        out.append(n); last = n['t']
    return out, hold_min


def chart(S):
    talk = vocal_notes(S['voc5'], FIRST_TALK_ARROWS, J_TALK - 0.02, 0, min_gap=0.14)
    sing = vocal_notes(S['voc4'], J_SONG, len(S['voc4']) / SR, J_TALK - J_SONG)
    g0 = c_from_song(SONG_GRID0)
    for n in sing: n['t'] = snap(n['t'], g0)
    talk, sing = lanes(talk), lanes(sing)
    notes, speed = {}, {'easy': 1.7, 'normal': 2.1, 'hard': 2.5}
    for diff, (gap, hold) in {'easy': (0.42, 0.55), 'normal': (0.21, 0.42), 'hard': (0.0, 0.34)}.items():
        s, h = thin(sing, gap, hold)
        tk, _ = thin(talk, 0.3 if diff == 'easy' else 0.0, 9)
        notes[diff] = sorted(to_chart(s, 'player', h) + to_chart(tk, 'opp', 9), key=lambda q: (q['t'], q['d']))
    events = [dict(t=0, e='FocusCamera', v=dict(char=0))]
    json.dump(dict(version='2.0.0', scrollSpeed=speed, events=events, notes=notes, generatedBy='FNF 2 - tools/own/video_song.py'),
              open(out('preload', 'data', 'songs', SID, SID + '-chart.json'), 'w'))
    return {d: sum(1 for q in v if q['d'] < 4) for d, v in notes.items()}, len(talk)


def metadata(total):
    # beats: the talk clip's grid, one quick beat at the join, then the song clip's grid
    a0 = (SONG_GRID0 - OFF) % BEAT
    last_a = a0 + int((J_TALK - a0) / BEAT) * BEAT
    g0 = c_from_song(SONG_GRID0); first_b = g0 + np.ceil((last_a + 0.05 - g0) / BEAT) * BEAT
    bpm = round(60 / BEAT, 4)
    tc = [dict(t=round(a0 * 1000, 3), b=0, bpm=bpm, bt=[4, 4, 4, 4]),
          dict(t=round(last_a * 1000, 3), bpm=round(60 / (first_b - last_a), 4), bt=[4, 4, 4, 4]),
          dict(t=round(first_b * 1000, 3), bpm=bpm, bt=[4, 4, 4, 4])]
    m = dict(version='2.2.4', songName='Into Our Lives', artist='kip.zig', charter='FNF 2', offsets={},
             playData=dict(difficulties=['easy', 'normal', 'hard'],
                           characters=dict(player='bf', girlfriend='', opponent='kip-talk', instrumental='', playerVocals=['player'], opponentVocals=['talk']),
                           stage='kipVillage', noteStyle='funkin', ratings=dict(easy=3, normal=5, hard=8), album='volume1',
                           previewStart=int(c_from_song(36.5) * 1000), previewEnd=int(c_from_song(51.5) * 1000),
                           anyPlayer=True, video=dict(path='videos/' + SID + '.webm', length=round(total, 3))),
             generatedBy='FNF 2 - tools/own/video_song.py', timeChanges=tc)
    json.dump(m, open(out('preload', 'data', 'songs', SID, SID + '-metadata.json'), 'w'), indent=1)
    json.dump(dict(version='1.0.0', name='VIDEO SONGS', titleAsset='storymenu/titles/tutorial', visible=False, props=[],
                   background='#1b2433', capsule=dict(name='VIDEO SONG'), songs=[SID]),
              open(out('preload', 'data', 'levels', 'videosongs.json'), 'w'), indent=1)
    # the people talking stand nowhere: the arrows on the left are theirs
    json.dump(dict(version='1.0.0', name='kip.zig', renderType='own', scale=1, singTime=4, danceEvery=1, offsets=[0, 0],
                   cameraOffsets=[0, 0], healthIcon=dict(id='kip'), animations=[]),
              open(out('preload', 'data', 'characters', 'kip-talk.json'), 'w'), indent=1)


def robot_icon(size, losing=False):
    """the robot's head (a TV box: cream frame, cyan screen, two slit eyes), colours from the daytime clip,
    blocky like the Minecraft model, with a black outline like FNF's icons."""
    from PIL import Image, ImageDraw
    k = size / 150
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    R = lambda x0, y0, x1, y1, c: d.rectangle([round(x0 * k), round(y0 * k), round(x1 * k) - 1, round(y1 * k) - 1], fill=c)
    ink, cream, side, cyan, cyan2, eye = '#111111', '#ece4d6', '#c7baa6', '#36b2d4', '#2a8fb0', '#141414'
    if losing: cyan, cyan2 = '#2b8aa6', '#216e88'
    R(14, 26, 136, 132, ink)                  # outline
    R(20, 32, 112, 126, cream)                # front of the box
    R(112, 32, 130, 126, side)                # its side
    R(112, 32, 116, 126, ink)
    R(30, 42, 102, 116, ink)
    R(34, 46, 98, 112, cyan)                  # the screen
    R(34, 96, 98, 112, cyan2)
    if not losing:
        R(42, 60, 60, 68, eye); R(72, 60, 90, 68, eye)
    else:                                     # sad: the slits droop outward
        for i in range(4):
            R(42 + i * 4, 68 - i * 2, 48 + i * 4, 74 - i * 2, eye); R(72 + i * 4, 62 + i * 2, 78 + i * 4, 68 + i * 2, eye)
    return im


def pictures():
    """Characters mode: a stage picture from the video (the village at night, lights below) + the robot's head as
    the icons of the people talking."""
    from PIL import Image, ImageFilter, ImageEnhance
    x, y, w, h = BAND
    tmp = os.path.join(WORK, 'pic.png')
    run(['ffmpeg', '-y', '-ss', '62', '-i', V_SONG, '-frames:v', '1', '-vf', f'crop={w}:{h}:{x}:{y}', tmp])
    bg = Image.open(tmp).convert('RGB').resize((1600, 900), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0))
    # the ground: the bottom fades to near black, so whoever sings stands on something
    a = np.asarray(bg, dtype=np.float32)
    yy = np.linspace(0, 1, 900)[:, None, None]
    shade = np.clip((yy - 0.62) / 0.3, 0, 1) * 0.82
    bg = Image.fromarray((a * (1 - shade) + np.array([8, 8, 12]) * shade).astype(np.uint8))
    bg.save(out('shared', 'images', 'stages', 'kipVillage', 'village.png'))
    icon = Image.new('RGBA', (300, 150), (0, 0, 0, 0))
    icon.paste(robot_icon(150), (0, 0)); icon.paste(robot_icon(150, True), (150, 0))
    icon.save(out('preload', 'images', 'icons', 'icon-kip.png'))
    robot_icon(32).resize((64, 64), Image.NEAREST).save(out('preload', 'images', 'freeplay', 'icons', 'kippixel.png'))
    json.dump(dict(version='1.0.0', name='kip village', cameraZoom=0.9,
                   props=[dict(name='village', assetPath='stages/kipVillage/village', position=[-160, -90], scale=[1, 1], scroll=[0, 0], zIndex=0)],
                   characters=dict(bf=dict(position=[950, 800], zIndex=300, cameraOffsets=[-180, -80]),
                                   dad=dict(position=[200, 860], zIndex=200, cameraOffsets=[150, -100]),
                                   gf=dict(position=[600, 860], zIndex=100))),
              open(out('preload', 'data', 'stages', 'kipVillage.json'), 'w'), indent=1)


def main():
    if '--pictures' in sys.argv: pictures(); return
    if os.path.isdir(OWN): shutil.rmtree(OWN)
    S = stems()
    total = audio(S)
    print('audio', round(total, 2), 's')
    counts, talk = chart(S)
    print('player notes', counts, 'talk notes', talk)
    metadata(total)
    pictures()
    print('video', video(total))


if __name__ == '__main__':
    main()
