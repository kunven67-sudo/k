// Dev server: static files with cross-origin isolation headers (needed for multi-threaded WASM).
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(process.argv[2] || '.'), port = +(process.argv[3] || 8130);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.wav': 'audio/wav' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  const st = fs.statSync(f), h = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) { const a = +range[1], b = range[2] ? +range[2] : st.size - 1; res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(res); return; }
  res.writeHead(200, { ...h, 'Content-Length': st.size }); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
