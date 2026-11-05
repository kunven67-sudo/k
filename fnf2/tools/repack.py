#!/usr/bin/env python3
"""Unpack / repack a built mod pack (build/packs/<id>.head.js + .body*.js) without making it again from the mod.
  python3 tools/repack.py unpack <id> <folder>     -> <folder>/meta.json + <folder>/files/<path> (+ mimes.json)
  python3 tools/repack.py pack <id> <folder> [v]   -> build/packs/<id>.head.js + .body.js from the folder (v = new version)
Text files (json/xml/txt) go back as text, everything else as a data: URI with its old type."""
import base64, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PK = os.path.join(ROOT, 'build', 'packs')
dec = json.JSONDecoder()

def args(s, fun):
    i = s.index(fun + '(') + len(fun) + 1; s = s[i:s.rindex(');')]
    out = []
    while s:
        v, e = dec.raw_decode(s); out.append(v); s = s[e:].lstrip(',')
    return out

def unpack(pid, d):
    meta, head = args(open(os.path.join(PK, pid + '.head.js')).read(), 'FNF_PACK')
    body = {}
    for fn in sorted(os.listdir(PK)):
        if re.match(re.escape(pid) + r'\.body\d*\.js$', fn): body.update(args(open(os.path.join(PK, fn)).read(), 'FNF_PACK_BODY')[1])
    mimes, where = {}, {}
    for part, files in (('head', head), ('body', body)):
        for k, v in files.items():
            p = os.path.join(d, 'files', k); os.makedirs(os.path.dirname(p), exist_ok=True)
            where[k] = part
            if v.startswith('data:'): mimes[k] = v[5:v.index(';')]; open(p, 'wb').write(base64.b64decode(v[v.index(',') + 1:]))
            else: open(p, 'w').write(v)
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    json.dump({'mimes': mimes, 'where': where}, open(os.path.join(d, 'mimes.json'), 'w'), indent=1)
    print(f'unpacked {len(where)} files')

def pack(pid, d, v=None):
    meta = json.load(open(os.path.join(d, 'meta.json'))); mm = json.load(open(os.path.join(d, 'mimes.json')))
    head, body, sizes = {}, {}, {}
    for k, part in mm['where'].items():
        p = os.path.join(d, 'files', k)
        data = ('data:' + mm['mimes'][k] + ';base64,' + base64.b64encode(open(p, 'rb').read()).decode()) if k in mm['mimes'] else open(p).read()
        (head if part == 'head' else body)[k] = data
        if part == 'body': sizes[k] = [len(data)] + (meta.get('body', {}).get(k, [0, 0, 0])[1:])
    meta['body'] = sizes
    if v is not None: meta['v'] = int(v)
    parts, cur, size = [], {}, 0
    for k, x in body.items():
        if cur and size + len(x) > 90 * 1048576: parts.append(cur); cur, size = {}, 0
        cur[k] = x; size += len(x)
    if cur or not parts: parts.append(cur)
    meta['bodyParts'] = len(parts)
    tag = lambda part, **x: '/*FNF-PACK ' + json.dumps(dict(id=pid, name=meta.get('name', pid), part=part, **x)) + '*/\n'
    note = "/* PRIVATE BUILD: art + music belong to their makers (see the credits). Not for public distribution. */\n"
    with open(os.path.join(PK, pid + '.head.js'), 'w') as f:
        f.write(tag('head', parts=len(parts)) + note + 'FNF_PACK(' + json.dumps(meta, separators=(',', ':')) + ',' + json.dumps(head, separators=(',', ':')) + ');\n')
    for old in os.listdir(PK):
        if re.match(re.escape(pid) + r'\.body\d*\.js$', old): os.remove(os.path.join(PK, old))
    for i, part in enumerate(parts, 1):
        with open(os.path.join(PK, pid + '.body' + (str(i) if i > 1 else '') + '.js'), 'w') as f:
            f.write(tag('body', n=i, of=len(parts)) + note + 'FNF_PACK_BODY(' + json.dumps(pid) + ',' + json.dumps(part, separators=(',', ':')) + f',{i},{len(parts)});\n')
    print(f'packed {pid} v{meta.get("v")}: head {len(head)} files, body {len(body)} files in {len(parts)} part(s)')

if __name__ == '__main__':
    cmd, pid, d = sys.argv[1:4]
    unpack(pid, d) if cmd == 'unpack' else pack(pid, d, sys.argv[4] if len(sys.argv) > 4 else None)
