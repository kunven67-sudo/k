// "Read" worker: finds and reads subtitle text in video frames (PaddleOCR).
import { serve } from '../engine/rpc.js';
import { setupOrt, session, ort } from '../engine/ortsetup.js';
import { MODELS, ocrRecUrl, ocrDictUrl } from '../engine/models.js';
import { fetchModel } from '../engine/cache.js';
import { PaddleOCR, parseDictYml } from '../lib/ocr.js';

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
serve({
  async init({ threads = 1 }, emit) {
    await setupOrt({ threads, onProgress: (p) => emit('progress', p) });
    const det = await session(MODELS.ocrDet.url, { onProgress: (p) => emit('progress', p) });
    const main = await getRec('main', emit);
    ocr = new PaddleOCR(ort, det, main.sess, main.chars.slice(1, -1));
    return true;
  },
  // img: {data, width, height} RGBA. kinds: writing systems to try (e.g. ['main', 'korean']). Returns text lines (top to bottom).
  async read({ img, kinds = ['main'], maxSide = 960 }, emit) {
    const boxes = await ocr.detect(img, { maxSide });
    const lines = [];
    for (const b of boxes) {
      if ((b.x2 - b.x) < 8 || (b.y2 - b.y) < 6) continue;
      let best = null;
      for (const k of kinds) {
        const r = await getRec(k, emit);
        const res = await ocr.recognize(img, b, r.sess, r.chars);
        if (!best || res.conf > best.conf) best = { ...res, kind: k };
      }
      if (best.text) lines.push({ ...best, box: b });
    }
    lines.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    return lines;
  },
});
