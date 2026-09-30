// What tiny people build, piece by piece, from the wood and stones they bring.
// Each blueprint is a list of slots (where one real piece goes); a building on
// its site shows exactly the pieces placed so far, so you watch it grow.
// Site space: origin on the ground at the middle, +Z = the front/door.
import * as THREE from 'three';
import { pieceMesh, firewoodMesh, POLE } from './items.js';

const X = new THREE.Vector3(1, 0, 0);

// a pole lying from a to b (pole meshes run along X), rolled a bit at random
function poleSlot(a, b, extra = {}) {
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(X, dir);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.random() * Math.PI * 2));
  return { kind: 'wood', pos: a.clone().lerp(b, 0.5), quat: q, ...extra };
}

// a pole of POLE.length starting at `foot`, heading toward `toward`
function poleFrom(foot, toward, extra) {
  const dir = toward.clone().sub(foot).normalize();
  return poleSlot(foot, foot.clone().addScaledVector(dir, POLE.length), extra);
}

function stoneSlot(pos, size, yaw, extra = {}) {
  return { kind: 'stone', pos, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), size, ...extra };
}

export const BLUEPRINTS = {
  // a ring of stones with a small stack of firewood; lit once the wood is in
  campfire: {
    name: 'campfire',
    radius: 0.026,
    obstacle: { radius: 0.024, height: 0.02 },
    slots() {
      const s = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        s.push(stoneSlot(new THREE.Vector3(Math.cos(a) * 0.018, 0.0024, Math.sin(a) * 0.018), 0.0085, a, { work: 'low' }));
      }
      s.push({ kind: 'wood', firewood: true, pos: new THREE.Vector3(0, 0, 0), quat: new THREE.Quaternion(), work: 'low' });
      return s;
    },
  },

  // two forked posts, a ridge pole, and a sloping roof of poles down to the back
  leanto: {
    name: 'lean-to',
    radius: 0.07,
    obstacle: { half: { x: 0.052, y: 0.035, z: 0.042 }, offset: new THREE.Vector3(0, 0, -0.034) },
    slots() {
      const s = [];
      const ridgeY = 0.068;
      for (const x of [-0.042, 0.042]) s.push(poleSlot(new THREE.Vector3(x, -0.012, 0.002), new THREE.Vector3(x, -0.012 + POLE.length, 0.002), { work: 'mid' }));
      s.push(poleSlot(new THREE.Vector3(-0.05, ridgeY, -0.002), new THREE.Vector3(0.05, ridgeY, -0.002), { work: 'high' }));
      const back = Math.sqrt(POLE.length ** 2 - ridgeY ** 2);
      for (let i = 0; i < 12; i++) {
        const x = -0.042 + (i / 11) * 0.084 + (Math.random() - 0.5) * 0.002;
        s.push(poleSlot(new THREE.Vector3(x, 0.0015, -back), new THREE.Vector3(x, ridgeY + POLE.radius * 2, -0.004), { work: 'mid' }));
      }
      return s;
    },
  },

  // a cone of poles crossing near the top, with a gap at the front for the door
  tipi: {
    name: 'tipi',
    radius: 0.05,
    obstacle: { radius: 0.046, height: 0.08 },
    slots() {
      const s = [];
      const apex = new THREE.Vector3(0, 0.077, 0);
      // tripod first (it stands on its own), then the rest around it; slot 0 is the door
      for (const k of [4, 8, 11, 1, 6, 2, 10, 3, 9, 5, 7]) {
        const a = Math.PI / 2 + (k / 12) * Math.PI * 2;
        const foot = new THREE.Vector3(Math.cos(a) * 0.042, -0.002, Math.sin(a) * 0.042);
        s.push(poleFrom(foot, apex.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.004, 0, (Math.random() - 0.5) * 0.004)), { work: 'mid' }));
      }
      return s;
    },
  },

  // a round dry-stone wall (three courses, door gap at the front) with a pole roof
  stonehut: {
    name: 'stone hut',
    radius: 0.056,
    obstacle: { radius: 0.052, height: 0.08 },
    slots() {
      const s = [];
      const R = 0.045, size = 0.0105, courseH = size * 0.62;
      const door = 0.36; // half-angle of the doorway (radians) around +Z
      const n = Math.round((Math.PI * 2 * R) / (size * 0.98));
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < n; i++) {
          const a = ((i + (c % 2) * 0.5) / n) * Math.PI * 2;
          const off = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
          if (Math.abs(off) < door) continue;
          s.push(stoneSlot(new THREE.Vector3(Math.cos(a) * R, courseH * 0.5 + c * courseH, Math.sin(a) * R), size, -a + (Math.random() - 0.5) * 0.4, { work: c < 2 ? 'low' : 'mid' }));
        }
      }
      const top = courseH * 3;
      const apex = new THREE.Vector3(0, 0.078, 0);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.2;
        const rim = new THREE.Vector3(Math.cos(a) * (R + 0.004), top, Math.sin(a) * (R + 0.004));
        const dir = apex.clone().sub(rim).normalize();
        const foot = rim.clone().addScaledVector(dir, -0.012); // eaves hang past the wall
        s.push(poleFrom(foot, apex, { work: 'high' }));
      }
      return s;
    },
  },
};

