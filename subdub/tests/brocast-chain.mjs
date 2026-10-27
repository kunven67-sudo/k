// The whole BroCast -> SUBDUB chain, for real: a fake phone (BroCast's DevServer) streams a clip with
// burned-in subtitles as H.264, the BroCast page plays it in one tab, and SUBDUB's real subtitle
// reader + translator read that tab through tab capture, like on the user's PC.
//
// Needs: a headed Chromium (run under xvfb-run), ffmpeg, BroCast's test classpath
// (cd ../brocast && gradle :core:writeTestClasspath), and internet for the reader/translator models.
// Run:  xvfb-run -a node tests/brocast-chain.mjs <clip.mp4> [seconds]
import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import url from 'url';

const { chromium } = createRequire(import.meta.url)('playwright'); // (NODE_PATH works here)
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const brocast = path.resolve(root, '../brocast');
const [clip, secs = '50'] = process.argv.slice(2);
const OUT = path.join(root, 'test-out');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 1) the SUBDUB side: a small page with the real SubWatch + reader + translator
const harness = `
import { Engine } from '../src/engine/engine.js';
import { SubWatch } from '../src/engine/subwatch.js';
import { Translate } from '../src/engine/translate.js';
window.__subs = []; window.__log = [];
const say = (m) => { window.__log.push(m); console.log('HARNESS ' + m); };
window.__start = async () => {
  const engine = new Engine('../');
  engine.settings = { useGpu: false };
  const [eyes, asr] = await Promise.all([engine.start('eyes'), engine.start('asr')]);
  say('brains ready');
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true, selfBrowserSurface: 'exclude' });
  const vt = stream.getVideoTracks()[0];
  say('captured ' + vt.label + ' ' + vt.getSettings().displaySurface + ' ' + vt.getSettings().width + 'x' + vt.getSettings().height);
  const v = document.createElement('video'); v.muted = true; v.srcObject = stream; document.body.append(v); await v.play();
  const t0 = performance.now();
  const watch = new SubWatch({ eyes, translate: new Translate(asr), video: v, clock: () => (performance.now() - t0) / 1000, settings: { readSubs: true } });
  watch.addEventListener('sub', (e) => { const s = e.detail; window.__subs.push({ t: +s.s.toFixed(1), lang: s.lang, text: s.text, en: s.en || null, box: s.box }); say('SUB ' + s.lang + ' | ' + s.text.replace(/\\n/g, ' / ') + ' -> ' + (s.en || '')); });
  watch.addEventListener('error', (e) => say('ERROR ' + (e.detail && e.detail.message || e.detail)));
  watch.start();
  return true;
};
`;
await esbuild.build({ stdin: { contents: harness, resolveDir: OUT, loader: 'js' }, bundle: true, format: 'esm', outfile: path.join(OUT, 'brocast-chain.js'), logLevel: 'warning' });
fs.writeFileSync(path.join(OUT, 'brocast-chain.html'), '<!doctype html><title>SUBDUB chain test</title><body><script type="module" src="brocast-chain.js"></script>');

// 2) servers: SUBDUB (cross-origin isolated) and the fake phone streaming the clip
const procs = [];
const start = (cmd, args, opts, ready) => new Promise((resolve) => {
  const p = spawn(cmd, args, opts);
  procs.push(p);
  p.stdout.on('data', (d) => { if (ready.test(String(d))) resolve(p); });
  p.stderr.on('data', (d) => { const s = String(d); if (!/JAVA_TOOL_OPTIONS/.test(s)) process.stderr.write('[' + cmd + '] ' + s); });
});
await start('node', ['tools/serve.mjs', '.', '8140'], { cwd: root }, /serving/);
const CP = fs.readFileSync(path.join(brocast, 'core/build/test-classpath.txt'), 'utf8').trim();
await start('java', ['-cp', CP, 'com.brocast.core.DevServerKt', '--port', '18400', '--source', path.resolve(clip), '--size', '1600x720', '--no-audio'], {}, /READY/);
log('servers up');

