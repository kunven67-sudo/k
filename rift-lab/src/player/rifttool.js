// The Rift Tool: the shrink / grow ray you built. Mouse only, like everything else:
//   G            take it out / put it away
//   hold LMB     shrink what you aim at        hold RMB   grow it        (Shift = faster)
//   V            flip it around onto yourself (then LMB / RMB shrink / grow YOU)
//   phone app    "Rift": a size slider for you + battery
// Real scaling laws: lengths x k, weight x k^3, your strength x k^2. Everything you're carrying
// (phone, tool) shrinks with you. Battery: a world setting (real = recharge near a power source,
// self-recharging, or unlimited).

import * as THREE from 'three';
import { input } from '../core/input.js';
import { material, canvasTex } from '../items/materials.js';
import { addOutline, removeOutline } from './build.js';
import { clamp } from '../core/noise.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const RANGE = 40;              // meters (x your size)
const OBJ_MIN = 0.02, OBJ_MAX = 10;
const SELF_MIN = 0.03, SELF_MAX = 8;

export class RiftTool {
  constructor({ physics, camera, kit, items, player, power, consume, scene, audio, battery = 'real', saved, onMessage, onTip }) {
    Object.assign(this, { physics, camera, kit, items, player, power, consume, scene, audio, onMessage: onMessage || (() => {}), onTip: onTip || (() => {}) });
    this.R = physics.RAPIER;
    this.batteryMode = battery;
    this.battery = saved?.battery ?? 100;
    this.equipped = false;
    this.selfMode = false;
    this.target = null;      // { item, live, built }
    this.selfTarget = null;  // size the phone slider asked for
    this.firing = 0;         // -1 shrink, +1 grow
    this.t = 0;
    this.buildModel();
    this.buildBeam();
  }

