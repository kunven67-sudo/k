// Screenshot / probe tool: node tools/shot.mjs "<query>" out.png [waitMs] [w] [h]
// Serves the project folder, opens dist/dev.html?<query>, waits for window.__shotReady, screenshots.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [query = '', out = '/tmp/claude-0/shot.png', waitMs = '90000', W = '1280', H = '720'] = process.argv.slice(2);
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
if (process.env.INIT) await page.addInitScript({ path: process.env.INIT });
const logs = [];
page.on('console', m => { const t = m.text(); if (!/GPU stall|Automatic fallback|WebGL/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/dist/dev.html?shot=1&${query}`);
try { await page.waitForFunction(() => window.__shotReady === true, null, { timeout: +waitMs, polling: 300 }); }
catch { logs.push('[shot] timeout waiting for __shotReady'); }
await page.waitForTimeout(+(process.env.EXTRA || 400));
await page.screenshot({ path: out, timeout: 180000 });
const info = await page.evaluate(() => window.__shotInfo || null).catch(() => null);
console.log(logs.slice(-30).join('\n'));
if (info) console.log('info', JSON.stringify(info));
console.log('shot', out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
await browser.close(); server.close();
