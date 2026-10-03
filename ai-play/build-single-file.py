"""Packs AI Play (index.html + style.css + js/*.js) into ONE file: "AI Play.html" in the repo root.
Run:  python3 ai-play/build-single-file.py
"""
import pathlib, re

here = pathlib.Path(__file__).parent
html = (here / 'index.html').read_text(encoding='utf-8')

css = (here / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')

def inline_script(m):
    js = (here / m.group(1)).read_text(encoding='utf-8')
    js = js.replace('</script', '<\\/script')  # can't appear raw inside an inline <script>
    return '<script>\n/* ---- ' + m.group(1) + ' ---- */\n' + js + '\n</script>'

html = re.sub(r'<script src="(js/[\w.-]+\.js)"></script>', inline_script, html)
assert 'src="js/' not in html, 'a script was not inlined'
out = here.parent / 'AI Play.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, round(len(html.encode('utf-8')) / 1024), 'KB')
