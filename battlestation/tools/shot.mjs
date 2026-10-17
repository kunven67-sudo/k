// Open a page in headless Chromium, wait for window.__ready, save a screenshot.
// usage: node tools/shot.mjs <url-path> <out.png> [width] [height] [timeoutMs]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const [, , urlPath = '/dev/index.html', out = 'shot.png', w = '1280', h = '720', to = '120000'] = process.argv;
const server = await serve(8765);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
await page.goto('http://localhost:8765' + urlPath);
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: +to }); }
catch (e) { logs.push('[shot] timeout waiting for __ready'); }
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
server.close();
