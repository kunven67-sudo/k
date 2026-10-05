// What makes a body look alive, layered on top of the mocap animation:
// breathing, eyes that dart around, a face that's never perfectly still,
// soft-tissue jiggle, and skin that flushes, pales and sweats.
// Cost follows graphics.humansDetail: low = breathing + blinking only;
// medium adds eye darts, micro-movement and jiggle; high adds skin pores
// and the skin light-glow; ultra adds body (belly/chest) jiggle.
import * as THREE from 'three';

const LEVEL = { low: 0, medium: 1, high: 2, ultra: 3 };
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _a = new THREE.Vector3();

function rotateWorld(bone, axis, angle) {
  if (!bone || !angle) return;
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  _q.setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(pq.clone().invert().multiply(_q).multiply(pq));
}

// ---- skin: a tiling pore/fine-wrinkle height texture (made once, no file)
let poreTex = null;
function pores() {
  if (poreTex) return poreTex;
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const h = new Float32Array(n * n).fill(1);
  // pits of random size (pores) on a slightly bumpy base
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 900; k++) {
    const cx = rnd() * n, cy = rnd() * n, r = 0.8 + rnd() * 1.6, d = 0.35 + rnd() * 0.5;
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const dist = Math.hypot(x, y) / r;
      if (dist > 1) continue;
      const i = ((Math.floor(cy + y) + n) % n) * n + ((Math.floor(cx + x) + n) % n);
      h[i] = Math.min(h[i], 1 - d * (1 - dist * dist));
    }
  }
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(255, (h[i] * 0.85 + rnd() * 0.15) * 255));
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  poreTex = new THREE.CanvasTexture(c);
  poreTex.wrapS = poreTex.wrapT = THREE.RepeatWrapping;
  return poreTex;
}

