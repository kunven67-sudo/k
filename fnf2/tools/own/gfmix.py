"""Girlfriend from "Girlfriend Mix REDUX" (GameBanana 615434: retr0's GF mixes, ported to Psych Engine by Ledonic) for
FNF 2 - PRIVATE build only. Its GF_V3 (GF on her feet with a mic, red dress) takes the place of the 'geef' GF that Nene
raps against in her own songs (Nene, Bubbles, Sharp): src/12-song.js G.CHAR_SWAP. Writes the git-ignored
build/mods/gfmix pack (credits in fnf2/private/CREDITS-mods.txt).

  python3 tools/own/gfmix.py [mod folder]
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import impostor as IM

MOD = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('GFMIX', '/home/user/ref/mods/gfredux/x/Gf Redux')
OUT = os.environ.get('FNF_OWN') or os.path.join(ROOT, 'build', 'mods', 'gfmix')
CID = 'gf-mix'

def M(*p): return os.path.join(MOD, *p)
def put(src, *dst):
    d = os.path.join(OUT, *dst); os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(src, d); return d


def main():
    cj = json.load(open(M('characters', 'GF_V3.json'), encoding='utf-8-sig'))
    for ext in ('.png', '.xml'): put(M('images', 'characters', 'GF_V3' + ext), 'shared', 'images', 'gfmix', 'GF_V3' + ext)
    put(M('images', 'icons', 'triple-icons', 'icon-gfv3.png'), 'preload', 'images', 'icons', 'icon-%s.png' % CID)
    class _P:
        def path(self, *p):
            f = os.path.join(OUT, *p); os.makedirs(os.path.dirname(f), exist_ok=True); return f
    IM.pixel_icon(_P(), M('images', 'icons', 'triple-icons', 'icon-gfv3.png'), CID)
    s = cj.get('scale', 1)
    # (V-Slice placing, like the 'geef' she stands in for: feet on the stage's spot, so no Psych 'position')
    d = {'version': '1.0.0', 'name': 'Girlfriend', 'renderType': 'sparrow', 'assetPath': 'shared:gfmix/GF_V3', 'scale': s,
         'flipX': bool(cj.get('flip_x')), 'offsets': [0, 0], 'cameraOffsets': [0, 0], 'singTime': cj.get('sing_duration', 4),
         'danceEvery': 1, 'healthIcon': {'id': CID}, 'healthColor': IM.color(cj.get('healthbar_colors')),
         'animations': [a for a in IM.anim_list(cj, 'sparrow', div=s) if a['name'] not in ('preAttack', 'attack', 'hurt')]}
    p = os.path.join(OUT, 'preload', 'data', 'characters', CID + '.json'); os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(d, open(p, 'w'), indent=1)
    print('gfmix:', CID, [a['name'] for a in d['animations']])


if __name__ == '__main__':
    main()
