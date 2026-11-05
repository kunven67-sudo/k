"""Into Our Lives: put back the song clip's opening shot (the camera flying over the dark village to the gazebo,
the first 4.25 s of the song TikTok) that the join used to skip. Works on the already built 'videosongs' pack files
(unpacked into a folder), so nothing else has to be made again.

Old join: talk clip up to J_TALK, then the song clip from J_SONG (a whole number of bars earlier on the beat).
New join: talk clip up to the next bar line (J_TALK + 1 beat: the talk is over by then), then the song clip from
0 s (also a bar line), all the way through. That adds exactly 3 bars: every note + event after the join moves 3 bars
later (the beat grid stays the same). The added part's TikTok logo is painted out like the rest.

  python3 tools/own/iol_intro.py <unpacked pack folder> <talk clip mp4> <song clip mp4>
"""
import json, os, subprocess, sys
import numpy as np
import cv2
import soundfile as sf

D, V_TALK, V_SONG = sys.argv[1:4]
SID = 'into-our-lives'
BPM = 155.0; BEAT = 60 / BPM; BAR = 4 * BEAT
OFF = 3.0801
J_TALK = 15.1136
J_SONG = J_TALK + OFF - 9 * BAR          # where the old join went into the song clip
INS = BEAT + J_SONG                      # = 3 bars added
BAND = (0, 350, 576, 324)
LOGO_BOX = (10, 110, 160, 90)
SR = 44100
WORK = os.path.join(D, '_work'); os.makedirs(WORK, exist_ok=True)
print(f'join {J_TALK:.4f}s, song clip skipped part 0..{J_SONG:.4f}s, adding {INS:.4f}s (= {INS / BAR:.3f} bars)')

def run(cmd): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wav(src, a=None, b=None):
    out = os.path.join(WORK, 'a.wav')
    cmd = ['ffmpeg', '-y', '-v', 'error'] + (['-ss', str(a)] if a is not None else []) + ['-i', src] + (['-t', str(b - a)] if b is not None else []) + ['-ac', '2', '-ar', str(SR), out]
    run(cmd); x, _ = sf.read(out, dtype='float32'); return x

# ---------------------------------------------------------------- video frames of the added part
def frames(src, a, b, logo):
    cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.set(cv2.CAP_PROP_POS_MSEC, a * 1000)
    out = []
    while True:
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        ok, f = cap.read()
        if not ok or t >= b - 1e-6: break
        if t < a - 1e-6: continue
        x, y, w, h = BAND; out.append(f[y:y + h, x:x + w].copy())
    return out

