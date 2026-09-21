// First-person controller: WASD movement + mouse look (PointerLockControls) + E-interact
// raycasting + simple circle-vs-AABB collision against static room/furniture colliders.
import * as THREE from 'three';
import { PointerLockControls } from './vendor/three/examples/jsm/controls/PointerLockControls.js';
import { EYE_HEIGHT, PLAYER_RADIUS } from './utils.js';
import { getSettings, onSettingsChange } from './settings.js';
import { playFootstep } from './audio.js';

export class FirstPersonController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = getSettings().sensitivity;
    this._unsubSettings = onSettingsChange(s => { this.controls.pointerSpeed = s.sensitivity; });

    this.move = { forward: false, back: false, left: false, right: false };
    this.colliders = [];
    this.speed = 3.3; // meters/sec
    this.footstepSurface = 'wood';
    this.enabled = false;
    this.isMoving = false;
    this._footstepTimer = 0;
    this._raycaster = new THREE.Raycaster();
    this._fwd = new THREE.Vector3();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.controls.addEventListener('lock', () => { this.enabled = true; });
    this.controls.addEventListener('unlock', () => { this.enabled = false; this._clearMove(); });
  }

  _clearMove() { this.move.forward = this.move.back = this.move.left = this.move.right = false; }

  _onKeyDown(e) {
    if (!this.enabled) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.move.forward = true; break;
      case 'KeyS': case 'ArrowDown': this.move.back = true; break;
      case 'KeyA': case 'ArrowLeft': this.move.left = true; break;
      case 'KeyD': case 'ArrowRight': this.move.right = true; break;
    }
  }
  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.move.forward = false; break;
      case 'KeyS': case 'ArrowDown': this.move.back = false; break;
      case 'KeyA': case 'ArrowLeft': this.move.left = false; break;
      case 'KeyD': case 'ArrowRight': this.move.right = false; break;
    }
  }

  setColliders(list) { this.colliders = list || []; }

  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }
  get isLocked() { return this.controls.isLocked; }

  setPosition(x, y, z) { this.camera.position.set(x, y === undefined ? EYE_HEIGHT : y, z); }

  setYaw(yawRadians) {
    // Face a given horizontal direction on scene entry, keeping the camera upright.
    this.camera.rotation.set(0, yawRadians, 0, 'YXZ');
  }

  _collidesAt(x, z) {
    for (let i = 0; i < this.colliders.length; i++) {
      const box = this.colliders[i];
      const cx = Math.max(box.min.x, Math.min(x, box.max.x));
      const cz = Math.max(box.min.z, Math.min(z, box.max.z));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS) return true;
    }
    return false;
  }

  update(dt) {
    if (!this.enabled || !this.controls.isLocked) { this.isMoving = false; return; }
    const cam = this.camera;
    let moved = false;

    let fwdInput = 0;
    if (this.move.forward) fwdInput += 1;
    if (this.move.back) fwdInput -= 1;
    if (fwdInput !== 0) {
      const px = cam.position.x, pz = cam.position.z;
      this.controls.moveForward(fwdInput * this.speed * dt);
      if (this._collidesAt(cam.position.x, cam.position.z)) { cam.position.x = px; cam.position.z = pz; }
      else moved = true;
    }

    let strafeInput = 0;
    if (this.move.right) strafeInput += 1;
    if (this.move.left) strafeInput -= 1;
    if (strafeInput !== 0) {
      const px = cam.position.x, pz = cam.position.z;
      this.controls.moveRight(strafeInput * this.speed * dt);
      if (this._collidesAt(cam.position.x, cam.position.z)) { cam.position.x = px; cam.position.z = pz; }
      else moved = true;
    }

    this.isMoving = moved;
    if (moved) {
      this._footstepTimer -= dt;
      if (this._footstepTimer <= 0) {
        playFootstep(this.footstepSurface);
        this._footstepTimer = 0.38;
      }
    } else {
      this._footstepTimer = 0;
    }
  }

  // Raycasts from the camera forward against a list of {object, ...} interactables and
  // returns the nearest one within range, or null. `object` may be a Mesh or a Group.
  getInteractable(interactables, maxDist = 3.2) {
    if (!interactables || interactables.length === 0) return null;
    this.camera.getWorldDirection(this._fwd);
    this._raycaster.set(this.camera.position, this._fwd);
    this._raycaster.far = maxDist;
    const meshes = [];
    const map = this._interactMap || (this._interactMap = new Map());
    map.clear();
    for (const it of interactables) {
      if (it.enabled === false) continue;
      it.object.traverse(o => { if (o.isMesh) { meshes.push(o); map.set(o, it); } });
    }
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return map.get(hits[0].object) || null;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this._unsubSettings) this._unsubSettings();
    this.controls.disconnect();
  }
}
