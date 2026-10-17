import { FONT, MONO, font, fillRR, strokeRR, text, inside } from '../gfx.js';

// Tiny immediate-mode UI for in-game apps: draw() registers clickable regions,
// mouse() looks them up. Keeps every app short.
export class Kit {
  constructor() { this.hits = []; }
  begin() { this.hits = []; }
  region(x, y, w, h, act, cursor = 'arrow') { this.hits.push({ x, y, w, h, act, cursor }); }
  find(x, y) { for (let k = this.hits.length - 1; k >= 0; k--) { const r = this.hits[k]; if (inside(x, y, r.x, r.y, r.w, r.h)) return r; } return null; }
  click(x, y) { const r = this.find(x, y); if (r && r.act) { r.act(x - r.x, y - r.y); return true; } return false; }
  cursor(x, y) { return this.find(x, y)?.cursor || 'arrow'; }

  // cur = cursor in the app's client coordinates (clientCursor(os, win))
  button(g, cur, x, y, w, h, label, act, o = {}) {
    const hov = cur && inside(cur.x, cur.y, x, y, w, h);
    const bg = o.primary ? (hov ? '#5cc8ff' : (o.accent || '#4cc2ff')) : (hov ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)');
    fillRR(g, x, y, w, h, o.r ?? 4, o.bg || bg);
    if (!o.primary && !o.bg) strokeRR(g, x, y, w, h, o.r ?? 4, 'rgba(255,255,255,0.08)');
    font(g, o.size || 13, o.weight || (o.primary ? 600 : 400));
    g.fillStyle = o.primary ? '#000' : (o.color || '#fff');
    text(g, label, x + w / 2, y + h / 2 + (o.size || 13) * 0.36, w - 8, 'center');
    this.region(x, y, w, h, act, 'arrow');
  }
}

// the window offset helper: apps get cursor in client coords via os + window
export function clientCursor(os, win) { return { x: os.cursor.x - win.x, y: os.cursor.y - win.y - 32 }; }

export function hov(os, win, x, y, w, h) { const c = clientCursor(os, win); return inside(c.x, c.y, x, y, w, h); }

export function scrollbar(g, x, y, h, frac, pos) {
  if (frac >= 1) return;
  fillRR(g, x, y, 6, h, 3, 'rgba(255,255,255,0.05)');
  fillRR(g, x, y + pos * h * (1 - frac), 6, Math.max(20, h * frac), 3, 'rgba(255,255,255,0.3)');
}

export { FONT, MONO, font, fillRR, strokeRR, text, inside };

// Text editing core used by Notepad, the browser address bar, terminal input...
export class TextBuf {
  constructor(s = '') { this.s = s; this.caret = s.length; this.anchor = null; this.undo = []; }
  sel() { if (this.anchor === null || this.anchor === this.caret) return null; return [Math.min(this.anchor, this.caret), Math.max(this.anchor, this.caret)]; }
  push() { this.undo.push([this.s, this.caret]); if (this.undo.length > 200) this.undo.shift(); }
  insert(t) {
    this.push();
    const s = this.sel();
    if (s) { this.s = this.s.slice(0, s[0]) + t + this.s.slice(s[1]); this.caret = s[0] + t.length; }
    else { this.s = this.s.slice(0, this.caret) + t + this.s.slice(this.caret); this.caret += t.length; }
    this.anchor = null;
  }
  del(dir) {
    const s = this.sel();
    if (s) { this.push(); this.s = this.s.slice(0, s[0]) + this.s.slice(s[1]); this.caret = s[0]; this.anchor = null; return; }
    if (dir < 0 && this.caret > 0) { this.push(); this.s = this.s.slice(0, this.caret - 1) + this.s.slice(this.caret); this.caret--; }
    if (dir > 0 && this.caret < this.s.length) { this.push(); this.s = this.s.slice(0, this.caret) + this.s.slice(this.caret + 1); }
  }
  move(to, shift) { if (shift) { if (this.anchor === null) this.anchor = this.caret; } else this.anchor = null; this.caret = Math.max(0, Math.min(this.s.length, to)); }
  lineStart(i = this.caret) { return this.s.lastIndexOf('\n', i - 1) + 1; }
  lineEnd(i = this.caret) { const e = this.s.indexOf('\n', i); return e < 0 ? this.s.length : e; }
  wordLeft() { let i = this.caret - 1; while (i > 0 && /\s/.test(this.s[i])) i--; while (i > 0 && !/\s/.test(this.s[i - 1])) i--; return Math.max(0, i); }
  wordRight() { let i = this.caret; while (i < this.s.length && !/\s/.test(this.s[i])) i++; while (i < this.s.length && /\s/.test(this.s[i])) i++; return i; }

  // standard editing keys. returns true if handled
  key(e, os, multiline = true) {
    const ctrl = e.ctrlKey || e.metaKey;
    const sh = e.shiftKey;
    if (ctrl && e.code === 'KeyA') { this.anchor = 0; this.caret = this.s.length; return true; }
    if (ctrl && e.code === 'KeyC') { const s = this.sel(); if (s) os.clipboard = this.s.slice(s[0], s[1]); return true; }
    if (ctrl && e.code === 'KeyX') { const s = this.sel(); if (s) { os.clipboard = this.s.slice(s[0], s[1]); this.del(0); } return true; }
    if (ctrl && e.code === 'KeyV') { if (os.clipboard) this.insert(multiline ? os.clipboard : os.clipboard.replace(/\n/g, ' ')); return true; }
    if (ctrl && e.code === 'KeyZ') { const u = this.undo.pop(); if (u) { [this.s, this.caret] = u; this.anchor = null; } return true; }
    if (e.code === 'ArrowLeft') { const s = this.sel(); this.move(!sh && s ? s[0] : ctrl ? this.wordLeft() : this.caret - 1, sh); return true; }
    if (e.code === 'ArrowRight') { const s = this.sel(); this.move(!sh && s ? s[1] : ctrl ? this.wordRight() : this.caret + 1, sh); return true; }
    if (e.code === 'Home') { this.move(ctrl ? 0 : this.lineStart(), sh); return true; }
    if (e.code === 'End') { this.move(ctrl ? this.s.length : this.lineEnd(), sh); return true; }
    if (multiline && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
      const col = this.caret - this.lineStart();
      if (e.code === 'ArrowUp') { const ls = this.lineStart(); if (ls === 0) { this.move(0, sh); return true; } const ps = this.lineStart(ls - 1); this.move(Math.min(ps + col, ls - 1), sh); }
      else { const le = this.lineEnd(); if (le >= this.s.length) { this.move(this.s.length, sh); return true; } const ns = le + 1; this.move(Math.min(ns + col, this.lineEnd(ns)), sh); }
      return true;
    }
    if (e.code === 'Backspace') { if (ctrl && !this.sel()) { this.anchor = this.wordLeft(); } this.del(-1); return true; }
    if (e.code === 'Delete') { this.del(1); return true; }
    if (e.code === 'Enter' && multiline) { this.insert('\n'); return true; }
    if (e.code === 'Tab' && multiline) { this.insert('    '); return true; }
    if (e.key && e.key.length === 1 && !ctrl && !e.altKey) { this.insert(e.key); return true; }
    return false;
  }
}
