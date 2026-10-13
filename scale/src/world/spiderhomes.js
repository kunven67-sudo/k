// Where the spiders live around your house, each where its species really lives (and why).
//  - Black widow #1: the back corner of the garage, behind the boxes (dark, quiet, nobody cleans).
//  - Black widow #2: the base of the firewood pile behind the garage (the classic widow spot).
//  - Garden orb weaver: a web strung between two shrubs on the east side of the house (flying insects
//    come through the gap between bushes).
//  - Red-backed jumping spider: the sunny sill of the living room's east window (it hunts by sight
//    where it's bright, and flies bump into windows).
//  - Cellar spiders: a ceiling corner of the living room, and a corner of the basement lab.
import * as THREE from 'three';
import { buildOrbWeb, buildTangleWeb, buildSheetWeb } from '../life/web.js';
import { makeSpider } from '../life/spiders.js';
import { shrub, woodpile } from './garden.js';

function ray(game, from, dir, max = 5) {
  const physics = game.physics;
  return physics.raycast(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize(), max, {
    predicate: (c) => {
      const o = physics.ownerOf(c);
      return !(o && (o.kind === 'creature' || o === game.player || o.held || o.kind === 'prop'));
    },
  });
}

// Built after the world exists (for the shrubs and woodpile) ...
// The garage's back wall: its outside face is at z = -4.15 (wall centered on z = -4, 30 cm thick).
const GARAGE_BACK_OUT = -4.15;

export function buildSpiderHomes(game, groundY) {
  // Firewood against the back of the garage (outside).
  woodpile(game, { at: [-18.8, groundY, GARAGE_BACK_OUT - 0.22], length: 1.2, rows: 6, logLen: 0.4, seed: 5 });
  const S = [
    shrub(game, { at: [13.0, groundY, -1.3], radius: 0.42, height: 1.05, seed: 1 }),
    shrub(game, { at: [13.05, groundY, -0.02], radius: 0.45, height: 1.15, seed: 2 }),
    shrub(game, { at: [13.1, groundY, 1.55], radius: 0.4, height: 1.0, seed: 3 }),
    shrub(game, { at: [12.95, groundY, 2.85], radius: 0.43, height: 1.1, seed: 4 }),
  ];
  return { shrubs: S };
}

// ... and the webs and spiders once physics has settled (webs are glued to what rays hit).
export function placeSpiders(game, groundY) {
  const out = [];
  const wallZ = GARAGE_BACK_OUT;

  // Black widow #1: garage back corner.
  {
    const c0 = [-20.7, 0.06, -3.7];
    const wx = ray(game, c0, [-1, 0, 0], 1), wz = ray(game, c0, [0, 0, -1], 1), fl = ray(game, c0, [0, -1, 0], 1);
    const corner = new THREE.Vector3(wx ? wx.point.x + 0.012 : -20.95, fl ? fl.point.y + 0.01 : -0.09, wz ? wz.point.z + 0.012 : -3.95);
    const web = buildTangleWeb(game, { center: new THREE.Vector3(corner.x + 0.12, corner.y + 0.11, corner.z + 0.12), corner, size: 0.2, seed: 11 });
    out.push(makeSpider(game, 'widow', { web, position: web.nodes[web.hub].toArray() }));
  }
  // Black widow #2: the base of the woodpile, at its end by the wall.
  {
    const end = -18.8 + 0.6;
    const corner = new THREE.Vector3(end + 0.02, groundY + 0.01, wallZ - 0.015);
    const web = buildTangleWeb(game, { center: new THREE.Vector3(end + 0.09, groundY + 0.09, wallZ - 0.1), corner, size: 0.16, gumfoots: 7, seed: 12 });
    out.push(makeSpider(game, 'widow', { web, position: web.nodes[web.hub].toArray() }));
  }
  // Garden orb weaver: between the first two shrubs (the web faces east-west across the gap).
  {
    const web = buildOrbWeb(game, { center: new THREE.Vector3(13.02, 0.6, -0.66), normal: new THREE.Vector3(1, 0, 0), radius: 0.12, seed: 21 });
    out.push(makeSpider(game, 'orb', { web, position: web.nodes[web.hub].toArray() }));
  }
  // Jumping spider on the living room's east window sill.
  {
    const sill = ray(game, [11.92, 0.8, 3.4], [0, -1, 0], 1.5);
    if (sill) out.push(makeSpider(game, 'jumper', { position: sill.point.toArray(), up: [0, 1, 0], fwd: [-1, 0, 0] }));
  }
  // Cellar spiders: living room ceiling corner, lab corner.
  for (const [x, y, z] of [[11.7, 2.0, 7.7], [-11.7, -2.6, -7.6]]) {
    const up = ray(game, [x, y, z], [0, 1, 0], 4), wx = ray(game, [x, y, z], [Math.sign(x), 0, 0], 2), wz = ray(game, [x, y, z], [0, 0, Math.sign(z)], 2);
    if (!up || !wx || !wz) continue;
    const c = new THREE.Vector3(wx.point.x - Math.sign(x) * 0.13, up.point.y - 0.1, wz.point.z - Math.sign(z) * 0.13);
    const web = buildSheetWeb(game, { center: c, size: 0.24, seed: 31 + out.length });
    out.push(makeSpider(game, 'cellar', { web, position: web.nodes[web.hub].toArray() }));
  }
  game.spiders = out;
  return out;
}
