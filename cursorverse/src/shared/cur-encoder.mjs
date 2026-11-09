// Encodes RGBA frames into Windows cursor files.
//   .cur = one image (ICO container, type 2, with a hotspot)
//   .ani = RIFF "ACON" container holding one .cur per frame
// Frames use 32-bit BGRA DIBs (not PNG) because every Windows version
// loads those inside animated cursors.

const MAX_SIZE = 256;

function checkFrame(frame) {
  const { width, height, data } = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`bad frame size ${width}x${height}`);
  }
  if (width > MAX_SIZE || height > MAX_SIZE) throw new Error(`cursor frames max out at ${MAX_SIZE}px`);
  if (!data || data.length !== width * height * 4) throw new Error('frame data length does not match width*height*4');
}

function clampHotspot(hotspot, width, height) {
  const x = Math.max(0, Math.min(width - 1, Math.round(hotspot?.[0] ?? 0)));
  const y = Math.max(0, Math.min(height - 1, Math.round(hotspot?.[1] ?? 0)));
  return [x, y];
}

// Builds the DIB (BITMAPINFOHEADER + XOR pixels + AND mask) for one frame.
function encodeDib(frame) {
  const { width: w, height: h, data } = frame;
  const xorSize = w * h * 4;
  const maskStride = Math.ceil(w / 32) * 4;
  const andSize = maskStride * h;
  const buf = new Uint8Array(40 + xorSize + andSize);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 40, true);          // biSize
  dv.setInt32(4, w, true);            // biWidth
  dv.setInt32(8, h * 2, true);        // biHeight (XOR + AND stacked)
  dv.setUint16(12, 1, true);          // biPlanes
  dv.setUint16(14, 32, true);         // biBitCount
  dv.setUint32(16, 0, true);          // BI_RGB
  dv.setUint32(20, xorSize + andSize, true);
  // Pixels are stored bottom-up.
  let o = 40;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a === 0) {
        buf[o] = buf[o + 1] = buf[o + 2] = buf[o + 3] = 0;
      } else {
        buf[o] = data[i + 2];
        buf[o + 1] = data[i + 1];
        buf[o + 2] = data[i];
        buf[o + 3] = a;
      }
      o += 4;
    }
  }
  // AND mask: 1 = transparent. Only used by old code paths, but keep it right.
  const maskStart = 40 + xorSize;
  for (let row = 0; row < h; row++) {
    const y = h - 1 - row;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) {
        buf[maskStart + row * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return buf;
}

export function encodeCur(frame, hotspot) {
  checkFrame(frame);
  const [hx, hy] = clampHotspot(hotspot, frame.width, frame.height);
  const dib = encodeDib(frame);
  const out = new Uint8Array(6 + 16 + dib.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true);  // reserved
  dv.setUint16(2, 2, true);  // type 2 = cursor
  dv.setUint16(4, 1, true);  // image count
  out[6] = frame.width >= 256 ? 0 : frame.width;
  out[7] = frame.height >= 256 ? 0 : frame.height;
  out[8] = 0;                // color count
  out[9] = 0;                // reserved
  dv.setUint16(10, hx, true);
  dv.setUint16(12, hy, true);
  dv.setUint32(14, dib.length, true);
  dv.setUint32(18, 22, true);
  out.set(dib, 22);
  return out;
}

function fourcc(s) {
  return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];
}

