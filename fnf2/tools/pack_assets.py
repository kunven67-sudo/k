#!/usr/bin/env python3
"""Packs the FNF assets FNF 2 needs into fnf2/build/assets.js (PRIVATE build only).

The Friday Night Funkin' art + music belong to The Funkin' Crew and "may not be
publicly distributed". So this script never writes into the repo's tracked
files: it reads from a local checkout of github.com/FunkinCrew/funkin.assets
(outside the repo) and writes to fnf2/build/ (git-ignored). The resulting HTML
is a personal copy for the owner only.

  python3 tools/pack_assets.py --src /path/to/funkin.assets [--pack early] [--fetch]

--fetch makes/updates a sparse checkout of the asset repo at --src first.
Images become WebP, audio becomes MP3 (voices mono), text/json/xml stay text.
Converted files are cached in ~/.cache/fnf2/conv so rebuilds are fast.
"""
import argparse, base64, fnmatch, hashlib, json, os, re, subprocess, sys
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.expanduser('~/.cache/fnf2/conv')

# ---------------------------------------------------------------- what to pack
SONGS_EARLY = ['bopeebo', 'fresh', 'dadbattle']
OWN_SONGS = ['ugh', 'guns', 'stress', 'darnell', 'lit-up', '2hot']   # Tankman's 3, then Darnell's 3
CHARS_EARLY = ['bf', 'bf-death', 'gf', 'dad', 'pico/basic-animations', 'pico/playable-animations', 'pico/death']
PACKS = {
    'early': [
        # data
        'preload/data/introText.txt',
        'preload/data/characters/bf.json', 'preload/data/characters/gf.json', 'preload/data/characters/dad.json', 'preload/data/characters/pico-playable.json', 'preload/data/characters/pico.json',
        'preload/data/characters/nene.json',
        'preload/data/stages/mainStage.json', 'preload/data/stages/mainStageErect.json',
        'sserafim/images/cutscene/bfGetUp/*', 'sserafim/images/cutscene/gfGetUp/*',   # BF + GF sitting (WRATH's Brain Freeze cutscene)
        'preload/data/levels/tutorial.json', 'preload/data/levels/week1.json',
        'preload/data/notestyles/funkin.json',
        'preload/data/songs/tutorial/*.json',
        *[f'preload/data/songs/{s}/*.json' for s in SONGS_EARLY],
        'preload/music/freakyMenu/freakyMenu-metadata.json',
        # fonts
        'fonts/vcr.ttf',
        # menus / ui
        'preload/images/alphabet.*', 'preload/images/fonts/*.png', 'preload/images/fonts/*.xml', 'preload/images/logoBumpin.*', 'preload/images/gfDanceTitle.*', 'preload/images/title-screen-text/*',
        'preload/images/menuBG.png', 'preload/images/menuBGMagenta.png', 'preload/images/menuDesat.png', 'preload/images/newgrounds_logo.png',
        'preload/images/backButton.*', 'preload/images/pauseButton.*', 'preload/images/pauseCircle.png',   # FNF mobile's buttons
        'preload/images/funkay.png',   # the loading screen
        'preload/images/mainmenu/storymode.*', 'preload/images/mainmenu/freeplay.*', 'preload/images/mainmenu/options.*', 'preload/images/mainmenu/credits.*',
        'preload/images/storymenu/titles/tutorial.png', 'preload/images/storymenu/titles/week1.png',
        'preload/images/storymenu/props/bf.*', 'preload/images/storymenu/props/gf.*', 'preload/images/storymenu/props/dad.*', 'preload/images/storymenu/props/pico-player.*',
        'preload/images/storymenu/difficulties/*', 'preload/images/storymenu/ui/*',
        'preload/images/icons/icon-bf.png', 'preload/images/icons/icon-gf.png', 'preload/images/icons/icon-dad.png', 'preload/images/icons/icon-pico.png', 'preload/images/icons/icon-face.png',
        'preload/images/ui/popup/funkin/*', 'preload/images/checkboxThingie.*', 'preload/images/NOTE_hold_assets.png',
        'shared/images/notes.*', 'shared/images/noteStrumline.*', 'shared/images/noteSplashes.*', 'shared/images/holdCover*', 'shared/images/NOTE_hold_assets.png',
        'shared/images/healthBar.png', 'shared/images/ui/countdown/funkin/*',
        'shared/images/stageback.png', 'shared/images/stagefront.png', 'shared/images/stagecurtains.png', 'week1/images/erect/*',
        *[f'shared/images/characters/{c}/*' for c in CHARS_EARLY],
        # freeplay (V-Slice DJ menu)
        'preload/images/freeplay/*.png', 'preload/images/freeplay/*.xml', 'preload/images/freeplay/*.json', 'preload/images/freeplay/albumRoll/*.png', 'preload/images/freeplay/albumRoll/*.xml', 'preload/images/freeplay/albumRoll/*.json', 'preload/images/freeplay/albumRoll/freeplayAlbum/*.png', 'preload/images/freeplay/albumRoll/freeplayAlbum/*.xml', 'preload/images/freeplay/albumRoll/freeplayAlbum/*.json', 'preload/images/freeplay/backing-text-yeah/*.png', 'preload/images/freeplay/backing-text-yeah/*.xml', 'preload/images/freeplay/backing-text-yeah/*.json', 'preload/images/freeplay/backingCards/*.png', 'preload/images/freeplay/backingCards/*.xml', 'preload/images/freeplay/backingCards/*.json', 'preload/images/freeplay/backingCards/newCharacter/*.png', 'preload/images/freeplay/backingCards/newCharacter/*.xml', 'preload/images/freeplay/backingCards/newCharacter/*.json', 'preload/images/freeplay/backingCards/pico/*.png', 'preload/images/freeplay/backingCards/pico/*.xml', 'preload/images/freeplay/backingCards/pico/*.json', 'preload/images/freeplay/backingCards/pico/pico-confirm/*.png', 'preload/images/freeplay/backingCards/pico/pico-confirm/*.xml', 'preload/images/freeplay/backingCards/pico/pico-confirm/*.json', 'preload/images/freeplay/freeplay-boyfriend/*.png', 'preload/images/freeplay/freeplay-boyfriend/*.xml', 'preload/images/freeplay/freeplay-boyfriend/*.json', 'preload/images/freeplay/freeplay-pico/*.png', 'preload/images/freeplay/freeplay-pico/*.xml', 'preload/images/freeplay/freeplay-pico/*.json', 'preload/images/freeplay/freeplayCapsule/*.png', 'preload/images/freeplay/freeplayCapsule/*.xml', 'preload/images/freeplay/freeplayCapsule/*.json', 'preload/images/freeplay/freeplayCapsule/capsule/*.png', 'preload/images/freeplay/freeplayCapsule/capsule/*.xml', 'preload/images/freeplay/freeplayCapsule/capsule/*.json', 'preload/images/freeplay/freeplaySelector/*.png', 'preload/images/freeplay/freeplaySelector/*.xml', 'preload/images/freeplay/freeplaySelector/*.json', 'preload/images/freeplay/freeplayStars/*.png', 'preload/images/freeplay/freeplayStars/*.xml', 'preload/images/freeplay/freeplayStars/*.json', 'preload/images/freeplay/icons/*.png', 'preload/images/freeplay/icons/*.xml', 'preload/images/freeplay/icons/*.json', 'preload/images/freeplay/instBox/*.png', 'preload/images/freeplay/instBox/*.xml', 'preload/images/freeplay/instBox/*.json', 'preload/images/freeplay/sortedLetters/*.png', 'preload/images/freeplay/sortedLetters/*.xml', 'preload/images/freeplay/sortedLetters/*.json',
        'preload/data/players/*.json', 'fonts/5by7.ttf', 'fonts/5by7_b.ttf',
        # character select (V-Slice CharSelectSubState)
        *[f'preload/images/charSelect/{d}/*' for d in ['barThing', 'bfChill', 'charSelectSpeakers', 'charSelectStage', 'crowd', 'gfChill', 'lock', 'lockedChill', 'neneChill', 'picoChill', 'gfAnimInfo', 'neneAnimInfo', 'iconBopInfo']],
        *[f'preload/images/charSelect/{f}' for f in ['charSelectBG.png', 'curtains.png', 'charLight.png', 'foregroundBlur.png', 'dipshitBlur.*', 'dipshitBacking.*', 'chooseDipshit.png', 'charSelector.png', 'charSelectorConfirm.*', 'charSelectorDenied.*', '*Nametag.png']],
        'preload/music/stayFunky/*.ogg', 'preload/music/stayFunky/*.json', 'preload/sounds/CS_*.ogg', 'preload/sounds/static loop.ogg', 'videos/videos/introSelect.mp4',
        'shared/images/characters/darnell/*', 'shared/images/characters/tankman/basic/*', 'shared/images/characters/tankman/extra-animations/*',
        'preload/data/characters/darnell.json', 'preload/data/characters/tankman.json',
        'preload/images/icons/icon-darnell.png', 'preload/images/icons/icon-tankman.png',
        'preload/data/ui/freeplay/albums/*.json', 'preload/data/ui/freeplay/styles/*.json', 'fonts/YoureGone-Regular.otf', 'fonts/pixel.otf', 'week6/sounds/pixelText.ogg', 'shared/sounds/clickText.ogg',
        'preload/music/freeplayRandom/freeplayRandom.ogg', 'preload/music/freeplayRandom/freeplayRandom-metadata.json',
        *[f'shared/music/results{r}{p}/*' for r in ['SHIT', 'NORMAL', 'EXCELLENT', 'PERFECT'] for p in ['', '-pico']],
        # Week 7 + Weekend 1: the songs Tankman and Darnell really sang in (played swapped as them: 12-song.js)
        'preload/data/levels/week7.json', 'preload/data/levels/weekend1.json',
        'preload/data/stages/tankmanBattlefield.json', 'preload/data/stages/phillyStreets.json',
        *[f'preload/data/songs/{s}/{s}-{k}.json' for s in OWN_SONGS for k in ('chart', 'metadata')],
        *[f'songs/{s}/{f}.ogg' for s in OWN_SONGS[:3] for f in ('Inst', 'Voices-bf', 'Voices-tankman')],
        *[f'songs/{s}/{f}.ogg' for s in OWN_SONGS[3:] for f in ('Inst', 'Voices-pico', 'Voices-darnell')],
        'week7/images/*.png', 'week7/images/*.xml', 'weekend1/images/phillyStreets/*', 'weekend1/images/SpraycanPile.png',
        'shared/images/characters/bfAndGF.*', 'shared/images/characters/bfHoldingGF-DEAD.*', 'shared/images/characters/gfTankmen.*', 'shared/images/characters/pico-speaker/*',
        *[f'preload/data/characters/{c}.json' for c in ('bf-holding-gf', 'pico-speaker', 'gf-tankmen')],
        # results screen (safe versions only: no "hearts" naughty layer)
        *[f'shared/images/resultScreen/{d}{e}' for d in ['', 'clearPercent/', 'rankText/', 'results-bf/resultsEXCELLENT/', 'results-bf/resultsGOOD/', 'results-bf/resultsGOOD/bf/',
          'results-bf/resultsGREAT/bf/', 'results-bf/resultsGREAT/gf/', 'results-bf/resultsPERFECT/bed/', 'results-bf/resultsPERFECT/tickleFight/', 'results-bf/resultsSHIT/',
          'results-pico/resultsGOOD/', 'results-pico/resultsGREAT/', 'results-pico/resultsPERFECT/', 'results-pico/resultsSHIT/'] for e in ['*.png', '*.xml', '*.json']],
        'preload/sounds/ranks/*.ogg', 'shared/sounds/tickleFight.ogg',
        'preload/data/stickerpacks/*.json', 'shared/images/transitionSwag/stickers-set-1/*.png', 'shared/images/transitionSwag/stickers-set-2/*.png', 'shared/sounds/stickersounds/keys/*.ogg',
        # Nene + her A-Bot speaker (Pico mixes)
        'shared/images/characters/nene/*', 'shared/images/characters/abot/abotSystem/*', 'shared/images/characters/abot/systemEyes/*',
        'shared/images/characters/abot/aBotViz.*', 'shared/images/characters/abot/stereoBG.png', 'preload/images/storymenu/props/nene.*',
        # sounds + music
        'preload/sounds/scrollMenu.ogg', 'preload/sounds/confirmMenu.ogg', 'preload/sounds/cancelMenu.ogg',
        'preload/sounds/fav.ogg', 'preload/sounds/unfav.ogg', 'preload/images/digital_numbers.*', 'preload/images/digital_numbers_pico.*',
        'shared/sounds/missnote1.ogg', 'shared/sounds/missnote2.ogg', 'shared/sounds/missnote3.ogg',
        'shared/sounds/gameplay/countdown/funkin/*.ogg', 'shared/sounds/gameplay/gameover/fnf_loss_sfx.ogg', 'shared/sounds/gameplay/gameover/fnf_loss_sfx-pico.ogg',
        'shared/music/gameplay/gameover/gameOver.ogg', 'shared/music/gameplay/gameover/gameOverEnd.ogg', 'shared/music/gameplay/gameover/gameOver-pico.ogg', 'shared/music/gameplay/gameover/gameOverEnd-pico.ogg',
        'preload/music/freakyMenu/freakyMenu.ogg', 'shared/music/breakfast/breakfast.ogg', 'shared/music/breakfast-pico/breakfast-pico.ogg',
        # songs
        'songs/tutorial/Inst.ogg', 'songs/tutorial/Voices-bf.ogg', 'songs/tutorial/Voices-gf.ogg',
        *[f'songs/{s}/{f}.ogg' for s in SONGS_EARLY for f in ['Inst', 'Voices-bf', 'Voices-dad', 'Inst-erect', 'Voices-bf-erect', 'Voices-dad-erect', 'Inst-pico', 'Voices-pico-playable-pico', 'Voices-dad-pico']],
    ],
}
# extra characters (for making our own characters from the real art)
CHARS_MORE = ['darnell', 'monster', 'nene', 'tankman/basic', 'tankman/sing-alts', 'momCar', 'bf-dark', 'pico-dark', 'gf-dark', 'spooky_dark', 'otis', 'parents-christmas', 'pico-christmas', 'nene-dark']
PACKS['design'] = PACKS['early'] + [p for c in CHARS_MORE for p in (f'shared/images/characters/{c}/*', f'shared/images/characters/{c}.*')] + [
    'preload/data/characters/*.json', 'shared/images/characters/SpookyKids.*', 'shared/images/characters/senpai.*', 'shared/images/characters/spirit.*',
    'preload/images/icons/*.png']
