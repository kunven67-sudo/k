// The player's room (#6 by default; renumbered by setRoomNumber). This file builds the shell —
// peeling wallpaper, stained carpet, water-stained popcorn ceiling, the entry door (deadbolt,
// chain, peephole, fire map, DO NOT DISTURB hanger), the window with sliding blackout curtains +
// sheers, light switches and the room's lights — and pulls in the furniture, bathroom and clutter.
//
// Lighting budget (≤ 4 real lights): ceiling dome (the only shadow caster, high tier), bedside lamp,
// bathroom vanity bar, TV glow. Daylight comes from the sky's sun through the curtain gap; at night
// the pole sign's pink neon leaks in as an additive light-spill on the floor and wall.
import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { propMats } from '../shared/props.js';
import { Rng } from '../../core/rng.js';
import { t } from '../../core/i18n.js';
import { Y0, RI, ROOM, BACK } from './layout.js';
import { motelMats, PAL, plaqueMat } from './mats.js';
import { doorParts, jambParts, partsToGroup, stampParts, DOOR } from './doors.js';
import { movable, switcher } from './interact.js';
import { buildFurniture } from './room-furniture.js';
import { buildBath } from './room-bath.js';
import { buildClutter } from './room-clutter.js';

export function buildRoom(ctx) {
  const { batch, colliders, physics, tier } = ctx;
  const M = motelMats();
  const rng = new Rng('starlite-room');
  const R = RI;
  const room = { ctx, lights: {}, switches: {}, fx: [] };
  ctx.room = room;
  // Everything built for the room goes into its own chunk / group so index.js can hide the whole
  // interior when nobody is near it (it is invisible from outside with the door shut anyway).
  const outerExtras = ctx.extraMeshes;
  const roomExtras = [];
  ctx.extraMeshes = roomExtras;
  const batchAdd = batch.add;
  batch.add = (g, m, o = {}) => batchAdd.call(batch, g, m, { chunk: 'room', ...o });

  // ---- Shared interior materials ------------------------------------------------------------------
  const W = {
    paper: mat('wallpaper', { color: 0xcdb98f, color2: 0xa8936a, pattern: 'damask', wear: 0.85, dirt: 0.75, seed: 901, tileMeters: 0.55 }),
    carpet: mat('carpet-motel', { seed: 902 }),
    trim: mat('painted-wood', { color: 0xd8d0bc, wear: 0.6, dirt: 0.6, seed: 903 }),
    ceil: new THREE.MeshStandardMaterial({ map: popcornTex(), roughness: 0.97 }),
  };
  W.ceil.name = 'room-ceiling';
  room.W = W;

  // ---- Floor + ceiling ----------------------------------------------------------------------------
  batch.add(new THREE.BoxGeometry(R.x1 - R.x0, R.fl - Y0, R.zf - (R.zp - 0.1)).translate((R.x0 + R.x1) / 2, (Y0 + R.fl) / 2, (R.zf + R.zp - 0.1) / 2), W.carpet, { castShadow: false, chunk: 'room' });
  // Closet floor (carpet continues into the nook).
  batch.add(new THREE.BoxGeometry(R.bx - 0.1 - R.x0, R.fl - Y0, R.zp - R.zb).translate((R.x0 + R.bx - 0.1) / 2, (Y0 + R.fl) / 2, (R.zp + R.zb) / 2), W.carpet, { castShadow: false, chunk: 'room' });
  colliders.aabb(ROOM.x0, Y0 - 0.1, R.zb, ROOM.x1, R.fl, R.zf);
  const cg = new THREE.PlaneGeometry(R.x1 - R.x0, R.zf - R.zb).rotateX(Math.PI / 2).translate((R.x0 + R.x1) / 2, R.ceil, (R.zf + R.zb) / 2);
  batch.add(cg, W.ceil, { uv: 'keep', castShadow: true, chunk: 'room' });
  // Ceiling slab above (blocks the sun from the room above; also the closed box for shadows).
  // Thick so the sun's (coarse) shadow map never leaks a bright line along the wall tops.
  batch.add(new THREE.BoxGeometry(ROOM.x1 - ROOM.x0 + 0.4, 0.4, BACK.z1 - BACK.z0).translate((ROOM.x0 + ROOM.x1) / 2, R.ceil + 0.205, (BACK.z0 + BACK.z1) / 2), M.concrete, { castShadow: true, receiveShadow: false, chunk: 'room' });

  // ---- Walls (liners on the room side; party walls get their own colliders) -----------------------
  const wallH = R.ceil - R.fl;
  const yc = R.fl + wallH / 2;
  // Party walls run 0.3 m past the ceiling (into the slab) — again against shadow leaks.
  const pwH = wallH + 0.3;
  const pyc = R.fl + pwH / 2;
  // West + east party walls (full depth, both rooms).
  batch.add(new THREE.BoxGeometry(0.1, pwH, R.zf - R.zb).translate(R.x0 - 0.05, pyc, (R.zf + R.zb) / 2), W.paper, { chunk: 'room' });
  batch.add(new THREE.BoxGeometry(0.1, pwH, R.zf - R.zb).translate(R.x1 + 0.05, pyc, (R.zf + R.zb) / 2), W.paper, { chunk: 'room' });
  colliders.aabb(R.x1, Y0, R.zb, ROOM.x1, R.ceil, R.zf);
  colliders.aabb(ROOM.x0, Y0, R.zb, R.x0, R.ceil, R.zf);
  // Rear wall liner + collider (the wing's rear wall stops at the room box).
  batch.add(new THREE.BoxGeometry(R.x1 - R.x0, wallH, 0.02).translate((R.x0 + R.x1) / 2, yc, R.zb + 0.01), W.paper, { chunk: 'room' });
  colliders.aabb(ROOM.x0, Y0, BACK.z0, ROOM.x1, R.ceil, R.zb);
  // Front wall: liner pieces around the door and window holes + colliders.
  const front = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    batch.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.02).translate((x0 + x1) / 2, (y0 + y1) / 2, R.zf - 0.01), W.paper, { chunk: 'room' });
  };
  const D = R.door;
  const Wn = R.win;
  front(R.x0, D.x0, R.fl, R.ceil);
  front(D.x0, D.x1, R.fl + D.h, R.ceil);
  front(D.x1, Wn.x0, R.fl, R.ceil);
  front(Wn.x0, Wn.x1, R.fl, Wn.y0);
  front(Wn.x0, Wn.x1, Wn.y1, R.ceil);
  front(Wn.x1, R.x1, R.fl, R.ceil);
  colliders.aabb(ROOM.x0, Y0, R.zf, D.x0, R.ceil, BACK.z1);
  colliders.aabb(D.x1, Y0, R.zf, ROOM.x1, R.ceil, BACK.z1);
  colliders.aabb(D.x0, R.fl + D.h, R.zf, D.x1, R.ceil, BACK.z1);
  // Window reveal liners (inside the 0.3 m wall).
  for (const [x, y, sx, sy] of [[(Wn.x0 + Wn.x1) / 2, Wn.y0, Wn.x1 - Wn.x0, 0.03], [(Wn.x0 + Wn.x1) / 2, Wn.y1, Wn.x1 - Wn.x0, 0.03], [Wn.x0, (Wn.y0 + Wn.y1) / 2, 0.03, Wn.y1 - Wn.y0], [Wn.x1, (Wn.y0 + Wn.y1) / 2, 0.03, Wn.y1 - Wn.y0]]) {
    batch.add(new THREE.BoxGeometry(sx, sy, 0.3).translate(x, y, R.zf + 0.15), W.trim, { chunk: 'room' });
  }
  // Interior sill.
  batch.add(new THREE.BoxGeometry(Wn.x1 - Wn.x0 + 0.12, 0.03, 0.1).translate((Wn.x0 + Wn.x1) / 2, Wn.y0 - 0.015, R.zf - 0.04), W.trim, { chunk: 'room' });
  // Baseboards + a ceiling cove.
  const base = (x0, z0, x1, z1) => batch.add(new THREE.BoxGeometry(Math.max(0.02, x1 - x0), 0.09, Math.max(0.02, z1 - z0)).translate((x0 + x1) / 2, R.fl + 0.045, (z0 + z1) / 2), W.trim, { tint: 0xbab09a, chunk: 'room', grime: 0.5, grimeBase: R.fl });
  base(R.x0, R.zb, R.x0 + 0.015, R.zf);
  base(R.x1 - 0.015, R.zp, R.x1, R.zf);
  base(D.x1, R.zf - 0.015, R.x1, R.zf);
  base(R.x0, R.zf - 0.015, D.x0, R.zf);
  base(R.x0, R.zb, R.bx - 0.1, R.zb + 0.015);
  // Partitions: bedroom|bathroom (with door hole) and closet|bathroom.
  const B = R.bathDoor;
  const zp0 = R.zp - 0.1;
  const part = (x0, x1, y0, y1) => {
    batch.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.1).translate((x0 + x1) / 2, (y0 + y1) / 2, R.zp - 0.05), W.paper, { chunk: 'room' });
  };
  part(R.bx - 0.1, B.x0, R.fl, R.ceil);
  part(B.x0, B.x1, R.fl + B.h, R.ceil);
  part(B.x1, R.x1, R.fl, R.ceil);
  colliders.aabb(R.bx - 0.1, R.fl, zp0, B.x0, R.ceil, R.zp);
  colliders.aabb(B.x1, R.fl, zp0, R.x1, R.ceil, R.zp);
  colliders.aabb(B.x0, R.fl + B.h, zp0, B.x1, R.ceil, R.zp);
  batch.add(new THREE.BoxGeometry(0.1, wallH, R.zp - R.zb).translate(R.bx - 0.05, yc, (R.zp + R.zb) / 2), W.paper, { chunk: 'room' });
  colliders.aabb(R.bx - 0.1, R.fl, R.zb, R.bx, R.ceil, R.zp);
  // Door casing for the bathroom door.
  for (const x of [B.x0 - 0.03, B.x1 + 0.03]) batch.add(new THREE.BoxGeometry(0.06, B.h + 0.06, 0.14).translate(x, R.fl + (B.h + 0.06) / 2, R.zp - 0.05), W.trim, { chunk: 'room' });
  batch.add(new THREE.BoxGeometry(B.x1 - B.x0 + 0.12, 0.06, 0.14).translate((B.x0 + B.x1) / 2, R.fl + B.h + 0.03, R.zp - 0.05), W.trim, { chunk: 'room' });

  // Shadow-only proxies: thick blockers around the window so the sun's coarse shadow map cannot leak
  // light along the wall/ceiling joints. Invisible (no colour/depth writes), they only cast shadows.
  const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  proxyMat.name = 'shadow-proxy';
  const proxy = (x0, y0, z0, x1, y1, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), proxyMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = false;
    ctx.extraMeshes.push(m);
  };
  proxy(ROOM.x0 - 0.3, Wn.y1, R.zf - 0.05, ROOM.x1 + 0.3, R.ceil + 1.2, BACK.z1 + 0.6);
  proxy(ROOM.x0 - 0.3, R.ceil + 0.05, BACK.z0, ROOM.x1 + 0.3, R.ceil + 1.2, BACK.z1 + 0.6);
  proxy(Wn.x1 + 0.02, R.fl, R.zf - 0.05, ROOM.x1 + 0.3, Wn.y1, BACK.z1 + 0.6);
  proxy(ROOM.x0 - 0.3, R.fl, R.zf - 0.05, Wn.x0 - 0.02, Wn.y1, BACK.z1 + 0.6);

  peelingPaper(ctx, W.paper, rng);
  roomDecals(ctx, rng);

  // ---- Entry door ---------------------------------------------------------------------------------
  const jm = new THREE.Matrix4().makeTranslation(D.x0, R.fl, BACK.z1);
  stampParts(batch, jambParts({ depth: 0.3 }), jm);
  const doorGroup = partsToGroup(doorParts({ tint: PAL.doors[1], inside: true }));
  // Inside of the door: fire-escape map + DO NOT DISTURB hanger on the knob.
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.36), fireMapMat());
  fire.position.set(DOOR.w / 2, 1.42, -DOOR.t / 2 - 0.002);
  fire.rotation.y = Math.PI;
  doorGroup.add(fire);
  const dnd = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.24), dndMat());
  dnd.position.set(DOOR.w - 0.075, 0.86, -DOOR.t / 2 - 0.07);
  dnd.rotation.set(0.08, Math.PI, 0.05);
  doorGroup.add(dnd);
  const pivot = new THREE.Group();
  pivot.name = 'room-door';
  pivot.position.set(D.x0 + 0.005, R.fl, BACK.z1 - 0.06);
  pivot.add(doorGroup);
  ctx.extraMeshes.push(pivot);
  const door = movable({
    id: 'room-door', kind: 'hinge', object: pivot, axis: 'y', limits: [0, 1.65], physics, speed: 2.0,
    box: { size: [DOOR.w - 0.01, DOOR.h, 0.05], offset: [DOOR.w / 2, DOOR.h / 2, 0] },
    sounds: { open: 'door.open', close: 'door.creak', shut: 'door.close' }, label: 'motel.it.door',
  });
  ctx.interactables.push(door);
  room.door = door;

  // ---- Window: aluminium slider + glass, rod, blackout curtains + sheers --------------------------
  const PM = propMats();
  const wz = R.zf + 0.2; // glass plane inside the reveal
  const ww = Wn.x1 - Wn.x0;
  const wh = Wn.y1 - Wn.y0;
  const fr = (sx, sy, x, y, z) => batch.add(new THREE.BoxGeometry(sx, sy, 0.05).translate(x, y, z), M.galv, { chunk: 'room' });
  fr(ww, 0.05, (Wn.x0 + Wn.x1) / 2, Wn.y0 + 0.025, wz);
  fr(ww, 0.05, (Wn.x0 + Wn.x1) / 2, Wn.y1 - 0.025, wz);
  fr(0.05, wh, Wn.x0 + 0.025, (Wn.y0 + Wn.y1) / 2, wz);
  fr(0.05, wh, Wn.x1 - 0.025, (Wn.y0 + Wn.y1) / 2, wz);
  fr(0.05, wh, (Wn.x0 + Wn.x1) / 2, (Wn.y0 + Wn.y1) / 2, wz - 0.03);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.08, wh - 0.08), PM.glass);
  pane.position.set((Wn.x0 + Wn.x1) / 2, (Wn.y0 + Wn.y1) / 2, wz);
  ctx.extraMeshes.push(pane);
  const rodY = Wn.y1 + 0.16;
  batch.add(new THREE.CylinderGeometry(0.012, 0.012, ww + 0.5, 8).rotateZ(Math.PI / 2).translate((Wn.x0 + Wn.x1) / 2, rodY, R.zf - 0.18), M.galv, { chunk: 'room' });
  for (const x of [Wn.x0 - 0.22, Wn.x1 + 0.22]) batch.add(new THREE.BoxGeometry(0.03, 0.05, 0.18).translate(x, rodY, R.zf - 0.09), M.galv, { chunk: 'room' });
  const curtains = buildCurtains(ctx, { x0: Wn.x0 - 0.25, x1: Wn.x1 + 0.25, top: rodY - 0.02, bottom: Wn.y0 - 0.2, z: R.zf - 0.18 });
  room.curtains = curtains;

  // ---- Lights ---------------------------------------------------------------------------------------
  const shadowsOK = !!tier?.shadows && tier?.name !== 'low' && tier?.name !== 'medium';
  const L = room.lights;
  // Ceiling dome (frosted glass, dead bugs in it).
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).rotateX(Math.PI), domeMat());
  dome.position.set(206.0, R.ceil - 0.005, -48.3);
  ctx.extraMeshes.push(dome);
  L.ceiling = new THREE.PointLight(0xffd9a0, 0, 9, 1.7);
  L.ceiling.position.set(206.0, R.ceil - 0.2, -48.3);
  if (shadowsOK) {
    L.ceiling.castShadow = true;
    L.ceiling.shadow.mapSize.set(512, 512);
    L.ceiling.shadow.bias = -0.002;
    L.ceiling.shadow.camera.near = 0.1;
    L.ceiling.shadow.camera.far = 8;
  }
  L.ceilingK = 5; // candela (physically based units): a dim, cheap dome
  ctx.extraMeshes.push(L.ceiling);
  room.dome = dome;
  // Switch plates: by the door (ceiling light) and outside the bathroom (bath light).
  const plate = (x, y, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.008), mat('plastic', { color: 0xe6dcc6, wear: 0.6, dirt: 0.7, seed: 905 }));
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.014), mat('plastic', { color: 0xe6dcc6, seed: 905 }));
    toggle.position.z = 0.008;
    g.add(p, toggle);
    g.userData.toggle = toggle;
    ctx.extraMeshes.push(g);
    return g;
  };
  const sw1 = plate(R.x0 + 0.005, R.fl + 1.2, -45.75, Math.PI / 2);
  const sw2 = plate(B.x1 + 0.16, R.fl + 1.2, R.zp + 0.005, 0);
  const setDome = (on) => {
    L.ceiling.intensity = on ? L.ceilingK : 0;
    dome.material.emissiveIntensity = on ? 0.45 : 0;
    sw1.userData.toggle.rotation.x = on ? -0.35 : 0.35;
  };
  room.switches.ceiling = switcher({ id: 'room-light-switch', object: sw1, physics, box: { size: [0.08, 0.12, 0.03] }, label: 'motel.it.switch', start: false, onToggle: setDome });
  ctx.interactables.push(room.switches.ceiling);
  setDome(false);
  room.switchPlates = { bath: sw2 };

  // ---- Light spill (sun through the curtain gap by day, pink neon by night) -------------------------
  room.spill = spillQuads(ctx, curtains);

  // ---- Furniture, bathroom, clutter -------------------------------------------------------------------
  buildFurniture(ctx, room);
  buildBath(ctx, room);
  buildClutter(ctx, room);

  batch.add = batchAdd;
  ctx.extraMeshes = outerExtras;
  const roomGroup = new THREE.Group();
  roomGroup.name = 'starlite-room';
  for (const m of roomExtras) roomGroup.add(m);
  ctx.extraMeshes.push(roomGroup);
  room.group = roomGroup;

  // ---- Runtime ------------------------------------------------------------------------------------------
  const inBox = new THREE.Box3(new THREE.Vector3(ROOM.x0 - 1, Y0 - 1, R.zb - 0.5), new THREE.Vector3(ROOM.x1 + 1, R.ceil + 1, R.zf + 6));
  ctx.updaters.push((dt, clock, o, viewer, state) => {
    const near = inBox.containsPoint(viewer);
    // Interior lights only matter when the viewer is in or right outside the room.
    L.ceiling.visible = near;
    for (const it of ctx.interactables) if (it.update && it._room) it.update(dt);
    door.update(dt);
    curtains.it.update(dt);
    curtains.sheer.update(dt);
    room.spill.update(state.night, curtains, clock, near);
    for (const f of room.fx) f(dt, state, near, clock);
  });
  room.setNumber = () => {};
  return room;
}

