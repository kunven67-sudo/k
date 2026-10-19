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

  python3 tools/own/whitty.py [port folder]
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/whittyvs/x/VSWhittyDefinitiveEdition'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'whitty')   # this mod's pack folder (tools/pack_assets.py --packs)

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
    print('whitty:', n, 'files')


if __name__ == '__main__':
    sys.path.insert(0, HERE)
    main()