// Gives this character its own skin materials with the life uniforms.
function upgradeSkin(character, level) {
  const u = {
    uFlush: { value: 0 },     // anger / embarrassment / exertion: redder
    uPale: { value: 0 },      // fear / sick / dying: whiter, less blood
    uWet: { value: 0 },       // sweat: shinier
    uGlow: { value: level >= LEVEL.high ? 1 : 0 },   // light seeping through thin skin (ears, nose, fingers)
    uPores: { value: level >= LEVEL.high ? 1 : 0 },
    uPoreMap: { value: pores() },
    // clothes: dirt on shoes and trouser legs, rain-soaked, sweat patches, blood stains
    uDirt: { value: 0 },
    uSoak: { value: 0 },
    uSweat: { value: 0 },
    uStains: { value: [new THREE.Vector4(0, -9, 0, 0), new THREE.Vector4(0, -9, 0, 0), new THREE.Vector4(0, -9, 0, 0), new THREE.Vector4(0, -9, 0, 0)] },
    uWeave: { value: level >= LEVEL.high ? 1 : 0 },
  };
  character.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mats = [].concat(o.material).map((m) => {
      if (!/body|head/i.test(m.name) || /opacity/i.test(m.name)) return m;
      const c = m.clone();
      const isBody = /body/i.test(m.name);
      c.onBeforeCompile = c.userData.extraCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        // where on the body (bind pose, meters: y = height, arms out sideways)
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vBind;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
uniform float uFlush, uPale, uWet, uGlow, uPores, uDirt, uSoak, uSweat, uWeave; uniform sampler2D uPoreMap;
uniform vec4 uStains[4];
varying vec3 vBind;
float gauss3(vec3 d, float r) { return exp(-dot(d, d) / (r * r)); }`)
          // clothes and grime (after the skin tint)
          .replace('#include <color_fragment>', `#include <color_fragment>
{
  float n = texture2D(uPoreMap, vBind.xy * 2.7 + vBind.z).r;
  ${isBody ? `// mud and dust climb up from the shoes
  float dirt = uDirt * (1.0 - smoothstep(0.03, 0.6, vBind.y + n * 0.12));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.23, 0.15) * (0.7 + n * 0.5), clamp(dirt, 0.0, 1.0) * 0.85);
  // sweat: armpits and the middle of the back go dark first
  float sw = uSweat * (gauss3(vBind - vec3(0.17, 1.27, 0.0), 0.07) + gauss3(vBind - vec3(-0.17, 1.27, 0.0), 0.07) + gauss3((vBind - vec3(0.0, 1.12, -0.13)) * vec3(1.0, 0.7, 1.0), 0.11));
  diffuseColor.rgb *= 1.0 - 0.32 * clamp(sw, 0.0, 1.0);` : ''}
  // soaked by rain: darker everywhere
  diffuseColor.rgb *= 1.0 - 0.3 * uSoak;
  // blood: dark red, ragged edges
  float blood = 0.0;
  for (int i = 0; i < 4; i++) blood += 1.0 - smoothstep(uStains[i].w * 0.35, uStains[i].w + 1e-4, length(vBind - uStains[i].xyz) + (n - 0.5) * uStains[i].w * 0.8);
  blood = clamp(blood, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.015, 0.01), blood * 0.9);
}`)
          // blood in the skin: flush toward red, pale toward grey-white
          .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 0.86, 0.84), uFlush * 0.6);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * vec3(1.02, 1.0, 1.02), uPale * 0.45);`)
          // sweat: shinier skin
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, max(uWet, uSoak * 0.8));`)
          // pores: a fine bump from the tiling pore map (screen-space derivatives, cheap)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef USE_UV
if (uPores > 0.5 || uWeave > 0.5) {
  // skin pores on the head; on the body: the weave of the fabric
  vec2 puv = ${isBody ? 'vUv * 140.0' : 'vUv * 38.0'};
  float ph = texture2D(uPoreMap, puv).r;
  vec2 dh = vec2(dFdx(ph), dFdy(ph)) * 0.6;
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  normal = normalize(abs(det) * normal - grad * 0.9);
}
#endif`)
          // light passing through thin skin: a warm red glow at the edges (ears, nose, fingers)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uGlow > 0.5) {
  float edge = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.9, 0.25, 0.15) * edge * 0.18 * (1.0 - uPale * 0.7);
}`);
      };
      c.customProgramCacheKey = () => `skin-life-${level}-${isBody ? 'body' : 'head'}`;
      return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  return u;
}

// A damped spring (soft tissue): follows a target, overshoots, settles.
class Spring {
  constructor(k = 120, damp = 9) { this.k = k; this.d = damp; this.x = new THREE.Vector3(); this.v = new THREE.Vector3(); }
  step(target, dt) {
    _a.copy(target).sub(this.x).multiplyScalar(this.k).addScaledVector(this.v, -this.d);
    this.v.addScaledVector(_a, dt);
    this.x.addScaledVector(this.v, dt);
    return this.x;
  }
}

export class Life {
  constructor(character, settings) {
    this.ch = character;
    this.settings = settings;
    this.level = LEVEL[settings?.get?.('graphics.humansDetail')] ?? 1;
    this.skin = upgradeSkin(character, this.level);
    this.t = Math.random() * 100;
    this.breath = Math.random();
    this.eye = { yaw: 0, pitch: 0, toYaw: 0, toPitch: 0, timer: 0.5 };
    this.lastPos = new THREE.Vector3();
    this.lastVel = new THREE.Vector3();
    this.torso = new Spring(90, 8);
    this.cheeks = new Spring(260, 12);
    this.first = true;
    // face bones the mocap doesn't move: remember their rest pose (offsets are added fresh each frame)
    this.rest = ['Bip01_LEye', 'Bip01_REye', 'Bip01_LCheek', 'Bip01_RCheek'].map((n) => character.bones[n]).filter(Boolean)
      .map((b) => ({ b, q: b.quaternion.clone(), p: b.position.clone() }));
    // how they feel right now (set by the owner each frame)
    this.fear = 0; this.anger = 0; this.effort = 0; this.sad = 0;
    this.rain = 0;        // how hard it's raining on them right now (set by the weather)
    this.dirty = 0;
    this.nextStain = 0;
  }

  // Blood where they got hurt (world point); goreScale 0 = none.
  addStain(worldPoint, radius = 0.09, goreScale = 1) {
    if (goreScale <= 0) return;
    const l = this.ch.root.worldToLocal(worldPoint.clone());
    const s = this.skin.uStains.value[this.nextStain++ % 4];
    s.set(l.x, l.y, l.z, radius * goreScale);
  }

  update(dt) {
    if (dt <= 0) return;
    for (const r of this.rest) { r.b.quaternion.copy(r.q); r.b.position.copy(r.p); }
    const B = this.ch.bones;
    const root = this.ch.root;
    const s = root.getWorldScale(_w).y || 1;
    this.t += dt;
    const head = B.Bip01_Head;
    // body acceleration (for jiggle): from how the root moved
    root.getWorldPosition(_v);
    if (this.first) { this.lastPos.copy(_v); this.first = false; }
    const vel = _v.clone().sub(this.lastPos).divideScalar(dt * s);
    const acc = vel.clone().sub(this.lastVel).divideScalar(dt);
    this.lastPos.copy(_v);
    this.lastVel.copy(vel);
    const speed = Math.hypot(vel.x, vel.z);
    this.effort = Math.max(this.effort * Math.exp(-dt * 0.08), Math.min(1, speed / 3.5));

    // breathing: 12-16 per minute at rest, up to ~40 when panicking or out of breath
    const rate = (0.22 + this.fear * 0.35 + this.effort * 0.4) * Math.PI * 2;
    this.breath += rate * dt;
    const b = Math.sin(this.breath);
    const depth = 0.012 + this.effort * 0.02 + this.fear * 0.012;
    const up = _w.set(0, 1, 0);
    if (B.Bip01_Spine2) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(_q));
      rotateWorld(B.Bip01_Spine2, right, -b * depth);
    }
    for (const side of ['L', 'R']) {
      const cl = B[`Bip01_${side}_Clavicle`];
      if (cl) rotateWorld(cl, new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_q)), (side === 'L' ? -1 : 1) * b * depth * 0.6);
    }

    if (this.level >= LEVEL.medium) {
      // face never perfectly still: slow tiny head drift
      if (head) {
        const n = Math.sin(this.t * 0.9) * 0.5 + Math.sin(this.t * 2.3 + 1) * 0.3;
        rotateWorld(head, up, n * 0.012);
      }
      // eyes dart between things (saccades): quick jump, hold, jump
      const e = this.eye;
      e.timer -= dt;
      if (e.timer <= 0) {
        const wide = this.fear > 0.6 ? 0.28 : 0.14;
        e.toYaw = (Math.random() - 0.5) * wide;
        e.toPitch = (Math.random() - 0.5) * wide * 0.5;
        e.timer = this.fear > 0.6 ? 0.15 + Math.random() * 0.4 : 0.4 + Math.random() * 2.2;
      }
      const k = 1 - Math.exp(-dt * 45); // ~40 ms to land
      e.yaw += (e.toYaw - e.yaw) * k;
      e.pitch += (e.toPitch - e.pitch) * k;
      if (head) {
        head.updateMatrixWorld(true);
        const hq = head.getWorldQuaternion(new THREE.Quaternion());
        const hUp = new THREE.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(_q));
        const hRight = new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(_q));
        void hq;
        for (const eye of [B.Bip01_LEye, B.Bip01_REye]) {
          rotateWorld(eye, hUp, e.yaw);
          rotateWorld(eye, hRight, e.pitch);
        }
      }
      // soft tissue: the torso lags behind sudden moves and wobbles back; cheeks bounce
      const target = acc.multiplyScalar(-0.0009).clampLength(0, 0.08);
      const t = this.torso.step(target, dt);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_q));
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(_q));
      if (B.Bip01_Spine1) {
        rotateWorld(B.Bip01_Spine1, right, t.dot(fwd) * 0.6);
        rotateWorld(B.Bip01_Spine1, fwd, -t.dot(right) * 0.4);
      }
      // running bounce: vertical acceleration shakes the cheeks
      const ch = this.cheeks.step(new THREE.Vector3(0, THREE.MathUtils.clamp(-acc.y * 0.00025, -0.004, 0.004), 0), dt);
      if (B.Bip01_LCheek) B.Bip01_LCheek.position.addScaledVector(up, ch.y * 0.5);
      if (B.Bip01_RCheek) B.Bip01_RCheek.position.addScaledVector(up, ch.y * 0.5);
    }

    const u = this.skin;
    // clothes: dirt builds up while walking outside (slowly), rain soaks, sweat from effort or fear
    if (speed > 0.3 && this.outdoors) this.dirty = Math.min(1, this.dirty + dt * 0.002 * speed);
    u.uDirt.value = 0.15 + this.dirty * 0.7;
    u.uSoak.value += ((this.rain > 0.1 ? 1 : 0) - u.uSoak.value) * dt * (this.rain > 0.1 ? 0.05 * this.rain : 0.003);
    u.uSweat.value += (Math.min(1, this.effort * 1.2 + Math.max(0, this.fear - 0.5)) - u.uSweat.value) * dt * 0.02;
    // skin: blood rushes to the face when angry or working hard, drains when terrified
    const k2 = 1 - Math.exp(-dt * 1.5);
    u.uFlush.value += (Math.min(1, this.anger * 0.9 + this.effort * 0.5) - u.uFlush.value) * k2;
    u.uPale.value += (Math.max(0, this.fear - 0.5) * 1.6 - u.uPale.value) * k2;
    u.uWet.value += (Math.min(1, this.effort * 0.8 + Math.max(0, this.fear - 0.6)) - u.uWet.value) * (1 - Math.exp(-dt * 0.3));
  }
}
