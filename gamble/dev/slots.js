// Dev page: slot machines (lane C).
//   slots.html                              lit test room: a bank of every theme, walk (WASD), E to sit
//   slots.html?theme=wild-west&sit=1        straight into a close-up (&m=machine index, &count=8)
//   &arr=back-to-back · &denom=0.25 · &npcs=2 (NPC players per bank) · &cash=500 · &hour=…
//   slots.html?view=symbols                 2D review of every symbol atlas (&blur=1 for the smear copy)
//   slots.html?view=signs                   2D review of logos, belly glass, button atlas, top glass
// Console: __slots.banks / .player / .machine(theme, i), __step(seconds) deterministic fast-forward,
//          __slots.force(theme, i, stops) to land a chosen result (dev only).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { mat } from '../src/gfx/materials.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { PhysicsWorld } from '../src/core/physics.js';
import { input } from '../src/core/input.js';
import { audio } from '../src/core/audio.js';
import { Rng } from '../src/core/rng.js';
import { slice } from '../src/life/state.js';
import { createHuman, randomHumanParams } from '../src/character/index.js';
import { Player } from '../src/player/index.js';
import { createSlotBank } from '../src/casino/slots/index.js';
import { spinVideo, spinStepper } from '../src/casino/slots/math/index.js';
import { symbolAtlas, THEME_ART } from '../src/casino/slots/art/atlas.js';
import { slotFontsReady, METAL } from '../src/casino/slots/art/paint.js';
import { logoTexture, bellyTexture, buttonAtlas, bankSignTexture } from '../src/casino/slots/art/signage.js';
import { topGlassTexture } from '../src/casino/slots/reels3d.js';
import { drawLogo } from '../src/casino/slots/art/signage.js';

const q = Object.fromEntries(new URLSearchParams(location.search));

async function symbolsView() {
  await slotFontsReady();
  document.body.style.cssText = 'background:#222;overflow:auto;margin:0';
  document.getElementById('app').style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;padding:12px';
  document.body.append(wrap);
  for (const theme of Object.keys(THEME_ART)) {
    const a = symbolAtlas(theme, 160);
    const c = document.createElement('canvas');
    c.width = a.canvas.width;
    c.height = a.canvas.height;
    const g = c.getContext('2d');
    g.fillStyle = theme === 'classic-fruit' ? '#f4ecd9' : theme === 'space' ? '#120a30' : theme === 'dragon' ? '#3a0406' : '#2a170c';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(q.blur ? a.blur : a.canvas, 0, 0);
    c.style.cssText = 'width:480px;border:1px solid #555';
    wrap.append(c);
  }
  window.__ready = true;
}

async function signsView() {
  await slotFontsReady();
  await new Promise((r) => setTimeout(r, 300));
  document.body.style.cssText = 'background:#222;overflow:auto;margin:0';
  document.getElementById('app').style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:10px;align-items:flex-start';
  document.body.append(wrap);
  const show = (tex, w) => {
    const c = tex.image;
    c.style.cssText = `width:${w}px;border:1px solid #555`;
    wrap.append(c);
  };
  for (const th of ['classic-fruit', 'wild-west', 'space', 'dragon']) show(logoTexture(th), 300);
  for (const th of ['classic-fruit', 'wild-west', 'space', 'dragon']) show(bellyTexture(th), 300);
  show(bankSignTexture('dragon', 0.01), 600);
  show(buttonAtlas().texture, 400);
  show(topGlassTexture('single', drawLogo), 250);
  show(topGlassTexture('three', drawLogo), 250);
  window.__ready = true;
}

