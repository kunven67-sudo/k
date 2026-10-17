import * as THREE from 'three';
import { ROOMS, DOORS, OPENINGS, WINDOWS, H, T_IN, T_OUT } from './layout.js';
import { pbr, paint, canvasTex, worldUV, smudgeTex } from './materials.js';
import { mesh, boxMM, box, wallFace, faceRects, merge, cyl, slab } from './build.js';

// Builds the apartment shell: floors, ceilings, walls with real door/window openings,
// doors, windows with blinds, baseboards, light switches and the view outside.
export async function buildHouse(ctx) {
  const { scene, physics, interact } = ctx;
  const house = { group: new THREE.Group(), doors: {}, windows: {}, switches: {}, walls: [] };
  scene.add(house.group);
  const G = house.group;

  const plaster = await pbr('painted_plaster_wall', { normal: 0.35, ao: false });
  const floors = {
    laminate: await pbr('laminate_floor_02', { normal: 0.8, roughness: 0.85, env: 0.9 }),
    marble: await pbr('marble_01', { normal: 0.6, roughness: 0.9, env: 1 }),
    granite: await pbr('granite_tile', { normal: 0.7, scale: 0.55 }),
  };
  const white = paint(0xf3f2ef, 0.55);
  const trim = paint(0xf4f3f0, 0.35);

  // ---- floors + ceilings -------------------------------------------------
  for (const [name, r] of Object.entries(ROOMS)) {
    const e = name === 'hallway' ? 0.14 : 0.07; // reach under door thresholds
    const fl = mesh(boxMM(r.x0 - e, -0.06, r.z0 - e, r.x1 + e, 0, r.z1 + e), floors[r.floor], { parent: G, cast: false, name: 'floor_' + name });
    fl.userData.surface = r.floor === 'laminate' ? 'wood' : 'tile';
    interact.block(fl);
    const ceilMat = plaster.clone(); ceilMat.color.set(r.ceil);
    const c = new THREE.PlaneGeometry(r.x1 - r.x0 + 0.1, r.z1 - r.z0 + 0.1);
    c.rotateX(Math.PI / 2); c.translate((r.x0 + r.x1) / 2, H, (r.z0 + r.z1) / 2);
    worldUV(c);
    mesh(c, ceilMat, { parent: G, cast: false, name: 'ceiling_' + name });
  }
  // roof slab above the ceilings so the sun can't shine through them
  const roof = mesh(boxMM(-0.4, H + 0.002, -0.4, 11.4, H + 0.3, 6.9), white, { parent: G, receive: false, name: 'roof' });
  roof.castShadow = true;

  // ---- structural walls (solid, with holes) -------------------------------
  // axis 'x': wall runs along x between z0..z1 thickness. holes: [{a0,a1,y0,y1}] in world x.
  const structMat = white;
  function structWall(x0, z0, x1, z1, axis, holes = []) {
    const len = axis === 'x' ? x1 - x0 : z1 - z0;
    const local = holes.map(o => ({ x0: o.a0 - (axis === 'x' ? x0 : z0), x1: o.a1 - (axis === 'x' ? x0 : z0), y0: o.y0, y1: o.y1 }));
    const geos = [];
    for (const r of faceRects(len, H, local)) {
      const g = axis === 'x' ? boxMM(x0 + r.x0, r.y0, z0, x0 + r.x1, r.y1, z1) : boxMM(x0, r.y0, z0 + r.x0, x1, r.y1, z0 + r.x1);
      geos.push(g);
      if (r.y0 < 1.9) { // anything you could bump into
        const cx = axis === 'x' ? x0 + (r.x0 + r.x1) / 2 : (x0 + x1) / 2;
        const cz = axis === 'x' ? (z0 + z1) / 2 : z0 + (r.x0 + r.x1) / 2;
        const hx = axis === 'x' ? (r.x1 - r.x0) / 2 : (x1 - x0) / 2;
        const hz = axis === 'x' ? (z1 - z0) / 2 : (r.x1 - r.x0) / 2;
        physics.add({ x: cx, z: cz, hx, hz, y0: r.y0, y1: r.y1 });
      }
    }
    const m = mesh(merge(geos), structMat, { parent: G, name: 'wall' });
    interact.block(m);
    house.walls.push(m);
  }
  const d = DOORS, w = WINDOWS, op = OPENINGS[0];
  structWall(-T_OUT, -T_OUT, 5.52, 0, 'x', [{ a0: w.bedroom.x0, a1: w.bedroom.x1, y0: w.bedroom.y0, y1: w.bedroom.y1 }]);
  structWall(5.4, -T_OUT, 6.94, 0, 'x');
  structWall(6.82, -T_OUT, 11.16, 0, 'x', [{ a0: w.kitchen.x0, a1: w.kitchen.x1, y0: w.kitchen.y0, y1: w.kitchen.y1 }]);
  structWall(-T_OUT, -T_OUT, 0, 5.02, 'z');
  structWall(-T_OUT, 4.8, 5.52, 5.02, 'x');
  structWall(5.4, 0, 5.52, 4.8, 'z', [{ a0: d.bedroom.z0, a1: d.bedroom.z1, y0: 0, y1: d.bedroom.h }]);
  structWall(5.3, 4.8, 5.52, 6.62, 'z');
  structWall(5.3, 6.4, 7.06, 6.62, 'x', [{ a0: d.front.x0, a1: d.front.x1, y0: 0, y1: d.front.h }]);
  structWall(6.82, 0, 6.94, 3.6, 'z', [{ a0: op.z0, a1: op.z1, y0: 0, y1: op.h }]);
  structWall(6.82, 3.6, 6.94, 6.4, 'z', [{ a0: d.bathroom.z0, a1: d.bathroom.z1, y0: 0, y1: d.bathroom.h }]);
  structWall(6.94, 3.6, 9.34, 3.72, 'x');
  structWall(9.34, 3.6, 11.16, 3.82, 'x');
  structWall(9.34, 3.6, 9.56, 6.62, 'z');
  structWall(6.82, 6.4, 9.56, 6.62, 'x', [{ a0: w.bathroom.x0, a1: w.bathroom.x1, y0: w.bathroom.y0, y1: w.bathroom.y1 }]);
  structWall(10.94, -T_OUT, 11.16, 3.82, 'z');

  // ---- painted room faces ---------------------------------------------------
  const holes = { bedroom: { N: [], S: [], E: [], W: [] }, hallway: { N: [], S: [], E: [], W: [] }, kitchen: { N: [], S: [], E: [], W: [] }, bathroom: { N: [], S: [], E: [], W: [] } };
  const along = (room, side, a) => {
    const r = ROOMS[room];
    return side === 'N' ? a - r.x0 : side === 'S' ? r.x1 - a : side === 'W' ? r.z1 - a : a - r.z0;
  };
  const addHole = (room, side, a0, a1, y0, y1) => {
    const p = along(room, side, a0), q = along(room, side, a1);
    holes[room][side].push({ x0: Math.min(p, q), x1: Math.max(p, q), y0, y1 });
  };
  addHole('bedroom', 'E', d.bedroom.z0, d.bedroom.z1, 0, d.bedroom.h);
  addHole('hallway', 'W', d.bedroom.z0, d.bedroom.z1, 0, d.bedroom.h);
  addHole('bathroom', 'W', d.bathroom.z0, d.bathroom.z1, 0, d.bathroom.h);
  addHole('hallway', 'E', d.bathroom.z0, d.bathroom.z1, 0, d.bathroom.h);
  addHole('hallway', 'S', d.front.x0, d.front.x1, 0, d.front.h);
  addHole('hallway', 'E', op.z0, op.z1, 0, op.h);
  addHole('kitchen', 'W', op.z0, op.z1, 0, op.h);
  for (const win of Object.values(w)) addHole(win.room, win.wall, win.x0, win.x1, win.y0, win.y1);

  const faceMats = {};
  for (const [name, r] of Object.entries(ROOMS)) {
    const m = plaster.clone(); m.color.set(r.wall); faceMats[name] = m;
    const sides = {
      N: [r.x0, r.z0, 1, 0, r.x1 - r.x0], S: [r.x1, r.z1, -1, 0, r.x1 - r.x0],
      W: [r.x0, r.z1, 0, -1, r.z1 - r.z0], E: [r.x1, r.z0, 0, 1, r.z1 - r.z0],
    };
    for (const [side, [ox, oz, dx, dz, len]] of Object.entries(sides)) {
      const inset = 0.002;
      const g = wallFace(ox + (-dz) * inset, oz + dx * inset, dx, dz, len, H, holes[name][side]);
      if (!g) continue;
      let mat = m;
      if (name === 'bedroom' && side === 'W') { mat = plaster.clone(); mat.color.set(r.accent); }
      if (name === 'bathroom') mat = await tileMat();
      const fm = mesh(g, mat, { parent: G, cast: false, name: `face_${name}_${side}` });
      interact.block(fm);
      // baseboard along the bottom, skipping door holes
      if (name !== 'bathroom') {
        const base = holes[name][side].filter(o => o.y0 < 0.1);
        for (const seg of faceRects(len, 0.085, base)) {
          const a0 = seg.x0, a1 = seg.x1;
          const ax0 = ox + dx * a0, az0 = oz + dz * a0, ax1 = ox + dx * a1, az1 = oz + dz * a1;
          const nx = -dz, nz = dx, t = 0.014;
          const bx0 = Math.min(ax0, ax1, ax0 + nx * t), bx1 = Math.max(ax0, ax1, ax1 + nx * t);
          const bz0 = Math.min(az0, az1, az0 + nz * t), bz1 = Math.max(az0, az1, az1 + nz * t);
          mesh(boxMM(bx0, 0, bz0, bx1, 0.085, bz1), trim, { parent: G, cast: false });
        }
      }
    }
  }
  house.faceMats = faceMats;

  async function tileMat() {
    if (house._tile) return house._tile;
    // glossy white wall tiles with grout, 20x30 cm
    const map = canvasTex(1024, 1024, (g, W, Hh) => {
      g.fillStyle = '#cfcdc8'; g.fillRect(0, 0, W, Hh);
      const tw = W / 2, th = Hh / 3;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) {
        const v = 236 + Math.random() * 10;
        g.fillStyle = `rgb(${v},${v - 1},${v - 3})`;
        g.fillRect(x * tw + 4, y * th + 4, tw - 8, th - 8);
      }
    });
    const rough = canvasTex(1024, 1024, (g, W, Hh) => {
      g.fillStyle = '#ddd'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#222';
      const tw = W / 2, th = Hh / 3;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) g.fillRect(x * tw + 5, y * th + 5, tw - 10, th - 10);
    }, false);
    map.repeat.set(1 / 0.4, 1 / 0.9); rough.repeat.copy(map.repeat);
    house._tile = new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0, envMapIntensity: 1.2 });
    return house._tile;
  }

  // ---- doors ------------------------------------------------------------------
  const doorMat = paint(0xf1f0ed, 0.42, 0, { roughnessMap: smudgeTex() });
  const chrome = paint(0xd8d8d8, 0.18, 1);
  for (const [key, dd] of Object.entries(DOORS)) house.doors[key] = makeDoor(key, dd);

  function makeDoor(key, dd) {
    const vertical = dd.wall === 'E' || dd.wall === 'W';
    const width = vertical ? dd.z1 - dd.z0 : dd.x1 - dd.x0;
    const leafW = width - 0.01, leafH = dd.h - 0.012, leafT = 0.038;
    // wall center line
    let wallC;
    if (key === 'bedroom') wallC = 5.46; else if (key === 'bathroom') wallC = 6.88; else wallC = 6.51;
    const pivot = new THREE.Group();
    const leaf = new THREE.Group();
    pivot.add(leaf);
    // shaker-style panel door
    const body = mesh(box(leafW, leafH, leafT, 0.004), doorMat, { parent: leaf });
    body.position.set(leafW / 2, leafH / 2 + 0.008, 0);
    for (const sx of [-1, 1]) {
      for (const [py, ph] of [[0.62, 0.9], [1.6, 0.75]]) {
        const p = mesh(box(leafW - 0.22, ph, 0.006, 0.002), doorMat, { parent: leaf, cast: false });
        p.position.set(leafW / 2, py, sx * (leafT / 2 + 0.001));
      }
    }
    // lever handles both sides
    for (const sx of [-1, 1]) {
      const rose = mesh(cyl(0.026, 0.026, 0.012, 24), chrome, { parent: leaf, rot: [Math.PI / 2, 0, 0] });
      rose.position.set(leafW - 0.065, 1.02, sx * (leafT / 2 + 0.006));
      const lever = mesh(box(0.13, 0.018, 0.018, 0.008), chrome, { parent: leaf });
      lever.position.set(leafW - 0.065 - 0.055, 1.02, sx * (leafT / 2 + 0.03));
      const neck = mesh(cyl(0.008, 0.008, 0.03, 12), chrome, { parent: leaf, rot: [Math.PI / 2, 0, 0] });
      neck.position.set(leafW - 0.065, 1.02, sx * (leafT / 2 + 0.018));
    }
    // frame casing (trim) both sides
    const casing = new THREE.Group();
    const wallT = key === 'front' ? T_OUT : T_IN;
    for (const sx of [-1, 1]) {
      const off = sx * (wallT / 2 + 0.008);
      const l = mesh(box(0.07, dd.h + 0.07, 0.016, 0.003), trim, { parent: casing, cast: false }); l.position.set(-0.035, (dd.h + 0.07) / 2, off);
      const r = mesh(box(0.07, dd.h + 0.07, 0.016, 0.003), trim, { parent: casing, cast: false }); r.position.set(width + 0.035, (dd.h + 0.07) / 2, off);
      const t = mesh(box(width + 0.14, 0.07, 0.016, 0.003), trim, { parent: casing, cast: false }); t.position.set(width / 2, dd.h + 0.035, off);
    }
    // jamb lining inside the opening
    mesh(box(0.02, dd.h, wallT), trim, { parent: casing, pos: [0.01, dd.h / 2, 0], cast: false });
    mesh(box(0.02, dd.h, wallT), trim, { parent: casing, pos: [width - 0.01, dd.h / 2, 0], cast: false });
    mesh(box(width, 0.02, wallT), trim, { parent: casing, pos: [width / 2, dd.h - 0.01, 0], cast: false });
    G.add(casing);

    // place: local x runs along the opening from the hinge side
    let hx, hz, ang;
    if (vertical) {
      hx = wallC; hz = dd.hingeAt === 'z1' ? dd.z1 : dd.z0;
      ang = dd.hingeAt === 'z1' ? Math.PI / 2 : -Math.PI / 2; // local +x -> world -z
      casing.position.set(wallC, 0, dd.z1); casing.rotation.y = Math.PI / 2;
    } else {
      hx = dd.x0; hz = wallC; ang = 0;
      casing.position.set(dd.x0, 0, wallC);
    }
    pivot.position.set(hx, 0, hz);
    pivot.rotation.y = ang;
    leaf.position.z = 0;
    G.add(pivot);
    // which way it swings: into the room it belongs to
    const swingSign = key === 'bedroom' ? -1 : key === 'bathroom' ? 1 : 1;
    const door = { key, pivot, leaf, open: 0, target: 0, base: ang, width, locked: !!dd.locked, swingSign };
    const col = physics.add({ x: 0, z: 0, hx: width / 2, hz: 0.03, y0: 0, y1: dd.h });
    door.collider = col;
    door.update = (dt) => {
      const speed = 2.2;
      door.open += Math.sign(door.target - door.open) * Math.min(Math.abs(door.target - door.open), dt * speed);
      const a = door.base + door.swingSign * door.open * (Math.PI / 2) * 0.96;
      pivot.rotation.y = a;
      // collider follows the leaf
      const cx = Math.cos(a), sx = -Math.sin(a);
      col.x = hx + cx * width / 2; col.z = hz + sx * width / 2; col.rot = a;
    };
    door.update(0);
    door.toggle = () => {
      if (door.locked) {
        ctx.audio.play('door_locked.ogg', { pos: new THREE.Vector3(hx, 1, hz), vol: 0.6 });
        ctx.toast(key === 'front' ? "It's locked. You're not going out right now." : 'Locked.');
        return;
      }
      const opening = door.target < 0.5;
      door.target = opening ? 1 : 0;
      const p = new THREE.Vector3(hx, 1.1, hz);
      ctx.audio.play(opening ? 'door_open.ogg' : 'door_close.ogg', { pos: p, vol: 0.7, jitter: 0.04 });
      if (opening && Math.random() < 0.35) ctx.audio.play('door_creak.ogg', { pos: p, vol: 0.18, rate: 1.2 + Math.random() * 0.3 });
    };
    interact.add(leaf, { label: () => door.locked ? 'Front door' : (door.target > 0.5 ? 'Close door' : 'Open door'), use: door.toggle });
    return door;
  }

  // ---- windows --------------------------------------------------------------
  const frameMat = paint(0xf6f6f4, 0.4);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide });
  const frosted = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.72, depthWrite: false });
  const slatMat = paint(0xe9e8e4, 0.45, 0.1);
  for (const [key, win] of Object.entries(WINDOWS)) {
    const outward = win.wall === 'N' ? -1 : 1; // z direction of the outside
    const zWall = win.wall === 'N' ? 0 : 6.4;
    const wallT = T_OUT;
    const zc = zWall + outward * wallT * 0.55;
    const g = new THREE.Group();
    G.add(g);
    const W = win.x1 - win.x0, Hh = win.y1 - win.y0, cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
    const f = 0.055;
    mesh(boxMM(win.x0, win.y0, zc - 0.03, win.x1, win.y0 + f, zc + 0.03), frameMat, { parent: g });
    mesh(boxMM(win.x0, win.y1 - f, zc - 0.03, win.x1, win.y1, zc + 0.03), frameMat, { parent: g });
    mesh(boxMM(win.x0, win.y0, zc - 0.03, win.x0 + f, win.y1, zc + 0.03), frameMat, { parent: g });
    mesh(boxMM(win.x1 - f, win.y0, zc - 0.03, win.x1, win.y1, zc + 0.03), frameMat, { parent: g });
    if (W > 1) mesh(boxMM(cx - 0.035, win.y0, zc - 0.035, cx + 0.035, win.y1, zc + 0.035), frameMat, { parent: g });
    const pane = new THREE.PlaneGeometry(W - f * 2, Hh - f * 2);
    mesh(pane, win.frosted ? frosted : glass, { parent: g, pos: [cx, cy, zc], cast: false, receive: false, name: 'glass' });
    // interior sill
    const inner = zWall - outward * 0.0;
    const sill = mesh(boxMM(win.x0 - 0.05, win.y0 - 0.03, Math.min(inner, inner - outward * 0.06), win.x1 + 0.05, win.y0, Math.max(inner, inner - outward * 0.06)), trim, { parent: g });
    interact.block(sill);
    const wobj = { key, win, group: g, blinds: null };
    // blinds for the real windows
    if (!win.frosted) {
      const slats = Math.round(Hh / 0.025);
      const slat = new THREE.BoxGeometry(W - 0.02, 0.0012, 0.024);
      const inst = new THREE.InstancedMesh(slat, slatMat, slats);
      inst.castShadow = true; inst.receiveShadow = true;
      const zb = zWall - outward * 0.035;
      const head = mesh(boxMM(win.x0 - 0.01, win.y1 - 0.004, zb - 0.025, win.x1 + 0.01, win.y1 + 0.035, zb + 0.025), slatMat, { parent: g });
      head.name = 'blind_head';
      g.add(inst);
      const bl = { inst, tilt: key === 'bedroom' ? 1.1 : 0.15, target: key === 'bedroom' ? 1.1 : 0.15, n: slats, zb };
      const dummy = new THREE.Object3D();
      bl.update = (dt) => {
        bl.tilt += (bl.target - bl.tilt) * Math.min(1, dt * 4);
        for (let i = 0; i < slats; i++) {
          dummy.position.set(cx, win.y1 - 0.02 - i * 0.025, zb);
          dummy.rotation.set(bl.tilt, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
      };
      bl.update(1);
      bl.openness = () => 1 - Math.min(1, Math.abs(bl.tilt) / 1.35);
      interact.add(inst, { label: () => bl.target > 0.6 ? 'Open blinds' : 'Close blinds', use: () => { bl.target = bl.target > 0.6 ? 0.1 : 1.35; ctx.audio.play('blinds.ogg', { pos: new THREE.Vector3(cx, cy, zb), vol: 0.45 }); } });
      wobj.blinds = bl;
    }
    house.windows[key] = wobj;
  }

  // ---- the world outside (real photo of a street, day + night) --------------
  house.sky = await makeSky(ctx);
  G.add(house.sky.mesh);

  return house;
}

async function makeSky(ctx) {
  const { tex } = await import('./materials.js');
  const [day, night] = await Promise.all([tex('skies/courtyard.webp'), tex('skies/courtyard_night.webp')]);
  for (const t of [day, night]) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
  const mat = new THREE.ShaderMaterial({
    uniforms: { day: { value: day }, night: { value: night }, mixv: { value: 0 }, gain: { value: 1.6 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D day, night; uniform float mixv, gain; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float u = atan(d.x, -d.z) / 6.2831853 + 0.5; float v = acos(clamp(d.y,-1.,1.)) / 3.14159265;
        vec2 uv = vec2(u, 1.0 - v);
        vec3 a = texture2D(day, uv).rgb, b = texture2D(night, uv).rgb;
        gl_FragColor = vec4(mix(a, b, mixv) * gain, 1.);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  // three converts the sRGB textures to linear when sampling; our output is linear too (tone mapped later)
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), mat);
  m.position.set(5.4, 1.5, 2.4);
  m.rotation.y = 2.2;
  m.renderOrder = -10;
  m.frustumCulled = false;
  m.name = 'sky';
  return { mesh: m, mat };
}
