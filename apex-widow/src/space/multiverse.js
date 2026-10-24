// (placeholder while the full world is being built)
import * as THREE from 'three';
import { SpaceZone } from './spacezone.js';
export class MultiverseZone extends SpaceZone {
  constructor(game) { super(game, 'multiverse', 'The Multiverse', 1e24); }
  async build() { this.baseScene(); }
  enter() { this.placePlayer(new THREE.Vector3(0, 0, 0)); }
}