# every pattern above must also be in the sparse checkout (directories, for --fetch)
def sparse_dirs(patterns):
    out = set()
    for p in patterns:
        d = os.path.dirname(p) if any(ch in p for ch in '*?') or '.' in os.path.basename(p) else p
        out.add(d.strip('/'))   # plain dir names work for cone-mode sparse checkouts
    return sorted(out)

# ---------------------------------------------------------------- converters
def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0: raise RuntimeError(' '.join(cmd) + '\n' + r.stderr.decode(errors='ignore')[-800:])
    return r.stdout

def conv_cached(src, kind, fn):
    st = os.stat(src)
    key = hashlib.sha1(f'{src}|{st.st_size}|{st.st_mtime}|{kind}|v3'.encode()).hexdigest()
    p = os.path.join(CACHE, key)
    if os.path.exists(p):
        return open(p, 'rb').read()
    data = fn()
    os.makedirs(CACHE, exist_ok=True)
    tmp = p + '.%d.tmp' % os.getpid()          # written whole, then renamed: a parallel pack never reads half a file
    open(tmp, 'wb').write(data); os.replace(tmp, p)
    return data

def to_webp(src):
    from PIL import Image
    def f():
        im = Image.open(src)
        if im.mode not in ('RGBA', 'RGB'): im = im.convert('RGBA')
        b = BytesIO()
        # high quality so outlines stay crisp
        im.save(b, 'WEBP', quality=92, alpha_quality=100, method=6)
        return b.getvalue()
    return conv_cached(src, 'webp', f)

