// "Read" worker: finds and reads subtitle text in video frames (PaddleOCR).
import { serve } from '../engine/rpc.js';
import { setupOrt, session, ort } from '../engine/ortsetup.js';
import { MODELS, ocrRecUrl, ocrDictUrl } from '../engine/models.js';
import { fetchModel } from '../engine/cache.js';
import { PaddleOCR, parseDictYml } from '../lib/ocr.js';
import { looksEnglish, sameText } from '../engine/textclean.js';

let ocr = null;
const recs = {}; // writing system -> {sess, chars}
async function getRec(kind, emit) {
  if (!recs[kind]) {
    const onProgress = (p) => emit('progress', p);
    const [s, yml] = await Promise.all([session(ocrRecUrl(kind), { onProgress }), fetchModel(ocrDictUrl(kind))]);
    recs[kind] = { sess: s, chars: ['', ...parseDictYml(new TextDecoder().decode(yml)), ' '] };
  }
  return recs[kind];
}
// Which alphabet's reader got it right? The main reader wins ties (it also reads English, Chinese and Japanese);
// another reader must be clearly surer. Accents: the Latin reader wins when it only adds accents to the same words.
// Cyrillic: the main reader reads it as look-alike Latin letters (MbI = Мы), so a sure Cyrillic read wins, unless
// the main read is plainly English.
const plain = (t) => t.normalize('NFD').replace(/[\u0300-\u036f¿¡]/g, '').replace(/\s+/g, '').toLowerCase();
// same words give or take a misread letter or two (edit distance)
function near(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= Math.max(1, Math.round(a.length * 0.08));
}
function pick(all) {
  const main = all.find(r => r.kind === 'main') || all[0];
  let best = main;
  for (const r of all) {
    if (r === main || !r.text) continue;
    if (r.kind === 'latin' && near(plain(r.text), plain(main.text))) { if (r.conf >= main.conf - 0.01) best = r; continue; }
    if (r.kind === 'eslav' && /[\u0400-\u04ff]/.test(r.text) && main.conf >= 0.93 && looksEnglish(main.text)) continue;
    const margin = main.conf < 0.75 ? 0 : 0.03;
    if (r.conf > best.conf + margin) best = r;
  }
  return best;
}
serve({
  async init({ threads = 1 }, emit) {
    await setupOrt({ threads, onProgress: (p) => emit('progress', p) });
    const det = await session(MODELS.ocrDet.url, { onProgress: (p) => emit('progress', p) });
    const main = await getRec('main', emit);
    ocr = new PaddleOCR(ort, det, main.sess, main.chars.slice(1, -1));
    return true;
  },
  // img: {data, width, height} RGBA. kinds: writing systems to try (e.g. ['main', 'korean']). Returns text lines (top to bottom).
  // known: texts already on screen. A box whose quick (main) read matches one of them keeps it without the other readers.
  async read({ img, kinds = ['main'], maxSide = 960, known = [] }, emit) {
    const knownLines = known.flatMap(t => t.split('\n'));
    const boxes = await ocr.detect(img, { maxSide });
    const lines = [];
    for (const b of boxes) {
      if ((b.x2 - b.x) < 8 || (b.y2 - b.y) < 6) continue;
      const all = [];
      for (const k of kinds) {
        const r = await getRec(k, emit);
        all.push({ ...(await ocr.recognize(img, b, r.sess, r.chars)), kind: k });
        if (all.length === 1 && knownLines.length) {
          const same = knownLines.find(t => sameText(t, all[0].text));
          if (same && all[0].conf > 0.6) { all[0] = { ...all[0], text: same, conf: Math.max(all[0].conf, 0.9) }; break; }
        }
      }
      const best = pick(all);
      if (best?.text) lines.push({ ...best, box: b });
    }
    lines.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    return lines;
  },
});
