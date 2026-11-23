// Windows calls for the mouse (no hooks: only plain cursor calls). On other systems a fake stand-in is used for tests.
'use strict';
const IS_WIN = process.platform === 'win32';

const CURSOR_IDS = { arrow: 32512, ibeam: 32513, wait: 32514, cross: 32515, up: 32516, nwse: 32642, nesw: 32643,
  we: 32644, ns: 32645, all: 32646, no: 32648, hand: 32649, appstarting: 32650 };

function makeWin() {
  const koffi = require('koffi');
  const u = koffi.load('user32.dll');
  const g = koffi.load('gdi32.dll');
  const P = 'intptr_t';
  const f = (lib, name, ret, args) => lib.func('__stdcall', name, ret, args);
  const api = {
    SetThreadDpiAwarenessContext: f(u, 'SetThreadDpiAwarenessContext', P, [P]),
    GetCursorPos: f(u, 'GetCursorPos', 'int', ['void *']),
    SetCursorPos: f(u, 'SetCursorPos', 'int', ['int', 'int']),
    ClipCursor: f(u, 'ClipCursor', 'int', ['void *']),
    GetClipCursor: f(u, 'GetClipCursor', 'int', ['void *']),
    GetCursorInfo: f(u, 'GetCursorInfo', 'int', ['void *']),
    LoadCursorW: f(u, 'LoadCursorW', P, [P, P]),
    CopyImage: f(u, 'CopyImage', P, [P, 'uint', 'int', 'int', 'uint']),
    CreateCursor: f(u, 'CreateCursor', P, [P, 'int', 'int', 'int', 'int', 'void *', 'void *']),
    SetSystemCursor: f(u, 'SetSystemCursor', 'int', [P, 'uint']),
    SystemParametersInfoW: f(u, 'SystemParametersInfoW', 'int', ['uint', 'uint', P, 'uint']),
    GetIconInfo: f(u, 'GetIconInfo', 'int', [P, 'void *']),
    DrawIconEx: f(u, 'DrawIconEx', 'int', [P, 'int', 'int', P, 'int', 'int', 'uint', P, 'uint']),
    GetDC: f(u, 'GetDC', P, [P]),
    ReleaseDC: f(u, 'ReleaseDC', 'int', [P, P]),
    GetObjectW: f(g, 'GetObjectW', 'int', [P, 'int', 'void *']),
    CreateCompatibleDC: f(g, 'CreateCompatibleDC', P, [P]),
    CreateCompatibleBitmap: f(g, 'CreateCompatibleBitmap', P, [P, 'int', 'int']),
    SelectObject: f(g, 'SelectObject', P, [P, P]),
    DeleteObject: f(g, 'DeleteObject', 'int', [P]),
    DeleteDC: f(g, 'DeleteDC', 'int', [P]),
    SetDIBits: f(g, 'SetDIBits', 'int', [P, P, 'uint', 'uint', 'void *', 'void *', 'uint']),
    GetDIBits: f(g, 'GetDIBits', 'int', [P, P, 'uint', 'uint', 'void *', 'void *', 'uint']),
  };
  try { api.SetThreadDpiAwarenessContext(-4); } catch (e) { /* older Windows */ }
  const pt = Buffer.alloc(8), rc = Buffer.alloc(16);
  const W = {
    real: true,
    getPos() { api.GetCursorPos(pt); return { x: pt.readInt32LE(0), y: pt.readInt32LE(4) }; },
    setPos(x, y) { api.SetCursorPos(Math.round(x), Math.round(y)); },
    clip(r) { // r = {x,y,w,h} in screen pixels, or null = free
      if (!r) return api.ClipCursor(null);
      rc.writeInt32LE(Math.round(r.x), 0); rc.writeInt32LE(Math.round(r.y), 4);
      rc.writeInt32LE(Math.round(r.x + Math.max(1, r.w)), 8); rc.writeInt32LE(Math.round(r.y + Math.max(1, r.h)), 12);
      return api.ClipCursor(rc);
    },
    getClip() { api.GetClipCursor(rc); return { x: rc.readInt32LE(0), y: rc.readInt32LE(4), r: rc.readInt32LE(8), b: rc.readInt32LE(12) }; },
    currentCursor() { const b = Buffer.alloc(24); b.writeUInt32LE(24, 0); api.GetCursorInfo(b); return { shown: (b.readUInt32LE(4) & 1) === 1, handle: Number(b.readBigInt64LE(8)) }; },
    systemHandles() { const o = {}; for (const k in CURSOR_IDS) o[k] = Number(api.LoadCursorW(0, CURSOR_IDS[k])); return o; },
    hideAll() { // swap every system cursor for an empty one (undone by restoreAll)
      const and = Buffer.alloc(128, 0xff), xor = Buffer.alloc(128, 0);
      let ok = 0;
      for (const k in CURSOR_IDS) { const h = api.CreateCursor(0, 0, 0, 32, 32, and, xor); if (h && api.SetSystemCursor(h, CURSOR_IDS[k])) ok++; }
      return ok;
    },
    restoreAll() { return api.SystemParametersInfoW(0x57, 0, 0, 0); }, // SPI_SETCURSORS: reload the real cursors
    captureCursors() { // real pictures of their own cursors (black/white trick to get the see-through parts)
      const out = {};
      const screen = api.GetDC(0), dc = api.CreateCompatibleDC(screen);
      for (const k in CURSOR_IDS) {
        try {
          const h = api.LoadCursorW(0, CURSOR_IDS[k]); if (!h) continue;
          const ii = Buffer.alloc(32); if (!api.GetIconInfo(h, ii)) continue;
          const hx = ii.readUInt32LE(4), hy = ii.readUInt32LE(8);
          const mask = Number(ii.readBigInt64LE(16)), color = Number(ii.readBigInt64LE(24));
          const bm = Buffer.alloc(32); api.GetObjectW(color || mask, 32, bm);
          const w = bm.readInt32LE(4); let hgt = bm.readInt32LE(8); if (!color) hgt = hgt / 2;
          if (mask) api.DeleteObject(mask); if (color) api.DeleteObject(color);
          if (w <= 0 || hgt <= 0 || w > 512) continue;
          const bi = Buffer.alloc(44); bi.writeUInt32LE(40, 0); bi.writeInt32LE(w, 4); bi.writeInt32LE(-hgt, 8);
          bi.writeUInt16LE(1, 12); bi.writeUInt16LE(32, 14);
          const shots = [0, 255].map(bg => {
            const bmp = api.CreateCompatibleBitmap(screen, w, hgt); const old = api.SelectObject(dc, bmp);
            const px = Buffer.alloc(w * hgt * 4, bg); api.SetDIBits(dc, bmp, 0, hgt, px, bi, 0);
            api.DrawIconEx(dc, 0, 0, h, w, hgt, 0, 0, 3);
            api.GetDIBits(dc, bmp, 0, hgt, px, bi, 0); api.SelectObject(dc, old); api.DeleteObject(bmp); return px;
          });
          const rgba = Buffer.alloc(w * hgt * 4);
          for (let i = 0; i < w * hgt; i++) {
            const o = i * 4; let a = 0; const c = [0, 0, 0];
            for (let ch = 0; ch < 3; ch++) a = Math.max(a, 255 - (shots[1][o + ch] - shots[0][o + ch]));
            a = Math.max(0, Math.min(255, a));
            for (let ch = 0; ch < 3; ch++) c[ch] = a > 0 ? Math.min(255, Math.round(shots[0][o + ch] * 255 / a)) : 0;
            rgba[o] = c[2]; rgba[o + 1] = c[1]; rgba[o + 2] = c[0]; rgba[o + 3] = a; // BGR -> RGB
          }
          out[k] = { w, h: hgt, hx, hy, rgba: rgba.toString('base64') };
        } catch (e) { /* skip this one */ }
      }
      api.DeleteDC(dc); api.ReleaseDC(0, screen);
      return out;
    },
  };
  return W;
}

