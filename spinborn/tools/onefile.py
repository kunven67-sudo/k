"""Pack SPINBORN into ONE .html file (no .exe, no server): game code, GS3 kit, fonts, music, sounds and memes inside.
Usage: python3 tools/onefile.py OUT.html   (run `node tools/build.mjs` first)"""
import base64, os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
MIME = {'.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.css': 'text/css'}

def b64(path):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

def data_url(path):
    return 'data:%s;base64,%s' % (MIME[os.path.splitext(path)[1]], b64(path))

# every file the game asks for at runtime
files = {}
for top in ['assets/memes', 'assets/audio']:
    for d, _, fs in os.walk(os.path.join(ROOT, top)):
        for f in fs:
            ext = os.path.splitext(f)[1]
            if ext in MIME:
                rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
                files[rel] = [MIME[ext], b64(rel)]
for f in os.listdir(os.path.join(ROOT, 'gs3kit/fonts')):
    rel = 'gs3kit/fonts/' + f
    files[rel] = [MIME['.woff2'], b64(rel)]

# GS3 kit css with its fonts inside
css = open(os.path.join(ROOT, 'gs3kit/gs3-console.css'), encoding='utf-8').read()
css = re.sub(r"url\('fonts/([^']+)'\)", lambda m: "url('%s')" % data_url('gs3kit/fonts/' + m.group(1)), css)
css_url = 'data:text/css;base64,' + base64.b64encode(css.encode('utf-8')).decode('ascii')

kit_js = open(os.path.join(ROOT, 'gs3kit/gs3-console.js'), encoding='utf-8').read()
game_js = open(os.path.join(ROOT, 'game.js'), encoding='utf-8').read()
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

def safe(js):  # never end the <script> early
    return js.replace('</script', '<\\/script')

loader = """
window.SB_FILES = %s;
(function () {
  var cache = {};
  window.SB_URL = function (p) {
    p = String(p).replace(/^\\.\\//, '');
    if (cache[p]) return cache[p];
    var f = window.SB_FILES[p]; if (!f) return p;
    var bin = atob(f[1]), n = bin.length, u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    f[1] = null;
    return (cache[p] = URL.createObjectURL(new Blob([u8], { type: f[0] })));
  };
})();
""" % json.dumps(files, separators=(',', ':'))

html = html.replace('<link rel="icon" href="assets/icon.png">\n', '')
html = html.replace('<script src="gs3kit/gs3-console.js"></script>',
                    '<link data-gs3-kit rel="stylesheet" href="%s">\n<script>%s</script>' % (css_url, safe(kit_js)))
html = html.replace('<script type="module" src="game.js"></script>',
                    '<script>%s</script>\n<script type="module">%s</script>' % (safe(loader), safe(game_js)))
assert 'src="game.js"' not in html and 'gs3kit/gs3-console.js' not in html
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)
print(OUT, round(os.path.getsize(OUT) / 1048576, 1), 'MB,', len(files), 'files inside')
