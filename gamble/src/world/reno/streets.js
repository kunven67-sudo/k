// Streetscape: everything on the sidewalks and in the parking lanes.
//
// Downtown (Virginia St, west 4th St, Commercial Row): decorative twin-lantern lamp posts with
// banners, concrete planters with street trees, signal masts with lit street-name blades at every
// intersection, trash cans, newspaper boxes, hydrants, utility cabinets, parking meters + parked
// cars on 4th St.
// The strip (4th St east of Lake): wooden power poles with sagging wires and sodium lights on the
// north side, galvanised cobra-head lights on the south side, an RTC bus shelter, concrete bins,
// more meters and beaters parked along the curb, and litter in every gutter.

import * as THREE from 'three';
import { Props } from '../shared/props.js';
import { addTree } from '../shared/flora.js';
import { parkedCar } from '../shared/vehicles.js';
import { paintedSignMat } from '../shared/signs.js';
import { ARCH_Z, TRENCH } from './layout.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const Y0 = 0.15;

export function buildStreets(ctx, { month = 10 } = {}) {
  const P = ctx.stripProps || new Props(ctx);
  const rng = new Rng('streets');
  const { batch, colliders } = ctx;
  const banners = [bannerMat(0), bannerMat(1), bannerMat(2)];

  // ---------------------------------------------------------------- Virginia St
  const inIntersection = (z) => (z > -14 && z < 14) || (z > -128 - 3 && z < -108 + 3) || (z > 104 - 3 && z < 124 + 3) || (z > TRENCH.z0 - 1 && z < TRENCH.z1 + 1);
  let bi = 0;
  for (let z = -136; z <= 150; z += 20) {
    for (const s of [-1, 1]) {
      if (inIntersection(z)) continue;
      if (s < 0 && z > 37 && z < 63) continue; // Eldorado canopy / entrance
      if (Math.abs(z - ARCH_Z) < 4) continue;
      P.downtownLamp(s * 7.75, z, s < 0 ? 0 : Math.PI, { banner: banners[bi++ % banners.length] });
    }
  }
  // Planters with trees between the lamps.
  for (let z = -126; z <= 150; z += 20) {
    for (const s of [-1, 1]) {
      if (inIntersection(z)) continue;
      if (s < 0 && z > 35 && z < 65) continue;
      if (Math.abs(z - ARCH_Z) < 5) continue;
      const soil = P.planter(s * 8.55, z, { size: 1.5 });
      addTree(batch, null, { x: s * 8.55, y: soil.y, z, height: rng.range(6, 7.5), spread: rng.range(2.3, 2.9), seed: rng.int(1, 9999), month, kind: rng.chance(0.5) ? 'locust' : 'pear' });
    }
  }
  // Hydrants, bins, newsboxes, cabinets.
  for (const [x, z] of [[7.55, 32], [-7.55, -72], [7.55, -92], [-7.55, 88], [7.55, 140]]) P.hydrant(x, z, Math.atan2(-x, 0));
  for (const [x, z] of [[9.9, 14.8], [-9.9, -14.8], [9.9, -14.6], [9.9, 100], [-9.9, 99], [9.9, -104], [-9.9, -104], [9.9, 60], [-9.9, -50]]) P.trashCan(x, z);
  P.newsboxes(10.45, 17.5, -Math.PI / 2, 3);
  P.newsboxes(-10.45, -18.0, Math.PI / 2, 2);
  P.newsboxes(10.45, -106, -Math.PI / 2, 2);
  P.cabinet(10.2, -16.4, -Math.PI / 2);
  P.cabinet(-10.3, 101.5, Math.PI / 2);
  P.bench(10.3, 66, -Math.PI / 2);
  P.bench(10.3, -78, -Math.PI / 2);
  P.bench(-10.3, -82, Math.PI / 2);

  // ---------------------------------------------------------------- Intersections
  signalCorners(P, { cx: 0, cz: 0, ns: 'N Virginia St', ew: 'E 4th St', ewW: 'W 4th St', blockNS: '300', blockEW: '1' });
  signalCorners(P, { cx: 0, cz: 114, ns: 'N Virginia St', ew: 'W Commercial Row', ewW: 'W Commercial Row', blockNS: '200', blockEW: '1', north: 102.7, south: 121.6, hwEW: 6 });
  signalCorners(P, { cx: 0, cz: -118, ns: 'N Virginia St', ew: 'E 5th St', ewW: 'W 5th St', blockNS: '400', blockEW: '1', hwEW: 6 });
  signalCorners(P, { cx: 100, cz: 0, ns: 'Lake St', ew: 'E 4th St', ewW: 'E 4th St', blockNS: '300', blockEW: '100', hwNS: 6 });

  // ---------------------------------------------------------------- 4th St downtown section
  for (let x = -38; x <= 86; x += 20) {
    if (x > -14 && x < 14) continue;
    for (const s of [-1, 1]) {
      if (s > 0 && x > -50 && x < -40) continue;
      P.downtownLamp(x, s * 7.75, s < 0 ? -Math.PI / 2 : Math.PI / 2, { banner: banners[bi++ % banners.length] });
    }
  }
  // Meters + cars in the parking lanes (stall ticks every 6.5 m from x = -147).
  const stallX = (k) => -150 + 3 + 6.5 * k + 3.25;
  for (let k = 0; k < 70; k++) {
    const x = stallX(k);
    if (x < -40 || x > 262) continue;
    if ((x > -16 && x < 16) || (x > 85 && x < 115)) continue;
    for (const s of [-1, 1]) {
      const meter = x < 90 || rng.chance(0.25);
      if (meter && !(s > 0 && x > -50 && x < -40)) P.parkingMeter(x - 2.9, s * 7.55, s < 0 ? 0 : Math.PI);
      if (s < 0 && x > 176 && x < 234 && rng.chance(0.5)) continue; // keep the Starlite curb a bit freer
      if (rng.chance(x < 90 ? 0.6 : 0.5)) {
        const type = rng.pick(x < 90 ? ['sedan', 'sedan', 'coupe', 'pickup', 'wagon'] : ['sedan', 'wagon', 'pickup', 'van', 'coupe', 'pickup']);
        parkedCar(batch, colliders, { x, y: 0, z: s * 5.85 + rng.range(-0.1, 0.1), ry: s < 0 ? Math.PI : 0, type, seed: rng.int(1, 99999) });
      }
    }
  }

  // ---------------------------------------------------------------- 4th St strip
  // North side: wooden power poles, wires pole to pole, a few sodium lights (one dead).
  const poles = [];
  for (let x = 112; x <= 298; x += 37) {
    poles.push(P.powerPole(x, -10.55, 0, { transformer: (x - 112) % 74 === 0, light: x % 3 === 0 ? { sodium: true, dead: x === 223 } : { sodium: true }, lean: rng.range(-0.02, 0.02) }));
  }
  // Also downtown-to-strip continuation along Lake St corner.
  for (let i = 0; i < poles.length - 1; i++) {
    for (let k = 0; k < 3; k++) P.wire(poles[i].top[k], poles[i + 1].top[k], { sag: 0.6 + k * 0.08 });
    for (let k = 0; k < 2; k++) P.wire(poles[i].low[k], poles[i + 1].low[k], { sag: 0.75, r: 0.016 });
    P.wire(poles[i].phone, poles[i + 1].phone, { sag: 0.9, r: 0.02 });
  }
  // Service drops to the north-side buildings (and one across the street).
  for (const [pi, x, z, y] of [[0, 118, -16.2, 4.2], [1, 141, -19.6, 3.0], [2, 158, -20.5, 5.2], [4, 238, -15.2, 3.4], [5, 254, -13.4, 5.5]]) {
    if (!poles[pi]) continue;
    P.wire(poles[pi].low[0], new THREE.Vector3(x, Y0 + y, z), { sag: 0.35, r: 0.01 });
  }
  P.wire(poles[3].low[1], new THREE.Vector3(200, Y0 + 3.9, 21.2), { sag: 0.5, r: 0.011 });
  // South side: galvanised cobra heads over the road.
  for (let x = 128; x <= 290; x += 36) P.cobraLight(x, 10.45, -Math.PI / 2, { arm: 2.8, sodium: x > 200, dead: x === 236 });
  // Bus shelter (south side, facing the street) + newsboxes + bins.
  P.busShelter(166, 9.9, Math.PI, { route: '11 · 18' });
  P.newsboxes(171.2, 10.3, Math.PI, 3);
  P.trashCan(161.5, 10.2, { style: 'concrete' });
  P.trashCan(122, -10.2, { style: 'concrete' });
  P.trashCan(246.5, -10.2, { style: 'concrete' });
  P.trashCan(214.6, 10.2, { style: 'concrete' });
  for (const [x, z] of [[132, 7.55], [186.5, -7.55], [229.5, 7.55], [262, -7.55]]) P.hydrant(x, z, Math.atan2(0, z));
  P.cabinet(110.8, 10.6, Math.PI);
  P.bollard(184.2, -10.4);
  P.bollard(179.6, -10.4);

  // Lake St & the cross streets: a few lights.
  for (const z of [-60, -36, 36, 60]) {
    P.cobraLight(92.3, z, Math.PI, { arm: 2.4 });
    P.cobraLight(107.7, z + 12, 0, { arm: 2.4 });
  }
  for (const x of [-36, 36]) {
    P.downtownLamp(x, 106.7, -Math.PI / 2, {});
    P.downtownLamp(x, -109.3, -Math.PI / 2, {});
  }

  // ---------------------------------------------------------------- Litter in gutters
  for (const [x0, x1, z0, z1, n] of [
    [110, 262, 6.6, 7.0, 90], [110, 262, -7.0, -6.6, 90], [110, 262, 7.2, 10.8, 70], [110, 262, -10.8, -7.2, 70],
    [-40, 90, 6.6, 7.0, 30], [-40, 90, -7.0, -6.6, 30], [6.6, 7.0, -140, 150, 30], [-7.0, -6.6, -140, 150, 30],
    [7.2, 10.8, -140, 150, 30], [-10.8, -7.2, -140, 150, 30],
  ]) P.litter(x0, z0, x1, z1, n, { rng, y: z0 > 7.1 || z1 < -7.1 || x0 > 7.1 || x1 < -7.1 ? Y0 : 0 });
  void paintedSignMat;
}

