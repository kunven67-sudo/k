// Mom and Dad. They live in the house on a daily routine (breakfast, Dad off to
// work, Mom around the house, dinner, TV, bed), give you chores and a weekly
// allowance, and if they catch you with the size watch (or doing something
// awful) they take it away. Shrink them and they are FURIOUS.
import * as THREE from 'three';

const pick = (a) => a[(Math.random() * a.length) | 0];

const PARENT_LINES = {
  shrunk: ['You are SO grounded when I\'m big again!', 'WHAT DID YOU DO?! Turn me back RIGHT NOW!', 'Young man, you put me back to normal this instant!', 'I am your PARENT! Make me big!'],
  grown: ['Thank you. Now go to your room.', 'We are going to have a LONG talk about this.', 'Where did you even GET that thing?!'],
  pickedUp: { scared: ['Put me DOWN! I\'m your mother!', 'This is NOT funny!'], angry: ['PUT. ME. DOWN.', 'You are grounded until you\'re thirty!'], curious: ['Is this... the science project?'], friendly: ['Sweetie, please put me down'] },
  held: { scared: ['I raised you better than this!'], angry: ['Wait until your father hears about this!', 'No allowance. For a YEAR.'], curious: ['How long have you been doing this?'], friendly: ['Okay, joke\'s over, honey'] },
  thrown: ['NOOOO!', 'I\'M YOUR PAREEEENT!'],
  landed: ['Ow... You. Are. Grounded.', 'My back...!'],
  putDown: { scared: ['I need to lie down...'], angry: ['Go to your room. NOW.'], curious: ['We need to talk about this.'], friendly: ['...thank you. Go to your room.'] },
  giantSeen: ['Is that... my KID?!', 'Get down here this instant!', 'What did you DO to yourself?!'],
};

const CHORES = {
  trash: { text: 'Take the kitchen trash out to the bin by the road', pay: 5 },
  tidy: { text: 'Clean your room (pick up your dirty clothes)', pay: 5 },
  dishes: { text: 'Bring your plate down to the kitchen', pay: 3 },
  lights: { text: 'Turn off your light and go to bed', pay: 2 },
};

export class Family {
  constructor({ player, env, speech, toast, interact, scene, physics, home, police }) {
    Object.assign(this, { player, env, speech, toast, interact, scene, physics, home, police });
    this.parents = [];
    this.money = 0;
    this.chores = new Map(); // key -> { text, pay, state }
    this.watchBackAt = null; // game time when you get the size watch back
    this.lastAllowanceDay = 0;
    this.greetedDay = 0;
    this.hudMoney = document.getElementById('money');
    this.hudChores = document.getElementById('chores');
    if (police) police.onParentSaw = (h, kind) => this.sawCrime(h, kind);
    this.setupProps();
    this.addMoney(0);
  }

  get time() { return (this.env?.day ?? 1) * 24 + (this.env?.hour ?? 12); }
  get hour() { return this.env?.hour ?? 12; }

  add(h, role) {
    h.isParent = true;
    h.role = role;
    h.lines = PARENT_LINES;
    h.area = this.home.inHouse;
    h.spots = this.dailySpots(role);
    h.brain = (dt) => this.brain(h, dt);
    h.profile.job = role === 'dad' ? 'accountant' : 'nurse';
    this.parents.push(h);
  }

  // ---- routine

  // where they should be right now: 'home', 'work', 'bed'
  plan(h) {
    const t = this.hour;
    const weekday = ((this.env?.day ?? 1) - 1) % 7 < 5;
    if (t >= 22.5 || t < 6.5) return 'bed';
    if (h.role === 'dad' && weekday && t >= 8.5 && t < 17.5) return 'work';
    if (h.role === 'mom' && weekday && t >= 13 && t < 16) return 'work';
    return 'home';
  }

  dailySpots(role) {
    const S = this.home.spots;
    const t = this.hour;
    if (t < 9) return [S.stove, S.table, S.counter];                         // breakfast
    if (t >= 17.5 && t < 19.5) return role === 'mom' ? [S.stove, S.counter, S.table] : [S.table, S.tv]; // dinner
    if (t >= 19.5) return [S.tv, S.armchair];                                 // TV
    return [S.window, S.counter, S.tv, S.armchair, S.table];
  }

