"""VS Sky (bbpanzu, Sky by @Alexander0110_ + @Dra9onSlayer5) for FNF 2 - PRIVATE build only.

Reads the ORIGINAL mod (Kade Engine build from GameBanana mod 44555) and writes everything
FNF 2 needs into the git-ignored build/own folder (never the repo):
  characters  sky, sky-annoyed, sky-mad, gf-cruz (GF on the cross in Manifest)
  stages      skybg, skybgannoyed, skybgmanifest
  songs       Wife Forever, Sky, Manifest: audio + the original charts (legacy -> V-Slice)
  dialogue    the original dialogue.txt files, speakers mapped like the mod
  extras      icons, freeplay pixel icons, story week, endings, music + sounds

Layout numbers (stage positions, anim frame splits) come from the V-Slice port by Rermega
(GameBanana 610809), which matches the original mod.

  python3 tools/own/sky.py [--src /path/to/vs_sky/bin] [--port "/path/to/Vs Sky-Fixed"]
"""
import argparse, json, os, re, shutil, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OWN = os.path.join(ROOT, 'build', 'own')
sys.path.insert(0, HERE)
from repack_sparrow import repack

SONGS = [  # id, name, opponent, gf, stage, rating easy/normal/hard
    ('wife-forever', 'Wife Forever', 'sky', 'gf', 'skybg', (2, 4, 5)),
    ('sky', 'Sky', 'sky-annoyed', 'gf', 'skybgannoyed', (2, 4, 5)),
    ('manifest', 'Manifest', 'sky-mad', 'gf-cruz', 'skybgmanifest', (4, 6, 7)),
]
# who talks in the original dialogue.txt files -> portrait (+ animation)
SPEAKERS = {
    'wife-forever': {'bf': 'bf', 'boyf': 'bf', 'dad': 'sky', 'gf': 'gf'},
    'sky': {'bf': 'bf', 'boyf': 'bf', 'dad': 'sky-annoyed', 'dadd': 'sky-annoyed', 'dad_happy': 'sky'},
    'manifest': {'bf': 'bf', 'boyf': 'bf', 'dad': 'sky-mad', 'gf': 'gf', 'gffu': 'gf:fyou'},
}


