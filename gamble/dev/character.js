// Dev page: the procedural human system (src/character).
//
//   view=lineup (default)  8 diverse people on a street corner: four idle on the sidewalk,
//                          four walk back and forth over a 0.15 m curb (foot IK, planting).
//   view=face&i=N          close-up of person N cycling expressions, then visemes.
//
// Keys:  1-9 0 - =  one-shots (wave, cheer, shrug, facepalm, knock, drink, phone-up/down,
//        sit/stand, stretch, yawn, pat-pockets …; see panel)   E next expression   V visemes
//        W walkers on/off   D dirt+bruises   O new outfits   R new people   H hide panel
//        drag = orbit, wheel = zoom.
// URL: ?view=face&i=2&seed=40&n=8&walk=0&tier=high&expr=happy&action=wave&t=2

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { createHuman, randomHumanParams } from '../src/character/index.js';
import { ACTION_NAMES } from '../src/character/anim/actions.js';
import { EXPRESSIONS, VISEMES } from '../src/character/anim/face.js';
import { mat } from '../src/gfx/materials.js';
import { worldUV } from '../src/gfx/geom.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { i18n, t } from '../src/core/i18n.js';
import { el, injectStyle, damp } from '../src/core/util.js';

i18n.register('devchar', {
  en: { title: 'People', sub: 'procedural humans', expr: 'Expression', vis: 'Viseme', help: 'Drag orbit · wheel zoom · keys play actions · E expression · V visemes · W walkers · D grime · O outfits · R people · H hide', build: 'Built in' },
  es: { title: 'Gente', sub: 'humanos procedurales', expr: 'Expresión', vis: 'Visema', help: 'Arrastrar orbitar · rueda zoom · teclas acciones · E expresión · V visemas · W caminantes · D suciedad · O ropa · R gente · H ocultar', build: 'Generado en' },
});

injectStyle('dev-char', `
  .dch-panel { position:absolute; left:calc(14px + var(--safe-left, 0px)); top:calc(14px + var(--safe-top, 0px));
    max-width:330px; padding:12px 14px 11px; border-radius:10px; color:#f3ead8; pointer-events:none;
    background:linear-gradient(160deg, rgba(20,16,14,.8), rgba(8,7,9,.72)); border:1px solid rgba(216,178,90,.35);
    box-shadow:0 10px 30px rgba(0,0,0,.45); font:500 12px/1.4 var(--font-ui); }
  .dch-title { font:400 24px/1 var(--font-display); letter-spacing:.06em; color:#e8c46a; }
  .dch-sub { opacity:.65; font-size:11px; letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }
  .dch-keys { display:grid; grid-template-columns:auto 1fr; gap:1px 8px; margin:6px 0; font-size:11px; }
  .dch-k { color:#e8c46a; font-weight:700; }
  .dch-state { margin:6px 0; font-size:12px; }
  .dch-help { opacity:.55; font-size:10.5px; }
`);

