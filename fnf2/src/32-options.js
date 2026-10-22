// FNF 2 - Options (FNF OptionsState look: purple menuDesat, Alphabet pages, checkboxThingie)
// + Credits. Settings live in G.settings (core).
(function () {
  const PURPLE = '#EA71FD';
  // shared menu bits (back button on phones)
  G.ui = G.ui || {};
  // (phones: the real FNF mobile back button in the corner does 'back' now, 60-mobile.js)
  G.ui.drawBack = function () {};
  G.ui.hitBack = () => false;
  // Save data: everything the game keeps (scores, ranks, settings, rank mode, mods on/off) in one file you can
  // download and load again (on another browser, another PC, after clearing the browser)
  G.SaveData = {
    dump() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fnf2.')) data[k] = localStorage.getItem(k); }
      return { game: 'FNF 2', v: 1, made: new Date().toISOString(), data };
    },
    download() {
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      const name = 'FNF 2 save ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + '.' + pad(d.getMinutes()) + '.json';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(this.dump(), null, 1)], { type: 'application/json' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return name;
    },
    // asks for the file (has to run from a click / key press), writes it over the save, then the game restarts
    load(done) {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) { done(false, 'no file picked'); return; }
        f.text().then(t => {
          let o = null; try { o = JSON.parse(t); } catch (e) {}
          if (!o || o.game !== 'FNF 2' || !o.data || typeof o.data !== 'object') { done(false, 'that is not an FNF 2 save file'); return; }
          const keys = Object.keys(o.data).filter(k => k.startsWith('fnf2.') && typeof o.data[k] === 'string');
          if (!keys.length) { done(false, 'that save file is empty'); return; }
          for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('fnf2.') && !(k in o.data)) localStorage.removeItem(k); }
          for (const k of keys) localStorage.setItem(k, o.data[k]);
          done(true, o.made);
        }, () => done(false, 'could not read the file'));
      };
      inp.click();
    },
  };
  function drawDesat(ctx, color, sy) {
    G.setScreenT(ctx);
    ctx.fillStyle = color; ctx.fillRect(0, 0, G.W, G.H);
    const img = G.A.image('preload/images/menuDesat.png');
    if (img) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; const w = G.W * 1.1, h = img.height * w / img.width; ctx.drawImage(img, (G.W - w) / 2, (G.H - h) / 2 - (sy || 0) * 0.05, w, h); ctx.restore(); }
  }
  G.ui.drawDesat = drawDesat;
  const S = () => G.settings;
  const save = () => { G.saveSettings(); if (G.audio) G.audio.applyVolumes(); };
  // preference rows: [label, type, get, set, desc, extra]
  const PREFS = [
    ['Downscroll', 'bool', () => S().downscroll, v => S().downscroll = v, 'Notes move down toward the strumline at the bottom of the screen.'],
    ['Middlescroll', 'bool', () => S().middlescroll, v => S().middlescroll = v, 'Your arrows sit in the middle and the opponent arrows are hidden.'],
    ['Ghost Tapping', 'bool', () => S().ghostTapping, v => S().ghostTapping = v, 'Pressing a key when there is no note does not count as a miss.'],
    ['Modcharts', 'bool', () => S().modcharts !== false, v => S().modcharts = v, 'Songs can move, swap + spin your arrows and add trick notes. Off = just the song.'],
    ['Flashing Lights', 'bool', () => S().flashing, v => S().flashing = v, 'When disabled, flashing effects are dampened.'],
    ['Camera Zooms', 'bool', () => S().camZoom, v => S().camZoom = v, 'When enabled, the camera bounces on the beat during songs.'],
    ['Note Splashes', 'bool', () => S().noteSplashes, v => S().noteSplashes = v, 'Show a splash when you hit a SICK note.'],
    ['Combo Popups', 'bool', () => S().comboPopups !== false, v => S().comboPopups = v, 'Show SICK!! / GOOD and combo numbers when you hit notes.'],
    ['Pro Mode keys', 'enum', () => S().proKeys === 'any' ? 'any' : 'four', v => { S().proKeys = v; }, 'PRO MODE (main menu). FOUR: hit the right key for each arrow (your 4 note keys), early is fine, every hit is SICK. ANY: any one of your note keys hits the next note.', ['four', 'any']],
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
    ['Video Songs', 'enum', () => S().videoSongs || 'video', v => { S().videoSongs = v; }, 'Songs made from a video. VIDEO: the video plays behind the arrows. CHARACTERS: your picked player sings on a stage instead.', ['video', 'characters']],
    ['Phone controls', 'enum', () => S().touchScheme || 'arrows', v => { S().touchScheme = v; }, 'Arrows: tap your arrows at the bottom of the screen, like FNF mobile. Lanes: the screen is split into 4 tall lanes.', ['arrows', 'lanes']],
    ['App mode', 'bool', () => !!S().appMode, v => { S().appMode = v; if (G.appMode) { if (v) G.appMode.enter(); else G.appMode.exit(); } }, 'Phones: FNF 2 fills the whole screen (no browser bars) and stays sideways, like the FNF app. Tip: add it to your home screen too.'],
    ['Quality', 'enum', () => S().quality, v => { S().quality = v; G.autoQ = 1; G.resize(); }, 'Auto: 720p, lower by itself when it lags. High: full screen sharpness (strong PCs). Low: fastest.', ['auto', 'high', 'low']],
    ['Framerate', 'enum', () => S().fpsCap, v => { S().fpsCap = v; }, 'Highest frames per second. 60 is smooth and easy on your PC.', ['60', '120', '144', '240', 'max']],
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
    MAIN_ALL: [['PREFERENCES', 'buildPrefs'], ['CONTROLS', 'buildControls'], ['INPUT OFFSETS', 'buildOffsets'], ['MODS', 'buildMods'], ['SAVE DATA', 'buildSave'], ['EXIT', 'exit']],
    // (FNF mobile: no CONTROLS without a keyboard, and the back button in the corner instead of EXIT)
    get MAIN() { return G.touchMode ? this.MAIN_ALL.filter(m => m[1] !== 'buildControls' && m[1] !== 'exit') : this.MAIN_ALL; },
    buildMain(sel) {
      this.page = 'main'; this.sel = sel || 0;
      const n = this.MAIN.length, gap = Math.min(120, (G.H - 100) / n);
      this.items = this.MAIN.map(([s], i) => { const a = new G.Alphabet(s, true, 0, 0); a.x = (G.W - a.width) / 2; a.y = (G.H - n * gap) / 2 + i * gap; return a; });
    },
    buildSave() { this.page = 'save'; this.sel = 0; this.saveMsg = null; },
    // ---------- mods: every pack (ON / OFF), + load packs on phones (kept in the browser)
    buildMods() {
      this.page = 'mods'; this.sel = 0; this.modMsg = null; this.modsChanged = this.modsChanged || false;
      this.mods = Object.values(G.Packs.all).filter(p => !p.core).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    },
    modRows() { return this.mods.length + 1; },     // the packs, then LOAD PACKS
    modAction(i, d) {
      if (i < this.mods.length) {
        const p = this.mods[i]; G.Packs.setOn(p.id, !G.Packs.isOn(p.id)); this.modsChanged = true; G.sfx('scroll');
        this.modMsg = { ok: true, text: (p.name || p.id) + ' is ' + (G.Packs.isOn(p.id) ? 'ON' : 'OFF') + '. The game restarts when you leave this page.' };
        return;
      }
      // pick pack files (.head.js + .body.js, any number at once) or the update's whole zip: they're kept in this browser
      G.sfx('confirm');
      const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.js,.zip,text/javascript,application/javascript,application/zip,application/x-zip-compressed';
      inp.onchange = async () => {
        const files = [...(inp.files || [])]; if (!files.length) return;
        this.modMsg = { ok: true, text: files.some(f => /\.zip$/i.test(f.name)) ? 'Taking the mods out of the zip... (this can take a minute)' : 'Saving ' + files.length + ' file(s)...' };
        const got = await G.Packs.save(files);
        if (!got.length) { this.modMsg = { ok: false, text: 'No FNF 2 packs in there (pick the update zip, or files ending in .head.js / .body.js)' }; G.sfx('cancel'); return; }
        const names = [...new Set(got.map(m => m.name || m.id))];
        const half = got.filter(m => !got.some(o => o.id === m.id && o.part !== m.part) && !(G.Packs.all[m.id] && G.Packs.all[m.id].src)).map(m => (m.name || m.id) + ' (' + (m.part === 'head' ? 'body' : 'head') + ' missing)');
        this.modMsg = { ok: !half.length, text: 'Saved: ' + names.join(', ') + (half.length ? '. Also pick: ' + half.join(', ') : '. The game restarts when you leave this page.') };
        this.modsChanged = true;
      };
      inp.click();
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
        const n = this.MAIN.length;
        if (a === 'ui_up' || a === 'ui_down') { this.sel = (this.sel + (a === 'ui_up' ? -1 : 1) + n) % n; G.sfx('scroll'); }
        else if (a === 'accept') { const fn = this.MAIN[this.sel][1]; if (fn !== 'exit') G.sfx('confirm'); this[fn](); }
        else if (a === 'back') this.exit();
        return;
      }
      if (a === 'back' && this.page === 'mods' && this.modsChanged) { G.sfx('cancel'); save(); this.modMsg = { ok: true, text: 'Restarting...' }; setTimeout(() => location.reload(), 400); return true; }
      // back to the main list with the same item still picked (like FNF)
      if (a === 'back' && !this.cal) { G.sfx('cancel'); save(); this.buildMain(Math.max(0, this.MAIN.findIndex(m => m[1] === { prefs: 'buildPrefs', controls: 'buildControls', offsets: 'buildOffsets', mods: 'buildMods', save: 'buildSave' }[this.page]))); return true; }
      if (this.page === 'mods') {
        const n = this.modRows();
        if (a === 'ui_up' || a === 'ui_down') { this.sel = (this.sel + (a === 'ui_up' ? -1 : 1) + n) % n; G.sfx('scroll'); }
        else if (a === 'accept' || ((a === 'ui_left' || a === 'ui_right') && this.sel < this.mods.length)) this.modAction(this.sel);
        return;
      }
      if (this.page === 'save') {
        if (a === 'ui_up' || a === 'ui_down') { this.sel = 1 - this.sel; G.sfx('scroll'); }
        else if (a === 'accept') this.saveAction();
        return;
      }
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
        else if (a === 'back' && this.cal) { this.cal = null; G.audio.music.stop(0.2); setTimeout(() => G.menuMusic && G.menuMusic.start(0.5), 250); }
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
        if (this.page === 'main') { for (let i = 0; i < this.items.length; i++) if (Math.abs(s.y - this.items[i].y - 35) < 48) { if (i === this.sel) this.onAction('accept', true); else { this.sel = i; G.sfx('scroll'); } return; } }
        else if (this.page === 'mods') {
          const n = this.modRows(), top = 100, gap = Math.min(100, (G.H - 130 - top) / Math.max(1, n));
          const i = Math.floor((s.y - top + 10) / gap); if (i >= 0 && i < n) { if (i === this.sel) this.modAction(i); else { this.sel = i; G.sfx('scroll'); } }
        }
        else if (this.page === 'save') { const i = s.y < 270 ? 0 : s.y < 410 ? 1 : -1; if (i >= 0) { if (i === this.sel) this.saveAction(); else { this.sel = i; G.sfx('scroll'); } } }
        else if (this.page === 'prefs') { const i = Math.round((s.y + this.camY - 35) / 120); if (i >= 0 && i < this.rows.length) { if (i === this.sel) { const r = this.rows[i]; if (r.row[1] === 'bool') this.onAction('accept', true); else this.nudge(r.row, s.x > G.W / 2 ? 1 : -1); } else { this.sel = i; G.sfx('scroll'); } } }
        else this.onAction('accept', true);
      }
    },
    saveAction() {
      if (this.sel === 0) {
        save();
        try { const name = G.SaveData.download(); G.sfx('confirm'); this.saveMsg = { ok: true, text: 'Saved to your Downloads: ' + name }; }
        catch (e) { this.saveMsg = { ok: false, text: 'Could not download the save: ' + e.message }; }
      } else {
        G.sfx('confirm');
        G.SaveData.load((ok, info) => {
          if (!ok) { G.sfx('cancel'); this.saveMsg = { ok: false, text: 'Could not load: ' + info }; return; }
          this.saveMsg = { ok: true, text: 'Save loaded! The game restarts now...' };
          setTimeout(() => location.reload(), 1500);
        });
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
      } else if (this.page === 'mods') {
        G.setScreenT(ctx);
        const n = this.modRows(), top = 100, gap = Math.min(100, (G.H - 130 - top) / Math.max(1, n));
        const t = new G.Alphabet('MODS', true, 0, 12); t.scale = 0.75; t.x = (G.W - t.width * 0.75) / 2; t.draw(ctx, null);
        if (!this.mods.length) G.vcr(ctx, 'No mod packs yet. Put the packs folder next to the game, or LOAD PACKS below.', G.W / 2, top + 10, { size: 24, align: 'center', maxWidth: G.W - 60 });
        this.mods.forEach((p, i) => {
          const y = top + i * gap, on = G.Packs.isOn(p.id), sel = i === this.sel;
          const a = new G.Alphabet(p.name || p.id, true, 60, y); a.scale = Math.min(0.62, 760 / Math.max(1, a.width)); a.alpha = sel ? 1 : 0.6; a.draw(ctx, null);
          G.setScreenT(ctx);
          G.vcr(ctx, on ? 'ON' : 'OFF', G.W - 60, y + 6, { size: 40, align: 'right', color: on ? '#7CFF7C' : '#FF7070', alpha: sel ? 1 : 0.7, outline: 3 });
          G.vcr(ctx, (p.credit ? p.credit + '   ' : '') + (p.bodyMB ? (p.headMB + p.bodyMB).toFixed(0) + ' MB' : '') + (p.missingBody ? '   (half saved: LOAD PACKS its .body.js file too)' : p.src === 'saved' ? '   (saved in this browser)' : ''), 60, y + 58, { size: 18, alpha: sel ? 0.95 : 0.55, outline: 2, maxWidth: G.W - 260 });
        });
        const ly = top + this.mods.length * gap + 10, la = new G.Alphabet('LOAD PACKS', true, 0, ly); la.scale = 0.7; la.x = (G.W - la.width * 0.7) / 2; la.alpha = this.sel === this.mods.length ? 1 : 0.6; la.draw(ctx, null);
        G.setScreenT(ctx);
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, G.H - 110, G.W, 110); ctx.globalAlpha = 1;
        const info = this.sel < this.mods.length ? 'ENTER: switch this mod ON / OFF (OFF = its songs are not in the game).' : 'Phones: pick the pack files (.head.js + .body.js). They stay saved in this browser.';
        G.vcr(ctx, info, G.W / 2, G.H - 94, { size: 22, align: 'center', outline: 0, maxWidth: G.W - 40 });
        if (this.modMsg) G.vcr(ctx, this.modMsg.text, G.W / 2, G.H - 54, { size: 22, align: 'center', outline: 0, maxWidth: G.W - 40, color: this.modMsg.ok ? '#7CFF7C' : '#FF7070' });
      } else if (this.page === 'save') {
        G.setScreenT(ctx);
        ['DOWNLOAD SAVE', 'LOAD SAVE'].forEach((t, i) => { const a = new G.Alphabet(t, true, 0, 200 + i * 140); a.x = (G.W - a.width) / 2; a.alpha = i === this.sel ? 1 : 0.6; a.draw(ctx, null); });
        G.setScreenT(ctx);
        const info = this.sel === 0 ? 'Makes a file with all your scores, ranks, settings and rank mode. Keep it safe!' : 'Pick a save file you downloaded before. It replaces the save you have now.';
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, G.H - 120, G.W, 120); ctx.globalAlpha = 1;
        G.vcr(ctx, info, G.W / 2, G.H - 102, { size: 24, align: 'center', outline: 0, maxWidth: G.W - 40 });
        if (this.saveMsg) G.vcr(ctx, this.saveMsg.text, G.W / 2, G.H - 58, { size: 24, align: 'center', outline: 0, maxWidth: G.W - 40, color: this.saveMsg.ok ? '#7CFF7C' : '#FF7070' });
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
