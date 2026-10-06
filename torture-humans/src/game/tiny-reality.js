// What being small really does to you (always on), from the realistic list:
//  6 food by size: a crumb is a loaf, a droplet is a drink
//  7 bugs are dangerous (the spider hunts you, ants bite)
//  8 pets see you as prey (the rat bites, the gecko's tongue)
//  9 people don't notice you: their feet come down on you
// 10 cleaning: Mom's vacuum (family.js drives her, this does the sucking)
// 11 air is thick: wind blows you around outside, you fall slowly
// 12 water: raindrops hit like buckets, water surface traps you
// 13 sticky: very small, you can creep up walls
// 14 small bodies get cold and run out of food/water fast
// 15 your voice is too quiet for big people (talk.js), big voices rumble (audio.js)
// 16 tiny eyes see blurry   17 breathing gets hard   18 the world seems slow-motion
// 19 light gets weird at germ size   20 below ~2 cm your body slowly gives out
// And the not-realistic extras from settings (tiny.*): talking bugs, riding the
// rat, labels on tiny things (super jump is in player.js).
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = THREE.MathUtils.clamp;
const _v = new THREE.Vector3();

function crumbMesh(size) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(0.7, 1.3), p.getY(i) * rand(0.5, 0.9), p.getZ(i) * rand(0.7, 1.3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: pick([0xb07a3c, 0xc99a5a, 0x8a5a2c]), roughness: 0.9 }));
  m.scale.setScalar(size);
  m.castShadow = true;
  m.userData.noCollide = true;
  return m;
}

const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 0.95, ior: 1.33, thickness: 0.002, transparent: true, opacity: 0.55 });
function dropMesh(size) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dropMat);
  m.scale.set(size, size * 0.7, size); // surface tension: a squashed bead
  m.userData.noCollide = true;
  return m;
}

const BUG_LINES = {
  ant: ['Get off the trail!', 'This crumb is MINE.', 'Have you seen the queen?', 'Left, right, left, right...'],
  beetle: ['Mind the shell.', '*click click*', 'Nice day for a crawl.'],
  spider: ['Come closer, little one...', 'My web is just over there...', 'You look... delicious.'],
  mite: ['Mmm, skin flakes.', 'Who are YOU?', 'This is my carpet.'],
};

