"""VS Whitty (Sock.clip + Nateanimate + KadeDev's mod, the "Definitive Edition") for FNF 2 - PRIVATE build only.

Reads jarekboho's V-Slice port of the Definitive Edition (GameBanana file 1788784) and copies what FNF 2 plays into
the git-ignored mod pack folder build/mods/whitty (never the repo; credits in fnf2/private/CREDITS-mods.txt).

  songs       Lo-Fight, Overhead, Ballistic, Underground, Low-Rise, Hungry, Faucet, Ballistic Remix, and SiIvaGunner's
              "High Quality Rip" joke versions (Lo-Fight / Overhead / Ballistic / Underground / Low-Rise / Hungry /
              Faucet HQ, Ballistic Beta Mix, Underground In-Game Mix)
  characters  Whitty (calm, Ballistic, HQ), the Underground guys, Hunger, 4_fuck, Boof, their BFs + GFs
  stages      the alley, the alley on fire (Ballistic), the swag club (Underground), the fast food place (Hungry),
              4chan (Faucet), + every HQ version
  cutscenes   Lo-Fight's intro, Ballistic's transformation, the Psych Engine talk boxes, the Hotline Miami talk box
              (Ballistic HQ), the story mode end pictures
  look        the HQ ratings/combo, the Slam ratings + GO, the red cracked screen on Ballistic

The port's stage scripts put the characters by their sprite corner (like Psych Engine did) and aim the camera at their
middle; that goes into the stage files here as 'raw' spots + 'camMid' offsets (20-play.js places them that way).

The OG difficulty = the songs as they were in the original 2021 mod (the Kade Engine build, GameBanana file 586687):
its Lo-Fight + Overhead charts (same music as the port) and its later Ballistic remake (200 BPM, its own music; the
port's Ballistic is the first 2021 one, which that build kept as "Ballistic-Old"). One 'og' difficulty each = the 2021
HARD chart, like Garcello's OG.

ERECT / NIGHTMARE = "Whitty-ERECT" (a Psych Engine mod, GameBanana file 1299664): its remixes of Lo-Fight, Overhead +
Ballistic as an 'erect' variation, with its own characters, alleys, voices, voice-acted talk scenes, cutscene art and
Ballistic video. The mod has one chart per song: that's NIGHTMARE, and ERECT is a lighter chart made from it (8th-note
grid, like the port's NORMAL). Everything it brings is named whitty-erect/... so nothing clashes with the port.

  python3 tools/own/whitty.py [port folder]
"""
import copy, filecmp, glob, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/whittyvs/x/VSWhittyDefinitiveEdition'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'whitty')   # this mod's pack folder (tools/pack_assets.py --packs)
LEGACY = os.environ.get('WHITTY_LEGACY', '/home/user/ref/mods/whitty/x/assets')        # the original 2021 build
GARCELLO = os.environ.get('GARCELLO_PORT', '/home/user/ref/mods/garcellovs/x')         # its OG difficulty labels
OG_SONGS = ('lo-fight', 'overhead', 'ballistic')
OG_ART = ('images/storymenu/difficulties/og.png', 'images/freeplay/freeplayog.png', 'shared/images/resultScreen/diff_og.png')
ERECT = os.environ.get('WHITTY_ERECT', '/home/user/ref/mods/whittyerect/x/mods/WhittyErect')    # the Whitty-ERECT mod
PSYCH = os.environ.get('PSYCH', '/home/user/ref/psych')                                          # its letters' data
EX = 'whitty-erect'
# song -> opponent, stage, how far the camera leans toward each note (data/<song>/camera.lua shiftCameraPixels)
ER_SONGS = {'lo-fight': ('whitty', EX + '-alley', 25), 'overhead': ('whitty', EX + '-alley', 30),
            'ballistic': ('whitty-crazy', EX + '-alley-ballistic', 60)}
# character -> sheet scale (the 8192 px sheets come in at 80%, like Sky + Nene: same look at the mod's 0.6 zoom)
ER_CHARS = {'bf-whitty': 0.8, 'gf-whitty': 1.0, 'whitty': 0.8, 'whitty-crazy': 0.8}
ER_ICONS = {'bfWhitty': 'bfwhitty-erect', 'whitty': 'whitty-erect', 'whittyCrazy': 'whittycrazy-erect'}

