// Real-GPU test in a hidden Edge: node tests/eye.mjs <outdir> "<js>@ms" ...
// Each step runs js in the page, waits ms, then saves a screenshot + the frame rate.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [out, ...steps] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720'],
  userDataDir: 'C:/Users/kunve/OVERDRIVE/workspace/games/_dl/eye-profile',
});
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
// NEVER let the hidden test browser lock the real mouse (on Windows pointer lock clips + recenters the real cursor even for a hidden window)
await p.evaluateOnNewDocument(() => { Element.prototype.requestPointerLock = function () { return Promise.resolve(); }; Document.prototype.exitPointerLock = function () {}; });
const killer = () => { try { b.process()?.kill(); } catch (e) {} }; process.on('exit', killer); process.on('SIGINT', () => { killer(); process.exit(1); }); process.on('SIGTERM', () => { killer(); process.exit(1); });
const errs = []; p.on('pageerror', e => { errs.push('PAGEERROR ' + e.message); console.log('PAGEERROR', e.message.slice(0, 300)); }); p.on('console', m => { if (['error', 'warn'].includes(m.type())) errs.push(m.type() + ' ' + m.text().slice(0, 240)); });
await p.goto('http://127.0.0.1:47840/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ol, { timeout: 120000 });
await p.evaluate(() => { const f = { n: 0, t: performance.now() }; window.__fps = f; const loop = () => { f.n++; requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
console.log('gpu:', await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; }));
let i = 0;
for (const st of ['0@2500', ...steps]) {
  const at = st.lastIndexOf('@'), js = st.slice(0, at), ms = +st.slice(at + 1);
  try { const r = await p.evaluate(js); if (r !== undefined && r !== 0) console.log('step', i, '->', JSON.stringify(r).slice(0, 500)); } catch (e) { console.log('step', i, 'ERR', e.message.slice(0, 300)); }
  await p.evaluate(() => { window.__fps.n = 0; window.__fps.t = performance.now(); });
  await new Promise(r => setTimeout(r, ms));
  const fps = await p.evaluate(() => (window.__fps.n * 1000 / (performance.now() - window.__fps.t)).toFixed(0) + ' fps, quality ' + window.__ol.quality.cur);
  await p.screenshot({ path: `${out}/${String(i).padStart(2, '0')}.png` });
  console.log('shot', i, fps); i++;
}
console.log([...new Set(errs)].slice(0, 20).join('\n') || 'no errors');
await b.close();
