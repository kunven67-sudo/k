// Scripted test run: node tools/run.mjs "<query>" steps.mjs [outDir]
// steps.mjs: export default async (t) => { await t.wait(2000); await t.shot('a'); await t.hold('KeyW', 1500); t.log(await t.g(G => G.player.pos)); }
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [query = '', stepsFile, outDir = '/tmp/claude-0/aw'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
if (process.env.INIT) await page.addInitScript({ path: process.env.INIT });
const logs = [];
page.on('console', m => { const t = m.text(); if (!/GPU stall|Automatic fallback|WebGL: |GL_CLOSE_PATH/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));
const t0 = Date.now();
const flush = () => { while (logs.length) console.log(logs.shift()); };
const t = {
  page,
  log: (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a.map(x => typeof x === 'string' ? x : JSON.stringify(x))),
  wait: (ms) => page.waitForTimeout(ms),
  shot: async (name) => { flush(); const f = path.join(outDir, name + '.png'); await page.screenshot({ path: f, timeout: 180000 }); console.log('shot', f, ((Date.now() - t0) / 1000).toFixed(1) + 's'); },
  key: async (code) => { await page.keyboard.press(code); },
  hold: async (code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); },
  click: async (x, y, button = 'left') => { await page.mouse.click(x, y, { button }); },
  g: (fn, arg) => page.evaluate(([src, a]) => { const f = eval('(' + src + ')'); return f(window.__game, a); }, [fn.toString(), arg]),
  until: async (fn, ms = 60000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await t.g(fn)) return true; } catch (e) {} await page.waitForTimeout(300); } t.log('until: timeout ' + fn.toString().slice(0, 80)); return false; },
  flush,
};
await page.goto(`http://localhost:${port}/dist/dev.html?shot=1&${query}`);
await page.waitForFunction(() => !!window.__game, null, { timeout: 120000 }).catch(() => logs.push('[run] no __game'));
try {
  const mod = await import(path.resolve(stepsFile));
  await mod.default(t);
} catch (e) { console.log('[run] step error', e.message); }
flush();
console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await browser.close(); server.close();