export class TinyReality {
  constructor(ctx) {
    Object.assign(this, ctx); // player, vitals, env, camera, canvas, audio, humans, pets, bugs, cage, colony, details, family, hazards, settings, speech, interact, input, scene, toast, getZone, germs
    this.t = 0;
    this.bodyT = 37;
    this.timeScale = 1;
    this.cool = {};     // cooldowns
    this.told = {};     // one-time tips
    this.footY = new Map();
    // overlays: cold, rainbow light, splash
    const mk = (id, css) => { let el = document.getElementById(id); if (!el) { el = document.createElement('div'); el.id = id; el.style.cssText = css; document.body.appendChild(el); } return el; };
    this.coldEl = mk('tinycold', 'position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center, transparent 45%, rgba(150,200,255,0.55) 100%);');
    this.rainbowEl = mk('tinyrainbow', 'position:fixed;inset:-20%;pointer-events:none;opacity:0;mix-blend-mode:screen;background:conic-gradient(from 0deg, #f005, #ff05, #0f05, #0ff5, #00f5, #f0f5, #f005);filter:blur(30px);');
    this.splashEl = mk('tinysplash', 'position:fixed;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 40%, rgba(180,215,255,0.85), rgba(120,170,230,0.4));');
    this.labelEl = mk('tinylabel', 'position:fixed;left:50%;top:56%;transform:translateX(-50%);color:#fff;font:13px system-ui,sans-serif;text-shadow:0 0 4px #000;pointer-events:none;text-align:center;');
    this.slowEl = mk('tinyslow', 'position:fixed;left:16px;top:42px;color:#cfe8ff;font:12px system-ui,sans-serif;text-shadow:0 0 4px #000;pointer-events:none;');
    // food and water at tiny scale: crumbs on the kitchen floor and by the bakery, a spilled drop by the table
    this.food = [];
    this.water = [];
    const fy = 3.301;
    for (let i = 0; i < 14; i++) this.addCrumb(new THREE.Vector3(rand(-3.6, -1.7), fy, rand(-4.4, -1.4)));
    for (let i = 0; i < 6; i++) this.addCrumb(new THREE.Vector3(rand(-37, -34), 3.3, rand(16.9, 17.6)));
    this.addDrop(new THREE.Vector3(-2.3, fy, -1.9), 0.004);
    this.addDrop(new THREE.Vector3(-2.9, fy, -2.6), 0.003);
    // outdoor dew / rain droplets that appear around you on the lawn
    this.dew = [];
    // interact: eat / drink whatever is closest when you're small
    this.near = null;
    ctx.interact?.add({
      at: () => this.near?.pos, anyScale: true, radius: () => Math.max(0.01, 0.6 * this.player.scale * 1.8),
      when: () => this.near && this.player.scale < 0.15,
      label: () => this.near?.label, use: () => this.consume(this.near),
    });
    // ride the rat (settings: not realistic)
    ctx.interact?.add({
      at: () => this.rat()?.holder.position.clone().setY(this.rat().holder.position.y + 0.06), anyScale: true, radius: () => 0.35,
      when: () => this.settings.get('tiny.rideCritters') && this.rat() && this.player.scale < 0.12 && !this.riding,
      label: () => `Climb on ${this.rat().profile.name} and ride`, use: () => { this.riding = this.rat(); this.rideT = 0; this.player.frozen = true; this.toast?.('Riding! W/A/S/D to steer, E or Space to get off'); },
    });
  }

  addCrumb(p) {
    const size = rand(0.0012, 0.003);
    const m = crumbMesh(size);
    m.position.copy(p).setY(p.y + size * 0.6);
    this.scene.add(m);
    this.food.push({ mesh: m, pos: m.position, size, label: 'Eat the bread crumb', home: p.clone() });
  }

  addDrop(p, size) {
    const m = dropMesh(size);
    m.position.copy(p).setY(p.y + size * 0.65);
    this.scene.add(m);
    this.water.push({ mesh: m, pos: m.position, size, label: 'Drink the water droplet', home: p.clone() });
  }

  rat() { return this.pets?.list.find((p) => p.kind === 'rat'); }

  // what you could eat or drink right now, closest first
  findNear() {
    const f = this.player.feet;
    const s = this.player.scale;
    const reach = 0.6 * 1.8 * s + 0.002;
    let best = null, bd = Infinity;
    const consider = (pos, label, kind, ref) => {
      const d = Math.hypot(pos.x - f.x, pos.z - f.z);
      if (d < reach && Math.abs(pos.y - f.y) < Math.max(0.01, 1.8 * s) && d < bd) { bd = d; best = { pos, label, kind, ref }; }
    };
    for (const c of this.food) if (c.mesh.visible) consider(c.pos, c.label, 'crumb', c);
    for (const w of [...this.water, ...this.dew]) if (w.mesh.visible) consider(w.pos, w.label, 'drop', w);
    // the colony's food in the terrarium, and morning dew on its plants
    if (this.colony && this.player.inCage) {
      for (const p of this.colony.pieces) if (p.kind === 'food' && p.state === 'ground' && p.mesh?.parent) consider(p.mesh.getWorldPosition(new THREE.Vector3()), 'Eat (the tiny people\'s food!)', 'piece', p);
      const w = this.cage?.tiny?.world;
      if (this.details?.dewVisible) for (const d of this.details.dewSpots || []) if (!d.drunk) consider(w.localToWorld(d.p.clone()), 'Drink the dew drop', 'dew', d);
    }
    return best;
  }

