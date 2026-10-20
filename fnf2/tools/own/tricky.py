"""VS Tricky ("The Full-Ass Tricky Mod", by Banbuds + Rozebud + KadeDev + Cval + YingYang48 + JADS + Moro) for FNF 2 -
PRIVATE build only.

Reads the V-Slice port of the mod (GameBanana file 1706935, port by thisaintcub + PurSnake + LeonidKosherny) and copies
what FNF 2 plays into the git-ignored mod pack folder build/mods/tricky (never the repo; credits in
fnf2/private/CREDITS-mods.txt). The port is made for the real FNF engine, so its files go to the same places FNF's own do.

  songs       Improbable Outset, Madness, Hellclown (easy/normal/hard), Expurgation (the mod's chart = HARD, EASY +
              NORMAL are made from it here)
  characters  Tricky with his mask, Tricky, Hellclown Tricky, EX Tricky, the BF + GF for each of them, the sign death
  stages      Nevada (+ the Madness one), Hellclown's red island, the Auditor's hell
  notes       fire notes (don't hit them: they burn) + halo notes (don't hit them: they kill), the smoke splash
  cutscenes   the jaws + "OMFG CLOWN!!!!" intro, the Madness + Hellclown videos, the "CLOWN KILLS YOU" ending, EX Tricky
              climbing out of the ground
  mechanics   the static + red words, signs, the HP gremlin, clones, floor spikes, the energy wall (src/44-tricky.js)

MADNESS ERECT = ChuckySkullHead's remix (charted by Exspiranix, GameBanana file 1277573): an 'erect' variation of Madness
(BF vs Tricky, split voices, camera + scroll speed events). Its chart is NIGHTMARE, ERECT is a lighter one made from it.
PICO MIXES = angelkireina's "VS TRICKY (Pico Mix)" (a Psych mod, GameBanana file 1395143): Improbable Outset, Madness +
Expurgation remixed for Pico (Nene on the speaker), as a 'pico' variation on the port's stages. The mod chart is HARD.

  python3 tools/own/tricky.py [port folder]
"""
import glob, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/trickyvs/x/Vs Tricky'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'tricky')   # this mod's pack folder (tools/pack_assets.py --packs)
VIDEOS = ('HankFuckingShootsTricky', 'HELLCLOWN_ENGADGED', 'TricksterMan')
HALO = 'trickydeath'
ERECT = os.environ.get('TRICKY_ERECT', '/home/user/ref/mods/chuckyerects/x/ERECT MOD REMIXES')
PICO = os.environ.get('TRICKY_PICO', '/home/user/ref/mods/trickypico/x/Tricky Pico Mix')
# song -> (opponent, stage, girlfriend) for the Pico mixes (the port's characters + stages, FNF 2's own Pico + Nene)
PICO_SONGS = {'improbable-outset': 'trickyMask', 'madness': 'tricky', 'expurgation': 'exTricky'}
# Psych note types -> the port's note kinds
KINDS = {'EX Note': HALO, 'Halo Note': HALO, 'Hurt Note': 'trickyhell', 'Alt Animation': 'alt', 'No Animation': 'No Animation'}
# the Pico mod's sign names -> the sign types src/44-tricky.js knows (3 = 'Signature Stop Sign 2', only the Pico mod uses it)
SIGNS = {'Sign1': 0, 'Sign2': 3, 'Sign3': 1, 'Sign4': 2}
FA = os.environ.get('FNF_ASSETS', '/home/user/ref/fa')   # FNF's own files: the old BOYFRIEND sheet the mod's BF uses (FNF 2's own BF is the atlas one)
# the jaws closing over the screen: 32 frames of 2075x2305 (a 12462x13842 sheet, ~700 MB once decoded) drawn at 1.38x
# from (-300, -760), so only this part of each frame is ever on the screen (+ a few px around it): the sheet keeps just
# that (src/44-tricky.js draws it at the same spot)
JAWS_CROP = (480, 850, 1450, 1410)
# effect + cutscene sheets only ever drawn small (on the HUD at 0.67-0.76x, or in a stage the camera sees at 0.55x):
# packed at this fraction of their size (src/44-tricky.js draws them at scale / fraction, same spot: shrunk())
SHRINK = {'mechanics/Sign_Post_Mechanic': 0.7, 'mechanics/HP GREMLIN': 0.8, 'bgs/expurgation/EXENTER': 0.6,
          'bgs/expurgation/Clone': 0.6, 'bgs/expurgation/FloorSpikes': 0.6, 'cutscenes/somewhere': 0.5}
