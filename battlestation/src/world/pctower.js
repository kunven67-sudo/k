import * as THREE from 'three';
import { mesh, box, boxMM, cyl, tube } from './build.js';
import { paint, canvasTex } from './materials.js';

// Mid-tower PC case with a tempered glass side, RGB fans, motherboard, cooler, RAM and a
// graphics card that matches the class of card you really have. Front faces local +z,
// the glass side faces local -x, the motherboard sits on the +x wall.
const CW = 0.215, CH = 0.47, CD = 0.45;

function fanBladeGeo() {
  // 7 curved blades as one geometry
  const geos = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Shape();
    s.moveTo(0.018, -0.004); s.quadraticCurveTo(0.04, 0.012, 0.056, 0.004); s.lineTo(0.055, -0.012); s.quadraticCurveTo(0.038, -0.006, 0.02, -0.016); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false });
    g.rotateZ((i / 7) * Math.PI * 2);
    geos.push(g);
  }
  return geos;
}

function makeFan(size, rgbMat, frameMat, bladeMat) {
  // a 120/140 mm fan: square frame, hub, blades, RGB ring. Spins around local z.
  const g = new THREE.Group();
  const s = size;
  const t = 0.025;
  const ring = new THREE.RingGeometry(s * 0.44, s * 0.5, 48, 1);
  const frame = new THREE.Group();
  for (const [x, y, w, h] of [[0, s / 2 - 0.003, s, 0.006], [0, -s / 2 + 0.003, s, 0.006], [s / 2 - 0.003, 0, 0.006, s], [-s / 2 + 0.003, 0, 0.006, s]]) {
    mesh(new THREE.BoxGeometry(w, h, t), frameMat, { parent: frame, pos: [x, y, 0] });
  }
  for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) mesh(new THREE.BoxGeometry(0.014, 0.014, t), frameMat, { parent: frame, pos: [x * (s / 2 - 0.007), y * (s / 2 - 0.007), 0] });
  g.add(frame);
  const glow = mesh(ring, rgbMat, { parent: g, cast: false, pos: [0, 0, t / 2 + 0.0005] });
  const glow2 = mesh(ring, rgbMat, { parent: g, cast: false, pos: [0, 0, -t / 2 - 0.0005], rot: [0, Math.PI, 0] });
  const rotor = new THREE.Group();
  mesh(cyl(0.02, 0.02, t * 0.8, 24), bladeMat, { parent: rotor, rot: [Math.PI / 2, 0, 0] });
  for (const bg of fanBladeGeo()) {
    bg.scale(s / 0.12, s / 0.12, 1);
    mesh(bg, bladeMat, { parent: rotor, pos: [0, 0, -0.001] });
  }
  g.add(rotor);
  g.userData.rotor = rotor;
  void glow; void glow2;
  return g;
}

export function gpuClass(name = '') {
  const n = name.toLowerCase();
  if (!n || /intel|uhd|iris|radeon\(tm\) graphics|vega \d+ graphics|microsoft basic|swiftshader|llvmpipe/.test(n)) return 'igpu';
  if (/gt ?(710|720|730|1010|1030)|gtx ?(650|750)|rx ?(5[0-5]0|6400)|r7 |quadro p(4|6)00|t400|t600/.test(n)) return 'lp1';
  if (/rtx ?(30[7-9]0|40[7-9]0|50[7-9]0)|rx ?(6[7-9]\d0|7[7-9]\d0|9070)|titan/.test(n)) return 'triple';
  return 'dual';
}

