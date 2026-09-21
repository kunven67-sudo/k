// Shared helpers: procedural textures, simple low-poly character builders, math utils.
// Everything here is generated at runtime (canvas + primitive geometry) - no external assets.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.33;

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function randRange(a, b) { return a + Math.random() * (b - a); }
export function damp(current, target, lambda, dt) {
  // exponential smoothing, frame-rate independent
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

// ---------- Procedural canvas textures ----------
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function canvasTexture(draw, size = 256, repeat = [1, 1]) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function woodTexture(base = '#8a5a34', dark = '#6b4225', repeat = [2, 2]) {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = dark;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.3;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const y = (i / 14) * size + randRange(-4, 4);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + randRange(-6, 6), size * 0.7, y + randRange(-6, 6), size, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 256, repeat);
}

export function tileTexture(a = '#d9d3c7', b = '#c3bcae', repeat = [4, 4]) {
  return canvasTexture((ctx, size) => {
    const n = 4;
    const cell = size / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }, 256, repeat);
}

export function fabricTexture(color = '#4a6b8a', repeat = [2, 2]) {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < size; i += 6) {
      ctx.fillRect(i, 0, 2, size);
      ctx.fillRect(0, i, size, 2);
    }
  }, 128, repeat);
}

export function carpetTexture(color = '#7a3b3b', repeat = [3, 3]) {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  }, 128, repeat);
}

export function wallpaperTexture(color = '#cdbfa5', accent = '#b8a583', repeat = [3, 2]) {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    for (let x = 0; x <= size; x += size / 6) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
  }, 256, repeat);
}

export function starTexture() {
  return canvasTexture((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#0a1029');
    grad.addColorStop(1, '#2b3d6b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.9})`;
      ctx.fillRect(Math.random() * size, Math.random() * size * 0.7, 1.5, 1.5);
    }
  }, 512, [1, 1]);
}

export function skyTexture(top = '#7ec8e3', bottom = '#d9f2ff') {
  return canvasTexture((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) {
      const cx = randRange(0, size), cy = randRange(size * 0.1, size * 0.5), r = randRange(20, 46);
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.ellipse(cx + j * r * 0.6, cy + Math.sin(j) * 6, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 512, [1, 1]);
}

export function staticNoiseTexture(size = 128) {
  return canvasTexture((ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, size, [1, 1]);
}

// ---------- Collision helpers ----------
export function boxCollider(cx, cy, cz, sx, sy, sz) {
  return new THREE.Box3(
    new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2)
  );
}

// Generic box "prop" - covers most furniture pieces as simple stacked boxes.
export function addBox(parent, colliders, {
  x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, color = '#888888', roughness = 0.85, metalness = 0,
  map = null, collide = true, castShadow = true, receiveShadow = true, name = null, rotY = 0,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, map: map || null });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (name) mesh.name = name;
  parent.add(mesh);
  if (collide) colliders.push(boxCollider(x, y, z, sx, sy, sz));
  return mesh;
}

export function addCylinder(parent, colliders, {
  x = 0, y = 0, z = 0, radiusTop = 0.3, radiusBottom = 0.3, height = 1, color = '#888888',
  roughness = 0.85, metalness = 0, collide = false, castShadow = true, receiveShadow = true, segments = 12,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  parent.add(mesh);
  if (collide) colliders.push(boxCollider(x, y, z, radiusTop * 2, height, radiusTop * 2));
  return mesh;
}

export function addSphere(parent, { x = 0, y = 0, z = 0, radius = 0.3, color = '#888888', roughness = 0.85,
  metalness = 0, emissive = null, castShadow = true } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) { mat.emissive = new THREE.Color(emissive); mat.emissiveIntensity = 1; }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  parent.add(mesh);
  return mesh;
}

// A closed rectangular room: floor, ceiling, four walls. Returns colliders for the walls.
export function buildRoomShell({ width, depth, height = 2.8, floorTex, wallTex, ceilingColor = '#e9e4d8', wallThickness = 0.2 }) {
  const group = new THREE.Group();
  const colliders = [];

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ color: ceilingColor, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = height;
  ceil.receiveShadow = true;
  group.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  function wall(cx, cz, w, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMat);
    mesh.position.set(cx, height / 2, cz);
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(boxCollider(cx, height / 2, cz, w, height, d));
  }
  wall(0, -depth / 2, width + wallThickness * 2, wallThickness);
  wall(0, depth / 2, width + wallThickness * 2, wallThickness);
  wall(-width / 2, 0, wallThickness, depth);
  wall(width / 2, 0, wallThickness, depth);

  return { group, colliders };
}

