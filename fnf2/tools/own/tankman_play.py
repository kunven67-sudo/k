"""Tankman as a real playable character, from the mod "Playable Tankman" (v1.1.1, by Adamatik, PugSquad + team,
GameBanana 545138). PRIVATE build only: the mod's art + music belong to its makers, so everything is copied into
the git-ignored build/mods folder, never the repo (credits in fnf2/private/CREDITS-mods.txt).

The mod is made for the real FNF engine (V-Slice), so its files go to the same places FNF's own do:
  character select  his chill animation + nametag, Steve (his tank buddy) on the speakers
  freeplay          his DJ (symbol animations), capsules, selector, numbers, background, album, his card's art
  songs             Tankman mixes of the songs FNF 2 has (Tutorial, Bopeebo, Fresh, DadBattle): his own voice
  play              playable Tankman (misses, cheer, death + retry), Steve as GF, breakfast + game over music
  results           his rank animations + results music, his sticker pack

The mod also remixes weeks 2-6; those come when FNF 2 has those weeks. No _merge patching: FNF 2 finds a player's
own song variation by itself (12-song.js), so two player packs never fight over the same metadata file.

  python3 tools/own/tankman_play.py [mod folder]
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/tankplay/x/Playable Tankman'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'tankman')   # this mod's pack folder
SONGS = ['tutorial', 'bopeebo', 'fresh', 'dadbattle']

FILES = [
    'data/players/tankman.json', 'data/characters/tankman-playable.json', 'data/characters/steve.json',
    'data/ui/freeplay/styles/tankman.json', 'data/ui/freeplay/albums/tankmanv1.json',
    'data/stickerpacks/standard-tankman.json',
    'images/charSelect/tankmanChill/*', 'images/charSelect/steveChill/*',
    'images/freeplay/freeplay-tankman/*', 'images/freeplay/freeplayBGdadTankman.png', 'images/freeplay/tankman/*',
    'images/freeplay/freeplayCapsule/capsule/freeplayCapsule_tankman.*',
    'images/freeplay/freeplaySelector/freeplaySelector_tankman.*',
    'images/freeplay/albumRoll/tankman*', 'images/digital_numbers_tankman.*',
    'shared/images/characters/tankmanCaptain.*', 'shared/images/characters/tankmanCaptain_playable.*',
    'shared/images/characters/tankmanCheer.*', 'shared/images/characters/tankmanMiss.*',
    'shared/images/characters/tankmanPico.*', 'shared/images/characters/captainpicomad.*',
    'shared/images/characters/tankman_DEAD_assets.*', 'shared/images/characters/steve_assets.*',
    'shared/images/resultScreen/results-tankman/*/*',
    'shared/images/transitionSwag/stickers-set-67/*',
    'shared/music/breakfast-tankman/*', 'shared/music/results*-tankman/*',
    'shared/music/gameplay/gameover/gameOver-tankman.ogg', 'shared/music/gameplay/gameover/gameOverEnd-tankman.ogg',
    'shared/sounds/gameplay/gameover/fnf_loss_sfx-tankman.ogg',
] + [f'data/songs/{s}/{s}-*-tankman.json' for s in SONGS] + [f'songs/{s}/*-tankman.ogg' for s in SONGS]

RENAME = {
    # FNF 2's own Tankman nametag (made from the menu letters) has this name already: the mod's (white, like FNF's
    # real ones) gets its own
    'images/charSelect/tankmanNametag.png': 'images/charSelect/tankmanplayNametag.png',
}


def dest(rel):
    # V-Slice libraries: images/, data/, music/ = 'preload'; shared/ and songs/ keep their names
    if rel.startswith(('shared/', 'songs/')): return rel
    return 'preload/' + rel


def main():
    if os.path.isdir(OWN): shutil.rmtree(OWN)
    n = 0
    for pat in FILES + list(RENAME):
        for src in glob.glob(os.path.join(glob.escape(MOD), pat)):
            if os.path.isdir(src): continue
            rel = os.path.relpath(src, MOD).replace(os.sep, '/')
            dst = os.path.join(OWN, dest(RENAME.get(rel, rel)))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst); n += 1

    # playable Tankman: the voice-line taunts live in an Animate atlas inside a multi-sparrow character (the mod's
    # scripts play them), and Windows didn't mind the death sheet's name in capitals: FNF 2 keeps the rest
    p = os.path.join(OWN, 'preload', 'data', 'characters', 'tankman-playable.json')
    d = json.load(open(p, encoding='utf-8-sig'))
    d['animations'] = [a for a in d['animations'] if 'yeahIsaidit' not in (a.get('assetPath') or '') and 'moretalking' not in (a.get('assetPath') or '')]
    for a in d['animations']:
        if a.get('assetPath') == 'characters/TANKMAN_DEAD_assets': a['assetPath'] = 'characters/tankman_DEAD_assets'
    json.dump(d, open(p, 'w'), indent=1)

    # his card (FNF 2 draws his own scene: sky, mountains, Steve's tank rolling by) + unlocked like everyone
    p = os.path.join(OWN, 'preload', 'data', 'players', 'tankman.json')
    d = json.load(open(p, encoding='utf-8-sig'))
    d['unlocked'] = True
    json.dump(d, open(p, 'w'), indent=1)
    print('playable tankman:', n, 'files')


if __name__ == '__main__':
    main()
