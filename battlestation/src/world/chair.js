import * as THREE from 'three';
import { mesh, box, cyl } from './build.js';
import { pbr, paint } from './materials.js';

// Racing-style gaming chair: 5-star base on casters, gas lift, bolstered seat + backrest,
// headrest and lumbar pillows, armrests. You sit facing local -z.
export async function buildChair(ctx) {
  const g = new THREE.Group();
  g.name = 'chair';
  const leather = await pbr('fabric_leather_02', { color: 0x1a1a1c, roughness: 0.9, normal: 0.7, scale: 0.5 });
  const accent = await pbr('fabric_leather_02', { color: 0x7a1218, roughness: 0.9, normal: 0.7, scale: 0.5 });
  const plastic = paint(0x101012, 0.45);
  const chrome = paint(0xcfd2d6, 0.15, 1);

  // base
  const swivel = new THREE.Group();
  g.add(swivel);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = mesh(box(0.33, 0.035, 0.05, 0.012), plastic, { parent: g });
    leg.position.set(Math.cos(a) * 0.16, 0.085, Math.sin(a) * 0.16);
    leg.rotation.y = -a;
    const caster = mesh(cyl(0.028, 0.028, 0.022, 20), plastic, { parent: g, rot: [Math.PI / 2, 0, 0] });
    caster.position.set(Math.cos(a) * 0.32, 0.028, Math.sin(a) * 0.32);
    caster.rotation.y = -a;
  }
  mesh(cyl(0.035, 0.045, 0.05, 24), plastic, { parent: g, pos: [0, 0.095, 0] });
  mesh(cyl(0.025, 0.025, 0.3, 24), chrome, { parent: g, pos: [0, 0.26, 0] });
  mesh(cyl(0.032, 0.032, 0.12, 24), plastic, { parent: g, pos: [0, 0.18, 0] });

  // everything above the gas lift swivels
  const top = new THREE.Group();
  top.position.y = 0.42;
  swivel.add(top);
  mesh(box(0.3, 0.03, 0.3, 0.01), plastic, { parent: top, pos: [0, 0.015, 0] });
  // seat with side bolsters
  mesh(box(0.38, 0.09, 0.5, 0.04, 4), accent, { parent: top, pos: [0, 0.075, 0] });
  for (const sx of [-1, 1]) {
    const b = mesh(box(0.08, 0.11, 0.5, 0.035, 4), leather, { parent: top, pos: [sx * 0.22, 0.085, 0] });
    b.rotation.z = sx * -0.18;
  }
  // backrest (tilted back)
  const back = new THREE.Group();
  back.position.set(0, 0.11, 0.24);
  back.rotation.x = 0.17;
  top.add(back);
  mesh(box(0.34, 0.78, 0.09, 0.04, 4), accent, { parent: back, pos: [0, 0.41, 0.02] });
  for (const sx of [-1, 1]) {
    const w = mesh(box(0.1, 0.78, 0.12, 0.045, 4), leather, { parent: back, pos: [sx * 0.21, 0.4, 0.01] });
    w.rotation.y = sx * 0.28;
    const sh = mesh(box(0.13, 0.14, 0.1, 0.045, 4), leather, { parent: back, pos: [sx * 0.19, 0.83, 0.03] });
    sh.rotation.z = sx * 0.2;
  }
  mesh(box(0.52, 0.86, 0.025, 0.012), leather, { parent: back, pos: [0, 0.45, 0.075] });
  // pillows
  mesh(box(0.22, 0.12, 0.08, 0.04, 4), leather, { parent: back, pos: [0, 0.8, -0.04] });
  mesh(box(0.26, 0.15, 0.07, 0.04, 4), leather, { parent: back, pos: [0, 0.2, -0.04] });
  // armrests
  for (const sx of [-1, 1]) {
    mesh(box(0.04, 0.2, 0.06, 0.01), plastic, { parent: top, pos: [sx * 0.27, 0.15, 0.05] });
    mesh(box(0.085, 0.03, 0.26, 0.012), plastic, { parent: top, pos: [sx * 0.27, 0.26, 0.02] });
  }
  ctx.interact.block(g);
  const chair = { group: g, swivel: top, seatY: 0.42 + 0.12, armY: 0.42 + 0.275, yaw: 0 };
  chair.collider = ctx.physics.add({ x: 0, z: 0, hx: 0.3, hz: 0.3, y0: 0, y1: 1.3 });
  chair.syncCollider = () => { chair.collider.x = g.position.x; chair.collider.z = g.position.z; };
  return chair;
}
