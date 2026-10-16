// The experiment table: scan someone's mind, open them up (cartoony organs, follows the gore setting,
// adults only), replace lost limbs with robot parts, inject potions, test gadgets, heal, release.
import * as THREE from 'three';
import { h, put, clear, btn } from './dom.js';
import { Preview } from './preview.js';
import { Body, poseTargets, J } from '../life/body.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';
import { CORES } from '../gadgets/parts.js';

const ORGANS = {
  brain: { label: 'Brain', color: 0xf0a0b0, deadly: true, line: 'You took out their brain.' },
  heart: { label: 'Heart', color: 0xb01020, deadly: true, line: 'You pulled out their heart. It\'s still beating in your fingers.' },
  lungL: { label: 'Left lung', color: 0xe08890, deadly: false, hurt: 45 },
  lungR: { label: 'Right lung', color: 0xe08890, deadly: false, hurt: 45 },
  liver: { label: 'Liver', color: 0x7a1a20, deadly: false, hurt: 55 },
  stomach: { label: 'Stomach', color: 0xe0b0a0, deadly: false, hurt: 35 },
  guts: { label: 'Intestines', color: 0xe8a0a8, deadly: false, hurt: 40 },
};

function organMesh(key) {
  const c = ORGANS[key].color;
  const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 });
  let geo;
  switch (key) {
    case 'brain': geo = new THREE.SphereGeometry(0.075, 18, 14); geo.scale(1.1, 0.8, 1.25); break;
    case 'heart': geo = new THREE.SphereGeometry(0.045, 16, 12); geo.scale(1, 1.2, 0.9); break;
    case 'lungL': case 'lungR': geo = new THREE.CapsuleGeometry(0.045, 0.08, 6, 12); break;
    case 'liver': geo = new THREE.SphereGeometry(0.06, 14, 10); geo.scale(1.4, 0.6, 0.9); break;
    case 'stomach': geo = new THREE.SphereGeometry(0.045, 14, 10); geo.scale(1.3, 0.9, 0.8); break;
    case 'guts': geo = new THREE.TorusKnotGeometry(0.05, 0.016, 80, 8, 3, 5); break;
    default: geo = new THREE.SphereGeometry(0.04, 10, 8);
  }
  const m = new THREE.Mesh(geo, mat);
  m.userData.organ = key;
  if (key === 'brain') {
    // wrinkles
    const w = new THREE.Mesh(new THREE.TorusKnotGeometry(0.05, 0.008, 90, 6, 7, 3), new THREE.MeshStandardMaterial({ color: 0xd88898, roughness: 0.4 }));
    w.scale.set(1.1, 0.75, 1.25);
    m.add(w);
  }
  return m;
}

