// shared VR test harness: real WebXR session in Chromium through Meta's IWER emulator (Quest 3 + Touch controllers)
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
export async function openVR({ w = 640, h = 400 } = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.addInitScript({ content: fs.readFileSync(new URL('./iwer-bundle.js', import.meta.url), 'utf8') });
  await page.addInitScript(() => { window.__AF_TEST = true; });
  await page.goto('http://localhost:8150/index.html');
  await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const T = {
    page, browser, logs,
    frames: async (n) => { const f0 = await page.evaluate(() => window.__AF.game.frameN || 0); await page.waitForFunction((t) => (window.__AF.game.frameN || 0) >= t, f0 + n, { timeout: 600000, polling: 100 }); },
    ev: (fn, arg) => page.evaluate(fn, arg),
    shot: (path) => page.screenshot({ path, type: 'jpeg', quality: 72, timeout: 120000 }),
    // controller helpers (positions in meters, relative to your real room)
    ctl: (side, pos, quat) => page.evaluate(([s, p, q]) => { const c = window.__xr.controllers[s]; if (p) c.position.set(...p); if (q) c.quaternion.set(...q); }, [side, pos, quat]),
    btn: (side, id, v) => page.evaluate(([s, i, val]) => window.__xr.controllers[s].updateButtonValue(i, val), [side, id, v]),
    stick: (side, x, y) => page.evaluate(([s, a, b]) => window.__xr.controllers[s].updateAxes('thumbstick', a, b), [side, x, y]),
    head: (pos, quat) => page.evaluate(([p, q]) => { if (p) window.__xr.position.set(...p); if (q) window.__xr.quaternion.set(...q); }, [pos, quat]),
    // where a hand's palm is, in game units, and what it holds
    hands: () => page.evaluate(() => window.__AF.game.vrHands.map((H) => ({ side: H.side, pos: H.pos.toArray().map((v) => +v.toFixed(2)), held: H.held ? H.held.id : null }))),
    part: (id) => page.evaluate((i) => { const A = window.__AF, p = A.partsById.get(i); if (!p) return null; const w = A.partWorld(p); return { id: p.id, type: p.type, body: p.body.id, n: p.body.parts.size, pos: w.toArray().map((v) => +v.toFixed(2)), frozen: p.body.frozen, size: p.size.toArray().map((v) => +v.toFixed(3)) }; }, id),
    find: (type) => page.evaluate((t) => { const A = window.__AF; const out = []; for (const b of A.bodies) for (const p of b.parts) if (p.type === t) out.push(p.id); return out; }, type),
    // world (units) -> controller position (meters, room) for the CURRENT rig
    toRoom: (wp) => page.evaluate((w) => { const A = window.__AF; const v = new A.camera.position.constructor(...w); A.rig.updateMatrixWorld(true); return A.rig.worldToLocal(v).toArray(); }, wp)
  };
  return T;
}
export async function enterVR(T) {
  await T.page.waitForFunction(() => [...document.querySelectorAll('#menus .gs3-item, #menus button')].some((x) => /Play in VR|in VR/.test(x.textContent)), null, { timeout: 30000 });
  await T.ev(() => { const b = [...document.querySelectorAll('#menus .gs3-item, #menus button')].find((x) => /Play in VR|in VR/.test(x.textContent)); b.click(); });
  await T.page.waitForFunction(() => window.__AF.game.inVR, null, { timeout: 30000 });
  await T.frames(3);
}
