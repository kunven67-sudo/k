// POCKET SIZE - entry point. Renderer, loading, main menu, settings, pause, and the game loop.
import * as THREE from 'three';
import { getSettings, setSetting, onSettingChange, getPreset, resetSettings } from './core/settings.js';
import { input } from './core/input.js';
import { initAudio, resumeAudio, sfx, setListener, playMusic } from './core/audio.js';
import { ui } from './core/ui.js';
import { PostFX } from './core/post.js';
import { setAnisotropy } from './core/textures.js';
import { windUniforms } from './core/materials.js';
import { Director } from './core/cutscene.js';
import { G, loadSave, unlockedChapters } from './game/state.js';
import { ACHIEVEMENTS, DEATHS, allUnlocked, deathsDiscovered } from './game/achievements.js';
import { Story, CHAPTERS } from './game/story.js';

// ---------------------------------------------------------------- renderer
const preset = getPreset();
setAnisotropy(preset.anisotropy);
const renderer = new THREE.WebGLRenderer({ antialias: !preset.post, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = preset.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let autoScale = 1; // lowered automatically when frame rate drops
function pixelRatio() { return Math.min(window.devicePixelRatio || 1, getPreset().pixelRatioCap) * getSettings().resolutionScale * autoScale; }
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('scene-root').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(getSettings().fov, window.innerWidth / window.innerHeight, 0.05, 6000);
const post = new PostFX(renderer);
const director = new Director(camera);
G.renderer = renderer; G.camera = camera; G.post = post; G.director = director;
G.settingsApi = { setSetting };
G.music = (m) => playMusic(m);
input.init(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  post.resize(window.innerWidth, window.innerHeight);
});

onSettingChange((k) => {
  if (['bloom', 'depthOfField', 'filmGrain'].includes(k)) post.build();
  if (k === 'resolutionScale') { renderer.setPixelRatio(pixelRatio()); post.build(); }
  if (k === 'fov' && G.mode === 'menu') { camera.fov = getSettings().fov; camera.updateProjectionMatrix(); }
});

// Audio can only start after a user gesture.
const unlockAudio = () => { initAudio(); resumeAudio(); };
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// ---------------------------------------------------------------- pointer lock / pause
input.onLockChange((locked) => {
  if (locked) { ui.lock(false); return; }
  if (G.mode === 'play' && !Story.modalOpen()) openPause();
});
document.getElementById('lock').addEventListener('click', () => { resumeAudio(); input.requestLock(); });
renderer.domElement.addEventListener('click', () => { if ((G.mode === 'play' || G.mode === 'cutscene') && !input.locked && !Story.modalOpen()) input.requestLock(); });

function openPause() {
  if (G.mode !== 'play') return;
  G.mode = 'paused';
  const s = G.stats;
  document.getElementById('pause-stats').innerHTML =
    `Chapter: <b>${G.chapter || '-'}</b><br>Deaths: ${s.deaths} &middot; Bugs defeated: ${s.bugs} &middot; Grass cut: ${s.grass}<br>Achievements: ${allUnlocked().size}/${ACHIEVEMENTS.length}`;
  document.getElementById('pause').classList.remove('hidden');
  ui.clearSubtitle();
}
function closePause() {
  document.getElementById('pause').classList.add('hidden');
  G.mode = 'play';
  input.requestLock();
}
document.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', () => {
  sfx('click');
  const a = b.dataset.pause;
  if (a === 'resume') closePause();
  if (a === 'checkpoint') { document.getElementById('pause').classList.add('hidden'); G.mode = 'play'; Story.respawn(); input.requestLock(); }
  if (a === 'settings') { document.getElementById('pause').classList.add('hidden'); showMenuOverlay('settings', () => { document.getElementById('pause').classList.remove('hidden'); }); }
  if (a === 'menu') { document.getElementById('pause').classList.add('hidden'); Story.quitToMenu(); }
}));

// ---------------------------------------------------------------- menu
const menuEl = document.getElementById('menu');
const subEl = document.getElementById('menu-sub');
let subReturn = null;

function showMenu() {
  G.mode = 'menu';
  menuEl.classList.remove('hidden');
  subEl.classList.add('hidden');
  document.getElementById('btn-continue').disabled = !loadSave();
  ui.showHud(false);
  playMusic('menu');
}
G.showMenu = showMenu;

menuEl.querySelectorAll('[data-act]').forEach((b) => {
  b.addEventListener('mouseenter', () => sfx('hover'));
  b.addEventListener('click', () => {
    resumeAudio(); sfx('click');
    const a = b.dataset.act;
    if (a === 'start') { menuEl.classList.add('hidden'); Story.newGame(); }
    else if (a === 'continue') { menuEl.classList.add('hidden'); Story.continueGame(loadSave()); }
    else if (a === 'back') closeSub();
    else openSub(a);
  });
});

