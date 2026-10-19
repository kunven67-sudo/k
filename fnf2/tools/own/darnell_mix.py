"""Darnell as a real playable character, from the mod "FNF: Darnell's Mixtape" (V1, by Vegie15 + team,
GameBanana 615366). PRIVATE build only: the mod's art + music belong to its makers, so everything is copied into
the git-ignored build/own folder, never the repo (credits in fnf2/private/CREDITS-mods.txt).

The mod is made for the real FNF engine (V-Slice), so its files go to the same places FNF's own do:
  character select  his chill animation + nametag, his friends on the speakers
  freeplay          his DJ, capsules, selector, numbers, background, album, backing card art
  songs             Darnell mixes of the songs FNF 2 has (Tutorial, Bopeebo, Fresh, DadBattle): his own voice
  play              playable Darnell (misses, hey, death + retry), his friends as GF, breakfast + game over music
  results           his rank animations + results music, his sticker pack

Its _merge metadata patches (adding the 'darnell' variation to a song) are applied to FNF's own metadata.

  python3 tools/own/darnell_mix.py [mod folder]
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FA = os.environ.get('FA', '/home/user/ref/fa')
MOD = sys.argv[1] if len(sys.argv) > 1 else "/home/user/ref/mods/darnellmix/x/Darnell's Mixtape 1.0.36"
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'darnell')   # this mod's pack folder (tools/pack_assets.py --packs)
SONGS = ['tutorial', 'bopeebo', 'fresh', 'dadbattle']

FILES = [
    'data/players/darnell.json', 'data/characters/darnell-player.json', 'data/characters/friends.json',
    'data/ui/freeplay/styles/darnell.json', 'data/ui/freeplay/albums/darnell*.json',
    'data/stickerpacks/standart-darnell.json',
    'images/charSelect/darnellChill/*', 'images/charSelect/friendsChill/*', 'images/charSelect/darnellNametag.png',
    'images/freeplay/DARNELL freeplay/*', 'images/freeplay/freeplayBGdad_darnell.png',
    'images/freeplay/backingCards/darnell/*', 'images/freeplay/backingCards/darnell/*/*',
    'images/freeplay/freeplayCapsule/capsule/freeplayCapsule_darnell.*',
    'images/freeplay/freeplaySelector/freeplaySelector_darnell.*',
    'images/freeplay/albumRoll/darnell*', 'images/digital_numbers_darnell.*',
    'shared/images/characters/playable-darnell-anims/*', 'shared/images/characters/friends/*',
    'shared/images/resultScreen/results-darnell/*/*', 'shared/images/resultScreen/results-darnell/*/*/*',
    'shared/images/transitionSwag/stickers-set-darnell/*',
    'shared/music/breakfast-darnell/*', 'shared/music/results*-darnell/*',
    'shared/music/gameplay/gameover/gameOver-darnell.*', 'shared/music/gameplay/gameover/gameOverEnd-darnell.ogg',
    'shared/sounds/gameplay/gameover/fnf_loss_sfx-darnell.ogg',
] + [f'data/songs/{s}/{s}-*-darnell.json' for s in SONGS] + [f'songs/{s}/*-darnell.ogg' for s in SONGS]


def dest(rel):
    # V-Slice libraries: images/, data/, music/ = 'preload'; shared/ and songs/ keep their names
    if rel.startswith(('shared/', 'songs/')): return rel
    return 'preload/' + rel


def apply_patch(doc, ops):
    """The few JSON patch ops the mod's _merge files use (add to a list / set a key)."""
    for op in ops:
        parts = [p for p in op['path'].split('/') if p]
        node = doc
        for i, p in enumerate(parts[:-1]):
            nxt = parts[i + 1]
            node = node.setdefault(p, [] if nxt == '-' or nxt.isdigit() else {}) if isinstance(node, dict) else node[int(p)]
        last = parts[-1]
        if op['op'] == 'add' and last == '-': node.append(op['value'])
        elif op['op'] == 'add' and isinstance(node, list): node.insert(int(last), op['value'])
        elif op['op'] in ('add', 'replace'): node[last] = op['value']
        elif op['op'] == 'remove': node.pop(last if isinstance(node, dict) else int(last))
    return doc


def main():
    n = 0
    for pat in FILES:
        for src in glob.glob(os.path.join(glob.escape(MOD), pat)):
            if os.path.isdir(src): continue
            rel = os.path.relpath(src, MOD).replace(os.sep, '/')
            if rel.endswith('-old.ogg'): continue
            dst = os.path.join(OWN, dest(rel))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst); n += 1
    # the 'darnell' variation added to each song's own metadata
    for s in SONGS:
        patch = os.path.join(MOD, '_merge', 'data', 'songs', s, s + '-metadata.json')
        if not os.path.exists(patch): continue
        base = os.path.join(FA, 'preload', 'data', 'songs', s, s + '-metadata.json')
        doc = json.load(open(base, encoding='utf-8-sig'))
        apply_patch(doc, json.load(open(patch, encoding='utf-8-sig')))
        out = os.path.join(OWN, 'preload', 'data', 'songs', s, s + '-metadata.json')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        json.dump(doc, open(out, 'w'), indent=1); n += 1
    # his card's third line was a joke note to the coders (in Russian); FNF 2's card shows it, so it gets a real one,
    # plus the card's colours (purple, like his capsules)
    p = os.path.join(OWN, 'preload', 'data', 'players', 'darnell.json')
    d = json.load(open(p, encoding='utf-8-sig'))
    fd = d['freeplayDJ']
    fd['text3'] = 'LIGHT IT UP AND KICK IT BACK'
    fd['colors'] = ['#DCD0FF', '#B49CFF', '#F1EAFF', '#6F4BD8', '#FFFFFF', '#4B2FA8', '#8A63E8', '#7A55E0']
    d['unlocked'] = True
    json.dump(d, open(p, 'w'), indent=1)
    print('darnell mixtape:', n, 'files')


if __name__ == '__main__':
    main()
