// Rapier physics wrapper. Objects are built from REAL-SHAPE pieces (boxes, cylinders, hulls,
// triangle meshes) so you can walk on / into the actual shape of things - no invisible boxes.
import RAPIER from '@dimforge/rapier3d-compat';

export let R = null;
export let world = null;
export const handleToThing = new Map(); // collider handle -> game object

export async function initPhysics() {
  await RAPIER.init();
  R = RAPIER;
  world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  // tolerances follow the player's size (see setLengthUnit) so tiny contacts stay crisp
  setLengthUnit(1);
  return world;
}

let curUnit = 0;
export function setLengthUnit(u) {
  if (Math.abs(u - curUnit) / u < 0.05) return;
  curUnit = u;
  world.lengthUnit = u;
  world.numSolverIterations = 4;
}

export function step() { world.step(); }

// Collision groups: membership (high 16 bits) / filter (low 16 bits)
export const G = {
  WORLD: 0x0001, PLAYER: 0x0002, PROP: 0x0004, SENSOR: 0x0008, CREATURE: 0x0010, DEBRIS: 0x0020, SKIN: 0x0040,
};
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

// Collider desc from a part spec. Sizes are in meters and already multiplied by `scale`.
export function colliderDesc(part, scale = 1) {
  const s = scale;
  let d;
  switch (part.shape) {
    case 'box': d = R.ColliderDesc.cuboid(part.size[0] / 2 * s, part.size[1] / 2 * s, part.size[2] / 2 * s); break;
    case 'rbox': {
      const r = Math.min(part.radius || 0, part.size[0] / 2, part.size[1] / 2, part.size[2] / 2) * s * 0.9;
      d = r > 0 ? R.ColliderDesc.roundCuboid(part.size[0] / 2 * s - r, part.size[1] / 2 * s - r, part.size[2] / 2 * s - r, r)
        : R.ColliderDesc.cuboid(part.size[0] / 2 * s, part.size[1] / 2 * s, part.size[2] / 2 * s);
      break;
    }
    case 'cyl': d = R.ColliderDesc.cylinder(part.h / 2 * s, part.r * s); break;
    case 'ball': d = R.ColliderDesc.ball(part.r * s); break;
    case 'capsule': d = R.ColliderDesc.capsule(part.h / 2 * s, part.r * s); break;
    case 'hull': {
      const pts = new Float32Array(part.points.length);
      for (let i = 0; i < pts.length; i++) pts[i] = part.points[i] * s;
      d = R.ColliderDesc.convexHull(pts);
      break;
    }
    case 'trimesh': {
      const v = new Float32Array(part.vertices.length);
      for (let i = 0; i < v.length; i++) v[i] = part.vertices[i] * s;
      d = R.ColliderDesc.trimesh(v, part.indices);
      break;
    }
    default: throw new Error('bad shape ' + part.shape);
  }
  if (!d) return null;
  const p = part.pos || [0, 0, 0];
  d.setTranslation(p[0] * s, p[1] * s, p[2] * s);
  if (part.quat) d.setRotation({ x: part.quat[0], y: part.quat[1], z: part.quat[2], w: part.quat[3] });
  d.setFriction(part.friction ?? 0.7);
  d.setRestitution(part.bounce ?? 0.05);
  if (part.sensor) d.setSensor(true);
  return d;
}
