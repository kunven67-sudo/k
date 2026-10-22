"""Video songs for FNF 2 (PRIVATE build only: written to the git-ignored build/mods/videosongs, never the repo).

A video song plays a video behind the arrows instead of a stage (Options > Video songs = Characters puts your
picked player on a stage made from the video instead). You sing every sung line; whenever the people in the
video TALK, see-through arrows play by themselves on the side of whoever talks (zombie = left, robot = right).

  Into Our Lives   two TikToks by kip.zig (Minecraft animation, the user's picks in fnf2/private/):
                   video-song-5.mp4 = the zombie + the robot talking about trying "that FNF stuff" over the beat,
                   video-song-4.mp4 = the whole song. Both are the same beat (clip 4 = clip 5 + 3.0801 s).
                   The talk clip plays up to J_TALK (an 8th after the robot's last word), then the song clip
                   carries on from a point a whole number of bars earlier, so the groove never skips.

What it does:
  video   the sharp part of the TikTok frame (576x324 at y 350; the blurred bars + the TikTok name are cut off),
          every frame at its real time (no slowing down). Where the TikTok logo sits ON the picture (first ~5 s
          of each clip) it is painted out (a mask of the logo found over many frames + inpainting).
          Upscaled to 960x540, WebM.
  audio   demucs (htdemucs) splits voices from the beat: Inst = the beat, Voices-talk = the talk,
          Voices-player = the singing (yours: goes quiet on a miss). Joined with a short crossfade.
  chart   notes from the vocals: syllable starts (librosa onsets, backtracked), pitch (pYIN) -> lanes follow the
          melody inside each phrase, long held notes -> holds, snapped to the 155 BPM grid (16ths or triplets).
          HARD = every syllable, NORMAL + EASY thinned. Talk notes (kind 'talk') are the same on every
          difficulty: drawn at 50%, hit by themselves, never scored.
  extras  a stage picture from the video (Characters mode), health/freeplay icons from the robot's face.

  python3 tools/own/video_song.py            (--video = only the video, --chart = only the notes)
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
# the beat: 155 BPM (the hats run in 16ths of it; 103.3 was a dotted-quarter pulse and put notes on a wrong grid).
# Bars of the song clip start at 0.0 s (kick + snare pattern), so on the joined timeline the first bar starts
# right at the start too.
BPM = 155.0
BEAT = 60 / BPM
BAR = 4 * BEAT
SONG_GRID0 = -0.002              # a bar line of the song clip
OFF = 3.0801                     # song clip time = talk clip time + OFF (cross-correlation of the two beats)
# the talk ends (the robot's "...I guess I'll try") at 14.92 s of the talk clip; cut on the next 8th, then go back
# exactly 9 bars in the song clip: same place in the bar, so the groove never trips, and the song comes in from its
# intro (the singing starts ~5.05 s of the song clip)
J_TALK = 15.1136
J_SONG = J_TALK + OFF - 9 * BAR
# who talks (talk clip seconds): the ZOMBIE (left, higher voice ~300 Hz) and the ROBOT (right, lower ~190 Hz)
TALK_LINES = [
    (0.00, 2.18, 'L'),    # zombie: "Hey, people really like that FNF stuff. You want to try it out?"
    (2.20, 2.72, 'R'),    # robot: "I don't know."
    (3.20, 6.45, 'L'),    # zombie shows how: "hey, hey, hey..."
    (7.10, 9.48, 'R'),    # robot: "Sounds stupid when you try it. Why do I have to do it?"
    (9.50, 12.06, 'L'),   # zombie: "Come on, since I did it, you have to do it. I don't want to look like an idiot alone."
    (12.40, 14.95, 'R'),  # robot: "I don't even want to, but I guess I'll try."
]
LOGO_UNTIL = 5.05                # the TikTok logo sits on the picture until here (both clips)
LOGO_BOX = (10, 110, 160, 90)    # x, y, w, h of the logo + name inside the band
BAND = (0, 350, 576, 324)        # x, y, w, h of the sharp picture inside the 576x1024 TikTok frame
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
    """Inst + the two voice tracks on the joined timeline (the talk, then the song from its intro). The cut is a
    short crossfade on an 8th, 9 bars apart in the music, so it sounds like one take."""
    jt, js, xf = int(round(J_TALK * SR)), int(round(J_SONG * SR)), int(0.03 * SR)
    h = xf // 2
    up = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]; down = np.cos(np.linspace(0, np.pi / 2, xf))[:, None]
    a, b = S['inst5'][:jt + h], S['inst4'][js - h:]
    inst = np.concatenate([a[:-xf], a[-xf:] * down + b[:xf] * up, b[xf:]])
    talk = S['voc5'][:jt].copy(); n = int(0.08 * SR); talk[-n:] *= np.linspace(1, 0, n)[:, None]
    talk = np.concatenate([talk, np.zeros((len(inst) - len(talk), 2), np.float32)])
    sing = np.concatenate([np.zeros((jt, 2), np.float32), S['voc4'][js:]])[:len(inst)]
    d = out('songs', SID, 'x')
    for name, w in (('Inst', inst), ('Voices-talk', talk), ('Voices-player', sing)):
        f = os.path.join(WORK, name + '.wav'); sf.write(f, w, SR)
        run(['ffmpeg', '-y', '-i', f, '-c:a', 'libvorbis', '-q:a', '6', os.path.join(os.path.dirname(d), name + '.ogg')])
    return len(inst) / SR


# ---------------------------------------------------------------- video
def logo_mask():
    """the TikTok logo + @name: the pixels that look like the logo (white letters, its cyan/red edges) in EVERY one of
    12 frames from both clips (the picture under it changes, the logo doesn't), grown a little for the soft edges."""
    import cv2
    x, y, w, h = BAND
    hs = []
    for src in (V_SONG, V_TALK):
        for t in (0.3, 1.2, 2.1, 3.0, 3.9, 4.8):
            f = os.path.join(WORK, f'lg_{os.path.basename(src)}_{t}.png')
            run(['ffmpeg', '-y', '-ss', str(t), '-i', src, '-frames:v', '1', '-vf', f'crop={w}:{h}:{x}:{y}', f])
            hs.append(cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2HSV).astype(np.int16))
    H, S, V = (np.stack([q[..., i] for q in hs]) for i in range(3))
    bgr = np.stack([cv2.cvtColor(q.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) for q in hs])
    white = (V.min(0) > 165) & (S.max(0) < 70)
    # the music-note icon's cyan + red edges: coloured and the same in every frame
    col = (bgr.std(0).mean(2) < 26) & (S.mean(0) > 55) & (V.mean(0) > 70)
    glyph = np.zeros_like(white); glyph[116:168, 12:62] = True
    m = (white | (col & glyph)).astype(np.uint8) * 255
    lx, ly, lw, lh = LOGO_BOX
    box = np.zeros_like(m); box[ly:ly + lh, lx:lx + lw] = 1
    return cv2.dilate(m * box, np.ones((3, 3), np.uint8), iterations=2)


