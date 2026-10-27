// Subtitle reader on pictures with black bars (a phone shown on a PC, like the BroCast tab),
// and with two subtitles at once. Runs SubWatch in Chromium on a drawn test picture, with a
// stand-in reader (no models needed). Run: NODE_PATH=<where playwright is> node tests/subwatch-bars.mjs
import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import url from 'url';

const { chromium } = createRequire(import.meta.url)('playwright'); // (NODE_PATH works here)
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const bundle = await esbuild.build({
  stdin: {
    contents: `import { SubWatch } from './src/engine/subwatch.js'; window.SubWatch = SubWatch;`,
    resolveDir: root, loader: 'js',
  },
  bundle: true, format: 'iife', write: false, platform: 'browser',
});
const code = bundle.outputFiles[0].text;

let failures = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) failures++; };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="1280" height="720"></canvas>');
await page.addScriptTag({ content: code });

// scene: { bars: 'pillar' | 'none' | 'letter', lines: [{ text, w, h, dy }] }  (sizes as parts of the picture)
async function run(scene, secs) {
  return page.evaluate(async ({ scene, secs }) => {
    const c = document.getElementById('c'), g = c.getContext('2d');
    const W = 1280, H = 720;
    // the phone picture inside the frame
    const pic = scene.bars === 'pillar' ? { x: 460, y: 0, w: 360, h: 720 }
      : scene.bars === 'letter' ? { x: 0, y: 72, w: 1280, h: 576 } : { x: 0, y: 0, w: W, h: H };
    let frame = 0;
    const draw = () => {
      frame++;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      // a moving, colourful "anime" picture
      const grd = g.createLinearGradient(pic.x, pic.y, pic.x + pic.w, pic.y + pic.h);
      grd.addColorStop(0, '#3a6'); grd.addColorStop(1, '#a5c');
      g.fillStyle = grd; g.fillRect(pic.x, pic.y, pic.w, pic.h);
      g.fillStyle = '#fc4'; g.fillRect(pic.x + (frame * 7) % (pic.w - 60), pic.y + pic.h * 0.3, 60, 60);
      // subtitles: white boxes standing in for text, centred near the bottom of the picture
      scene.lines.forEach((l, i) => {
        const lw = pic.w * l.w, lh = pic.h * l.h;
        g.fillStyle = '#fff';
        g.fillRect(pic.x + (pic.w - lw) / 2, pic.y + pic.h * (0.86 - (scene.lines.length - 1 - i) * 0.08) - lh / 2, lw, lh);
      });
    };
    draw();
    const timer = setInterval(draw, 1000 / 30);
    const v = document.createElement('video');
    v.muted = true; v.srcObject = c.captureStream(30); await v.play();
    await new Promise((r) => { const t = () => (v.videoWidth ? r() : setTimeout(t, 20)); t(); });

    // stand-in reader: finds the white boxes in the picture it's given, top to bottom
    const reads = [];
    const eyes = {
      call: async (m, { img }) => {
        reads.push({ w: img.width, h: img.height });
        const rowsHit = [];
        for (let y = 0; y < img.height; y++) {
          let x0 = -1, x1 = -1;
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            if (img.data[i] > 240 && img.data[i + 1] > 240 && img.data[i + 2] > 240) { if (x0 < 0) x0 = x; x1 = x; }
          }
          if (x0 >= 0) rowsHit.push({ y, x0, x1 });
        }
        const boxes = [];
        for (const r of rowsHit) {
          const b = boxes[boxes.length - 1];
          if (b && r.y === b.y2 + 1) { b.y2 = r.y; b.x = Math.min(b.x, r.x0); b.x2 = Math.max(b.x2, r.x1); } else boxes.push({ x: r.x0, x2: r.x1, y: r.y, y2: r.y });
        }
        return boxes.map((b, i) => ({ text: scene.lines[i] ? scene.lines[i].text : '?', conf: 0.95, box: { x: b.x, y: b.y, x2: b.x2 + 1, y2: b.y2 + 1 } }));
      },
    };
    const translate = { toEnglish: async (t) => 'EN(' + t + ')' };
    const subs = [];
    const w = new window.SubWatch({ eyes, translate, video: v, clock: () => v.currentTime, settings: { readSubs: true } });
    w.addEventListener('sub', (e) => subs.push(JSON.parse(JSON.stringify(e.detail))));
    w.start();
    await new Promise((r) => setTimeout(r, secs * 1000));
    w.stop(); clearInterval(timer);
    return { reads, subs, pic };
  }, { scene, secs });
}

console.log('1) Phone picture with black bars left and right (BroCast tab, portrait phone)');
let r = await run({ bars: 'pillar', lines: [{ text: '¿Qué pasó aquí, amigo?', w: 0.7, h: 0.035 }] }, 9);
const last = r.reads[r.reads.length - 1];
ok(r.reads.length > 3, `read ${r.reads.length} times`);
ok(r.reads[0].w === 1280, 'first reads cover the whole width (bars not trusted yet)');
ok(last.w < 600, `once the bars are known, only the picture is read (${last.w} px wide instead of 1280)`);
ok(r.subs.length >= 1 && r.subs[0].en === 'EN(¿Qué pasó aquí, amigo?)', 'subtitle found and translated: ' + JSON.stringify(r.subs.map((s) => s.en)));
const sb = r.subs[r.subs.length - 1].box;
ok(Math.abs(sb.x + sb.w / 2 - 0.5) < 0.02 && sb.w < 0.25 && sb.y > 0.8 && sb.y < 0.9, 'its spot is right on the whole frame: ' + JSON.stringify(sb));

console.log('2) No bars: reads the whole width like before');
r = await run({ bars: 'none', lines: [{ text: 'こんにちは', w: 0.3, h: 0.05 }] }, 8);
ok(r.reads.every((x) => x.w === 1280), 'every read is full width');
ok(r.subs.length >= 1 && r.subs[0].lang === 'ja', 'Japanese subtitle found');

console.log('3) Bars on top and bottom (BroCast tab, phone sideways)');
r = await run({ bars: 'letter', lines: [{ text: 'Não sei o que fazer', w: 0.5, h: 0.05 }] }, 9);
ok(r.subs.length >= 1 && r.subs[0].lang === 'pt', 'Portuguese subtitle found: ' + JSON.stringify(r.subs.map((s) => s.text)));

console.log('4) Two subtitles at once: Chinese on top, English under it');
r = await run({ bars: 'none', lines: [{ text: '你在这里做什么', w: 0.4, h: 0.05 }, { text: 'What are you doing here', w: 0.5, h: 0.05 }] }, 6);
ok(r.subs.length >= 1 && r.subs[0].text === '你在这里做什么' && r.subs[0].lang === 'zh', 'only the Chinese line is the subtitle: ' + JSON.stringify(r.subs.map((s) => s.text)));
ok(r.subs[0] && r.subs[0].en === 'EN(你在这里做什么)', 'and it gets translated');

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
