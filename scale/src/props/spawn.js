// Rift delivery: things you order on your phone come out of a small rift that opens in front of you.
//
// Where it lands is worked out for real: where you're looking if that's a floor or a table close
// enough, otherwise a clear spot in front of you (never through a wall, never inside the sofa, never
// on top of you). Orders of several items arrive one after another, one per physics step, because a
// new object only becomes "solid" to space checks after the physics world has stepped once.
import * as THREE from 'three';
import { Prop, fitsAt } from './prop.js';
import { bus } from '../core/events.js';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();

export class Spawner {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.portals = [];
    this.lastStep = -1;
    this.orders = []; // { name, id, qty, scale, time }
    game.updatables.add(this);
  }

  // Order something. qty items at scale `scale` (1 = real size).
  order(def, { scale = 1, qty = 1 } = {}) {
    this.queue.push({ def, scale, left: qty, made: 0 });
    this.orders.unshift({ id: def.id, name: def.name, qty, scale, time: new Date() });
    if (this.orders.length > 40) this.orders.length = 40;
  }

  update(dt) {
    for (const p of this.portals) p.update(dt);
    this.portals = this.portals.filter((p) => !p.done);
    if (!this.queue.length || this.game.physics.stepCount === this.lastStep) return;
    this.lastStep = this.game.physics.stepCount;
    const job = this.queue[0];
    const prop = this.spawn(job.def, job.scale);
    if (!prop) {
      bus.emit('toast', job.made ? `No more room here (${job.made} of ${job.made + job.left} delivered)` : `No room here for the ${job.def.name.toLowerCase()}`);
      this.queue.shift();
      return;
    }
    job.made++;
    if (--job.left <= 0) this.queue.shift();
  }

  // Find a clear spot and create the thing there. Returns the prop, or null if there's no room.
  spawn(def, scale) {
    const spot = this.findSpot(def, scale);
    if (!spot) return null;
    const prop = new Prop(this.game, def, { position: [spot.x, spot.y, spot.z], rotationY: spot.yaw, scale, sleeping: false });
    prop.body.wakeUp();
    const size = def.size * scale;
    this.portals.push(new RiftPortal(this.game, spot, size, prop));
    bus.emit('spawn', prop);
    return prop;
  }

  findSpot(def, s) {
    const game = this.game;
    const pl = game.player;
    const physics = game.physics;
    const H = pl.height;
    const size = (def.size || 0.1) * s;
    const yaw = pl.yaw;
    const chest = pl.feet.clone().addScaledVector(UP, H * 0.55);
    const notMe = (c) => {
      const o = physics.ownerOf(c);
      return o !== pl && !(o && o.held);
    };
    const tryAt = (x, z, yTop, yBottom) => {
      // Straight line from you to the spot must be clear (no spawning through walls).
      const to = new THREE.Vector3(x - chest.x, 0, z - chest.z);
      const dist = to.length();
      if (dist > 1e-6) {
        to.divideScalar(dist);
        const block = physics.raycast(chest, to, dist, { excludeBody: pl.body, predicate: notMe });
        if (block) return null;
      }
      // Drop a ray straight down to find the floor or table top there.
      const from = new THREE.Vector3(x, yTop, z);
      const hit = physics.raycast(from, { x: 0, y: -1, z: 0 }, yTop - yBottom, { excludeBody: pl.body, predicate: notMe });
      if (!hit || hit.normal.y < 0.6) return null;
      const origin = new THREE.Vector3(x, hit.point.y + Math.max(size * 0.03, 1e-5), z);
      _q.setFromAxisAngle(UP, yaw);
      if (!fitsAt(game, def, s, origin, _q, { strict: true })) return null;
      return { x: origin.x, y: origin.y, z: origin.z, yaw };
    };
    // How high above you there's room (so the downward ray doesn't start on the floor upstairs).
    const up = physics.raycast(chest, { x: 0, y: 1, z: 0 }, H * 2 + size * 2, { excludeBody: pl.body, predicate: notMe });
    const ceil = up ? up.point.y - Math.min(H, size) * 0.02 : chest.y + H * 2 + size * 2;
    const yTop = Math.min(ceil, pl.feet.y + Math.max(H, size) * 1.5);
    const yBottom = pl.feet.y - H * 2 - size * 2;

    // 1) Where you're looking, if it's a floor/table near you.
    const aim = pl.hands?.aimHit;
    if (aim && aim.normal && aim.normal.y > 0.6) {
      const d = Math.hypot(aim.point.x - pl.feet.x, aim.point.z - pl.feet.z);
      if (d > H * 0.25 + size * 0.5 && d < H * 5 + size * 2) {
        const r = tryAt(aim.point.x, aim.point.z, Math.min(yTop, aim.point.y + size * 1.2 + H * 0.2), aim.point.y - H * 0.5 - size);
        if (r) return r;
      }
    }
    // 2) A clear spot in front of you, a little to the right so your own body doesn't hide it from
    //    the camera (it sits over your right shoulder), then further out and to the sides.
    const base = H * 0.45 + 0.13 * H + size * 0.6;
    for (const k of [1, 1.4, 2, 2.8]) {
      for (const a of [-0.38, 0.38, 0, -0.85, 0.85, -1.5, 1.5, 2.3, -2.3, Math.PI]) {
        const dir = yaw + a;
        const x = pl.feet.x - Math.sin(dir) * base * k;
        const z = pl.feet.z - Math.cos(dir) * base * k;
        const r = tryAt(x, z, yTop, yBottom);
        if (r) return r;
      }
    }
    return null;
  }
}

