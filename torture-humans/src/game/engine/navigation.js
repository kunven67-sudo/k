// Walkable-area map (navmesh) + crowd steering for humans, with Recast/Detour.
// The navmesh is baked from the same triangles as the physics world, so humans
// only walk where you can walk; the crowd makes them step around each other
// instead of bumping or overlapping.
import { init as initRecast, Crowd, NavMeshQuery } from '@recast-navigation/core';
import { generateSoloNavMesh } from '@recast-navigation/generators';
import { collectTriangles } from './physics.js';

let ready = null;
export function initNavigation() {
  ready ??= initRecast();
  return ready;
}

// Recast settings for real human sizes (meters)
const CONFIG = {
  cs: 0.1,                 // cell size: 10 cm grid
  ch: 0.05,                // cell height
  walkableSlopeAngle: 45,
  walkableHeight: 18,      // 1.8 m of headroom (in ch units = 0.05 m)
  walkableClimb: 7,        // 35 cm steps (ch units)
  walkableRadius: 3,       // 30 cm from walls (cs units)
  maxEdgeLen: 120,
  maxSimplificationError: 1.2,
  minRegionArea: 6,
  mergeRegionArea: 30,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
};

export class Navigation {
  constructor() {
    this.navMesh = null;
    this.query = null;
    this.crowd = null;
  }

  // bake from any number of object trees (the level's static geometry)
  build(roots, overrides = {}) {
    const vs = [];
    const is = [];
    for (const root of [].concat(roots)) {
      const { vertices, indices } = collectTriangles(root);
      const base = vs.length / 3;
      for (const v of vertices) vs.push(v);
      for (const i of indices) is.push(i + base);
    }
    const { success, navMesh, error } = generateSoloNavMesh(vs, is, { ...CONFIG, ...overrides });
    if (!success) throw new Error(`navmesh build failed: ${error}`);
    this.navMesh = navMesh;
    this.query = new NavMeshQuery(navMesh);
    this.crowd = new Crowd(navMesh, { maxAgents: 128, maxAgentRadius: 0.6 });
    return this;
  }

  addAgent(position, { radius = 0.3, height = 1.8, maxSpeed = 1.4, maxAcceleration = 6 } = {}) {
    const p = this.closest(position) || position;
    return this.crowd.addAgent(p, {
      radius, height, maxSpeed, maxAcceleration,
      collisionQueryRange: radius * 12,
      pathOptimizationRange: radius * 30,
      separationWeight: 1.5,
      updateFlags: 0b11111, // anticipate turns, obstacle avoidance, separation, visibility + topology optimisation
      obstacleAvoidanceType: 3,
    });
  }

  removeAgent(agent) {
    this.crowd?.removeAgent(agent);
  }

  closest(p) {
    const r = this.query?.findClosestPoint(p, { halfExtents: { x: 2, y: 4, z: 2 } });
    return r?.success ? r.point : null;
  }

  // a random walkable spot; `accept(point)` can limit it (e.g. only inside the lab)
  randomPoint(accept = null, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const r = this.query?.findRandomPoint();
      if (r?.success && (!accept || accept(r.randomPoint))) return r.randomPoint;
    }
    return null;
  }

  path(from, to) {
    const r = this.query?.computePath(from, to);
    return r?.success ? r.path : null;
  }

  update(dt) {
    this.crowd?.update(dt);
  }
}