def tight_sparrow(png, xml):
    """A Sparrow sheet trimmed + de-duplicated + packed tight again, pixel for pixel (tools/own/repack_sparrow.py).
    Many sheets are mostly empty space or the same drawing many times. -> (png, xml) paths, the originals if not worth it."""
    st1, st2 = os.stat(png), os.stat(xml)
    key = hashlib.sha1(f'{png}|{st1.st_size}|{st1.st_mtime}|{xml}|{st2.st_size}|{st2.st_mtime}|tight3'.encode()).hexdigest()
    d = os.path.join(CACHE, 'tight', key); base = os.path.join(d, 'sheet')
    if os.path.exists(base + '.skip'): return png, xml
    if not os.path.exists(base + '.png'):
        from PIL import Image
        sys.path.insert(0, os.path.join(ROOT, 'tools', 'own'))
        from repack_sparrow import repack
        os.makedirs(d, exist_ok=True)
        try:
            (w, h), nframes, _ = repack(png, xml, base, scale=1)
            W, H = Image.open(png).size
            if nframes < 2 or w * h > 0.7 * W * H: raise ValueError('not worth it')
        except Exception:
            open(base + '.skip', 'w').close()
            for e in ('.png', '.xml'):
                if os.path.exists(base + e): os.remove(base + e)
            return png, xml
    return base + '.png', base + '.xml'

