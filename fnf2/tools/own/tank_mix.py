"""TANKMAN MIXES: Tankman's own version of every song he covers (like a Pico Mix: the song's not the same, he sounds
different and so does whoever he raps against). PRIVATE build only, made from real sounds, nothing made up:

  the beat     the song's own music split into drums / bass / the rest (Demucs, htdemucs); its drums are swapped for
               Tankman's real Week 7 drums (Guns' drum track, cut into 16th notes and played on the song's own beat
               grid, so no stretching), only in the bars where the song had drums
  Tankman      his own long notes, his real voice (tools/own/tank_voice.py: Voices-tankcover)
  the opponent new notes too (the same 'own chart' maths, G.Songs.ownChart lanes 4-7), sung with pieces of THEIR real
               singing from this song, on their tune
  -> songs/<id>/Inst-tankmix[-<variation>].ogg + Voices-tankcover[-<variation>]-opp.ogg (in the tankvoice packs)

  node tools/tank_dump.js <dump dir>     then     python3 tools/own/tank_mix.py <dump dir> [song ids...]
"""
import glob, json, os, random, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tank_voice as TV
SR = TV.SR
ROOT = TV.ROOT
CACHE = os.path.join(ROOT, 'build', 'cache', 'tank-mix'); os.makedirs(CACHE, exist_ok=True)
SR2 = 44100


def stems(src, key):
    """Demucs: drums / bass / other / vocals of a music file (cached)"""
    d = os.path.join(CACHE, 'sep', key)
    if not os.path.exists(os.path.join(d, 'drums.wav')):
        os.makedirs(d, exist_ok=True)
        wav = os.path.join(d, 'in.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ar', str(SR2), '-ac', '2', wav], check=True)
        subprocess.run([sys.executable, '-m', 'demucs', '-n', 'htdemucs', '-o', os.path.join(CACHE, 'tmp'), wav], check=True, capture_output=True)
        out = os.path.join(CACHE, 'tmp', 'htdemucs', 'in')
        for s in ('drums', 'bass', 'other', 'vocals'): os.replace(os.path.join(out, s + '.wav'), os.path.join(d, s + '.wav'))
        os.remove(wav)
    import soundfile as sf
    return {s: sf.read(os.path.join(d, s + '.wav'), dtype='float32')[0] for s in ('drums', 'bass', 'other', 'vocals')}


def grid(tc, end_ms):
    """the song's 16th notes: (time ms, index from the song's start)"""
    tcs = sorted(tc or [{'t': 0, 'bpm': 100}], key=lambda x: x['t'])
    out, t, i = [], 0.0, 0
    k = 0
    while t < end_ms:
        while k + 1 < len(tcs) and tcs[k + 1]['t'] <= t + 1: k += 1
        out.append((t, i)); t += 60000 / tcs[k]['bpm'] / 4; i += 1
    return out


def phase(dr, step_ms):
    """where the drum hits really land inside a 16th (ms after the chart's grid): songs' audio doesn't start exactly on
    the beat (+ the onset finder's own delay, which cancels out: the kit is measured the same way)"""
    import librosa
    y = dr.mean(axis=1) if dr.ndim > 1 else dr
    y = librosa.resample(y, orig_sr=SR2, target_sr=22050)
    on = librosa.onset.onset_detect(y=y, sr=22050, units='time')
    if len(on) < 8: return 0.0
    ang = (on * 1000 / step_ms) % 1 * 2 * np.pi
    return float(np.angle(np.mean(np.exp(1j * ang))) % (2 * np.pi) / (2 * np.pi) * step_ms)


def kit():
    """Tankman's drums: 2 bars (32 16ths) of Guns' drum track, the loudest steady stretch, as 32 slices"""
    import soundfile as sf
    A = os.path.join(ROOT, 'build', 'assets.js')
    V = TV.asset_json_strings(A, ['songs/guns/Inst.ogg'])
    p = os.path.join(CACHE, 'guns-inst.mp3')
    if not os.path.exists(p):
        import base64; open(p, 'wb').write(base64.b64decode(V['songs/guns/Inst.ogg'].split(',', 1)[1]))
    dr = stems(p, 'guns')['drums']
    step = 60000 / 185 / 4
    n16 = int(len(dr) / SR2 * 1000 / step)
    rms = np.array([np.sqrt(np.mean(dr[int(i * step * SR2 / 1000):int((i + 1) * step * SR2 / 1000)] ** 2)) for i in range(n16)])
    best, bi = -1, 0
    for s in range(0, n16 - 32, 16):                  # (whole bars)
        w = rms[s:s + 32]
        if w.min() <= 0: continue
        score = w.mean() - w.std() * 0.5
        if score > best: best, bi = score, s
    # each 16th cut from just before its hit to just before the next one (a piece never carries the next hit)
    h = phase(dr, step) - 6
    sl = []
    for i in range(32):
        a, b = int(((bi + i) * step + h) * SR2 / 1000), int(((bi + i + 1) * step + h) * SR2 / 1000)
        sl.append(dr[a:b].copy())
    return sl, 6.0                            # (the hit sits 6 ms into each piece)


