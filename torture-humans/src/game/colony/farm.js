// The tiny people's field: seeds you give them get planted in rows next to the
// camp, sprout, grow leaves, flower and fruit (red berries), then get picked
// and grow back. To them a full-grown plant is about as tall as they are.
import * as THREE from 'three';

const GROW_SECONDS = 360; // seed to ripe berries: 6 real minutes (6 game hours)

let shared = null;
function lib() {
  if (shared) return shared;
  const stem = new THREE.CylinderGeometry(0.00035, 0.0005, 1, 5).translate(0, 0.5, 0);
  const leaf = new THREE.PlaneGeometry(1, 0.45, 3, 1);
  {
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setY(i, y * (1 - Math.abs(x - 0.5 + 0.5) * 0.9));
      p.setZ(i, x * x * 0.25);
    }
    leaf.translate(0.5, 0, 0);
    leaf.computeVertexNormals();
  }
  shared = {
    stem, leaf,
    berry: new THREE.SphereGeometry(1, 10, 8),
    stemMat: new THREE.MeshStandardMaterial({ color: 0x4f7a2c, roughness: 0.7 }),
    leafMat: new THREE.MeshStandardMaterial({ color: 0x5b8f2f, roughness: 0.6, side: THREE.DoubleSide }),
    berryMat: new THREE.MeshPhysicalMaterial({ color: 0xb3121c, roughness: 0.25, clearcoat: 0.8 }),
    greenBerry: new THREE.MeshStandardMaterial({ color: 0x8aa83a, roughness: 0.5 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }),
  };
  return shared;
}

class Crop {
  constructor(parent, pos) {
    const L = lib();
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    parent.add(this.group);
    this.growth = 0;      // 0 seed .. 1 ripe
    this.stem = new THREE.Mesh(L.stem, L.stemMat);
    this.group.add(this.stem);
    this.leaves = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(L.leaf, L.leafMat);
      l.rotation.set(-0.5, (i / 6) * Math.PI * 2 + i * 0.4, 0.4);
      this.group.add(l);
      this.leaves.push(l);
    }
    this.berries = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(L.berry, L.greenBerry);
      b.userData.a = i * 2.1;
      this.group.add(b);
      this.berries.push(b);
    }
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.noCollide = true; } });
    this.claimedBy = null;
    this.update(0);
  }

  get ripe() { return this.growth >= 1; }

  update(dt) {
    this.growth = Math.min(1, this.growth + dt / GROW_SECONDS);
    const g = this.growth;
    const h = 0.004 + g * 0.07; // up to 7 cm (1.4 m to them)
    this.stem.scale.set(1 + g * 1.5, h, 1 + g * 1.5);
    this.leaves.forEach((l, i) => {
      const k = THREE.MathUtils.clamp(g * 6 - i * 0.6, 0, 1);
      l.visible = k > 0;
      l.scale.setScalar(0.004 + k * 0.016);
      l.position.y = h * (0.15 + (i / 6) * 0.75);
    });
    const fruit = THREE.MathUtils.clamp((g - 0.6) / 0.4, 0, 1);
    this.berries.forEach((b) => {
      b.visible = fruit > 0 && !b.userData.picked;
      b.scale.setScalar(0.0006 + fruit * 0.0017);
      b.position.set(Math.cos(b.userData.a) * 0.004, h * 0.85, Math.sin(b.userData.a) * 0.004);
      b.material = g >= 1 ? lib().berryMat : lib().greenBerry;
    });
  }

  pick() {
    for (const b of this.berries) b.userData.picked = false;
    this.growth = 0.62; // grows new berries
  }
}

export class Farm {
  constructor(colony) {
    this.c = colony;
    this.crops = [];
    this.spots = [];
    // a patch of dug soil beside the camp, opposite the stockpile
    const c = colony.center, s = colony.stock;
    const away = c.clone().sub(s).setY(0).normalize();
    let origin = null;
    for (let i = 0; i < 10 && !origin; i++) {
      const dir = away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45);
      const p = c.clone().addScaledVector(dir, 0.11);
      if (colony.clearCircle(p.x, p.z, 0.045)) origin = p;
    }
    origin ??= c.clone().addScaledVector(away, 0.11);
    this.origin = origin;
    const L = lib();
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24).rotateX(-Math.PI / 2), L.soil);
    patch.scale.set(1, 1, 0.75);
    patch.position.set(origin.x, colony.cage.surfaceY(origin.x, origin.z) + 0.0006, origin.z);
    patch.userData.noCollide = true;
    patch.receiveShadow = true;
    colony.world.add(patch);
    // planting spots in rows (2.5 cm apart: half a meter to them)
    for (let r = -1; r <= 1; r++) {
      for (let k = -1; k <= 1; k++) {
        const x = origin.x + k * 0.025, z = origin.z + r * 0.022;
        this.spots.push({ p: new THREE.Vector3(x, colony.cage.surfaceY(x, z), z), crop: null, claimedBy: null });
      }
    }
  }

  freeSpot() { return this.spots.find((s) => !s.crop && !s.claimedBy) || null; }
  ripeCrop() { return this.crops.find((c) => c.ripe && !c.claimedBy) || null; }

  plant(spot) {
    spot.crop = new Crop(this.c.world, spot.p);
    this.crops.push(spot.crop);
  }

  update(dt) {
    for (const c of this.crops) c.update(dt);
  }
}

// a berry as a food piece (red, shiny)
export function berryMesh() {
  const L = lib();
  const m = new THREE.Mesh(L.berry, L.berryMat);
  const size = 0.0022;
  m.scale.setScalar(size);
  m.userData.rest = size;
  m.userData.size = size * 2;
  m.userData.kind = 'food';
  m.castShadow = true;
  return m;
}
