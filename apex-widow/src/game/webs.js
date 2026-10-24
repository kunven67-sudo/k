// Silk. Every line you spin stays in the world (real widow cobwebs: messy, they sag, catch light, get dusty).
// Active lines (dragline, swing rope, zip line) follow you. Web shots fly and stick. Prey gets wrapped in cocoons.
// Webs you spin as traps catch whatever flies or walks into them, and you feel the vibration.
import * as THREE from 'three';
import { rand, clamp } from '../core/util.js';

const CAP = 6000; // segments
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// camera-facing thick lines (expanded in the vertex shader), min 1.2 px wide so thin silk still shows
class WebLines {
  constructor() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    this.a = new Float32Array(CAP * 3); this.b = new Float32Array(CAP * 3); this.w = new Float32Array(CAP * 2);
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(this.a, 3)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(this.b, 3)); g.setAttribute('iW', new THREE.InstancedBufferAttribute(this.w, 2));
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(1920, 1080) }, uLight: { value: new THREE.Vector3(0.3, 1, 0.2).normalize() } },
      vertexShader: /* glsl */`attribute vec3 iA; attribute vec3 iB; attribute vec2 iW; uniform vec2 uRes; varying float vAl; varying float vG;
        void main(){
          vec4 ca = modelViewMatrix * vec4(iA, 1.0), cb = modelViewMatrix * vec4(iB, 1.0);
          vec4 c = mix(ca, cb, position.x);
          vec4 pa = projectionMatrix * ca, pb = projectionMatrix * cb;
          vec2 sa = pa.xy / max(abs(pa.w), 1e-9), sb = pb.xy / max(abs(pb.w), 1e-9);
          vec2 dir = sb - sa; float dl = length(dir * uRes); dir = dl > 1e-6 ? normalize(dir * uRes) : vec2(1.0, 0.0);
          vec2 nrm = vec2(-dir.y, dir.x);
          vec4 p = projectionMatrix * c;
          float wpx = max(iW.x * projectionMatrix[1][1] * uRes.y * 0.5 / max(-c.z, 1e-9), 1.25);
          p.xy += nrm * position.y * wpx / uRes * p.w;
          gl_Position = p;
          vAl = iW.y * clamp(wpx / 1.25, 0.35, 1.0);
          vec3 t = normalize((cb - ca).xyz + 1e-9);
          vG = abs(dot(t, vec3(0.0, 0.0, 1.0)));
        }`,
      fragmentShader: /* glsl */`varying float vAl; varying float vG; void main(){ float glint = 1.0 - vG; gl_FragColor = vec4(vec3(0.82, 0.84, 0.86) * (0.55 + 0.9 * glint * glint), vAl); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    this.g = g; this.n = 0;
  }
  clear() { this.n = 0; }
  push(a, b, width, alpha = 0.75) {
    if (this.n >= CAP) return;
    const i = this.n++;
    this.a[i * 3] = a.x; this.a[i * 3 + 1] = a.y; this.a[i * 3 + 2] = a.z;
    this.b[i * 3] = b.x; this.b[i * 3 + 1] = b.y; this.b[i * 3 + 2] = b.z;
    this.w[i * 2] = width; this.w[i * 2 + 1] = alpha;
  }
  commit() {
    this.g.instanceCount = this.n;
    for (const k of ['iA', 'iB', 'iW']) { this.g.attributes[k].needsUpdate = true; this.g.attributes[k].addUpdateRange && this.g.attributes[k].clearUpdateRanges && (this.g.attributes[k].clearUpdateRanges(), this.g.attributes[k].addUpdateRange(0, this.n * (k === 'iW' ? 2 : 3))); }
  }
}

function silkTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = '#d8d8d4'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`; x.lineWidth = rand(0.5, 2); x.beginPath(); const y = rand(0, 256); x.moveTo(0, y); x.bezierCurveTo(80, y + rand(-40, 40), 170, y + rand(-40, 40), 256, y + rand(-20, 20)); x.stroke(); }
  for (let i = 0; i < 300; i++) { x.strokeStyle = `rgba(120,120,110,${rand(0.05, 0.2)})`; x.beginPath(); const y = rand(0, 256); x.moveTo(0, y); x.lineTo(256, y + rand(-60, 60)); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class Webs {
  constructor(game) {
    this.game = game;
    this.lines = new WebLines();
    this.strands = [];   // permanent: {a, b, sag, w}
    this.active = [];    // {anchor, player, type}
    this.shots = [];     // flying web balls
    this.cocoons = [];
    this.traps = [];     // {pos, r, strands, caught}
    this.cocoonMat = new THREE.MeshPhysicalMaterial({ color: 0xe6e4de, map: silkTex(), roughness: 0.65, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff), transparent: true, opacity: 0.96 });
    this.shotMat = new THREE.MeshBasicMaterial({ color: 0xf0f0ea, transparent: true, opacity: 0.8 });
  }
  attach(scene) { this.scene = scene; if (this.lines.mesh.parent !== scene) scene.add(this.lines.mesh); }
  reset() { for (const c of this.cocoons) c.mesh.removeFromParent(); this.cocoons = []; this.strands = []; this.active = []; this.shots = []; this.traps = []; }
  // the point on the spider where silk comes out (spinnerets, at the abdomen tip)
  spinnerets(p) {
    const ud = p.body.userData; const s = p.s;
    if (ud.abMesh) { ud.abMesh.updateWorldMatrix(true, false); return _v.set(0, -0.1, -0.5).applyMatrix4(ud.abMesh.matrixWorld).clone(); }
    return p.pos.clone().addScaledVector(p.up, s * 0.2).addScaledVector(p.fwd, -s * 0.6);
  }
  silkWidth(p) { return Math.max(p.s * 0.004, 2e-7); }
  line(anchor, player, type) { this.active = this.active.filter(a => a.player !== player); this.active.push({ anchor: anchor.clone(), player, type, w: this.silkWidth(player) }); this.game.audio.silk(); }
  detach(player) {
    for (const a of this.active) if (a.player === player) {
      // the strand stays where it was: anchor -> where you let go
      this.addStrand(a.anchor, this.spinnerets(player), a.w, a.type === 'drag' ? 0.02 : 0.04);
    }
    this.active = this.active.filter(a => a.player !== player);
  }
  addStrand(a, b, w, sag = 0.03) {
    this.strands.push({ a: a.clone(), b: b.clone(), w, sag });
    if (this.strands.length > 900) this.strands.shift();
  }
  // RMB: a sticky web ball (catches flies, roaches, people...)
  shoot(from, dir, player, speed) {
    const s = player.s;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), this.shotMat); m.scale.setScalar(s * 0.18);
    m.position.copy(from); this.scene.add(m);
    this.shots.push({ p: from.clone(), v: dir.clone().multiplyScalar(speed), life: 1.2, m, s, start: from.clone(), player });
    this.game.audio.silk();
  }
  // wrap something helpless in silk
  cocoon(target, kind) {
    const isHuman = kind === 'human';
    const len = isHuman ? target.height : target.L;
    const geo = new THREE.SphereGeometry(1, 20, 14);
    const m = new THREE.Mesh(geo, this.cocoonMat);
    m.castShadow = true; m.receiveShadow = true;
    if (isHuman) { m.scale.set(0.28, 0.24, len * 0.55); m.position.copy(target.pos).add(new THREE.Vector3(Math.sin(target.yaw) * 0.0, 0.22, 0)); m.rotation.y = target.yaw; target.inner.visible = false; }
    else { m.scale.set(len * 0.38, len * 0.3, len * 0.62); m.position.copy(target.pos).addScaledVector(target.up, len * 0.25); m.quaternion.copy(target.root.quaternion); target.model.root.visible = false; }
    m.scale.multiplyScalar(0.2); m.userData.grow = 0;
    this.scene.add(m);
    const c = { mesh: m, target, kind, full: m.scale.clone().multiplyScalar(5), grow: 0 };
    this.cocoons.push(c);
    return c;
  }
  // spin a trap web (power): a messy 3D cobweb anchored to the nearby surfaces
  trap(p) {
    const G = this.game, s = p.s, c = p.pos.clone().addScaledVector(p.up, s * 3);
    const anchors = [];
    for (let i = 0; i < 22; i++) {
      const d = new THREE.Vector3(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize();
      const h = G.probe(c, d, s * 18, s);
      if (h) anchors.push(h.point);
    }
    if (anchors.length < 3) return false;
    const T = { pos: c, r: s * 9, caught: new Set(), strands: [] };
    for (const a of anchors) this.addStrand(c.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(s * 2)), a, this.silkWidth(p) * 1.5, 0.05);
    for (let i = 0; i < 40; i++) { const a = anchors[Math.floor(Math.random() * anchors.length)], b = anchors[Math.floor(Math.random() * anchors.length)]; if (a !== b) this.addStrand(a.clone().lerp(c, rand(0, 0.6)), b.clone().lerp(c, rand(0, 0.6)), this.silkWidth(p), 0.06); }
    this.traps.push(T);
    G.audio.silk();
    return true;
  }
  update(dt) {
    const G = this.game, P = G.player;
    // shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const S = this.shots[i];
      S.life -= dt;
      const step = S.v.clone().multiplyScalar(dt), sl = step.length();
      const dir = step.clone().divideScalar(sl || 1);
      let hit = null;
      const cr = G.zone && G.zone.creatures ? G.zone.creatures.raycast(S.p, dir, sl + S.s * 0.3, S.s * 0.02) : null;
      const hr = G.zone && G.zone.humans ? G.zone.humans.raycast(S.p, dir, sl) : null;
      const wh = G.probe(S.p, dir, sl, S.s);
      if (cr && (!wh || cr.t < wh.distance) && (!hr || cr.t < hr.t)) { const amt = clamp(S.player.mass / cr.c.mass * 3, 0.8, 12); cr.c.webbed(amt); G.fx.dust(cr.c.pos, cr.c.up, cr.c.L * 0.5, 0.2); hit = true; this.addStrand(S.start, cr.c.pos, this.silkWidth(S.player), 0.05); }
      else if (hr && (!wh || hr.t < wh.distance)) { hr.h.hurt(0, 0); hr.h.netted = (hr.h.netted || 0) + clamp(S.player.sizeM * 4, 0.2, 6); hit = true; }
      else if (wh) { this.addStrand(S.start, wh.point, this.silkWidth(S.player), 0.04); hit = true; }
      if (hit || S.life <= 0) { S.m.removeFromParent(); this.shots.splice(i, 1); continue; }
      S.v.y -= 9.81 / (G.zone ? G.zone.unit : 1) * dt * 0.3;
      S.p.add(step); S.m.position.copy(S.p);
    }
    // cocoons grow around their target
    for (const c of this.cocoons) {
      if (c.grow < 1) { c.grow = Math.min(1, c.grow + dt * 1.2); c.mesh.scale.copy(c.full).multiplyScalar(0.2 + 0.8 * c.grow); }
      if (c.kind !== 'human' && c.target.state !== 'eaten') c.mesh.position.copy(c.target.pos).addScaledVector(c.target.up, c.target.L * 0.25);
      if (c.target.eatenFrac !== undefined) c.mesh.scale.copy(c.full).multiplyScalar(1 - 0.45 * c.target.eatenFrac);
    }
    // traps catch things that touch them, you feel it
    if (G.zone && G.zone.creatures) for (const T of this.traps) {
      for (const c of G.zone.creatures.near(T.pos, T.r)) {
        if (T.caught.has(c) || !c.alive) continue;
        T.caught.add(c); c.webbed(8);
        if (G.hud && P && P.pos.distanceTo(T.pos) < T.r * 40) G.hud.toast('Something hit your web: ' + c.def.name, 2);
        G.hud && G.hud.vibration && G.hud.vibration(T.pos);
      }
    }
    // rebuild the line buffer: permanent strands (sagging), active lines (taut)
    this.lines.clear();
    for (const S of this.strands) {
      const n = 5; let prev = S.a;
      const len = S.a.distanceTo(S.b);
      for (let k = 1; k <= n; k++) {
        const t = k / n; const p = _v2.copy(S.a).lerp(S.b, t); p.y -= Math.sin(t * Math.PI) * len * S.sag;
        const cur = p.clone(); this.lines.push(prev, cur, S.w, 0.55); prev = cur;
      }
    }
    for (const A of this.active) { const sp = this.spinnerets(A.player); this.lines.push(A.anchor, sp, A.w, 0.9); }
    this.lines.commit();
    this.lines.mat.uniforms.uRes.value.set(G.renderer.size().w, G.renderer.size().h);
  }
}
