// Procedural portal gun model (fan build inspired by Rick and Morty).
// Units are centimetres, +X points out of the emitter, +Y is up.
// THREE is passed in so the same code runs in the browser viewer and in
// Node (tools/export-models.mjs), which resolve 'three' differently.

export function buildPortalGun(THREE, { coreColor = 0x3dff74 } = {}) {
  const gun = new THREE.Group();
  gun.name = 'PortalGun';
  const parts = [];

  const mat = {
    shell: new THREE.MeshPhysicalMaterial({ name: 'Shell', color: 0xdfe4e2, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
    trim: new THREE.MeshStandardMaterial({ name: 'Trim', color: 0x8f9aa0, roughness: 0.48, metalness: 0.15 }),
    metal: new THREE.MeshStandardMaterial({ name: 'Metal', color: 0xc2c8cb, roughness: 0.28, metalness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x272c30, roughness: 0.55, metalness: 0.2 }),
    rubber: new THREE.MeshStandardMaterial({ name: 'Rubber', color: 0x373c3f, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0xffffff, roughness: 0.05, transmission: 1, thickness: 0.35, ior: 1.45 }),
    fluid: new THREE.MeshStandardMaterial({ name: 'PortalFluid', color: coreColor, emissive: coreColor, emissiveIntensity: 1.5, roughness: 0.25 }),
    glow: new THREE.MeshStandardMaterial({ name: 'EmitterGlow', color: coreColor, emissive: coreColor, emissiveIntensity: 2.4, roughness: 0.3 }),
    screen: new THREE.MeshBasicMaterial({ name: 'Screen', color: 0xff3b30, toneMapped: false }),
  };

  // Rolling bands and rising bubbles in the vial, drawn in the emissive term.
  const fluidTime = { value: 0 };
  mat.fluid.defines = { USE_UV: '' };
  mat.fluid.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = fluidTime;
    shader.fragmentShader = 'uniform float uTime;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float band = sin(vUv.y * 26.0 - uTime * 2.6 + sin(vUv.x * 18.85 + uTime * 1.3) * 1.8) * 0.5 + 0.5;
      float bub = smoothstep(0.9, 1.0, sin(vUv.x * 62.83 + vUv.y * 4.0) * sin(vUv.y * 44.0 - uTime * 5.0));
      totalEmissiveRadiance *= 0.5 + 0.8 * band + 1.6 * bub;`
    );
  };

  const RX = -10.9, FX = 10.6;                      // body shape ends (before bevel)
  const BEVEL = 0.6, HALF_W = 1.65 + BEVEL;         // body half width = 2.25
  const tilt = Math.atan2(0.6, FX - RX);            // top slopes down toward the muzzle
  const topY = (x) => 2.8 - 0.6 * (x - RX) / (FX - RX);
  const bottomY = (x) => -2.6 + 0.4 * (x - RX) / (FX - RX);

  function roundedShape(pts, radii) {
    const s = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const r = Array.isArray(radii) ? radii[i] : radii;
      const toward = (q) => {
        const dx = q[0] - p1[0], dy = q[1] - p1[1], l = Math.hypot(dx, dy);
        return [p1[0] + dx / l * r, p1[1] + dy / l * r];
      };
      const a = toward(p0), b = toward(p2);
      if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
      s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
    }
    s.closePath();
    return s;
  }

  function extrude(shape, depth, bevel, segments = 4) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segments, curveSegments: 14,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  function part(name, info, explode, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.userData = { label: name, info, explode: new THREE.Vector3(...explode), home: g.position.clone() };
    gun.add(g);
    parts.push(g);
    return g;
  }

  function add(parent, geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  const alongX = (geo) => geo.rotateZ(-Math.PI / 2); // cylinder axis Y -> +X

  // Shell: the main body with vents near the muzzle.
  const shell = part('Titanium shell', 'Main housing. Holds the microprocessor and the battery.', [0, 0, 0]);
  add(shell, extrude(roundedShape([[RX, -2.0], [FX, -1.6], [FX, 1.6], [RX, 2.2]], [1.0, 1.2, 1.2, 1.0]), 1.65 * 2, BEVEL), mat.shell);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      add(shell, new THREE.BoxGeometry(0.22, 1.5, 0.12), mat.dark, 7.9 + i * 0.55, 0.15, side * (HALF_W - 0.03));
    }
  }

  // Side panels, four screws each (the infographic's "8 mounting screws").
  const panelShape = roundedShape([[-6.5, -1.2], [6.5, -1.0], [6.5, 1.3], [-6.5, 1.5]], 0.6);
  for (const side of [1, -1]) {
    const panel = part(side > 0 ? 'Side panel (right)' : 'Side panel (left)', 'Bolted armour plate over the electronics bay.', [0, 0, side * 3.5], 0, 0, side * (HALF_W + 0.09));
    add(panel, extrude(panelShape, 0.12, 0.06, 2), mat.trim);
    for (const [sx, sy] of [[-5.9, -0.6], [5.9, -0.45], [5.9, 0.75], [-5.9, 0.9]]) {
      const screw = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16).rotateX(Math.PI / 2);
      add(panel, screw, mat.metal, sx, sy, side * 0.15);
    }
  }

  // Vial socket and the vial of portal fluid on top.
  const VX = -3.2;
  const socket = part('Vial socket', 'Locks the fluid vial in place and feeds the conduit.', [0, 2.6, 0], VX, topY(VX), 0);
  socket.rotation.z = -tilt;
  add(socket, new THREE.CylinderGeometry(2.0, 2.15, 0.7, 48), mat.trim, 0, 0.1, 0);
  add(socket, new THREE.CylinderGeometry(1.6, 1.6, 1.0, 48), mat.metal, 0, 0.85, 0);
  add(socket, new THREE.TorusGeometry(1.55, 0.14, 12, 48).rotateX(Math.PI / 2), mat.dark, 0, 1.35, 0);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    add(socket, new THREE.CylinderGeometry(0.17, 0.17, 0.2, 12), mat.metal, Math.cos(a) * 1.8, 0.5, Math.sin(a) * 1.8);
  }

  const vial = part('Portal fluid vial', 'Green phase crystal suspended in portal fluid. Swappable.', [0, 6.5, 0], VX, topY(VX), 0);
  vial.rotation.z = -tilt;
  add(vial, new THREE.CapsuleGeometry(1.3, 4.0, 12, 40), mat.glass, 0, 4.2, 0);
  add(vial, new THREE.CapsuleGeometry(1.08, 3.3, 12, 40), mat.fluid, 0, 3.95, 0);

  // Frequency display.
  const SX = 5.6;
  const display = part('Frequency display', 'Shows the dimension the gun is locked to.', [0, 3, 0], SX, topY(SX) - 0.05, 0);
  display.rotation.z = -tilt;
  const bezel = extrude(roundedShape([[-2.6, -1.65], [2.6, -1.65], [2.6, 1.65], [-2.6, 1.65]], 0.45), 0.4, 0.08, 2).rotateX(-Math.PI / 2);
  add(display, bezel, mat.dark, 0, 0.2, 0);
  add(display, new THREE.PlaneGeometry(4.3, 2.5).rotateX(-Math.PI / 2), mat.screen, 0, 0.49, 0);
  add(display, new THREE.CylinderGeometry(0.28, 0.28, 0.3, 20), mat.metal, 3.35, 0.2, -0.75);
  add(display, new THREE.CylinderGeometry(0.28, 0.28, 0.3, 20), mat.glow, 3.35, 0.2, 0.75);

  // Dimensional dial on the back, knurled around the rim.
  const dial = part('Dimensional dial', 'Turn to pick the destination dimension.', [-4, 0, 0], RX - BEVEL, 0.5, 0);
  add(dial, alongX(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 32)), mat.metal, -0.3, 0, 0);
  const dialSpin = new THREE.Group();
  dialSpin.position.x = -1.35;
  dial.add(dialSpin);
  const knob = new THREE.CylinderGeometry(1.75, 1.75, 1.5, 96, 1);
  const pos = knob.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r > 1.7) {
      const k = 1 + 0.035 * Math.cos(48 * Math.atan2(z, x));
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  knob.computeVertexNormals();
  add(dialSpin, alongX(knob), mat.dark);
  add(dialSpin, alongX(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 40)), mat.metal, -0.82, 0, 0);
  add(dialSpin, new THREE.BoxGeometry(0.16, 0.95, 0.24), mat.glow, -0.92, 0.55, 0);

  // Emitter at the muzzle.
  const emitter = part('Portal emitter', 'Fires the portal. Glows with the colour of the core.', [4.5, 0, 0], FX + BEVEL, 0.3, 0);
  add(emitter, alongX(new THREE.CylinderGeometry(1.75, 1.95, 1.0, 48)), mat.trim, 0.3, 0, 0);
  add(emitter, new THREE.TorusGeometry(1.55, 0.18, 14, 48).rotateY(Math.PI / 2), mat.metal, 0.85, 0, 0);
  add(emitter, new THREE.SphereGeometry(1.45, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), mat.glow, 0.8, 0, 0);

  // Grip with rubber side panels.
  const grip = part('Grip', 'Non-slip handle. Angled like a pistol grip.', [-1.5, -3, 0]);
  add(grip, extrude(roundedShape([[-7.6, -1.6], [-3.0, -1.6], [-5.6, -9.4], [-9.6, -9.4]], [0.4, 0.6, 1.2, 1.2]), 2.6, 0.5), mat.trim);
  const rubberShape = roundedShape([[-7.2, -3.2], [-3.9, -3.2], [-5.8, -8.8], [-9.0, -8.8]], 0.7);
  for (const side of [-1, 1]) add(grip, extrude(rubberShape, 0.12, 0.05, 2), mat.rubber, 0, 0, side * 1.86);

  // Trigger and guard.
  const trigger = part('Trigger', 'Pull to open a portal.', [1.5, -2.2, 0]);
  add(trigger, extrude(roundedShape([[-1.9, -2.3], [-1.1, -2.3], [-1.5, -4.4], [-2.4, -4.5]], 0.25), 0.5, 0.12, 2), mat.dark);
  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.0, -5.2, 0), new THREE.Vector3(-2.0, -5.45, 0), new THREE.Vector3(0.2, -4.9, 0),
    new THREE.Vector3(0.9, -3.5, 0), new THREE.Vector3(0.9, bottomY(0.9) + 0.1, 0),
  ]);
  add(trigger, new THREE.TubeGeometry(guardCurve, 40, 0.22, 10), mat.trim);

  // Stabilization conduit: a glass tube carrying fluid from the vial to the emitter.
  const conduit = part('Stabilization conduit', 'Carries charged fluid from the vial to the emitter.', [0, 0, 5]);
  const conduitCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(VX + 1.4, topY(VX) + 0.45, 0.9), new THREE.Vector3(VX + 2.6, topY(VX) + 0.05, 2.1),
    new THREE.Vector3(2, 2.0, HALF_W + 0.3), new THREE.Vector3(8, 1.45, HALF_W + 0.3),
    new THREE.Vector3(10.6, 1.05, HALF_W + 0.15), new THREE.Vector3(11.6, 0.65, 1.5),
  ]);
  add(conduit, new THREE.TubeGeometry(conduitCurve, 96, 0.34, 14), mat.glass);
  add(conduit, new THREE.TubeGeometry(conduitCurve, 96, 0.16, 10), mat.glow);
  for (const t of [0.38, 0.62, 0.84]) {
    const p = conduitCurve.getPointAt(t);
    add(conduit, new THREE.BoxGeometry(0.5, 0.9, 0.9), mat.dark, p.x, p.y, p.z - 0.1);
  }

  return {
    group: gun,
    parts,
    materials: mat,
    screenMaterial: mat.screen,
    dialSpin,
    emitterTip: new THREE.Vector3(FX + BEVEL + 2.3, 0.3, 0),
    setCoreColor(hex) {
      for (const m of [mat.fluid, mat.glow]) { m.color.setHex(hex); m.emissive.setHex(hex); }
    },
    setExplode(t) {
      for (const p of parts) p.position.copy(p.userData.home).addScaledVector(p.userData.explode, t);
    },
    update(time) { fluidTime.value = time; },
  };
}

// A copy of the assembled gun at the given scale, for STL/GLB export.
export function exportCopy(THREE, api, scale) {
  const copy = api.group.clone(true);
  copy.position.set(0, 0, 0);
  copy.rotation.set(0, 0, 0);
  copy.children.forEach((child, i) => child.position.copy(api.parts[i].userData.home));
  copy.scale.setScalar(scale);
  copy.updateMatrixWorld(true);
  return copy;
}
