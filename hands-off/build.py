#!/usr/bin/env python3
"""Glue src/ into one standalone file: dist/hands-off.html"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'dist', 'hands-off.html')
SCRIPTS = ['core.js', 'gfx.js', 'glyphs.js', 'audio.js', 'main.js']


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def main():
    parts = []
    for name in SCRIPTS:
        if not os.path.exists(os.path.join(SRC, name)):
            print('skip (missing):', name)
            continue
        js = read(name)
        if '</script' in js.lower():
            sys.exit(name + ' contains </script')
        parts.append('<script>\n' + js + '\n</script>')
    html = '\n'.join([
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">',
        '<meta name="theme-color" content="#05030b">',
        '<meta name="description" content="HANDS OFF. Do nothing. Literally nothing. Touch anything and it all resets.">',
        '<title>HANDS OFF</title>',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Unbounded:wght@700;800;900&display=swap">',
        '<style>\n' + read('style.css') + '\n</style>',
        '</head>',
        '<body>',
        read('body.html'),
        *parts,
        '</body>',
        '</html>',
        '',
    ])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote', OUT, len(html.encode('utf-8')), 'bytes')


if __name__ == '__main__':
    main()
