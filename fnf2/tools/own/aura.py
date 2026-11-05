"""Aura Funkin': at South America (Coopey St. Whistler, GameBanana mod 731963) for FNF 2 - PRIVATE build only.
A Psych Engine 1.0 mod with one song, Aura Battle (week 'CLOCK IT!', freeplay only), in the South Park school
hallway: Chase vs Ike, Randy watching (he sings the 'GF Sing' notes). Writes the git-ignored build/mods/aura pack
(never the repo; credits in fnf2/private/CREDITS-mods.txt). What the song's scripts do is in src/48-aura.js.

  characters   characters/*.json (Psych) -> aura-chase, aura-ike, aura-ike2 (Ike after he goes cringe), aura-randy
  chart        data/aura-battle/aura-battle-aura.json: the mod's one chart ('aura') = HARD, NORMAL + EASY made from it
  stage        stages/school.json -> aura-school (the hallway + the crowd behind)
  events       the mod's custom_events get FNF 2 names ('Aura ...'), src/48-aura.js plays them like the .lua files

  python3 tools/own/aura.py [mod folder]
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import impostor as IM                                   # (its Psych helpers: chart + events + characters' animations)

MOD = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('AURA', "/home/user/ref/mods/aura/x/Aura Funkin' at South America")
OUT = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'aura')
NS = 'aura'; P = 'aura-'; SID = 'aura-battle'

def M(*p): return os.path.join(MOD, *p)
def load(p): return json.load(open(p, encoding='utf-8-sig'))
def put(src, *dst):
    d = os.path.join(OUT, *dst); os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(src, d); return d
def dump(obj, *dst):
    d = os.path.join(OUT, *dst); os.makedirs(os.path.dirname(d), exist_ok=True); json.dump(obj, open(d, 'w'), indent=1)

# Randy's sheet is 5185 x 5118 (106 MB of graphics memory): made smaller here (he's drawn at 0.9 x the zoom 0.8 =
# 0.72, so 0.6 still looks sharp); the character's scale goes up by the same amount, so he stands the same size.
SMALL = {'characters/randy': 0.6, 'characters/chase': 0.8, 'characters/ike2': 0.8}

# the mod's own events -> FNF 2 names (src/48-aura.js); the rest are Psych's own (16-mod-events.js)
EVENTS = {'Set Cam Zoom': 'Aura Zoom', 'Camera Set Target': 'Aura Cam', 'CamPosV2': 'Aura Cam Pos', 'bop': 'Aura Bop',
          'lyrics': 'Aura Lyrics', 'Image Fade In': 'Aura Black In', 'Image Fade Out': 'Aura Black Out',
          'backgroundfade': 'Aura BG Fade', 'Play Animation': 'Aura Anim'}


def sheet(img):
    """a character's / the stage's Sparrow sheet into the pack (made smaller when it's in SMALL): its scale k"""
    k = SMALL.get(img)
    base = os.path.join(OUT, 'shared', 'images', NS, img)
    os.makedirs(os.path.dirname(base), exist_ok=True)
    if k:
        from repack_sparrow import repack
        repack(M('images', img + '.png'), M('images', img + '.xml'), base, scale=k)
        return k
    for ext in ('.png', '.xml'):
        if os.path.exists(M('images', img + ext)): shutil.copyfile(M('images', img + ext), base + ext)
    return 1


def icon(name):
    """Psych 1.0 icons are one picture (200 x 275 here, no losing face): kept as is (src/48-aura.js draws them the
    mod's way, 140 px tall) + FNF 2's freeplay pixel icon made from it"""
    src = M('images', 'icons', name + '.png')
    if not os.path.exists(src): return None
    put(src, 'preload', 'images', 'icons', 'icon-' + P + name + '.png')
    class _P:                                      # (impostor.pixel_icon writes through a pack's .path)
        def path(self, *p):
            f = os.path.join(OUT, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f
    IM.pixel_icon(_P(), src, P + name)
    return P + name


def character(cid):
    cj = load(M('characters', cid + '.json'))
    k = sheet(cj['image'])
    s = cj.get('scale', 1) / k                    # (a smaller sheet drawn bigger: the same size on screen)
    pos = cj.get('position', [0, 0])
    d = {'version': '1.0.0', 'name': cid, 'renderType': 'sparrow', 'assetPath': 'shared:%s/%s' % (NS, cj['image']), 'scale': s,
         'flipX': bool(cj.get('flip_x')), 'offsets': [IM.num(pos[0] / s), IM.num(pos[1] / s)],
         'cameraOffsets': cj.get('camera_position', [0, 0]), 'singTime': cj.get('sing_duration', 4),
         'isPixel': bool(cj.get('no_antialiasing')), 'danceEvery': 2,
         'animations': IM.anim_list(cj, 'sparrow', div=s), 'hpColor': IM.color(cj.get('healthbar_colors'))}
    ic = icon(cj.get('healthicon'))
    if ic: d['healthIcon'] = {'id': ic}
    dump(d, 'preload', 'data', 'characters', P + cid + '.json')
    return P + cid


def stage():
    """stages/school.json: Psych stage objects (scale + updateHitbox: the corner stays at x, y) + the spots, and the
    camera the Psych way (the character's middle + 150 / -100, its camera_position, the stage's camera_*)"""
    S = load(M('stages', 'school.json'))
    props = []
    for i, o in enumerate(S['objects']):
        if o.get('type') not in ('sprite', 'animatedSprite'): continue
        sheet(o['image'])
        q = {'name': o['name'], 'assetPath': '%s/%s' % (NS, o['image']), 'position': [o['x'], o['y']], 'scale': list(o['scale']),
             'scroll': list(o['scroll']), 'alpha': o.get('alpha', 1), 'zIndex': i}
        if o.get('animations'):
            q['animations'] = [{'name': a['anim'], 'prefix': a['name'], 'frameRate': a['fps'], 'looped': bool(a['loop'])} for a in o['animations']]
            q['startingAnimation'] = o.get('firstAnimation') or o['animations'][0]['anim']
        props.append(q)
    cb, co, cg = S.get('camera_boyfriend', [0, 0]), S.get('camera_opponent', [0, 0]), S.get('camera_girlfriend', [0, 0])
    chars = {'gf': {'zIndex': 500, 'position': list(S['girlfriend']), 'raw': list(S['girlfriend']), 'scroll': [0.95, 0.95], 'camMid': [cg[0], cg[1]]},
             'dad': {'zIndex': 510, 'position': list(S['opponent']), 'raw': list(S['opponent']), 'camMid': [150 + co[0], -100 + co[1]]},
             'bf': {'zIndex': 520, 'position': list(S['boyfriend']), 'raw': list(S['boyfriend']), 'camMid': [-100 + cb[0], -100 + cb[1]], 'camSign': -1}}
    put(M('images', 'black.png'), 'shared', 'images', NS, 'black.png')
    dump({'version': '1.0.0', 'name': 'South Park Elementary', 'cameraZoom': S.get('defaultZoom', 1), 'directory': 'shared', 'props': props,
          'characters': chars, 'aura': {'cameraSpeed': S.get('camera_speed', 1)}}, 'preload', 'data', 'stages', P + 'school.json')
    return P + 'school'


def notestyle():
    """FNF's arrows at 0.6 (AURA.lua: noteScale 0.6), everything else FNF's own"""
    import re
    src = open(os.path.join(ROOT, 'build', 'assets.js'), encoding='utf-8').read()
    m = re.search(r'"preload/data/notestyles/funkin.json":("(?:[^"\\]|\\.)*")', src)
    j = json.loads(json.loads(m.group(1)))
    j['name'] = 'Aura'; j['fallback'] = 'funkin'
    for k in ('note', 'noteStrumline', 'holdNote'): j['assets'][k]['scale'] = 0.6
    dump(j, 'preload', 'data', 'notestyles', 'aura.json')


def main():
    s = IM.chart(M('data', SID, SID + '-aura.json'))
    hard, cam, tc, old_ev = IM.notes_of(s)
    IM.OWN_EVENTS.clear()                           # (these are VS Impostor's names; ours are EVENTS)
    evs = []
    for e in IM.events_of(s):
        e['e'] = EVENTS.get(e['e'], e['e'])
        if e['e'] == 'Change Character': e['v']['value2'] = P + e['v']['value2'].strip()
        evs.append(e)
    events = sorted(cam + evs, key=lambda e: e['t'])
    player, opp, gfid = character(s['player1']), character(s['player2']), character(s['gfVersion'])
    for e in events:
        if e['e'] == 'Change Character': character(e['v']['value2'][len(P):])
    icon('freeplay-icon')
    st = stage()
    notestyle()
    notes = {'easy': IM.easier(hard, tc, 'easy'), 'normal': IM.easier(hard, tc, 'normal'), 'hard': hard}
    sp = s.get('speed', 3)
    speeds = {'default': sp, 'easy': round(sp * 0.85, 2), 'normal': round(sp * 0.92, 2), 'hard': sp}
    put(M('songs', SID, 'Inst.ogg'), 'songs', SID, 'Inst.ogg')
    put(M('songs', SID, 'Voices-player.ogg'), 'songs', SID, 'Voices-%s.ogg' % player)
    put(M('songs', SID, 'Voices-opponent.ogg'), 'songs', SID, 'Voices-%s.ogg' % opp)
    gen = 'FNF 2 - tools/own/aura.py (Aura Funkin\': at South America)'
    meta = {'version': '2.2.4', 'songName': 'Aura Battle', 'artist': 'Coopey St. Whistler', 'charter': 'Coopey St. Whistler', 'offsets': {},
            'playData': {'difficulties': ['easy', 'normal', 'hard'],
                         'characters': {'player': player, 'girlfriend': gfid, 'opponent': opp, 'playerVocals': [player], 'opponentVocals': [opp]},
                         'stage': st, 'noteStyle': 'aura', 'ratings': {'easy': 2, 'normal': 4, 'hard': 6},
                         'previewStart': 61364, 'previewEnd': 76000},
            'timeChanges': tc, 'generatedBy': gen}
    dump(meta, 'preload', 'data', 'songs', SID, SID + '-metadata.json')
    dump({'version': '2.0.0', 'scrollSpeed': speeds, 'events': events, 'notes': notes, 'generatedBy': gen},
         'preload', 'data', 'songs', SID, SID + '-chart.json')
    # the week: freeplay only, like the mod (hideStoryMode)
    wk = load(M('weeks', 'weekaura.json'))
    dump({'version': '1.0.0', 'name': wk.get('storyName', 'CLOCK IT!'), 'visible': False, 'props': [], 'background': '#FF005D',
          'songs': [SID], 'capsule': {'name': 'AURA'}}, 'preload', 'data', 'levels', 'aura.json')
    cnt = {k: sum(1 for q in v if q['d'] < 4) for k, v in notes.items()}
    gfn = sum(1 for q in hard if q.get('k') == 'gfsing'), sum(1 for q in hard if q.get('k') == 'gfsing' and q['d'] < 4)
    print('aura:', SID, [c['bpm'] for c in tc], 'bpm, your notes', cnt, 'speed', sp, len(events), 'events, gf notes (all, yours)', gfn,
          'chars', player, opp, gfid)


if __name__ == '__main__':
    main()
