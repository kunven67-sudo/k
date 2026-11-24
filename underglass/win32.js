// Plain Windows calls (no hooks): real pictures of their own mouse cursor and the Recycle Bin icon.
// On other systems everything returns empty so the game still runs (tests on Linux).
'use strict';
const IS_WIN = process.platform === 'win32';
const CURSOR_IDS = { arrow: 32512, ibeam: 32513, wait: 32514, cross: 32515, hand: 32649, all: 32646, no: 32648 };

function make() {
  const koffi = require('koffi');
  const u = koffi.load('user32.dll'), g = koffi.load('gdi32.dll'), sh = koffi.load('shell32.dll');
  const P = 'intptr_t';
  const f = (lib, name, ret, args) => lib.func('__stdcall', name, ret, args);
  const api = {
    LoadCursorW: f(u, 'LoadCursorW', P, [P, P]),
    GetIconInfo: f(u, 'GetIconInfo', 'int', [P, 'void *']),
    DrawIconEx: f(u, 'DrawIconEx', 'int', [P, 'int', 'int', P, 'int', 'int', 'uint', P, 'uint']),
    DestroyIcon: f(u, 'DestroyIcon', 'int', [P]),
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
    SHGetStockIconInfo: f(sh, 'SHGetStockIconInfo', 'int', ['int', 'uint', 'void *']),
    SHGetFileInfoW: f(sh, 'SHGetFileInfoW', P, ['str16', 'uint', 'void *', 'uint', 'uint']),
    SHGetImageList: f(sh, 'SHGetImageList', 'int', ['int', 'void *', '_Out_ void **']),
  };
  // 48 px icons straight from Windows' own icon list (the same ones the real desktop shows)
  let imgList = null, getIcon = null;
  try {
    const iid = Buffer.from('2659EB4617582040' + '9FDFE8998DAA0950', 'hex'); // IID_IImageList {46EB5926-582E-4017-9FDF-E8998DAA0950}
    iid.writeUInt32LE(0x46EB5926, 0); iid.writeUInt16LE(0x582E, 4); iid.writeUInt16LE(0x4017, 6);
    const out = [null];
    if (api.SHGetImageList(2, iid, out) === 0 && out[0]) { // SHIL_EXTRALARGE
      imgList = out[0];
      const vt = koffi.decode(imgList, 'void *');
      const fnp = koffi.decode(vt, 10 * 8, 'void *'); // IImageList::GetIcon
      const proto = koffi.proto('__stdcall', 'ImageListGetIcon', 'int', ['void *', 'int', 'uint', '_Out_ void **']);
      getIcon = koffi.decode(fnp, proto);
    }
  } catch (e) { getIcon = null; }
  // draws an icon/cursor on black and on white, works out the see-through parts from the difference
  function pixels(h, w, hgt) {
    const screen = api.GetDC(0), dc = api.CreateCompatibleDC(screen);
    const bi = Buffer.alloc(44); bi.writeUInt32LE(40, 0); bi.writeInt32LE(w, 4); bi.writeInt32LE(-hgt, 8); bi.writeUInt16LE(1, 12); bi.writeUInt16LE(32, 14);
    const shots = [0, 255].map(bg => {
      const bmp = api.CreateCompatibleBitmap(screen, w, hgt); const old = api.SelectObject(dc, bmp);
      const px = Buffer.alloc(w * hgt * 4, bg); api.SetDIBits(dc, bmp, 0, hgt, px, bi, 0);
      api.DrawIconEx(dc, 0, 0, h, w, hgt, 0, 0, 3);
      api.GetDIBits(dc, bmp, 0, hgt, px, bi, 0); api.SelectObject(dc, old); api.DeleteObject(bmp); return px;
    });
    api.DeleteDC(dc); api.ReleaseDC(0, screen);
    const rgba = Buffer.alloc(w * hgt * 4);
    for (let i = 0; i < w * hgt; i++) {
      const o = i * 4; let a = 0;
      for (let ch = 0; ch < 3; ch++) a = Math.max(a, 255 - (shots[1][o + ch] - shots[0][o + ch]));
      a = Math.max(0, Math.min(255, a));
      const c = [0, 1, 2].map(ch => a > 0 ? Math.min(255, Math.round(shots[0][o + ch] * 255 / a)) : 0);
      rgba[o] = c[2]; rgba[o + 1] = c[1]; rgba[o + 2] = c[0]; rgba[o + 3] = a;
    }
    return rgba;
  }
  function iconSize(h) {
    const ii = Buffer.alloc(32); if (!api.GetIconInfo(h, ii)) return null;
    const hx = ii.readUInt32LE(4), hy = ii.readUInt32LE(8);
    const mask = Number(ii.readBigInt64LE(16)), color = Number(ii.readBigInt64LE(24));
    const bm = Buffer.alloc(32); api.GetObjectW(color || mask, 32, bm);
    const w = bm.readInt32LE(4); let hgt = bm.readInt32LE(8); if (!color) hgt = hgt / 2;
    if (mask) api.DeleteObject(mask); if (color) api.DeleteObject(color);
    if (w <= 0 || hgt <= 0 || w > 512) return null;
    return { w, h: hgt, hx, hy };
  }
  return {
    cursors() {
      const out = {};
      for (const k in CURSOR_IDS) {
        try {
          const h = api.LoadCursorW(0, CURSOR_IDS[k]); if (!h) continue;
          const s = iconSize(h); if (!s) continue;
          out[k] = { w: s.w, h: s.h, hx: s.hx, hy: s.hy, rgba: pixels(h, s.w, s.h).toString('base64') };
        } catch (e) { /* skip */ }
      }
      return out;
    },
    bigIcon(file) { // {w,h,rgba} or null
      if (!getIcon) return null;
      try {
        const fi = Buffer.alloc(696);
        if (!api.SHGetFileInfoW(file, 0, fi, 696, 0x4000)) return null; // SHGFI_SYSICONINDEX
        const idx = fi.readInt32LE(8); const out = [null];
        if (getIcon(imgList, idx, 1, out) !== 0 || !out[0]) return null;
        const h = Number(koffi.address(out[0]));
        const s = iconSize(h); if (!s) { api.DestroyIcon(h); return null; }
        const px = pixels(h, s.w, s.h); api.DestroyIcon(h);
        return { w: s.w, h: s.h, rgba: px.toString('base64') };
      } catch (e) { return null; }
    },
    stockIcon(id, big) { // SHSTOCKICONID, e.g. 31 = empty recycle bin, 32 = full
      try {
        const info = Buffer.alloc(8 + 8 + 4 + 4 + 520); info.writeUInt32LE(info.length, 0);
        if (api.SHGetStockIconInfo(id, 0x100 | (big ? 0 : 1), info) !== 0) return null; // SHGSI_ICON (+ small)
        const h = Number(info.readBigInt64LE(8)); if (!h) return null;
        const s = iconSize(h); if (!s) { api.DestroyIcon(h); return null; }
        const px = pixels(h, s.w, s.h); api.DestroyIcon(h);
        return { w: s.w, h: s.h, rgba: px.toString('base64') };
      } catch (e) { return null; }
    },
  };
}
let inst = null;
module.exports = () => inst || (inst = IS_WIN ? make() : { cursors: () => ({}), stockIcon: () => null, bigIcon: () => null });
