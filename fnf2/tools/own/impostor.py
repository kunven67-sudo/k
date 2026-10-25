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


PACKS = []
def pack_of(pid):
    for pk in PACKS:
        if pk.id == pid: return pk
    return Pack(pid)

class Pack:
    def __init__(self, pid):
        self.id = pid; self.root = os.path.join(MODS_OUT, pid); self.n = 0; self.wrote = set()
        PACKS.append(self)
    def path(self, *p):
        f = os.path.join(self.root, *p); os.makedirs(os.path.dirname(f), exist_ok=True); self.wrote.add(os.path.normpath(f)); return f
    def prune(self):
        """Deletes what an older run left here that this run didn't make (moved to another pack, renamed...)."""
        gone = 0
        for d, _, fs in os.walk(self.root):
            for n in fs:
                f = os.path.normpath(os.path.join(d, n))
                if f not in self.wrote: os.remove(f); gone += 1
        if gone: print('   %s: %d old files removed' % (self.id, gone))
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
    """A cutscene video as WebM (VP9 + Opus) at most 720 px high: plays in every browser, the mod's mp4s are H.264.
    Above 60 fps it's brought down to 60 (Sussus Toogus' video is 120 fps: twice the decoding for nothing on a phone)."""
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src],
                       capture_output=True, text=True).stdout.strip() or '30/1'
    n, _, d = r.partition('/'); fps = float(n) / float(d or 1)
    vf = "scale=-2:'min(%d,ih)'" % height + (',fps=60' if fps > 60.5 else '')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0',
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
    """The health icon 'name' (the mod's icons/icon-<name>.png, any case) -> preload/images/icons/icon-imp-<name>.png,
    + a freeplay pixel icon made from it (FNF's: tiny pixel art in a 50x50 frame the game doubles, a 1 px black line)."""
    if not name: return None
    want = ('icon-' + name + '.png').lower()
    for f in os.listdir(M('images', 'icons')):
        if f.lower() == want:
            pack.put(M('images', 'icons', f), 'preload', 'images', 'icons', 'icon-' + P + name + '.png')
            if f.endswith('.png') and os.path.exists(M('images', 'icons', f[:-4] + '.xml')):
                pack.put(M('images', 'icons', f[:-4] + '.xml'), 'preload', 'images', 'icons', 'icon-' + P + name + '.xml')
            pixel_icon(pack, M('images', 'icons', f), P + name)
            return P + name
    return None