function closeSub() {
  subEl.classList.add('hidden');
  if (subReturn) { const r = subReturn; subReturn = null; menuEl.classList.add('hidden'); r(); }
}

function showMenuOverlay(which, onClose) {
  menuEl.classList.remove('hidden');
  document.getElementById('menu-main').style.visibility = 'hidden';
  subReturn = () => { document.getElementById('menu-main').style.visibility = ''; onClose(); };
  openSub(which);
}

function row(label, control, val = '') { return `<div class="set-row"><span>${label}</span><span style="display:flex;align-items:center;gap:8px">${control}${val}</span></div>`; }

function openSub(which) {
  const body = document.getElementById('sub-body');
  const title = document.getElementById('sub-title');
  subEl.classList.remove('hidden');
  const s = getSettings();
  if (which === 'settings') {
    title.textContent = 'Settings';
    const sel = (k, opts) => `<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const rng = (k, min, max, step) => `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><span class="set-val" data-v="${k}">${s[k]}</span>`;
    const chk = (k) => `<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}>`;
    body.innerHTML = `
      <div class="set-group">Graphics</div>
      ${row('Quality preset', sel('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra (GTA mode)']]))}
      ${row('Resolution scale', rng('resolutionScale', 0.5, 1, 0.05))}
      ${row('Shadows', chk('shadows'))}
      ${row('Bloom', chk('bloom'))}
      ${row('Macro depth of field', chk('depthOfField'))}
      ${row('Film grain', chk('filmGrain'))}
      ${row('Field of view', rng('fov', 55, 100, 1))}
      ${row('Auto-lower resolution when slow', chk('autoResolution'))}
      ${row('Show FPS', chk('showFps'))}
      <div class="set-group">Gameplay</div>
      ${row('Difficulty', sel('difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]))}
      ${row('Camera', sel('cameraMode', [['third', 'Third person'], ['first', 'First person']]))}
      ${row('Mouse sensitivity', rng('sensitivity', 0.2, 3, 0.05))}
      ${row('Invert Y', chk('invertY'))}
      ${row('Objective marker', chk('waypoints'))}
      ${row('Camera shake & head bob', chk('motionEffects'))}
      ${row('5D Immersion (spatial audio, rumble, heartbeat)', chk('immersion5d'))}
      <div class="set-group">Audio</div>
      ${row('Master volume', rng('masterVolume', 0, 1, 0.01))}
      ${row('Music volume', rng('musicVolume', 0, 1, 0.01))}
      ${row('Effects volume', rng('sfxVolume', 0, 1, 0.01))}
      ${row('Character voice (text-to-speech)', chk('voice'))}
      ${row('Subtitles', chk('subtitles'))}
      <div style="margin-top:16px;display:flex;gap:8px"><button class="mbtn small" id="btn-reset">Reset to defaults</button><button class="mbtn small" id="btn-apply" style="display:none">Apply graphics (reload)</button></div>
      <p style="font-size:12px;color:rgba(255,255,255,.45);margin-top:10px">Quality, resolution and shadow changes need a quick reload. Your progress is saved.</p>`;
    body.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      const handler = () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range') v = parseFloat(v);
        setSetting(k, v);
        const vl = body.querySelector(`[data-v="${k}"]`);
        if (vl) vl.textContent = v;
        if (['quality', 'shadows', 'resolutionScale'].includes(k)) document.getElementById('btn-apply').style.display = '';
      };
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', handler);
    });
    document.getElementById('btn-reset').onclick = () => { resetSettings(); openSub('settings'); document.getElementById('btn-apply').style.display = ''; };
    document.getElementById('btn-apply').onclick = () => { Story.saveIfPlaying(); location.reload(); };
  } else if (which === 'achievements') {
    const got = allUnlocked();
    title.textContent = `Achievements ${got.size}/${ACHIEVEMENTS.length}`;
    body.innerHTML = ACHIEVEMENTS.map((a) => {
      const g = got.has(a.id);
      return `<div class="achv ${g ? 'got' : ''} ${a.secret ? 'secret' : ''}"><div class="ic">${a.icon}</div><div><div class="t">${g || !a.secret ? a.name : '???'}</div><div class="d">${g || !a.secret ? a.desc : 'Secret achievement - keep exploring.'}</div></div></div>`;
    }).join('');
  } else if (which === 'deaths') {
    const seen = deathsDiscovered();
    title.textContent = `Ways to Die ${seen.size}/${DEATHS.length}`;
    body.innerHTML = DEATHS.map((d) => {
      const g = seen.has(d.id);
      return `<div class="achv ${g ? 'got' : ''}"><div class="ic">${g ? '💀' : '❔'}</div><div><div class="t">${g ? d.name : '???'}</div><div class="d">${g ? d.text : 'Not discovered yet.'}</div></div></div>`;
    }).join('');
  } else if (which === 'chapters') {
    title.textContent = 'Chapters';
    const un = unlockedChapters();
    body.innerHTML = CHAPTERS.map((c, i) => `<div class="chap ${un.has(c.id) ? '' : 'locked'}" data-ch="${c.id}"><div><div class="n">CHAPTER ${i + 1}</div><div class="nm">${un.has(c.id) ? c.name : '? ? ?'}</div></div><div>${un.has(c.id) ? '&#9654;' : '&#128274;'}</div></div>`).join('');
    body.querySelectorAll('[data-ch]').forEach((el) => el.addEventListener('click', () => { sfx('click'); menuEl.classList.add('hidden'); Story.startChapter(el.dataset.ch); }));
  } else if (which === 'controls') {
    title.textContent = 'Controls';
    const rows = [
      ['Move', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'], ['Look', 'Mouse'], ['Jump', '<kbd>Space</kbd>'], ['Sprint', '<kbd>Shift</kbd>'],
      ['Crouch / sneak (quieter)', '<kbd>C</kbd> / <kbd>Ctrl</kbd>'], ['Interact / climb (mash)', '<kbd>E</kbd>'], ['Drop carried item', '<kbd>G</kbd>'],
      ['Attack', 'Left mouse'], ['Throw / aim', 'Right mouse'], ['Inventory & crafting', '<kbd>Tab</kbd> / <kbd>I</kbd>'], ['Hotbar', '<kbd>1</kbd>-<kbd>8</kbd> / wheel while holding <kbd>Alt</kbd>'],
      ['Build mode (outside)', '<kbd>B</kbd>'], ['Eat / use item', '<kbd>F</kbd>'], ['Zoom camera', 'Mouse wheel'], ['Toggle 1st / 3rd person', '<kbd>V</kbd>'],
      ['Skip cutscene', 'Hold <kbd>Space</kbd>'], ['Pause', '<kbd>Esc</kbd>'], ['Phone: scroll', 'Wheel / swipe / <kbd>&uarr;</kbd><kbd>&darr;</kbd>'], ['Phone: like', 'Double-click'],
      ['Swim up / down (germ size)', '<kbd>Space</kbd> / <kbd>C</kbd>'],
    ];
    body.innerHTML = `<table class="controls-table">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  } else if (which === 'credits') {
    title.textContent = 'Credits';
    body.innerHTML = `<div class="credits"><p><b>POCKET SIZE</b> — an original game about being very, very small.</p>
      <p>Every model, texture, animation, sound effect, voice line and piece of music in this game is generated from code at runtime. There are no downloaded art or audio files at all: the planks in the floor, the fur on the dog, the grass in the yard and the germs in the void are all math.</p>
      <p>Built with Three.js (MIT licence). Idea, story and direction by the player who asked for it. Code by Claude.</p>
      <p>Special thanks to Biscuit, who is a very good boy and would never eat anyone on purpose.</p></div>`;
  }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let lockShown = false;
let fpsAcc = 0, fpsN = 0, fpsT = 0;
const listenerFwd = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  G.time += dt;
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 0.5) { ui.fps(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; fpsT = 0; }
  windUniforms.uTime.value = G.time;

  if (input.wasPressed('Escape') && G.mode === 'paused') closePause();

  director.update(dt);
  Story.update(dt);

  const lvl = G.level;
  if (lvl) {
    if (lvl.update) lvl.update(dt, G.time);
    if (lvl.updateLights) lvl.updateLights(camera.position, G.player && G.mode === 'play' ? G.player.body.pos : null);
  }
  if (G.mode !== 'paused' && G.mode !== 'inventory') {
    G.aiPaused = G.mode !== 'play';
    if (lvl && lvl.creatures) {
      for (let i = lvl.creatures.length - 1; i >= 0; i--) {
        const c = lvl.creatures[i];
        const alive = c.update(dt, lvl, G.player);
        if (alive === false) { c.group.parent && c.group.parent.remove(c.group); lvl.creatures.splice(i, 1); }
      }
    }
    if ((G.mode === 'play' || G.mode === 'cutscene' || G.mode === 'dead') && G.player && lvl && G.player.object.parent) G.player.update(dt, lvl);
  }

  // "Click to play" only makes sense during free play.
  const wantLock = G.mode === 'play' && !input.locked;
  if (wantLock !== lockShown) { lockShown = wantLock; ui.lock(wantLock, 'Click to play'); }

  updateWaypoint();
  camera.getWorldDirection(listenerFwd);
  setListener(camera.position, listenerFwd);
  if (lvl) post.render(dt, G.time);
  input.endFrame();
  adaptResolution(dt);
}

// Objective marker: levels expose waypoint() -> { pos, scale?, unit? } for where to go next.
const wpCam = new THREE.Vector3(), wpNdc = new THREE.Vector3();
function updateWaypoint() {
  const lvl = G.level, P = G.player;
  const w = G.mode === 'play' && lvl && lvl.waypoint && P && getSettings().waypoints ? lvl.waypoint() : null;
  if (!w || !w.pos) { ui.waypoint(null); return; }
  wpCam.copy(w.pos).applyMatrix4(camera.matrixWorldInverse);
  const behind = wpCam.z > 0;
  wpNdc.copy(w.pos).project(camera);
  let nx = wpNdc.x, ny = wpNdc.y;
  if (behind) { nx = -nx; ny = -ny; if (Math.hypot(nx, ny) < 0.3) ny = -1; }
  // keep edge arrows clear of the objective text (top) and the hotbar (bottom)
  const mx = 0.9, top = 0.72, bot = 0.7;
  const edge = behind || Math.abs(nx) > mx || ny > top || ny < -bot;
  if (edge) {
    const k = Math.min(mx / Math.max(Math.abs(nx), 1e-4), ny > 0 ? top / ny : ny < 0 ? bot / -ny : Infinity);
    nx *= k; ny *= k;
  }
  const W = window.innerWidth, H = window.innerHeight;
  const d = P.body.pos.distanceTo(w.pos) * (w.scale ?? 0.01);
  ui.waypoint({
    x: (nx * 0.5 + 0.5) * W, y: (-ny * 0.5 + 0.5) * H, edge, angle: Math.atan2(-ny, nx),
    text: `${d < 10 ? d.toFixed(1) : Math.round(d)} ${w.unit ?? 'm'}`,
  });
}

// Adaptive resolution: if the game runs slowly during play, quietly render fewer pixels.
let perfT = 0, perfFrames = 0, perfWarned = false;
function adaptResolution(dt) {
  if (G.mode !== 'play' || !getSettings().autoResolution) { perfT = 0; perfFrames = 0; return; }
  perfT += dt; perfFrames++;
  if (perfT < 3) return;
  const fps = perfFrames / perfT;
  perfT = 0; perfFrames = 0;
  if (fps < 26 && autoScale > 0.55) {
    autoScale = Math.max(0.55, autoScale - 0.12);
    renderer.setPixelRatio(pixelRatio());
    post.build();
    if (!perfWarned) { perfWarned = true; ui.toast('⚙️ Lowered render resolution for smoother play (Settings → Quality to change).', 4500); }
  } else if (fps > 58 && autoScale < 1) {
    autoScale = Math.min(1, autoScale + 0.06);
    renderer.setPixelRatio(pixelRatio());
    post.build();
  }
}

// ---------------------------------------------------------------- boot
const tips = [
  'Tip: you are 1.8 centimetres tall. Everything in your house is life-size. Plan accordingly.',
  'Tip: crouching makes you quieter. Biscuit is a light sleeper.',
  'Tip: at your size, falling is slow. Landing on something soft is still a good idea.',
  'Tip: shade is life outside. The sun hits different when you are pocket sized.',
  'Tip: hold Space to skip cutscenes you have already seen.',
  'Tip: something big lives deep inside the bush.',
];
ui.setTip(tips[Math.floor(Math.random() * tips.length)]);

// Handy for debugging from the browser console.
window.PocketSize = {
  G, Story,
  view(x, y, z, lx, ly, lz, fov = 60) {
    G.mode = 'debug';
    camera.position.set(x, y, z); camera.lookAt(lx, ly, lz);
    camera.fov = fov; camera.updateProjectionMatrix();
    G.post.focus = Math.hypot(lx - x, ly - y, lz - z); G.post.dofOverride = null;
    document.getElementById('menu').classList.add('hidden');
  },
};

async function boot() {
  try {
    await Story.init((p, text) => ui.loading(p, text));
    ui.loading(1, 'Ready');
    await ui.wait(250);
    ui.hideLoading();
    showMenu();
    requestAnimationFrame(frame);
    // Warm up shaders so the first real frame doesn't hitch.
    try { renderer.compile(G.level.scene, camera); } catch (e) { /* ignore */ }
  } catch (e) {
    console.error(e);
    ui.loading(1, 'Something went wrong while building the world: ' + e.message);
  }
}
boot();
