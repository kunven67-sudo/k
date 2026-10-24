// Films a test page frame by frame (deterministic, works on the slow cloud GPU).
//   node tools/film.mjs "<query>" out.mp4 frames fps [w h]
// The page must set window.__shotReady and expose window.__step(dt) that advances + renders one frame.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [query, out, frames = '60', fps = '30', W = '960', H = '540'] = process.argv.slice(2);
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.goto(`http://localhost:${server.address().port}/dist/dev.html?shot=1&freeze=1&${query}`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000, polling: 300 });
const dir = fs.mkdtempSync('/tmp/claude-0/film-');
for (let i = 0; i < +frames; i++) {
  await page.evaluate((dt) => window.__step(dt), 1 / +fps);
  await page.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.png` });
}
execSync(`ffmpeg -y -loglevel error -framerate ${fps} -i ${dir}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 "${out}"`);
// contact sheet of a few frames for a quick look
execSync(`ffmpeg -y -loglevel error -i "${out}" -vf "select='not(mod(n\\,${Math.max(1, Math.floor(+frames / 8))}))',scale=480:-1,tile=4x2" -frames:v 1 "${out.replace(/\.mp4$/, '_sheet.jpg')}"`);
console.log(logs.join('\n')); console.log('film', out);
await browser.close(); server.close();
