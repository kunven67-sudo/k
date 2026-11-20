// The suit bench: your suit's power module up close. Turn it with the mouse, use real tools on it.
// No hands - the tool does the work. Live wires shock you. What you change changes how the suit works.
import * as THREE from 'three';

const TOOLS = [
  { id: 'driver', name: 'Screwdriver', key: '1', tip: 'Undo / do up screws' },
  { id: 'pliers', name: 'Pliers', key: '2', tip: 'Cut wires, pull chips' },
  { id: 'iron', name: 'Soldering iron', key: '3', tip: 'Join cut wires, bridge pads' },
  { id: 'meter', name: 'Tester', key: '4', tip: 'Read voltage + what a part does' },
];

export class SuitBench {
  constructor(renderer, audio) {
    this.r = renderer; this.audio = audio; this.hooks = {};
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0e0f12);
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.drag = null;
    this.rotY = 0.5; this.rotX = 0.55; this.dist = 0.62; this.tool = 'driver';
    this.state = {}; this.build(); this.reset(); this.bindUI();
  }
  reset() {
    Object.assign(this.state, { limiter: true, oc: false, mass: false, speedWire: true, shrinkWire: true, battery: true, shield: true, leadCut: false });
    this.cover = true; this.shieldOn = true; this.chipOut = false;
    this.screws.forEach(s => { s.userData.in = true; s.visible = true; s.position.copy(s.userData.home); });
    for (const w of Object.values(this.wires)) this.setWire(w, true);
    this.ocBridge.visible = false; this.massBridge.visible = false;
    this.coverMesh.position.copy(this.coverHome); this.coverMesh.rotation.set(0, 0, 0); this.coverMesh.visible = true;
    this.shieldMesh.position.copy(this.shieldHome); this.shieldMesh.visible = true;
    this.chip.position.copy(this.chipHome); this.chip.visible = true;
    this.clamp.position.copy(this.clampHome);
    this.sync();
  }
  sync() {
    const S = this.state, clampIn = this.screws.filter(s => s.userData.group === 'clamp' && s.userData.in).length === 2;
    S.battery = clampIn && !S.leadCut; S.limiter = !this.chipOut; S.shield = this.shieldOn;
    S.shrinkWire = !this.wires.shrink.userData.cut; S.speedWire = !this.wires.speed.userData.cut; S.leadCut = this.wires.lead.userData.cut;
    S.battery = clampIn && !S.leadCut;
    S.oc = this.ocBridge.visible; S.mass = this.massBridge.visible;
  }
  // ---------------- the module, built to scale (meters: it's about 24 cm wide) ----------------
  build() {
    const sc = this.scene, M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0, ...o });
    const metal = M(0x9aa1ab, { metalness: 1, roughness: 0.32 }), dark = M(0x1c1e22, { roughness: 0.6 }), steel = M(0xc8cdd4, { metalness: 1, roughness: 0.25 });
    const copper = M(0xb87333, { metalness: 1, roughness: 0.3 });
    // bench: ESD mat
    const mat = document.createElement('canvas'); mat.width = mat.height = 512; const g = mat.getContext('2d');
    g.fillStyle = '#2a3a33'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    const mt = new THREE.CanvasTexture(mat); mt.colorSpace = THREE.SRGBColorSpace; mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(4, 4);
    const benchM = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), M(0xffffff, { map: mt, roughness: 0.9 })); benchM.rotation.x = -Math.PI / 2; benchM.position.y = -0.06; benchM.receiveShadow = true; sc.add(benchM);
    const lamp = new THREE.SpotLight(0xfff0dd, 30, 4, 0.7, 0.6, 1.5); lamp.position.set(0.4, 1.1, 0.5); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); sc.add(lamp, lamp.target);
    sc.add(new THREE.HemisphereLight(0xbfd0ff, 0x202018, 0.6));
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.6); fill.position.set(-1, 0.5, -0.6); sc.add(fill);
    const mod = this.mod = new THREE.Group(); sc.add(mod);
    const add = (geo, m, p, part, parent = mod) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); o.castShadow = o.receiveShadow = true; if (part) o.userData.part = part; parent.add(o); return o; };
    // back plate (housing)
    add(new THREE.BoxGeometry(0.24, 0.012, 0.16), M(0x2b2f36, { metalness: 0.6, roughness: 0.4 }), [0, 0, 0], 'housing');
    for (const [x, z, w, d] of [[0, -0.077, 0.24, 0.006], [0, 0.077, 0.24, 0.006], [-0.117, 0, 0.006, 0.16], [0.117, 0, 0.006, 0.16]]) add(new THREE.BoxGeometry(w, 0.03, d), M(0x2b2f36, { metalness: 0.6, roughness: 0.4 }), [x, 0.015, z], 'housing');
    // battery: two 18650-size cells in a wrap
    const bat = new THREE.Group(); bat.position.set(-0.065, 0.024, 0.02); mod.add(bat);
    for (const z of [-0.022, 0.022]) { const c = add(new THREE.CylinderGeometry(0.0185, 0.0185, 0.068, 24), M(0x2453a8, { roughness: 0.35 }), [0, 0, z], 'battery', bat); c.rotation.z = Math.PI / 2; const t = add(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), steel, [0.036, 0, z], 'battery', bat); t.rotation.z = Math.PI / 2; }
    this.clamp = add(new THREE.BoxGeometry(0.012, 0.006, 0.09), steel, [-0.065, 0.046, 0.02], 'clamp'); this.clampHome = this.clamp.position.clone();
    // board
    const pcb = document.createElement('canvas'); pcb.width = 1024; pcb.height = 768; const p = pcb.getContext('2d');
    p.fillStyle = '#0d4a2c'; p.fillRect(0, 0, 1024, 768);
    p.strokeStyle = '#c99a3a'; p.lineCap = 'round';
    for (let i = 0; i < 70; i++) { p.lineWidth = Math.random() < 0.2 ? 10 : 4; let x = Math.random() * 1024, y = Math.random() * 768; p.beginPath(); p.moveTo(x, y); for (let j = 0; j < 4; j++) { if (Math.random() < 0.5) x += (Math.random() - 0.5) * 300; else y += (Math.random() - 0.5) * 300; p.lineTo(x, y); } p.stroke(); }
    p.fillStyle = 'rgba(13,74,44,0.55)'; p.fillRect(0, 0, 1024, 768);
    p.fillStyle = '#d8b05a'; for (let i = 0; i < 160; i++) { const x = Math.random() * 1024, y = Math.random() * 768; p.beginPath(); p.arc(x, y, 6, 0, 7); p.fill(); }
    p.fillStyle = '#eef'; p.font = 'bold 30px monospace';
    [['LIM', 600, 330], ['OC', 250, 610], ['MASS', 470, 610], ['CORE', 840, 130], ['SPD', 840, 690], ['BATT+', 40, 60], ['BATT-', 40, 720]].forEach(([s, x, y]) => p.fillText(s, x, y));
    p.font = '22px monospace'; p.fillText('SHRINK/SPD CTRL  REV 3  - DO NOT BRIDGE OC OR MASS', 200, 40);
    const pt = new THREE.CanvasTexture(pcb); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8;
    const board = add(new THREE.BoxGeometry(0.12, 0.003, 0.09), [M(0x0d4a2c), M(0x0d4a2c), M(0xffffff, { map: pt, roughness: 0.45, metalness: 0.1 }), M(0x0d4a2c), M(0x0d4a2c), M(0x0d4a2c)], [0.035, 0.012, -0.005], 'board');
    void board;
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.008 + Math.random() * 0.01, 0.003, 0.006 + Math.random() * 0.008), dark, [0.0 + Math.random() * 0.08, 0.0152, -0.04 + Math.random() * 0.07], 'board');
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 16), M(0x283a8a, { roughness: 0.3 }), [0.005 + i * 0.012, 0.019, 0.032], 'board');
    // limiter chip in its socket
    add(new THREE.BoxGeometry(0.018, 0.003, 0.012), M(0xe0d6c0), [0.045, 0.0148, -0.012], 'socket');
    this.chip = add(new THREE.BoxGeometry(0.014, 0.004, 0.009), dark, [0.045, 0.018, -0.012], 'chip'); this.chipHome = this.chip.position.clone();
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.0012, 0.0025, 0.002), steel, [0.039 + i * 0.004, 0.0165, -0.012 + s * 0.0052], null, this.chip.parent);
    // OC + MASS pads (bridge them with solder)
    const pad = (x, z, name) => { add(new THREE.BoxGeometry(0.004, 0.0008, 0.004), M(0xd9d9d9, { metalness: 1, roughness: 0.2 }), [x - 0.003, 0.0138, z], name); add(new THREE.BoxGeometry(0.004, 0.0008, 0.004), M(0xd9d9d9, { metalness: 1, roughness: 0.2 }), [x + 0.003, 0.0138, z], name); const b = add(new THREE.SphereGeometry(0.0035, 12, 8), M(0xbfc4c8, { metalness: 1, roughness: 0.15 }), [x, 0.0142, z], name); b.scale.set(1.6, 0.45, 0.9); return b; };
    this.ocBridge = pad(0.0, 0.035, 'oc'); this.massBridge = pad(0.022, 0.035, 'mass');
    // shrink core: a glowing crystal in a copper coil
    const core = new THREE.Group(); core.position.set(0.08, 0.032, -0.05); mod.add(core);
    this.crystal = add(new THREE.OctahedronGeometry(0.011, 0), M(0xff3a2a, { emissive: 0xff2a10, emissiveIntensity: 2, roughness: 0.1, transparent: true, opacity: 0.9 }), [0, 0.004, 0], 'core', core);
    for (let i = 0; i < 7; i++) { const t = add(new THREE.TorusGeometry(0.016, 0.0018, 8, 32), copper, [0, -0.01 + i * 0.0035, 0], 'core', core); t.rotation.x = Math.PI / 2; }
    // speed coil: copper toroid
    const sp = add(new THREE.TorusGeometry(0.016, 0.006, 16, 48), copper, [0.08, 0.02, 0.05], 'coil'); sp.rotation.x = Math.PI / 2;
    // wires: battery lead (red), shrink (blue), speed (yellow)
    this.wires = {};
    const wire = (name, color, pts, r) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)));
      const mid = Math.floor(48 / 2);
      const make = (a, b) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.getPoints(48).slice(a, b)), 24, r, 8, false);
      const g = new THREE.Group(); mod.add(g);
      const m = M(color, { roughness: 0.5 });
      const A = add(make(0, mid - 1), m, [0, 0, 0], 'wire:' + name, g), B = add(make(mid + 1, 49), m, [0, 0, 0], 'wire:' + name, g);
      const whole = add(new THREE.TubeGeometry(curve, 48, r, 8, false), m, [0, 0, 0], 'wire:' + name, g);
      const pmid = curve.getPoint(0.5);
      const blob = add(new THREE.SphereGeometry(r * 1.9, 12, 8), M(0xbfc4c8, { metalness: 1, roughness: 0.2 }), [pmid.x, pmid.y, pmid.z], 'wire:' + name, g);
      const cu = add(new THREE.SphereGeometry(r * 0.8, 8, 6), copper, [pmid.x, pmid.y, pmid.z], 'wire:' + name, g);
      const hitM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      add(new THREE.TubeGeometry(curve, 24, r * 3.2, 6, false), hitM, [0, 0, 0], 'wire:' + name, g).castShadow = false;
      g.userData = { A, B, whole, blob, cu, cut: false, joined: false, name }; return g;
    };
    this.wires.lead = wire('lead', 0xc0281e, [[-0.03, 0.026, 0.02], [-0.015, 0.04, 0.02], [0.0, 0.03, 0.0], [-0.02, 0.022, -0.02], [-0.005, 0.016, -0.03]], 0.0028);
    this.wires.shrink = wire('shrink', 0x2a62d8, [[0.055, 0.016, -0.03], [0.045, 0.045, -0.045], [0.055, 0.048, -0.07], [0.072, 0.03, -0.068]], 0.0018);
    this.wires.speed = wire('speed', 0xe0b21a, [[0.055, 0.016, 0.02], [0.045, 0.045, 0.035], [0.055, 0.048, 0.062], [0.07, 0.026, 0.06]], 0.0018);
    // cover (with 4 screws) + heat shield underneath (4 screws)
    this.coverMesh = add(new THREE.BoxGeometry(0.236, 0.006, 0.156), M(0x3a3f47, { metalness: 0.7, roughness: 0.35 }), [0, 0.054, 0], 'cover'); this.coverHome = this.coverMesh.position.clone();
    const lbl = document.createElement('canvas'); lbl.width = 512; lbl.height = 128; const l = lbl.getContext('2d'); l.fillStyle = '#e8e2d4'; l.fillRect(0, 0, 512, 128); l.fillStyle = '#111'; l.font = 'bold 44px sans-serif'; l.fillText('WARNING: LIVE CELLS', 20, 58); l.font = '28px sans-serif'; l.fillText('Disconnect battery before service', 20, 104);
    const lt = new THREE.CanvasTexture(lbl); lt.colorSpace = THREE.SRGBColorSpace;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.025), M(0xffffff, { map: lt })); lab.rotation.x = -Math.PI / 2; lab.position.y = 0.0032; this.coverMesh.add(lab);
    this.shieldMesh = add(new THREE.BoxGeometry(0.236, 0.008, 0.156), M(0xd8d2c4, { roughness: 0.95 }), [0, -0.011, 0], 'shield'); this.shieldHome = this.shieldMesh.position.clone();
    this.screws = [];
    const screw = (x, y, z, group, flip) => {
      const s = new THREE.Group(); s.position.set(x, y, z); mod.add(s);
      const head = add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0022, 20), steel, [0, 0, 0], 'screw', s);
      const slot = add(new THREE.BoxGeometry(0.006, 0.0008, 0.0011), dark, [0, flip ? -0.0012 : 0.0012, 0], 'screw', s);
      add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.008, 10), steel, [0, flip ? 0.005 : -0.005, 0], 'screw', s);
      const hit = add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [0, 0, 0], 'screw', s); hit.castShadow = false;
      head.userData.screw = slot.userData.screw = hit.userData.screw = s;
      s.userData = { in: true, group, home: s.position.clone(), flip }; this.screws.push(s); return s;
    };
    for (const [x, z] of [[-0.108, -0.068], [0.108, -0.068], [-0.108, 0.068], [0.108, 0.068]]) screw(x, 0.0585, z, 'cover');
    for (const [x, z] of [[-0.108, -0.068], [0.108, -0.068], [-0.108, 0.068], [0.108, 0.068]]) screw(x, -0.0162, z, 'shield', true);
    for (const z of [-0.022, 0.062]) screw(-0.065, 0.05, z, 'clamp');
    // the tool (shows up where you point; no hands)
    this.toolObj = new THREE.Group(); sc.add(this.toolObj);
    const T = {};
    { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.007, 0.006, 0.05, 16), M(0xd2322a, { roughness: 0.4 }), [0, 0.045, 0], null, g); add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.05, 8), steel, [0, 0.0, 0], null, g); T.driver = g; }
    { const g = new THREE.Group(); for (const s of [-1, 1]) { const h = add(new THREE.BoxGeometry(0.004, 0.06, 0.004), M(0x2b4fd0, { roughness: 0.4 }), [s * 0.006, 0.05, 0], null, g); h.rotation.z = s * 0.15; const j = add(new THREE.BoxGeometry(0.003, 0.02, 0.003), steel, [s * 0.0015, 0.008, 0], null, g); j.rotation.z = -s * 0.1; } T.pliers = g; }
    { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 16), M(0x3a3a3a), [0, 0.05, 0], null, g); add(new THREE.CylinderGeometry(0.0015, 0.0005, 0.03, 8), steel, [0, 0.012, 0], null, g); this.ironTip = add(new THREE.SphereGeometry(0.0012, 8, 6), M(0xff6a20, { emissive: 0xff4010, emissiveIntensity: 2 }), [0, -0.003, 0], null, g); T.iron = g; }
    { const g = new THREE.Group(); add(new THREE.BoxGeometry(0.03, 0.05, 0.01), M(0xf2c21a), [0, 0.06, 0], null, g); add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.04, 6), M(0xc0281e), [0, 0.018, 0], null, g); T.meter = g; }
    for (const k in T) { T[k].visible = false; this.toolObj.add(T[k]); }
    this.T = T;
    // sparks
    this.sparkG = new THREE.BufferGeometry(); this.sparkP = new Float32Array(60 * 3); this.sparkV = new Float32Array(60 * 3); this.sparkL = 0;
    this.sparkG.setAttribute('position', new THREE.BufferAttribute(this.sparkP, 3));
    this.sparks = new THREE.Points(this.sparkG, new THREE.PointsMaterial({ color: 0xfff0a0, size: 0.004, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sc.add(this.sparks);
    this.sparkLight = new THREE.PointLight(0x9fd0ff, 0, 0.5); sc.add(this.sparkLight);
  }
  setWire(w, whole) { const u = w.userData; u.cut = !whole; u.whole.visible = whole && !u.joined; u.A.visible = u.B.visible = !whole || u.joined; u.blob.visible = whole && u.joined; u.cu.visible = !whole; }
  bindUI() {
    const bar = document.querySelector('#tools'); if (!bar) return;
    bar.innerHTML = TOOLS.map(t => `<button data-tool="${t.id}"><b>${t.key}</b>${t.name}<small>${t.tip}</small></button>`).join('');
    bar.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.pick(b.dataset.tool)));
    const c = this.r.domElement;
    c.addEventListener('pointerdown', e => { if (!this.isOpen) return; this.drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
    addEventListener('pointermove', e => {
      if (!this.isOpen) return;
      this.mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (this.drag) { const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.moved += Math.abs(dx) + Math.abs(dy); this.drag.x = e.clientX; this.drag.y = e.clientY; this.rotY += dx * 0.008; this.rotX = Math.max(-1.45, Math.min(1.45, this.rotX + dy * 0.008)); }
    });
    addEventListener('pointerup', e => { if (!this.isOpen || !this.drag) return; const m = this.drag.moved; this.drag = null; if (m < 6 && e.target === c) this.use(); });
    this.pick('driver');
  }
  pick(id) { this.tool = id; document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === id)); for (const k in this.T) this.T[k].visible = k === id; this.audio.click(); }
  key(code) { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code); if (i >= 0) this.pick(TOOLS[i].id); }
  wheel(dy) { this.dist = Math.max(0.22, Math.min(1.2, this.dist * (1 + dy * 0.001))); }
  open() { this.isOpen = true; this.say('Drag to turn it. Click a part with a tool. Number keys switch tools.'); }
  close() { this.isOpen = false; }
  say(t) { const el = document.querySelector('#benchMsg'); if (el) { el.textContent = t; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
  hit() {
    this.ray.setFromCamera(this.mouse, this.cam);
    const hits = this.ray.intersectObject(this.mod, true).filter(h => h.object.visible && h.object.userData.part && isVisible(h.object));
    return hits[0] || null;
  }
  live() { return this.state.battery; }
  shock(part, cause, big) {
    const h = this.hooks; this.audio.spark(); this.spark(big ? 50 : 25);
    const dmg = big ? 30 + Math.random() * 20 : 12 + Math.random() * 10;
    h.hurt?.('armR', dmg, 'burn', cause); h.hurt?.('torso', dmg * 0.4, 'burn', cause);
    if (Math.random() < (big ? 0.35 : 0.12)) { h.heart?.(); this.say('ZAP. The current went across your chest - your heart stopped. Hold on...'); }
    else this.say(big ? 'BANG - you cut a live battery lead. That current went straight through you.' : 'ZAP - it was live. Your hand is burned.');
  }
  spark(n) { this.sparkL = 0.5; const p = this.lastHit || new THREE.Vector3(); for (let i = 0; i < 60; i++) { this.sparkP.set([p.x, p.y, p.z], i * 3); this.sparkV.set([(Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2], i * 3); } this.sparkLight.position.copy(p); this.sparkLight.intensity = n * 0.4; }
  use() {
    const h = this.hit(); if (!h) return;
    const part = h.object.userData.part, t = this.tool, S = this.state;
    this.lastHit = h.point.clone();
    if (t === 'meter') return this.say(this.read(part));
    if (part === 'screw') {
      if (t !== 'driver') return this.say('That is a screw. Use the screwdriver (1).');
      const s = h.object.userData.screw || h.object.parent;
      const grp = s.userData.group;
      if (grp === 'cover' && !this.cover) return;
      s.userData.in = !s.userData.in; this.audio.screw(s.userData.in);
      s.position.copy(s.userData.home); if (!s.userData.in) s.position.y += s.userData.flip ? -0.006 : 0.006;
      if (grp === 'cover' && this.screws.filter(x => x.userData.group === 'cover' && x.userData.in).length === 0) { this.cover = false; this.coverMesh.position.set(0.16, 0.0, 0.16); this.coverMesh.rotation.set(0, 0.4, 0); this.screws.filter(x => x.userData.group === 'cover').forEach(x => x.visible = false); this.say('Cover off. Careful: the battery is still connected.'); }
      if (grp === 'shield' && this.screws.filter(x => x.userData.group === 'shield' && x.userData.in).length === 0) { this.shieldOn = false; this.shieldMesh.position.set(-0.16, -0.05, 0.18); this.screws.filter(x => x.userData.group === 'shield').forEach(x => x.visible = false); this.say('Heat shield off. The suit is lighter (faster) - but nothing protects you from air friction past Mach 5.'); }
      if (grp === 'clamp') { const n = this.screws.filter(x => x.userData.group === 'clamp' && x.userData.in).length; this.clamp.position.copy(this.clampHome); if (n < 2) this.clamp.position.y += 0.006; this.say(n === 2 ? 'Battery clamped - the suit has power.' : n === 1 ? 'One clamp screw left.' : 'Battery disconnected. Nothing in here is live now.'); }
      return this.sync();
    }
    if (part === 'cover' && !this.cover) { this.cover = true; this.coverMesh.position.copy(this.coverHome); this.coverMesh.rotation.set(0, 0, 0); this.screws.filter(x => x.userData.group === 'cover').forEach(x => { x.visible = true; x.userData.in = false; x.position.copy(x.userData.home); x.position.y += 0.006; }); this.say('Cover back on. Do the screws up.'); return; }
    if (part === 'shield' && !this.shieldOn) { this.shieldOn = true; this.shieldMesh.position.copy(this.shieldHome); this.screws.filter(x => x.userData.group === 'shield').forEach(x => { x.visible = true; x.userData.in = true; x.position.copy(x.userData.home); }); this.audio.screw(true); this.say('Heat shield screwed back on.'); return this.sync(); }
    if (part === 'cover' || part === 'shield') return this.say(t === 'driver' ? 'Undo the 4 screws to take it off.' : 'It is held on by 4 screws.');
    if (part.startsWith('wire:')) {
      const w = this.wires[part.slice(5)], u = w.userData;
      if (t === 'pliers') {
        if (u.cut) return this.say('Already cut.');
        this.audio.snip(); u.joined = false; this.setWire(w, false);
        if (this.live() || (w === this.wires.lead && this.screws.filter(x => x.userData.group === 'clamp' && x.userData.in).length === 2)) this.shock(part, w === this.wires.lead ? 'Cut a live battery lead' : 'Cut a live wire', w === this.wires.lead);
        else this.say(w === this.wires.lead ? 'Battery lead cut. No power until you solder it.' : w === this.wires.shrink ? 'Shrink core wire cut. You are stuck at this size until it is fixed.' : 'Speed coil wire cut. The speed suit is dead.');
        return this.sync();
      }
      if (t === 'iron') {
        if (!u.cut) return this.say('That wire is fine.');
        if (this.live() && Math.random() < 0.3) { this.shock(part, 'Soldered a live wire', false); }
        u.joined = true; this.setWire(w, true); this.audio.sizzle(); this.say('Soldered back together.'); return this.sync();
      }
      return this.say('A wire. Pliers cut it, the soldering iron joins it.');
    }
    if (part === 'chip' || part === 'socket') {
      if (t !== 'pliers') return this.say('The LIMITER chip. Pliers pull it out.');
      if (!this.chipOut) { this.chipOut = true; this.chip.position.set(0.14, -0.05, 0.1); this.audio.snip(); this.say('Limiter out. Nothing stops the core now - you can go as small as you dare. It will be unstable.'); }
      else { this.chipOut = false; this.chip.position.copy(this.chipHome); this.audio.click(); this.say('Limiter back in its socket.'); }
      if (this.live() && Math.random() < 0.15) this.shock(part, 'Pulled a chip off a live board', false);
      return this.sync();
    }
    if (part === 'oc' || part === 'mass') {
      if (t !== 'iron') return this.say(part === 'oc' ? 'OC pads: bridge them with solder to overclock the core.' : 'MASS pads: bridge them and the suit keeps your full weight when you shrink.');
      const b = part === 'oc' ? this.ocBridge : this.massBridge; b.visible = !b.visible; this.audio.sizzle();
      if (this.live() && Math.random() < 0.25) this.shock(part, 'Soldered a live board', false);
      this.say(part === 'oc' ? (b.visible ? 'OC bridged: shrinking 3x faster, speed builds faster. The core will run hot.' : 'OC unbridged.') : (b.visible ? 'MASS bridged: tiny you keeps 80 kg. Huge jumps - but you fall fast and land hard.' : 'MASS unbridged.'));
      return this.sync();
    }
    if (part === 'battery' || part === 'clamp') return this.say(t === 'driver' ? 'Undo the two clamp screws to disconnect it.' : 'The battery. Disconnect it before cutting anything.');
    this.say({ core: 'The shrink core.', coil: 'The speed coil.', board: 'The control board.', housing: 'The housing.' }[part] || '');
  }
  read(part) {
    const S = this.state, v = S.battery ? '11.1 V' : '0 V';
    if (part.startsWith('wire:')) { const w = this.wires[part.slice(5)].userData; if (w.cut) return `Cut. ${w.name === 'lead' ? 'Battery side still' : 'Board side'} reads ${this.screws.filter(x => x.userData.group === 'clamp' && x.userData.in).length === 2 ? '11.1 V' : '0 V'}.`; return `${v} on this wire. ${S.battery ? 'LIVE - don\'t cut it like this.' : 'Dead. Safe to cut.'}`; }
    return ({
      battery: `Battery: 11.1 V lithium pack. ${S.battery ? 'Connected - everything is live.' : 'Disconnected.'}`, clamp: 'Clamp: holds the battery against its contacts.',
      chip: 'LIMITER chip: blocks the shrink core below 0.2 mm.', socket: this.chipOut ? 'Empty socket: no limit on the core.' : 'LIMITER chip: blocks the shrink core below 0.2 mm.',
      oc: S.oc ? 'OC pads: bridged. Core runs 3x.' : 'OC pads: open. Core runs 1x.', mass: S.mass ? 'MASS pads: bridged. You keep 80 kg at any size.' : 'MASS pads: open. Your weight shrinks with you.',
      core: `Shrink core: ${S.shrinkWire ? 'connected' : 'NOT connected'}.`, coil: `Speed coil: ${S.speedWire ? 'connected' : 'NOT connected'}.`, board: `Control board: ${v}.`, housing: 'Housing: 0 V.',
      cover: 'Cover.', shield: 'Ceramic heat shield. Without it, air friction burns you past Mach 5.', screw: 'Screw.',
    })[part] || '';
  }
  frame(dt) {
    const w = innerWidth, h = innerHeight; if (this.r.domElement.width !== Math.floor(w * this.r.getPixelRatio())) this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const c = Math.cos(this.rotX); this.cam.position.set(Math.sin(this.rotY) * c * this.dist, Math.sin(this.rotX) * this.dist + 0.02, Math.cos(this.rotY) * c * this.dist); this.cam.lookAt(0, 0.015, 0);
    this.crystal.rotation.y += dt * (this.state.oc ? 6 : 2); this.crystal.material.emissiveIntensity = this.state.battery && this.state.shrinkWire ? 2 + Math.sin(performance.now() / 200) * 0.6 : 0.1;
    this.ironTip.material.emissiveIntensity = 2 + Math.sin(performance.now() / 90) * 0.5;
    // tool follows what you point at
    const hit = this.hit();
    if (hit) { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0); this.toolObj.position.copy(hit.point).addScaledVector(n, 0.004); this.toolObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); this.toolObj.visible = true; if (this.tool === 'driver') this.T.driver.rotation.y += dt * 2; }
    else this.toolObj.visible = false;
    const info = document.querySelector('#benchInfo'); if (info) info.textContent = hit ? partName(hit.object.userData.part) : '';
    if (this.sparkL > 0) { this.sparkL -= dt; for (let i = 0; i < 60; i++) { this.sparkV[i * 3 + 1] -= dt * 4; for (let j = 0; j < 3; j++) this.sparkP[i * 3 + j] += this.sparkV[i * 3 + j] * dt * 0.3; } this.sparkG.attributes.position.needsUpdate = true; this.sparks.visible = true; this.sparkLight.intensity *= 0.85; } else { this.sparks.visible = false; this.sparkLight.intensity = 0; }
    this.r.setRenderTarget(null); this.r.render(this.scene, this.cam);
  }
}
const partName = p => p ? (p.startsWith('wire:') ? { lead: 'Battery lead (red)', shrink: 'Shrink core wire (blue)', speed: 'Speed coil wire (yellow)' }[p.slice(5)] : { screw: 'Screw', cover: 'Cover', shield: 'Heat shield', battery: 'Battery pack', clamp: 'Battery clamp', chip: 'LIMITER chip', socket: 'LIMITER socket', oc: 'OC pads', mass: 'MASS pads', core: 'Shrink core', coil: 'Speed coil', board: 'Control board', housing: 'Housing' }[p]) : '';
function isVisible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
