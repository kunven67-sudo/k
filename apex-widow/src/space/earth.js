// EARTH: you're too big for New Halvern, so now you stand on the real planet (units: km). Real continents, oceans,
// clouds at your knees, city lights on the night side. The world's big cities (real places, made-up names) are food,
// storms give you electric silk, volcanoes fire, the ice shelves frost. Every army on Earth fires at you: nukes, and
// Voss's own laser satellite. The rich launch rockets for Mars. Grow enough and you bite the ground itself, crater
// by crater, until there is no Earth left. Then the Moon.
import * as THREE from 'three';
import { SpaceZone, massOf } from './spacezone.js';
import { makeEarth, makePlanet, makeStarSky, makeStarPoints, makeSun } from './planets.js';
import { rand, pick, clamp, sizeText } from '../core/util.js';

export const R_E = 6371;
const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
// lat/lon -> direction on the unit sphere (matches the texture on three's SphereGeometry)
export function llDir(lat, lon) { const phi = (lon + 180) * Math.PI / 180, th = (90 - lat) * Math.PI / 180; return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)); }
export const HALVERN_LL = [41.28, -72.9];

// the world's biggest cities (real places, made-up names): name, lat, lon, size of the city (km), people (millions)
const CITIES = [
  ['Port Auren', 35.68, 139.69, 95, 37], ['Delvara', 28.61, 77.21, 75, 32], ['Shanlu', 31.23, 121.47, 80, 29], ['Sao Varo', -23.55, -46.63, 70, 22],
  ['Merin', 19.43, -99.13, 65, 22], ['Kairun', 30.04, 31.24, 55, 21], ['Bhamra', 19.08, 72.88, 60, 21], ['Beihai', 39.9, 116.4, 70, 21],
  ['Dhakir', 23.81, 90.41, 45, 22], ['Lagosa', 6.52, 3.38, 55, 15], ['Manovar', 14.6, 120.98, 50, 14], ['Istrava', 41.01, 28.98, 55, 16],
  ['Buenaterra', -34.6, -58.38, 60, 15], ['Kolvana', 22.57, 88.36, 45, 15], ['Rio Caldo', -22.91, -43.17, 45, 13], ['Loma Vista', 34.05, -118.24, 85, 13],
  ['Moskara', 55.76, 37.62, 55, 12], ['Paresse', 48.86, 2.35, 50, 11], ['Londral', 51.51, -0.13, 55, 9], ['Jakorta', -6.21, 106.85, 60, 11],
  ['Seolan', 37.57, 126.98, 55, 10], ['Lakeport', 41.88, -87.63, 55, 9], ['Bangara', 13.76, 100.5, 50, 11], ['Tehvar', 35.69, 51.39, 45, 9],
  ['Kinsara', -4.44, 15.27, 40, 15], ['Limara', -12.05, -77.04, 40, 11], ['Sydra', -33.87, 151.21, 50, 5], ['Johanna', -26.2, 28.05, 45, 6],
  ['Torvale', 43.65, -79.38, 40, 6], ['Madrena', 40.42, -3.7, 35, 7], ['Kingsbay', 40.71, -74.0, 60, 19], ['Bayhaven', 42.36, -71.06, 40, 5],
];
const VOLCANOES = [['Yellowstone caldera', 44.43, -110.59, 70], ['Kilauea', 19.42, -155.29, 40], ['Etna', 37.75, 14.99, 35], ['Krakatoa', -6.1, 105.42, 30], ['Mount Fuji', 35.36, 138.73, 30], ['Popocatepetl', 19.02, -98.62, 30], ['Eyjafjallajokull', 63.63, -19.62, 30]];
const ICE = [['Ross Ice Shelf', -81.5, -175, 800], ['Ronne Ice Shelf', -78.5, -61, 600], ['Larsen Ice Shelf', -67.5, -62, 300], ['Greenland ice sheet', 72, -40, 900]];
// real landmarks at real size (km): tiny next to you, but you can still find them and eat them
const LANDMARKS = [
  { id: 'eiffel', name: 'Eiffel Tower', ll: [48.858, 2.294], h: 0.33, fact: '10,100 tonnes of iron. Crunchy.' },
  { id: 'liberty', name: 'Statue of Liberty', ll: [40.689, -74.044], h: 0.093, fact: 'Copper. Gone green from the rain.' },
  { id: 'pyramids', name: 'Pyramids of Giza', ll: [29.979, 31.134], h: 0.139, fact: '4,500 years old. 2.3 million stone blocks each.' },
  { id: 'bigben', name: 'Big Ben', ll: [51.5007, -0.1246], h: 0.096, fact: 'The bell kept ringing all the way down.' },
  { id: 'burj', name: 'Burj Khalifa', ll: [25.197, 55.274], h: 0.828, fact: 'The tallest building on Earth. Was.' },
  { id: 'goldengate', name: 'Golden Gate Bridge', ll: [37.8199, -122.4783], h: 0.227, fact: 'International orange. 2.7 km of steel cable.' },
  { id: 'opera', name: 'Sydney Opera House', ll: [-33.857, 151.215], h: 0.065, fact: 'A million roof tiles. They sound nice when they crack.' },
  { id: 'titanic', name: 'Titanic wreck', ll: [41.726, -49.948], h: 0.05, fact: '3,800 m down. Tastes like rust and 1912.' },
  { id: 'redeemer', name: 'Christ the Redeemer', ll: [-22.952, -43.211], h: 0.038, fact: 'Stood on that mountain for 90 years.' },
];

