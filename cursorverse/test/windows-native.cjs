// Runs on the Windows CI machine: exercises the real Win32 calls that can't be
// tested on Linux. Exits non-zero if the native layer is broken.
const fs = require('fs');
const os = require('os');
const path = require('path');
const win32 = require('../src/main/win32');

(async () => {
  const { encodeCur, encodeAni } = await import('../src/shared/cur-encoder.mjs');
  if (!win32.available()) throw new Error(`native layer failed to load: ${win32.loadError()}`);
  console.log('native layer loaded');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-'));
  const frame = (shade) => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 32 * 32; i++) { data[i * 4] = shade; data[i * 4 + 3] = (i % 32) < (i / 32) ? 255 : 0; }
    return { width: 32, height: 32, data };
  };
  const cur = path.join(dir, 'test.cur');
  const ani = path.join(dir, 'test.ani');
  fs.writeFileSync(cur, encodeCur(frame(255), [0, 0]));
  fs.writeFileSync(ani, encodeAni([frame(80), frame(160), frame(240)], [0, 0], 10));

  for (const file of [cur, ani]) {
    const res = win32.applySystemCursors({ normal: file }, { normal: true }, 32);
    console.log(`apply ${path.extname(file)}:`, JSON.stringify(res));
    if (!res.ok) throw new Error(`could not set the system cursor from ${path.basename(file)}`);
  }
  console.log('restore:', win32.restoreSystemCursors());

  const fg = win32.foregroundProcess();
  console.log('foreground process:', JSON.stringify(fg));
  console.log('all Windows native checks passed');
})().catch((err) => { console.error(err); win32.restoreSystemCursors(); process.exit(1); });
