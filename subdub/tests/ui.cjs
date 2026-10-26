// Drives the real SUBDUB app in Chromium.
//   node tests/ui.cjs setup                 -> first-run download screen until home
//   node tests/ui.cjs file <video> <secs>   -> open a video, let it dub, screenshots + line list
//   node tests/ui.cjs live <video> <secs>   -> fake "shared tab" playing the video, live dub, then the synced window
// Needs the dev server (node tools/serve.mjs . 8140). Profile + shots go to $OUT (default test-out/ui).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [mode = 'setup', clip, secs = '90'] = process.argv.slice(2);
const OUT = process.env.OUT || path.join(__dirname, '../test-out/ui');
const PROFILE = process.env.PROFILE || path.join(OUT, 'profile');
const URL0 = process.env.URL || 'http://localhost:8140/';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, viewport: { width: 1440, height: 900 },
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu', '--js-flags=--max-old-space-size=6000'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /SUBDUB|Problem|failed/i.test(t)) { log('console.' + m.type(), t.slice(0, 300)); if (m.type() === 'error') errors.push(t); } });
  page.on('pageerror', (e) => { log('PAGEERROR', e.message); errors.push(e.message); });
  if (mode === 'live') {
    // fake getDisplayMedia: a hidden video playing the clip, captured like a browser tab
    await page.addInitScript((src) => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const v = document.createElement('video');
        v.src = src; v.crossOrigin = 'anonymous'; v.playsInline = true; v.style.cssText = 'position:fixed;left:-9999px;width:640px';
        document.body.append(v); await v.play();
        window.__fakeTab = v;
        const s = v.captureStream();
        await new Promise(r => { const t = () => s.getVideoTracks().length && s.getAudioTracks().length ? r() : setTimeout(t, 50); t(); });
        const vt = s.getVideoTracks()[0], gs = vt.getSettings.bind(vt);
        vt.getSettings = () => ({ ...gs(), displaySurface: 'browser' });
        Object.defineProperty(vt, 'label', { value: 'Test tab - anime' });
        return s;
      };
    }, URL0 + 'test-media/' + path.basename(clip));
  }
  await page.goto(URL0);
  await page.waitForFunction(() => self.crossOriginIsolated !== undefined);
  // service worker reloads once to become cross-origin isolated
  await sleep(2500);
  log('isolated:', await page.evaluate(() => self.crossOriginIsolated));
  const setup = await page.$('.setup');
  if (setup) {
    log('setup screen');
    await page.screenshot({ path: path.join(OUT, 'setup-0.png') });
    await page.click('.bigbtn');
    const t0 = Date.now();
    while (!(await page.$('.home'))) {
      await sleep(10000);
      const p = await page.$$eval('.part', els => els.map(e => e.innerText.replace(/\s+/g, ' ')).join(' | '));
      log('setup', Math.round((Date.now() - t0) / 1000) + 's', p.slice(0, 400));
      if (Date.now() - t0 > 25 * 60e3) throw new Error('setup took too long');
      if (await page.$('.setup .note:not(:empty)')) { const n = await page.$eval('.setup p:last-of-type', e => e.textContent); if (/wrong/.test(n)) throw new Error(n); }
    }
    log('setup done in', Math.round((Date.now() - t0) / 1000), 's');
  }
  await page.waitForSelector('.home', { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, 'home.png') });
  if (mode === 'setup') { log('errors:', errors.length); await ctx.close(); return; }

  const name = path.basename(clip || 'x', path.extname(clip || 'x'));
  if (mode === 'file') {
    await page.setInputFiles('.home input[type=file]', clip);
    if (process.env.TICKS) await page.evaluate(() => { window.__debugTicks = true; });
    page.evaluate(() => {
      const hook = () => { const w = window.__subdubWatch; if (!w) return setTimeout(hook, 300);
        const tick = w.tick.bind(w); let n = 0; w.debug = !!window.__debugTicks;
        w.tick = async function () { return tick(); };
        w.addEventListener('sub', (e) => console.log('SUBDUB sub', e.detail.s.toFixed(1), e.detail.lang, e.detail.text, '=>', e.detail.en));
        const close = w._close.bind(w); w._close = (t) => close(t);
        const orig = w.eyes.call.bind(w.eyes); w.eyes.call = async (m, a) => { const r = await orig(m, a); if (m === 'read') console.log('SUBDUB read', w.clock().toFixed(1), JSON.stringify(r.map(l => [l.text, +l.conf.toFixed(2), l.kind, Math.round(l.box.y2 - l.box.y), Math.round((l.box.x + l.box.x2) / 2)]))); return r; };
      }; hook();
    });
    const t0 = Date.now();
    let shot = 0;
    while (Date.now() - t0 < +secs * 1000) {
      await sleep(+(process.env.STEP || 15000));
      const st = await page.evaluate(() => ({ prog: document.querySelector('.prog')?.textContent, t: document.querySelector('video')?.currentTime, paused: document.querySelector('video')?.paused, wait: !document.querySelector('.wait')?.hidden, caps: document.querySelector('.caps')?.innerText }));
      log('file', JSON.stringify(st).slice(0, 300));
      await page.screenshot({ path: path.join(OUT, `${name}-file-${shot++}.png`) });
    }
    log('screen subs', await page.evaluate(() => JSON.stringify((window.__subdubFile?.screenSubs || []).map(s => [+s.s.toFixed(1), s.lang, s.text, s.en]))));
    log('stats', await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__subdubFile?.stats || {}).map(([k, v]) => [k, Math.round(v)])))));
    await page.click('.tabs button:nth-child(2)');
    await sleep(800);
    const lines = await page.$$eval('.lineitem', els => els.map(e => e.innerText.replace(/\n+/g, ' | ')));
    fs.writeFileSync(path.join(OUT, `${name}-lines.txt`), lines.join('\n'));
    log('lines:', lines.length); for (const l of lines.slice(0, 40)) log('  ', l.slice(0, 200));
    const cast = await page.$$eval('.castrow, .char', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    log('cast:', cast.join(' || ').slice(0, 600));
  }
  if (mode === 'live') {
    await page.click('.tile.live .go');
    await page.waitForSelector('.live', { timeout: 60000 });
    const t0 = Date.now();
    const syncAt = (+secs * 0.4) * 1000;
    let synced = false, shot = 0;
    while (Date.now() - t0 < +secs * 1000) {
      await sleep(10000);
      const st = await page.evaluate(() => ({ tab: window.__fakeTab?.currentTime, lag: document.querySelector('.livehead span:last-child')?.textContent, bubbles: [...document.querySelectorAll('.feed .bubble')].slice(-3).map(b => b.innerText.replace(/\n/g, ' / ')), synced: !!document.querySelector('.synced'), count: document.querySelector('.synccount')?.textContent, caps: document.querySelector('.synced .caps')?.innerText }));
      log('live', JSON.stringify(st).slice(0, 500));
      if (!synced && Date.now() - t0 > syncAt) {
        synced = true;
        const dis = await page.$eval('.livebtns button:nth-child(2)', b => b.disabled);
        log('synced button disabled:', dis);
        await page.click('.livebtns button:nth-child(2)');
      }
      await page.screenshot({ path: path.join(OUT, `${name}-live-${shot++}.png`) });
      if (synced) {
        const px = await page.evaluate(() => { const c = document.querySelector('.synccv'); if (!c || !c.width) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4 * 97) s += d[i] + d[i + 1] + d[i + 2]; return { w: c.width, h: c.height, bright: s / (d.length / (4 * 97)) }; });
        log('synced canvas', JSON.stringify(px));
        log('synced state', JSON.stringify(await page.evaluate(() => { const y = window.__subdubSynced; if (!y) return null; return { chunks: y.chunks.length, frames: y.frames.length, enc: y.enc?.state, dec: y.dec?.state, decErrors: y.decErrors, pieces: y.pieces.length, sepMs: Math.round(y.lastSepMs || 0), slow: y.slow, late: y.late, caps: y.caps.length, note: y.noteEl.hidden ? '' : y.noteEl.textContent, playT: +y.playTime().toFixed(2) }; })));
      }
    }
  }
  log('errors:', errors.length, errors.slice(0, 5).join(' || ').slice(0, 800));
  await ctx.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