// ---- Curtains -----------------------------------------------------------------------------------
// Two pleated blackout panels (lined, a loud 70s orange-brown print) + full-width sheers behind,
// hanging from rings. Interactable value = how far open (0 closed … 1 bunched at the ends).
function buildCurtains(ctx, { x0, x1, top, bottom, z }) {
  const span = x1 - x0;
  const half = span / 2;
  const h = top - bottom;
  const fabric = new THREE.MeshStandardMaterial({ map: curtainTex(), roughness: 0.95, side: THREE.DoubleSide });
  fabric.name = 'curtain-blackout';
  const sheerMat = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  sheerMat.name = 'curtain-sheer';
  const pleats = (w, folds, amp) => {
    const g = new THREE.PlaneGeometry(w, h, folds * 4, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      // Pleats, plus a slight belly toward the hem (heavy fabric hangs out).
      p.setZ(i, Math.sin(((x + w / 2) / w) * folds * Math.PI * 2) * amp + (1 - (y + h / 2) / h) * 0.02);
    }
    g.translate(w / 2, -h / 2, 0);
    g.computeVertexNormals();
    return g;
  };
  const left = new THREE.Mesh(pleats(half, 7, 0.035), fabric);
  const right = new THREE.Mesh(pleats(half, 7, 0.035), fabric);
  right.scale.x = -1;
  for (const m of [left, right]) m.castShadow = true;
  left.position.set(x0, top, z);
  right.position.set(x1, top, z);
  const sheerL = new THREE.Mesh(pleats(half, 9, 0.02).scale(1, 0.97, 1), sheerMat);
  const sheerR = new THREE.Mesh(pleats(half, 9, 0.02).scale(1, 0.97, 1), sheerMat);
  sheerR.scale.x = -1;
  sheerL.position.set(x0, top - 0.01, z + 0.06);
  sheerR.position.set(x1, top - 0.01, z + 0.06);
  const g = new THREE.Group();
  g.name = 'curtains';
  g.add(left, right, sheerL, sheerR);
  ctx.extraMeshes.push(g);
  const minW = 0.32 / half;
  const bunch = (l, r, v, gap) => {
    const s = 1 - v * (1 - minW);
    l.scale.set(s, 1, 1 / Math.sqrt(s));
    r.scale.set(-s, 1, 1 / Math.sqrt(s));
    // A few cm gap in the middle even when "closed" (they never quite meet).
    l.position.x = x0 - gap;
    r.position.x = x1 + gap;
  };
  const anchor = new THREE.Object3D();
  anchor.position.set((x0 + x1) / 2, top, z);
  g.add(anchor);
  const it = movable({
    id: 'curtains', kind: 'slide', object: anchor, axis: 'x', limits: [0.06, 1], start: 0.06, speed: 1.4, label: 'motel.it.curtains',
    sounds: { open: 'cloth.rustle', close: 'cloth.rustle' },
    onChange: (v) => bunch(left, right, v, 0.012),
  });
  // The slide axis moves the anchor; we only want the value — keep the anchor in place.
  const sheer = movable({
    id: 'sheers', kind: 'slide', object: new THREE.Object3D(), axis: 'x', limits: [0, 1], start: 0, speed: 1.4, label: 'motel.it.sheers',
    sounds: { open: 'cloth.rustle', close: 'cloth.rustle' },
    onChange: (v) => bunch(sheerL, sheerR, v, 0),
  });
  ctx.interactables.push(it, sheer);
  return { it, sheer, group: g, x0, x1, top, bottom, z, get gap() {
    return it.value;
  } };
}

