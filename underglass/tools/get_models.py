# Downloads Poly Haven (CC0) glTF models at 1k into <out>/<id>/ . python3 -I get_models.py <out> id id ...
import json, os, sys, urllib.request, concurrent.futures as cf
out = sys.argv[1]; ids = sys.argv[2:]
def get(u): 
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 asset-fetch'}), timeout=60) as r: return r.read()
def one(i):
    d = os.path.join(out, i)
    if os.path.exists(os.path.join(d, 'done')): return i + ' cached'
    try:
        f = json.loads(get('https://api.polyhaven.com/files/' + i))
        g = f['gltf']['1k']['gltf']
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'model.gltf'), 'wb').write(get(g['url']))
        for rel, inc in g.get('include', {}).items():
            p = os.path.normpath(os.path.join(d, rel))
            if not p.startswith(d): continue
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(get(inc['url']))
        open(os.path.join(d, 'done'), 'w').write('1')
        return i + ' ok'
    except Exception as e: return i + ' FAIL ' + str(e)
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(one, ids): print(r, flush=True)
