"""Change a few files inside a made pack (build/packs/<id>.head.js + .body*.js) without making the whole pack again
(PRIVATE build only: packs never go in this repo). For a fix to one or two pictures when the pack's mod folder
(build/mods/<id>) isn't on this machine: everything else stays byte for byte the same.

  python3 tools/own/packpatch.py <id> [--root DIR] [--drop REGEX ...]
    --root  files to add or replace, at their pack paths inside DIR (e.g. DIR/shared/images/x.png); they are
            packed like tools/pack_assets.py does (tight Sparrow sheets, pages, WebP)
    --drop  pack paths to take out (regex)
  The pack's name / credit / version come from PACK_INFO in tools/pack_assets.py again (bump 'v' there first).
"""
import os, sys, re, json, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE))
import pack_assets as PA

PACKS = os.path.join(ROOT, 'build', 'packs')


def read_call(path, name):
    """'...name(a, b, ...);' -> [a, b, ...] (JSON values)"""
    txt = open(path).read()
    i = txt.index(name + '(') + len(name) + 1
    dec, out = json.JSONDecoder(), []
    while True:
        while txt[i] in ' \n,': i += 1
        if txt[i] == ')': return out
        v, i = dec.raw_decode(txt, i); out.append(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('id'); ap.add_argument('--root'); ap.add_argument('--drop', nargs='*', default=[])
    a = ap.parse_args()
    pid = a.id
    meta, head = read_call(os.path.join(PACKS, pid + '.head.js'), 'FNF_PACK')
    parts = []
    for i in range(1, meta.get('bodyParts', 1) + 1):
        p = os.path.join(PACKS, pid + '.body' + (str(i) if i > 1 else '') + '.js')
        parts.append(read_call(p, 'FNF_PACK_BODY')[1])
    gone = 0
    for rx in a.drop:
        r = re.compile(rx)
        for d in [head] + parts:
            for k in [k for k in d if r.search(k)]: del d[k]; gone += 1
        for k in [k for k in meta.get('body', {}) if r.search(k)]: del meta['body'][k]
    new = {}
    if a.root:
        srcs = {}
        for d, _, fs in os.walk(a.root):
            for f in fs:
                rel = os.path.relpath(os.path.join(d, f), a.root).replace(os.sep, '/')
                srcs[rel] = os.path.join(d, f)
        new = PA.convert(srcs)
    from PIL import Image
    from io import BytesIO
    import base64
    for rel, data in new.items():
        for d in [head] + parts: d.pop(rel, None)
        meta.get('body', {}).pop(rel, None)
        ext = os.path.splitext(rel)[1].lower()
        small_pic = ext == '.png' and (rel.startswith(PA.HEAD_PICS) or len(data) < 160000)
        if ext in ('.json', '.xml', '.txt', '.srt', '.ttf', '.otf') or small_pic: head[rel] = data; continue
        w = h = 0
        if ext == '.png':
            try: w, h = Image.open(BytesIO(base64.b64decode(data[data.index(',') + 1:]))).size
            except Exception: pass
        parts[-1][rel] = data; meta.setdefault('body', {})[rel] = [len(data), w, h]
    if sum(len(v) for v in parts[-1].values()) > 90 * 1048576: sys.exit('the last body part would be over 90 MB: make the pack again instead')
    meta.update(PA.PACK_INFO.get(pid, {}), id=pid)
    tag = lambda part, **x: '/*FNF-PACK ' + json.dumps(dict(id=pid, name=meta['name'], part=part, **x)) + '*/\n'
    note = "/* PRIVATE BUILD: art + music belong to their makers (see the credits). Not for public distribution. */\n"
    with open(os.path.join(PACKS, pid + '.head.js'), 'w') as f:
        f.write(tag('head', parts=len(parts)) + note + 'FNF_PACK(' + json.dumps(meta, separators=(',', ':')) + ',' + json.dumps(head, separators=(',', ':')) + ');\n')
    for i, part in enumerate(parts, 1):
        with open(os.path.join(PACKS, pid + '.body' + (str(i) if i > 1 else '') + '.js'), 'w') as f:
            f.write(tag('body', n=i, of=len(parts)) + note + 'FNF_PACK_BODY(' + json.dumps(pid) + ',' + json.dumps(part, separators=(',', ':')) + f',{i},{len(parts)});\n')
    PA.write_index(PACKS)
    print(f'pack {pid} v{meta.get("v", 1)}: {len(new)} files in, {gone} out: ' + ', '.join(sorted(new)))


if __name__ == '__main__':
    main()
