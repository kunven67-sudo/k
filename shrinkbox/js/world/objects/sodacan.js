// 12 oz soda can (6.6 cm x 12.2 cm). Hollow aluminium with a real opening in the lid.
// Inside: soda. When you're tiny the surface acts like a bouncy skin (surface tension - push
// through by holding crouch), the soda feels thick like honey, the bubbles push you up and you
// come out sticky. Tip the can over and it spills.
import * as THREE from 'three';
import { Thing, coneWall, diskStrips, lathe } from '../thing.js';
import { defMat, drawTexture } from '../../core/materials.js';
import { R, world, groups, G } from '../../core/physics.js';
import { loop, sfx, vol3d } from '../../core/audio.js';

const RC = 0.033, HC = 0.122;

function labelTex() {
  return drawTexture(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#b3121b'); g.addColorStop(0.5, '#e01d26'); g.addColorStop(1, '#a10f17');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 10;
    c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.62 + Math.sin(x / w * Math.PI * 4) * 22); c.stroke();
    c.fillStyle = '#fff'; c.font = 'italic 900 150px sans-serif'; c.textAlign = 'center';
    c.fillText('FIZZ', w * 0.27, h * 0.5); c.fillText('FIZZ', w * 0.77, h * 0.5);
    c.font = 'bold 34px sans-serif'; c.fillText('ORIGINAL COLA', w * 0.27, h * 0.8); c.fillText('12 FL OZ (355 mL)', w * 0.77, h * 0.8);
    c.font = '20px sans-serif'; c.fillStyle = 'rgba(255,255,255,.8)'; c.fillText('140 CALORIES · 39g SUGAR', w * 0.52, h * 0.94);
  }, 'fizzLabel');
}

