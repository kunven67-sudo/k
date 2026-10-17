// Portals: the green blob you shoot, the swirly portal it makes, and travel through them.
import * as THREE from '../three.js';
import { LAYER_OVERLAY } from '../render/kit.js';
import { haloTexture } from './gun.js';
import { audio } from '../core/audio.js';
import { clamp, easeOutBack, rand } from '../util.js';

const portalVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// the Rick and Morty portal: a crisp green vortex with a pale core, dark swirl arms
// and a bright goopy rim. Kept mostly under the bloom threshold so it stays sharp.
const portalFrag = /* glsl */ `
  uniform float time;
  uniform float open;
  uniform float seed;
  uniform float fade;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float wob = 0.025 * sin(a * 6.0 + time * 2.2 + seed) + 0.018 * sin(a * 11.0 - time * 3.1 + seed * 1.7) + 0.035 * (noise(vec2(a * 2.5 + seed, time * 0.8)) - 0.5);
    float edge = (0.93 + wob) * open;
    if (r > edge + 0.02) discard;
    float rn = r / max(edge, 0.001);
    // log spiral arms turning inward
    float spiral = a * 3.0 + log(rn + 0.08) * 5.5 + time * 3.2 + noise(p * 2.5 + time * 0.4) * 1.5;
    float arms = smoothstep(-0.25, 0.35, sin(spiral));
    vec3 dark = vec3(0.05, 0.36, 0.05);
    vec3 mid = vec3(0.22, 0.78, 0.1);
    vec3 col = mix(dark, mid, arms);
    // pale glowing middle
    col = mix(col, vec3(0.78, 1.12, 0.42), smoothstep(0.42, 0.0, rn));
    // inner shadow ring, then the bright lime lip
    col = mix(col, vec3(0.03, 0.22, 0.04), smoothstep(0.78, 0.86, rn) * (1.0 - smoothstep(0.88, 0.92, rn)));
    col = mix(col, vec3(0.42, 0.98, 0.16), smoothstep(0.9, 0.95, rn));
    float alpha = 1.0 - smoothstep(edge - 0.006, edge + 0.012, r);
    gl_FragColor = vec4(col, alpha * fade);
  }`;

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Portal {
  constructor(sys, { center, normal, up, kind, w = 1.35, h = 2.25 }) {
    this.sys = sys;
    this.center = center.clone();
    this.normal = normal.clone().normalize();
    this.up = up.clone().normalize();
    this.right = new THREE.Vector3().crossVectors(this.up, this.normal).normalize();
    this.kind = kind; // wall | stand | floor | ceiling
    this.w = w;
    this.h = h;
    this.link = null;
    this.t = 0;
    this.state = 'opening';
    this.age = 0;
    this.lastUse = 0;
    this.seed = Math.random() * 10;
    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    const m = new THREE.Matrix4().makeBasis(this.right, this.up, this.normal);
    this.group.quaternion.setFromRotationMatrix(m);
    this.uniforms = { time: { value: 0 }, open: { value: 0 }, seed: { value: this.seed }, fade: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: portalVert,
      fragmentShader: portalFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.mesh.layers.set(LAYER_OVERLAY);
    this.mesh.renderOrder = 10;
    this.group.add(this.mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0x55ff33, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(w * 2.1, h * 1.7, 1);
    glow.layers.set(LAYER_OVERLAY);
    this.group.add(glow);
    this.glow = glow;
    this.hum = audio.loop('portal');
    audio.portalOpen(center.x, center.y, center.z);
    sys.scene.add(this.group);
  }

  /** local coords of a point: x/y in units of the half size, z = distance from the plane */
  local(p) {
    _v.subVectors(p, this.center);
    return { x: _v.dot(this.right) / (this.w / 2), y: _v.dot(this.up) / (this.h / 2), z: _v.dot(this.normal) };
  }

  close() {
    if (this.state === 'closing' || this.state === 'dead') return;
    this.state = 'closing';
    this.t = 1;
    audio.portalClose(this.center.x, this.center.y, this.center.z);
  }

  update(dt, listener) {
    this.age += dt;
    this.uniforms.time.value += dt;
    if (this.state === 'opening') {
      this.t = Math.min(1, this.t + dt / 0.5);
      this.uniforms.open.value = easeOutBack(this.t, 2.2);
      if (this.t >= 1) this.state = 'open';
    } else if (this.state === 'closing') {
      this.t = Math.max(0, this.t - dt / 0.35);
      this.uniforms.open.value = this.t * this.t;
      if (this.t <= 0) this.state = 'dead';
    }
    const o = this.uniforms.open.value;
    this.glow.material.opacity = clamp(o, 0, 1) * 0.12;
    if (this.hum) {
      const d = listener.distanceTo(this.center);
      this.hum.gain(clamp(1 - d / 14, 0, 1) * 0.5 * clamp(o, 0, 1));
    }
  }

  dispose() {
    this.sys.scene.remove(this.group);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.glow.material.dispose();
    this.hum?.stop();
  }

  /** where something comes out of this portal, and which way it faces */
  exitTransform(physics, bodyHeight = 1.8) {
    const n = this.normal;
    if (this.kind === 'floor') {
      return { pos: this.center.clone().add(new THREE.Vector3(0, 0.05, 0)), dir: this.up.clone(), vel: new THREE.Vector3(0, 7.5, 0).addScaledVector(this.up, 2.5) };
    }
    if (this.kind === 'ceiling') {
      return { pos: this.center.clone().add(new THREE.Vector3(0, -bodyHeight - 0.2, 0)), dir: this.up.clone(), vel: new THREE.Vector3(0, -1, 0) };
    }
    const flat = new THREE.Vector3(n.x, 0, n.z).normalize();
    const pos = this.center.clone().addScaledVector(flat, 0.6);
    pos.y = physics.floorBelow(pos.x, this.center.y + 0.2, pos.z, 4);
    return { pos, dir: flat, vel: flat.clone().multiplyScalar(2.5) };
  }
}

export class PortalSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.physics = game.physics;
    this.portals = [];
    this.pending = null; // first portal of a pair, waiting for its partner
    this.blobs = [];
    this.cooldown = 0;
    this.maxPairs = 2;
    this.onTravel = null;
    this.blobGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.blobMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.2, 0.25) });
    this.lights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0x5cff3c, 0, 6, 1.4);
      l.layers.enableAll();
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  clearAll(silent = false) {
    for (const p of this.portals) {
      if (silent) p.dispose();
      else p.close();
    }
    if (silent) this.portals = [];
    this.pending = null;
  }

  /** fire a blob from `from` toward where the crosshair hits */
  shoot(from, camera, kind = 'pair') {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = this.physics.raycast(camera.position, dir, 120, (c) => c.shootable);
    const target = hit ? hit.point.clone() : camera.position.clone().addScaledVector(dir, 120);
    const blob = new THREE.Mesh(this.blobGeo, this.blobMat);
    blob.layers.set(LAYER_OVERLAY);
    blob.position.copy(from);
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0x66ff44, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    trail.scale.setScalar(0.7);
    trail.layers.set(LAYER_OVERLAY);
    blob.add(trail);
    this.scene.add(blob);
    const dist = from.distanceTo(target);
    this.blobs.push({ mesh: blob, from: from.clone(), to: target, t: 0, dur: Math.max(0.05, dist / 75), hit, kind, shotDir: dir.clone() });
    audio.portalShoot();
  }

  update(dt, playerPos) {
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.t += dt / b.dur;
      const k = Math.min(1, b.t);
      b.mesh.position.lerpVectors(b.from, b.to, k);
      b.mesh.scale.setScalar(1 + Math.sin(b.t * 30) * 0.15);
      if (b.t >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.children[0].material.dispose();
        this.blobs.splice(i, 1);
        if (b.hit) this._land(b, playerPos);
        else audio.fizzle();
      }
    }
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const p = this.portals[i];
      p.update(dt, this.game.camera.position);
      if (p.state === 'dead') {
        p.dispose();
        this.portals.splice(i, 1);
        if (this.pending === p) this.pending = null;
        if (p.link && p.link.link === p) p.link.link = null;
      }
    }
    // the two closest portals light up the room green
    const sorted = this.portals.filter((p) => p.state !== 'dead').sort((a, b) => a.center.distanceToSquared(playerPos) - b.center.distanceToSquared(playerPos));
    this.lights.forEach((l, i) => {
      const p = sorted[i];
      if (p) {
        l.position.copy(p.center).addScaledVector(p.normal, 0.6);
        l.intensity = 1.4 * clamp(p.uniforms.open.value, 0, 1.2);
      } else l.intensity = 0;
    });
  }

  _land(b, playerPos) {
    const hit = b.hit;
    const placed = this.place(hit, playerPos, b.shotDir);
    if (!placed) {
      audio.fizzle();
      this.game.onPortalFail?.(hit);
      return;
    }
    this.game.onPortalPlaced?.(placed, b.kind);
  }

  /** work out a portal's position/orientation for a surface hit; null if it won't fit */
  place(hit, playerPos, shotDir) {
    const n = hit.normal.clone();
    const ph = this.physics;
    let kind, center, normal, up, w = 1.35, h = 2.25;
    if (Math.abs(n.y) < 0.5) {
      kind = 'wall';
      normal = n;
      up = UP.clone();
      center = hit.point.clone().addScaledVector(n, 0.03);
      // stand it on the floor like a doorway when the floor is close below
      const floor = ph.floorBelow(center.x + n.x * 0.4, center.y, center.z + n.z * 0.4, 3);
      if (center.y - floor < 2.4) center.y = floor + h / 2 + 0.02;
    } else if (n.y > 0.5) {
      const horiz = new THREE.Vector3(playerPos.x - hit.point.x, 0, playerPos.z - hit.point.z);
      if (horiz.length() < 1.6) {
        // shooting your own feet: a hole in the floor
        kind = 'floor';
        normal = UP.clone();
        up = new THREE.Vector3(shotDir.x, 0, shotDir.z).normalize();
        if (up.lengthSq() < 0.01) up.set(0, 0, -1);
        center = hit.point.clone().add(new THREE.Vector3(0, 0.02, 0));
        w = h = 1.9;
      } else {
        kind = 'stand';
        normal = horiz.normalize();
        up = UP.clone();
        center = hit.point.clone().add(new THREE.Vector3(0, h / 2 + 0.02, 0));
      }
    } else {
      kind = 'ceiling';
      normal = new THREE.Vector3(0, -1, 0);
      up = new THREE.Vector3(shotDir.x, 0, shotDir.z).normalize();
      if (up.lengthSq() < 0.01) up.set(0, 0, -1);
      center = hit.point.clone().add(new THREE.Vector3(0, -0.02, 0));
      w = h = 1.9;
    }
    if (kind === 'stand') {
      if (!this._fitStanding(center, normal, w, h)) return null;
    } else if (!this._fitSurface(center, normal, up, w, h)) return null;
    return { kind, center, normal, up, w, h };
  }

  _fitSurface(center, normal, up, w, h) {
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const back = normal.clone().negate();
    const test = (c) => {
      let worst = null;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const p = c.clone().addScaledVector(right, Math.cos(a) * w * 0.47).addScaledVector(up, Math.sin(a) * h * 0.47);
        const o = p.clone().addScaledVector(normal, 0.25);
        const hit = this.physics.raycast(o, back, 0.45, (cc) => cc.shootable);
        const ok = hit && hit.dist > 0.12 && hit.dist < 0.38 && hit.normal.dot(normal) > 0.9 && (!hit.collider || hit.collider.portalable);
        // nothing sticking out in front of the portal either
        const blocked = this.physics.pointBlocked(p.x + normal.x * 0.15, p.y + normal.y * 0.15, p.z + normal.z * 0.15);
        if (!ok || blocked) {
          const push = new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0);
          worst = worst ? worst.add(push) : push;
        }
      }
      return worst;
    };
    for (let tries = 0; tries < 8; tries++) {
      const bad = test(center);
      if (!bad) return true;
      if (bad.lengthSq() < 1e-6) return false;
      bad.normalize();
      center.addScaledVector(right, bad.x * w * 0.12).addScaledVector(up, bad.y * h * 0.12);
    }
    return false;
  }

  _fitStanding(center, normal, w, h) {
    const right = new THREE.Vector3().crossVectors(UP, normal).normalize();
    for (let tries = 0; tries < 6; tries++) {
      let blocked = false;
      for (const sx of [-0.45, 0, 0.45]) {
        for (const sy of [-0.35, 0, 0.4]) {
          for (const sz of [-0.12, 0.12]) {
            const p = center.clone().addScaledVector(right, sx * w).addScaledVector(UP, sy * h).addScaledVector(normal, sz);
            if (this.physics.pointBlocked(p.x, p.y, p.z)) blocked = true;
          }
        }
      }
      if (!blocked) return true;
      center.addScaledVector(normal, 0.35); // step it toward the shooter
    }
    return false;
  }

  /** create a portal (and link it into a pair) */
  open(spec, { linkTo = null, unpaired = false } = {}) {
    const p = new Portal(this, spec);
    this.portals.push(p);
    if (linkTo) {
      p.link = linkTo;
      linkTo.link = p;
    } else if (!unpaired) {
      if (this.pending && this.pending.state !== 'dead' && this.pending.state !== 'closing') {
        p.link = this.pending;
        this.pending.link = p;
        this.pending = null;
      } else {
        this.pending = p;
      }
    }
    this._enforceLimit();
    return p;
  }

  _enforceLimit() {
    const alive = this.portals.filter((p) => p.state !== 'closing' && p.state !== 'dead');
    const maxPortals = this.maxPairs * 2 + 1;
    let extra = alive.length - maxPortals;
    for (const p of alive) {
      if (extra <= 0) break;
      p.close();
      if (p.link) p.link.close();
      extra -= p.link ? 2 : 1;
    }
  }

  /**
   * Checks whether a body walked into a linked portal. Returns the portal it
   * entered (and teleports the body) or null.
   */
  checkTravel(body, state) {
    if (state.cooldown > 0) return null;
    for (const p of this.portals) {
      if (p.state !== 'open' && !(p.state === 'opening' && p.t > 0.6)) continue;
      if (!p.link || p.link.state === 'dead' || p.link.state === 'closing') continue;
      if (state.ignore === p) {
        // must leave the exit portal's zone before it can be entered again
        if (!this._inZone(p, body, state, 0.6)) state.ignore = null;
        continue;
      }
      if (this._inZone(p, body, state, 0)) {
        this._teleport(p, body, state);
        return p;
      }
    }
    return null;
  }

  _inZone(p, body, state, pad) {
    const b = body.pos;
    if (p.kind === 'floor') {
      const l = p.local(_v.set(b.x, b.y + 0.1, b.z).clone());
      return l.x * l.x + l.y * l.y < 0.55 + pad && Math.abs(l.z) < 0.35 + pad;
    }
    if (p.kind === 'ceiling') {
      const l = p.local(_v.set(b.x, b.y + body.height, b.z).clone());
      return l.x * l.x + l.y * l.y < 0.55 + pad && l.z > -0.35 - pad && l.z < 0.4;
    }
    const mid = new THREE.Vector3(b.x, b.y + Math.min(1.0, body.height * 0.55), b.z);
    const l = p.local(mid);
    const inside = l.x * l.x + l.y * l.y < 0.8 + pad;
    if (p.kind === 'wall') return inside && l.z < 0.45 + pad && l.z > -0.5;
    // standing portal: walk through from either side
    const prev = state.prevSide?.get(p);
    if (!state.prevSide) state.prevSide = new Map();
    state.prevSide.set(p, l.z);
    if (pad > 0) return inside && Math.abs(l.z) < 0.5 + pad;
    return inside && Math.abs(l.z) < 0.35 && prev !== undefined && Math.sign(prev) !== Math.sign(l.z || 1e-6);
  }

  _teleport(p, body, state) {
    const to = p.link;
    const ex = to.exitTransform(this.physics, body.height);
    // keep the speed you came in with, pointed out of the exit
    const speed = Math.max(2.5, Math.hypot(body.vel.x, body.vel.z), Math.abs(body.vel.y) * 0.7);
    body.pos.copy(ex.pos);
    if (to.kind === 'floor') body.vel.copy(ex.vel);
    else if (to.kind === 'ceiling') body.vel.set(0, -2, 0);
    else body.vel.copy(ex.dir).multiplyScalar(Math.min(speed, 8));
    body.grounded = false;
    state.cooldown = 0.25;
    state.ignore = to;
    state.prevSide?.clear();
    p.lastUse = to.lastUse = performance.now();
    if (state.onTeleport) state.onTeleport(p, to, ex);
    audio.portalTravel();
  }
}

export { rand };
