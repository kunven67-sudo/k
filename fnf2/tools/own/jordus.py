"""Jordus (Nightly Funkin') rebuilt from a gameplay video: the user only had a TikTok of the mod (it is nowhere to
download), so everything comes out of that video. PRIVATE build only: the song, the characters and the stage belong
to the mod's makers, so they go to the git-ignored build/mods folder, never the repo.

What tools/own/jordus_video/*.py read out of the video first (into WORK, see its README):
  song      demucs stems of the video's sound (Inst + one voice track: both girls sing on it)
  charts    YOUR chart from the arrows on screen (every note + hold, timed to the frame: 440 notes, 125 BPM);
            HERS from her goggles, which light up in the arrow colour of the pose she sings (her arrows are hidden
            in the mod, so they stay hidden here too)
  camera    the mod's camera, tracked frame by frame (who it follows, how close, its bops): replayed in the game
  art       both girls cut out of the frames (an anime upscaler + a cut-out model + the stage behind them),
            the health icons off the health bar, the whole stage stitched from every camera angle
  game over the end of the video IS the mod's game over (shocked, skeleton flash, blue, the pink '?' of smoke):
            its frames + sound + music loop make the death screen

  python3 tools/own/jordus.py
"""
import glob, hashlib, json, os, shutil, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORK = os.environ.get('FNF_JORDUS_WORK', '/tmp/claude-0/nf')
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'jordus')
SID = 'jordus'
PAD = 0.085            # silence put in front so beat 0 is at 0 (the video starts 1/16 after a beat)
END = 127.2            # the song's own sound ends here (video time); the game over comes after (death())
LAG = 0.048            # what's on screen in the video is 48 ms behind its sound (notes + camera)
K = 2                  # world = the video's reference frame (the 90 s shot) x 2
BOX = {'opp': (10, 60, 460, 492), 'plr': (560, 230, 980, 530)}   # each girl's cut-out box (reference px)
OPP, PLR = 'nightly-opp', 'nightly-player'
LIGHT = (2.0, 2.0, 1.04)    # the beat flash: RGB of the stage x this (black stays black, the lavender ramp goes white)
FLASH_BEATS = [[48, 63], [128, 191]]


