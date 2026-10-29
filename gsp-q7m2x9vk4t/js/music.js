/* Home screen music.
   - The console music of the home style (or the one you picked in Settings) loops quietly underneath.
   - About a second after you land on a game that has its own song, that song fades in instead (PS5-style).
     Moving away fades back to the console music.
   - Starting a game pauses everything; coming back fades it in again.
   - Your own songs (Documents\Game System 3\Music): one on repeat, or all of them shuffled, each leveled
     to about as loud as the console music. */
let base = null;      /* track id of the console music ('music-wii', 'own:song.mp3', 'own:*'), or null */
let own = [];         /* your own songs: { name, gain } */
let shuffle = [];     /* 'own:*' play order */
let shufAt = 0;
let wanted = null;    /* the picked game's own song url, or null */
let cur = null;       /* { el, url } what is playing */
let timer = null;
let gameSongs = true;
let vol = 0.35;
let paused = false;
let asleep = false;   /* Game System 3 isn't the window you're using */
const resumeAt = {};  /* console music picks up where it left off (like a real PS5), not from the start every time */

function fade(el, to, ms, done) {
  const from = el.volume;
  const t0 = performance.now();
  if (el._fade) cancelAnimationFrame(el._fade);
  function step(t) {
    const k = Math.min(1, (t - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) el._fade = requestAnimationFrame(step);
    else { el._fade = null; if (done) done(); }
  }
  el._fade = requestAnimationFrame(step);
}

function stopCurrent(ms) {
  if (!cur) return;
  const el = cur.el;
  if (!cur.game && cur.url.indexOf('preview:') !== 0 && el.currentTime > 0) resumeAt[cur.url] = el.currentTime;
  cur = null;
  fade(el, 0, ms || 700, function () { el.pause(); el.removeAttribute('src'); el.load(); });
}

function ownUrl(name) { return 'gs3://music/' + encodeURIComponent(name); }
function gainOf(name) { const s = own.find(function (x) { return x.name === name; }); return s && s.gain ? s.gain : 1; }
function reshuffle() {
  shuffle = own.map(function (s) { return s.name; });
  for (let i = shuffle.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = shuffle[i]; shuffle[i] = shuffle[j]; shuffle[j] = t; }
  shufAt = 0;
}
function trackFor(id) {
  if (!id) return null;
  if (id === 'own:*') {
    if (!own.length) return null;
    if (!shuffle.length) reshuffle();
    const n = shuffle[shufAt % shuffle.length];
    return { url: ownUrl(n), gain: gainOf(n), next: true };
  }
  if (id.indexOf('own:') === 0) {
    const n = id.slice(4);
    return own.some(function (s) { return s.name === n; }) ? { url: ownUrl(n), gain: gainOf(n) } : null;
  }
  return { url: 'sounds/' + id + '.ogg', gain: 1 };
}
function level(c) { return Math.min(1, vol * (c && c.gain ? c.gain : 1)); }

function target() {
  if (gameSongs && wanted) return { url: wanted, game: true, gain: 1 };
  const t = trackFor(base);
  if (t) t.game = false;
  return t;
}

function start() {
  if (paused || asleep) return;
  const t = target();
  if (!t) { stopCurrent(700); return; }
  if (cur && cur.url === t.url) {
    if (cur.el.paused) { cur.el.play().catch(function () {}); }
    fade(cur.el, level(cur), 900);
    return;
  }
  stopCurrent(800);
  const el = new Audio();
  el.src = t.url;
  /* shuffled own songs: one after another instead of looping one */
  el.loop = !t.next;
  if (t.next) {
    el.addEventListener('ended', function () {
      if (!cur || cur.el !== el) return;
      shufAt++;
      if (shufAt >= shuffle.length) reshuffle();
      cur = null;
      start();
    });
  }
  el.volume = 0;
  el.preload = 'auto';
  if (t.game) {
    /* start a little into the song, menus usually skip the quiet intro */
    el.addEventListener('loadedmetadata', function () {
      if (el.duration > 40) { try { el.currentTime = Math.min(el.duration * 0.12, 18); } catch (e) { /* not seekable */ } }
    }, { once: true });
  } else if (resumeAt[t.url]) {
    const at = resumeAt[t.url];
    el.addEventListener('loadedmetadata', function () {
      try { el.currentTime = at < el.duration - 1 ? at : 0; } catch (e) { /* not seekable */ }
    }, { once: true });
  }
  const c = { el: el, url: t.url, game: !!t.game, gain: t.gain };
  el.play().then(function () { fade(el, level(c), t.game ? 1500 : 2200); }).catch(function () {});
  cur = c;
}

function soon(ms) {
  clearTimeout(timer);
  timer = setTimeout(start, ms);
}

export const Music = {
  /* the picked game's own song (or null) */
  want(url) {
    url = url || null;
    if (url === wanted) return;
    wanted = url;
    soon(1000);
  },
  /* the console music under everything (track id or null) */
  setBase(id) {
    id = id || null;
    if (id === base) return;
    base = id;
    soon(200);
  },
  /* your own songs changed (added some, or they were leveled) */
  setOwn(list) {
    const before = own.map(function (s) { return s.name; }).join('|');
    own = (list || []).slice();
    if (own.map(function (s) { return s.name; }).join('|') !== before) shuffle = [];
    if (cur && cur.url.indexOf('gs3://music/') === 0) {
      const n = decodeURIComponent(cur.url.slice('gs3://music/'.length));
      cur.gain = gainOf(n);
      fade(cur.el, level(cur), 400);
    }
    if (base && base.indexOf('own:') === 0) soon(200);
  },
  set(songsOn, volume) {
    gameSongs = !!songsOn;
    vol = typeof volume === 'number' ? volume : vol;
    if (cur) fade(cur.el, level(cur), 300);
    soon(150);
  },
  pause() {
    paused = true;
    clearTimeout(timer);
    if (cur) { const el = cur.el; fade(el, 0, 350, function () { el.pause(); }); }
  },
  resume() {
    paused = false;
    soon(700);
  },
  /* the window isn't in use: fade out and stop (no music and no CPU behind other apps), back when it is */
  sleep(v) {
    v = !!v;
    if (v === asleep) return;
    asleep = v;
    if (v) { clearTimeout(timer); if (cur) { const el = cur.el; fade(el, 0, 500, function () { if (asleep) el.pause(); }); } }
    else soon(300);
  },
  /* preview a track in Settings */
  preview(id) {
    clearTimeout(timer);
    stopCurrent(300);
    const t = trackFor(id);
    if (!t) { soon(600); return; }
    const el = new Audio(t.url);
    el.loop = true;
    el.volume = 0;
    const c = { el: el, url: 'preview:' + id, gain: t.gain };
    el.play().then(function () { fade(el, level(c), 600); }).catch(function () {});
    cur = c;
  },
  endPreview() { if (cur && cur.url.indexOf('preview:') === 0) stopCurrent(400); soon(600); }
};
