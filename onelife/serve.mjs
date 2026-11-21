// ONE LIFE launcher: serves the game on this PC only and opens it in its own Edge window.
// node serve.mjs [--no-open]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = 47840;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
let last = Date.now();

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/alive') { last = Date.now(); res.writeHead(204); return res.end(); }
  if (url === '/quit') { res.writeHead(204); res.end(); setTimeout(() => process.exit(0), 300); return; }
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', e => {
  // already running: just open another window onto it
  if (e.code === 'EADDRINUSE') { open(); setTimeout(() => process.exit(0), 1500); } else { console.error(e); process.exit(1); }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('ONE LIFE running on http://127.0.0.1:' + PORT);
  if (!process.argv.includes('--no-open')) open();
  // close by itself once the game window has been gone for a while
  setTimeout(() => setInterval(() => { if (Date.now() - last > 75000) process.exit(0); }, 10000), 90000);
});

function open() {
  const url = 'http://127.0.0.1:' + PORT + '/';
  const p = spawn('cmd', ['/c', 'start', '', 'msedge', '--app=' + url, '--start-maximized', '--autoplay-policy=no-user-gesture-required'], { windowsHide: true, detached: true, stdio: 'ignore' });
  p.on('error', () => spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }));
  p.unref();
}
