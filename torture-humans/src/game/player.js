// The mad scientist: physics capsule + animated body + first/third person camera.
// First person keeps your full body (you see your arms, legs and shadow) and hides
// only the head so it never blocks the view. Third person uses a spring-arm camera
// that pulls in when a wall is behind you, so it never clips through walls.
import * as THREE from 'three';
import { GROUP } from './engine/physics.js';
import { LadderClimb } from './ladder.js';

const WALK = 1.45;
const RUN = 3.6;
const CROUCH = 0.8;
const ACCEL = 10;          // how fast you reach full speed (1/s)
const AIR_CONTROL = 0.25;
const JUMP_SPEED = 4.6;
const GRAVITY = 9.81;
const STAND_H = 1.8;
const CROUCH_H = 1.15;
const EYE = 0.09;          // eyes are this far below the top of the head

export class Player {
  constructor({ physics, input, settings, camera, character, scene, position = new THREE.Vector3(0, 0, 0) }) {
    this.physics = physics;
    this.input = input;
    this.settings = settings;
    this.camera = camera;
    this.character = character;
    this.scene = scene;
    this.body = physics.createCharacter({ radius: 0.28, height: STAND_H, position, group: GROUP.PLAYER });
    this.velocity = new THREE.Vector3();
    this.yaw = 0;           // camera yaw
    this.pitch = 0;
    this.bodyYaw = 0;       // where the body faces
    this.grounded = true;
    this.crouching = false;
    this.mode = settings.get('gameplay.camera') || 'first';
    this.camDistance = 2.6;
    this.camCurrentDist = 2.6;
    this.scale = 1;         // 1 = normal size (shrinking changes this)
    this.headBone = character.bones.Bip01_Head;
    this.frozen = false;    // cutscene-free scripted moves (ladder) take over when true
    this.queued = { jump: false, interact: false };
    scene.add(character.root);
    this.renderPos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    const t = this.body.body.translation();
    this.prevPos.set(t.x, t.y, t.z);
    this.currPos.copy(this.prevPos);
  }

  get feet() {
    return new THREE.Vector3(this.renderPos.x, this.renderPos.y - this.body.height / 2, this.renderPos.z);
  }