export function buildExpTable(ui) {
  const g = ui.g;

  const exptable = () => {
    const p = g.exp;
    if (!p) { ui.toast('Nobody is on the table.'); return; }
    const body = h('div', { class: 'wb' });
    const left = h('div', { class: 'col' });
    const cv = h('canvas', { style: { width: '100%', height: '300px', borderRadius: '10px', background: 'radial-gradient(circle at 50% 40%, #2a3233, #0b1213)', cursor: 'pointer' } });
    const pv = new Preview(cv, { dist: 2.2, height: 0.25, fov: 34 });
    pv.pitch = 0.9;
    const out = h('div', { class: 'col', style: { maxHeight: '36vh', overflow: 'auto', fontSize: '13px' } });
    const right = h('div', { class: 'col' }, cv, h('div', { class: 'muted' }, 'Drag to turn, scroll to zoom.'), out);
    put(body, left, right);
    p.removedOrgans = p.removedOrgans || [];
    let open = false;
    let b3 = null;
    const organs = new THREE.Group();
    const buildModel = () => {
      if (b3) b3.dispose();
      // the same person at human size, lying on the table
      b3 = new Body(p.look, pv.scene, { pos: new THREE.Vector3(0, 0.05, 0), yaw: Math.PI / 2, scale: 1, hi: true });
      for (const j of p.body.cut) b3.sever(j);
      b3.groundFn = () => 0.05;
      for (let i = 0; i < 80; i++) { poseTargets(b3, { pos: new THREE.Vector3(0, 0.05, 0), yaw: Math.PI / 2, phase: 0, speed: 0, action: 'sleep', at: 0, lying: true }); b3.simulate(1 / 60, 9.8, 30); }
      b3.face.closed = p.alive ? 0 : 1; b3.face.scared = p.alive ? 1 : 0; b3.face.open = p.alive ? 0.5 : 0;
      b3.render(0);
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: 0xcfd6d8, roughness: 0.3, metalness: 0.7 }));
      table.position.y = 0.0;
      pv.root.clear();
      pv.root.add(table, organs);
      if (open) cutOpen(); else { b3.setClip(null); organs.clear(); }
    };
    const cutOpen = () => {
      // slice the front half away (they're lying on their back) and put the organs where they really are
      const neck = b3.P(J.neck, new THREE.Vector3()), pel = b3.P(J.pelvis, new THREE.Vector3()), head = b3.P(J.head, new THREE.Vector3());
      const cutY = (neck.y + pel.y) / 2 + 0.01;
      b3.setClip([new THREE.Plane(new THREE.Vector3(0, -1, 0), cutY)]);
      b3.render(0);
      organs.clear();
      const along = (t) => neck.clone().lerp(pel, t);
      const side = new THREE.Vector3().subVectors(b3.P(J.lSh, new THREE.Vector3()), b3.P(J.rSh, new THREE.Vector3())).normalize();
      const place = { brain: head.clone(), heart: along(0.28).addScaledVector(side, 0.03), lungL: along(0.25).addScaledVector(side, 0.08), lungR: along(0.25).addScaledVector(side, -0.08), liver: along(0.5).addScaledVector(side, -0.05), stomach: along(0.52).addScaledVector(side, 0.06), guts: along(0.78) };
      for (const [k, pos] of Object.entries(place)) {
        if (p.removedOrgans.includes(k)) continue;
        const m = organMesh(k);
        m.position.copy(pos); m.position.y = Math.min(pos.y, cutY - 0.005);
        if (k === 'lungL' || k === 'lungR') m.rotation.z = Math.PI / 2;
        if (k === 'heart') m.userData.beat = true;
        organs.add(m);
      }
    };
    let beat = 0;
    pv.onFrame = () => { beat += 1 / 60; for (const m of organs.children) if (m.userData.beat) m.scale.setScalar(p.alive ? 1 + Math.max(0, Math.sin(beat * 8)) * 0.12 : 1); };
    cv.addEventListener('click', (e) => {
      if (!open) return;
      const r = cv.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), pv.cam);
      const hit = ray.intersectObjects(organs.children, true)[0];
      if (!hit) return;
      let o = hit.object; while (o && !o.userData.organ) o = o.parent;
      if (!o) return;
      takeOut(o.userData.organ);
    });
    const say = (txt) => { out.prepend(h('div', { class: 'card' }, txt)); };
    const takeOut = (k) => {
      const d = ORGANS[k];
      if (!confirm(`Take out ${p.name}'s ${d.label.toLowerCase()}?`)) return;
      p.removedOrgans.push(k);
      sfx('squish'); sfx('slice');
      g.fx.blood(p.center(new THREE.Vector3()), new THREE.Vector3(0, 1, 0), p.height, 1, settings.gore !== 'none');
      if (p.alive) {
        p.hurtByPlayer(40);
        if (d.deadly) p.die(k === 'heart' ? 'had their heart pulled out' : 'had their brain taken out', { from: 'player' });
        else { p.health -= d.hurt; p.bleed += 1.5; p.say('AAAAAAAAAGH!', { kind: 'scared', scream: true }); if (p.health <= 0) p.die(`died when you took out their ${d.label.toLowerCase()}`, { from: 'player' }); }
      }
      g.feed(`You took out ${p.name}'s ${d.label.toLowerCase()}`, 'bad', p);
      say(d.line || `You took out the ${d.label.toLowerCase()}.`);
      cutOpen(); drawLeft();
    };

    const drawLeft = () => {
      clear(left);
      const lost = [...p.body.cut].filter((j) => !j.startsWith('neck') && j !== 'waist');
      const gadgets = g.player.hotbar.concat(g.backpack).filter((t) => t && typeof t === 'object' && !t.potion);
      const potions = g.player.hotbar.concat(g.backpack).filter((t) => t && t.potion);
      put(left, 
        h('h3', { style: { margin: 0 } }, `${p.name} ${p.last}`),
        h('div', {}, h('span', { class: 'hp' }, p.alive ? `${Math.max(0, Math.round(p.health))}/100` : 'DEAD'), '  ', h('span', { class: 'muted' }, p.alive ? p.feeling() : p.cause)),
        h('div', { class: 'row' },
          btn('Scan their mind', () => { sfx('electric'); say(scan(p)); }),
          btn(open ? 'Close them up' : 'Open them up', () => {
            if (!open && settings.gore === 'none') { ui.toast('Turn gore on in Settings to open people up.'); return; }
            if (!open && p.alive && !confirm(`Cut ${p.name} open while they're awake?`)) return;
            open = !open;
            if (open) { sfx('slice'); if (p.alive) { p.hurtByPlayer(25); p.health -= 20; p.bleed += 0.6; p.say('NO! NO! STOP! AAAAAAH!', { kind: 'scared', scream: true }); if (p.health <= 0) p.die('died on the operating table', { from: 'player' }); } g.feed(`You cut ${p.name} open on the table`, 'bad', p); say('Click an organ in the picture to take it out.'); cutOpen(); }
            else { b3.setClip(null); organs.clear(); if (p.alive) { p.bleed = Math.max(0, p.bleed - 0.4); p.bandaged = 80; say('Stitched them up.'); } }
            drawLeft();
          }, open ? '' : 'danger'),
        ),
        h('div', { class: 'row' },
          btn('Heal fully', () => { if (!p.alive) { ui.toast('Too late for that.'); return; } p.health = 100; p.bleed = 0; p.sick = null; p.bandaged = 120; p.brokenLeg = undefined; p.needs.hunger = Math.max(p.needs.hunger, 70); p.needs.thirst = Math.max(p.needs.thirst, 70); sfx('heart'); p.op = Math.min(100, p.op + 6); say('Healed. They look at you a little differently now.'); drawLeft(); }),
          btn('Feed + water them', () => { if (!p.alive) return; p.needs.hunger = 100; p.needs.thirst = 100; p.op = Math.min(100, p.op + 3); sfx('bubble'); say(`${p.name} ate like they hadn't eaten in days.`); }),
        ),
        lost.length && p.alive ? h('div', {}, h('div', { class: 'muted' }, 'Robot parts for lost limbs'), h('div', { class: 'chips' }, lost.map((j) => h('span', { class: 'chip', onclick: () => attachRobot(j) }, `Robot ${j.includes('Hip') || j.includes('Knee') ? 'leg' : 'arm'} (${j[0] === 'l' ? 'left' : 'right'})`)))) : null,
        p.alive && !p.robot ? btn('Make them a cyborg (no hunger, no thirst, metal skin)', () => { if (!confirm('Turn them into a cyborg? It can\'t be undone.')) return; p.robot = true; p.look = { ...p.look, skin: 0x9aa4aa, eyes: 0x20e0ff }; g.rebuildBody(p); buildModel(); sfx('electric'); sfx('hammer'); p.remember('cyborg', 'The giant turned me into a machine', -30, 'player'); g.feed(`You made ${p.name} a cyborg`, 'bad', p); say('Cyborg. They don\'t need food or water any more.'); drawLeft(); }) : null,
        potions.length && p.alive ? h('div', {}, h('div', { class: 'muted' }, 'Inject a potion'), h('div', { class: 'chips' }, potions.map((t) => h('span', { class: 'chip', onclick: () => { inject(t); drawLeft(); } }, h('i', { style: { background: '#' + t.color.toString(16).padStart(6, '0') } }), `${t.name} x${t.uses}`)))) : null,
        gadgets.length && p.alive ? h('div', {}, h('div', { class: 'muted' }, 'Test a gadget on them'), h('div', { class: 'chips' }, gadgets.map((t) => h('span', { class: 'chip', onclick: () => { g.gadgets.apply(t, { kind: 'person', ref: p, point: p.center(new THREE.Vector3()) }, { bp: t, S: 1, color: CORES[t.cores[0]].color, source: 'player', dir: new THREE.Vector3(0, -1, 0) }); sfx('zap'); say(`Tested ${t.name}: ${t.cores.map((k) => CORES[k].label).join(' + ')}.`); setTimeout(drawLeft, 400); } }, t.name)))) : null,
        h('hr', { class: 'sep' }),
        btn('Unstrap + pick them up', () => { release(); }, 'primary'),
      );
    };
    const attachRobot = (j) => {
      const keep = [...p.body.cut].filter((x) => x !== j && !(j.includes('Shoulder') && x === j[0] + 'Elbow') && !(j.includes('Hip') && x === j[0] + 'Knee'));
      p.body.cut = new Set(keep);
      const L = { ...p.look };
      if (j.includes('Shoulder') || j.includes('Elbow')) L.gloves = 0x8a9298; else L.shoes = 0x8a9298;
      p.look = L;
      p.limbsLost = Math.max(0, p.limbsLost - 1);
      p.body.cut = new Set(keep); // rebuildBody re-cuts only what's still missing
      g.rebuildBody(p);
      p.stumpBleed = [];
      buildModel();
      sfx('hammer'); sfx('electric');
      p.op = Math.min(100, p.op + 10);
      p.remember('robot', `The giant gave me a robot ${j.includes('Hip') || j.includes('Knee') ? 'leg' : 'arm'}`, 15, 'player');
      p.say(rand2(['It... it moves! It actually moves!', 'What did you put on me?!', 'Is this... metal?']), { kind: 'chat' });
      g.feed(`You gave ${p.name} a robot ${j.includes('Hip') || j.includes('Knee') ? 'leg' : 'arm'}`, 'warm', p);
      drawLeft();
    };
    const inject = (t) => {
      const bp = { id: 'potion', name: t.name, body: 'wand', cores: t.effects.filter((k) => CORES[k]), mod: 'burst', stats: { power: t.power || 5, area: 1, time: t.time || 5, shots: 1 }, opts: { color: t.color } };
      g.gadgets.apply(bp, { kind: 'person', ref: p, point: p.center(new THREE.Vector3()) }, { bp, S: 1, color: t.color, source: 'player', dir: new THREE.Vector3(0, -1, 0) });
      t.uses = (t.uses ?? 1) - 1;
      if (t.uses <= 0) { const i = g.player.hotbar.indexOf(t); if (i >= 0) g.player.hotbar[i] = null; const k = g.backpack.indexOf(t); if (k >= 0) g.backpack.splice(k, 1); g.player.setGadgetMesh(); }
      sfx('bubble');
      say(`Injected ${t.name}.`);
    };
    const release = () => {
      g.exp = null;
      p.loc = 'world';
      p.body.bounds = null;
      p.body.groundFn = (x, z, y) => g.groundAt(x, z, y, p);
      ui.close(true);
      const pl = g.player;
      if (pl.holding) pl.drop(true);
      pl.select(0);
      if (!pl.grabTarget({ kind: 'person', ref: p })) { p.pos.y += 0.01; }
      ui.close();
    };
    buildModel();
    drawLeft();
    ui.showModal('exptable', { title: 'Experiment table', body, wide: true, onClose: () => { pv.dispose(); if (b3) b3.dispose(); } });
  };

  return { exptable };
}

