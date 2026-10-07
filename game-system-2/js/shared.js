/* Game System 2.0 — code shared by the app and the service worker (no DOM). */
(function (root) {
  'use strict';

  var APP_VERSION = '2.3.0';

  /* Every file of the app itself (used for offline caching and for "Build website folder") */
  var APP_FILES = [
    'index.html', 'manifest.webmanifest', 'sw.js', '_headers',
    'css/app.css',
    'js/shared.js', 'js/db.js', 'js/zip.js', 'js/util.js', 'js/sound.js', 'js/bg.js', 'js/ui.js', 'js/data.js', 'js/themes.js', 'js/trophies.js', 'js/media.js',
    'js/layout.js', 'js/importer.js', 'js/player.js', 'js/editor.js', 'js/grid.js', 'js/views.js', 'js/backup.js', 'js/upgrade.js', 'js/pics.js', 'js/windows.js', 'js/capture.js', 'js/notify.js', 'js/app.js',
    'kit/gs2-kit.js', 'kit/save-kit.js',
    'vendor/codemirror.min.js', 'vendor/codemirror.css', 'vendor/acorn.min.js', 'vendor/LICENSES.txt',
    'fonts/orbitron-latin-500-normal.woff2', 'fonts/orbitron-latin-700-normal.woff2', 'fonts/orbitron-latin-900-normal.woff2',
    'fonts/chakra-petch-latin-400-normal.woff2', 'fonts/chakra-petch-latin-500-normal.woff2',
    'fonts/chakra-petch-latin-600-normal.woff2', 'fonts/chakra-petch-latin-700-normal.woff2',
    'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
  ];

  var MIME = {
    html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
    css: 'text/css', json: 'application/json', map: 'application/json', txt: 'text/plain', md: 'text/plain',
    xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
    opus: 'audio/ogg', flac: 'audio/flac', mid: 'audio/midi', midi: 'audio/midi',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    wasm: 'application/wasm', glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'text/plain', mtl: 'text/plain',
    csv: 'text/csv', glsl: 'text/plain', vert: 'text/plain', frag: 'text/plain',
    data: 'application/octet-stream', bin: 'application/octet-stream', pck: 'application/octet-stream',
    zip: 'application/zip', pdf: 'application/pdf', webmanifest: 'application/manifest+json'
  };
  var TEXTY = /^(text\/|application\/(json|javascript|xml|manifest\+json)|image\/svg\+xml|model\/gltf\+json)/;

  function mimeOf(path) {
    var m = /\.([a-z0-9]+)$/i.exec(path || '');
    return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream';
  }
  function isHtml(path) { return /\.html?$/i.test(path || ''); }
  function isTextMime(type) { return TEXTY.test(type || ''); }

  var utf8Fatal = new TextDecoder('utf-8', { fatal: true });
  function isUtf8(u8) {
    try { utf8Fatal.decode(u8); return true; } catch (e) { return false; }
  }

  function lower(c) { return c >= 65 && c <= 90 ? c + 32 : c; }

  /* Does u8 contain the ASCII text `word` (case-insensitive) at position i? */
  function matchAt(u8, i, word) {
    if (i + word.length > u8.length) return false;
    for (var j = 0; j < word.length; j++) if (lower(u8[i + j]) !== word.charCodeAt(j)) return false;
    return true;
  }
  function isTagEnd(c) { return c === 62 || c === 47 || c === 32 || c === 9 || c === 10 || c === 13 || c === 12; }

  /* Find the end (index after '>') of the first <tag ...> in the first part of the file,
     skipping <!-- comments -->. Returns -1 when not found. */
  function findTagEnd(u8, tag, limit) {
    var max = Math.min(u8.length, limit || 200000);
    var open = '<' + tag;
    for (var i = 0; i < max; i++) {
      if (u8[i] !== 60) continue;
      if (matchAt(u8, i, '<!--')) {
        var k = i + 4;
        while (k < max && !(u8[k] === 45 && u8[k + 1] === 45 && u8[k + 2] === 62)) k++;
        i = k + 2;
        continue;
      }
      if (matchAt(u8, i, '<script') || matchAt(u8, i, '<body')) {
        /* the head/html/doctype tags always come before scripts/body; stop looking */
        if (tag !== 'script' && tag !== 'body') return -1;
      }
      if (matchAt(u8, i, open) && (i + open.length >= u8.length || isTagEnd(u8[i + open.length]))) {
        var q = 0;
        for (var p = i + open.length; p < u8.length; p++) {
          var c = u8[p];
          if (q) { if (c === q) q = 0; }
          else if (c === 34 || c === 39) q = c;
          else if (c === 62) return p + 1;
        }
        return -1;
      }
    }
    return -1;
  }

  /* Where to put the kit <script>: right after <head>, else after <html>, else after <!doctype>,
     else at the very start (after a BOM). Inserting on the same line keeps error line numbers right. */
  function injectionPoint(u8) {
    var at = findTagEnd(u8, 'head');
    if (at < 0) at = findTagEnd(u8, 'html');
    if (at < 0) at = findTagEnd(u8, '!doctype');
    if (at < 0) at = (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) ? 3 : 0;
    return at;
  }

  function injectTag(u8, tag) {
    var at = injectionPoint(u8);
    var add = new TextEncoder().encode(tag);
    var out = new Uint8Array(u8.length + add.length);
    out.set(u8.subarray(0, at), 0);
    out.set(add, at);
    out.set(u8.subarray(at), at + add.length);
    return out;
  }

  /* The JS served as /__gs2/boot.js: boot data + the kit itself. */
  function bootScript(boot, kitSource) {
    return 'window.__GS2_BOOT=' + JSON.stringify(boot) + ';\n' + kitSource;
  }

  root.GS2Shared = {
    APP_VERSION: APP_VERSION,
    APP_FILES: APP_FILES,
    MIME: MIME,
    mimeOf: mimeOf,
    isHtml: isHtml,
    isTextMime: isTextMime,
    isUtf8: isUtf8,
    injectionPoint: injectionPoint,
    injectTag: injectTag,
    bootScript: bootScript
  };
})(typeof self !== 'undefined' ? self : this);
