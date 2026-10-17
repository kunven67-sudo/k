import * as THREE from 'three';

// The internet box (modem + router combo). Behaves like a real one:
// - pull the power or the coax cable and the internet goes down
// - plug it back in and it takes about a minute to boot and get online again
// - the ethernet cable to the PC can be pulled too (then the PC falls back to Wi-Fi)
// - if your REAL internet drops, the in-game internet drops with it
// - random short ISP outages (can be switched off in settings)
// - hold the reset pinhole with a paperclip for 10 s to factory reset (new Wi-Fi password!)
export class Router {
  constructor(game) {
    this.g = game;
    this.power = true;      // power cable in
    this.wan = true;        // coax in
    this.lan = true;        // ethernet cable to the PC in
    this.bootT = 999;       // seconds since power-on (999 = long booted)
    this.syncT = 999;       // seconds since the WAN line came back
    this.realOnline = navigator.onLine;
    this.outage = 0;        // seconds of outage left
    this.nextOutage = 1800 + Math.random() * 3600;
    this.outagesOn = true;
    this.activity = 0;
    this.time = 0;
    this.ssid = 'NETLINK-4F2A';
    this.password = makePass();
    this.pcKnowsWifi = true;  // the PC has the Wi-Fi password saved
    this.plan = { name: 'NETLINK Fiber 300', down: 300, up: 20 };
    this.resetHold = 0;
    addEventListener('online', () => { this.realOnline = true; this.probe(); });
    addEventListener('offline', () => { this.realOnline = false; });
    this.probe();
    setInterval(() => this.probe(), 20000);
  }

  // Is the REAL internet up? (a tiny request to a "no content" page)
  async probe() {
    if (!navigator.onLine) { this.realOnline = false; return; }
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      await fetch('https://www.gstatic.com/generate_204?bs=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: c.signal });
      clearTimeout(t);
      this.realOnline = true;
    } catch (e) {
      // file:// pages or strict networks can block this; only trust navigator.onLine then
      this.realOnline = navigator.onLine;
    }
  }

  setPower(on) {
    if (on === this.power) return;
    this.power = on;
    if (on) { this.bootT = 0; this.syncT = 0; }
  }
  setWan(on) { if (on === this.wan) return; this.wan = on; if (on) this.syncT = 0; }
  setLan(on) { this.lan = on; }

  factoryReset() {
    this.password = makePass();
    this.ssid = 'NETLINK-' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    this.pcKnowsWifi = false;
    this.bootT = 0; this.syncT = 0;
    this.g.toast('Router factory reset. The Wi-Fi name and password changed (they are on the sticker on its side).', 5000);
  }

  booted() { return this.power && this.bootT > 50; }
  wanUp() { return this.booted() && this.wan && this.syncT > 22 && this.outage <= 0 && this.realOnline; }
  wifiUp() { return this.power && this.bootT > 32; }

  // what the in-game PC sees
  link(pcHasWifi = true) {
    if (this.lan && this.power && this.bootT > 6) return 'ethernet';
    if (pcHasWifi && this.wifiUp() && this.pcKnowsWifi) return 'wifi';
    return null;
  }

  status(pcHasWifi = true) {
    const l = this.link(pcHasWifi);
    if (!l) return { link: null, internet: false, state: 'disconnected' };
    if (!this.wanUp()) return { link: l, internet: false, state: this.booted() && this.wan && this.syncT <= 22 ? 'connecting' : 'nointernet' };
    return { link: l, internet: true, state: 'online' };
  }

  // Wi-Fi signal 0..1 from the PC's distance to the box (and a wall or two)
  signal() {
    const d = this.g.desk;
    if (!d) return 1;
    const a = d.router.group.getWorldPosition(new THREE.Vector3());
    const b = d.tower.group.getWorldPosition(new THREE.Vector3());
    const dist = a.distanceTo(b);
    return Math.max(0.15, Math.min(1, 1.15 - dist * 0.08));
  }

  speed(pcHasWifi = true) {
    const s = this.status(pcHasWifi);
    if (!s.internet) return { down: 0, up: 0, ping: 0 };
    const wifi = s.link === 'wifi';
    const k = wifi ? 0.35 + 0.55 * this.signal() : 0.96;
    const jitter = 0.9 + Math.random() * 0.15;
    return { down: this.plan.down * k * jitter, up: this.plan.up * k * jitter, ping: Math.round((wifi ? 22 : 13) + Math.random() * (wifi ? 14 : 5) + (1 - this.signal()) * 20 * (wifi ? 1 : 0)) };
  }

  touch(amount = 1) { this.activity = Math.min(3, this.activity + amount); }

  update(dt) {
    this.time += dt;
    if (this.power) { this.bootT += dt; if (this.wan) this.syncT += dt; }
    if (this.outagesOn && this.wanUp()) {
      this.nextOutage -= dt;
      if (this.nextOutage <= 0) { this.outage = 40 + Math.random() * 180; this.nextOutage = 2400 + Math.random() * 4800; }
    } else if (!this.outagesOn) this.outage = 0;
    if (this.outage > 0) this.outage -= dt;
    this.activity = Math.max(0, this.activity - dt * 0.8);
    this.updateLeds();
  }

  updateLeds() {
    const L = this.g.desk?.router.leds;
    if (!L) return;
    const t = this.time;
    const set = (k, color, on) => { L[k].mat.emissive.set(on ? color : 0x000000); };
    const blink = (hz) => Math.sin(t * Math.PI * 2 * hz) > 0;
    if (!this.power) { for (const k of Object.keys(L)) set(k, 0, false); return; }
    set('power', this.bootT < 6 ? 0xff9a1f : 0x3cff6a, true);
    if (this.bootT < 6) { set('internet', 0, false); set('wifi', 0, false); set('lan', 0, false); return; }
    const wanUp = this.wanUp();
    if (!this.wan || !this.booted()) set('internet', 0xff9a1f, !this.wan ? true : blink(1.5));
    else if (this.syncT <= 22) set('internet', 0xffffff, blink(2));
    else if (!wanUp) set('internet', 0xff6a1f, true);
    else set('internet', 0xffffff, true);
    const act = this.activity > 0.05;
    set('wifi', 0xffffff, this.wifiUp() && (!act || blink(6 + this.activity * 3)));
    set('lan', 0x3cff6a, this.lan && (!act || blink(8)));
  }
}

function makePass() {
  const w = ['maple', 'river', 'falcon', 'copper', 'velvet', 'orbit', 'pixel', 'cedar', 'harbor', 'ember'];
  return w[Math.floor(Math.random() * w.length)] + '-' + w[Math.floor(Math.random() * w.length)] + '-' + (10 + Math.floor(Math.random() * 89));
}
