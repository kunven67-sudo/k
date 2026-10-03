/* AI Play - the AI's EYES. Looks at the game every tick and figures out:
 *  - what the screen looks like (tiny low-res picture, like how a baby sees blurry shapes)
 *  - what moved and which way
 *  - numbers on screen (score, health, lives...) - from canvas text AND normal page text
 *  - "GAME OVER" / "YOU WIN" popping up, red damage flashes
 *  - buttons it could click
 */
'use strict';

AIP.COLORS = {
  names: ['dark', 'white', 'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'],
  emoji: ['⬛', '⬜', '🩶', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪'],
  words: {
    dark: 0, black: 0, shadow: 0, white: 1, light: 1, gray: 2, grey: 2, silver: 2,
    red: 3, lava: 3, blood: 3, fire: 4, orange: 4, brown: 4, wood: 4, yellow: 5, gold: 5, coin: 5, coins: 5, star: 5, stars: 5,
    green: 6, grass: 6, slime: 6, blue: 7, water: 7, cyan: 7, ice: 7, purple: 8, pink: 8, magenta: 8, violet: 8,
  },
};

AIP.Senses = (function () {
  const { clamp } = AIP.util;
  const GW = 40, GH = 30; // fine grid (motion + direction)
  const SW = 20, SH = 15; // brain grid
  const NSMALL = SW * SH;

  function colorCat(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 48 || 0.299 * r + 0.587 * g + 0.114 * b < 36) return 0;
    const l = (max + min) / 510;
    const d = max - min;
    const s = d === 0 ? 0 : d / (255 - Math.abs(max + min - 255));
    if (s < 0.22 || d < 28) return l > 0.72 ? 1 : (l < 0.2 ? 0 : 2);
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    if (h < 14 || h >= 338) return 3;
    if (h < 42) return 4;
    if (h < 72) return 5;
    if (h < 165) return 6;
    if (h < 255) return 7;
    return 8;
  }

  // Which way did the picture move? Tries little shifts and picks the one that matches best.
  function bestShift(prev, cur, x0, y0, x1, y1, R) {
    let bestErr = Infinity, bdx = 0, bdy = 0, err0 = 0, n0 = 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        let e = 0, n = 0;
        // (skip only the pixels whose "before" spot would be off the screen - NOT whole edge rows,
        //  or a player standing on the bottom row would be invisible to this)
        const ya = Math.max(y0, dy, 0), yb = Math.min(y1, GH + Math.min(0, dy), GH);
        const xa = Math.max(x0, dx, 0), xb = Math.min(x1, GW + Math.min(0, dx), GW);
        for (let y = ya; y < yb; y++) {
          const row = y * GW, prow = (y - dy) * GW - dx;
          for (let x = xa; x < xb; x++) {
            e += Math.abs(cur[row + x] - prev[prow + x]);
            n++;
          }
        }
        if (!n) continue;
        e /= n;
        if (dx === 0 && dy === 0) { err0 = e; n0 = n; }
        // tiny bias toward "no move" so noise doesn't look like motion
        const eb = e + (dx || dy ? 0.002 * (Math.abs(dx) + Math.abs(dy)) : 0);
        if (eb < bestErr) { bestErr = eb; bdx = dx; bdy = dy; }
      }
    }
    if (!n0 || err0 < 1e-4) return { dx: 0, dy: 0, gain: 0 };
    return { dx: bdx, dy: bdy, gain: clamp(1 - bestErr / err0, 0, 1) };
  }

  const KIND_RX = [
    ['highscore', /\b(best|high|hi|record|top)\b/i],
    ['health', /(\bhp\b|health|\blife\b|lives|heart|❤|♥|💖|shield|armou?r)/i],
    ['score', /(score|point|\bpts\b|coin|gold|money|cash|\$|💰|🪙|\bgems?\b|💎|\bstars?\b|⭐|kill|\bxp\b|dist|meter|catch|ducks?\b|\bhits?\b|bank|loot|eaten|food)/i],
    ['progress', /(level|\blvl\b|\blv\b|stage|wave|round|world|floor|\bday\b)/i],
    ['resource', /(ammo|shell|bullet|stamina|energy|mana|fuel|bomb|arrow)/i],
    ['time', /(time|timer|\bsec\b|clock)/i],
    ['combo', /(combo|streak|multi)/i],
  ];
  const kindOf = (label) => { for (const [k, rx] of KIND_RX) if (rx.test(label)) return k; return 'unknown'; };
  const GAMEOVER_RX = /game\s*over|you\s*(died|lose|lost|are\s+dead|crashed|failed)|wasted|\bdefeat(ed)?\b|out\s+of\s+lives|no\s+lives\s+left|mission\s+failed|level\s+failed|\bbusted\b|try\s+again|play\s+again|\bretry\b|\bcaught\b/i;
  const WIN_RX = /you\s*(win|won|beat|escaped|survived)|\bvictory\b|level\s*(complete|cleared)|stage\s*clear|congratulations|\bcongrats\b|mission\s*complete|\bwinner\b|\bthe\s+end\b|you\s+did\s+it/i;
  const GOOD_BTN_RX = /\b(play|start|begin|go|continue|retry|try again|again|restart|next|ok|okay|resume|new game|tap|click|press|enter|let'?s|ready|yes|launch)\b/i;
  const MEH_BTN_RX = /\b(settings|options|credits|quit|exit|reset|erase|delete|back|menu|about|help|share|privacy|shop|store|achievements?)\b/i;
  const NUM_ONLY = /^\s*[x×]?\s*(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+))?\s*(%|pts|m)?\s*$/i;
  const LABELLED = /([A-Za-z][A-Za-z _'.]{0,16}?|❤️|❤|♥|💖|⭐|🪙|💰|💎|🏆|⚡|🔥|\$)\s*[:=]?\s*[x×]?\s*(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/gu;
  const NUM_FIRST = /(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)\s*(pts|points|coins?|lives|hp|meters|kills|gems|stars|xp)\b/gi;
  const HEART_RX = /❤️|❤|♥|💖|🧡|💗|💓/gu;
  const toNum = (s) => parseFloat(String(s).replace(/,/g, ''));

  class Senses {
    constructor() {
      this.makeCanvases();
      this.reset();
    }
    // Shrinking a big screen straight down to 40x30 skips most pixels (thin things vanish!),
    // so paint at 320x240 first and halve it step by step - every pixel gets averaged in.
    makeCanvases() {
      const mk = (w, h, read) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d', read ? { willReadFrequently: true } : undefined) }; };
      this.big = mk(GW * 8, GH * 8);
      this.steps = [mk(GW * 4, GH * 4), mk(GW * 2, GH * 2, true)];
      const small = mk(GW, GH, true);
      this.cv = small.c; this.ctx = small.x;
      this.big.x.imageSmoothingQuality = 'high';
    }

    reset() {
      this.win = null; this.doc = null;
      this.hist = []; // last few 40x30 gray frames
      this.prevGray20 = null;
      this.readouts = new Map();
      this.primary = { score: null, hp: null, lives: null };
      this.items = []; this.itemsAt = 0;
      this.buttons = []; this.textBits = [];
      this.tainted = new WeakSet();
      this.taintCheckAt = 0;
      this.redBase = 0; this.lastFlashAt = -1e9;
      this.phrase = { over: false, win: false, overSince: 0, winSince: 0 };
      this.staticTime = 0;
      this.lastT = performance.now();
      this.errorsSeen = 0; this.alertsSeen = 0;
      this.lastFrames = 0; this.noFramesTime = 0;
      this.bodyBg = '#000';
      this.tick = 0;
    }

    attach(frameEl) {
      this.reset();
      this.frameEl = frameEl;
      this.win = frameEl.contentWindow;
      this.doc = this.win.document;
    }

    get aip() { try { return this.win && this.win.__aip; } catch (e) { return null; } }

    /* ---- collect the things worth drawing / reading (refreshed twice a second) ---- */
    collect() {
      const doc = this.doc, win = this.win;
      if (!doc || !doc.body) { this.items = []; return; }
      try { const bg = win.getComputedStyle(doc.body).backgroundColor; const hbg = win.getComputedStyle(doc.documentElement).backgroundColor; this.bodyBg = isSolid(bg) ? bg : isSolid(hbg) ? hbg : '#fff'; } catch (e) { /* ignore */ }
      const all = doc.body.getElementsByTagName('*');
      const out = [];
      const n = Math.min(all.length, 1600);
      for (let i = 0; i < n; i++) {
        const el = all[i];
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'BR' || tag === 'TEMPLATE' || tag === 'NOSCRIPT') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        let cs;
        try { cs = win.getComputedStyle(el); } catch (e) { continue; }
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const op = parseFloat(cs.opacity);
        if (op < 0.05) continue;
        const media = tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO' || (tag === 'image');
        let text = '';
        for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) text += c.nodeValue;
        text = text.replace(/\s+/g, ' ').trim();
        const fill = isSolid(cs.backgroundColor) ? cs.backgroundColor : null;
        if (media || fill || text) out.push({ el, media, fill, text, color: cs.color, op });
      }
      this.items = out;
    }

    findButtons() {
      const doc = this.doc, win = this.win;
      const out = [];
      if (!doc || !doc.body) { this.buttons = out; return; }
      const vw = win.innerWidth, vh = win.innerHeight;
      const sel = 'button,a[href],[role="button"],input[type="button"],input[type="submit"],[onclick],.btn,.button,[data-go],[data-action]';
      let list;
      try { list = doc.querySelectorAll(sel); } catch (e) { list = []; }
      for (let i = 0; i < list.length && out.length < 24; i++) {
        const el = list[i];
        if (el.disabled) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 6 || r.height < 6 || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
        const cx = clamp(r.left + r.width / 2, 1, vw - 1), cy = clamp(r.top + r.height / 2, 1, vh - 1);
        const top = doc.elementFromPoint(cx, cy);
        if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
        const text = ((el.innerText || el.value || el.getAttribute('aria-label') || el.title || '') + '').replace(/\s+/g, ' ').trim().slice(0, 32);
        let prio = 0.5;
        if (GOOD_BTN_RX.test(text)) prio = 1;
        if (MEH_BTN_RX.test(text)) prio = 0.15;
        if (!text) prio = 0.3;
        out.push({ el, text: text || '(no label)', x: cx, y: cy, prio });
      }
      this.buttons = out;
    }

    /* ---- draw what the game looks like into a tiny 40x30 picture ---- */
    paint() {
      const ctx = this.big.x, win = this.win;
      const BW = this.big.c.width, BH = this.big.c.height;
      const vw = Math.max(1, win.innerWidth), vh = Math.max(1, win.innerHeight);
      const sx = BW / vw, sy = BH / vh;
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.bodyBg; ctx.fillRect(0, 0, BW, BH);
      for (const it of this.items) {
        const el = it.el;
        if (!el.isConnected) continue;
        const r = el.getBoundingClientRect();
        if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh || r.width < 1) continue;
        ctx.globalAlpha = it.op;
        if (it.media) {
          if (this.tainted.has(el)) continue;
          if (el.tagName === 'IMG' && !(el.complete && el.naturalWidth)) continue;
          if (el.tagName === 'VIDEO' && el.readyState < 2) continue;
          if (el.tagName === 'CANVAS' && (!el.width || !el.height)) continue;
          try { ctx.drawImage(el, r.left * sx, r.top * sy, r.width * sx, r.height * sy); } catch (e) { /* broken image */ }
        } else {
          if (it.fill) { ctx.fillStyle = it.fill; ctx.fillRect(r.left * sx, r.top * sy, r.width * sx, r.height * sy); }
          if (it.text) {
            ctx.globalAlpha = it.op * 0.55;
            ctx.fillStyle = it.color;
            const tw = Math.min(r.width, it.text.length * 9);
            ctx.fillRect((r.left + (r.width - tw) / 2) * sx, (r.top + r.height * 0.25) * sy, tw * sx, r.height * 0.5 * sy);
          }
        }
      }
      ctx.globalAlpha = 1;
      let src = this.big.c;
      for (const st of this.steps) { st.x.drawImage(src, 0, 0, st.c.width, st.c.height); src = st.c; }
      this.ctx.drawImage(src, 0, 0, GW, GH);
      try {
        this.fine = this.steps[1].x.getImageData(0, 0, GW * 2, GH * 2).data;
        return this.ctx.getImageData(0, 0, GW, GH).data;
      } catch (e) {
        // A picture from another website "poisoned" the canvas. Find it and stop looking at it.
        this.findTainted();
        this.makeCanvases();
        return null;
      }
    }
    findTainted() {
      for (const it of this.items) {
        if (!it.media || this.tainted.has(it.el)) continue;
        const c = document.createElement('canvas'); c.width = c.height = 2;
        const x = c.getContext('2d');
        try { x.drawImage(it.el, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); } catch (e) { this.tainted.add(it.el); }
      }
    }

    /* ---- reading numbers ---- */
    gatherText(now) {
      const bits = [];
      for (const it of this.items) {
        if (!it.text || it.text.length > 80) continue;
        bits.push({ s: it.text, ctx: ctxLabel(it.el), src: 'dom', id: elId(it.el) });
      }
      const aip = this.aip;
      if (aip && aip.texts.length) {
        // the game has its own clock (performance.now() starts when IT loaded), so use the game's clock
        let fnow = now;
        try { fnow = this.win.performance.now(); } catch (e) { /* ignore */ }
        const recent = aip.texts.splice(0, aip.texts.length).filter((t) => fnow - t.t < 500 && t.s && t.s.length < 80);
        // canvas text often comes in pieces ("Score:" then "120") - glue pieces on the same line
        const lines = new Map();
        for (const t of recent) {
          const key = (t.c.id || 'cv') + ':' + Math.round(t.y / 8);
          if (!lines.has(key)) lines.set(key, new Map());
          lines.get(key).set(Math.round(t.x), t.s);
        }
        lines.forEach((m, key) => {
          const s = [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).join(' ').trim();
          if (s) bits.push({ s, ctx: '', src: 'cv', id: key });
        });
      }
      if (aip && aip.alerts.length > this.alertsSeen) {
        for (let i = this.alertsSeen; i < aip.alerts.length; i++) bits.push({ s: aip.alerts[i].slice(0, 80), ctx: 'alert', src: 'alert', id: 'alert' });
        this.alertsSeen = aip.alerts.length;
      }
      this.textBits = bits;
      return bits;
    }

    readNumbers(bits, now) {
      const seen = new Set();
      const put = (label, value, max, src, id) => {
        label = String(label).replace(/[:=\s]+$/g, '').trim();
        if (!label || !isFinite(value)) return;
        const kind = kindOf(label);
        const key = src + ':' + label.toLowerCase() + (src === 'dom' ? '@' + id : '');
        if (seen.has(key)) return;
        seen.add(key);
        let r = this.readouts.get(key);
        if (!r) {
          r = { key, label, kind, value, max: max || null, prev: value, firstSeen: now, seenAt: now, changedAt: 0, ups: 0, downs: 0, maxSeen: value };
          this.readouts.set(key, r);
          if (this.readouts.size > 80) this.readouts.delete(this.readouts.keys().next().value);
        }
        r.prev = r.value; r.value = value; r.seenAt = now;
        if (max) r.max = max;
        if (value > r.maxSeen) r.maxSeen = value;
        if (value !== r.prev) { r.changedAt = now; if (value > r.prev) r.ups++; else r.downs++; }
      };
      for (const b of bits) {
        const s = b.s;
        const hearts = s.match(HEART_RX);
        if (hearts && s.replace(HEART_RX, '').replace(/[\s\u200d\ufe0f]/g, '').length === 0) { put('hearts', hearts.length, null, b.src, b.id); continue; }
        const only = NUM_ONLY.exec(s);
        if (only) {
          const label = b.ctx || '';
          if (label) put(label, toNum(only[1]), only[2] ? toNum(only[2]) : null, b.src, b.id);
          continue;
        }
        let m, any = false;
        LABELLED.lastIndex = 0;
        while ((m = LABELLED.exec(s))) { put(m[1], toNum(m[2]), m[3] ? toNum(m[3]) : null, b.src, b.id + ':' + m[1]); any = true; }
        NUM_FIRST.lastIndex = 0;
        while ((m = NUM_FIRST.exec(s))) { put(m[2], toNum(m[1]), null, b.src, b.id + ':' + m[2]); any = true; }
        if (!any && hearts) put('hearts', hearts.length, null, b.src, b.id);
      }
    }

    // Pick which numbers are "my score", "my health", "my lives".
    choosePrimary(now) {
      const active = (r) => r && now - r.seenAt < 2500;
      const P = this.primary;
      const rs = [...this.readouts.values()].filter(active);
      const pickBest = (filter, scoreFn) => { let best = null, bs = -Infinity; for (const r of rs) { if (!filter(r)) continue; const s = scoreFn(r); if (s > bs) { bs = s; best = r; } } return best; };
      if (!active(this.readouts.get(P.score))) {
        const b = pickBest((r) => r.kind === 'score', (r) => (/score/i.test(r.label) ? 100 : 0) + r.ups * 2 - r.downs + (/coin|gold|money/i.test(r.label) ? 5 : 0));
        let k = b ? b.key : null;
        if (!k) { // no labelled score: a number that only goes up is probably the score
          const u = pickBest((r) => r.kind === 'unknown' && r.ups >= 3 && r.downs <= 1, (r) => r.ups);
          k = u ? u.key : null;
        }
        P.score = k;
      }
      if (!active(this.readouts.get(P.hp))) { const b = pickBest((r) => r.kind === 'health' && !/live|heart|❤|♥|💖|life/i.test(r.label), (r) => (r.max ? 10 : 0) + r.downs); P.hp = b ? b.key : null; }
      if (!active(this.readouts.get(P.lives))) { const b = pickBest((r) => r.kind === 'health' && /live|heart|❤|♥|💖|life/i.test(r.label), (r) => r.downs + 1); P.lives = b ? b.key : null; }
    }

    /* ---- main: look at the game right now ---- */
    sense() {
      const now = performance.now();
      const dt = Math.min(1, (now - this.lastT) / 1000);
      this.lastT = now;
      this.tick++;
      const obs = { t: now, dt, events: [], ok: false };
      let doc;
      try { doc = this.win && this.win.document; } catch (e) { doc = null; }
      if (!doc || !doc.body) return obs;
      if (doc !== this.doc) { this.doc = doc; this.items = []; }
      const win = this.win;
      obs.vw = win.innerWidth; obs.vh = win.innerHeight;

      if (now - this.itemsAt > 450 || !this.items.length) { this.itemsAt = now; this.collect(); this.findButtons(); }

      const px = this.paint();
      if (!px) return obs;
      obs.ok = true;
      // 40x30 gray + average down to 20x15 (gray, color, color category)
      const g40 = new Float32Array(GW * GH);
      let red = 0;
      for (let i = 0, j = 0; i < g40.length; i++, j += 4) {
        g40[i] = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) / 255;
        red += Math.max(0, px[j] - (px[j + 1] + px[j + 2]) / 2);
      }
      red /= g40.length * 255;
      const gray = new Float32Array(NSMALL), rgb = new Uint8Array(NSMALL * 3), cat = new Uint8Array(NSMALL);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        let r = 0, g = 0, b = 0, l = 0;
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
          const k = (y * 2 + yy) * GW + (x * 2 + xx), j = k * 4;
          r += px[j]; g += px[j + 1]; b += px[j + 2]; l += g40[k];
        }
        const i = y * SW + x;
        gray[i] = l / 4;
        rgb[i * 3] = r / 4; rgb[i * 3 + 1] = g / 4; rgb[i * 3 + 2] = b / 4;
        cat[i] = colorCat(r / 4, g / 4, b / 4);
      }
      // Small things (a coin, a thin paddle) get lost in an average color. So: find the BACKGROUND
      // color, then give each cell the most common NOT-background color inside it (looking closer).
      const F = this.fine;
      if (F) {
        const FW = GW * 2, FH = GH * 2;
        const fc = this.fineCat || (this.fineCat = new Uint8Array(FW * FH));
        const hist = new Uint32Array(9);
        for (let k = 0, j = 0; k < fc.length; k++, j += 4) { fc[k] = colorCat(F[j], F[j + 1], F[j + 2]); hist[fc[k]]++; }
        let bg = 0;
        for (let c = 1; c < 9; c++) if (hist[c] > hist[bg]) bg = c;
        obs.bgCat = bg;
        const cnt = new Uint8Array(9);
        for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
          cnt.fill(0);
          for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) cnt[fc[(y * 4 + yy) * FW + x * 4 + xx]]++;
          let bc = bg, bv = 1;
          for (let c = 0; c < 9; c++) { if (c === bg) continue; const v = cnt[c] * (c >= 3 ? 1.5 : 1); if (v > bv) { bv = v; bc = c; } }
          cat[y * SW + x] = bc;
        }
      }
      const motion = new Float32Array(NSMALL);
      if (this.prevGray20) for (let i = 0; i < NSMALL; i++) motion[i] = Math.min(1, Math.abs(gray[i] - this.prevGray20[i]) * 3);
      this.prevGray20 = gray;
      obs.gray = gray; obs.rgb = rgb; obs.cat = cat; obs.motion = motion; obs.g40 = g40; obs.px = px;

      // motion + which way things moved
      const prev = this.hist.length >= 2 ? this.hist[this.hist.length - 2] : this.hist[this.hist.length - 1];
      this.hist.push(g40);
      if (this.hist.length > 4) this.hist.shift();
      let amt = 0, changed = 0, cx = 0, cy = 0, wsum = 0, minx = GW, miny = GH, maxx = 0, maxy = 0;
      if (prev) {
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          const d = Math.abs(g40[y * GW + x] - prev[y * GW + x]);
          amt += d;
          if (d > 0.06) { changed++; cx += x * d; cy += y * d; wsum += d; if (x < minx) minx = x; if (y < miny) miny = y; if (x > maxx) maxx = x; if (y > maxy) maxy = y; }
        }
        amt /= GW * GH;
      }
      const frac = changed / (GW * GH);
      obs.motionAmt = amt; obs.changedFrac = frac;
      obs.centroid = changed ? { x: (cx / wsum + 0.5) / GW, y: (cy / wsum + 0.5) / GH } : null;
      if (obs.centroid) { obs.centroid.x = clamp(obs.centroid.x, 0, 1); obs.centroid.y = clamp(obs.centroid.y, 0, 1); }
      obs.gshift = { dx: 0, dy: 0, gain: 0 };
      obs.lshift = { dx: 0, dy: 0, gain: 0 };
      if (prev && changed) {
        if (frac > 0.25) obs.gshift = bestShift(prev, g40, 0, 0, GW, GH, 3);
        else obs.lshift = bestShift(prev, g40, Math.max(0, minx - 3), Math.max(0, miny - 3), Math.min(GW, maxx + 4), Math.min(GH, maxy + 4), 2);
      }
      this.staticTime = amt < 0.0015 ? this.staticTime + dt : 0;
      obs.staticTime = this.staticTime;

      // red flash = probably got hit
      const flash = red - this.redBase;
      this.redBase += (red - this.redBase) * 0.08;
      obs.redness = red;
      if (flash > 0.09 && now - this.lastFlashAt > 700) { this.lastFlashAt = now; obs.events.push({ type: 'flash', size: clamp(flash * 4, 0, 1) }); }

      // text + numbers (every other tick is plenty)
      if (this.tick % 2 === 0 || !this.textBits.length) {
        const bits = this.gatherText(now);
        this.readNumbers(bits, now);
        this.choosePrimary(now);
        this.checkPhrases(bits, now, obs);
      }
      this.numberEvents(obs, now);

      obs.buttons = this.buttons;
      const aip = this.aip;
      obs.lockActive = !!(aip && aip.lockEl);
      obs.frames = aip ? aip.frames : 0;
      if (aip && aip.errors.length > this.errorsSeen) { obs.errors = aip.errors.slice(this.errorsSeen); this.errorsSeen = aip.errors.length; }
      obs.gameOverVisible = this.phrase.over;
      obs.winVisible = this.phrase.win;
      obs.readouts = [...this.readouts.values()].filter((r) => now - r.seenAt < 2500);
      const P = this.primary;
      const sr = this.readouts.get(P.score), hr = this.readouts.get(P.hp), lr = this.readouts.get(P.lives);
      obs.score = sr ? sr.value : null; obs.scoreLabel = sr ? sr.label : null;
      obs.hp = hr ? { value: hr.value, max: hr.max || hr.maxSeen || 1, label: hr.label } : null;
      obs.lives = lr ? { value: lr.value, max: lr.max || lr.maxSeen || 1, label: lr.label } : null;
      let hf = 1;
      if (obs.hp) hf = Math.min(hf, clamp(obs.hp.value / Math.max(1, obs.hp.max), 0, 1));
      if (obs.lives) hf = Math.min(hf, clamp(obs.lives.value / Math.max(1, obs.lives.max), 0, 1));
      obs.healthFrac = hf;
      return obs;
    }

    checkPhrases(bits, now, obs) {
      let over = false, win = false, overText = '', winText = '';
      for (const b of bits) {
        if (b.s.length > 60) continue;
        if (!over && GAMEOVER_RX.test(b.s)) { over = true; overText = b.s; }
        if (!win && WIN_RX.test(b.s)) { win = true; winText = b.s; }
      }
      const P = this.phrase;
      if (over && !P.over) { P.overSince = now; obs.events.push({ type: 'gameOver', text: overText }); }
      if (win && !P.win) { P.winSince = now; obs.events.push({ type: 'win', text: winText }); }
      P.over = over; P.win = win;
    }

    numberEvents(obs, now) {
      const P = this.primary;
      const sr = this.readouts.get(P.score);
      if (sr && sr._last !== undefined && sr.value !== sr._last) {
        const d = sr.value - sr._last;
        if (d > 0) obs.events.push({ type: 'score', delta: d, value: sr.value, label: sr.label });
        else if (sr.value === 0 || sr.value < sr._last * 0.2) obs.events.push({ type: 'scoreReset', from: sr._last });
        else obs.events.push({ type: 'scoreLoss', delta: d, value: sr.value });
      }
      if (sr) sr._last = sr.value;
      for (const key of [P.hp, P.lives]) {
        const r = this.readouts.get(key);
        if (!r) continue;
        if (r._last !== undefined && r.value !== r._last) {
          const max = Math.max(1, r.max || r.maxSeen || 1);
          const d = r.value - r._last;
          if (d < 0) {
            obs.events.push({ type: 'damage', amount: clamp(-d / max, 0.05, 1), label: r.label, left: r.value });
            if (r.value <= 0) obs.events.push({ type: 'healthZero', label: r.label });
          } else if (r._last <= 0 || r.value >= max) obs.events.push({ type: 'refill', label: r.label });
          else obs.events.push({ type: 'heal', amount: clamp(d / max, 0, 1), label: r.label });
        }
        r._last = r.value;
      }
      for (const r of this.readouts.values()) {
        if (r.kind !== 'progress' || now - r.seenAt > 1000) continue;
        if (r._last !== undefined && r.value > r._last && r.value - r._last <= 3) obs.events.push({ type: 'progress', label: r.label, value: r.value });
        r._last = r.value;
      }
    }

    // A small picture of what the AI sees, for the brain view.
    eyeImage() { return this.cv; }
  }

  function isSolid(c) {
    if (!c || c === 'transparent') return false;
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return true;
    const p = m[1].split(',');
    return p.length < 4 || parseFloat(p[3]) > 0.15;
  }
  function elId(el) {
    if (el.id) return '#' + el.id;
    const p = el.parentElement;
    let i = 0;
    if (p) for (let c = p.firstElementChild; c && c !== el; c = c.nextElementSibling) i++;
    return (p && p.id ? '#' + p.id : (p ? p.tagName : '')) + '>' + el.tagName + i;
  }
  // For a lonely number like <b id="coinN">12</b>, guess what it means from nearby names/words.
  function ctxLabel(el) {
    const words = [];
    const addName = (e) => {
      if (!e) return;
      const s = ((e.id || '') + ' ' + (typeof e.className === 'string' ? e.className : '')).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
      if (s.trim()) words.push(s.trim());
    };
    addName(el); addName(el.parentElement);
    const sib = el.previousElementSibling || el.nextElementSibling;
    if (sib && sib.textContent && sib.textContent.length < 30) words.push(sib.textContent.trim());
    const p = el.parentElement;
    if (p) { let t = ''; for (let c = p.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue; t = t.replace(/[\d\s:/]+/g, ' ').trim(); if (t && t.length < 25) words.push(t); }
    if (!words.length && p) addName(p.parentElement);
    return words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  Senses.GW = GW; Senses.GH = GH; Senses.SW = SW; Senses.SH = SH; Senses.N = NSMALL;
  Senses.colorCat = colorCat;
  Senses.bestShift = bestShift;
  return Senses;
})();
