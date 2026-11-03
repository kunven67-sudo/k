// VR: controllers + lasers + hands that match your character (skin, claws, armor). Hand tracking uses the WebXR generic hands.
import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

const CLAWS = /werewolf|dragon|ghoul|devil|cerberus|vampire|lich|demon|beast/i;

export class XRInput {
  constructor(renderer, rig) {
    this.renderer = renderer; this.rig = rig; this.sides = {};
    const handFactory = new XRHandModelFactory(); handFactory.setPath('assets/hands/');
    for (let i = 0; i < 2; i++) {
      const target = renderer.xr.getController(i);
      const grip = renderer.xr.getControllerGrip(i);
      const hand = renderer.xr.getHand(i);
      rig.add(target); rig.add(grip); rig.add(hand);
      const side = { i, target, grip, hand, handedness: null, gamepad: null, buttons: [], prev: [], fist: buildFist(), laser: buildLaser(), handModel: null, tracking: false };
      grip.add(side.fist); target.add(side.laser);
      side.handModel = handFactory.createHandModel(hand, 'mesh'); hand.add(side.handModel);
      target.addEventListener('connected', (e) => {
        side.handedness = e.data.handedness; side.gamepad = e.data.gamepad || null; side.tracking = !!e.data.hand;
        side.fist.visible = !side.tracking; side.fist.scale.x = side.handedness === 'left' ? -1 : 1;
        this.sides[side.handedness] = side;
      });
      target.addEventListener('disconnected', () => { side.gamepad = null; if (side.handedness) delete this.sides[side.handedness]; });
      target.addEventListener('selectstart', () => this.onSelect && this.onSelect(side.handedness || 'right', true));
      target.addEventListener('selectend', () => this.onSelect && this.onSelect(side.handedness || 'right', false));
      target.addEventListener('squeezestart', () => this.onSqueeze && this.onSqueeze(side.handedness || 'right', true));
      target.addEventListener('squeezeend', () => this.onSqueeze && this.onSqueeze(side.handedness || 'right', false));
      this.sides['c' + i] = side;
    }
  }
  list() { return [this.sides.c0, this.sides.c1].filter(s => s && s.handedness); }
  ray(side) {
    const o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
    side.target.getWorldPosition(o); d.applyQuaternion(side.target.getWorldQuaternion(new THREE.Quaternion()));
    return { o, d };
  }
  gripPos(side) { const p = new THREE.Vector3(); (side.tracking ? side.hand : side.grip).getWorldPosition(p); return p; }
  // buttons: 0 trigger, 1 squeeze, 3 stick press, 4 A/X, 5 B/Y
  pressed(side, b) { const g = side.gamepad; return !!(g && g.buttons[b] && g.buttons[b].pressed); }
  justPressed(side, b) { const now = this.pressed(side, b); const was = side.prev[b]; return now && !was; }
  endFrame() { for (const s of this.list()) { const g = s.gamepad; if (!g) continue; s.prev = g.buttons.map(b => b.pressed); } }
  axes(side) { const g = side.gamepad; if (!g || !g.axes) return [0, 0]; return [g.axes[2] || 0, g.axes[3] || 0]; }
  pulse(side, strength = 0.6, ms = 60) {
    const g = side && side.gamepad; const h = g && g.hapticActuators && g.hapticActuators[0];
    try { if (h && h.pulse) h.pulse(strength, ms); else if (g && g.vibrationActuator) g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength }); } catch (e) { }
  }
  update() {
    for (const s of this.list()) {
      const trig = s.gamepad && s.gamepad.buttons[0] ? s.gamepad.buttons[0].value : 0;
      const sq = s.gamepad && s.gamepad.buttons[1] ? s.gamepad.buttons[1].value : 0;
      s.fist.userData.curl && s.fist.userData.curl(Math.max(trig, sq));
    }
  }
  // color the hands like your character
  dress(C) {
    const skin = new THREE.Color(C ? (C.skinHex || '#e8b994') : '#e8b994');
    const claws = C && (CLAWS.test(C.race || '') || (C.parents && C.parents.some(p => CLAWS.test(p))) || /Demon|Dragon|Beast/.test(C.transformation || ''));
    const armor = C && C.armor ? new THREE.Color(armorHex(C.armor)) : null;
    for (const s of [this.sides.c0, this.sides.c1]) {
      if (!s) continue;
      s.fist.userData.setSkin(skin, armor, claws);
      s.handModel.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = skin.clone(); } });
    }
  }
}

function armorHex(a) { if (/Divine|Celestial/.test(a)) return '#f2d27a'; if (/Demon|Cursed/.test(a)) return '#5a1a1a'; if (/Dragon/.test(a)) return '#2f7a3c'; if (/Void|Cosmic|Dimensional/.test(a)) return '#3a2a6a'; if (/Energy|Spirit/.test(a)) return '#58c8ff'; return '#9aa2ac'; }

// low-poly hand for controllers (same chunky style as the characters). Grip space: -Z = forward out of the fist.
function buildFist() {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b994, roughness: 0.75, flatShading: true });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.35, metalness: 0.8, flatShading: true });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.5, flatShading: true });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.095, 1, 1, 1), skinMat); palm.position.set(0, 0, 0.01); g.add(palm);
  const fingers = [];
  for (let k = 0; k < 4; k++) {
    const pivot = new THREE.Group(); pivot.position.set(-0.03 + k * 0.02, 0.035 - k * 0.002, -0.035); g.add(pivot);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.02, 0.06), skinMat); f.position.set(0, 0, -0.03); pivot.add(f);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 4), clawMat); claw.rotation.x = -Math.PI / 2; claw.position.set(0, 0, -0.072); claw.visible = false; pivot.add(claw);
    fingers.push({ pivot, claw });
  }
  const thumbPivot = new THREE.Group(); thumbPivot.position.set(0.04, 0.0, -0.005); g.add(thumbPivot);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 0.05), skinMat); thumb.position.set(0.005, 0, -0.025); thumb.rotation.y = -0.4; thumbPivot.add(thumb);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 8), armorMat); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0, 0.075); cuff.visible = false; g.add(cuff);
  g.userData.curl = (v) => { for (const f of fingers) f.pivot.rotation.x = -0.2 - v * 1.35; thumbPivot.rotation.y = 0.2 + v * 0.9; };
  g.userData.setSkin = (skin, armor, claws) => {
    skinMat.color.copy(skin);
    cuff.visible = !!armor; if (armor) armorMat.color.copy(armor);
    for (const f of fingers) f.claw.visible = !!claws;
  };
  g.userData.curl(0);
  g.rotation.x = -0.35;
  return g;
}
function buildLaser() {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.85 }));
  line.scale.z = 4; line.name = 'laser';
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  dot.position.z = -4; dot.name = 'dot'; line.add(dot);
  line.userData.setLength = (L) => { L = Math.max(0.05, L); line.scale.z = L; dot.position.z = -1; dot.scale.set(1, 1, 1 / L); };
  return line;
}