// Additive light shafts: a soft quad on the carpet in front of the window and one on the wall
// opposite. Day: warm sun through the curtain gap; night: pink neon from the pole sign.
function spillQuads(ctx, curtains) {
  const tex = canvasTexture('room-spill', 128, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const s = g.createLinearGradient(0, 0, w, 0);
    s.addColorStop(0, 'rgba(0,0,0,1)');
    s.addColorStop(0.3, 'rgba(0,0,0,0)');
    s.addColorStop(0.7, 'rgba(0,0,0,0)');
    s.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const m = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true });
  m.name = 'room-spill';
  const cx = (curtains.x0 + curtains.x1) / 2;
  const floorMat = m.clone();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.6).rotateX(-Math.PI / 2).translate(0, 0, -1.3), floorMat);
  floor.position.set(cx, RI.fl + 0.006, RI.zf);
  floor.renderOrder = 3;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, curtains.top - curtains.bottom), m);
  glow.position.set(cx, (curtains.top + curtains.bottom) / 2, curtains.z - 0.045);
  glow.renderOrder = 3;
  ctx.extraMeshes.push(floor, glow);
  const day = new THREE.Color(0xffd9a6);
  const pink = new THREE.Color(0xff3f9e);
  const c = new THREE.Color();
  return {
    update(night, cur, clock, near) {
      glow.visible = near;
      // Indoors the real sun is dimmed (see index.js), so the beam on the carpet is faked here:
      // warm by day, pink neon by night.
      floor.visible = near;
      if (!near) return;
      // Visible gap width between the panels (metres).
      const gapW = 0.05 + cur.gap * (cur.x1 - cur.x0 - 0.64);
      floor.scale.x = night > 0.5 ? gapW + 0.9 : gapW + 0.25;
      glow.scale.x = gapW;
      const sheerK = 1 - (1 - cur.sheer.value) * 0.45;
      const hour = clock?.hourFloat ?? 12;
      // Morning sun comes from the south-east into the south-facing window.
      const sunK = Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI)) * (1 - night);
      c.copy(day).multiplyScalar(0.55 * sunK * sheerK).lerp(pink.clone().multiplyScalar(0.5 * sheerK), night);
      m.color.copy(c);
      floorMat.color.copy(day).multiplyScalar(0.45 * sunK * sheerK).lerp(pink.clone().multiplyScalar(0.16 * (0.5 + gapW)), night);
    },
  };
}

