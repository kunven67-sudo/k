// Renders the app icon with the cursor library and writes PNG + ICO files.
// Run: node scripts/make-icons.cjs  (needs a local http server on :8123 serving the repo folder)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8124/scripts/make-icons.html');
  await p.waitForFunction(() => document.title === 'done');
  const icons = await p.evaluate(() => window.__icons);
  await b.close();
  const png = (s) => Buffer.from(icons[s].split(',')[1], 'base64');
  const root = path.join(__dirname, '..');
  fs.writeFileSync(path.join(root, 'build/icon.png'), png(512));
  fs.writeFileSync(path.join(root, 'src/assets/icon.png'), png(256));
  fs.writeFileSync(path.join(root, 'src/assets/tray.png'), png(16));
  fs.writeFileSync(path.join(root, 'src/assets/tray@2x.png'), png(32));
  // ICO with embedded PNGs
  const sizes = [16, 32, 48, 64, 128, 256];
  const imgs = sizes.map(png);
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const o = 6 + i * 16;
    head[o] = s >= 256 ? 0 : s; head[o + 1] = s >= 256 ? 0 : s;
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(imgs[i].length, o + 8); head.writeUInt32LE(off, o + 12);
    off += imgs[i].length;
  });
  fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([head, ...imgs]));
  console.log('icons written');
})();
