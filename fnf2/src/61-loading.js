// FNF 2 - the loading screen: FNF's own (V-Slice LoadingState: lime green, the 'funkay' picture, a pink bar along
// the bottom) + a little game while you wait: ENDLESS ARROWS. Notes keep coming up to the arrows, faster and
// faster; hit them with your note keys (tap the 4 lanes on a phone). Your best combo is kept.
// Shown whenever the game has to wait a moment: a mod pack loading, pictures decoding, a song's music decoding.
(function () {
  const DIR = ['Left', 'Down', 'Up', 'Right'];
  const STRUMS = 'shared/images/noteStrumline', NOTES = 'shared/images/notes';
  const SP = 112, SCALE = 0.7, SY = 70, SPEED0 = 520;
  G.Loading = {
    shown: false, wait: 0, fade: 0, t: 0, prog: 0, maxPending: 0,
    best: G.store.get('fnf2.miniBest', 0) || 0,
    // every frame the game is waiting: after a short moment the screen shows (no flash for quick loads)
    frame(ctx, dt, label) {
      this.wait += dt;
      if (!this.shown && this.wait < 0.35) return false;
      if (!this.shown) this.start();
      this.update(dt);
      this.draw(ctx, label, 1);
      return true;
    },
    // nothing to wait for any more: fade it out over the game
    done() { if (this.shown) { this.shown = false; this.fade = 0.3; } this.wait = 0; this.maxPending = 0; },
    overlay(ctx, dt) { if (this.fade > 0 && !this.shown) { this.fade -= dt; this.draw(ctx, null, Math.max(0, this.fade / 0.3)); } },
    start() {
      this.shown = true; this.t = 0; this.prog = 0; this.score = 0; this.combo = 0; this.hits = 0; this.miss = 0;
      this.notes = []; this.nextT = 0.6; this.funk = 1;
      // (the arrow sheets are big pictures: ask for them now, they decode while the game loads its own stuff)
      this.strums = DIR.map((d, i) => {
        const s = new G.Sprite(0, 0).loadSparrow(STRUMS);
        s.addAnim('static', 'static' + d + '0', 24, false); s.addAnim('press', 'press' + d + '0', 24, false); s.addAnim('confirm', 'confirm' + d + '0', 24, false);
        s.scale.x = s.scale.y = SCALE; s.play('static', true); s.updateHitbox();
        s.lane = i; s.back = 0;
        return s;
      });
      this.keys = [false, false, false, false];
    },
    laneX(i) { return 70 + i * SP; },
    speed() { return SPEED0 * (1 + Math.min(1.6, this.t / 45)); },
    update(dt) {
      this.t += dt;
      // progress: pictures still decoding + the mod pack's body loading
      const pend = G.A.pending.size + (G.Packs.loadingNow ? 4 : 0);
      this.maxPending = Math.max(this.maxPending, pend);
      const want = this.maxPending ? 1 - pend / this.maxPending : 0.5;
      this.prog = G.lerp(this.prog, Math.max(this.prog, want), 1 - Math.pow(0.02, dt));
      // endless arrows: one note every beat-ish, quicker and quicker (and the odd double)
      this.nextT -= dt;
      if (this.nextT <= 0) {
        const gap = Math.max(0.16, 0.55 - this.t / 90);
        this.nextT = gap * (Math.random() < 0.2 ? 0.5 : 1);
        const lane = Math.floor(Math.random() * 4);
        this.notes.push({ lane, y: G.H + 80 });
        if (this.t > 20 && Math.random() < 0.15) this.notes.push({ lane: (lane + 1 + Math.floor(Math.random() * 3)) % 4, y: G.H + 80 });
      }
      const v = this.speed();
      for (const n of this.notes) {
        n.y -= v * dt;
        if (!n.hit && n.y < SY - 70) { n.hit = true; n.gone = true; this.combo = 0; this.miss++; }
      }
      this.notes = this.notes.filter(n => !n.gone);
      for (const s of this.strums) {
        s.update(dt);
        if (s.animName === 'confirm' && s.finished && !this.keys[s.lane]) s.play('static', true);
        if (s.back > 0) { s.back -= dt; if (s.back <= 0 && !this.keys[s.lane]) s.play('static', true); }
      }
      this.funk = G.lerp(this.funk, 1, 1 - Math.pow(0.001, dt));
    },
    hit(lane) {
      this.keys[lane] = true;
      let best = null, bd = 1e9;
      for (const n of this.notes) if (n.lane === lane && !n.hit) { const d = Math.abs(n.y - SY); if (d < bd) { bd = d; best = n; } }
      const s = this.strums[lane];
      if (best && bd < 75) {
        best.hit = best.gone = true;
        this.combo++; this.hits++; this.score += bd < 28 ? 350 : bd < 50 ? 200 : 100;
        if (this.combo > this.best) { this.best = this.combo; G.store.set('fnf2.miniBest', this.best); }
        s.play('confirm', true); s.back = 0.15; this.funk = 1.06;
      } else s.play('press', true);
    },
    release(lane) { this.keys[lane] = false; const s = this.strums[lane]; if (s.animName !== 'confirm') s.play('static', true); },
    // input while it's up: note keys play, everything else is ignored (true = used)
    key(acts, down, repeat) {
      if (!this.shown) return false;
      for (const a of acts) { const m = /^note(\d)$/.exec(a); if (m && !repeat) { if (down) this.hit(+m[1]); else this.release(+m[1]); } }
      return true;
    },
    _touch: {},
    pointer(type, x, y, id) {
      if (!this.shown) return false;
      if (type === 'down') { const lane = G.clamp(Math.floor((x - this.laneX(0) + SP / 2) / SP), 0, 3); this._touch[id] = lane; this.hit(lane); }
      else if (type === 'up' && this._touch[id] != null) { this.release(this._touch[id]); delete this._touch[id]; }
      return true;
    },
    draw(ctx, label, alpha) {
      G.setScreenT(ctx);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = '#caff4d'; ctx.fillRect(0, 0, G.W, G.H);
      // FNF's loading picture on the right (the little game takes the left)
      const f = G.A.image('preload/images/funkay.png');
      if (f && f.naturalWidth) { const rw = G.W - 540, w = rw * this.funk, h = f.naturalHeight * w / f.naturalWidth; ctx.drawImage(f, 540 + (rw - w) / 2, 110 + (G.H - 130 - h) / 2, w, h); }
      if (this.strums) {
        // the lanes, darkened so the arrows read over the picture
        ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = '#000'; ctx.fillRect(this.laneX(0) - 20, 0, SP * 4 + 40, G.H); ctx.globalAlpha = alpha;
        const sheet = G.Sparrow.load(NOTES);
        for (let i = 0; i < 4; i++) { const s = this.strums[i]; s.x = this.laneX(i) + (SP - s.width) / 2 - 4; s.y = SY - s.height / 2; s.offset.x = (s.frameW - s.width) * 0.5; s.offset.y = (s.frameH - s.height) * 0.5; s.origin.x = s.frameW / 2; s.origin.y = s.frameH / 2; s.draw(ctx, null); }
        G.setScreenT(ctx); ctx.globalAlpha = alpha;
        if (sheet) for (const n of this.notes) {
          const fr = G.Sparrow.byPrefix(sheet, 'note' + DIR[n.lane])[0]; if (!fr) continue;
          const w = fr.fw * SCALE;
          ctx.save(); ctx.translate(this.laneX(n.lane) + (SP - w) / 2 - 4, n.y - w / 2); ctx.scale(SCALE, SCALE); G.Sparrow.draw(ctx, sheet, fr); ctx.restore();
        }
        G.setScreenT(ctx); ctx.globalAlpha = alpha;
        const x = G.W - 24;
        G.vcr(ctx, 'ENDLESS ARROWS', x, 26, { size: 30, outline: 3, align: 'right' });
        G.vcr(ctx, 'Score: ' + this.score + '   Combo: ' + this.combo + '   Best combo: ' + this.best, x, 62, { size: 22, outline: 2, align: 'right' });
        G.vcr(ctx, G.touchMode ? 'tap the lanes on the left while you wait!' : 'hit the arrows with your note keys while you wait!', x, 90, { size: 18, outline: 2, align: 'right', alpha: 0.85 });
      }
      const msg = label || (G.Packs.loadingNow ? 'Loading ' + (G.Packs.loadingNow.name || G.Packs.loadingNow.id) + '...' : 'Loading...');
      G.vcr(ctx, msg, G.W - 24, G.H - 62, { size: 30, align: 'right', outline: 3 });
      // the pink bar along the bottom
      ctx.fillStyle = '#ff16d2'; ctx.fillRect(0, G.H - 20, G.W * G.clamp(this.prog, 0, 1), 10);
      ctx.restore();
    },
  };
})();
