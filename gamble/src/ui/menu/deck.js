// The slot machine's button deck (five real push buttons with lit plastic caps) and the big side
// lever. Pure presentation + animation state; the menu state does input and decides actions.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from '../../gfx/materials.js';
import { bevelBox } from '../../gfx/geom.js';
import { canvasTexture } from '../../gfx/textures.js';
import { spring } from '../three/stage.js';
import { DIM, mergeAll } from './machine.js';

const CAP_W = 0.34;
const CAP_D = 0.22;

function labelAtlas(options, key) {
  return canvasTexture(`ui-menu-btnlabels-${key}`, 256 * options.length, 160, (g) => {
    g.clearRect(0, 0, 256 * options.length, 160);
    options.forEach((o, i) => {
      const text = o.label().toUpperCase();
      let size = 84;
      g.font = `400 ${size}px "Bebas Neue", sans-serif`;
      while (g.measureText(text).width > 220 && size > 26) g.font = `400 ${(size -= 2)}px "Bebas Neue", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,250,235,0.92)';
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 4;
      g.fillText(text, i * 256 + 128, 84);
      g.shadowBlur = 0;
    });
  });
}

export function buildDeck(group, { options, tier }) {
  const { w, faceZ, deckY } = DIM;
  const chrome = mat('chrome');
  const lacquer = mat('car-paint', { color: 0x6b0c16, wear: 0.25, dirt: 0.2 });
  const black = mat('plastic', { color: 0x141113, wear: 0.4, dirt: 0.3 });

  // Sloped deck shelf, tilted toward the player.
  const tilt = new THREE.Group();
  tilt.position.set(0, deckY, faceZ + 0.26);
  tilt.rotation.x = 0.5;
  group.add(tilt);
  const shelf = bevelBox(w - 0.04, 0.12, 0.6, lacquer, { radius: 0.04, segments: 3 });
  const rim = bevelBox(w + 0.02, 0.05, 0.64, chrome, { radius: 0.02, segments: 2 });
  rim.position.y = 0.075;
  const plate = bevelBox(w - 0.22, 0.02, 0.42, black, { radius: 0.01, segments: 2 });
  plate.position.y = 0.105;
  tilt.add(shelf, rim, plate);
  // Under-deck support down to the pedestal.
  const skirt = bevelBox(w - 0.1, 0.5, 0.3, lacquer, { radius: 0.03, segments: 2 });
  skirt.position.set(0, deckY - 0.33, faceZ + 0.1);
  group.add(skirt);

  // Buttons.
  const n = options.length;
  const pitch = (w - 0.4) / n;
  const capGeo = new RoundedBoxGeometry(CAP_W, 0.11, CAP_D, 3, 0.035);
  const bezelGeo = new RoundedBoxGeometry(CAP_W + 0.06, 0.04, CAP_D + 0.06, 2, 0.02);
  const bezels = [];
  let labelMat = null;
  const buttons = options.map((o, i) => {
    const x = -((n - 1) * pitch) / 2 + i * pitch;
    const bezel = new THREE.Mesh(bezelGeo, chrome);
    bezel.position.set(x, 0.12, 0);
    bezels.push(bezel);
    tilt.add(bezel);
    const capMat = new THREE.MeshPhysicalMaterial({
      color: o.color,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: new THREE.Color(o.color),
      emissiveIntensity: 0.25,
      transmission: 0,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.castShadow = true;
    cap.position.set(x, 0.17, 0);
    cap.userData.button = o.id;
    tilt.add(cap);
    // Printed label on the cap's top, riding with it.
    const lg = new THREE.PlaneGeometry(CAP_W * 0.94, CAP_D * 0.8);
    lg.rotateX(-Math.PI / 2);
    const uv = lg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / n);
    const label = new THREE.Mesh(lg, null);
    label.position.y = 0.0565;
    label.userData.button = o.id;
    cap.add(label);
    return { id: o.id, cap, label, mat: capMat, x, press: { x: 0, v: 0 }, glow: 0.25, hover: false, selected: false };
  });
  const setLabels = (key) => {
    labelMat?.dispose();
    labelMat = new THREE.MeshBasicMaterial({ map: labelAtlas(options, key), transparent: true, depthWrite: false });
    for (const b of buttons) b.label.material = labelMat;
  };
  setLabels('init');
  const bezelMesh = mergeAll(bezels, chrome);
  bezels.forEach((b) => tilt.remove(b));
  group.add(bezelMesh); // merged in world space, so it belongs to the (untransformed) machine group

  // Lever: chrome hub on the cabinet's right side, arm + ruby knob.
  const lever = new THREE.Group();
  lever.position.set(w / 2 + 0.16, 2.05, 0.05);
  group.add(lever);
  const mount = bevelBox(0.22, 0.5, 0.5, chrome, { radius: 0.05, segments: 3 });
  mount.position.set(-0.06, 0, 0);
  const hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 28);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, chrome);
  hub.position.x = 0.09;
  lever.add(mount, hub);
  const arm = new THREE.Group();
  arm.position.x = 0.12;
  lever.add(arm);
  const rodGeo = new THREE.CylinderGeometry(0.035, 0.045, 1.25, 16);
  rodGeo.translate(0, 0.62, 0);
  const rod = new THREE.Mesh(rodGeo, chrome);
  rod.castShadow = true;
  const knobMat = new THREE.MeshPhysicalMaterial({ color: 0xb0101c, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color(0x3a0206) });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 24), knobMat);
  knob.position.y = 1.3;
  knob.castShadow = true;
  arm.add(rod, knob);
  rod.userData.lever = knob.userData.lever = true;
  const REST = -0.16;
  const leverState = { x: REST, v: 0, held: false, target: REST };
  arm.rotation.x = REST;

  return {
    buttons,
    lever: {
      knob,
      rod,
      REST,
      MAX: 1.45,
      state: leverState,
      /** While dragging: set the arm angle directly. */
      hold(angle) {
        leverState.held = true;
        leverState.x = Math.max(REST, Math.min(1.45, angle));
        leverState.v = 0;
      },
      release() {
        leverState.held = false;
      },
      get angle() {
        return leverState.x;
      },
    },
    setLabels,
    update(dt, time) {
      for (const b of buttons) {
        const lit = b.hover || b.selected;
        const target = lit ? 1.6 + Math.sin(time * 6) * 0.25 : 0.22;
        b.glow += (target - b.glow) * Math.min(1, dt * 12);
        b.mat.emissiveIntensity = b.glow;
        const p = spring(b.press, 0, dt, 520, 22);
        b.cap.position.y = 0.17 - Math.max(0, p) * 0.05;
      }
      if (!leverState.held) spring(leverState, REST, dt, 90, 7);
      arm.rotation.x = leverState.x;
    },
    /** Physically push a button down (spring brings it back). */
    push(id) {
      const b = buttons.find((x) => x.id === id);
      if (b) b.press.x = 1;
    },
    dispose() {
      for (const x of [capGeo, bezelGeo, labelMat, knobMat, hubGeo, rodGeo]) x?.dispose?.();
      for (const b of buttons) {
        b.mat.dispose();
        b.label.geometry.dispose();
      }
    },
  };
}