const KEYMAP = ['wave', 'cheer', 'shrug', 'facepalm', 'knock', 'drink', 'phone-up', 'phone-down', 'sit', 'stand', 'stretch', 'yawn'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const EXTRA = { f: 'flip-off', g: 'pat-pockets', j: 'eat', k: 'pull-lever', l: 'toss-chips', p: 'peek-cards', t: 'throw-dice', u: 'stumble', y: 'wave-off', z: 'tap-table', x: 'reach', c: 'get-up-floor' };
const EXPR = Object.keys(EXPRESSIONS).slice(0, 10);
const VIS = Object.keys(VISEMES);

// Lineup casting: a believable street-corner crowd.
const CAST = [
  { sex: 'f', uniform: 'dealer', age: 34, skinTone: 0.78, hairStyle: 'bun', fat: 0.25 },
  { sex: 'm', uniform: 'security', age: 52, fat: 0.8, belly: 0.9, skinTone: 0.35, hairStyle: 'buzz', facialHair: 'mustache', glasses: 'aviator' },
  { sex: 'x', uniform: 'clerk', age: 23, skinTone: 0.55, hairStyle: 'messy', fat: 0.1 },
  { sex: 'f', age: 81, fat: 0.35, skinTone: 0.12, hairStyle: 'bob', gray: 1, top: 'button', glasses: 'reading' },
  { sex: 'm', age: 24, fat: 0.08, muscle: 0.4, skinTone: 0.93, hairStyle: 'afro', top: 'tshirt', print: 'dice', bottom: 'jeans' },
  { sex: 'f', age: 44, fat: 0.85, chest: 0.85, skinTone: 0.45, hairStyle: 'long-wavy', top: 'dress', topColor: 'teal' },
  { sex: 'm', age: 36, fat: 0.15, muscle: 0.95, shoulders: 0.9, skinTone: 0.62, hairStyle: 'crew', top: 'tank', topColor: 'white', bottom: 'cargo', hat: 'cowboy', hatColor: 'tan', shoes: 'cowboy', shoesColor: 'brown' },
  { sex: 'x', age: 29, fat: 0.3, skinTone: 0.25, hairStyle: 'mohawk', hairColor: 'dyed-pink', outer: 'leather-jacket', outerColor: 'black', top: 'tshirt', topColor: 'white' },
];

class CharacterDev {
  constructor(e) {
    this.engine = e;
  }

  async enter(q) {
    const e = this.engine;
    this.q = q;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(0x9fb4c8);
    scene.fog = new THREE.Fog(0x9fb4c8, 18, 60);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;
    // Late-afternoon sun, sky fill and a warm bounce from the pavement.
    const sun = new THREE.DirectionalLight(0xffe2bd, 3.1);
    sun.position.set(-4, 6.5, 5);
    sun.castShadow = e.tier.shadows;
    sun.shadow.mapSize.setScalar(e.tier.shadowMapSize || 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xbcd4ff, 1.1);
    rim.position.set(5, 3, -6);
    scene.add(sun, rim, new THREE.HemisphereLight(0xc9dcff, 0x8a7a66, 0.75));
    this._street(scene);

    this.focus = +(q.i || 0);
    this.view = q.view || 'lineup';
    this.walkOn = q.walk !== '0';
    this.exprIdx = 0;
    this.visOn = false;
    this.dirty = false;
    this.seed = +(q.seed || 7);
    this.n = this.view === 'face' ? 1 : +(q.n || 8);
    this.humans = [];
    this._spawn();

    // Camera + simple orbit.
    const cam = new THREE.PerspectiveCamera(this.view === 'face' ? 22 : 32, 1, 0.02, 120);
    this.cam = cam;
    if (this.view === 'face') {
      this.orbit = { yaw: +(q.yaw || 0.25), pitch: +(q.pitch || 0.02), dist: +(q.dist || 0.75), target: new THREE.Vector3() };
    } else {
      this.orbit = { yaw: +(q.yaw || 0.55), pitch: +(q.pitch || 0.12), dist: +(q.dist || 9.5), target: new THREE.Vector3(0, 0.95, 0.4) };
    }
    this._bindInput();
    this._panel();
    e.setView(scene, cam);
    this.time = 0;
    if (q.expr) this.humans.forEach((h) => h.human.setExpression(q.expr, 1));
    if (q.action) setTimeout(() => this._playAll(q.action), +(q.t || 0.5) * 1000);
    window.__humans = this.humans.map((h) => h.human);
    window.__info = this.humans.map((h) => ({ ms: +h.human.buildMs.toFixed(0), t: Object.fromEntries(Object.entries(h.human.timing).map(([k, v]) => [k, +v.toFixed(0)])) }));
  }

  _street(scene) {
    // Asphalt street (z < 0) and a 15 cm sidewalk (z > 0) with a curb face.
    const asphalt = mat('asphalt', { wear: 0.5, dirt: 0.3 });
    const walk = mat('sidewalk', { wear: 0.4, dirt: 0.25 });
    const curbM = mat('curb', { wear: 0.6 });
    const g1 = new THREE.PlaneGeometry(40, 20).rotateX(-Math.PI / 2).translate(0, 0, -10);
    worldUV(g1, asphalt.userData.tileMeters);
    const street = new THREE.Mesh(g1, asphalt);
    street.receiveShadow = true;
    const g2 = new THREE.BoxGeometry(40, 0.15, 12).translate(0, 0.075, 6);
    worldUV(g2, walk.userData.tileMeters);
    const side = new THREE.Mesh(g2, walk);
    side.receiveShadow = true;
    side.castShadow = true;
    const g3 = new THREE.BoxGeometry(40, 0.16, 0.16).translate(0, 0.08, 0.08);
    worldUV(g3, curbM.userData.tileMeters);
    const curb = new THREE.Mesh(g3, curbM);
    curb.receiveShadow = true;
    curb.castShadow = true;
    scene.add(street, side, curb);
  }

  ground(x, z) {
    return z > 0.0 ? 0.15 : 0;
  }

  _spawn() {
    for (const h of this.humans) h.human.dispose();
    this.humans = [];
    const tier = this.q.tier || this.engine.tier;
    for (let i = 0; i < this.n; i++) {
      const idx = this.view === 'face' ? this.focus : i;
      const cast = CAST[idx % CAST.length];
      const { uniform, sex, ...rest } = cast;
      const p = randomHumanParams(this.seed * 101 + idx * 7, { sex, uniform, ...rest });
      const human = createHuman(p, { tier, hero: this.view === 'face' });
      const walker = this.view !== 'face' && i >= 4;
      const x = walker ? (i - 5.5) * 1.4 : (i - 1.5) * 1.05;
      const z = walker ? -2 + (i % 2) * 3.5 : 1.3;
      human.root.position.set(x, this.ground(x, z), z);
      human.root.rotation.y = walker ? (i % 2 ? Math.PI : 0) : 0;
      human.setFootIK((fx, fy, fz) => ({ y: this.ground(fx, fz), normal: new THREE.Vector3(0, 1, 0) }));
      this.scene.add(human.root);
      this.humans.push({ human, walker, dir: i % 2 ? -1 : 1, x, turn: 0, speed: 1.15 + (i % 3) * 0.2 });
    }
  }

  _playAll(name) {
    for (const h of this.humans) if (!h.walker || ['wave', 'cheer', 'shrug', 'phone-up', 'phone-down', 'drink', 'stumble', 'wave-off', 'flip-off', 'pat-pockets'].includes(name)) h.human.play(name, { side: 'R' });
    this.lastAction = name;
    this._refreshPanel();
  }

  _bindInput() {
    const c = this.engine.renderer.domElement;
    let drag = null;
    this._down = (ev) => (drag = { x: ev.clientX, y: ev.clientY });
    this._move = (ev) => {
      if (!drag) return;
      this.orbit.yaw -= (ev.clientX - drag.x) * 0.006;
      this.orbit.pitch = Math.max(-0.5, Math.min(1.2, this.orbit.pitch + (ev.clientY - drag.y) * 0.004));
      drag = { x: ev.clientX, y: ev.clientY };
    };
    this._up = () => (drag = null);
    this._wheel = (ev) => (this.orbit.dist = Math.max(0.3, Math.min(30, this.orbit.dist * (ev.deltaY > 0 ? 1.1 : 0.9))));
    this._key = (ev) => {
      const k = ev.key.toLowerCase();
      const ki = KEYS.indexOf(ev.key);
      if (ki >= 0) this._playAll(KEYMAP[ki]);
      else if (EXTRA[k]) this._playAll(EXTRA[k]);
      else if (k === 'e') {
        this.exprIdx = (this.exprIdx + 1) % EXPR.length;
        for (const h of this.humans) {
          h.human.setExpression('neutral');
          h.human.setExpression(EXPR[this.exprIdx], 1);
        }
      } else if (k === 'v') this.visOn = !this.visOn;
      else if (k === 'w') this.walkOn = !this.walkOn;
      else if (k === 'd') {
        this.dirty = !this.dirty;
        for (const h of this.humans) {
          h.human.setDirtiness(this.dirty ? 0.9 : 0.1);
          h.human.setBruises({ eye: this.dirty ? 0.8 : 0, knuckles: this.dirty ? 0.7 : 0 });
          h.human.setSweat(this.dirty ? 0.8 : 0);
        }
      } else if (k === 'o') {
        for (const h of this.humans) {
          const r = randomHumanParams(Math.random() * 1e9);
          h.human.setOutfit({ top: r.top, topColor: r.topColor, bottom: r.bottom, bottomColor: r.bottomColor, shoes: r.shoes, outer: r.outer, outerColor: r.outerColor, print: r.print });
        }
      } else if (k === 'r') {
        this.seed++;
        this._spawn();
      } else if (k === 'h') this.panel.style.display = this.panel.style.display === 'none' ? '' : 'none';
      this._refreshPanel();
    };
    c.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    c.addEventListener('wheel', this._wheel, { passive: true });
    window.addEventListener('keydown', this._key);
  }

  _panel() {
    const keys = el('div', { class: 'dch-keys' });
    KEYMAP.forEach((a, i) => keys.append(el('span', { class: 'dch-k' }, KEYS[i]), el('span', {}, a)));
    for (const [k, a] of Object.entries(EXTRA)) keys.append(el('span', { class: 'dch-k' }, k.toUpperCase()), el('span', {}, a));
    this.stateEl = el('div', { class: 'dch-state' });
    this.panel = el('div', { class: 'dch-panel' }, [el('div', { class: 'dch-title' }, t('devchar.title')), el('div', { class: 'dch-sub' }, t('devchar.sub')), this.stateEl, keys, el('div', { class: 'dch-help' }, t('devchar.help'))]);
    if (this.q.panel === '0') this.panel.style.display = 'none';
    this.engine.uiRoot.append(this.panel);
    this._refreshPanel();
  }

  _refreshPanel() {
    if (!this.stateEl) return;
    const ms = this.humans.map((h) => h.human.buildMs);
    const avg = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
    this.stateEl.textContent = `${t('devchar.expr')}: ${EXPR[this.exprIdx]} · ${this.visOn ? t('devchar.vis') + ' ✓ · ' : ''}${this.lastAction || ''} · ${t('devchar.build')} ${avg.toFixed(0)} ms`;
  }

  update(dt) {
    this.time += dt;
    for (const h of this.humans) {
      const r = h.human.root;
      if (h.walker && this.walkOn) {
        // Walk across the curb, turn around at each end (gameplay-style root motion).
        if (h.turn > 0) {
          h.turn -= dt;
          r.rotation.y += (Math.PI / 1.1) * dt;
          h.human.setLocomotion({ speed: 0, turnRate: Math.PI / 1.1 });
        } else {
          const fwd = new THREE.Vector3(Math.sin(r.rotation.y), 0, Math.cos(r.rotation.y));
          r.position.addScaledVector(fwd, h.speed * dt);
          h.human.setLocomotion({ speed: h.speed, turnRate: 0 });
          if ((r.position.z > 3.2 && fwd.z > 0) || (r.position.z < -3.2 && fwd.z < 0)) h.turn = 1.1;
        }
        r.position.y = damp(r.position.y, this.ground(r.position.x, r.position.z), 0.06, dt);
      } else h.human.setLocomotion({ speed: 0, turnRate: 0 });
      if (this.view === 'face') {
        // Cycle expressions every 1.8 s, visemes when V is on; look at the camera.
        h.human.lookAt(this.cam.position);
        const step = Math.floor(this.time / 1.8);
        if (step !== this._step && !this.q.expr) {
          this._step = step;
          h.human.setExpression('neutral');
          h.human.setExpression(EXPR[step % EXPR.length], 1);
          this.exprIdx = step % EXPR.length;
          this._refreshPanel();
        }
      }
      if (this.visOn) {
        const v = VIS[Math.floor(this.time * 7) % VIS.length];
        h.human.setViseme(v, 1);
      }
      h.human.update(dt);
    }
    // Camera orbit.
    const o = this.orbit;
    if (this.view === 'face') {
      const hb = this.humans[0].human.bones;
      hb['eye.L'].getWorldPosition(o.target).add(hb['eye.R'].getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
      o.target.y -= 0.035;
    }
    this.cam.position.set(
      o.target.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist,
      o.target.y + Math.sin(o.pitch) * o.dist,
      o.target.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist,
    );
    this.cam.lookAt(o.target);
  }

  onResize(w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  exit() {
    for (const h of this.humans) h.human.dispose();
    const c = this.engine.renderer.domElement;
    c.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    c.removeEventListener('wheel', this._wheel);
    window.removeEventListener('keydown', this._key);
  }
}

runState(CharacterDev);
