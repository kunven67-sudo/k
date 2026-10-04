// Your character (seen in third-person) + your first-person arms with the sci-fi watch.
// Fully customizable: skin, face, hair, clothes, height and body type.
import * as THREE from 'three';
import { surface } from '../core/textures.js';

export const LOOK_DEFAULT = {
  skin: '#c68a64', eyes: '#4a3121', hair: '#2b1d14', hairStyle: 'short',
  top: '#2f3b52', topStyle: 'hoodie', pants: '#2b2f36', shoes: '#e9e9e9',
  height: 1.0, build: 1.0, face: 'round',
};
export const SKIN_TONES = ['#f3d2b8', '#e8b892', '#c68a64', '#a0663f', '#7a4a2a', '#4f2f1c'];
export const HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'ponytail', 'bald'];

function mat(color, rough = 0.7, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
function capsule(r, len, m) { const g = new THREE.CapsuleGeometry(r, len, 6, 14); const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh; }
function limb(r0, r1, len, m) {
  // tapered limb hanging down from its pivot
  const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1); g.translate(0, -len / 2, 0);
  const cap = new THREE.SphereGeometry(r1, 14, 8); cap.translate(0, -len, 0);
  const top = new THREE.SphereGeometry(r0, 14, 8);
  const grp = new THREE.Group();
  for (const gg of [g, cap, top]) { const mm = new THREE.Mesh(gg, m); mm.castShadow = true; grp.add(mm); }
  return grp;
}

export class Avatar {
  constructor(look = LOOK_DEFAULT) {
    this.root = new THREE.Group();
    this.look = { ...LOOK_DEFAULT, ...look };
    this.walk = 0;
    this.build();
  }

