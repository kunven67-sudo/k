// End-to-end test: fake phone (DevServer) + real Chromium acting as the TV.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'core/build/e2e-shots');
fs.mkdirSync(OUT, { recursive: true });
const CP = fs.readFileSync(path.join(ROOT, 'core/build/test-classpath.txt'), 'utf8').trim();
const PORT = 18080;

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failures++; console.log('  FAIL ' + msg); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tests 1-12 check the picture-by-picture (JPEG) mode, like a phone without a working video encoder.
// Pass '--video' for the H.264 video mode.
function startPhone(args = []) {
  if (!args.includes('--video')) args = ['--jpeg-only', ...args];
  const p = spawn('java', ['-Djava.awt.headless=true', '-cp', CP, 'com.brocast.core.DevServerKt', '--port', String(PORT), ...args]);
  p.stats = [];
  return new Promise((resolve, reject) => {
    let buf = '';
    p.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (line.startsWith('READY')) { p.url = line.split(' ')[1]; p.startedAt = Date.now(); resolve(p); }
        if (line.startsWith('STATS')) p.stats.push(line);
      }
    });
    p.stderr.on('data', (d) => { const s = d.toString(); if (!s.includes('JAVA_TOOL_OPTIONS')) process.stderr.write('[phone] ' + s); });
    p.on('exit', (c) => reject(new Error('phone exited ' + c)));
  });
}
function stopPhone(p) { return new Promise((r) => { p.removeAllListeners('exit'); p.on('exit', r); p.kill('SIGKILL'); }); }
const lastViewers = (p) => { const l = p.stats[p.stats.length - 1] || ''; const m = l.match(/viewers=(\d+)/); return m ? +m[1] : -1; };
const lastMode = (p) => { const l = p.stats[p.stats.length - 1] || ''; const m = l.match(/mode=(\w+)/); return m ? m[1] : '?'; };

async function waitFor(page, fn, timeout, arg) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 200 }); return true; } catch (e) { return false; }
}
const showingPicture = () => {
  const img = document.getElementById('screen');
  return img.style.display === 'block' && document.getElementById('overlay').style.display === 'none';
};
// Red channel of the test pattern's top-left block (encodes the frame number).
const sampleRed = () => {
  const img = document.getElementById('screen');
  const c = document.createElement('canvas'); c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(20, 20, 1, 1).data; return [d[0], d[1], d[2], img.naturalWidth, img.naturalHeight];
};
const pictureHash = () => {
  const img = document.getElementById('screen');
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data; let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0;
  return h;
};
const showingVideo = () => {
  const v = document.getElementById('vid');
  return v.style.display === 'block' && document.getElementById('overlay').style.display === 'none' && v.readyState >= 2;
};
const videoHash = () => {
  const v = document.getElementById('vid');
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.drawImage(v, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data; let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0;
  return h;
};
const vinfo = () => {
  const v = document.getElementById('vid'); const b = v.buffered;
  return { t: v.currentTime, end: b.length ? b.end(b.length - 1) : 0, ranges: b.length, w: v.videoWidth, h: v.videoHeight,
    paused: v.paused, rs: v.readyState, rate: v.playbackRate, stats: Object.assign({}, window.BroCastVideo) };
};
// Video time moves forward over [ms] (the picture is playing, not frozen).
async function videoMoves(page, ms = 1000) {
  const a = await page.evaluate(vinfo); await sleep(ms); const b = await page.evaluate(vinfo);
  return { moved: b.t - a.t > (ms / 1000) * 0.5, a, b };
}
const overlayText = () => document.getElementById('overlay').style.display !== 'none'
  ? (document.getElementById('waitCard').style.display !== 'none' ? document.getElementById('waitMsg').textContent : 'PIN') : '';

async function newTv(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) page.errors.push('console: ' + m.text()); });
  await page.goto(url);
  return { ctx, page };
}

