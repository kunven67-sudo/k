// (placeholder while the full world is being built)
import * as THREE from 'three';
import { SpaceZone } from './spacezone.js';
export class GalaxyZone extends SpaceZone {
  constructor(game) { super(game, 'galaxy', 'The Milky Way', 1e12); }
  async build() { this.baseScene(); }
  enter() { this.placePlayer(new THREE.Vector3(0, 0, 0)); }
}
