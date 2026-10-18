// ---------- legends: the god on the mountain, the god in your dreams, the hungry empress and her eye ----------
// (their names come from tools/names-*.sed at build time)
const EYE_NAMES = { foresight: 'Demon Eye of Foresight', clairvoyance: 'Demon Eye of Clairvoyance' };
const legend = { met: 0, warned: 0, emp: { fed: 0, met: 0, angry: 0 }, dreams: 0, advice: null };
try { Object.assign(legend, JSON.parse(localStorage.getItem('ironblood.legend') || '{}')); } catch (e) {}
function saveLegend() { try { localStorage.setItem('ironblood.legend', JSON.stringify(legend)); } catch (e) {} }

// ---- a story box at the bottom of the screen, with choices ----
const saga = (() => {
  let el = null, typing = null, onDone = null;
  function ensure() {
    if (el) return;
    el = document.createElement('div'); el.id = 'saga';
    el.innerHTML = '<div class="sn"></div><div class="st"></div><div class="sc"></div>';
    document.body.appendChild(el);
    const css = document.createElement('style');
    css.textContent = `#saga { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); width: min(760px, calc(100% - 32px)); background: rgba(8,8,10,.86); border: 1px solid rgba(226,199,122,.28); border-radius: 8px; padding: 14px 18px 12px; display: none; pointer-events: auto; z-index: 5; }
      #saga .sn { font-family: Cinzel, serif; font-weight: 800; font-size: 16px; color: #e2c77a; letter-spacing: .06em; }
      #saga .st { font-family: Cinzel, serif; font-size: 17px; line-height: 1.5; margin: 6px 0 10px; min-height: 26px; }
      #saga .sc { display: flex; flex-wrap: wrap; gap: 8px; }
      #saga .sc button { cursor: pointer; font-size: 13px; font-weight: 700; color: #1a0f06; background: #d9c99c; border: 0; border-radius: 4px; padding: 7px 12px; }
      #saga .sc button.ghost { background: transparent; color: #e8e2d6; border: 1px solid rgba(255,255,255,.3); }
      #saga.dream { background: rgba(255,255,255,.75); border-color: rgba(0,0,0,.15); color: #222; }
      #saga.dream .sn { color: #6a5a90; } #saga.dream .st { color: #222; }
      #dreamFx { position: absolute; inset: 0; display: none; z-index: 4; pointer-events: none; }
      .ghostT { position: absolute; transform: translate(-50%, -100%); color: #dcbcff; font: 700 11px system-ui, sans-serif; letter-spacing: .04em; text-shadow: 0 1px 3px #000, 0 0 8px rgba(160,80,255,.6); white-space: nowrap; }`;
    document.head.appendChild(css);
  }
  // say(name, text, choices[{t, fn, ghost}], { voice:{pos,pitch,female}, dream })
  function say(name, text, choices = [{ t: '...', fn: null }], o = {}) {
    ensure();
    el.style.display = 'block'; el.classList.toggle('dream', !!o.dream);
    el.querySelector('.sn').textContent = name;
    const st = el.querySelector('.st'), sc = el.querySelector('.sc');
    sc.innerHTML = ''; st.textContent = '';
    clearInterval(typing);
    let i = 0;
    typing = setInterval(() => { i += 2; st.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typing); showChoices(); } }, 28);
    const showChoices = () => {
      sc.innerHTML = '';
      choices.forEach((c) => { const b = document.createElement('button'); b.textContent = c.t; if (c.ghost) b.className = 'ghost'; b.onclick = () => { sfx.ui(520); if (c.fn) c.fn(); else close(); }; sc.appendChild(b); });
    };
    st.onclick = () => { if (i < text.length) { i = text.length; st.textContent = text; clearInterval(typing); showChoices(); } };
    if (o.voice && ac) sfx.murmur(o.voice.pos, text, o.voice.pitch || 1, !!o.voice.female);
    uiOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function close() { if (!el) return; el.style.display = 'none'; clearInterval(typing); uiOpen = false; if (!legendBusy) cutscene = false; if (!cutscene && player.alive) requestLock(); if (onDone) { const f = onDone; onDone = null; f(); } }
  return { say, close, ensure, get open() { return el && el.style.display === 'block'; } };
})();
addEventListener('keydown', (e) => { if (e.code === 'Escape' && saga.open && !legendBusy) saga.close(); });
let legendBusy = false;

// ---- the mountain: a ledge high on the north peaks where the silver-haired man stands ----
const LEDGE = (() => {
  let best = null, bs = -1e9;
  for (let x = -170; x <= -60; x += 5) for (let z = -290; z <= -215; z += 5) {
    const h = terrainH(x, z), s = slopeAt(x, z);
    const score = -Math.abs(h - 105) * 0.6 - s * 30 - Math.abs(x + 110) * 0.05;
    if (score > bs) { bs = score; best = { x, z, y: h }; }
  }
  return best;
})();
const ledges = [];
{
  // a slab of rock to stand on, and stone cairns up the slope to show the way
  const L = LEDGE, R = 5.5;
  let top = -1e9; for (let a = 0; a < 6.28; a += 0.5) top = Math.max(top, terrainH(L.x + Math.cos(a) * R * 0.7, L.z + Math.sin(a) * R * 0.7));
  top += 0.15;
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.15, 4, 18, 2), rockMat);
  { const p = slab.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = vnoise(v.x * 0.8 + 3, v.z * 0.8) * 0.5; p.setXYZ(i, v.x * (1 + n * 0.15), v.y > 1.9 ? v.y + n * 0.06 : v.y + n * 0.6, v.z * (1 + n * 0.15)); } slab.geometry.computeVertexNormals(); }
  slab.position.set(L.x, top - 2, L.z); slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  ledges.push({ x: L.x, z: L.z, r2: (R - 0.3) ** 2, y: top });
  circles.push({ x: L.x, z: L.z, r: 0.01 });
  L.top = top;
  // cairns from the north road up to the ledge
  const from = { x: 6, z: -175 }, n = Math.ceil(Math.hypot(L.x - from.x, L.z - from.z) / 14);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = lerp(from.x, L.x, t) + Math.sin(i * 1.7) * 4, z = lerp(from.z, L.z, t) + Math.cos(i * 1.3) * 3, y = terrainH(x, z);
    for (let k = 0; k < 4; k++) { const s = 0.32 - k * 0.06, m = new THREE.Mesh(rockGeo, rockMat); m.scale.set(s, s * 0.45, s * 0.9); m.position.set(x + (Math.random() - 0.5) * 0.06, y + 0.08 + k * 0.17, z); m.rotation.y = Math.random() * 6; m.castShadow = true; scene.add(m); }
  }
}
const groundH1 = groundH;
groundH = function (x, z) { const h = groundH1(x, z); for (const l of ledges) if ((x - l.x) ** 2 + (z - l.z) ** 2 < l.r2) return Math.max(h, l.y); return h; };