# the mod's own menus (title logo, menu backgrounds, freeplay card) would replace FNF 2's: not taken
SKIP = {'images/logoBumpin.png', 'images/logoBumpin.xml', 'images/gfDanceTitle.png', 'images/gfDanceTitle.xml',
        'images/menuBG.png', 'images/menuBGBlue.png', 'images/menuBGMagenta.png', 'images/menuDesat.png',
        'images/freeplay/freeplayBGweek1-bf.png', 'shared/images/characters/readme.txt', '_polymod_icon.png', '_polymod_meta.json'}

# where each stage script puts the characters (sprite corner) + whether GF is there + where the camera starts
# (stages/*.hxc onSongLoaded / onCountdownStart)
SPOTS = {
    'alley': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100), start='bf'),
    'alley-hqr': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100), start='bf'),
    'alley-hqr2': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100), start='bf'),
    'alley-balls': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100), start='bf'),
    'alley-balls-hqr': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100), start='bf'),
    'better': dict(dad=(280, 150), gf=(460, 180), bf=(1100, 150)),
    'better-balls': dict(dad=(300, 100), gf=(400, 130), bf=(1000, 100)),
    'better-hqr': dict(dad=(280, 150), gf=(460, 180), bf=(1100, 150)),
    'better-hqr2': dict(dad=(280, 150), gf=(460, 180), bf=(1100, 125)),
    'better-hqr3': dict(dad=(280, 150), gf=(460, 180), bf=(1100, 150)),
    '4chan': dict(dad=(310, 190), gf=(180, 180), bf=(1100, 150), nogf=True),
    '4chan-hqr': dict(dad=(310, 190), gf=(760, 333), bf=(1100, 150)),
    'hungry': dict(dad=(260, 190), gf=(180, 180), bf=(880, -40), nogf=True, start=(670, 430)),
    'hungry-hqr': dict(dad=(260, 190), gf=(180, 180), bf=(880, -40), nogf=True, start=(670, 430)),
}
# FlxSprite.blend numbers (openfl BlendMode): 0 = add, 9 = multiply (better-hqr3.hxc)
BLENDS = {('better-hqr3', 'moonlight1'): 'multiply', ('better-hqr3', 'moonlight2'): 'add'}


def dest(rel):
    # V-Slice libraries: images/, data/, music/, sounds/ = 'preload'; shared/, songs/, videos/ keep their names
    if rel.startswith(('shared/', 'songs/', 'videos/')): return rel
    if rel.startswith('fonts/'): return 'fonts/mods/' + rel[6:]
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))
def save(obj, p): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(obj, open(p, 'w'), indent=1)


