// THE MASK - your hands: chunky cartoon work gloves (mustard leather, teal cuffs, stitched backs).
// Local space: wrist at the origin, fingers point -Z, back of the hand +Y. Right hand is built, left is mirrored.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, PAL } from './toon.js';

let mats = null;
function M() {
  if (!mats) mats = {
    glove: toon({ color: PAL.mustard }), seam: toon({ color: PAL.mustardDark }), cuff: toon({ color: PAL.teal }),
    cuffD: toon({ color: PAL.tealDark }), brass: toon({ color: PAL.brass })
  };
  return mats;
}

function seg(len, r, mat) { // capsule pointing -Z from its pivot
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 2, 7);
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}

export function buildHand(side = 'right') {
  const m = M();
  const root = new THREE.Group(); root.name = 'hand-' + side;
  const hand = new THREE.Group(); root.add(hand);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.084, 0.032, 0.088, 2, 0.012), m.glove);
  palm.position.set(0, 0, -0.046); palm.castShadow = true; hand.add(palm);
  // back-of-hand stitches
  for (const x of [-0.02, 0, 0.02]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0012, 0.05), m.seam);
    s.position.set(x, 0.0162, -0.05); hand.add(s);
  }
  // cuff
  const cuffGeo = new THREE.CylinderGeometry(0.041, 0.048, 0.056, 10); cuffGeo.rotateX(Math.PI / 2); cuffGeo.scale(1, 0.72, 1);
  const cuff = new THREE.Mesh(cuffGeo, m.cuff); cuff.position.z = 0.024; cuff.castShadow = true; hand.add(cuff);
  const bandGeo = new THREE.TorusGeometry(0.046, 0.0045, 5, 14); bandGeo.scale(1, 0.72, 1);
  const band = new THREE.Mesh(bandGeo, m.cuffD); band.position.z = 0.05; hand.add(band);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 8), m.brass);
  button.position.set(0.0, 0.035, 0.026); hand.add(button);

  // fingers: index (thumb side, -X on the right hand) to pinky
  const fingers = [];
  const spec = [[-0.0305, 0.072], [-0.0102, 0.08], [0.0102, 0.075], [0.0305, 0.062]];
  for (const [x, len] of spec) {
    const base = new THREE.Group(); base.position.set(x, 0.002, -0.086); hand.add(base);
    base.add(seg(len * 0.56, 0.0108, m.glove));
    const tip = new THREE.Group(); tip.position.z = -len * 0.5; base.add(tip);
    tip.add(seg(len * 0.5, 0.0101, m.glove));
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0015, 0.0025), m.seam);
    knuckle.position.set(0, 0.0105, -len * 0.5); base.add(knuckle);
    fingers.push({ base, tip });
  }
  // thumb
  const thumbBase = new THREE.Group(); thumbBase.position.set(-0.04, -0.004, -0.026);
  thumbBase.rotation.set(0.15, 0.62, 0.45); hand.add(thumbBase);
  thumbBase.add(seg(0.038, 0.0125, m.glove));
  const thumbTip = new THREE.Group(); thumbTip.position.z = -0.034; thumbBase.add(thumbTip);
  thumbTip.add(seg(0.032, 0.0115, m.glove));

  if (side === 'left') hand.scale.x = -1;

  // grip/trigger 0..1 curl the fingers into a fist
  root.userData.pose = (grip = 0, trigger = 0, point = false) => {
    fingers.forEach((f, i) => {
      const c = i === 0 ? (point ? 0 : trigger) : grip;
      f.base.rotation.x = -c * 1.35; f.tip.rotation.x = -c * 1.55;
    });
    const tc = Math.max(grip, trigger) * 0.9;
    thumbBase.rotation.set(0.15 - tc * 0.25, 0.62 - tc * 0.55, 0.45 + tc * 0.35);
    thumbTip.rotation.x = -tc * 0.9;
  };
  root.userData.pose(0.15, 0.1);
  return root;
}