// ---- the rift a delivery comes out of -------------------------------------------------------------
const portalMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime; uniform float uOpen; varying vec2 vUv;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    float noise(float x){ float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
    void main(){
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float a = atan(p.y, p.x);
      // Torn, flickering edge.
      float edge = (0.62 + 0.18 * noise(a * 3.0 + uTime * 6.0) + 0.12 * noise(a * 9.0 - uTime * 11.0)) * uOpen;
      float inside = smoothstep(edge, edge - 0.08, r);
      float rim = exp(-pow((r - edge) * 18.0, 2.0));
      float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 14.0 - uTime * 9.0);
      vec3 cyan = vec3(0.18, 0.95, 1.0), pink = vec3(1.0, 0.18, 0.53);
      vec3 col = mix(pink, cyan, swirl) * inside * 0.32 + mix(cyan, vec3(1.0), 0.15) * rim * 1.15;
      float alpha = clamp(inside * 0.85 + rim, 0.0, 1.0);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(col * alpha, alpha);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const beamMat = () => new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uFade; varying vec2 vUv;
    void main(){
      float a = pow(vUv.y, 1.6) * uFade * 0.28;
      gl_FragColor = vec4(vec3(0.3, 0.95, 1.0) * a, a);
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  toneMapped: false,
});

const PORTAL_GEO = new THREE.PlaneGeometry(2, 2);
PORTAL_GEO.rotateX(-Math.PI / 2);
const BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
BEAM_GEO.translate(0, 0.5, 0);

class RiftPortal {
  constructor(game, spot, size, prop) {
    this.game = game;
    this.prop = prop;
    this.t = 0;
    this.done = false;
    this.size = size;
    this.group = new THREE.Group();
    this.group.position.set(spot.x, spot.y, spot.z);
    const h = size * 1.15 + size * 0.1;
    this.disc = new THREE.Mesh(PORTAL_GEO, portalMat());
    this.disc.position.y = h;
    this.disc.scale.setScalar(size * 0.75);
    this.disc.frustumCulled = false;
    this.beam = new THREE.Mesh(BEAM_GEO, beamMat());
    this.beam.scale.set(size * 0.5, h, size * 0.5);
    this.beam.frustumCulled = false;
    this.group.add(this.disc, this.beam);
    this.group.updateMatrixWorld(true);
    game.scene.add(this.group);
    // The thing grows out of the rift over a quarter second (just how it looks; its physics body
    // is already its full size, so nothing can end up inside it).
    this.s = prop.scale;
    prop.object.scale.setScalar(prop.scale * 0.02);
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const open = t < 0.18 ? t / 0.18 : t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.3);
    this.disc.material.uniforms.uTime.value = t;
    this.disc.material.uniforms.uOpen.value = open;
    this.beam.material.uniforms.uFade.value = t < 0.12 ? 0 : t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) / 0.3);
    const p = this.prop;
    if (p.object.parent) {
      const k = Math.min(1, Math.max(0, (t - 0.1) / 0.28));
      const e = 1 - Math.pow(1 - k, 3);
      // If the ray or anything else resized it meanwhile, use its real current size.
      p.object.scale.setScalar(p.scale * Math.max(0.02, e));
    }
    if (t > 1.0) {
      if (p.object.parent) p.object.scale.setScalar(p.scale);
      this.group.removeFromParent();
      this.disc.material.dispose();
      this.beam.material.dispose();
      this.done = true;
    }
  }
}
