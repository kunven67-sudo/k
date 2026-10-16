// Builds the 3D model of a gadget from its parts: the body shape, one glowing canister per core
// (each core has its own symbol inside), the muzzle/attachment from the mod, and coils for power.
import * as THREE from 'three';
import { roundedBox } from '../world/materials.js';
import { BODIES, CORES } from './parts.js';

const mats = new Map();
function mat(c, rough = 0.4, metal = 0.6, emissive = 0, ei = 0) {
  const k = `${c}:${rough}:${metal}:${emissive}:${ei}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei }));
  return mats.get(k);
}
const glowMat = (c, i = 1.8) => mat(0x111111, 0.4, 0.1, c, i);
const glassM = () => { if (!mats.has('glass')) mats.set('glass', new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false })); return mats.get('glass'); };

function m(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; return o; }

function icon(kind, color) {
  const g = glowMat(color, 2.2);
  const s = 0.012;
  switch (kind) {
    case 'cones-in': { const o = new THREE.Group(); o.add(m(new THREE.ConeGeometry(s, s * 1.4, 8), g, 0, s, 0, Math.PI), m(new THREE.ConeGeometry(s, s * 1.4, 8), g, 0, -s, 0)); return o; }
    case 'cones-out': { const o = new THREE.Group(); o.add(m(new THREE.ConeGeometry(s, s * 1.4, 8), g, 0, s), m(new THREE.ConeGeometry(s, s * 1.4, 8), g, 0, -s, 0, Math.PI)); return o; }
    case 'crystal': return m(new THREE.OctahedronGeometry(s * 1.3), g);
    case 'flame': return m(new THREE.ConeGeometry(s, s * 2.4, 7), g);
    case 'bolt': return m(new THREE.TetrahedronGeometry(s * 1.5), g, 0, 0, 0, 0.5, 0.3, 0.9);
    case 'ring': return m(new THREE.TorusGeometry(s, s * 0.3, 8, 16), g);
    case 'ring2': return m(new THREE.TorusKnotGeometry(s * 0.8, s * 0.2, 30, 6), g);
    case 'cube': return m(new THREE.BoxGeometry(s * 1.6, s * 1.6, s * 1.6), g, 0, 0, 0, 0.6, 0.6, 0);
    case 'heart': { const o = new THREE.Group(); o.add(m(new THREE.SphereGeometry(s * 0.7, 8, 6), g, -s * 0.5, s * 0.3), m(new THREE.SphereGeometry(s * 0.7, 8, 6), g, s * 0.5, s * 0.3), m(new THREE.ConeGeometry(s * 1.1, s * 1.4, 10), g, 0, -s * 0.5, 0, Math.PI)); return o; }
    case 'star': return m(new THREE.DodecahedronGeometry(s * 1.2), g);
    case 'spike': return m(new THREE.IcosahedronGeometry(s * 1.2), g);
    case 'eye': { const o = new THREE.Group(); o.add(m(new THREE.SphereGeometry(s * 1.1, 10, 8), glowMat(0xffffff, 1.5)), m(new THREE.SphereGeometry(s * 0.55, 8, 6), g, 0, 0, s * 0.7)); return o; }
    case 'twin': { const o = new THREE.Group(); o.add(m(new THREE.SphereGeometry(s * 0.7, 8, 6), g, -s * 0.6), m(new THREE.SphereGeometry(s * 0.7, 8, 6), g, s * 0.6)); return o; }
    case 'plus': { const o = new THREE.Group(); o.add(m(new THREE.BoxGeometry(s * 2, s * 0.6, s * 0.6), g), m(new THREE.BoxGeometry(s * 0.6, s * 2, s * 0.6), g)); return o; }
    case 'drop': return m(new THREE.SphereGeometry(s, 10, 8), g);
    case 'moon': return m(new THREE.TorusGeometry(s, s * 0.45, 8, 12, Math.PI * 1.3), g);
    case 'blade': return m(new THREE.BoxGeometry(s * 0.3, s * 2.4, s * 1.2), g, 0, 0, 0, 0, 0, 0.4);
    case 'arrow': return m(new THREE.ConeGeometry(s, s * 2, 3), g, 0, 0, 0, 0, 0, -Math.PI / 2);
    case 'arrow-in': return m(new THREE.ConeGeometry(s, s * 2, 3), g, 0, 0, 0, 0, 0, Math.PI / 2);
    case 'weight': return m(new THREE.CylinderGeometry(s * 0.7, s * 1.2, s * 1.4, 8), g);
    case 'magnet': return m(new THREE.TorusGeometry(s, s * 0.35, 6, 12, Math.PI), g);
    case 'coin': return m(new THREE.CylinderGeometry(s * 1.2, s * 1.2, s * 0.4, 12), g, 0, 0, 0, Math.PI / 2);
    case 'leaf': return m(new THREE.SphereGeometry(s, 8, 6), g, 0, 0, 0, 0, 0, 0.6);
    case 'clock': return m(new THREE.CylinderGeometry(s * 1.2, s * 1.2, s * 0.4, 14), g, 0, 0, 0, Math.PI / 2);
    default: return m(new THREE.SphereGeometry(s, 10, 8), g);
  }
}

// Returns a Group ~ handheld size (meters), aimed down -Z, grip at the origin.
export function buildGadgetModel(bp) {
  const g = new THREE.Group();
  const body = BODIES[bp.body] || BODIES.pistol;
  const tint = bp.opts && bp.opts.color != null ? bp.opts.color : (CORES[bp.cores[0]] ? CORES[bp.cores[0]].color : 0x63e6be);
  const dark = mat(0x23292b, 0.35, 0.8), mid = mat(0x4a5458, 0.35, 0.8), accent = mat(tint, 0.3, 0.5);
  let canisterAt = [];   // where the cores go
  let muzzle = new THREE.Vector3(0, 0.05, -0.2);
  switch (bp.body) {
    case 'pistol':
      g.add(m(roundedBox(0.035, 0.1, 0.045, 0.01), dark, 0, -0.02, 0.01, 0.2));
      g.add(m(roundedBox(0.05, 0.055, 0.2, 0.012), mid, 0, 0.045, -0.06));
      g.add(m(new THREE.CylinderGeometry(0.014, 0.018, 0.08, 12), dark, 0, 0.05, -0.19, Math.PI / 2));
      canisterAt = [[0, 0.09, -0.04], [0.035, 0.05, -0.02], [-0.035, 0.05, -0.02]];
      muzzle.set(0, 0.05, -0.24);
      break;
    case 'rifle':
      g.add(m(roundedBox(0.035, 0.1, 0.045, 0.01), dark, 0, -0.02, 0.01, 0.2));
      g.add(m(roundedBox(0.055, 0.06, 0.48, 0.012), mid, 0, 0.045, -0.15));
      g.add(m(roundedBox(0.045, 0.07, 0.16, 0.012), dark, 0, 0.03, 0.15));
      g.add(m(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 12), dark, 0, 0.05, -0.47, Math.PI / 2));
      g.add(m(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 12), dark, 0, 0.1, -0.08, Math.PI / 2));
      canisterAt = [[0, 0.095, -0.2], [0.04, 0.05, -0.12], [-0.04, 0.05, -0.12]];
      muzzle.set(0, 0.05, -0.57);
      break;
    case 'glove':
      g.add(m(roundedBox(0.09, 0.03, 0.11, 0.012), mid, 0, 0, -0.03));
      for (let i = 0; i < 4; i++) g.add(m(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), dark, -0.03 + i * 0.02, 0, -0.11, Math.PI / 2));
      g.add(m(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14), dark, 0, 0, 0.05, Math.PI / 2));
      canisterAt = [[0, 0.03, -0.03], [0.035, 0.03, 0.0], [-0.035, 0.03, 0.0]];
      muzzle.set(0, 0, -0.15);
      break;
    case 'grenade':
      g.add(m(roundedBox(0.035, 0.1, 0.045, 0.01), dark, 0, -0.02, 0.01, 0.2));
      g.add(m(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 16), mid, 0, 0.06, -0.1, Math.PI / 2));
      g.add(m(new THREE.TorusGeometry(0.042, 0.006, 6, 16), accent, 0, 0.06, -0.23));
      canisterAt = [[0, 0.11, -0.05], [0.045, 0.06, -0.02], [-0.045, 0.06, -0.02]];
      muzzle.set(0, 0.06, -0.24);
      break;
    case 'wand':
      g.add(m(new THREE.CylinderGeometry(0.008, 0.012, 0.3, 10), mat(0x3a2a1a, 0.6, 0.1), 0, 0.0, -0.1, Math.PI / 2));
      g.add(m(new THREE.SphereGeometry(0.025, 14, 10), glassM(), 0, 0, -0.27));
      canisterAt = [[0, 0, -0.27], [0, 0.012, -0.04], [0, -0.012, -0.04]];
      muzzle.set(0, 0, -0.29);
      break;
    case 'cannon':
      g.add(m(roundedBox(0.04, 0.1, 0.05, 0.01), dark, 0, -0.03, 0.04, 0.2));
      g.add(m(new THREE.CylinderGeometry(0.06, 0.075, 0.42, 18), mid, 0, 0.07, -0.13, Math.PI / 2));
      g.add(m(new THREE.TorusGeometry(0.065, 0.012, 8, 20), accent, 0, 0.07, -0.34));
      canisterAt = [[0, 0.15, -0.08], [0.07, 0.08, 0.0], [-0.07, 0.08, 0.0]];
      muzzle.set(0, 0.07, -0.36);
      break;
    case 'trap':
      g.add(m(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), mid, 0, 0, -0.05));
      g.add(m(new THREE.TorusGeometry(0.06, 0.006, 6, 20), accent, 0, 0.011, -0.05, Math.PI / 2));
      canisterAt = [[0, 0.025, -0.05], [0.045, 0.02, -0.05], [-0.045, 0.02, -0.05]];
      muzzle.set(0, 0.02, -0.05);
      break;
    case 'staff':
      g.add(m(new THREE.CylinderGeometry(0.01, 0.012, 0.7, 10), mat(0x2a2a2a, 0.4, 0.7), 0, 0.2, 0));
      g.add(m(new THREE.TorusGeometry(0.04, 0.006, 8, 20), accent, 0, 0.57, 0));
      canisterAt = [[0, 0.57, 0], [0, 0.44, 0], [0, 0.32, 0]];
      muzzle.set(0, 0.57, 0);
      break;
    default: break;
  }
  // core canisters (glass tube with the core's glowing symbol inside)
  bp.cores.slice(0, 3).forEach((k, i) => {
    const c = CORES[k];
    if (!c || !canisterAt[i]) return;
    const [x, y, z] = canisterAt[i];
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    if (bp.body !== 'wand' || i > 0) {
      holder.add(m(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12, 1, true), glassM(), 0, 0, 0, Math.PI / 2));
      holder.add(m(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 12), dark, 0, 0, 0.026, Math.PI / 2));
      holder.add(m(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 12), dark, 0, 0, -0.026, Math.PI / 2));
    }
    const ic = icon(c.icon, c.color);
    ic.scale.setScalar(bp.body === 'wand' && i === 0 ? 1.3 : 0.9);
    ic.userData.spin = true;
    holder.add(ic);
    holder.userData.core = k;
    g.add(holder);
  });
  // mod attachment at the muzzle
  const mc = tint;
  const at = muzzle;
  switch (bp.mod) {
    case 'beam': g.add(m(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 12), glowMat(mc, 1.5), at.x, at.y, at.z - 0.01, Math.PI / 2)); break;
    case 'bolt': for (let i = 0; i < 3; i++) g.add(m(new THREE.TorusGeometry(0.018, 0.004, 6, 14), glowMat(mc, 1.2), at.x, at.y, at.z + 0.02 + i * 0.02)); break;
    case 'spray': g.add(m(new THREE.ConeGeometry(0.035, 0.06, 14, 1, true), mat(0x9aa0a4, 0.3, 0.8), at.x, at.y, at.z - 0.02, -Math.PI / 2)); break;
    case 'burst': g.add(m(new THREE.SphereGeometry(0.026, 12, 8), glowMat(mc, 1.2), at.x, at.y, at.z)); break;
    case 'chain': g.add(m(new THREE.TorusKnotGeometry(0.016, 0.004, 40, 6, 2, 5), glowMat(mc, 1.5), at.x, at.y, at.z)); break;
    case 'rain': for (let i = 0; i < 5; i++) g.add(m(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), glowMat(mc, 1.2), at.x + (i - 2) * 0.012, at.y + 0.02, at.z)); break;
    case 'homing': g.add(m(new THREE.SphereGeometry(0.025, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xcfd6d8, 0.3, 0.8), at.x, at.y + 0.03, at.z + 0.03, -Math.PI / 2)); break;
    case 'hold': g.add(m(new THREE.TorusGeometry(0.025, 0.005, 6, 20), glowMat(mc, 1.6), at.x, at.y, at.z)); g.add(m(new THREE.TorusGeometry(0.018, 0.004, 6, 20), glowMat(mc, 1.6), at.x, at.y, at.z - 0.015)); break;
    case 'pulse': g.add(m(new THREE.TorusGeometry(0.03, 0.006, 6, 24), glowMat(mc, 1.4), at.x, at.y, at.z, Math.PI / 2)); break;
    default: break;
  }
  // power coils
  const coils = Math.round((bp.stats.power || 5) / 2.5);
  for (let i = 0; i < coils; i++) g.add(m(new THREE.TorusGeometry(0.03 + (bp.body === 'cannon' ? 0.045 : 0), 0.0035, 6, 18), mat(0xc87a1a, 0.35, 0.9), 0, bp.body === 'staff' ? 0.1 + i * 0.03 : at.y, bp.body === 'staff' ? 0 : at.z + 0.06 + i * 0.018, bp.body === 'staff' ? Math.PI / 2 : 0));
  g.userData.muzzle = muzzle.clone();
  return g;
}

export function spinIcons(g, dt) {
  g.traverse((o) => { if (o.userData && o.userData.spin) { o.rotation.y += dt * 2; o.rotation.x += dt * 0.7; } });
}