function peelingPaper(ctx, paper, rng) {
  // Curled strips where the seams let go (above the AC, by the bathroom, in the corner over the bed).
  for (const [x, y, z, ry, w] of [[207.89, RI.ceil - 0.25, -46.2, -Math.PI / 2, 0.5], [204.11, RI.ceil - 0.2, -50.4, Math.PI / 2, 0.53], [205.95, RI.fl + 1.4, RI.zp + 0.001, 0, 0.42]]) {
    const g = new THREE.PlaneGeometry(w, 0.5, 6, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const py = p.getY(i);
      const curl = Math.max(0, -py + 0.05);
      p.setZ(i, curl * curl * 1.4 + rng.range(0, 0.004));
    }
    g.computeVertexNormals();
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    m.multiply(new THREE.Matrix4().makeRotationZ(rng.range(-0.05, 0.05)));
    ctx.batch.add(g, paper, { matrix: m, chunk: 'room', castShadow: true });
    // The bare plaster where it peeled.
    ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(x, y - 0.3, z).add(new THREE.Vector3(0, 0, 0.003).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry)), normal: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry), size: [w, 0.4], rotation: 0, opacity: 0.6 });
  }
}

function roomDecals(ctx, rng) {
  const up = new THREE.Vector3(0, 1, 0);
  // Carpet: stains, a path worn from the door to the bed and bathroom, cigarette burns.
  for (const [x, z, sz] of [[205.2, -46.4, 1.3], [206.3, -49.9, 1.1], [207.0, -47.2, 0.9], [205.6, -50.8, 0.8]]) ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(x, RI.fl + 0.003, z), normal: up, size: sz, opacity: 0.22 });
  for (let i = 0; i < 6; i++) ctx.decals.push({ kind: 'burn', position: new THREE.Vector3(rng.range(204.6, 207.4), RI.fl + 0.0035, rng.range(-50.5, -46)), normal: up, size: rng.range(0.07, 0.12), opacity: 0.9 });
  // Walls: grime by the switch and along the bed, a streak under the AC.
  ctx.decals.push({ kind: 'grime', position: new THREE.Vector3(RI.x0 + 0.003, RI.fl + 1.2, -45.75), normal: new THREE.Vector3(1, 0, 0), size: 0.35, opacity: 0.5 });
  ctx.decals.push({ kind: 'streak', position: new THREE.Vector3(206.55, RI.fl + 0.45, RI.zf - 0.003), normal: new THREE.Vector3(0, 0, -1), size: [0.5, 0.8], rotation: Math.PI, opacity: 0.6 });
}