def pixel_icon(pack, src, cid):
    from PIL import Image, ImageFilter
    dst = pack.path('preload', 'images', 'freeplay', 'icons', cid + 'pixel.png')
    if os.path.exists(dst): return
    im = Image.open(src).convert('RGBA'); im = im.crop((0, 0, min(150, im.width), im.height))
    bb = im.getchannel('A').getbbox() or (0, 0, im.width, im.height)
    im = im.crop(bb); k = 38 / max(im.size)
    px = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    a = px.getchannel('A').point(lambda v: 255 if v > 110 else 0); px.putalpha(a)
    frame = Image.new('RGBA', (50, 50), (0, 0, 0, 0)); frame.paste(px, ((50 - px.width) // 2, 50 - px.height - 3), px)
    ring = frame.getchannel('A').filter(ImageFilter.MaxFilter(3))
    under = Image.new('RGBA', (50, 50), (0, 0, 0, 255)); under.putalpha(ring)
    Image.alpha_composite(under, frame).save(dst)


def num(v):
    """a number for the json: whole ones stay whole (-12, not -12.0)"""
    r = round(v, 3); return int(r) if r == int(r) else r


def anim_list(cj, img_kind, extra_offset=(0, 0), asset=None, div=1):
    """div: the character's scale. FNF 2 draws the offsets x the scale, the mod's engine doesn't (scalableOffsets only
    counts when the scale changes from the json's own): so they go in divided by it."""
    out = []
    for a in cj['animations']:
        name = a['anim']
        if name.endswith('-loop'): name = name[:-5] + '-hold'          # (Psych 1.0 '-loop' follow-ups = FNF's '-hold')
        an = {'name': name, 'prefix': a['name'], 'frameRate': a.get('fps', 24), 'looped': bool(a.get('loop')),
              'offsets': [num((a['offsets'][0] - extra_offset[0]) / div), num((a['offsets'][1] - extra_offset[1]) / div)]}
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
    pos = cj.get('position', [0, 0])
    d = {'version': '1.0.0', 'name': cid, 'renderType': 'animateatlas' if kind == 'atlas' else 'sparrow',
         'assetPath': 'shared:%s/%s' % (NS, cj['image']), 'scale': s, 'flipX': bool(cj.get('flip_x')),
         # (x the scale when FNF 2 draws them: the mod puts them on unscaled)
         'offsets': [num(pos[0] / s), num(pos[1] / s)], 'cameraOffsets': cj.get('camera_position', [0, 0]),
         # (Character.update: back to idle after sing_duration steps: holdTimer >= stepCrotchet * 0.001 * singDuration)
         'singTime': cj.get('sing_duration', 4),
         'isPixel': bool(cj.get('no_antialiasing')),
         'animations': anim_list(cj, kind, div=s)}
    d['danceEvery'] = cj.get('dance_every', 2)       # (the template's 2 when it's missing)
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
        d['animations'] += anim_list(dj, dk, (dp[0] - bp[0], dp[1] - bp[1]), dasset, div=s)
        d['renderType'] = 'multianimateatlas' if kind == 'atlas' or dk == 'atlas' else 'multisparrow'
        if d['renderType'] == 'multianimateatlas':
            for a in d['animations']:
                if 'assetPath' not in a: a['assetPath'] = d['assetPath']
                a['renderType'] = 'animateatlas' if (atlas_dir(dj['image']) if a['assetPath'] == dasset else kind == 'atlas') else 'sparrow'
        for k in ('gameover_intial_sound', 'gameover_loop_sound', 'gameover_confirm_sound'):
            v = dj.get(k) or cj.get(k)
            if v:
                d['impostor'][k] = v
                snd = M('sounds', v + '.ogg') if k == 'gameover_intial_sound' else M('music', v + '.ogg')
                if os.path.exists(snd): pack.put(snd, 'preload', 'sounds' if k == 'gameover_intial_sound' else 'music', NS, v + '.ogg')
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
    out.sort(key=lambda q: q['t'])           # (stable: a double note keeps the chart's order, the chord ghosts use it)
    dd, seen = [], set()
    for q in out:
        k = (round(q['t']), q['d'])
        if k not in seen: seen.add(k); dd.append(q)
    return dd, ev, tc, old_ev


# (Add Camera Zoom adds to the zoom, Set Cam Zoom only sets where the zoom goes back to, Play Animation stops the
# dancing until it's done: Nightmare Vision's own)
OWN_EVENTS = {'Add Camera Zoom': 'Imp Add Zoom', 'Set Cam Zoom': 'Imp Set Zoom', 'Play Animation': 'Imp Play Anim'}

def events_of(*songs):
    """Psych 'events' lists ([t, [[name, v1, v2], ...]] or the old [t, name, v1, v2]) -> FNF 2 events, each once."""
    out, seen = [], set()
    def add(t, name, v1, v2):
        name = OWN_EVENTS.get(name, name)
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
def prop(name, img, x, y, scroll=(1, 1), scale=1.0, hitbox=False, alpha=1.0, z=0, anims=None, start=None, blend=None, flip=False, extra=None, gsize=None, indices=None, hit1=None):
    """gsize = setGraphicSize(Std.int(width * gsize)): the scale that makes, from the picture's real width.
    scale = one number or (x, y). indices = {anim: [frame numbers]} (addByIndices). img '#rrggbb' = makeGraphic (a
    block of colour, scale = its size). hit1 = the scale its last updateHitbox ran at, when it was scaled again after."""
    return dict(name=name, img=img, x=x, y=y, scroll=scroll, scale=scale, hitbox=hitbox, alpha=alpha, z=z, anims=anims, start=start, blend=blend, flip=flip, extra=extra or {}, gsize=gsize, indices=indices or {}, hit1=hit1)

# layer numbers (zIndex) the FNF 2 way: the mod's zIndex x 1000 + where it was added: the stage script's onLoad
# sprites first (0..499), then GF / the opponent / you (500 / 510 / 520), then onCreatePost's (600..). Ties keep the
# order they were added in, like the mod's stable sort.
def zkey(z, slot):
    return z * 1000 + slot

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
    # ---- MIRA HQ, the cafeteria (data/stages/toogus.hx): the walkers + the sax guy are Sussus Toogus' own (song files);
    #      the black cover for Lights Down's dark parts (loBlack, zIndex 12) is drawn by src/47-impostor.js
    'toogus': dict(
        zoom=0.9, bf=(970, 50), gf=(400, 80), dad=(29, 29), cams=((500, 475), (900, 475)), charz={'bf': 20, 'dad': 20, 'gf': 15},
        back=[
            prop('bg', 'stages/mira/cafeteria/mirabg', -207, 37, gsize=1.06),
            prop('fg', 'stages/mira/cafeteria/mirafg', -1649, 49, gsize=1.06),
            prop('bfvent', 'stages/mira/cafeteria/bf_mira_vent', 70, 200, alpha=0, anims=[('vent', 'bf vent', 24, False)]),
            prop('table', 'stages/mira/cafeteria/table_bg', -1659, 42, gsize=1.06, z=10),
            prop('ldspeaker', 'stages/mira/cafeteria/stereo_taken', 400, 385, alpha=0, z=11, anims=[('boom', 'stereo boom', 24, False)]),
        ],
    ),
    # ---- MIRA HQ, the reactor room (data/stages/reactor.hx)
    'reactor': dict(
        zoom=0.7, bf=(1950, 750), gf=(1400, 775), dad=(1100, 750), cams=((1725, 1100), (1725, 1100)),
        back=[
            prop('wall', 'stages/mira/reactor/wallbgthing', 290, 0, scale=2, hitbox=True),
            prop('floor', 'stages/mira/reactor/floornew', 0, 762),
            prop('pillarsY', 'stages/mira/reactor/yellowglita', 875, 890, anims=[('bop', 'Pillars with crewmates instance 1', 24, False)], start='bop'),
            prop('backbars', 'stages/mira/reactor/backbars', 408, 579),
            prop('pillarsB', 'stages/mira/reactor/browngeoff', 450, 995, anims=[('bop', 'Pillars with crewmates instance 1', 24, False)], start='bop'),
            prop('frontpillars', 'stages/mira/reactor/frontpillars', 58, 546),
            # (no flashing lights: only frames 25-29 of the glow)
            prop('coreGlow', 'stages/mira/reactor/coreGlow', 1150, 60, scroll=(0.95, 0.95), scale=2.7, hitbox=True,
                 anims=[('bop', 'reactor core', 24, False), ('bopSafe', 'reactor core', 24, False)], indices={'bopSafe': list(range(25, 30))}, start='bop'),
            prop('coreRing', 'stages/mira/reactor/coreRing', 1295, 212, scroll=(0.95, 0.95), scale=1.35, hitbox=True, blend='add',
                 anims=[('ring', 'reactor core ring', 24, True)], start='ring'),
            prop('coreClaw', 'stages/mira/reactor/coreClaw', 1222, 395, scroll=(0.98, 1.3)),
        ],
        front=[
            prop('lightoverlay', 'stages/mira/reactor/frontblack', 0, 0, scale=4, hitbox=True),
            prop('mainoverlay', 'stages/mira/reactor/yeahman', 750, 100, blend='add', anims=[('bop', 'Reactor Overlay Top instance 1', 24, True)], start='bop'),
        ],
    ),
    # ---- Ejected (data/stages/ejected.hx): falling past MIRA HQ. The sky + the big cloud bank are props; the
    #      buildings, the clouds rushing past and the speed lines move every frame (src/47-impostor.js)
    'ejected': dict(
        zoom=0.45, bf=(1008.6, 504), gf=(114.4, 78.45), dad=(-1225.75, 440), cams=None, gfScroll=(0.7, 0.7),
        back=[
            prop('sky', 'stages/mira/ejected/sky', -2372.25 + 1000, -4181.7 + 656 * 5, scroll=(0, 0), scale=5, hitbox=True),
            prop('fgCloud', 'stages/mira/ejected/fgClouds', -2660.4, -402, scroll=(0.2, 0.2), scale=2, hitbox=True),
        ],
        files=['stages/mira/ejected/buildingA', 'stages/mira/ejected/buildingB', 'stages/mira/ejected/scrollingClouds', 'stages/mira/ejected/speedLines'],
        extra={'falling': True},
    ),
    # ---- the Airship, Yellow's room (data/stages/airship.hx): nine layers, all x2. White sweats in the corner (gone
    #      in Oversight, where Yellow's body lies there instead). (The Henry Teleporter, story mode Mando / D'low,
    #      comes with week 9: clicking it leads there.)
    'airship': dict(
        zoom=0.6, bf=(700, 110), gf=(135, 140), dad=(-220, 110), cams=((300, 500), (700, 500)),
        back=[
            prop('sky', 'stages/airship/mando/fartingSky', -1468, -995, (0.3, 0.3), 2, hitbox=True),
            prop('backSky', 'stages/airship/mando/backSkyyellow', -1125, 284, (0.4, 0.7), 2, hitbox=True),
            prop('cloud3', 'stages/airship/mando/yellow cloud 3', 1330, 283, (0.5, 0.8), 2, hitbox=True),
            prop('cloud2', 'stages/airship/mando/yellow could 2', -837, 304, (0.6, 0.9), 2, hitbox=True),
            prop('window', 'stages/airship/mando/window', -1387, -1231, scale=2, hitbox=True),
            prop('cloud1', 'stages/airship/mando/cloudYellow 1', -1541, 242, (0.8, 0.8), 2, hitbox=True),
            prop('backFloor', 'stages/airship/mando/backDlowFloor', -642, 325, (0.9, 1), 2, hitbox=True),
            prop('floor', 'stages/airship/mando/DlowFloor', -2440, 336, scale=2, hitbox=True),
            prop('glow', 'stages/airship/mando/glowYellow', -1113, -1009, scale=2, hitbox=True, blend='add'),
            prop('whiteAwkward', 'stages/airship/mando/white_awkward', 298, 550,
                 anims=[('sweat', 'fetal position', 6, True), ('stare', 'white stare', 24, False)], start='sweat'),
            prop('deadbody', 'stages/airship/mando/YELLOW', -400, 620, alpha=0),
        ],
    ),
    # ---- Danger (data/stages/danger.hx): running on top of the Airship. The clouds, the platform you run on and the
    #      speed lines are endless strips (FlxBackdrop: 'backdrop' = the gap between the copies) scrolling left every
    #      frame (src/47-impostor.js); the big cloud drifts by, the scream sky flashes when Black screams.
    #      (zoom: the stage says 2, the script .3: the camera starts at 2 and eases out once Black sings)
    'danger': dict(
        zoom=0.3, bf=(1645, -120), gf=(850, -90), dad=(500, -130), cams=((1634.05, -54.3), (1734.05, -54.3)), charz={'gf': 3, 'bf': 6, 'dad': 9},
        back=[
            # (the sky gradient + the pale band under the far clouds go further left than the mod's: a phone's screen is
            #  wider, they ended inside it; the right ends stay where they were, so a PC sees the same)
            prop('sky', 'stages/airship/danger/sky', -3500, -897.55, (0, 0), (700, 6), hitbox=True),
            prop('farCloudBg', '#C0DBFF', -3000, -142.2 + 126 * 2 - 1, (0.1, 0.1), (4500, 1200)),
            prop('farClouds', 'stages/airship/danger/farthestClouds', 3385.95, -142.2, (0.1, 0.1), 2, hitbox=True, extra={'backdrop': -2}),
            prop('midClouds', 'stages/airship/danger/backClouds', 3352.4, 76.55, (0.2, 0.2), 2, hitbox=True, extra={'backdrop': -2}),
            prop('airship', 'stages/airship/danger/airship', 1114.75, -873.05, (0.25, 0.25), 2, hitbox=True),
            prop('fan', 'stages/airship/danger/airshipFan', 2285.4, 102, (0.27, 0.27), anims=[('idle', 'ala avion instance 1', 24, True)], start='idle'),
            prop('bigCloud', 'stages/airship/danger/bigCloud', 3507.15, -744.2, (0.4, 0.4), 2, hitbox=True),
            prop('closeClouds', 'stages/airship/danger/frontClouds', 6092.2, 422.15, (0.3, 0.3), 2, hitbox=True, extra={'backdrop': -3}),
            prop('screamsky', 'stages/airship/danger/screamsky', 0, -200, scale=12, hit1=4, alpha=0, anims=[('bop', 'scream sky', 24, False)]),
            prop('platform', 'stages/airship/danger/fgPlatform', -7184.8, 282.25, scale=2, hitbox=True, extra={'backdrop': 0}),
            # (GF's speaker on wheels, right behind her)
            prop('gfBoard', 'stages/airship/danger/dangerboards', 850, 550, z=2, anims=[('bop', 'speakerwheel', 24, True)], start='bop'),
        ],
        front=[
            # (added after the characters but on layer 0 like the rest: in front of the platform, behind everyone)
            prop('speedlines', 'stages/airship/danger/speedlines', -3352.1, -1035.95, (1.3, 1.3), alpha=0.2, extra={'backdrop': 1}),
        ],
        extra={'startZoom': 2},
    ),
    # ---- Double Kill, the cargo hold (data/stages/cargo.hx + songs/double-kill/double-kill.hx). Black sings from GF's
    #      spot. The black cover for the dark parts is on layer 0 (behind everyone); the two light overlays are over
    #      everyone (subtract .51, add .6). The song's own pictures (the airship flashback, the defeat glow, the black
    #      cover over everything) are made in src/47-impostor.js
    'cargo': dict(
        zoom=0.8, bf=(2550, 650), gf=(1550, 600), dad=(1250, 680), cams=((2000, 1050), (2300, 1050)),
        back=[
            prop('bg', 'stages/airship/double-kill/cargo', 0, 0, scale=2, hitbox=True),
            prop('cargoDark', '#000000', -1000, -1000, (0, 0), (1280 * 3, 720 * 3), alpha=0.001),
        ],
        front=[
            prop('mainoverlay', 'stages/airship/double-kill/newoverlay1', 1000, 350, scale=(1.8, 1.6), hitbox=True, alpha=0.51, extra={'blendMode': 'subtract'}),
            prop('lightoverlay', 'stages/airship/double-kill/newoverlay2', 1000, 350, scale=(1.8, 1.6), hitbox=True, alpha=0.6, blend='add'),
        ],
        files=['stages/airship/double-kill/airshipFlashback', 'stages/void/iluminao omaga'],
    ),
    # ---- Defeat, the void (data/stages/defeat.hx): the DEFEAT letters pulse, the bodies + the edge glows show up when
    #      BF gets scared (Defeat Fade), the old V1 look for the flashback part (Defeat Retro); the red screen at the
    #      end + Black's kill before the game over are in src/47-impostor.js. No GF; Black in front of BF.
    'defeat': dict(
        zoom=0.6, bf=(994, 106), gf=(400, 100), dad=(210, 100), cams=((750, 500), (750, 500)), charz={'dad': 1, 'bf': 0},
        frames={'stages/void/deadBG': ('stages/void/props', 'deadBG'), 'stages/void/deadFG': ('stages/void/props', 'deadFG')},
        back=[
            prop('defeatthing', 'stages/void/defeatpulse', 225, 380, (0.8, 0.8), gsize=4, alpha=0.4),
            prop('old_defeat', 'stages/void/defeatfnf', 250, 125, gsize=2, alpha=0),
            prop('bodies2', 'stages/void/idontknwo', -500, 50, (0.5, 0.5), gsize=1.3, alpha=0),
            prop('bodies', 'stages/void/deadBG', -4800, -900, (0.9, 0.9), gsize=1.3, hit1=5, alpha=0),
            prop('edgeglow1', 'stages/void/edgeglow', -1000, -720, (0, 0), 1.6, hitbox=True, blend='add', z=4, alpha=0),
            prop('edgeglow2', 'stages/void/edgeglow', -1000, 720, (0, 0), 1.6, hitbox=True, blend='add', z=4, alpha=0),
            prop('subtract', 'stages/void/subtract', -700, -500, (0, 0), 4, hitbox=True, z=2, alpha=0, extra={'blendMode': 'subtract'}),
        ],
        front=[
            prop('bodiesfront', 'stages/void/deadFG', -3770, -250, (1.5, 1.2), gsize=1.5, hit1=5, z=2, alpha=0),
            prop('lightoverlay', 'stages/void/iluminao omaga', -500, -200, scale=4, hitbox=True, blend='add', z=3, alpha=0.6),
        ],
    ),
    # ---- Finale (data/stages/finalem.hx): the void + its light first, the flashbacks of weeks 1-3 over the camera, then
    #      at the drop the ruined room (BG + FG) comes in and Black turns into the parasite. Black in front of BF, the
    #      room's front bits in front of both. The black bars, the black over everything at the start, the flashback
    #      fades are in src/47-impostor.js.
    'finalem': dict(
        zoom=0.8, bf=(1250, 540), gf=(1000, 100), dad=(0, 530), cams=((750, 800), (750, 800)), charz={'dad': 1, 'bf': 0},
        frames={'stages/void/finale/' + n: ('stages/void/finale/props', n) for n in ('bg', 'dark', 'dead', 'fore', 'lamp', 'splat')},
        back=[
            prop('defeatthing', 'stages/void/finale/defeat', -400, 2000, (0.8, 0.8), gsize=1.3),
            prop('mainoverlayDK', 'stages/void/defeatfnf', 250, 475, gsize=4, hit1=4, alpha=0),
            prop('bg0', '#0D0A1B', -600, -400, scale=(3000, 2000), alpha=0),
            prop('bg1', 'stages/void/finale/dead', 800, -270, (0.8, 0.8), 1.3, alpha=0),
            prop('bg2', 'stages/void/finale/bg', -790, -530, (0.9, 0.9), 1.3, alpha=0),
        ],
        front=[
            prop('splat', 'stages/void/finale/splat', 370, 1200, scale=1.3, z=2, alpha=0),
            prop('lamp', 'stages/void/finale/lamp', 990, -380, scale=1.3, z=2, alpha=0),
            prop('fore', 'stages/void/finale/fore', -750, 160, scale=1.3, z=2, alpha=0),
            prop('dark', 'stages/void/finale/dark', -950, -160, scale=1.3, blend='multiply', z=2, alpha=0),
            prop('finaleLight', 'stages/void/finale/light', -230, -200, (0.8, 0.8), 4.4, hit1=4, blend='add', z=2, alpha=0,
                 anims=[('bop', 'light', 24, False)], start='bop'),
            prop('flashback', 'stages/void/finale/finaleFlashback', -290, -160, (0, 0), gsize=1.6, z=3, alpha=0,
                 anims=[('moog', 'finaleFlashback moog', 24, False), ('toog', 'finaleFlashback toog', 24, False), ('doog', 'finaleFlashback doog', 24, False)], start='moog'),
            prop('lightoverlay', 'stages/void/iluminao omaga', -550, 250, scale=4, hitbox=True, blend='add', z=4),
        ],
        extra={'startZoom': 0.4},
    ),
}


FRAME_DIR = os.path.join(ROOT, 'build', 'cache', 'impostor-frames')
def sheet_frame(sheet, frame):
    """loadFromSheet(sheet, frame): that one frame (its whole frame box) as its own picture -> its file"""
    from PIL import Image
    from repack_sparrow import frames_of
    out = os.path.join(FRAME_DIR, sheet + '-' + frame + '.png')
    src = M('images', sheet + '.png')
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src): return out
    fr = [f for f in frames_of(open(M('images', sheet + '.xml'), encoding='utf-8-sig').read()) if f['name'].rstrip('0123456789') == frame or f['name'] == frame][0]
    im = Image.open(src).convert('RGBA')
    x, y, w, h = int(fr['x']), int(fr['y']), int(fr['width']), int(fr['height'])
    cut = im.crop((x, y, x + w, y + h))
    if fr['rot']: cut = cut.transpose(Image.ROTATE_90)
    full = Image.new('RGBA', (int(fr['fw']), int(fr['fh'])), (0, 0, 0, 0)); full.paste(cut, (int(fr['fx']), int(fr['fy'])))
    os.makedirs(os.path.dirname(out), exist_ok=True); full.save(out)
    return out


