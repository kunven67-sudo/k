// Chapter logic inside the house: the night-time doom-scroll, the shrunk wake-up, the pillow
// leap, sneaking past Biscuit, hauling the paper airplane, the mash-E bed climb, the flight to
// the desk and diving into the phone. Plus every household way to die.
import * as THREE from 'three';
import { ui } from '../core/ui.js';
import { input } from '../core/input.js';
import { sfx, playMusic, loop, setReverb } from '../core/audio.js';
import { unlock } from './achievements.js';
import { G } from './state.js';
import { Feed } from '../scenes/feed.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

export class HouseStory {
  constructor(story, level) {
    this.story = story;
    this.level = level;
    this.feed = new Feed();
    this.visited = new Set();
    this.flight = null;
    this.airplaneHome = level.refs.airplane.position.clone();
    this.airplaneRot = level.refs.airplane.rotation.clone();
    this.ambience = [];
    this.setupInteractables();
  }

  // ---------------------------------------------------------------- night: doom-scrolling
  async playFeed() {
    const L = this.level, d = G.director;
    L.setTime('night');
    G.mode = 'feed';
    ui.showHud(false);
    playMusic('night');
    const eye = V(98, 79, 42);
    d.cut(eye, V(100, 100, 120), 62);
    G.post.dofOverride = true; G.post.focus = 12; G.post.aperture = 1.2; G.post.maxBlur = 10;
    ui.fadeInstant(1);
    ui.fade(0, 2000);
    await wait(0.8);
    await new Promise((resolve) => this.feed.start(resolve));
    // Phone goes down onto the desk, lights out, eyes close.
    this.feed.putDown();
    sfx('whoosh', { dur: 0.6, vol: 0.4 });
    await d.move(V(120, 78, 40), V(335, 58, 28), 2.2, { fov: 55 });
    const scr = L.refs.phoneScreenMat;
    scr.emissive.set(0x5b7cc4); scr.emissiveIntensity = 1.2;
    sfx('place', { vol: 0.6 });
    L.refs.lights.phoneGlow.position.set(335, 66, 30); L.refs.lights.phoneGlow.intensity = 1600;
    await ui.say('Okay. Five more minutes turned into an hour again.', { speaker: 'You' });
    await wait(0.8);
    scr.emissive.set(0x000000); L.refs.lights.phoneGlow.intensity = 0;
    sfx('click');
    L.refs.fairy.forEach((b) => { b.userData.off = true; });
    await d.move(V(98, 76, 40), V(100, 110, 140), 2.5);
    sfx('yawn');
    await ui.say('...night, Biscuit.', { speaker: 'You', pitch: 0.95, rate: 0.9 });
    await ui.eyelids(0.35, 900);
    await ui.eyelids(0.7, 500);
    await ui.eyelids(0, 1400);
    await ui.fade(1, 1500);
    ui.eyelids(1, 10);
    G.post.dofOverride = null;
    L.refs.fairy.forEach((b) => { b.userData.off = false; });
  }

