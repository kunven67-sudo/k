"""Tankman's own voice on every song he sings that has nothing of his own (FNF 2 'cover' songs: BF's part, played as
Tankman). PRIVATE build only: made from Tankman's REAL singing, nothing made up.

  bank      every note Tankman really sings: his part of Ugh / Guns / Stress (FNF's Voices-tankman) + his part of the
            Playable Tankman mixes of Tutorial / Bopeebo / Fresh / DadBattle (Adamatik + team), each note cut out of
            the vocals with its pitch measured. + his real 'UGH's (Ugh's ugh notes) and his real "Heh, pretty good"
            (Stress, its hehPrettyGood note)
  each song for every note you sing: the piece of his singing closest in pitch + length, moved to the note BF sings
            there (BF's own vocal track = the tune; moved into Tankman's low range, the same melody), placed on the
            note. Now and then an 'UGH' starts a line, and "Heh, pretty good" goes after a long line + at the end
  -> songs/<id>/Voices-tankcover[-<variation>].ogg, which the game plays instead of BF's voice (src/20-play.js).
  Songs whose ONE vocal track has both singers (VS Impostor, Nene's songs...): + Voices-tankcover...-opp.ogg = that
  track with only the opponent's lines left (BF's are cut out), played instead of it.

Packs (git-ignored build/mods/<id>): tankvoice (everything but...), tankvoice-imp (VS Impostor), tankvoice-mods (VS
Tricky, VS Whitty + its HQ songs).

  node tools/tank_dump.js <dump dir>          (every cover song: its chart + BF's vocal track, from the built game)
  python3 tools/own/tank_voice.py <dump dir>
"""
import glob, json, os, re, base64, subprocess, sys, random
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DUMP = sys.argv[1]
MODS = os.path.join(ROOT, 'build', 'mods')
SR = 22050
CACHE = os.path.join(ROOT, 'build', 'cache', 'tank-voice'); os.makedirs(CACHE, exist_ok=True)

import librosa


def decode(data_or_path):
    """an audio file (path) or a data: URL -> mono float32 at SR"""
    if isinstance(data_or_path, str) and data_or_path.startswith('data:'):
        raw = base64.b64decode(data_or_path.split(',', 1)[1]); inp = ['-i', 'pipe:0']
    else: raw = None; inp = ['-i', data_or_path]
    out = subprocess.run(['ffmpeg', '-v', 'error'] + inp + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], input=raw, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def asset_json_strings(path, keys):
    """values of some keys in a built JS file of {"path":"value"} (assets.js / pack heads + bodies)"""
    t = open(path, encoding='utf-8').read(); out = {}
    for k in keys:
        m = re.search(re.escape(json.dumps(k)) + r':("(?:[^"\\]|\\.)*")', t)
        if m: out[k] = json.loads(m.group(1))
    return out


def pitch(seg):
    """the note's pitch (MIDI), from the loud middle of it; None = no clear pitch"""
    if len(seg) < 1024 or np.sqrt(np.mean(seg ** 2)) < 0.01: return None
    f = librosa.yin(seg, fmin=65, fmax=700, sr=SR, frame_length=1024, hop_length=256)
    rms = librosa.feature.rms(y=seg, frame_length=1024, hop_length=256)[0][:len(f)]
    f = f[:len(rms)]; good = f[rms > rms.max() * 0.35]
    if len(good) < 2: return None
    return float(librosa.hz_to_midi(np.median(good)))


def chords(notes):
    """one entry per time you sing (a chord = one sound), with how long until the next one"""
    out = []
    for t, d, l, k in sorted(notes):
        if out and abs(t - out[-1][0]) < 3: out[-1][2] = max(out[-1][2], l); continue
        out.append([t, d, l, k])
    return out


