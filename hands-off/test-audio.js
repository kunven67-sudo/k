// Records the game's real audio in headless Chrome so it can be measured. Run: node test-audio.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const HO = require('./src/core.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function seeded(runSecs) {
  const now = Date.now();
  const s = HO.newSave(now - runSecs * 1000);
  const r = HO.newRun(now - runSecs * 1000); HO.step(r, runSecs);
  s.run = r; s.savedAt = now; s.rec.runs = 2; s.rec.bestTime = runSecs;
  return HO.serialize(s);
}
// tap everything that reaches the speakers into a recorder
const TAP = `
  (() => {
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      const r = orig.call(this, dest, ...rest);
      if (dest instanceof AudioDestinationNode && !this.context.__tap) {
        const ms = this.context.createMediaStreamDestination();
        orig.call(this, ms);
        this.context.__tap = ms;
      }
      return r;
    };
    window.__rec = (ms) => new Promise((res) => {
      const ctx = window.__HO_CTX;
      const tapNode = [...document.querySelectorAll('x')];
    });
  })();`;
async function record(page, ms) {
  return page.evaluate(async (ms) => {
    const ctxs = window.__ctxs || [];
    const ms2 = window.__tapStream;
    const rec = new MediaRecorder(ms2, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    await new Promise((r) => setTimeout(r, ms));
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const buf = await new Blob(chunks).arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, ms);
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const cases = [['start', 0, 9000], ['ten-min', 600, 7000], ['two-hours', 7200, 7000]];
  for (const [name, secs, ms] of cases) {
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => {
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest, ...rest) {
        const r = orig.call(this, dest, ...rest);
        if (dest instanceof AudioDestinationNode && !window.__tapStream) {
          const ms = this.context.createMediaStreamDestination();
          orig.call(this, ms);
          window.__tapStream = ms.stream;
          // true sample peak, straight from the last node before the speakers
          const an = this.context.createAnalyser(); an.fftSize = 16384;
          orig.call(this, an);
          const buf = new Float32Array(an.fftSize);
          window.__peak = 0; window.__over = 0;
          setInterval(() => { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > window.__peak) window.__peak = v; if (v > 0.999) window.__over++; } }, 100);
        }
        return r;
      };
    });
    if (secs) await p.addInitScript((s) => { if (!sessionStorage.getItem('x')) { localStorage.setItem('handsoff.save.v1', s); sessionStorage.setItem('x', 1); } }, seeded(secs));
    await p.goto('file://' + path.join(__dirname, 'dist', 'hands-off.html'));
    await p.click('#startBtn');
    await p.waitForFunction(() => window.__HO_DEBUG.state === 'live', null, { timeout: 30000 });
    const bytes = await record(p, ms);
    fs.writeFileSync(path.join(__dirname, 'shots', 'audio-' + name + '.webm'), Buffer.from(bytes));
    if (name === 'ten-min') {
      // and a reset: crack, shatter, tape stop, slam
      const rp = record(p, 6000);
      await sleep(300);
      await p.mouse.move(400, 300); await p.mouse.move(420, 310);
      fs.writeFileSync(path.join(__dirname, 'shots', 'audio-reset.webm'), Buffer.from(await rp));
    }
    const pk = await p.evaluate(() => [window.__peak, window.__over]);
    console.log(name, 'recorded', bytes.length, 'bytes', errs.length ? errs : 'no errors', '| TRUE peak', (20 * Math.log10(pk[0] || 1e-9)).toFixed(2), 'dBFS, samples at full scale:', pk[1]);
    await ctx.close();
  }
  await b.close();
})();