  // ---------------------------------------------------------------- morning: shrunk
  async playWake() {
    const L = this.level, P = G.player, d = G.director;
    L.setTime('morning');
    this.story.placePlayer('wake');
    P.sleeping = true; P.mode = 'locked'; P.lockFreeze = false;
    G.mode = 'cutscene';
    ui.fadeInstant(1);
    ui.eyelids(0, 10);
    playMusic(null);
    const head = P.body.pos.clone().add(V(0, 0.6, 0));
    await d.play(async (c) => {
      c.cut(head.clone().add(V(0.3, 0.5, 0)), head.clone().add(V(0, 40, 30)), 70);
      G.post.dofOverride = true; G.post.focus = 60; G.post.aperture = 0.4;
      await ui.fade(0, 800);
      sfx('yawn');
      await ui.eyelids(0.4, 1200);
      await ui.eyelids(0.05, 300);
      await ui.eyelids(1, 900);
      await c.say('Mmmh... morning already?', { speaker: 'You', pitch: 0.95 });
      // third person: standing up
      c.cut(head.clone().add(V(2.4, 0.8, 2.2)), head.clone().add(V(0, -0.2, 0)), 50);
      G.post.focus = 3.2; G.post.aperture = 1.1;
      P.sleeping = false;
      await c.wait(1.2);
      await c.say('Okay. School. Up. Let\'s go.', { speaker: 'You' });
      // try to walk: it takes forever
      P.scriptVel = V(0, 0, 5.5);
      c.move(P.body.pos.clone().add(V(3.5, 1.4, 5)), P.body.pos.clone().add(V(0, 1, 9)), 4, { e: 'linear' });
      await c.say('Why is this taking so long? The pillow just keeps... going.', { speaker: 'You' });
      P.scriptVel = null;
      await c.wait(0.4);
      // the big reveal: crane back to show how enormous everything is
      playMusic('wonder');
      const p = P.body.pos.clone();
      c.cut(p.clone().add(V(-1.5, 1.6, 2.5)), p.clone().add(V(0, 1.4, 0)), 48);
      G.post.focus = 3; G.post.aperture = 1.3;
      const craneEnd = V(p.x + 150, 175, p.z + 230);
      c.tween(9, (k) => { G.post.focus = 3 + k * 240; G.post.aperture = 1.3 - k * 0.9; });
      c.move(craneEnd, p.clone().add(V(0, 12, -10)), 9, { fov: 60, path: [p.clone().add(V(10, 12, 20)), p.clone().add(V(60, 70, 110))] });
      await c.wait(2.2);
      await c.say('Wait. WAIT. Why is everything so HUGE?', { speaker: 'You', pitch: 1.15, rate: 1.1 });
      await c.wait(1.5);
      await c.say('No... everything isn\'t big. I\'m TINY!', { speaker: 'You', pitch: 1.2, rate: 1.1 });
      unlock('shrunk');
      await c.wait(0.8);
      // the dog, far away in the living room
      c.cut(V(840, 25, 330), V(955, 25, 440), 42);
      G.post.focus = 150; G.post.aperture = 0.6;
      c.move(V(870, 22, 370), V(955, 22, 440), 7, { e: 'linear' });
      await c.say('And Biscuit\'s asleep in the living room. Good.', { speaker: 'You' });
      await c.say('At this size he could swallow me in one bite.', { speaker: 'You' });
      // the phone on the desk
      c.cut(V(360, 66, 70), V(335, 59, 28), 40);
      G.post.focus = 45; G.post.aperture = 0.9;
      c.move(V(346, 62, 44), V(335, 58.5, 28), 6, { e: 'out' });
      await c.say('My phone! If I can get to it, I can call for help.', { speaker: 'You' });
      // back to the player looking at the edge of the bed
      c.cut(P.body.pos.clone().add(V(-3, 2.2, -2)), P.body.pos.clone().add(V(10, -2, 10)), 60);
      G.post.focus = 4; G.post.aperture = 0.9;
      await c.say('First I need to get off this bed. That pillow down on the floor looks soft...', { speaker: 'You' });
    });
    G.post.dofOverride = null;
    ui.eyelids(1, 10);
    ui.fadeInstant(0);
    P.mode = 'walk';
    P.camYaw = Math.PI / 2 + 0.3; P.camPitch = 0.3;
    G.stats.wakeTime = G.stats.playTime;
    this.story.beginPlay();
    ui.chapterCard('CHAPTER 2', 'BIG MORNING');
    this.story.objective('Get off the bed — go to the edge above the fallen pillow');
    this.story.checkpoint('house', 'wake');
  }