def out(*p):
    f = os.path.join(OWN, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f


def jdump(obj, *p): json.dump(obj, open(out(*p), 'w'), indent=1)


def ogg(src, dst):
    """Copy an .ogg as is (the packer turns it into mp3)."""
    shutil.copyfile(src, out(dst))


# ---------------------------------------------------------------- charts (legacy FNF -> V-Slice)
def convert(src_dir, sid):
    notes, speeds, events, bpm = {}, {}, None, None
    for diff, suffix in (('easy', '-easy'), ('normal', ''), ('hard', '-hard')):
        p = os.path.join(src_dir, sid + suffix + '.json')
        if not os.path.exists(p): continue
        s = json.load(open(p))['song']
        bpm = s['bpm']; speeds[diff] = s.get('speed', 1)
        step = 60000 / bpm / 4
        lst, ev, t, last = [], [], 0.0, None
        for sec in s['notes']:
            must = bool(sec.get('mustHitSection'))
            if must != last: ev.append({'t': round(t, 3), 'e': 'FocusCamera', 'v': 0 if must else 1}); last = must
            for n in sec['sectionNotes']:
                tt, lane, ln = n[0], int(n[1]), n[2] if len(n) > 2 else 0
                if lane < 0 or lane > 7: continue
                player = (lane < 4) == must
                d = (lane % 4) + (0 if player else 4)
                nt = {'t': round(tt, 3), 'd': d}
                if ln and ln > 0: nt['l'] = round(ln, 3)
                lst.append(nt)
            t += sec.get('lengthInSteps', 16) * step
        lst.sort(key=lambda q: (q['t'], q['d']))
        # legacy charts can have the same note twice: keep one
        dedup, seen = [], set()
        for q in lst:
            k = (q['t'], q['d'])
            if k not in seen: seen.add(k); dedup.append(q)
        notes[diff] = dedup
        if events is None: events = ev
    return notes, speeds, events, bpm


# ---------------------------------------------------------------- pixel icons (freeplay capsules)
def pixel_icon(src, dst_base):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    frames = [('idle0001', im)]
    for i, (sx, sy) in enumerate([(1.12, 0.86), (0.92, 1.1), (1.0, 1.0)]):          # little squash on confirm
        f = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        s = im.resize((max(1, round(w * sx)), max(1, round(h * sy))), Image.NEAREST)
        f.alpha_composite(s.crop((0, 0, min(w, s.width), min(h, s.height))) if s.width >= w else s, ((w - min(w, s.width)) // 2, h - min(h, s.height)))
        frames.append(('confirm%04d' % (i + 1), f))
    sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<TextureAtlas imagePath="%s.png">' % os.path.basename(dst_base)]
    for i, (n, f) in enumerate(frames):
        sheet.paste(f, (i * w, 0))
        xml.append('  <SubTexture name="%s" x="%d" y="0" width="%d" height="%d"/>' % (n, i * w, w, h))
    xml.append('</TextureAtlas>')
    sheet.save(dst_base + '.png'); open(dst_base + '.xml', 'w').write('\n'.join(xml) + '\n')


SKY_SHEETS = ('sky_assets', 'sky_annoyed_assets', 'sky_mad_assets')
SKY_SCALE = 0.8


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='/home/user/ref/mods/sky/x/bin')
    ap.add_argument('--port', default='/home/user/ref/mods/skyvs/x/Vs Sky-Fixed')
    a = ap.parse_args()
    A = os.path.join(a.src, 'assets')
    IMG = os.path.join(A, 'shared', 'images', 'sky')
    os.makedirs(out('shared', 'images', 'sky', 'x'), exist_ok=True)
    D = lambda *p: out('shared', 'images', 'sky', *p)

    # Sky's own sheets at 80% (she's drawn at 90% on a 1280x720 screen, so it looks the same): the angry one
    # alone was 8192x8192 = 268 MB on the graphics card, the main cause of the lag in her songs.
    # Everything else lossless (the packer trims + de-duplicates sheets and splits big ones into pages);
    # backgrounds half size (soft art)
    for n in SKY_SHEETS: repack(os.path.join(IMG, n + '.png'), os.path.join(IMG, n + '.xml'), D(n), scale=SKY_SCALE)
    for n in ('gf', 'port', 'port_an', 'port_mad', 'bfport', 'gfport', 'dia'):
        for e in ('.png', '.xml'): shutil.copyfile(os.path.join(IMG, n + e), D(n + e))
    for n in ('bg_normal', 'bg_annoyed', 'bg_manifest', 'floorManifest'):
        repack(os.path.join(IMG, n + '.png'), os.path.join(IMG, n + '.xml'), D(n), scale=0.5)
    for i in (1, 2, 3): shutil.copyfile(os.path.join(IMG, 'ending%04d.png' % i), D('ending%04d.png' % i))

    # character data (V-Slice format; frame splits from the port, art from the original)
    P = os.path.join(a.port, 'data', 'characters')
    for cid, src, sheet, icon, col in (('sky', 'sky', 'sky_assets', 'sky', '#4DD8F8'), ('sky-annoyed', 'skyannoyed', 'sky_annoyed_assets', 'sky-annoyed', '#4DD8F8'),
                                       ('sky-mad', 'skymad', 'sky_mad_assets', 'sky-mad', '#3E3E4E'), ('gf-cruz', 'gf-cruz', 'gf', 'gf', '#A5004D')):
        d = json.load(open(os.path.join(P, src + '.json')))
        d['assetPath'] = 'shared:sky/' + sheet
        d['healthIcon'] = {'id': icon}; d['healthColor'] = col
        if sheet in SKY_SHEETS:   # smaller sheet drawn bigger; the engine scales animation offsets too, so they shrink back
            d['scale'] = (d.get('scale') or 1) / SKY_SCALE
            for an in d.get('animations', []):
                if an.get('offsets'): an['offsets'] = [round(v * SKY_SCALE, 2) for v in an['offsets']]
        if cid.startswith('sky'): d['cameraOffsets'] = [0, 0]
        jdump(d, 'preload', 'data', 'characters', cid + '.json')

    # stages
    S = os.path.join(a.port, 'data', 'stages')
    for sid in ('skybg', 'skybgannoyed', 'skybgmanifest'):
        d = json.load(open(os.path.join(S, sid + '.json')))
        for p in d['props']:
            if p['name'] in ('bg_normal', 'bg_annoyed'): p['position'][0] = 640 - 2131 / 2     # centred: no black strip at the left
            p['assetPath'] = p['assetPath'].replace('stages/', 'sky/')
            p['scale'] = [2, 2]                                  # (the sheets were halved above)
            for an in p.get('animations', []):
                if an['prefix'] == 'bg2': an['prefix'] = 'bg'    # (the port's name; the original sheet calls it "bg")
        jdump(d, 'preload', 'data', 'stages', sid + '.json')

    # songs: audio + charts + metadata (the original has ONE vocal track: it goes quiet when you miss, like old FNF)
    for sid, name, opp, gf, stage, rt in SONGS:
        ogg(os.path.join(A, 'songs', sid, 'Inst.ogg'), 'songs/%s/Inst.ogg' % sid)
        ogg(os.path.join(A, 'songs', sid, 'Voices.ogg'), 'songs/%s/Voices-bf.ogg' % sid)
        notes, speeds, events, bpm = convert(os.path.join(A, 'data', sid), sid)
        diffs = [d for d in ('easy', 'normal', 'hard') if d in notes]
        meta = {'version': '2.2.4', 'songName': name, 'artist': 'bbpanzu', 'charter': 'bbpanzu', 'offsets': {},
                'playData': {'difficulties': diffs, 'characters': {'player': 'bf', 'girlfriend': gf, 'opponent': opp, 'playerVocals': ['bf'], 'opponentVocals': []},
                             'stage': stage, 'noteStyle': 'funkin', 'album': 'skyVolume1', 'ratings': dict(zip(('easy', 'normal', 'hard'), rt)), 'previewStart': 0, 'previewEnd': 15000},
                'timeChanges': [{'t': 0, 'b': 0, 'bpm': bpm, 'bt': [4, 4, 4, 4]}],
                'generatedBy': 'FNF 2 - tools/own/sky.py (from the original VS Sky charts)'}
        chart = {'version': '2.0.0', 'scrollSpeed': speeds, 'events': events, 'notes': notes, 'generatedBy': meta['generatedBy']}
        jdump(meta, 'preload', 'data', 'songs', sid, sid + '-metadata.json')
        json.dump(chart, open(out('preload', 'data', 'songs', sid, sid + '-chart.json'), 'w'))
        print(sid, 'bpm', bpm, {k: len(v) for k, v in notes.items()}, 'speed', speeds)

    # dialogue: the original text files, speakers mapped like the mod
    def lines(path, who):
        res = []
        for raw in open(path, encoding='utf-8-sig').read().splitlines():
            m = re.match(r'^:([^:]+):(.*)$', raw.strip())
            if not m: continue
            sp = who.get(m.group(1), 'sky').split(':')
            res.append({'who': sp[0], 'anim': sp[1] if len(sp) > 1 else 'talk', 'text': m.group(2).replace('----', '').strip()})
        return res
    convs = {'wife-forever': lines(os.path.join(A, 'data', 'wife-forever', 'dialogue.txt'), SPEAKERS['wife-forever']),
             'sky': lines(os.path.join(A, 'data', 'sky', 'dialogue.txt'), SPEAKERS['sky']),
             'sky-end': lines(os.path.join(A, 'data', 'sky', 'dialogue2.txt'), SPEAKERS['sky']),
             'manifest': lines(os.path.join(A, 'data', 'manifest', 'dialogue.txt'), SPEAKERS['manifest'])}
    jdump(convs, 'preload', 'data', 'dialogue', 'sky.json')

    # music + sounds
    for n in ('shift', 'manifest', 'goodEnding', 'badEnding', 'peanut'):
        ogg(os.path.join(A, 'shared', 'music', n + '.ogg'), 'shared/music/sky/%s.ogg' % n)
    ogg(os.path.join(A, 'shared', 'sounds', 'manifest.ogg'), 'shared/sounds/sky/manifest.ogg')

    # icons + freeplay pixel icons + story week
    I = os.path.join(a.port, 'images')
    for src, cid in (('sky', 'sky'), ('skyannoyed', 'sky-annoyed'), ('skymad', 'sky-mad')):
        shutil.copyfile(os.path.join(I, 'icons', 'icon-%s.png' % src), out('preload', 'images', 'icons', 'icon-%s.png' % cid))
        pixel_icon(os.path.join(I, 'freeplay', 'icons', src + 'pixel.png'), out('preload', 'images', 'freeplay', 'icons', cid + 'pixel'))
    shutil.copyfile(os.path.join(I, 'storymenu', 'weeksky.png'), out('preload', 'images', 'storymenu', 'titles', 'sky.png'))
    # freeplay album (the port's "vs Sky Volume 1" cover + title)
    for n in ('skyVolume1.png', 'skyVolume1-text.png', 'skyVolume1-text.xml'):
        shutil.copyfile(os.path.join(I, 'freeplay', 'albumRoll', n), out('preload', 'images', 'freeplay', 'albumRoll', n))
    jdump({'version': '1.0.0', 'name': 'vs Sky Volume 1', 'artists': ['bbpanzu'], 'albumArtAsset': 'freeplay/albumRoll/skyVolume1',
           'albumTitleAsset': 'freeplay/albumRoll/skyVolume1-text'}, 'preload', 'data', 'ui', 'freeplay', 'albums', 'skyVolume1.json')
    sm = os.path.join(A, 'images', 'campaign_menu_UI_characters')
    repack(sm + '.png', sm + '.xml', out('preload', 'images', 'storymenu', 'props', 'sky'), keep=['sky idle'], scale=1.0)
    level = {'version': '1.0.0', 'name': 'Sky by @bfswifeforever', 'titleAsset': 'storymenu/titles/sky', 'visible': True,
             'props': [{'assetPath': 'storymenu/props/sky', 'scale': 0.5, 'offsets': [80, 30], 'animations': [
                         {'name': 'danceLeft', 'prefix': 'sky idle', 'frameIndices': [0, 1, 2, 3, 4, 5, 6, 7]},
                         {'name': 'danceRight', 'prefix': 'sky idle', 'frameIndices': [8, 9, 10, 11, 12, 13, 14, 15]}]},
                       {'assetPath': 'storymenu/props/bf', 'scale': 1.0, 'offsets': [150, 80], 'animations': [{'name': 'idle', 'prefix': 'idle0', 'frameRate': 24}, {'name': 'confirm', 'prefix': 'confirm0', 'frameRate': 24}]},
                       {'assetPath': 'storymenu/props/gf', 'scale': 1.0, 'offsets': [200, 80], 'animations': [{'name': 'danceLeft', 'prefix': 'idle0', 'frameIndices': [30, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]}, {'name': 'danceRight', 'prefix': 'idle0', 'frameIndices': [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]}]}],
             'background': '#F9CF51', 'songs': [s[0] for s in SONGS]}
    jdump(level, 'preload', 'data', 'levels', 'sky.json')
    print('VS Sky written to', OWN)


if __name__ == '__main__':
    main()