// Headless Chrome ignores the autoplay rule, so imitate it: audio can only start (resume)
// while the user is clicking / pressing a key, like on a real TV or PC browser.
const strictOf = (browser) => ({
  newContext: async (opts) => {
    const c = await browser.newContext(opts);
    await c.addInitScript(() => {
      const Real = window.AudioContext;
      const realResume = Real.prototype.resume;
      window.AudioContext = function () { const ac = new Real(); ac.suspend(); return ac; };
      window.AudioContext.prototype = Real.prototype;
      Real.prototype.resume = function () {
        if (!navigator.userActivation.isActive) return Promise.reject(new Error('NotAllowedError'));
        return realResume.call(this);
      };
    });
    return c;
  },
});

const S = () => window.BroCastStats;

// ONLY=video runs just the video tests, ONLY=pictures just the older picture ones.
const ONLY = process.env.ONLY || '';

async function pictureTests(browser) {
  const strict = strictOf(browser);
  let phone, ctx, page;

  console.log('1) Basic MJPEG streaming');
  phone = await startPhone();
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingPicture, 10000), 'picture shows up');
  const a = await page.evaluate(sampleRed);
  const ha = await page.evaluate(pictureHash); await sleep(700); const hb = await page.evaluate(pictureHash);
  ok(ha !== hb, `picture is moving (${ha} -> ${hb})`);
  ok(a[3] === 720 && a[4] === 1280, `frame size ${a[3]}x${a[4]}`);
  ok(await page.evaluate(() => document.getElementById('bar').className === 'show'), 'control bar visible at start');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'fsBtn'), 'Full screen button has focus (TV remote OK works)');
  await page.screenshot({ path: OUT + '/1-live.png' });
  await sleep(5600);
  ok(await page.evaluate(() => document.getElementById('bar').className === ''), 'control bar auto-hides');
  ok(await page.evaluate(() => document.body.className === 'idle'), 'mouse cursor hides when idle');
  await page.keyboard.press('f');
  ok(await waitFor(page, () => !!document.fullscreenElement, 3000), 'pressing F goes full screen');
  ok(await page.evaluate(() => document.getElementById('fsBtn').textContent === 'Exit full screen'), 'button says Exit full screen');
  await page.keyboard.press('f');
  ok(await waitFor(page, () => !document.fullscreenElement, 3000), 'pressing F again exits full screen');
  await sleep(1500);
  ok(lastViewers(phone) === 1, 'phone counts 1 viewer: ' + phone.stats[phone.stats.length - 1]);
  ok(await page.evaluate(() => document.title) === 'BroCast • Live', 'tab title says Live');

  console.log('2) Phone stops sharing, then starts again (no page reload)');
  await stopPhone(phone);
  ok(await waitFor(page, () => document.getElementById('waitMsg').textContent === "Can't reach your phone" && document.getElementById('overlay').style.display !== 'none', 12000),
    'shows "Can\'t reach your phone"');
  await page.screenshot({ path: OUT + '/2-cant-reach.png' });
  phone = await startPhone();
  ok(await waitFor(page, showingPicture, 15000), 'reconnects by itself when phone comes back');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await sleep(7500);
  ok(lastViewers(phone) === 0, 'viewer count drops to 0 after TV closes: ' + phone.stats[phone.stats.length - 1]);
  await stopPhone(phone);

  console.log('3) Page opened before phone starts sharing');
  phone = await startPhone(['--live-after', '4']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, () => document.getElementById('waitMsg').textContent === 'Waiting for your phone', 4000), 'shows "Waiting for your phone"');
  await page.screenshot({ path: OUT + '/3-waiting.png' });
  ok(await waitFor(page, showingPicture, 10000), 'starts showing once phone goes live');
  await ctx.close();
  await stopPhone(phone);

  console.log('4) PIN protection');
  phone = await startPhone(['--pin', '4821']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, () => document.getElementById('pinCard').style.display !== 'none', 5000), 'asks for PIN');
  ok(await waitFor(page, () => document.activeElement && document.activeElement.id === 'pinInput', 3000), 'PIN box is focused');
  await page.keyboard.type('1111');
  ok(await waitFor(page, () => document.getElementById('pinError').textContent === 'Wrong PIN. 4 tries left.', 4000),
    'wrong PIN message: ' + await page.evaluate(() => document.getElementById('pinError').textContent));
  await page.screenshot({ path: OUT + '/4-pin.png' });
  ok(!(await page.evaluate(showingPicture)), 'no picture with wrong PIN');
  await page.keyboard.type('4821');
  ok(await waitFor(page, showingPicture, 8000), 'right PIN shows the picture');
  await page.reload();
  ok(await waitFor(page, showingPicture, 8000), 'after reload, remembered (no PIN again)');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  // A fresh browser (no cookie) gets locked out after 5 wrong tries.
  ({ ctx, page } = await newTv(browser, phone.url));
  await waitFor(page, () => document.activeElement && document.activeElement.id === 'pinInput', 5000);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.type('000' + i);
    await waitFor(page, (n) => /Wrong PIN|Too many/.test(document.getElementById('pinError').textContent) && document.getElementById('pinInput').value === '', 3000);
    await sleep(150);
  }
  const lockMsg = await page.evaluate(() => document.getElementById('pinError').textContent);
  ok(/Too many wrong tries\. Wait 60 seconds/.test(lockMsg), 'lockout message: ' + lockMsg);
  await ctx.close();
  await stopPhone(phone);

  console.log('5) Fallback "poll" mode');
  phone = await startPhone();
  ({ ctx, page } = await newTv(browser, phone.url + '?mode=poll'));
  ok(await waitFor(page, showingPicture, 10000), 'picture shows in poll mode');
  const p1 = await page.evaluate(pictureHash); await sleep(700); const p2 = await page.evaluate(pictureHash);
  ok(p1 !== p2, `poll mode picture is moving (${p1} -> ${p2})`);
  await sleep(1500);
  ok(lastViewers(phone) === 1, 'poll viewer counted: ' + phone.stats[phone.stats.length - 1]);
  const blobCount = await page.evaluate(() => performance.getEntriesByType('resource').length);
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();

  console.log('6) Browser that can\'t do MJPEG -> switches to poll mode automatically');
  ({ ctx, page } = await newTv(browser, 'about:blank'));
  await page.route('**/stream.mjpeg*', (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.goto(phone.url);
  ok(await waitFor(page, showingPicture, 20000), 'picture shows via automatic fallback');
  const f1 = await page.evaluate(pictureHash); await sleep(700); const f2 = await page.evaluate(pictureHash);
  ok(f1 !== f2, `fallback picture is moving (${f1} -> ${f2})`);
  await ctx.close();

  console.log('7) Stream that silently hangs -> detected and recovered');
  ({ ctx, page } = await newTv(browser, 'about:blank'));
  await page.route('**/stream.mjpeg*', () => { /* never answer */ });
  await page.goto(phone.url);
  ok(await waitFor(page, showingPicture, 45000), 'recovers from a hung stream');
  await ctx.close();
  await stopPhone(phone);

  console.log('8) Static screen: one frame only, must still be shown');
  phone = await startPhone(['--static']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingPicture, 10000), 'single frame displayed');
  await sleep(300);
  const s1 = await page.evaluate(sampleRed);
  ok(s1[0] < 30 && s1[2] > 150, 'shows frame #0 colors ' + JSON.stringify(s1));
  await sleep(5000);
  ok(await page.evaluate(showingPicture), 'still showing after 5 s of no changes (keepalive works)');
  await ctx.close();
  await stopPhone(phone);

  console.log('9) Phone rotates portrait <-> landscape');
  phone = await startPhone(['--rotate-every', '3']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingPicture, 10000), 'picture shows');
  ok(await waitFor(page, () => document.getElementById('screen').naturalWidth === 720, 5000), 'portrait frame (720 wide)');
  await page.screenshot({ path: OUT + '/9-portrait.png' });
  ok(await waitFor(page, () => document.getElementById('screen').naturalWidth === 1280, 6000), 'landscape frame (1280 wide)');
  await page.screenshot({ path: OUT + '/9-landscape.png' });
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();

  console.log('10) Small window (phone-sized browser)');
  const small = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const sp = await small.newPage();
  await sp.goto(phone.url);
  await waitFor(sp, showingPicture, 10000);
  await stopPhone(phone);
  await waitFor(sp, () => document.getElementById('waitMsg').textContent === "Can't reach your phone", 12000);
  await sp.screenshot({ path: OUT + '/10-small.png' });
  const fits = await sp.evaluate(() => document.getElementById('waitCard').getBoundingClientRect().width <= window.innerWidth);
  ok(fits, 'wait card fits a narrow screen');
  await small.close();

  console.log('11) Browser tries https:// first (Chrome HTTPS-First mode) -> refused instantly');
  phone = await startPhone();
  const hp = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  const t0 = Date.now();
  let httpsErr = '';
  try { await hp.goto(phone.url.replace('http://', 'https://'), { timeout: 10000 }); } catch (e) { httpsErr = String(e.message).split('\n')[0]; }
  const took = Date.now() - t0;
  ok(httpsErr !== '' && took < 1500, `https attempt fails fast (${took} ms: ${httpsErr})`);
  const hp2 = await hp.context().newPage();
  await hp2.goto(phone.url);
  ok(await waitFor(hp2, showingPicture, 10000), 'plain http still works right after');
  await hp.context().close();
  await stopPhone(phone);

  console.log('12) Sound (with real browser autoplay rules: needs a click / key press first)');
  phone = await startPhone();
  ({ ctx, page } = await newTv(strict, phone.url));
  const hintShown = () => document.getElementById('soundHint').style.display !== 'none';
  ok(await waitFor(page, showingPicture, 10000), 'picture shows');
  ok(await waitFor(page, hintShown, 5000), 'shows "Press OK or click anywhere to turn on sound"');
  await page.screenshot({ path: OUT + '/12-sound-hint.png' });
  ok(await waitFor(page, () => window.BroCastStats.chunks > 20, 5000), 'sound data is arriving: ' + JSON.stringify(await page.evaluate(S)));
  ok((await page.evaluate(S)).played === 0, 'but nothing plays before a click (browser rule)');
  await page.mouse.click(640, 360);
  ok(await waitFor(page, () => window.BroCastStats.played > 25, 5000), 'after a click, sound plays: ' + JSON.stringify(await page.evaluate(S)));
  ok(!(await page.evaluate(hintShown)), 'hint goes away');
  const st = await page.evaluate(S);
  ok(st.peak > 0.2 && st.peak < 0.3, 'it is the test tone at 1/4 volume (peak ' + st.peak.toFixed(3) + ')');
  let leads = [];
  for (let i = 0; i < 15; i++) { await sleep(200); leads.push((await page.evaluate(S)).lead); }
  ok(leads.every((l) => l > 0.015 && l < 0.4), 'stays in sync, 0.1 s cushion: ' + leads.map((l) => l.toFixed(2)).join(' '));
  const sk = (await page.evaluate(S)).skipped;
  ok(sk < 5, 'barely any chunks skipped: ' + sk);
  await page.mouse.move(600, 600);
  ok(await page.evaluate(() => document.getElementById('soundBtn').textContent) === 'Sound on', 'Sound on button in the bar');
  await page.screenshot({ path: OUT + '/12-sound-bar.png' });
  await page.click('#soundBtn');
  ok(await page.evaluate(() => document.getElementById('soundBtn').textContent) === 'Sound off', 'mute: button says Sound off');
  await sleep(600);
  const c1 = (await page.evaluate(S)).chunks; await sleep(1000); const c2 = (await page.evaluate(S)).chunks;
  ok(c1 === c2, `muted = stops downloading sound (${c1} -> ${c2})`);
  await page.click('#soundBtn');
  const p0 = (await page.evaluate(S)).played;
  ok(await waitFor(page, (n) => window.BroCastStats.played > n + 20, 5000, p0), 'unmute: plays again');
  console.log('    ...phone stops and starts again');
  await stopPhone(phone);
  phone = await startPhone();
  const pr = (await page.evaluate(S)).played;
  ok(await waitFor(page, (n) => window.BroCastStats.played > n + 20, 15000, pr), 'sound comes back by itself after phone restarts');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();

  console.log('    ...TV remote: pressing OK on the focused Full screen button also turns on sound');
  ({ ctx, page } = await newTv(strict, phone.url));
  await waitFor(page, showingPicture, 10000);
  await waitFor(page, () => document.activeElement && document.activeElement.id === 'fsBtn', 3000);
  await page.keyboard.press('Enter');
  ok(await waitFor(page, () => window.BroCastStats.played > 10, 5000), 'OK press -> sound plays');
  ok(await waitFor(page, () => !!document.fullscreenElement, 3000), 'and it went full screen (one press does both)');
  await ctx.close();
  await stopPhone(phone);

  console.log('    ...phone sharing without sound');
  phone = await startPhone(['--no-audio']);
  ({ ctx, page } = await newTv(strict, phone.url));
  await waitFor(page, showingPicture, 10000);
  await sleep(2500);
  ok(!(await page.evaluate(hintShown)), 'no sound hint');
  ok(await page.evaluate(() => document.getElementById('soundBtn').style.display === 'none'), 'no sound button');
  ok((await page.evaluate(S)).chunks === 0, 'no sound connection');
  await ctx.close();
  await stopPhone(phone);

}

