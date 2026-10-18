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
import argparse, base64, fnmatch, hashlib, json, os, subprocess, sys
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.expanduser('~/.cache/fnf2/conv')

# ---------------------------------------------------------------- what to pack
SONGS_EARLY = ['bopeebo', 'fresh', 'dadbattle']
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
    open(p, 'wb').write(data)
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.environ.get('FNF_ASSETS', os.path.expanduser('~/.cache/fnf2/funkin.assets')))
    ap.add_argument('--pack', default='early')
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'assets.js'))
    ap.add_argument('--fetch', action='store_true')
    ap.add_argument('--own', default=os.path.join(ROOT, 'build', 'own'), help='our own characters made by tools/own/*.py (same folder layout as the assets)')
    a = ap.parse_args()
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
    out = {}
    total = 0
    for rel, src in sorted(srcs.items()):
        ext = os.path.splitext(rel)[1].lower()
        if ext == '.png':
            data = 'data:image/webp;base64,' + base64.b64encode(to_webp(src)).decode()
        elif ext in ('.ogg', '.mp3'):
            if ext == '.mp3' and os.path.exists(src[:-4] + '.ogg'): continue
            voices = '/Voices' in rel
            # (the new players' changed voices: a smaller mono mp3, they're only a stand-in until their own songs)
            data = 'data:audio/mpeg;base64,' + base64.b64encode(to_mp3(src, voices, 40 if '/Voices-as-' in rel else None)).decode()
            rel = rel[:-4] + '.ogg'   # the game always asks for .ogg names
        elif ext in ('.ttf', '.otf'):
            data = 'data:font/ttf;base64,' + base64.b64encode(open(src, 'rb').read()).decode()
        elif ext == '.json':
            try:
                j = json.load(open(src, encoding='utf-8-sig'))
                if os.path.basename(rel) == 'Animation.json': j = slim_atlas(j)
                data = json.dumps(j, separators=(',', ':'))
            except Exception: data = open(src, encoding='utf-8-sig').read()
        elif ext == '.mp4':
            data = 'data:video/mp4;base64,' + base64.b64encode(open(src, 'rb').read()).decode()
        elif ext in ('.xml', '.txt', '.srt'):
            data = open(src, encoding='utf-8-sig').read()
        else:
            continue
        out[rel] = data
        total += len(data)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w') as f:
        f.write('/* PRIVATE BUILD: Friday Night Funkin\' assets (c) The Funkin\' Crew Inc. Not for public distribution. */\n')
        f.write('window.__FNF_ASSETS = ')
        json.dump(out, f, separators=(',', ':'))
        f.write(';\n')
    print(f'packed {len(out)} files, {total / 1048576:.1f} MB -> {a.out}')

if __name__ == '__main__':
    main()
