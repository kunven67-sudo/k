// Hidden engine window: plays typing sounds and music, and draws cursor files.
// It stays alive while the main window is closed to the tray.
import { SOUND_PACKS, PACK_MAP, renderPack } from '../../shared/sound-packs.mjs';
import { TRACKS, TRACK_MAP, MusicPlayer, trackDuration } from '../../shared/music-tracks.mjs';
import { buildFrames, resolveDef, customToDef } from '../../shared/cursor-render.mjs';
import { encodeCur, encodeAni } from '../../shared/cur-encoder.mjs';

const E = window.engine;
const ctx = new AudioContext({ latencyHint: 'interactive' });
const sfxGain = ctx.createGain();
sfxGain.connect(ctx.destination);
const musicGain = ctx.createGain();
musicGain.connect(ctx.destination);

let settings = null;
let myCursors = [];
const customDefs = new Map();

// ------------------------------------------------------------ typing sounds

let packBuffers = null;
let packId = null;
let packLoading = null;

async function decodeMedia(rel) {
  const res = await fetch(`cv://media/${rel.split('/').map(encodeURIComponent).join('/')}`);
  if (!res.ok) throw new Error(`missing sound ${rel}`);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

async function loadCustomPack(custom) {
  const out = { key: [], space: [], enter: [], backspace: [], up: [], mouse: [] };
  for (const rel of custom.key || []) {
    try { out.key.push(await decodeMedia(rel)); } catch (err) { E.log(err.message); }
  }
  for (const role of ['space', 'enter', 'backspace']) {
    if (custom[role]) { try { out[role].push(await decodeMedia(custom[role])); } catch (err) { E.log(err.message); } }
  }
  if (!out.key.length) return renderPack(PACK_MAP.get('mech-blue'));
  for (const role of ['space', 'enter', 'backspace', 'mouse']) if (!out[role].length) out[role] = out.key;
  out.up = [];
  return out;
}

function ensurePack() {
  const s = settings?.sounds;
  if (!s) return;
  const key = s.pack === 'custom' ? `custom:${JSON.stringify(s.custom)}` : s.pack;
  if (key === packId) return;
  packId = key;
  const p = s.pack === 'custom' ? loadCustomPack(s.custom) : renderPack(PACK_MAP.get(s.pack) || SOUND_PACKS[0]);
  packLoading = p;
  p.then((bufs) => { if (packLoading === p) packBuffers = bufs; }).catch((err) => E.log(`pack failed: ${err.message}`));
}

function play(role) {
  if (!packBuffers || !settings) return;
  if (ctx.state === 'suspended') ctx.resume();
  const list = packBuffers[role]?.length ? packBuffers[role] : packBuffers.key;
  if (!list?.length) return;
  const buf = list[Math.floor(Math.random() * list.length)];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const v = Number(settings.sounds.pitchVariation) || 0;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * v;
  src.connect(sfxGain);
  src.start();
}

E.onKey((kind) => play(kind === 'modifier' ? 'key' : kind));
E.onKeyUp(() => { if (packBuffers?.up?.length) play('up'); });
E.onMouse(() => play('mouse'));

// ------------------------------------------------------------ music

const player = new MusicPlayer(ctx, musicGain);
const audioEl = new Audio();
audioEl.preload = 'auto';
let current = null;       // { id, name, genre, user }
let playing = false;
let shuffleBag = [];
let stateTimer = null;

function allTracks() {
  const user = (settings?.music.userTracks || []).map((t) => ({ id: t.id, name: t.name, genre: 'mine', user: true, file: t.file }));
  return [...TRACKS.map((t) => ({ id: t.id, name: t.name, genre: t.genre })), ...user];
}

function findTrack(id) {
  return allTracks().find((t) => t.id === id) || null;
}

function sendState() {
  const pos = current?.user ? audioEl.currentTime || 0 : player.position;
  const dur = current?.user ? (Number.isFinite(audioEl.duration) ? audioEl.duration : 0) : (current ? trackDuration(TRACK_MAP.get(current.id)) : 0);
  E.musicState({ playing, track: current?.id || null, name: current?.name || '', genre: current?.genre || '', position: pos, duration: dur });
}

function startTimer() {
  clearInterval(stateTimer);
  stateTimer = setInterval(sendState, 1000);
}

function stopAll() {
  player.stop(0.3);
  audioEl.pause();
}

async function startTrack(t) {
  stopAll();
  current = t;
  if (!t) { playing = false; sendState(); return; }
  if (ctx.state === 'suspended') await ctx.resume();
  if (t.user) {
    audioEl.src = `cv://media/${t.file.split('/').map(encodeURIComponent).join('/')}`;
    audioEl.volume = settings.music.volume;
    try { await audioEl.play(); } catch (err) { E.log(`could not play ${t.name}: ${err.message}`); playing = false; sendState(); return; }
  } else {
    player.play(TRACK_MAP.get(t.id));
  }
  playing = true;
  startTimer();
  sendState();
}

function nextTrack(dir = 1, auto = false) {
  const list = allTracks();
  if (!list.length) return;
  const m = settings.music;
  if (auto && m.repeat === 'one' && current) { startTrack(current); return; }
  let next;
  if (m.shuffle) {
    if (!shuffleBag.length) shuffleBag = list.map((t) => t.id).filter((id) => id !== current?.id).sort(() => Math.random() - 0.5);
    next = findTrack(shuffleBag.shift()) || list[0];
  } else {
    const i = Math.max(0, list.findIndex((t) => t.id === current?.id));
    const j = i + dir;
    if (auto && m.repeat === 'off' && j >= list.length) { playing = false; current = null; sendState(); return; }
    next = list[(j + list.length) % list.length];
  }
  startTrack(next);
}

player.onEnd = () => nextTrack(1, true);
audioEl.addEventListener('ended', () => nextTrack(1, true));
audioEl.addEventListener('error', () => { if (current?.user) { E.log(`bad audio file ${current.name}`); nextTrack(1, true); } });

E.onMusic((cmd) => {
  const m = settings?.music;
  if (!m) return;
  switch (cmd.action) {
    case 'play': if (!playing) startTrack(current || findTrack(m.track) || allTracks()[0]); break;
    case 'pause': stopAll(); playing = false; sendState(); break;
    case 'toggle': if (playing) { stopAll(); playing = false; sendState(); } else startTrack(current || findTrack(m.track) || allTracks()[0]); break;
    case 'next': nextTrack(1); break;
    case 'prev':
      if ((current?.user ? audioEl.currentTime : player.position) > 4 && current) startTrack(current);
      else nextTrack(-1);
      break;
    case 'select': {
      const t = findTrack(cmd.track);
      if (t) { if (cmd.play === false) { current = t; sendState(); } else startTrack(t); }
      break;
    }
    case 'seek':
      if (current?.user && Number.isFinite(cmd.to)) audioEl.currentTime = cmd.to;
      break;
    default: break;
  }
});

// ------------------------------------------------------------ cursor building

async function refreshCustomDefs() {
  customDefs.clear();
  for (const rec of myCursors) {
    try { customDefs.set(rec.id, await customToDef(rec)); } catch (err) { E.log(`custom cursor ${rec.name} failed: ${err.message}`); }
  }
}

let customReady = Promise.resolve();

E.onBuild(async ({ reqId, cursor, scale }) => {
  try {
    await customReady;
    const def = resolveDef(cursor.id, customDefs);
    const S = Math.max(16, Math.min(256, Math.round((Number(cursor.size) || 32) * (scale || 1))));
    const variants = ['normal'];
    if (cursor.replace?.link && cursor.linkBadge !== false) variants.push('link');
    if (cursor.replace?.busy) variants.push('busy');
    const files = {};
    for (const v of variants) {
      const { frames, hotspot, fps } = buildFrames(def, cursor, S, v);
      files[v] = frames.length > 1
        ? { ext: 'ani', bytes: encodeAni(frames, hotspot, fps, def.name) }
        : { ext: 'cur', bytes: encodeCur(frames[0], hotspot) };
    }
    E.cursorBuilt({ reqId, files, size: S });
  } catch (err) {
    E.cursorBuilt({ reqId, error: err.message || String(err) });
  }
});

E.onMyCursors((list) => {
  myCursors = list || [];
  customReady = refreshCustomDefs();
});

E.onSettings((s) => {
  const first = !settings;
  settings = s;
  sfxGain.gain.value = s.sounds.volume;
  musicGain.gain.value = s.music.volume;
  audioEl.volume = Math.max(0, Math.min(1, s.music.volume));
  ensurePack();
  if (first && !current) { current = findTrack(s.music.track); sendState(); }
  // a removed user track that is playing
  if (current?.user && !findTrack(current.id)) { stopAll(); playing = false; current = null; sendState(); }
});

E.ready();