// What to build next: a fire first, then shelters (roughly one per two people).
export function nextBlueprint(built, residents) {
  if (!built.includes('campfire')) return 'campfire';
  const shelters = built.filter((b) => b !== 'campfire').length;
  if (shelters * 2 >= Math.max(2, residents)) return null;
  return ['leanto', 'tipi', 'stonehut'][Math.min(2, shelters)] ?? 'stonehut';
}

export class Site {
  // parent: the tiny world group; origin: site center on the ground (parent space); yaw: front direction
  constructor(key, parent, origin, yaw) {
    this.key = key;
    this.bp = BLUEPRINTS[key];
    this.group = new THREE.Group();
    this.group.name = `site-${key}`;
    this.group.position.copy(origin);
    this.group.rotation.y = yaw;
    parent.add(this.group);
    this.slots = this.bp.slots().map((s, i) => ({ ...s, i, filled: false, claimedBy: null, mesh: null }));
    this.fire = null;
    this.placing = []; // pieces flying from hands into their slots
  }

  get done() { return this.slots.every((s) => s.filled); }
  get progress() { return this.slots.filter((s) => s.filled).length / this.slots.length; }

  // how many of each material still missing (not placed, not on the way)
  missing(kind) {
    return this.slots.filter((s) => !s.filled && !s.claimedBy && s.kind === kind).length;
  }

  // the next free slot for this material. Builds bottom-up in blueprint order:
  // only the first few open slots can be taken, so walls rise course by course.
  openSlot(kind) {
    let open = 0;
    for (const s of this.slots) {
      if (s.filled) continue;
      if (open++ > 4) return null;
      if (!s.claimedBy && s.kind === kind) return s;
    }
    return null;
  }

  // slot position in the parent's space (the tiny world)
  slotPoint(s) {
    this.group.updateMatrix();
    return s.pos.clone().applyMatrix4(this.group.matrix);
  }