const DEFS = {
  earth: { kind: 'earth', name: 'Earth', latin: 'third planet from the Sun', fact: 'Home to 8 billion people. Was.', passive: true, chunk: true, walk: true, label: true, color: 0x6aa0ff, glow: 0.9, minEater: 18000, g: 1 },
  moon: { kind: 'moon', name: 'The Moon', latin: 'Luna', fact: 'Holds the tides. Tastes like dust.', passive: true, chunk: true, walk: true, label: true, color: 0xd8d8d0, glow: 0.8, g: 0.165, minEater: 18000 },
  city: { kind: 'city', name: 'City', passive: true, chunk: true, disc: true, label: true, color: 0xffc890, glow: 0.7, fact: 'Every light goes out, block by block, as you eat it.' },
  hurricane: { kind: 'hurricane', name: 'Hurricane', latin: 'category 5', fact: 'Lightning in your mouth. Your webs crackle now.', passive: true, chunk: true, disc: true, label: true, color: 0xe8eef8, glow: 0.6 },
  volcano: { kind: 'volcano', name: 'Volcano', fact: 'You drank the magma chamber. Your veins glow.', passive: true, chunk: true, disc: true, label: true, color: 0xff6a20, glow: 0.9 },
  iceshelf: { kind: 'iceshelf', name: 'Ice shelf', latin: 'Antarctica', fact: 'A trillion tonnes of ice. Your blood runs cold now.', passive: true, chunk: true, disc: true, label: true, color: 0xdaf0ff, glow: 0.7 },
  nuke: { kind: 'nuke', name: 'Nuclear missile', latin: 'ICBM, 1.2 megatons', fact: 'Caught one before it went off. Radioactive venom.', passive: true, color: 0xff3020, glow: 1.2, label: true },
  vossorbital: { kind: 'vossorbital', name: 'VOSS-1', latin: 'Voss\'s laser satellite', fact: 'Voss built a space laser to bring you home. Crunchy solar panels.', passive: false, label: true, color: 0xff2a1f, glow: 1.0, hp: 600 },
  station: { kind: 'station', name: 'Space station', latin: '7 astronauts (evacuated)', fact: 'Freeze-dried ice cream in the pantry.', passive: true, label: true, color: 0xffffff, glow: 0.6 },
  rocket: { kind: 'rocket', name: 'Escape rocket', latin: 'billionaires, bound for Mars', fact: 'They paid 40 million each for a seat. You paid nothing.', passive: true, label: true, color: 0xffe0a0, glow: 1.0 },
  whale: { kind: 'whale', name: 'Blue whale', latin: 'Balaenoptera musculus', fact: 'The biggest animal that ever lived. Before you.', passive: true, label: true, color: 0x8ab0d0, glow: 0.4 },
  landmark: { kind: 'landmark', name: 'Landmark', passive: true, label: true, color: 0xffe8c0, glow: 0.5 },
};