  // ---------- the tool in your hand ----------
  buildModel() {
    const g = new THREE.Group();
    g.name = 'rift-tool';
    const metal = material('metal:steel'), dark = material('plastic:0x1d1f22'), rubber = material('rubber');
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.85, roughness: 0.42, normalMap: metal.normalMap, roughnessMap: metal.roughnessMap });
    const carbon = new THREE.MeshPhysicalMaterial({ map: carbonTexture(), roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    this.glowMat = new THREE.MeshStandardMaterial({ color: 0x2a2140, emissive: 0xc9b6ff, emissiveIntensity: 1.2, roughness: 0.3 });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xbfa8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = false; g.add(m); return m; };
    // body (z forward = -z, toward the world)
    add(new RoundedBoxGeometry(0.046, 0.05, 0.2, 3, 0.008), gunmetal, 0, 0, 0);
    add(new RoundedBoxGeometry(0.03, 0.012, 0.17, 2, 0.004), carbon, 0, 0.031, 0.005);   // carbon rail on top
    for (const x of [-0.024, 0.024]) add(new RoundedBoxGeometry(0.004, 0.034, 0.15, 2, 0.0015), carbon, x, 0, 0.01); // carbon side plates
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.036, 0.008, 0.003), metal, 0, 0.041, -0.075 + i * 0.008); // heat-sink fins
    for (const x of [-0.026, 0.026]) for (const z of [-0.06, 0.07]) add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 8), metal, x, 0.016, z, 0, 0, Math.PI / 2); // screws
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), metal, 0.027, -0.008, -0.03, 0, 0, Math.PI / 2); // dial
    add(new RoundedBoxGeometry(0.034, 0.095, 0.042, 3, 0.01), rubber, 0, -0.065, 0.055, -0.22);   // grip
    add(new THREE.BoxGeometry(0.008, 0.02, 0.02), dark, 0, -0.03, 0.02);                 // trigger
    // emitter: barrel, three focusing prongs, ring, glowing core
    add(new THREE.CylinderGeometry(0.019, 0.023, 0.05, 20), metal, 0, 0.002, -0.12, Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const prong = add(new THREE.CylinderGeometry(0.0028, 0.0035, 0.045, 8), gunmetal, Math.cos(a) * 0.026, 0.002 + Math.sin(a) * 0.026, -0.16, Math.PI / 2);
      prong.rotation.set(Math.PI / 2 - Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    }
    this.ring = add(new THREE.TorusGeometry(0.02, 0.004, 10, 28), this.glowMat, 0, 0.002, -0.147);
    this.core = add(new THREE.CircleGeometry(0.016, 20), this.coreMat, 0, 0.002, -0.1455, 0, Math.PI);
    // swappable battery pack at the back, with a cable to the emitter
    add(new THREE.BoxGeometry(0.04, 0.034, 0.05), dark, 0, 0.002, 0.122);
    add(new THREE.BoxGeometry(0.041, 0.006, 0.051), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 }), 0, 0.018, 0.122);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0.022, -0.012, 0.11), new THREE.Vector3(0.034, -0.03, 0.02), new THREE.Vector3(0.03, -0.02, -0.07), new THREE.Vector3(0.02, -0.008, -0.11)]);
    add(new THREE.TubeGeometry(cable, 24, 0.0032, 6), rubber, 0, 0, 0);
    // little screen on the left side: size + battery
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 256; this.screenCanvas.height = 128;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: this.screenTex }), -0.0255, 0.004, 0.0, 0, -Math.PI / 2, 0);
    g.scale.setScalar(0.85);
    g.position.set(0.15, -0.135, -0.36);
    g.rotation.set(0.02, 0.08, 0);
    // the emitter lights up your hand + what's close when it fires
    this.light = new THREE.PointLight(0xc9b6ff, 0, 1.2, 2);
    this.light.position.set(0, 0.002, -0.17);
    g.add(this.light);
    g.visible = false;
    this.root = g;
    this.kit.add(g);
    this.drawScreen();
  }

  drawScreen() {
    const c = this.screenCanvas.getContext('2d');
    c.fillStyle = '#05070a'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = this.firing ? '#d9ccff' : '#9fe8ff';
    c.font = '700 30px Inter, monospace';
    const mode = this.selfMode ? 'SELF' : 'OBJECT';
    const sc = this.selfMode ? this.player.size : this.target ? this.target.live : this.aimItem?.scale ?? 1;
    c.fillText(`${mode} x${sc < 0.1 ? sc.toFixed(3) : sc.toFixed(2)}`, 12, 46);
    c.font = '20px Inter, monospace';
    c.fillStyle = this.battery < 15 ? '#ff6b6b' : '#7ee08a';
    c.fillText(this.batteryMode === 'unlimited' ? 'BATT ∞' : `BATT ${Math.round(this.battery)}%`, 12, 92);
    c.fillStyle = '#333a44'; c.fillRect(130, 76, 110, 18);
    c.fillStyle = this.battery < 15 ? '#ff6b6b' : '#7ee08a'; c.fillRect(132, 78, 106 * this.battery / 100, 14);
    this.screenTex.needsUpdate = true;
  }

  // the beam: a twisting glow from the emitter to what you're shrinking
  buildBeam() {
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGrow: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uGrow; varying vec2 vUv;
        void main(){
          float bands = 0.55 + 0.45 * sin((vUv.y * 40.0 - uTime * (uGrow > 0.5 ? -14.0 : 14.0)));
          float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.5);
          vec3 col = mix(vec3(0.75, 0.66, 1.0), vec3(0.5, 0.95, 1.0), vUv.y);
          gl_FragColor = vec4(col * (0.6 + bands * 0.8), edge * (0.35 + 0.4 * bands));
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), this.beamMat);
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    this.scene.add(this.beam);
  }

  setEquipped(on) {
    if (on === this.equipped) return;
    if (on && this.consume?.held) this.consume.putDown();
    this.equipped = on;
    this.root.visible = on;
    if (!on) this.stopFiring();
    this.audio.ui?.('click');
    if (on) this.onTip('rift', 'The <b>Rift Tool</b>: aim + hold <b>left-click</b> to shrink, <b>right-click</b> to grow (<kbd>Shift</kbd> = faster). <kbd>V</kbd> turns it on yourself. <kbd>G</kbd> puts it away. Size slider: phone → Rift.', 12);
  }

  // ---------- per frame ----------
  update(dt, { locked, blocked }) {
    this.t += dt;
    this.beamMat.uniforms.uTime.value = this.t;
    this.chargeBattery(dt);
    // the phone slider can resize you even with the tool put away
    if (this.selfTarget != null && !this.firing) this.approachSelf(dt);
    if (!this.equipped) { this.aimItem = null; this.setAimOutline(null); return; }
    if (!locked || blocked) { this.stopFiring(); return; }
    if (input.actionPressed('riftSelf')) {
      this.selfMode = !this.selfMode;
      this.stopFiring();
      this.onMessage(this.selfMode ? 'Rift Tool turned on yourself.' : 'Rift Tool pointing at things.');
    }
    // what you're pointing at
    this.aimItem = this.selfMode ? null : this.pick();
    const want = input.mouse(0) ? -1 : input.mouse(2) ? 1 : 0;
    if (want !== this.firing) {
      this.stopFiring();
      if (want) this.startFiring(want);
    }
    if (this.firing) this.fire(dt);
    this.setAimOutline(this.selfMode ? null : this.target?.item || this.aimItem);
    // little screen refresh
    this.screenT = (this.screenT || 0) - dt;
    if (this.screenT <= 0) { this.screenT = 0.15; this.drawScreen(); }
  }

  pick() {
    const cam = this.camera.position, dir = this.camera.getWorldDirection(new THREE.Vector3());
    const hit = this.physics.castRay({ x: cam.x, y: cam.y, z: cam.z }, { x: dir.x, y: dir.y, z: dir.z }, RANGE * this.player.size, this.player.collider);
    if (!hit) return null;
    const it = this.items.itemOfCollider(hit.collider);
    if (it) it._riftHit = new THREE.Vector3(cam.x + dir.x * hit.timeOfImpact, cam.y + dir.y * hit.timeOfImpact, cam.z + dir.z * hit.timeOfImpact);
    return it;
  }

  startFiring(dir) {
    if (this.battery <= 0 && this.batteryMode !== 'unlimited') { this.onMessage('The Rift Tool battery is empty.'); return; }
    if (this.selfMode) {
      this.selfTarget = null;
      if (this.consume?.held) this.consume.putDown();
    } else {
      if (!this.aimItem) return;
      const it = this.aimItem;
      this.target = { item: it, live: it.scale, built: it.scale };
    }
    this.firing = dir;
    this.hum = this.startHum(dir);
  }

  stopFiring() {
    if (!this.firing && !this.target) return;
    // settle the object at its new size (rebuild physics at the exact scale)
    if (this.target) this.commitTarget();
    this.target = null;
    this.firing = 0;
    this.beam.visible = false;
    this.stopHum();
    this.drawScreen();
  }

  fire(dt) {
    const speed = input.action('sprint') ? 3 : 1; // x2 (or x8 with Shift) per second
    const f = Math.pow(2, this.firing * speed * dt);
    if (this.batteryMode !== 'unlimited') {
      const mass = this.selfMode ? 75 * this.player.size ** 3 : this.target?.item?.mass || 1;
      this.battery -= (1 + 0.6 * Math.log10(1 + mass)) * speed * dt;
      if (this.battery <= 0) { this.battery = 0; this.onMessage('The Rift Tool battery died.'); this.stopFiring(); return; }
    }
    if (this.selfMode) {
      const p = this.player;
      const next = clamp(p.size * f, SELF_MIN, SELF_MAX);
      if (next > p.size && !p.roomFor(next)) { this.onMessage('No room to grow here.'); this.stopFiring(); return; }
      if (next === p.size) { this.onMessage(next <= SELF_MIN ? 'This is as small as the Rift Tool can take you (for now).' : 'This is as big as it goes (for now).'); this.stopFiring(); return; }
      p.setSize(next);
      this.updateHum(next);
      return;
    }
    const tg = this.target;
    if (!tg || !this.items.items.includes(tg.item)) { this.stopFiring(); return; }
    const base = tg.item.bounds.getSize(new THREE.Vector3()).length() / tg.built; // its normal size
    const lo = Math.max(OBJ_MIN, 0.006 / base), hi = Math.min(OBJ_MAX, 40 / base);
    const next = clamp(tg.live * f, lo, hi);
    if (next === tg.live) { this.onMessage(next <= lo ? 'It won\'t go any smaller (the field gets unstable).' : 'It won\'t go any bigger.'); this.stopFiring(); return; }
    tg.live = next;
    this.updateHum(next);
    // rebuild the real physics shape every so often; in between just the look follows smoothly
    if (Math.abs(Math.log(tg.live / tg.built)) > 0.12) this.commitTarget();
  }

  commitTarget() {
    const tg = this.target;
    if (!tg || !this.items.items.includes(tg.item)) return;
    if (Math.abs(tg.live - tg.built) < 1e-6) return;
    const it = tg.item;
    it.state.scale = tg.live;
    tg.item = this.items.rebuild(it);
    tg.built = tg.live;
  }

  // the phone slider: glide your size toward the chosen one (uses battery like the trigger)
  approachSelf(dt) {
    const p = this.player, goal = clamp(this.selfTarget, SELF_MIN, SELF_MAX);
    if (Math.abs(Math.log(goal / p.size)) < 0.004) { p.setSize(goal); this.selfTarget = null; return; }
    if (this.battery <= 0 && this.batteryMode !== 'unlimited') { this.selfTarget = null; this.onMessage('The Rift Tool battery is empty.'); return; }
    const dir = goal > p.size ? 1 : -1;
    let next = p.size * Math.pow(2, dir * 1.2 * dt);
    next = dir > 0 ? Math.min(next, goal) : Math.max(next, goal);
    if (dir > 0 && !p.roomFor(next)) { this.selfTarget = null; this.onMessage('No room to grow here.'); return; }
    if (this.consume?.held) this.consume.putDown();
    p.setSize(next);
    if (this.batteryMode !== 'unlimited') this.battery = Math.max(0, this.battery - 1.6 * dt);
  }

  chargeBattery(dt) {
    if (this.batteryMode === 'unlimited') { this.battery = 100; return; }
    if (this.firing) return;
    if (this.batteryMode === 'recharge') { this.battery = Math.min(100, this.battery + 1.2 * dt); return; }
    // real: charges only when you're close to a live power source (it plugs in)
    this.nearPowerT = (this.nearPowerT || 0) - dt;
    if (this.nearPowerT <= 0) {
      this.nearPowerT = 0.5;
      const me = this.player.pos;
      this.nearPower = !!this.power && this.items.items.some((it) => it.def?.source && it.def.source.kind !== 'strip' && this.power.sourceLive(it) && it.position.distanceTo(me) < 2.2);
    }
    if (this.nearPower && this.battery < 100) this.battery = Math.min(100, this.battery + 2.5 * dt);
  }

  setAimOutline(item) {
    if (item === this.outlined) return;
    removeOutline(this.outlineList);
    this.outlineList = item ? addOutline(item) : null;
    this.outlined = item;
  }

  // ---------- after physics: visuals ----------
  lateUpdate(dt) {
    const p = this.player;
    this.kit.scale.setScalar(p.size); // phone + tool shrink with you
    if (!this.equipped) return;
    // idle sway + shake while firing
    const shake = this.firing ? 0.0015 : 0;
    this.root.position.set(0.15 + Math.sin(this.t * 1.3) * 0.002 + (Math.random() - 0.5) * shake, -0.135 + Math.sin(this.t * 2.1) * 0.0015 + (Math.random() - 0.5) * shake, -0.36);
    this.light.intensity = this.firing ? 0.6 + Math.random() * 0.3 : 0;
    this.light.color.setHex(this.firing > 0 ? 0x9fe8ff : 0xc9b6ff);
    const glow = this.firing ? 3 + Math.sin(this.t * 30) * 0.8 : 1.1 + Math.sin(this.t * 2) * 0.15;
    this.glowMat.emissive.setHex(this.firing > 0 ? 0x9fe8ff : 0xc9b6ff);
    this.glowMat.emissiveIntensity = glow;
    this.coreMat.opacity = this.firing ? 1 : 0.7;
    // a grown/shrunk-in-progress object follows smoothly between physics rebuilds
    const tg = this.target;
    if (tg && this.items.items.includes(tg.item)) {
      const k = tg.live / tg.built;
      for (const g of Object.values(tg.item.groups)) g.scale.setScalar(k);
    }
    // beam from the emitter to the thing
    if (this.firing && !this.selfMode && tg && this.items.items.includes(tg.item)) {
      this.root.updateWorldMatrix(true, false);
      const from = new THREE.Vector3(0, 0.002, -0.15).applyMatrix4(this.root.matrixWorld);
      const b = tg.item.bounds, c = new THREE.Vector3();
      b.getCenter(c).multiplyScalar(tg.live / tg.built);
      const to = c.applyQuaternion(tg.item.groups.main.quaternion).add(tg.item.groups.main.position);
      const len = from.distanceTo(to);
      const r = 0.008 * p.size + len * 0.006;
      this.beam.position.copy(from).lerp(to, 0.5);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      this.beam.scale.set(r, len, r);
      this.beamMat.uniforms.uGrow.value = this.firing > 0 ? 1 : 0;
      this.beam.visible = true;
    } else this.beam.visible = false;
  }

  // ---------- sound: a hum that falls as things shrink, rises as they grow ----------
  startHum(dir) {
    const a = this.audio;
    if (!a?.ctx) return null;
    const ctx = a.ctx;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sine';
    o.frequency.value = 220; o2.frequency.value = 441;
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 0.08);
    o.connect(f); o2.connect(f); f.connect(g).connect(a.fx);
    o.start(); o2.start();
    a.burst?.({ dur: 0.25, freq: dir > 0 ? 2400 : 1400, q: 1.5, gain: 0.08 });
    return { o, o2, g, f };
  }

  updateHum(size) {
    const h = this.hum;
    if (!h) return;
    const t = this.audio.ctx.currentTime;
    const fq = clamp(220 * Math.pow(size, 0.35), 60, 1400);
    h.o.frequency.setTargetAtTime(fq, t, 0.05);
    h.o2.frequency.setTargetAtTime(fq * 2.01, t, 0.05);
    h.f.frequency.setTargetAtTime(400 + fq * 3, t, 0.05);
  }

  stopHum() {
    const h = this.hum;
    if (!h) return;
    this.hum = null;
    const t = this.audio.ctx.currentTime;
    h.g.gain.setTargetAtTime(0, t, 0.06);
    setTimeout(() => { try { h.o.stop(); h.o2.stop(); } catch { /* */ } h.g.disconnect(); }, 400);
    this.audio.tone?.({ freq: 900, freqEnd: 1300, dur: 0.12, gain: 0.04, type: 'sine' });
  }

  serialize() { return { battery: this.battery }; }

  dispose() {
    this.stopFiring();
    this.setAimOutline(null);
    this.root.parent?.remove(this.root);
    this.scene.remove(this.beam);
    this.beam.geometry.dispose();
    this.beamMat.dispose();
    this.screenTex.dispose();
  }
}

function carbonTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#16181b'; ctx.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const odd = ((x + y) / s) % 2;
      const g = ctx.createLinearGradient(x, y, odd ? x + s : x, odd ? y : y + s);
      g.addColorStop(0, '#2b2f35'); g.addColorStop(0.5, '#3a3f47'); g.addColorStop(1, '#202328');
      ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
  }, { w: 256, h: 256 });
}
