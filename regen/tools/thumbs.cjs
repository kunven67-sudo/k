// node tools/thumbs.cjs  -> assets/thumbs/*.webp
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
fs.writeFileSync(path.join(root, 'thumbs.html'), '<!doctype html><body style="margin:0"><script type="module" src="tests/thumbs.bundle.js"></script></body>');
const srv = http.createServer((q, r) => { fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': q.url.endsWith('.js') ? 'text/javascript' : q.url.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/thumbs.html`);
  await pg.waitForFunction('window.THUMBS', null, { timeout: 600000 });
  const t = await pg.evaluate('window.THUMBS'); fs.mkdirSync(path.join(root, 'assets/thumbs'), { recursive: true });
  for (const [k, v] of Object.entries(t)) fs.writeFileSync(path.join(root, 'assets/thumbs', k + '.webp'), Buffer.from(v.split(',')[1], 'base64'));
  console.log('thumbs', Object.keys(t).length); fs.unlinkSync(path.join(root, 'thumbs.html')); await b.close(); srv.close();
});