PAGE = 2048
def paged_sparrow(png, xml):
    """A big Sparrow sheet split into small pages (max PAGE x PAGE), every animation's frames kept together.
    Chrome keeps every picture a song draws on the graphics card; one giant sheet (Sky's angry sheet was
    8192x8192 = 268 MB) means a huge upload whenever it's pushed out of memory, and a 2 GB card fills up fast.
    Small pages are cheap to move around and only the pages in use have to stay.
    -> (xml path, [page png paths]) or None if the sheet is small enough already.
    Frame i of the XML gets page="n" (n > 0) when it's on page n (page n = <name>~n.png)."""
    from PIL import Image
    import re
    W, H = Image.open(png).size
    if W * H * 4 <= 24e6 and max(W, H) <= 4096: return None
    st1, st2 = os.stat(png), os.stat(xml)
    key = hashlib.sha1(f'{png}|{st1.st_size}|{st1.st_mtime}|{xml}|{st2.st_size}|{st2.st_mtime}|pages{PAGE}v1'.encode()).hexdigest()
    d = os.path.join(CACHE, 'pages', key)
    if os.path.exists(os.path.join(d, 'sheet.xml')):
        return os.path.join(d, 'sheet.xml'), sorted((os.path.join(d, f) for f in os.listdir(d) if f.endswith('.png')), key=lambda p: int(re.findall(r'(\d+)\.png$', p)[0]))
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'own'))
    from repack_sparrow import frames_of
    img = Image.open(png).convert('RGBA')
    text = open(xml, encoding='utf-8-sig').read()
    frames = frames_of(text)
    # one picture per unique region, grouped by animation (name without its frame number)
    regions, order = {}, []
    for f in frames:
        k = (int(f['x']), int(f['y']), int(f['width']), int(f['height']), f['rot'])
        if k not in regions:
            cut = img.crop((k[0], k[1], k[0] + k[2], k[1] + k[3]))
            if f['rot']: cut = cut.transpose(Image.ROTATE_90)
            regions[k] = {'img': cut, 'anim': re.sub(r'\d+(\.png)?$', '', f['name'])}
            order.append(k)
    groups = {}
    for k in order: groups.setdefault(regions[k]['anim'], []).append(k)
    pages = []   # each: {'shelves': [[y, h, x]], 'h': used height, 'w': used width, 'items': [(k, x, y)]}
    pad = 2
    def place(pg, w, h):
        for sh in pg['shelves']:
            if h <= sh[1] and sh[2] + w <= PAGE: x = sh[2]; sh[2] += w + pad; return x, sh[0]
        y = pg['h']
        if y + h > PAGE or w > PAGE: return None
        pg['shelves'].append([y, h, w + pad]); pg['h'] = y + h + pad
        return 0, y
    def new_page():
        pages.append({'shelves': [], 'h': 0, 'w': 0, 'items': []}); return pages[-1]
    for name, ks in groups.items():
        ks = sorted(ks, key=lambda k: -regions[k]['img'].height)
        # the whole animation on the current page if it fits, else start a fresh one
        trial = None
        if pages:
            import copy
            trial = copy.deepcopy({kk: v for kk, v in pages[-1].items() if kk != 'items'})
            for k in ks:
                if place(trial, *regions[k]['img'].size) is None: trial = None; break
        pg = pages[-1] if trial is not None else new_page()
        for k in ks:
            w, h = regions[k]['img'].size
            at = place(pg, w, h)
            if at is None: pg = new_page(); at = place(pg, w, h)
            if at is None:   # one frame bigger than a page: a page of its own, just that size
                pg['shelves'].append([0, h, PAGE]); pg['h'] = h + pad; at = (0, 0)
            pg['items'].append((k, at[0], at[1])); pg['w'] = max(pg['w'], at[0] + w)
    os.makedirs(d, exist_ok=True)
    where, outs = {}, []
    for n, pg in enumerate(pages):
        sheet = Image.new('RGBA', (max(1, pg['w']), max(1, pg['h'] - pad)), (0, 0, 0, 0))
        for k, x, y in pg['items']: sheet.paste(regions[k]['img'], (x, y)); where[k] = (n, x, y)
        p = os.path.join(d, 'page%d.png' % n); sheet.save(p); outs.append(p)
    lines = ['<?xml version="1.0" encoding="utf-8"?>', '<TextureAtlas imagePath="sheet.png">']
    esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    for f in frames:
        k = (int(f['x']), int(f['y']), int(f['width']), int(f['height']), f['rot'])
        n, x, y = where[k]; w, h = regions[k]['img'].size
        if f['rot'] and f['fx'] == 0 and f['fy'] == 0 and (f['fw'], f['fh']) == (f['width'], f['height']): f['fw'], f['fh'] = w, h
        lines.append('  <SubTexture name="%s" x="%d" y="%d" width="%d" height="%d" frameX="%g" frameY="%g" frameWidth="%g" frameHeight="%g"%s/>' % (
            esc(f['name']), x, y, w, h, -f['fx'], -f['fy'], f['fw'], f['fh'], ' page="%d"' % n if n else ''))
    lines.append('</TextureAtlas>')
    open(os.path.join(d, 'sheet.xml'), 'w').write('\n'.join(lines) + '\n')
    return os.path.join(d, 'sheet.xml'), outs