  // eating/drinking: what's a crumb to you is a loaf; tiny you fills up fast
  consume(n) {
    if (!n) return;
    const s = this.player.scale;
    const amount = clamp(55 * (0.05 / s), 8, 100);
    const v = this.vitals;
    if (n.kind === 'crumb' || n.kind === 'piece') {
      v.hunger = Math.min(100, v.hunger + amount);
      this.toast?.(amount >= 100 ? 'You ate the whole crumb. You\'re stuffed!' : 'Crunch. Tastes like bread (because it is).');
      if (n.kind === 'crumb') { n.ref.mesh.visible = false; n.ref.back = 240; }
      else this.colony.removePiece(n.ref); // gone from the tiny people's world too
    } else {
      v.thirst = Math.min(100, v.thirst + amount);
      this.toast?.(amount >= 100 ? 'You drank the whole droplet. So much water!' : 'Slurp.');
      if (n.kind === 'dew') n.ref.drunk = true;
      else { n.ref.mesh.visible = false; n.ref.back = 180; }
    }
    this.audio?.tone?.({ freq: 300, to: 200, dur: 0.12, gain: 0.05 });
  }

  tip(key, text) {
    if (this.told[key]) return;
    this.told[key] = true;
    this.toast?.(text);
  }

  cooldown(key, sec) {
    if ((this.cool[key] ?? 0) > this.t) return false;
    this.cool[key] = this.t + sec;
    return true;
  }

  hurt(amount, cause, from = null, kick = 0) {
    this.vitals.damage(amount, cause);
    if (from && kick) {
      const f = this.player.feet;
      const away = new THREE.Vector3(f.x - from.x, 0, f.z - from.z).normalize().multiplyScalar(kick);
      this.player.velocity.add(away);
      this.player.push ??= new THREE.Vector3();
      this.player.push.y += kick * 8;
    }
  }

