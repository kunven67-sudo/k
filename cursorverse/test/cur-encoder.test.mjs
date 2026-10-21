import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCur, encodeAni, decodeCur, decodeAni, fpsToJiffies } from '../src/shared/cur-encoder.mjs';

function makeFrame(w, h, seed = 0) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const on = (x + y + seed) % 3 !== 0;
      data[i] = (x * 7 + seed) & 255;
      data[i + 1] = (y * 5) & 255;
      data[i + 2] = 200;
      data[i + 3] = on ? 255 : 0;
    }
  }
  return { width: w, height: h, data };
}

test('.cur round-trips pixels and hotspot', () => {
  for (const size of [1, 7, 32, 33, 48, 128, 256]) {
    const frame = makeFrame(size, size, size);
    const bytes = encodeCur(frame, [3, 5]);
    const back = decodeCur(bytes);
    assert.equal(back.width, size);
    assert.equal(back.height, size);
    assert.deepEqual(back.hotspot, [Math.min(3, size - 1), Math.min(5, size - 1)]);
    for (let i = 0; i < frame.data.length; i += 4) {
      if (frame.data[i + 3] === 0) {
        assert.equal(back.data[i + 3], 0);
      } else {
        assert.deepEqual([...back.data.subarray(i, i + 4)], [...frame.data.subarray(i, i + 4)]);
      }
    }
  }
});

test('.cur AND mask marks transparent pixels', () => {
  const w = 40, h = 2;
  const frame = makeFrame(w, h);
  const bytes = encodeCur(frame, [0, 0]);
  const maskStride = Math.ceil(w / 32) * 4;
  const maskStart = 22 + 40 + w * h * 4;
  assert.equal(bytes.length, maskStart + maskStride * h);
  for (let row = 0; row < h; row++) {
    const y = h - 1 - row;
    for (let x = 0; x < w; x++) {
      const bit = (bytes[maskStart + row * maskStride + (x >> 3)] >> (7 - (x & 7))) & 1;
      const transparent = frame.data[(y * w + x) * 4 + 3] === 0;
      assert.equal(bit, transparent ? 1 : 0, `mask bit at ${x},${y}`);
    }
  }
});

test('hotspot outside the image is clamped', () => {
  const back = decodeCur(encodeCur(makeFrame(16, 16), [99, -4]));
  assert.deepEqual(back.hotspot, [15, 0]);
});

test('.ani has a valid RIFF layout with every frame', () => {
  const frames = [0, 1, 2, 3, 4].map((s) => makeFrame(48, 48, s));
  const bytes = encodeAni(frames, [10, 12], 15);
  assert.equal(bytes.length % 2, 0);
  const ani = decodeAni(bytes);
  assert.equal(ani.header.frames, 5);
  assert.equal(ani.header.steps, 5);
  assert.equal(ani.header.jiffies, 4);
  assert.equal(ani.header.flags, 1);
  assert.equal(ani.frames.length, 5);
  ani.frames.forEach((cur, i) => {
    const f = decodeCur(cur);
    assert.deepEqual(f.hotspot, [10, 12]);
    assert.deepEqual([...f.data.subarray(0, 8)], [...frames[i].data.subarray(0, 8)].map((v, k) => (frames[i].data[k - (k % 4) + 3] === 0 ? 0 : v)));
  });
});

test('.ani rejects mismatched frame sizes', () => {
  assert.throws(() => encodeAni([makeFrame(32, 32), makeFrame(48, 48)], [0, 0], 10));
});

test('fps converts to jiffies sensibly', () => {
  assert.equal(fpsToJiffies(60), 1);
  assert.equal(fpsToJiffies(12), 5);
  assert.equal(fpsToJiffies(1000), 1);
  assert.equal(fpsToJiffies(0), 5);
  assert.equal(fpsToJiffies('abc'), 5);
});