def out(*p):
    f = os.path.join(OWN, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f


def run(cmd): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def T(video_t): return video_t + PAD           # video/audio time -> song time


# ---------------------------------------------------------------- song
def audio():
    for src, dst in (('no_vocals', 'Inst'), ('vocals', 'Voices-' + PLR)):
        run(['ffmpeg', '-y', '-i', os.path.join(WORK, 'sep', 'htdemucs', 'a', src + '.wav'),
             '-af', f'adelay={int(PAD * 1000)}:all=1,atrim=0:{T(END):.3f},afade=t=out:st={T(END) - 0.3:.3f}:d=0.3',
             '-c:a', 'libvorbis', '-q:a', '7', out('songs', SID, dst + '.ogg')])
    return T(END)


def chart():
    plr = json.load(open(os.path.join(WORK, 'player_chart.json')))
    opp = json.load(open(os.path.join(WORK, 'opp_chart.json')))
    # (her red pose is also her idle: a long red stretch is just her resting, not a note)
    opp = [o for o in opp if not o.get('idle')]
    def thin(notes, gap, hold):
        res, last = [], -9
        for n in sorted(notes, key=lambda n: (n['t'], n['lane'])):
            if n['t'] - last < gap - 1e-6: continue
            res.append(dict(n, sus=n['sus'] if n['sus'] >= hold else 0)); last = n['t']
        return res
    q = lambda n, base: dict(t=round(T(n['t']) * 1000, 2), d=base + n['lane'], **({'l': round(n['sus'] * 1000, 2)} if n['sus'] else {}))
    notes = {}
    for diff, (gap, hold) in {'easy': (0.36, 0.3), 'normal': (0.18, 0.18), 'hard': (0.0, 0.1)}.items():
        mine = plr if diff == 'hard' else thin(plr, gap, hold)
        notes[diff] = sorted([q(n, 0) for n in mine] + [q(n, 4) for n in opp], key=lambda x: (x['t'], x['d']))
    json.dump(dict(version='2.0.0', scrollSpeed={'easy': 2.2, 'normal': 2.6, 'hard': 3.1}, events=[], notes=notes,
                   generatedBy='FNF 2 - tools/own/jordus.py'), open(out('preload', 'data', 'songs', SID, SID + '-chart.json'), 'w'))
    return {d: sum(1 for x in v if x['d'] < 4) for d, v in notes.items()}, len(opp)


def camera():
    cam = json.load(open(os.path.join(WORK, 'cam.json')))
    fs = sorted(int(k) for k in cam)
    rows = []
    for f in fs:
        H = np.vstack([np.array(cam[str(f)]['H']), [0, 0, 1]])
        s = float(np.hypot(H[0, 0], H[1, 0])); c = H @ [512, 288, 1]
        rows.append([f / 30 - LAG + PAD, c[0] * K, c[1] * K, 1280 / (1024 * s * K)])
    R = np.array(rows)
    # (tracking jitter: a 3-sample median, cuts stay cuts)
    S = R.copy()
    for i in range(1, len(R) - 1):
        if R[i + 1, 0] - R[i - 1, 0] < 0.2: S[i, 1:] = np.median(R[i - 1:i + 2, 1:], axis=0)
    path = [[round(r[0], 3), round(r[1], 1), round(r[2], 1), round(r[3], 4)] for r in S]
    # the blackouts: whole frames gone dark in the middle of the song
    br = np.load(os.path.join(WORK, 'bright.npy'))
    dark, blk = br < 15, []
    f = 30 * 20
    while f < 30 * 120:
        if dark[f]:
            g = f
            while dark[g + 1]: g += 1
            blk.append([round(T(f / 30 - LAG), 3), round(T((g + 1) / 30 - LAG), 3)]); f = g
        f += 1
    json.dump(dict(path=path, blackouts=blk, card=[round(T(2.0 - LAG), 3), round(T(6.9 - LAG), 3)], lights=FLASH_BEATS),
              open(out('preload', 'data', 'songs', SID, SID + '-camera.json'), 'w'))
    return len(path), blk


# ---------------------------------------------------------------- the girls
# which cut-out frames make each animation (out/<who>/<anim>_<nn>.png, 30 fps like the video), from where
ANIMS = {
    # (her idle: one bounce of her loop, played on every beat; RIGHT starts on its cut's 3rd frame; UP/DOWN were cut
    # from wide shots where the stage lights don't flash and her whole body shows (her DOWN is a handstand: in the
    # close-ups her head was under the black bar); after their first 7 / 9 frames the cut-out lost bits of her navy
    # cap (it's the buildings' colour) or the next move starts, so the pose holds there; her LEFT only ever happens
    # while the lights flash: the lit frames (3-5) are skipped)
    'opp': dict(idle=('idle', 2, 14), singLEFT=('left', [2, 6, 7, 8], None), singDOWN=('down', 0, 9), singUP=('up', 0, 7), singRIGHT=('right', 2, 17)),
    # (hers: one bop, every 2 beats like in the video; poses start on the note's frame. LEFT + DOWN come from shots
    # that show her whole body with no arrows over her; UP's last frames were taken after the camera moved; the
    # arrows that flew over her in the others were painted out from the frames next to them, fillarrows.py)
    'plr': dict(idle=('idle', 9, 21), singLEFT=('left', 1, 7), singDOWN=('down', 1, 7), singUP=('up', [1, 2, 3, 4, 5, 6], None), singRIGHT=('right', 1, 9)),
}


def atlas(who, name, extra=None):
    """one sparrow sheet: every frame trimmed, same frames shared, frameX/Y keep them all lined up (the box)"""
    from PIL import Image
    X0, Y0, X1, Y1 = BOX[who]; FW, FH = (X1 - X0) * K, (Y1 - Y0) * K
    frames = []                                        # (anim prefix, index, image)
    for anim, (src, a, b) in ANIMS[who].items():
        for i, n in enumerate(a if isinstance(a, list) else range(a, b)):
            p = os.path.join(WORK, 'out_clean', who, f'{src}_{n:02d}.png')
            if os.path.exists(p): frames.append((anim, i, Image.open(p).convert('RGBA')))
    for anim, ims in (extra or {}).items():
        for i, im in enumerate(ims): frames.append((anim, i, im))
    uniq, refs = {}, []
    for anim, i, im in frames:
        bb = im.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox() or (0, 0, 1, 1)
        cut = im.crop(bb); h = hashlib.md5(cut.tobytes() + bytes(str(bb), 'ascii')).hexdigest()
        if h not in uniq: uniq[h] = (cut, bb)
        refs.append((anim, i, h))
    # shelf pack, widest sheet 4096
    order = sorted(uniq, key=lambda h: -uniq[h][0].height)
    x = y = sh = 0; W = 4096; pos = {}
    for h in order:
        im = uniq[h][0]
        if x + im.width > W: x = 0; y += sh + 2; sh = 0
        pos[h] = (x, y); x += im.width + 2; sh = max(sh, im.height)
    sheet = Image.new('RGBA', (W, y + sh), (0, 0, 0, 0))
    for h, (px, py) in pos.items(): sheet.paste(uniq[h][0], (px, py))
    png = out('shared', 'images', 'characters', 'nightly', name + '.png')
    sheet.save(png, optimize=True)
    xml = ['<?xml version="1.0" encoding="utf-8"?>', f'<TextureAtlas imagePath="{name}.png">']
    for anim, i, h in refs:
        im, bb = uniq[h]; px, py = pos[h]
        xml.append(f'  <SubTexture name="{anim}_{i:04d}" x="{px}" y="{py}" width="{im.width}" height="{im.height}" '
                   f'frameX="{-bb[0]}" frameY="{-bb[1]}" frameWidth="{FW}" frameHeight="{FH}"/>')
    xml.append('</TextureAtlas>')
    open(png[:-4] + '.xml', 'w').write('\n'.join(xml))
    counts = {}
    for anim, i, h in refs: counts[anim] = counts.get(anim, 0) + 1
    return counts, (FW, FH)


def misses_and_death():
    """the player never missed in the video: her misses = her poses in FNF's miss purple, a little shake;
    her death = her down miss held dark, then lit up white for the retry"""
    from PIL import Image, ImageChops
    extra = {}
    for anim, (src, a, b) in ANIMS['plr'].items():
        if not anim.startswith('sing'): continue
        ims = []
        for k, n in enumerate((a if isinstance(a, list) else list(range(a, b)))[:5]):
            im = Image.open(os.path.join(WORK, 'out_clean', 'plr', f'{src}_{n:02d}.png')).convert('RGBA')
            r, g, bl, al = im.split()
            tint = Image.merge('RGB', (r, g, bl))
            tint = ImageChops.multiply(tint, Image.new('RGB', im.size, (150, 140, 255)))
            sh = [6, -5, 3, -2, 0][k]
            frame = Image.new('RGBA', im.size, (0, 0, 0, 0)); frame.paste(Image.merge('RGBA', (*tint.split(), al)), (sh, 0))
            ims.append(frame)
        extra[anim + 'miss'] = ims
    base = extra['singDOWNmiss'][-1]
    r, g, bl, al = base.split()
    dark = ImageChops.multiply(Image.merge('RGB', (r, g, bl)), Image.new('RGB', base.size, (110, 110, 170)))
    extra['firstDeath'] = [Image.merge('RGBA', (*dark.split(), al))] * 2
    extra['deathLoop'] = [extra['firstDeath'][0]]
    conf = []
    for k in range(6):
        w = Image.blend(Image.merge('RGB', (r, g, bl)), Image.new('RGB', base.size, (255, 255, 255)), min(1, 0.25 + k * 0.15))
        conf.append(Image.merge('RGBA', (*w.split(), al)))
    extra['deathConfirm'] = conf
    return extra


def characters():
    res = {}
    for who, cid, name, dance in (('opp', OPP, 'opp', 1), ('plr', PLR, 'player', 2)):
        extra = misses_and_death() if who == 'plr' else None
        counts, (FW, FH) = atlas(who, name, extra)
        anims = []
        for a, n in counts.items():
            fps = 30 if not a.startswith('death') else 24
            anims.append(dict(name=a, prefix=a + '_', frameRate=fps, looped=a == 'deathLoop', offsets=[0, 0]))
        # (FNF turns whoever stands on the player's side round, since BF is drawn facing the other way: flipX on the
        #  player = she stays exactly as the video shows her, so the stage bits on her land on the same stage)
        d = dict(version='1.0.0', name='Nightly Funkin\' ' + ('opponent' if who == 'opp' else 'player'), renderType='sparrow',
                 assetPath='characters/nightly/' + name, scale=1, singTime=4, danceEvery=dance, isPixel=False,
                 offsets=[0, 0], cameraOffsets=[0, 0], flipX=who == 'plr', startingAnimation='idle', animations=anims,
                 healthIcon=dict(id=cid, isPixel=False, offsets=[0, 0], scale=1),
                 death=dict(cameraOffsets=[0, -40], cameraZoom=1.1, preTransitionDelay=0))
        json.dump(d, open(out('preload', 'data', 'characters', cid + '.json'), 'w'), indent=1)
        res[who] = counts
    return res


def icons():
    from PIL import Image
    for cid in (OPP, PLR):
        shutil.copyfile(os.path.join(WORK, 'icons', 'icon-' + cid + '.png'), out('preload', 'images', 'icons', 'icon-' + cid + '.png'))
        im = Image.open(os.path.join(WORK, 'icons', 'icon-' + cid + '.png')).crop((0, 0, 150, 150))
        im.resize((32, 32), Image.LANCZOS).resize((64, 64), Image.NEAREST).save(out('preload', 'images', 'freeplay', 'icons', cid + 'pixel.png'))


# ---------------------------------------------------------------- the stage
def stage():
    from PIL import Image
    p = json.load(open(os.path.join(WORK, 'stage', 'stage.json')))
    shutil.copyfile(os.path.join(WORK, 'stage', 'stage.png'), out('shared', 'images', 'stages', 'nightly', 'street.png'))
    # the lights: in two parts of the song the stage flashes bright on every beat (the girls don't): a lit copy of
    # the stage fades in over it (46-jordus.js); measured on the floor + the sky
    a = np.asarray(Image.open(os.path.join(WORK, 'stage', 'stage.png')).convert('RGB')).astype(np.float32)
    lit = np.clip(a * np.array(LIGHT, np.float32), 0, 255).astype(np.uint8)
    Image.fromarray(lit).save(out('shared', 'images', 'stages', 'nightly', 'street-lit.png'))
    pos = lambda who: [round((BOX[who][0] + BOX[who][2]) / 2 * K, 1), BOX[who][3] * K]
    json.dump(dict(version='1.0.0', name='Nightly street', cameraZoom=0.625,
                   props=[dict(name='street', assetPath='stages/nightly/street', position=[p['x0'] * K, p['y0'] * K],
                               scale=[K / p['k'], K / p['k']], scroll=[1, 1], zIndex=0),
                          dict(name='lights', assetPath='stages/nightly/street-lit', position=[p['x0'] * K, p['y0'] * K],
                               scale=[K / p['k'], K / p['k']], scroll=[1, 1], zIndex=1, alpha=0)],
                   characters=dict(bf=dict(position=pos('plr'), zIndex=300, cameraOffsets=[0, 0]),
                                   dad=dict(position=pos('opp'), zIndex=200, cameraOffsets=[0, 0]),
                                   gf=dict(position=[1024, 900], zIndex=100))),
              open(out('preload', 'data', 'stages', 'nightlyStreet.json'), 'w'), indent=1)


# ---------------------------------------------------------------- freeplay album (its own cover, not FNF's Volume 1)
def album():
    """cover: both girls on their street (their own cut-out frames, the stage picture); title: the mod's name"""
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    st = Image.open(os.path.join(WORK, 'stage', 'stage.png')).convert('RGBA'); p = json.load(open(os.path.join(WORK, 'stage', 'stage.json')))
    # (stage picture px = (ref - origin) * 2) -> a square around the middle of the street
    cx, cy = (512 - p['x0']) * 2, (300 - p['y0']) * 2
    cover = st.crop((cx - 520, cy - 430, cx + 520, cy + 610)).convert('RGBA')
    def put(who, src, k, x, y):
        im = Image.open(os.path.join(WORK, 'out_clean', who, src + '.png')).convert('RGBA')
        im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
        cover.alpha_composite(im, (int(x), int(y)))
    put('opp', 'up_08', 1.15, -60, 40); put('plr', 'idle_20', 1.35, 330, 330)
    cover = cover.resize((262, 262), Image.LANCZOS)
    cover.save(out('preload', 'images', 'freeplay', 'albumRoll', 'nightly.png'))
    # the title: two lines, chunky, white with a dark purple outline + shadow (like FNF's album titles)
    W_, H_ = 234, 142
    f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf', 46)
    t = Image.new('RGBA', (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    for i, line in enumerate(("NIGHTLY", "FUNKIN'")):
        w = d.textlength(line, font=f); x, y = (W_ - w) / 2, 14 + i * 56
        d.text((x + 4, y + 5), line, font=f, fill=(20, 8, 46, 255), stroke_width=6, stroke_fill=(20, 8, 46, 255))
        d.text((x, y), line, font=f, fill=(255, 255, 255, 255), stroke_width=6, stroke_fill=(52, 24, 112, 255))
    t = t.rotate(4, resample=Image.BICUBIC)
    sheet = Image.new('RGBA', (W_ * 2, H_), (0, 0, 0, 0)); sheet.paste(t, (0, 0)); sheet.paste(t, (W_, 0))
    sheet.save(out('preload', 'images', 'freeplay', 'albumRoll', 'nightly-text.png'))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', f'<TextureAtlas imagePath="nightly-text.png" width="{W_ * 2}" height="{H_}">']
    xml += [f'  <SubTexture name="idle{i:04d}" x="0" y="0" width="{W_}" height="{H_}"/>' for i in range(1)]
    xml += [f'  <SubTexture name="switch{i:04d}" x="{W_}" y="0" width="{W_}" height="{H_}"/>' for i in range(1, 5)]
    xml.append('</TextureAtlas>')
    open(out('preload', 'images', 'freeplay', 'albumRoll', 'nightly-text.xml'), 'w').write('\n'.join(xml))
    json.dump(dict(version='1.0.0', name="Nightly Funkin'", artists=["Nightly Funkin'"], albumArtAsset='freeplay/albumRoll/nightly',
                   albumTitleAsset='freeplay/albumRoll/nightly-text', albumTitleOffsets=[8, 0]),
              open(out('preload', 'data', 'ui', 'freeplay', 'albums', 'nightly.json'), 'w'), indent=1)


# ---------------------------------------------------------------- the game over (the end of the video)
def death():
    """the end of the video is the mod's GAME OVER (the player is shocked, skeleton flash, turns blue, a pink '?' of
    smoke loops over her; on retry the smoke goes and she sits up): its frames (jordus_video/death_frames.py, at
    game-screen size) become one sheet drawn on the screen (46-jordus.js), with its own shock sound + music loop"""
    from PIL import Image
    D = os.path.join(WORK, 'death'); box = json.load(open(os.path.join(D, 'box.json')))
    frames = []
    for anim in ('firstDeath', 'deathLoop', 'deathConfirm'):
        num = lambda p: int(p.rsplit('_', 1)[1][:-4])            # (firstDeath_100 comes after _99, not after _10)
        for i, p in enumerate(sorted(glob.glob(os.path.join(D, anim + '_*.png')), key=num)):
            frames.append((anim, i, Image.open(p).convert('RGBA')))
    uniq, refs = {}, []
    for anim, i, im in frames:
        bb = im.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox() or (0, 0, 1, 1)
        cut = im.crop(bb); h = hashlib.md5(cut.tobytes() + bytes(str(bb), 'ascii')).hexdigest()
        if h not in uniq: uniq[h] = (cut, bb)
        refs.append((anim, i, h))
    order = sorted(uniq, key=lambda h: -uniq[h][0].height)
    x = y = sh = 0; W = 4096; pos = {}
    for h in order:
        im = uniq[h][0]
        if x + im.width > W: x = 0; y += sh + 2; sh = 0
        pos[h] = (x, y); x += im.width + 2; sh = max(sh, im.height)
    sheet = Image.new('RGBA', (W, y + sh), (0, 0, 0, 0))
    for h, (px, py) in pos.items(): sheet.paste(uniq[h][0], (px, py))
    png = out('shared', 'images', 'characters', 'nightly', 'death.png'); sheet.save(png, optimize=True)
    xml = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="death.png">']
    for anim, i, h in refs:
        im, bb = uniq[h]; px, py = pos[h]
        # (frames are the whole 1280x720 screen: the box sits where it sat in the video)
        xml.append(f'  <SubTexture name="{anim}_{i:04d}" x="{px}" y="{py}" width="{im.width}" height="{im.height}" '
                   f'frameX="{-(box["x"] + bb[0])}" frameY="{-(box["y"] + bb[1])}" frameWidth="1280" frameHeight="720"/>')
    xml.append('</TextureAtlas>')
    open(png[:-4] + '.xml', 'w').write('\n'.join(xml))
    for src, dst in (('sfx.wav', ('shared', 'sounds', 'jordus', 'death.ogg')), ('loop.wav', ('shared', 'music', 'jordus', 'gameOver.ogg'))):
        run(['ffmpeg', '-y', '-i', os.path.join(D, src), '-af', 'afade=t=out:st=3.9:d=0.15' if src == 'sfx.wav' else 'anull',
             '-c:a', 'libvorbis', '-q:a', '6', out(*dst)])
    return len(refs), len(uniq)


def metadata(length):
    m = dict(version='2.2.4', songName='Jordus', artist="Nightly Funkin'", charter='FNF 2 (from the video)', offsets={},
             playData=dict(difficulties=['easy', 'normal', 'hard'],
                           characters=dict(player=PLR, girlfriend='', opponent=OPP, instrumental='', playerVocals=[PLR], opponentVocals=[]),
                           stage='nightlyStreet', noteStyle='funkin', ratings=dict(easy=3, normal=6, hard=9), album='nightly',
                           previewStart=int(T(61.4) * 1000), previewEnd=int(T(76.4) * 1000)),
             generatedBy='FNF 2 - tools/own/jordus.py', timeChanges=[dict(t=0, b=0, bpm=125, n=4, d=4, bt=[4, 4, 4, 4])])
    json.dump(m, open(out('preload', 'data', 'songs', SID, SID + '-metadata.json'), 'w'), indent=1)
    json.dump(dict(version='1.0.0', name="NIGHTLY FUNKIN'", titleAsset='storymenu/titles/tutorial', visible=False, props=[],
                   background='#2b1d5c', capsule=dict(name='NIGHTLY'), songs=[SID]),
              open(out('preload', 'data', 'levels', 'nightly.json'), 'w'), indent=1)


def main():
    if os.path.isdir(OWN): shutil.rmtree(OWN)
    length = audio(); print('song', round(length, 2), 's')
    print('notes (yours per difficulty, hers)', *chart())
    print('camera points, blackouts', *camera())
    metadata(length)
    print('animation frames', characters())
    icons(); stage(); album()
    print('death frames (all, different)', *death())
    print('jordus: done ->', OWN)


if __name__ == '__main__':
    main()