# the same sound as FNF's own (not taken twice)
SKIP = {'shared/sounds/gameplay/gameover/fnf_loss_sfx.ogg'}


def dest(rel):
    # V-Slice libraries: images/, data/, music/, sounds/ = 'preload'; shared/, songs/, videos/ keep their names
    if rel.startswith(('shared/', 'songs/', 'videos/')): return rel
    if rel.startswith('fonts/'): return 'fonts/mods/' + rel[6:]
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))
def save(obj, p): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(obj, open(p, 'w'), indent=1)


TRAPS = (HALO, 'trickyhell')


def easier(hard, bpm):
    """EASY + NORMAL from a HARD chart: your normal notes thinned (nene.thin), every 2nd (NORMAL) / 3rd (EASY) halo or
    fire note kept, Tricky's side left as it is (his poses + EX Hank stay)."""
    from nene import thin
    opp = [n for n in hard if n['d'] >= 4]
    mine = [n for n in hard if n['d'] < 4 and n.get('k') not in TRAPS]
    halos = sorted((n for n in hard if n['d'] < 4 and n.get('k') in TRAPS), key=lambda q: (q['t'], q['d']))
    out = {}
    for level, every in (('easy', 3), ('normal', 2)):
        kept = thin(mine, bpm, level)
        busy = {}
        for n in kept: busy.setdefault(n['d'], []).append(n['t'])
        # (a halo right on top of a note you have to hit in the same lane would be unfair: the note wins, the halo goes)
        hl = [h for i, h in enumerate(halos) if i % every == 0 and not any(abs(h['t'] - t) < 130 for t in busy.get(h['d'], ()))]
        out[level] = sorted(kept + hl + opp, key=lambda q: (q['t'], q['d']))
    return out