  brain(h, dt) {
    if (h.dead || h.tiny || h.state === 'held') return false;
    const want = this.plan(h);
    const S = this.home.spots;
    const exit = want === 'work' ? S.frontDoor : S.parentsDoor;
    if (h.state === 'away') {
      if (want === 'home') {
        // back: in through the door they left by
        h.placeAt((h.awayAt || exit).p.clone(), this.scene);
        h.character.root.visible = true;
        h.speech?.say(h, h.role === 'dad' && h.awayAt === S.frontDoor ? 'I\'m home!' : 'Good morning!');
      }
      return true;
    }
    if (want !== 'home') {
      // leaving: walk to the door, then gone
      if (!h.leaving || h.state !== 'walking') { h.leaving = true; h.spot = null; if (!h.goTo(exit.p)) h.leaving = false; }
      const d = Math.hypot(h.position.x - exit.p.x, h.position.z - exit.p.z);
      if (d < 0.6) {
        h.leaving = false;
        h.awayAt = exit;
        if (h.agent) { h.nav.removeAgent(h.agent); h.agent = null; }
        if (h.capsule) { h.physics.removeCapsule(h.capsule); h.capsule = null; }
        h.state = 'away';
        h.character.root.visible = false;
      }
      return true;
    }
    h.leaving = false;
    h.spots = this.dailySpots(h.role);
    return false; // the normal brain walks between the spots
  }

  // ---- props for chores