  update(dt) {
    this.t += dt;
    const p = this.player;
    const s = p.scale;
    const zone = this.getZone?.() || 'outside';
    const outside = zone === 'outside';
    const f = p.feet;
    p.push ??= new THREE.Vector3();
    p.push.x = 0; p.push.z = 0;
    p.canCling = s < 0.012;                                                    // 13
    // 18: small animals take in the world faster, so it looks slow to them
    this.timeScale = s < 0.5 ? clamp(Math.pow(s / 0.5, 0.11), 0.55, 1) : 1;
    this.slowEl.textContent = this.timeScale < 0.95 ? `⏱ the world looks ${Math.round((1 / this.timeScale) * 10) / 10}× slower to you` : '';
    // 14: metabolism: smaller = hungrier, thirstier, colder
    const small = s < 0.5 ? Math.pow(0.5 / s, 0.35) : 1;
    this.vitals.drainMul = clamp(small, 1, 5);
    const ambient = zone === 'lab' ? 18 : zone === 'house' ? 21 : this.env?.temperature ?? 15;
    const exposure = clamp((Math.pow(0.05 / s, 0.35) - 1) * 0.5, 0, 1);
    const teq = 37 - (37 - ambient) * exposure;
    const tau = 25 * Math.sqrt(clamp(s / 0.05, 0.02, 1));
    this.bodyT += (teq - this.bodyT) * (1 - Math.exp(-dt / tau));
    if (s >= 0.5) this.bodyT += (37 - this.bodyT) * (1 - Math.exp(-dt / 5));
    const cold = clamp((35.5 - this.bodyT) / 4, 0, 1);
    this.coldEl.style.opacity = String(cold * 0.9);
    if (cold > 0) {
      this.tip('cold', 'You\'re freezing! Tiny bodies lose heat super fast. Get somewhere warm (or grow).');
      if (this.bodyT < 34) this.vitals.damage((34 - this.bodyT) * 0.3 * dt, 'cold');
    }
    // 20: below ~2 cm a human body can't work (too few cells for a brain, blood too thick to pump)
    if (s < 0.011) {
      this.tip('tiny', 'Your body isn\'t built for this size. It\'s slowly giving out — grow back before it\'s too late!');
      this.vitals.damage(0.35 * Math.pow(0.011 / s, 0.8) * dt, 'tiny');
    }
    // 17: breathing: tiny lungs don't work like that; dizzy, tired
    const breathless = clamp((0.004 - s) / 0.003, 0, 1);
    this.vitals.energyMul = this.vitals.drainMul * (1 + breathless * 8);
    p.sway = breathless * (Math.sin(this.t * 0.9) * 0.05 + Math.sin(this.t * 2.3) * 0.02);
    if (breathless > 0.2) this.tip('breath', 'It\'s hard to breathe at this size… you feel dizzy.');
    // 16 + 19: blurry tiny eyes, and light starts to bend (rainbow fuzz) at germ size
    const blur = clamp((0.004 / s - 1) * 0.6, 0, 3);
    const rainbow = clamp((0.0025 / s - 1) * 0.3, 0, 0.45);
    const filt = `${blur > 0.05 ? `blur(${blur.toFixed(2)}px) ` : ''}${rainbow > 0.01 ? `saturate(${(1 + rainbow).toFixed(2)}) hue-rotate(${(Math.sin(this.t * 0.7) * rainbow * 40).toFixed(1)}deg)` : ''}`;
    if (this.canvas && this.canvas.style.filter !== filt) this.canvas.style.filter = filt;
    this.rainbowEl.style.opacity = String(rainbow);
    if (rainbow > 0.01) this.rainbowEl.style.transform = `rotate(${(this.t * 12) % 360}deg)`;
    // 11: wind blows you around outside (the smaller, the more)
    if (outside && s < 0.03) {
      const w = this.env?.weather || {};
      const wind = (0.6 + (w.cloud ?? 0) * 1.2 + (w.rain ?? 0) * 1.8) * (0.55 + 0.45 * Math.sin(this.t * 0.6) + 0.3 * Math.sin(this.t * 1.7));
      const k = clamp((0.03 - s) / 0.03, 0, 1) * (p.grounded ? 0.25 : 0.8);
      const dir = new THREE.Vector3(Math.cos(this.t * 0.05), 0, Math.sin(this.t * 0.05));
      p.push.x = dir.x * wind * k; p.push.z = dir.z * wind * k;
      if (wind * k > 0.3) this.tip('wind', 'The wind is pushing you around! At your size, air is thick.');
    }
    // 12: raindrops (2-5 mm) hit tiny you like buckets of water
    const rain = this.env?.weather?.rain ?? 0;
    if (outside && rain > 0.2 && s < 0.03 && Math.random() < dt * rain * 2.5 * (0.03 / s) ** 0.3) {
      this.hurt(clamp(2 * Math.sqrt(0.01 / s), 1, 12), 'raindrop');
      p.push.y -= 6;
      p.velocity.x += rand(-1, 1) * 0.3; p.velocity.z += rand(-1, 1) * 0.3;
      this.splash = 0.6;
      this.audio?.noiseBurst?.({ freq: 900, q: 0.6, dur: 0.15, gain: 0.25 });
      this.tip('rain', 'SPLASH! Raindrops are huge at your size. Get under cover!');
    }
    this.splash = Math.max(0, (this.splash ?? 0) - dt * 1.5);
    this.splashEl.style.opacity = String(this.splash);
    // 12: water surface tension traps something this small
    if (p.inWater && s < 0.02) { p.speedMul = 0.15; this.tip('water', 'You\'re stuck on the water\'s surface! Surface tension is like glue at this size.'); }
    // 6: what's in reach to eat or drink
    this.nearT = (this.nearT ?? 0) - dt;
    if (this.nearT <= 0) { this.nearT = 0.15; this.near = s < 0.15 ? this.findNear() : null; }
    for (const c of [...this.food, ...this.water]) if (!c.mesh.visible && (c.back -= dt) <= 0) c.mesh.visible = true;
    this.updateDew(outside, s);
    // 9: people's feet; 8: pets; 7: bugs; 10: the vacuum
    if (s < 0.15) {
      this.updateFeet(dt);
      this.updatePets(dt);
      this.updateBugs(dt);
    }
    this.updateVacuum(dt);
    this.updateRide(dt);
    this.updateLabels(dt);
  }

