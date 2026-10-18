// FNF 2 - the V-Slice sticker transition (StickerSubState): stickers slap onto the screen in a
// random order with key-click sounds, the next screen loads underneath, then they peel off.
G.stickers = {
  active: false, phase: null, list: [], t: 0,
  packFor(player) {
    const P = G.A.json('preload/data/players/' + player + '.json') || G.A.json('preload/data/players/bf.json') || {};
    const pack = G.A.json('preload/data/stickerpacks/' + (P.stickerPack || 'standard-bf') + '.json') || G.A.json('preload/data/stickerpacks/standard-bf.json');
    return ((pack && pack.stickers) || []).map(s => G.A.image('shared/images/' + s + '.png')).filter(Boolean);
  },
  sound() { const n = [1, 2, 3, 4, 5, 7, 8, 9][Math.floor(Math.random() * 8)]; G.sfx('shared/sounds/stickersounds/keys/keyClick' + n + '.ogg'); },
  // cover the screen, call onCovered() once it's full, then peel the stickers off again
  cover(player, onCovered) {
    const imgs = this.packFor(player);
    if (!imgs.length) { onCovered(); return; }
    const pick = () => imgs[Math.floor(Math.random() * imgs.length)];
    const list = [];
    let x = -100, y = -100;
    while (x <= G.W) {
      const img = pick();
      list.push({ img, x, y, angle: (Math.floor(Math.random() * 131) - 60) * Math.PI / 180, scale: 1, vis: false });
      x += img.width * 0.5;
      if (x >= G.W && y <= G.H) { x = -100; y += 70 + Math.random() * 50; }
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const last = pick();
    list.push({ img: last, x: (G.W - last.width) / 2, y: (G.H - last.height) / 2, angle: 0, scale: 1, vis: false, last: true });
    list.forEach((s, i) => { s.timing = i / list.length * 0.9; s.jig = s.last ? 2 : Math.floor(Math.random() * 3); });
    this.list = list; this.t = 0; this.phase = 'cover'; this.active = true; this.onCovered = onCovered;
  },
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.phase === 'cover') {
      for (const s of this.list) {
        if (!s.vis && this.t >= s.timing) { s.vis = true; this.sound(); }
        if (s.vis && s.scale === 1 && !s.jigged && this.t >= s.timing + s.jig / 24) { s.jigged = true; s.scale = 0.97 + Math.random() * 0.05; }
      }
      const L = this.list[this.list.length - 1];
      if (L.jigged) {
        this.phase = 'peel'; this.t = 0;
        const f = this.onCovered; this.onCovered = null;
        if (f) f();
      }
    } else if (this.phase === 'peel') {
      for (let i = 0; i < this.list.length; i++) {
        const s = this.list[i];
        if (s.vis && this.t >= s.timing) { s.vis = false; this.sound(); }
      }
      if (this.list.every(s => !s.vis)) { this.active = false; this.list = []; this.phase = null; }
    }
  },
  draw(ctx) {
    if (!this.active) return;
    G.setScreenT(ctx);
    for (const s of this.list) {
      if (!s.vis) continue;
      ctx.save();
      ctx.translate(s.x + s.img.width / 2, s.y + s.img.height / 2);
      ctx.rotate(s.angle); ctx.scale(s.scale, s.scale);
      ctx.drawImage(s.img, -s.img.width / 2, -s.img.height / 2);
      ctx.restore();
    }
  },
};