def frame_mask(f, base):
    """the logo mask + whatever is cyan or red around the music-note icon in THIS frame (its soft coloured glow)."""
    import cv2
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV).astype(np.int16); H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    cr = ((np.abs(H - 88) < 16) | (H > 150) | (H < 10)) & (S > 45) & (V > 60)
    g = np.zeros(cr.shape, bool); g[112:172, 8:66] = True
    m = base.copy(); m[cv2.dilate((cr & g).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0] = 255
    return m


def frames(src, start, dur):
    """the sharp band of a clip, 30 frames a second from start, as RGB arrays."""
    x, y, w, h = BAND
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', f'{start:.4f}', '-t', f'{dur:.4f}', '-i', src, '-an',
                          '-vf', f'crop={w}:{h}:{x}:{y},fps=30', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


def video(total):
    """real frames all the way (nothing slowed down, so the picture matches the sound): the talk clip up to the cut,
    then the song clip from its intro; the logo seconds painted out (inpainting), 960x540 WebM."""
    import cv2
    x, y, w, h = BAND
    mask = logo_mask()
    dst = out('videos', SID + '.webm')
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{w}x{h}', '-r', '30', '-i', '-',
                            '-vf', 'scale=960:540:flags=lanczos,setsar=1', '-c:v', 'libvpx-vp9', '-b:v', '1300k', '-crf', '33',
                            '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', dst], stdin=subprocess.PIPE)
    n_talk = int(round(J_TALK * 30))
    k = 0
    # (each output frame k shows time k/30 of the joined timeline)
    for src, start, count, clip_t0 in ((V_TALK, 0.0, n_talk, 0.0), (V_SONG, J_SONG + (n_talk / 30 - J_TALK), None, None)):
        t_src0 = start
        for i, f in enumerate(frames(src, start, (count / 30 + 0.2) if count else total - k / 30 + 0.5)):
            if count is not None and i >= count: break
            if k >= int(total * 30): break
            if t_src0 + i / 30 < LOGO_UNTIL: f = cv2.inpaint(f, frame_mask(f, mask), 4, cv2.INPAINT_TELEA)
            enc.stdin.write(np.ascontiguousarray(f).tobytes()); k += 1
    enc.stdin.close(); enc.wait()
    return dst