def stage(pack, sid):
    S = STAGES[sid]
    from PIL import Image
    from repack_sparrow import frames_of
    props, order = [], 0
    frames = S.get('frames', {})          # (picture name -> (sheet, frame): a frame of a sheet on its own)
    def add(pr, front):
        nonlocal order
        img = pr['img']
        if img.startswith('#'):          # (makeGraphic + setGraphicSize: a block of colour that size)
            w, h = pr['scale']
            q = {'name': pr['name'], 'assetPath': img, 'position': [pr['x'], pr['y']], 'scale': [w, h], 'scroll': list(pr['scroll']),
                 'alpha': pr['alpha'], 'zIndex': zkey(pr['z'], 600 + order if front else order)}
            q.update(pr['extra']); props.append(q); order += 1
            return
        if img in frames:
            src = sheet_frame(*frames[img]); pack.put(src, 'shared', 'images', NS, img + '.png'); kind = 'image'
            fw, fh = Image.open(src).size
        else: kind = copy_image(pack, img)
        if img in frames: pass
        elif kind == 'sparrow':
            f0 = frames_of(open(M('images', img + '.xml'), encoding='utf-8-sig').read())[0]; fw, fh = f0['fw'], f0['fh']
        elif kind == 'image':
            fw, fh = Image.open(M('images', img + '.png')).size
        else: fw = fh = 0
        sc = pr['scale']; sx, sy = sc if isinstance(sc, (tuple, list)) else (sc, sc); x, y = pr['x'], pr['y']
        if pr['gsize'] and fw: sx = sy = int(fw * pr['gsize']) / fw
        # scaled around its middle: the corner only stays put where its last updateHitbox was (FNF 2 puts the corner)
        h1 = pr['hit1'] if pr['hit1'] is not None else ((sx, sy) if pr['hitbox'] else (1, 1))
        h1x, h1y = h1 if isinstance(h1, (tuple, list)) else (h1, h1)
        if fw: x += fw * (h1x - sx) / 2; y += fh * (h1y - sy) / 2
        q = {'name': pr['name'], 'assetPath': '%s/%s' % (NS, img), 'position': [round(x, 2), round(y, 2)], 'scale': [sx, sy],
             'scroll': list(pr['scroll']), 'alpha': pr['alpha'],
             'zIndex': zkey(pr['z'], 600 + order if front else order)}
        if pr['anims']:
            q['animations'] = [dict({'name': a[0], 'prefix': a[1], 'frameRate': a[2], 'looped': a[3]},
                                    **({'frameIndices': pr['indices'][a[0]]} if a[0] in pr['indices'] else {})) for a in pr['anims']]
            if pr['start']: q['startingAnimation'] = pr['start']
            if kind == 'atlas': q['animType'] = 'animateatlas'
        if pr['blend']: q['blend'] = pr['blend']
        if pr['flip']: q['flipX'] = True
        q.update(pr['extra'])
        props.append(q); order += 1
    for pr in S['back']: add(pr, False)
    for pr in S.get('front', []): add(pr, True)
    for img in S.get('files', []): copy_image(pack, img)
    cz = S.get('charz', {})
    chars = {'gf': {'zIndex': zkey(cz.get('gf', 0), 500), 'position': list(S['gf']), 'raw': list(S['gf']), 'scroll': list(S.get('gfScroll', (0.95, 0.95)))},
             'dad': {'zIndex': zkey(cz.get('dad', 0), 510), 'position': list(S['dad']), 'raw': list(S['dad'])},
             'bf': {'zIndex': zkey(cz.get('bf', 0), 520), 'position': list(S['bf']), 'raw': list(S['bf'])}}
    if S.get('cams'):          # (camSpecialThing: the camera's fixed spots; without them it follows the characters)
        (dx, dy), (bx, by) = S['cams']; chars['dad']['camera'] = [dx, dy]; chars['bf']['camera'] = [bx, by]
    imp = {'stage': sid}
    imp.update(S.get('extra', {}))
    pack.dump({'version': '1.0.0', 'name': 'VS Impostor: ' + sid, 'cameraZoom': S['zoom'], 'directory': 'shared', 'props': props,
               'characters': chars, 'impostor': imp}, 'preload', 'data', 'stages', P + sid + '.json')
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
SHARED_TALKERS = ('bf', 'gf')        # (they talk in every week: in the shared pack, so a week never loads another week)
def talker(pack, who):
    """A talking portrait (data/dialogue/<who>.json + ui/dialogue/characters/<asset>) + its typing sound."""
    if who in DONE_TALKERS: return
    DONE_TALKERS.add(who)
    if who in SHARED_TALKERS: pack = CORE
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
    'w1': dict(pack='impostor-w1', level='imp-week1', week='week1', title='POLUS PROBLEMS', color='#E2253A', portrait='red',
               songs={
                   'sussus-moogus': dict(stage='polus', videos=['week1/sussus-moogus'], talk='dialogue.txt', ratings=(2, 3, 5)),
                   'sabotage': dict(stage='polus', videos=['week1/sabotage'], talk='dialogue.txt', ratings=(2, 4, 6)),
                   'meltdown': dict(stage='polus', videos=['week1/meltdown', 'week1/meltdownEnd', 'week1/post-week1'], talk='dialogue.txt', ratings=(3, 5, 7)),
               }),
    'w2': dict(pack='impostor-w2', level='imp-week2', week='week2', title='MIRA MANIA', color=None, portrait='green',
               songs={
                   # (the walkers + the sax guy: songs/sussus-toogus/script.hx; the sax guy's 8154 x 5444 sheet is
                   #  packed at 75 %: drawn bigger to match, it stays sharp at the game's size)
                   'sussus-toogus': dict(stage='toogus', videos=['week2/sussus-toogus'], talk='dialogue.txt', ratings=(2, 4, 6),
                                         files=['stages/mira/cafeteria/walkers'], small={'stages/mira/cafeteria/cyan_toogus': 0.75}),
                   # (Lights out swaps in the dark versions: green-dark + BF's own 'dark' variant)
                   'lights-down': dict(stage='toogus', talk='dialogue.txt', chars=['green-dark', 'bf-dark'], ratings=(3, 5, 7)),
                   'reactor': dict(stage='reactor', ratings=(3, 5, 7)),
                   'ejected': dict(stage='ejected', videos=['week2/ejected'], ratings=(3, 6, 8)),
               }),
    'w3': dict(pack='impostor-w3', level='imp-week3', week='week3', title='AIRSHIP ATROCITIES', color=None, portrait='yellow',
               songs={
                   'mando': dict(stage='airship', videos=['week3/Mando'], talk='dialogue.txt', ratings=(3, 5, 7)),
                   # (Yellow dies at the end: her 'dead' icon stands in for the real one)
                   "d'low": dict(stage='airship', talk='dialogue.txt', icons=['yellow-dead'], ratings=(3, 6, 8)),
                   'oversight': dict(stage='airship', videos=['week3/oversight'], talk='dialogue.txt', ratings=(3, 5, 8)),
                   'danger': dict(stage='danger', videos=['week3/danger'], ratings=(4, 6, 9)),
                   # (White + Black: the icons change with who sings; BF turns into his defeat self at the end)
                   'double-kill': dict(stage='cargo', chars=['bf-defeat-normal'], icons=['double-kill', 'black', 'white'], ratings=(4, 7, 10)),
               }),
    # (Defeat + Finale: two story weeks, one pack. Before Defeat you pick how many misses you get (the dummies); dying
    #  = Black's kill first, then BF's defeat game over (1 in 10: the 'balls' one), the old V1 one in the flashback.)
    'w4': dict(pack='impostor-w4', level='imp-week4', week='week4', title='DEFEAT', color='#B300FF', portrait='black',
               songs={
                   'defeat': dict(stage='defeat', ratings=(4, 7, 9),
                                  chars=['bf-defeat-scared', 'blackold', 'bf', 'bf-defeat-dead', 'bf-defeat-dead-balls', 'bf-defeat-dead-retro', 'bf-defeat-dead-balls-retro'],
                                  icons=['blackOG'], files=['menu/freeplay/miss/dummypostor%d' % i for i in range(1, 7)] + ['menu/freeplay/miss/missAmountArrow'],
                                  sounds=['kill', 'stage/defeat_kill_sfx', 'stage/defeat_kill_sfx-retro', 'stage/defeat_kill_ballz_sfx', 'stage/defeat_kill_ballz_sfx-retro',
                                          'stage/defeat_prekill_sfx', 'stage/defeat_prekill_sfx_v3'],
                                  music=['blackPause']),
               }),
    # (the finale video: in the mod it comes after Identity Crisis (not here yet); FNF 2 plays it before Finale. Story mode:
    #  the credits roll after the song.)
    'w4f': dict(pack='impostor-w4', level='imp-finale', week='week4Finale', title='FINALE', color='#FF1266', portrait='blackp',
                songs={
                    'finale': dict(stage='finalem', videos=['finale'], ratings=(5, 7, 10), chars=['blackparasite'],
                                   files=['ui/finale/healthbarBG', 'ui/finale/insideRED', 'ui/finale/insideBLUE', 'icons/icon-blackFinale'],
                                   music=['blackPause'], credits=True),
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
    for t, n, v1, v2 in old_ev: evs.append({'t': round(t, 3), 'e': OWN_EVENTS.get(n, n), 'v': {'value1': str(v1), 'value2': str(v2)}})
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
    for ic in spec.get('icons', []): icon(pack, ic)
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
            'stage': P + spec['stage'], 'noteStyle': spec.get('noteStyle', 'impostor'), 'album': 'impostor', 'ratings': dict(zip(('easy', 'normal', 'hard'), rt)),
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
    # the 'task' credits box (scripts/tasksong.hx): info.txt's first line + the next two
    if os.path.exists(ip):
        lines = [l.strip() for l in open(ip, encoding='utf-8-sig').read().splitlines() if l.strip()]
        if lines: data['task'] = [lines[0], '\n'.join(lines[1:3])]
    for img in spec.get('files', []): copy_image(pack, img)
    for snd in spec.get('sounds', []): pack.put(M('sounds', snd + '.ogg'), 'preload', 'sounds', NS, snd + '.ogg')
    for mu in spec.get('music', []): pack.put(M('music', mu + '.ogg'), 'preload', 'music', NS, mu + '.ogg')
    if spec.get('credits'): credits_roll(pack)
    for img, k in spec.get('small', {}).items():
        from repack_sparrow import repack
        base = pack.path('shared', 'images', NS, img)
        pack.wrote.update(os.path.normpath(base + e) for e in ('.png', '.xml'))     # (repack writes these two)
        if not os.path.exists(base + '.png') or os.path.getmtime(base + '.png') < os.path.getmtime(M('images', img + '.png')):
            repack(M('images', img + '.png'), M('images', img + '.xml'), base, scale=k); pack.n += 1
        data.setdefault('small', {})[img] = k
    pack.dump(data, 'preload', 'data', NS, 'songs', sid + '.json')
    cnt = {k: sum(1 for q in v if q['d'] < 4) for k, v in notes.items()}
    print('  ', sid, name, [c['bpm'] for c in tc], 'bpm, your notes', cnt, 'speed', sp, ',', len(events), 'events', ', chars', player, opp, gfid, opp2)
    return sid


def credits_roll(pack):
    """The credits roll after Finale (scripts/substates/CreditsRollSubState.hx): its song, the pictures, the names
    (the script's own list), the icons with the outline2 shader's white ring baked in."""
    import numpy as np
    from PIL import Image
    src = open(M('scripts', 'substates', 'CreditsRollSubState.hx'), encoding='utf-8-sig').read()
    body = src[src.index('var credits:Array<CreditInfo> = ['):]
    body = body[:body.index('];')]
    out = []
    for m in re.finditer(r'\{([^{}]*)\}', body, re.S):
        e = {}
        for k, v in re.findall(r"(\w+):\s*('(?:[^'\\]|\\.)*'|-?[\d.]+)", m.group(1)):
            e[k] = v[1:-1].replace("\\'", "'") if v.startswith("'") else float(v)
        if e: out.append(e)
    pack.dump(out, 'preload', 'data', NS, 'credits.json')
    for f in ('rollBorder', 'disc', 'backRow', 'victoryGlow', 'shadow', 'motorfrog', 'innersloth', 'black'):
        copy_image(pack, 'credits/' + f)
    for f in os.listdir(M('images', 'credits', 'roll')):
        if f.endswith('.png'): pack.put(M('images', 'credits', 'roll', f), 'shared', 'images', NS, 'credits', 'roll', f)
    copy_image(pack, 'credits/roll/black')
    # the icons: outline2.frag = a 3 px white ring (12 directions, their alpha / 3), the picture over it
    def outline(sp, dp):
        a = np.asarray(Image.open(sp).convert('RGBA')).astype(np.float32) / 255
        pad = 4; H, W = a.shape[:2]
        A = np.zeros((H + 2 * pad, W + 2 * pad), np.float32); A[pad:pad + H, pad:pad + W] = a[..., 3]
        otl = np.zeros((H, W), np.float32); d = np.array([1.0, 0.0])
        for i in range(12):
            d = np.array([d[0] * 0.866 - d[1] * 0.5, d[0] * 0.5 + d[1] * 0.866])
            dx, dy = int(round(d[0] * 3)), int(round(d[1] * 3))
            otl = np.minimum(otl + A[pad + dy:pad + dy + H, pad + dx:pad + dx + W] / 3, 1)
        al = a[..., 3:4]
        rgb = (1 - al) * otl[..., None] + a[..., :3] * al            # (mix(vec4(1) * otl, tex, tex.a), premultiplied)
        alpha = (1 - al[..., 0]) * otl + al[..., 0]
        rgb = np.where(alpha[..., None] > 1e-4, rgb / np.maximum(alpha[..., None], 1e-4), 0)
        os.makedirs(os.path.dirname(dp), exist_ok=True)
        Image.fromarray((np.dstack([rgb, alpha]) * 255 + 0.5).astype(np.uint8), 'RGBA').save(dp)
    for d, _, fs in os.walk(M('images', 'credits', 'icons')):
        for f in fs:
            if not f.endswith('.png'): continue
            rel = os.path.relpath(os.path.join(d, f), M('images', 'credits', 'icons'))
            dp = pack.path('shared', 'images', NS, 'credits', 'icons', rel)
            if not os.path.exists(dp) or os.path.getmtime(dp) < os.path.getmtime(os.path.join(d, f)): outline(os.path.join(d, f), dp); pack.n += 1
    pack.put(M('music', 'sussusEndus.ogg'), 'preload', 'music', NS, 'sussusEndus.ogg')
    pack.put(M('fonts', 'impact.ttf'), 'fonts', 'mods', 'impact.ttf')


def album(core):
    """the freeplay album: the mod's own Legacy logo on its star sky; the title = the logo's 'VS. IMPOSTOR LEGACY'"""
    from PIL import Image
    from repack_sparrow import frames_of
    f = frames_of(open(M('images', 'logoBumpin.xml'), encoding='utf-8-sig').read())[0]
    sheet = Image.open(M('images', 'logoBumpin.png')).convert('RGBA')
    logo = sheet.crop((int(f['x']), int(f['y']), int(f['x'] + f['width']), int(f['y'] + f['height'])))
    stars = Image.open(M('images', 'menu', 'common', 'starBG.png')).convert('RGBA')
    s = max(262 / stars.width, 262 / stars.height); stars = stars.resize((round(stars.width * s) + 1, round(stars.height * s) + 1), Image.LANCZOS).crop((0, 0, 262, 262))
    sky = Image.new('RGBA', (262, 262), (10, 10, 32, 255)); sky.alpha_composite(stars)
    k = 236 / logo.width; lg = logo.resize((236, round(logo.height * k)), Image.LANCZOS)
    sky.alpha_composite(lg, (13, (262 - lg.height) // 2)); sky.save(core.path('preload', 'images', 'freeplay', 'albumRoll', 'impostor.png'))
    # (the bottom of the logo: VS. IMPOSTOR + LEGACY)
    part = logo.crop((0, int(logo.height * 0.66), logo.width, logo.height)); part = part.crop(part.getchannel('A').getbbox())
    W_, H_ = 234, 142; k = min((W_ - 8) / part.width, (H_ - 8) / part.height)
    part = part.resize((round(part.width * k), round(part.height * k)), Image.LANCZOS)
    t = Image.new('RGBA', (W_, H_), (0, 0, 0, 0)); t.alpha_composite(part, ((W_ - part.width) // 2, (H_ - part.height) // 2))
    sh = Image.new('RGBA', (W_ * 2, H_), (0, 0, 0, 0)); sh.paste(t, (0, 0)); sh.paste(t, (W_, 0))
    sh.save(core.path('preload', 'images', 'freeplay', 'albumRoll', 'impostor-text.png'))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', f'<TextureAtlas imagePath="impostor-text.png" width="{W_ * 2}" height="{H_}">']
    xml += [f'  <SubTexture name="idle{i:04d}" x="0" y="0" width="{W_}" height="{H_}"/>' for i in range(1)]
    xml += [f'  <SubTexture name="switch{i:04d}" x="{W_}" y="0" width="{W_}" height="{H_}"/>' for i in range(1, 5)]
    xml.append('</TextureAtlas>')
    open(core.path('preload', 'images', 'freeplay', 'albumRoll', 'impostor-text.xml'), 'w').write('\n'.join(xml))
    core.dump(dict(version='1.0.0', name='VS IMPOSTOR: LEGACY', artists=['The VS Impostor team'], albumArtAsset='freeplay/albumRoll/impostor',
                   albumTitleAsset='freeplay/albumRoll/impostor-text', albumTitleOffsets=[8, 0]), 'preload', 'data', 'ui', 'freeplay', 'albums', 'impostor.json')


# Psych 1.0 / Nightmare Vision default arrow colours (ClientPrefs.arrowRGBdef): base, white highlight, dark outline
ARROW_RGB = {'left': ('#C24B99', '#FFFFFF', '#3C1F56'), 'down': ('#00FFFF', '#FFFFFF', '#1542B7'),
             'up': ('#12FA05', '#FFFFFF', '#0A4447'), 'right': ('#F9393F', '#FFFFFF', '#651038')}

def rgb_mix(im, cols):
    """The RGB shader (RGBShader.hx): colour = r * c1 + g * c2 + b * c3, alpha kept."""
    import numpy as np
    from PIL import Image
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255
    C = np.array([[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for c in cols], np.float32)   # 3 x rgb
    out = np.clip(a[..., 0:1] * C[0] + a[..., 1:2] * C[1] + a[..., 2:3] * C[2], 0, 1)
    return Image.fromarray((np.concatenate([out, a[..., 3:4]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')


def noteskin(core):
    """The mod's arrows (data/noteskins/default.json + images/NOTE_assets, noteSplashes, sustainHold) as an FNF 2 note
    style 'impostor': every arrow / press / confirm / splash / hold cover coloured per lane the way the shader does
    (the grey receptors aren't coloured), the holds in FNF's 8-column hold picture."""
    from PIL import Image
    from repack_sparrow import frames_of
    D = lambda *p: core.path('shared', 'images', NS, 'notes', *p)
    # arrows: one sheet, each lane's frames coloured in place (every frame belongs to one lane)
    sheet = Image.open(M('images', 'NOTE_assets.png')).convert('RGBA'); xml = open(M('images', 'NOTE_assets.xml'), encoding='utf-8-sig').read()
    out = sheet.copy()
    for f in frames_of(xml):
        lane = f['name'].split(' ')[0]
        if lane not in ARROW_RGB or 'receptor' in f['name'] or 'hold' in f['name']: continue
        x, y = int(f['x']), int(f['y']); w, h = (int(f['height']), int(f['width'])) if f['rot'] else (int(f['width']), int(f['height']))
        out.paste(rgb_mix(sheet.crop((x, y, x + w, y + h)), ARROW_RGB[lane]), (x, y))
    out.save(D('NOTE_assets.png')); open(D('NOTE_assets.xml'), 'w').write(xml)
    # holds: FNF's layout (8 columns: lane piece, lane end), the piece tiled, the tail at the end
    fr = {f['name'].rstrip('0123456789'): f for f in frames_of(xml)}
    def cut(name):
        f = fr[name]; x, y = int(f['x']), int(f['y']); return sheet.crop((x, y, x + int(f['width']), y + int(f['height'])))
    piece, tail = cut('left hold piece'), cut('left hold tail')
    cw, ch = max(piece.width, tail.width) + 2, 87
    hold = Image.new('RGBA', (cw * 8, ch), (0, 0, 0, 0))
    for i, lane in enumerate(('left', 'down', 'up', 'right')):
        pc, tl = rgb_mix(piece, ARROW_RGB[lane]), rgb_mix(tail, ARROW_RGB[lane])
        col = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        for yy in range(0, ch, pc.height): col.paste(pc, ((cw - pc.width) // 2, yy))
        hold.paste(col, (i * 2 * cw, 0))
        cap = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); cap.paste(tl, ((cw - tl.width) // 2, 0))
        hold.paste(cap, ((i * 2 + 1) * cw, 0))
    hold.save(D('NOTE_hold_assets.png'))
    # splashes: 'splash 1' + 'splash 2' coloured for each lane, one sheet, frames renamed '<lane> splash 1....'
    sp = Image.open(M('images', 'noteSplashes.png')).convert('RGBA'); sx = open(M('images', 'noteSplashes.xml'), encoding='utf-8-sig').read()
    sfr = frames_of(sx); W1, H1 = sp.size
    big = Image.new('RGBA', (W1, H1 * 4), (0, 0, 0, 0)); lines = []
    for i, lane in enumerate(('left', 'down', 'up', 'right')):
        big.paste(rgb_mix(sp, ARROW_RGB[lane]), (0, H1 * i))
        for f in sfr:
            lines.append('  <SubTexture name="%s %s" x="%d" y="%d" width="%d" height="%d" frameX="%d" frameY="%d" frameWidth="%d" frameHeight="%d"/>' % (
                lane, f['name'], f['x'], f['y'] + H1 * i, f['width'], f['height'], -f['fx'], -f['fy'], f['fw'], f['fh']))
    big.save(D('noteSplashes.png'))
    open(D('noteSplashes.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<TextureAtlas imagePath="noteSplashes.png">\n' + '\n'.join(lines) + '\n</TextureAtlas>\n')
    # hold covers ('hold splash start / loop / end'), FNF's names per colour (holdCoverStartPurple...)
    hs = Image.open(M('images', 'sustainHold.png')).convert('RGBA'); hx = open(M('images', 'sustainHold.xml'), encoding='utf-8-sig').read()
    for lane, colr in zip(('left', 'down', 'up', 'right'), ('Purple', 'Blue', 'Green', 'Red')):
        rgb_mix(hs, ARROW_RGB[lane]).save(D('holdCover' + colr + '.png'))
        x2 = hx.replace('imagePath="sustainHold.png"', 'imagePath="holdCover%s.png"' % colr)
        x2 = x2.replace('name="hold splash start', 'name="holdCoverStart' + colr).replace('name="hold splash loop', 'name="holdCover' + colr).replace('name="hold splash end', 'name="holdCoverEnd' + colr)
        open(D('holdCover' + colr + '.xml'), 'w').write(x2)
    L = ('left', 'down', 'up', 'right')
    # (data/noteskins/default.json: the splash + hold cover animation offsets, the cover's loop speed)
    skin = json5(M('data', 'noteskins', 'default.json'))
    spo = skin['noteSplashAnimations'][0][0]['offsets']
    sus = {a['anim']: a for a in skin['susSplashAnimations'][0]}
    core.dump({'version': '1.1.0', 'name': 'VS Impostor (Legacy)', 'author': 'The VS Impostor team', 'fallback': 'funkin', 'assets': {
        'note': {'assetPath': 'shared:%s/notes/NOTE_assets' % NS, 'scale': skin.get('noteScale', 0.7), 'data': {l: {'prefix': l + ' note'} for l in L}},
        'noteStrumline': {'assetPath': 'shared:%s/notes/NOTE_assets' % NS, 'scale': skin.get('noteScale', 0.7), 'offsets': [0, 0], 'layout': 'psych', 'data': dict(
            [(l + 'Static', {'prefix': l + ' receptor'}) for l in L] + [(l + 'Press', {'prefix': l + ' press'}) for l in L] +
            [(l + 'Confirm', {'prefix': l + ' confirm'}) for l in L] + [(l + 'ConfirmHold', {'prefix': l + ' confirm'}) for l in L])},
        'holdNote': {'assetPath': 'shared:%s/notes/NOTE_hold_assets' % NS, 'scale': 0.7, 'data': {}},
        'noteSplash': {'assetPath': 'shared:%s/notes/noteSplashes' % NS, 'scale': skin.get('splashScale', 1), 'alpha': skin.get('splashAlpha', 1), 'offsets': spo,
                       'data': dict((l + 'Splashes', [{'prefix': l + ' splash 1'}, {'prefix': l + ' splash 2'}]) for l in L)},
        'holdNoteCover': {'assetPath': 'shared:%s/notes/holdCover' % NS, 'scale': skin.get('susSplashScale', 0.7), 'offsets': sus['loop']['offsets'],
                          'fps': sus['loop'].get('fps', 24), 'data': {}},
    }}, 'preload', 'data', 'notestyles', 'impostor.json')


def core_pack():
    core = Pack('impostor')
    album(core)
    noteskin(core)
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
    pack = pack_of(W['pack'])
    for sid in {spec['stage'] for spec in W['songs'].values()}: stage(pack, sid)
    ids = [song(pack, core, sid, spec, wid) for sid, spec in W['songs'].items()]
    wj = json5(M('data', 'weeks', W['week'] + '.json'))
    # the story menu: the week's opponent from the mod's own freeplay portraits, on the banner
    props = []
    if W.get('portrait'):
        pp = M('images', 'menu', 'freeplay', 'portraits', W['portrait'] + '.png')
        if os.path.exists(pp):
            from PIL import Image
            im = Image.open(pp).convert('RGBA'); im = im.crop(im.getchannel('A').getbbox())
            # (FNF's story characters are only their black lines on the band's colour: keep the art's dark lines)
            import numpy as np
            a = np.asarray(im).astype(np.float32); lum = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
            line = np.clip((34 - lum) / 14, 0, 1) * (a[..., 3] / 255)        # (only the black lines, not the shading)
            out = np.zeros(a.shape, np.uint8); out[..., 3] = (line * 255).astype(np.uint8)
            im = Image.fromarray(out, 'RGBA')
            k = min(1, 300 / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            im.save(pack.path('preload', 'images', 'storymenu', 'props', P + W['portrait'] + '.png'))
            props.append({'assetPath': 'storymenu/props/' + P + W['portrait'], 'scale': 1.0, 'offsets': [60, 80]})
    # (+ BF and GF like every FNF week)
    props += [{'assetPath': 'storymenu/props/bf', 'scale': 1.0, 'offsets': [150, 80], 'animations': [{'name': 'idle', 'prefix': 'idle0', 'frameRate': 24}, {'name': 'confirm', 'prefix': 'confirm0', 'frameRate': 24}]},
              {'assetPath': 'storymenu/props/gf', 'scale': 1.0, 'offsets': [200, 80], 'animations': [{'name': 'danceLeft', 'prefix': 'idle0', 'frameIndices': [30, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]}, {'name': 'danceRight', 'prefix': 'idle0', 'frameIndices': [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]}]}]
    col = W['color']
    if not col:
        cj = json5(M('data', 'characters', W['portrait'] + '.json'))
        col = color(cj.get('healthbar_colour', cj.get('healthbar_colors')))
    pack.dump({'version': '1.0.0', 'name': wj.get('storyName', W['title']), 'titleAsset': 'storymenu/titles/' + W['level'], 'visible': True,
               'props': props, 'background': col, 'songs': ids, 'capsule': {'name': 'IMPOSTOR'}}, 'preload', 'data', 'levels', W['level'] + '.json')
    title_png(pack, W['level'], wj.get('storyName', W['title']))
    print('   ', pack.id, pack.n, 'files')


def title_png(pack, level, text):
    """The story menu week title, FNF's way: chunky hollow letters (black inside, white outline), each a little tilted,
    at most 420 px wide so it never runs into the difficulty picker."""
    from PIL import Image, ImageDraw, ImageFont
    import random
    rnd = random.Random(level)
    font = ImageFont.truetype(os.path.join(ROOT, 'assets', 'fonts', 'Chewy-Regular.ttf'), 120)
    text = text.upper()
    letters = []
    for ch in text:
        if ch == ' ': letters.append(None); continue
        w = int(font.getlength(ch)) + 24
        im = Image.new('RGBA', (w, 170), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.text((12, 12), ch, font=font, fill=(255, 255, 255, 255), stroke_width=8, stroke_fill=(255, 255, 255, 255))   # (the white ring
        d.text((12, 12), ch, font=font, fill=(0, 0, 0, 255))                                                       #  outside, black inside)
        letters.append(im.rotate(rnd.uniform(-5, 5), resample=Image.BICUBIC, expand=False))
    W = sum((l.width - 18) if l else 34 for l in letters) + 40
    out = Image.new('RGBA', (W, 190), (0, 0, 0, 0)); x = 6
    for l in letters:
        if l is None: x += 34; continue
        out.alpha_composite(l, (x, rnd.randint(0, 8))); x += l.width - 18
    out = out.crop(out.getchannel('A').getbbox())
    if out.width > 420: out = out.resize((420, round(out.height * 420 / out.width)), Image.LANCZOS)
    out.save(pack.path('preload', 'images', 'storymenu', 'titles', level + '.png'))


CORE = None
def main():
    global CORE
    want = sys.argv[1:] or list(WEEKS)
    CORE = core_pack()
    for wid in want: week(wid)
    for pk in PACKS: pk.prune()
    print('core', CORE.n, 'files')


if __name__ == '__main__':
    main()
