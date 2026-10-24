// (placeholder while the full world is being built)
import * as THREE from 'three';
import { SpaceZone } from './spacezone.js';
export class EarthZone extends SpaceZone {
  constructor(game) { super(game, 'earth', 'Earth', 1000); }
  async build() { this.baseScene(); }
  enter() { this.placePlayer(new THREE.Vector3(0, 0, 0)); }
}