def warm(job):
    rel, src = job
    ext = os.path.splitext(rel)[1].lower()
    try:
        if ext == '.png': to_webp(src)
        elif ext == '.ogg' or (ext == '.mp3' and not os.path.exists(src[:-4] + '.ogg')): to_mp3(src, '/Voices' in rel)
    except Exception as e: print('warm failed', rel, e, file=sys.stderr)

def to_mp3(src, voices, kbps=None):
    def f():
        args = ['ffmpeg', '-v', 'error', '-i', src]
        if voices: args += ['-ac', '1', '-b:a', '%dk' % (kbps or 64)]
        else: args += ['-ac', '2', '-b:a', '96k']
        return run(args + ['-f', 'mp3', '-'])
    return conv_cached(src, ('mp3v%d' % (kbps or 64)) if voices else 'mp3i96', f)

# Animate atlases: keep only what the player reads (matrix as a 6-number MX, names, frames),
# drop decomposed matrices / transformation points and round the numbers
DROP_KEYS = {'DecomposedMatrix', 'DCM', 'Instance_Name', 'IN'}      # keep TRP: puppets turn pieces around it
def slim_atlas(o):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in DROP_KEYS: continue
            if k in ('M3D', 'Matrix3D'):
                m = v
                mx = [m[0], m[1], m[4], m[5], m[12], m[13]] if isinstance(m, list) else [m['m00'], m['m01'], m['m10'], m['m11'], m['m30'], m['m31']]
                out['MX'] = [round(x, 4) for x in mx]
                continue
            out[k] = slim_atlas(v)
        return out
    if isinstance(o, list): return [slim_atlas(v) for v in o]
    if isinstance(o, float): return round(o, 4)
    return o

