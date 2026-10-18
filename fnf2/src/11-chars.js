// FNF 2 - character scripts: the extra behaviour some FNF characters get from their
// .hxc scripts (preload/scripts/characters). Each script can hook:
//   init(ch)            after the character is built
//   attach(ch, stage)   after it's placed on a stage (add extra sprites with stage.addExtra)
//   dance(ch, force)    replaces the normal dance
//   tick(ch, dt)        every frame (ch.playHealth = the player's health, 0..2)
//   onEvent(ch, kind, value)  song events (FocusCamera ...)
G.CharScripts = {};

// ------------------------------------------------------------------ Nene + A-Bot (nene.hxc)
(function () {
  const VULTURE = 0.25 * 2;          // at this health Nene raises her knife
  const ABOT = 'shared/images/characters/abot/';
  // per-bar x/y steps of the 7 visualizer bars (ABotVis)
  const VX = [0, 59, 56, 66, 54, 52, 51], VY = [0, -8, -3.5, -0.4, 0.5, 4.7, 7];
  // a texture-atlas sprite whose main timeline we drive by hand
  function atlasSprite(path) {
    const s = new G.Sprite(0, 0).loadAtlas(path);
    if (s.atlas) { s.addAnim('all', s.atlas.main.name, 24, false); s.play('all', true); s.paused = true; }
    return s;
  }
  // FFT levels for the 7 bars (funkin.vis SpectralAnalyzer: 7 bars, -65..-25 dB, 10..22000 Hz)
  let bins = null;
  function levels(state) {
    const an = state.an || (G.audio && G.audio.analyser);     // (state.an: the character select's menu music)
    const out = state.levels || (state.levels = new Array(7).fill(0));
    if (!an || (!state.an && !G.audio.songPlaying)) { for (let i = 0; i < 7; i++) out[i] = Math.max(0, out[i] - 0.1); return out; }
    if (!bins || bins.length !== an.frequencyBinCount) bins = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(bins);
    const hz = G.audio.ctx.sampleRate / an.fftSize, lo = Math.log(10), hi = Math.log(22000);
    for (let b = 0; b < 7; b++) {
      const f0 = Math.exp(lo + (hi - lo) * b / 7), f1 = Math.exp(lo + (hi - lo) * (b + 1) / 7);
      let db = -Infinity;
      for (let k = Math.max(1, Math.floor(f0 / hz)); k <= Math.min(bins.length - 1, Math.ceil(f1 / hz)); k++) if (bins[k] > db) db = bins[k];
      const target = G.clamp((db + (state.an ? 72 : 65)) / 40, 0, 1);   // (menu music is measured after the volume knobs)
      // bars move at most 0.1 per frame, like the original analyzer's maxDelta
      out[b] += G.clamp(target - out[b], -0.1, 0.1);
    }
    return out;
  }

  G.CharScripts.nene = {
    init(ch) {
      ch.nene = { state: 'DEFAULT', pupil: 'RIGHT', blink: 3, danced: false };
      const N = ch.nene;
      N.abot = atlasSprite(ABOT + 'abotSystem');
      N.eyes = atlasSprite(ABOT + 'systemEyes');
      N.whites = new G.Sprite(0, 0).makeSolid(160, 60, '#FFFFFF');
      N.stereo = new G.Sprite(0, 0).loadImage(ABOT + 'stereoBG.png');
      N.viz = [];
      let px = 0, py = 0;
      for (let i = 1; i <= 7; i++) {
        px += VX[i - 1]; py += VY[i - 1];
        const v = new G.Sprite(0, 0).loadSparrow(ABOT + 'aBotViz');
        v.addAnim('viz', 'viz' + i + '0', 0, false); v.play('viz', true); v.paused = true; v.fi = 1;
        v.bx = px; v.by = py; v.visible = false;
        N.viz.push(v);
      }
      // the bars draw as one group
      N.vizGroup = { zIndex: 0, scroll: { x: 1, y: 1 }, update() {}, draw(ctx, cam) { for (const v of N.viz) v.draw(ctx, cam); } };
    },
    attach(ch, stage) {
      const N = ch.nene;
      const ax = ch.x - 95 + ch.globalOffsets[0] * ch.scale.x, ay = ch.y + 384 + ch.globalOffsets[1] * ch.scale.y;
      const put = (s, x, y, z) => { s.x = x; s.y = y; s.zIndex = z; s.scroll.x = ch.scroll.x; s.scroll.y = ch.scroll.y; stage.addExtra(s, ch); };
      const z = ch.zIndex - 10;
      put(N.abot, ax, ay, z);
      N.vizGroup.zIndex = z - 1; stage.addExtra(N.vizGroup, ch);
      for (const v of N.viz) { v.x = ax + 207 + v.bx; v.y = ay + 84 + v.by; }
      put(N.whites, ax + 40, ay + 250, z - 10);
      put(N.eyes, ax + 50, ay + 238, z - 10 + 5);
      put(N.stereo, ax + 150, ay + 30, z - 8);
    },
    dance(ch, force) {
      const N = ch.nene;
      // A-Bot bumps on every dance (frame 1 on: frame 0 is a still frame)
      if (N.abot.atlas) { N.abot.play('all', true); N.abot.fi = 1; N.abot.paused = false; }
      // let a combo cheer / laugh finish
      if (!force && ['combo50', 'drop70', 'combo200'].includes(ch.animName) && !ch.finished) return;
      switch (N.state) {
        case 'DEFAULT': ch.play(N.danced ? 'danceRight' : 'danceLeft', force); N.danced = !N.danced; break;
        case 'PRE_RAISE': if (ch.animName !== 'danceLeft') ch.play('danceLeft', false); N.danced = false; break;
        case 'READY':
          if (N.blink === 0) { ch.play('idleKnife', true); N.blink = 3 + Math.floor(Math.random() * 5); } else N.blink--;
          break;
        case 'LOWER': if (ch.animName !== 'lowerKnife') ch.play('lowerKnife', true); break;
        default: break;
      }
    },
    tick(ch, dt) {
      const N = ch.nene, hp = ch.playHealth != null ? ch.playHealth : 1;
      N.abot.update(dt);
      // pupils: slide between "looking left" (frame 17) and "looking right" (frame 30)
      if (N.eyes.atlas && N.eyes.moving) {
        N.eyes.paused = false; N.eyes.update(dt); N.eyes.paused = true;
        if (N.pupil === 'RIGHT' && N.eyes.fi >= 17) { N.pupil = 'LEFT'; N.eyes.moving = false; N.eyes.fi = 17; }
        else if (N.pupil === 'LEFT' && N.eyes.fi >= 30) { N.pupil = 'RIGHT'; N.eyes.moving = false; N.eyes.fi = 30; }
      }
      // visualizer bars (frame 5 = smallest, 0 = tallest)
      const lv = levels(N), muted = !G.settings.vol || G.settings.vol.master === 0 || G.settings.vol.music === 0;
      N.viz.forEach((v, i) => {
        let f = muted ? 0 : Math.round(lv[i] * 6);
        v.visible = f > 0;
        f = Math.max(0, Math.min(5, f - 1));
        v.fi = Math.min(v.cur ? v.cur.n - 1 : 0, 5 - f);
      });
      // knife state machine
      const fin = ch.finished;
      switch (N.state) {
        case 'DEFAULT': if (hp <= VULTURE) N.state = 'PRE_RAISE'; break;
        case 'PRE_RAISE':
          if (hp > VULTURE) N.state = 'DEFAULT';
          else if (ch.animName === 'danceLeft' && ch.fi >= 13) { N.state = 'RAISE'; ch.play('raiseKnife', true); }
          else if (fin && ch.animName !== 'danceLeft') ch.play('danceLeft', true);
          break;
        case 'RAISE': if (ch.animName === 'raiseKnife' && fin) N.state = 'READY'; break;
        case 'READY': if (hp > VULTURE) N.state = 'LOWER'; break;
        case 'LOWER': if (ch.animName === 'lowerKnife' && fin) { N.state = 'DEFAULT'; N.danced = false; } break;
      }
    },
    onEvent(ch, kind, v) {
      if (kind !== 'FocusCamera') return;
      let c = v != null && typeof v === 'object' ? v.char : v; c = +c;
      const N = ch.nene; if (!N.eyes.atlas) return;
      if (c === 0) { N.eyes.play('all', true); N.eyes.fi = 17; N.pupil = 'LEFT'; N.eyes.moving = true; N.eyes.paused = true; }       // look right at the player
      else if (c === 1) { N.eyes.play('all', true); N.eyes.fi = 0; N.pupil = 'RIGHT'; N.eyes.moving = true; N.eyes.paused = true; } // look left at the opponent
    },
  };
})();
