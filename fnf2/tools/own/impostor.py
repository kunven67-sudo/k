"""VS IMPOSTOR: LEGACY (the official 2025 remaster of VS Impostor V4: MOTORFROG, Clowfoe + the Impostor team) for
FNF 2 - PRIVATE build only. Reads the mod's own folder (GameBanana file 1762758) and writes FNF 2 mod packs into the
git-ignored build/mods/<pack> folders (never the repo; credits in fnf2/private/CREDITS-mods.txt).

The mod runs on its own Psych Engine based engine with HScript stage + song scripts. Here:
  characters   data/characters/*.json (Psych style, most are Animate atlases) -> FNF 2 character files, all named
               'imp-<id>' (the mod's 'bf', 'gf', 'red'... would clash with FNF's own)
  charts       songs/<id>/data/normal.json (+ events.json): the mod has ONE chart per song = HARD; NORMAL + EASY are
               made from it (only your side is thinned, the opponents sing every note like in the mod)
  stages       data/stages/<id>.json + .hx: the layout of every stage script's onLoad/onCreatePost is written out
               here (STAGES), what moves is in src/47-impostor.js
  talk         songs/<id>/dialogue.txt + data/dialogue/*.json + the English text (lang/english.json)
  videos       videos/**/*.mp4 -> WebM (VP9 + Opus), their .srt captions with the English text
Packs: 'impostor' = what every week uses (BF, GF, the talk box, icons, sounds), then one pack per week, so a song only
loads its own week.

  python3 tools/own/impostor.py [week ids...]      (default: every week that's written up)
"""
import glob, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
MOD = os.environ.get('IMPOSTOR', '/home/user/ref/mods/impostor/x/VS IMPOSTOR LEGACY 1.1.2/assets')
MODS_OUT = os.path.join(ROOT, 'build', 'mods')
NS = 'impostor'                     # every picture goes under shared/images/impostor/<the mod's own path>
P = 'imp-'                          # character + stage ids

def M(*p): return os.path.join(MOD, *p)


# ---------------------------------------------------------------- small helpers
def json5(path):
    """The mod's JSON files can have // comments + trailing commas (lang/*.json, data/dialogue/*.json)."""
    t = open(path, encoding='utf-8-sig').read()
    out, i, n, q = [], 0, len(t), None
    while i < n:
        c = t[i]
        if q:
            out.append(c)
            if c == '\\' and i + 1 < n: out.append(t[i + 1]); i += 2; continue
            if c == q: q = None
            i += 1; continue
        if c in '"\'': q = c; out.append(c); i += 1; continue
        if t.startswith('//', i): j = t.find('\n', i); i = n if j < 0 else j; continue
        if t.startswith('/*', i): j = t.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        out.append(c); i += 1
    s = re.sub(r',(\s*[}\]])', r'\1', ''.join(out))
    return json.loads(s)


