// FNF 2 - RANK MODE: the freeplay menu with fake ranks + scores you set yourself.
// Pick a song, E (or ENTER) opens the edit box: rank, score, clear %, misses and the tallies.
// Picking a rank fills every number in so it looks like a real run; change any of them after.
// SAVE slams the rank onto the capsule like a real new rank, RESULTS plays the real results screen
// with your numbers. Saved on its own ('fnf2.rankmode'): it never touches your real scores.
(function () {
  const W = 1280, H = 720;
  const E = G.ease;
  const RANKS = ['SHIT', 'GOOD', 'GREAT', 'EXCELLENT', 'PERFECT', 'PERFECT_GOLD'];
  const RANK_NAME = { SHIT: 'LOSS', GOOD: 'GOOD', GREAT: 'GREAT', EXCELLENT: 'EXCELLENT', PERFECT: 'PERFECT', PERFECT_GOLD: 'GOLD PERFECT' };
  const RANK_COLOR = { SHIT: '#6044FF', GOOD: '#EF8764', GREAT: '#EAF6FF', EXCELLENT: '#FDCB42', PERFECT: '#FF58B4', PERFECT_GOLD: '#FFB619' };
  const DIFF_COLOR = { easy: '#58FF79', normal: '#FFE83A', hard: '#FF4A4A', erect: '#C28AFF', nightmare: '#FF3D8B' };
  const r = (a, b) => a + Math.random() * (b - a);

  const store = G.store.get('fnf2.rankmode', null) || {};
  store.scores = store.scores || {};

  const RM = G.RankMode = {
    get(songKey, diff) { return store.scores[G.scoreKey(songKey, diff, 'bf')] || null; },
    set(songKey, diff, rec) {
      const k = G.scoreKey(songKey, diff, 'bf');
      if (rec) store.scores[k] = rec; else delete store.scores[k];
      G.store.set('fnf2.rankmode', store);
    },
    // how many notes YOU hit in that chart (the opponent's don't count, nor fakes / don't-hit notes) + hold time
    chartInfo(id, variation, diff) {
      const c = G.Songs.chart(id, variation);
      const ns = ((c && c.notes && c.notes[diff]) || []).filter(n => n.d < 4 && n.k !== 'fake' && n.k !== 'eye');
      return { notes: ns.length || 300, holdMs: ns.reduce((a, n) => a + (n.l || 0), 0) };
    },
    // every number for a run that would really get this rank (same maths as the results screen)
    fill(rank, info) {
      const N = Math.max(1, info.notes);
      let sick, good, bad = 0, shit = 0, missed = 0;
      if (rank === 'PERFECT_GOLD') { sick = N; good = 0; }
      else if (rank === 'PERFECT') { good = Math.max(1, Math.round(N * r(0.02, 0.09))); sick = N - good; }
      else {
        const band = { EXCELLENT: [0.905, 0.985], GREAT: [0.805, 0.89], GOOD: [0.61, 0.79], SHIT: [0.25, 0.58] }[rank] || [0.6, 0.7];
        const lose = Math.max(1, Math.round(N * (1 - r(band[0], band[1]))));   // bad + shit + 2 x misses
        missed = Math.max(rank === 'EXCELLENT' ? 0 : 1, Math.round(lose * r(0.16, 0.32)));
        const rest = Math.max(0, lose - 2 * missed);
        bad = Math.round(rest * r(0.55, 0.78)); shit = rest - bad;
        const hit = Math.max(0, N - missed - bad - shit);
        good = Math.round(hit * (rank === 'SHIT' ? r(0.2, 0.34) : r(0.05, 0.16))); sick = hit - good;
      }
      const breaks = missed + bad + shit;
      const combo = breaks ? Math.max(1, Math.min(N - breaks, Math.round((N - breaks) / (breaks + 1) * r(1.6, 3.2)))) : N;
      const clear = Math.floor(Math.max(0, (sick + good - missed) / N) * 100);
      const held = info.holdMs / 1000 * 250 * (1 - breaks / N);
      const score = Math.round(sick * r(476, 498) + good * r(330, 420) + bad * r(170, 260) + shit * r(30, 120) - missed * 100 + held);
      return { rank, score: Math.max(0, score), clear, misses: missed, sick, good, bad, shit, combo };
    },
    fromRec(rec) {
      const t = rec.tallies || {};
      return {
        rank: rec.rank || null, score: rec.score || 0, clear: Math.floor((rec.clear != null ? rec.clear : rec.acc || 0) * 100),
        misses: t.missed != null ? t.missed : rec.misses || 0, sick: t.sick || 0, good: t.good || 0, bad: t.bad || 0, shit: t.shit || 0, combo: t.maxCombo || 0,
      };
    },
    toRec(v, info) {
      const hit = v.sick + v.good + v.bad + v.shit;
      const tallies = { sick: v.sick, good: v.good, bad: v.bad, shit: v.shit, missed: v.misses, maxCombo: v.combo, totalNotesHit: hit, totalNotes: Math.max(info.notes, hit + v.misses) };
      return { rank: v.rank, score: v.score, clear: v.clear / 100, acc: v.clear / 100, misses: v.misses, fc: !v.misses && !v.bad && !v.shit, tallies, fake: true, at: Date.now() };
    },
    open(fp) {
      const s = fp.song(); if (!s || fp.editor || fp.state !== 'idle') return;
      fp.editor = new Editor(fp, s);
    },
  };

  // ---------------------------------------------------------------- the edit box
  const ROWS = [
    { k: 'rank', label: 'RANK', h: 64 },
    { k: 'score', label: 'SCORE', max: 99999999, step: 1000 },
    { k: 'clear', label: 'CLEAR %', max: 100, step: 1 },
    { k: 'misses', label: 'MISSES', color: '#C68AE6', step: 1 },
    { k: 'sick', label: 'SICK', color: '#89E59E', step: 1 },
    { k: 'good', label: 'GOOD', color: '#89C9E5', step: 1 },
    { k: 'bad', label: 'BAD', color: '#E6CF8A', step: 1 },
    { k: 'shit', label: 'SHIT', color: '#E68C8A', step: 1 },
    { k: 'combo', label: 'MAX COMBO', step: 1 },
    { k: 'buttons', h: 50 },
  ];
  const BUTTONS = [
    { k: 'random', label: 'RANDOM' }, { k: 'real', label: 'COPY REAL' }, { k: 'all', label: 'ALL SONGS' },
    { k: 'delete', label: 'DELETE' }, { k: 'results', label: 'RESULTS' }, { k: 'save', label: 'SAVE' },
  ];
  const PX = 300, PW = 680, PY = 64, ROW_H = 38, LIST_Y = PY + 150, VAL_X0 = 270;
  const TALLY = ['sick', 'good', 'bad', 'shit', 'misses'];

  class Editor {
    constructor(fp, s) {
      this.fp = fp; this.s = s;
      this.d = s.diffs.find(x => x.diff === fp.diff) || s.diffs[0];
      this.diff = fp.diff;
      this.as = fp.realP ? '-as-' + fp.player : '';      // the new players keep their own ranks
      this.key = s.id + (this.d.variation !== 'default' ? '-' + this.d.variation : '') + this.as;
      this.info = RM.chartInfo(s.id, this.d.variation, this.diff);
      this.old = RM.get(this.key, this.diff);
      this.v = this.old ? RM.fromRec(this.old) : RM.fill('PERFECT', this.info);
      this.row = 0; this.btn = BUTTONS.length - 1;
      this.typing = false; this.clearManual = !!this.old;
      this.t = 0; this.a = 0; this.closing = false;
      this.toast = null;
      this.prevState = fp.state; fp.state = 'edit';
      this.tw = new G.Tw(); this.tw.to(this, { a: 1 }, 0.18, E.quartOut);
      this.rowY = []; let y = LIST_Y; for (const rw of ROWS) { this.rowY.push(y); y += rw.h || ROW_H; }
      G.sfx('scroll', { vol: 0.6 });
    }
    close(after) {
      if (this.closing) return;
      this.closing = true; this.typing = false;
      this.tw.to(this, { a: 0 }, 0.12, E.quartIn, { onComplete: () => { const fp = this.fp; fp.editor = null; fp.state = 'idle'; if (after) after(); } });
    }
    say(msg, color) { this.toast = { msg, color: color || '#FFFFFF', t: 2.4 }; }
    // ------------------------------------------------------------ values
    setRank(rank) {
      this.v = RM.fill(rank, this.info); this.rankT = this.t;
      this.clearManual = false; this.typing = false;
    }
    cycleRank(dir) {
      const i = RANKS.indexOf(this.v.rank);
      this.setRank(RANKS[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + RANKS.length) % RANKS.length]);
      G.sfx('scroll', { vol: 0.5 });
    }
    clamp(k) { const rw = ROWS.find(x => x.k === k); this.v[k] = Math.max(0, Math.min(rw.max != null ? rw.max : 99999, Math.round(this.v[k]))); }
    changed(k) {
      this.clamp(k);
      if (k === 'clear') this.clearManual = true;
      // the clear % follows the tallies until you set it yourself
      if (TALLY.includes(k) && !this.clearManual) {
        const v = this.v, n = Math.max(this.info.notes, v.sick + v.good + v.bad + v.shit + v.misses);
        v.clear = Math.floor(Math.max(0, Math.min(1, (v.sick + v.good - v.misses) / n)) * 100);
      }
    }
    nudge(dir, big) {
      const rw = ROWS[this.row];
      if (rw.k === 'rank') { this.cycleRank(dir); return; }
      if (rw.k === 'buttons') { this.btn = (this.btn + dir + BUTTONS.length) % BUTTONS.length; G.sfx('scroll', { vol: 0.4 }); return; }
      this.typing = false;
      this.v[rw.k] += dir * rw.step * (big ? 10 : 1);
      this.changed(rw.k);
      G.sfx('scroll', { vol: 0.3 });
    }
    type(digit) {
      const rw = ROWS[this.row];
      if (rw.k === 'rank' || rw.k === 'buttons') return;
      const max = rw.max != null ? rw.max : 99999;
      const cur = this.typing ? this.v[rw.k] : 0;
      const next = cur * 10 + digit;
      if (next > max) { this.v[rw.k] = this.typing ? cur : Math.min(max, digit); }
      else this.v[rw.k] = next;
      this.typing = true;
      this.changed(rw.k);
    }
    backspace() {
      const rw = ROWS[this.row]; if (rw.k === 'rank' || rw.k === 'buttons') return;
      this.v[rw.k] = Math.floor(this.v[rw.k] / 10); this.typing = true; this.changed(rw.k);
    }
    move(dir) { this.typing = false; this.row = (this.row + dir + ROWS.length) % ROWS.length; G.sfx('scroll', { vol: 0.4 }); }
    // ------------------------------------------------------------ buttons
    press(k) {
      const fp = this.fp, v = this.v;
      if (k === 'random') {
        const w = [0.8, 1.3, 1.6, 1.6, 1.1, 0.6]; let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
        while (x > w[i] && i < w.length - 1) { x -= w[i]; i++; }
        this.setRank(RANKS[i]); G.sfx('scroll', { vol: 0.6 });
        this.say('RANDOM: ' + RANK_NAME[RANKS[i]], RANK_COLOR[RANKS[i]]);
      } else if (k === 'real') {
        const real = G.getScore(this.key, this.diff, 'bf');
        if (!real || !real.rank) { G.sfx('cancel', { vol: 0.6 }); this.say('No real score on this song yet', '#FF7A7A'); return; }
        this.v = RM.fromRec(real); this.clearManual = true; G.sfx('scroll', { vol: 0.6 });
        this.say('Copied your real score', '#89E59E');
      } else if (k === 'all') {
        if (!v.rank) { G.sfx('cancel', { vol: 0.6 }); this.say('Pick a rank first', '#FF7A7A'); return; }
        let n = 0;
        for (const s of fp.allSongs) {
          const d = s.diffs.find(x => x.diff === this.diff); if (!d) continue;
          const key = s.id + (d.variation !== 'default' ? '-' + d.variation : '') + this.as;
          if (key === this.key) continue;
          const info = RM.chartInfo(s.id, d.variation, this.diff);
          RM.set(key, this.diff, RM.toRec(RM.fill(v.rank, info), info)); n++;
        }
        this.save(true);
        G.sfx('confirm');
        fp._rankToast = { msg: (n + 1) + ' songs are ' + RANK_NAME[v.rank] + ' on ' + this.diff.toUpperCase(), color: RANK_COLOR[v.rank], t: 3 };
      } else if (k === 'delete') {
        const had = !!this.old;
        RM.set(this.key, this.diff, null);
        G.sfx('cancel');
        this.close(() => { this.refresh(); if (had) this.fp.caps[this.fp.sel].shake(0.4, 1 / 24, 0.08, 0, E.quadOut); });
      } else if (k === 'results') {
        if (!v.rank) { G.sfx('cancel', { vol: 0.6 }); this.say('Pick a rank first', '#FF7A7A'); return; }
        const rec = RM.toRec(v, this.info);
        RM.set(this.key, this.diff, rec);
        G.sfx('confirm');
        const old = this.old, s = this.s, d = this.d;
        this.closing = true;
        G.setScreen('results', {
          mode: 'rank', song: s.id, diff: this.diff, variation: d.variation, title: s.name, player: fp.player,
          stats: { tallies: rec.tallies, score: rec.score }, forceRank: v.rank, forceClear: v.clear,
          prevRank: old ? old.rank : null, isNewHighscore: !old || rec.score > (old.score || 0),
        });
      } else if (k === 'save') this.save(false);
    }
    save(silent) {
      const v = this.v;
      if (!v.rank) { G.sfx('cancel', { vol: 0.6 }); this.say('Pick a rank first', '#FF7A7A'); return; }
      RM.set(this.key, this.diff, RM.toRec(v, this.info));
      if (!silent) G.sfx('confirm');
      const oldRank = this.old ? this.old.rank : null;
      this.close(() => {
        this.refresh();
        // the real new-rank slam (FreeplayState.rankAnimStart), no fade from black
        const fp = this.fp;
        fp.rankFx = { pending: false, fade: 0, bgA: 0, zoom: 1, funny: 1, vigA: 0, shakeT: 0 };
        fp.rankAnimStart({ rank: v.rank, oldRank });
      });
    }
    refresh() {
      const fp = this.fp;
      for (const s of fp.list) if (s) s.rank = fp.rankFor(s);
      fp.updateScore();
    }
    // ------------------------------------------------------------ input
    // (a key can mean several actions, e.g. note_left + ui_left: only the ones used here count as handled)
    onAction(a, down, repeat) {
      if (!down || this.closing) return false;
      if (a === 'ui_up') this.move(-1);
      else if (a === 'ui_down') this.move(1);
      else if (a === 'ui_left' || a === 'ui_right') this.nudge(a === 'ui_left' ? -1 : 1, G.input.isDown('shift'));
      else if (a === 'accept') { if (repeat) return true; if (ROWS[this.row].k === 'buttons') this.press(BUTTONS[this.btn].k); else this.save(false); }
      else if (a === 'back') { if (!repeat) { G.sfx('cancel'); this.close(); } }
      else return false;
      return true;
    }
    onKey(code, down, repeat) {
      if (!down || this.closing) return false;
      const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
      if (m) { this.type(+m[1]); return true; }
      if (code === 'Backspace' || code === 'Delete') { this.backspace(); return true; }
      if (code === 'KeyE' && !repeat) { G.sfx('cancel'); this.close(); return true; }
      if (code === 'Tab') { this.row = ROWS.length - 1; this.nudge(1); return true; }
      return /^Key[A-Z]$/.test(code) && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);   // letters do nothing in here
    }
    onWheel(dir) { if (!this.closing) this.nudge(-dir, false); }
    onPointer(type, x, y) {
      if (type !== 'down' || this.closing) return;
      if (x < PX || x > PX + PW || y < PY || y > PY + this.panelH()) { G.sfx('cancel'); this.close(); return; }
      for (let i = 0; i < ROWS.length; i++) {
        const rw = ROWS[i], y0 = this.rowY[i], h = rw.h || ROW_H;
        if (y < y0 || y >= y0 + h) continue;
        if (rw.k === 'buttons') {
          const b = this.buttonAt(x); if (b < 0) return;
          this.row = i; this.btn = b; this.press(BUTTONS[b].k); return;
        }
        if (this.row !== i) { this.typing = false; this.row = i; }
        // the little arrows either side of the value
        if (x < PX + VAL_X0 + 30 && x > PX + VAL_X0 - 24) this.nudge(-1, false);
        else if (x > PX + PW - 60) this.nudge(1, false);
        else G.sfx('scroll', { vol: 0.3 });
        return;
      }
    }
    buttonAt(x) {
      const bw = (PW - 40 - 8 * (BUTTONS.length - 1)) / BUTTONS.length;
      const i = Math.floor((x - PX - 20) / (bw + 8));
      return i >= 0 && i < BUTTONS.length ? i : -1;
    }
    panelH() { return this.rowY[ROWS.length - 1] + ROWS[ROWS.length - 1].h + 40 - PY; }
    update(dt) {
      this.t += dt; this.tw.update(dt);
      if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    }
    // ------------------------------------------------------------ draw
    draw(ctx) {
      const a = this.a; if (a <= 0) return;
      const fp = this.fp, v = this.v;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, W, H);
      const sc = 0.94 + 0.06 * a, ph = this.panelH();
      ctx.translate(W / 2, PY + ph / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -(PY + ph / 2));
      // the box (like freeplay's clear % box: black, rounded, white edge)
      rrect(ctx, PX, PY, PW, ph, 18); ctx.fillStyle = '#0B0B10'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      // header: song name glowing like a capsule title, difficulty, note count
      G.text(ctx, 'EDIT RANK', PX + 24, PY + 20, { font: G.FONT.f5b, size: 26, color: '#8C8C99', baseline: 'top' });
      G.text(ctx, this.diff.toUpperCase(), PX + PW - 24, PY + 20, { font: G.FONT.f5b, size: 26, color: DIFF_COLOR[this.diff] || '#FFFFFF', baseline: 'top', align: 'right' });
      ctx.save();
      ctx.shadowColor = fp.glowCol || '#00ccff'; ctx.shadowBlur = 14;
      G.text(ctx, this.s.name, W / 2, PY + 58, { font: G.FONT.f5b, size: 44, color: '#FFFFFF', baseline: 'top', align: 'center', maxWidth: PW - 60 });
      ctx.restore();
      G.text(ctx, this.info.notes + ' NOTES', W / 2, PY + 108, { font: G.FONT.f5, size: 22, color: '#6E6E7A', baseline: 'top', align: 'center' });
      // rows
      ROWS.forEach((rw, i) => {
        const y0 = this.rowY[i], h = rw.h || ROW_H, sel = i === this.row;
        if (rw.k === 'buttons') { this.drawButtons(ctx, y0 + 6, sel); return; }
        if (sel) { rrect(ctx, PX + 14, y0 + 2, PW - 28, h - 4, 10); ctx.fillStyle = 'rgba(255,255,255,0.11)'; ctx.fill(); }
        G.text(ctx, rw.label, PX + 34, y0 + h / 2, { font: G.FONT.f5b, size: 28, color: sel ? '#FFFFFF' : (rw.color || '#A8A8B4'), baseline: 'middle' });
        const ax0 = PX + VAL_X0, ax1 = PX + PW - 40;
        this.arrow(ctx, ax0, y0 + h / 2, -1, sel);
        this.arrow(ctx, ax1, y0 + h / 2, 1, sel);
        const cx = (ax0 + ax1) / 2;
        if (rw.k === 'rank') {
          if (v.rank) {
            // the real freeplay rank badge (with its glow) + the rank's name in its colour
            const img = fp.rankImg(v.rank), blur = fp.rankBlur(v.rank);
            const name = RANK_NAME[v.rank], tw = G.measure(ctx, name, 30, G.FONT.f5b);
            const bs = img ? 52 / img.height : 1, bw = img ? img.width * bs : 0, x0 = cx - (bw + 14 + tw) / 2;
            if (img) {
              const pop = 1 + 0.25 * Math.max(0, 1 - (this.t - (this.rankT || -9)) / 0.18);
              const by = y0 + h / 2, bx = x0 + bw / 2;
              ctx.save(); ctx.translate(bx, by); ctx.scale(pop, pop);
              if (blur) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(blur, -blur.width * bs / 2, -blur.height * bs / 2, blur.width * bs, blur.height * bs); ctx.globalCompositeOperation = 'source-over'; }
              ctx.drawImage(img, -bw / 2, -img.height * bs / 2, bw, img.height * bs);
              ctx.restore();
            }
            G.text(ctx, name, x0 + bw + 14, y0 + h / 2 + 1, { font: G.FONT.f5b, size: 30, color: RANK_COLOR[v.rank], baseline: 'middle', outline: 2, outlineColor: '#000' });
          } else G.text(ctx, 'NONE', cx, y0 + h / 2, { font: G.FONT.f5b, size: 28, color: '#6E6E7A', baseline: 'middle', align: 'center' });
          return;
        }
        let txt = String(v[rw.k]) + (rw.k === 'clear' ? '%' : '');
        const caret = sel && this.typing && Math.floor(this.t * 2.5) % 2 === 0;
        G.text(ctx, txt, cx, y0 + h / 2, { font: 'vcr', size: 32, color: sel ? '#FFFFFF' : '#D8D8E0', baseline: 'middle', align: 'center' });
        if (caret) { const w = G.measure(ctx, txt, 32, 'vcr'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx + w / 2 + 4, y0 + h / 2 - 13, 3, 26); }
      });
      // tips + messages
      const tip = this.toast ? this.toast.msg : 'Pick a rank and every number fills itself in. Type numbers to change them.';
      const ta = this.toast ? Math.min(1, this.toast.t / 0.4) : 1;
      G.text(ctx, tip, W / 2, PY + ph - 22, { font: G.FONT.f5, size: 20, color: this.toast ? this.toast.color : '#6E6E7A', baseline: 'middle', align: 'center', alpha: ta, maxWidth: PW - 40 });
      ctx.restore();
      G.text(ctx, 'ARROWS move   TYPE numbers   ENTER save   ESC cancel', W / 2, Math.min(H - 14, PY + ph + 22), { font: G.FONT.f5, size: 20, color: '#BDBDC6', baseline: 'middle', align: 'center', alpha: a, outline: 2, outlineColor: '#000' });
    }
    drawButtons(ctx, y, rowSel) {
      const bw = (PW - 40 - 8 * (BUTTONS.length - 1)) / BUTTONS.length;
      BUTTONS.forEach((b, i) => {
        const x = PX + 20 + i * (bw + 8), on = rowSel && i === this.btn;
        rrect(ctx, x, y, bw, 38, 9);
        ctx.fillStyle = on ? '#FFFFFF' : (b.k === 'save' ? '#1E3A24' : b.k === 'delete' ? '#3A1E1E' : '#1A1A22'); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = on ? '#FFFFFF' : '#5A5A66'; ctx.stroke();
        G.text(ctx, b.label, x + bw / 2, y + 20, { font: G.FONT.f5b, size: 19, color: on ? '#000000' : '#FFFFFF', baseline: 'middle', align: 'center', maxWidth: bw - 8 });
      });
    }
    // freeplay's difficulty arrow (the shiny pointer), small
    arrow(ctx, x, y, dir, sel) {
      const sh = G.Sparrow.load('preload/images/freeplay/freeplaySelector/freeplaySelector') || G.Sparrow.load('preload/images/freeplay/freeplaySelector');
      const fr = sh ? G.Sparrow.byPrefix(sh, 'arrow pointer loop') : [];
      const f = fr.length ? fr[Math.floor(this.t * 24) % fr.length] : null;
      ctx.save();
      ctx.globalAlpha *= sel ? 1 : 0.35;
      ctx.translate(x, y);
      if (f) {
        const s = 30 / f.fh;
        ctx.scale(dir > 0 ? -s : s, s);
        ctx.translate(-f.fw / 2, -f.fh / 2);
        G.Sparrow.draw(ctx, sh, f);
      } else {
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(-8 * dir, 0); ctx.lineTo(8 * dir, -10); ctx.lineTo(8 * dir, 10); ctx.fill();
      }
      ctx.restore();
    }
  }

  function rrect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }

  // a message on the freeplay screen after ALL SONGS (drawn over the list for a few seconds)
  const FP = G.screens.freeplay;
  const baseDraw = FP.draw, baseUpdate = FP.update;
  FP.update = function (dt) { baseUpdate.call(this, dt); if (this._rankToast) { this._rankToast.t -= dt; if (this._rankToast.t <= 0) this._rankToast = null; } };
  FP.draw = function (ctx) {
    baseDraw.call(this, ctx);
    const t = this._rankToast; if (!t || this.editor) return;
    G.setScreenT(ctx);
    const a = Math.min(1, t.t / 0.5, (3 - t.t) / 0.2);
    G.text(ctx, t.msg, W / 2 + 120, H - 40, { font: G.FONT.f5b, size: 30, color: t.color, baseline: 'middle', align: 'center', alpha: a, outline: 3, outlineColor: '#000' });
  };
})();