  // dew on the grass in the morning (and drops everywhere when it rains): only spawned around tiny you
  updateDew(outside, s) {
    const wet = outside && s < 0.1 && ((this.env?.hour ?? 12) < 9.5 || (this.env?.weather?.rain ?? 0) > 0.2 || (this.env?.wet ?? 0) > 0.3);
    if (!wet) { for (const d of this.dew) d.mesh.visible = false; this.dewAt = null; return; }
    const f = this.player.feet;
    if (this.dewAt && Math.hypot(f.x - this.dewAt.x, f.z - this.dewAt.z) < 0.5) return;
    this.dewAt = f.clone();
    while (this.dew.length < 14) { const m = dropMesh(1); this.scene.add(m); this.dew.push({ mesh: m, pos: m.position, label: 'Drink the dew drop' }); }
    for (const d of this.dew) {
      const size = rand(0.0015, 0.004);
      d.mesh.scale.set(size, size * 0.7, size);
      d.mesh.position.set(f.x + rand(-0.4, 0.4), f.y + size * 0.65, f.z + rand(-0.4, 0.4));
      d.mesh.visible = true;
    }
  }

  // 9: big people don't see you; a foot coming down on you is the end (or close)
  updateFeet() {
    const p = this.player, f = p.feet, s = p.scale;
    for (const h of this.humans) {
      if (h.dead || !h.alive || h.tiny || h.state === 'away' || h.state === 'held' || !h.character.root.visible || h.scale < 12 * s) continue;
      if (Math.hypot(h.position.x - f.x, h.position.z - f.z) > 2 * h.scale) continue;
      for (const side of ['L', 'R']) {
        const foot = h.character.bones[`Bip01_${side}_Foot`];
        if (!foot) continue;
        foot.getWorldPosition(_v);
        const key = h.id * 2 + (side === 'L' ? 0 : 1);
        const prev = this.footY.get(key) ?? _v.y;
        this.footY.set(key, _v.y);
        const ground = h.position.y;
        // the foot bone is the ankle (~9 cm up when planted): a landing is it dropping through ~11.5 cm
        const low = 0.115 * h.scale;
        const landing = prev - _v.y > 0.0002 && _v.y - ground < low && prev - ground >= low;
        if (!landing) continue;
        // a thud you feel through the floor
        const d = Math.hypot(_v.x - f.x, _v.z - f.z);
        this.audio?.tone?.({ at: _v.clone(), ref: 1.5, freq: 55, to: 30, dur: 0.3, gain: clamp(0.4 * (1 - d / 2), 0, 0.4) });
        // the whole sole counts: from a bit behind the ankle to the toes, about a shoe wide
        const toe = h.character.bones[`Bip01_${side}_Toe0`]?.getWorldPosition(new THREE.Vector3());
        const fwd = toe ? toe.clone().sub(_v).setY(0).normalize() : new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
        const rel = new THREE.Vector3(f.x - _v.x, 0, f.z - _v.z);
        const along = rel.dot(fwd), across = Math.abs(rel.x * fwd.z - rel.z * fwd.x);
        const r = 0.3 * 1.8 * s; // your own width
        const under = along > -0.07 * h.scale - r && along < 0.2 * h.scale + r && across < 0.055 * h.scale + r;
        if (under && p.grounded && Math.abs(f.y - ground) < 0.1) {
          this.tip('feet', 'Big people can\'t see you down here. Watch out for feet!');
          this.hurt(s < 0.03 * h.scale ? 999 : 45, 'stepped', _v, 2);
        } else if (d < 0.35 * h.scale) this.tip('feet', 'Big people can\'t see you down here. Watch out for feet!');
      }
    }
  }