def convert(srcs, jobs=0, warm_only=False):
    """{rel path: source file} -> {rel path: packed data} (pictures WebP data URLs, audio MP3, text as text)."""
    # Sparrow sheets: use the tight copy (same pixels, much less memory)
    saved = 0
    for rel in list(srcs):
        if rel.endswith('.png') and rel[:-4] + '.xml' in srcs:
            p2, x2 = tight_sparrow(srcs[rel], srcs[rel[:-4] + '.xml'])
            if p2 != srcs[rel]:
                from PIL import Image
                s0, s1 = Image.open(srcs[rel]).size, Image.open(p2).size
                saved += (s0[0] * s0[1] - s1[0] * s1[1]) * 4
                srcs[rel], srcs[rel[:-4] + '.xml'] = p2, x2
    print(f'tight sheets saved {saved / 1e6:.0f} MB of decoded pictures')
    # big sheets -> small pages (sheet.png = page 0, sheet~1.png = page 1, ...)
    npaged = 0
    for rel in list(srcs):
        if rel.endswith('.png') and rel[:-4] + '.xml' in srcs:
            r = paged_sparrow(srcs[rel], srcs[rel[:-4] + '.xml'])
            if not r: continue
            x2, pages = r
            srcs[rel[:-4] + '.xml'] = x2; srcs[rel] = pages[0]
            for n, p in enumerate(pages[1:], 1): srcs[rel[:-4] + '~%d.png' % n] = p
            npaged += 1
    print(f'{npaged} big sheets split into pages of max {PAGE}x{PAGE}')
    # convert on every core first (the slow part: WebP + mp3), the loop below then reads the cache
    from concurrent.futures import ProcessPoolExecutor
    jl = [(rel, src) for rel, src in sorted(srcs.items()) if os.path.splitext(rel)[1].lower() in ('.png', '.ogg', '.mp3')]
    if warm_only: jl.reverse()
    with ProcessPoolExecutor(jobs or os.cpu_count()) as ex: list(ex.map(warm, jl, chunksize=4))
    if warm_only: print('warmed', len(jl)); return None
    out = {}
    for rel, src in sorted(srcs.items()):
        ext = os.path.splitext(rel)[1].lower()
        if ext == '.png':
            data = 'data:image/webp;base64,' + base64.b64encode(to_webp(src)).decode()
        elif ext in ('.ogg', '.mp3'):
            if ext == '.mp3' and os.path.exists(src[:-4] + '.ogg'): continue
            voices = '/Voices' in rel
            data = 'data:audio/mpeg;base64,' + base64.b64encode(to_mp3(src, voices)).decode()
            rel = rel[:-4] + '.ogg'   # the game always asks for .ogg names
        elif ext in ('.ttf', '.otf'):
            data = 'data:font/ttf;base64,' + base64.b64encode(open(src, 'rb').read()).decode()
        elif ext == '.json':
            try:
                j = json.load(open(src, encoding='utf-8-sig'))
                if os.path.basename(rel) == 'Animation.json': j = slim_atlas(j)
                data = json.dumps(j, separators=(',', ':'))
            except Exception: data = open(src, encoding='utf-8-sig').read()
        elif ext in ('.mp4', '.webm'):
            data = 'data:video/' + ext[1:] + ';base64,' + base64.b64encode(open(src, 'rb').read()).decode()
        elif ext in ('.xml', '.txt', '.srt'):
            data = open(src, encoding='utf-8-sig').read()
        else:
            continue
        out[rel] = data
    return out

def write_chunked(f, var_assign, out):
    """Object.assign pieces of ~96 MB, each its own <script> in the built page (one script's text is one JS string,
    and Chrome can't make a string much over 512 MB)."""
    part, size = {}, 0
    def flush():
        f.write('/*FNF-CHUNK*/\n' + var_assign)
        json.dump(part, f, separators=(',', ':'))
        f.write(');\n')
    for k, v in out.items():
        if part and size + len(v) > 96 * 1048576: flush(); part, size = {}, 0
        part[k] = v; size += len(v)
    if part: flush()

# ---------------------------------------------------------------- mod packs (fnf2/build/packs, see G.Packs in src/02-assets.js)
PACK_INFO = {
    'garcello': {'name': 'VS Garcello', 'credit': 'atsuover + Rageminer (original), Greeny3483 (V-Slice port)'},
    'tabi': {'name': 'VS Tabi', 'credit': 'Homskiy + team (original), SangMareZG (V-Slice port)'},
    'sky': {'name': 'VS Sky', 'credit': 'bbpanzu'},
    'nene': {'name': "Nene's songs (Girls Night + Girls' Night Out)", 'credit': 'Girls Night team, Pico Day 2023 team, ZenUnique (playable Nene)'},
    'darnell': {'name': "Darnell's Mixtape", 'credit': 'Vegie15 + team'},
    'whitty': {'name': 'VS Whitty', 'credit': 'Sock.clip, Nateanimate, KadeDev + team (original), jarekboho (V-Slice port), SiIvaGunner (HQ songs), ChuckySkullHead + team (Whitty ERECT)'},
    'nenemix': {'name': 'NENE MIXES', 'credit': 'd4rkwinged, PurSnake, Redar13, KerSive, juztexd, geka, Voideeeee, Mio OwO'},
    'jordus': {'name': "Nightly Funkin' (Jordus)", 'credit': "the Nightly Funkin' team (song, characters, stage); rebuilt from a gameplay video", 'v': 4},
    'videosongs': {'name': 'Video Songs', 'credit': 'kip.zig (the Minecraft animation + song of Into Our Lives)', 'v': 2},
    'tankman': {'name': 'Playable Tankman', 'credit': 'Adamatik, PugSquad, Kawai Nuka-Cola, Skellix, JakeOfficial, Pumkin, Shroomii, Camiiix3 + team'},
    'impostor': {'name': 'VS Impostor: Legacy (shared)', 'credit': 'MOTORFROG, Clowfoe + the VS Impostor team (VS IMPOSTOR: LEGACY)', 'group': 'impostor'},
    'impostor-w1': {'name': 'VS Impostor: Legacy - Week 1', 'credit': 'MOTORFROG, Clowfoe + the VS Impostor team (VS IMPOSTOR: LEGACY)', 'group': 'impostor'},
    'mobile': {'name': 'FNF mobile pictures', 'credit': "The Funkin' Crew (FNF mobile)", 'core': True, 'v': 2},
    'tricky': {'name': 'VS Tricky', 'credit': 'Banbuds, Rozebud, KadeDev, Cval, YingYang48, JADS, Moro + team (original), thisaintcub, PurSnake + LeonidKosherny (V-Slice port), ChuckySkullHead (Madness Erect), angelkireina (Pico mixes)'},
}
# small pictures the menus need right away (icons, freeplay capsules, album art, character select) live in the head
HEAD_PICS = ('preload/images/icons/', 'preload/images/freeplay/', 'preload/images/charSelect/', 'preload/images/storymenu/', 'preload/images/mainmenu/')

