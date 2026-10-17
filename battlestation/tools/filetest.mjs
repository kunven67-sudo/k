// Opens the built single file straight from disk (file://), like a player double-clicking it.
// usage: node tools/filetest.mjs [path]
import { chromium } from 'playwright';
import path from 'node:path';

const file = path.resolve(process.argv[2] || 'dist/battlestation.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto('file://' + file, { timeout: 120000 });
const ok = await page.waitForFunction(() => window.__ready === true, null, { timeout: 400000 }).then(() => true).catch(() => false);
const info = await page.evaluate(() => ({ text: document.getElementById('loadtext')?.textContent, start: !document.getElementById('start').classList.contains('hidden'), state: window.__game?.player?.state }));
console.log('ready:', ok, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(info));
console.log(logs.filter(l => !/battlestation-mypc/.test(l)).slice(0, 20).join('\n'));
await browser.close();
