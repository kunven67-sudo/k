// Hand-built gadget models (no external files): proper bevels, real metals,
// glass and emissive parts that react to charge. Units in meters.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const gunmetal = () => new THREE.MeshPhysicalMaterial({ color: 0x2c3036, metalness: 0.9, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3 });
const copper = () => new THREE.MeshStandardMaterial({ color: 0xc27a47, metalness: 1, roughness: 0.28 });
const brass = () => new THREE.MeshStandardMaterial({ color: 0xc9a452, metalness: 1, roughness: 0.3 });
const rubber = () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
export const glassMat = () => new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.004, ior: 1.52,
  transparent: true, specularIntensity: 1, envMapIntensity: 1.3, side: THREE.DoubleSide,
});

function m(geo, mat, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent?.add(o);
  return o;
}

// Shrink ray pistol. Barrel points -Z. Grip point (where the palm goes) is the origin.
export function shrinkRayModel() {
  const g = new THREE.Group();
  g.name = 'shrink-ray';
  const gm = gunmetal();
  // grip, angled like a real pistol grip
  const grip = m(new RoundedBoxGeometry(0.032, 0.11, 0.045, 3, 0.008), rubber(), 0, -0.035, 0.012, g);
  grip.rotation.x = -0.28;
  // receiver + barrel
  m(new RoundedBoxGeometry(0.042, 0.05, 0.16, 3, 0.01), gm, 0, 0.03, -0.045, g);
  const barrel = m(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 32), gm, 0, 0.03, -0.2, g);
  barrel.rotation.x = Math.PI / 2;
  // glass charge tube on top with a glowing core
  const tube = m(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 24), glassMat(), 0, 0.068, -0.06, g);
  tube.rotation.x = Math.PI / 2;
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x0b1a2e, emissive: 0x3ab7ff, emissiveIntensity: 0.4, roughness: 0.2 });
  const core = m(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 16), coreMat, 0, 0.068, -0.06, g);
  core.rotation.x = Math.PI / 2;
  core.castShadow = false;
  for (const z of [-0.115, -0.005]) {
    const cap = m(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 24), brass(), 0, 0.068, z, g);
    cap.rotation.x = Math.PI / 2;
  }
  // copper coils around the barrel
  const coils = [];
  for (let i = 0; i < 3; i++) {
    const c = m(new THREE.TorusGeometry(0.021, 0.0045, 12, 36), copper(), 0, 0.03, -0.15 - i * 0.03, g);
    coils.push(c);
  }
  // emitter dish + lens at the muzzle
  const dish = m(new THREE.CylinderGeometry(0.03, 0.017, 0.02, 32, 1, true), brass(), 0, 0.03, -0.29, g);
  dish.rotation.x = -Math.PI / 2;
  dish.material.side = THREE.DoubleSide;
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0a1624, emissive: 0x57c7ff, emissiveIntensity: 0.3, roughness: 0.05, metalness: 0.2 });
  const lens = m(new THREE.CircleGeometry(0.016, 32), lensMat, 0, 0.03, -0.281, g);
  lens.rotation.y = Math.PI;
  // trigger + guard
  m(new RoundedBoxGeometry(0.006, 0.024, 0.01, 2, 0.002), brass(), 0, -0.005, -0.018, g);
  const guard = m(new THREE.TorusGeometry(0.018, 0.003, 8, 24, Math.PI), gm, 0, -0.006, -0.018, g);
  guard.rotation.set(0, Math.PI / 2, Math.PI);
  // light at the muzzle (flashes when firing, glows while charging)
  const light = new THREE.PointLight(0x57c7ff, 0, 1.2, 2);
  light.position.set(0, 0.03, -0.3);
  g.add(light);
  g.userData = { core, coreMat, lensMat, coils, light, muzzle: new THREE.Vector3(0, 0.03, -0.3) };
  return g;
}

// Specimen / catching jar with a screw lid. Opening at +Y, lid separate so it can come off.
export function jarModel({ r = 0.065, h = 0.19 } = {}) {
  const g = new THREE.Group();
  g.name = 'jar';
  const neck = r * 0.86;
  const pts = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.9, 0), new THREE.Vector2(r, r * 0.14),
    new THREE.Vector2(r, h * 0.8), new THREE.Vector2(neck, h * 0.9), new THREE.Vector2(neck, h),
    new THREE.Vector2(neck - 0.003, h), new THREE.Vector2(neck - 0.003, h * 0.9), new THREE.Vector2(r - 0.003, h * 0.8),
    new THREE.Vector2(r - 0.003, r * 0.14), new THREE.Vector2(r * 0.9 - 0.003, 0.003), new THREE.Vector2(0, 0.003),
  ];
  m(new THREE.LatheGeometry(pts, 48), glassMat(), 0, 0, 0, g);
  const lid = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 1, roughness: 0.32 });
  m(new THREE.CylinderGeometry(neck * 1.07, neck * 1.07, 0.016, 48), steel, 0, 0, 0, lid);
  // air holes so whatever is inside can breathe
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hole = m(new THREE.CircleGeometry(0.0035, 12), holeMat, Math.cos(a) * neck * 0.5, 0.0082, Math.sin(a) * neck * 0.5, lid);
    hole.rotation.x = -Math.PI / 2;
  }
  lid.position.y = h + 0.006;
  g.add(lid);
  g.userData = { r, h, neck, lid };
  return g;
}