# ---------------------------------------------------------------- chart
def vocal_notes(y, t0, t1, shift, sr=22050, min_gap=0.085, rel_db=-27):
    """syllables of a vocal stem between t0 and t1 (clip time), as joined-timeline notes with pitch + length. A note
    sits where its syllable STARTS (onset backtracked to the energy rise), like a charter would put it. Quiet bits
    (breaths, demucs leftovers) under rel_db of the loud parts are skipped."""
    import librosa
    seg = y[int(t0 * SR):int(t1 * SR)]
    seg = librosa.resample(seg.mean(1) if seg.ndim > 1 else seg, orig_sr=SR, target_sr=sr)
    hop = 128
    env = librosa.onset.onset_strength(y=seg, sr=sr, hop_length=hop)
    ons = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, backtrack=True, units='frames', delta=0.07, wait=4)
    rms = librosa.feature.rms(y=seg, frame_length=1024, hop_length=hop)[0]
    thr = np.percentile(rms[rms > 0], 95) * (10 ** (rel_db / 20))
    f0, voiced, _ = librosa.pyin(seg, fmin=70, fmax=1000, sr=sr, frame_length=2048, hop_length=hop)
    fps = sr / hop
    # a sung note coming back in after a little gap (a new syllable on a long run the onset finder slid over)
    extra = [i for i in range(8, len(voiced) - 8)
             if voiced[i] and not voiced[i - 8:i].any() and rms[i:i + 8].max() > thr * 4
             and not np.any(np.abs(ons - i) < 0.12 * fps)]
    ons = np.array(sorted(set(int(o) for o in ons) | set(extra)))
    notes, last = [], -1e9
    for k, fr in enumerate(ons):
        if rms[fr:fr + 8].max() < thr: continue
        t = fr / fps
        if t - last < min_gap: continue
        nxt = ons[k + 1] if k + 1 < len(ons) else len(rms)
        # how long it is sung: from the first voiced frame (a consonant can come first), through tiny breaks
        e = fr
        while e < min(fr + 12, len(voiced) - 1) and not voiced[e]: e += 1
        gap_ = 0
        while e < len(voiced) - 1 and rms[e] > thr * 0.5 and gap_ <= 8:
            gap_ = 0 if voiced[e] else gap_ + 1; e += 1
        e -= gap_
        p = f0[fr:fr + 16]; p = p[~np.isnan(p)]
        pitch = float(np.median(12 * np.log2(p / 440))) if len(p) else None
        notes.append(dict(t=t + t0 + shift, len=max(0, min(e, nxt) - fr) / fps, pitch=pitch, gap=(nxt - fr) / fps))
        last = t
    return notes


def snap(t, grid0):
    """onto the beat grid when close: 16ths first, then 16th triplets."""
    for div, tol in ((4, 0.036), (6, 0.02)):
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
    """fewer notes for easier charts: none closer than min_gap; a long held note always stays (it is the line you
    hear most), the quick note just before it goes instead."""
    out = []
    for n in notes:
        if out and n['t'] - out[-1]['t'] < min_gap:
            if n['len'] >= 0.8 and out[-1]['len'] < 0.8 and (len(out) < 2 or n['t'] - out[-2]['t'] >= min_gap): out[-1] = n
            continue
        out.append(n)
    return out, hold_min


def chart(S):
    """your notes = every sung syllable of the song; the talk = notes on the side of whoever talks (zombie left,
    robot right), kind 'talk': 50% see-through, they play by themselves and never count."""
    talk = []
    for a, b, side in TALK_LINES:
        ns = lanes(vocal_notes(S['voc5'], a, min(b + 0.05, J_TALK), 0, min_gap=0.13))
        for n in ns: n['side'] = side
        talk += ns
    sing = vocal_notes(S['voc4'], J_SONG, len(S['voc4']) / SR, J_TALK - J_SONG)
    g0 = c_from_song(SONG_GRID0)
    for n in sing: n['t'] = snap(n['t'], g0)
    sing = lanes(sing)
    notes, speed = {}, {'easy': 1.8, 'normal': 2.2, 'hard': 2.6}
    tk = [dict(t=round(n['t'] * 1000, 2), d=(4 if n['side'] == 'L' else 0) + n['lane'], k='talk') for n in talk]
    for diff, (gap, hold) in {'easy': (0.36, 0.5), 'normal': (0.18, 0.38), 'hard': (0.0, 0.3)}.items():
        s, h = thin(sing, gap, hold)
        notes[diff] = sorted(to_chart(s, 'player', h) + tk, key=lambda q: (q['t'], q['d']))
    events = [dict(t=0, e='FocusCamera', v=dict(char=0))]
    json.dump(dict(version='2.0.0', scrollSpeed=speed, events=events, notes=notes, generatedBy='FNF 2 - tools/own/video_song.py'),
              open(out('preload', 'data', 'songs', SID, SID + '-chart.json'), 'w'))
    return {d: sum(1 for q in v if q.get('k') != 'talk') for d, v in notes.items()}, len(tk)


def metadata(total):
    # one tempo: the joined timeline keeps the song's bars (the cut is whole bars), the first bar line ~15 ms in
    t0 = (J_TALK - J_SONG + SONG_GRID0) % BAR
    tc = [dict(t=round(t0 * 1000, 3), b=0, bpm=BPM, bt=[4, 4, 4, 4])]
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
    if '--chart' in sys.argv:       # (just the notes again)
        print('player notes', chart(stems())); return
    if '--video' in sys.argv:       # (just the video again: the length comes from the built Inst)
        print('video', video(sf.info(os.path.join(OWN, 'songs', SID, 'Inst.ogg')).duration)); return
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
