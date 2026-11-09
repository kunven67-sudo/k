// Townspeople's days: each has a home (a house on your side of the street) and
// a job that fits their uniform (the chef at the diner, the officer at the
// station, the nurse at the pharmacy...). Mornings they leave home, during the
// day they're at work (inside), evenings they shop and stroll, at night they
// go home and the street empties. Weekends: no work.
const WORK = { police: 'Police', firefighter: 'Police', nurse: 'Pharmacy', chef: 'Diner', 'office worker': 'Bank', builder: 'Hardware', 'delivery driver': 'Grocery', gardener: 'Pet Shop', 'security guard': 'Bank', 'fitness coach': null, carpenter: 'Hardware', 'shop assistant': 'Grocery', cashier: 'Grocery' };

export class TownLife {
  constructor({ humans, env, spots, scene }) {
    Object.assign(this, { humans, env, scene });
    this.homes = spots.filter((s) => s.act === 'door');
    this.shops = spots.filter((s) => s.act === 'shop');
    let i = 0;
    for (const h of humans) {
      if (!h.townie || h.dispatched) continue;
      this.adopt(h, i++);
    }
  }

  adopt(h, i = Math.floor(Math.random() * 100)) {
    h.home = this.homes[i % this.homes.length];
    const shopName = WORK[(h.profile.job || '').replace('police officer', 'police')];
    h.work = shopName ? this.shops.find((s) => s.name === shopName) : null;
    h.startHour = 7 + (i % 5) * 0.3;      // everyone leaves at a slightly different time
    h.bedHour = 21 + (i % 4) * 0.5;
    const prev = h.brain;
    h.brain = (dt) => (prev?.(dt)) || this.routine(h, dt);
  }

  plan(h) {
    const t = this.env?.hour ?? 12;
    const weekday = ((this.env?.day ?? 1) - 1) % 7 < 5;
    if (t >= h.bedHour || t < h.startHour) return 'home';
    if (weekday && h.work && t >= h.startHour + 1 && t < 17) return 'work';
    return 'out';
  }

  routine(h, dt) {
    if (h.tiny || h.dead || h.state === 'held' || h.isCop && h.copBusy) return false;
    const want = this.plan(h);
    if (h.state === 'away') {
      if (h.awayFor !== want) {
        // out the door they went in by
        const q = h.nav.closest(h.awaySpot.p);
        h.placeAt(q ? h.awaySpot.p.clone().set(q.x, q.y, q.z) : h.awaySpot.p.clone(), this.scene);
        h.character.root.visible = true;
        h.awayFor = null;
      }
      return true;
    }
    if (want === 'out') return false; // the normal brain: shops, benches, strolls
    const spot = want === 'home' ? h.home : h.work;
    if (!spot) return false;
    if (h.state !== 'walking' || h.goingTo !== spot) { if (h.goTo(spot.p)) h.goingTo = spot; else return false; }
    if (Math.hypot(h.position.x - spot.p.x, h.position.z - spot.p.z) < 0.7) {
      // inside: gone from the street until it's time to come out
      h.goingTo = null;
      h.awaySpot = spot;
      h.awayFor = want;
      if (h.agent) { h.nav.removeAgent(h.agent); h.agent = null; }
      if (h.capsule) { h.physics.removeCapsule(h.capsule); h.capsule = null; }
      h.state = 'away';
      h.character.root.visible = false;
    }
    return true;
  }
}
