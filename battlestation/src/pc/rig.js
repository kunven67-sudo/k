import * as THREE from 'three';
import { Hardware, gpuInfo } from './hardware.js';
import { Router } from '../net/router.js';
import { OS } from './os.js';
import { makeCursor } from '../world/monitor.js';
import { canvasTex } from '../world/materials.js';
import { mesh } from '../world/build.js';

// Glue between the 3D desk and the in-game computer: the hardware, the internet box, the OS,
// every button / plug / panel you can touch, fan noise, and saving all of it.
const HOT = { arrow: [1, 1], hand: [9, 2], text: [8, 15], cross: [16, 16], busy: [1, 1] };

export class Rig {
  constructor(g) {
    this.g = g;
    const d = this.desk = g.desk;
    g.hw = this.hw = new Hardware(g);
    g.router = this.router = new Router(g);
    this.restore();
    d.tower.setGpu(this.hw.parts.gpu.cls);
    d.tower.setRam(this.hw.parts.ram.sticks);
    g.os = this.os = new OS(g, d.monitors);
    g.pc = this;
    this.cursorImgs = {};
    for (const k of Object.keys(HOT)) this.cursorImgs[k] = makeCursor(k);
    g.pcCursorKind = (kind) => { for (const m of d.monitors) m.setCursorImage(this.cursorImgs[kind] || this.cursorImgs.arrow); this.os.hot = HOT[kind] || HOT.arrow; };
    g.onPcPower = (on) => this.onPower(on);
    this.gaze = null;
    this.saveT = 0;
    this.sticker();
    this.wire();
  }