  // A carried piece goes into its slot: it moves from the builder's hands into
  // place over `time` seconds. onSet runs when it lands (collider, fire...).
  place(s, mesh, time = 0.5, onSet) {
    s.filled = true;
    s.claimedBy = null;
    let target;
    if (s.firewood) {
      // the pole is broken into four sticks, leaned together
      mesh.removeFromParent();
      target = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const stick = firewoodMesh();
        const foot = new THREE.Vector3(Math.cos(a) * 0.0075, 0.0015, Math.sin(a) * 0.0075);
        const top = new THREE.Vector3(Math.cos(a + 2) * 0.0015, 0.011, Math.sin(a + 2) * 0.0015);
        stick.position.copy(foot).lerp(top, 0.5);
        stick.quaternion.setFromUnitVectors(X, top.clone().sub(foot).normalize());
        target.add(stick);
      }
      this.group.add(target);
      target.position.copy(s.pos);
      s.mesh = target;
      onSet?.(target);
      return;
    }
    // world -> site space, then glide into the slot
    this.group.attach(mesh);
    const from = { p: mesh.position.clone(), q: mesh.quaternion.clone(), s: mesh.scale.clone() };
    const toScale = s.size ? new THREE.Vector3().setScalar(s.size / 2) : mesh.scale.clone();
    this.placing.push({ mesh, from, to: { p: s.pos.clone(), q: s.quat.clone(), s: toScale }, t: 0, time, onSet });
    s.mesh = mesh;
  }

  update(dt) {
    for (let i = this.placing.length - 1; i >= 0; i--) {
      const p = this.placing[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.time);
      const e = k * k * (3 - 2 * k);
      p.mesh.position.lerpVectors(p.from.p, p.to.p, e);
      // a little lift in the middle, like it's being set down
      p.mesh.position.y += Math.sin(k * Math.PI) * 0.004;
      p.mesh.quaternion.slerpQuaternions(p.from.q, p.to.q, e);
      p.mesh.scale.lerpVectors(p.from.s, p.to.s, e);
      if (k >= 1) {
        this.placing.splice(i, 1);
        p.onSet?.(p.mesh);
      }
    }
    this.fire?.update(dt);
  }
}

// ---- fire: flickering flames, embers, glow and a thin smoke column

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  grd.addColorStop(0, 'rgba(255,245,200,1)');
  grd.addColorStop(0.25, 'rgba(255,190,70,0.95)');
  grd.addColorStop(0.55, 'rgba(240,90,20,0.55)');
  grd.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = grd;
  // a teardrop: round at the bottom, pointed at the top
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(44, 40, 60, 70, 56, 96);
  g.bezierCurveTo(52, 124, 12, 124, 8, 96);
  g.bezierCurveTo(4, 70, 20, 40, 32, 4);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let flameTex = null;
export class Fire {
  constructor(parent, pos) {
    flameTex ??= flameTexture();
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    parent.add(this.group);
    this.flames = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff });
      const sp = new THREE.Sprite(m);
      sp.center.set(0.5, 0.1);
      sp.userData = { phase: Math.random() * 10, x: (Math.random() - 0.5) * 0.006, z: (Math.random() - 0.5) * 0.006, h: 0.012 + Math.random() * 0.008 };
      this.group.add(sp);
      this.flames.push(sp);
    }
    this.light = new THREE.PointLight(0xff8a3a, 0, 0.45, 2);
    this.light.position.y = 0.012;
    this.group.add(this.light);
    this.fuel = 0;   // seconds of burning left
    this.lit = 0;    // 0..1 fade in/out
    this.t = 0;
  }

  addFuel(seconds) { this.fuel = Math.min(600, this.fuel + seconds); }
  get burning() { return this.fuel > 0; }

  update(dt) {
    this.t += dt;
    this.fuel = Math.max(0, this.fuel - dt);
    const want = this.fuel > 0 ? 1 : 0;
    this.lit += (want - this.lit) * (1 - Math.exp(-dt * 1.5));
    const strength = this.lit * (0.6 + Math.min(1, this.fuel / 60) * 0.4);
    let flick = 0;
    for (const f of this.flames) {
      const u = f.userData;
      const n = Math.sin(this.t * 9 + u.phase) * 0.5 + Math.sin(this.t * 23 + u.phase * 3) * 0.3;
      const h = u.h * strength * (1 + n * 0.25);
      f.scale.set(h * 0.45, h, 1);
      f.position.set(u.x + Math.sin(this.t * 5 + u.phase) * 0.0006, 0.001, u.z);
      f.material.opacity = strength * (0.75 + n * 0.2);
      f.visible = strength > 0.02;
      flick += n;
    }
    this.light.intensity = strength * (0.35 + flick * 0.02);
  }
}
