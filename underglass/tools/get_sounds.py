# CC0 sounds from freesound.org previews. python3 -I get_sounds.py <rawdir> <outdir> ; list below = name|query|minDur|maxDur|trimTo
import re, os, sys, subprocess, urllib.request, urllib.parse, html
raw, out = sys.argv[1], sys.argv[2]
L = """tear_plastic|plastic crack snap|0.2|4|2
tear_paper|paper rip|0.3|5|2
glass_shatter|glass shatter|0.4|6|3
impact_wood|wood impact|0.1|3|1.5
impact_metal|metal impact clang|0.1|4|2
impact_plastic|plastic hit|0.1|3|1.2
laser|laser beam loop|1|12|4
punch|punch impact|0.1|2|1
poof|magic poof|0.2|3|2
gunshot|gunshot pistol|0.2|3|2
siren|police siren|3|30|8
fuse|fuse burning|1|15|5
big_boom|huge explosion|2|15|7
day_amb|birds ambience countryside|20|300|40
night_amb|crickets night ambience|20|300|40
town_amb|small town ambience people|20|300|40
pub_amb|pub ambience chatter|20|300|40
feedback|microphone feedback|0.5|8|3
door|door open close|0.4|4|2
pop_click|mouse click|0.05|1|0.5
meteor|meteor impact|1|10|5
baby|baby cry|1|10|4
cheer|crowd cheer|1|10|4
swallow|drinking gulp|0.3|4|2
eat|eating crunch|0.3|4|2
sleep|snoring|1|10|4"""
os.makedirs(raw, exist_ok=True); os.makedirs(out, exist_ok=True)
cred = open(os.path.join(out, 'CREDITS-underglass.txt'), 'a')
for line in L.split('\n'):
    name, q, lo, hi, trim = line.split('|'); lo, hi = float(lo), float(hi)
    if os.path.exists(os.path.join(out, name + '.ogg')): continue
    u = 'https://freesound.org/search/?q=' + urllib.parse.quote_plus(q) + '&f=license%3A%22Creative+Commons+0%22'
    try:
        h = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read().decode('utf8', 'ignore')
    except Exception as e: print('FAIL search', name, e); continue
    # each result block: sound link, title, mp3, duration
    blocks = re.split(r'(?=href="/people/[^/]+/sounds/\d+/")', h)
    done = False
    for b in blocks:
        m = re.match(r'href="/people/([^/]+)/sounds/(\d+)/"', b)
        mp3 = re.search(r'data-mp3="([^"]+)"', b); du = re.search(r'duration="([\d.]+)"', b)
        if not (m and mp3 and du): continue
        d = float(du.group(1))
        if d < lo or d > hi: continue
        url = mp3.group(1).replace('-lq.mp3', '-hq.mp3'); sid = m.group(2)
        rp = os.path.join(raw, name + '.mp3')
        try: open(rp, 'wb').write(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read())
        except Exception as e: print('FAIL dl', name, e); continue
        op = os.path.join(out, name + '.ogg')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', rp, '-t', trim, '-af', 'loudnorm=I=-18:TP=-1.5,afade=t=out:st=%s:d=0.3' % max(0, float(trim) - 0.3) if float(trim) < d else 'loudnorm=I=-18:TP=-1.5', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '4', op], check=False)
        cred.write('%s.ogg  <-  freesound sound #%s by %s  https://freesound.org/s/%s/  (CC0)\n' % (name, sid, m.group(1), sid))
        print('ok', name, sid, d); done = True; break
    if not done: print('NONE', name)