# ---------------------------------------------------------------- his real singing
def bank():
    cp = os.path.join(CACHE, 'bank.npz')
    if os.path.exists(cp):
        z = np.load(cp, allow_pickle=True); return list(z['syl']), list(z['ugh']), z['pretty']
    A = os.path.join(ROOT, 'build', 'assets.js')
    keys = []
    for s in ('ugh', 'guns', 'stress'): keys += ['songs/%s/Voices-tankman.ogg' % s, 'preload/data/songs/%s/%s-chart.json' % (s, s)]
    V = asset_json_strings(A, keys)
    src = []          # (audio, notes he sings, from where)
    for s in ('ugh', 'guns', 'stress'):
        ch = json.loads(V['preload/data/songs/%s/%s-chart.json' % (s, s)])
        src.append((decode(V['songs/%s/Voices-tankman.ogg' % s]), [(n['t'], n['d'], n.get('l', 0), n.get('k', '')) for n in ch['notes']['hard'] if n['d'] >= 4], s))
    TH, TB = os.path.join(ROOT, 'build', 'packs', 'tankman.head.js'), os.path.join(ROOT, 'build', 'packs', 'tankman.body.js')
    for s in ('tutorial', 'bopeebo', 'fresh', 'dadbattle'):
        H = asset_json_strings(TH, ['preload/data/songs/%s/%s-chart-tankman.json' % (s, s)])
        B = asset_json_strings(TB, ['songs/%s/Voices-tankman-playable-tankman.ogg' % s])
        ch = json.loads(H['preload/data/songs/%s/%s-chart-tankman.json' % (s, s)])
        top = ch['notes'].get('hard') or max(ch['notes'].values(), key=len)
        src.append((decode(B['songs/%s/Voices-tankman-playable-tankman.ogg' % s]), [(n['t'], n['d'] % 4, n.get('l', 0), n.get('k', '')) for n in top if n['d'] < 4], s))
    syl, ugh, pretty = [], [], None
    for audio, notes, name in src:
        cs = chords(notes)
        for i, (t, d, l, k) in enumerate(cs):
            nxt = cs[i + 1][0] if i + 1 < len(cs) else t + 900
            a = int(max(0, t - 12) * SR / 1000)
            if k == 'ugh':
                ugh.append(audio[a:int(min(nxt, t + 800) * SR / 1000)].copy()); continue
            if k == 'hehPrettyGood':
                pretty = audio[a:int((t + 2420) * SR / 1000)].copy(); continue      # ("Heh!  Pretty good!": 2.4 s, over his next notes)
            end = min(nxt - 8, t + max(l + 160, 200), t + 1500)
            seg = audio[a:int(end * SR / 1000)]
            p = pitch(seg[:int(0.3 * SR)])
            if p is None: continue
            syl.append({'a': seg.copy(), 'p': p, 'ms': (end - t), 'hold': l >= 250, 'from': name})
        print('  bank:', name, len(syl), 'notes so far')
    np.savez(cp, syl=np.array(syl, dtype=object), ugh=np.array(ugh, dtype=object), pretty=pretty)
    return syl, ugh, pretty


def fade(a, fin=0.004, fout=0.03):
    a = a.copy(); n1, n2 = min(len(a), int(fin * SR)), min(len(a), int(fout * SR))
    if n1: a[:n1] *= np.linspace(0, 1, n1)
    if n2: a[-n2:] *= np.linspace(1, 0, n2)
    return a


def place(out, a, t_ms, gain=1.0):
    s = int(t_ms * SR / 1000)
    if s >= len(out) or s + len(a) <= 0: return
    if s < 0: a = a[-s:]; s = 0
    e = min(len(out), s + len(a)); out[s:e] += a[:e - s] * gain


