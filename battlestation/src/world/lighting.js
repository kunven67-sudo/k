import * as THREE from 'three';
import { ROOMS, H, WINDOWS } from './layout.js';
import { mesh, cyl, box } from './build.js';
import { paint } from './materials.js';

// Sun + sky that follow your REAL clock, and every ceiling light in the house (with switches).
export function buildLighting(ctx, house) {
  const { scene } = ctx;
  const L = { rooms: {}, sunDir: new THREE.Vector3() };

  // Sun: the windows face -z (south), so daylight pours in through them.
  const sun = new THREE.DirectionalLight(0xfff1dd, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.target.position.set(4, 0, 2.5);
  scene.add(sun, sun.target);
  L.sun = sun;

  // Soft skylight coming through each window (area light facing into the room).
  L.skyLights = [];
  for (const win of Object.values(WINDOWS)) {
    const w = win.x1 - win.x0, h = win.y1 - win.y0;
    const a = new THREE.RectAreaLight(0xbfd6ff, 0, w, h);
    const outward = win.wall === 'N' ? -1 : 1;
    const z = (win.wall === 'N' ? 0 : 6.4) - outward * 0.02;
    a.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, z);
    a.lookAt(a.position.x, a.position.y, z - outward);
    scene.add(a);
    L.skyLights.push({ light: a, win, area: w * h });
  }

  // Very low ambient so nothing is ever pitch black (light bouncing around).
  L.hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3229, 0.05);
  scene.add(L.hemi);

  // Ceiling lights (one per room, two in the hallway). Real bulbs: warm white ~800 lumens.
  const fixtureMat = paint(0xf7f6f2, 0.5);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 0, roughness: 0.3 });
  const spots = {
    bedroom: [[2.7, 2.5]], hallway: [[6.17, 1.5], [6.17, 4.8]], kitchen: [[8.6, 1.6]], bathroom: [[8.1, 5.0]],
  };
  for (const [room, list] of Object.entries(spots)) {
    const r = { on: room === 'hallway' ? false : false, lights: [], glows: [], key: room };
    for (const [x, z] of list) {
      const l = new THREE.SpotLight(0xffe6c7, 0, 12, 1.35, 0.95, 2);
      l.position.set(x, H - 0.08, z);
      l.target.position.set(x, 0, z + 0.001);
      l.castShadow = room === 'bedroom' || room === 'kitchen';
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0006; l.shadow.normalBias = 0.03; l.shadow.radius = 4;
      l.shadow.camera.near = 0.1; l.shadow.camera.far = 8;
      scene.add(l, l.target);
      // the bedroom has a ceiling fan with its own light kit; others get a flush dome light
      if (room !== 'bedroom' && !(room === 'kitchen')) {
        const dome = mesh(new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glowMat, { cast: false, parent: scene });
        dome.position.set(x, H - 0.005, z); dome.scale.y = 0.45;
        mesh(cyl(0.18, 0.18, 0.012, 32), fixtureMat, { pos: [x, H - 0.006, z], parent: scene, cast: false });
        r.glows.push(dome);
      }
      // a dim omni fill so the ceiling + walls above the light aren't black
      const fill = new THREE.PointLight(0xffe6c7, 0, 7, 2);
      fill.position.set(x, H - 0.35, z);
      scene.add(fill);
      r.lights.push({ spot: l, fill });
    }
    L.rooms[room] = r;
  }
  L.glowMat = glowMat;

  L.setRoom = (room, on) => {
    const r = L.rooms[room];
    r.on = on;
    for (const { spot, fill } of r.lights) { spot.intensity = on ? 95 : 0; fill.intensity = on ? 7 : 0; }
    for (const g of r.glows) g.material.emissiveIntensity = on ? 4 : 0;
    if (r.onChange) r.onChange(on);
    ctx.envDirty = true;
  };

  // Light switches next to each doorway.
  const plateMat = paint(0xf8f8f6, 0.45);
  const rockerMat = paint(0xf2f2f0, 0.35);
  const switches = [
    { room: 'bedroom', pos: [5.4 - 0.004, 1.2, 3.55], face: -1, axis: 'x' },
    { room: 'hallway', pos: [5.52 + 0.004, 1.2, 3.55], face: 1, axis: 'x' },
    { room: 'kitchen', pos: [6.94 + 0.004, 1.2, 2.25], face: 1, axis: 'x' },
    { room: 'bathroom', pos: [6.94 + 0.004, 1.2, 4.35], face: 1, axis: 'x' },
  ];
  for (const s of switches) {
    const g = new THREE.Group();
    g.position.set(...s.pos);
    g.rotation.y = s.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    mesh(box(0.072, 0.115, 0.008, 0.002), plateMat, { parent: g, pos: [0, 0, 0.004], cast: false });
    const rocker = mesh(box(0.032, 0.062, 0.012, 0.003), rockerMat, { parent: g, pos: [0, 0, 0.012], cast: false });
    scene.add(g);
    const set = (on) => { rocker.rotation.x = on ? -0.12 : 0.12; };
    set(L.rooms[s.room].on);
    const prev = L.rooms[s.room].onChange;
    L.rooms[s.room].onChange = (on) => { set(on); prev?.(on); };
    ctx.interact.add(g, {
      label: () => L.rooms[s.room].on ? 'Lights off' : 'Lights on', range: 2.0,
      use: () => { L.setRoom(s.room, !L.rooms[s.room].on); ctx.audio.play(L.rooms[s.room].on ? 'switch_on.ogg' : 'switch_off.ogg', { pos: g.position, vol: 0.5 }); },
    });
  }

  // ---- real time of day -------------------------------------------------------
  // Rough solar position for ~40°N using your local clock + date. Good enough for a window.
  L.solar = (date) => {
    const day = (date - new Date(date.getFullYear(), 0, 0)) / 864e5;
    const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (day + 10)) * Math.PI / 180;
    const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    const ha = (hours - 12.5) * 15 * Math.PI / 180;
    const lat = 40 * Math.PI / 180;
    const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    const alt = Math.asin(sinAlt);
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)); // 0 = south
    return { alt, az };
  };

  L.update = (date, house) => {
    const { alt, az } = L.solar(date);
    const day = THREE.MathUtils.smoothstep(alt, -0.1, 0.12); // 0 night .. 1 day (civil twilight blend)
    L.daylight = day;
    // south is -z, west is -x... az > 0 = afternoon (west)
    const dir = L.sunDir.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();
    sun.position.copy(sun.target.position).addScaledVector(dir, 25);
    const sunUp = THREE.MathUtils.smoothstep(alt, 0.0, 0.2);
    const warm = 1 - THREE.MathUtils.smoothstep(alt, 0.05, 0.5);
    sun.color.setRGB(1, 0.93 - warm * 0.25, 0.85 - warm * 0.45);
    sun.intensity = sunUp * 55;
    sun.visible = sunUp > 0.001;
    let blindsOpen = 1;
    const bw = house.windows.bedroom.blinds;
    if (bw) blindsOpen = bw.openness();
    for (const s of L.skyLights) {
      const ob = s.win.room === 'bedroom' ? (0.18 + 0.82 * blindsOpen) : s.win.room === 'kitchen' ? 0.9 : 0.6;
      s.light.intensity = (day * 38 + 0.25) * ob;
      s.light.color.setRGB(0.75 + 0.25 * day, 0.82 + 0.12 * day, 1);
    }
    L.hemi.intensity = 0.02 + day * 0.08;
    house.sky.mat.uniforms.mixv.value = 1 - day;
    house.sky.mat.uniforms.gain.value = 0.9 + day * 0.9;
  };

  return L;
}