def crop_sheet(png, xml_path, out_base, rect):
    """Every frame of a Sparrow sheet cut down to `rect` (frame space), packed in a grid: frames named the same."""
    from PIL import Image
    from repack_sparrow import frames_of
    Image.MAX_IMAGE_PIXELS = None
    img = Image.open(png).convert('RGBA')
    frames = frames_of(open(xml_path, encoding='utf-8-sig').read())
    x0, y0, x1, y1 = rect; w, h = x1 - x0, y1 - y0
    cols = max(1, 4096 // (w + 2)); rows = (len(frames) + cols - 1) // cols
    out = Image.new('RGBA', (cols * (w + 2), rows * (h + 2)))
    lines = []
    for i, f in enumerate(frames):
        cut = img.crop((int(f['x']), int(f['y']), int(f['x'] + f['width']), int(f['y'] + f['height'])))
        if f['rot']: cut = cut.transpose(Image.ROTATE_90)
        full = Image.new('RGBA', (int(f['fw']), int(f['fh']))); full.paste(cut, (int(f['fx']), int(f['fy'])))
        px, py = (i % cols) * (w + 2), (i // cols) * (h + 2)
        out.paste(full.crop(rect), (px, py))
        lines.append('\t<SubTexture name="%s" x="%d" y="%d" width="%d" height="%d"/>' % (f['name'], px, py, w, h))
    out.save(out_base + '.png', optimize=True)
    open(out_base + '.xml', 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<TextureAtlas imagePath="%s.png">\n%s\n</TextureAtlas>\n'
                                       % (os.path.basename(out_base), '\n'.join(lines)))


def main():
    n = 0
    for src in glob.glob(os.path.join(glob.escape(MOD), '**', '*'), recursive=True):
        if os.path.isdir(src): continue
        rel = os.path.relpath(src, MOD).replace(os.sep, '/')
        if rel.endswith(('.astc', '.hxc', '.mp4')) or '/' not in rel or rel.startswith('scripts/') or rel in SKIP: continue
        if rel.startswith('shared/images/') and rel[14:].rsplit('.', 1)[0] in set(SHRINK) | {'Jaws'}: continue
        dst = os.path.join(OWN, dest(rel))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst); n += 1
    J = os.path.join(MOD, 'shared', 'images', 'Jaws')
    crop_sheet(J + '.png', J + '.xml', os.path.join(OWN, 'shared', 'images', 'Jaws'), JAWS_CROP); n += 2
    from repack_sparrow import repack
    for k, f in SHRINK.items():
        src, out = os.path.join(MOD, 'shared', 'images', k), os.path.join(OWN, 'shared', 'images', k)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        repack(src + '.png', src + '.xml', out, scale=f); n += 2
    for ext in ('.png', '.xml'):
        shutil.copyfile(os.path.join(FA, 'shared', 'images', 'characters', 'BOYFRIEND' + ext), os.path.join(OWN, 'shared', 'images', 'characters', 'BOYFRIEND' + ext)); n += 1
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    # BF's scared shake in the intro: the port names it 'Scared' (its own sheet); FNF's BOYFRIEND calls it 'BF idle shaking'
    p = D('characters', 'bftricky.json'); c = load(p)
    for a in c['animations']:
        if a['name'] == 'scared': a['prefix'] = 'BF idle shaking'
    save(c, p)
    # every week is open from the start in FNF 2 (the mod hides Expurgation until the clown week is beaten)
    p = D('levels', 'expurgation.json'); L = load(p); L['visible'] = True; save(L, p)
    # Expurgation: one chart in the mod (HARD); EASY + NORMAL made from it
    cp, mp = D('songs', 'expurgation', 'expurgation-chart.json'), D('songs', 'expurgation', 'expurgation-metadata.json')
    C, M = load(cp), load(mp)
    hard = C['notes']['hard']
    C['notes'] = dict(easier(hard, M['timeChanges'][0]['bpm']), hard=hard)
    sp = C['scrollSpeed'].get('hard', 3.4)
    C['scrollSpeed'] = {'default': sp, 'easy': round(sp * 0.78, 2), 'normal': round(sp * 0.88, 2), 'hard': sp}
    pd = M['playData']; r = pd['ratings'].get('hard', 15)
    pd['difficulties'] = ['easy', 'normal', 'hard']; pd['ratings'] = {'easy': round(r * 0.4), 'normal': round(r * 0.66), 'hard': r}
    save(C, cp); save(M, mp)
    print('   expurgation', {k: (len(v), sum(q.get('k') == HALO and q['d'] < 4 for q in v)) for k, v in C['notes'].items()}, '(notes, halos)')
    # the videos as WebM (VP9 + Opus: plays in every browser; the mod's mp4s are H.264)
    for v in VIDEOS:
        out = os.path.join(OWN, 'videos', 'videos', v + '.webm')
        if not os.path.exists(out):
            os.makedirs(os.path.dirname(out), exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(MOD, 'videos', 'videos', v + '.mp4'), '-c:v', 'libvpx-vp9',
                            '-b:v', '0', '-crf', '34', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '112k', out], check=True)
        n += 1
    n += erect(D)
    n += pico(D)
    print('tricky:', n, 'files')


