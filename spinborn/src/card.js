// End card (like his: big character picture + stat list in the corner) + page 2 "what everything does".
import * as THREE from 'three';
import * as D from '../js/data/core.js';
import { RACES, RACE_EXTRAS } from '../js/data/race.js';
import * as B from '../js/data/big.js';
import * as L from '../js/data/loop.js';
import { tierLabel, tierDesc, combatTier } from './flow.js';
import { FONT, wrap, drawText, roundRect, fmtYears, fmtHeight } from './text.js';

const SERIF = '"Times New Roman", Georgia, serif';
const find = (arr, label, di = 2) => { const r = arr.find(a => (Array.isArray(a) ? a[0] : a) === label); return r ? r[di] : ''; };
const bigDesc = (arr, label) => { const r = arr.find(a => a[0] === label); return r ? r[1] : ''; };

// [key, value, what it does]
export function describe(C) {
  const out = [];
  const race = C.parents ? `Hybrid (${C.parents[0]} father, ${C.parents[1]} mother)` : C.race;
  out.push(['RACE', race, C.parents ? `${find(RACES, C.parents[0])} + ${find(RACES, C.parents[1])}` : find(RACES, C.race)]);
  for (const [id, v] of Object.entries(C.extras || {})) {
    let d = ''; for (const list of Object.values(RACE_EXTRAS)) for (const ex of list) if (ex.id === id && ex.slices) d = d || find(ex.slices, v);
    out.push([id.replace(/_/g, ' ').toUpperCase(), v, d]);
  }
  if (C.age) out.push(['AGE', `${C.age.label} (${fmtYears(C.age.years)} years)`, find(D.AGES, C.age.label)]);
  if (C.height) out.push(['HEIGHT', fmtHeight(C.height), find(D.HEIGHTS, fmtHeight(C.height))]);
  if (C.background) out.push(['BACKGROUND', C.background, bigDesc(B.BACKGROUNDS, C.background)]);
  out.push(['LUCK', C.luckLabel, find(D.LUCK, C.luckLabel)]);
  if (C.personality) out.push(['PERSONALITY', C.personality, bigDesc(B.PERSONALITIES, C.personality)]);
  const st = C.stats;
  out.push(['STRENGTH', tierLabel('str', st.str), tierDesc('str', st.str)]);
  out.push(['SPEED', tierLabel('spd', st.spd), tierDesc('spd', st.spd)]);
  out.push(['DURABILITY', tierLabel('dur', st.dur), tierDesc('dur', st.dur)]);
  out.push(['INTELLIGENCE', tierLabel('iq', st.iq), tierDesc('iq', st.iq)]);
  out.push(['FIGHTING SKILLS', tierLabel('fight', st.fight) + (C.style ? ` (${C.style})` : ''), tierDesc('fight', st.fight) + (C.style ? ' ' + find(D.FIGHT_STYLES, C.style) : '')]);
  const wl = C.legendWeapon ? L.LEGEND_WEAPONS.find(w => w[0].includes(C.legendWeapon)) : null;
  out.push(['WEAPON', C.weapon || 'No weapon', wl ? wl[2] : bigDesc(B.WEAPONS, C.weapon)]);
  if (C.weapon && C.weapon !== 'No weapon' && st.wm >= 0) out.push(['WEAPON MASTERY', tierLabel('wm', st.wm), tierDesc('wm', st.wm)]);
  if (C.element) out.push(['ELEMENT', C.element, find(D.ELEMENTS, C.element)]);
  if (!C.powers.length) out.push(['POWER', 'No powers', 'No powers. Just you and your body.']);
  C.powers.forEach((p, i) => out.push([C.powers.length > 1 ? `POWER ${i + 1}` : 'POWER', p.name, p.desc]));
  if (C.powers.length && st.pm >= 0) out.push(['POWER MASTERY', tierLabel('pm', st.pm), tierDesc('pm', st.pm)]);
  if (C.transformation) out.push(['TRANSFORMATION', C.transformation, find(D.TRANSFORMATIONS, C.transformation)]);
  if (C.aura) out.push(['AURA', C.aura, find(D.AURA, C.aura)]);
  out.push(['WEAKNESS', C.weaknesses.length ? C.weaknesses.join(', ') : 'No weakness', C.weaknesses.length ? C.weaknesses.map(w => bigDesc(B.WEAKNESSES, w)).join(' ') : 'You have no weakness at all.']);
  if (C.title) out.push(['TITLE', C.title, 'What people call you. It shows over your head once your name spreads.']);
  if (C.rival) out.push(['RIVAL', C.rival, find(L.RIVALS, C.rival) || 'They hunt you and get stronger when you do.']);
  if (C.armor) out.push(['ARMOR', C.armor, find(L.ARMORS, C.armor)]);
  if (C.followers.length) C.followers.forEach(f => out.push(['FOLLOWERS', `${f.count} ${f.kind}`, `${find(L.FOLLOWERS, f.kind)} Power: ${f.power.replace(/^\d+\.\s*/, '')}`]));
  if (C.org) out.push(['ORGANIZATION', `${C.org.kind} (${C.org.size})`, `${find(L.ORG_KINDS, C.org.kind)} Members: ${C.org.members}. Power: ${C.org.power.replace(/^\d+\.\s*/, '')}`]);
  if (C.kingdom) out.push(['KINGDOM', `${C.kingdom.size} in ${C.kingdom.where}`, C.kingdom.outcome]);
  if (C.business) out.push(['BUSINESS', C.business.kind, C.business.outcome]);
  if (C.beasts.length) out.push(['BEASTS', C.beasts.map(b => b.kind).join(', '), 'They fight for you.']);
  if (C.allies.length) out.push(['ALLIES', C.allies.map(a => `${a.race} (${a.power})`).join(', '), 'They fight beside you.']);
  if (C.enemies.length) out.push(['ENEMIES', C.enemies.map(a => `${a.race} (${a.power})`).join(', '), 'They hunt you in the world.']);
  if (C.spells.length) out.push(['SPELLS', C.spells.join(', '), 'Spells you can cast.']);
  if (C.skills.length) out.push(['SKILLS', C.skills.join(', '), 'Skills you learned.']);
  if (C.artifacts.length) C.artifacts.forEach(a => out.push(['ARTIFACT', a.split(' — ')[0], a.split(' — ')[1] || '']));
  if (C.items.length) out.push(['ITEMS', [...new Set(C.items)].join(', '), 'Stuff you carry.']);
  if (C.territories.length) out.push(['TERRITORY', C.territories.join(', '), 'Land you rule.']);
  if (C.gold) out.push(['GOLD', C.gold.toLocaleString('en-US'), 'Your money.']);
  out.push(['POWER LEVEL', `${Math.round(combatTier(C) * 10) / 10} / 22`, 'How strong you are overall. People in the world compare against this.']);
  if (C.dead) out.push(['STATUS', 'DEAD', C.death]);
  else if (C.worldLabel) out.push(['WORLD', C.worldLabel, find(D.WORLDS, C.worldLabel)]);
  return out;
}