  build() {
    this.root.clear();
    const L = this.look;
    const skinTex = surface('skin', { color: parseInt(L.skin.slice(1), 16), size: 128 });
    const skin = mat(L.skin, 0.6, { normalMap: skinTex.normalMap });
    const top = mat(L.top, 0.92, { normalMap: surface('fabric', { color: 0x808080, size: 128 }).normalMap });
    const pants = mat(L.pants, 0.9, { normalMap: surface('fabric', { color: 0x808080, size: 128 }).normalMap });
    const shoes = mat(L.shoes, 0.6);
    const hair = mat(L.hair, 0.75);
    const b = L.build; // body width factor
    const body = new THREE.Group(); body.scale.setScalar(L.height); this.root.add(body); this.body = body;
    // proportions for a 1.75 m person (scaled later by the player's size)
    const hipY = 0.92;
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.095 * b, hipY, 0);
      const thigh = limb(0.075 * b, 0.058 * b, 0.42, pants); hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
      const shin = limb(0.056 * b, 0.045, 0.4, pants); knee.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.27).translate(0, -0.03, 0.05), shoes); shoe.position.y = -0.42; shoe.castShadow = true;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.02, 0.272).translate(0, -0.065, 0.05), mat('#f4f4f4', 0.8)); sole.position.y = -0.42;
      knee.add(shoe, sole);
      body.add(hip); this.legs.push({ hip, knee });
    }
    // torso (hoodie) + hips
    const pelvis = capsule(0.135 * b, 0.12 * b, pants); pelvis.rotation.z = Math.PI / 2; pelvis.position.y = hipY + 0.02; pelvis.scale.set(1, 1, 0.75); body.add(pelvis);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * b, 0.155 * b, 0.5, 18), top); torso.position.y = hipY + 0.29; torso.scale.z = 0.62; torso.castShadow = true; body.add(torso);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19 * b, 18, 12), top); chest.position.y = hipY + 0.52; chest.scale.set(1, 0.55, 0.62); chest.castShadow = true; body.add(chest);
    if (L.topStyle === 'hoodie') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), top); hood.position.set(0, hipY + 0.58, -0.09); hood.rotation.x = -1.9; hood.scale.set(1.1, 0.7, 0.9); body.add(hood);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.22 * b, 0.1, 0.01), top); pocket.position.set(0, hipY + 0.16, 0.105 * b); body.add(pocket);
      for (const sx of [-1, 1]) { const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14), mat('#ddd')); str.position.set(sx * 0.04, hipY + 0.5, 0.11); body.add(str); }
    }
    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), skin); neck.position.y = hipY + 0.64; body.add(neck);
    const head = new THREE.Group(); head.position.y = hipY + 0.79; body.add(head); this.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin); skull.scale.set(L.face === 'long' ? 0.92 : 1, L.face === 'long' ? 1.18 : 1.1, 1.05); skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), skin); jaw.position.set(0, -0.055, 0.02); jaw.scale.set(L.face === 'square' ? 1.08 : 0.95, 0.75, 0.95); head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 8), skin); nose.rotation.x = Math.PI / 2.2; nose.position.set(0, -0.005, 0.11); head.add(nose);
    for (const sx of [-1, 1]) {
      const ew = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), mat('#f6f4f0', 0.3)); ew.position.set(sx * 0.038, 0.025, 0.088); ew.scale.z = 0.6; head.add(ew);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), mat(L.eyes, 0.25)); iris.position.set(sx * 0.038, 0.025, 0.098); head.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 6), mat('#050505', 0.2)); pupil.position.set(sx * 0.038, 0.025, 0.1045); head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.01), hair); brow.position.set(sx * 0.04, 0.052, 0.1); brow.rotation.z = -sx * 0.1; head.add(brow);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skin); ear.position.set(sx * 0.103, 0.0, 0); ear.scale.set(0.45, 1, 0.8); head.add(ear);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 12, Math.PI), mat('#8a4a44', 0.5)); mouth.position.set(0, -0.05, 0.093); mouth.rotation.z = Math.PI; head.add(mouth);
    this.addHair(head, hair, L.hairStyle);
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.22 * b, hipY + 0.53, 0);
      sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.065 * b, 12, 10), top));
      const upper = limb(0.055 * b, 0.045 * b, 0.29, top); sh.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.29; sh.add(elbow);
      const fore = limb(0.044 * b, 0.034, 0.25, top); elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.03), skin); hand.position.y = -0.3; hand.castShadow = true; elbow.add(hand);
      if (sx < 0) { // the watch on the left wrist
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.022, 16, 1, true), mat('#111', 0.6, { side: THREE.DoubleSide })); band.position.y = -0.22; elbow.add(band);
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.034, 0.012), mat('#0a1a24', 0.2, { emissive: 0x4ef2ff, emissiveIntensity: 0.6 })); face.position.set(0, -0.22, 0.042); elbow.add(face);
        this.watchFace = face;
      }
      sh.rotation.z = sx * 0.08;
      body.add(sh); this.arms.push({ sh, elbow });
    }
  }

  addHair(head, hair, style) {
    if (style === 'bald') return;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 14, 0, Math.PI * 2, 0, style === 'buzz' ? 1.25 : 1.45), hair);
    cap.scale.set(1, 1.12, 1.08); cap.position.y = 0.012; cap.rotation.x = -0.25; cap.castShadow = true; head.add(cap);
    if (style === 'curly') for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.1;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hair);
      c.position.set(Math.cos(a) * Math.sin(e) * 0.11, 0.03 + Math.cos(e) * 0.1, Math.sin(a) * Math.sin(e) * 0.11 - 0.01); head.add(c);
    }
    if (style === 'long' || style === 'ponytail') {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, style === 'long' ? 0.18 : 0.02, 6, 12), hair);
      back.position.set(0, style === 'long' ? -0.1 : 0.0, -0.06); back.scale.set(1.15, 1, 0.6); head.add(back);
      if (style === 'ponytail') { const pt = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), hair); pt.position.set(0, -0.06, -0.13); pt.rotation.x = 0.4; head.add(pt); }
    }
  }

  setLook(look) { this.look = { ...this.look, ...look }; this.build(); }

  // animate: speed in body-heights per second, grounded, crouch 0..1
  animate(dt, speed, grounded, crouch) {
    this.walk += dt * Math.min(9, speed * 3.4);
    const sw = Math.min(1, speed / 1.3) * (grounded ? 1 : 0.2);
    const a = Math.sin(this.walk) * 0.6 * sw;
    this.legs[0].hip.rotation.x = a - crouch * 0.9; this.legs[1].hip.rotation.x = -a - crouch * 0.9;
    this.legs[0].knee.rotation.x = Math.max(0, -Math.sin(this.walk + 1.2)) * 0.9 * sw + crouch * 1.6;
    this.legs[1].knee.rotation.x = Math.max(0, Math.sin(this.walk + 1.2)) * 0.9 * sw + crouch * 1.6;
    this.arms[0].sh.rotation.x = -a * 0.8; this.arms[1].sh.rotation.x = a * 0.8;
    this.arms[0].elbow.rotation.x = -0.25 - sw * 0.3; this.arms[1].elbow.rotation.x = -0.25 - sw * 0.3;
    this.body.position.y = -crouch * 0.35 + Math.abs(Math.cos(this.walk)) * 0.02 * sw;
    if (!grounded) { this.legs[0].knee.rotation.x = 0.5; this.legs[1].knee.rotation.x = 0.2; this.arms[0].sh.rotation.z = -0.5; this.arms[1].sh.rotation.z = 0.5; }
    else { this.arms[0].sh.rotation.z = -0.08; this.arms[1].sh.rotation.z = 0.08; }
  }
}