async function screenView() {
  await slotFontsReady();
  await new Promise((r) => setTimeout(r, 300));
  const { VideoScreen } = await import('../src/casino/slots/screen.js');
  const { spinVideo } = await import('../src/casino/slots/math/index.js');
  document.body.style.cssText = 'background:#222;overflow:auto;margin:0';
  document.getElementById('app').style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:10px;align-items:flex-start';
  document.body.append(wrap);
  const theme = q.theme || 'wild-west';
  const states = ['idle', 'win', 'paytable', 'hold', 'big'];
  for (const st of states) {
    const sc = new VideoScreen(theme, { scale: 1, denom: 0.01 });
    sc.setMeters({ credit: 20, bet: 0.25, win: 0, lines: 25, betPerLine: 1, mult: 1 });
    let res = spinVideo(theme);
    if (st === 'win') for (let k = 0; k < 400 && !(res.wins?.length >= 2); k++) res = spinVideo(theme);
    sc.setStops(res.stops);
    if (st === 'idle') sc.setMessage('PRESS SPIN TO PLAY', 'GOOD LUCK!');
    if (st === 'win') {
      sc.showAllWins(res.wins);
      sc.showWin(res.wins[0], 40);
      sc.setMeters({ win: 0.4 });
    }
    if (st === 'paytable') sc.mode = 'paytable';
    if (st === 'hold') {
      sc.mode = 'hold';
      sc.hold = { cells: [null, { label: '$0.25', t: -1 }, null, { label: 'mini', t: -1 }, null, { label: '$1.50', t: -1 }, null, null, { label: '$0.50', t: -1 }, { label: '$2.00', t: -1 }, null, null, { label: '$0.75', t: -1 }, null, null], respins: 2, total: 5.0, spinning: true };
    }
    if (st === 'big') sc.bigWin('BIG WIN', 12.5);
    for (let k = 0; k < 30; k++) sc.update(1 / 30);
    sc.draw();
    sc.canvas.style.cssText = `width:${q.w || 300}px;border:1px solid #555`;
    wrap.append(sc.canvas);
  }
  window.__ready = true;
}

// ---- the test room --------------------------------------------------------------------------------

const ROOM = { x0: -8, x1: 9, z0: -6.5, z1: 7.5 };

const LAYOUT = {
  'wild-west': { pos: [-4.4, 0, -4.6], yaw: 0, count: 4 },
  dragon: { pos: [-4.4, 0, 0.0], yaw: 0, count: 4 },
  'classic-fruit': { pos: [-4.4, 0, 4.6], yaw: 0, count: 4 },
  space: { pos: [4.2, 0, 0.6], yaw: 0, count: 8, arrangement: 'back-to-back' },
};

class SlotsDev {
  constructor(engine) {
    this.engine = engine;
    this.ready = false;
  }

  async enter() {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    await slotFontsReady();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0708);
    scene.fog = new THREE.Fog(0x0a0708, 10, 30);
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.28;
    scene.add(new THREE.HemisphereLight(0x8a7058, 0x1a120c, 0.45));
    const physics = new PhysicsWorld();
    e.physics = physics;
    this.physics = physics;
    physics.addGround(0);
    this._room(scene, physics);

    if (q.cash) slice('money').cash = +q.cash;
    else if (slice('money').cash < 200) slice('money').cash = 500;

    const only = q.theme && LAYOUT[q.theme] ? q.theme : null;
    this.banks = {};
    const tier = e.tier;
    for (const [theme, L] of Object.entries(LAYOUT)) {
      if (only && theme !== only) continue;
      const pos = only ? new THREE.Vector3(0, 0, -1.2) : new THREE.Vector3(...L.pos);
      const b = createSlotBank({
        engine: e,
        physics,
        tier,
        casino: 'eldorado',
        id: `dev-${theme}`,
        theme,
        count: q.count ? +q.count : L.count,
        arrangement: q.arr || L.arrangement || 'row',
        position: pos,
        yaw: L.yaw,
        rng: new Rng(`dev-${theme}`),
        denom: q.denom ? +q.denom : undefined,
      });
      scene.add(b.group);
      this.banks[theme] = b;
      // a warm downlight pool over each bank (the casino floor's ceiling cans do this in game)
      const s = new THREE.SpotLight(0xffd9b0, 30, 9, 0.9, 0.7, 2);
      s.position.set(pos.x, 3.4, pos.z + 1.6);
      s.target.position.set(pos.x, 0.8, pos.z);
      s.castShadow = e.tier.shadows && Object.keys(this.banks).length <= 2;
      s.shadow.mapSize.setScalar(e.tier.shadowMapSize || 1024);
      s.shadow.bias = -0.0004;
      s.shadow.normalBias = 0.02;
      scene.add(s, s.target);
    }

