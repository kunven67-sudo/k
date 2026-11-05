// Real-input test: plays the game in Chromium with real mouse + keyboard events and saves screenshots.
// node tools/test-pc.mjs [scenario]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const scen = process.argv[2] || 'basic';
const out = 'test-out/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(() => { window.__AF_TEST = true; });
const t0 = Date.now();
await page.goto('http://localhost:8150/index.html' + (process.argv[3] || ''));
await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 }).catch(() => logs.push('TIMEOUT waiting for load: ' + Date.now()));
console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
const shot = (n) => page.screenshot({ path: out + n + '.jpg', quality: 70, type: 'jpeg' });
const wait = (ms) => page.waitForTimeout(ms);
const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
globalThis.page = page;
await wait(800);
await shot(scen + '-0-title');
const s = await import('./scen-' + scen + '.mjs');
await s.run({ page, shot, wait, key, logs });
console.log(logs.slice(0, 40).join('\n') || 'no errors');
await browser.close();