  // ---------------------------------------------------------------- interactables
  setupInteractables() {
    const L = this.level;
    const I = L.interactables;
    const airplane = L.refs.airplane;
    // 1) Leap from the bed onto the pillow
    I.push({
      pos: V(166, 60, 96), radius: 12, height: 6, label: 'Leap onto the pillow',
      can: () => !G.player.carry,
      action: () => this.leap(),
    });
    // 2) The paper airplane: heavy, noisy to lift
    this.airplaneIt = {
      getPos: () => airplane.position, radius: 14, height: 8, hold: 2.4,
      label: () => (G.flags.airplaneLifted ? 'Pick up the paper airplane' : 'Lift the paper airplane (heavy!)'),
      can: () => !G.player.carry && !this.flight && airplane.parent === L.group,
      onHoldTick: (k) => {
        G.player.rig.trigger('struggle', 0.5);
        if (Math.random() < 0.12) { sfx('crunch', { vol: 0.25, pos: airplane.position }); L.refs.dog.hear(0.05, airplane.position); }
        G.player.shake = Math.max(G.player.shake, 0.08 * k);
      },
      action: () => this.pickUpAirplane(),
    };
    I.push(this.airplaneIt);
    // 3) The blanket at the foot of the bed: MASH E
    this.climbZone = {
      x: 100, z: 216.5, zTop: 213.5, bottomY: 0, topY: 60, facing: Math.PI, exit: V(100, 60.5, 196),
      label: 'MASH E TO CLIMB', surface: 'fabric', perPress: 1.25, slide: 2.2,
      onTop: () => this.onBedTop(),
    };
    I.push({
      pos: V(100, 1, 217), radius: 22, height: 4, label: 'Climb the blanket (mash E)',
      action: (p) => {
        if (p.carry) { p.carry.onBack = true; this.attachAirplane(true); }
        p.startClimb(this.climbZone);
        this.story.objective('Keep mashing E! Don\'t stop or you\'ll slide down');
      },
    });
    // 4) Launch the airplane from the bed edge toward the desk
    I.push({
      pos: V(166, 60, 70), radius: 26, height: 6, label: 'Launch the paper airplane toward the desk',
      can: () => G.player.carry && G.player.carry.item === 'airplane',
      action: () => this.startFlight(),
    });
    // 5) The phone: tap the screen
    I.push({
      pos: V(335, 59, 28), radius: 7, height: 4, label: 'Tap the phone screen',
      can: () => G.flags.onDesk && !G.flags.phoneDone,
      action: () => this.enterPhone(),
    });
    // 6) Front door
    I.push({
      pos: V(1036, 1, 227), radius: 30, height: 6, label: 'Squeeze under the front door',
      action: () => {
        if (!G.flags.phoneDone) { ui.say('Not yet. I need my phone first. Help is one call away... I hope.', { speaker: 'You' }); return; }
        this.story.goOutside();
      },
    });
    // 7) Crumbs heal
    L.crumbs.forEach((c) => I.push({
      pos: V(c.x, 0.5, c.z), radius: 2.5, height: 3, label: 'Eat the cereal crumb (+30 health)',
      can: () => !c.eaten,
      action: (p) => { c.eaten = true; c.mesh.visible = false; p.heal(30); sfx('eat'); unlock('crumbs'); ui.toast('🥣 Crunchy. The five second rule applies at any size.'); },
    }));
    // 8) Mousetrap cheese
    I.push({
      pos: V(L.refs.trap.x - 2.4, 1.5, L.refs.trap.z - 0.5), radius: 5, height: 4, label: 'Eat the cheese',
      action: () => this.snapTrap(),
    });
    // 9) Poke Biscuit (bad idea)
    I.push({
      getPos: () => L.refs.dog.headPos(), radius: 30, height: 40, label: 'Boop Biscuit\'s nose',
      can: () => L.refs.dog.state === 'sleep',
      action: () => { L.refs.dog.alert = 5; L.refs.dog.wake(); },
    });
  }

  attachAirplane(onBack) {
    const a = this.level.refs.airplane;
    const P = G.player;
    P.object.add(a);
    if (onBack) { a.position.set(0, 1.4, -1.2); a.rotation.set(-1.25, 0, 0); a.scale.setScalar(1); }
    else { a.position.set(0, 3.55, 0.3); a.rotation.set(0, 0, Math.PI); }
  }

  pickUpAirplane() {
    const P = G.player, L = this.level;
    const first = !G.flags.airplaneLifted;
    G.flags.airplaneLifted = true;
    sfx('crunch', { vol: 0.6 });
    L.refs.dog.hear(first ? 0.35 : 0.15, P.body.pos);
    this.attachAirplane(false);
    P.carry = {
      item: 'airplane', speedMul: 0.62, canJump: false, canSprint: false, camDist: 17, camLift: 3,
      onDrop: (pl) => this.dropAirplane(pl),
    };
    P.rig.trigger('pickup', 0.6);
    if (first) {
      unlock('airplane');
      ui.say('Got it! It weighs a ton... Okay. Back to my room. Quietly.', { speaker: 'You' });
    }
    this.story.objective(G.flags.climbedBed ? 'Launch the paper airplane from the bed' : 'Carry the airplane back to your bedroom (G to drop)');
  }

