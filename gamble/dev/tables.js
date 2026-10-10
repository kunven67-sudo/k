// Dev page: casino table games (lane B).
//   tables.html                        lit test room: blackjack + roulette, walk with WASD, E to sit
//   tables.html?game=blackjack&sit=1   straight into the blackjack close-up (&seat=0..6, &npcs=0..6)
//   tables.html?game=roulette&sit=1    straight into the roulette close-up
//   &min=25 → the $25 S17 table · &speed=3 animation fast-forward · &chips=500 dev chips · &hour=…
//   tables.html?view=art               2D preview of the card atlases + chip texture
//   tables.html?view=props             cards and chips on a felt swatch (material check)
// Console: __tables.bj / .rl (tables), .player, __step(seconds) (deterministic fast-forward for
// headless screenshots: runs the game loop without rendering).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { mat } from '../src/gfx/materials.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { PhysicsWorld } from '../src/core/physics.js';
import { input } from '../src/core/input.js';
import { audio } from '../src/core/audio.js';
import { Rng } from '../src/core/rng.js';
import { createHuman, randomHumanParams } from '../src/character/index.js';
import { Player } from '../src/player/index.js';
import { chips } from '../src/casino/chips.js';
import { createBlackjackTable, createRouletteTable } from '../src/casino/tables/index.js';
import { basicStrategy } from '../src/casino/tables/rules/blackjack.js';
import { bus } from '../src/core/events.js';
import { cardAtlasCanvases, CardMeshes, cardQuat, CARD_H } from '../src/casino/tables/kit/cards.js';
import { ChipMeshes, Pile, chipCanvas, kindOf, WHEEL_KIND } from '../src/casino/tables/kit/chips3d.js';

const q = Object.fromEntries(new URLSearchParams(location.search));

function artView() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;z-index:50';
  for (const c of [...cardAtlasCanvases(), chipCanvas()]) {
    c.style.cssText = 'width:min(48vw,1024px);height:auto;background:#fff';
    wrap.append(c);
  }
  document.body.append(wrap);
  window.__ready = true;
}

function lights(scene, e) {
  const pmrem = new THREE.PMREMGenerator(e.renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  scene.add(new THREE.HemisphereLight(0x8a7058, 0x1a120c, 0.35));
}

function tableLight(scene, e, x, z, shadow) {
  // A warm pool on the felt from a fixture above (what lane A's pit lighting provides on the floor).
  const s = new THREE.SpotLight(0xffd6a0, 16, 7, 0.78, 0.65, 2);
  s.position.set(x, 3.1, z + 0.25);
  s.target.position.set(x, 0.76, z - 0.1);
  s.castShadow = shadow && e.tier.shadows;
  s.shadow.mapSize.setScalar(e.tier.shadowMapSize || 1024);
  s.shadow.bias = -0.0004;
  s.shadow.normalBias = 0.01;
  scene.add(s, s.target);
  return s;
}

class PropsDev {
  constructor(engine) {
    this.engine = engine;
  }
  async enter() {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d0b);
    lights(scene, e);
    const spot = new THREE.SpotLight(0xffe2b8, 7, 6, 0.7, 0.6, 2);
    spot.position.set(0.3, 2.2, 0.6);
    spot.target.position.set(0, 0.76, 0);
    spot.castShadow = e.tier.shadows;
    spot.shadow.mapSize.setScalar(1024);
    spot.shadow.bias = -0.0002;
    scene.add(spot, spot.target);
    const felt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.9), mat('felt', { color: 0x125a3a }));
    felt.position.set(0, 0.74, 0);
    felt.receiveShadow = true;
    scene.add(felt);
    const deck = new CardMeshes({ capacity: 64 });
    scene.add(deck.mesh);
    const vals = [0, 13 + 12, 26 + 11, 39 + 10, 9, 13 + 4, 26 + 7, 39 + 0, 12, 13 + 0];
    vals.forEach((v, i) => {
      const x = -0.5 + (i % 5) * 0.075;
      const z = -0.12 + Math.floor(i / 5) * (CARD_H + 0.01);
      deck.spawn(v, new THREE.Vector3(x, 0.7604, z), cardQuat((Math.random() - 0.5) * 0.06, true));
    });
    deck.spawn(5, new THREE.Vector3(-0.05, 0.7604, -0.12), cardQuat(0.05, false));
    const set = new ChipMeshes({ capacity: 300 });
    scene.add(set.mesh);
    [1, 2.5, 5, 25, 100, 500, 1000].forEach((d, i) => {
      const p = new Pile(set, 0.12 + (i % 4) * 0.05, -0.1 + Math.floor(i / 4) * 0.06, 0.76, { neat: 2 });
      for (let k = 0; k < 4 + i * 2; k++) p.push(kindOf(d));
    });
    [0xd6732a, 0x3a8fd6, 0x8a5ac8].forEach((t, i) => {
      const p = new Pile(set, 0.12 + i * 0.05, 0.08, 0.76, { tint: new THREE.Color(t) });
      for (let k = 0; k < 6; k++) p.push(WHEEL_KIND);
    });
    const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 50);
    cam.position.set(-0.1, 1.12, 0.42);
    cam.lookAt(-0.1, 0.76, -0.04);
    this.cam = cam;
    e.setView(scene, cam);
  }
  update() {}
  onResize(w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }
  exit() {}
}

