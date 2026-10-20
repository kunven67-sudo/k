"""Nene as a real playable character, from the mod "NENE MIXES" (by d4rkwinged + team: PurSnake, Redar13, KerSive,
juztexd, geka, Voideeeee, Mio OwO; GameBanana 664062). PRIVATE build only: the mod's art + music belong to its makers,
so everything is copied into the git-ignored build/mods folder, never the repo (credits in fnf2/private/CREDITS-mods.txt).

The mod is made for the real FNF engine (V-Slice), so its files go to the same places FNF's own do:
  character select  her chill animation + nametag, Cassandra on the speakers
  freeplay          her DJ (symbol animations), capsules, selector, background, album, her card's art (sketches + seal)
  songs             Nene mixes of the songs FNF 2 has (Bopeebo, Darnell, Guns): her own voice
  play              playable Nene (misses, cheer, laugh, her death), Cassandra as GF, breakfast + game over music
  results           her rank animations + results music, her sticker pack

The mod also remixes Spookeez, Pico, High, Eggnog and Senpai; those come when FNF 2 has those weeks.
Her singing character is called 'nene-playable' in the mod, the same name as the Playable Nene (ZenUnique) that sings
Nene's own songs (the 'nene' pack), so here it's renamed 'nenemix-playable'. The player file becomes players/nene.json
(FNF 2's Nene) and owns both.

  python3 tools/own/nene_mix.py [mod folder]
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
MOD = sys.argv[1] if len(sys.argv) > 1 else '/home/user/ref/mods/nenemixes/x'
OWN = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'nenemix')   # this mod's pack folder
SONGS = ['bopeebo', 'darnell', 'guns']
# (FNF 2 has the plain versions of these stages)
STAGES = {'phillyStreetsErect': 'phillyStreets', 'tankmanBattlefieldErect': 'tankmanBattlefield'}

FILES = [
    'data/characters/cassandra-boom.json', 'data/characters/cassandra-boom-week7.json',
    'data/ui/freeplay/styles/nene.json', 'data/ui/freeplay/albums/nenemixes1.json',
    'data/stickerpacks/standard-nene.json',
    'images/charSelect/neneplayerChill/*', 'images/charSelect/dipshitCass/*', 'images/charSelect/neneplayerNametag.png',
    'images/freeplay/freeplay-nene/*', 'images/freeplay/freeplayBGweek1-nene.png', 'images/freeplay/nenecard/*',
    'images/freeplay/freeplayCapsule/capsule/freeplayCapsule_nene.*',
    'images/freeplay/freeplaySelector/freeplaySelector_nene.*',
    'images/freeplay/albumRoll/nenemixes1*', 'images/icons/icon-nene-playble.png', 'images/icons/icon-cass.png',
    'images/freeplay/icons/nene-playablepixel.*', 'images/freeplay/icons/neneplayerpixel.*',
    'shared/images/characters/nene/nene-playable/*', 'shared/images/characters/nene/nene-death/*',
    'shared/images/characters/cass/cassandra/*', 'shared/images/characters/cass/cassandra-week7/*',
    'shared/images/resultScreen/results-nene/*/*', 'shared/images/resultScreen/results-nene/*/*/*',
    'shared/images/transitionSwag/nenemix-stickers/*',
    'shared/music/breakfast-nene/*', 'shared/music/results*-nene/*',
    'shared/music/gameplay/gameover/gameOver-nene.ogg', 'shared/music/gameplay/gameover/gameOverEnd-nene.ogg',
    'shared/sounds/gameplay/gameover/fnf_loss_sfx-nene.ogg',
] + [f'data/songs/{s}/{s}-*-nene.json' for s in SONGS] + [f'songs/{s}/*-nene.ogg' for s in SONGS]


def dest(rel):
    # V-Slice libraries: images/, data/, music/ = 'preload'; shared/ and songs/ keep their names
    if rel.startswith(('shared/', 'songs/')): return rel
    return 'preload/' + rel


def load(p): return json.load(open(p, encoding='utf-8-sig'))


def save(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(d, open(p, 'w'), indent=1)


def main():
    if os.path.isdir(OWN): shutil.rmtree(OWN)
    n = 0
    for pat in FILES:
        for src in glob.glob(os.path.join(glob.escape(MOD), pat)):
            if os.path.isdir(src): continue
            rel = os.path.relpath(src, MOD).replace(os.sep, '/')
            dst = os.path.join(OWN, dest(rel))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst); n += 1

    # her singing character, renamed; her death (the mod's script plays an atlas 300 px to the left) as real
    # death animations
    c = load(os.path.join(MOD, 'data/characters/nene-playable.json'))
    death = 'shared:characters/nene/nene-death'
    c['animations'] += [
        dict(name='firstDeath', prefix='fisrt death', assetPath=death, animType='framelabel', offsets=[300, 0], frameRate=24, looped=False),
        dict(name='deathLoop', prefix='loop', assetPath=death, animType='framelabel', offsets=[300, 0], frameRate=24, looped=True),
        dict(name='deathConfirm', prefix='comfinrm', assetPath=death, animType='framelabel', offsets=[300, 0], frameRate=24, looped=False),
    ]
    c['script'] = ''   # (not the Nene on the A-Bot)
    save(os.path.join(OWN, 'preload/data/characters/nenemix-playable.json'), c)

    # her songs: the renamed character, FNF 2's stages
    for s in SONGS:
        p = os.path.join(OWN, f'preload/data/songs/{s}/{s}-metadata-nene.json')
        m = load(p); pd = m['playData']
        pd['characters']['player'] = 'nenemix-playable'
        pd['stage'] = STAGES.get(pd.get('stage'), pd.get('stage'))
        save(p, m)

    # the player: FNF 2's Nene (players/nene.json), owning this Nene and the Playable Nene of her own songs
    d = load(os.path.join(MOD, 'data/players/neneplayer.json'))
    d['name'] = 'Nene'
    d['ownedChars'] = ['nenemix-playable', 'nene-playable']
    d['unlocked'] = True
    save(os.path.join(OWN, 'preload/data/players/nene.json'), d)
    print('nene mixes:', n, 'files')


if __name__ == '__main__':
    main()
