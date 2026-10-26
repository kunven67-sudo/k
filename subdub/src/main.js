// SUBDUB app: setup -> home -> watch a file (prepared ahead, synced) or watch live (a tab, app window or screen).
import { h, $, icon, fmtTime, fmtMB, toast } from './ui/dom.js';
import { mountLogo } from './ui/logo.js';
import { castPanel } from './ui/castpanel.js';
import { loadSettings, saveSettings, openSettings } from './ui/settings.js';
import { Engine, detectGpu } from './engine/engine.js';
import { MODELS } from './engine/models.js';
import { modelCache } from './engine/cache.js';
import { Cast, showKeyFrom, kv } from './engine/cast.js';
import { Translate } from './engine/translate.js';
import { FileDub, PIECE } from './engine/filedub.js';
import { DubPlayer } from './engine/player.js';
import { LiveDub } from './engine/live.js';
import { SubWatch } from './engine/subwatch.js';
import { SyncedLive } from './engine/synced.js';
import { readSubtitleTracks } from './engine/media.js';

const S = loadSettings();
const engine = new Engine('./');
engine.settings = S;
const main = $('#main');
let translate = null;
let current = null;         // active screen controller (has .close())
const SETUP_KEY = 'subdub-setup-done-v1';
const BASIC_LANGS = ['ja', 'ko', 'zh', 'es', 'pt'];

mountLogo($('#logo'));
$('#logo').addEventListener('click', () => goHome());
$('#btnSettings').addEventListener('click', () => openSettings(S, {
  gpuInfo: engine.gpu?.ok ? `Using: ${engine.gpu.name || 'your graphics card'}` : 'Not available in this browser right now (using the processor)',
  onChange: (k) => { current?.settingsChanged?.(k); },
  onClearDownloads: async () => { await modelCache.clear(); localStorage.removeItem(SETUP_KEY); toast('Deleted. SUBDUB will download them again next time.'); },
}));

function setStatus(text, kind = '') {
  const el = $('#status');
  el.querySelector('.dot').className = 'dot ' + kind;
  el.querySelector('span').textContent = text;
}

// ---------- start ----------
(async () => {
  const gpu = await detectGpu();
  engine.gpu = gpu;
  if (!self.crossOriginIsolated) console.info('SUBDUB: not cross-origin isolated, brains run on one CPU core');
  const done = localStorage.getItem(SETUP_KEY) && await modelCache.has(MODELS.vad.url);
  if (!done) showSetup(); else { setStatus('Ready', 'ok'); goHome(); }
})();

function getTranslate() { translate ??= new Translate({ call: async (m, a) => (await engine.start('asr')).call(m, a) }); return translate; }