function makeFake() { // stand-in for tests on Linux: a fake mouse that remembers where it was put
  const s = { x: 960, y: 540, clip: null };
  return {
    real: false,
    getPos() { if (global.__fakeMouse) { const m = global.__fakeMouse(); s.x = m.x; s.y = m.y; } return clampClip({ x: s.x, y: s.y }); },
    setPos(x, y) { s.x = Math.round(x); s.y = Math.round(y); if (global.__fakeMouseSet) global.__fakeMouseSet(s.x, s.y); },
    clip(r) { s.clip = r; return 1; },
    getClip() { return s.clip ? { x: s.clip.x, y: s.clip.y, r: s.clip.x + s.clip.w, b: s.clip.y + s.clip.h } : { x: 0, y: 0, r: 99999, b: 99999 }; },
    currentCursor() { return { shown: true, handle: 1 }; },
    systemHandles() { return { arrow: 1 }; },
    hideAll() { return 13; }, restoreAll() { return 1; }, captureCursors() { return {}; },
  };
  function clampClip(p) { const c = s.clip; if (!c) return p; return { x: Math.min(c.x + c.w, Math.max(c.x, p.x)), y: Math.min(c.y + c.h, Math.max(c.y, p.y)) }; }
}

let inst = null;
module.exports = () => inst || (inst = IS_WIN ? makeWin() : makeFake());
module.exports.CURSOR_IDS = CURSOR_IDS;
