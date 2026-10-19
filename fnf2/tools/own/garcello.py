"""VS Garcello ("Smoke 'Em Out Struggle", by Atsuover + Clover) for FNF 2 - PRIVATE build only.

Reads the V-Slice port of the mod (GameBanana 511838, port by Greeny3483, v3.3.4) and copies what FNF 2
plays into the git-ignored build/own folder (never the repo; credits in fnf2/private/CREDITS-mods.txt).
The port is made for the real FNF engine, so its files go to the same places FNF's own do.

  songs       Headache, Nerves, Release, Fading: the mod's songs (easy/normal/hard), the ORIGINAL 2021
              versions as the OG difficulty, the Pico mixes (played as Pico, Nene on the speakers) and
              Release Erect (erect/nightmare)
  characters  garcello (+ tired, dead, ghost), their health + freeplay icons
  stages      the alley at night, smoky, morning + the four Erect ones the Pico mixes use
  cutscenes   dialogue (FNF's conversation system), the intro text, the Release video, the sounds
  menus       story week, freeplay albums, OG difficulty art

Not taken: the "minus" remixes (their own characters + parking-lot stages, a fan series of their own).

  python3 tools/own/garcello.py [port folder]
"""
import glob, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/garcellovs/x'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'garcello')   # this mod's pack folder (tools/pack_assets.py --packs)
SONGS = ['headache', 'nerves', 'release', 'fading']
CHARS = ['garcello', 'garcellotired', 'garcellodead', 'garcelloghosty']
STAGES = ['strangeAlley', 'strangeAlleySmokey', 'strangeAlleyMorning',
          'strangeAlleyErect', 'strangeAlleyErectRain', 'strangeAlleyErectStorming', 'strangeAlleyErectSunset']
PURPLE = '#8E40A5'   # the mod paints Garcello's side of the health bar purple

FILES = [
    *[f'data/characters/{c}.json' for c in CHARS],
    'shared/images/characters/garcello.*', 'shared/images/characters/garcelloWeak.*',
    'shared/images/characters/garcellodead_assets.*', 'shared/images/characters/garcelloghosty_assets.*',
    *[f'data/stages/{s}.json' for s in STAGES],
    'shared/images/stages/garStage*.png', 'shared/images/stages/gardead.png', 'shared/images/stages/garSmoke.*',
    'shared/images/stages/erect/*.png',
    'data/levels/weekg.json', 'images/storymenu/titles/weekG.png', 'images/storymenu/props/menu_garcello.*',
    'images/storymenu/difficulties/og.png', 'images/freeplay/freeplayog.png', 'shared/images/resultScreen/diff_og.png',
    'data/ui/freeplay/albums/ostHazyRiver.json', 'data/ui/freeplay/albums/seosOST.json', 'data/ui/freeplay/albums/seosErectOST.json',
    'images/freeplay/albumRoll/ostHazyRiver*', 'images/freeplay/albumRoll/seosOST.png', 'images/freeplay/albumRoll/seosOG-text.*',
    'images/freeplay/albumRoll/seosErectOST*',
    'images/freeplay/icons/garcello*pixel.png', 'images/icons/icon-gar*.png',
    'data/dialogue/conversations/*.json', 'data/dialogue/speakers/*.json', 'data/dialogue/boxes/*.json', 'images/dialogue/*',
    'shared/images/garIntroText.png', 'shared/images/garIntroPico.png',
    'music/garbgnoise.ogg', 'sounds/Garcello_Dies.ogg', 'sounds/Wind_Fadeout.ogg', 'sounds/garWeak.ogg',
    'sounds/thunder_1.ogg', 'sounds/thunder_2.ogg', 'sounds/pixelText.ogg',
]
for s in SONGS:
    for v in ('', '-og', '-pico', '-erect'):
        FILES += [f'data/songs/{s}/{s}-metadata{v}.json', f'data/songs/{s}/{s}-chart{v}.json']
    FILES += [f'songs/{s}/Inst.ogg', f'songs/{s}/Inst-og.ogg', f'songs/{s}/Inst-pico.ogg', f'songs/{s}/Inst-erect.ogg']
    FILES += [f'songs/{s}/Voices-{w}*.ogg' for w in ('bf', 'pico', 'garcello')]


def dest(rel):
    # V-Slice libraries: images/, data/, music/, sounds/ = 'preload'; shared/, songs/, videos/ keep their names
    if rel.startswith(('shared/', 'songs/', 'videos/')): return rel
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))
def save(obj, p): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(obj, open(p, 'w'), indent=1)


def main():
    n = 0
    for pat in FILES:
        hits = glob.glob(os.path.join(glob.escape(MOD), pat))
        if not hits: print('missing:', pat)
        for src in hits:
            rel = os.path.relpath(src, MOD).replace(os.sep, '/')
            if '-minus' in rel or 'Minus' in rel: continue
            dst = os.path.join(OWN, dest(rel))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst); n += 1
    # the Release cutscene video as WebM (VP9 + Opus): every browser plays it (the mp4 is H.264, which some
    # Chromium builds can't)
    vid = os.path.join(OWN, 'videos', 'videos', 'releasecutvslice.webm')
    if not os.path.exists(vid):
        os.makedirs(os.path.dirname(vid), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(MOD, 'videos', 'videos', 'releasecutvslice.mp4'),
                        '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '96k', vid], check=True)
    n += 1
    D = lambda *p: os.path.join(OWN, 'preload', 'data', *p)
    # songs: the minus remixes aren't here, so they leave the variation lists
    for s in SONGS:
        p = D('songs', s, s + '-metadata.json')
        m = load(p); pd = m['playData']
        pd['songVariations'] = [v for v in pd.get('songVariations', []) if v != 'minus']
        save(m, p)
    # Garcello's half of the health bar is purple (the mod's character scripts do it in code)
    for c in CHARS:
        p = D('characters', c + '.json'); d = load(p); d['hpColor'] = PURPLE; save(d, p)
    # every week is open from the start in FNF 2 (the mod hides Fading + the OG versions until the week is beaten)
    p = D('levels', 'weekg.json'); L = load(p); L['visible'] = True; save(L, p)
    print('garcello:', n, 'files')


if __name__ == '__main__':
    main()
