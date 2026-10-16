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
        'preload/data/stages/mainStage.json', 'preload/data/stages/mainStageErect.json',
        'preload/data/levels/tutorial.json', 'preload/data/levels/week1.json',
        'preload/data/notestyles/funkin.json',
        'preload/data/songs/tutorial/*.json',
        *[f'preload/data/songs/{s}/*.json' for s in SONGS_EARLY],
        'preload/music/freakyMenu/freakyMenu-metadata.json',
        # fonts
        'fonts/vcr.ttf',
        # menus / ui
        'preload/images/alphabet.*', 'preload/images/logoBumpin.*', 'preload/images/gfDanceTitle.*', 'preload/images/title-screen-text/*',
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
        # sounds + music
        'preload/sounds/scrollMenu.ogg', 'preload/sounds/confirmMenu.ogg', 'preload/sounds/cancelMenu.ogg',
        'shared/sounds/missnote1.ogg', 'shared/sounds/missnote2.ogg', 'shared/sounds/missnote3.ogg',
        'shared/sounds/gameplay/countdown/funkin/*.ogg', 'shared/sounds/gameplay/gameover/fnf_loss_sfx.ogg', 'shared/sounds/gameplay/gameover/fnf_loss_sfx-pico.ogg',
        'shared/music/gameplay/gameover/gameOver.ogg', 'shared/music/gameplay/gameover/gameOverEnd.ogg', 'shared/music/gameplay/gameover/gameOver-pico.ogg', 'shared/music/gameplay/gameover/gameOverEnd-pico.ogg',
        # results screen (art for BF + Pico, rank music)
        'shared/images/resultScreen/**', 'preload/data/players/*.json',
        *[f'shared/music/{r}{v}/*.ogg' for r in ['resultsPERFECT', 'resultsEXCELLENT', 'resultsNORMAL', 'resultsSHIT'] for v in ['', '-pico']],
        *[f'shared/music/{r}{v}/*.json' for r in ['resultsPERFECT', 'resultsEXCELLENT', 'resultsNORMAL', 'resultsSHIT'] for v in ['', '-pico']],
        'preload/music/freakyMenu/freakyMenu.ogg', 'shared/music/breakfast/breakfast.ogg',
        # songs
        'songs/tutorial/Inst.ogg', 'songs/tutorial/Voices-bf.ogg', 'songs/tutorial/Voices-gf.ogg',
        *[f'songs/{s}/{f}.ogg' for s in SONGS_EARLY for f in ['Inst', 'Voices-bf', 'Voices-dad', 'Inst-erect', 'Voices-bf-erect', 'Voices-dad-erect', 'Inst-pico', 'Voices-pico-playable-pico', 'Voices-dad-pico']],
    ],
}
# every pattern above must also be in the sparse checkout (directories, for --fetch)
def sparse_dirs(patterns):
    out = set()
    for p in patterns:
        d = os.path.dirname(p) if any(ch in p for ch in '*?') or '.' in os.path.basename(p) else p
        out.add('/' + d + '/')
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

def to_mp3(src, voices):
    def f():
        args = ['ffmpeg', '-v', 'error', '-i', src]
        if voices: args += ['-ac', '1', '-b:a', '72k']
        else: args += ['-ac', '2', '-b:a', '112k']
        return run(args + ['-f', 'mp3', '-'])
    return conv_cached(src, 'mp3v' if voices else 'mp3i', f)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.environ.get('FNF_ASSETS', os.path.expanduser('~/.cache/fnf2/funkin.assets')))
    ap.add_argument('--pack', default='early')
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'assets.js'))
    ap.add_argument('--fetch', action='store_true')
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
    out = {}
    total = 0
    for rel in files:
        src = os.path.join(a.src, rel)
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
            try: data = json.dumps(json.load(open(src, encoding='utf-8-sig')), separators=(',', ':'))
            except Exception: data = open(src, encoding='utf-8-sig').read()
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
