// FNF 2 - Options (FNF OptionsState look: purple menuDesat, Alphabet pages, checkboxThingie)
// + Credits. Settings live in G.settings (core).
(function () {
  const PURPLE = '#EA71FD';
  function drawDesat(ctx, color, sy) {
    G.setScreenT(ctx);
    ctx.fillStyle = color; ctx.fillRect(0, 0, G.W, G.H);
    const img = G.A.image('preload/images/menuDesat.png');
    if (img) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; const w = G.W * 1.1, h = img.height * w / img.width; ctx.drawImage(img, (G.W - w) / 2, (G.H - h) / 2 - (sy || 0) * 0.05, w, h); ctx.restore(); }
  }
  G.ui = G.ui || {};
  G.ui.drawDesat = drawDesat;
  const S = () => G.settings;
  const save = () => { G.saveSettings(); if (G.audio) G.audio.applyVolumes(); };
  // preference rows: [label, type, get, set, desc, extra]
  const PREFS = [
    ['Downscroll', 'bool', () => S().downscroll, v => S().downscroll = v, 'Notes move down toward the strumline at the bottom of the screen.'],
    ['Middlescroll', 'bool', () => S().middlescroll, v => S().middlescroll = v, 'Your arrows sit in the middle and the opponent arrows are hidden.'],
    ['Ghost Tapping', 'bool', () => S().ghostTapping, v => S().ghostTapping = v, 'Pressing a key when there is no note does not count as a miss.'],
    ['Flashing Lights', 'bool', () => S().flashing, v => S().flashing = v, 'When disabled, flashing effects are dampened.'],
    ['Camera Zooms', 'bool', () => S().camZoom, v => S().camZoom = v, 'When enabled, the camera bounces on the beat during songs.'],
    ['Note Splashes', 'bool', () => S().noteSplashes, v => S().noteSplashes = v, 'Show a splash when you hit a SICK note.'],
    ['Combo Popups', 'bool', () => S().comboPopups !== false, v => S().comboPopups = v, 'Show SICK!! / GOOD and combo numbers when you hit notes.'],
    ['Botplay', 'bool', () => S().botplay, v => S().botplay = v, 'The game plays for you. Scores are not saved.'],
    ['Practice Mode', 'bool', () => S().practice, v => S().practice = v, 'You cannot die. Scores are not saved.'],
    ['FPS Counter', 'bool', () => S().fps, v => S().fps = v, 'Show the frames per second in the corner.'],
    ['Time Bar', 'enum', () => S().timeBar, v => S().timeBar = v, 'What the bar at the top shows during a song.', ['name', 'left', 'elapsed', 'off']],
    ['Scroll Speed', 'enum', () => S().speedType, v => S().speedType = v, 'Chart = the song\'s own speed. Mult = multiplied. Const = always the same.', ['chart', 'mult', 'const']],
    ['Speed Value', 'num', () => S().speedValue, v => S().speedValue = v, 'Used by the Mult / Const scroll speed modes.', [0.5, 4, 0.1, 1]],
    ['Hitsound', 'num', () => S().hitsound, v => S().hitsound = v, 'Volume of a click on every note you hit.', [0, 1, 0.1, 1]],
    ['Master Volume', 'num', () => S().vol.master, v => S().vol.master = v, 'Overall game volume.', [0, 1, 0.05, 2]],
    ['Music Volume', 'num', () => S().vol.music, v => S().vol.music = v, 'Volume of the instrumentals + menu music.', [0, 1, 0.05, 2]],
    ['Vocals Volume', 'num', () => S().vol.vocals, v => S().vol.vocals = v, 'Volume of the singing.', [0, 1, 0.05, 2]],
    ['SFX Volume', 'num', () => S().vol.sfx, v => S().vol.sfx = v, 'Volume of menu sounds and misses.', [0, 1, 0.05, 2]],
    ['Quality', 'enum', () => S().quality, v => { S().quality = v; G.autoQ = 1; G.resize(); }, 'Auto lowers the resolution when the game lags.', ['auto', 'high', 'low']],
  ];
  const fmt = (row) => {
    const v = row[2]();
    if (row[1] === 'enum') return String(v).toUpperCase();
    if (row[1] === 'num') { const step = row[5][2]; return step < 0.1 || row[0].includes('Volume') || row[0] === 'Hitsound' ? Math.round(v * 100) + '%' : v.toFixed(1) + 'x'; }
    return '';
  };

  G.screens.options = {
    enter(p) {
      this.from = (p && p.from) || 'mainMenu';
      this.page = 'main'; this.sel = 0; this.t = 0;
      this.swipe = new G.Swipe();
      this.buildMain();
    },
    buildMain() {
      this.page = 'main'; this.sel = 0;
      this.items = ['PREFERENCES', 'CONTROLS', 'INPUT OFFSETS', 'EXIT'].map((s, i) => { const a = new G.Alphabet(s, true, 0, 0); a.x = (G.W - a.width) / 2; a.y = 120 + i * 120 + (G.H - 4 * 120) / 2 - 60; return a; });
    },
    buildPrefs() {
      this.page = 'prefs'; this.sel = 0; this.camY = 0;
      this.rows = PREFS.map((r, i) => {
        const a = new G.Alphabet(r[0], true, 120, 120 * i);
        const cb = new G.Sprite(0, 0).loadSparrow('preload/images/checkboxThingie');
        cb.addAnim('off', 'Check Box unselected', 24, false); cb.addAnim('on', 'Check Box Selected Static', 24, false); cb.addAnim('turnOn', 'Check Box selecting animation', 24, false);
        cb.scale.x = cb.scale.y = 0.7; cb.play(r[1] === 'bool' && r[2]() ? 'on' : 'off'); cb.updateHitbox();
        cb.onFinish = n => { if (n === 'turnOn') cb.play('on'); };
        return { row: r, text: a, cb, val: null };
      });
    },
    buildControls() {
      this.page = 'controls'; this.sel = 0; this.wait = null;
      this.ctrl = [['LEFT', 'note0'], ['DOWN', 'note1'], ['UP', 'note2'], ['RIGHT', 'note3'], ['RESET TO WASD', 'preset0'], ['RESET TO DFJK', 'preset1']];
    },
    buildOffsets() { this.page = 'offsets'; this.sel = 0; this.cal = null; },
    update(dt) {
      this.t += dt;
      if (this.items) for (const a of this.items) a.update(dt);
      if (this.page === 'prefs') {
        const target = this.sel * 120 - G.H / 2 + 60;
        this.camY = G.lerp(this.camY, target, 1 - Math.pow(0.0001, dt));
        for (const r of this.rows) { r.text.update(dt); r.cb.update(dt); }
      }
      if (this.cal) this.updateCal(dt);
    },
    // ---------- input
    onKey(code, down) {
      if (this.page === 'controls' && this.wait && down) {
        const [, act] = this.ctrl[this.sel];
        if (code !== 'Escape') { const b = S().binds[act]; b[this.wait.slot] = code; save(); G.sfx('confirm'); }
        this.wait = null; G.input.blockKeys = false; return true;
      }
      if (this.cal && down && (code === 'Space' || code === 'Enter')) { this.calTap(); return true; }
      return false;
    },
    onAction(a, down) {
      if (!down) return;
      if (this.page === 'main') {
        if (a === 'ui_up' || a === 'ui_down') { this.sel = (this.sel + (a === 'ui_up' ? -1 : 1) + 4) % 4; G.sfx('scroll'); }
        else if (a === 'accept') { G.sfx('confirm'); [() => this.buildPrefs(), () => this.buildControls(), () => this.buildOffsets(), () => this.exit()][this.sel](); }
        else if (a === 'back') this.exit();
        return;
      }
      if (a === 'back' && !this.cal) { G.sfx('cancel'); save(); this.buildMain(); return; }
      if (this.page === 'prefs') {
        const r = this.rows[this.sel];
        if (a === 'ui_up' || a === 'ui_down') { this.sel = (this.sel + (a === 'ui_up' ? -1 : 1) + this.rows.length) % this.rows.length; G.sfx('scroll'); }
        else if (a === 'accept' && r.row[1] === 'bool') { const v = !r.row[2](); r.row[3](v); r.cb.play(v ? 'turnOn' : 'off', true); save(); }
        else if ((a === 'ui_left' || a === 'ui_right') && r.row[1] !== 'bool') this.nudge(r.row, a === 'ui_left' ? -1 : 1);
      } else if (this.page === 'controls') {
        if (a === 'ui_up' || a === 'ui_down') { this.sel = (this.sel + (a === 'ui_up' ? -1 : 1) + this.ctrl.length) % this.ctrl.length; G.sfx('scroll'); }
        else if (a === 'ui_left' || a === 'ui_right') { this.slot = a === 'ui_left' ? 0 : 1; }
        else if (a === 'accept') {
          const [, act] = this.ctrl[this.sel];
          if (act.startsWith('preset')) { S().binds = JSON.parse(JSON.stringify(act === 'preset0' ? G.DEFAULT_BINDS : G.DFJK_BINDS)); save(); G.sfx('confirm'); }
          else { this.wait = { slot: this.slot || 0 }; G.input.blockKeys = true; }
        }
      } else if (this.page === 'offsets') {
        if (a === 'ui_left' || a === 'ui_right') { S().offset = G.clamp((S().offset || 0) + (a === 'ui_left' ? -1 : 1) * (G.input.isDown('shift') ? 10 : 1), -500, 500); save(); G.sfx('scroll', { vol: 0.4 }); }
        else if (a === 'accept' && !this.cal) this.startCal();
        else if (a === 'back' && this.cal) { this.cal = null; G.audio.music.stop(0.2); }
      }
    },
    nudge(row, d) {
      if (row[1] === 'enum') { const list = row[5]; const i = list.indexOf(row[2]()); row[3](list[(i + d + list.length) % list.length]); }
      else { const [mn, mx, st] = row[5]; row[3](Math.round(G.clamp(row[2]() + d * st, mn, mx) * 100) / 100); }
      G.sfx('scroll', { vol: 0.4 }); save();
    },
    onWheel(d) { this.onAction(d > 0 ? 'ui_down' : 'ui_up', true); },
    onPointer(type, x, y) {
      if (type === 'down' && G.ui.hitBack(x, y)) { this.onAction('back', true); return; }
      const s = this.swipe.handle(type, x, y); if (!s) return;
      if (s.dir === 'up') this.onAction('ui_down', true); else if (s.dir === 'down') this.onAction('ui_up', true);
      else if (s.dir === 'left') this.onAction('ui_left', true); else if (s.dir === 'right') this.onAction('ui_right', true);
      else if (s.dir === 'tap') {
        if (this.cal) { this.calTap(); return; }
        if (this.page === 'main') { for (let i = 0; i < this.items.length; i++) if (Math.abs(s.y - this.items[i].y - 35) < 55) { if (i === this.sel) this.onAction('accept', true); else { this.sel = i; G.sfx('scroll'); } return; } }
        else if (this.page === 'prefs') { const i = Math.round((s.y + this.camY - 35) / 120); if (i >= 0 && i < this.rows.length) { if (i === this.sel) { const r = this.rows[i]; if (r.row[1] === 'bool') this.onAction('accept', true); else this.nudge(r.row, s.x > G.W / 2 ? 1 : -1); } else { this.sel = i; G.sfx('scroll'); } } }
        else this.onAction('accept', true);
      }
    },
    exit() { G.sfx('cancel'); save(); G.setScreen(this.from === 'pause' ? 'play' : 'mainMenu', {}); },
    // ---------- offset calibration: tap along to a metronome, average the error
    startCal() { this.cal = { taps: [], start: performance.now() + 1000, bpm: 100 }; G.audio.music.stop(0.1); },
    calTap() {
      const c = this.cal; const now = performance.now(), per = 60000 / c.bpm;
      const rel = (now - c.start) % per; const err = rel > per / 2 ? rel - per : rel;
      c.taps.push(err); if (c.taps.length > 16) c.taps.shift();
      const avg = c.taps.reduce((a, b) => a + b, 0) / c.taps.length;
      c.avg = Math.round(avg);
      if (c.taps.length >= 8) { S().offset = c.avg; save(); }
    },
    updateCal() {
      const c = this.cal, per = 60000 / c.bpm, now = performance.now();
      const beat = Math.floor((now - c.start) / per);
      if (beat >= 0 && beat !== c.lastBeat) { c.lastBeat = beat; G.sfx('preload/sounds/scrollMenu.ogg', { vol: beat % 4 === 0 ? 1 : 0.6 }); c.flash = 1; }
      c.flash = Math.max(0, (c.flash || 0) - 0.08);
    },
    // ---------- drawing
    draw(ctx) {
      drawDesat(ctx, PURPLE, this.camY || 0);
      if (this.page === 'main') {
        this.items.forEach((a, i) => { a.alpha = i === this.sel ? 1 : 0.6; a.draw(ctx, null); });
      } else if (this.page === 'prefs') {
        G.setScreenT(ctx);
        this.rows.forEach((r, i) => {
          const y = 120 * i - this.camY;
          if (y < -120 || y > G.H) return;
          r.text.y = y; r.text.alpha = i === this.sel ? 1 : 0.6; r.text.draw(ctx, null);
          if (r.row[1] === 'bool') { r.cb.x = 0; r.cb.y = y - 20; r.cb.alpha = r.text.alpha; r.cb.draw(ctx, null); }
          else { const v = new G.Alphabet('< ' + fmt(r.row) + ' >', true, 0, 0); v.scale = 0.6; v.x = 120 + r.text.width + 30; v.y = y + 18; v.alpha = r.text.alpha; v.draw(ctx, null); }
        });
        const desc = this.rows[this.sel].row[4];
        G.setScreenT(ctx); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, G.H - 70, G.W, 70); ctx.globalAlpha = 1;
        G.vcr(ctx, desc, G.W / 2, G.H - 52, { size: 24, align: 'center', outline: 0, maxWidth: G.W - 40 });
      } else if (this.page === 'controls') {
        G.setScreenT(ctx);
        const nm = c => (c || '---').replace('Key', '').replace('Arrow', '').replace('Digit', '');
        this.ctrl.forEach(([label, act], i) => {
          const y = 120 + i * 90, on = i === this.sel;
          const a = new G.Alphabet(label, true, 80, y); a.alpha = on ? 1 : 0.6; a.scale = 0.8; a.draw(ctx, null);
          if (!act.startsWith('preset')) {
            const b = S().binds[act];
            for (let k = 0; k < 2; k++) {
              const sel = on && (this.slot || 0) === k;
              const txt = this.wait && on && this.wait.slot === k ? 'PRESS A KEY' : nm(b[k]);
              G.vcr(ctx, txt, 620 + k * 300, y + 14, { size: 36, color: sel ? '#FFE45C' : '#fff', alpha: on ? 1 : 0.6, outline: 3 });
            }
          }
        });
        G.vcr(ctx, 'LEFT/RIGHT pick slot - ENTER rebind - ESC back', G.W / 2, G.H - 40, { size: 22, align: 'center' });
      } else if (this.page === 'offsets') {
        G.setScreenT(ctx);
        const a = new G.Alphabet('OFFSET: ' + (S().offset || 0) + 'MS', true, 0, 160); a.x = (G.W - a.width) / 2; a.draw(ctx, null);
        G.vcr(ctx, 'LEFT/RIGHT change (SHIFT x10). If notes feel LATE, raise it.', G.W / 2, 290, { size: 26, align: 'center' });
        if (!this.cal) G.vcr(ctx, 'ENTER: calibrate (tap SPACE/ENTER on every beat)', G.W / 2, 340, { size: 26, align: 'center' });
        else {
          const c = this.cal;
          G.setScreenT(ctx); ctx.globalAlpha = 0.2 + 0.8 * c.flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(G.W / 2, 470, 60, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          G.vcr(ctx, 'taps: ' + c.taps.length + '   average: ' + (c.avg != null ? c.avg + 'ms' : '-'), G.W / 2, 560, { size: 28, align: 'center' });
          G.vcr(ctx, 'ESC to stop (after 8 taps the offset is applied)', G.W / 2, 610, { size: 22, align: 'center' });
        }
      }
      G.ui.drawBack(ctx);
    },
  };

  // ---------------------------------------------------------------- CREDITS
  G.screens.credits = {
    enter() {
      this.list = (G.CREDITS || []).map(c => c.head ? { head: true, a: new G.Alphabet(c.head, true, 0, 0) } : { a: new G.Alphabet(c.name, true, 0, 0), role: c.role });
      this.sel = this.list.findIndex(x => !x.head); this.camY = 0;
    },
    update(dt) { const t = this.sel * 110 - G.H / 2 + 60; this.camY = G.lerp(this.camY, t, 1 - Math.pow(0.001, dt)); for (const x of this.list) x.a.update(dt); },
    move(d) { let i = this.sel; do { i = (i + d + this.list.length) % this.list.length; } while (this.list[i].head); this.sel = i; G.sfx('scroll'); },
    onAction(a, down) { if (!down) return; if (a === 'ui_up') this.move(-1); else if (a === 'ui_down') this.move(1); else if (a === 'back') { G.sfx('cancel'); G.setScreen('mainMenu', {}); } },
    onPointer(type, x, y) { if (type === 'down') { if (G.ui.hitBack(x, y)) this.onAction('back', true); else this.move(y > G.H / 2 ? 1 : -1); } },
    draw(ctx) {
      drawDesat(ctx, '#B57EDC', this.camY);
      this.list.forEach((x, i) => {
        const y = i * 110 - this.camY; if (y < -100 || y > G.H) return;
        x.a.x = x.head ? (G.W - x.a.width) / 2 : 120; x.a.y = y; x.a.alpha = x.head || i === this.sel ? 1 : 0.6; x.a.draw(ctx, null);
      });
      const cur = this.list[this.sel];
      if (cur && cur.role) { G.setScreenT(ctx); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, G.H - 70, G.W, 70); ctx.globalAlpha = 1; G.vcr(ctx, cur.role, G.W / 2, G.H - 52, { size: 28, align: 'center', outline: 0 }); }
      G.ui.drawBack(ctx);
    },
  };
})();