  // 8: your pets: the rat sees a snack, the gecko's tongue is fast
  updatePets() {
    const p = this.player, f = p.feet;
    const rat = this.rat();
    if (rat && rat.agent && !this.riding && p.scale < 0.1) {
      const rp = rat.holder.position;
      const d = Math.hypot(rp.x - f.x, rp.z - f.z);
      if (d < 3 && Math.abs(rp.y - f.y) < 0.3) {
        const q = rat.agent && this.pets.nav.closest(f);
        if (q && this.cooldown('ratchase', 0.5)) rat.agent.requestMoveTarget(q);
        if (d < 0.1 && this.cooldown('ratbite', 1.6)) {
          this.hurt(18, 'rat', rp, 1.5);
          this.speech?.say(rat, pick(['*SQUEAK!*', '*chomp*', '*sniff sniff... BITE*']));
          this.tip('rat', `${rat.profile.name} thinks you're food! Pets see tiny things as prey.`);
        }
      }
    }
    const gecko = this.pets?.list.find((x) => x.kind === 'gecko');
    if (gecko) {
      const gp = gecko.model.getWorldPosition(new THREE.Vector3());
      if (f.distanceTo(gp) < 0.09 && this.cooldown('gecko', 2)) {
        gecko.lick = 1;
        this.hurt(30, 'gecko', gp, 1);
        this.tip('gecko', 'The gecko\'s tongue shot out at you!');
      }
    }
  }

  // 7: in the terrarium the spider hunts you and ants bite (and, if you turn it on, they talk)
  updateBugs() {
    const p = this.player, f = p.feet;
    const talk = this.settings.get('tiny.talkingBugs');
    for (const b of this.bugs?.list || []) {
      const bp = b.mesh.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(bp.x - f.x, bp.z - f.z);
      if (Math.abs(bp.y - f.y) > 0.05) continue;
      if (b.kind === 'spider' && p.inCage) {
        if (d < 0.35) {
          // hunt: head straight for you
          b.target = b.mesh.parent.worldToLocal(f.clone()).setY(0);
          b.wait = 0;
          this.tip('spider', 'The spider is hunting you! Run!');
        }
        if (d < 0.02 && this.cooldown('spiderbite', 1.4)) this.hurt(14, 'spider', bp, 1.2);
      } else if (b.kind === 'ant' && d < 0.006 && this.cooldown(`ant${this.bugs.list.indexOf(b)}`, 1)) {
        this.hurt(3, 'ant', bp, 0.3);
        this.tip('ant', 'Ouch! Ants bite.');
      }
      if (talk && d < 0.12 && this.cooldown(`talk${this.bugs.list.indexOf(b)}`, 7)) {
        b.voice ??= { character: { root: b.mesh, bones: {} }, profile: { name: b.kind }, alive: true, scale: b.size };
        this.speech?.say(b.voice, pick(BUG_LINES[b.kind] || BUG_LINES.ant));
      }
    }
    // germ world mites (talking, if turned on)
    if (talk && this.germs?.active) {
      for (const mt of this.germs.mites) {
        const d = Math.hypot(mt.m.position.x - f.x, mt.m.position.z - f.z);
        if (d < 0.004 && this.cooldown(`mite${this.germs.mites.indexOf(mt)}`, 8)) {
          mt.voice ??= { character: { root: mt.m, bones: {} }, profile: { name: 'mite' }, alive: true, scale: 0.0002 };
          this.speech?.say(mt.voice, pick(BUG_LINES.mite));
        }
      }
    }
  }

