// (placeholder while the full world is being built)
import * as THREE from 'three';
import { SpaceZone } from './spacezone.js';
export class UniverseZone extends SpaceZone {
  constructor(game) { super(game, 'universe', 'The Universe', 1e18); }
  async build() { this.baseScene(); }
  enter() { this.placePlayer(new THREE.Vector3(0, 0, 0)); }
}
