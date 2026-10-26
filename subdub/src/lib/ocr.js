// PaddleOCR (PP-OCRv5) text detection + recognition on RGBA image data. `ort` = onnxruntime module.
export class PaddleOCR {
  constructor(ort, det, rec, dict) { this.ort = ort; this.det = det; this.rec = rec; this.chars = ['', ...dict, ' ']; }
  // img: {data: Uint8ClampedArray RGBA, width, height}
  async detect(img, { maxSide = 960, thresh = 0.3, boxThresh = 0.6, unclip = 1.5 } = {}) {
    const { width: W, height: H, data } = img;
    const s = Math.min(1, maxSide / Math.max(W, H));
    const w = Math.max(32, Math.round(W * s / 32) * 32), h = Math.max(32, Math.round(H * s / 32) * 32);
    const x = new Float32Array(3 * w * h), mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let yy = 0; yy < h; yy++) {
      const sy = Math.min(H - 1, Math.floor((yy + 0.5) * H / h));
      for (let xx = 0; xx < w; xx++) {
        const sx = Math.min(W - 1, Math.floor((xx + 0.5) * W / w)), o = (sy * W + sx) * 4;
        // BGR order, normalized per channel position
        x[0 * w * h + yy * w + xx] = (data[o + 2] / 255 - mean[0]) / std[0];
        x[1 * w * h + yy * w + xx] = (data[o + 1] / 255 - mean[1]) / std[1];
        x[2 * w * h + yy * w + xx] = (data[o] / 255 - mean[2]) / std[2];
      }
    }
    const out = await this.det.run({ [this.det.inputNames[0]]: new this.ort.Tensor('float32', x, [1, 3, h, w]) });
    const prob = out[this.det.outputNames[0]].data; // [1,1,h,w]
    // connected components on the thresholded map
    const lab = new Int32Array(w * h).fill(-1), boxes = [], stack = [];
    for (let i = 0; i < w * h; i++) {
      if (lab[i] !== -1 || prob[i] < thresh) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sum = 0, cnt = 0; stack.push(i); lab[i] = boxes.length;
      while (stack.length) {
        const p = stack.pop(), px = p % w, py = (p - px) / w;
        sum += prob[p]; cnt++; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (const q of [p - 1, p + 1, p - w, p + w]) {
          if (q < 0 || q >= w * h) continue; if ((q === p - 1 && px === 0) || (q === p + 1 && px === w - 1)) continue;
          if (lab[q] === -1 && prob[q] >= thresh) { lab[q] = boxes.length; stack.push(q); }
        }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (cnt < 6 || Math.min(bw, bh) < 3 || sum / cnt < boxThresh) { boxes.push(null); continue; }
      const d = (bw * bh) * unclip / (2 * (bw + bh));
      boxes.push({ score: sum / cnt, _r: [x0 - d, y0 - d, x1 + 1 + d, y1 + 1 + d] });
    }
    const sx = W / w, sy = H / h;
    return boxes.filter(Boolean).map(b => {
      const [a, c, e, f] = b._r;
      return { x: Math.max(0, a * sx), y: Math.max(0, c * sy), x2: Math.min(W, e * sx), y2: Math.min(H, f * sy), score: b.score };
    });
  }
  async recognize(img, box, rec = this.rec, chars = this.chars) {
    const ort = this.ort;
    const { width: W, data } = img, bw = box.x2 - box.x, bh = box.y2 - box.y;
    const h = 48, w = Math.max(16, Math.min(3200, Math.round(bw * h / bh / 8) * 8));
    const x = new Float32Array(3 * w * h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      // bilinear sample
      const fx = box.x + (xx + 0.5) * bw / w - 0.5, fy = box.y + (yy + 0.5) * bh / h - 0.5;
      const ix = Math.max(0, Math.floor(fx)), iy = Math.max(0, Math.floor(fy)), ax = fx - ix, ay = fy - iy;
      const H = img.height, ix1 = Math.min(W - 1, ix + 1), iy1 = Math.min(H - 1, iy + 1);
      for (let c = 0; c < 3; c++) {
        const ch = 2 - c; // BGR
        const v = (data[(iy * W + ix) * 4 + ch] * (1 - ax) + data[(iy * W + ix1) * 4 + ch] * ax) * (1 - ay) + (data[(iy1 * W + ix) * 4 + ch] * (1 - ax) + data[(iy1 * W + ix1) * 4 + ch] * ax) * ay;
        x[c * w * h + yy * w + xx] = (v / 255 - 0.5) / 0.5;
      }
    }
    const out = await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, h, w]) });
    const o = out[rec.outputNames[0]], [, T, C] = o.dims, p = o.data;
    let text = '', last = -1, conf = 0, n = 0;
    for (let t = 0; t < T; t++) {
      let bi = 0, bv = -1; for (let c = 0; c < C; c++) if (p[t * C + c] > bv) { bv = p[t * C + c]; bi = c; }
      if (bi !== 0 && bi !== last) { text += chars[bi] ?? ''; conf += bv; n++; }
      last = bi;
    }
    return { text: text.trim(), conf: n ? conf / n : 0 };
  }
}
export function parseDictYml(yml) {
  const i = yml.indexOf('character_dict:'); const lines = yml.slice(i).split('\n').slice(1);
  const out = []; for (const l of lines) { if (!l.startsWith('  - ') && !l.startsWith('  -')) break; let v = l.slice(4); if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'"); else if (v.startsWith('"') && v.endsWith('"')) v = JSON.parse(v); out.push(v); }
  return out;
}
