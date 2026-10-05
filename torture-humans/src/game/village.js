// The wall village: tiny people living in the hollow at the bottom of your
// bedroom wall, behind a mouse hole in the baseboard (under the bed). Houses
// are matchboxes, tables are bottle caps, stools are buttons, the water tank
// is a thimble, a sugar cube and rice grains are the food store, and a fairy
// light bulb on a thread lights the street. Shrink below ~4 cm to fit through
// the hole and visit them.
import * as THREE from 'three';
import { VILLAGE, BEDROOM } from './levels/bedroom.js';

const FY = BEDROOM.floorY;
const ZB = VILLAGE.z0 + 0.012; // just in front of the back wall
const ZS = -5.045;             // the "street" (where people walk)
const pick = (a) => a[(Math.random() * a.length) | 0];

function labelTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = fg; g.font = 'bold 34px serif'; g.textAlign = 'center';
  g.fillText(text, 128, 58);
  g.font = '20px serif'; g.fillText('SAFETY MATCHES', 128, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mesh(geo, mat, x, y, z, parent, { shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// built with the level (so the matchboxes are solid for a tiny you)
export function buildVillage(parent, scene) {
  const g = new THREE.Group();
  g.name = 'wall-village';
  parent.add(g);
  const card = new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 1 });
  // three matchbox houses against the back wall (on their sides: 5.3 x 3.6 x 1.6 cm)
  const labels = [['LION', '#b8231d', '#f5e6c0'], ['SWAN', '#1d4f8a', '#f2efe6'], ['STAR', '#2c6b34', '#f7e9a8']];
  const houses = [];
  [3.62, 3.34, 3.06].forEach((x, i) => {
    const [t, bg, fg] = labels[i];
    const side = new THREE.MeshStandardMaterial({ map: labelTexture(t, bg, fg), roughness: 0.8 });
    const m = mesh(new THREE.BoxGeometry(0.053, 0.036, 0.03), [card, card, card, card, side, card], x, FY + 0.018, ZB + 0.015, g);
    m.name = 'matchbox-house';
    // the door (a cut-out) and a window
    mesh(new THREE.PlaneGeometry(0.012, 0.022), dark, x - 0.012, FY + 0.011, ZB + 0.0302, g, { shadow: false });
    mesh(new THREE.PlaneGeometry(0.009, 0.008), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb050, emissiveIntensity: 0.8 }), x + 0.012, FY + 0.024, ZB + 0.0302, g, { shadow: false });
    houses.push(new THREE.Vector3(x - 0.012, FY, ZS));
  });
  // the square: a bottle cap table with button stools
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc8202a, metalness: 0.7, roughness: 0.35 });
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 21), capMat, 3.86, FY + 0.006, -5.07, g);
  mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.006, 8), capMat, 3.86, FY + 0.003, -5.07, g);
  const button = new THREE.MeshStandardMaterial({ color: 0x3a5fa8, roughness: 0.4 });
  for (const [dx, dz] of [[-0.026, 0], [0.026, 0], [0, -0.025]]) mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 14), button, 3.86 + dx, FY + 0.002, -5.07 + dz, g);
  // the store: a sugar cube, rice grains, a crumb; the thimble water tank
  mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.9 }), 2.82, FY + 0.006, ZB + 0.012, g);
  const rice = new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.5 });
  for (let i = 0; i < 9; i++) { const r = mesh(new THREE.CapsuleGeometry(0.0012, 0.004, 3, 6), rice, 2.84 + Math.random() * 0.03, FY + 0.0012, ZB + 0.02 + Math.random() * 0.02, g); r.rotation.set(Math.PI / 2, 0, Math.random() * 3); }
  const thimble = mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.018, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }), 2.76, FY + 0.009, ZB + 0.014, g);
  thimble.name = 'thimble';
  mesh(new THREE.CircleGeometry(0.0078, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a86a8, roughness: 0.05 }), 2.76, FY + 0.015, ZB + 0.014, g, { shadow: false });
  // a spool of thread (the town hall) and a postage stamp poster
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0x8e2f6f, roughness: 0.9 }), 2.66, FY + 0.015, ZB + 0.015, g);
  const stamp = document.createElement('canvas'); stamp.width = 64; stamp.height = 80;
  { const c = stamp.getContext('2d'); c.fillStyle = '#f4ecd8'; c.fillRect(0, 0, 64, 80); c.fillStyle = '#3d6e9e'; c.fillRect(6, 6, 52, 58); c.fillStyle = '#fff'; c.font = 'bold 12px serif'; c.fillText('WALLTON', 7, 76); }
  const st = new THREE.CanvasTexture(stamp); st.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.02, 0.025), new THREE.MeshStandardMaterial({ map: st }), 3.95, FY + 0.06, VILLAGE.z0 + 0.0125, g, { shadow: false });
  // fairy lights on a thread: the street lamps
  const thread = mesh(new THREE.CylinderGeometry(0.0004, 0.0004, VILLAGE.x1 - VILLAGE.x0, 4).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x222222 }), (VILLAGE.x0 + VILLAGE.x1) / 2, FY + 0.24, -5.075, g, { shadow: false });
  thread.userData.noCollide = true;
  for (const [x, col] of [[3.9, 0xffc98a], [3.45, 0xffd6a0], [2.9, 0xffc070]]) {
    const bulb = mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: col, emissiveIntensity: 3 }), x, FY + 0.232, -5.075, g, { shadow: false });
    bulb.userData.noCollide = true;
    const light = new THREE.PointLight(col, 0.6, 0.7, 2);
    light.position.copy(bulb.position);
    scene.add(light);
  }
  g.traverse((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry') o.userData.noCollide = true; });
  return {
    houses,
    stations: [
      { p: new THREE.Vector3(3.86, FY, -5.045), act: 'table' },
      { p: new THREE.Vector3(2.84, FY, ZS), act: 'store' },
      { p: new THREE.Vector3(2.76, FY, ZS), act: 'water' },
      { p: new THREE.Vector3(2.68, FY, ZS), act: 'hall' },
      { p: new THREE.Vector3(4.02, FY, ZS), act: 'gate' },
      ...houses.map((p) => ({ p, act: 'home' })),
    ],
  };
}

const ACTS = {
  table: ['gestic_talk_relaxed_01', 'gestic_listen_neutral_01', 'gestic_laugh_low', 'drink_drinking'],
  store: ['work_table', 'idle_scratch_head_01', 'documents_check'],
  water: ['drink_drinking', 'idle_neutral_02'],
  hall: ['gestic_presentation_left_01', 'idle_look_around_01'],
  gate: ['idle_look_around_02', 'listen_door', 'idle_waiting_01'],
  home: ['knock_door', 'idle_stretch_arms_01', 'idle_yawn_01'],
};
const LINES = {
  meet: ['Welcome to Wallton!', 'A visitor! From outside the wall?', 'Are you one of the giant\'s children?', 'Shh, the giants will hear you!'],
  life: ['A grain of rice feeds a family for a day', 'We fixed the roof with a stamp', 'Watch out for the spiders by the pipes', 'The ants stole our lunch again', 'Our water comes from the thimble'],
  giant: ['The giant is looking in!', 'Hide!', 'Everyone inside!', 'It\'s the big one again...'],
};

// The villagers' daily life (they walk the "street" inside the wall)
export class Village {
  constructor({ layout, player, camera, speech }) {
    Object.assign(this, { layout, player, camera, speech });
    this.people = [];
  }

  add(h) {
    if (h.agent) { h.nav.removeAgent(h.agent); h.agent = null; }
    h.applyScale(0.05);
    h.tiny = true;
    h.villager = true;
    h.lines = { ...(h.lines || {}) };
    const home = this.layout.houses[this.people.length % this.layout.houses.length];
    h.character.root.position.copy(home);
    h.state = 'village';
    h.vt = { target: null, wait: Math.random() * 4, speed: 1.2 * 0.05 * (0.85 + Math.random() * 0.3) };
    h.custom = (dt) => this.live(h, dt);
    h.villageExit = this.layout.bounds ? home.clone() : new THREE.Vector3(VILLAGE.hole, FY, -4.75);
    this.people.push(h);
  }

  live(h, dt) {
    const v = h.vt;
    const root = h.character.root;
    if (!v.target) {
      v.wait -= dt;
      if (v.wait <= 0) v.target = pick(this.layout.stations);
    } else {
      const to = v.target.p.clone().sub(root.position).setY(0);
      const d = to.length();
      if (d < 0.004) {
        h.faceYaw = v.target.act === 'home' || v.target.act === 'store' || v.target.act === 'water' || v.target.act === 'hall' ? Math.PI : undefined;
        h.character.play(pick(ACTS[v.target.act] || ACTS.home));
        v.wait = 4 + Math.random() * 8;
        v.target = null;
        h.character.speed = 0;
      } else {
        to.normalize();
        root.position.addScaledVector(to, Math.min(d, v.speed * dt));
        // stay inside the cavity
        const B = this.layout.bounds || { x0: VILLAGE.x0 + 0.01, x1: VILLAGE.x1 - 0.01, z0: VILLAGE.z0 + 0.008, z1: VILLAGE.z1 - 0.008 };
        root.position.z = THREE.MathUtils.clamp(root.position.z, B.z0, B.z1);
        root.position.x = THREE.MathUtils.clamp(root.position.x, B.x0, B.x1);
        h.faceYaw = Math.atan2(to.x, to.z);
        h.character.speed = v.speed / h.scale;
      }
    }
    if (h.faceYaw !== undefined) {
      let dy = h.faceYaw - h.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      h.yaw += dy * (1 - Math.exp(-dt * 6));
    }
    const Y = this.layout.y ?? FY;
    root.position.y = Y + 0.001;
    root.rotation.set(0, h.yaw, 0);
    if (h.capsule) h.physics.placeCapsule(h.capsule, root.position);
    // you: tiny and close = a visitor; giant face at the hole = panic
    const p = this.player;
    const f = p.feet;
    const d = Math.hypot(f.x - root.position.x, f.z - root.position.z);
    h.metYou ??= false;
    if (p.scale < 0.06 && d < 0.12 && Math.abs(f.y - Y) < 0.05) {
      if (!h.metYou) { h.metYou = true; this.speech?.say(h, pick(LINES.meet)); }
      else if (Math.random() < dt * 0.04) this.speech?.say(h, pick(LINES.life));
    } else if (p.scale > 0.5) {
      const eye = this.camera.position;
      const peek = this.layout.bounds ? eye.distanceTo(root.position) < 1.2 : Math.abs(eye.x - VILLAGE.hole) < 0.25 && eye.z > -5.0 && eye.z < -4.6 && eye.y < FY + 0.25;
      if (peek && Math.random() < dt * 0.3) this.speech?.say(h, pick(LINES.giant), { shout: true });
    }
    h.updateFace();
    h.character.update(dt);
  }
}

// settings (not realistic): another tiny town, out in the open under a fir tree in the
// park: matchbox houses in a ring, a bottle-cap table, a leaf awning, a crumb store
export function buildBurrow(scene, at) {
  const g = new THREE.Group();
  g.name = 'park-burrow';
  scene.add(g);
  const y = at.y;
  const card = new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 0.9 });
  const labels = [['FOX', '#a34a1d', '#f5e6c0'], ['OWL', '#4a3a7a', '#f2efe6'], ['ELK', '#2c6b34', '#f7e9a8'], ['BEE', '#b88a1d', '#2a2010']];
  const houses = [];
  labels.forEach(([t, bg, fg], i) => {
    const a = (i / labels.length) * Math.PI * 2;
    const x = at.x + Math.cos(a) * 0.09, z = at.z + Math.sin(a) * 0.09;
    const side = new THREE.MeshStandardMaterial({ map: labelTexture(t, bg, fg), roughness: 0.8 });
    const m = mesh(new THREE.BoxGeometry(0.053, 0.036, 0.03), [card, card, card, card, side, card], x, y + 0.018, z, g);
    m.rotation.y = -a - Math.PI / 2;
    houses.push(new THREE.Vector3(at.x + Math.cos(a) * 0.065, y, at.z + Math.sin(a) * 0.065));
  });
  const cap = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 21), new THREE.MeshStandardMaterial({ color: 0x1f6fb2, metalness: 0.7, roughness: 0.35 }), at.x, y + 0.006, at.z, g);
  cap.name = 'cap-table';
  const leaf = mesh(new THREE.CircleGeometry(0.05, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f8a2c, roughness: 0.6, side: THREE.DoubleSide }), at.x + 0.03, y + 0.07, at.z - 0.02, g);
  leaf.rotation.z = 0.2;
  mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.9 }), at.x - 0.03, y + 0.006, at.z + 0.03, g);
  g.traverse((o) => { o.userData.noCollide = true; });
  const R = 0.11;
  return {
    houses, y,
    bounds: { x0: at.x - R, x1: at.x + R, z0: at.z - R, z1: at.z + R },
    stations: [{ p: new THREE.Vector3(at.x + 0.02, y, at.z), act: 'table' }, { p: new THREE.Vector3(at.x - 0.03, y, at.z + 0.02), act: 'store' }, ...houses.map((p) => ({ p, act: 'home' }))],
  };
}