  dropAirplane(p) {
    const a = this.level.refs.airplane;
    this.level.group.add(a);
    const fwd = V(Math.sin(p.facing), 0, Math.cos(p.facing));
    const x = p.body.pos.x + fwd.x * 8, z = p.body.pos.z + fwd.z * 8;
    const y = this.level.world.surfaceBelow(x, p.body.pos.y + 2, z);
    a.position.set(x, (Number.isFinite(y) ? y : p.body.pos.y) + 4.6, z);
    a.rotation.set(0, p.facing, 0);
    a.scale.setScalar(1);
    sfx('place', { pos: a.position });
    this.story.objective('Pick the paper airplane back up');
  }

  resetAirplane() {
    const a = this.level.refs.airplane;
    this.level.group.add(a);
    a.position.copy(this.airplaneHome); a.rotation.copy(this.airplaneRot); a.scale.setScalar(1);
  }

  // ---------------------------------------------------------------- the 10-second leap
  async leap() {
    const P = G.player, d = G.director;
    const L = this.level;
    P.mode = 'locked'; P.lockFreeze = true;
    G.mode = 'cutscene';
    const start = L.spawns.bedEdge.pos.clone();
    const end = L.spawns.pillow.pos.clone().add(V(0, -2.5, 0));
    P.body.pos.copy(start); P.facing = Math.PI / 2;
    await d.play(async (c) => {
      c.cut(V(start.x + 6, start.y + 2, start.z + 9), start.clone().add(V(0, 1, 0)), 55);
      G.post.dofOverride = true; G.post.focus = 11; G.post.aperture = 0.8;
      await c.say('It\'s just a little jump. For a normal person.', { speaker: 'You' });
      P.crouching = true;
      await c.wait(0.8);
      P.crouching = false;
      sfx('jump');
      await c.say('Three... two... one...', { speaker: 'You', rate: 1.2 });
      playMusic('wonder');
      sfx('whoosh', { dur: 9, vol: 0.5 });
      const wind = loop('wind', { vol: 0.6 });
      P.body.grounded = false;
      // slow-motion arc, ~9 seconds
      const arcH = 14;
      c.tween(9, (k) => {
        const p = start.clone().lerp(end, k);
        p.y += Math.sin(Math.min(1, k * 1.15) * Math.PI) * arcH * (1 - k * 0.3);
        P.body.pos.copy(p);
        P.body.vel.y = k < 0.3 ? 5 : -5;
        P.body.grounded = false;
        G.post.focus = c.camera.position.distanceTo(p);
        G.post.fx.aberration = 0.0015 + Math.sin(k * Math.PI) * 0.004;
      }, 'sine');
      const mid = start.clone().lerp(end, 0.5);
      c.move(V(mid.x - 20, mid.y + 8, mid.z + 38), mid.clone().add(V(0, -6, 0)), 9, { fov: 50, e: 'sine', path: [V(start.x, start.y + 10, start.z + 18), V(mid.x, mid.y + 12, mid.z + 30)] });
      await c.wait(2.5);
      c.say('Whoaaaaaaa!', { speaker: 'You', pitch: 1.4, rate: 0.7 });
      await c.wait(6.6);
      wind.stop();
      P.body.grounded = true; P.body.vel.set(0, 0, 0);
      sfx('land', { soft: true, vol: 1 });
      sfx('squish', { vol: 0.4 });
      P.shake = 0.5;
      G.post.fx.aberration = 0.0015;
      this.poof(P.body.pos);
      await c.wait(1.0);
      c.cut(P.body.pos.clone().add(V(3, 1.6, 2.8)), P.body.pos.clone().add(V(0, 1.2, 0)), 55);
      G.post.focus = 4;
      await c.say('...Soft landing. Nailed it.', { speaker: 'You' });
    });
    G.post.dofOverride = null;
    P.mode = 'walk'; P.lockFreeze = false;
    P.camYaw = Math.PI / 2 + 0.4;
    unlock('leap');
    G.flags.leapt = true;
    this.story.beginPlay();
    this.story.checkpoint('house', 'pillow');
    this.story.objective('Get to your phone on the desk');
    await wait(4);
    if (G.mode === 'play') await ui.say('Okay. The desk. My phone is right up there...', { speaker: 'You' });
    if (G.mode === 'play') await ui.say('There\'s nothing to climb. The legs are way too smooth.', { speaker: 'You' });
    if (G.mode === 'play' && !this.visited.has('living')) {
      await ui.say('Maybe something in the living room can help. I\'m small enough to go under the door now.', { speaker: 'You' });
      this.story.objective('Find a way up to the desk — explore the house (squeeze under the bedroom door)');
    }
  }