// First-person arms: the left one lifts to show the watch while you shrink/grow.
export class ViewModel {
  constructor(look) {
    this.root = new THREE.Group();
    this.raise = 0;
    this.toolHold = new THREE.Group();
    this.setLook(look);
  }
  setLook(look) {
    this.root.clear();
    const L = { ...LOOK_DEFAULT, ...look };
    const sleeve = mat(L.top, 0.9), skin = mat(L.skin, 0.6);
    // left arm + watch
    const left = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.045, 0.32, 14), sleeve); fore.rotation.x = Math.PI / 2; fore.position.z = 0.16; left.add(fore);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.06, 14), skin); wrist.rotation.x = Math.PI / 2; wrist.position.z = -0.02; left.add(wrist);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.09), skin); hand.position.z = -0.09; left.add(hand);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.024, 20, 1, true), mat('#15171c', 0.5, { side: THREE.DoubleSide })); band.rotation.x = Math.PI / 2; band.position.z = -0.01; left.add(band);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.012, 6), mat('#3b4350', 0.3, { metalness: 0.9 })); bezel.position.set(0, 0.035, -0.01); left.add(bezel);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    this.watchTex = new THREE.CanvasTexture(canvas); this.watchTex.colorSpace = THREE.SRGBColorSpace; this.watchCanvas = canvas;
    this.watchMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.watchTex, emissiveIntensity: 1.2 });
    const screen = new THREE.Mesh(new THREE.CircleGeometry(0.026, 6), this.watchMat); screen.rotation.x = -Math.PI / 2; screen.rotation.z = Math.PI / 6; screen.position.set(0, 0.0415, -0.01); left.add(screen);
    left.position.set(-0.13, -0.16, -0.3); left.rotation.set(0.2, 0.5, 0.3);
    this.left = left; this.root.add(left);
    // right hand (holds tools)
    const right = new THREE.Group();
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.045, 0.32, 14), sleeve); rf.rotation.x = Math.PI / 2; rf.position.z = 0.16; right.add(rf);
    const rh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.08), skin); rh.position.z = -0.06; right.add(rh);
    right.add(this.toolHold); this.toolHold.position.set(0, 0.03, -0.09);
    right.position.set(0.2, -0.2, -0.34); right.rotation.set(0.05, -0.15, 0);
    this.right = right; this.root.add(right);
  }
  drawWatch(text1, text2, color = '#4ef2ff') {
    const c = this.watchCanvas.getContext('2d');
    c.fillStyle = '#02060c'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = color; c.textAlign = 'center'; c.font = 'bold 26px monospace'; c.fillText(text1, 64, 62);
    c.font = '14px monospace'; c.fillStyle = '#cfe'; c.fillText(text2, 64, 86);
    this.watchTex.needsUpdate = true;
  }
  update(dt, wantRaise, bob, t) {
    this.right.visible = this.toolHold.children.length > 0;
    this.raise += ((wantRaise ? 1 : 0) - this.raise) * Math.min(1, dt * 7);
    const r = this.raise;
    this.left.position.set(-0.13 + r * 0.1, -0.16 - (1 - r) * 0.25 + r * 0.06, -0.3 + r * 0.05);
    this.left.rotation.set(0.2 + r * 0.7, 0.5 - r * 0.2, 0.3 - r * 0.2);
    this.left.visible = r > 0.02;
    this.right.position.y = -0.2 + Math.sin(bob) * 0.006;
    this.right.position.x = 0.2 + Math.cos(bob * 0.5) * 0.004;
    void t;
  }
}
