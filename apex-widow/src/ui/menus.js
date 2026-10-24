// Every menu: main menu (over the Earth-in-a-web scene), new run + difficulty, pause, settings (graphics, sound,
// gameplay, camera, HUD, controls), records + trophies, bestiary, credits, the death screen with your run summary,
// molt evolution cards (with a real 3D picture of each species), notes, and the map + evolution tree (Tab).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SPECIES, POWERS } from '../spider/species.js';
import { buildSpider } from '../spider/body.js';
import { SpiderRig } from '../spider/rig.js';
import { BIND_NAMES } from '../core/input.js';
import { KINDS } from '../life/creatures.js';
import { sizeText, asBig, clamp } from '../core/util.js';
import { loadRun, saveMeta } from '../game/save.js';
import { LEVEL_NAMES } from '../game/wanted.js';
import { NOTES } from '../game/story.js';
import { PLAYABLE, FLOOR_NAMES, ROOF } from '../world/tower.js';
import { ZONE_TITLE } from '../world/zones.js';

const HG = '<svg viewBox="0 0 10 16"><path d="M0 0H10L5 7.6L10 16H0L5 8.4Z" fill="#ff2a1f"/></svg>';
const LOGO = `<div class="logo">APEX WID<span class="o">O${HG}</span>W</div>`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + 'h ' : '') + m + 'm ' + (h ? '' : x + 's'); };
const keyName = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('Escape', 'Esc').replace('Space', 'Space');

export const DEATHS = {
  'starved': 'You starved. Your body burned itself to stay alive, then there was nothing left to burn.',
  'fell too far': 'You fell too far. At your size, the ground hits back.',
  'fell into the dark': 'You fell, and kept falling.',
  'bug spray': 'Bug spray. It shuts down your nerves. Your legs curled up under you.',
  'drowned': 'You drowned. The air bubble on your body ran out.',
  'nuked': 'A nuclear blast. Even you could not eat that much heat at once.',
  'burned by the Sun': 'Burned up by a star. You got too close before your shell could take it.',
  'spaghettified': 'A black hole stretched you into a noodle of atoms.',
};

const EVO = {
  venom:  { name: 'Venom',  text: 'Bites paralyze faster and hurt more.' },
  silk:   { name: 'Silk',   text: 'Stronger silk: webs hold bigger prey for longer.' },
  body:   { name: 'Shell',  text: 'Harder shell, stronger bite, higher jumps.' },
  senses: { name: 'Senses', text: 'Feel vibrations from further away, see danger sooner.' },
  speed:  { name: 'Speed',  text: 'Run faster at every size.' },
};
const evoCost = (lv) => 6 + lv * 6;

const previewCache = {};
// renders a species into a small picture (real 3D model, posed on a floor)
function speciesPreview(G, id) {
  if (previewCache[id]) return previewCache[id];
  try {
    const r = G.renderer.r, W = 420, H = 260;
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env; scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xfff4ea, 2.6); key.position.set(2, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7a60, 2.2); rim.position.set(-3, 1.5, -3); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0x8899aa, 0x221a18, 0.5));
    const sp = SPECIES[id];
    const body = buildSpider(sp, { quality: 'high', hairMul: 0.7 });
    const floor = (o, d, far) => { if (d.y > -1e-6) return null; const t = -o.y / d.y; if (t < 0 || t > far) return null; return { point: o.clone().addScaledVector(d, t), normal: new THREE.Vector3(0, 1, 0), distance: t }; };
    const rig = new SpiderRig(body, sp, floor);
    body.rotation.y = 0.85; scene.add(body); body.updateMatrixWorld(true);
    rig.excite = 0.6; for (let i = 0; i < 4; i++) rig.update(0.03, 0);
    const span = Math.max(...sp.legs.len) * 1.15 + 0.5;
    const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 50);
    cam.position.set(1.2, 0.95, 1.55).multiplyScalar(span * 0.95); cam.lookAt(0, 0.12, -0.12);
    const old = r.getRenderTarget(), oc = r.getClearColor(new THREE.Color()), oa = r.getClearAlpha();
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
    const buf = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    r.setRenderTarget(old); r.setClearColor(oc, oa);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); const img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    x.putImageData(img, 0, 0);
    previewCache[id] = cv.toDataURL('image/png');
    rt.dispose(); env.dispose(); pm.dispose();
    body.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  } catch (e) { console.warn('preview failed', e); previewCache[id] = ''; }
  return previewCache[id];
}