export function buildTower(ctx) {
  const g = new THREE.Group();
  g.name = 'pc';
  const steel = paint(0x101114, 0.42, 0.55);
  const steelIn = paint(0x0c0c0e, 0.6, 0.4);
  const plastic = paint(0x121214, 0.55, 0.05);
  const pcbMat = paint(0x161a1c, 0.55, 0.15);
  const heatMat = paint(0x2a2c30, 0.35, 0.85);
  const rgbMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2266, emissiveIntensity: 3.2, side: THREE.DoubleSide });
  const rgbMat2 = rgbMat.clone();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.3, transparent: true, opacity: 0.55, emissive: 0xff2266, emissiveIntensity: 0.6 });

  const x0 = -CW / 2, x1 = CW / 2, z0 = -CD / 2, z1 = CD / 2;
  // shell: right panel, top, bottom, back
  mesh(boxMM(x1 - 0.0015, 0, z0, x1, CH, z1), steel, { parent: g });
  mesh(boxMM(x0, CH - 0.002, z0, x1, CH, z1 - 0.02), steel, { parent: g });
  mesh(boxMM(x0, 0, z0, x1, 0.012, z1), steel, { parent: g });
  mesh(boxMM(x0, 0.012, z0, x1, CH - 0.002, z0 + 0.0015), steelIn, { parent: g });
  // feet
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.012, 0.014, 0.012, 16), plastic, { parent: g, pos: [x * 0.08, -0.006, z * 0.18] });
  g.position.y = 0.012;
  // front panel: mesh + frame
  const meshTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) { c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill(); }
  }, false);
  meshTex.repeat.set(10, 22);
  const frontMesh = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.6, metalness: 0.4, alphaMap: meshTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  // invert: holes are the white dots -> use alphaMap where white = opaque, so draw inverse
  meshTex.image.getContext('2d').globalCompositeOperation = 'difference';
  meshTex.image.getContext('2d').fillStyle = '#fff'; meshTex.image.getContext('2d').fillRect(0, 0, 256, 256);
  meshTex.needsUpdate = true;
  const front = mesh(new THREE.PlaneGeometry(CW - 0.016, CH - 0.03), frontMesh, { parent: g, pos: [0, CH / 2, z1 - 0.001], cast: false });
  for (const [px, py, w, h] of [[0, CH - 0.012, CW, 0.024], [0, 0.012, CW, 0.024], [x0 + 0.004, CH / 2, 0.008, CH], [x1 - 0.004, CH / 2, 0.008, CH]]) mesh(new THREE.BoxGeometry(w, h, 0.012), plastic, { parent: g, pos: [px, py, z1 - 0.004] });
  // top I/O: power button with LED ring, reset, USB ports
  const powerBtn = mesh(cyl(0.008, 0.008, 0.004, 32), paint(0x1a1a1d, 0.35, 0.6), { parent: g, pos: [-0.04, CH + 0.002, z1 - 0.035] });
  const pledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.DoubleSide });
  mesh(new THREE.RingGeometry(0.0082, 0.0094, 32), pledMat, { parent: g, pos: [-0.04, CH + 0.0042, z1 - 0.035], rot: [-Math.PI / 2, 0, 0], cast: false });
  mesh(cyl(0.003, 0.003, 0.003, 16), plastic, { parent: g, pos: [-0.015, CH + 0.0015, z1 - 0.035] });
  for (let i = 0; i < 2; i++) mesh(new THREE.BoxGeometry(0.013, 0.002, 0.0055), paint(0x000000, 0.8), { parent: g, pos: [0.012 + i * 0.022, CH + 0.0005, z1 - 0.035] });

  // PSU shroud
  mesh(boxMM(x0 + 0.001, 0.012, z0 + 0.002, x1 - 0.002, 0.115, z1 - 0.012), steelIn, { parent: g });
  // motherboard
  const mbTex = canvasTex(512, 640, (c, w, h) => {
    c.fillStyle = '#15191b'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,140,150,0.18)'; c.lineWidth = 1;
    for (let i = 0; i < 160; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 120, y); c.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120); c.stroke(); }
    c.fillStyle = '#2d3135'; c.fillRect(20, 30, 120, 220); c.fillRect(170, 30, 260, 40); // VRM covers
    c.fillStyle = '#c9c9c9'; c.font = 'bold 22px Arial'; c.fillText('X', 40, 300);
    c.fillStyle = '#25282b'; for (let i = 0; i < 3; i++) c.fillRect(60, 380 + i * 90, 380, 14); // PCIe slots
    c.fillStyle = '#3a3e42'; c.fillRect(330, 470, 140, 140); // chipset heatsink
  });
  const mb = mesh(new THREE.BoxGeometry(0.0016, 0.305, 0.244), new THREE.MeshStandardMaterial({ map: mbTex, roughness: 0.55, metalness: 0.2 }), { parent: g, pos: [x1 - 0.022, 0.12 + 0.305 / 2 + 0.01, z0 + 0.012 + 0.244 / 2] });
  mb.rotation.y = 0;
  const mbX = x1 - 0.023; // front face of the board
  // rear I/O shield + VRM heatsinks
  mesh(boxMM(mbX - 0.03, 0.33, z0 + 0.005, mbX, 0.44, z0 + 0.03), heatMat, { parent: g });
  mesh(boxMM(mbX - 0.022, 0.4, z0 + 0.03, mbX, 0.435, z0 + 0.16), heatMat, { parent: g });
  // CPU tower cooler with a fan in front
  const fanMat = paint(0x18181b, 0.5);
  const coolerY = 0.35, coolerZ = z0 + 0.13;
  const finTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#999'; c.fillRect(0, 0, w, h); c.fillStyle = '#333'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1.6); }, false);
  const fins = mesh(boxMM(mbX - 0.135, coolerY - 0.065, coolerZ - 0.025, mbX - 0.01, coolerY + 0.065, coolerZ + 0.025), new THREE.MeshStandardMaterial({ color: 0xbfc3c7, roughness: 0.3, metalness: 0.9, bumpMap: finTex, bumpScale: 2 }), { parent: g });
  void fins;
  const cpuFan = makeFan(0.12, rgbMat, fanMat, bladeMat);
  cpuFan.position.set(mbX - 0.072, coolerY, coolerZ + 0.04);
  g.add(cpuFan);
  // heat pipes
  for (let i = 0; i < 4; i++) mesh(cyl(0.003, 0.003, 0.06, 12), paint(0xb87333, 0.3, 1), { parent: g, pos: [mbX - 0.025 - i * 0.02, coolerY + 0.08, coolerZ], cast: false });
  // RAM slots + sticks
  const ram = new THREE.Group();
  g.add(ram);
  const ramMat = paint(0x1d1e22, 0.4, 0.6);
  const ramRgb = rgbMat2;
  const sticks = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group();
    mesh(boxMM(-0.034, 0, -0.0035, 0, 0.13, 0.0035), ramMat, { parent: s });
    mesh(boxMM(-0.041, 0.002, -0.003, -0.034, 0.128, 0.003), ramRgb, { parent: s, cast: false });
    s.position.set(mbX, 0.29, z0 + 0.185 + i * 0.0105);
    ram.add(s);
    sticks.push(s);
  }
  // graphics card (rebuilt when you swap it)
  const gpuHolder = new THREE.Group();
  g.add(gpuHolder);
  // front + rear fans
  const fans = [cpuFan];
  for (let i = 0; i < 3; i++) {
    const f = makeFan(0.12, rgbMat, fanMat, bladeMat);
    f.position.set(0, 0.17 + i * 0.128, z1 - 0.03);
    if (f.position.y + 0.06 < CH - 0.01) { g.add(f); fans.push(f); }
  }
  const rear = makeFan(0.12, rgbMat, fanMat, bladeMat);
  rear.position.set(-0.01, 0.37, z0 + 0.016);
  g.add(rear); fans.push(rear);

  // tempered glass side panel (hinged at the back so you can swing it open)
  const glassPivot = new THREE.Group();
  glassPivot.position.set(x0, 0, z0);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa0a8, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
  const glassPane = mesh(new THREE.BoxGeometry(0.004, CH - 0.004, CD - 0.002), glassMat, { parent: glassPivot, pos: [-0.002, CH / 2, CD / 2], cast: false, receive: false });
  for (const [y] of [[0.004], [CH - 0.004]]) mesh(new THREE.BoxGeometry(0.005, 0.008, CD - 0.002), steel, { parent: glassPivot, pos: [-0.002, y, CD / 2] });
  g.add(glassPivot);

  // rear: PSU power socket + switch (where the power cable plugs in)
  const psuSock = mesh(new THREE.BoxGeometry(0.03, 0.022, 0.004), paint(0x050505, 0.8), { parent: g, pos: [0.03, 0.06, z0 - 0.002] });
  const psuSwitch = mesh(new THREE.BoxGeometry(0.012, 0.016, 0.006), paint(0x0a0a0a, 0.6), { parent: g, pos: [-0.02, 0.06, z0 - 0.003] });
  // rear I/O ports (ethernet port location for the router cable)
  const ioPorts = new THREE.Group();
  mesh(boxMM(mbX - 0.04, 0.33, z0 - 0.002, mbX - 0.002, 0.44, z0), paint(0x6a6e73, 0.5, 0.7), { parent: ioPorts });
  const ethPort = mesh(new THREE.BoxGeometry(0.016, 0.014, 0.003), paint(0x050505, 0.9), { parent: ioPorts, pos: [mbX - 0.02, 0.35, z0 - 0.002] });
  g.add(ioPorts);

  const tower = {
    group: g, fans, sticks, gpuHolder, glassPivot, powerBtn, pledMat, rgbMat, rgbMat2, bladeMat, psuSock, ethPort, psuSwitch,
    on: false, fanSpeed: 0, panelOpen: 0, panelTarget: 0, gpuClass: null, gpuParts: null, time: 0, rgbMode: 'rainbow', dust: 0,
    size: new THREE.Vector3(CW, CH, CD),
  };

  tower.setRam = (n) => { sticks.forEach((s, i) => { s.visible = n >= 4 ? true : n === 1 ? i === 1 : n === 2 ? (i === 1 || i === 3) : i < n; }); };
  tower.setRam(2);

  tower.setGpu = (cls) => {
    tower.gpuClass = cls;
    gpuHolder.clear();
    if (cls === 'igpu' || !cls) return;
    const spec = { lp1: { len: 0.168, ht: 0.068, th: 0.018, fans: 1, fanSize: 0.05 }, dual: { len: 0.235, ht: 0.112, th: 0.04, fans: 2, fanSize: 0.088 }, triple: { len: 0.305, ht: 0.128, th: 0.055, fans: 3, fanSize: 0.09 } }[cls];
    const yTop = 0.245;
    const zStart = z0 + 0.004;
    const shroudMat = paint(cls === 'lp1' ? 0x2a2a2d : 0x1a1b1f, 0.45, 0.5);
    // PCB (horizontal) + backplate on top + cooler shroud underneath
    mesh(boxMM(mbX - spec.ht, yTop - 0.0016, zStart, mbX, yTop, zStart + spec.len), pcbMat, { parent: gpuHolder });
    mesh(boxMM(mbX - spec.ht, yTop, zStart + 0.01, mbX - 0.004, yTop + 0.003, zStart + spec.len), paint(0x0f1012, 0.4, 0.7), { parent: gpuHolder });
    mesh(boxMM(mbX - spec.ht + 0.002, yTop - spec.th, zStart + 0.005, mbX - 0.002, yTop - 0.0016, zStart + spec.len - 0.002), shroudMat, { parent: gpuHolder });
    const gfans = [];
    for (let i = 0; i < spec.fans; i++) {
      const f = makeFan(spec.fanSize, cls === 'triple' ? rgbMat : fanMat, shroudMat, paint(0x151517, 0.5));
      f.rotation.x = Math.PI / 2;
      f.position.set(mbX - spec.ht / 2, yTop - spec.th - 0.001, zStart + spec.len * (i + 0.5) / spec.fans);
      f.scale.z = 0.4;
      gpuHolder.add(f); gfans.push(f);
    }
    // bracket on the back of the case
    mesh(boxMM(mbX - spec.ht - 0.005, yTop - spec.th - 0.005, z0 - 0.001, mbX, yTop + 0.01, z0 + 0.003), paint(0x8d9196, 0.4, 0.9), { parent: gpuHolder });
    if (cls === 'triple') mesh(boxMM(mbX - spec.ht - 0.0005, yTop - spec.th * 0.6, zStart + 0.03, mbX - spec.ht + 0.0005, yTop - spec.th * 0.45, zStart + spec.len - 0.03), rgbMat, { parent: gpuHolder, cast: false });
    tower.gpuFans = gfans;
    tower.gpuSpec = spec;
  };

  tower.update = (dt, load = 0) => {
    tower.time += dt;
    const target = tower.on ? 0.35 + load * 0.65 : 0;
    tower.fanSpeed += (target - tower.fanSpeed) * Math.min(1, dt * (tower.on ? 1.5 : 0.6));
    for (const f of fans) f.userData.rotor.rotation.z -= tower.fanSpeed * dt * 70;
    for (const f of tower.gpuFans || []) f.userData.rotor.rotation.z += (tower.on ? 0.2 + load * 0.8 : 0) * dt * 80;
    const t = tower.time;
    const lit = tower.on ? 1 : 0;
    if (tower.rgbMode === 'rainbow') { rgbMat.emissive.setHSL((t * 0.07) % 1, 0.95, 0.5); rgbMat2.emissive.setHSL((t * 0.07 + 0.33) % 1, 0.95, 0.5); }
    rgbMat.emissiveIntensity = 3.2 * lit; rgbMat2.emissiveIntensity = 3.2 * lit;
    bladeMat.emissive.copy(rgbMat.emissive); bladeMat.emissiveIntensity = 0.5 * lit;
    pledMat.emissiveIntensity = tower.sleep ? (0.5 + 0.5 * Math.sin(t * 2)) * 2.5 : lit * 2.5;
    tower.panelOpen += (tower.panelTarget - tower.panelOpen) * Math.min(1, dt * 5);
    glassPivot.rotation.y = tower.panelOpen * 1.6;
  };

  // light from the RGB spilling onto the desk + wall
  const spill = new THREE.PointLight(0xff3377, 0, 1.1, 2);
  spill.position.set(-0.12, 0.3, 0.02);
  g.add(spill);
  tower.spill = spill;
  const baseUpdate = tower.update;
  tower.update = (dt, load) => { baseUpdate(dt, load); spill.color.copy(rgbMat.emissive); spill.intensity = tower.on ? 0.25 : 0; };
  return tower;
}
