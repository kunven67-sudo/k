// Draws the extension icons (PNG) from an SVG. Run once: node tools/icons.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './pw.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132029"/><stop offset="1" stop-color="#070b10"/></linearGradient></defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#g)" stroke="#3dffa2" stroke-width="${s <= 32 ? 8 : 5}"/>
  <path d="M46 40 L22 64 L46 88 M82 40 L106 64 L82 88 M72 30 L56 98" fill="none" stroke="#3dffa2" stroke-width="${s <= 16 ? 14 : s <= 32 ? 12 : 10}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const s of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(s)}</body></html>`);
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  writeFileSync(join(ROOT, 'src', 'extension', 'icons', `${s}.png`), png);
}
await browser.close();
console.log('icons written');
