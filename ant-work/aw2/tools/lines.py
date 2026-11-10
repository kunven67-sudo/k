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
def expr_end(s, i):
    """end of the JS expression that starts at i (stops at a top-level , ) ] or })"""
    d = 0; q = None; j = i
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\': j += 2; continue
            if c == q: q = None
        elif c in '"\'`': q = c
        elif c in '([{': d += 1
        elif c in ')]}':
            if d == 0: return j
            d -= 1
        elif c == ',' and d == 0: return j
        j += 1
    return j
glued = []
def literals(src, a, b, depth=0):
    """every whole sentence the expression src[a:b] can say: plain strings, both sides of a ?:,
    pick([...]) lists, and arrays it reads from (const lines=[...] just before it).
    Strings glued to a number ("You've got "+coins) can't be recorded: reported, and should be rewritten."""
    expr = src[a:b]; out = []
    for m in re.finditer(STR, expr):
        lit = m.group(1)
        if lit.startswith('`') and '${' in lit: glued.append(clean(lit)[:60]); continue
        pre = expr[:m.start()].rstrip(); post = expr[m.end():].lstrip()
        if pre.endswith('+') or post.startswith('+'): glued.append(clean(unq(lit))[:60]); continue
        if post.startswith('.') or post.startswith('['): continue   # 'abc'.split(...) etc.
        t = clean(unq(lit))
        if len(t) >= 2 and re.search('[A-Za-z]', t): out.append(t)
    if depth == 0:
        for nm in set(re.findall(r'(?<![\w$.\'"])([A-Za-z_$][\w$]*)\s*(?:\[|\))', expr)) | set(re.findall(r'pick\(\s*([A-Za-z_$][\w$]*)\s*\)', expr)):
            if nm in ('pick', 'Math', 'min', 'max'): continue
            d = None
            for dm in re.finditer(r'(?:const|let|var)\s+' + re.escape(nm) + r'\s*=\s*\[', src[max(0, a - 900):a]): d = dm
            if d:
                st = max(0, a - 900) + d.end(); en = expr_end(src, st)
                out += literals(src, st, en, 1)
    return out
lines = {}; clash = []
def add(t, who, f):
    k = fnv(t.lower())
    if k in lines and lines[k]['who'] != who: clash.append((t[:50], lines[k]['who'], who)); return
    lines[k] = {'who': who, 'text': t, 'src': f}
unknown = []
for f in sorted(glob.glob(SRC + '/*.js')):
    b = os.path.basename(f)
    if b in ('58b_voice.js', '95_funny.js'): continue
    src = open(f, encoding='utf-8').read()
    for m in re.finditer(r'\btext:', src):
        e = expr_end(src, m.end()); ts = literals(src, m.end(), e)
        if not ts: continue
        who = who_of(src, m.start())
        if not who: unknown.append((b, ts[0][:70])); continue
        for t in ts: add(t, who, b)
    for m in re.finditer(r'\bbark\(\s*\'([A-Za-z]+)\'\s*,', src):
        e = expr_end(src, m.end())
        for t in literals(src, m.end(), e): add(t, m.group(1), b)
    for m in re.finditer(r'larrySay\(', src):
        if src[m.start()-9:m.start()] == 'function ': continue
        e = expr_end(src, m.end())
        for t in literals(src, m.end(), e): add(t, 'Larry', b)
    if b == '51_bighouse.js':   # said('key',[...lines]) = you looking at stuff in the big house
        for m in re.finditer(r'said\(\s*\'\w+\'\s*,', src):
            e = expr_end(src, m.end())
            for t in literals(src, m.end(), e): add(t, 'You', b)
# (Jim's photo comments, TINY_LINES, are said by Jim = old voice, so they're NOT recorded)
os.makedirs('assets/voice', exist_ok=True)
json.dump(lines, open('assets/voice/lines.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(lines), 'lines;', len(glued), 'glued to numbers (can\'t record, rewrite them);', len(unknown), 'unknown speaker;', len(clash), 'same words, 2 speakers')
print(Counter(v['who'] for v in lines.values()).most_common())
for g in glued: print('  glued:', g)
for u in unknown[:40]: print('  ?', u)
for c in clash: print('  clash:', c)