// ---------- setup ----------
const PARTS = [
  { key: 'listen', label: 'Voice finder + girl/boy ears', match: /silero|gender|wespeaker/i },
  { key: 'asr', label: 'Speech reader (understands the talking)', match: /whisper/i },
  { key: 'tts', label: 'English voices', match: /kokoro|voices\//i },
  { key: 'sep', label: 'Voice cutter (keeps music + effects)', match: /spleeter|vocals|accompaniment|uvr/i },
  { key: 'eyes', label: 'Subtitle reader', match: /ocr|PP-OCR/i },
  { key: 'tr', label: 'Translator (built into your browser)', match: /^translator:/ },
  { key: 'rt', label: 'Brain runtime', match: /onnxruntime|ort-wasm/i },
];
function showSetup() {
  close();
  setStatus('Needs setup', 'busy');
  const gpu = engine.gpu;
  const mb = Engine.setupSizeMB(gpu?.ok);
  const bars = {};
  const parts = h('div', { class: 'parts' }, PARTS.map(p => { const bar = h('div', { class: 'bar' }, h('i')); bars[p.key] = { bar, size: h('span', { class: 'size' }, '') }; return h('div', { class: 'part' }, h('span', { class: 'name' }, p.label), bars[p.key].size, bar); }));
  const btn = h('button', { class: 'bigbtn', onclick: () => run() }, `Get SUBDUB ready (about ${mb} MB, one time)`);
  const note = h('p', {}, '');
  const el = h('div', { class: 'setup screen' },
    h('h1', {}, 'Let\'s get SUBDUB ready'),
    h('p', {}, 'SUBDUB runs on your own PC: it listens, translates and talks without sending your shows anywhere. It needs to download its brains once. After that it opens fast and works offline.'),
    h('div', { class: 'hw' },
      h('span', { class: 'chip' }, h('i', { class: 'dot ' + (gpu?.ok ? 'ok' : 'busy') }), gpu?.ok ? `Graphics card: ${gpu.name || 'found'}` : 'Graphics card: not available, will use the processor'),
      h('span', { class: 'chip' }, h('i', { class: 'dot ' + (self.crossOriginIsolated ? 'ok' : 'busy') }), self.crossOriginIsolated ? `${navigator.hardwareConcurrency || '?'} CPU cores` : '1 CPU core (open it from the install link for full speed)'),
      h('span', { class: 'chip' }, h('i', { class: 'dot ' + (typeof self.Translator !== 'undefined' ? 'ok' : 'busy') }), typeof self.Translator !== 'undefined' ? 'Built-in translator found' : 'Using backup translator')),
    parts, btn, note);
  main.append(el);
  current = { close: () => el.remove() };
  // map download progress to the parts
  const files = new Map();
  engine.addEventListener('progress', function onP() {
    if (!el.isConnected) { engine.removeEventListener('progress', onP); return; }
    for (const [url, f] of engine.dl) files.set(url, f);
    const agg = {};
    for (const [url, f] of files) {
      const p = PARTS.find(p => p.match.test(url)) || PARTS.at(-1);
      agg[p.key] ??= { loaded: 0, total: 0 };
      agg[p.key].loaded += f.loaded; agg[p.key].total += Math.max(f.total, f.loaded);
    }
    for (const [k, a] of Object.entries(agg)) {
      const b = bars[k]; if (!b) continue;
      b.bar.firstChild.style.width = (a.total ? 100 * a.loaded / a.total : 0) + '%';
      b.size.textContent = `${fmtMB(a.loaded)} / ${fmtMB(a.total)}`;
    }
  });
  async function run() {
    btn.disabled = true; btn.textContent = 'Downloading…';
    setStatus('Setting up', 'busy');
    // the browser's own translator needs this click to download its language packs
    const tr = getTranslate();
    const trDone = tr.prepare(BASIC_LANGS, (p) => { bars.tr.bar.firstChild.style.width = Math.round(p.loaded * 100) + '%'; }).then((st) => {
      const builtin = Object.values(st).filter(v => v === 'builtin').length;
      bars.tr.bar.classList.add('done'); bars.tr.bar.firstChild.style.width = '100%';
      bars.tr.size.textContent = builtin ? `${builtin} languages built in` : 'backup translator';
    });
    try {
      await engine.start('listen'); done('listen');
      await Promise.all([
        engine.start('asr').then(a => a.call('load', { tier: S.liveModel })).then(() => done('asr')),
        engine.start('tts').then(() => done('tts')),
        engine.start('sep').then(() => done('sep')),
        engine.start('eyes').then(() => done('eyes')),
      ]);
      await Promise.race([trDone, new Promise(r => setTimeout(r, 20000))]);
      done('rt');
      localStorage.setItem(SETUP_KEY, '1');
      setStatus('Ready', 'ok');
      toast('SUBDUB is ready.');
      goHome();
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = 'Try again';
      note.textContent = 'Something went wrong while downloading: ' + e.message + '. Check the internet and press Try again (it continues where it stopped).';
      setStatus('Setup failed', 'bad');
    }
  }
  function done(k) { bars[k].bar.classList.add('done'); bars[k].bar.firstChild.style.width = '100%'; }
}

// ---------- home ----------
function close() { current?.close?.(); current = null; main.textContent = ''; $('#btnCast').hidden = true; }
function goHome() {
  close();
  const fileInput = h('input', { type: 'file', accept: 'video/*,audio/*,.mkv,.webm,.mp4,.avi,.mov,.ts,.m2ts', hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) openFile(f); } });
  const fileTile = h('div', { class: 'tile file', role: 'button', tabindex: 0 },
    tileArt('file'),
    h('div', { class: 'subtitle-demo' }, 'あの…'),
    h('h2', {}, 'Open an episode'),
    h('p', {}, 'A video on your PC. SUBDUB gets it ready a little ahead of you, so every English line lands right on the mouth. Drop it here or pick it.'),
    h('button', { class: 'go', onclick: () => fileInput.click() }, icon('file'), 'Pick a video'), fileInput);
  for (const ev of ['dragenter', 'dragover']) fileTile.addEventListener(ev, (e) => { e.preventDefault(); fileTile.classList.add('drag'); });
  for (const ev of ['dragleave', 'drop']) fileTile.addEventListener(ev, () => fileTile.classList.remove('drag'));
  fileTile.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f); });
  const el = h('div', { class: 'home screen' },
    h('div', { class: 'hero' },
      h('h1', {}, 'Any language in, ', h('em', {}, 'English'), ' out.'),
      h('p', {}, 'SUBDUB reads subtitles you can\'t read and turns foreign talking into English, with a girl voice for girls and a boy voice for boys. Their real voices get cut out, the music stays.')),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile live' },
        tileArt('tv'),
        h('div', { class: 'subtitle-demo' }, '¿Qué pasó?'),
        h('h2', {}, 'Watch live'),
        h('p', {}, 'An anime site, an app, or your phone\'s screen on the PC. Pick it and SUBDUB dubs it while you watch (English is about 2 seconds behind).'),
        h('button', { class: 'go', onclick: () => startLive() }, icon('tv'), 'Pick what to dub')),
      fileTile),
    h('div', { class: 'notes' },
      h('div', { class: 'note' }, h('b', {}, 'Tip: pick the browser tab'), 'When the anime is in a browser tab, pick that tab and keep "Share tab audio" on. Then you only hear English.'),
      h('div', { class: 'note' }, h('b', {}, 'Boy with a girl voice?'), 'Lots of anime boys are voiced by women. Open Characters and tap Boy once, SUBDUB remembers it for that show.'),
      h('div', { class: 'note' }, h('b', {}, 'English stays English'), 'Lines already in English, screams and laughs keep the real voice. English subtitles are left alone.')));
  main.append(el);
  current = { close: () => el.remove() };
}
function tileArt(kind) {
  const s = icon(kind); s.setAttribute('width', '150'); s.setAttribute('height', '150'); s.style.color = kind === 'tv' ? '#2a2a12' : '#22222e'; s.setAttribute('stroke-width', '1.2');
  return h('div', { class: 'art' }, s);
}

