// Test page: runs file mode on a clip in a real browser and reports what happened.
import { Engine } from '../src/engine/engine.js';
import { FileDub } from '../src/engine/filedub.js';
import { Cast } from '../src/engine/cast.js';
import { Translate } from '../src/engine/translate.js';

const q = new URLSearchParams(location.search);
const log = (m) => { console.log(m); document.getElementById('o').textContent += m + '\n'; };
window.__out = { lines: [], log: [] };
(async () => {
  const t0 = performance.now();
  const engine = new Engine('../');
  engine.settings = { useGpu: q.get('gpu') === '1' };
  let lastP = 0;
  engine.addEventListener('progress', (e) => { const { loaded, total } = e.detail; if (total && loaded / total - lastP > 0.1) { lastP = loaded / total; log(`download ${(loaded / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`); } });
  const [listen, asr, tts, sep] = await Promise.all(['listen', 'asr', 'tts', 'sep'].map(n => engine.start(n)));
  log(`brains ready ${((performance.now() - t0) / 1000).toFixed(1)}s gpu=${JSON.stringify(engine.gpu)}`);
  const settings = { mode: 'dub', fileModel: q.get('model') || 'good' };
  const cast = new Cast('test');
  const tr = new Translate(asr);
  const dub = new FileDub({ engine: { listen, asr, tts, sep }, cast, translate: tr, settings });
  const res = await fetch('media/' + q.get('clip'));
  const t1 = performance.now();
  await dub.load(await res.arrayBuffer());
  log(`decoded ${dub.duration.toFixed(1)}s in ${((performance.now() - t1) / 1000).toFixed(1)}s`);
  const maxPieces = +(q.get('pieces') || 1);
  dub.pieces = dub.pieces.slice(0, maxPieces + 1);
  dub.addEventListener('line', (e) => {
    const l = e.detail, c = cast.byId(l.charId);
    const row = { s: +l.s.toFixed(2), e: +l.e.toFixed(2), who: c.name, g: cast.gender(c), voice: cast.voice(c).label, pitch: Math.round(c.pitchAvg), lang: l.lang, keep: l.keep && l.why, src: l.src, en: l.en, dur: l.dur && +l.dur.toFixed(2), speed: l.speed && +l.speed.toFixed(2) };
    window.__out.lines.push(row);
    log(`[${row.s}-${row.e}] ${row.who}(${row.g},${row.pitch}Hz,${row.voice}) ${row.lang}${row.keep ? ' KEEP:' + row.keep : ''} | ${row.src} => ${row.en}${row.dur ? ` (${row.dur}s @${row.speed})` : ''}`);
  });
  const t2 = performance.now();
  dub.addEventListener('progress', (e) => log(`progress ${JSON.stringify(e.detail)} at ${((performance.now() - t2) / 1000).toFixed(1)}s`));
  // stop after N pieces
  const origDub = dub._dubPiece.bind(dub);
  let done = 0;
  dub._dubPiece = async (p) => { await origDub(p); if (++done >= maxPieces) dub.stop(); };
  await dub.run();
  window.__out.secs = (performance.now() - t2) / 1000;
  window.__out.cast = cast.chars.map(c => ({ name: c.name, g: cast.gender(c), score: +c.score.toFixed(1), pitch: Math.round(c.pitchAvg), lines: c.lines, voice: cast.voice(c).label }));
  // a mixed preview of the first piece (background + English voices) for listening tests
  const p = dub.pieces[0], bg = dub.background(p);
  const mix = [new Float32Array(bg.L), new Float32Array(bg.R)];
  for (const l of dub.lines) if (l.audio && !l.keep && l.s < p.e) { const o = Math.floor(l.s * 44100); for (let i = 0; i < l.audio.length && o + i < mix[0].length; i++) { mix[0][o + i] += l.audio[i] * l.gain; mix[1][o + i] += l.audio[i] * l.gain; } }
  window.__mix = mix;
  log(`DONE in ${window.__out.secs.toFixed(1)}s; cast ${JSON.stringify(window.__out.cast)}`);
  document.title = 'DONE';
})().catch(e => { log('ERROR ' + e.message + '\n' + e.stack); document.title = 'DONE'; });