// short lines for the corner list (like his card)
const SHORT = ['RACE', 'AGE', 'HEIGHT', 'STRENGTH', 'SPEED', 'DURABILITY', 'INTELLIGENCE', 'FIGHTING SKILLS', 'WEAPON', 'POWER', 'POWER 1', 'POWER 2', 'POWER 3', 'WEAKNESS', 'TITLE'];

export function drawCard(canvas, C, art) {
  const W = canvas.width = 1080, H = canvas.height = 1600, g = canvas.getContext('2d');
  g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  if (art) g.drawImage(art, 0, 0, W, H);
  // dark corner for the text (his cards fade the bottom left to black)
  const gr = g.createLinearGradient(0, H * 0.48, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.78)'); gr.addColorStop(1, 'rgba(0,0,0,0.95)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const rows = describe(C).filter(r => SHORT.includes(r[0]) || r[0].startsWith('POWER ')).slice(0, 15);
  let y = H - 64 - rows.length * 46;
  for (const [k, v] of rows) {
    g.font = `400 34px ${SERIF}`; g.fillStyle = '#e9e3d6'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const head = k.replace('FIGHTING SKILLS', 'FIGHTING SKILLS') + ' : ';
    g.fillText(head, 54, y);
    const wv = g.measureText(head).width;
    g.fillStyle = k === 'STATUS' ? '#ff4a4a' : '#c9a96a'; g.fillText(String(v), 54 + wv, y, W - 120 - wv);
    y += 46;
  }
  // name/title top
  if (C.title) {
    g.font = `700 54px ${SERIF}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.92)';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 18; g.fillText(C.title.toUpperCase(), W / 2, 96); g.shadowBlur = 0;
  }
  if (C.dead) { g.font = `800 120px ${SERIF}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,40,40,0.85)'; g.fillText('DEAD', W / 2, H * 0.38); }
}

