// node tests/run-harness.mjs <clip> [pieces] [model]  -> runs file mode in headless Chromium, saves results + a mix WAV
import pw from '/usr/local/lib/node_modules_global/playwright/index.js';
import fs from 'fs';
const [clip, pieces = '1', model = 'good'] = process.argv.slice(2);
const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
p.on('pageerror', e => console.log('pageerror', e.message));
const t = Date.now();
await p.goto(`http://localhost:8140/test-out/harness.html?clip=${clip}&pieces=${pieces}&model=${model}`);
let shown = 0;
while (true) {
  await new Promise(r => setTimeout(r, 2000));
  const txt = await p.textContent('#o');
  if (txt.length > shown) { process.stdout.write(txt.slice(shown)); shown = txt.length; }
  if (await p.title() === 'DONE') break;
  if (Date.now() - t > 3600e3) { console.log('TIMEOUT'); break; }
}
const out = await p.evaluate(() => window.__out);
fs.writeFileSync(`test-out/${clip}.result.json`, JSON.stringify(out, null, 1));
const mix = await p.evaluate(() => window.__mix && [Array.from(window.__mix[0]), Array.from(window.__mix[1])]);
if (mix) {
  const n = mix[0].length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[0][i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[1][i] * 32767))), 46 + i * 4); }
  fs.writeFileSync(`test-out/${clip}.mix.wav`, buf);
}
await b.close();