export function buildSodaCan(game, pos, { open = true, fill = 0.55, rot = [0, 0, 0] } = {}) {
  const can = new Thing({ name: 'Soda can', type: 'dynamic', density: 2700, pos, rot, surface: 'metal', icon: '🥤', spawnId: 'soda', tags: ['enterable', 'container'] });
  const wallT = 0.0006; // real cans are ~0.1 mm; a bit thicker so physics never tunnels
  // ---- visual: outer body with label, inner walls (you can see them from inside) ----
  const prof = [[0.001, 0.0], [0.024, 0.0], [0.029, 0.004], [RC, 0.012], [RC, 0.108], [0.0285, 0.118], [0.0275, 0.1215], [0.0272, HC]];
  const outer = lathe(prof, 64);
  const labelMat = defMat('fizzLabelMat', () => new THREE.MeshStandardMaterial({ map: labelTex(), metalness: 0.65, roughness: 0.3 }));
  // map label UVs: v from y range 0.012..0.108
  const uv = outer.attributes.uv, p = outer.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (p.getY(i) - 0.012) / 0.096);
  can.geo(outer, [0, 0, 0], labelMat, { collide: false });
  const innerProf = prof.map(([r, y]) => [Math.max(0.0005, r - wallT), y + (y < 0.01 ? wallT : 0)]).reverse();
  const inner = lathe(innerProf, 48);
  can.geo(inner, [0, 0, 0], defMat('canInside', () => new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.35, side: THREE.DoubleSide })), { collide: false });
  // lid (recessed) with the opening + rim + pull tab
  const lidY = 0.1195;
  const lid = new THREE.CircleGeometry(0.0268, 48); lid.rotateX(-Math.PI / 2);
  const hole = [-0.0085, 0.006, 0.0085, 0.02]; // opening near one edge (x0, z0, x1, z1)
  if (open) {
    // cut the opening out of the lid visual (remove triangles whose center is inside the hole)
    const lp = lid.attributes.position, idx = lid.index.array, keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += lp.getX(idx[i + k]) / 3; cz += lp.getZ(idx[i + k]) / 3; }
      if (!(cx > hole[0] && cx < hole[2] && cz > hole[1] && cz < hole[3])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    lid.setIndex(keep);
  }
  can.geo(lid, [0, lidY, 0], defMat('canLid', () => new THREE.MeshStandardMaterial({ color: 0xd4d7dc, metalness: 1, roughness: 0.25, side: THREE.DoubleSide })), { collide: false, cut: 'lid' });
  const rim = new THREE.TorusGeometry(0.0272, 0.0011, 8, 64); rim.rotateX(Math.PI / 2);
  can.geo(rim, [0, HC - 0.001, 0], 'alu', { collide: false });
  can.box([0.012, 0.0008, 0.021], [0, lidY + 0.0012, -0.004], 'alu', { collide: false, rot: [open ? -0.25 : 0, 0, 0], cut: 'lid' }); // tab
  can.cyl(0.0018, 0.001, [0, lidY + 0.0008, 0.002], 'alu', { collide: false, cut: 'lid' });

  // ---- collision: real hollow shape ----
  coneWall(can, { r0: 0.024, y0: 0, r1: 0.029, y1: 0.004, thick: wallT * 2 });
  coneWall(can, { r0: 0.029, y0: 0.004, r1: RC, y1: 0.012, thick: wallT * 2 });
  coneWall(can, { r0: RC, y0: 0.012, r1: RC, y1: 0.108, thick: wallT * 2, seg: 28 });
  coneWall(can, { r0: RC, y0: 0.108, r1: 0.0285, y1: 0.118, thick: wallT * 2 });
  coneWall(can, { r0: 0.0285, y0: 0.118, r1: 0.0272, y1: HC, thick: wallT * 2 });
  diskStrips(can, { r: 0.0245, y: 0.0025, thick: 0.001, strip: 0.004 }); // bottom (dome is simplified flat inside)
  diskStrips(can, { r: 0.027, y: lidY, thick: 0.0008, strip: 0.0025, hole: open ? hole : null, o: { cut: 'lid' } });
  can.build(game.engine.scene);

  // ---- the soda ----
  can.fill = fill;
  can.open = open;
  can.liquidTop = () => 0.004 + can.fill * 0.104;
  const sodaMat = defMat('soda', () => new THREE.MeshPhysicalMaterial({ color: 0x3a1608, roughness: 0.08, transmission: 0.4, thickness: 0.03, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: true }));
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(RC - wallT * 1.5, RC - wallT * 1.5, 1, 40, 1, false), sodaMat);
  liquid.geometry.translate(0, 0.5, 0);
  liquid.position.y = 0.004;
  can.group.add(liquid);
  can.liquidMesh = liquid;
  // bubbles rising from the bottom (CO2 coming out of the soda)
  const nB = 160, bg = new THREE.BufferGeometry(), bp = new Float32Array(nB * 3);
  for (let i = 0; i < nB; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * RC * 0.9; bp[i * 3] = Math.cos(a) * r; bp[i * 3 + 1] = Math.random() * 0.1; bp[i * 3 + 2] = Math.sin(a) * r; }
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xe8d8c0, size: 0.0012, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false }));
  can.group.add(bubbles);
  can.bubbles = bubbles;
  // surface tension "skin" - only tiny-you can stand on it
  can.skin = world.createCollider(R.ColliderDesc.cylinder(0.0004, RC - wallT * 2).setTranslation(0, can.liquidTop(), 0)
    .setCollisionGroups(groups(G.SKIN, G.PLAYER)).setFriction(0.2), can.body);
  can.skin.isSkin = true;
  // the soda itself weighs ~370 g when full (realistic) and sits low -> the can stands steady
  can.setLiquidMass = () => {
    const top = can.liquidTop(), h = Math.max(0, top - 0.004), k = can.scale;
    const vol = Math.PI * (RC - 0.001) ** 2 * h * k ** 3, m = vol * 1040;
    const I = m * (RC * k) ** 2 / 2;
    can.body.setAdditionalMassProperties(m, { x: 0, y: (0.004 + h / 2) * k, z: 0 }, { x: I, y: I, z: I }, { x: 0, y: 0, z: 0, w: 1 }, true);
    can._massFill = can.fill;
  };
  can.setLiquidMass();
  can.behaviors.push(canBehavior);
  can.enclosure = new THREE.Box3(new THREE.Vector3(-RC, 0.002, -RC), new THREE.Vector3(RC, HC, RC));
  return can;
}

