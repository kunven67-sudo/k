// Where people can walk: a waypoint graph of Maple Hollow (sidewalks, crosswalks, driveways,
// front doors, every room + doorway of the family house, store aisles + registers, park paths).
// A* finds a route; NPCs walk it and open doors on the way.
//
//   const nav = buildNav(world)
//   nav.add(pos, { tag, door, room }) -> node id     nav.link(a, b)
//   nav.nearest(pos, filter) -> id                     nav.path(fromPos, toId) -> [Vector3...]

import * as THREE from 'three';
import { CURB, MAPLE, ELM, SIDEWALK, LOTS, PARK, FAMILY_LOT } from '../world/layout.js';

export class Nav {
  constructor() {
    this.nodes = []; // { id, p: Vector3, links: Set, tag, door, room }
  }

  add(p, extra = {}) {
    const n = { id: this.nodes.length, p: p.clone(), links: new Set(), ...extra };
    this.nodes.push(n);
    return n.id;
  }

  link(a, b) {
    if (a == null || b == null || a === b) return;
    this.nodes[a].links.add(b);
    this.nodes[b].links.add(a);
  }

  chain(ids) {
    for (let i = 1; i < ids.length; i++) this.link(ids[i - 1], ids[i]);
  }

  nearest(p, filter = null) {
    let best = null;
    let bd = Infinity;
    for (const n of this.nodes) {
      if (filter && !filter(n)) continue;
      const d = n.p.distanceToSquared(p) + Math.abs(n.p.y - p.y) * 40; // stay on the same floor
      if (d < bd) {
        bd = d;
        best = n.id;
      }
    }
    return best;
  }

  /** A* from the node nearest `from` to node `to`. Returns node ids. */
  route(fromId, toId) {
    if (fromId == null || toId == null) return [];
    const N = this.nodes;
    const g = new Map([[fromId, 0]]);
    const came = new Map();
    const open = new Set([fromId]);
    const h = (id) => N[id].p.distanceTo(N[toId].p);
    const f = new Map([[fromId, h(fromId)]]);
    let guard = 0;
    while (open.size && guard++ < 5000) {
      let cur = null;
      let cf = Infinity;
      for (const id of open) if (f.get(id) < cf) (cf = f.get(id)), (cur = id);
      if (cur === toId) {
        const out = [cur];
        while (came.has(cur)) out.unshift((cur = came.get(cur)));
        return out;
      }
      open.delete(cur);
      for (const nb of N[cur].links) {
        const cost = g.get(cur) + N[cur].p.distanceTo(N[nb].p) * (N[nb].tag === 'road' ? 1.6 : 1);
        if (cost < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          g.set(nb, cost);
          f.set(nb, cost + h(nb));
          open.add(nb);
        }
      }
    }
    return [];
  }

  path(fromPos, toId, filter) {
    const from = this.nearest(fromPos, filter);
    return this.route(from, toId).map((id) => this.nodes[id]);
  }
}