def main():
    n = 0
    for src in glob.glob(os.path.join(glob.escape(MOD), '**', '*'), recursive=True):
        if os.path.isdir(src): continue
        rel = os.path.relpath(src, MOD).replace(os.sep, '/')
        if rel in SKIP or rel.endswith(('.astc', '.hxc')) or '/' not in rel or rel.startswith('scripts/'): continue
        dst = os.path.join(OWN, dest(rel))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst); n += 1
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    # stages: the characters' spots the Psych way + the camera rules
    for sid, sp in SPOTS.items():
        p = D('stages', sid + '.json'); S = load(p)
        ch = S.setdefault('characters', {})
        for slot in ('bf', 'dad', 'gf'):
            c = ch.setdefault(slot, {})
            c['raw'] = list(sp[slot])
            if slot == 'dad': c['camMid'] = [150, -100]
            if slot == 'bf': c['camMid'] = [-100, -100]; c['camSign'] = -1
        if sp.get('nogf'): ch['gf']['hidden'] = True
        st = sp.get('start')
        if st == 'bf': S['camStart'] = 'bf'
        elif st: S['camStart'] = list(st)
        for pr in S.get('props', []):
            b = BLENDS.get((sid, pr.get('name')))
            if b: pr['blend'] = b
        save(S, p)
    # one-difficulty songs (Faucet): the mod's chart is HARD, EASY + NORMAL are made from it
    from tabi import spaced
    from nene import thin
    for cp in sorted(glob.glob(D('songs', '*', '*-chart.json'))):
        mp = cp.replace('-chart', '-metadata')
        C, M = load(cp), load(mp)
        pd = M['playData']
        if len(pd.get('difficulties', [])) > 1: continue
        hard = C['notes'].get('normal') or C['notes'].get('hard') or []
        bpm = M['timeChanges'][0]['bpm']; beat = 60000 / bpm
        on_grid = sum(abs(q['t'] / beat * 4 - round(q['t'] / beat * 4)) < 0.08 for q in hard) / max(1, len(hard))
        C['notes'] = {'easy': thin(hard, bpm, 'easy') if on_grid > 0.6 else spaced(hard, beat),
                      'normal': thin(hard, bpm, 'normal') if on_grid > 0.6 else spaced(hard, beat / 2), 'hard': hard}
        sp = (C.get('scrollSpeed') or {}).get('normal') or 2
        C['scrollSpeed'] = {'default': sp, 'easy': round(sp * 0.85, 2), 'normal': round(sp * 0.92, 2), 'hard': sp}
        r = (pd.get('ratings') or {}).get('normal') or 4
        pd['difficulties'] = ['easy', 'normal', 'hard']
        pd['ratings'] = {'easy': max(1, round(r * 0.35)), 'normal': max(1, round(r * 0.6)), 'hard': r}
        save(C, cp); save(M, mp)
        print('  ', os.path.basename(cp), {k: len(v) for k, v in C['notes'].items()})
    # the bonus weeks have no story art (freeplay only, like the mod): their capsule label
    for lv, label in (('weekbonus1-2', 'WHITTY BONUS'), ('weekbonus3', 'WHITTY BONUS'), ('weekhungry', 'WHITTY BONUS'),
                      ('zweekbonus3-hqr', 'HIGH QUALITY'), ('zweekhungry-hqr', 'HIGH QUALITY')):
        p = D('levels', lv + '.json'); L = load(p); L['capsule'] = {'name': label}; save(L, p)
    n += og(D)
    n += erect(D)
    print('whitty:', n, 'files')


# ---------------------------------------------------------------- Whitty-ERECT
def psych_chart(s):
    """Psych chart (sections relative to mustHitSection, BPM changes on sections) -> V-Slice notes, camera events,
    time changes. The note times are absolute; the sections are only for the camera + the BPM."""
    bpm = s['bpm']; tc = [{'t': 0, 'bpm': bpm}]
    notes, ev, t, last = [], [], 0.0, None
    for sec in s['notes']:
        if sec.get('changeBPM') and sec.get('bpm') and sec['bpm'] != bpm:
            bpm = sec['bpm']; tc.append({'t': round(t, 3), 'bpm': bpm})
        must = bool(sec.get('mustHitSection'))
        if must != last: ev.append({'t': round(t, 3), 'e': 'FocusCamera', 'v': {'char': 0 if must else 1}}); last = must
        for n in sec['sectionNotes']:
            tt, lane, ln = n[0], int(n[1]), n[2] if len(n) > 2 else 0
            if lane < 0 or lane > 7: continue
            nt = {'t': round(tt, 3), 'd': (lane % 4) + (0 if (lane < 4) == must else 4)}
            if isinstance(ln, (int, float)) and ln > 0: nt['l'] = round(ln, 3)
            if len(n) > 3 and isinstance(n[3], str) and n[3]: nt['k'] = n[3]
            notes.append(nt)
        t += (sec.get('sectionBeats') or sec.get('lengthInSteps', 16) / 4) * 60000 / bpm
    notes.sort(key=lambda q: (q['t'], q['d']))
    out, seen = [], set()
    for q in notes:
        k = (round(q['t']), q['d'])
        if k not in seen: seen.add(k); out.append(q)
    return out, ev, tc


def psych_events(*songs):
    """Psych chart events (+ data/<song>/events.json) -> V-Slice events {t, e, v: {value1, value2}}, each once."""
    out, seen = [], set()
    for s in songs:
        for t, lst in s.get('events', []):
            for e in lst:
                k = (round(t, 1), e[0], str(e[1]), str(e[2]))
                if k in seen: continue
                seen.add(k); out.append({'t': round(t, 3), 'e': e[0], 'v': {'value1': str(e[1]), 'value2': str(e[2])}})
    return out


