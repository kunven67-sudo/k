// Walkable-area map (navmesh) + crowd steering for humans, with Recast/Detour.
// The navmesh is baked from the same triangles as the physics world, so humans
// only walk where you can walk; the crowd makes them step around each other
// instead of bumping or overlapping.
import { init as initRecast, Crowd, NavMeshQuery } from '@recast-navigation/core';
import { generateSoloNavMesh, generateTileCache } from '@recast-navigation/generators';
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
  constructor({ halfExtents = { x: 2, y: 4, z: 2 } } = {}) {
    this.navMesh = null;
    this.query = null;
    this.crowd = null;
    this.tileCache = null;  // set when built with obstacles (things built later block the way)
    this.halfExtents = halfExtents;
  }

  // bake from any number of object trees (the level's static geometry) or
  // ready-made {vertices, indices} triangle soups (world space)
  build(roots, overrides = {}, { obstacles = 0, maxAgentRadius = 0.6, tileSize = 48 } = {}) {
    const vs = [];
    const is = [];
    for (const root of [].concat(roots)) {
      const { vertices, indices } = root.isObject3D ? collectTriangles(root) : root;
      const base = vs.length / 3;
      for (const v of vertices) vs.push(v);
      for (const i of indices) is.push(i + base);
    }
    const config = { ...CONFIG, ...overrides };
    const r = obstacles
      ? generateTileCache(vs, is, { ...config, tileSize, expectedLayersPerTile: 4, maxObstacles: obstacles })
      : generateSoloNavMesh(vs, is, config);
    if (!r.success) throw new Error(`navmesh build failed: ${r.error}`);
    this.navMesh = r.navMesh;
    this.tileCache = r.tileCache || null;
    this.query = new NavMeshQuery(r.navMesh);
    this.crowd = new Crowd(r.navMesh, { maxAgents: 128, maxAgentRadius });
    return this;
  }

  // Something now stands here (a new hut): paths go around it from the next update.
  // Cylinder: {radius, height}; box: {half: {x,y,z}, angle}. p = bottom center.
  addObstacle(p, { radius, height = 0.1, half, angle = 0 } = {}) {
    if (!this.tileCache) return null;
    const r = half
      ? this.tileCache.addBoxObstacle({ x: p.x, y: p.y + half.y, z: p.z }, half, angle)
      : this.tileCache.addCylinderObstacle(p, radius, height);
    this.dirty = true;
    return r.success ? r.obstacle : null;
  }

  removeObstacle(o) {
    if (!o || !this.tileCache) return;
    this.tileCache.removeObstacle(o);
    this.dirty = true;
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

  closest(p, halfExtents = this.halfExtents) {
    const r = this.query?.findClosestPoint(p, { halfExtents });
    return r?.success && r.polyRef ? r.point : null;
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
    if (this.dirty && this.tileCache) {
      // rebuild the tiles the new/removed obstacles touch (a few per frame at most)
      for (let i = 0; i < 4; i++) {
        const r = this.tileCache.update(this.navMesh);
        if (r.upToDate) { this.dirty = false; break; }
      }
    }
    this.crowd?.update(dt);
  }
}