  poof(pos) {
    // A little burst of lint "feathers" from the pillow.
    const N = 40;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) { arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y + 0.3; arr[i * 3 + 2] = pos.z; vel.push(V((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6)); }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.9 }));
    this.level.scene.add(pts);
    let t = 0;
    const tick = () => {
      t += 0.016;
      for (let i = 0; i < N; i++) { vel[i].y -= 0.05; vel[i].multiplyScalar(0.97); arr[i * 3] += vel[i].x * 0.016; arr[i * 3 + 1] += vel[i].y * 0.016; arr[i * 3 + 2] += vel[i].z * 0.016; }
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = Math.max(0, 0.9 - t * 0.4);
      if (t < 2.5) requestAnimationFrame(tick); else { this.level.scene.remove(pts); geo.dispose(); }
    };
    tick();
  }

  // ---------------------------------------------------------------- bed top + flight
  onBedTop() {
    G.flags.climbedBed = true;
    unlock('climber');
    const P = G.player;
    if (P.carry) { P.carry.onBack = false; this.attachAirplane(false); }
    if (G.flags.airplaneLifted && !G.flags.dogWoke) unlock('sneaky');
    ui.say(P.carry ? 'Made it! Now... to the edge of the bed. Aim for the desk.' : 'Made it back up. But I still need a way across to the desk...', { speaker: 'You' });
    this.story.objective(P.carry ? 'Walk to the edge of the bed facing the desk and launch the airplane (E)' : 'Get the paper airplane from the living room');
    if (P.carry) this.story.checkpoint('house', 'bedTop', { carrying: 'airplane' });
  }

  startFlight() {
    const P = G.player, L = this.level;
    const a = L.refs.airplane;
    P.carry = null;
    L.group.add(a);
    ui.mash(null);
    const f = this.flight = {
      pos: V(170, 62.5, P.body.pos.z), yaw: Math.PI / 2 - 0.05, pitch: 0.08, speed: 21, roll: 0, t: 0,
      camPos: V(150, 68, P.body.pos.z),
    };
    a.position.copy(f.pos); a.rotation.set(0, f.yaw, 0, 'YXZ');
    P.mode = 'external';
    P.externalUpdate = (dt, lvl) => this.updateFlight(dt, lvl);
    sfx('whoosh', { dur: 1.2 });
    P.rig.trigger('throw', 0.5);
    playMusic('outdoor');
    ui.toast('✈️ <b>Mouse / A-D</b> to steer &middot; <b>W / S</b> nose down / up. Land on the <b>desk</b>!', 6000);
    this.story.objective('Fly to the desk and land on it');
    this.flightWind = loop('wind', { vol: 0.5 });
  }

  updateFlight(dt, lvl) {
    const f = this.flight;
    if (!f) return;
    const P = G.player, a = this.level.refs.airplane, world = this.level.world;
    f.t += dt;
    const look = input.locked ? input.look() : { x: 0, y: 0 };
    const ax = input.axis();
    const yawIn = -look.x * 2.2 - ax.x * 1.4 * dt;
    f.yaw += yawIn;
    f.roll += ((-yawIn / Math.max(dt, 1e-3)) * 0.35 - f.roll) * (1 - Math.exp(-4 * dt));
    f.roll = Math.max(-0.9, Math.min(0.9, f.roll));
    f.pitch += (-look.y * 1.2) + (-ax.z * 0.9 * dt);
    f.pitch = Math.max(-0.7, Math.min(0.45, f.pitch));
    // arcade glider physics: diving trades height for speed, climbing bleeds it off
    f.speed += (-Math.sin(f.pitch) * 30 - 0.0035 * f.speed * f.speed) * dt;
    f.speed = Math.max(7, Math.min(42, f.speed));
    if (f.speed < 10) f.pitch -= dt * 0.6; // stall: nose drops
    const sink = 1.6 + Math.max(0, 13 - f.speed) * 0.5;
    const fwd = V(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    const vy = f.speed * Math.sin(f.pitch) - sink;
    const step = fwd.clone().multiplyScalar(f.speed * Math.cos(f.pitch) * dt);
    // wall / object ahead?
    const dir = V(fwd.x * Math.cos(f.pitch), Math.sin(f.pitch), fwd.z * Math.cos(f.pitch)).normalize();
    const ahead = world.raycast(f.pos.clone().add(V(0, 1, 0)), dir, 14 + f.speed * dt);
    f.pos.add(step); f.pos.y += vy * dt;
    a.position.copy(f.pos);
    a.rotation.set(-f.pitch, f.yaw, f.roll, 'YXZ');
    // rider sits on the plane
    P.object.position.copy(f.pos).add(V(0, 0.9, 0).applyEuler(a.rotation)).addScaledVector(fwd, -3);
    P.object.rotation.set(0, f.yaw, 0);
    P.rig.update(dt, { speed: 0, grounded: true, glide: true, vy: 0 });
    P.body.pos.copy(P.object.position);
    // camera: chase cam
    const want = f.pos.clone().addScaledVector(fwd, -24).add(V(0, 8 + f.pitch * -10, 0));
    f.camPos.lerp(want, 1 - Math.exp(-4 * dt));
    G.camera.position.copy(f.camPos);
    G.camera.lookAt(f.pos.clone().addScaledVector(fwd, 12));
    G.camera.fov += ((62 + f.speed * 0.5) - G.camera.fov) * (1 - Math.exp(-3 * dt));
    G.camera.updateProjectionMatrix();
    G.post.focus = G.camera.position.distanceTo(f.pos); G.post.aperture = 0.5;
    if (this.flightWind) this.flightWind.setVolume(0.2 + f.speed / 50);
    // landing / crashing
    const ground = world.surfaceBelow(f.pos.x, f.pos.y + 1, f.pos.z);
    const onDesk = f.pos.x > 286 && f.pos.x < 409 && f.pos.z > 1 && f.pos.z < 62;
    if (f.pos.y - 3 <= ground) {
      if (onDesk && Math.abs(ground - 58) < 1.5) return this.flightSuccess();
      if (Math.abs(ground - 60) < 3 && f.pos.x < 172) return this.flightEnd('You landed back on the bed. Walk to the edge and try again!', false);
      return this.flightEnd('The airplane nose-dived into the floor.', true);
    }
    if (ahead < 12 + f.speed * dt) return this.flightEnd('Crash! You flew straight into something.', true);
    if (f.t > 90) return this.flightEnd('You ran out of air.', true);
  }

  async flightEnd(msg, crashed) {
    const P = G.player;
    this.flight = null;
    if (this.flightWind) { this.flightWind.stop(); this.flightWind = null; }
    sfx(crashed ? 'crunch' : 'land', { soft: true });
    P.shake = 0.8;
    ui.toast(msg, 4000);
    if (crashed) {
      G.mode = 'cutscene';
      await ui.fade(1, 600);
      this.story.respawnAt('house', 'bedTop', { carrying: 'airplane' });
      await ui.fade(0, 600);
      G.mode = 'play';
    } else {
      P.mode = 'walk';
      P.body.pos.copy(this.level.refs.airplane.position).add(V(-4, 0, 0));
      P.body.pos.y = 60.5;
      this.pickUpAirplane();
      this.story.objective('Launch the paper airplane again from the bed edge (E)');
    }
    playMusic('wonder');
  }

  async flightSuccess() {
    const P = G.player, L = this.level;
    this.flight = null;
    if (this.flightWind) { this.flightWind.stop(); this.flightWind = null; }
    const a = L.refs.airplane;
    a.position.y = 58 + 4.6; a.rotation.set(0, a.rotation.y, 0);
    sfx('land', { soft: false, vol: 0.8 });
    P.mode = 'walk';
    P.body.pos.set(Math.min(400, Math.max(292, a.position.x - Math.sin(a.rotation.y) * 12)), 58.2, Math.min(56, Math.max(8, a.position.z)));
    P.body.vel.set(0, 0, 0);
    P.camYaw = Math.atan2(335 - P.body.pos.x, 28 - P.body.pos.z) + Math.PI;
    P.facing = P.camYaw - Math.PI;
    G.flags.onDesk = true;
    unlock('pilot');
    const since = G.stats.playTime - (G.stats.wakeTime || 0);
    if (since < 360) unlock('speedy');
    if ((G.stats.damageTaken || 0) < 0.5) unlock('pacifist');
    this.story.checkpoint('house', 'deskPhone');
    playMusic('wonder');
    await ui.say('I MADE IT! Tiny pilot, reporting for duty!', { speaker: 'You', pitch: 1.15 });
    this.story.objective('Walk over to your phone and tap the screen');
  }

  // ---------------------------------------------------------------- into the phone
  async enterPhone() {
    const P = G.player, L = this.level, d = G.director;
    P.mode = 'locked'; P.lockFreeze = true;
    G.mode = 'cutscene';
    const scr = L.refs.phoneScreenMat;
    await d.play(async (c) => {
      c.cut(V(345, 64, 44), V(335, 58.5, 28), 50);
      G.post.dofOverride = true; G.post.focus = 20;
      await c.say('Come on, come on... turn on.', { speaker: 'You' });
      sfx('glitch');
      scr.emissive.set(0x2a50ff); scr.emissiveIntensity = 0.3;
      L.refs.lights.phoneGlow.position.set(335, 64, 28); L.refs.lights.phoneGlow.intensity = 1000;
      await c.wait(0.4);
      c.tween(3, (k) => {
        scr.emissive.setHSL(0.6 + Math.sin(k * 40) * 0.1, 1, 0.3 + k * 0.4);
        G.post.fx.glitch = k * 0.8;
        L.refs.lights.phoneGlow.intensity = 1000 + k * 6000;
        P.shake = k;
      }, 'in');
      await c.say('Huh? The screen is... pulling me in?!', { speaker: 'You', pitch: 1.2, rate: 1.15 });
      sfx('shrink');
      c.move(V(336, 60, 30), V(335, 58, 28), 1.5, { fov: 100, e: 'in' });
      await c.wait(1.2);
      await ui.fade(1, 400);
    });
    G.post.fx.glitch = 0;
    scr.emissive.set(0x000000);
    L.refs.lights.phoneGlow.intensity = 0;
    G.post.dofOverride = null;
    unlock('inphone');
    this.story.enterPhone();
  }

  // ---------------------------------------------------------------- hazards
  async snapTrap() {
    const T = this.level.refs.trap;
    if (T.snapped) return;
    T.snapped = true;
    sfx('chomp', { vol: 1 });
    sfx('hit');
    const start = T.bar.rotation.x;
    let k = 0;
    const iv = setInterval(() => { k += 0.2; T.bar.rotation.x = start + Math.min(1, k) * Math.PI; if (k >= 1) clearInterval(iv); }, 16);
    G.player.shake = 2;
    G.player.die('mousetrap');
    setTimeout(() => { T.bar.rotation.x = start; T.snapped = false; }, 4000);
  }

  update(dt) {
    const P = G.player, L = this.level;
    if (!P || G.level !== L) return;
    // background ambience in the house
    if (!this.ambienceOn && L.audioReady) {
      this.ambienceOn = true;
      this.ambience.push(loop('room', { vol: 0.35 }));
      this.ambience.push(loop('fridge', { pos: V(1000, 90, 650), ref: 120, vol: 0.5 }));
      this.ambience.push(loop('clock', { pos: V(418, 225, 335), ref: 80, vol: 0.5 }));
      setReverb(0.35);
    }
    if (G.mode !== 'play' || P.mode === 'dead') return;
    const p = P.body.pos;
    // rooms visited / explorer / under-door
    const room = L.roomAt(p.x, p.z);
    if (room && !this.visited.has(room)) {
      this.visited.add(room);
      if (this.visited.size >= 4) unlock('explorer');
      if (room === 'living' && !G.flags.seenLiving) this.firstLiving();
      if (room === 'kitchen') ui.toast('🍳 <b>Kitchen</b> — watch your step. Something skitters under the fridge.');
      if (room === 'bathroom') ui.toast('🛁 <b>Bathroom</b> — tiles are slippery and the toilet is... a lot.');
    }
    if (p.x > 420 && p.x < 432 && p.y < 2.6 && !G.flags.underDoor) { G.flags.underDoor = true; unlock('underdoor'); }
    if (p.x > 1036 && p.z > 180 && p.z < 275 && p.y < 2.6) { /* at the front door gap */ }
    // vacuum schedule
    if (G.flags.seenLiving && !L.refs.vacuum.active) {
      this.vacT = (this.vacT || 0) + dt;
      if (this.vacT > 45) L.refs.vacuum.start();
    }
    // coins
    for (const c of L.coins) {
      if (!c.taken && Math.hypot(p.x - c.x, p.z - c.z) < 1.8 && Math.abs(p.y - c.y) < 2) {
        c.taken = true; c.mesh.visible = false;
        G.flags.coins = (G.flags.coins || 0) + 1;
        sfx('pickup');
        ui.toast(`🪙 Lost coin found! <b>${G.flags.coins}/8</b>`);
        if (G.flags.coins >= 8) unlock('coins');
      }
    }
    // toilet water
    const T = L.refs.toilet;
    if (Math.hypot(p.x - T.x, p.z - T.z) < T.rIn - 0.5 && p.y < 38 && p.y > 5) { sfx('splash'); sfx('flush', { delay: 0.6 }); P.die('toilet'); }
    // water bowl
    const W = L.refs.waterBowl;
    if (Math.hypot(p.x - W.x, p.z - W.z) < W.r && p.y < W.y + 0.2) { sfx('splash'); P.die('waterbowl'); }
    // mousetrap plate
    const tr = L.refs.trap;
    if (Math.hypot(p.x - (tr.x - 2.4), p.z - tr.z) < 2 && p.y > 0.8 && p.y < 2.5) this.snapTrap();
    // drop airplane
    if (input.wasPressed('KeyG') && P.carry && P.mode === 'walk') P.dropCarry();
    // tip about climbing when carrying the plane into the bedroom
    if (P.carry && room === 'bedroom' && !G.flags.tipClimb && p.x < 420) {
      G.flags.tipClimb = true;
      this.story.objective('Climb the blanket hanging at the foot of the bed (mash E)');
      ui.say('The blanket hanging off the end of the bed. I can climb that!', { speaker: 'You' });
    }
    // Leaving the phone: nudge toward the front door
    if (G.flags.phoneDone && !G.flags.tipDoor && p.y < 5) { G.flags.tipDoor = true; this.story.objective('Get outside — squeeze under the front door in the living room'); }
  }

  async firstLiving() {
    G.flags.seenLiving = true;
    const P = G.player, d = G.director, L = this.level;
    this.story.checkpoint('house', 'livingDoor');
    P.mode = 'locked'; P.lockFreeze = false;
    G.mode = 'cutscene';
    await d.play(async (c) => {
      const a = L.refs.airplane.position;
      c.cut(V(a.x - 30, 8, a.z + 40), a.clone(), 45);
      G.post.dofOverride = true; G.post.focus = 50; G.post.aperture = 0.8;
      c.move(V(a.x - 16, 5, a.z + 22), a.clone().add(V(0, 2, 0)), 5, { e: 'out' });
      await c.say('My paper airplane! If I haul it back to my room...', { speaker: 'You' });
      await c.say('...I could fly it from the bed straight to the desk!', { speaker: 'You', pitch: 1.1 });
      c.cut(V(900, 16, 380), V(955, 22, 440), 45);
      G.post.focus = 80;
      c.move(V(912, 14, 395), V(955, 22, 440), 4, { e: 'linear' });
      await c.say('Just have to be quiet. Real quiet.', { speaker: 'You', rate: 0.9, pitch: 0.95 });
    });
    G.post.dofOverride = null;
    P.mode = 'walk';
    this.story.beginPlay();
    this.story.objective('Get the paper airplane without waking Biscuit (hold C to sneak)');
  }

  onRespawn(spawn, opts = {}) {
    const L = this.level;
    // everything resets to a calm house
    const dog = L.refs.dog;
    dog.state = 'sleep'; dog.alert = 0; dog.pose = 0;
    dog.body.pos.copy(dog.bedPos); dog.yaw = dog.bedYaw; dog.body.vel.set(0, 0, 0);
    const v = L.refs.vacuum;
    v.body.pos.set(1000, 0, 520); v.yaw = -Math.PI / 2;
    const r = L.refs.roach;
    r.body.pos.copy(r.home); r.state = 'idle'; r.hp = r.maxHp; r.dead = false; r.aggro = false; r.group.scale.setScalar(1); r.group.rotation.set(0, 0, 0);
    if (!L.creatures.includes(r)) { L.creatures.push(r); L.scene.add(r.group); }
    this.flight = null;
    if (this.flightWind) { this.flightWind.stop(); this.flightWind = null; }
    if (opts.carrying === 'airplane') {
      this.pickUpAirplane();
      if (spawn === 'bedTop') this.story.objective('Walk to the edge of the bed facing the desk and launch the airplane (E)');
    } else if (!G.flags.onDesk) {
      this.resetAirplane();
    }
  }

  stopAmbience() { this.ambience.forEach((a) => a.stop()); this.ambience = []; this.ambienceOn = false; }
}
