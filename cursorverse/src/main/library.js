// The cv:// protocol and the user's imported files.
//   cv://app/<path>    -> files inside src/ (the app's own pages and scripts)
//   cv://media/<path>  -> files the user imported (music, backgrounds, sounds)
// Imported files are copied into <userData>/library so moving the originals
// never breaks anything, and the protocol can only reach those two folders.
const { protocol, net, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');

const SRC_ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4',
};

const KINDS = {
  music: { dir: 'music', exts: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'], label: 'Music' },
  background: { dir: 'backgrounds', exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'm4v'], label: 'Images & videos' },
  sound: { dir: 'sounds', exts: ['mp3', 'wav', 'ogg', 'm4a'], label: 'Sounds' },
  image: { dir: null, exts: ['png', 'jpg', 'jpeg', 'gif', 'webp'], label: 'Images' },
};

let libraryRoot = null;

function registerSchemes() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'cv',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  }]);
}

// Resolves a URL path under root; returns null if it tries to escape.
function safeJoin(root, rel) {
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; }
  const full = path.resolve(root, `.${path.sep}${decoded}`);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  return full.startsWith(rootWithSep) ? full : null;
}

// Serves a file with Range support so audio/video can seek and loop.
async function serveFile(file, request) {
  let stat;
  try { stat = await fs.promises.stat(file); } catch { return new Response('not found', { status: 404 }); }
  if (!stat.isFile()) return new Response('not found', { status: 404 });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.get('range');
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, stat.size - parseInt(m[2], 10)); end = stat.size - 1; }
    if (start >= stat.size || start > end) {
      return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${stat.size}` } });
    }
    end = Math.min(end, stat.size - 1);
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end }));
    return new Response(stream, {
      status: 206,
      headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...base, 'Content-Length': String(stat.size) } });
}

function handleProtocol(userDataDir) {
  libraryRoot = path.join(userDataDir, 'library');
  fs.mkdirSync(libraryRoot, { recursive: true });
  protocol.handle('cv', async (request) => {
    const url = new URL(request.url);
    const rel = url.pathname.replace(/^\/+/, '');
    if (url.host === 'app') {
      const file = safeJoin(SRC_ROOT, rel);
      if (!file) return new Response('forbidden', { status: 403 });
      // app files may live inside app.asar, which net.fetch reads fine
      if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
      const res = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(res.headers);
      const type = MIME[path.extname(file).toLowerCase()];
      if (type) headers.set('Content-Type', type);
      return new Response(res.body, { status: res.status, headers });
    }
    if (url.host === 'media') {
      const file = safeJoin(libraryRoot, rel);
      if (!file) return new Response('forbidden', { status: 403 });
      return serveFile(file, request);
    }
    return new Response('not found', { status: 404 });
  });
}

function safeName(name) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
}

// Opens a file picker and copies the chosen files into the library.
async function importFiles(win, kind, multi = false) {
  const k = KINDS[kind];
  if (!k) throw new Error(`unknown import kind ${kind}`);
  const res = await dialog.showOpenDialog(win, {
    title: `Add ${k.label.toLowerCase()}`,
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: k.label, extensions: k.exts }],
  });
  if (res.canceled || !res.filePaths.length) return [];
  const out = [];
  for (const src of res.filePaths) {
    const ext = path.extname(src).slice(1).toLowerCase();
    if (!k.exts.includes(ext)) continue;
    const stat = await fs.promises.stat(src);
    const name = path.basename(src, path.extname(src));
    if (!k.dir) {
      if (stat.size > 25 * 1024 * 1024) throw new Error('That image is too big (max 25 MB).');
      const data = await fs.promises.readFile(src);
      out.push({ name, ext, dataUrl: `data:${MIME[`.${ext}`]};base64,${data.toString('base64')}` });
      continue;
    }
    const id = crypto.randomBytes(6).toString('hex');
    const rel = `${k.dir}/${id}-${safeName(path.basename(src))}`;
    const dest = path.join(libraryRoot, rel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
    out.push({ id, name, file: rel, ext, size: stat.size, video: ['mp4', 'webm', 'mov', 'm4v'].includes(ext) });
  }
  return out;
}

async function removeFile(rel) {
  const file = safeJoin(libraryRoot, rel);
  if (!file) return false;
  try { await fs.promises.unlink(file); return true; } catch { return false; }
}

async function readFile(rel) {
  const file = safeJoin(libraryRoot, rel);
  if (!file) throw new Error('bad path');
  return fs.promises.readFile(file);
}

module.exports = { registerSchemes, handleProtocol, importFiles, removeFile, readFile, safeJoin, KINDS };