// ---------- characters drawer (header button) ----------
function showCastButton(cast) {
  const b = $('#btnCast');
  b.hidden = false;
  b.onclick = () => current?.showCast?.();
}

// ---------- file mode ----------
async function openFile(file) {
  close();
  setStatus('Opening video', 'busy');
  const cast = new Cast(showKeyFrom(file.name));
  await cast.load().catch(() => {});
  const video = h('video', { playsinline: true, preload: 'auto' });
  const caps = h('div', { class: 'caps', style: { '--capsize': S.capSize + 'px' } });
  const waitBox = h('div', { class: 'box' }, h('div', {}, 'Getting the English ready…'), h('div', { class: 'time', style: { marginTop: '6px' } }, ''));
  const wait = h('div', { class: 'wait' }, waitBox);
  const ready = h('div', { class: 'ready' }), played = h('div', { class: 'played' }), knob = h('div', { class: 'knob' });
  const seek = h('div', { class: 'seek', role: 'slider', 'aria-label': 'Seek' }, h('div', { class: 'track' }), ready, played, knob);
  const playBtn = h('button', { 'aria-label': 'Play' }, icon('play'));
  const timeEl = h('span', { class: 'time' }, '0:00 / 0:00');
  const modeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Sound' });
  const controls = h('div', { class: 'controls' }, seek,
    h('div', { class: 'crow' }, playBtn,
      h('button', { 'aria-label': 'Back 10 seconds', onclick: () => (video.currentTime = Math.max(0, video.currentTime - 10)) }, icon('back10')),
      h('button', { 'aria-label': 'Forward 10 seconds', onclick: () => (video.currentTime = Math.min(video.duration, video.currentTime + 10)) }, icon('fwd10')),
      timeEl, h('span', { class: 'spacer', style: { flex: 1 } }), modeSeg,
      h('button', { 'aria-label': 'Fullscreen', onclick: () => document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen() }, icon('full'))));
  const covers = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  const stage = h('div', { class: 'stage' }, video, covers, caps, wait, controls);
  const tabCast = h('button', { class: 'on' }, 'Characters'), tabLines = h('button', {}, 'Lines');
  const body = h('div', { class: 'sidebody' });
  const prog = h('div', { class: 'prog' }, 'Opening…');
  const side = h('div', { class: 'side' }, h('div', { class: 'tabs' }, tabCast, tabLines), body, prog);
  const el = h('div', { class: 'player screen' }, stage, side);
  main.append(el);
  showCastButton(cast);

  const dub = new FileDub({ engine: {}, cast, translate: getTranslate(), settings: S });
  dub.screenSubs = [];
  let rl = null;
  const renderLinesSoon = () => { clearTimeout(rl); rl = setTimeout(renderLines, 300); };
  let player = null, watch = null, panel = null, closed = false;
  current = {
    close: () => { closed = true; dub.stop(); player?.destroy(); watch?.stop(); panel?.destroy?.(); URL.revokeObjectURL(video.src); el.remove(); cast.save().catch(() => {}); },
    showCast: () => showTab('cast'),
    settingsChanged: (k) => {
      caps.style.setProperty('--capsize', S.capSize + 'px');
      if (!player) return;
      player.applyVolumes();
      if (k === 'mode') { syncModeSeg(); video.muted = S.mode !== 'original'; player.markAllDirty(); }
    },
  };
  // side tabs
  const showTab = (t) => {
    tabCast.classList.toggle('on', t === 'cast'); tabLines.classList.toggle('on', t === 'lines');
    body.textContent = ''; panel?.destroy?.();
    if (t === 'cast') { panel = castPanel({ cast, engine, onVoiceChange: (c) => revoice(c) }); body.append(panel); }
    else renderLines();
  };
  tabCast.onclick = () => showTab('cast'); tabLines.onclick = () => showTab('lines');
  const renderLines = () => {
    if (!tabLines.classList.contains('on')) return;
    body.textContent = '';
    const list = dub.lines.filter(l => l.en || l.src);
    if (!list.length) body.append(h('div', { class: 'empty' }, 'Lines appear here as SUBDUB reads them.'));
    for (const l of list) {
      const c = cast.byId(l.charId);
      body.append(h('div', { class: 'lineitem', style: { '--c': c?.color }, onclick: () => (video.currentTime = l.s) },
        h('div', {}, h('b', {}, c?.name || ''), ' ', fmtTime(l.s), l.keep ? ` · kept real voice (${l.why})` : ''),
        h('div', {}, l.en || ''), h('div', { class: 'src' }, l.src)));
    }
  };
  showTab('cast');
  // re-voice all lines of a character (girl/boy flipped or voice picked)
  const revoice = async (c) => {
    for (const l of dub.lines) if (l.charId === c.id && !l.keep && l.en) { await dub.speakLine(l); dub.emit('line', l); }
  };
  // mode buttons
  const MODES = [['dub', 'Dub'], ['voiceover', 'Voice-over'], ['captions', 'Captions'], ['original', 'Off']];
  const syncModeSeg = () => { modeSeg.textContent = ''; for (const [v, l] of MODES) modeSeg.append(h('button', { class: S.mode === v ? 'on' : '', onclick: () => { S.mode = v; saveSettings(S); current.settingsChanged('mode'); } }, l)); };
  syncModeSeg();

  try {
    // picture: play the file directly (or a playable copy if the browser can't)
    const media = await readSubtitleTracks(file).catch(() => null);
    video.src = URL.createObjectURL(file);
    const playable = await new Promise((res) => { video.onloadedmetadata = () => res(true); video.onerror = () => res(false); setTimeout(() => res(video.readyState > 0), 8000); });
    if (!playable) throw new Error('This browser can\'t play this video file. Try an MP4 (H.264) or WebM version of it.');
    if (media?.english) { dub.subs = media.english; toast(`Using the video's English subtitles for the voices (${media.english.length} lines).`); }
    prog.textContent = 'Reading the sound…';
    await dub.load(file);
    // brains
    setStatus('Starting brains', 'busy');
    const [listen, asr, tts, sep] = await Promise.all(['listen', 'asr', 'tts', 'sep'].map(n => engine.start(n)));
    dub.e = { listen, asr, tts, sep };
    if (closed) return;
    player = new DubPlayer(video, dub, S);
    video.muted = S.mode !== 'original';
    // subtitles burned into the picture
    if (S.readSubs) {
      engine.start('eyes').then((eyes) => {
        if (closed) return;
        watch = new SubWatch({ eyes, translate: getTranslate(), video, clock: () => video.currentTime, settings: S });
        watch.addEventListener('sub', (e) => {
          const s = e.detail;
          if (s.lang === 'en' || !s.en) return;
          // seen this one before (watching a part again)? keep the old one
          if (dub.screenSubs.some(o => o.text === s.text && Math.abs(o.s - s.s) < 3)) return;
          s.isSub = true; dub.screenSubs.push(s);
        });
        watch.start();
      }).catch(() => {});
    }
    dub.addEventListener('progress', (e) => {
      const p = e.detail;
      ready.style.width = (100 * p.readyUntil / p.duration) + '%';
      prog.textContent = p.done >= p.total ? 'All done. The whole video is in English.' : `English ready up to ${fmtTime(p.readyUntil)} of ${fmtTime(p.duration)} (keeps going while you watch)`;
      waitBox.lastChild.textContent = `Ready up to ${fmtTime(p.readyUntil)}`;
    });
    dub.addEventListener('line', () => { renderLinesSoon(); });
    dub.addEventListener('error', (e) => toast('Problem: ' + (e.detail?.message || e.detail), true));
    player.addEventListener('waiting', () => { wait.hidden = false; });
    player.addEventListener('ready', () => { wait.hidden = true; });
    setStatus('Dubbing', 'busy');
    dub.run().then(() => setStatus('Done', 'ok')).catch(e => { if (!closed) { console.error(e); toast('Dubbing stopped: ' + e.message, true); setStatus('Problem', 'bad'); } });
    // start playing as soon as the first part is ready
    const first = () => dub.isReadyAt(0.5) ? (wait.hidden = true, video.play().catch(() => {})) : setTimeout(first, 400);
    first();
  } catch (e) {
    console.error(e);
    wait.hidden = false; waitBox.firstChild.textContent = e.message;
    setStatus('Problem', 'bad');
    return;
  }
  // controls
  playBtn.onclick = () => video.paused ? video.play() : video.pause();
  video.addEventListener('play', () => playBtn.replaceChildren(icon('pause')));
  video.addEventListener('pause', () => playBtn.replaceChildren(icon('play')));
  const seekTo = (e) => { const r = seek.getBoundingClientRect(); video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (video.duration || 0); };
  seek.addEventListener('pointerdown', (e) => { seekTo(e); seek.setPointerCapture(e.pointerId); seek.onpointermove = seekTo; });
  seek.addEventListener('pointerup', () => (seek.onpointermove = null));
  video.addEventListener('click', () => playBtn.click());
  const keys = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
    else if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 10);
    else if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen();
    else if (e.key === 'c' || e.key === 'C') { S.showCaps = !S.showCaps; saveSettings(S); }
    else if (e.key === 'd' || e.key === 'D') { S.mode = S.mode === 'original' ? 'dub' : 'original'; saveSettings(S); current.settingsChanged('mode'); toast(S.mode === 'dub' ? 'English dub on' : 'Original sound'); }
  };
  document.addEventListener('keydown', keys);
  const oldClose = current.close;
  current.close = () => { document.removeEventListener('keydown', keys); oldClose(); };
  // captions + seek bar
  const frame = () => {
    if (closed) return;
    const t = video.currentTime, d = video.duration || 1;
    played.style.width = (100 * t / d) + '%'; knob.style.left = (100 * t / d) + '%';
    timeEl.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    caps.textContent = ''; covers.textContent = '';
    if (S.showCaps && S.mode !== 'original' && player) {
      for (const l of player.captionsAt(t)) {
        if (l.isSub) {
          // a foreign subtitle burned into the picture: cover it with the English
          const r = stage.getBoundingClientRect(), vw = video.videoWidth, vh = video.videoHeight;
          const sc = Math.min(r.width / vw, r.height / vh), ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
          covers.append(h('div', { class: 'cover', style: { left: ox + (l.box.x - 0.02) * vw * sc + 'px', top: oy + (l.box.y - 0.01) * vh * sc + 'px', width: (l.box.w + 0.04) * vw * sc + 'px', minHeight: (l.box.h + 0.02) * vh * sc + 'px', fontSize: Math.max(16, l.box.h * vh * sc * 0.42) + 'px' } }, l.en));
        } else {
          const c = cast.byId(l.charId);
          caps.append(h('div', { class: 'cap' }, h('span', { class: 'who', style: { background: c?.color || '#fff' } }), l.en));
        }
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ---------- live mode ----------
async function startLive() {
  // ask what to share first (the browser needs the click for this)
  const cast = new Cast('live');
  const live = new LiveDub({ engine: {}, cast, translate: getTranslate(), settings: S, workletUrl: new URL('tap.worklet.js', location.href).href });
  let stream;
  try { stream = await live.start(); }
  catch (e) { if (e.name !== 'NotAllowedError') toast('Could not start: ' + e.message, true); return; }
  close();
  const showKey = showKeyFrom(live.title);
  cast.showKey = showKey; await cast.load().catch(() => {});
  setStatus('Starting brains', 'busy');
  const preview = h('video', { muted: true, playsinline: true, autoplay: true });
  preview.srcObject = stream; preview.muted = true; preview.play().catch(() => {});
  const feed = h('div', { class: 'feed', 'aria-live': 'polite' }, h('div', { class: 'empty' }, 'Listening. English lines show up here and you hear them.'));
  const light = (label) => { const d = h('i', { class: 'dot' }); return [h('span', {}, d, label), d]; };
  const [lHear, dHear] = light('Hearing'), [lTr, dTr] = light('Translating'), [lSay, dSay] = light('Speaking');
  const lag = h('span', {}, '');
  const warn = [];
  if (!live.hasAudio) warn.push(h('div', { class: 'warn' }, 'No sound was shared, so SUBDUB can only read subtitles. Stop and pick again with "Share audio" turned on.'));
  else if (!live.ownsSound) warn.push(h('div', { class: 'warn' }, live.surface === 'browser' ? '' : 'You picked a window or the whole screen: SUBDUB can\'t turn that app\'s own sound down, so the original voices stay under the English. Pick a browser tab instead for a full dub, or open the video file in SUBDUB.'));
  const btnBar = h('button', { class: 'iconbtn', onclick: () => openCaptionBar() }, icon('bar'), 'Caption bar');
  const btnSync = h('button', { class: 'iconbtn', onclick: () => toggleSynced(), disabled: !live.ownsSound, title: live.ownsSound ? 'Watch a few seconds behind live so the English lands on the mouths' : 'Synced needs a browser tab (then SUBDUB plays its sound). Apps and phone mirrors play their own sound.' }, icon('sync'), 'Synced window');
  const btnStop = h('button', { class: 'iconbtn', onclick: () => { live.stop(); goHome(); } }, icon('stop'), 'Stop');
  const castBody = h('div', { class: 'sidebody' });
  const el = h('div', { class: 'live screen' },
    h('div', { class: 'livebox' },
      h('div', { class: 'livehead' }, h('i', { class: 'dot ok' }), h('span', { class: 'what' }, live.title || 'Your pick'), h('span', { class: 'spacer', style: { flex: 1 } }), lag),
      ...warn.filter(w => w.textContent),
      h('div', { class: 'preview' }, preview),
      feed,
      h('div', { class: 'lights' }, lHear, lTr, lSay),
      h('div', { class: 'livebtns' }, btnBar, btnSync, btnStop)),
    h('div', { class: 'side livebox' }, h('div', { class: 'tabs' }, h('button', { class: 'on' }, 'Characters')), castBody));
  main.append(el);
  showCastButton(cast);
  let panel = castPanel({ cast, engine }); castBody.append(panel);
  let watch = null, pip = null, synced = null, closed = false;
  current = {
    close: () => { closed = true; live.stop(); watch?.stop(); synced?.close(); pip?.close(); panel.destroy?.(); el.remove(); cast.save().catch(() => {}); },
    showCast: () => castBody.scrollIntoView({ behavior: 'smooth' }),
    settingsChanged: () => { live.applySettings(); synced?.applySettings?.(); },
  };
  live.addEventListener('stopped', (e) => { if (!closed) { toast(e.detail.why === 'ended' ? 'Sharing stopped.' : 'Stopped.'); goHome(); } });
  live.addEventListener('error', (e) => console.warn(e.detail));
  live.addEventListener('hearing', (e) => { dHear.className = 'dot ' + (e.detail ? 'busy' : ''); });
  const addBubble = (b) => {
    feed.querySelector('.empty')?.remove();
    feed.append(b);
    while (feed.children.length > 60) feed.firstChild.remove();
    feed.scrollTop = feed.scrollHeight;
  };
  live.addEventListener('line', (e) => {
    const l = e.detail, c = cast.byId(l.charId);
    dTr.className = 'dot';
    if (l.keep && l.why !== 'english') return;
    addBubble(h('div', { class: 'bubble', style: { '--c': c?.color } }, h('span', { class: 'tag' }, `${c?.name || ''} · ${l.keep ? 'English' : l.lang}`), h('span', { class: 'en' }, l.en), l.keep ? null : h('span', { class: 'src' }, l.src)));
    pip?.show(l.en, c?.color);
  });
  live.addEventListener('speak', (e) => {
    dSay.className = 'dot ok'; setTimeout(() => (dSay.className = 'dot'), 1500);
    lag.textContent = `English ${(e.detail.lagMs / 1000).toFixed(1)}s behind`;
  });
  try {
    const [listen, asr, tts] = await Promise.all(['listen', 'asr', 'tts'].map(n => engine.start(n)));
    live.e = { listen, asr, tts };
    if (S.readSubs) {
      const eyes = await engine.start('eyes');
      watch = new SubWatch({ eyes, translate: getTranslate(), video: preview, clock: () => live.nowInput(), settings: S });
      watch.addEventListener('sub', (ev) => {
        const s = ev.detail;
        live.addSubtitle(s); synced?.addSubtitle(s);
        if (s.lang !== 'en' && s.en) { addBubble(h('div', { class: 'bubble sub' }, h('span', { class: 'tag' }, `Subtitle · ${s.lang}`), h('span', { class: 'en' }, s.en), h('span', { class: 'src' }, s.text))); pip?.show(s.en, null, true); }
      });
      watch.start();
    }
    setStatus('Live', 'ok');
  } catch (e) { toast('Brains failed to start: ' + e.message, true); setStatus('Problem', 'bad'); }

  // always-on-top caption bar (Picture-in-Picture window) you can put over the foreign subtitles
  async function openCaptionBar() {
    if (pip) { pip.close(); pip = null; return; }
    if (!('documentPictureInPicture' in window)) { toast('Your browser can\'t make a caption bar. Use Edge or Chrome.', true); return; }
    const w = await documentPictureInPicture.requestWindow({ width: 900, height: 150 });
    const st = w.document.createElement('style');
    st.textContent = `body{margin:0;background:#0b0b10;color:#fff;font:800 ${S.capSize}px/1.2 'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;text-align:center;padding:0 16px}
      .c{paint-order:stroke;-webkit-text-stroke:6px #000;text-shadow:0 2px 6px rgba(0,0,0,.6)} .c.s{color:#ffe14d} .d{display:inline-block;width:.45em;height:.45em;border-radius:50%;margin-right:.35em;vertical-align:.12em;border:2px solid #000;-webkit-text-stroke:0}`;
    w.document.head.append(st);
    const box = w.document.createElement('div'); box.className = 'c'; box.textContent = 'English captions show here. Drag this window over the subtitles.';
    w.document.body.append(box);
    let t = null;
    pip = {
      show(text, color, isSub) { box.className = 'c' + (isSub ? ' s' : ''); box.textContent = ''; if (color) { const d = w.document.createElement('span'); d.className = 'd'; d.style.background = color; box.append(d); } box.append(text); clearTimeout(t); t = setTimeout(() => (box.textContent = ''), 7000); },
      close() { w.close(); },
    };
    w.addEventListener('pagehide', () => { pip = null; btnBar.classList.remove('on'); });
  }
  // synced window: the anime plays inside SUBDUB a few seconds late so English lands on the mouths
  async function toggleSynced() {
    if (synced) { synced.close(); synced = null; live.setMuted?.(false); return; }
    try {
      const sep = await engine.start('sep');
      synced = new SyncedLive({ live, stream, sep, cast, settings: S, onClose: () => { synced = null; } });
      await synced.open();
    } catch (e) { toast('Synced window failed: ' + e.message, true); synced = null; }
  }
}

window.addEventListener('beforeunload', () => current?.close?.());