def erect(D):
    """Madness ERECT as the 'erect' variation of Madness (V-Slice files already: only renamed + a lighter chart)."""
    if not os.path.isdir(ERECT): print('  no ChuckySkullHead remixes at', ERECT, '- Madness ERECT skipped'); return 0
    from nene import thin
    E = lambda *p: os.path.join(ERECT, *p)
    C = load(E('data', 'songs', 'madness-erect', 'madness-erect-chart.json'))
    M = load(E('data', 'songs', 'madness-erect', 'madness-erect-metadata.json'))
    hard = C['notes']['erect']; bpm = M['timeChanges'][0]['bpm']; sp = C['scrollSpeed'].get('erect', 2.5)
    save({'version': '2.0.0', 'scrollSpeed': {'default': sp, 'erect': round(sp * 0.9, 2), 'nightmare': sp}, 'events': C['events'],
          'notes': {'erect': thin(hard, bpm, 'normal'), 'nightmare': hard}, 'generatedBy': 'FNF 2 tricky.py (Madness ERECT)'},
         D('songs', 'madness', 'madness-chart-erect.json'))
    mp = D('songs', 'madness', 'madness-metadata.json'); base = load(mp)
    m = json.loads(json.dumps(base)); pd = m['playData']
    m['artist'] = base['artist'] + ' (ChuckySkullHead remix)'; m['charter'] = 'Exspiranix'; m['timeChanges'] = M['timeChanges']
    pd['songVariations'] = []; pd['difficulties'] = ['erect', 'nightmare']; pd['ratings'] = {'erect': 10, 'nightmare': M['playData']['ratings'].get('erect', 14)}
    pd['characters'] = {'player': 'bf', 'girlfriend': 'gf', 'opponent': 'tricky', 'instrumental': 'erect', 'altInstrumentals': []}
    save(m, D('songs', 'madness', 'madness-metadata-erect.json'))
    bd = base['playData']; bd['songVariations'] = [v for v in bd.get('songVariations', []) if v not in ('erect', 'pico')] + ['erect']; save(base, mp)
    S = lambda f: os.path.join(OWN, 'songs', 'madness', f)
    shutil.copyfile(E('songs', 'madness-erect', 'Inst-erect.ogg'), S('Inst-erect.ogg'))
    shutil.copyfile(E('songs', 'madness-erect', 'Voices-bf.ogg'), S('Voices-bf-erect.ogg'))
    shutil.copyfile(E('songs', 'madness-erect', 'Voices-tricky.ogg'), S('Voices-tricky-erect.ogg'))
    print('   erect madness', bpm, 'bpm', len(hard), 'notes,', len(C['events']), 'events')
    return 5


def psych(s):
    """A Psych 1.0 chart (lanes 0-3 always yours) -> V-Slice notes with their kinds, camera + other events."""
    from nene import convert
    notes, cam, bpm = convert(s)
    kinds = {}
    for sec in s['notes']:
        for q in sec['sectionNotes']:
            if len(q) > 3 and isinstance(q[3], str) and q[3] and 0 <= int(q[1]) <= 7: kinds[(round(q[0]), int(q[1]))] = q[3]
    for q in notes:
        k = kinds.get((round(q['t']), q['d']))
        if k in KINDS: q['k'] = KINDS[k]
    ev, seen = [], set()
    for item in s.get('events', []):          # ([time, [[name, v1, v2], ...]], some with extra stuff after)
        for x in item[1]:
            name, v1, v2 = x[0], str(x[1]), str(x[2]) if len(x) > 2 else ''
            if (round(item[0], 1), name, v1, v2) in seen: continue
            seen.add((round(item[0], 1), name, v1, v2))
            e = {'t': round(item[0], 3), 'e': name, 'v': {'value1': v1, 'value2': v2}}
            psych_event(ev, e, name, v1, v2)
    return notes, sorted(cam + ev, key=lambda e: e['t']), bpm