def preview_cut(src, start, end):
    """The part of a song freeplay previews (start..end seconds), as an mp3."""
    st = os.stat(src)
    key = hashlib.sha1(f'{src}|{st.st_size}|{st.st_mtime}|{start:.3f}|{end:.3f}|preview1'.encode()).hexdigest()
    p = os.path.join(CACHE, 'preview', key)
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(run(['ffmpeg', '-v', 'error', '-ss', '%.3f' % start, '-t', '%.3f' % max(0.5, end - start), '-i', src, '-ac', '2', '-b:a', '96k', '-f', 'mp3', '-']))
    return open(p, 'rb').read()

def make_pack(pid, root, out_dir, jobs):
    from PIL import Image
    srcs = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            srcs[rel] = os.path.join(d, f)
    orig = dict(srcs)
    out = convert(dict(srcs), jobs)
    head, body, sizes = {}, {}, {}
    for rel, data in out.items():
        ext = os.path.splitext(rel)[1].lower()
        small_pic = ext == '.png' and (rel.startswith(HEAD_PICS) or len(data) < 160000)
        if ext in ('.json', '.xml', '.txt', '.srt', '.ttf', '.otf') or small_pic: head[rel] = data; continue
        body[rel] = data
        if ext == '.png':
            w = h = 0
            try:
                im = Image.open(BytesIO(base64.b64decode(data[data.index(',') + 1:]))); w, h = im.size
            except Exception: pass
            sizes[rel] = [len(data), w, h]
        else: sizes[rel] = [len(data), 0, 0]
    # freeplay previews: every song's preview part cut out into the head
    previews = {}
    for rel in list(out):
        m = re.match(r'preload/data/songs/([^/]+)/\1-metadata(-[^.]+)?\.json$', rel)
        if not m: continue
        try: meta = json.loads(out[rel])
        except Exception: continue
        pd = meta.get('playData', {}); ins = (pd.get('characters') or {}).get('instrumental') or ''
        inst = f'songs/{m.group(1)}/Inst' + ('-' + ins if ins else '') + '.ogg'
        if inst not in body or inst in previews: continue
        src = orig.get(inst) or orig.get(inst[:-4] + '.mp3')
        if not src: continue
        a, b2 = (pd.get('previewStart') or 0) / 1000, (pd.get('previewEnd') or 15000) / 1000
        head[inst + '#preview'] = 'data:audio/mpeg;base64,' + base64.b64encode(preview_cut(src, a, b2)).decode()
        previews[inst] = [round(a, 3), round(b2, 3)]
    weeks = []
    for rel in sorted(head):
        m = re.match(r'preload/data/levels/([^/]+)\.json$', rel)
        if m: weeks.append(m.group(1))
    info = dict(PACK_INFO.get(pid, {'name': pid}), id=pid)
    # the body in parts of at most ~90 MB each (GitHub takes no single file over 100 MB): <id>.body.js, <id>.body2.js...
    parts, cur, size = [], {}, 0
    for k, v in body.items():
        if cur and size + len(v) > 90 * 1048576: parts.append(cur); cur, size = {}, 0
        cur[k] = v; size += len(v)
    if cur or not parts: parts.append(cur)
    meta = dict(info, weeks=weeks, body=sizes, previews=previews, bodyParts=len(parts))
    hb, bb = sum(len(v) for v in head.values()), sum(len(v) for v in body.values())
    os.makedirs(out_dir, exist_ok=True)
    tag = lambda part, **x: '/*FNF-PACK ' + json.dumps(dict(id=pid, name=info['name'], part=part, **x)) + '*/\n'
    note = "/* PRIVATE BUILD: art + music belong to their makers (see the credits). Not for public distribution. */\n"
    with open(os.path.join(out_dir, pid + '.head.js'), 'w') as f:
        f.write(tag('head', parts=len(parts)) + note + 'FNF_PACK(' + json.dumps(meta, separators=(',', ':')) + ',' + json.dumps(head, separators=(',', ':')) + ');\n')
    for old in os.listdir(out_dir):
        if re.match(re.escape(pid) + r'\.body\d*\.js$', old): os.remove(os.path.join(out_dir, old))
    for i, part in enumerate(parts, 1):
        with open(os.path.join(out_dir, pid + '.body' + (str(i) if i > 1 else '') + '.js'), 'w') as f:
            f.write(tag('body', n=i, of=len(parts)) + note + 'FNF_PACK_BODY(' + json.dumps(pid) + ',' + json.dumps(part, separators=(',', ':')) + f',{i},{len(parts)});\n')
    print(f'pack {pid}: head {len(head)} files {hb / 1048576:.1f} MB, body {len(body)} files {bb / 1048576:.1f} MB, weeks {weeks}')
    return dict(info, headMB=round(hb / 1048576, 1), bodyMB=round(bb / 1048576, 1))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.environ.get('FNF_ASSETS', os.path.expanduser('~/.cache/fnf2/funkin.assets')))
    ap.add_argument('--pack', default='early')
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'assets.js'))
    ap.add_argument('--fetch', action='store_true')
    ap.add_argument('--warm', action='store_true', help='only fill the conversion cache (from the end of the list)')
    ap.add_argument('--jobs', type=int, default=0)
    ap.add_argument('--own', default=os.path.join(ROOT, 'build', 'own'), help='our own characters made by tools/own/*.py (same folder layout as the assets)')
    ap.add_argument('--packs', nargs='*', help='make the mod packs (build/mods/<id> -> build/packs/<id>.head.js + .body.js) instead; no ids = all')
    a = ap.parse_args()
    if a.packs is not None:
        mods = os.path.join(ROOT, 'build', 'mods'); out_dir = os.path.join(ROOT, 'build', 'packs')
        ids = a.packs or sorted(d for d in os.listdir(mods) if os.path.isdir(os.path.join(mods, d)))
        for pid in ids: make_pack(pid, os.path.join(mods, pid), out_dir, a.jobs)
        # the list of every pack that's there (index.js)
        index = []
        for f in sorted(os.listdir(out_dir)):
            m = re.match(r'(.+)\.head\.js$', f)
            if not m: continue
            pid = m.group(1)
            hb = os.path.getsize(os.path.join(out_dir, f))
            bb = sum(os.path.getsize(os.path.join(out_dir, g)) for g in os.listdir(out_dir) if re.match(re.escape(pid) + r'\.body\d*\.js$', g))
            index.append(dict(PACK_INFO.get(pid, {'name': pid}), id=pid, headMB=round(hb / 1048576, 1), bodyMB=round(bb / 1048576, 1)))
        with open(os.path.join(out_dir, 'index.js'), 'w') as f:
            f.write('/* FNF 2 mod packs in this folder */\nFNF_PACK_INDEX(' + json.dumps(index, indent=1) + ');\n')
        print('index:', [e['id'] for e in index])
        return
    pats = PACKS[a.pack]
    if a.fetch:
        if not os.path.isdir(os.path.join(a.src, '.git')):
            run(['git', 'clone', '--depth', '1', '--filter=blob:none', '--sparse', 'https://github.com/FunkinCrew/funkin.assets', a.src])
        run(['git', '-C', a.src, 'sparse-checkout', 'add', *sparse_dirs(pats)])
    files = []
    for p in pats:
        if p.endswith('/**'):  # whole folder, recursive
            root = os.path.join(a.src, p[:-3])
            if not os.path.isdir(root): print('missing dir for', p, file=sys.stderr); continue
            for dp, dn, fn in os.walk(root):
                for f in fn: files.append(os.path.relpath(os.path.join(dp, f), a.src))
            continue
        base = os.path.join(a.src, os.path.dirname(p))
        if not os.path.isdir(base):
            print('missing dir for', p, file=sys.stderr); continue
        hits = [f for f in sorted(os.listdir(base)) if fnmatch.fnmatch(f, os.path.basename(p)) and os.path.isfile(os.path.join(base, f))]
        if not hits: print('no match:', p, file=sys.stderr)
        for h in hits: files.append(os.path.join(os.path.dirname(p), h))
    files = sorted(set(files))
    srcs = {rel: os.path.join(a.src, rel) for rel in files}
    if os.path.isdir(a.own):
        for d, _, fs in os.walk(a.own):
            for f in fs:
                rel = os.path.relpath(os.path.join(d, f), a.own).replace(os.sep, '/')
                srcs[rel] = os.path.join(d, f)
    out = convert(srcs, a.jobs, a.warm)
    if out is None: return
    total = sum(len(v) for v in out.values())
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w') as f:
        f.write('/* PRIVATE BUILD: Friday Night Funkin\' assets (c) The Funkin\' Crew Inc. Not for public distribution. */\n')
        f.write('window.__FNF_ASSETS = {};\n')
        write_chunked(f, 'Object.assign(window.__FNF_ASSETS, ', out)
    print(f'packed {len(out)} files, {total / 1048576:.1f} MB -> {a.out}')

if __name__ == '__main__':
    main()
