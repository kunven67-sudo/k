# download a Poly Haven model (1k glTF) + merge color/alpha for see-through materials
import json, sys, os, urllib.request
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'Mozilla/5.0 ironblood-asset-fetch')]; urllib.request.install_opener(op)
from PIL import Image
name = sys.argv[1]
d = json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{name}'))
g = d['gltf']['1k']['gltf']
os.makedirs(f'{name}/textures', exist_ok=True)
urllib.request.urlretrieve(g['url'], f'{name}/{name}_1k.gltf')
for k, v in g['include'].items(): urllib.request.urlretrieve(v['url'], f'{name}/{k}')
cards = {}
for k in d:
    if k.endswith('_alpha') and '1k' in d[k]:
        base = k[:-6]
        if base + '_diff' not in d: continue
        dp, ap = f'{name}/{base}_diffpng.png', f'{name}/{base}_alphapng.png'
        urllib.request.urlretrieve(d[base + '_diff']['1k']['png']['url'], dp)
        urllib.request.urlretrieve(d[k]['1k']['png']['url'], ap)
        im = Image.open(dp).convert('RGB'); a = Image.open(ap).convert('L').resize(im.size)
        im.putalpha(a); out = f'{name}/{base}_rgba.png'; im.save(out, optimize=True)
        cards[f'{name}_{base}'] = out
print(json.dumps(cards))