// ---- the test room --------------------------------------------------------------------------------

const ROOM = { x0: -5, x1: 9, z0: -4.5, z1: 5 };

class TablesDev {
  constructor(engine) {
    this.engine = engine;
    this.ready = false;
  }

  async enter() {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0807);
    scene.fog = new THREE.Fog(0x0b0807, 9, 26);
    this.scene = scene;
    lights(scene, e);
    const physics = new PhysicsWorld();
    e.physics = physics;
    this.physics = physics;
    physics.addGround(0);

    // Carpet floor + dark wainscot walls.
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
    const wallH = 3.6;
    for (const [x, z, ww, dd] of [
      [(ROOM.x0 + ROOM.x1) / 2, ROOM.z0, w, 0.2], [(ROOM.x0 + ROOM.x1) / 2, ROOM.z1, w, 0.2],
      [ROOM.x0, (ROOM.z0 + ROOM.z1) / 2, 0.2, d], [ROOM.x1, (ROOM.z0 + ROOM.z1) / 2, 0.2, d],
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

    // Tables.
    const tier = e.tier;
    const npcs = q.npcs != null ? +q.npcs : 2;
    const min = q.min ? +q.min : 5;
    this.tables = [];
    const wantBJ = !q.game || q.game === 'blackjack';
    const wantRL = !q.game || q.game === 'roulette';
    if (wantBJ) {
      this.bj = createBlackjackTable({ engine: e, physics, tier, casino: 'eldorado', id: 'bj-dev', position: new THREE.Vector3(0, 0, 0), yaw: 0, limits: { min, max: min >= 25 ? 2000 : 500 }, rng: new Rng('bj-dev'), npcs });
      scene.add(this.bj.group);
      this.tables.push(this.bj);
      tableLight(scene, e, 0, -0.1, true);
    }
    if (wantRL) {
      this.rl = createRouletteTable({ engine: e, physics, tier, casino: 'eldorado', id: 'rl-dev', position: new THREE.Vector3(wantBJ ? 5 : 0, 0, 0), yaw: 0, limits: { min: 5, max: 2000, insideMin: 1 }, rng: new Rng('rl-dev'), npcs });
      scene.add(this.rl.group);
      this.tables.push(this.rl);
      tableLight(scene, e, wantBJ ? 4.6 : -0.4, -0.05, !wantBJ);
    }
    for (const t of this.tables) {
      t.refreshWorld();
      if (q.speed) t.devSpeed = +q.speed;
    }

    // Player.
    const camera = new THREE.PerspectiveCamera(62, innerWidth / Math.max(1, innerHeight), 0.03, 120);
    this.camera = camera;
    const human = createHuman(randomHumanParams(new Rng(q.who || 'tables-player'), { hat: 'none' }), { tier, hero: true });
    const spawnX = q.game === 'roulette' ? 0 : wantBJ ? 0 : 0;
    this.player = new Player(e, { dev: true }, { human, spawn: { x: spawnX + 0.4, y: 0.05, z: 3.2, yaw: 0 }, camera });
    scene.add(this.player.root);
    this.player.interact.setList(this.tables.flatMap((t) => t.interactables));
    // Dev chips so the tables are playable without the cage.
    const want = q.chips != null ? +q.chips : 500;
    if (chips.total('eldorado') < 1 && want > 0) chips.buyIn(want, 'eldorado', 'dev');

    e.setView(scene, camera);
    input.setPointerLock(!q.sit);
    try {
      audio.setRoom('casino');
    } catch {
      /* locked */
    }
    this.player.update(0);
    this.ready = true;
    window.__tables = this;
    this.results = [];
    bus.on('gamble:result', (r) => this.results.push(r));
    if (q.auto) this.auto = true;
    if (q.sit) {
      const t = q.game === 'roulette' ? this.rl : this.bj;
      const seat = q.seat != null ? +q.seat : t.seats.findIndex((s) => !s.occupant);
      t.sit(this.player, Math.max(0, seat));
    }
  }

  fixedUpdate(step) {
    if (!this.ready) return;
    this.player.fixedUpdate(step);
  }

  update(dt) {
    if (!this.ready) return;
    this.player.update(dt);
    const ctx = { camera: this.camera, player: this.player };
    for (const t of this.tables) t.update(dt, ctx);
    if (this.auto) this._autoPlay();
  }

  /** Dev autoplay for soak tests: the seated player bets and plays basic strategy. */
  _autoPlay() {
    const t = this.bj;
    if (!t?.active) return;
    if (t._insAsk) t._insAsk.resolve(false);
    if (t._turn) {
      const { hand, legal } = t._turn;
      const afford = t.myTotal >= hand.bet;
      const a = basicStrategy(hand.vals, t.dealerCards[0].v, { h17: t.rules.h17, canDouble: legal.double && afford, canSplit: legal.split && afford });
      t._turn.resolve(a);
    }
    if (t.phase === 'betting' && !t._dealRequested && !t._changing) {
      const spot = t._playerSpot();
      if (!spot.betPile && !this._autoBetting && t.myTotal >= t.limits.min) {
        this._autoBetting = true;
        t._betAmount(this.autoBet || t.limits.min * 2);
        setTimeout(() => (this._autoBetting = false), 0);
      } else if (spot.betPile && spot.betPile.value >= t.limits.min) t._requestDeal();
    }
  }

  onResize(wd, ht) {
    if (!this.camera) return;
    this.camera.aspect = wd / Math.max(1, ht);
    this.camera.updateProjectionMatrix();
  }

  exit() {
    for (const t of this.tables) t.dispose();
    this.player?.dispose();
  }
}

if (q.view === 'art') artView();
else if (q.view === 'props') runState(PropsDev);
else runState(TablesDev);

// Deterministic fast-forward without rendering (headless SwiftShader renders ~1 fps). Yields to
// the event loop every frame so the tables' async choreography (promise chains) advances exactly
// as it would between real frames.
const mc = new MessageChannel();
const yieldTask = () => new Promise((r) => {
  mc.port1.onmessage = () => r();
  mc.port2.postMessage(0);
});
window.__step = async (seconds, dt = 1 / 30) => {
  const st = window.__tables;
  if (!st) return 'not ready';
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    st.fixedUpdate(dt);
    st.physics.step();
    st.physics.sync();
    st.update(dt);
    await yieldTask();
  }
  const bj = st.bj;
  return bj ? { phase: bj.phase, cards: bj.cards.used, chips: bj.chipSet.used, discards: bj.discards, shoe: bj.shoe.remaining } : 'ok';
};