const _v = new THREE.Vector3(), _up = new THREE.Vector3();
const canBehavior = {
  onScale(can) { can.setLiquidMass(); can.skin.setRadius((RC - 0.0012) * can.scale); },
  update(can, dt, game) {
    const p = game.player, s = p.s;
    // spill when tipped over (realistic: open cans pour out)
    _up.set(0, 1, 0).applyQuaternion(can.group.quaternion);
    if (can.open && _up.y < 0.25 && can.fill > 0) {
      can.fill = Math.max(0, can.fill - dt * 0.35);
      if (!can._spilled) { can._spilled = true; sfx.splash(0.4); game.spill?.(can.position(_v.clone())); }
    }
    if (Math.abs(can.fill - can._massFill) > 0.02) can.setLiquidMass();
    const top = can.liquidTop();
    can.liquidMesh.scale.y = Math.max(0.0001, top - 0.004);
    can.liquidMesh.visible = can.fill > 0.01;
    // the skin follows the soda level; only on when you're tiny (surface tension wins over weight)
    const tinyEnough = p.height < 0.006;
    can.skin.setTranslationWrtParent({ x: 0, y: top * can.scale, z: 0 });
    can.skin.setEnabled(tinyEnough && can.fill > 0.02 && !can._broke && _up.y > 0.8);
    // bubbles drift up
    const bp = can.bubbles.geometry.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      let y = bp.getY(i) + dt * (0.004 + (i % 7) * 0.0012);
      if (y > top) y = 0.005;
      bp.setY(i, y);
    }
    bp.needsUpdate = true;
    can.bubbles.visible = can.fill > 0.02 && p.feet.distanceTo(can.position(_v)) < 0.6;

    // player in the soda?
    const local = can.group.worldToLocal(p.center(_v.clone()));
    const feetLocal = can.group.worldToLocal(p.feet.clone());
    const inside = Math.hypot(local.x, local.z) < RC && local.y > 0 && local.y < HC;
    if (inside) { game.inside = can; game.insideEcho = 0.6; }
    const sub = can.fill > 0.01 && Math.hypot(feetLocal.x, feetLocal.z) < RC && feetLocal.y < top && feetLocal.y > 0;
    if (sub) {
      const tiny = p.height < 0.01;
      p.inLiquid = { swimMul: tiny ? 0.22 : 0.55, drag: tiny ? 9 : 3, sink: tiny ? 0.05 : 0.2, name: 'soda' };
      p.extForce.y += 9.81 * s * (tiny ? 0.55 : 0.15); // bubbles carry you up
      p.sticky = Math.min(0.7, p.sticky + dt * 0.3);
      if (!can._inSnd) { can._inSnd = true; sfx.splash(0.5); }
      if (!game._sodaTip) { game._sodaTip = 1; game.ui.toast(tiny ? '🥤 Soda feels thick like honey when you\'re this small. Bubbles push you up!' : '🥤 You\'re swimming in soda'); }
    } else if (can._inSnd) { can._inSnd = false; }
    // standing on the skin: hold crouch to push through
    if (tinyEnough && p.grounded && Math.abs(feetLocal.y - top) < p.height * 0.3 && inside) {
      can._push = (can._push || 0) + (p.crouchT > 0.5 ? dt : -dt);
      if (!game._skinTip) { game._skinTip = 1; game.ui.toast('🫧 Surface tension! The soda is like a trampoline. Hold CROUCH to push through'); }
      if (p.vel.y < -0.5 * s) p.vel.y *= -0.4;
      if (can._push > 1.2) { can._broke = true; can._push = 0; sfx.splash(0.6); }
    }
    if (!sub && can._broke && feetLocal.y > top + p.height) can._broke = false;
    // fizz sound
    if (!can.fizz) can.fizz = loop('fizz');
    const d = can.position(_v).distanceTo(p.feet);
    can.fizz.set(can.open && can.fill > 0.02 ? vol3d(d, 0.12 * Math.min(1, 0.01 / Math.max(s, 0.001)), s) * 0.25 : 0);
  },
};