function popcornTex() {
  return canvasTexture('room-popcorn', 512, 512, (g, w, h) => {
    const r = new Rng('popcorn');
    g.fillStyle = '#e9e3d4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 200 + r.int(-35, 25);
      g.fillStyle = `rgba(${v},${v - 4},${v - 14},0.5)`;
      g.beginPath();
      g.arc(r.range(0, w), r.range(0, h), r.range(0.6, 2.2), 0, Math.PI * 2);
      g.fill();
    }
    // Yellow nicotine haze toward the bed end, and two tide-mark water stains.
    const grd = g.createRadialGradient(w * 0.3, h * 0.55, 10, w * 0.3, h * 0.55, w * 0.6);
    grd.addColorStop(0, 'rgba(180,150,80,0.22)');
    grd.addColorStop(1, 'rgba(180,150,80,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (const [x, y, s] of [[360, 150, 80], [130, 400, 55]]) {
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = `rgba(140,96,40,${0.15 + k * 0.07})`;
        g.lineWidth = 2 + (k % 2);
        g.beginPath();
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * Math.PI * 2;
          const rr = s * (1 - k * 0.16) * (1 + 0.15 * Math.sin(ang * 5 + k));
          const px = x + Math.cos(ang) * rr;
          const py = y + Math.sin(ang) * rr * 0.75;
          if (a) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(160,120,60,0.16)';
      g.beginPath();
      g.ellipse(x, y, s, s * 0.75, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function curtainTex() {
  const tex = canvasTexture('room-curtain', 256, 256, (g, w, h) => {
    g.fillStyle = '#6b3a1c';
    g.fillRect(0, 0, w, h);
    // Big 70s "harvest" medallions in orange / mustard / brown.
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const cx = (x + (y % 2) * 0.5) * (w / 2.5) + 20;
        const cy = y * (h / 2.5) + 40;
        for (let k = 4; k > 0; k--) {
          g.fillStyle = ['#3e1f0e', '#c46a1e', '#d9a23a', '#8a4a1c'][k % 4];
          g.beginPath();
          g.ellipse(cx, cy, k * 13, k * 10, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // Sun-faded vertical streaks + dust.
    for (let x = 0; x < w; x += 3) {
      g.fillStyle = `rgba(255,230,190,${Math.random() * 0.06})`;
      g.fillRect(x, 0, 2, h);
    }
  }, { repeat: true });
  tex.repeat.set(2.2, 1.6);
  return tex;
}

function domeMat() {
  const m = new THREE.MeshStandardMaterial({ map: canvasTexture('room-dome', 128, 128, (g, w, h) => {
    g.fillStyle = '#f3ead2';
    g.fillRect(0, 0, w, h);
    // Dead bugs collected in the bottom of the bowl.
    g.fillStyle = 'rgba(40,30,20,0.85)';
    const r = new Rng('bugs');
    for (let i = 0; i < 26; i++) g.fillRect(w / 2 + r.range(-22, 22), h / 2 + r.range(-22, 22), r.range(2, 5), r.range(1, 3));
  }), emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.6, transparent: true, opacity: 0.92 });
  m.emissiveMap = m.map;
  m.name = 'room-dome';
  return m;
}

function fireMapMat() {
  return plaqueMat('fire-map', 256, 330, (g, w, h) => {
    g.fillStyle = '#f1ede2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b81d1d';
    g.fillRect(0, 0, w, 40);
    g.fillStyle = '#fff';
    g.font = '400 30px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.fillText(t('motel.fireMap'), w / 2, 30);
    // Floor plan: L of rooms, stairs, arrows.
    g.strokeStyle = '#222';
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) g.strokeRect(14 + i * 26, 70, 26, 50);
    for (let i = 0; i < 6; i++) g.strokeRect(14 + 8 * 26 + 4, 124 + i * 22, 22 * 1.6, 22);
    g.fillStyle = '#b81d1d';
    g.beginPath();
    g.arc(14 + 5 * 26 + 13, 112, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1f7a2a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(14 + 5 * 26 + 13, 125);
    g.lineTo(14 + 5 * 26 + 13, 150);
    g.lineTo(60, 150);
    g.lineTo(60, 250);
    g.stroke();
    g.fillStyle = '#222';
    g.font = '600 11px "Inter", sans-serif';
    t('motel.fireMapSmall').split(' · ').forEach((ln, i) => g.fillText(ln, w / 2, 272 + i * 15));
    g.font = 'italic 400 11px "Special Elite", monospace';
    g.fillText(t('motel.noElevator'), w / 2, 322);
  });
}

function dndMat() {
  return plaqueMat('dnd', 128, 300, (g, w, h) => {
    g.fillStyle = '#c8202a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(w / 2, 40, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8202a';
    g.beginPath();
    g.arc(w / 2, 40, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = '400 22px "Bebas Neue", sans-serif';
    g.fillText(t('motel.dndSmall'), w / 2, 100);
    g.save();
    g.translate(w / 2, 200);
    g.rotate(-Math.PI / 2);
    g.font = '400 36px "Bebas Neue", sans-serif';
    g.fillText(t('motel.dnd'), 0, 12);
    g.restore();
  });
}
