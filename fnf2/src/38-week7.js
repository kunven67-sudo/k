// FNF 2 - Week 7's battlefield (tankmanBattlefield.hxc + TankmanSpriteGroup.hxc + TankmanSprite.hxc):
//   the tank rolls along the hills behind everyone, the clouds drift, and in Stress the little tankmen run
//   in and get shot by Pico (timed by the song's hidden 'picospeaker' chart, about 1 in 16 of his shots).
(function () {
  const IMG = 'week7/images/';
  G.StageFX = G.StageFX || {};

  G.StageFX.tankmanBattlefield = {
    setup(P) {
      const st = P.stage, W = P.week7 = {};
      W.tank = st.props.find(p => p.name === 'tankRolling');
      // the cloud strip (an FlxTiledSprite 3200 wide, the picture repeats sideways)
      const img = G.A.image(IMG + 'tankClouds.png');
      if (img) {
        const c = W.clouds = new G.Sprite(-1100, 20);
        c.img = img; c.frameW = 3200; c.frameH = img.height; c.resetSize();
        c.scroll.x = c.scroll.y = 0.25; c.zIndex = 12; c.name = 'tankClouds';
        c.drawContent = function (ctx) {
          const im = G.srcImg(this.img);
          for (let x = 0; x < this.frameW; x += im.width) { const w = Math.min(im.width, this.frameW - x); ctx.drawImage(im, 0, 0, w, im.height, x, 0, w, im.height); }
        };
        st.props.push(c);
      }
      // Stress: the running tankmen
      W.runners = [];
      W.stress = P.song.id === 'stress' && P.song.variation !== 'pico';
      if (W.stress) G.A.warmNow([G.A.image(IMG + 'tankmanKilled1.png')]);
      this.reset(P);
    },
    reset(P) {
      const W = P.week7; if (!W) return;
      W.tankAngle = -90 + Math.floor(Math.random() * 136); W.tankSpeed = 5 + Math.random() * 2;
      if (W.clouds) W.clouds.x = -1100;
      this.moveTank(W, 0);
      // throw the old runners away + pick new ones from Pico's shots
      const st = P.stage;
      st.props = st.props.filter(p => !W.runners.includes(p));
      W.runners = []; W.times = [];
      if (!W.stress) return;
      const c = G.Songs.chart(P.song.id, P.song.variation);
      const shots = ((c && c.notes && c.notes.picospeaker) || []).slice().sort((a, b) => a.t - b.t);
      for (const n of shots) if (Math.random() < 1 / 16) W.times.push({ t: n.t, right: !(n.d % 4 === 2 || n.d % 4 === 3) });
    },
    moveTank(W, dt) {
      const t = W.tank; if (!t) return;
      W.tankAngle += dt * W.tankSpeed;
      const r = (W.tankAngle + 180) * Math.PI / 180;
      t.angle = W.tankAngle - 90 + 15;
      t.x = 400 + Math.cos(r) * 1500;
      t.y = 1300 + Math.sin(r) * 1100;
    },
    spawn(P, W, n) {
      const s = new G.Sprite(9999, 200 + 50 + Math.floor(Math.random() * 51)).loadSparrow(IMG + 'tankmanKilled1');
      if (!s.sheet) return;
      s.useAnimOffsets = false;
      s.addAnim('run', 'tankman running', 24, true);
      s.addAnim('shot', 'John Shot ' + (1 + Math.floor(Math.random() * 2)), 24, false);
      s.play('run', true); s.fi = Math.floor(Math.random() * s.cur.n);
      s.offset.x = 44; s.offset.y = 41;                // (setGraphicSize + updateHitbox in the original, then scale 1 again)
      s.flipX = !n.right; s.zIndex = 30; s.name = 'runner';
      s.strumTime = n.t; s.endingOffset = 50 + Math.random() * 150; s.runSpeed = 0.6 + Math.random() * 0.4; s.goingRight = n.right;
      s.flick = -1;
      P.stage.props.push(s); W.runners.push(s);
    },
    update(P, dt) {
      const W = P.week7; if (!W) return;
      this.moveTank(W, dt);
      if (W.clouds) W.clouds.x += 8 * dt;
      if (!W.stress) return;
      const pos = P.songPos;
      // made 3 seconds before they get shot
      while (W.times.length && W.times[0].t <= pos + 3000) this.spawn(P, W, W.times.shift());
      let gone = false;
      for (const s of W.runners) {
        if (s.animName === 'run' && pos >= s.strumTime) { s.play('shot', true); s.offset.x = 300; s.offset.y = 200; }
        if (s.animName === 'run') {
          const k = (pos - s.strumTime) * s.runSpeed;
          s.x = s.goingRight ? (G.W * 0.74 + s.endingOffset) - k : (G.W * 0.02 - s.endingOffset) + k;
        }
        // shot: flicker (0.3s every 0.1s, then 0.3s every 0.05s), then gone
        if (s.animName === 'shot' && s.fi >= 10 && s.flick < 0) s.flick = 0;
        if (s.flick >= 0) {
          s.flick += dt;
          const f = s.flick;
          if (f < 0.3) s.visible = Math.floor(f / 0.1) % 2 === 0;
          else if (f < 0.6) s.visible = Math.floor((f - 0.3) / 0.05) % 2 === 0;
          else { s.dead = true; gone = true; }
        }
      }
      if (gone) { P.stage.props = P.stage.props.filter(p => !p.dead); W.runners = W.runners.filter(s => !s.dead); }
    },
  };
})();
