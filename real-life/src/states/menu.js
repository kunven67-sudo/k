// Main menu (master list §34): a kid's bedroom at night. Rain runs down the window, the street
// light buzzes outside, now and then a car hisses past on the wet road. The REAL LIFE logo is
// printed on a store receipt that unrolls. Continue / New life / Lives / Settings.
//
// The new life screen turns the camera around: your family stands in the room like a family
// photo and changes live while you pick (parents' looks, names, how strict they are, how much
// money, a brother or sister). Your own look comes from your parents' genes.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { el, injectStyle } from '../core/util.js';
import { save } from '../core/save.js';
import { clock } from '../core/clock.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { Rng } from '../core/rng.js';
import { assets } from '../gfx/assets.js';
import { music } from '../audio/music/index.js';
import { Person, preloadPeople } from '../people/person.js';
import { randomLook, childLook } from '../people/look.js';
import { openSettings } from '../ui/settings.js';
import { openPanel, row, closeTopPanel, panelOpen } from '../ui/panel.js';

injectStyle('menu', `
.mm { position: fixed; inset: 0; pointer-events: none; font-family: var(--font-ui); }
.mm > * { pointer-events: auto; }
.mm-left { position: absolute; left: 6vw; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 22px; width: min(360px, 80vw); }
.receipt { position: relative; background: #fbfaf5; color: #222; width: 300px; padding: 0 22px; font: 500 13px/1.45 'Courier New', ui-monospace, monospace; box-shadow: 0 18px 40px rgba(0,0,0,.45);
  overflow: hidden; max-height: 0; transition: max-height 2.2s cubic-bezier(.3,.7,.2,1); transform: rotate(-1.6deg); }
.receipt.on { max-height: 520px; }
.receipt::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 10px; background: linear-gradient(-45deg, transparent 6px, #fbfaf5 0) 0 0/12px 12px, linear-gradient(45deg, transparent 6px, #fbfaf5 0) 0 0/12px 12px; transform: rotate(180deg); }
.receipt .in { padding: 20px 0 26px; }
.receipt .c { text-align: center; }
.receipt .big { font: 900 54px/0.95 'Courier New', ui-monospace, monospace; letter-spacing: -2px; margin: 10px 0 6px; text-align: center; color: #111; }
.receipt .ln { display: flex; justify-content: space-between; }
.receipt .rule { border-top: 1.5px dashed #999; margin: 8px 0; }
.receipt .bars { height: 46px; margin: 10px auto 4px; width: 220px; background: repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 7px, transparent 7px 8px, #111 8px 9px, transparent 9px 12px, #111 12px 15px, transparent 15px 17px); }
.mm-btns { display: flex; flex-direction: column; gap: 9px; }
.mm-btn { text-align: left; padding: 13px 18px; border-radius: 14px; border: 0; background: rgba(255,255,255,.1); color: #fff; font: 600 17px var(--font-round); cursor: pointer;
  backdrop-filter: blur(8px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); transition: background .15s, transform .1s; }
.mm-btn:hover { background: rgba(255,255,255,.2); transform: translateX(3px); }
.mm-btn.go { background: var(--accent); box-shadow: none; }
.mm-btn.go:hover { background: #f06a48; }
.mm-btn small { display: block; font: 500 12.5px var(--font-ui); opacity: .75; margin-top: 2px; }
.mm-foot { position: absolute; right: 18px; bottom: 14px; color: rgba(255,255,255,.55); font: 500 12px var(--font-ui); }
.nl { position: absolute; right: 3vw; top: 3vh; bottom: 3vh; width: min(430px, 92vw); background: rgba(251,248,241,.97); color: var(--ink); border-radius: 22px; box-shadow: 0 24px 60px rgba(0,0,0,.45);
  display: flex; flex-direction: column; overflow: hidden; animation: rlPop .25s ease both; }
.nl h2 { margin: 0; padding: 18px 20px 4px; font: 700 22px var(--font-round); }
.nl .sub { padding: 0 20px 8px; color: var(--muted); font: 500 13px var(--font-ui); }
.nl-body { flex: 1; overflow-y: auto; padding: 4px 20px 12px; }
.nl-sec { margin: 12px 0 6px; font: 700 12px var(--font-ui); letter-spacing: .06em; text-transform: uppercase; color: #8a8478; }
.nl-row { display: flex; gap: 8px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
.nl-row input { flex: 1; min-width: 120px; padding: 9px 11px; border-radius: 10px; border: 1px solid #e3dccd; font: 500 14px var(--font-ui); background: #fff; }
.nl-chip { padding: 7px 11px; border-radius: 999px; border: 1px solid #e3dccd; background: #fff; font: 600 12.5px var(--font-ui); cursor: pointer; color: var(--ink); }
.nl-chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.nl-note { color: #6d6774; font: 500 12.5px/1.4 var(--font-ui); margin: 4px 0; }
.nl-sw { display: inline-block; width: 16px; height: 16px; border-radius: 50%; vertical-align: -3px; margin: 0 3px 0 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
.nl-foot { display: flex; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid #e8e1d3; }
.nl-foot button { flex: 1; padding: 12px; border-radius: 12px; border: 0; font: 600 14px var(--font-ui); cursor: pointer; background: var(--paper-2); color: var(--ink); }
.nl-foot button.go { background: var(--accent); color: #fff; }
`);

