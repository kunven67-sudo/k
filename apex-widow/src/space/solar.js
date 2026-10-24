// (placeholder while the full world is being built)
import * as THREE from 'three';
import { SpaceZone } from './spacezone.js';
export class SolarZone extends SpaceZone {
  constructor(game) { super(game, 'solar', 'The Solar System', 1e6); }
  async build() { this.baseScene(); }
  enter() { this.placePlayer(new THREE.Vector3(0, 0, 0)); }
}