def own_chart(notes, tc):
    """Tankman's own part from BF's: the same maths as G.Songs.ownChart (src/12-song.js), so his voice fits his notes"""
    tcs = sorted(tc or [{'t': 0, 'bpm': 100}], key=lambda x: x['t'])
    def beat(t):
        x = tcs[0]
        for y in tcs:
            if y['t'] <= t: x = y
        return 60000 / (x.get('bpm') or 100)
    plain = lambda k: not k or re.fullmatch(r'alt|normal|default|easy|hard|erect|nightmare', k)
    mine = sorted([n for n in notes if n[1] < 4 and plain(n[3])], key=lambda n: (n[0], n[1]))
    keep, last, prev = [], -1e9, -1e9
    for t, d, l, k in mine:
        if t - prev <= 2: continue
        b = beat(t)
        if t - prev > b * 1.5 or t - last >= b * 0.98: keep.append([t, d, l or 0, k]); last = t
        prev = t
    for i, n in enumerate(keep):
        b = beat(n[0]); gap = keep[i + 1][0] - n[0] if i + 1 < len(keep) else b * 4
        l = gap - b * 0.25 if gap <= b * 2.5 else min(max(n[2], b), gap - b * 0.5)
        n[2] = round(l) if l >= b * 0.4 else 0
    return keep


def bake(meta, ref, total_len, SYL, UGH, PRETTY, rnd):
    """his track for one song: ref = BF's singing (the tune), None = no tune to follow"""
    out = np.zeros(total_len, np.float32)
    cs = own_chart(meta['notes'], meta.get('tc'))
    med = float(np.median([s['p'] for s in SYL]))
    bpm = (meta.get('tc') or [{'bpm': 120}])[0].get('bpm', 120); beat = 60000 / bpm
    last_ids = []
    lines_end = []                       # (time a line of yours ended, the rest after it)
    for i, (t, d, l, k) in enumerate(cs):
        prev = cs[i - 1][0] if i else -1e9
        nxt = cs[i + 1][0] if i + 1 < len(cs) else t + 1200
        want = max(90, min(nxt - t - 10, l + 140)) if l > 0 else max(90, min(nxt - t - 10, 320))
        if nxt - t > beat * 3: lines_end.append((t + want, nxt - t - want))
        # a line starts: sometimes it's an UGH (like his real ones)
        if t - prev > beat * 3 and UGH and rnd.random() < 0.14:
            place(out, fade(UGH[rnd.randrange(len(UGH))]), t - 12); continue
        target = pitch(ref[int(t * SR / 1000):int((t + min(want, 300)) * SR / 1000)]) if ref is not None else None
        if target is not None: target -= 12 * round((target - med) / 12)          # (his range, same tune)
        # a long note = one of his real held notes (stretched to fit), a short one = any note of his long enough
        long_enough = ([j for j, s in enumerate(SYL) if s['hold']] if want > 450 else [j for j, s in enumerate(SYL) if s['ms'] >= want * 0.8]) or list(range(len(SYL)))
        if target is None: score = lambda j: abs(SYL[j]['p'] - med) + rnd.random() * 3
        else: score = lambda j: abs(SYL[j]['p'] - target) + rnd.random() * 0.8
        pick = sorted((j for j in long_enough if j not in last_ids), key=score)[:4]
        j = pick[rnd.randrange(len(pick))] if pick else rnd.randrange(len(SYL))
        last_ids = (last_ids + [j])[-8:]
        a = SYL[j]['a']
        if target is not None:
            st = max(-4, min(4, target - SYL[j]['p']))
            if abs(st) > 0.15: a = librosa.effects.pitch_shift(a, sr=SR, n_steps=st, bins_per_octave=12)
        n_want = int((want + 12) * SR / 1000)
        if len(a) < n_want * 0.9:          # (held longer than he really did: the sound after its start, slowed down)
            att = int(0.06 * SR); body = a[att:]
            rate = max(0.3, len(body) / max(1, n_want - att))
            if len(body) > 2048: a = np.concatenate([a[:att], librosa.effects.time_stretch(body, rate=rate)])
        a = a[:n_want]
        place(out, fade(a, fout=0.06 if want > 450 else 0.03), t - 12)
    # "Heh, pretty good": after the longest rest of yours mid-song (if it's long enough), and after your last line
    if PRETTY is not None and len(PRETTY):
        plen = len(PRETTY) * 1000 / SR
        mid = [x for x in lines_end[:-1] if x[1] > plen + 300]
        if mid: t0, _ = max(mid, key=lambda x: x[1]); place(out, fade(PRETTY), t0 + 120)
        if cs: place(out, fade(PRETTY), cs[-1][0] + 400)
    # as loud as BF was
    if ref is not None:
        r = np.sqrt(np.mean(ref[np.abs(ref) > 0.02] ** 2)) if np.any(np.abs(ref) > 0.02) else 0.1
        o = np.sqrt(np.mean(out[np.abs(out) > 0.02] ** 2)) if np.any(np.abs(out) > 0.02) else 0.1
        out *= min(3.0, r / max(o, 1e-4))
    pk = np.abs(out).max()
    if pk > 0.97: out *= 0.97 / pk
    return out