function signalCorners(P, { cx, cz, ns, ew, ewW, blockNS, blockEW, north, south, hwEW = 7, hwNS = 7 }) {
  const d = hwNS + 1.2;
  const dz = hwEW + 1.2;
  const zN = north ?? cz - dz;
  const zS = south ?? cz + dz;
  // Arms reach over the approach lanes (right-hand traffic). Heads face the oncoming traffic.
  P.signalMast(cx + d, zS, Math.PI, { axis: 'ns', arm: hwNS + 1.6, heads: [hwNS * 0.4 + 1.2, hwNS * 0.85 + 1.2], blade: { name: ns, block: blockNS }, pedAxes: [{ axis: 'pedEW', ry: Math.PI / 2 }, { axis: 'pedNS', ry: 0 }] });
  P.signalMast(cx - d, zN, 0, { axis: 'ns', arm: hwNS + 1.6, heads: [hwNS * 0.4 + 1.2, hwNS * 0.85 + 1.2], blade: { name: ns, block: blockNS }, pedAxes: [{ axis: 'pedEW', ry: Math.PI / 2 }, { axis: 'pedNS', ry: 0 }] });
  P.signalMast(cx + d, zN, -Math.PI / 2, { axis: 'ew', arm: hwEW + 1.6, heads: [hwEW * 0.4 + 1.2, hwEW * 0.85 + 1.2], blade: { name: ew, block: blockEW }, pedAxes: [] });
  P.signalMast(cx - d, zS, Math.PI / 2, { axis: 'ew', arm: hwEW + 1.6, heads: [hwEW * 0.4 + 1.2, hwEW * 0.85 + 1.2], blade: { name: ewW, block: blockEW }, pedAxes: [] });
}