    // Player.
    const camera = new THREE.PerspectiveCamera(62, innerWidth / Math.max(1, innerHeight), 0.03, 120);
    this.camera = camera;
    const human = createHuman(randomHumanParams(new Rng(q.who || 'slots-player'), { hat: 'none' }), { tier, hero: true });
    const spawn = only ? { x: 0.3, y: 0.05, z: 2.6, yaw: 0 } : { x: 0, y: 0.05, z: 4.5, yaw: Math.PI * 0.25 };
    this.player = new Player(e, { dev: true }, { human, spawn, camera });
    scene.add(this.player.root);
    this.player.interact.setList(Object.values(this.banks).flatMap((b) => b.interactables));

    // NPC players.
    this.npcs = [];
    const nNpc = q.npcs != null ? +q.npcs : 1;
    const r = new Rng('slots-npcs');
    for (const [theme, b] of Object.entries(this.banks)) {
      let placed = 0;
      for (let i = b.machines.length - 1; i >= 0 && placed < nNpc; i--) {
        if (q.sit && theme === (only || q.theme) && i === (+q.m || 0)) continue;
        const h = createHuman(randomHumanParams(r), { tier });
        if (b.machines[i].seatNpc(h)) {
          this.npcs.push(h);
          placed++;
        }
      }
    }