def psych_event(ev, e, name, v1, v2):
    """The Pico mod's events -> the ones src/44-tricky.js + the engine know."""
    if name == 'Sign Post': ev.append(dict(e, e='tricky.ExpurgationSignEvent', v={'type': SIGNS.get(v1, 0), 'flipX': False}))
    elif name == 'HP Gremlin': ev.append(dict(e, e='tricky.HPGremlinTo', v={'to': float(v1 or 1), 'duration': float(v2 or 1)}))
    elif name == 'Play Animation' and v1.lower().startswith('burp'): ev.append(dict(e, e='PlayAnimation', v={'target': 'bf', 'anim': 'burpSmile', 'force': True}))
    elif name in ('whiteflash', 'static V2'): ev.append(dict(e, e='tricky.' + name.replace(' ', '')))
    # (Change Character to 'pico-burps' and back: FNF 2's Pico has the burp himself)


def pico(D):
    """The Pico mixes as the 'pico' variation of each song."""
    if not os.path.isdir(PICO): print('  no Pico mixes at', PICO, '- skipped'); return 0
    from nene import read_psych
    n = 0
    for sid, opp in PICO_SONGS.items():
        s = read_psych(os.path.join(PICO, 'data', sid, sid + '-pico-mix.json'))
        hard, events, bpm = psych(s)
        sp = s.get('speed', 3)
        notes = dict(easier(hard, bpm), hard=hard)
        save({'version': '2.0.0', 'scrollSpeed': {'default': sp, 'easy': round(sp * 0.8, 2), 'normal': round(sp * 0.9, 2), 'hard': sp}, 'events': events,
              'notes': notes, 'generatedBy': 'FNF 2 tricky.py (VS Tricky Pico Mix)'}, D('songs', sid, sid + '-chart-pico.json'))
        mp = D('songs', sid, sid + '-metadata.json'); base = load(mp)
        m = json.loads(json.dumps(base)); pd = m['playData']
        m['songName'] = base['songName'] + ' (Pico Mix)'; m['artist'] = base['artist'] + ' (angelkireina remix)'; m['charter'] = 'angelkireina'
        m['timeChanges'] = [{'t': 0, 'b': 0, 'bpm': bpm, 'n': 4, 'd': 4, 'bt': [4, 4, 4, 4]}]
        r = (base['playData'].get('ratings') or {}).get('hard', 6)
        pd['songVariations'] = []; pd['difficulties'] = ['easy', 'normal', 'hard']; pd['ratings'] = {'easy': max(1, round(r * 0.45)), 'normal': max(2, round(r * 0.7)), 'hard': r}
        pd['characters'] = {'player': 'pico-playable', 'girlfriend': 'nene', 'opponent': opp, 'instrumental': 'pico', 'altInstrumentals': []}
        save(m, D('songs', sid, sid + '-metadata-pico.json'))
        bd = base['playData']; bd['songVariations'] = [v for v in bd.get('songVariations', []) if v != 'pico'] + ['pico']; save(base, mp)
        A = lambda f: os.path.join(PICO, 'songs', sid, f)
        S = lambda f: os.path.join(OWN, 'songs', sid, f)
        shutil.copyfile(A('Inst.ogg'), S('Inst-pico.ogg'))
        shutil.copyfile(A('Voices.ogg'), S('Voices-pico-pico.ogg'))
        shutil.copyfile(A('Voices-Opponent.ogg'), S('Voices-%s-pico.ogg' % opp))
        traps = {k: sum(q.get('k') in TRAPS and q['d'] < 4 for q in v) for k, v in notes.items()}
        print('   pico', sid, bpm, 'bpm', {k: len(v) for k, v in notes.items()}, 'traps', traps, len(events), 'events')
        n += 5
    # the Pico mod's game over music (Pico's own death, Tricky's tune)
    for f in ('tikygameOver.ogg', 'tikygameOverEnd.ogg'):
        dst = os.path.join(OWN, 'shared', 'music', 'gameplay', 'gameover', f)
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(os.path.join(PICO, 'music', f), dst); n += 1
    return n


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