const RAIN_GLASS = {
  uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(0x1d2b44) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime; uniform vec3 uTint;
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    // One layer of drops: still beads + drops that slide down with a trail.
    float layer(vec2 uv, float t, float sc){
      vec2 a = vec2(6.0,2.0) * sc;
      vec2 st = uv * a; st.y += t*0.22;
      vec2 id = floor(st); vec2 f = fract(st) - 0.5;
      float n = h21(id);
      float x = (n-0.5)*0.7;
      float ti = fract(t*0.25 + n*6.28);
      float y = -sin(ti*6.2831 + sin(ti*6.2831)*0.5)*0.43;
      vec2 p = (f - vec2(x, y)) / vec2(1.0, a.x/a.y*0.35);
      float drop = smoothstep(0.09, 0.05, length(p));
      float trail = smoothstep(0.05, 0.02, abs(f.x - x)) * smoothstep(-0.05, 0.05, f.y - y) * smoothstep(0.5, y, f.y) * 0.45;
      vec2 sid = floor(uv*vec2(40.0,24.0)*sc); vec2 sf = fract(uv*vec2(40.0,24.0)*sc)-0.5;
      float bead = smoothstep(0.18, 0.1, length(sf - (vec2(h21(sid), h21(sid+7.1))-0.5)*0.6)) * step(0.82, h21(sid+3.3));
      return drop + trail + bead*0.6;
    }
    void main(){
      float t = uTime;
      float d = layer(vUv, t, 1.0) + layer(vUv*1.7+0.3, t*1.1, 1.0)*0.7;
      float fog = 0.18 + 0.1*sin(vUv.y*3.0 + t*0.1);
      vec3 col = uTint * (0.25 + d*0.9) + vec3(0.65,0.75,0.9) * d * 0.35;
      gl_FragColor = vec4(col, clamp(fog + d*0.55, 0.0, 0.75));
    }`,
};

export class MenuState {
  constructor(engine) {
    this.engine = engine;
    this.t = 0;
    this.people = [];
  }

  async enter() {
    const e = this.engine;
    save.close();
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 18, 60);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.12;
    const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 200);
    cam.position.set(0.55, 1.32, 2.5);
    this.cam = cam;
    this.camLook = new THREE.Vector3(-0.15, 1.28, 0);
    this.camGoal = { pos: cam.position.clone(), look: this.camLook.clone() };
    await assets.preload([
      ['home', 'Curtains_Double'], ['home', 'Houseplant_3'], ['home', 'Light_Desk'], ['home', 'Carpet_Round'], ['furniture', 'bear'],
      ['autos', 'NormalCar1'], ['nature', 'tree_oak'], ['nature', 'tree_default'], ['roads', 'light-curved'],
    ]);
    this._room(scene);
    this._outside(scene);
    e.setView(scene, cam);
    this._ui();
    try {
      this.rain = audio.play('amb.rain', { bus: 'ambience', loop: true, gain: 0.55, reverb: 0.1 });
    } catch {
      /* audio locked until first click */
    }
    music.play('menu-lounge', { fade: 3, gain: 0.55 });
    input.setPointerLock?.(false);
    preloadPeople(); // warm up for the new life screen
    this.ready = true;
  }

  // ------------------------------------------------------------------ the bedroom
  _room(scene) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x55657a, roughness: 0.92 });
    const W = 4.4;
    const H = 2.7;
    const win = { w: 1.7, h: 1.35, sill: 0.82, x: -0.15 };
    const box = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    // Window wall (z = 0) with the opening.
    const L = win.x - win.w / 2;
    const R = win.x + win.w / 2;
    box(L + W / 2, H, 0.18, (-W / 2 + L) / 2, H / 2, 0, wallMat);
    box(W / 2 - R, H, 0.18, (R + W / 2) / 2, H / 2, 0, wallMat);
    box(win.w, win.sill, 0.18, win.x, win.sill / 2, 0, wallMat);
    box(win.w, H - win.sill - win.h, 0.18, win.x, (H + win.sill + win.h) / 2, 0, wallMat);
    // Side walls, floor, ceiling, back wall.
    const side = new THREE.MeshStandardMaterial({ color: 0x4b596b, roughness: 0.95 });
    box(0.1, H, 6, -W / 2, H / 2, 3, side);
    box(0.1, H, 6, W / 2, H / 2, 3, side);
    box(W, 0.1, 6, 0, H, 3, new THREE.MeshStandardMaterial({ color: 0x3e4756, roughness: 1 }));
    box(W, 0.1, 6, 0, -0.05, 3, new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.7 }));
    box(W, H, 0.1, 0, H / 2, 6, side);
    // Frame + mullions + sill board.
    const frame = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6 });
    box(win.w + 0.12, 0.07, 0.22, win.x, win.sill + win.h + 0.03, 0, frame);
    box(win.w + 0.2, 0.05, 0.32, win.x, win.sill - 0.01, 0.06, frame);
    box(0.07, win.h, 0.22, L - 0.03, win.sill + win.h / 2, 0, frame);
    box(0.07, win.h, 0.22, R + 0.03, win.sill + win.h / 2, 0, frame);
    box(0.045, win.h, 0.06, win.x, win.sill + win.h / 2, 0.02, frame);
    box(win.w, 0.045, 0.06, win.x, win.sill + win.h * 0.55, 0.02, frame);
    // Rainy glass.
    this.glassMat = new THREE.ShaderMaterial({ ...RAIN_GLASS, uniforms: THREE.UniformsUtils.clone(RAIN_GLASS.uniforms), transparent: true, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), this.glassMat);
    glass.position.set(win.x, win.sill + win.h / 2, 0.03);
    scene.add(glass);
    // Curtains, plant, desk + lamp, bear, bed behind you.
    const put = (kit, name, x, y, z, ry = 0, s = null) => {
      const m = assets.model(kit, name, s ? { scale: s } : {});
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      scene.add(m);
      return m;
    };
    put('home', 'Curtains_Double', win.x, win.sill + win.h + 0.12, 0.14, 0);
    put('home', 'Houseplant_3', win.x + 0.55, win.sill + 0.02, 0.1, 0.4);
    put('furniture', 'bear', win.x - 0.55, win.sill + 0.02, 0.1, 0.5, 1.4);
    put('home', 'Carpet_Round', -0.2, 0.005, 4.2, 0);
    // Warm light for the family photo (on while you pick your family).
    this.photoLight = new THREE.SpotLight(0xffe2c0, 0, 8, 0.7, 0.6, 1.2);
    this.photoLight.position.set(0.3, 2.3, 1.4);
    this.photoLight.target.position.set(0.2, 1.0, 4.4);
    scene.add(this.photoLight, this.photoLight.target);
    // Warm desk lamp + cold street glow through the window.
    const lamp = new THREE.PointLight(0xffc27a, 3.2, 6, 1.6); // desk lamp just out of frame
    lamp.position.set(2.0, 1.15, 0.9);
    lamp.castShadow = true;
    scene.add(lamp);
    const fill = new THREE.HemisphereLight(0x5d7090, 0x2a2018, 0.35);
    scene.add(fill);
    const moon = new THREE.SpotLight(0x9fb8ff, 6, 14, 0.5, 0.8, 1.5);
    moon.position.set(win.x + 2, 4, -6);
    moon.target.position.set(win.x, 0.6, 2);
    scene.add(moon, moon.target);
    // Posters on the side wall.
    for (const [i, col] of [[0, '#d24c3c'], [1, '#2f6db5']]) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 360;
      const x = c.getContext('2d');
      x.fillStyle = col;
      x.fillRect(0, 0, 256, 360);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.font = 'bold 44px sans-serif';
      x.textAlign = 'center';
      x.fillText(i ? 'SPACE' : 'DINO', 128, 70);
      x.beginPath();
      x.arc(128, 210, 70, 0, Math.PI * 2);
      x.fillStyle = 'rgba(255,255,255,.25)';
      x.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.77), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      p.position.set(W / 2 - 0.06, 1.55, 1.2 + i * 0.8);
      p.rotation.y = -Math.PI / 2;
      scene.add(p);
    }
  }

  // ------------------------------------------------------------------ outside: the street at night
  _outside(scene) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ color: 0x1d2a1d, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -30);
    scene.add(ground);
    // Wet road: low roughness so the street light + headlights streak on it.
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 7.5), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.18, metalness: 0.2 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -16);
    scene.add(road);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(120, 1.6), new THREE.MeshStandardMaterial({ color: 0x3c3e42, roughness: 0.4 }));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.01, -11.4);
    scene.add(walk);
    // Houses across the street with a few lit windows.
    const houseMat = [0x6b6a64, 0x5c6470, 0x6f6152].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 });
    const lit = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc47a, emissiveIntensity: 1.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.2 });
    [-14, -2, 10].forEach((x, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 7), houseMat[i]);
      body.position.y = 1.7;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 6.2, 2.2, 4, 1), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1.05, 1, 0.82);
      roof.position.y = 4.5;
      g.add(roof);
      for (const [wx, on] of [[-2.6, i !== 1], [0.4, false], [2.8, i === 1]]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), on ? lit : dark);
        w.position.set(wx, 1.9, 3.51);
        g.add(w);
      }
      g.position.set(x, 0, -25);
      scene.add(g);
    });
    // Trees + street light.
    for (const [x, z, n] of [[-8, -21, 'tree_oak'], [5, -22, 'tree_default'], [16, -21, 'tree_oak'], [-20, -22, 'tree_default']]) {
      const t = assets.model('nature', n);
      t.position.set(x, 0, z);
      t.rotation.y = x;
      scene.add(t);
    }
    const pole = assets.model('roads', 'light-curved');
    pole.position.set(1.5, 0, -11.9);
    pole.rotation.y = Math.PI;
    scene.add(pole);
    const sl = new THREE.SpotLight(0xffb36b, 40, 22, 0.9, 0.6, 1.6);
    sl.position.set(1.5, 5.6, -13.6);
    sl.target.position.set(1.5, 0, -15);
    scene.add(sl, sl.target);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    glow.position.set(1.5, 5.45, -13.6);
    glow.scale.set(2.2, 2.2, 1);
    scene.add(glow);
    // Rain streaks outside.
    const N = 1400;
    const pos = new Float32Array(N * 6);
    this.rainSeeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.rainSeeds[i * 3] = (Math.random() - 0.5) * 40;
      this.rainSeeds[i * 3 + 1] = Math.random() * 12;
      this.rainSeeds[i * 3 + 2] = -2 - Math.random() * 26;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb2cc, transparent: true, opacity: 0.32 }));
    this.rainLines.frustumCulled = false;
    scene.add(this.rainLines);
    // The passing car (headlights + tail lights).
    const car = assets.model('autos', 'NormalCar1');
    car.rotation.y = Math.PI / 2;
    const carG = new THREE.Group();
    carG.add(car);
    const hl = new THREE.SpotLight(0xfff2d6, 60, 30, 0.45, 0.5, 1.4);
    hl.position.set(2.2, 0.7, 0);
    hl.target.position.set(12, 0, 0);
    carG.add(hl, hl.target);
    for (const dz of [-0.6, 0.6]) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      tail.position.set(-2.15, 0.75, dz);
      carG.add(tail);
      const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff2d6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      head.position.set(2.25, 0.65, dz);
      head.scale.set(0.7, 0.7, 1);
      carG.add(head);
    }
    carG.position.set(-60, 0.02, -17.5);
    scene.add(carG);
    this.car = carG;
    this.carT = 4;
  }

  // ------------------------------------------------------------------ UI
  _ui() {
    const e = this.engine;
    const root = el('div', { class: 'mm' });
    this.root = root;
    const slots = save.slots();
    const last = slots.find((s) => s.id === save.lastSlotId()) || slots[0];
    const receipt = el('div', { class: 'receipt' }, [
      el('div', { class: 'in' }, [
        el('div', { class: 'c' }, ['MAPLE HOLLOW GENERAL #0109']),
        el('div', { class: 'c' }, ['109 MAPLE ST  MAPLE HOLLOW OH']),
        el('div', { class: 'rule' }),
        el('div', { class: 'big' }, ['REAL', el('br'), 'LIFE']),
        el('div', { class: 'rule' }),
        el('div', { class: 'ln' }, [el('span', {}, ['1  BIRTH']), el('span', {}, ['$0.00'])]),
        el('div', { class: 'ln' }, [el('span', {}, ['1  CHILDHOOD']), el('span', {}, ['$0.00'])]),
        el('div', { class: 'ln' }, [el('span', {}, ['1  EVERYTHING ELSE']), el('span', {}, ['TBD'])]),
        el('div', { class: 'rule' }),
        el('div', { class: 'ln' }, [el('span', {}, ['SALES TAX 7.25%']), el('span', {}, ['$0.00'])]),
        el('div', { class: 'ln', style: 'font-weight:700' }, [el('span', {}, ['TOTAL']), el('span', {}, ['1 LIFE'])]),
        el('div', { class: 'bars' }),
        el('div', { class: 'c', style: 'font-size:11px' }, ['NO REFUNDS. NO RETURNS. ONE PER CUSTOMER.']),
      ]),
    ]);
    setTimeout(() => {
      receipt.classList.add('on');
      audio.play?.('slot.ticket-print', { bus: 'ui', gain: 0.4 });
    }, 500);
    const btns = el('div', { class: 'mm-btns' }, [
      last ? el('button', { class: 'mm-btn go', onclick: () => this._continue(last.id) }, [`Continue`, el('small', {}, [`${last.name}, age ${last.age} · ${last.dateText || ''}`])]) : null,
      el('button', { class: `mm-btn ${last ? '' : 'go'}`, onclick: () => this._newLife() }, ['New life', el('small', {}, ['Pick your family. Get born.'])]),
      slots.length ? el('button', { class: 'mm-btn', onclick: () => this._lives() }, ['Lives', el('small', {}, [`${slots.length} saved`])]) : null,
      el('button', { class: 'mm-btn', onclick: () => openSettings() }, ['Settings']),
      el('button', { class: 'mm-btn', onclick: () => this._credits() }, ['Credits']),
    ]);
    this.left = el('div', { class: 'mm-left' }, [receipt, btns]);
    root.append(this.left, el('div', { class: 'mm-foot' }, ['REAL LIFE · first playable']));
    e.uiRoot.appendChild(root);
    // First click unlocks audio: start the rain then.
    window.addEventListener('pointerdown', () => !this.rain && (this.rain = audio.play('amb.rain', { bus: 'ambience', loop: true, gain: 0.55, reverb: 0.1 })), { once: true });
  }

  _continue(id) {
    if (!save.loadLife(id)) return;
    this.engine.go(save.life.opening && save.life.opening !== 'done' ? 'birth' : 'world');
  }

  _lives() {
    const p = openPanel({ title: 'Lives', sub: 'One save per life. Dying is forever.' });
    const render = () => {
      const slots = save.slots();
      const obits = save.obituaries();
      p.setBody([
        el('div', { class: 'rl-list' }, slots.map((s) => row(`${s.name}, age ${s.age}`, `${s.town} · ${s.dateText || ''}`, [
          { text: 'Play', onClick: () => (p.close(), this._continue(s.id)) },
          { text: 'Backup', soft: true, onClick: () => save.download(s.id) },
          { text: 'Delete', soft: true, onClick: () => confirmDelete(s, render) },
        ]))),
        obits.length ? el('p', { class: 'rl-note', style: 'margin-top:14px' }, ['Lives that ended:']) : null,
        el('div', { class: 'rl-list' }, obits.slice(0, 8).map((o) => row(`${o.character?.name || 'Someone'} (${o.ageYears})`, o.cause || 'Rest in peace', []))),
      ]);
    };
    render();
    const file = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    file.onchange = async () => {
      try {
        await save.upload(file.files[0]);
        render();
      } catch (err) {
        p.setBody([el('p', { class: 'rl-note' }, [err.message])]);
      }
    };
    p.el.appendChild(file);
    p.setButtons([{ text: 'Load a backup file', onClick: () => file.click() }, { text: 'Close', kind: 'go', onClick: () => p.close() }]);
  }

  _credits() {
    const p = openPanel({ title: 'Credits', sub: 'REAL LIFE' });
    p.setBody([
      el('p', { class: 'rl-note' }, ['Game idea + every big decision: ven/jason.']),
      el('p', { class: 'rl-note' }, ['Built with three.js and Rapier physics.']),
      el('p', { class: 'rl-note' }, ['3D people, cars and house furniture: Quaternius (CC0). Street, food, store and furniture models: Kenney (CC0). Full list in THIRD_PARTY_LICENSES.md.']),
      el('p', { class: 'rl-note' }, ['All brands in the game are parodies. Any resemblance to real stores is for laughs.']),
    ]);
    p.setButtons([{ text: 'Close', kind: 'go', onClick: () => p.close() }]);
  }

  // ------------------------------------------------------------------ new life
  async _newLife() {
    await preloadPeople();
    this.left.style.display = 'none';
    // Camera turns to the room: the family stands by the bed like a photo.
    this.camGoal = { pos: new THREE.Vector3(0.35, 1.3, 0.75), look: new THREE.Vector3(-0.35, 1.0, 4.6) };
    this.photoLight.intensity = 2.4;
    const rng = new Rng((Date.now() % 100000) + 1);
    const st = {
      you: { name: '', sex: rng.pick(['m', 'f']) },
      type: 'mom+dad',
      a: { name: 'Karen', look: randomLook(rng, { sex: 'f', age: 35 }), style: 'chill' },
      b: { name: 'Mike', look: randomLook(rng, { sex: 'm', age: 37 }), style: 'strict' },
      wealth: 'middle',
      sibling: 'none',
      seed: rng.int(1, 99999),
      last: rng.pick(['Miller', 'Johnson', 'Carter', 'Nguyen', 'Garcia', 'Patel', 'Kowalski', 'Brooks', 'Reed', 'Hoffman']),
    };
    const NAMES = { f: ['Emma', 'Olivia', 'Ava', 'Mia', 'Zoe', 'Lily', 'Chloe', 'Maya', 'Aaliyah', 'Sofia'], m: ['Alex', 'Liam', 'Noah', 'Mason', 'Ethan', 'Jayden', 'Owen', 'Diego', 'Caleb', 'Marcus'] };
    const P_NAMES = { f: ['Karen', 'Linda', 'Jennifer', 'Amy', 'Melissa', 'Nicole', 'Tasha', 'Maria', 'Priya', 'Rachel'], m: ['Mike', 'Dave', 'Chris', 'Jason', 'Brian', 'Kevin', 'Marcus', 'Carlos', 'Raj', 'Tom'] };
    const panel = el('div', { class: 'nl' });
    this.root.appendChild(panel);
    const childOf = () => {
      const r = new Rng(st.seed);
      const mom = st.a.look;
      const dad = st.b.look;
      return childLook(r, mom, dad, st.you.sex);
    };
    const typeSex = () => ({ 'mom+dad': ['f', 'm'], mom: ['f', null], dad: ['m', null], 'two moms': ['f', 'f'], 'two dads': ['m', 'm'] })[st.type];
    const rerollParent = (k, sex) => {
      st[k].look = randomLook(new Rng(rng.int(1, 1e6)), { sex, age: 36 });
      st[k].name = rng.pick(P_NAMES[sex]);
    };
    const chips = (list, cur, set) => el('div', { class: 'nl-row' }, list.map(([v, label]) => el('button', { class: `nl-chip ${cur === v ? 'on' : ''}`, onclick: () => (set(v), render()) }, [label])));
    const render = () => {
      const [sa, sb] = typeSex();
      if (st.a.look.sex !== sa) rerollParent('a', sa);
      if (sb && st.b.look.sex !== sb) rerollParent('b', sb);
      const kid = childOf();
      const youName = el('input', { value: st.you.name, placeholder: st.you.sex === 'f' ? 'Emma' : 'Alex', maxlength: 16 });
      youName.addEventListener('input', () => (st.you.name = youName.value.trim()));
      youName.addEventListener('keydown', (e) => e.stopPropagation());
      const pName = (k) => {
        const i = el('input', { value: st[k].name, maxlength: 16 });
        i.addEventListener('input', () => (st[k].name = i.value.trim()));
        i.addEventListener('keydown', (e) => e.stopPropagation());
        return i;
      };
      const styles = [['chill', 'Chill'], ['strict', 'Strict'], ['overprotective', 'Overprotective'], ['fun', 'Fun'], ['doesnt-care', "Doesn't care"]];
      const parentBlock = (k, label) => [
        el('div', { class: 'nl-sec' }, [label]),
        el('div', { class: 'nl-row' }, [pName(k), el('button', { class: 'nl-chip', onclick: () => (rerollParent(k, st[k].look.sex), render()) }, ['New look'])]),
        chips(styles, st[k].style, (v) => (st[k].style = v)),
      ];
      const body = el('div', { class: 'nl-body' }, [
        el('div', { class: 'nl-sec' }, ['You']),
        el('div', { class: 'nl-row' }, [youName]),
        chips([['m', 'Boy'], ['f', 'Girl']], st.you.sex, (v) => (st.you.sex = v)),
        el('p', { class: 'nl-note' }, ['Your looks come from your parents\' genes:', el('span', { class: 'nl-sw', style: `background:${skinHex(kid)}` }), 'skin', el('span', { class: 'nl-sw', style: `background:${kid.hair}` }), 'hair', el('span', { class: 'nl-sw', style: `background:${kid.eyes || '#5a3b22'}` }), 'eyes']),
        el('div', { class: 'nl-row' }, [el('button', { class: 'nl-chip', onclick: () => ((st.seed = rng.int(1, 99999)), render()) }, ['Roll the genes again'])]),
        el('div', { class: 'nl-sec' }, ['Family']),
        chips([['mom+dad', 'Mom + Dad'], ['mom', 'Just Mom'], ['dad', 'Just Dad'], ['two moms', 'Two moms'], ['two dads', 'Two dads']], st.type, (v) => (st.type = v)),
        ...parentBlock('a', sb ? (sa === 'f' ? 'Mom' : 'Dad') : sa === 'f' ? 'Mom' : 'Dad'),
        ...(sb ? parentBlock('b', sb === 'f' ? (sa === 'f' ? 'Other mom' : 'Mom') : sa === 'm' ? 'Other dad' : 'Dad') : []),
        el('div', { class: 'nl-sec' }, ['Brother or sister']),
        chips([['none', 'None'], ['older', 'Older'], ['younger', 'Younger']], st.sibling, (v) => (st.sibling = v)),
        el('div', { class: 'nl-sec' }, ['Money']),
        chips([['poor', 'Poor'], ['working', 'Working class'], ['middle', 'Middle class'], ['rich', 'Rich'], ['veryrich', 'Very rich']], st.wealth, (v) => (st.wealth = v)),
        el('p', { class: 'nl-note' }, [{ poor: 'Small house, old stuff, free school lunch, almost no allowance. Every dollar counts.', working: 'Parents work hard, money is tight at the end of the month.', middle: 'A normal house on Maple St, a normal allowance.', rich: 'Big TV, nice cars, a bigger allowance. Expectations too.', veryrich: 'The fanciest house on the street. You can have almost anything... almost.' }[st.wealth]]),
        el('p', { class: 'nl-note', style: 'margin-top:12px' }, ['You start as a newborn in Maple Hollow, Ohio. 4 days = 1 year of your life.']),
      ]);
      panel.replaceChildren(
        el('h2', {}, ['New life']),
        el('div', { class: 'sub' }, ['Pick your family. Everything else depends on it.']),
        body,
        el('div', { class: 'nl-foot' }, [
          el('button', { onclick: () => this._closeNewLife(panel) }, ['Back']),
          el('button', { class: 'go', onclick: () => this._start(st, typeSex(), childOf()) }, ['Be born']),
        ]),
      );
      this._family(st, kid, sb);
    };
    render();
  }

  /** Family photo in the room (live preview). */
  _family(st, kid, two) {
    for (const p of this.people) p.dispose();
    this.people = [];
    const add = (look, age, x, ry = 0) => {
      const p = new Person(look, age, {});
      p.root.position.set(x + 0.75, 0, 4.35);
      p.root.rotation.y = Math.PI + ry;
      this.scene.add(p.root);
      this.people.push(p);
      return p;
    };
    add(st.a.look, 36, two ? -1.35 : -0.95, 0.15);
    if (two) add(st.b.look, 38, -0.15, -0.05);
    if (st.sibling !== 'none') {
      const r = new Rng(st.seed + 9);
      add(childLook(r, st.a.look, st.b.look), st.sibling === 'older' ? 12 : 5, two ? 0.75 : 0.35, -0.2);
    }
    // You (as a little kid in the photo; you'll be born as a baby).
    const you = add(kid, 6, two ? -0.75 : -0.35, 0);
    you.root.position.z = 3.85;
  }

  _closeNewLife(panel) {
    panel.remove();
    this.left.style.display = '';
    for (const p of this.people) p.dispose();
    this.people = [];
    this.camGoal = { pos: new THREE.Vector3(0.55, 1.32, 2.5), look: new THREE.Vector3(-0.15, 1.28, 0) };
    this.photoLight.intensity = 0;
  }

  _start(st, [sa, sb], kidLook) {
    const name = st.you.name || (st.you.sex === 'f' ? 'Emma' : 'Alex');
    const members = [{ role: roleOf(sa, 0, sb), name: st.a.name || (sa === 'f' ? 'Karen' : 'Mike'), look: st.a.look, style: st.a.style }];
    if (sb) members.push({ role: roleOf(sb, 1, sa), name: st.b.name || (sb === 'f' ? 'Linda' : 'Dave'), look: st.b.look, style: st.b.style });
    const fam = { members, lastName: st.last, geneSeed: st.seed, house: { wealth: st.wealth, seed: st.seed % 97 + 1, kidSex: st.you.sex, sibling: st.sibling } };
    // The dev-life shape the rest of the game reads (mom/dad for genes + the house).
    fam.mom = members.find((m) => m.look.sex === 'f') || members[0];
    fam.dad = members.find((m) => m.look.sex === 'm' && m !== fam.mom) || members[1] || null;
    save.newLife({
      character: { name, look: kidLook, sex: st.you.sex },
      family: fam,
      birth: { year: new Date().getFullYear(), season: 0, weekdayOffset: 6 },
    });
    save.slice('me').piggy = { poor: 4, working: 12, middle: 25, rich: 60, veryrich: 120 }[st.wealth] ?? 25;
    music.stop({ fade: 1.5 });
    this.engine.go('birth');
  }

  update(dt) {
    if (!this.ready) return; // still loading (enter() is async)
    this.t += dt;
    if (input.pressed('menu') && panelOpen()) closeTopPanel();
    if (this.glassMat) this.glassMat.uniforms.uTime.value = this.t;
    // Camera: slow breathing drift, eased towards its goal.
    const g = this.camGoal;
    const k = 1 - Math.pow(0.12, dt);
    this.cam.position.lerp(g.pos, k * 0.6);
    this.camLook.lerp(g.look, k * 0.6);
    const bx = Math.sin(this.t * 0.21) * 0.025;
    const by = Math.sin(this.t * 0.33) * 0.015;
    this.cam.lookAt(this.camLook.x + bx, this.camLook.y + by, this.camLook.z);
    // Rain.
    const a = this.rainLines.geometry.attributes.position.array;
    const S = this.rainSeeds;
    for (let i = 0; i < S.length / 3; i++) {
      S[i * 3 + 1] -= dt * 11;
      if (S[i * 3 + 1] < 0) S[i * 3 + 1] += 12;
      const x = S[i * 3];
      const y = S[i * 3 + 1];
      const z = S[i * 3 + 2];
      a.set([x, y, z, x + 0.05, y + 0.42, z], i * 6);
    }
    this.rainLines.geometry.attributes.position.needsUpdate = true;
    // A car every so often (left to right, then right to left).
    this.carT -= dt;
    if (this.carT <= 0) {
      const dir = this._carDir = -(this._carDir || -1);
      this.car.position.set(dir > 0 ? -60 : 60, 0.02, dir > 0 ? -17.5 : -14.5);
      this.car.rotation.y = dir > 0 ? 0 : Math.PI;
      this.carV = dir * 13;
      this.carT = 11 + (this.t % 7);
      audio.play?.('car.pass', { bus: 'ambience', gain: 0.5, position: { x: 0, y: 0, z: -16 }, refDistance: 6 });
    }
    if (this.carV) this.car.position.x += this.carV * dt;
    for (const p of this.people) {
      p.setMotion({ speed: 0 });
      p.update(dt);
    }
  }

  exit() {
    this.rain?.stop?.(0.8);
    for (const p of this.people) p.dispose();
    this.root?.remove();
  }
}

function roleOf(sex, i, other) {
  if (sex === 'f') return other === 'f' && i === 1 ? 'mom2' : 'mom';
  return other === 'm' && i === 1 ? 'dad2' : 'dad';
}

function skinHex(look) {
  const t = look.skin;
  const a = [255, 224, 196];
  const b = [92, 58, 38];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

let _glow = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

void confirmDelete;
function confirmDelete(s, after) {
  const p = openPanel({ title: `Delete ${s.name}'s life?`, sub: 'This can\'t be undone.' });
  p.setBody([el('p', { class: 'rl-note' }, ['Download a backup first if you might want it back.'])]);
  p.setButtons([{ text: 'Keep it', onClick: () => p.close() }, { text: 'Delete forever', kind: 'go', onClick: () => (save.deleteSlot(s.id), p.close(), after()) }]);
}

void clock;