def erect(D):
    if not os.path.isdir(ERECT): print('  no Whitty-ERECT at', ERECT, '- ERECT skipped'); return 0
    from nene import psych_to_vslice, thin
    from repack_sparrow import repack
    E = lambda *p: os.path.join(ERECT, *p)
    O = lambda *p: os.path.join(OWN, *p)
    def put(src, dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(src, dst)
    n = 0
    # characters: Psych json -> V-Slice ('-loop' follow-ups = V-Slice '-hold'; Psych 'position' = the global offset,
    # drawn x the sheet's scale in FNF 2, so it goes in pre-divided)
    for cid, sc in ER_CHARS.items():
        cj = json.load(open(E('characters', cid + '.json'), encoding='utf-8-sig'))
        img = os.path.join(OWN, 'shared', 'images', 'characters', EX, cid)
        os.makedirs(os.path.dirname(img), exist_ok=True)
        repack(E('images', cj['image'] + '.png'), E('images', cj['image'] + '.xml'), img, scale=sc); n += 2
        d = psych_to_vslice(cj, 'shared:characters/%s/%s' % (EX, cid), sc)
        for a in d['animations']: a['name'] = a['name'].replace('-loop', '-hold')
        d['name'] = cid; d['offsets'] = [round(v * sc, 2) for v in cj['position']]; d['cameraOffsets'] = cj['camera_position']
        d['healthIcon'] = {'id': ER_ICONS.get(cj.get('healthicon'), cj.get('healthicon'))}
        d['hpColor'] = '#%02X%02X%02X' % tuple(cj.get('healthbar_colors', [161, 161, 161]))
        if cj.get('dead_char'): d['deadChar'] = cj['dead_char']
        save(d, D('characters', cid + '.json')); n += 1
    for src, dst in ER_ICONS.items():
        put(E('images', 'icons', 'icon-%s.png' % src), O('preload', 'images', 'icons', 'icon-%s.png' % dst)); n += 1
    # stages (stages/<name>.lua + .json): back layer, then smog / foreground / volumetric light in front of everyone
    for name, sid in (('alley', EX + '-alley'), ('alley-ballistic', EX + '-alley-ballistic')):
        sj = json.load(open(E('stages', name + '.json')))
        anim = name == 'alley-ballistic'
        layers = [('background', (-400, -150) if anim else (-420, -130), 1.0, 10, 'background idle' if anim else None),
                  ('smog', (-450, -160), 0.9, 400, None),
                  ('foreground', (-480, -220) if anim else (-500, -230), 0.7, 410, 'foreground idle' if anim else None),
                  ('volumetric', (-420, -200), 0.8, 420, None)]
        props = []
        for lid, pos, sf, z, pre in layers:
            fn = {'smog': 'Smog' if anim else 'smog'}.get(lid, lid)
            base = os.path.join('images', 'stages', name, fn)
            for ext in ('.png', '.xml'):
                if os.path.exists(E(base + ext)): put(E(base + ext), O('preload', 'images', EX, 'stages', name, lid + ext)); n += 1
            p = {'name': lid, 'assetPath': '%s/stages/%s/%s' % (EX, name, lid), 'position': list(pos), 'scroll': [sf, sf], 'zIndex': z}
            if pre: p['animations'] = [{'name': 'idle', 'prefix': pre, 'frameRate': 24, 'looped': True}]; p['startingAnimation'] = 'idle'
            props.append(p)
        if anim:   # (the angry overlay on the HUD: whittyAngryOverlay.lua)
            put(E('images', 'stages', name, 'angry.png'), O('preload', 'images', EX, 'stages', name, 'angry.png')); n += 1
        bx, by = sj['boyfriend']; gx, gy = sj['girlfriend']; dx, dy = sj['opponent']
        save({'version': '1.0.0', 'name': 'Alley (Whitty-ERECT)', 'cameraZoom': sj.get('defaultZoom', 0.6), 'props': props,
              'characters': {'bf': {'zIndex': 300, 'position': [bx, by], 'raw': [bx, by], 'camMid': [-100, -100], 'camSign': -1, 'cameraOffsets': [0, 0]},
                             'dad': {'zIndex': 200, 'position': [dx, dy], 'raw': [dx, dy], 'camMid': [150, -100], 'cameraOffsets': [0, 0]},
                             'gf': {'zIndex': 100, 'position': [gx, gy], 'raw': [gx, gy], 'cameraOffsets': [0, 0]}}},
             D('stages', sid + '.json')); n += 1
    # songs: the 'erect' variation (ERECT = lighter, NIGHTMARE = the mod's chart)
    for sid, (opp, stage, lean) in ER_SONGS.items():
        s = json.load(open(E('data', sid, sid + '-erect.json'), encoding='utf-8-sig'))['song']
        extra = [json.load(open(E('data', sid, 'events.json')))['song']] if os.path.exists(E('data', sid, 'events.json')) else []
        notes, cam, tc = psych_chart(s)
        events = sorted(cam + psych_events(s, *extra), key=lambda e: e['t'])
        # (thinned per tempo: the 8th-note grid moves at every BPM change)
        light = []
        for i, c in enumerate(tc):
            end = tc[i + 1]['t'] if i + 1 < len(tc) else 1e12
            seg = [dict(q, t=q['t'] - c['t']) for q in notes if c['t'] <= q['t'] < end]
            light += [dict(q, t=round(q['t'] + c['t'], 3)) for q in thin(seg, c['bpm'], 'normal')]
        sp = s.get('speed', 2.5)
        save({'version': '2.0.0', 'scrollSpeed': {'default': sp, 'erect': round(sp * 0.9, 2), 'nightmare': sp},
              'events': events, 'notes': {'erect': light, 'nightmare': notes}, 'generatedBy': 'FNF 2 whitty.py (Whitty-ERECT)'},
             D('songs', sid, sid + '-chart-erect.json'))
        mp = D('songs', sid, sid + '-metadata.json'); base = load(mp)
        m = copy.deepcopy(base); pd = m['playData']
        hard = (base['playData'].get('ratings') or {}).get('hard', 5)
        m['timeChanges'] = tc; m['artist'] = base.get('artist', '') + ' (Whitty-ERECT remix)'
        pd['songVariations'] = []; pd['difficulties'] = ['erect', 'nightmare']; pd['ratings'] = {'erect': hard + 1, 'nightmare': hard + 3}
        pd['characters'] = {'player': 'bf-whitty', 'girlfriend': 'gf-whitty', 'opponent': opp, 'instrumental': 'erect'}
        pd['stage'] = stage; pd['noteStyle'] = 'funkin'; pd['cameraLean'] = lean
        save(m, D('songs', sid, sid + '-metadata-erect.json'))
        bd = base['playData']; bd['songVariations'] = [v for v in bd.get('songVariations', []) if v != 'erect'] + ['erect']; save(base, mp)
        put(E('songs', sid, 'Inst.ogg'), O('songs', sid, 'Inst-erect.ogg'))
        put(E('songs', sid, 'Voices-Player.ogg'), O('songs', sid, 'Voices-bf-whitty-erect.ogg'))
        put(E('songs', sid, 'Voices-Opponent.ogg'), O('songs', sid, 'Voices-whitty-erect.ogg'))
        # the talk (Psych DialogueBoxPsych) + one voice-acted line per entry
        put(E('data', sid, 'dialogue.json'), D(EX, 'dialogue', sid + '.json'))
        vl = sorted(glob.glob(E('sounds', sid, 'dialogueVoiceLines', '*.ogg')), key=lambda p: int(os.path.basename(p)[:-4]))
        for p in vl: put(p, O('preload', 'sounds', EX, sid, 'voice', os.path.basename(p)))
        n += 6 + len(vl)
        print('   erect', sid, [x['bpm'] for x in tc], 'bpm', len(light), '/', len(notes), 'notes,', len(events), 'events,', len(vl), 'voice lines')
    # talk portraits (Psych DialogueCharacter) + the mod's talk sounds + music + the Psych letters' data
    for f in glob.glob(E('images', 'dialogue', '*')):
        # (portrait files are found by name the Windows way, any case: the talk asks for 'bfWhitty', the file is
        #  bfwhitty.json, so the .json files go in lower case and the game looks them up lower case)
        b = os.path.basename(f)
        if f.endswith(('.png', '.xml', '.json')): put(f, O('preload', 'images', EX, 'dialogue', b.lower() if b.endswith('.json') else b)); n += 1
    for rel in ('dialogue.ogg', 'dialogueClose.ogg', 'lo-fight/rip.ogg', 'lo-fight/fire.ogg', 'lo-fight/beepboop.ogg', 'lo-fight/citynight.ogg'):
        put(E('sounds', rel), O('preload', 'sounds', EX, rel)); n += 1
    for rel in ('lo-fight/citynight.ogg', 'ballistic/grit.ogg'):
        put(E('music', rel), O('preload', 'music', EX, rel)); n += 1
    put(os.path.join(PSYCH, 'assets', 'shared', 'images', 'alphabet.json'), D(EX, 'alphabet.json')); n += 1
    # cutscene art: Whitty tearing + burning the poster (Lo-Fight), his scream loop (Ballistic, frames 66-91 only)
    cut = os.path.join(OWN, 'preload', 'images', EX, 'cutscenes'); os.makedirs(cut, exist_ok=True)
    repack(E('images', 'cutscenes', 'lo-fight', 'whittyIntro.png'), E('images', 'cutscenes', 'lo-fight', 'whittyIntro.xml'),
           os.path.join(cut, 'whittyIntro'), scale=0.8)
    repack(E('images', 'cutscenes', 'ballistic', 'whittyBallisticIntro.png'), E('images', 'cutscenes', 'ballistic', 'whittyBallisticIntro.xml'),
           os.path.join(cut, 'whittyScream'), keep=['intro%04d' % i for i in range(66, 92)], scale=0.8)
    n += 4
    # the Ballistic video as WebM (VP9 + Opus: plays in every browser; the mod's mp4 is H.264)
    vid = O('videos', 'videos', EX + '-ballistic.webm')
    if not os.path.exists(vid):
        os.makedirs(os.path.dirname(vid), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', E('videos', 'ballistic.mp4'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34',
                        '-row-mt', '1', '-c:a', 'libopus', '-b:a', '112k', vid], check=True)
    n += 1
    return n