export function buildNav(world) {
  const nav = new Nav();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = CURB;
  const home = world.home;
  const FY = home.floorY;
  const eW = ELM.x - ELM.half;
  const eE = ELM.x + ELM.half;

  // ------------------------------------------------------------------ sidewalks along Maple
  const zN = (SIDEWALK.mapleN.z0 + SIDEWALK.mapleN.z1) / 2;
  const zS = (SIDEWALK.mapleS.z0 + SIDEWALK.mapleS.z1) / 2;
  const walkN = [];
  const walkS = [];
  for (let x = -60; x <= SIDEWALK.elmW.x0; x += 5) {
    walkN.push(nav.add(V(x, Y, zN), { tag: 'walk' }));
    walkS.push(nav.add(V(x, Y, zS), { tag: 'walk' }));
  }
  nav.chain(walkN);
  nav.chain(walkS);
  // Crosswalk near Elm + a crossing at the cul-de-sac end (kids cross there to the park).
  const xCross = eW - 3.2;
  const cN = nav.add(V(xCross, Y, zN), { tag: 'walk' });
  const cS = nav.add(V(xCross, Y, zS), { tag: 'walk' });
  const cMid = nav.add(V(xCross, 0, 0), { tag: 'road' });
  nav.chain([cN, cMid, cS]);
  nav.link(cN, nav.nearest(V(xCross, Y, zN), (n) => n.tag === 'walk' && n.id !== cN && Math.abs(n.p.z - zN) < 0.1));
  nav.link(cS, nav.nearest(V(xCross, Y, zS), (n) => n.tag === 'walk' && n.id !== cS && Math.abs(n.p.z - zS) < 0.1));
  const parkCross = nav.add(V(-60, 0, 0), { tag: 'road' });
  nav.link(parkCross, walkN[0]);
  nav.link(parkCross, walkS[0]);

  // ------------------------------------------------------------------ Elm Ave sidewalks + crossing
  const xW = (SIDEWALK.elmW.x0 + SIDEWALK.elmW.x1) / 2;
  const xE = (SIDEWALK.elmE.x0 + SIDEWALK.elmE.x1) / 2;
  const elmW = [];
  const elmE = [];
  for (let z = -90; z <= 90; z += 6) {
    elmW.push(nav.add(V(xW, Y, z), { tag: 'walk' }));
    elmE.push(nav.add(V(xE, Y, z), { tag: 'walk' }));
  }
  nav.chain(elmW);
  nav.chain(elmE);
  nav.link(walkN[walkN.length - 1], nav.nearest(V(xW, Y, zN), (n) => elmW.includes(n.id)));
  nav.link(walkS[walkS.length - 1], nav.nearest(V(xW, Y, zS), (n) => elmW.includes(n.id)));
  // Crossing Elm at Maple.
  const eA = nav.nearest(V(xW, Y, 0), (n) => elmW.includes(n.id));
  const eB = nav.nearest(V(xE, Y, 0), (n) => elmE.includes(n.id));
  const eMid = nav.add(V(ELM.x, 0, 0), { tag: 'road' });
  nav.chain([eA, eMid, eB]);

  // ------------------------------------------------------------------ stores (plaza)
  for (const S of ['grocery', 'electronics', 'furniture'].map((k) => world.town.stores[k])) {
    const out = nav.add(S.outside, { tag: 'lot' });
    const lotMid = nav.add(V((xE + S.outside.x) / 2, Y, S.outside.z), { tag: 'lot' });
    nav.chain([nav.nearest(V(xE, Y, S.outside.z), (n) => elmE.includes(n.id)), lotMid, out]);
    const inn = nav.add(S.entrance, { tag: 'store', store: S.id, storeDoor: true });
    nav.link(out, inn);
    S.navEntrance = inn;
    S.navOutside = out;
    // Inside: a loop through the store + each register (customer + cashier side).
    const { x0, x1, z0, z1 } = S.def;
    const loop = [
      nav.add(V(x0 + 6, S.entrance.y, (z0 + z1) / 2), { tag: 'store', store: S.id }),
      nav.add(V(x0 + 6, S.entrance.y, z0 + 2.4), { tag: 'store', store: S.id }),
      nav.add(V(x1 - 3.2, S.entrance.y, z0 + 2.4), { tag: 'store', store: S.id }),
      nav.add(V(x1 - 3.2, S.entrance.y, z1 - 2.4), { tag: 'store', store: S.id }),
      nav.add(V(x0 + 6, S.entrance.y, z1 - 2.4), { tag: 'store', store: S.id }),
    ];
    nav.chain([...loop, loop[0]]);
    nav.link(inn, loop[0]);
    S.navLoop = loop;
    for (const r of S.registers) {
      r.navCustomer = nav.add(r.customer, { tag: 'store', store: S.id });
      r.navCashier = nav.add(r.cashier, { tag: 'store', store: S.id, staff: true });
      nav.link(r.navCustomer, loop[0]);
      nav.link(r.navCustomer, inn);
      const back = nav.add(V(r.cashier.x + 1.4, r.cashier.y, r.cashier.z), { tag: 'store', store: S.id, staff: true });
      nav.chain([r.navCashier, back, loop[0]]);
    }
  }

  // ------------------------------------------------------------------ park
  const pcx = (PARK.x0 + PARK.x1) / 2;
  const parkGate = nav.add(V(PARK.x1 + 1.5, Y, 0), { tag: 'park' });
  nav.link(parkGate, parkCross);
  const ring = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ring.push(nav.add(V(pcx + Math.cos(a) * 22, Y, Math.sin(a) * 22 * 1.2), { tag: 'park' }));
  }
  nav.chain([...ring, ring[0]]);
  nav.link(parkGate, nav.nearest(V(pcx + 22, Y, 0), (n) => ring.includes(n.id)));
  const play = nav.add(V(PARK.x1 - 14, Y, -16), { tag: 'park', spot: 'playground' });
  nav.link(play, nav.nearest(play ? V(PARK.x1 - 14, Y, -16) : V(), (n) => ring.includes(n.id)));
  for (const s of world.parkSpots || []) {
    const id = nav.add(s.at.clone().setY(Y).add(V(Math.sin(s.faceYaw) * 0.6, 0, Math.cos(s.faceYaw) * 0.6)), { tag: 'park', seat: s });
    nav.link(id, nav.nearest(s.at, (n) => ring.includes(n.id)));
    s.nav = id;
  }

  // ------------------------------------------------------------------ neighbours' houses
  for (const h of world.town.houses) {
    if (h.family) continue;
    const door = h.house.door; // in front of the porch
    const d = nav.add(door.clone().setY(Y), { tag: 'yard', house: h.lot.id });
    const side = h.lot.side;
    const sw = nav.nearest(V(door.x, Y, side === -1 ? zN : zS), (n) => (side === -1 ? walkN : walkS).includes(n.id));
    const mid = nav.add(V(door.x, Y, side === -1 ? zN - 2 : zS + 2), { tag: 'yard' });
    nav.chain([d, mid, sw]);
    h.navDoor = d;
    if (h.house.garageX != null) {
      const drv = nav.add(V(h.house.garageX, Y, side === -1 ? -10 : 10), { tag: 'yard', house: h.lot.id, driveway: true });
      nav.link(drv, nav.nearest(V(h.house.garageX, Y, side === -1 ? zN : zS), (n) => (side === -1 ? walkN : walkS).includes(n.id)));
      h.navDriveway = drv;
    }
  }

  // ------------------------------------------------------------------ the family house
  const R = home.roomById;
  const roomNode = {};
  for (const r of home.rooms) {
    const c = r.box.getCenter(new THREE.Vector3());
    c.y = r.id === 'garage' ? home.garageY : FY;
    roomNode[r.id] = nav.add(c, { tag: 'home', room: r.id });
  }
  // Open plan: living <-> kitchen through the gap beside the stub wall.
  const gap = nav.add(V(FAMILY_LOT.x0 + 7, FY, FAMILY_LOT.zf - 4.4), { tag: 'home', room: 'living' });
  nav.chain([roomNode.living, gap, roomNode.kitchen]);
  // Doorways: a node in the doorway + one each side.
  for (const d of home.doors) {
    const ref = d.ref;
    const n = new THREE.Vector3(Math.sin(d.rotY), 0, Math.cos(d.rotY)); // door normal (wall facing)
    const y = d.y;
    const mid = nav.add(V(d.cx, y, d.cz), { tag: 'door', door: ref });
    const a = nav.add(V(d.cx + n.x * 0.75, y, d.cz + n.z * 0.75), { tag: 'home' });
    const b = nav.add(V(d.cx - n.x * 0.75, y, d.cz - n.z * 0.75), { tag: 'home' });
    nav.chain([a, mid, b]);
    for (const end of [a, b]) {
      const p = nav.nodes[end].p;
      const room = world.roomAt(p.clone().setY(p.y + 0.5));
      if (room && roomNode[room.id] != null) {
        nav.nodes[end].room = room.id;
        nav.link(end, roomNode[room.id]);
        if (room.id === 'living' || room.id === 'kitchen') nav.link(end, gap);
      } else {
        nav.nodes[end].tag = 'yard';
        nav.nodes[end].outsideOf = d.name;
        nav.nodes[end].p.y = Math.max(Y, p.y);
        d.outsideNode = end;
      }
    }
  }
  // Front door outside -> porch steps -> walkway -> sidewalk.
  const front = home.doors.find((d) => d.name === 'Front door');
  if (front?.outsideNode != null) {
    const steps = nav.add(V(front.cx, Y, FAMILY_LOT.zf + 2.6), { tag: 'yard' });
    const sw = nav.nearest(V(front.cx, Y, zN), (n) => walkN.includes(n.id));
    nav.chain([front.outsideNode, steps, nav.add(V(front.cx, Y, zN - 1.5), { tag: 'yard' }), sw]);
  }
  // Garage <-> driveway (the big door is open) + back door -> backyard.
  const gd = home.garageDoor;
  const drive = nav.add(V(gd.cx, Y, FAMILY_LOT.zf + 3), { tag: 'yard', familyDriveway: true });
  const gIn = nav.add(V(gd.cx, home.garageY, FAMILY_LOT.zf - 1), { tag: 'home', room: 'garage' });
  nav.chain([roomNode.garage, gIn, drive, nav.nearest(V(gd.cx, Y, zN), (n) => walkN.includes(n.id))]);
  home.navDriveway = drive;
  home.navRoom = roomNode;
  // Spots (bed, couch, fridge, stove, TV...) get an approach node in their room.
  for (const s of home.spots) {
    const room = R[s.room] || home.rooms.find((r) => r.id === s.room);
    if (!room) continue;
    const fy = s.room === 'garage' ? home.garageY : FY;
    const yaw = s.faceYaw ?? 0;
    let p = s.at.clone().setY(fy);
    if (s.kind === 'seat' || s.kind === 'couch') p.add(V(Math.sin(yaw) * 0.55, 0, Math.cos(yaw) * 0.55));
    else {
      // Stand beside it, towards the room centre (beds: next to the mattress).
      const c = room.box.getCenter(new THREE.Vector3()).setY(fy);
      p.add(c.clone().sub(p).setY(0).normalize().multiplyScalar(s.kind === 'bed' ? 1.05 : 0.7));
    }
    const id = nav.add(p, { tag: 'home', room: s.room, spot: s });
    nav.link(id, roomNode[s.room]);
    s.nav = id;
  }
  void LOTS;
  void MAPLE;
  void eE;
  return nav;
}