async function videoTests(browser) {
  const strict = strictOf(browser);
  let phone, ctx, page, mv;
  console.log('13) Video mode: real H.264 through the browser\'s video player');
  phone = await startPhone(['--video']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'video shows up');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('screen')).display === 'none'), 'picture-by-picture view is off');
  await sleep(1000);
  const v1 = await page.evaluate(videoHash); await sleep(1000); const v2 = await page.evaluate(videoHash);
  ok(v1 !== v2, `video picture is changing (${v1} -> ${v2})`);
  mv = await videoMoves(page, 1500);
  ok(mv.moved, 'video time moves: ' + JSON.stringify([mv.a.t, mv.b.t]));
  ok(mv.b.w === 720 && mv.b.h === 1280, `video size ${mv.b.w}x${mv.b.h}`);
  const lags = [];
  for (let i = 0; i < 12; i++) { await sleep(250); const x = await page.evaluate(vinfo); lags.push(x.end - x.t); }
  ok(lags.every((l) => l >= -0.05 && l < 0.8), 'stays close to live (buffer ahead, s): ' + lags.map((l) => l.toFixed(2)).join(' '));
  await page.screenshot({ path: OUT + '/13-video.png' });
  await sleep(4000);
  const vs13 = (await page.evaluate(vinfo)).stats;
  ok(vs13.resets === 0 && vs13.reconnects === 0, 'no restarts needed: ' + JSON.stringify(vs13));
  ok(lastMode(phone) === 'h264', 'phone sends video: ' + phone.stats[phone.stats.length - 1]);
  ok(lastViewers(phone) === 1, 'phone counts 1 viewer');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('14) Video: still screen (one frame, then nothing) stays up without restarting');
  phone = await startPhone(['--video', '--static']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'still picture shows');
  await sleep(9000);
  ok(await page.evaluate(showingVideo), 'still showing after 9 s of nothing new');
  const vs14 = (await page.evaluate(vinfo)).stats;
  ok(vs14.resets === 0 && vs14.reconnects === 0, 'no restart loop on a still screen: ' + JSON.stringify(vs14));
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('15) Video: phone pauses for 3 s (still screen), then moves again -> picks right back up');
  phone = await startPhone(['--video', '--pause-every', '7', '--pause-for', '3']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  // Wait until the pause (7..10 s after the phone started), then check it plays again after.
  await sleep(Math.max(0, 7600 - (Date.now() - phone.startedAt)));
  const during = await videoMoves(page, 1200);
  ok(!during.moved, 'during the pause the picture holds still: ' + JSON.stringify([during.a.t, during.b.t]));
  await sleep(Math.max(0, 10600 - (Date.now() - phone.startedAt)));
  const after = await videoMoves(page, 1500);
  ok(after.moved, 'moves again right after: ' + JSON.stringify([after.a.t, after.b.t, after.b.end]));
  const x15 = await page.evaluate(vinfo);
  ok(x15.end - x15.t < 0.8, 'and is back at live (' + (x15.end - x15.t).toFixed(2) + ' s behind)');
  ok(x15.stats.resets === 0, 'without restarting the player: ' + JSON.stringify(x15.stats));
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('16) Video: phone rotates portrait <-> landscape');
  phone = await startPhone(['--video', '--rotate-every', '4']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  ok(await waitFor(page, () => document.getElementById('vid').videoWidth === 720, 5000), 'portrait video (720 wide)');
  ok(await waitFor(page, () => document.getElementById('vid').videoWidth === 1280, 8000), 'landscape video (1280 wide)');
  await sleep(500);
  mv = await videoMoves(page, 1200);
  ok(mv.moved, 'keeps playing after rotating');
  await page.screenshot({ path: OUT + '/16-video-landscape.png' });
  ok(await waitFor(page, () => document.getElementById('vid').videoWidth === 720, 8000), 'and back to portrait');
  mv = await videoMoves(page, 1200);
  ok(mv.moved, 'still playing');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('17) Video: connection silently stops delivering (Wi-Fi hiccup) -> noticed and fixed');
  phone = await startPhone(['--video']);
  ({ ctx, page } = await newTv(browser, 'about:blank'));
  let conns = 0, freezeFirst = false;
  await page.routeWebSocket('**/video*', (ws) => {
    const n = ++conns;
    const server = ws.connectToServer();
    server.onMessage((m) => { if (!(n === 1 && freezeFirst)) ws.send(m); });
    ws.onMessage((m) => server.send(m));
  });
  await page.goto(phone.url);
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  await sleep(1500);
  freezeFirst = true;
  const frozeAt = Date.now();
  await sleep(1500);
  const f17 = await videoMoves(page, 1000);
  ok(!f17.moved, 'the picture froze (like the bug you saw)');
  ok(await waitFor(page, () => window.BroCastVideo.reconnects >= 1, 10000), 'page noticed and reconnected');
  const fixedIn = Date.now() - frozeAt;
  let back = false;
  for (let i = 0; i < 20 && !back; i++) { back = (await videoMoves(page, 500)).moved; }
  ok(back, 'video plays again');
  ok(fixedIn < 7000, `fixed within ${(fixedIn / 1000).toFixed(1)} s of freezing`);
  ok(conns >= 2, 'used a new connection');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('18) A TV that can\'t play video makes the phone send pictures; it switches back after');
  phone = await startPhone(['--video']);
  const oldTv = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await oldTv.addInitScript(() => { if (window.MediaSource) window.MediaSource.isTypeSupported = () => false; });
  const op = await oldTv.newPage();
  await op.goto(phone.url);
  ok(await waitFor(op, showingPicture, 15000), 'old TV gets pictures');
  const o1 = await op.evaluate(pictureHash); await sleep(700); const o2 = await op.evaluate(pictureHash);
  ok(o1 !== o2, 'and they move');
  await sleep(1500);
  ok(lastMode(phone) === 'jpeg', 'phone switched to pictures: ' + phone.stats[phone.stats.length - 1]);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingPicture, 15000), 'a new PC meanwhile also gets pictures');
  await oldTv.close();
  ok(await waitFor(page, showingVideo, 20000), 'old TV gone -> the PC switches to video by itself');
  ok(lastMode(phone) === 'h264', 'phone is back to video');
  mv = await videoMoves(page, 1200);
  ok(mv.moved, 'video plays');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('19) Video player keeps failing -> falls back to pictures, never a black screen');
  phone = await startPhone(['--video']);
  const broken = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await broken.addInitScript(() => {
    window.__realAppend = SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer = function () { throw new Error('decoder broke'); };
  });
  page = await broken.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(phone.url);
  ok(await waitFor(page, showingPicture, 25000), 'shows pictures instead');
  ok(await page.evaluate(() => window.BroCastVideo.resets) >= 3, 'after trying the video player a few times');
  const b1 = await page.evaluate(pictureHash); await sleep(700); const b2 = await page.evaluate(pictureHash);
  ok(b1 !== b2, 'pictures move');
  // Later on it gives the video another go (here: right away, by moving the retry time).
  await page.evaluate(() => { SourceBuffer.prototype.appendBuffer = window.__realAppend; });
  await page.evaluate(() => { window.BroCastRetryNow && window.BroCastRetryNow(); });
  ok(await waitFor(page, showingVideo, 20000), 'and switches back to video once the player works again');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await broken.close();
  await stopPhone(phone);

  console.log('20) Video + sound: sound waits for the picture so they stay in sync');
  phone = await startPhone(['--video']);
  ({ ctx, page } = await newTv(strict, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  await page.mouse.click(640, 360);
  ok(await waitFor(page, () => window.BroCastStats.played > 25, 5000), 'sound plays');
  await sleep(5000); // it lines up gently (2% faster/slower), so give it a few seconds
  const sync = [];
  const skippedBefore = (await page.evaluate(S)).skipped;
  for (let i = 0; i < 10; i++) {
    await sleep(200);
    sync.push(await page.evaluate(() => [window.BroCastStats.lead, window.BroCastVideo.lag / 1000]));
  }
  ok(sync.every(([lead, lag]) => Math.abs(lead - (Math.max(0.1, lag + 0.05))) < 0.06),
    'sound delay follows the video delay: ' + sync.map(([a, b]) => a.toFixed(2) + '/' + b.toFixed(2)).join(' '));
  const skippedNow = (await page.evaluate(S)).skipped;
  ok(skippedNow - skippedBefore <= 2, `once lined up, no sound gets cut (${skippedNow - skippedBefore} bits skipped; ${skippedBefore} while starting)`);
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('21) Video with a PIN');
  phone = await startPhone(['--video', '--pin', '4821']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, () => document.activeElement && document.activeElement.id === 'pinInput', 5000), 'asks for PIN');
  await page.keyboard.type('4821');
  ok(await waitFor(page, showingVideo, 15000), 'right PIN -> video');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('24) English from the phone: shown over the subtitle, said with a guy/girl voice, show ducked');
  phone = await startPhone(['--video', '--subs']);
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // A stand-in for the computer's voices that records what gets said.
  await ctx.addInitScript(() => {
    const said = [];
    window.__said = said;
    const voices = [
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
      { name: 'Microsoft Denise Online (Natural) - French (France)', lang: 'fr-FR' },
    ];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    const fake = {
      speaking: false,
      getVoices: () => voices,
      cancel() {},
      speak(u) {
        said.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate });
        setTimeout(() => u.onend && u.onend(), 1200);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
  });
  page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(phone.url);
  ok(await waitFor(page, showingVideo, 15000), 'video shows up');
  ok(await waitFor(page, () => document.getElementById('en').style.display === 'block', 9000), 'English box shows up');
  const box = await page.evaluate(() => {
    const e = document.getElementById('en').getBoundingClientRect();
    const v = document.getElementById('vid');
    const vw = innerWidth, vh = innerHeight, s = Math.min(vw / v.videoWidth, vh / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s, ox = (vw - w) / 2, oy = (vh - h) / 2;
    return { text: document.getElementById('en').textContent, cx: (e.left + e.right) / 2, cy: (e.top + e.bottom) / 2,
      want: { cx: ox + 0.5 * w, cy: oy + 0.83 * h }, left: e.left, right: e.right, ox, w };
  });
  ok(Math.abs(box.cx - box.want.cx) < 8 && Math.abs(box.cy - box.want.cy) < 12, 'sits right on the original subtitle: ' + JSON.stringify(box));
  ok(box.left >= box.ox - 1 && box.right <= box.ox + box.w + 1, 'stays inside the picture');
  await page.screenshot({ path: OUT + '/24-english.png' });
  ok(await waitFor(page, () => window.__said.length >= 2, 12000), 'lines are said out loud');
  ok(await page.evaluate(() => /sword/.test(window.__said[0].text)), 'the very first line is said too');
  const said = await page.evaluate(() => window.__said);
  ok(said.every((x) => x.voice && x.voice.includes('Online (Natural)')), 'natural voices: ' + JSON.stringify(said));
  const guy = said.find((x) => /sword|train/.test(x.text)), girl = said.find((x) => /came back/.test(x.text));
  ok(guy && /Guy/.test(guy.voice) && girl && /Jenny/.test(girl.voice), 'guy voice for the low voice, girl voice for the high one');
  ok(await page.evaluate(() => document.getElementById('trBtn').style.display === 'none' && document.getElementById('vcBtn').style.display === ''),
    'Translate button hidden (the phone translates), Voice button there');
  // Line 3 is already drawn into the picture (whole-screen sharing): said, but no second box.
  ok(await waitFor(page, () => window.__said.some((x) => /train/.test(x.text)), 12000), 'third line said');
  ok(await page.evaluate(() => document.getElementById('en').style.display === 'none'), 'no box over English that is already in the picture');
  await page.evaluate(() => document.getElementById('vcBtn').click());
  const before = await page.evaluate(() => window.__said.length);
  await sleep(4500);
  ok(await page.evaluate((n) => window.__said.length === n, before), 'Voice off: nothing more is said');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);

  console.log('23) Translate button opens SUBDUB ready for this tab');
  phone = await startPhone(['--video']);
  ({ ctx, page } = await newTv(browser, phone.url));
  await ctx.route('https://kunven67-sudo.github.io/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>SUBDUB</title>' }));
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  await page.mouse.move(600, 600);
  ok(await page.evaluate(() => document.getElementById('trBtn').style.display !== 'none'), 'Translate button in the bar (PC browser)');
  const [sub] = await Promise.all([ctx.waitForEvent('page'), page.click('#trBtn')]);
  ok(sub.url() === 'https://kunven67-sudo.github.io/k/subdub/?from=brocast', 'opens SUBDUB in BroCast mode: ' + sub.url());
  await page.bringToFront();
  ok((await videoMoves(page, 1200)).moved, 'video keeps playing');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  // A smart TV doesn't get the button (SUBDUB needs a computer).
  const tv = await browser.newContext({ userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0 TV Safari/537.36' });
  const tp = await tv.newPage();
  await tp.goto(phone.url);
  await waitFor(tp, showingVideo, 15000);
  ok(await tp.evaluate(() => document.getElementById('trBtn').style.display === 'none'), 'no Translate button on a TV');
  await tv.close();
  await stopPhone(phone);

  console.log('22) Tab in the background keeps playing (sound keeps going, screen recorders keep working)');
  phone = await startPhone(['--video']);
  ({ ctx, page } = await newTv(browser, phone.url));
  ok(await waitFor(page, showingVideo, 15000), 'video shows');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const ap1 = await page.evaluate(() => window.BroCastVideo.appended);
  await sleep(4000);
  const ap2 = await page.evaluate(() => window.BroCastVideo.appended);
  ok(ap2 - ap1 > 60, `still receiving while hidden (${ap2 - ap1} frames in 4 s)`);
  // A browser pausing the video in a background tab must not count as "stuck".
  await page.evaluate(() => document.getElementById('vid').pause());
  await sleep(5000);
  const hid = (await page.evaluate(vinfo)).stats;
  ok(hid.resets === 0, 'a paused background video is not treated as stuck: ' + JSON.stringify(hid));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  ok(await waitFor(page, () => { const v = document.getElementById('vid'); return !v.paused && v.buffered.length && v.buffered.end(v.buffered.length - 1) - v.currentTime < 0.8; }, 6000),
    'back in front: plays again, right at live');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();
  await stopPhone(phone);
}

(async () => {
  const browser = await chromium.launch();
  if (ONLY !== 'video') await pictureTests(browser);
  if (ONLY !== 'pictures') await videoTests(browser);
  await browser.close();
  console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