talk_part = frames(V_TALK, J_TALK, J_TALK + BEAT, False)
song_part = frames(V_SONG, 0, J_SONG, True)
# the TikTok logo + name: bright pixels that stay put over the whole part (min over frames), plus the cyan / red
# glyph shadows of each frame, grown a little
x, y, w, h = LOGO_BOX
stack = np.stack([cv2.cvtColor(f[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY) for f in song_part])
still = (np.percentile(stack, 20, axis=0) > 170).astype(np.uint8) * 255
for i, f in enumerate(song_part):
    box = f[y:y + h, x:x + w]
    hsv = cv2.cvtColor(box, cv2.COLOR_BGR2HSV)
    glyph = (((hsv[..., 1] > 110) & (hsv[..., 2] > 150)) & (((hsv[..., 0] > 80) & (hsv[..., 0] < 100)) | (hsv[..., 0] < 8) | (hsv[..., 0] > 165))).astype(np.uint8) * 255
    gray = cv2.cvtColor(box, cv2.COLOR_BGR2GRAY)
    m = cv2.bitwise_or(still, cv2.bitwise_and(glyph, cv2.dilate(still, np.ones((9, 9), np.uint8))))
    m = cv2.bitwise_or(m, cv2.bitwise_and((gray > 200).astype(np.uint8) * 255, cv2.dilate(still, np.ones((5, 5), np.uint8))))
    # (the logo's colour fringes: any coloured speck near it goes too, then the whole thing grows a bit more)
    near = cv2.dilate(still, np.ones((17, 17), np.uint8))
    fringe = (hsv[..., 1] > 50) & (hsv[..., 2] > 40) & (((hsv[..., 0] > 78) & (hsv[..., 0] < 102)) | (hsv[..., 0] < 6) | (hsv[..., 0] > 168))
    m = cv2.bitwise_or(m, cv2.bitwise_and(fringe.astype(np.uint8) * 255, near))
    m = cv2.dilate(m, np.ones((7, 7), np.uint8), iterations=2)
    full = np.zeros(f.shape[:2], np.uint8); full[y:y + h, x:x + w] = m
    song_part[i] = cv2.inpaint(f, full, 4, cv2.INPAINT_TELEA)
fdir = os.path.join(WORK, 'ins'); os.makedirs(fdir, exist_ok=True)
for fn in os.listdir(fdir): os.remove(os.path.join(fdir, fn))
for i, f in enumerate(talk_part + song_part):
    cv2.imwrite(os.path.join(fdir, f'{i:05d}.png'), cv2.resize(f, (960, 540), interpolation=cv2.INTER_LANCZOS4))
cv2.imwrite(os.path.join(WORK, 'logo-mask.png'), still)
print(f'added frames: {len(talk_part)} talk + {len(song_part)} song')
if os.environ.get('FRAMES_ONLY'): sys.exit(0)

# ---------------------------------------------------------------- the video: old up to the join + added + old after
vid = os.path.join(D, 'files', 'videos', SID + '.webm'); new_vid = os.path.join(WORK, 'new.webm')
n_ins = len(talk_part) + len(song_part)
run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-framerate', '30', '-i', os.path.join(fdir, '%05d.png'),
     '-filter_complex',
     f'[0:v]trim=0:{J_TALK},setpts=PTS-STARTPTS,format=yuv420p[a];[1:v]trim=end_frame={n_ins},setpts=PTS-STARTPTS,format=yuv420p[b];'
     f'[0:v]trim=start={J_TALK},setpts=PTS-STARTPTS,format=yuv420p[c];[a][b][c]concat=n=3:v=1:a=0,fps=30[v]',
     '-map', '[v]', '-c:v', 'libvpx-vp9', '-b:v', '1300k', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-an', new_vid])

# ---------------------------------------------------------------- audio: the beat gets the real sound of the added part
def splice(x, ins):
    j = int(round(J_TALK * SR)); fade = int(0.012 * SR)
    a, b = x[:j].copy(), x[j:].copy()
    ins = ins.copy()
    r = np.linspace(0, 1, fade)[:, None]
    ins[:fade] *= r; ins[-fade:] *= r[::-1]
    return np.concatenate([a, ins, b])

inst = wav(os.path.join(D, 'files', 'songs', SID, 'Inst.ogg'))
t_raw = wav(V_TALK, J_TALK, J_TALK + BEAT)
s_raw = wav(V_SONG, 0, J_SONG)
need = int(round(INS * SR))
add = np.concatenate([t_raw, s_raw])[:need]
if len(add) < need: add = np.concatenate([add, np.zeros((need - len(add), 2), np.float32)])
# same loudness as the beat right after the join (the old song clip from J_SONG, before the singing comes in)
j = int(round(J_TALK * SR)); ref = inst[j:j + int(0.75 * SR)]
cmp = wav(V_SONG, J_SONG, J_SONG + 0.75)
g = float(np.sqrt(np.mean(ref ** 2)) / max(1e-6, np.sqrt(np.mean(cmp ** 2))))
print(f'loudness match gain {g:.3f}')
add *= g
for name, x in (('Inst', inst), ('Voices-player', None), ('Voices-talk', None)):
    src = os.path.join(D, 'files', 'songs', SID, name + '.ogg')
    x = inst if name == 'Inst' else wav(src)
    y = splice(x, add if name == 'Inst' else np.zeros((need, 2), np.float32))
    sf.write(os.path.join(WORK, name + '.wav'), np.clip(y, -1, 1), SR)
    run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(WORK, name + '.wav'), '-c:a', 'libmp3lame', '-b:a', '96k' if name == 'Inst' else '64k', os.path.join(WORK, name + '.mp3')])

# ---------------------------------------------------------------- chart + metadata: everything after the join, 3 bars later
cp = os.path.join(D, 'files', 'preload', 'data', 'songs', SID, SID + '-chart.json')
c = json.load(open(cp)); jm = J_TALK * 1000; sh = INS * 1000
moved = 0
for diff, ns in c['notes'].items():
    for n in ns:
        if n['t'] >= jm - 1: n['t'] = round(n['t'] + sh, 2); moved += 1
for e in c.get('events', []):
    if e['t'] >= jm - 1: e['t'] = round(e['t'] + sh, 2)
json.dump(c, open(os.path.join(WORK, 'chart.json'), 'w'), separators=(',', ':'))
mp = os.path.join(D, 'files', 'preload', 'data', 'songs', SID, SID + '-metadata.json')
m = json.load(open(mp)); pd = m['playData']
pd['previewStart'] = int(round(pd['previewStart'] + sh)); pd['previewEnd'] = int(round(pd['previewEnd'] + sh))
pd['video']['length'] = round(pd['video']['length'] + INS, 3)
json.dump(m, open(os.path.join(WORK, 'meta.json'), 'w'), separators=(',', ':'))
print(f'moved {moved} notes by {sh:.1f} ms; new video length {pd["video"]["length"]}')