def new_beat(st, tc, kit_slices, kit_ms=0.0):
    """the song's music with Tankman's drums instead of its own (only in bars that had drums)"""
    dr = st['drums']; n = len(dr)
    g = grid(tc, n / SR2 * 1000)
    tcs = sorted(tc or [{'t': 0, 'bpm': 100}], key=lambda x: x['t'])
    step0 = 60000 / tcs[0]['bpm'] / 4
    shift = phase(dr, step0) - kit_ms                              # (the song's hits minus where the kit's sit)
    shift = (shift + step0 / 2) % step0 - step0 / 2
    out = np.zeros_like(dr)
    drm = np.sqrt(np.mean(dr ** 2, axis=1))
    def step_at(t):
        x = tcs[0]
        for y in tcs:
            if y['t'] <= t: x = y
        return 60000 / x['bpm'] / 4
    bars = {}
    for t, i in g:
        b = i // 16; a = int(t * SR2 / 1000)
        bars.setdefault(b, []).append(a)
    bar_rms = {b: float(np.sqrt(np.mean(drm[v[0]:min(n, v[-1] + (v[-1] - v[0]) // 15 + 1)] ** 2))) if v[0] < n else 0 for b, v in bars.items()}
    on = [r for r in bar_rms.values() if r > 0]
    thr = (np.median(on) * 0.3) if on else 1
    for t, i in g:
        if bar_rms.get(i // 16, 0) < thr: continue
        a = int((t + shift) * SR2 / 1000); s = kit_slices[i % 32]
        if a < 0: continue
        nxt = int((t + 60000 / 120 / 4) * SR2 / 1000)            # (each slice rings into the next a little)
        s = s[:max(1, min(len(s), n - a, int(step_at(t) * SR2 / 1000) + 1))]
        if len(s) > 64:
            f = min(len(s), int(0.02 * SR2)); s = s.copy(); s[-f:] *= np.linspace(1, 0, f)[:, None]
        out[a:a + len(s)] += s
    # (measured again against the song's own drums and nudged onto them: the onset finder hears different drums a
    # little differently)
    for _ in range(2):
        res = (phase(dr, step0) - phase(out, step0) + step0 / 2) % step0 - step0 / 2
        if abs(res) < 2: break
        k = int(round(res * SR2 / 1000)); out = np.roll(out, k, axis=0)
        if k > 0: out[:k] = 0
        elif k < 0: out[k:] = 0
    # as loud as the song's own drums were
    act = drm > thr * 0.5
    r0 = np.sqrt(np.mean(dr[act] ** 2)) if act.any() else 0.1
    on2 = np.abs(out).max(axis=1) > 1e-4
    r1 = np.sqrt(np.mean(out[on2] ** 2)) if on2.any() else 0.1
    out *= min(4, r0 / max(r1, 1e-5))
    mix = st['bass'] + st['other'] + st['vocals'] + out
    pk = np.abs(mix).max()
    if pk > 0.98: mix *= 0.98 / pk
    return mix


def opp_voice(meta, base, total_len, rnd):
    """the opponent on their own new notes, with pieces of their real singing from this song"""
    of = sorted(glob.glob(glob.escape(base) + '.o*'))
    pf = sorted(glob.glob(glob.escape(base) + '.p*'))
    if not of: return None
    trk = sum(TV.decode(f)[:total_len] if len(TV.decode(f)) >= total_len else np.pad(TV.decode(f), (0, total_len - len(TV.decode(f)))) for f in of)
    onotes = [[n[0], n[1] - 4, n[2], n[3]] for n in meta['onotes']]
    if not pf: trk = TV.gate(trk, [tuple(n) for n in meta['onotes']])      # (one track for both: theirs alone)
    syl = []
    cs0 = TV.chords([tuple(n) for n in onotes])
    for i, (t, d, l, k) in enumerate(cs0):
        nxt = cs0[i + 1][0] if i + 1 < len(cs0) else t + 900
        end = min(nxt - 8, t + max(l + 160, 200), t + 1500)
        seg = trk[int(max(0, t - 12) * SR / 1000):int(end * SR / 1000)]
        p = TV.pitch(seg[:int(0.3 * SR)])
        if p is None: continue
        syl.append({'a': seg.copy(), 'p': p, 'ms': end - t, 'hold': l >= 250})
    if len(syl) < 8: return None
    if sum(s['hold'] for s in syl) < 4:                      # (few long notes of their own: their longest ones)
        for s in sorted(syl, key=lambda s: -s['ms'])[:12]: s['hold'] = True
    cs = TV.own_chart(onotes, meta.get('tc'))
    return TV.bake(meta, trk, total_len, syl, [], None, rnd, cs=cs)


def main():
    dump = sys.argv[1]; only = sys.argv[2:]
    kit_slices, kit_ph = kit()
    for jp in sorted(glob.glob(os.path.join(dump, '*.json'))):
        meta = json.load(open(jp)); sid, v = meta['id'], meta['v']
        if only and sid not in only: continue
        base = jp[:-5]
        inst = (glob.glob(glob.escape(base) + '.inst.*') or [None])[0]
        if not inst: print('   (no music)', sid, v); continue
        st = stems(inst, sid + '__' + v)
        mix = new_beat(st, meta.get('tc'), kit_slices, kit_ph)
        suf = '' if v == 'default' else '-' + v
        pk = os.path.join(TV.MODS, TV.pack_of_meta(meta))
        out = os.path.join(pk, 'songs', sid, 'Inst-tankmix%s.ogg' % suf); os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR2), '-ac', '2', '-i', '-', '-c:a', 'libvorbis', '-q:a', '4', out],
                       input=mix.astype(np.float32).tobytes(), check=True)
        ov = opp_voice(meta, base, int(len(mix) / SR2 * SR), random.Random('opp' + sid + v))
        if ov is not None: TV.write(ov, os.path.join(pk, 'songs', sid, 'Voices-tankcover%s-opp.ogg' % suf))
        print('  ', sid, v, '-> beat', 'opponent' if ov is not None else '(opponent kept)', os.path.basename(pk))


if __name__ == '__main__':
    main()