  // 10: Mom's vacuum (family.js moves her around with it); tiny you near the nozzle gets pulled in
  updateVacuum(dt) {
    const mom = this.family?.parents.find((h) => h.role === 'mom');
    const vac = this.family?.vacuum;
    const on = !!(mom && vac && mom.vacuuming && (mom.state === 'idle' || mom.state === 'walking') && !mom.tiny && !mom.dead);
    if (vac) vac.visible = on;
    this.audio?.vacuum?.(on ? vac.position : null);
    if (!on) return;
    const head = vac.userData.head.getWorldPosition(new THREE.Vector3());
    const p = this.player, f = p.feet;
    const d = Math.hypot(head.x - f.x, head.z - f.z);
    if (p.scale < 0.06 && d < 0.6 && Math.abs(head.y - f.y) < 0.2) {
      const pull = new THREE.Vector3(head.x - f.x, 0, head.z - f.z).normalize().multiplyScalar(clamp(0.6 - d, 0, 0.6) * 3);
      p.push.x += pull.x; p.push.z += pull.z;
      this.tip('vacuum', 'The VACUUM! It\'s pulling you in — run!');
      if (d < 0.12 && !this.hazards.fading) {
        this.vitals.damage(20, 'vacuum');
        this.hazards.blackout('SHHHHLLLUUURP! The vacuum sucked you up… Mom emptied the bag into the trash can by the road.', new THREE.Vector3(5.6, 3.3, 6.2), { revive: false });
      }
    }
  }

  // settings (not realistic): ride the rat, steering with WASD
  updateRide() {
    const r = this.riding;
    if (!r) return;
    const p = this.player;
    // knocked out / teleported: just let go (don't pull you back to the rat)
    if (this.hazards?.fading || this.vitals.dead) { this.riding = null; p.frozen = false; return; }
    if (!this.pets?.list.includes(r) || p.scale > 0.12 || this.input.pressed('jump') || this.input.pressed('interact') && this.rideT > 0.3) {
      this.riding = null;
      p.frozen = false;
      p.placeFeet(r.holder.position.clone().add(new THREE.Vector3(0.12, 0, 0)));
      return;
    }
    this.rideT = (this.rideT ?? 0) + 1 / 60;
    const mv = this.input.moveVector();
    if (Math.hypot(mv.x, mv.y) > 0.2 && r.agent) {
      const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
      const ahead = r.holder.position.clone().add(new THREE.Vector3(mv.x * cos - mv.y * sin, 0, -mv.x * sin - mv.y * cos).multiplyScalar(0.8));
      const q = this.pets.nav.closest(ahead);
      if (q) r.agent.requestMoveTarget(q);
      r.think = 1; // you're steering, not its brain
    } else r.agent?.resetMoveTarget();
    p.placeFeet(r.holder.position.clone().setY(r.holder.position.y + 0.07));
  }

  // settings (not realistic): labels on the tiny things you look at
  updateLabels(dt) {
    this.labelT = (this.labelT ?? 0) - dt;
    if (this.labelT > 0) return;
    this.labelT = 0.2;
    const on = this.settings.get('tiny.labels') && this.player.scale < 0.15;
    if (!on) { this.labelEl.textContent = ''; return; }
    const cam = this.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const range = 60 * this.player.scale * 1.8;
    const items = [];
    for (const c of this.food) if (c.mesh.visible) items.push([c.pos, `Bread crumb · ${(c.size * 2000).toFixed(1)} mm · food (a loaf to you)`]);
    for (const w of [...this.water, ...this.dew]) if (w.mesh.visible) items.push([w.pos, 'Water droplet · drink it']);
    for (const b of this.bugs?.list || []) items.push([b.mesh.getWorldPosition(new THREE.Vector3()), { spider: 'Spider · DANGEROUS — it hunts small things', ant: 'Ant · bites if you get too close', beetle: 'Beetle · harmless' }[b.kind]]);
    for (const mt of this.germs?.active ? this.germs.mites : []) items.push([mt.m.position, 'Dust mite · 0.3 mm · harmless, eats skin flakes']);
    const rat = this.rat(); if (rat) items.push([rat.holder.position, `${rat.profile.name} the rat · sees you as food!`]);
    let best = null, ba = 0.12;
    for (const [pos, text] of items) {
      const to = pos.clone().sub(cam.position);
      const d = to.length();
      if (d > range) continue;
      const a = to.normalize().angleTo(dir);
      if (a < ba) { ba = a; best = text; }
    }
    this.labelEl.textContent = best ? `🔎 ${best}` : '';
  }
}