def og(D):
    """The 2021 versions as an 'og' variation of the port's songs (same characters, stage, cutscenes)."""
    if not os.path.isdir(LEGACY): print('  no 2021 build at', LEGACY, '- OG skipped'); return 0
    from sky import convert
    n = 0
    for sid in OG_SONGS:
        notes, speeds, events, bpm = convert(os.path.join(LEGACY, 'data', sid), sid, only=('hard',))
        mp = D('songs', sid, sid + '-metadata.json'); base = load(mp)
        m = copy.deepcopy(base); pd = m['playData']
        m['songName'] = base['songName'] + ' (OG)'
        m['timeChanges'] = [{'t': 0, 'bpm': bpm}]
        pd['songVariations'] = []; pd['difficulties'] = ['og']
        pd['ratings'] = {'og': (base['playData'].get('ratings') or {}).get('hard', 5)}
        player = pd['characters']['player']
        songs = os.path.join(OWN, 'songs', sid)
        ins, voc = os.path.join(LEGACY, 'songs', sid, 'Inst.ogg'), os.path.join(LEGACY, 'songs', sid, 'Voices.ogg')
        if filecmp.cmp(ins, os.path.join(songs, 'Inst.ogg'), shallow=False) and filecmp.cmp(voc, os.path.join(songs, 'Voices-%s.ogg' % player), shallow=False):
            pd['characters']['instrumental'] = ''; pd['vocalsVariation'] = ''        # same music: no second copy
        else:
            pd['characters']['instrumental'] = 'og'
            shutil.copyfile(ins, os.path.join(songs, 'Inst-og.ogg')); shutil.copyfile(voc, os.path.join(songs, 'Voices-%s-og.ogg' % player)); n += 2
        sp = speeds.get('hard', 2)
        save({'version': '2.0.0', 'scrollSpeed': {'default': sp, 'og': sp}, 'events': events, 'notes': {'og': notes['hard']},
              'generatedBy': 'FNF 2 whitty.py (VS Whitty 2021 Kade build)'}, D('songs', sid, sid + '-chart-og.json'))
        save(m, D('songs', sid, sid + '-metadata-og.json'))
        bd = base['playData']; bd['songVariations'] = [v for v in bd.get('songVariations', []) if v != 'og'] + ['og']; save(base, mp)
        n += 2
        print('   og', sid, bpm, 'bpm', len(notes['hard']), 'notes', 'own music' if pd['characters']['instrumental'] else 'same music')
    for rel in OG_ART:
        dst = os.path.join(OWN, 'preload', rel) if not rel.startswith('shared/') else os.path.join(OWN, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(os.path.join(GARCELLO, rel), dst); n += 1
    return n


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