export function drawExplain(canvas, C, page = 0) {
  const W = canvas.width = 1080, H = canvas.height = 1600, g = canvas.getContext('2d');
  g.fillStyle = '#0b0d12'; g.fillRect(0, 0, W, H);
  drawText(g, 'What everything does', 54, 96, { size: 56, weight: 800, color: '#fff' });
  const rows = describe(C);
  let y = 150; const perPage = []; let cur = [];
  // paginate by height
  g.font = `500 28px ${FONT}`;
  for (const r of rows) {
    const lines = wrap(g, r[2] || '', W - 108).length;
    const h = 46 + lines * 34 + 18;
    if (y + h > H - 90) { perPage.push(cur); cur = []; y = 150; }
    cur.push([r, h]); y += h;
  }
  if (cur.length) perPage.push(cur);
  const pg = perPage[Math.min(page, perPage.length - 1)] || [];
  y = 150;
  for (const [[k, v, d], h] of pg) {
    drawText(g, k, 54, y + 30, { size: 26, weight: 800, color: '#8fb4ff' });
    g.font = `800 26px ${FONT}`; const kw = g.measureText(k + '  ').width;
    drawText(g, String(v), 54 + kw, y + 30, { size: 30, weight: 700, color: '#fff', maxW: W - 108 - kw });
    g.font = `500 28px ${FONT}`; g.fillStyle = '#b8c1cf';
    wrap(g, d || '', W - 108).forEach((l, i) => g.fillText(l, 54, y + 70 + i * 34));
    y += h;
  }
  drawText(g, `Page ${page + 1} / ${perPage.length}`, W - 54, H - 44, { size: 26, weight: 600, color: '#7d8796', align: 'right' });
  return perPage.length;
}

// 3D "cool background" scene for the card art
export function cardScene(C, character) {
  const scene = new THREE.Scene();
  const auraHex = C.auraColor && C.auraColor.startsWith('#') ? C.auraColor : C.auraColor === 'rainbow' ? '#ff5fd0' : C.auraColor === 'galaxy' ? '#7a5cff' : '#6a8cff';
  // backdrop: painted canvas with light rays + fog in the aura color
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1536; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 1536); bg.addColorStop(0, '#05060c'); bg.addColorStop(0.55, shadeHex(auraHex, 0.22)); bg.addColorStop(1, '#030305');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 1536);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4; const len = 1400;
    const gr = g.createLinearGradient(512, 900, 512 + Math.cos(a) * len, 900 + Math.sin(a) * len);
    gr.addColorStop(0, hexA(auraHex, 0.22)); gr.addColorStop(1, hexA(auraHex, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(512, 900); g.lineTo(512 + Math.cos(a - 0.03) * len, 900 + Math.sin(a - 0.03) * len); g.lineTo(512 + Math.cos(a + 0.03) * len, 900 + Math.sin(a + 0.03) * len); g.fill();
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = hexA(i % 5 ? '#ffffff' : auraHex, Math.random() * 0.8); const r = Math.random() * 2.4; g.beginPath(); g.arc(Math.random() * 1024, Math.random() * 1536, r, 0, Math.PI * 2); g.fill(); }
  const glow = g.createRadialGradient(512, 980, 30, 512, 980, 620); glow.addColorStop(0, hexA(auraHex, 0.55)); glow.addColorStop(1, hexA(auraHex, 0));
  g.fillStyle = glow; g.fillRect(0, 0, 1024, 1536);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
  scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x1a1020, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(auraHex), 4); rim.position.set(-2, 2.5, -3); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(auraHex).multiplyScalar(0.5), transparent: true, opacity: 0.5 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(character.root);
  const h = character.heightM || 2;
  const cam = new THREE.PerspectiveCamera(32, 1080 / 1600, 0.05, 100);
  cam.position.set(0.9, h * 0.38, h * 2.5 + 1.2); cam.lookAt(0, h * 0.55, 0);
  return { scene, cam };
}
function shadeHex(hex, k) { const c = new THREE.Color(hex).multiplyScalar(k); return '#' + c.getHexString(); }
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }
