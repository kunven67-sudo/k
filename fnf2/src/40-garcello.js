// FNF 2 - VS Garcello ("Smoke 'Em Out Struggle"), played like the mod (V-Slice port by Greeny3483):
//   Headache  black screen with the intro text + the city ambience, then the talk
//   Nerves    his weak cough, then the talk; he coughs on set beats in the song (chart events)
//   Release   the cutscene where the smoke gets him (video), wind + a long white flash, then the talk
//   Fading    the talk with his ghost; at beat 60 he waves goodbye and fades away
// The Pico mixes (Nene on the speakers) are on the Erect alley: day, rain + mist, storm + lightning, sunset.
// Art, songs, charts + dialogue come from the mod (tools/own/garcello.py, private build only).
(function () {
  const IMG = 'shared/images/', MUS = 'preload/music/', SND = 'preload/sounds/';
  const AMBIENCE = MUS + 'garbgnoise.ogg';   // the original mod's city_ambience, under every Garcello talk
  const ease = { quadOut: t => 1 - (1 - t) * (1 - t) };
  const talk = (id, opt) => ({ enter(S) { S.black = 0; S.dlg = G.Conversation(id, Object.assign({ music: AMBIENCE, musicVol: 0.8, musicFade: 1 }, opt || {})); } });
  const pico = P => P.song.variation === 'pico';

  // Headache: the intro text on black (8 s), the ambience fading in + out, then the black fades away
  const introText = picoMix => ({
    enter(S) {
      S.black = 0; S.pic = G.A.image(IMG + (picoMix ? 'garIntroPico' : 'garIntroText') + '.png'); S.picA = 0;
      G.audio.music.play(AMBIENCE, { loop: true, vol: 0.6, fadeIn: 1, restart: true });
    },
    dur: 10.25, skippable: true,
    update(S) {
      const t = S.t;
      S.picA = t < 8 ? Math.min(1, t) : 0;
      if (t >= 8 && !S.fadedOut) { S.fadedOut = true; G.audio.music.setVolume(0.0001, 1); }
      // (the step paints its own black under the text; the scene's black, drawn over everything, takes over after)
      S.black = t < 8 ? 0 : t < 8.25 ? 1 : 1 - Math.floor(Math.min(1, (t - 8.25) / 2) * 8) / 8;
    },
    draw(S, ctx) {
      if (S.t >= 8) return;
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      if (!S.pic || S.picA <= 0) return;
      ctx.save(); ctx.globalAlpha = S.picA; ctx.drawImage(G.srcImg(S.pic), 0, 0, G.W, G.H); ctx.restore();
    },
  });

  // Release: the cutscene video on black (it has the sound of it), then wind + a white flash that fades over 5 s
  const releaseVideo = {
    enter(S) {
      S.black = 0; S.white = 0; S.vidBlack = true;   // (the step paints its own black under the video)
      const src = G.A.raw['videos/videos/releasecutvslice.webm'];
      if (!src) { S.vidDone = true; return; }
      const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
      v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
      v.onended = () => { S.vidDone = true; }; v.onerror = () => { S.vidDone = true; };
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { S.vidDone = true; }); });
      S.video = v;
    },
    update(S) {
      if (S.t > 12) S.vidDone = true;   // never stuck on a video that won't play
      if (S.vidDone && !S.flashT) {
        if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; }
        S.flashT = S.t; S.vidBlack = false; S.white = 1; G.sfx(SND + 'Wind_Fadeout.ogg', { vol: 1 });
      }
      if (S.flashT) { S.white = Math.max(0, 1 - (S.t - S.flashT) / 5); if (S.white <= 0) S.go(); }
    },
    draw(S, ctx) {
      if (!S.vidBlack) return;
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const v = S.video;
      if (v && v.readyState >= 2) ctx.drawImage(v, 0, 0, G.W, G.H);
    },
    leave(S) { if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; } },
  };

  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes.headache = { create: P => G.Scene(P, [introText(pico(P)), talk(pico(P) ? 'headache-pico' : 'headache', { continueMusic: true })]) };
  G.Cutscenes.nerves = { create: P => G.Scene(P, [{ enter(S) { G.sfx(SND + 'garWeak.ogg', { vol: 1 }); }, dur: 0 }, talk(pico(P) ? 'nerves-pico' : 'nerves')]) };
  G.Cutscenes.release = { create: P => G.Scene(P, pico(P) ? [talk('release-pico')] : [releaseVideo, talk('release')]) };
  G.Cutscenes.fading = { create: P => G.Scene(P, [talk(pico(P) ? 'fading-pico' : 'fading')]) };

  // ---------------------------------------------------------------- stages
  G.StageFX = G.StageFX || {};
  // AdjustColorShader numbers from each Erect stage script -> the same CSS filters the Erect main stage uses
  const tint = a => `brightness(${(100 + (a.brightness || 0) * 0.9).toFixed(0)}%) contrast(${(100 + (a.contrast || 0)).toFixed(0)}%) saturate(${(100 + (a.saturation || 0)).toFixed(0)}%) hue-rotate(${a.hue || 0}deg)`;
  const tints = (P, t) => { P.charFilter = {}; for (const k in t) P.charFilter[k] = tint(t[k]); };
  const fadeOpponent = (P, black) => { P.garFade = { t: 0, black }; };
  const fadeUpdate = (P, dt) => {
    const F = P.garFade; if (!F) return;
    F.t = Math.min(1, F.t + dt);
    if (P.dad) P.dad.alpha = 1 - F.t; P.iconP2.alpha = 1 - F.t;
  };
  const fadeReset = P => { P.garFade = null; if (P.dad) P.dad.alpha = 1; if (P.iconP2) P.iconP2.alpha = 1; };

  // Fading (BF): at beat 60 Garcello waves goodbye and fades out with his icon
  G.StageFX.strangeAlleyMorning = {
    reset: fadeReset,
    beat(P, b) { if (P.song.id === 'fading' && b === 60 && !P.garFade) { if (P.dad) { P.dad.playAnim('goodbye', false); P.dad._locked = true; } fadeOpponent(P, false); } },
    update: fadeUpdate,
  };
  G.StageFX.strangeAlleyErect = { setup(P) { tints(P, { bf: { brightness: 5, contrast: 7, saturation: 20 }, gf: { hue: -5, contrast: 1, saturation: 20 }, dad: { contrast: 7, saturation: 20 } }); } };
  // Fading (Pico mix): at step 248 he fades away and the screen goes black
  G.StageFX.strangeAlleyErectSunset = {
    setup(P) { tints(P, { bf: { brightness: -10, hue: -5, contrast: 10, saturation: 22 }, gf: { brightness: -10, hue: -5, contrast: 10, saturation: 22 }, dad: { brightness: -10, hue: -15, contrast: 10, saturation: 30 } }); },
    reset: fadeReset, update: fadeUpdate,
    step(P, s) { if (P.song.id === 'fading' && pico(P) && s === 248 && !P.garFade) fadeOpponent(P, true); },
    drawTop(ctx, P) { const F = P.garFade; if (F && F.black) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + F.t.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); } },
  };

  // ---------------------------------------------------------------- rain, mist + lightning
  // RuntimeRainShader in the mod: thin streaks falling a bit sideways, more of them as the song goes on
  function Rain(n) {
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ x: Math.random() * G.W, y: Math.random() * G.H, v: 1400 + Math.random() * 900, l: 18 + Math.random() * 26, a: 0.12 + Math.random() * 0.25 });
    return {
      update(dt) { for (const d of drops) { d.y += d.v * dt; d.x -= d.v * 0.12 * dt; if (d.y > G.H + 40) { d.y = -40 - Math.random() * 80; d.x = Math.random() * (G.W + 120); } if (d.x < -40) d.x += G.W + 80; } },
      draw(ctx, k) {
        const m = Math.round(drops.length * Math.min(1, k)); if (!m) return;
        G.setScreenT(ctx); ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#c8d4e6'; ctx.lineCap = 'round';
        for (let i = 0; i < m; i++) { const d = drops[i]; ctx.globalAlpha = d.a; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.12, d.y - d.l); ctx.stroke(); }
        ctx.restore();
      },
    };
  }
  // FlxBackdrop (repeats sideways) drifting at a set speed, additive + dimmed
  function mist(P, pic, x, y, sf, z, alpha, vx, sc) {
    const img = G.A.image(IMG + 'stages/erect/' + pic + '.png'); if (!img) return null;
    const s = new G.Sprite(x, y); s.img = img; s.frameW = img.width; s.frameH = img.height; s.resetSize();
    s.scale.x = s.scale.y = sc || 1;   // (no updateHitbox: an FlxBackdrop scales around its middle)
    s.scroll.x = s.scroll.y = sf; s.zIndex = z; s.alpha = alpha * 0.36 * 0.45; s.blend = 'lighter';   // (0x5c5c5c tint; toned down to the mod's own screenshots) s.vx = vx; s.name = 'mist';
    s.drawContent = function (ctx) {
      const im = G.srcImg(this.img), w = im.width, x0 = ((this.x % w) + w) % w;
      for (let k = -2; k <= 3; k++) ctx.drawImage(im, -x0 + k * w - this.x, 0);
    };
    P.stage.props.push(s);
    return s;
  }
  const rainBase = (start, end) => ({
    rain(P) { return P.garRain || (P.garRain = Rain(260)); },
    rainUpdate(P, dt) { this.rain(P).update(dt); },
    drawOver(ctx, P) {
      if (G.settings.lowQuality) return;
      const k = P.audio && P.audio.length ? G.clamp(P.songPos / P.audio.length, 0, 1) : 0;
      this.rain(P).draw(ctx, (start + (end - start) * k) / 0.5);
      if (this.cine && P.garCine) { G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, 100); ctx.fillRect(0, G.H - 100, G.W, 100); }
    },
  });
  G.StageFX.strangeAlleyErectRain = Object.assign(rainBase(0.1, 0.3), {
    setup(P) {
      tints(P, { bf: { brightness: -30, hue: 12, contrast: 7, saturation: 3 }, gf: { brightness: -30, hue: -9, contrast: -4 }, dad: { hue: -20, contrast: -13, saturation: 5 } });
      P.garMist = [
        mist(P, 'mistMid', -650, -100, 1.2, 2000, 0.6, 172), mist(P, 'mistMid', -650, -100, 1.1, 2000, 0.6, 150),
        mist(P, 'mistBack', -650, -100, 1.2, 2001, 0.8, -80), mist(P, 'mistMid', -650, -100, 0.95, 900, 0.5, -50, 0.8),
        mist(P, 'mistBack', -650, -100, 0.8, 800, 1, 40, 0.7), mist(P, 'mistMid', -650, -100, 0.5, 700, 1, 20, 1.1),
      ].filter(Boolean);
    },
    update(P, dt) { this.rainUpdate(P, dt); for (const m of P.garMist || []) m.x += m.vx * dt; },
  });
  // the storm: rain, lightning now and then (thunder + white flash + everyone flinches), cinematic bars in Release Erect
  G.StageFX.strangeAlleyErectStorming = Object.assign(rainBase(0.3, 0.5), {
    cine: true,
    setup(P) {
      tints(P, { bf: { brightness: -23, hue: 12, contrast: 7 }, gf: { brightness: -30, hue: -9, contrast: -4 }, dad: { hue: -20, contrast: -23, saturation: 5 } });
      const sm = P.stage.props.find(p => p.name === 'smokey'); if (sm) sm.blend = 'lighter';
    },
    reset(P) { P.garBolt = { beat: 0, off: 8 }; P.garCine = false; this.cinematics(P, false); },
    update(P, dt) { this.rainUpdate(P, dt); },
    strike(P, sound, beat) {
      if (sound) G.sfx(SND + (Math.random() < 0.5 ? 'thunder_1' : 'thunder_2') + '.ogg', { vol: 1 });
      if (G.settings.flashing !== false) P.cam.flash('#ffffff', 0.5);
      P.garBolt = { beat, off: 8 + Math.floor(Math.random() * 17) };
      for (const c of [P.bf, P.gf]) if (c && c.hasAnim && c.hasAnim('scared')) c.playAnim('scared', true);
    },
    beat(P, b) {
      if (!P.garBolt) this.reset(P);
      if (b === 4 && P.song.id === 'release') this.strike(P, false, b);
      if (Math.random() < 0.1 && b > P.garBolt.beat + P.garBolt.off) this.strike(P, true, b);
    },
    step(P, s) {
      const erect = P.song.id === 'release' && P.song.variation === 'erect';
      // (the mod's check flashes on these steps in every song here, 879 only in the Erect mix)
      if ((s === 287 || s === 292 || s === 296 || s === 300 || (s === 879 && erect)) && G.settings.flashing !== false) P.cam.flash('#ffffff', 0.2);
      if (!erect) return;
      if (s === 398 || s === 1103) { G.sfx(SND + 'thunder_1.ogg', { vol: 1 }); this.strike(P, false, Math.floor(s / 4)); this.cinematics(P, true); }
      if (s === 465 || s === 1215) { G.sfx(SND + 'thunder_1.ogg', { vol: 1 }); this.strike(P, false, Math.floor(s / 4)); this.cinematics(P, false); }
    },
    // cinematic bars: the arrows move down a bit, score + health bar + icons hide
    cinematics(P, on) {
      P.garCine = on; P.hideHealth = on;
      P.strumShift = on && !P.down ? 50 : 0;
    },
  });
})();