// A RIFF chunk: id + little-endian size + payload, padded to an even length.
function chunk(id, payload) {
  const pad = payload.length & 1;
  const out = new Uint8Array(8 + payload.length + pad);
  out.set(fourcc(id), 0);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function concat(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// fps -> "jiffies" (1/60 s) per frame, which is what .ani files store.
export function fpsToJiffies(fps) {
  const f = Number(fps) > 0 ? Number(fps) : 12;
  return Math.max(1, Math.round(60 / f));
}

export function encodeAni(frames, hotspot, fps, name = 'CursorVerse') {
  if (!Array.isArray(frames) || frames.length === 0) throw new Error('need at least one frame');
  const { width, height } = frames[0];
  frames.forEach((f) => {
    checkFrame(f);
    if (f.width !== width || f.height !== height) throw new Error('all frames must be the same size');
  });

  const anih = new Uint8Array(36);
  const dv = new DataView(anih.buffer);
  dv.setUint32(0, 36, true);                 // cbSize
  dv.setUint32(4, frames.length, true);      // nFrames
  dv.setUint32(8, frames.length, true);      // nSteps
  dv.setUint32(12, 0, true);                 // iWidth  (unused with AF_ICON)
  dv.setUint32(16, 0, true);                 // iHeight
  dv.setUint32(20, 0, true);                 // iBitCount
  dv.setUint32(24, 0, true);                 // nPlanes
  dv.setUint32(28, fpsToJiffies(fps), true); // iDispRate
  dv.setUint32(32, 1, true);                 // AF_ICON (frames are .cur data)

  const text = new TextEncoder().encode(`${name}\0`);
  const info = concat([new Uint8Array(fourcc('INFO')), chunk('INAM', text)]);
  const icons = frames.map((f) => chunk('icon', encodeCur(f, hotspot)));
  const fram = concat([new Uint8Array(fourcc('fram')), ...icons]);

  const body = concat([
    new Uint8Array(fourcc('ACON')),
    chunk('LIST', info),
    chunk('anih', anih),
    chunk('LIST', fram),
  ]);
  const out = new Uint8Array(8 + body.length);
  out.set(fourcc('RIFF'), 0);
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

// Reads a .cur back (used by tests and to sanity-check what we built).
export function decodeCur(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint16(0, true) !== 0 || dv.getUint16(2, true) !== 2) throw new Error('not a .cur file');
  const count = dv.getUint16(4, true);
  const width = bytes[6] || 256;
  const height = bytes[7] || 256;
  const hotspot = [dv.getUint16(10, true), dv.getUint16(12, true)];
  const size = dv.getUint32(14, true);
  const offset = dv.getUint32(18, true);
  if (offset + size > bytes.length) throw new Error('image data runs past end of file');
  const bih = offset;
  const bw = dv.getInt32(bih + 4, true);
  const bh = dv.getInt32(bih + 8, true);
  const bpp = dv.getUint16(bih + 14, true);
  if (bw !== width || bh !== height * 2 || bpp !== 32) throw new Error('unexpected bitmap header');
  const data = new Uint8ClampedArray(width * height * 4);
  let o = bih + 40;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = bytes[o + 2];
      data[i + 1] = bytes[o + 1];
      data[i + 2] = bytes[o];
      data[i + 3] = bytes[o + 3];
      o += 4;
    }
  }
  return { count, width, height, hotspot, data };
}

// Walks an .ani file and returns its header + raw .cur frames.
export function decodeAni(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (id(0) !== 'RIFF' || id(8) !== 'ACON') throw new Error('not an .ani file');
  const riffSize = dv.getUint32(4, true);
  if (riffSize + 8 !== bytes.length) throw new Error(`RIFF size ${riffSize + 8} != file size ${bytes.length}`);
  const result = { header: null, frames: [] };
  const walk = (start, end) => {
    let o = start;
    while (o + 8 <= end) {
      const cid = id(o);
      const len = dv.getUint32(o + 4, true);
      const payload = o + 8;
      if (payload + len > end) throw new Error(`chunk ${cid} overruns its parent`);
      if (cid === 'LIST') {
        walk(payload + 4, payload + len);
      } else if (cid === 'anih') {
        result.header = {
          frames: dv.getUint32(payload + 4, true),
          steps: dv.getUint32(payload + 8, true),
          jiffies: dv.getUint32(payload + 28, true),
          flags: dv.getUint32(payload + 32, true),
        };
      } else if (cid === 'icon') {
        result.frames.push(bytes.subarray(payload, payload + len));
      }
      o = payload + len + (len & 1);
    }
  };
  walk(12, bytes.length);
  if (!result.header) throw new Error('missing anih chunk');
  return result;
}