def gate(track, notes):
    """the opponent's lines only: the shared track around their notes, silent where only BF sings"""
    keep = np.zeros(len(track), np.float32)
    for t, d, l, k in notes:
        a, b = int(max(0, t - 60) * SR / 1000), int((t + l + 380) * SR / 1000)
        keep[a:b] = 1
    k = int(0.03 * SR); keep = np.convolve(keep, np.ones(k) / k, mode='same')
    return track * keep


def write(a, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', '3', path],
                   input=a.astype(np.float32).tobytes(), check=True)


def pack_of(sid):
    m = json.load(open(glob.glob(os.path.join(DUMP, glob.escape(sid) + '__*.json'))[0]))
    p = ' '.join(m['pv'] + m['ov'])
    if not m['pv'] and sid in IMP: return 'tankvoice-imp'
    if re.search(r'bftricky|bfhell|bfwhit|whitty|minimum_bf|boof|bf-erect|bf-hqr|bf-jam', p) or sid in ('low-rise',): return 'tankvoice-mods'
    return 'tankvoice'

IMP = {'sussus-moogus', 'sabotage', 'meltdown', 'sussus-toogus', 'lights-down', 'reactor', 'ejected', 'mando', "d'low", 'oversight', 'danger', 'double-kill'}


def main():
    SYL, UGH, PRETTY = bank()
    print('bank:', len(SYL), 'notes,', len(UGH), 'UGHs, pretty good', round(len(PRETTY) / SR, 2) if PRETTY is not None else None, 's')
    only = sys.argv[2:]
    for jp in sorted(glob.glob(os.path.join(DUMP, '*.json'))):
        meta = json.load(open(jp)); sid, v = meta['id'], meta['v']
        if only and sid not in only: continue
        base = jp[:-5]
        pf = sorted(glob.glob(glob.escape(base) + '.p*')); of = sorted(glob.glob(glob.escape(base) + '.o*'))
        ref = decode(pf[0]) if pf else None
        shared = decode(of[0]) if (of and not pf) else None
        if ref is None and shared is not None:
            # one track for both: BF's lines (around your notes) are the tune
            ref = shared - gate(shared, [tuple(n) for n in meta['onotes']])
        length = max(len(x) for x in (ref, shared) if x is not None) if (ref is not None or shared is not None) else int((max(n[0] for n in meta['notes']) + 4000) * SR / 1000)
        rnd = random.Random(sid + v)
        out = bake(meta, ref, length, SYL, UGH, PRETTY, rnd)
        suf = '' if v == 'default' else '-' + v
        pk = os.path.join(MODS, pack_of(sid))
        write(out, os.path.join(pk, 'songs', sid, 'Voices-tankcover%s.ogg' % suf))
        if shared is not None: write(gate(shared, [tuple(n) for n in meta['onotes']]), os.path.join(pk, 'songs', sid, 'Voices-tankcover%s-opp.ogg' % suf))
        print('  ', sid, v, len(meta['notes']), 'notes', '(shared track)' if shared is not None else '' if pf else '(no tune)', '->', os.path.basename(pk))


if __name__ == '__main__':
    main()
