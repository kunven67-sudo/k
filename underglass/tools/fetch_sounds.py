# Downloads real CC0 recordings from freesound (search page, CC0 filter, most downloaded first).
import time, re, sys, json, urllib.request, urllib.parse, os, html
OUT = sys.argv[1]
Q = {  # name: (query, min_dur, max_dur)
 'field_hum': ('force field hum', 3, 60), 'field_hit': ('electric zap', 0.2, 4),
 'ice_freeze': ('ice freezing', 1, 15), 'ice_crack': ('ice crack', 0.3, 6), 'ice_shatter': ('glass shatter', 0.5, 5),
 'fire_loop': ('fire crackling', 8, 90), 'fire_ignite': ('torch ignite', 0.5, 5),
 'water_splash': ('water splash', 1, 6), 'water_drip': ('water drop single', 0.1, 2), 'water_pour': ('water pouring', 2, 30),
 'bh_drone': ('dark drone', 5, 60), 'whoosh': ('whoosh', 0.3, 3),
 'explosion': ('explosion', 1.5, 10), 'incoming': ('bomb whistle falling', 1, 6), 'beep': ('beep', 0.05, 1),
 'thunder': ('thunder crack close', 2, 15), 'electric': ('electric shock buzz', 0.5, 8),
 'wind': ('tornado', 5, 90), 'rumble': ('earthquake rumble', 3, 40), 'glass_crack': ('glass crack', 0.2, 4),
 'thud': ('body fall thud', 0.1, 2), 'squelch': ('slime squelch', 0.2, 4), 'lava': ('lava bubbling', 4, 60),
 'sizzle': ('sizzle hiss', 0.5, 8), 'blizzard': ('blizzard wind howling', 8, 90), 'hiccup': ('hiccup', 0.2, 2),
 'glitch': ('glitch digital', 0.5, 8), 'pop': ('pop', 0.05, 1), 'shimmer': ('magic shimmer', 0.5, 5),
 'band_stretch': ('rubber band stretch', 0.3, 5), 'band_snap': ('rubber band', 0.1, 3),
 'bubble_pop': ('bubble pop', 0.05, 1.5), 'bubbles': ('bubbles underwater', 2, 30), 'steam': ('steam hiss', 0.5, 8),
}
meta = {}
only = sys.argv[2:] 
for name, (q, lo, hi) in Q.items():
    if only and name not in only: continue
    time.sleep(4)
    url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': 'license:"Creative Commons 0"', 's': 'Downloads (most first)'})
    try:
        page = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode('utf8', 'ignore')
    except Exception as e:
        print(name, 'search fail', e); continue
    # each result: data-mp3 then data-duration nearby; title in a link
    found = None
    for m in re.finditer(r'data-mp3="([^"]+)"', page):
        seg = page[m.start(): m.start() + 3000]
        d = re.search(r'data-duration="([0-9.]+)"', seg)
        dur = float(d.group(1)) if d else 0
        if lo <= dur <= hi:
            found = (m.group(1).replace('-lq.mp3', '-hq.mp3'), dur); break
    if not found: print(name, 'no match'); continue
    mp3, dur = found
    sid = re.search(r'previews/\d+/(\d+)_', mp3).group(1)
    t = re.search(r'/sounds/' + sid + r'/"[^>]*>([^<]{1,120})<', page)
    try:
        data = urllib.request.urlopen(urllib.request.Request(mp3, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    except Exception as e:
        print(name, 'dl fail', e); continue
    open(os.path.join(OUT, name + '.mp3'), 'wb').write(data)
    meta[name] = {'id': sid, 'title': html.unescape(t.group(1).strip()) if t else '', 'dur': dur, 'query': q}
    print(name, sid, dur, meta[name]['title'])
old = {}
p = os.path.join(OUT, 'meta.json')
if os.path.exists(p): old = json.load(open(p))
old.update(meta); json.dump(old, open(p, 'w'), indent=1)