  // ------------------------------------------------------------------ saving
  restore() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('bs_rig') || 'null'); } catch (e) { /* first run */ }
    this.saved = s || {};
    const r = this.router;
    if (s?.router) {
      r.ssid = s.router.ssid || r.ssid; r.password = s.router.password || r.password;
      r.pcKnowsWifi = s.router.pcKnowsWifi ?? true;
      r.outagesOn = s.router.outagesOn ?? true;
    }
    if (s?.parts) {
      const hw = this.hw;
      if (s.parts.gpu && !s.parts.gpu.yours) hw.parts.gpu = { ...gpuInfo(s.parts.gpu.name), yours: false, id: s.parts.gpu.id };
      if (s.parts.ram && !s.parts.ram.yours) hw.parts.ram = { ...s.parts.ram };
      if (s.box) hw.box = s.box.map(p => p.kind === 'gpu' ? { kind: 'gpu', ...gpuInfo(p.name), id: p.id, yours: p.yours } : p);
      hw.dust = s.dust || 0;
    }
  }

  save() {
    const r = this.router, hw = this.hw, c = this.desk.cables;
    const s = {
      router: { ssid: r.ssid, password: r.password, pcKnowsWifi: r.pcKnowsWifi, outagesOn: r.outagesOn },
      plugs: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.plugged])),
      parts: { gpu: hw.parts.gpu.yours ? { yours: true } : { name: hw.parts.gpu.name, id: hw.parts.gpu.id }, ram: hw.parts.ram },
      box: hw.box.map(p => p.kind === 'gpu' ? { kind: 'gpu', name: p.name, id: p.id, yours: p.yours } : p),
      dust: hw.dust,
    };
    try { localStorage.setItem('bs_rig', JSON.stringify(s)); } catch (e) { /* storage blocked */ }
  }

  // ------------------------------------------------------------------ the sticker on the router
  sticker() {
    const R = this.desk.router;
    if (!this.stickerTex) {
      this.stickerTex = canvasTex(512, 256, () => {});
      this.stickerTex.wrapS = this.stickerTex.wrapT = THREE.ClampToEdgeWrapping;
      const m = mesh(new THREE.PlaneGeometry(0.05, 0.025), new THREE.MeshStandardMaterial({ map: this.stickerTex, roughness: 0.6 }), { parent: R.group, cast: false });
      m.position.set(R.W / 2 + 0.0006, 0.11, 0);
      m.rotation.y = Math.PI / 2;
      this.stickerMesh = m;
    }
    const c = this.stickerTex.image.getContext('2d');
    c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#111'; c.font = '700 30px Arial'; c.fillText('NETLINK  N300 Gateway', 24, 48);
    c.font = '22px Arial'; c.fillStyle = '#333';
    c.fillText('Wi-Fi name (SSID):', 24, 100); c.fillText('Wi-Fi password:', 24, 150); c.fillText('Admin: http://192.168.0.1   user: admin', 24, 200);
    c.fillStyle = '#000'; c.font = '700 24px "Courier New", monospace';
    c.fillText(this.router.ssid, 240, 100); c.fillText(this.router.password, 210, 150);
    c.font = '16px Arial'; c.fillStyle = '#666'; c.fillText('S/N 4F2A-77C1-09  MAC 3C:84:6A:4F:2A:10', 24, 236);
    this.stickerTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ things you can touch
  wire() {
    const g = this.g, d = this.desk, os = this.os, it = g.interact, au = g.audio;
    const at = (o) => o.getWorldPosition(new THREE.Vector3());
    // PC power button: tap = on / shut down, hold 4 s = force off
    it.add(d.tower.powerBtn, {
      range: 1.6,
      label: () => !d.cables.pcPower.plugged ? 'Power button (the PC is unplugged)' : os.state === 'off' ? 'Turn on the PC' : os.state === 'sleep' ? 'Wake the PC' : 'Power button',
      hold: { time: 4, label: 'Hold to force off', enabled: () => os.on, done: () => { os.hardOff(); au.play('button.ogg', { pos: at(d.tower.powerBtn), vol: 0.5, rate: 0.9 }); } },
      use: () => { au.play('button.ogg', { pos: at(d.tower.powerBtn), vol: 0.5 }); os.powerButton(false); },
    });
    // monitor buttons
    d.monitors.forEach((m, i) => {
      it.add(m.btn, {
        range: 1.6, label: () => m.on ? `Turn off monitor ${i + 1}` : `Turn on monitor ${i + 1}`,
        use: () => { m.on = !m.on; au.play('button.ogg', { pos: at(m.btn), vol: 0.35, rate: 1.3 }); g.envDirty = true; },
      });
    });
    // plugs
    const plugs = [
      ['pcPower', 'PC power cable'], ['routerPower', 'internet box power cable'], ['wan', 'internet cable (coax)'], ['ethernet', 'ethernet cable'],
    ];
    for (const [k, name] of plugs) {
      const c = d.cables[k];
      if (this.saved.plugs && this.saved.plugs[k] === false) { c.set(false); c.t = 0; }
      it.add(c.head, {
        range: 1.7, label: () => c.plugged ? `Unplug the ${name}` : `Plug in the ${name}`,
        use: () => { this.plug(k, !c.plugged); },
      });
    }
    this.applyPlugs(true);
    // side glass panel
    it.add(d.tower.glassPivot, {
      range: 1.6, label: () => d.tower.panelTarget ? 'Close the side panel' : 'Open the side panel',
      use: () => { d.tower.panelTarget = d.tower.panelTarget ? 0 : 1; au.play('pickup.ogg', { pos: at(d.tower.group), vol: 0.4 }); },
    });
    it.add(d.tower.gpuHolder, {
      range: 1.6, enabled: () => d.tower.panelOpen > 0.8, solid: false, label: () => 'Swap parts',
      use: () => g.ui?.openMenu('parts'),
    });
    // reset pinhole on the back of the router (you keep a paperclip next to it)
    const R = d.router;
    const pin = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ visible: false }), { parent: R.group, cast: false });
    pin.position.copy(R.ports.reset);
    this.paperclip(R);
    it.add(pin, {
      range: 1.6, label: () => 'Reset pinhole',
      hold: { time: 10, label: 'Hold with the paperclip (10 s factory reset)', done: () => { this.router.factoryReset(); this.sticker(); this.save(); au.beep(1200, 0.08, { vol: 0.03, pos: at(R.group) }); } },
      use: () => g.toast('Hold it in for 10 seconds to reset the internet box.'),
    });
  }

  paperclip(R) {
    const curve = new THREE.CurvePath();
    const pts = [[0, 0], [0.026, 0], [0.026, 0.008], [0.003, 0.008], [0.003, 0.002], [0.021, 0.002], [0.021, 0.006]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    const geo = new THREE.TubeGeometry(curve, 48, 0.0005, 6, false);
    const clip = mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 1 }), { parent: R.group, cast: false });
    clip.position.set(-0.04, 0.0125, R.Dp / 2 + 0.03);
    clip.rotation.y = 0.5;
  }

  plug(k, on) {
    const c = this.desk.cables[k];
    if (c.plugged === on) return;
    c.set(on);
    this.g.audio.play('plug.ogg', { pos: c.head.getWorldPosition(new THREE.Vector3()), vol: 0.5, rate: on ? 1 : 1.15 });
    this.applyPlugs(false);
    this.save();
  }

  applyPlugs(initial) {
    const c = this.desk.cables, r = this.router;
    if (!c.pcPower.plugged && this.os?.on) this.os.hardOff();
    if (initial) { r.power = c.routerPower.plugged; r.wan = c.wan.plugged; if (!r.power) r.bootT = 0; }
    else { r.setPower(c.routerPower.plugged); r.setWan(c.wan.plugged); }
    r.setLan(c.ethernet.plugged);
  }

  onPower(on) {
    const t = this.desk.tower;
    t.on = on;
    if (on) this.g.audio.play('switch_on.ogg', { pos: t.group.getWorldPosition(new THREE.Vector3()), vol: 0.15, rate: 0.6 });
    this.g.envDirty = true;
  }

  // parts swapping (called from the parts menu). Returns a message.
  swap(part) {
    const hw = this.hw, os = this.os, t = this.desk.tower;
    if (t.panelOpen < 0.5) return 'Open the side panel first.';
    if (os.on) {
      // yanking a card out of a running PC: instant crash
      os.hardOff();
      this.g.audio.play('plug.ogg', { pos: t.group.getWorldPosition(new THREE.Vector3()), vol: 0.7, rate: 0.6 });
      return 'You pulled a part out while the PC was running. It crashed and shut off. (Turn it off first next time.)';
    }
    const box = hw.box;
    const i = box.indexOf(part);
    if (i < 0) return '';
    if (part.kind === 'gpu') {
      const old = hw.parts.gpu;
      hw.parts.gpu = { ...part, yours: part.yours || false };
      box.splice(i, 1, { kind: 'gpu', ...gpuInfo(old.name), id: old.id || 'yours', yours: !!old.yours });
      t.setGpu(hw.parts.gpu.cls);
    } else if (part.kind === 'ram') {
      const old = hw.parts.ram;
      hw.parts.ram = { sticks: part.sticks, gb: part.gb, name: part.name, yours: !!part.yours };
      box.splice(i, 1, { kind: 'ram', sticks: old.sticks, gb: old.gb, id: old.yours ? 'ramyours' : 'ram' + old.gb, name: old.name || `${old.gb} GB (${old.sticks} sticks)${old.yours ? ' - yours' : ''}`, yours: !!old.yours });
      t.setRam(hw.parts.ram.sticks);
    }
    this.g.audio.play('pickup.ogg', { pos: t.group.getWorldPosition(new THREE.Vector3()), vol: 0.5 });
    this.save();
    return 'Installed. Close the panel and turn the PC on.';
  }

  // where the in-game cursor is in the 3D room (for your eyes); k = how much to follow the cursor
  cursorWorld(k = 1) {
    const os = this.os, c = os.cursor, disp = os.displayAt(c.x, c.y), mon = disp.mon;
    const u = (c.x - disp.x) / disp.w, v = (c.y - disp.y) / disp.h;
    const center = mon.screen.localToWorld(new THREE.Vector3(0, 0, 0));
    const p = mon.screen.localToWorld(new THREE.Vector3((u - 0.5) * mon.sw, (0.5 - v) * mon.sh, 0));
    const want = center.lerp(p, k);
    if (!this.gaze) this.gaze = want.clone();
    return this.gaze.clone();
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, os = this.os, hw = this.hw, t = this.desk.tower;
    this.router.update(dt);
    os.update(dt);
    t.sleep = os.state === 'sleep';
    hw.update(dt, os.on && os.state !== 'sleep', os.load.gpu, os.load.cpu);
    g.pcLoad = os.on ? Math.max(os.load.gpu, (hw.temps.gpu - 40) / 50) : 0;
    t.dust = hw.dust;
    // smooth gaze target
    if (this.gaze) {
      const c = os.cursor, disp = os.displayAt(c.x, c.y), mon = disp.mon;
      const u = (c.x - disp.x) / disp.w, v = (c.y - disp.y) / disp.h;
      const center = mon.screen.localToWorld(new THREE.Vector3(0, 0, 0));
      const p = mon.screen.localToWorld(new THREE.Vector3((u - 0.5) * mon.sw, (0.5 - v) * mon.sh, 0));
      this.gaze.lerp(center.lerp(p, 0.3), Math.min(1, dt * 5));
    }
    // fan + coil noise from the tower
    const au = g.audio;
    if (au.ctx && !this.fanSnd) {
      const pos = t.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0));
      this.fanSnd = au.noiseLoop({ freq: 520, q: 0.4, pos, ref: 0.4, rolloff: 1.6 });
      this.whine = au.noiseLoop({ freq: 3200, q: 9, pos, ref: 0.3, rolloff: 2 });
    }
    if (this.fanSnd) {
      const sp = t.fanSpeed;
      this.fanSnd.setVolume(sp * 0.07 * (1 + hw.dust * 0.6));
      this.fanSnd.setFreq(380 + sp * 520);
      this.whine.setVolume(os.on ? hw.load.gpu * 0.006 : 0);
    }
    this.saveT += dt;
    if (this.saveT > 15) { this.saveT = 0; this.save(); }
  }
}
