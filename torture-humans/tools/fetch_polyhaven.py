# Downloads CC0 assets (textures, HDRIs, models) from Poly Haven for the game.
# Runs in GitHub Actions (the dev sandbox can't reach polyhaven.com) and the
# workflow commits the results to the "th-assets" branch.
#   python fetch_polyhaven.py <manifest.json> <out dir>
# The manifest lists asset ids per kind plus keyword searches, e.g.
#   {"textures": ["concrete_floor_02"], "search": {"textures": ["rust metal"]}, "res": "2k"}
# It also writes catalog.json (every Poly Haven asset + categories) so exact ids
# can be picked next time.
import json, os, sys, urllib.request, urllib.error, time

API = 'https://api.polyhaven.com'
UA = {'User-Agent': 'TortureHumans-asset-fetch/1.0 (github.com/kunven67-sudo/k)'}
TEX_MAPS = {  # our name -> Poly Haven map names to try, in order
    'color': ['Diffuse', 'diff'],
    'normal': ['nor_gl', 'Normal GL'],
    'rough': ['Rough', 'rough'],
    'ao': ['AO', 'ao'],
    'arm': ['arm'],
    'disp': ['Displacement', 'disp'],
    'metal': ['Metal', 'metal'],
}


def get_json(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:  # network hiccup: back off and retry
            print('retry', url, e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f'failed: {url}')


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(dest + '.part', 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            os.replace(dest + '.part', dest)
            return
        except Exception as e:
            print('retry', url, e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f'failed: {url}')


def pick(files, res, fmt_order=('jpg', 'png')):
    by_res = files.get(res) or files.get('2k') or files.get('1k') or next(iter(files.values()), {})
    for fmt in fmt_order:
        if fmt in by_res:
            return by_res[fmt]
    return None


def fetch_texture(aid, res, out):
    files = get_json(f'{API}/files/{aid}')
    got = {}
    for ours, names in TEX_MAPS.items():
        for n in names:
            if n in files:
                f = pick(files[n], res)
                if f:
                    ext = f['url'].rsplit('.', 1)[-1]
                    dest = os.path.join(out, 'textures', aid, f'{ours}.{ext}')
                    download(f['url'], dest)
                    got[ours] = os.path.relpath(dest, out)
                    break
    return got


def fetch_hdri(aid, res, out):
    files = get_json(f'{API}/files/{aid}')
    f = pick(files['hdri'], res, ('hdr', 'exr'))
    dest = os.path.join(out, 'hdri', f'{aid}.{f["url"].rsplit(".", 1)[-1]}')
    download(f['url'], dest)
    return {'file': os.path.relpath(dest, out)}


MAX_FILE = 90 * 1024 * 1024  # GitHub rejects files over 100 MB


def fetch_model(aid, res, out):
    files = get_json(f'{API}/files/{aid}')
    g = pick(files['gltf'], res, ('gltf',))
    sizes = [g.get('size', 0)] + [inc.get('size', 0) for inc in (g.get('include') or {}).values()]
    if max(sizes) > MAX_FILE:
        raise RuntimeError(f'too big for git ({max(sizes) // (1024 * 1024)} MB file); pick a lighter model')
    base = os.path.join(out, 'models', aid)
    download(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, inc in (g.get('include') or {}).items():
        download(inc['url'], os.path.join(base, rel))
    return {'gltf': os.path.relpath(os.path.join(base, os.path.basename(g['url'])), out)}


def main():
    manifest = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    res = manifest.get('res', '2k')
    catalog = {}
    for kind, t in (('textures', 'textures'), ('hdris', 'hdris'), ('models', 'models')):
        catalog[kind] = {k: {'name': v.get('name'), 'categories': v.get('categories'), 'tags': v.get('tags')} for k, v in get_json(f'{API}/assets?t={t}').items()}
    json.dump(catalog, open(os.path.join(out, 'catalog.json'), 'w'), indent=0, sort_keys=True)

    wanted = {k: list(manifest.get(k, [])) for k in ('textures', 'hdris', 'models')}
    for kind, queries in (manifest.get('search') or {}).items():
        for q in queries:
            words = q.lower().split()
            hits = [aid for aid, meta in catalog[kind].items()
                    if all(w in (aid + ' ' + ' '.join(meta.get('tags') or []) + ' ' + ' '.join(meta.get('categories') or [])).lower() for w in words)]
            print(f'search {kind} "{q}": {hits[:8]}')
            wanted[kind] += hits[: manifest.get('perSearch', 2)]

    index = {'textures': {}, 'hdris': {}, 'models': {}}
    fetchers = {'textures': fetch_texture, 'hdris': fetch_hdri, 'models': fetch_model}
    for kind, ids in wanted.items():
        for aid in dict.fromkeys(ids):  # dedupe, keep order
            if aid not in catalog[kind]:
                print('UNKNOWN', kind, aid)
                continue
            try:
                index[kind][aid] = fetchers[kind](aid, manifest.get('resOverride', {}).get(aid, res), out)
                print('OK', kind, aid)
            except Exception as e:
                print('FAILED', kind, aid, e)
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