function rand2(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// what's going on in their head
function scan(p) {
  const g = p.game;
  const lines = [];
  lines.push(`Feeling: ${p.feeling()}. Fear ${Math.round(p.fear)}/100. Thinks of you: ${p.op > 40 ? 'good' : p.op < -40 ? 'hate' : 'unsure'} (${Math.round(p.op)}).`);
  const rels = [...p.rel.entries()].map(([id, r]) => [g.byId(id), r]).filter(([o]) => o);
  const love = rels.filter(([, r]) => r.l > 30).sort((a, b) => b[1].l - a[1].l)[0];
  if (love) lines.push(`In love with ${love[0].name}${love[0].alive ? '' : ' (who is dead)'}.`);
  const hate = rels.filter(([, r]) => r.f < -30).sort((a, b) => a[1].f - b[1].f)[0];
  if (hate) lines.push(`Hates ${hate[0].name}.`);
  if (p.loveYou > 40) lines.push('Has feelings for YOU.');
  if (p.op < -40 && (p.has('rebel') || p.has('brave') || p.has('smart'))) lines.push('Plan: break the glass and get out. Would hurt you if they could.');
  if (p.faith > 50) lines.push('Believes you are a god.');
  if (p.has('liar')) lines.push('Lies when it helps them.');
  const mem = p.mem.slice(-6).reverse().map((m) => `- Day ${m.day}: ${m.text}`);
  if (mem.length) lines.push('Remembers:\n' + mem.join('\n'));
  return h('div', { style: { whiteSpace: 'pre-wrap' } }, lines.join('\n'));
}