const bannerCache = new Map();
function bannerMat(i) {
  if (bannerCache.has(i)) return bannerCache.get(i);
  const m = paintedSignMat(`banner-${i}`, 160, 380, (g, w, h) => {
    const bg = ['#1b3f78', '#a3242c', '#16533f'][i];
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (i === 0) {
      // Hot-air balloon (Great Reno Balloon Race season).
      g.fillStyle = '#f2c53a';
      g.beginPath();
      g.ellipse(w / 2, h * 0.3, w * 0.28, h * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8572e';
      g.fillRect(w / 2 - w * 0.06, h * 0.15, w * 0.12, h * 0.3);
      g.fillStyle = '#6b4a2a';
      g.fillRect(w / 2 - 10, h * 0.47, 20, 16);
      g.fillStyle = '#f4efe2';
      g.font = '400 64px "Bebas Neue"';
      g.fillText(t('reno.arch.name'), w / 2, h * 0.68);
      g.font = '400 26px "Bebas Neue"';
      g.fillText('BALLOON RACE', w / 2, h * 0.8);
    } else if (i === 1) {
      g.font = '400 30px "Bebas Neue"';
      g.fillText('THE', w / 2, h * 0.14);
      g.font = '400 50px "Bebas Neue"';
      for (const [k, wd] of ['BIGGEST', 'LITTLE', 'CITY'].entries()) g.fillText(wd, w / 2, h * (0.28 + k * 0.15));
      g.fillStyle = '#f2c53a';
      g.fillRect(w * 0.2, h * 0.78, w * 0.6, 4);
      g.fillStyle = '#f4efe2';
      g.font = '400 28px "Bebas Neue"';
      g.fillText('DOWNTOWN', w / 2, h * 0.87);
    } else {
      g.font = '700 46px "Playfair Display"';
      g.fillText('Reno', w / 2, h * 0.3);
      g.font = '400 26px "Bebas Neue"';
      g.fillText('ARTOWN · JULY', w / 2, h * 0.5);
      g.strokeStyle = '#f2c53a';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(w / 2, h * 0.72, w * 0.2, 0, Math.PI * 2);
      g.stroke();
    }
  }, { weather: { grime: 0.35, fade: 0.55, rust: 0, scratches: 0.05 }, rough: 0.85 });
  m.side = THREE.DoubleSide;
  bannerCache.set(i, m);
  return m;
}