class Pack:
    def __init__(self, pid):
        self.id = pid; self.root = os.path.join(MODS_OUT, pid); self.n = 0
    def path(self, *p):
        f = os.path.join(self.root, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f
    def put(self, src, *dst):
        d = self.path(*dst)
        if not os.path.exists(d) or os.path.getsize(d) != os.path.getsize(src): shutil.copyfile(src, d); self.n += 1
        return d
    def dump(self, obj, *dst):
        json.dump(obj, open(self.path(*dst), 'w'), indent=1); self.n += 1


_LANG = None
def lang(key, default=None):
    """The English text of one of the mod's string keys (dialogue_moogus0, cutscene_moogus0...)."""
    global _LANG
    if _LANG is None: _LANG = json5(M('lang', 'english.json'))['lang']
    return _LANG.get(key, key if default is None else default)


def color(v, d='#A1A1A1'):
    """healthbar_colour (signed 0xAARRGGBB int) or healthbar_colors [r, g, b] -> '#RRGGBB'."""
    if isinstance(v, list) and len(v) >= 3: return '#%02X%02X%02X' % tuple(int(x) for x in v[:3])
    if isinstance(v, (int, float)): v = int(v) & 0xFFFFFF; return '#%06X' % v
    return d


def webm(src, dst, height=720):
    """A cutscene video as WebM (VP9 + Opus) at most 720 px high: plays in every browser, the mod's mp4s are H.264."""
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', "scale=-2:'min(%d,ih)'" % height, '-c:v', 'libvpx-vp9', '-b:v', '0',
                    '-crf', '33', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-c:a', 'libopus', '-b:a', '128k', dst], check=True)


def srt(src):
    """A video's captions: [[from, to, English text], ...] (the mod's .srt files hold string keys)."""
    if not os.path.exists(src): return []
    out = []
    for block in re.split(r'\n\s*\n', open(src, encoding='utf-8-sig').read().strip()):
        lines = [l.strip() for l in block.strip().splitlines()]
        if len(lines) < 3: continue
        m = re.match(r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)', lines[1])
        if not m: continue
        g = [int(x) for x in m.groups()]
        a = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000; b = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        text = '\n'.join(lang(l) for l in lines[2:])
        out.append([round(a, 3), round(b, 3), text])
    return out


# ---------------------------------------------------------------- characters
def atlas_dir(img):
    return os.path.isdir(M('images', img)) and os.path.exists(M('images', img, 'Animation.json'))


def copy_image(pack, img):
    """A character's / prop's picture (Sparrow png+xml, a plain png, or an Animate atlas folder) into the pack."""
    if atlas_dir(img):
        for f in os.listdir(M('images', img)):
            pack.put(M('images', img, f), 'shared', 'images', NS, img, f)
        return 'atlas'
    for ext in ('.png', '.xml'):
        if os.path.exists(M('images', img + ext)): pack.put(M('images', img + ext), 'shared', 'images', NS, img + ext)
    return 'sparrow' if os.path.exists(M('images', img + '.xml')) else 'image'


def icon(pack, name):
    """The health icon 'name' (the mod's icons/icon-<name>.png, any case) -> preload/images/icons/icon-imp-<name>.png."""
    if not name: return None
    want = ('icon-' + name + '.png').lower()
    for f in os.listdir(M('images', 'icons')):
        if f.lower() == want:
            pack.put(M('images', 'icons', f), 'preload', 'images', 'icons', 'icon-' + P + name + '.png')
            if f.endswith('.png') and os.path.exists(M('images', 'icons', f[:-4] + '.xml')):
                pack.put(M('images', 'icons', f[:-4] + '.xml'), 'preload', 'images', 'icons', 'icon-' + P + name + '.xml')
            return P + name
    return None


def anim_list(cj, img_kind, extra_offset=(0, 0), asset=None):
    out = []
    for a in cj['animations']:
        name = a['anim']
        if name.endswith('-loop'): name = name[:-5] + '-hold'          # (Psych 1.0 '-loop' follow-ups = FNF's '-hold')
        an = {'name': name, 'prefix': a['name'], 'frameRate': a.get('fps', 24), 'looped': bool(a.get('loop')),
              'offsets': [round(a['offsets'][0] - extra_offset[0], 2), round(a['offsets'][1] - extra_offset[1], 2)]}
        if a.get('indices'): an['frameIndices'] = a['indices']
        if a.get('flipX'): an['flipX'] = True
        if asset: an['assetPath'] = asset
        out.append(an)
    return out


DONE_CHARS = {}
def character(pack, cid):
    """The mod's character 'cid' -> preload/data/characters/imp-<cid>.json (+ its picture, icon, death character).
    Placed the Psych way (FNF 2 'raw' stage spots): the stage spot + the character's 'position'."""
    if cid in DONE_CHARS: return DONE_CHARS[cid]
    p = M('data', 'characters', cid + '.json')
    if not os.path.exists(p): print('   (no character', cid + ')'); return None
    cj = json5(p)
    kind = copy_image(pack, cj['image'])
    s = cj.get('scale', 1)
    if s != 1: print('   NOTE scale', cid, s)
    d = {'version': '1.0.0', 'name': cid, 'renderType': 'animateatlas' if kind == 'atlas' else 'sparrow',
         'assetPath': 'shared:%s/%s' % (NS, cj['image']), 'scale': s, 'flipX': bool(cj.get('flip_x')),
         'offsets': cj.get('position', [0, 0]), 'cameraOffsets': cj.get('camera_position', [0, 0]),
         # Psych: back to idle after sing_duration x 1.1 steps (holdTimer > stepCrochet * 0.0011 * singDuration)
         'singTime': round(cj.get('sing_duration', 4) * 1.1, 3),
         'isPixel': bool(cj.get('no_antialiasing')),
         'animations': anim_list(cj, kind)}
    names = {a['anim'] for a in cj['animations']}
    de = cj.get('dance_every')
    d['danceEvery'] = de if de else (1 if 'danceLeft' in names else 2)
    ic = icon(pack, cj.get('healthicon'))
    if ic: d['healthIcon'] = {'id': ic}
    d['hpColor'] = color(cj.get('healthbar_colour', cj.get('healthbar_colors')))
    d['impostor'] = {'afterimages': cj.get('afterimages', True) is not False, 'vsliceSustains': bool(cj.get('vslice_sustains')),
                     'flags': cj.get('flags') or {}}
    if cj.get('pausePortrait'): d['impostor']['pausePortrait'] = cj['pausePortrait']
    # the game over: the death character's animations go onto this one (from its own picture, in its own spot)
    dead = cj.get('gameover_character')
    if dead and dead != cid and os.path.exists(M('data', 'characters', dead + '.json')):
        dj = json5(M('data', 'characters', dead + '.json'))
        dk = copy_image(pack, dj['image'])
        dp, bp = dj.get('position', [0, 0]), cj.get('position', [0, 0])
        dasset = 'shared:%s/%s' % (NS, dj['image'])
        d['animations'] += anim_list(dj, dk, (dp[0] - bp[0], dp[1] - bp[1]), dasset)
        d['renderType'] = 'multianimateatlas' if kind == 'atlas' or dk == 'atlas' else 'multisparrow'
        if d['renderType'] == 'multianimateatlas':
            for a in d['animations']:
                if 'assetPath' not in a: a['assetPath'] = d['assetPath']
                a['renderType'] = 'animateatlas' if (atlas_dir(dj['image']) if a['assetPath'] == dasset else kind == 'atlas') else 'sparrow'
        for k in ('gameover_intial_sound', 'gameover_loop_sound', 'gameover_confirm_sound'):
            v = dj.get(k) or cj.get(k)
            if v: d['impostor'][k] = v
    pack.dump(d, 'preload', 'data', 'characters', P + cid + '.json')
    DONE_CHARS[cid] = P + cid
    return P + cid


# ---------------------------------------------------------------- charts
def chart(path):
    d = json.load(open(path, encoding='utf-8-sig'))
    return d['song'] if isinstance(d.get('song'), dict) else d


KINDS = {'Alt Animation': 'alt', 'Hey!': 'hey', 'No Animation': 'No Animation', 'GF Sing': 'gfsing',
         'Opponent 2 Sing': 'opp2', 'Both Opponents Sing': 'oppboth', 'Ghost Note': 'ghost'}

def notes_of(s):
    """Psych sections -> FNF 2 notes (0-3 you, 4-7 the opponent), the camera turns (FocusCamera), BPM changes and the
    events written into the sections the old way ([t, -1, name, v1, v2])."""
    bpm = s['bpm']; tc = [{'t': 0, 'b': 0, 'bpm': bpm, 'bt': [4, 4, 4, 4]}]
    # the remaster's own charts ('nmv2', like Psych 1.0): lanes 0-3 are always yours; the older ones: 0-3 = whoever
    # the section is about (mustHitSection)
    absolute = str(s.get('format', '')) == 'nmv2' or str(s.get('format', '')).startswith('psych_v1')
    out, ev, t, last, old_ev = [], [], 0.0, None, []
    for sec in s['notes']:
        if sec.get('changeBPM') and sec.get('bpm') and sec['bpm'] != bpm:
            bpm = sec['bpm']; tc.append({'t': round(t, 3), 'bpm': bpm, 'bt': [4, 4, 4, 4]})
        must = bool(sec.get('mustHitSection'))
        gfsec = bool(sec.get('gfSection'))
        if must != last:
            ev.append({'t': round(t, 3), 'e': 'FocusCamera', 'v': {'char': 0 if must else 1}}); last = must
        for n in sec['sectionNotes']:
            tt, lane = n[0], int(n[1])
            if lane < 0:
                if len(n) >= 3 and isinstance(n[2], str): old_ev.append((tt, n[2], n[3] if len(n) > 3 else '', n[4] if len(n) > 4 else ''))
                continue
            if lane > 7: continue
            player = (lane < 4) if absolute else (lane < 4) == must
            ln = n[2] if len(n) > 2 and isinstance(n[2], (int, float)) else 0
            q = {'t': round(tt, 3), 'd': (lane % 4) + (0 if player else 4)}
            if ln > 0: q['l'] = round(ln, 3)
            k = n[3] if len(n) > 3 and isinstance(n[3], str) else ''
            if k and k in KINDS: q['k'] = KINDS[k]
            elif k: q['k'] = k
            if gfsec and not player and 'k' not in q: q['k'] = 'gfsing'
            if sec.get('altAnim') and not player and 'k' not in q: q['k'] = 'alt'
            out.append(q)
        t += (sec.get('sectionBeats') or sec.get('lengthInSteps', 16) / 4) * 60000 / bpm
    out.sort(key=lambda q: (q['t'], q['d']))
    dd, seen = [], set()
    for q in out:
        k = (round(q['t']), q['d'])
        if k not in seen: seen.add(k); dd.append(q)
    return dd, ev, tc, old_ev


def events_of(*songs):
    """Psych 'events' lists ([t, [[name, v1, v2], ...]] or the old [t, name, v1, v2]) -> FNF 2 events, each once."""
    out, seen = [], set()
    def add(t, name, v1, v2):
        k = (round(float(t), 1), name, str(v1), str(v2))
        if k in seen or not name: return
        seen.add(k); out.append({'t': round(float(t), 3), 'e': name, 'v': {'value1': '' if v1 is None else str(v1), 'value2': '' if v2 is None else str(v2)}})
    for s in songs:
        for e in s.get('events') or []:
            if len(e) >= 2 and isinstance(e[1], list):
                for x in e[1]: add(e[0], x[0], x[1] if len(x) > 1 else '', x[2] if len(x) > 2 else '')
            elif len(e) >= 2: add(e[0], e[1], e[2] if len(e) > 2 else '', e[3] if len(e) > 3 else '')
    return out


def easier(notes, bpm_changes, level):
    """NORMAL / EASY from the mod's chart: only YOUR side gets thinned (the opponents still sing every note, their
    double notes make the chord ghosts). Thinned per tempo (the beat grid moves at every BPM change)."""
    from nene import thin
    mine = [q for q in notes if q['d'] < 4]; theirs = [q for q in notes if q['d'] >= 4]
    kept = []
    for i, c in enumerate(bpm_changes):
        end = bpm_changes[i + 1]['t'] if i + 1 < len(bpm_changes) else 1e12
        seg = [dict(q, t=q['t'] - c['t']) for q in mine if c['t'] <= q['t'] < end]
        kept += [dict(q, t=round(q['t'] + c['t'], 3)) for q in thin(seg, c['bpm'], level)]
    return sorted(kept + theirs, key=lambda q: (q['t'], q['d']))


# ---------------------------------------------------------------- stages
# Each stage = the sprites its script's onLoad adds (behind the characters, in that order) + the ones onCreatePost
# adds (in front), as FNF 2 props. Psych/Flixel rules: setGraphicSize / scale.set without updateHitbox scale the
# picture around its middle, the x,y stay where the unscaled picture's corner was; zIndex sorts (default 0, ties keep
# the order they were added in).
def prop(name, img, x, y, scroll=(1, 1), scale=1.0, hitbox=False, alpha=1.0, z=0, anims=None, start=None, blend=None, flip=False, extra=None):
    return dict(name=name, img=img, x=x, y=y, scroll=scroll, scale=scale, hitbox=hitbox, alpha=alpha, z=z, anims=anims, start=start, blend=blend, flip=flip, extra=extra or {})

STAGES = {
    'polus': dict(
        zoom=0.75, bf=(870, -150), gf=(300, -120), dad=(0, -150), cams=((470, 250), (820, 250)),
        back=[
            prop('sky', 'stages/polus/red/polus_custom_sky', -400, -400, (0.5, 0.5), 1.4),
            prop('rocks', 'stages/polus/red/polusrocks', -700, -300, (0.6, 0.6)),
            prop('hills', 'stages/polus/red/polusHills', -1050, -180.55, (0.9, 0.9)),
            prop('warehouse', 'stages/polus/red/polus_custom_lab', 50, -400),
            prop('ground', 'stages/polus/red/polus_custom_floor', -1350, 80),
            prop('speaker', 'stages/polus/red/speakerlonely', 300, 185, alpha=0, anims=[('bop', 'speakers lonely', 24, False)], start='bop'),
            prop('bfdead', 'stages/polus/red/bfdead', 600, 525, scale=0.8, hitbox=True, alpha=0),
        ],
        front=[
            prop('crowd', 'stages/polus/red/boppers_meltdown', -900, 150, (1.5, 1.5), 0.9, alpha=0,
                 anims=[('bop', 'BoppersMeltdown', 24, False)], start='bop'),
        ],
        files=['stages/polus/snow_particles'],
    ),
}


def stage(pack, sid):
    S = STAGES[sid]
    from PIL import Image
    from repack_sparrow import frames_of
    props, order = [], 0
    def add(pr, front):
        nonlocal order
        img = pr['img']
        kind = copy_image(pack, img)
        if kind == 'sparrow':
            f0 = frames_of(open(M('images', img + '.xml'), encoding='utf-8-sig').read())[0]; fw, fh = f0['fw'], f0['fh']
        elif kind == 'image':
            fw, fh = Image.open(M('images', img + '.png')).size
        else: fw = fh = 0
        s = pr['scale']; x, y = pr['x'], pr['y']
        if s != 1 and not pr['hitbox']:      # scaled around its middle, the corner didn't move
            x -= fw * (s - 1) / 2; y -= fh * (s - 1) / 2
        q = {'name': pr['name'], 'assetPath': '%s/%s' % (NS, img), 'position': [round(x, 2), round(y, 2)], 'scale': [s, s],
             'scroll': list(pr['scroll']), 'alpha': pr['alpha'],
             # behind the characters: 0..; the characters: 500/510/520 (gf, dad, bf); in front: 1000 + the zIndex
             'zIndex': (pr['z'] * 1000 + 1000 + order) if front else (pr['z'] * 1000 + order)}
        if pr['anims']:
            q['animations'] = [{'name': a[0], 'prefix': a[1], 'frameRate': a[2], 'looped': a[3]} for a in pr['anims']]
            if pr['start']: q['startingAnimation'] = pr['start']
            if kind == 'atlas': q['animType'] = 'animateatlas'
        if pr['blend']: q['blend'] = pr['blend']
        if pr['flip']: q['flipX'] = True
        q.update(pr['extra'])
        props.append(q); order += 1
    for pr in S['back']: add(pr, False)
    for pr in S.get('front', []): add(pr, True)
    for img in S.get('files', []): copy_image(pack, img)
    (dx, dy), (bx, by) = S['cams']
    chars = {'gf': {'zIndex': 500, 'position': list(S['gf']), 'raw': list(S['gf']), 'scroll': [0.95, 0.95]},
             'dad': {'zIndex': 510, 'position': list(S['dad']), 'raw': list(S['dad']), 'camera': [dx, dy]},
             'bf': {'zIndex': 520, 'position': list(S['bf']), 'raw': list(S['bf']), 'camera': [bx, by]}}
    pack.dump({'version': '1.0.0', 'name': 'VS Impostor: ' + sid, 'cameraZoom': S['zoom'], 'directory': 'shared', 'props': props,
               'characters': chars, 'impostor': {'stage': sid}}, 'preload', 'data', 'stages', P + sid + '.json')
    return P + sid


# ---------------------------------------------------------------- the talk (scripts/dialogue.hx)
def dialogue(pack, sid, fname='dialogue.txt'):
    p = M('songs', sid, fname)
    if not os.path.exists(p): return None
    lines = []
    for raw in open(p, encoding='utf-8-sig').read().splitlines():
        raw = raw.strip()
        if not raw.startswith(':'): continue
        parts = raw.split(':')
        who, emote = parts[1], parts[2]
        text = raw[len(who) + len(emote) + 3:].strip()
        if 'dialogue_' in text: text = lang(text)
        lines.append([who, emote, text])
        talker(pack, who)
    mus = M('music', 'dialogue', sid + '.ogg')
    if os.path.exists(mus): pack.put(mus, 'preload', 'music', NS, 'dialogue', sid + '.ogg')
    return lines


DONE_TALKERS = set()
def talker(pack, who):
    """A talking portrait (data/dialogue/<who>.json + ui/dialogue/characters/<asset>) + its typing sound."""
    if who in DONE_TALKERS: return
    DONE_TALKERS.add(who)
    p = M('data', 'dialogue', who + '.json')
    if not os.path.exists(p): print('   (no talker', who + ')'); return
    tj = json5(p)
    tj['label'] = lang(tj['name'], tj['name'])
    pack.dump(tj, 'preload', 'data', NS, 'talkers', who + '.json')
    copy_image(pack, 'ui/dialogue/characters/' + tj['asset'])
    snd = M('sounds', 'dialogue', tj.get('sound', '') + '.ogg')
    if os.path.exists(snd): pack.put(snd, 'preload', 'sounds', NS, 'dialogue', tj['sound'] + '.ogg')
    if tj.get('icon'): icon(pack, tj['icon'])


def video(pack, rel):
    """videos/<rel>.mp4 -> videos/videos/impostor/<rel>.webm (+ its captions in the talk data)."""
    src = M('videos', rel + '.mp4')
    if not os.path.exists(src): print('   (no video', rel + ')'); return None
    webm(src, pack.path('videos', 'videos', NS, rel + '.webm'))
    cap = srt(M('videos', rel + '.srt'))
    if cap: pack.dump(cap, 'preload', 'data', NS, 'captions', rel.replace('/', '_') + '.json')
    return rel


# ---------------------------------------------------------------- the weeks
# per song: what the scripts swap in or show besides the chart's characters, its videos, talk files
WEEKS = {
    'w1': dict(pack='impostor-w1', level='imp-week1', week='week1', title='POLUS PROBLEMS', color='#FF2A2A',
               songs={
                   'sussus-moogus': dict(stage='polus', videos=['week1/sussus-moogus'], talk='dialogue.txt'),
                   'sabotage': dict(stage='polus', videos=['week1/sabotage'], talk='dialogue.txt'),
                   'meltdown': dict(stage='polus', videos=['week1/meltdown', 'week1/meltdownEnd', 'week1/post-week1'], talk='dialogue.txt'),
               }),
}
SHARED_CHARS = {'bf', 'gf'}


def song(pack, core, sid, spec, week):
    s = chart(M('songs', sid, 'data', 'normal.json'))
    extra = []
    ep = M('songs', sid, 'data', 'events.json')
    if os.path.exists(ep): extra.append(chart(ep))
    hard, cam, tc, old_ev = notes_of(s)
    evs = events_of(s, *extra)
    for t, n, v1, v2 in old_ev: evs.append({'t': round(t, 3), 'e': n, 'v': {'value1': str(v1), 'value2': str(v2)}})
    events = sorted(cam + evs, key=lambda e: e['t'])
    # characters: the chart's, the ones Change Character events want
    def ch(cid):
        if not cid: return ''
        return character(core if cid in SHARED_CHARS else pack, cid) or ''
    player, opp = ch(s.get('player1') or 'bf'), ch(s.get('player2') or 'red')
    gfid = ch(s.get('gfVersion') or s.get('player3') or 'gf')
    opp2 = ch(s.get('player4')) if s.get('player4') else ''
    for e in events:
        if e['e'] == 'Change Character': ch(e['v']['value2'].strip())
    for c in spec.get('chars', []): ch(c)
    notes = {'easy': easier(hard, tc, 'easy'), 'normal': easier(hard, tc, 'normal'), 'hard': hard}
    sp = s.get('speed', 2.5)
    speeds = {'default': sp, 'easy': round(sp * 0.85, 2), 'normal': round(sp * 0.92, 2), 'hard': sp}
    info = {}
    ip = M('songs', sid, 'info.txt')
    if os.path.exists(ip):
        lines = [l.strip() for l in open(ip, encoding='utf-8-sig').read().splitlines() if l.strip()]
        name = lines[0] if lines else sid
        for l in lines[1:]:
            k, _, v = l.partition(':')
            info[k.strip().lower()] = v.strip()
    else: name = s.get('song', sid)
    pack.put(M('songs', sid, 'Inst.ogg'), 'songs', sid, 'Inst.ogg')
    pv = []
    if os.path.exists(M('songs', sid, 'Voices.ogg')):
        pack.put(M('songs', sid, 'Voices.ogg'), 'songs', sid, 'Voices-%s.ogg' % opp)
    # (one voice track for both singers, like old FNF: it goes quiet when you miss)
    rt = spec.get('ratings', (3, 5, 7))
    meta = {'version': '2.2.4', 'songName': name, 'artist': info.get('composer', ''), 'charter': info.get('charters', info.get('charter', '')),
            'offsets': {}, 'playData': {'difficulties': ['easy', 'normal', 'hard'],
            'characters': {'player': player, 'girlfriend': gfid, 'opponent': opp, 'playerVocals': pv, 'opponentVocals': [opp]},
            'stage': P + spec['stage'], 'noteStyle': 'funkin', 'album': 'impostor', 'ratings': dict(zip(('easy', 'normal', 'hard'), rt)),
            'previewStart': spec.get('preview', (20000, 35000))[0], 'previewEnd': spec.get('preview', (20000, 35000))[1]},
            'timeChanges': tc, 'generatedBy': 'FNF 2 - tools/own/impostor.py (VS IMPOSTOR: LEGACY)'}
    if opp2: meta['playData']['characters']['opponent2'] = opp2
    pack.dump(meta, 'preload', 'data', 'songs', sid, sid + '-metadata.json')
    pack.dump({'version': '2.0.0', 'scrollSpeed': speeds, 'events': events, 'notes': notes, 'generatedBy': meta['generatedBy']},
              'preload', 'data', 'songs', sid, sid + '-chart.json')
    # what src/47-impostor.js needs: the talk, the videos + their captions, the song's script switches
    data = {'week': week, 'stage': spec['stage']}
    if spec.get('talk'):
        t = dialogue(pack, sid, spec['talk'])
        if t: data['talk'] = t
    data['videos'] = [v for v in (video(pack, v) for v in spec.get('videos', [])) if v]
    pack.dump(data, 'preload', 'data', NS, 'songs', sid + '.json')
    cnt = {k: sum(1 for q in v if q['d'] < 4) for k, v in notes.items()}
    print('  ', sid, name, [c['bpm'] for c in tc], 'bpm, your notes', cnt, 'speed', sp, ',', len(events), 'events', ', chars', player, opp, gfid, opp2)
    return sid


def core_pack():
    core = Pack('impostor')
    for c in SHARED_CHARS: character(core, c)
    # the talk box (scripts/dialogue.hx): box (RGB coloured), bubble, fonts, sounds
    for f in ('dialogueBox.png', 'bubble.png'): core.put(M('images', 'ui', 'dialogue', f), 'shared', 'images', NS, 'ui', 'dialogue', f)
    for f in ('liber.ttf', 'liberbold.ttf'): core.put(M('fonts', f), 'fonts', 'mods', f)
    for f in ('clickText.ogg', 'panelAppear.ogg', 'panelDisappear.ogg', 'fnf_loss_sfx.ogg', 'intro1.ogg', 'intro2.ogg', 'intro3.ogg', 'introGo.ogg',
              'missnote1.ogg', 'missnote2.ogg', 'missnote3.ogg'):
        core.put(M('sounds', f), 'preload', 'sounds', NS, f)
    for f in ('gameOver.ogg', 'gameOverEnd.ogg', 'breakfast.ogg'):
        core.put(M('music', f), 'preload', 'music', NS, f)
    # the HUD pictures (Psych's: ratings, numbers, countdown, the time bar)
    for f in ('sick.png', 'good.png', 'bad.png', 'shit.png', 'epic.png', 'combo.png', 'ready.png', 'set.png', 'go.png', 'timeBar.png') + tuple('num%d.png' % i for i in range(10)):
        if os.path.exists(M('images', f)): core.put(M('images', f), 'shared', 'images', NS, 'hud', f)
    return core


def week(wid):
    W = WEEKS[wid]
    print('==', wid, W['title'])
    core = CORE
    pack = Pack(W['pack'])
    for sid in {spec['stage'] for spec in W['songs'].values()}: stage(pack, sid)
    ids = [song(pack, core, sid, spec, wid) for sid, spec in W['songs'].items()]
    wj = json5(M('data', 'weeks', W['week'] + '.json'))
    pack.dump({'version': '1.0.0', 'name': wj.get('storyName', W['title']), 'titleAsset': 'storymenu/titles/' + W['level'], 'visible': True,
               'props': [], 'background': W['color'], 'songs': ids, 'capsule': {'name': 'VS IMPOSTOR'}}, 'preload', 'data', 'levels', W['level'] + '.json')
    title_png(pack, W['level'], wj.get('weekName', '') + ': ' + wj.get('storyName', W['title']))
    print('   ', pack.id, pack.n, 'files')


def title_png(pack, level, text):
    """The story menu week title (FNF's are white letters with a soft dark outline)."""
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    font = ImageFont.truetype(M('fonts', 'liberbold.ttf'), 62)
    text = text.upper()
    w = int(font.getlength(text)) + 30
    im = Image.new('RGBA', (w, 90), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((15, 10), text, font=font, fill=(255, 255, 255, 255), stroke_width=4, stroke_fill=(40, 20, 60, 255))
    im.save(pack.path('preload', 'images', 'storymenu', 'titles', level + '.png'))


CORE = None
def main():
    global CORE
    want = sys.argv[1:] or list(WEEKS)
    CORE = core_pack()
    for wid in want: week(wid)
    print('core', CORE.n, 'files')


if __name__ == '__main__':
    main()