    e.setView(scene, camera);
    input.setPointerLock(!q.sit);
    try {
      audio.setRoom('casino');
    } catch {
      /* locked */
    }
    this.player.update(0);
    this.ready = true;
    window.__slots = this;
    if (q.sit) {
      const b = this.banks[only || q.theme || 'wild-west'];
      b?.machines[+q.m || 0]?.sit(this.player, 0);
    }
  }

  _room(scene, physics) {
    const w = ROOM.x1 - ROOM.x0;
    const d = ROOM.z1 - ROOM.z0;
    const floorGeo = new THREE.PlaneGeometry(w, d);
    floorGeo.rotateX(-Math.PI / 2);
    const carpet = mat('carpet-casino');
    const uv = floorGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / carpet.userData.tileMeters, (uv.getY(i) * d) / carpet.userData.tileMeters);
    const floor = new THREE.Mesh(floorGeo, carpet);
    floor.position.set((ROOM.x0 + ROOM.x1) / 2, 0, (ROOM.z0 + ROOM.z1) / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    const wallMat = mat('wallpaper', { color: 0x3a1a16 });
    const wallH = 3.8;
    for (const [x, z, ww, dd] of [
      [(ROOM.x0 + ROOM.x1) / 2, ROOM.z0, w, 0.2],
      [(ROOM.x0 + ROOM.x1) / 2, ROOM.z1, w, 0.2],
      [ROOM.x0, (ROOM.z0 + ROOM.z1) / 2, 0.2, d],
      [ROOM.x1, (ROOM.z0 + ROOM.z1) / 2, 0.2, d],
    ]) {
      const g = new THREE.BoxGeometry(ww, wallH, dd);
      const p = g.attributes.position;
      const u = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        u[i * 2] = (ww > dd ? p.getX(i) : p.getZ(i)) / (wallMat.userData.tileMeters || 1);
        u[i * 2 + 1] = p.getY(i) / (wallMat.userData.tileMeters || 1);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
      const m = new THREE.Mesh(g, wallMat);
      m.position.set(x, wallH / 2, z);
      m.receiveShadow = true;
      scene.add(m);
      physics.addStaticBox(m);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((ROOM.x0 + ROOM.x1) / 2, wallH, (ROOM.z0 + ROOM.z1) / 2);
    scene.add(ceil);
  }

  /** Dev: make machine i's next spin one (fair) result that shows `what`: free | hold | big | handpay | top. */
  force(theme, i = 0, what = 'free') {
    const m = this.machine(theme, i);
    const ok = {
      free: (r) => r.freeGame,
      hold: (r) => r.holdSpin,
      big: (r) => r.total >= 20 && !r.freeGame && !r.holdSpin,
      handpay: (r) => m.dollars(Math.round((r.total ?? r.win) * m.betCredits())) >= 1200 || m.dollars(r.win ?? 0) >= 1200,
      top: (r) => r.top,
      win: (r) => (r.total ?? r.win) > 0 && (r.wins?.length || r.lines?.length) > 1,
    }[what];
    m.devNext = () => {
      for (let k = 0; k < 2e6; k++) {
        const r = m.kind === 'video' ? spinVideo(theme, m.lines) : spinStepper(m.variant, m.coins);
        if (ok(r)) return r;
      }
      return null;
    };
    return m.id;
  }

  machine(theme, i = 0) {
    return this.banks[theme]?.machines[i];
  }

  /** Draw calls / triangles of one bank alone, seen whole from 5 m (shadow passes included). */
  perf(theme) {
    const r = this.engine.renderer;
    const sc = this.scene;
    const b = this.banks[theme];
    const vis = sc.children.map((c) => c.visible);
    const cam = new THREE.PerspectiveCamera(62, this.camera.aspect, 0.05, 100);
    const p = b.group.position;
    cam.position.set(p.x + 0.5, 2.2, p.z + 5.5);
    cam.lookAt(p.x, 1.2, p.z);
    const count = () => {
      r.info.autoReset = false;
      r.info.reset();
      r.render(sc, cam);
      const out = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      r.info.autoReset = true;
      return out;
    };
    sc.children.forEach((c) => {
      if (c !== b.group && !c.isLight) c.visible = false;
    });
    const withBank = count();
    b.group.visible = false;
    const empty = count();
    sc.children.forEach((c, i) => (c.visible = vis[i]));
    return { calls: withBank.calls - empty.calls, triangles: withBank.triangles - empty.triangles, machines: b.machines.length, textures: r.info.memory.textures, geometries: r.info.memory.geometries };
  }

  fixedUpdate(step) {
    if (!this.ready) return;
    this.player.fixedUpdate(step);
  }

  update(dt) {
    if (!this.ready) return;
    this.player.update(dt);
    const ctx = { camera: this.camera, player: this.player };
    for (const b of Object.values(this.banks)) b.update(dt, ctx);
    for (const h of this.npcs) h.update(dt);
  }

  onResize(wd, ht) {
    if (!this.camera) return;
    this.camera.aspect = wd / Math.max(1, ht);
    this.camera.updateProjectionMatrix();
  }

  exit() {
    for (const b of Object.values(this.banks)) b.dispose();
    this.player?.dispose();
  }
}

if (q.view === 'symbols') symbolsView();
else if (q.view === 'signs') signsView();
else if (q.view === 'screen') screenView();
else runState(SlotsDev);

// Deterministic fast-forward without rendering (headless SwiftShader renders ~1 fps). Yields to
// the event loop every frame so the machines' async choreography advances like real frames.
const mc = new MessageChannel();
const yieldTask = () =>
  new Promise((r) => {
    mc.port1.onmessage = () => r();
    mc.port2.postMessage(0);
  });
window.__step = async (seconds, dt = 1 / 30) => {
  const st = window.__slots;
  if (!st) return 'not ready';
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    st.fixedUpdate(dt);
    st.physics.step();
    st.physics.sync();
    st.update(dt);
    await yieldTask();
  }
  const out = {};
  for (const [th, b] of Object.entries(st.banks)) out[th] = b.machines.map((m) => `${m.phase}:${m.balance}`).join(' ');
  return out;
};
void METAL;