  toggleCamera() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    this.settings.set('gameplay.camera', this.mode);
  }

  setLadder(ladder, topFloorY) {
    this.ladder = ladder ? new LadderClimb(this, ladder, { topFloorY }) : null;
  }

  // what "E" would do right now (shown as a hint on screen)
  get interactHint() {
    if (this.ladder?.active) return this.ladder.mode === 'climb' ? 'W / S climb · Space let go' : null;
    const where = this.ladder?.prompt();
    if (where === 'bottom') return 'E  Climb up the ladder';
    if (where === 'top') return 'E  Climb down to the lab';
    return null;
  }

  // runs at the fixed physics rate
  fixedUpdate(dt) {
    const jump = this.queued.jump;
    const interact = this.queued.interact;
    this.queued.jump = this.queued.interact = false;
    if (this.ladder?.active) {
      this.ladder.fixedUpdate(dt, { jump });
      this.grounded = !this.ladder.active;
      this.actualSpeed = 0;
      return;
    }
    if (interact) {
      const where = this.ladder?.prompt();
      if (where) { this.ladder.start(where); return; }
    }
    if (this.frozen) return;
    const t0 = this.body.body.translation();
    this.prevPos.set(t0.x, t0.y, t0.z);
    const inp = this.input;
    const mv = inp.moveVector();
    const toggleSprint = this.settings.get('controls.toggleSprint');
    const sprint = toggleSprint ? this.sprintToggled : inp.isDown('sprint');

    // crouch: can't stand up under a table
    const wantCrouch = this.settings.get('controls.toggleCrouch') ? this.crouchToggled : inp.isDown('crouch');
    if (wantCrouch && !this.crouching) {
      this.physics.resizeCharacter(this.body, CROUCH_H * this.scale);
      this.crouching = true;
    } else if (!wantCrouch && this.crouching && this.physics.fits(this.body, STAND_H * this.scale)) {
      this.physics.resizeCharacter(this.body, STAND_H * this.scale);
      this.crouching = false;
    }

    // wanted horizontal velocity, relative to where the camera looks
    const speed = (this.crouching ? CROUCH : sprint && mv.y > 0.3 ? RUN : WALK) * this.scale;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = (mv.x * cos - mv.y * sin) * speed;
    const wz = (-mv.x * sin - mv.y * cos) * speed;
    const k = 1 - Math.exp(-dt * ACCEL * (this.grounded ? 1 : AIR_CONTROL));
    this.velocity.x += (wx - this.velocity.x) * k;
    this.velocity.z += (wz - this.velocity.z) * k;

    // gravity and jumping
    if (this.grounded) {
      // no downward push while grounded: snap-to-ground keeps you on slopes and
      // steps going down, and a downward push stops Rapier's auto-step going up
      this.velocity.y = 0;
      if (jump && !this.crouching) this.velocity.y = JUMP_SPEED * Math.sqrt(this.scale);
    } else {
      this.velocity.y -= GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -50);
    }

    const res = this.physics.moveCharacter(this.body, { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt });
    const wasGrounded = this.grounded;
    this.grounded = res.grounded;
    // walking into a wall: real speed drops, so the legs slow down too (no running in place)
    this.actualSpeed = Math.hypot(res.x, res.z) / dt;
    if (!this.grounded && res.y > this.velocity.y * dt + 1e-4 && this.velocity.y > 0) this.velocity.y = 0; // bonked head
    if (this.grounded && !wasGrounded) this.landSpeed = -this.velocity.y;
    // the body only moves on the next world step; keep our own copy for smooth interpolation
    this.currPos.set(t0.x + res.x, t0.y + res.y, t0.z + res.z);
  }

  // runs every rendered frame
  update(dt, alpha) {
    const inp = this.input;
    // taps are latched here and used by the next physics step: at high FPS some
    // frames have no physics step, and a quick tap would otherwise be lost
    if (inp.pressed('jump')) this.queued.jump = true;
    if (inp.pressed('interact')) this.queued.interact = true;
    if (inp.pressed('camera')) this.toggleCamera();
    if (this.settings.get('controls.toggleSprint') && inp.pressed('sprint')) this.sprintToggled = !this.sprintToggled;
    if (this.settings.get('controls.toggleCrouch') && inp.pressed('crouch')) this.crouchToggled = !this.crouchToggled;

    const look = inp.lookDelta(dt);
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.45, 1.45);

    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    const feet = this.feet;

    // body: faces the camera direction in first person, the walking direction in third
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    let targetYaw = this.bodyYaw;
    if (this.ladder?.active) targetYaw = this.bodyYaw;
    else if (this.mode === 'first') targetYaw = this.yaw;
    else if (hs > 0.2) targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z);
    let d = targetYaw - this.bodyYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.bodyYaw += d * (1 - Math.exp(-dt * 12));

    const root = this.character.root;
    root.position.copy(feet);
    root.rotation.set(0, this.bodyYaw + Math.PI, 0); // Rocketbox faces +Z; our forward is -Z
    root.scale.setScalar(this.scale);

    this.character.speed = this.ladder?.active ? 0 : Math.min(this.actualSpeed ?? 0, hs) / this.scale;
    this.character.crouch = this.crouching ? 1 : 0;
    const climbing = !!this.ladder?.active;
    this.character.update(dt, {
      groundAt: this.grounded && !climbing ? (x, y, z) => {
        const hit = this.physics.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, 1.2 * this.scale, { exclude: this.body.collider });
        return hit ? hit.point.y : null;
      } : null,
    });

    if (climbing) this.ladder.applyIK();
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    const head = this.headBone;
    const firstPerson = this.mode === 'first';
    // hide only the head in first person (scale the head bone to nothing)
    if (head) head.scale.setScalar(firstPerson ? 0.001 : 1);
    this.character.root.updateMatrixWorld(true);

    const eye = new THREE.Vector3();
    if (head) {
      head.getWorldPosition(eye);
      eye.y += (0.05 - EYE) * this.scale;
    } else {
      eye.copy(this.feet).y += (this.crouching ? CROUCH_H : STAND_H) * this.scale - EYE;
    }
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (firstPerson) {
      // a little in front of the eyes so the neck never shows at the screen edge
      cam.position.copy(eye).addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 0.12 * this.scale);
      cam.near = 0.02 * this.scale;
    } else {
      const pivot = eye.clone().add(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.35 * this.scale));
      const want = this.camDistance * this.scale;
      const back = dir.clone().negate();
      const hit = this.physics.raycast(pivot, back, want + 0.2 * this.scale, { exclude: this.body.collider });
      const allowed = hit ? Math.max(0.2 * this.scale, hit.distance - 0.2 * this.scale) : want;
      // pull in instantly when blocked, ease back out when clear
      this.camCurrentDist = allowed < this.camCurrentDist ? allowed : this.camCurrentDist + (allowed - this.camCurrentDist) * (1 - Math.exp(-dt * 4));
      cam.position.copy(pivot).addScaledVector(back, this.camCurrentDist);
      cam.near = 0.05 * this.scale;
    }
    cam.lookAt(cam.position.clone().add(dir));
    cam.updateProjectionMatrix();
  }
}