// 3) a real (headed) Chromium: BroCast in one tab, SUBDUB capturing it from another
const ctx = await chromium.launchPersistentContext(path.join(OUT, 'chain-profile'), {
  headless: false, viewport: { width: 1280, height: 720 },
  args: ['--auto-select-desktop-capture-source=BroCastChainTab', '--auto-select-tab-capture-source-by-title=BroCastChainTab', '--enable-usermedia-screen-capturing', '--autoplay-policy=no-user-gesture-required'],
});
const tv = ctx.pages()[0] || await ctx.newPage();
await tv.goto('http://127.0.0.1:18400/');
await tv.waitForFunction(() => document.title === 'BroCast • Live' && document.getElementById('vid').style.display === 'block', null, { timeout: 30000 });
log('BroCast page is playing video', await tv.evaluate(() => { const v = document.getElementById('vid'); return v.videoWidth + 'x' + v.videoHeight; }));
// (Chrome's auto-pick matches the tab title; a plain one is safest for the command line)
await tv.evaluate(() => { document.title = 'BroCastChainTab'; });
const sd = await ctx.newPage();
sd.on('console', (m) => { const t = m.text(); if (/HARNESS|error/i.test(t)) log(t.slice(0, 300)); });
sd.on('pageerror', (e) => log('PAGEERROR', e.message));
await sd.goto('http://localhost:8140/test-out/brocast-chain.html');
await sd.waitForFunction(() => !!window.__start);
await sd.evaluate(() => window.__start());
await tv.bringToFront(); // the user watches BroCast; SUBDUB works from its own tab
log(`watching for ${secs} s (first run downloads the reader + translator models)`);
// move the mouse over BroCast now and then, so its buttons show up like when you use it
for (let t = 0; t < +secs; t += 4) {
  await tv.mouse.move(300 + (t * 37) % 600, 200 + (t * 23) % 300);
  await new Promise((r) => setTimeout(r, 4000));
}
const subs = await sd.evaluate(() => window.__subs);
fs.writeFileSync(path.join(OUT, 'brocast-chain.result.json'), JSON.stringify(subs, null, 1));
await tv.screenshot({ path: path.join(OUT, 'brocast-chain-tv.png') });

// 4) did every subtitle make it through, in the right language?
let failures = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) failures++; };
const find = (lang, re) => subs.find((s) => s.lang === lang && re.test(s.text.replace(/\s+/g, '')));
const es = find('es', /Qué|haciendo|aquí/), ja = find('ja', /何|して/), pt = find('pt', /não|fazer|sei/i), zh = find('zh', /你|这里|什么/);
ok(es && /doing|here/i.test(es.en || ''), 'Spanish subtitle read + translated: ' + JSON.stringify(es && [es.text, es.en]));
ok(ja && (ja.en || '').length > 3, 'Japanese subtitle read + translated: ' + JSON.stringify(ja && [ja.text, ja.en]));
ok(pt && /know|do/i.test(pt.en || ''), 'Portuguese subtitle read + translated: ' + JSON.stringify(pt && [pt.text, pt.en]));
ok(zh && !/What are you/i.test(zh.text) && (zh.en || '').length > 3, 'Chinese line of the Chinese + English pair, translated: ' + JSON.stringify(zh && [zh.text, zh.en]));
ok(subs.some((s) => s.lang === 'en' && /home/i.test(s.text)) && !subs.some((s) => s.lang !== 'en' && /home/i.test(s.text)), 'English line left alone');
const junk = subs.filter((s) => /Full screen|LIVE|Translate|Dev Phone|Sound on/.test(s.text));
ok(junk.length === 0, "BroCast's own buttons never end up in a subtitle: " + JSON.stringify(junk.map((s) => s.text)));
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
await ctx.close();
for (const p of procs) p.kill('SIGKILL');
process.exit(failures ? 1 : 0);