export class Menus {
  constructor(game) {
    this.game = game;
    this.open = null;   // name of the open menu (null = playing)
    this.stack = [];
    this.root = document.getElementById('ui') || document.body;
    addEventListener('keydown', (e) => this.key(e));
  }
  // ------------------------------------------------------------------ basics
  mk(cls, html) {
    const d = document.createElement('div'); d.className = 'menu ' + (cls || ''); d.innerHTML = html || '';
    this.root.appendChild(d);
    return d;
  }
  clear() { for (const e of this.stack) e.remove(); this.stack = []; }
  push(name, el) { this.stack.push(el); this.open = name; return el; }
  closeAll() { this.clear(); this.open = null; if (this.onClose) { const f = this.onClose; this.onClose = null; f(); } }
  back() { const e = this.stack.pop(); if (e) e.remove(); const prev = this.stack[this.stack.length - 1]; this.open = prev ? prev.dataset.name : null; if (prev && prev.refresh) prev.refresh(); }
  ui(k) { this.game.audio.ui && this.game.audio.ui(k); }
  btn(el, sel, fn) { const b = el.querySelector(sel); if (b) b.onclick = (e) => { e.stopPropagation(); this.ui('click'); fn(e); }; return b; }

  key(e) {
    const G = this.game;
    if (G.input.capture) return;
    if (e.code === 'Escape') {
      if (this.open === 'pause') { G.resume(); return; }
      if (this.open === 'note' || this.open === 'map') { this.closePlayOverlay(); return; }
      if (this.stack.length > 1) { this.back(); return; }
      if (this.open === 'evolve' || this.open === 'death' || this.open === 'main') return;
      if (!this.open && G.state === 'play') { G.pause(); return; }
    }
    if (this.open === 'note' && (e.code === G.input.binds.eat || e.code === 'Enter' || e.code === 'Space')) { this.closePlayOverlay(); return; }
    if (this.open === 'map' && e.code === G.input.binds.map) { e.preventDefault(); this.closePlayOverlay(); return; }
    if (this.open === 'evolve' && /^Digit[1-3]$/.test(e.code)) { const c = this.stack[this.stack.length - 1].querySelectorAll('.card')[+e.code.slice(5) - 1]; if (c) c.click(); }
  }