// ---- the Dragon God ----
let dragon = null, dragonCurseT = 0, dragonTalkT = 0;
function spawnDragon() {
  const f = new Fighter({ tier: 4, team: 'god', outfit: { sex: 'm', dress: true, top: 0xa9a69f, legs: 0x1a1a1e, hood: true, hoodColor: 0x9d9a93, cloak: true, belt: true, face: 'dragon', boots: 0x161616 }, body: 0xd8d4cc, sword: null, scale: 1.07, name: '@@DRAGON@@' });
  f.invuln = true; f.voicePitch = 0.68; f.legend = 'dragon';
  f.pos.set(LEDGE.x + 1.2, LEDGE.top, LEDGE.z + 1.5);
  f.facing = Math.PI * 0.95; // looking south over the valley
  f.root.rotation.y = f.facing;
  addHairBangs(f, 0xd9dde4, 0.9);
  goldEyes(f, 0xffc23a);
  f.onMagic = () => { if (!legendBusy && player.alive) dragonKill(Math.random() < 0.5 ? 'hand' : 'tap', 'You raised a hand against me.'); };
  dragon = f;
}
// hair falling out of the hood: thin curved ribbons of strands, thicker at the root
function strandGeo(L, w, bend, twist) {
  const n = 6, pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, y = -t * L, z = Math.sin(t * Math.PI * 0.6) * bend, x = Math.sin(t * 2.2) * twist;
    const hw = w * (1 - t * 0.85) * 0.5;
    pos.push(x - hw, y, z, x + hw, y, z); uv.push(0, t, 1, t);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const hairTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), r = mulberry32(8);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 70; i++) { const x = r() * 64, sh = 150 + r() * 105; g.strokeStyle = `rgb(${sh},${sh},${sh})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 6, 40, x + (r() - 0.5) * 6, 90, x + (r() - 0.5) * 8, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function addHairBangs(f, color, len) {
  const face = f.armor.face; if (!face) return;
  const mat = new THREE.MeshStandardMaterial({ color, map: hairTex, roughness: 0.38, metalness: 0.1, side: THREE.DoubleSide });
  const g = new THREE.Group(), r = mulberry32(color & 0xffff);
  // the fringe over the forehead
  for (let i = 0; i < 22; i++) {
    const x = -0.072 + i * 0.0068 + (r() - 0.5) * 0.004;
    const L = (0.055 + r() * 0.05) * len * (1 - Math.abs(x) * 2.2);
    const m = new THREE.Mesh(strandGeo(L, 0.012 + r() * 0.006, 0.012 + r() * 0.01, (r() - 0.5) * 0.008), mat);
    m.position.set(x, 0.072 - Math.abs(x) * 0.12, 0.03 - x * x * 7);
    m.rotation.set(-0.15 - r() * 0.15, x * -1.2, x * 1.4 + (r() - 0.5) * 0.2);
    g.add(m);
  }
  // locks falling past the cheeks
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const L = (0.12 + r() * 0.06) * len;
    const m = new THREE.Mesh(strandGeo(L, 0.016, 0.01, s * 0.006), mat);
    m.position.set(s * (0.064 + k * 0.004), 0.06 - k * 0.006, 0.012 - k * 0.012);
    m.rotation.set(-0.08, s * 0.5, s * (0.08 + k * 0.03));
    g.add(m);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.armor = true; } });
  face.add(g);
}
// glowing eyes for things that are not quite human
function goldEyes(f, color) {
  const face = f.armor.face; if (!face) return;
  // the loader splits the eyes into one mesh per material: find the one painted with the iris
  face.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const out = ms.map(mm => { if (mm.name !== 'eye') return mm; const m = mm.clone(); m.emissive = new THREE.Color(color); m.emissiveMap = m.map; m.emissiveIntensity = 1.4; m.color.set(color).lerp(new THREE.Color(0xffffff), 0.35); return m; });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
function updateDragon(dt) {
  if (!dragon) return;
  const f = dragon, P = player;
  // he stays where he is; he only turns his head toward you
  f.pos.y = groundH(f.pos.x, f.pos.z);
  f.speed = 0; f.vel.set(0, 0, 0);
  const d = P.pos.distanceTo(f.pos);
  if (d < 9 && P.alive) { const want = Math.atan2(P.pos.x - f.pos.x, P.pos.z - f.pos.z); f.facing = angleLerp(f.facing, want, dt * 0.8); f.root.rotation.y = f.facing; }
  // the curse: everyone who sees him is filled with dread
  if (d < 16 && P.alive && !legendBusy) {
    dragonCurseT -= dt;
    if (dragonCurseT <= 0) { dragonCurseT = 0.7 + d / 20; sfx.heartbeat(); }
    shake(Math.max(0, (16 - d) / 16) * 0.04);
    const tint = document.getElementById('legendTint');
    tint.style.background = 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.75) 100%)';
    tint.style.opacity = Math.min(0.85, (16 - d) / 12);
    if (!legend.warned) { legend.warned = 1; saveLegend(); ui.sub('Every part of your body is screaming at you to run.', 4.5); }
    f.cursed = true;
  } else if (!legendBusy && f.cursed) { document.getElementById('legendTint').style.opacity = 0; f.cursed = false; }
  // you attacked him
  if (P.alive && !legendBusy && P.attack && d < 2.6 && P.attack.t > P.attack.dur * 0.3) dragonKill('catch', '');
}
function talkDragon() {
  const f = dragon;
  if (dragonTalkT > clockNow) return;
  if (legend.met >= 2) { dragonKill(Math.random() < 0.5 ? 'hand' : 'tap', 'I told you not to speak to me.'); return; }
  cutscene = true;
  f.facing = Math.atan2(player.pos.x - f.pos.x, player.pos.z - f.pos.z); f.root.rotation.y = f.facing;
  const v = { pos: f.pos, pitch: 0.62 };
  saga.say('Silver-haired man', '......', [{ t: '...', fn: () => {
    saga.say('Silver-haired man', 'Do you know the @@MANGOD@@?', [
      { t: 'Yes.', fn: () => { saga.close(); dragonKill('hand', 'Then die.'); } },
      { t: 'No.', fn: () => answerNo() },
      { t: 'Who is that?', fn: () => answerNo() },
    ], { voice: v });
  } }], { voice: v });
  function answerNo() {
    if (magic.manGod) { saga.close(); dragonKill('tap', 'You lie. I can smell him on you.'); return; }
    saga.say('Silver-haired man', '...No. You really don\'t.', [{ t: '...', fn: () => {
      legend.met = Math.max(legend.met, 1); saveLegend();
      saga.say('@@DRAGON@@', 'Then you are nothing to me. Leave this mountain, and do not speak to me again.', [{ t: 'Walk away', fn: () => { legend.met = 2; saveLegend(); saga.close(); cutscene = false; dragonTalkT = clockNow + 3; } }], { voice: v });
    } }], { voice: v });
  }
}
// blink, and it's over
function dragonKill(kind, line) {
  if (legendBusy || !player.alive) return;
  legendBusy = true; cutscene = true; uiOpen = false;
  saga.close(); cutscene = true;
  cast.on = false; ui.chant(false);
  const f = dragon, P = player;
  P.attack = null; P.blocking = false; P.castAim = null; lockTarget = null;
  const start = f.pos.clone();
  // afterimage where he was
  for (let i = 0; i < 40; i++) mfx.emit(false, 4, start.x + (Math.random() - 0.5) * 0.6, start.y + Math.random() * 1.9, start.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.5, 0.5, 1.2, 0.85, 0.85, 0.85, 0.5);
  sfx.swing(start, 3, 2);
  const fwd = new THREE.Vector3(Math.sin(P.facing), 0, Math.cos(P.facing));
  f.pos.copy(P.pos).addScaledVector(fwd, kind === 'tap' ? 0.62 : 0.55); f.pos.y = groundH(f.pos.x, f.pos.z);
  f.facing = Math.atan2(P.pos.x - f.pos.x, P.pos.z - f.pos.z); f.root.rotation.y = f.facing;
  slowmo = 0.3; slowmoT = 3.5;
  const side = new THREE.Vector3(Math.cos(P.facing), 0, -Math.sin(P.facing));
  const mid = P.pos.clone().lerp(f.pos, 0.5); mid.y += 1.35;
  sceneCam = { pos: mid.clone().addScaledVector(side, 2.4).add(new THREE.Vector3(0, 0.15, 0)), look: mid.clone() };
  if (line) { ui.sub('@@DRAGON_SHORT@@: "' + line + '"', 3); sfx.murmur(f.pos, line, 0.62); }
  const chest = () => P.b.Spine2.getWorldPosition(new THREE.Vector3());
  let t = 0;
  const back = fwd.clone().negate();
  legendScene = (dt) => {
    t += dt * (slowmoT > 0 ? 0.6 : 1);
    if (kind === 'tap' || kind === 'catch') {
      // two fingers touch your chest
      const c = chest().addScaledVector(fwd, -0.12);
      f.castAim = c;
      if (kind === 'catch' && t < 0.3 && P.swordMesh) { P.swordMesh.position.lerp(f.b.LeftHand.getWorldPosition(new THREE.Vector3()), 0.3); }
      if (t > 0.35 && !f._tapped) { f._tapped = true; sfx.thud(c, 1.6); mfx.burst.glow(c.x, c.y, c.z, 0.6, 1.5, 1.5, 1.5, 0.3); shake(0.6); mfx.emit(true, 3, c.x, c.y, c.z, 0, 0, 0, 0.5, 0.2, 1.5, 1.5, 1.5, 1.5, 0.8); P.stagger = 3; }
      if (t > 1.3 && !f._cough) { f._cough = true; coughBlood(P); sfx.voice(P.pos, 'death', P.voicePitch); }
      if (t > 1.9) return finish();
    } else {
      // his hand goes straight through you
      const c = chest();
      f.castAim = null;
      const through = t > 0.25;
      f.noArms = true;
      f.root.updateMatrixWorld(true);
      solveArm(f.b.RightArm, f.b.RightForeArm, f.b.RightHand, through ? c.clone().addScaledVector(back, 0.32) : c.clone().addScaledVector(fwd, -0.2), new THREE.Vector3(0, -1, 0));
      if (through && !f._hit) {
        f._hit = true; sfx.stab(c); sfx.crack(c); shake(1);
        if (settings.gore > 0) { gore.blood(c.clone().addScaledVector(back, 0.25), back, 120, 5); gore.blood(c, fwd, 30, 2); for (let i = 0; i < 3; i++) gore.stain(c.x + back.x * (1 + i * 0.4), groundH(c.x, c.z) + 0.015, c.z + back.z * (1 + i * 0.4), 0.6); }
        P.blood = Math.max(P.blood, 0.45); P.stagger = 3;
        sfx.voice(P.pos, 'scream', P.voicePitch);
      }
      if (t > 1.0 && !f._pull) {
        f._pull = true;
        if (settings.gore >= 2) {
          // and comes back out holding your heart
          const h = new THREE.Mesh(organGeo('heart'), ORGAN_MATS.heart);
          f.b.RightHand.getWorldPosition(h.position); scene.add(h); h.updateMatrixWorld(true);
          f.b.RightHand.attach(h); f._heart = h;
        }
        gore.blood(c, fwd, 50, 2.5);
      }
      if (t > 1.0) solveArm(f.b.RightArm, f.b.RightForeArm, f.b.RightHand, c.clone().addScaledVector(fwd, -0.55).add(new THREE.Vector3(0, 0.1, 0)), new THREE.Vector3(0, -1, 0));
      if (t > 1.5 && !f._cough) { f._cough = true; coughBlood(P); }
      if (t > 2.3) return finish();
    }
  };
  function finish() {
    legendScene = null;
    if (P.alive) { P.lastHitBy = f; P.hp = 0; P.die({ from: f, part: 'chest', noBlood: true }, 'heart torn out'); }
    setTimeout(() => { document.getElementById('legendTint').style.opacity = 0; f.cursed = false; sceneCam = null; cutscene = false; legendBusy = false; f.noArms = false; f.castAim = null; f._tapped = f._cough = f._hit = f._pull = false; if (f._heart) { f._heart.parent.remove(f._heart); f._heart = null; } f.pos.copy(start); f.facing = Math.PI * 0.95; f.root.rotation.y = f.facing; }, 2200);
  }
}
let legendScene = null;
function coughBlood(P) {
  const head = P.b.Head.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(Math.sin(P.facing), -0.2, Math.cos(P.facing));
  if (settings.gore > 0) { gore.blood(head.clone().addScaledVector(fwd, 0.12), fwd, 60, 2.2); gore.stain(head.x + fwd.x * 0.8, groundH(head.x, head.z) + 0.015, head.z + fwd.z * 0.8, 0.5); }
  sfx.voice(P.pos, 'hurt', P.voicePitch * 0.9);
}

// ---- the god who smiles in your dreams ----
function dreamFx(on) {
  let d = document.getElementById('dreamFx');
  if (!d) {
    d = document.createElement('div'); d.id = 'dreamFx';
    d.innerHTML = '<canvas id="dreamCv" style="width:100%;height:100%"></canvas>';
    document.body.appendChild(d);
  }
  d.style.display = on ? 'block' : 'none';
  if (!on) { cancelAnimationFrame(dreamRaf); return; }
  const cv = document.getElementById('dreamCv'); cv.width = innerWidth; cv.height = innerHeight;
  const g = cv.getContext('2d');
  // a blank white world and a figure you can never quite see: a shifting mosaic of a person
  const shape = (x, y) => { const head = Math.hypot(x, (y + 0.62) * 1.05) < 0.17; const body = Math.abs(x) < 0.22 - Math.max(0, y) * 0.05 && y > -0.45 && y < 0.62; const arms = Math.abs(x) < 0.34 && y > -0.38 && y < 0.15 && Math.abs(x) > 0.18; const legs = y > 0.55 && y < 1.1 && Math.abs(Math.abs(x) - 0.09) < 0.07; return head || body || arms || legs; };
  const loop = (t) => {
    const W = cv.width, H = cv.height;
    const gr = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9dce4'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const s = H * 0.42, cx = W / 2, cy = H * 0.42, B = Math.max(10, Math.round(H / 34));
    for (let y = -1; y < 1.2; y += B / s) for (let x = -0.5; x < 0.5; x += B / s) {
      if (!shape(x + Math.sin(t * 0.001 + y * 3) * 0.01, y)) continue;
      const n = (Math.sin(x * 40 + t * 0.003) + Math.cos(y * 33 - t * 0.002) + Math.sin((x + y) * 20 + t * 0.004)) / 3;
      const c = Math.round(140 + n * 70);
      g.fillStyle = `rgb(${c},${c - 6},${c + 10})`;
      g.fillRect(Math.round(cx + x * s), Math.round(cy + y * s), B - 1, B - 1);
    }
    dreamRaf = requestAnimationFrame(loop);
  };
  dreamRaf = requestAnimationFrame(loop);
}
let dreamRaf = 0;
// sleeping may bring a visitor
function maybeDream(done) {
  const first = !legend.dreams && magic.max >= 25;
  const again = legend.dreams && Math.random() < (magic.manGod ? 0.4 : 0.18);
  if (!first && !again) return done();
  legend.dreams++; saveLegend();
  dreamFx(true);
  const V = { pos: null, pitch: 1.35 };
  const end = () => { saga.close(); dreamFx(false); done(); };
  const advice = () => {
    // his advice is real: there really is something waiting where he says
    const spot = adviceSpot();
    legend.advice = spot; saveLegend();
    placeAdvice(spot);
    magic.manGod = (magic.manGod || 0) + 1; saveMagic(true);
    saga.say('@@MANGOD_NAME@@', 'Listen well! Tomorrow, go to ' + spot.where + '. Someone died there with ' + (spot.book ? 'a book of ' + SPELL[spot.book].name : 'a fat purse of gold') + '. It is yours! See? I only want to help you.', [{ t: 'Wake up', fn: end }], { voice: V, dream: true });
  };
  if (!magic.manGod) {
    saga.say('???', 'Hello there! Don\'t be scared. This is a dream, you know.', [{ t: 'Who are you?', fn: () => {
      saga.say('@@MANGOD_NAME@@', 'Me? I am the @@MANGOD@@. I like to help people like you. Will you listen to my advice?', [
        { t: 'I\'ll listen.', fn: advice },
        { t: 'What do you want from me?', fn: () => saga.say('@@MANGOD_NAME@@', 'Nothing at all! Isn\'t that nice? So... will you listen?', [{ t: 'I\'ll listen.', fn: advice }, { t: 'No. I don\'t trust you.', fn: refuse }], { voice: V, dream: true }) },
        { t: 'No. I don\'t trust you.', fn: refuse },
      ], { voice: V, dream: true });
    } }], { voice: V, dream: true });
  } else {
    saga.say('@@MANGOD_NAME@@', 'Hello again, my friend! I have more good advice for you. Will you listen?', [{ t: 'Tell me.', fn: advice }, { t: 'Leave me alone.', fn: refuse }], { voice: V, dream: true });
  }
  function refuse() { saga.say('@@MANGOD_NAME@@', 'Aww. That\'s a shame. Well... I\'ll be around.', [{ t: 'Wake up', fn: end }], { voice: V, dream: true }); }
}
const ADVICE_SPOTS = [
  { where: 'the ruins on the eastern battlefield', x: () => BATTLE_X + 40, z: () => 30 },
  { where: 'the bridge on the north road, by the river bank', x: () => BRIDGE.x + 14, z: () => BRIDGE.z + 9 },
  { where: 'the foot of the castle hill', x: () => CASTLE.x + 52, z: () => CASTLE.z + 20 },
  { where: 'the edge of the pine forest to the west', x: () => -150, z: () => 10 },
];
function adviceSpot() {
  const s = ADVICE_SPOTS[Math.floor(Math.random() * ADVICE_SPOTS.length)];
  const unknown = SPELLS.filter(sp => !magic.known.includes(sp.id) && sp.rank <= 2 && !magic.books.includes(sp.id));
  const book = Math.random() < 0.65 && unknown.length ? unknown[Math.floor(Math.random() * unknown.length)].id : null;
  return { where: s.where, x: s.x(), z: s.z(), book };
}
function placeAdvice(spot) {
  let x = spot.x, z = spot.z;
  for (let i = 0; i < 20 && (solidAt(x, z, 1) || riverDist(x, z) < 12); i++) { x += 3; z += 2; }
  const camp = CAMPS[Math.floor(Math.random() * CAMPS.length)];
  const f = spawnMage(camp, { x, z }, 1);
  camp.members = camp.members.filter(m => m !== f);
  f.pos.set(x, groundH(x, z), z);
  f.fallDir = -1; f.fallT = 1; f.ai = null; f.keep = true; f.alive = false; f.down = true;
  f.mage.circle.visible = false; if (f.staff) { scene.remove(f.staff); f.staffDropped = true; }
  f.book = spot.book; f.purse = spot.book ? 20 : 300 + Math.floor(Math.random() * 300);
  f.name = 'Dead traveler';
  f.alive = true; f.down = false; f.animate(0.4); f.alive = false; f.down = true;
  f.updateFall(0.016); f.animatedOnce = true;
  if (settings.gore > 0) gore.pool(f);
}

// ---- the hungry empress, who walks the village at night ----
let empress = null, empAngryUntil = 0;
const EMP_SPOT = () => { const t = SPOTS.tavern; return { x: t.door.x + Math.cos(t.ry) * 4, z: t.door.z - Math.sin(t.ry) * 4 }; };
function spawnEmpress() {
  const f = new Fighter({ tier: 4, team: 'god', outfit: { sex: 'f', dress: true, top: 0x3a1f4a, legs: 0x1a1020, hood: true, hoodColor: 0x2a1438, cloak: true, face: 'empress', skin: 0x9a86b0, boots: 0x1a1020 }, body: 0x7a6a8a, sword: null, scale: 0.74, name: '@@EMPRESS@@' });
  f.invuln = true; f.voicePitch = 1.9; f.legend = 'empress';
  addHorns(f);
  addHairBangs(f, 0x6a3a9a, 1.6);
  goldEyes(f, 0xb06aff);
  f.onMagic = () => empressOffended('Fuhahaha! That tickles!');
  // a faint violet glow follows her around at night
  f.aura = new THREE.PointLight(0xa060ff, 0, 5, 2); scene.add(f.aura);
  setInside(f, true);
  empress = f;
}
function addHorns(f) {
  const face = f.armor.face; if (!face) return;
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2028, roughness: 0.35, metalness: 0.1 });
  for (const s of [-1, 1]) {
    // a horn that curls back and out, getting thinner
    const pts = [], rings = 14, segs = 10, pos = [], idx = [];
    for (let i = 0; i <= rings; i++) { const t = i / rings, a = t * 2.4; pts.push(new THREE.Vector3(s * (0.06 + Math.sin(a) * 0.075 * t + t * 0.05), 0.1 + Math.sin(a * 0.8) * 0.12, -0.01 - (1 - Math.cos(a)) * 0.07)); }
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, p = pts[i], q = pts[Math.min(rings, i + 1)], pp = pts[Math.max(0, i - 1)];
      const dir = q.clone().sub(pp).normalize(), n1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize(), n2 = new THREE.Vector3().crossVectors(dir, n1);
      const r = 0.024 * (1 - t * 0.9) * (1 + 0.08 * Math.sin(t * 40));
      for (let k = 0; k <= segs; k++) { const a = k / segs * 6.283; pos.push(p.x + (n1.x * Math.cos(a) + n2.x * Math.sin(a)) * r, p.y + (n1.y * Math.cos(a) + n2.y * Math.sin(a)) * r, p.z + (n1.z * Math.cos(a) + n2.z * Math.sin(a)) * r); }
      if (i < rings) for (let k = 0; k < segs; k++) { const a = i * (segs + 1) + k, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.userData.armor = true;
    face.add(m);
  }
}
function updateEmpress(dt) {
  if (!empress) return;
  const f = empress, h = hourNow(), night = h >= 20 || h < 5;
  if (empAngryUntil > clockNow) { if (!f.inside) setInside(f, true); return; }
  if (night && f.inside && !legendBusy) { setInside(f, false); const s = EMP_SPOT(); f.pos.set(s.x, groundH(s.x, s.z), s.z); f.facing = Math.random() * 6.28; }
  if (!night && !f.inside && !legendBusy && !saga.open) { smokePuff(f.pos); setInside(f, true); }
  f.aura.intensity = f.inside ? 0 : 2.2;
  if (!f.inside) f.aura.position.set(f.pos.x, f.pos.y + 1.2, f.pos.z);
  if (f.inside) return;
  // she wanders a few steps, looking for food, and hums
  f.wT = (f.wT || 0) - dt;
  const s = EMP_SPOT();
  if (f.wT <= 0) { f.wT = 3 + Math.random() * 5; const a = Math.random() * 6.28, r = Math.random() * 4; f.goal = { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r }; }
  const talking = saga.open && saga.who === 'empress';
  if (talking || legendBusy) { const d = player.pos.clone().sub(f.pos); stepFighter(f, dt, new THREE.Vector3(), 0, Math.atan2(d.x, d.z)); }
  else if (f.goal) { const dx = f.goal.x - f.pos.x, dz = f.goal.z - f.pos.z, d = Math.hypot(dx, dz); stepFighter(f, dt, d > 0.4 ? new THREE.Vector3(dx / d, 0, dz / d) : new THREE.Vector3(), d > 0.4 ? 1.1 : 0, d > 0.4 ? Math.atan2(dx, dz) : null); }
  // hit her and she just laughs and vanishes
  if (player.attack && player.attack.t > player.attack.dur * 0.3 && player.pos.distanceTo(f.pos) < 2.3 && !legendBusy) empressOffended('Fuhahaha! You think a sword can touch me?');
}
function smokePuff(p) { mfx.burst.smoke(p.x, p.y + 0.5, p.z, 14, 0.8, 0.3); for (let i = 0; i < 20; i++) mfx.emit(true, 0, p.x + (Math.random() - 0.5), p.y + Math.random() * 1.4, p.z + (Math.random() - 0.5), 0, 1, 0, 0.6, 0.15, 0.05, 1.8, 0.6, 2.6, 0.8); sfx.disturb(p); }
function empressOffended(line) {
  if (!empress || empress.inside || legendBusy) return;
  saga.close();
  ui.sub('@@EMPRESS_SHORT@@: "' + line + '"', 3);
  sfx.murmur(empress.pos, line, empress.voicePitch, true);
  smokePuff(empress.pos); setInside(empress, true);
  empAngryUntil = clockNow + 120;
}
const FOODS = ['bread', 'stew', 'honeycake'];
function talkEmpress() {
  const f = empress;
  const v = { pos: f.pos, pitch: 1.9, female: true };
  saga.who = 'empress';
  const food = FOODS.filter(k => vsave.items[k] > 0);
  const feedChoices = food.map(k => ({ t: 'Give her the ' + ITEMS[k].name.toLowerCase(), fn: () => feed(k) }));
  const intro = legend.emp.met ? (legend.emp.fed ? 'Ohh, it\'s you! My favorite human! Do you have more food?' : 'You again! Did you bring food this time?') : 'Hey! You! Human! You smell like food. Do you have food? Give me food! I am starving!';
  legend.emp.met = 1; saveLegend();
  saga.say('Horned girl', intro, [
    ...feedChoices,
    { t: 'Who are you?', fn: () => saga.say('@@EMPRESS@@', 'Who am I? Fuhahaha! I am @@EMPRESS@@! Six hundred years old and the greatest of all demons! Bow before me! ...And then feed me.', [...feedChoices, { t: 'I have no food.', fn: noFood }], { voice: v }) },
    ...(food.length ? [] : [{ t: 'I have no food.', fn: noFood }]),
    { t: 'Leave', ghost: true, fn: () => { saga.who = null; saga.close(); } },
  ], { voice: v });
  function noFood() { saga.say('@@EMPRESS_SHORT@@', 'Then what good are you?! Go! Bread, stew, honey cake, anything! The tavern has food, you know!', [{ t: 'Leave', fn: () => { saga.who = null; saga.close(); } }], { voice: v }); }
  function feed(k) {
    addItem(k, -1); legend.emp.fed++; saveLegend();
    for (let i = 0; i < 4; i++) setTimeout(() => sfx.step(f.pos, 'dirt', false, 0.5), i * 160);
    const strong = magic.max >= 100 && stats.str >= 4;
    const swap = !!magic.eye;
    saga.say('@@EMPRESS_SHORT@@', 'Mmmh! Fuhahaha! Delicious! You fed the great @@EMPRESS_SHORT@@! For that, I will give you a reward!', [{ t: '...a reward?', fn: () => {
      if (!strong) {
        saga.say('@@EMPRESS_SHORT@@', 'A Demon Eye! ...Hmm? Wait. Let me look at you. Your mana is a puddle and your arm is like a twig! A Demon Eye would burst your skull! Come back when your mana is over 100 and you have gotten stronger.', [{ t: 'I\'ll come back.', fn: () => { saga.who = null; saga.close(); ui.sub('She needs: max mana 100+ (yours: ' + Math.floor(magic.max) + '), strength 4+ (yours: ' + stats.str + ').', 5); } }], { voice: v });
        return;
      }
      saga.say('@@EMPRESS_SHORT@@', (swap ? 'You want a different eye? Fine, fine! ' : 'You are strong enough to hold one! ') + 'Choose! The Eye of Foresight sees three heartbeats into the future. The Eye of Clairvoyance sees far across the land.', [
        { t: 'Foresight', fn: () => givingEye('foresight') },
        { t: 'Clairvoyance', fn: () => givingEye('clairvoyance') },
        { t: 'No thanks', ghost: true, fn: () => { saga.who = null; saga.close(); } },
      ], { voice: v });
    } }], { voice: v });
  }
  function givingEye(kind) {
    saga.say('@@EMPRESS_SHORT@@', 'Hold still! This will hurt a little. Fuhahaha!', [{ t: 'Wait, what are you...', fn: () => { saga.close(); eyeScene(kind); } }], { voice: v });
  }
}
// she reaches up and pushes her finger into your eye
function eyeScene(kind) {
  legendBusy = true; cutscene = true;
  const f = empress, P = player;
  P.helmet(false);
  const fwd = new THREE.Vector3(Math.sin(P.facing), 0, Math.cos(P.facing));
  f.pos.copy(P.pos).addScaledVector(fwd, 0.5); f.facing = Math.atan2(P.pos.x - f.pos.x, P.pos.z - f.pos.z); f.root.rotation.y = f.facing;
  const side = new THREE.Vector3(Math.cos(P.facing), 0, -Math.sin(P.facing));
  const head = () => P.b.Head.getWorldPosition(new THREE.Vector3());
  let t = 0;
  legendScene = (dt) => {
    t += dt;
    const h = head();
    sceneCam = { pos: h.clone().addScaledVector(side, 1.0).addScaledVector(fwd, 0.55).add(new THREE.Vector3(0, -0.05, 0)), look: h.clone().addScaledVector(fwd, 0.15) };
    // she floats up to your face
    f.pos.y = groundH(f.pos.x, f.pos.z) + Math.min(0.5, t * 0.5) * (t > 2.4 ? Math.max(0, 1 - (t - 2.4) * 2) : 1);
    const eye = h.clone().addScaledVector(fwd, 0.1).addScaledVector(side, -0.035).add(new THREE.Vector3(0, 0.02, 0));
    f.castAim = t < 2.4 ? (t < 1.2 ? f.b.LeftArm.getWorldPosition(new THREE.Vector3()).lerp(eye, Math.min(1, t / 1.1) * 0.85) : eye) : null;
    if (t > 1.2 && !f._poked) {
      f._poked = true;
      sfx.voice(P.pos, 'scream', P.voicePitch); sfx.stab(eye); shake(0.8);
      const tint = document.getElementById('legendTint'); tint.style.background = 'radial-gradient(ellipse at 35% 45%, rgba(255,255,255,.95) 0%, rgba(160,0,0,.85) 35%, rgba(60,0,0,.9) 100%)'; tint.style.opacity = 1;
      if (settings.gore > 0) gore.blood(eye, fwd, 6, 0.6);
    }
    if (t > 1.2 && t < 3.5 && Math.random() < 0.05) sfx.heartbeat();
    if (t > 4.2) {
      legendScene = null;
      const tint = document.getElementById('legendTint'); tint.style.opacity = 0;
      magic.eye = kind; magic.eyeOn = false; saveMagic(true);
      P.helmet(true); sceneCam = null; cutscene = false; legendBusy = false; f._poked = false;
      ui.message(EYE_NAMES[kind].toUpperCase(), 3);
      setTimeout(() => ui.sub(kind === 'foresight' ? 'Press V to open the eye: you see ghosts of what enemies will do in the next 3 seconds. It costs mana and hurts your head if you keep it open.' : 'Hold V to look far through the eye. It costs mana while you look.', 7), 1200);
      setTimeout(() => { if (empress && !empress.inside) { sfx.murmur(empress.pos, 'Don\'t lose it! Fuhahaha!', 1.9, true); ui.sub('@@EMPRESS_SHORT@@: "Don\'t lose it! Fuhahaha!"', 3); } }, 4500);
      saga.who = null;
    }
  };
}

// ---- the Demon Eye: ghosts of the next three seconds ----
let ghostPool = [], eyeStrainT = 0, eyeHeldT = 0;
const ghostMat2 = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uA: { value: 1 } },
  vertexShader: ghostMat.vertexShader, fragmentShader: 'uniform float uT; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 1.6); float band = 0.7 + 0.3 * sin(vW.y * 30.0 - uT * 8.0); gl_FragColor = vec4(vec3(1.1, 0.45, 2.2) * (0.05 + f * 0.9) * band * uA, 1.0); }',
});
function makeGhost() {
  const m = skeletonClone(soldierGLTF.scene);
  const mat = ghostMat2.clone();
  m.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.frustumCulled = false; } });
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; m.rotation.y = Math.PI; root.add(m); scene.add(root);
  const b = {}; m.traverse(o => { if (o.isBone) b[o.name.replace('mixamorig', '')] = o; });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 2.4), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  blade.geometry.translate(0, 0.5, 0); scene.add(blade);
  const label = document.createElement('div'); label.className = 'ghostT'; document.getElementById('hud').appendChild(label);
  root.visible = false; blade.visible = false;
  return { root, model: m, b, mat, blade, label, src: null };
}
const _gv = new THREE.Vector3(), _gv2 = new THREE.Vector3();
function poseGhost(G, src, pos, facing, swing, phase) {
  G.root.visible = true; G.root.position.copy(pos); G.root.rotation.y = facing; G.root.rotation.x = 0;
  // copy his body as it is now
  if (!src._bones) { src._bones = {}; src.model.traverse(o => { if (o.isBone) src._bones[o.name.replace('mixamorig', '')] = o; }); }
  for (const k in G.b) { const sb = src._bones[k]; if (sb) G.b[k].quaternion.copy(sb.quaternion); }
  G.root.updateMatrixWorld(true);
  G.blade.visible = false;
  if (swing && src.hasSword) {
    const keys = SWINGS[swing];
    let i = 0; while (i < keys.length - 2 && phase > keys[i + 1][0]) i++;
    const [t0, A] = keys[i], [t1, B] = keys[i + 1];
    const k = smooth(0, 1, (phase - t0) / (t1 - t0));
    const hand = _gv.copy(A.h).lerp(B.h, k).applyMatrix4(G.root.matrixWorld);
    const bladeDir = _gv2.copy(A.b).lerp(B.b, k).normalize().applyQuaternion(G.root.quaternion);
    solveArm(G.b.RightArm, G.b.RightForeArm, G.b.RightHand, hand, new THREE.Vector3(-0.6, -1, -0.25).applyQuaternion(G.root.quaternion));
    G.b.RightHand.getWorldPosition(G.blade.position);
    G.blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bladeDir);
    G.blade.scale.y = src.sword ? src.sword.reach * 1.15 : 1;
    G.blade.visible = true;
  }
}
function updateEye(dt, realDt) {
  const on = magic.eye && magic.eyeOn && player.alive && !cutscene;
  if (!ghostPool.length && soldierGLTF && magic.eye === 'foresight') for (let i = 0; i < 6; i++) ghostPool.push(makeGhost());
  for (const G of ghostPool) { G.root.visible = false; G.blade.visible = false; G.label.style.display = 'none'; G.used = false; }
  setSlitColor(on ? 0xa040ff : 0xff1608);
  if (!on) { eyeStrainT = Math.max(0, eyeStrainT - dt * 2); return; }
  // it costs you: mana every second, and a headache if you hold it open too long
  const cost = (magic.eye === 'foresight' ? 1.4 : 2.0) * (0.6 + 40 / Math.max(40, magic.max));
  magic.mana -= cost * dt;
  eyeStrainT += dt;
  if (eyeStrainT > 25) { magic.exh = Math.min(120, magic.exh + dt * 1.2); if (Math.random() < dt * 0.3) ui.sub('Your demon eye throbs. Your head is splitting.', 1.5); }
  if (magic.mana <= 0) { magic.mana = 0; magic.eyeOn = false; ui.sub('Your mana ran out. The eye closes.', 2); return; }
  if (magic.exh >= 100) { magic.eyeOn = false; manaPassOut(); return; }
  if (magic.eye !== 'foresight') return;
  const P = player;
  if (dragon && dragon.pos.distanceTo(P.pos) < 14) { eyeChaos(dragon, dt); return; }
  const list = fighters.filter(f => f.ai && f.alive && f.ai.alert && f.ai.target === P && !f.down && f.pos.distanceTo(P.pos) < 32).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)).slice(0, ghostPool.length);
  let gi = 0;
  for (const f of list) {
    const G = ghostPool[gi++]; if (!G) break;
    const ai = f.ai, dist = f.pos.distanceTo(P.pos);
    let tAt = null, dir = null, pos = f.pos.clone(), face = f.facing;
    if (f.mage) {
      const M = f.mage, ch = M.chant;
      const tt = ch ? ch.need - ch.t : M.next ? Math.max(0, M.cd) + CHANT_T[M.next.s.rank] * 1.3 : null;
      if (tt !== null && tt < 3) {
        tAt = tt;
        const s = ch ? ch.s : M.next.s;
        G.label.textContent = s.name + ' ' + tt.toFixed(1) + 's';
        drawSpellPath(G, f, s, tt);
      }
      pos.addScaledVector(f.vel, Math.min(1, tAt ?? 1));
    } else if (f.hasSword) {
      // he swings when his timer runs out and he is close enough
      const approach = dist > 3 ? (dist - 2.6) / Math.max(1, 4.3 * f.T.speed) : 0;
      tAt = f.attack ? -1 : Math.max(ai.cd, approach);
      if (f.attack) { dir = f.attack.dir; tAt = 0; G.label.textContent = 'NOW'; }
      else if (tAt < 3) {
        dir = ai.nextDir || 'R';
        const lead = Math.min(tAt, 1.5);
        const toP = P.pos.clone().sub(f.pos).setY(0);
        const step = Math.max(0, Math.min(toP.length() - 1.7, 4.3 * lead));
        pos.addScaledVector(toP.normalize(), step);
        face = Math.atan2(toP.x, toP.z);
        G.label.textContent = { R: 'from your left', L: 'from your right', U: 'overhead', D: 'low', S: 'stab' }[dir] + ' ' + tAt.toFixed(1) + 's';
      } else { pos.addScaledVector(f.vel, 1); tAt = null; }
    }
    pos.y = groundH(pos.x, pos.z);
    G.mat.uniforms.uT.value = elapsed; G.mat.uniforms.uA.value = tAt === null ? 0.25 : 0.55 + 0.45 * (1 - Math.min(1, tAt / 3));
    poseGhost(G, f, pos, face, dir, f.attack ? Math.min(1, f.attack.t / f.attack.dur + 0.15) : 0.45);
    if (tAt !== null) {
      const h = G.b.Head.getWorldPosition(new THREE.Vector3()); h.y += 0.35;
      const s = h.project(camera);
      if (s.z < 1) { G.label.style.display = 'block'; G.label.style.left = ((s.x * 0.5 + 0.5) * innerWidth) + 'px'; G.label.style.top = ((-s.y * 0.5 + 0.5) * innerHeight) + 'px'; }
    }
  }
  // spells already in the air: where they'll land
  for (const pr of projs) {
    if (pr.dead || pr.caster === P || !pr.caster) continue;
    let p = pr.pos.clone(), v = pr.vel.clone();
    for (let i = 0; i < 40; i++) { v.y -= (pr.grav || 0) * 0.04; p.addScaledVector(v, 0.04); if (p.y < groundH(p.x, p.z) || p.distanceTo(P.pos.clone().setY(P.pos.y + 1)) < 0.6) break; if (i % 3 === 0) mfx.emit(true, 0, p.x, p.y, p.z, 0, 0, 0, 0.06, 0.12, 0.12, 1.2, 0.5, 2.4, 0.7); }
    mfx.emit(true, 3, p.x, groundH(p.x, p.z) + 0.05, p.z, 0, 0, 0, 0.06, 1.2, 1.2, 1.2, 0.5, 2.4, 0.6);
  }
}
function drawSpellPath(G, f, s, tt) {
  const a = palm(f), b = player.pos.clone().setY(player.pos.y + 1.1);
  for (let i = 0; i <= 14; i++) { const p = a.clone().lerp(b, i / 14); mfx.emit(true, 0, p.x, p.y, p.z, 0, 0, 0, 0.06, 0.1, 0.1, 1.2, 0.5, 2.4, 0.6 * (1 - tt / 3)); }
}
// a god's future can't be read: the eye shows a hundred of him at once
function eyeChaos(f, dt) {
  for (const G of ghostPool) {
    if (Math.random() < 0.4) continue;
    const a = Math.random() * 6.28, r = 0.6 + Math.random() * 4;
    const pos = player.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); pos.y = groundH(pos.x, pos.z);
    G.mat.uniforms.uA.value = 0.3 + Math.random() * 0.7;
    poseGhost(G, f, pos, Math.random() * 6.28, ['R', 'L', 'U', 'S'][Math.floor(Math.random() * 4)], Math.random());
  }
  magic.exh = Math.min(120, magic.exh + dt * 9);
  shake(0.05);
  if (Math.random() < dt * 0.8) ui.sub('Your eye shows too many of him. You cannot tell which one is real.', 1.5);
}
let slitColor = 0;
function setSlitColor(c) {
  if (slitColor === c) return; slitColor = c;
  player.model.traverse(o => { if (o.isMesh && o.userData.helm && o.material.emissive && o.material.emissiveIntensity >= 2) o.material.emissive.setHex(c); });
}
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat || !playing || paused || uiOpen || cutscene || !player.alive) return;
  if (!magic.eye) { ui.sub('You have no demon eye.', 1.2); return; }
  if (magic.eye === 'foresight') { magic.eyeOn = !magic.eyeOn; if (magic.eyeOn) { sfx.lift(player.pos); eyeStrainT = 0; } }
  else { magic.eyeOn = true; eyeHeldT = 0; sfx.lift(player.pos); }
});
addEventListener('keyup', (e) => { if (e.code === 'KeyV' && magic.eye === 'clairvoyance') magic.eyeOn = false; });
// clairvoyance: look far ahead through the eye
function eyeCamera() {
  if (magic.eye !== 'clairvoyance' || !magic.eyeOn || cutscene) return;
  const h = player.b.Head.getWorldPosition(new THREE.Vector3()); h.y += 0.05;
  const d = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch) + 0.15, -Math.cos(yaw) * Math.cos(pitch)).normalize();
  camera.position.copy(h).addScaledVector(d, 0.3);
  camera.lookAt(h.clone().addScaledVector(d, 50));
  camera.fov = 11; camera.updateProjectionMatrix();
  scene.fog.density *= 0.35;
}

// ---- E near a legend talks to them ----
const interactTarget1 = interactTarget;
interactTarget = function () {
  if (player.alive && !legendBusy) {
    if (dragon && player.pos.distanceTo(dragon.pos) < 3 && dragonTalkT <= clockNow) return { kind: 'legend', o: dragon, text: 'Speak to the silver-haired man' };
    if (empress && !empress.inside && player.pos.distanceTo(empress.pos) < 2.6) return { kind: 'legend', o: empress, text: 'Talk to the horned girl' };
  }
  return interactTarget1();
};
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || e.repeat || !playing || paused || uiOpen || cutscene || !player.alive || legendBusy) return;
  const t = interactTarget();
  if (!t || t.kind !== 'legend') return;
  e.stopImmediatePropagation();
  if (t.o === dragon) talkDragon(); else if (t.o === empress) talkEmpress();
}, true);
// dreams come when you sleep at the inn or pass out
const sleepAtInn0 = sleepAtInn;
sleepAtInn = function () {
  closeShop(); endTalk(); cutscene = true;
  fadeTo(1, 1.4, () => maybeDream(() => { cutscene = false; sleepAtInn0(); }));
};
// legends never get cleaned up, and dead advice bodies stay until you find them
function initLegends() {
  saga.ensure();
  spawnDragon();
  spawnEmpress();
  if (legend.advice) placeAdvice(legend.advice);
}
function updateLegends(dt, realDt) {
  if (!worldStarted) return;
  if (legendScene) legendScene(realDt);
  updateDragon(dt); updateEmpress(dt); updateEye(dt, realDt);
  if (legend.advice && player.pos.distanceTo(new THREE.Vector3(legend.advice.x, player.pos.y, legend.advice.z)) < 6) { legend.advice = null; saveLegend(); }
}
window.__L = { LEDGE, get dragon() { return dragon; }, get empress() { return empress; }, talkDragon, talkEmpress, saga, maybeDream, eyeScene, dragonKill, legend };
