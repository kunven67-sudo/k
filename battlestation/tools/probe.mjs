// Run JS inside the dev page and print the result. usage: node tools/probe.mjs "<url>" "<js expression>"
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [, , url, expr, shotPath] = process.argv;
const server = await serve(8765);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:8765' + url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }).catch(() => logs.push('timeout'));
try { const r = await page.evaluate(expr); console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1)); } catch (e) { console.log('ERR', e.message); }
if (shotPath) await page.screenshot({ path: shotPath });
console.log(logs.filter(l => !/404|favicon/.test(l)).join('\n'));
await browser.close(); server.close();