  // ------------------------------------------------------------------ main menu
  main() {
    const G = this.game;
    this.clear();
    G.state = 'menu'; G.controlsOn = false; G.hud.show(false); G.hud.cinema(false);
    G.input.unlock();
    G.audio.setTrack && G.audio.setTrack('menu');
    const run = loadRun();
    const m = G.meta;
    const el = this.mk('main', `
      <div class="mbox">
        ${LOGO}
        <div class="sub">Specimen 8 has escaped</div>
        ${run ? `<button class="mbtn" data-a="cont">Continue<div style="font-size:12px;letter-spacing:.12em;color:var(--mut);text-transform:none;margin-top:3px">${sizeText(run.sizeM)} &middot; ${esc(ZONE_TITLE[run.zone] || run.zone)} &middot; saved ${new Date(run.savedAt).toLocaleString()}</div></button>` : ''}
        <button class="mbtn" data-a="new">New run</button>
        <button class="mbtn" data-a="set">Settings</button>
        <button class="mbtn" data-a="rec">Records</button>
        <button class="mbtn" data-a="best">Bestiary</button>
        <button class="mbtn" data-a="cred">Credits</button>
        <div style="margin-top:28px;font-size:12px;color:var(--mut);letter-spacing:.12em">BIGGEST EVER: ${sizeText(m.bestSize)} &nbsp;&middot;&nbsp; RUNS: ${m.runs} &nbsp;&middot;&nbsp; DEATHS: ${m.deaths}</div>
      </div>`);
    el.dataset.name = 'main';
    this.push('main', el);
    this.btn(el, '[data-a=cont]', () => this.go(() => G.continueRun()));
    this.btn(el, '[data-a=new]', () => this.newRun());
    this.btn(el, '[data-a=set]', () => this.settings());
    this.btn(el, '[data-a=rec]', () => this.records());
    this.btn(el, '[data-a=best]', () => this.bestiary());
    this.btn(el, '[data-a=cred]', () => this.credits());
    // the first click anywhere starts the sound (browser rule)
    el.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });
  }
  go(fn) { const G = this.game; G.audio.unlock(); this.clear(); this.open = null; fn(); }

  newRun() {
    const G = this.game, run = loadRun();
    const el = this.mk('dim', `<div class="panel" style="width:min(900px,92vw)">
      <h2>New run</h2>
      <div style="color:var(--mut);margin:-8px 0 18px;font-size:14px">You start as a 4 mm black widow in a glass tank on the 48th floor. Dying is permanent: your saved spider is deleted.</div>
      <div class="cards" style="margin:0;gap:14px">
        <div class="card" data-d="normal"><div class="k">Difficulty</div><div class="t">Normal</div><div class="x">The real game. Hunters get smarter as you grow. Hunger is slow. Your shell can take some hits.</div></div>
        <div class="card" data-d="hard"><div class="k">Difficulty</div><div class="t">Hard</div><div class="x">Hits hurt more, hunger is faster, Voss's people react quicker and send more of them.</div></div>
        <div class="card" data-d="realistic"><div class="k">Difficulty</div><div class="t">Realistic</div><div class="x">Everything acts like real life. Tiny = one shoe, one swat, one bird and you are dead. Legs break off. You dry out without water. Most people kill you on sight.</div></div>
      </div>
      ${run ? '<div style="margin-top:16px;color:#ff8a7a;font-size:13px">Starting a new run deletes your saved spider (' + sizeText(run.sizeM) + ').</div>' : ''}
      <div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'new'; this.push('new', el);
    el.querySelectorAll('[data-d]').forEach(c => c.onclick = () => { this.ui('click'); const d = c.dataset.d; this.go(() => G.newRun({ difficulty: d })); });
    this.btn(el, '[data-a=back]', () => this.back());
  }

  // ------------------------------------------------------------------ pause
  pause() {
    const G = this.game;
    this.clear();
    G.input.unlock();
    const notes = Object.keys(G.story.notes || {}).length;
    const el = this.mk('dim', `<div class="mbox">
      ${LOGO.replace('class="logo"', 'class="logo" style="font-size:64px"')}
      <div class="sub">Paused &middot; ${sizeText(G.player ? G.player.sizeM : 0)} &middot; ${fmtTime(G.runTime)}</div>
      <button class="mbtn" data-a="res">Resume</button>
      <button class="mbtn" data-a="map">Map + evolution</button>
      <button class="mbtn" data-a="notes" ${notes ? '' : 'disabled'}>Voss's notes (${notes}/${Object.keys(NOTES).length})</button>
      <button class="mbtn" data-a="set">Settings</button>
      <button class="mbtn" data-a="quit">Quit to menu</button>
      <div style="margin-top:20px;font-size:12px;color:var(--mut);max-width:420px;line-height:1.5">Your run only saves when you rest at your lair (L to spin one, R to rest). Quitting now loses everything since your last rest.</div>
    </div>`);
    el.dataset.name = 'pause'; this.push('pause', el);
    this.btn(el, '[data-a=res]', () => G.resume());
    this.btn(el, '[data-a=map]', () => { this.clear(); this.open = null; G.state = 'play'; this.toggleMap(); });
    this.btn(el, '[data-a=notes]', () => this.notesList());
    this.btn(el, '[data-a=set]', () => this.settings());
    this.btn(el, '[data-a=quit]', () => { G.recordBest(); saveMeta(G.meta); this.main(); });
  }

  // ------------------------------------------------------------------ settings
  settings(tab = 'graphics') {
    const G = this.game, S = G.settings;
    const el = this.mk('dim', `<div class="panel"><h2>Settings</h2><div class="tabs"></div><div class="body"></div><div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'settings'; this.push('settings', el);
    this.btn(el, '[data-a=back]', () => this.back());
    const tabs = { graphics: 'Graphics', sound: 'Sound', game: 'Gameplay', camera: 'Camera', hud: 'HUD', controls: 'Controls' };
    const T = el.querySelector('.tabs'), B = el.querySelector('.body');
    const save = () => G.applySettings();
    const row = (label, desc, ctl) => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<div><div>${label}</div>${desc ? `<div class="d">${desc}</div>` : ''}</div>`; r.appendChild(ctl); B.appendChild(r); return r; };
    const seg = (opts, cur, fn) => { const d = document.createElement('div'); d.className = 'seg'; for (const [v, l] of opts) { const b = document.createElement('button'); b.textContent = l; if (v === cur) b.className = 'on'; b.onclick = () => { this.ui('click'); fn(v); d.querySelectorAll('button').forEach(x => x.className = ''); b.className = 'on'; }; d.appendChild(b); } return d; };
    const slider = (min, max, step, cur, fn, fmt = (v) => v) => { const d = document.createElement('div'); d.style.display = 'flex'; d.style.alignItems = 'center'; d.style.gap = '10px'; const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = cur; const o = document.createElement('span'); o.style.width = '46px'; o.style.textAlign = 'right'; o.style.color = 'var(--mut)'; o.textContent = fmt(+cur); i.oninput = () => { o.textContent = fmt(+i.value); fn(+i.value); }; d.append(i, o); return d; };
    const toggle = (cur, fn) => seg([[true, 'On'], [false, 'Off']], cur, fn);
    const pct = (v) => Math.round(v * 100) + '%';
    const show = (k) => {
      T.querySelectorAll('button').forEach(b => b.className = b.dataset.t === k ? 'on' : '');
      B.innerHTML = '';
      if (k === 'graphics') {
        const r = G.renderer;
        row('Quality', 'Auto picks from your graphics card and keeps it smooth. ' + (r.gpu ? 'Your card: ' + esc(r.gpu.replace(/ANGLE \(|\)$/g, '').slice(0, 70)) : ''), seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], r.qSetting, (v) => { S.quality = v; r.setQuality(v); save(); }));
        row('Field of view', '', slider(45, 95, 1, S.fov, (v) => { S.fov = v; save(); }, (v) => v + '°'));
        row('Camera shake', '', slider(0, 1.5, 0.05, S.shake, (v) => { S.shake = v; save(); }, pct));
      } else if (k === 'sound') {
        for (const [key, l] of [['master', 'Master'], ['music', 'Music'], ['spiderVol', 'Your spider'], ['voices', 'Voices'], ['world', 'World + city'], ['news', 'News + radio'], ['sfx', 'Effects']]) row(l, '', slider(0, 1, 0.01, S[key] ?? 1, (v) => { S[key] = v; save(); }, pct));
        row('Subtitles', 'Voices are muffled and too deep to understand when you are tiny. They get clearer as you grow.', toggle(S.subtitles, (v) => { S.subtitles = v; save(); }));
        row('Subtitle size', '', seg([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], typeof S.subSize === 'string' ? S.subSize : 'medium', (v) => { S.subSize = v; save(); }));
      } else if (k === 'game') {
        row('Bug + animal gore', 'Goo when you bite bugs and animals. People are never shown hurt: they get wrapped in silk.', seg([['off', 'Off'], ['medium', 'Some'], ['max', 'Max']], S.gore, (v) => { S.gore = v; save(); }));
        row('Goo stays', 'Splats stay on the floor or fade away.', toggle(S.bloodStays, (v) => { S.bloodStays = v; save(); }));
        row('Hints', 'Small tips the first time you need a control.', toggle(S.hints, (v) => { S.hints = v; save(); }));
        row('Spider fear mode', 'Your spider turns into a soft blue blob with big eyes. Same game.', toggle(S.fear, (v) => { S.fear = v; save(); }));
      } else if (k === 'camera') {
        row('Distance', '', slider(0.6, 2.2, 0.05, S.camDist, (v) => { S.camDist = v; save(); }, (v) => v.toFixed(2) + 'x'));
        row('Mouse sensitivity', '', slider(0.2, 3, 0.05, S.sens, (v) => { S.sens = v; save(); }, (v) => v.toFixed(2)));
        row('Invert Y', '', toggle(S.invertY, (v) => { S.invertY = v; save(); }));
        row('Level horizon on walls', 'Keep the camera upright when you walk on walls and ceilings (less dizzy).', toggle(S.upright, (v) => { S.upright = v; save(); }));
      } else if (k === 'hud') {
        for (const [key, l] of [['meters', 'Health + meters'], ['size', 'Size + "as big as"'], ['wanted', 'Wanted level'], ['minimap', 'Minimap'], ['feed', 'News + social feed'], ['near', 'Target info'], ['kills', 'Hints + toasts']]) row(l, '', toggle(S.hud[key] !== false, (v) => { S.hud[key] = v; save(); }));
      } else if (k === 'controls') {
        const I = G.input;
        for (const a of Object.keys(BIND_NAMES)) {
          const b = document.createElement('button'); b.className = 'opt'; b.textContent = keyName(I.binds[a]); b.style.minWidth = '110px';
          b.onclick = () => { b.textContent = 'press a key...'; I.capture = (code) => { if (code !== 'Escape') I.setBind(a, code); show('controls'); }; };
          row(BIND_NAMES[a], '', b);
        }
        row('Mouse', 'Left click = bite, right click = web shot, wheel = zoom', document.createElement('span'));
        const rs = document.createElement('button'); rs.className = 'opt'; rs.textContent = 'Reset all'; rs.onclick = () => { I.resetBinds(); show('controls'); };
        row('Reset to defaults', '', rs);
      }
    };
    for (const [k, l] of Object.entries(tabs)) { const b = document.createElement('button'); b.textContent = l; b.dataset.t = k; b.onclick = () => { this.ui('click'); show(k); }; T.appendChild(b); }
    show(tab);
  }

  // ------------------------------------------------------------------ records, bestiary, credits
  records() {
    const G = this.game, m = G.meta;
    const tro = Object.keys(m.trophies || {});
    const deaths = Object.entries(m.deathsBy || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const el = this.mk('dim', `<div class="panel"><h2>Records</h2>
      <div class="grid" style="margin:0 0 18px;width:auto">
        <div><b>${sizeText(m.bestSize)}</b><span>biggest you ever got</span></div>
        <div><b>${esc(ZONE_TITLE[m.bestZone] || 'VOSS tower')}</b><span>furthest world</span></div>
        <div><b>${m.runs}</b><span>runs</span></div><div><b>${m.deaths}</b><span>deaths</span></div>
        <div><b>${m.totalEaten}</b><span>things eaten (all runs)</span></div><div><b>${m.endings || 0}</b><span>endings seen</span></div>
        <div><b>${tro.length}</b><span>trophies</span></div><div><b>${Object.keys(m.bestiary || {}).length}</b><span>species in the bestiary</span></div>
      </div>
      <div class="lbl" style="font-size:12px;color:var(--mut);letter-spacing:.2em;margin-bottom:8px">HOW YOU DIED</div>
      ${deaths.length ? deaths.map(([c, n]) => `<div class="row"><div>${esc(c)}</div><div>${n}x</div></div>`).join('') : '<div class="row"><div style="color:var(--mut)">Never. Yet.</div></div>'}
      <div class="lbl" style="font-size:12px;color:var(--mut);letter-spacing:.2em;margin:18px 0 8px">TROPHIES</div>
      ${tro.length ? tro.map(t => `<div class="row"><div>${esc(t)}</div><div style="color:var(--mut);font-size:12px">${new Date(m.trophies[t]).toLocaleDateString()}</div></div>`).join('') : '<div class="row"><div style="color:var(--mut)">None yet.</div></div>'}
      <div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'records'; this.push('records', el); this.btn(el, '[data-a=back]', () => this.back());
  }
  bestiary() {
    const G = this.game, B = G.meta.bestiary || {};
    const all = { ...Object.fromEntries(Object.entries(KINDS).map(([k, d]) => [k, d])), human: { name: 'Human', latin: 'Homo sapiens', fact: 'Builds towers, tanks and rockets. Afraid of you.' } };
    for (const k of Object.keys(B)) if (!all[k]) all[k] = B[k];
    const cells = Object.entries(all).map(([k, d]) => {
      const e = B[k];
      return e ? `<div><b>${esc(e.name || d.name)}</b><div style="font-style:italic;color:var(--mut);font-size:12px">${esc(e.latin || d.latin || '')}</div><div style="margin-top:6px">${esc(d.fact || e.fact || '')}</div><div style="margin-top:6px;color:var(--mut);font-size:12px">Eaten ${e.count}x</div></div>`
        : `<div class="lk"><b>???</b><div style="color:var(--mut);font-size:12px">Not eaten yet</div></div>`;
    }).join('');
    const el = this.mk('dim', `<div class="panel"><h2>Bestiary</h2><div style="color:var(--mut);margin:-8px 0 16px;font-size:13px">Everything you ever ate, in every run. It survives death.</div><div class="bestiary">${cells}</div><div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'bestiary'; this.push('bestiary', el); this.btn(el, '[data-a=back]', () => this.back());
  }
  credits() {
    const el = this.mk('dim', `<div class="panel"><h2>Credits</h2>
      <div class="row"><div>APEX WIDOW<div class="d">Game design: the player. Built with three.js.</div></div></div>
      <div class="row"><div>Music<div class="d">Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0. Tracks: Darkest Child, Ossuary 6 - Air, Unseen Horrors, Volatile Reaction, Five Armies, Lightless Dawn, Crusade - Heavy Industry, Echoes of Time v2.</div></div></div>
      <div class="row"><div>Planet + star textures<div class="d">Solar System Scope (solarsystemscope.com), CC BY 4.0. Based on NASA imagery.</div></div></div>
      <div class="row"><div>Surface textures<div class="d">Poly Haven (polyhaven.com), CC0.</div></div></div>
      <div class="row"><div>People + cars<div class="d">Quaternius (quaternius.com), CC0.</div></div></div>
      <div class="row"><div>Code libraries<div class="d">three.js (MIT), postprocessing (Zlib), N8AO (CC0), three-mesh-bvh (MIT).</div></div></div>
      <div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'credits'; this.push('credits', el); this.btn(el, '[data-a=back]', () => this.back());
  }

  // ------------------------------------------------------------------ death
  death(cause) {
    const G = this.game, p = G.player, st = G.stats;
    this.clear(); G.hud.show(false);
    G.audio.setTrack && G.audio.setTrack(null);
    const eatenKinds = Object.keys(st.eatenList || {}).length;
    const el = this.mk('dim', `<div class="death">
      <div class="t1">YOU DIED</div>
      <div class="c">${esc(DEATHS[cause] || ('Killed by ' + cause + '.'))}</div>
      <div class="grid">
        <div><b>${sizeText(G.growth.peak || p.sizeM)}</b><span>as big as ${esc(asBig(G.growth.peak || p.sizeM))}</span></div>
        <div><b>${fmtTime(G.runTime)}</b><span>time alive</span></div>
        <div><b>${st.eaten}</b><span>things eaten</span></div>
        <div><b>${eatenKinds}</b><span>different kinds</span></div>
        <div><b>${st.humans}</b><span>people wrapped</span></div>
        <div><b>${st.molts}</b><span>molts</span></div>
        <div><b>${esc(LEVEL_NAMES[st.maxWanted] || 'nobody')}</b><span>hunted by</span></div>
        <div><b>${Object.keys(st.notes || {}).length}/${Object.keys(NOTES).length}</b><span>Voss's notes</span></div>
      </div>
      <div style="color:var(--mut);font-size:13px;margin-bottom:22px">${esc(ZONE_TITLE[G.zone ? G.zone.id : 'halvern'] || '')} &middot; ${G.settings.difficulty.toUpperCase()} &middot; your saved spider is gone</div>
      <button class="mbtn" data-a="again" style="text-align:center">Try again</button><br>
      <button class="mbtn small" data-a="menu" style="text-align:center">Main menu</button>
    </div>`);
    el.dataset.name = 'death'; this.push('death', el);
    this.btn(el, '[data-a=again]', () => this.go(() => G.newRun({ difficulty: G.settings.difficulty })));
    this.btn(el, '[data-a=menu]', () => this.main());
  }

  // ------------------------------------------------------------------ molt: pick an evolution
  evolve(cards, cb) {
    const G = this.game;
    this.clear();
    const html = cards.map((c, i) => {
      let img = '', extra = '';
      if (c.kind === 'species') img = `<img src="${speciesPreview(G, c.species)}">`;
      if (c.kind === 'grow') img = `<div style="height:150px;margin:8px 0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#1c1a1e,#09090b);font-size:58px;font-weight:800;color:#c79bff">+20%</div>`;
      if (c.kind === 'power') { const col = '#' + new THREE.Color(POWERS[c.power].color).getHexString(); img = `<div style="height:150px;margin:8px 0;background:radial-gradient(circle at 50% 55%, ${col}aa 0%, ${col}22 35%, #09090b 70%)"></div>`; extra = `<div class="d" style="margin-top:8px;color:var(--mut);font-size:12px">From: ${esc(POWERS[c.power].from)}</div>`; }
      if (c.kind === 'trait') img = `<div style="height:150px;margin:8px 0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#1c1a1e,#09090b);font-size:40px;font-weight:800;letter-spacing:.1em">${esc(c.title)}</div>`;
      if (c.stats) extra = `<div class="sb">${Object.entries(c.stats).filter(([k]) => ['speed', 'venom', 'silk', 'armor', 'jump'].includes(k)).map(([k, v]) => `<span>${k}</span><i style="width:${clamp(v / 2.6, 0.05, 1) * 100}%"></i>`).join('')}</div>`;
      const kind = { grow: 'Grow', species: 'Become a new species', power: 'Keep a stolen power', trait: 'Evolve' }[c.kind];
      return `<div class="card" data-i="${i}"><div class="k">${i + 1} &middot; ${kind}</div><div class="t">${esc(c.title)}</div>${img}<div class="x">${esc(c.text)}${c.kind === 'species' ? `<div style="margin-top:6px;font-style:italic;color:var(--mut);font-size:12px">${esc(SPECIES[c.species].latin)}</div>` : ''}</div>${extra}</div>`;
    }).join('');
    const el = this.mk('dim', `<div style="margin:auto;text-align:center">
      <div style="font-size:13px;letter-spacing:.4em;color:var(--mut)">MOLT ${G.growth.moltCount}</div>
      <div style="font-size:40px;font-weight:800;letter-spacing:.14em;margin:6px 0 26px">YOU CRAWL OUT ${esc(sizeText(G.player.targetSize || G.player.sizeM).toUpperCase())}</div>
      <div class="cards">${html}</div>
      <div style="margin-top:20px;color:var(--mut);font-size:12px;letter-spacing:.14em">CLICK A CARD OR PRESS 1 - 3</div></div>`);
    el.dataset.name = 'evolve'; this.push('evolve', el);
    el.querySelectorAll('.card').forEach(d => d.onclick = () => { this.ui('level'); const c = cards[+d.dataset.i]; this.clear(); this.open = null; cb(c); });
  }

  // ------------------------------------------------------------------ in-game overlays (note, map) pause the world
  playOverlay(name, el) {
    const G = this.game;
    this.clear();
    el.dataset.name = name; this.push(name, el);
    G.state = 'paused'; G.controlsOn = false;
    G.input.unlock();
  }
  closePlayOverlay() {
    const G = this.game;
    this.clear(); this.open = null;
    if (G.state === 'paused') { G.state = 'play'; G.controlsOn = true; G.input.lock(); }
  }
  note(n) {
    const el = this.mk('dim', `<div style="margin:auto;text-align:center"><div class="note"><h3>${esc(n.title)}</h3>${esc(n.text)}<div style="margin-top:16px;text-align:right;font-size:14px">- ${esc(n.by)}</div></div>
      <div style="margin-top:22px;color:var(--mut);font-size:12px;letter-spacing:.2em">CLICK OR PRESS E TO KEEP GOING</div></div>`);
    el.onclick = () => this.closePlayOverlay();
    this.playOverlay('note', el);
    this.ui('paper');
  }
  notesList() {
    const G = this.game;
    const ids = Object.keys(NOTES).filter(k => G.story.notes[k]);
    const el = this.mk('dim', `<div class="panel"><h2>Voss's notes</h2>${ids.map(k => `<div class="row" style="cursor:pointer" data-n="${k}"><div>${esc(NOTES[k].title)}<div class="d">${esc(NOTES[k].by)}</div></div><div style="color:var(--mut)">read</div></div>`).join('')}
      <div style="margin-top:18px"><button class="mbtn small" data-a="back">Back</button></div></div>`);
    el.dataset.name = 'notes'; this.push('notes', el);
    this.btn(el, '[data-a=back]', () => this.back());
    el.querySelectorAll('[data-n]').forEach(r => r.onclick = () => {
      const n = NOTES[r.dataset.n];
      const v = this.mk('dim', `<div style="margin:auto;text-align:center"><div class="note"><h3>${esc(n.title)}</h3>${esc(n.text)}<div style="margin-top:16px;text-align:right;font-size:14px">- ${esc(n.by)}</div></div><div style="margin-top:22px;color:var(--mut);font-size:12px;letter-spacing:.2em">CLICK TO GO BACK</div></div>`);
      v.dataset.name = 'notes'; this.push('notes', v); v.onclick = () => this.back();
    });
  }

  toggleMap() {
    const G = this.game;
    if (this.open === 'map') { this.closePlayOverlay(); return; }
    if (G.state !== 'play') return;
    const el = this.mk('dim', `<div class="panel" style="width:min(1100px,94vw)"><h2>Map + evolution</h2><div class="tabs"></div><div class="body"></div>
      <div style="margin-top:14px;color:var(--mut);font-size:12px;letter-spacing:.14em">TAB OR ESC TO CLOSE</div></div>`);
    this.playOverlay('map', el);
    const T = el.querySelector('.tabs'), B = el.querySelector('.body');
    const show = (k) => {
      T.querySelectorAll('button').forEach(b => b.className = b.dataset.t === k ? 'on' : '');
      B.innerHTML = '';
      if (k === 'evo') this.evoTree(B);
      else if (k === 'map') this.drawMap(B);
      else if (k === 'powers') this.powersList(B);
    };
    for (const [k, l] of [['evo', 'Evolution'], ['map', 'Map'], ['powers', 'Powers']]) { const b = document.createElement('button'); b.textContent = l; b.dataset.t = k; b.onclick = () => { this.ui('click'); show(k); }; T.appendChild(b); }
    show('evo');
  }
  evoTree(B) {
    const G = this.game, p = G.player;
    const draw = () => {
      B.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px"><div style="color:var(--mut)">${esc(p.sp.name)} <i>${esc(p.sp.latin)}</i> &middot; ${sizeText(p.sizeM)}</div><div style="font-size:20px"><b style="color:#c79bff">${p.mutationPoints}</b> <span style="font-size:12px;color:var(--mut);letter-spacing:.14em">MUTATION POINTS (FROM EATING)</span></div></div><div class="evo"></div>`;
      const E = B.querySelector('.evo');
      for (const [k, d] of Object.entries(EVO)) {
        const lv = p.evo[k] || 0, cost = evoCost(lv), max = lv >= 10;
        const c = document.createElement('div');
        c.innerHTML = `<div style="font-size:18px;font-weight:700;letter-spacing:.12em">${d.name.toUpperCase()}</div><div style="display:flex;gap:3px;justify-content:center;margin:10px 0">${Array.from({ length: 10 }, (_, i) => `<i style="width:8px;height:14px;background:${i < lv ? '#c79bff' : 'rgba(255,255,255,.1)'}"></i>`).join('')}</div><div style="font-size:12px;color:var(--mut);min-height:46px">${d.text}</div>`;
        const b = document.createElement('button'); b.className = 'opt'; b.style.cssText = 'font-family:var(--font);background:#14141a;color:var(--fg);border:1px solid var(--line);padding:6px 10px;cursor:pointer;margin-top:8px';
        b.textContent = max ? 'MAX' : `+1  (${cost} MP)`; b.disabled = max || p.mutationPoints < cost;
        if (b.disabled) b.style.opacity = 0.4;
        b.onclick = () => { if (p.mutationPoints < cost || max) return; p.mutationPoints -= cost; p.evo[k] = lv + 1; this.ui('level'); G.trophy('evo-' + k + '-' + (lv + 1), d.name + ' level ' + (lv + 1)); draw(); };
        c.appendChild(b); E.appendChild(c);
      }
    };
    draw();
  }
  powersList(B) {
    const G = this.game, p = G.player;
    const own = Object.keys(p.powers), pend = G.growth.pendingPowers;
    const keys = ['p1', 'p2', 'p3', 'p4'].map(k => keyName(G.input.binds[k]));
    let h = `<div class="row"><div><span class="key">${keys[0]}</span>Trap web<div class="d">Spin a sticky cobweb here. You feel it when something hits it.</div></div></div>`;
    own.forEach((pw, i) => { h += `<div class="row"><div>${i < 3 ? `<span class="key">${keys[i + 1]}</span>` : ''}${esc(POWERS[pw].name)} ${p.powers[pw] > 1 ? 'x' + p.powers[pw] : ''}<div class="d">${esc(POWERS[pw].desc)}</div></div><div style="width:18px;height:18px;border-radius:50%;background:#${new THREE.Color(POWERS[pw].color).getHexString()}"></div></div>`; });
    for (const pw of pend) h += `<div class="row" style="opacity:.6"><div>${esc(POWERS[pw].name)} (in your blood: MOLT to keep it)<div class="d">${esc(POWERS[pw].desc)}</div></div></div>`;
    const notOwned = Object.keys(POWERS).filter(k => !own.includes(k) && !pend.includes(k));
    if (notOwned.length) h += `<div class="lbl" style="font-size:12px;color:var(--mut);letter-spacing:.2em;margin:18px 0 6px">STILL OUT THERE</div>` + notOwned.map(k => `<div class="row" style="opacity:.45"><div>???<div class="d">Eat ${esc(POWERS[k].from)}</div></div></div>`).join('');
    B.innerHTML = h;
  }
  drawMap(B) {
    const G = this.game, Z = G.zone, p = G.player;
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 560; cv.style.width = '100%'; cv.style.background = 'rgba(0,0,0,.35)'; B.appendChild(cv);
    const x = cv.getContext('2d'); x.font = '14px Bahnschrift, Segoe UI, sans-serif';
    if (Z.mapDraw) { Z.mapDraw(x, cv.width, cv.height); return; }
    if (Z.id === 'halvern' && Z.inside(p.pos)) {
      // the tower, floor by floor
      const floors = [ROOF, ...PLAYABLE];
      const cur = Z.floorAt(p.pos);
      x.fillStyle = '#8c8b90'; x.fillText('VOSS BIOGENETICS TOWER  -  only some floors are open (the rest are locked offices). Elevators + stairs in the core.', 30, 30);
      floors.forEach((n, i) => {
        const y = 70 + i * 66;
        const here = n === cur;
        x.fillStyle = here ? 'rgba(212,20,26,.35)' : 'rgba(255,255,255,.05)'; x.fillRect(260, y, 480, 50);
        x.strokeStyle = here ? '#ff3b30' : 'rgba(255,255,255,.15)'; x.strokeRect(260, y, 480, 50);
        x.fillStyle = '#e9e6e1'; x.font = 'bold 18px Bahnschrift, Segoe UI, sans-serif'; x.fillText(n === ROOF ? 'ROOF' : 'FLOOR ' + n, 280, y + 31);
        x.font = '14px Bahnschrift, Segoe UI, sans-serif'; x.fillStyle = '#8c8b90'; x.fillText((FLOOR_NAMES[n] || '').replace(/^.*? - /, ''), 420, y + 31);
        if (here) { x.fillStyle = '#ff3b30'; x.beginPath(); x.moveTo(240, y + 25); x.lineTo(222, y + 15); x.lineTo(222, y + 35); x.fill(); x.fillText('YOU', 180, y + 30); }
        if (G.growth.lair && Z.floorAt(G.growth.lair.pos) === n) { x.fillStyle = '#c79bff'; x.fillText('LAIR', 760, y + 31); }
      });
      return;
    }
    // the city from above
    const span = Math.max(1200, p.sizeM * 400), W = cv.width, H = cv.height, k = H / span;
    const toS = (wx, wz) => [W / 2 + (wx - p.pos.x) * k, H / 2 + (wz - p.pos.z) * k];
    x.fillStyle = '#0d1016'; x.fillRect(0, 0, W, H);
    if (Z.city && Z.city.mapBlocks) for (const b of Z.city.mapBlocks) { const [sx, sy] = toS(b.x0, b.z0); x.fillStyle = b.water ? '#0b1a2a' : b.park ? '#13241a' : '#1c1d22'; x.fillRect(sx, sy, (b.x1 - b.x0) * k, (b.z1 - b.z0) * k); }
    const [tx, ty] = toS(0, 0); x.fillStyle = '#d4141a'; x.fillRect(tx - 22 * k, ty - 22 * k, 44 * k, 44 * k); x.fillStyle = '#e9e6e1'; x.fillText('VOSS', tx - 16, ty - 22 * k - 6);
    if (G.growth.lair) { const [lx, ly] = toS(G.growth.lair.pos.x, G.growth.lair.pos.z); x.fillStyle = '#c79bff'; x.beginPath(); x.arc(lx, ly, 6, 0, 7); x.fill(); x.fillText('LAIR', lx + 9, ly + 4); }
    x.fillStyle = '#ff3b30'; x.beginPath(); x.arc(W / 2, H / 2, 7, 0, 7); x.fill(); x.fillText('YOU', W / 2 + 10, H / 2 + 4);
    x.fillStyle = '#8c8b90'; x.fillText('NEW HALVERN  -  ' + sizeText(span) + ' across', 20, 26);
  }
}