// ------------------------------------------------------------------ shapes + textures
// a piece of sphere (a "cap") lying on the planet, in the Body's own units (Body.L = 1). Polar UVs: the middle of the
// texture is the middle of the cap. Bends with the planet, so big ones (ice shelves, storms) hug the ground.
function capGeo(Lkm, Rsph, seg = 56, rings = 10) {
  const r = Rsph / Lkm, a = Math.min(Math.PI * 0.9, (Lkm * 0.5) / Rsph);
  const g = new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, 0, a);
  g.translate(0, -r, 0);
  const P = g.attributes.position, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i) + r, z = P.getZ(i);
    const th = Math.acos(clamp(y / r, -1, 1)), ph = Math.atan2(z, x), k = th / a * 0.5;
    U.setXY(i, 0.5 + Math.cos(ph) * k, 0.5 + Math.sin(ph) * k);
  }
  return g;
}
let TEX = null;
function canvasTex(N, draw, srgb = true) { const c = document.createElement('canvas'); c.width = c.height = N; draw(c.getContext('2d'), N); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function texs() {
  if (TEX) return TEX;
  const blobMask = (x, N, edge = 0.18) => {
    // irregular round edge (no perfect circles on a real planet)
    x.globalCompositeOperation = 'destination-in'; x.beginPath();
    const R = N / 2;
    for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; const r = R * (0.84 + 0.1 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2) + 0.03 * Math.sin(a * 13)); if (i === 0) x.moveTo(R + Math.cos(a) * r, R + Math.sin(a) * r); else x.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r); }
    x.closePath(); x.filter = `blur(${N * edge * 0.12}px)`; x.fill(); x.filter = 'none'; x.globalCompositeOperation = 'source-over';
  };
  // a city seen from the sky: districts with their own street grids, a few highways cutting through, a ring road,
  // parks, a river. Day = grey-brown blocks, night = the same streets drawn in orange light.
  const cityPair = (seed) => {
    let sd = seed * 9301 + 49297; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const N = 512, R = N / 2;
    const roads = [], blocks = [], parks = [];
    // districts: each a patch with its own grid angle + block size
    for (let d = 0; d < 9; d++) {
      const a = rnd() * 6.28, r = Math.sqrt(rnd()) * R * 0.75, cx = R + Math.cos(a) * r, cy = R + Math.sin(a) * r;
      const rad = R * (0.25 + rnd() * 0.3), ang = rnd() * Math.PI, step = 5 + rnd() * 6;
      blocks.push({ cx, cy, rad, ang, step });
    }
    for (let k = 0; k < 5; k++) { const a = rnd() * 6.28, r = rnd() * R * 0.8; parks.push([R + Math.cos(a) * r, R + Math.sin(a) * r, 6 + rnd() * 16]); }
    // highways: long wobbly lines through the middle + a ring road
    for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI; const pts = []; for (let i = -6; i <= 6; i++) { const t = i / 6 * R * 1.05; pts.push([R + Math.cos(a) * t + Math.sin(a) * (rnd() - 0.5) * 22, R + Math.sin(a) * t - Math.cos(a) * (rnd() - 0.5) * 22]); } roads.push(pts); }
    const ring = []; const rr = R * (0.45 + rnd() * 0.15); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.28; const k = rr * (1 + 0.12 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7)); ring.push([R + Math.cos(a) * k, R + Math.sin(a) * k]); } roads.push(ring);
    const river = []; { const a = rnd() * Math.PI; let ox = 0; for (let i = -8; i <= 8; i++) { ox += (rnd() - 0.5) * 18; const t = i / 8 * R * 1.1; river.push([R + Math.cos(a) * t - Math.sin(a) * ox, R + Math.sin(a) * t + Math.cos(a) * ox]); } }
    const dens = (x, y) => Math.max(0, 1 - Math.hypot(x - R, y - R) / R);
    const line = (x, pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'round'; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); };
    const grid = (x, dayMode) => {
      for (const b of blocks) {
        const ca = Math.cos(b.ang), sa = Math.sin(b.ang), n = Math.ceil(b.rad / b.step);
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
          const u = i * b.step, v = j * b.step; if (u * u + v * v > b.rad * b.rad) continue;
          const px = b.cx + u * ca - v * sa, py = b.cy + u * sa + v * ca; const de = dens(px, py); if (de <= 0 || rnd() > 0.35 + de) continue;
          if (dayMode) { const g = 92 + rnd() * 70 * (0.5 + de); x.fillStyle = `rgba(${g + 10},${g + 6},${g},${0.55 + de * 0.45})`; x.save(); x.translate(px, py); x.rotate(b.ang); x.fillRect(-b.step * 0.4, -b.step * 0.4, b.step * 0.8, b.step * 0.8); x.restore(); }
          else if (rnd() < 0.2 + de * 0.9) { x.fillStyle = `rgba(255,${160 + rnd() * 80},${80 + rnd() * 70},${0.25 + de * 0.75})`; x.save(); x.translate(px, py); x.rotate(b.ang); x.fillRect(-b.step * 0.5, -b.step * 0.5, b.step, 1.1); x.fillRect(-b.step * 0.5, -b.step * 0.5, 1.1, b.step); x.restore(); }
        }
      }
    };
    const day = canvasTex(N, (x) => {
      x.fillStyle = 'rgba(105,98,88,0.85)'; x.beginPath(); x.arc(R, R, R * 0.92, 0, 7); x.fill();
      grid(x, true);
      for (const [px, py, r] of parks) { x.fillStyle = 'rgba(70,96,52,0.9)'; x.beginPath(); x.ellipse(px, py, r, r * 0.6, rnd() * 3, 0, 7); x.fill(); }
      line(x, river, 6, 'rgba(38,58,72,1)');
      for (const pts of roads) line(x, pts, 2.2, 'rgba(52,50,48,0.95)');
      blobMask(x, N);
    });
    const night = canvasTex(N, (x) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
      grid(x, false);
      for (const pts of roads) { line(x, pts, 2.4, 'rgba(255,205,130,0.85)'); line(x, pts, 0.9, 'rgba(255,245,220,0.9)'); }
      const g = x.createRadialGradient(R, R, 0, R, R, R * 0.6); g.addColorStop(0, 'rgba(255,200,140,0.35)'); g.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
      blobMask(x, N);
    });
    return { day, night };
  };
  const cities = [1, 2, 3, 4, 5].map(cityPair);
  const storm = canvasTex(512, (x, N) => {
    const R = N / 2;
    for (let i = 0; i < 3200; i++) {
      const t = Math.random(), arm = Math.floor(Math.random() * 3);
      const r = (0.07 + t * 0.92) * R, a = arm * 2.09 + t * 7.5 + (Math.random() - 0.5) * 0.9;
      const px = R + Math.cos(a) * r, py = R + Math.sin(a) * r;
      const g = x.createRadialGradient(px, py, 0, px, py, 8 + 22 * (1 - t));
      g.addColorStop(0, `rgba(255,255,255,${0.32 * (1 - t * 0.6)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(px - 30, py - 30, 60, 60);
    }
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(R, R, R * 0.055, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over'; // the eye
  });
  const ice = canvasTex(512, (x, N) => {
    x.fillStyle = 'rgb(226,240,250)'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 140; i++) { x.strokeStyle = `rgba(120,160,190,${0.15 + Math.random() * 0.3})`; x.lineWidth = 0.6 + Math.random() * 1.6; x.beginPath(); let px = Math.random() * N, py = Math.random() * N; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rand(-40, 40); py += rand(-12, 12); x.lineTo(px, py); } x.stroke(); }
    blobMask(x, N, 0.3);
  });
  const glow = canvasTex(128, (x, N) => { const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(0.2, 'rgba(255,100,20,0.95)'); g.addColorStop(0.55, 'rgba(130,25,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N); });
  const craterA = canvasTex(256, (x, N) => {
    const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(22,12,8,1)'); g.addColorStop(0.5, 'rgba(48,28,18,1)'); g.addColorStop(0.72, 'rgba(95,72,55,0.85)'); g.addColorStop(1, 'rgba(95,72,55,0)');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, r = 40 + Math.random() * 70; x.strokeStyle = 'rgba(10,5,2,0.45)'; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.moveTo(N / 2, N / 2); x.lineTo(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r); x.stroke(); }
  });
  const craterE = canvasTex(256, (x, N) => {
    const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,130,40,1)'); g.addColorStop(0.3, 'rgba(170,45,8,0.85)'); g.addColorStop(0.55, 'rgba(30,6,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, r = 30 + Math.random() * 50; x.strokeStyle = 'rgba(255,90,20,0.4)'; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.moveTo(N / 2, N / 2); x.lineTo(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r); x.stroke(); }
  });
  TEX = { cities, storm, ice, glow, craterA, craterE };
  return TEX;
}

// tiny models of the landmarks (real proportions; the Body scale = their real height in km)
function landmarkModel(id) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1, ...o });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch (id) {
    case 'eiffel': { const m = M(0x6b4a32, { metalness: 0.5 }); add(new THREE.CylinderGeometry(0.02, 0.32, 0.55, 4, 1, true), m, 0, 0.275).rotation.y = Math.PI / 4; add(new THREE.CylinderGeometry(0.004, 0.07, 0.45, 4), m, 0, 0.77).rotation.y = Math.PI / 4; add(new THREE.BoxGeometry(0.36, 0.02, 0.36), m, 0, 0.18); add(new THREE.BoxGeometry(0.16, 0.015, 0.16), m, 0, 0.38); break; }
    case 'liberty': { add(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(0x9a8f7c), 0, 0.25); add(new THREE.CylinderGeometry(0.08, 0.12, 0.42, 8), M(0x6fb39a), 0, 0.71); add(new THREE.SphereGeometry(0.06, 8, 6), M(0x6fb39a), 0, 0.96); add(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), M(0x6fb39a), 0.07, 1.0); break; }
    case 'pyramids': { const m = M(0xc9a66b, { roughness: 0.95 }); for (const [x, z, s] of [[0, 0, 1], [-0.9, -0.7, 0.95], [-1.6, -1.6, 0.48]]) { const p = add(new THREE.ConeGeometry(0.8 * s, s, 4), m, x, s / 2, z); p.rotation.y = Math.PI / 4; } break; }
    case 'bigben': { const m = M(0xb59c6e); add(new THREE.BoxGeometry(0.16, 0.75, 0.16), m, 0, 0.375); add(new THREE.ConeGeometry(0.12, 0.25, 4), M(0x5c5040), 0, 0.875).rotation.y = Math.PI / 4; add(new THREE.BoxGeometry(0.17, 0.12, 0.17), M(0xe8dcb0, { emissive: 0x605020 }), 0, 0.62); add(new THREE.BoxGeometry(1.4, 0.25, 0.2), m, 0.75, 0.125, 0); break; }
    case 'burj': { const m = M(0xa8b8c8, { metalness: 0.8, roughness: 0.2 }); let y = 0; for (let i = 0; i < 6; i++) { const h = 0.17 - i * 0.012, r = 0.09 - i * 0.013; add(new THREE.CylinderGeometry(r * 0.85, r, h, 6), m, 0, y + h / 2); y += h; } add(new THREE.CylinderGeometry(0.003, 0.012, 0.18, 6), m, 0, y + 0.09); break; }
    case 'goldengate': { const m = M(0xc0362c); for (const x of [-1.6, 1.6]) add(new THREE.BoxGeometry(0.08, 1, 0.12), m, x, 0.5); add(new THREE.BoxGeometry(5.6, 0.04, 0.12), m, 0, 0.3); for (let i = 0; i < 24; i++) { const x = -2.8 + i * 5.6 / 23, ax = Math.abs(x); const y = ax < 1.6 ? 0.3 + 0.62 * (ax / 1.6) * (ax / 1.6) : 0.92 - (ax - 1.6) * 0.5; add(new THREE.BoxGeometry(0.25, 0.015, 0.02), m, x, Math.min(1, y)); } break; }
    case 'opera': { const m = M(0xf2efe6, { roughness: 0.4 }); for (let i = 0; i < 4; i++) { const s = add(new THREE.SphereGeometry(0.5 - i * 0.07, 10, 6, 0, Math.PI, 0, Math.PI / 2), m, i * 0.35, 0, 0); s.rotation.set(0, Math.PI / 2, -0.5); } add(new THREE.BoxGeometry(1.8, 0.12, 0.9), M(0xb09070), 0.4, 0.06, 0); break; }
    case 'titanic': { const m = M(0x3a2a22, { roughness: 1 }); add(new THREE.BoxGeometry(0.9, 0.3, 0.2), m, 0, 0.15); add(new THREE.BoxGeometry(0.7, 0.25, 0.18), m, 0.9, 0.12).rotation.z = 0.25; for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), M(0x2a1a12), -0.3 + i * 0.25, 0.4); break; }
    case 'redeemer': { const m = M(0xe8e4d8); add(new THREE.CylinderGeometry(0.1, 0.16, 0.7, 8), m, 0, 0.35); add(new THREE.BoxGeometry(0.9, 0.09, 0.09), m, 0, 0.62); add(new THREE.SphereGeometry(0.07, 8, 6), m, 0, 0.78); add(new THREE.CylinderGeometry(0.6, 1.2, 0.6, 10), M(0x4a6a38, { roughness: 1 }), 0, -0.3); break; }
  }
  return g;
}
function rocketModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.6, roughness: 0.3 }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12), body.material); nose.position.y = 0.5;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.5, 1.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI; flame.position.y = -0.62;
  g.add(body, nose, flame); g.userData.flame = flame;
  return g;
}
function whaleModel() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x5a7690, roughness: 0.5 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8), m); b.scale.set(0.22, 0.14, 1); g.add(b);
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 3), m); t.rotation.set(-Math.PI / 2, 0, Math.PI / 2); t.scale.set(1, 1, 0.2); t.position.z = -0.55; g.add(t);
  return g;
}

export class EarthZone extends SpaceZone {
  constructor(game) {
    super(game, 'earth', 'Earth', 1000);
    this.cruise = 300; this.aimBL = 60000; this.zipBL = 60000; this.growMul = 1.3;
    this.fill = 0.45; this.nukeT = 45; this.laserT = 35; this.rocketT = 20; this.craters = []; this.scaleE = 1;
  }
  rimAmount() { return 0.26; }
  async build() {
    const G = this.game, S = this.scene, hud = G.hud;
    const T = texs();
    hud.loading('The whole planet', 0.2);
    this.baseScene({ ambient: 0.012, glow: 0x2f5fa8 });
    // the sun: the real light + a real-looking sun in the sky. It starts just below New Halvern's horizon: dawn.
    this.sunDir = llDir(...HALVERN_LL).applyAxisAngle(Y, 1.66).normalize();
    this.sunL = new THREE.DirectionalLight(0xfff4e6, 3.4); S.add(this.sunL); S.add(this.sunL.target);
    this.sunL.castShadow = true; this.sunL.shadow.mapSize.set(2048, 2048); this.sunL.shadow.bias = -0.0004; this.sunL.shadow.normalBias = 0.02;
    this.sunVis = await makeSun(4625, { glow: 1.0 }); S.add(this.sunVis.group);
    S.add(await makeStarSky(1000, 0.4)); S.add(makeStarPoints(6000, 1));
    // the Earth itself (a Body: you stand on it, and once you're big enough you eat it)
    hud.loading('Continents, oceans, clouds', 0.4);
    this.earthGfx = await makeEarth(0.5, { segments: 512, detail: true, cloudH: 0.00045, atmoH: 0.022 }); // low clouds: at your knees
    this.earth = this.bodies.add(DEFS.earth, new THREE.Vector3(), R_E * 2, { mesh: this.earthGfx.group, spin: 0, hp: 1e9 });
    this.earth.mass = massOf(R_E * 2 * 1000, 1);
    this.earth.onBite = (mass, p) => this.addCrater(p.pos.clone().normalize(), Math.max(4, p.s * 1.4), true);
    // the Moon
    const moonG = await makePlanet('moon', 0.5);
    this.moon = this.bodies.add(DEFS.moon, new THREE.Vector3(384400, 0, 0), 3474.8, { mesh: moonG.group, spin: 0, orbit: { center: new THREE.Vector3(), r: 384400, w: Math.PI * 2 / 7200, a: 2.2, tilt: 0.09 } });
    this.moon.gfx = moonG;
    // cities
    hud.loading('8 billion people', 0.6);
    const lift = 0.15; // the planet mesh is made of flat triangles, so decals float a hair above the true surface
    for (const [name, lat, lon, km, pop] of CITIES) {
      const d = llDir(lat, lon);
      const ct = T.cities[Math.floor(Math.random() * T.cities.length)];
      const mat = new THREE.MeshStandardMaterial({ map: ct.day, emissiveMap: ct.night, emissive: 0xffc890, emissiveIntensity: 0, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0 });
      const m = new THREE.Mesh(capGeo(km, R_E), mat); m.rotation.y = Math.random() * 6.28; m.receiveShadow = true;
      const c = this.bodies.add({ ...DEFS.city, name, latin: pop + ' million people' }, d.clone().multiplyScalar(R_E + lift), km, { mesh: m, spin: 0 });
      c.root.quaternion.setFromUnitVectors(Y, d); c.dir = d; c.mat = mat; c.up.copy(d);
      c.mass = 300 * Math.PI * (km * 500) ** 2 * 50; // 50 m of buildings on average
      c.lift = lift;
    }
    // storms over the warm oceans (the eye, the spiral arms, lightning)
    const stormNames = ['Hurricane Vera', 'Typhoon Hagen', 'Cyclone Imara'];
    [[18, -55, 700], [16, 140, 800], [-15, 75, 600]].forEach(([lat, lon, km], i) => {
      const d = llDir(lat, lon);
      const mat = new THREE.MeshStandardMaterial({ map: T.storm, transparent: true, depthWrite: false, roughness: 1, emissive: 0x9ab0ff, emissiveIntensity: 0, emissiveMap: T.storm, envMapIntensity: 0 });
      const m = new THREE.Mesh(capGeo(km, R_E + 11), mat);
      const h = this.bodies.add({ ...DEFS.hurricane, name: stormNames[i] }, d.clone().multiplyScalar(R_E + 11), km, { mesh: m, spin: 0 });
      h.root.quaternion.setFromUnitVectors(Y, d); h.dir = d; h.up.copy(d); h.mat = mat; h.mass = 6e13; h.ll = [lat, lon]; h.cap = m;
      h.update0 = (b, dt) => {
        b.cap.rotation.y += dt * 0.22 * Math.sign(b.ll[0] || 1);
        b.ll[1] -= dt * 0.015; b.ll[0] += dt * 0.003 * Math.sign(b.ll[0]);
        b.dir = llDir(b.ll[0], b.ll[1]); b.up.copy(b.dir); b.pos.copy(b.dir).multiplyScalar(R_E * this.scaleE + 11); b.root.quaternion.setFromUnitVectors(Y, b.dir);
        b.mat.emissiveIntensity = Math.random() < 0.05 ? 2.5 + Math.random() * 3 : b.mat.emissiveIntensity * 0.8; // lightning in the clouds
      };
    });
    // volcanoes (glowing) + ice shelves
    for (const [name, lat, lon, km] of VOLCANOES) {
      const d = llDir(lat, lon);
      const m = new THREE.Mesh(capGeo(km, R_E), new THREE.MeshBasicMaterial({ map: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(3.2, 3.2, 3.2), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      const v = this.bodies.add({ ...DEFS.volcano, name, latin: 'active volcano' }, d.clone().multiplyScalar(R_E + lift), km, { mesh: m, spin: 0 });
      v.root.quaternion.setFromUnitVectors(Y, d); v.up.copy(d); v.dir = d; v.lift = lift; v.mass = 2700 * Math.PI * (km * 500) ** 2 * 1000 * 0.02;
      v.smokeT = rand(0, 2);
    }
    for (const [name, lat, lon, km] of ICE) {
      const d = llDir(lat, lon);
      const m = new THREE.Mesh(capGeo(km, R_E), new THREE.MeshStandardMaterial({ map: T.ice, roughness: 0.3, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0 }));
      m.receiveShadow = true;
      const b = this.bodies.add({ ...DEFS.iceshelf, name }, d.clone().multiplyScalar(R_E + lift), km, { mesh: m, spin: 0 });
      b.root.quaternion.setFromUnitVectors(Y, d); b.up.copy(d); b.dir = d; b.lift = lift; b.mass = 3e16 * (km / 800) ** 2;
    }
    // landmarks
    for (const L of LANDMARKS) {
      const d = llDir(...L.ll);
      const b = this.bodies.add({ ...DEFS.landmark, kind: L.id, name: L.name, fact: L.fact, latin: (L.h * 1000).toFixed(0) + ' m tall' }, d.clone().multiplyScalar(R_E), L.h, { mesh: landmarkModel(L.id), spin: 0 });
      b.root.quaternion.setFromUnitVectors(Y, d); b.root.rotateY(Math.random() * 6); b.up.copy(d); b.dir = d; b.lift = 0; b.mass = 150 * Math.pow(L.h * 1000, 3) * 0.02;
    }
    // blue whales out in the oceans
    for (const [lat, lon] of [[52, -30], [36, -40], [-40, 20], [-55, -100], [10, 160], [-30, 95]]) {
      const w = this.bodies.add(DEFS.whale, llDir(lat, lon).multiplyScalar(R_E), 0.03, { mesh: whaleModel(), spin: 0 });
      w.ll = [lat, lon]; w.head = rand(0, 6.28); w.mass = 150000;
      w.update0 = (b, dt) => {
        if (b.stuck > 0 || b.wrapped) return;
        b.head += dt * rand(-0.2, 0.2); b.ll[0] = clamp(b.ll[0] + Math.cos(b.head) * dt * 0.002, -70, 70); b.ll[1] += Math.sin(b.head) * dt * 0.002;
        const dd = llDir(b.ll[0], b.ll[1]); b.up.copy(dd); b.pos.copy(dd).multiplyScalar(R_E * this.scaleE - 0.004);
        b.root.quaternion.setFromUnitVectors(Y, dd); b.root.rotateY(b.head);
      };
    }
    // things in orbit: a space station + Voss's laser satellite + a haze of satellites (decoration)
    const pm = new THREE.MeshStandardMaterial({ color: 0x1a2a5a, metalness: 0.6, roughness: 0.3, emissive: 0x0a1020 }), wm = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5, roughness: 0.4 });
    const stG = new THREE.Group();
    stG.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.06), wm)); for (const sx of [-1, 1]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.9), pm); pnl.position.x = sx * 0.45; stG.add(pnl); }
    this.iss = this.bodies.add(DEFS.station, new THREE.Vector3(), 0.11, { mesh: stG, spin: 0, orbit: { center: new THREE.Vector3(), r: R_E + 420, w: Math.PI * 2 / 300, a: 1, tilt: 0.9 } });
    this.iss.mass = 4.2e5;
    const vG = new THREE.Group();
    vG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 })));
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a1f, emissiveIntensity: 2 })); lens.position.y = -0.28; vG.add(lens);
    for (const sx of [-1, 1]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.01, 0.25), pm); pnl.position.x = sx * 0.6; vG.add(pnl); }
    this.vossSat = this.bodies.add(DEFS.vossorbital, new THREE.Vector3(), 0.06, { mesh: vG, spin: 0, orbit: { center: new THREE.Vector3(), r: R_E + 2000, w: Math.PI * 2 / 900, a: 0, tilt: 0.7 }, hp: 600 });
    this.vossSat.lens = lens; this.vossSat.mass = 2e6;
    const N = 500, sp = new Float32Array(N * 3); this.satA = [];
    for (let i = 0; i < N; i++) this.satA.push({ r: R_E + (Math.random() < 0.85 ? rand(400, 2000) : 35786), a: rand(0, 6.28), w: rand(0.002, 0.02), tilt: rand(-1.2, 1.2), node: rand(0, 6.28) });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.sats = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false })); this.sats.frustumCulled = false; S.add(this.sats);
    // Voss's laser beam (always in the scene, scaled to nothing when it isn't firing)
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 1.2, 0.8), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beam.scale.setScalar(1e-9); this.beam.frustumCulled = false; S.add(this.beam);
    // craters + scars: a dark rim + a glowing middle
    this.craterMat = new THREE.MeshStandardMaterial({ map: T.craterA, emissiveMap: T.craterE, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, envMapIntensity: 0 });
    this.scarMat = new THREE.MeshStandardMaterial({ map: T.craterA, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, envMapIntensity: 0 });
    hud.loading('Done', 1);
  }
  enter(opts = {}) {
    const G = this.game, p = G.player;
    const d = llDir(...HALVERN_LL);
    p.pos.copy(d).multiplyScalar(R_E + p.s * 0.02); p.up.copy(d); p.mode = 'ground'; p.vel.set(0, 0, 0); p.rope = null; p.zipT = null;
    p.fwd.copy(Y).addScaledVector(d, -d.y).normalize();
    if (opts.lair) { p.pos.fromArray(opts.lair.pos); p.up.fromArray(opts.lair.up); }
    p.rig.initDone = false;
    G.cam.target.copy(p.pos); G.cam.frame.setFromUnitVectors(Y, p.up);
    if (!this.entered) {
      this.entered = true;
      this.addCrater(d, Math.max(14, p.s * 1.6), false); // where New Halvern was
      G.hud.feed('NEWS', 'New Halvern is gone. Specimen 8 is ' + sizeText(p.sizeM) + ' long and walking toward Kingsbay.', null, true);
      setTimeout(() => G.zone === this && G.hud.toast('Cities are food now (their names float over them). To fly: jump, then hold Space. Hold Shift to cruise.', 6), 4500);
    }
  }
  // a crater / scar on the planet (lives on the Earth model, so it shrinks with it)
  addCrater(dir, sizeKm, hot = true) {
    if (this.craters.length > 120) { const c = this.craters.shift(); c.geometry.dispose(); c.removeFromParent(); }
    const ang = Math.min(1.2, (sizeKm * 0.5) / (R_E * this.scaleE));
    const r0 = 0.5 * 1.000025;
    const g = new THREE.SphereGeometry(r0, 40, 6, 0, Math.PI * 2, 0, ang);
    const P = g.attributes.position, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const th = Math.acos(clamp(y / r0, -1, 1)), ph = Math.atan2(z, x), k = th / ang * 0.5; U.setXY(i, 0.5 + Math.cos(ph) * k, 0.5 + Math.sin(ph) * k); }
    const m = new THREE.Mesh(g, hot ? this.craterMat : this.scarMat);
    m.quaternion.setFromUnitVectors(Y, dir); m.rotateY(Math.random() * 6.28);
    this.earth.model.root.add(m); this.craters.push(m);
  }
  outgrown(p) { return this.earth.state === 'eaten' || p.sizeM > 2.6e7; }
  objective(p) {
    if (this.earth.state === 'eaten') return 'The Earth is gone.';
    if (p.sizeM < DEFS.earth.minEater) return 'Eat the cities, storms and volcanoes. At ' + sizeText(DEFS.earth.minEater) + ' you can bite the planet itself.';
    return 'Eat the Earth. Bite the ground (E), again and again. The Moon is up there too.';
  }
  onEaten(b) {
    const G = this.game;
    if (b === this.earth) { G.hud.title('THE EARTH IS GONE', 'Nothing is holding the Moon now', 5); G.trophy('ate-earth', 'Ate the Earth'); G.stats.planets++; }
    else if (b.kind === 'city') { G.hud.feed('NEWS', b.def.name + ' has gone dark. ' + b.def.latin.replace(' people', '') + ' people.', null, true); G.stats.cities = (G.stats.cities || 0) + 1; this.addCrater(b.dir, b.L * 0.9, false); if (G.stats.cities === 1) G.trophy('first-city', 'Ate a whole city'); }
    else if (b === this.vossSat) { G.hud.toast('VOSS-1 is down. Somewhere, Voss is screaming.', 3); G.story.flags.vossSat = true; this.beam.scale.setScalar(1e-9); }
    else if (b === this.moon) { G.trophy('ate-moon', 'Ate the Moon'); G.stats.planets++; G.hud.title('THE MOON', 'Gone. The tides stop.', 4); }
    else if (b.kind === 'iceshelf' || b.kind === 'volcano') this.addCrater(b.dir, b.L * 0.6, b.kind === 'volcano');
  }
  update(dt, dtReal) {
    const G = this.game, p = G.player;
    super.update(dt, dtReal);
    this.scaleE = this.earth.state === 'eaten' ? 1 : this.earth.L / (R_E * 2);
    // the sun goes round (a day = 24 real minutes; the planet turns east, so the sun moves west)
    this.sunDir.applyAxisAngle(Y, -dt * Math.PI * 2 / 1440);
    const sun = this.sunDir;
    if (this.earth.state !== 'eaten') this.earthGfx.update(dt, sun, G.camera.position);
    if (this.moon.state !== 'eaten') this.moon.gfx.update(dt, sun);
    if (p) {
      // the light + its shadow box follow you
      const s = p.s;
      this.sunL.position.copy(p.pos).addScaledVector(sun, s * 40); this.sunL.target.position.copy(p.pos);
      const sc = this.sunL.shadow.camera; sc.left = sc.bottom = -s * 6; sc.right = sc.top = s * 6; sc.near = s * 2; sc.far = s * 90; sc.updateProjectionMatrix();
      this.sunVis.group.position.copy(G.camera.position).addScaledVector(sun, 1e6);
      this.aimEnv(sun, this.ground ? _v.copy(p.pos).sub(this.ground.pos) : p.up);
      this.sunVis.update(dt);
    }
    // things on the ground stay on it while it shrinks; city lights come on at night; volcanoes smoke
    const R = R_E * this.scaleE;
    for (const b of this.bodies.list) {
      if (b.lift !== undefined && b.dir) b.pos.copy(b.dir).multiplyScalar(R + b.lift);
      if (b.kind === 'city' && b.mat) { const nd = b.dir.dot(sun); b.mat.emissiveIntensity = clamp(-nd * 6 + 0.3, 0, 1.6) * 2.4; }
      if (b.kind === 'volcano' && p && b.pos.distanceTo(p.pos) < p.s * 60) { b.smokeT -= dt; if (b.smokeT <= 0) { b.smokeT = rand(0.15, 0.4); G.fx.add(b.pos, b.up.clone().multiplyScalar(rand(2, 5)).add(_v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1))), rand(4, 8), b.L * 0.12, [0.25, 0.22, 0.2, 0.5], { grow: b.L * 0.05, drag: 0.3 }); } }
    }
    // satellites
    const a = this.sats.geometry.attributes.position, k = this.scaleE;
    for (let i = 0; i < this.satA.length; i++) { const st = this.satA[i]; st.a += st.w * dt; const x = Math.cos(st.a) * st.r * k, y = Math.sin(st.a) * st.r * Math.sin(st.tilt) * k, z = Math.sin(st.a) * st.r * Math.cos(st.tilt) * k; a.setXYZ(i, x * Math.cos(st.node) - z * Math.sin(st.node), y, x * Math.sin(st.node) + z * Math.cos(st.node)); }
    a.needsUpdate = true;
    if (!p || G.state !== 'play') { this.beam.scale.setScalar(1e-9); return; }
    const ob = this.objective(p); if (ob !== this._obj) { this._obj = ob; G.hud.objective(ob); }
    // every army on Earth: nukes (they stop once you're too big to care)
    this.nukeT -= dt;
    if (this.nukeT <= 0 && p.sizeM < 3e6 && this.earth.state !== 'eaten') { this.nukeT = rand(40, 75); this.launchNukes(p, 1 + Math.floor(Math.random() * 3)); }
    for (const b of this.bodies.list) { if (b.kind === 'nuke') this.flyNuke(b, dt, p); else if (b.kind === 'rocket') this.flyRocket(b, dt, p); }
    // the rich leave for Mars
    this.rocketT -= dt;
    if (this.rocketT <= 0 && this.earth.state !== 'eaten') { this.rocketT = rand(35, 60); this.launchRocket(); }
    // Voss's laser
    this.updateLaser(dt, p);
  }
  launchNukes(p, n) {
    const G = this.game;
    const sites = this.bodies.list.filter(b => b.kind === 'city' && b.pos.distanceTo(p.pos) > 1500);
    for (let i = 0; i < n && sites.length; i++) {
      const city = pick(sites);
      const g = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xff5020, emissiveIntensity: 1 })); cone.rotation.x = Math.PI / 2; g.add(cone);
      const b = this.bodies.add(DEFS.nuke, city.pos.clone(), 0.03, { mesh: g, spin: 0 });
      b.from = city.pos.clone(); b.t = 0; b.dur = rand(18, 28); b.mass = 36000; b.target = p.pos.clone(); b.trailT = 0;
    }
    G.hud.feed('NEWS', n > 1 ? `${n} nuclear missiles are in the air. Target: Specimen 8.` : 'A nuclear missile has been launched at Specimen 8.', null, true);
    G.hud.toast('Nukes incoming. Web one out of the sky (right click) and eat it for radioactive venom, or run.', 4);
    G.audio.at && G.audio.at('missile', p.pos);
  }
  flyNuke(b, dt, p) {
    if (b.wrapped || b.stuck > 0 || b.state !== 'idle') return;
    b.t += dt / b.dur;
    if (b.t < 0.85) b.target.lerp(p.pos, Math.min(1, dt * 0.6)); // it steers at you
    const k = Math.min(1, b.t);
    const dir = _v.copy(b.from).normalize().lerp(_v2.copy(b.target).normalize(), k).normalize();
    const prev = b.pos.clone();
    b.pos.copy(dir).multiplyScalar(R_E * this.scaleE + Math.sin(k * Math.PI) * 1100 + 0.5);
    if (b.pos.distanceToSquared(prev) > 0) { b.root.position.copy(b.pos); b.root.lookAt(_v.copy(b.pos).sub(prev).add(b.pos)); }
    b.trailT -= dt; if (b.trailT <= 0) { b.trailT = 0.06; this.game.fx.add(b.pos, new THREE.Vector3(), 4, Math.max(3, p.s * 0.06), [0.9, 0.9, 0.95, 0.35], { grow: p.s * 0.08, drag: 0 }); }
    if (k >= 1) this.detonate(b.pos.clone(), p, b);
  }
  detonate(pos, p, b) {
    const G = this.game;
    const d = pos.distanceTo(p.pos), up = pos.clone().normalize();
    for (let i = 0; i < 46; i++) {
      const t = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)); t.addScaledVector(up, -t.dot(up)).normalize();
      G.fx.add(pos, t.multiplyScalar(rand(20, 60)).addScaledVector(up, rand(0, 25)), rand(1.5, 3.5), rand(8, 18), [1, rand(0.5, 0.8), 0.3, 0.9], { grow: 14, drag: 0.8 });
    }
    for (let i = 0; i < 18; i++) G.fx.add(pos.clone().addScaledVector(up, i * 3), up.clone().multiplyScalar(rand(8, 14)), rand(5, 9), 10 + i, [0.55, 0.42, 0.35, 0.55], { grow: 6, drag: 0.4 }); // the mushroom
    const flash = G.renderer.grade.uniforms.get('flash'); flash.value = d < p.s * 10 ? 0.7 : 0.2; setTimeout(() => { flash.value = 0; }, 180);
    G.audio.at && G.audio.at('explosion', pos); G.cam.addShake(d < p.s * 10 ? 1 : 0.3);
    if (d < Math.max(70, p.s * 6)) p.hurt(clamp(40 * 30000 / Math.max(p.sizeM, 1), 3, 45), 'nuked');
    this.addCrater(up, 28, true);
    if (b) b.remove();
  }
  launchRocket() {
    const d = llDir(28.57 + rand(-0.2, 0.2), -80.65);
    const b = this.bodies.add(DEFS.rocket, d.clone().multiplyScalar(R_E * this.scaleE + 0.05), 0.07, { mesh: rocketModel(), spin: 0 });
    b.dir = d; b.v = 0; b.t = 0; b.mass = 3e6; b.trailT = 0;
    b.root.quaternion.setFromUnitVectors(Y, d);
    this.game.hud.feed('NEWS', pick(['Another private rocket leaves Cape Canaveral for the Mars colony.', 'Billionaires are fleeing to Mars. Seats are selling for 40 million.', 'Launch from Florida: 90 passengers, one way to Mars.']), null, true);
  }
  flyRocket(b, dt) {
    const flame = b.model.root.userData.flame;
    if (b.wrapped || b.stuck > 0 || b.state !== 'idle') { if (flame) flame.visible = false; return; }
    b.t += dt; b.v = Math.min(11, b.v + dt * 0.6); // km/s
    // gravity turn: straight up, then tipping east
    const east = _v.copy(Y).cross(b.dir).normalize();
    const heading = b.dir.clone().lerp(east.add(_v2.copy(b.dir).multiplyScalar(0.3)).normalize(), clamp(b.t / 60, 0, 0.7)).normalize();
    b.pos.addScaledVector(heading, b.v * dt * 4);
    b.root.quaternion.setFromUnitVectors(Y, heading);
    b.trailT -= dt; if (b.trailT <= 0 && b.pos.length() < R_E * 1.2) { b.trailT = 0.1; this.game.fx.add(b.pos, new THREE.Vector3(), 6, 0.6 + b.t * 0.05, [0.9, 0.88, 0.85, 0.4], { grow: 0.4, drag: 0 }); }
    if (b.pos.length() > R_E * 30) { b.remove(); this.game.story.flags.rocketsEscaped = (this.game.story.flags.rocketsEscaped || 0) + 1; }
  }
  updateLaser(dt, p) {
    const S = this.vossSat;
    if (!S || !S.alive || S.stuck > 0 || S.wrapped || p.sizeM < 30000) { this.beam.scale.setScalar(1e-9); if (S && S.lens) S.lens.material.emissiveIntensity = 2; return; }
    this.laserT -= dt;
    const charge = this.laserT < 3 && this.laserT > 0;
    S.lens.material.emissiveIntensity = charge ? 2 + (3 - this.laserT) * 8 : 2;
    if (charge && !this.warned) { this.warned = true; this.game.hud.toast('Something in orbit is aiming at you. VOSS-1.', 2.5); }
    if (this.laserT > 0) { this.beam.scale.setScalar(1e-9); return; }
    if (this.laserT > -2.5) {
      const from = S.pos, to = p.pos, len = from.distanceTo(to);
      this.beam.position.copy(from).add(to).multiplyScalar(0.5); this.beam.quaternion.setFromUnitVectors(Y, _v.copy(to).sub(from).normalize());
      this.beam.scale.set(p.s * 0.05, len, p.s * 0.05);
      p.hurt(dt * 8, 'burned by Voss\'s space laser');
      if (Math.random() < dt * 8) this.game.fx.add(p.pos, new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(p.s), 0.4, p.s * 0.2, [1, 0.4, 0.2, 1], { drag: 2 });
      if (!this.toldLaser) { this.toldLaser = true; this.game.hud.toast('VOSS-1 is burning you from orbit. Zip up to it (aim + F) and eat it.', 4); }
    } else { this.laserT = rand(24, 34); this.warned = false; this.beam.scale.setScalar(1e-9); }
  }
  newsLines(p) {
    return ['Specimen 8 is walking across the continent. Every city in its path is being evacuated.', 'The President: "Every weapon we have."', 'The rich are boarding private rockets for Mars.', 'Dr. Elias Voss, on every channel: "It is mine. I can bring it home."', 'The clouds part around its legs. It is ' + sizeText(p.sizeM) + ' long.'];
  }
}