  setupProps() {
    const fy = 3.3;
    const scene = this.scene;
    // dirty clothes on your bedroom floor (soft lumps of fabric)
    this.clothes = [];
    const colors = [0x2f4f8f, 0xb03a2e, 0xe8e4da, 0x3c3c3c];
    [[4.8, -2.2], [5.0, -1.2], [3.2, -0.4], [6.2, -1.9]].forEach(([x, z], i) => {
      const g = new THREE.SphereGeometry(0.16, 12, 8);
      g.scale(1.3, 0.22, 0.9);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.95 }));
      m.position.set(x, fy + 0.03, z);
      m.rotation.y = i * 1.7;
      m.castShadow = m.receiveShadow = true;
      m.visible = false;
      scene.add(m);
      this.clothes.push(m);
      this.interact.add({ at: m.position, radius: 2, label: 'Pick up the dirty clothes', when: () => m.visible && this.chores.has('tidy'), use: () => { m.visible = false; this.checkTidy(); } });
    });
    // your plate (from last night) on your desk
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.25 }));
    plate.position.set(6.25, fy + 0.77, -1.15);
    plate.visible = false;
    scene.add(plate);
    this.plate = plate;
    this.interact.add({ at: plate.position, radius: 2, label: 'Take your plate', when: () => plate.visible && this.chores.has('dishes') && !this.carrying, use: () => { plate.visible = false; this.carry('plate'); } });
    this.interact.add({ at: new THREE.Vector3(-2.6, fy + 0.9, -4.6), radius: 2.2, label: 'Put the plate by the sink', when: () => this.carrying === 'plate', use: () => { this.carry(null); this.done('dishes'); } });
    // kitchen trash -> the bin by the road
    this.interact.add({ at: new THREE.Vector3(-1.9, fy + 0.3, -4.6), radius: 2, label: 'Pick up the trash bag', when: () => this.chores.has('trash') && !this.carrying && !this.trashOut, use: () => { this.carry('trash'); this.setTrashVisible(false); } });
    this.interact.add({ at: new THREE.Vector3(5.05, 3.4, 6.2), radius: 2.2, label: 'Put the trash in the bin', when: () => this.carrying === 'trash', use: () => { this.carry(null); this.trashOut = true; this.done('trash'); } });
    // your light switch (by the bedroom door)
    this.bedroomLamp = null;
    scene.traverse((o) => { if (o.isPointLight && Math.abs(o.position.x - 4.75) < 0.2 && Math.abs(o.position.z + 2.5) < 0.2 && o.position.y > 5) this.bedroomLamp = o; });
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.4 }));
    sw.position.set(4.15, fy + 1.2, -0.015);
    scene.add(sw);
    this.interact.add({ at: sw.position, radius: 1.8, label: () => (this.bedroomLamp?.visible === false ? 'Turn the light on' : 'Turn the light off'), use: () => {
      if (!this.bedroomLamp) return;
      this.bedroomLamp.visible = !this.bedroomLamp.visible;
      if (!this.bedroomLamp.visible && this.chores.has('lights')) this.done('lights');
    } });
  }

  setTrashVisible(v) {
    this.scene.traverse((o) => { if (o.name === 'kitchen-trash') o.visible = v; });
  }

  carry(what) {
    this.carrying = what;
    this.toast?.(what === 'trash' ? 'Carrying the trash bag (take it to the bin by the road)' : what === 'plate' ? 'Carrying your plate (take it to the kitchen)' : '');
  }

  checkTidy() {
    if (this.clothes.every((c) => !c.visible)) this.done('tidy');
  }

  // ---- chores and money

  give(key, from) {
    if (this.chores.has(key)) return;
    const c = { ...CHORES[key] };
    this.chores.set(key, c);
    if (key === 'tidy') for (const m of this.clothes) m.visible = true;
    if (key === 'dishes') this.plate.visible = true;
    if (key === 'trash') { this.trashOut = false; this.setTrashVisible(true); }
    const line = { trash: 'Can you take the trash out, please?', tidy: 'Your room is a mess. Clean it up!', dishes: 'Bring your plate down, it\'s been up there all day!', lights: 'Lights off, bedtime!' }[key];
    if (from && this.near(from)) this.speech?.say(from, line, { secs: 5 });
    else { this.toast?.(`📱 ${from?.profile.name ?? 'Mom'}: ${line}`); this.phone?.text(from?.profile.name ?? 'Mom', line); }
    this.drawChores();
  }

  done(key) {
    const c = this.chores.get(key);
    if (!c) return;
    this.chores.delete(key);
    this.addMoney(c.pay);
    this.toast?.(`Chore done: +$${c.pay}`);
    const mom = this.parents.find((p) => p.role === 'mom' && p.state !== 'away' && !p.tiny);
    if (mom && this.near(mom)) this.speech?.say(mom, pick(['Thank you, sweetie!', 'Good job!', 'See? That wasn\'t so hard.']));
    this.drawChores();
  }

  addMoney(n) {
    this.money += n;
    if (this.hudMoney) this.hudMoney.textContent = `$${this.money}`;
  }

  near(h, r = 9) {
    return h && h.state !== 'away' && h.position.distanceTo(this.player.feet) < r;
  }

  drawChores() {
    const el = this.hudChores;
    if (!el) return;
    el.hidden = this.chores.size === 0;
    el.innerHTML = '<b>Chores</b>' + [...this.chores.values()].map((c) => `<div>☐ ${c.text} <i>$${c.pay}</i></div>`).join('');
  }

  // ---- the size watch, and getting caught

  get watchTaken() { return this.watchBackAt !== null && this.time < this.watchBackAt; }

  confiscate(h, why) {
    if (this.watchTaken) return;
    this.watchBackAt = this.time + 24;
    this.player.watchTaken = true;
    h.emotion.anger = 1;
    this.speech?.say(h, why || 'Give me that watch. NOW.', { shout: true, secs: 5 });
    this.toast?.(`${h.profile.name} took your size watch! (you get it back tomorrow)`);
    // you go back to normal size first
    if (Math.abs(this.player.scale - 1) > 0.01 && !this.player.inCage) this.player.setScale(1, this.player.feet.clone());
  }

  sawCrime(h, kind) {
    const lines = { shrink: 'Did you just SHRINK someone?! Give me that watch. NOW.', grab: 'Put them down! And give me that watch!', throw: 'WHAT ARE YOU DOING?!', kill: 'Oh my god... OH MY GOD!', kidnap: 'Let them go! Right now!' };
    this.confiscate(h, lines[kind] || 'What is WRONG with you?!');
  }

  canSeePlayer(h) {
    if (!h || h.state === 'away' || h.tiny || h.dead || h.state === 'held') return false;
    // they have to be looking your way (the watch is quiet)
    const f = this.player.feet;
    const to = new THREE.Vector3(f.x - h.position.x, 0, f.z - h.position.z).normalize();
    if (to.dot(new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw))) < 0.3) return false;
    return this.police?.canSee(h, this.player.feet.clone().setY(this.player.feet.y + 1.2 * this.player.scale), 14) ?? false;
  }

  update(dt) {
    const p = this.player;
    if (p.watchTaken && !this.watchTaken) { p.watchTaken = false; this.toast?.('You got your size watch back'); }
    // using the size watch in front of them
    this.seeT = (this.seeT ?? 0) - dt;
    if (this.seeT <= 0) {
      this.seeT = 0.4;
      const looking = this.parents.find((h) => this.canSeePlayer(h));
      if (looking && p.sizeChanging) this.confiscate(looking);
      // first time you're seen each day: say hi
      if (looking && this.greetedDay !== this.env?.day && !looking.lastSaid) {
        this.greetedDay = this.env?.day;
        this.speech?.say(looking, pick(['Morning, sweetie!', 'Oh, you\'re up!', 'Hey kiddo. Breakfast is ready.']));
      }
    }
    // chores through the day
    const t = this.hour, day = this.env?.day ?? 1;
    const mom = this.parents.find((h) => h.role === 'mom') || this.parents[0];
    const give = (key, at) => { const id = `${key}@${day}`; if (t >= at && t < at + 2 && !this.given?.has(id)) { (this.given ??= new Set()).add(id); this.give(key, mom); } };
    give('tidy', 9.7);
    give('dishes', 12.5);
    give('trash', 17);
    give('lights', 21.5);
    // allowance on Sundays
    if ((day - 1) % 7 === 6 && t >= 10 && this.lastAllowanceDay !== day) {
      this.lastAllowanceDay = day;
      this.addMoney(10);
      this.toast?.(`📱 ${mom?.profile.name ?? 'Mom'}: Here's your allowance, $10. Spend it wisely!`);
      this.phone?.text(mom?.profile.name ?? 'Mom', 'Here\'s your allowance, $10. Spend it wisely! ❤️');
    }
    // a chore not done by bedtime is gone (and Mom is disappointed)
    if (t >= 23 && this.chores.size) {
      this.chores.clear();
      this.drawChores();
    }
  }
}
