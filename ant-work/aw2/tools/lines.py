"""Pull every spoken line out of Ant Work 2's source and guess who says it.
Writes assets/voice/lines.json  {id: {who, text}}   (id = fnv1a32 of the cleaned, lower-cased text)
Run: python3 tools/lines.py"""
import re, json, os, glob, sys
SRC = 'src'
def clean(t):
    t = re.sub(r'<[^>]+>', '', t); t = re.sub(r'\*[^*]*\*', '', t)
    t = re.sub(r"[^\x20-\x7E’'—–…]", '', t); return re.sub(r'\s+', ' ', t).strip()
def fnv(s):
    h = 0x811c9dc5
    for ch in s.encode('utf-16-le')[::2]:   # JS charCodeAt low byte for ASCII text
        h ^= ch; h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
STR = r'''("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`)'''
def unq(s):
    q = s[0]; b = s[1:-1]
    return b.replace('\\'+q, q).replace("\\n", ' ').replace('\\\\', '\\')
def obj_bounds(src, pos):
    d = 0; i = pos
    while i >= 0:
        c = src[i]
        if c == '}': d += 1
        elif c == '{':
            if d == 0: break
            d -= 1
        i -= 1
    j = pos; d = 0
    while j < len(src):
        c = src[j]
        if c == '{': d += 1
        elif c == '}':
            if d == 0: break
            d -= 1
        j += 1
    return i, j
def who_of(src, pos):
    a, b = obj_bounds(src, pos); o = src[a:b+1]
    m = re.search(r"voice:\s*'([A-Za-z0-9 ]+)'", o) or re.search(r"who:\s*'([A-Za-z0-9 ]+)'", o)
    if m: return m.group(1)
    m = re.search(r'\.\.\.([A-Za-z_$][\w$]*)', o)
    if m:
        name = m.group(1)
        last = None
        for d in re.finditer(r'(?<![\w$.])' + re.escape(name) + r'\s*=\s*\{([^{}]*)\}', src[:pos]): last = d
        if last is None:
            for d in re.finditer(r'(?<![\w$.])' + re.escape(name) + r'\s*=\s*\{([^{}]*)\}', src): last = d
        if last is not None:
            mm = re.search(r"voice:\s*'([A-Za-z0-9 ]+)'", last.group(1)) or re.search(r"who:\s*'([A-Za-z0-9 ]+)'", last.group(1))
            if mm: return mm.group(1)
    return None
lines = {}; unknown = []; dyn = 0
for f in sorted(glob.glob(SRC + '/*.js')):
    if os.path.basename(f) in ('58b_voice.js', '95_funny.js'): continue
    src = open(f, encoding='utf-8').read()
    for m in re.finditer(r'\btext:\s*' + STR, src):
        lit = m.group(1)
        if lit.startswith('`') and '${' in lit: dyn += 1; continue
        t = clean(unq(lit)); who = who_of(src, m.start())
        if not t: continue
        if not who: unknown.append((os.path.basename(f), t[:70])); continue
        lines[fnv(t.lower())] = {'who': who, 'text': t, 'src': os.path.basename(f)}
    for m in re.finditer(r'larrySay\(\s*' + STR, src):
        t = clean(unq(m.group(1)))
        if t: lines[fnv(t.lower())] = {'who': 'Larry', 'text': t, 'src': os.path.basename(f)}
    for m in re.finditer(r'\bbark\(\s*\'([A-Za-z]+)\'\s*,\s*' + STR, src):
        t = clean(unq(m.group(2)))
        if t: lines[fnv(t.lower())] = {'who': m.group(1), 'text': t, 'src': os.path.basename(f)}
# TINY_LINES: Larry's comments on the things you photograph
s30 = open(SRC + '/30_storyA.js', encoding='utf-8').read()
i = s30.index('const TINY_LINES={'); blk = s30[i:s30.index('};', i)]
for m in re.finditer(STR, blk):
    t = clean(unq(m.group(1)))
    if len(t) > 12 and ' ' in t: lines.setdefault(fnv(t.lower()), {'who': 'Larry', 'text': t, 'src': '30_storyA.js'})
os.makedirs('assets/voice', exist_ok=True)
json.dump(lines, open('assets/voice/lines.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(lines), 'lines;', dyn, 'built at runtime (computer voice);', len(unknown), 'unknown speaker')
print(Counter(v['who'] for v in lines.values()).most_common())
for u in unknown[:40]: print('  ?', u)
