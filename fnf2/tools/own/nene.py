"""Nene's own songs for FNF 2 (PRIVATE build only, written to the git-ignored build/own folder, never the repo).

  After Hours            Girls Night mod (GameBanana 622938): Nene vs Darnell on a rooftop, split voices
  Nene, Bubbles, Sharp   FNF: Girls' Night Out (GameBanana 441203): Nene vs the standing GF 'geef' in an
                         alley, one combined voice track per song

Nene sings with ZenUnique's Playable Nene sheet (GameBanana 386366) in all four, imported at 80% (drawn at
1.25x, like Sky). She is the ORIGINAL opponent of every song, so the songs are written that way
(opponent = 'nene-playable') and played swapped: you sing her part, standing on the player's side, and
whoever she battled stands on the left.

The mod charts are the HARD charts. NORMAL + EASY are thinned from them (normal: no 16th runs, few jumps;
easy: a beat or more between notes, no jumps).

Stages: every layer cut to its pixels, the big soft ones stored smaller (drawn bigger). Character spots
are where the mod's characters' FEET were (the play screen puts each new character's drawn feet there),
camera points are the mod's own.

  python3 tools/own/nene.py
"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OWN = os.path.join(ROOT, 'build', 'own')
sys.path.insert(0, HERE)
from repack_sparrow import repack, frames_of

MODS = os.environ.get('MODS', '/home/user/ref/mods')
NENE = os.path.join(MODS, 'nene1', 'x', 'playable_nene', 'mods')
GN = os.path.join(MODS, 'girlsnight', 'x', "Girl's Night")
GNO = os.path.join(MODS, 'gno', 'x', 'Girls Night Out')
PSYCH = os.environ.get('PSYCH', '/home/user/ref/psych/assets')
FA = os.environ.get('FNF_ASSETS', '/home/user/ref/fa')
NENE_SCALE = 0.8


def out(*p):
    f = os.path.join(OWN, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f


def jdump(obj, *p): json.dump(obj, open(out(*p), 'w'), indent=1)


# ---------------------------------------------------------------- Psych layout -> where feet + camera were
def first_frame(xml_path, prefix, indices=None):
    fr = [f for f in frames_of(open(xml_path, encoding='utf-8-sig').read()) if f['name'].startswith(prefix) and re.fullmatch(r'\d*', f['name'][len(prefix):])]
    fr.sort(key=lambda f: int(f['name'][len(prefix):] or 0))
    ok = [i for i in (indices or [0]) if i < len(fr)]          # (Flixel skips missing indices)
    return fr[ok[0]]


def visible(png, f):
    """Visible box of a frame inside its untrimmed frame: (x0, y0, x1, y1)."""
    img = Image.open(png)
    x, y, w, h = int(f['x']), int(f['y']), int(f['width']), int(f['height'])
    cut = img.crop((x, y, x + w, y + h)).convert('RGBA')
    if f['rot']: cut = cut.transpose(Image.ROTATE_90)
    a = np.asarray(cut)[..., 3]; ys, xs = np.nonzero(a > 8)
    return (f['fx'] + xs.min(), f['fy'] + ys.min(), f['fx'] + xs.max() + 1, f['fy'] + ys.max() + 1)


def psych_char(png, xml, cj, stage_pos, player):
    """A Psych character on a Psych stage -> world spot of its drawn feet + its camera point."""
    idle = next(a for a in cj['animations'] if a['anim'] in ('idle', 'danceLeft'))
    f = first_frame(xml, idle['name'], idle.get('indices') or None)
    f0 = frames_of(open(xml, encoding='utf-8-sig').read())[0]          # Psych's hitbox comes from the sheet's first frame
    s = cj.get('scale', 1)
    flip = bool(cj.get('flip_x')) != player
    x, y = stage_pos[0] + cj['position'][0], stage_pos[1] + cj['position'][1]
    ao = idle['offsets']
    x0, y0, x1, y1 = visible(png, f)
    cx = (f['fw'] - (x0 + x1) / 2) if flip else (x0 + x1) / 2
    corr = f0['fw'] / 2 * (1 - s), f0['fh'] / 2 * (1 - s)               # Psych replaces the hitbox offset by the anim offset
    feet = (x - ao[0] + cx * s + corr[0], y - ao[1] + y1 * s + corr[1])
    mid = (x + f0['fw'] * s / 2, y + f0['fh'] * s / 2)
    return feet, mid, cj.get('camera_position', [0, 0])


def cam_point(mid, campos, stage_off, player):
    if player: return [mid[0] - 100 - campos[0] + stage_off[0], mid[1] - 100 + campos[1] + stage_off[1]]
    return [mid[0] + 150 + campos[0] + stage_off[0], mid[1] - 100 + campos[1] + stage_off[1]]


# ---------------------------------------------------------------- characters
def psych_to_vslice(cj, asset, scale=1.0, death=None):
    """Psych character json -> FNF V-Slice character data (multisparrow when there's a death sheet)."""
    anims = []
    for a in cj['animations']:
        an = {'name': a['anim'], 'prefix': a['name'], 'frameRate': a.get('fps', 24), 'looped': bool(a.get('loop')),
              'offsets': [round(v * scale, 2) for v in a['offsets']]}
        if a.get('indices'): an['frameIndices'] = a['indices']
        anims.append(an)
    if death:
        dj, dasset, dy = death
        for a in dj['animations']:
            anims.append({'name': a['anim'], 'prefix': a['name'], 'frameRate': a.get('fps', 24), 'looped': bool(a.get('loop')),
                          'offsets': [round(a['offsets'][0] * scale, 2), round((a['offsets'][1] + dy) * scale, 2)], 'assetPath': dasset})
    return {'version': '1.0.0', 'renderType': 'multisparrow' if death else 'sparrow', 'assetPath': asset, 'scale': round(1 / scale, 4),
            'flipX': bool(cj.get('flip_x')), 'offsets': [0, 0], 'cameraOffsets': [0, 0], 'singTime': round(cj.get('sing_duration', 4), 2),
            'animations': anims}


def characters():
    C = os.path.join(NENE, 'characters'); I = os.path.join(NENE, 'images', 'characters')
    D = lambda n: out('shared', 'images', 'characters', n)
    # Nene (ZenUnique), 80%: her sheet alone is 8192x4096
    repack(os.path.join(I, 'nene.png'), os.path.join(I, 'nene.xml'), D('nene-playable'), scale=NENE_SCALE)
    repack(os.path.join(I, 'nene_dead.png'), os.path.join(I, 'nene_dead.xml'), D('nene-playable-dead'), scale=NENE_SCALE)
    cj = json.load(open(os.path.join(C, 'nene.json'))); dj = json.load(open(os.path.join(C, 'nene-dead.json')))
    # the death sheet is its own character in the mod, 40px higher (y 150 vs 190), which leaves her skeleton
    # floating ~85px over the floor: put its feet where hers were
    dy = cj['position'][1] - dj['position'][1] - 85
    d = psych_to_vslice(cj, 'shared:characters/nene-playable', NENE_SCALE, (dj, 'shared:characters/nene-playable-dead', dy))
    d['name'] = 'Nene'; d['healthIcon'] = {'id': 'nene'}; d['healthColor'] = '#F16AA5'
    d['script'] = ''            # no A-Bot: that's the speaker Nene (nene.hxc)
    d['death'] = {'cameraOffsets': [0, -40]}
    jdump(d, 'preload', 'data', 'characters', 'nene-playable.json')

    # the standing GF of Girls' Night Out (Flyplague): her real sheet, full size
    G = os.path.join(GNO, 'images', 'characters')
    repack(os.path.join(G, 'geef.png'), os.path.join(G, 'geef.xml'), D('geef'), scale=1.0)
    gj = json.load(open(os.path.join(GNO, 'characters', 'geef.json')))
    g = psych_to_vslice(gj, 'shared:characters/geef', 1.0)
    g['name'] = 'Girlfriend'; g['healthIcon'] = {'id': 'geef'}; g['healthColor'] = '#A5004D'
    jdump(g, 'preload', 'data', 'characters', 'geef.json')
    shutil.copyfile(os.path.join(GNO, 'images', 'icons', 'icon-geef.png'), out('preload', 'images', 'icons', 'icon-geef.png'))
    # her freeplay pixel icon = FNF's own GF one (she is GF)
    for e in ('.png', '.xml'):
        shutil.copyfile(os.path.join(FA, 'preload', 'images', 'freeplay', 'icons', 'gfpixel' + e), out('preload', 'images', 'freeplay', 'icons', 'geefpixel' + e))


# ---------------------------------------------------------------- stages
def layer(src, base, factor, bbox=None):
    im = Image.open(src).convert('RGBA')
    bb = bbox or im.getbbox()
    im = im.crop(bb)
    if factor != 1: im = im.resize((max(1, round(im.width * factor)), max(1, round(im.height * factor))), Image.LANCZOS)
    im.save(out('shared', 'images', 'nene-stages', base + '.png'))
    return bb


def prop(name, base, pos, bb, factor, scroll, z, scale=1.0):
    s = scale / factor
    return {'name': name, 'assetPath': 'nene-stages/' + base, 'position': [round(pos[0] + bb[0] * scale, 2), round(pos[1] + bb[1] * scale, 2)],
            'scale': [s, s], 'scroll': [scroll[0], scroll[1]], 'zIndex': z}


def rooftop():
    """Girls Night's rooftop (rooftop.lua). Its sky picture (v2normalbackground) isn't in the mod, so the sky
    is black behind the tints, like in the mod itself."""
    I = os.path.join(GN, 'images')
    L = [  # name, file, pos, scroll, z, factor (front layers z > 300)
        ('moon', 'v2normalmoon', (-800, -400), (0, 0), 10, 1.0),
        ('city1', 'v2buildings2', (-1000, -500), (0.1, 0.1), 20, 0.5),
        ('tint1', 'v2normaltint2', (-800, -500), (0.05, 0.05), 30, 0.125),
        ('city2', 'v2buildings1', (-1000, -500), (0.35, 0.35), 40, 0.5),
        ('floor', 'v2normalstagelarger', (-1000, -500), (1, 1), 50, 0.75),
        ('glow', 'v2normalglow', (-1000, -500), (1, 1), 400, 0.5),
        ('tint2', 'v2normaltint1', (-800, -200), (0, 0.5), 410, 0.125),
    ]
    props = [{'name': 'sky', 'assetPath': '#000000', 'position': [-2400, -1800], 'scale': [6000, 5000], 'scroll': [0, 0], 'zIndex': 0}]
    for name, f, pos, sc, z, k in L:
        bb = layer(os.path.join(I, f + '.png'), 'rooftop-' + name, k)
        props.append(prop(name, 'rooftop-' + name, pos, bb, k, sc, z))
    S = json.load(open(os.path.join(GN, 'stages', 'rooftop.json')))
    # who stood where in the mod: Nene (opponent, left), Darnell (player, right), GF on her speaker
    nj = json.load(open(os.path.join(GN, 'characters', 'nene.json')))
    dj = json.load(open(os.path.join(GN, 'characters', 'darnell playable.json')))
    gj = json.load(open(os.path.join(PSYCH, 'shared', 'characters', 'gf.json')))
    nf, nm, nc = psych_char(os.path.join(I, 'characters', 'NENE.png'), os.path.join(I, 'characters', 'NENE.xml'), nj, S['opponent'], False)
    df, dm, dc = psych_char(os.path.join(PSYCH, 'base_game', 'shared', 'images', 'characters', 'darnell.png'),
                            os.path.join(PSYCH, 'base_game', 'shared', 'images', 'characters', 'darnell.xml'), dj, S['boyfriend'], True)
    gf, gm, gc = psych_char(os.path.join(PSYCH, 'shared', 'images', 'characters', 'GF_assets.png'),
                            os.path.join(PSYCH, 'shared', 'images', 'characters', 'GF_assets.xml'), gj, S['girlfriend'], False)
    # FNF 2 framing: a little wider (0.72 instead of 0.8), camera 40px up and GF's speaker 40px lower, so
    # GF's head isn't cut off at the top (her speaker stands far up by the fence in the mod)
    up = lambda c: [round(c[0], 1), round(c[1] - 40, 1)]
    st = {'version': '1.0.1', 'name': 'Rooftop (Girls Night)', 'cameraZoom': 0.72, 'directory': 'shared', 'props': props,
          'noteCam': 20,
          'characters': {
              'bf': {'zIndex': 300, 'position': [round(df[0]), round(df[1])], 'feet': True, 'camera': up(cam_point(dm, dc, S['camera_boyfriend'], True))},
              'dad': {'zIndex': 200, 'position': [round(nf[0]), round(nf[1])], 'feet': True, 'camera': up(cam_point(nm, nc, S['camera_opponent'], False))},
              'gf': {'zIndex': 100, 'position': [round(gf[0]), round(gf[1] + 40)], 'feet': True}}}
    jdump(st, 'preload', 'data', 'stages', 'neneRooftop.json')
    print('rooftop: nene feet', nf, 'darnell feet', df, 'gf feet', gf, 'cams', st['characters']['bf']['camera'], st['characters']['dad']['camera'])


def alley():
    """Girls' Night Out's alley (alleynene.lua): 6 layers at 1.2x, the camera sits on two fixed spots."""
    I = os.path.join(GNO, 'images')
    L = [('sky', (0.3, 0.3), 10), ('far1', (0.5, 0.5), 20), ('far2', (0.5, 0.5), 30), ('back', (1, 1), 40), ('mid', (1, 1), 50), ('fg', (1, 1), 400)]
    props = []
    for n, sc, z in L:
        bb = layer(os.path.join(I, 'bg', 'sharp-%s.png' % n), 'alley-' + n, 1.0)
        props.append(prop(n, 'alley-' + n, (-300, -270), bb, 1.0, sc, z, scale=1.2))
    S = json.load(open(os.path.join(GNO, 'stages', 'alleynene.json')))
    nj = json.load(open(os.path.join(GNO, 'characters', 'nenemy.json')))
    gj = json.load(open(os.path.join(GNO, 'characters', 'geef.json')))
    nf, _, _ = psych_char(os.path.join(I, 'characters', 'Nenemy_Assets.png'), os.path.join(I, 'characters', 'Nenemy_Assets.xml'), nj, S['opponent'], False)
    gf, _, _ = psych_char(os.path.join(I, 'characters', 'geef.png'), os.path.join(I, 'characters', 'geef.xml'), gj, S['boyfriend'], True)
    # FNF 2 framing: Nene is wider than the mod's GF, so her spot is 70px further in and the view a bit wider
    # (0.75 instead of 0.8), or she'd hang off the right edge while the camera is on the left
    st = {'version': '1.0.1', 'name': "Alley (Girls' Night Out)", 'cameraZoom': 0.75, 'directory': 'shared', 'props': props,
          'noteCam': 20,
          'characters': {
              'bf': {'zIndex': 300, 'position': [round(gf[0]) - 70, round(gf[1])], 'feet': True, 'camera': [1100, 560]},
              'dad': {'zIndex': 200, 'position': [round(nf[0]), round(nf[1])], 'feet': True, 'camera': [700, 560]},
              'gf': {'zIndex': 100, 'position': [800, 600]}}}
    jdump(st, 'preload', 'data', 'stages', 'alleyNene.json')
    print('alley: nene feet', nf, 'geef feet', gf)


# ---------------------------------------------------------------- charts
def read_psych(path):
    d = json.load(open(path, encoding='utf-8-sig'))
    return d['song'] if isinstance(d.get('song'), dict) else d


def convert(s):
    """Psych chart -> V-Slice notes (0-3 = player, 4-7 = opponent) + camera events."""
    bpm = s['bpm']; step = 60000 / bpm / 4
    absolute = str(s.get('format', '')).startswith('psych_v1')     # Psych 1.0: lanes 0-3 are always the player's
    lst, ev, t, last = [], [], 0.0, None
    for sec in s['notes']:
        must = bool(sec.get('mustHitSection'))
        if must != last: ev.append({'t': round(t, 3), 'e': 'FocusCamera', 'v': {'char': 0 if must else 1}}); last = must
        for n in sec['sectionNotes']:
            tt, lane, ln = n[0], int(n[1]), n[2] if len(n) > 2 else 0
            if lane < 0 or lane > 7: continue
            player = lane < 4 if absolute else (lane < 4) == must
            nt = {'t': round(tt, 3), 'd': (lane % 4) + (0 if player else 4)}
            if isinstance(ln, (int, float)) and ln > 0: nt['l'] = round(ln, 3)
            lst.append(nt)
        beats = sec.get('sectionBeats') or (sec.get('lengthInSteps', 16) / 4)
        t += beats * 4 * step
    lst.sort(key=lambda q: (q['t'], q['d']))
    dedup, seen = [], set()
    for q in lst:
        k = (round(q['t']), q['d'])
        if k not in seen: seen.add(k); dedup.append(q)
    return dedup, ev, bpm


def thin(notes, bpm, level):
    """NORMAL: notes on the 8th grid only (holds kept), jumps only on the first beat of a bar.
    EASY: notes on the beat, at least a beat apart, no jumps."""
    beat = 60000 / bpm
    out = []
    for side in (0, 1):
        sn = [n for n in notes if (n['d'] >= 4) == bool(side)]
        groups = {}
        for n in sn: groups.setdefault(round(n['t']), []).append(n)
        lastT = -1e9
        for t in sorted(groups):
            g = sorted(groups[t], key=lambda n: (-n.get('l', 0), n['d']))
            pos = t / beat
            if level == 'normal':
                if abs(pos * 2 - round(pos * 2)) > 0.08 and not g[0].get('l'): continue        # off the 8th grid
                if t - lastT < beat / 2 - 5: continue
                bar_start = abs(pos / 4 - round(pos / 4)) < 0.02
                out.extend(g[:2] if bar_start else g[:1])
            else:
                if abs(pos - round(pos)) > 0.06: continue                                       # off the beat
                if t - lastT < beat - 5: continue
                out.append(g[0])
            lastT = t
    out.sort(key=lambda q: (q['t'], q['d']))
    return out


SONGS = [
    # id, name, mod chart, audio dir, split voices, opponent/player chars, gf, stage, ratings, artist, charter
    ('after-hours', 'After Hours', os.path.join(GN, 'data', 'after-hours', 'after-hours.json'), os.path.join(GN, 'songs', 'after-hours'), True,
     'darnell', 'gf', 'neneRooftop', (3, 5, 7), 'Fletch Legacy', 'AstralZ'),
    ('nene', 'Nene', os.path.join(GNO, 'data', 'nene', 'nene-hard.json'), os.path.join(GNO, 'songs', 'nene'), False,
     'geef', '', 'alleyNene', (2, 4, 6), 'bbpanzu', 'Clover'),
    ('bubbles', 'Bubbles', os.path.join(GNO, 'data', 'bubbles', 'bubbles-hard.json'), os.path.join(GNO, 'songs', 'bubbles'), False,
     'geef', '', 'alleyNene', (3, 5, 8), 'Nasa', 'Clover'),
    ('sharp', 'Sharp', os.path.join(GNO, 'data', 'sharp', 'sharp-hard.json'), os.path.join(GNO, 'songs', 'sharp'), False,
     'geef', '', 'alleyNene', (4, 6, 9), 'Clover + KaiTheGuy', 'Clover'),
]


def songs():
    for sid, name, chart, audio, split, player, gf, stage, rt, artist, charter in SONGS:
        s = read_psych(chart)
        hard, events, bpm = convert(s)
        notes = {'easy': thin(hard, bpm, 'easy'), 'normal': thin(hard, bpm, 'normal'), 'hard': hard}
        sp = s.get('speed', 2)
        speeds = {'easy': round(sp * 0.85, 2), 'normal': round(sp * 0.92, 2), 'hard': sp}
        src = {f.lower(): f for f in os.listdir(audio)}
        shutil.copyfile(os.path.join(audio, src['inst.ogg']), out('songs', sid, 'Inst.ogg'))
        if split:
            shutil.copyfile(os.path.join(audio, src['voices-opponent.ogg']), out('songs', sid, 'Voices-nene.ogg'))
            shutil.copyfile(os.path.join(audio, src['voices-player.ogg']), out('songs', sid, 'Voices-%s.ogg' % player))
            pv = [player]
        else:   # one track for both singers: it's Nene's (yours after the swap), it goes quiet when you miss like old FNF
            shutil.copyfile(os.path.join(audio, src['voices.ogg']), out('songs', sid, 'Voices-nene.ogg'))
            pv = []
        meta = {'version': '2.2.4', 'songName': name, 'artist': artist, 'charter': charter, 'offsets': {},
                'playData': {'difficulties': ['easy', 'normal', 'hard'],
                             'characters': {'player': player, 'girlfriend': gf, 'opponent': 'nene-playable', 'playerVocals': pv, 'opponentVocals': ['nene']},
                             'stage': stage, 'noteStyle': 'funkin', 'album': 'volume3', 'ratings': dict(zip(('easy', 'normal', 'hard'), rt)),
                             'previewStart': 0, 'previewEnd': 15000},
                'timeChanges': [{'t': 0, 'b': 0, 'bpm': bpm, 'bt': [4, 4, 4, 4]}],
                'generatedBy': 'FNF 2 - tools/own/nene.py (from the mod chart)'}
        jdump(meta, 'preload', 'data', 'songs', sid, sid + '-metadata.json')
        json.dump({'version': '2.0.0', 'scrollSpeed': speeds, 'events': events, 'notes': notes, 'generatedBy': meta['generatedBy']},
                  open(out('preload', 'data', 'songs', sid, sid + '-chart.json'), 'w'))
        cnt = {k: sum(1 for n in v if n['d'] < 4) for k, v in notes.items()}
        print(sid, 'bpm', bpm, 'player notes', cnt, 'speed', speeds)
    # a level only the new players' freeplay uses (like Week 7 for Tankman)
    jdump({'version': '1.0.0', 'name': "NENE'S NIGHT", 'titleAsset': 'storymenu/titles/weekend1', 'visible': False, 'props': [], 'capsule': {'name': 'GIRLS NIGHT'}, 'players': ['nene'],
           'background': '#F16AA5', 'songs': [s[0] for s in SONGS]}, 'preload', 'data', 'levels', 'nenesongs.json')


def main():
    characters()
    rooftop()
    alley()
    songs()
    print('Nene written to', OWN)


if __name__ == '__main__':
    main()
