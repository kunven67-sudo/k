// tiny static server for testing (node tools/serve.mjs [port])
import http from 'http'; import fs from 'fs'; import path from 'path';
const port = +process.argv[2] || 8150, root = path.resolve('.');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.hdr': 'application/octet-stream', '.css': 'text/css', '.woff2': 'font/woff2' };
http.createServer((q, s) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
}).listen(port, () => console.log('serving on', port));