// Generic rAF-driven tween: onUpdate(progress 0..1) each frame for `duration` ms, resolves at the end.
// Used for every small procedural animation (doors, box lids, bends, recoils) instead of a full
// animation-clip system, which would be overkill for primitive-built props.
export function tween(duration, onUpdate, easing = (t) => t) {
  return new Promise(resolve => {
    const start = performance.now();
    function step() {
      const p = clamp((performance.now() - start) / duration, 0, 1);
      onUpdate(easing(p));
      if (p < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  });
}
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

// Disposes geometries/materials/textures under a root object so switching scenes doesn't leak GPU memory.
export function disposeObject3D(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

// ---------- Low-poly character builders ----------
// Returns a group plus named parts so callers can animate them per-scene.
export function buildHumanoid({ shirt = '#3b6ea5', skin = '#e2b48a', pants = '#33415c', hair = '#3a2a1e' } = {}) {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 1 });

  const hip = new THREE.Group();
  hip.position.y = 0.9;
  group.add(hip);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), shirtMat);
  torso.position.y = 0.35;
  torso.castShadow = true;
  hip.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
  head.position.y = 0.78;
  head.castShadow = true;
  hip.add(head);

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairMesh.position.y = 0.84;
  hip.add(hairMesh);

  function arm(sign) {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.28, 0.58, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 4, 6), skinMat);
    mesh.position.y = -0.24;
    mesh.castShadow = true;
    pivot.add(mesh);
    hip.add(pivot);
    return pivot;
  }
  function leg(sign) {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.11, 0.1, 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 6), pantsMat);
    mesh.position.y = -0.24;
    mesh.castShadow = true;
    pivot.add(mesh);
    hip.add(pivot);
    return pivot;
  }

  const lArm = arm(-1), rArm = arm(1), lLeg = leg(-1), rLeg = leg(1);

  return { group, hip, torso, head, lArm, rArm, lLeg, rLeg };
}

export function buildDog(fur = '#a9773f', spots = '#6b4a26') {
  const group = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: fur, roughness: 0.95 });
  const spotMat = new THREE.MeshStandardMaterial({ color: spots, roughness: 0.95 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), furMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.32;
  body.castShadow = true;
  group.add(body);

  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), spotMat);
  patch.position.set(0.1, 0.4, 0.12);
  group.add(patch);

  const headPivot = new THREE.Group();
  headPivot.position.set(0.3, 0.38, 0);
  group.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), furMat);
  head.position.x = 0.06;
  head.castShadow = true;
  headPivot.add(head);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.16, 8), furMat);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.19, -0.02, 0);
  headPivot.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
  nose.position.set(0.27, -0.02, 0);
  headPivot.add(nose);

  function ear(sign) {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6), spotMat);
    e.position.set(0.05, 0.13, sign * 0.1);
    e.rotation.x = sign * 0.5;
    e.rotation.z = 0.3;
    headPivot.add(e);
    return e;
  }
  const lEar = ear(-1), rEar = ear(1);

  const eyeMat = new THREE.MeshStandardMaterial({ color: '#151515', emissive: '#000000' });
  function eye(sign) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat);
    e.position.set(0.18, 0.03, sign * 0.09);
    headPivot.add(e);
    return e;
  }
  const lEye = eye(-1), rEye = eye(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.32, 0.4, 0);
  group.add(tailPivot);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), furMat);
  tail.position.x = -0.1;
  tail.rotation.z = Math.PI / 2;
  tailPivot.add(tail);

  function leg(x, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.22, z);
    group.add(pivot);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6), furMat);
    mesh.position.y = -0.1;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  }
  const legs = [leg(0.16, 0.12), leg(0.16, -0.12), leg(-0.16, 0.12), leg(-0.16, -0.12)];

  return { group, body, headPivot, head, lEar, rEar, lEye, rEye, tailPivot, legs };
}

export function buildDuck(body = '#5a4a3a', wing = '#3b3126', belly = '#e7dcc4') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: body, roughness: 0.85 });
  const wingMat = new THREE.MeshStandardMaterial({ color: wing, roughness: 0.85 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: belly, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
  torso.scale.set(1.3, 0.9, 1);
  torso.castShadow = true;
  group.add(torso);

  const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), bellyMat);
  bellyMesh.position.set(0, -0.08, 0.02);
  bellyMesh.scale.set(1.1, 0.7, 0.9);
  group.add(bellyMesh);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
  head.position.set(0.28, 0.14, 0);
  group.add(head);

  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), new THREE.MeshStandardMaterial({ color: '#e0a83c' }));
  bill.rotation.z = -Math.PI / 2;
  bill.position.set(0.4, 0.12, 0);
  group.add(bill);

  function wingMesh(sign) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.02, 0.05, sign * 0.18);
    group.add(pivot);
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), wingMat);
    m.rotation.x = sign * Math.PI / 2;
    m.rotation.z = Math.PI / 2.4;
    m.position.z = sign * 0.05;
    pivot.add(m);
    return pivot;
  }
  const lWing = wingMesh(-1), rWing = wingMesh(1);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), wingMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.26, 0.06, 0);
  group.add(tail);

  group.userData.isDuck = true;
  return { group, torso, head, lWing, rWing, tail };
}

// Simple full-screen glitch flash overlay, reused by transitions + horror escalation.
export function triggerDomGlitch(durationMs = 350) {
  const el = document.getElementById('glitch-overlay');
  if (!el) return;
  el.classList.remove('glitching');
  void el.offsetWidth; // restart animation
  el.classList.add('glitching');
  setTimeout(() => el.classList.remove('glitching'), durationMs);
}
