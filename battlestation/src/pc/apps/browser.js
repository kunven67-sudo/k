import { Kit, TextBuf, clientCursor, scrollbar, FONT, MONO, font, fillRR, strokeRR, text, inside } from './kit.js';
import { para, icon } from '../gfx.js';

// A web browser with made-up websites. Everything that "needs internet" really checks the
// router: unplug the internet box and pages fail, videos buffer, the speed test dies.
const LOCAL = ['192.168.0.1', 'netlink.home', 'router.home'];
const SITES = {
  'searchly.com': { title: 'Searchly', page: homePage },
  'fastcheck.net': { title: 'FastCheck - Internet Speed Test', page: speedPage },
  'vidtube.com': { title: 'VidTube', page: videoPage },
  'news.today': { title: 'News Today', page: newsPage },
  'gamedrop.store': { title: 'GameDrop', page: storePage },
  '192.168.0.1': { title: 'NETLINK Router', page: routerPage },
};

export class Browser {
  static title = 'Browser'; static icon = 'browser'; static w = 1180; static h = 720; static minW = 520; static minH = 360; static exe = 'browser.exe';
  constructor(os, win, a) {
    this.os = os; this.win = win; this.kit = new Kit();
    this.brand = a.title || 'Browser';
    this.tabs = [];
    this.newTab('searchly.com');
    this.addr = null; // TextBuf while editing
    this.cpuLoad = 0.03;
    this.mem = 380;
  }
  get tab() { return this.tabs[this.ti]; }
  newTab(url) { this.tabs.push({ url: '', hist: [], fwd: [], page: null, load: 0, scroll: 0, state: {} }); this.ti = this.tabs.length - 1; this.go(url); }
  normalize(u) {
    u = u.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!u) return 'searchly.com';
    if (/\s/.test(u) || (!u.includes('.') && !LOCAL.includes(u))) return 'searchly.com/search?q=' + encodeURIComponent(u);
    if (LOCAL.includes(u)) return '192.168.0.1';
    return u;
  }
  go(url, push = true) {
    const t = this.tab;
    url = this.normalize(url);
    if (push && t.url) { t.hist.push(t.url); t.fwd = []; }
    t.url = url; t.scroll = 0; t.state = {}; t.page = null;
    const host = url.split('/')[0];
    const local = host === '192.168.0.1';
    const st = this.os.g.router.status(true);
    // how long the page takes depends on your real (in-game) connection
    const sp = this.os.g.router.speed(true);
    t.loadTime = local ? 0.35 : 0.35 + 400 / Math.max(20, sp.down) + sp.ping / 600;
    t.load = 0;
    t.error = null;
    if (!st.link) t.error = 'offline';
    else if (!local && !st.internet) t.error = st.state === 'connecting' ? 'dns' : 'offline';
    else if (local && !this.os.g.router.power) t.error = 'unreachable';
    else if (!SITES[host]) t.error = SITES[host] === undefined && !host.endsWith('.com') && !host.endsWith('.net') ? 'nxdomain' : null;
    this.os.g.router.touch(1);
    this.win.title = `${this.titleFor(t)} - ${this.brand}`;
  }
  titleFor(t) { const host = t.url.split('/')[0]; if (t.error) return host; return SITES[host]?.title || host; }
  update(dt) {
    let dirty = false;
    for (const t of this.tabs) {
      if (t.load < 1) { t.load = Math.min(1, t.load + dt / t.loadTime); dirty = true; }
      if (t.state.animate) dirty = true;
    }
    if (this.addr) dirty = true;
    this.cpuLoad = this.tab.state.video ? 0.12 : 0.03;
    this.gpuLoad = this.tab.state.video ? 0.08 : 0;
    return dirty;
  }
  draw(g, w, h) {
    this.kit.begin();
    const os = this.os, cur = clientCursor(os, this.win);
    // tab strip
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, w, h);
    const tw = Math.min(240, (w - 60) / this.tabs.length);
    this.tabs.forEach((t, k) => {
      const x = 8 + k * tw;
      fillRR(g, x, 6, tw - 4, 30, 6, k === this.ti ? '#2d2d2d' : inside(cur.x, cur.y, x, 6, tw - 4, 30) ? '#262626' : '#1b1b1b');
      g.drawImage(icon('browser', 16), x + 10, 13, 16, 16);
      font(g, 12); g.fillStyle = '#ddd'; text(g, t.load < 1 ? 'Loading…' : this.titleFor(t), x + 32, 26, tw - 64);
      g.fillStyle = '#999'; g.fillText('×', x + tw - 22, 26);
      this.kit.region(x, 6, tw - 30, 30, () => { this.ti = k; this.win.title = `${this.titleFor(this.tab)} - ${this.brand}`; });
      this.kit.region(x + tw - 30, 6, 26, 30, () => { if (this.tabs.length === 1) { this.os.close(this.win); return; } this.tabs.splice(k, 1); this.ti = Math.min(this.ti, this.tabs.length - 1); });
    });
    g.fillStyle = '#ccc'; font(g, 18); g.fillText('+', 16 + this.tabs.length * tw, 28);
    this.kit.region(8 + this.tabs.length * tw, 6, 30, 30, () => this.newTab('searchly.com'));
    // toolbar
    g.fillStyle = '#2d2d2d'; g.fillRect(0, 36, w, 42);
    const t = this.tab;
    const btn = (x, label, act, en = true) => { if (en && inside(cur.x, cur.y, x, 41, 32, 32)) fillRR(g, x, 41, 32, 32, 16, 'rgba(255,255,255,0.08)'); font(g, 16); g.fillStyle = en ? '#ddd' : '#666'; g.textAlign = 'center'; g.fillText(label, x + 16, 63); g.textAlign = 'left'; if (en) this.kit.region(x, 41, 32, 32, act); };
    btn(8, '←', () => { if (t.hist.length) { t.fwd.push(t.url); this.go(t.hist.pop(), false); } }, t.hist.length > 0);
    btn(42, '→', () => { if (t.fwd.length) { t.hist.push(t.url); this.go(t.fwd.pop(), false); } }, t.fwd.length > 0);
    btn(76, '↻', () => this.go(t.url, false));
    fillRR(g, 116, 42, w - 170, 30, 15, '#1c1c1c');
    if (this.addr) strokeRR(g, 116, 42, w - 170, 30, 15, '#4cc2ff', 1.5);
    font(g, 13); g.fillStyle = '#eee';
    const shown = this.addr ? this.addr.s : (t.url.startsWith('192.') ? t.url : 'https://' + t.url);
    text(g, shown, 134, 62, w - 210);
    if (this.addr && Math.floor(performance.now() / 500) % 2) g.fillRect(134 + g.measureText(this.addr.s.slice(0, this.addr.caret)).width, 49, 1.5, 17);
    this.kit.region(116, 42, w - 170, 30, () => { this.addr = new TextBuf(t.url); this.addr.anchor = 0; }, 'text');
    if (t.load < 1) { g.fillStyle = '#4cc2ff'; g.fillRect(0, 76, w * t.load, 2); }
    // page
    const top = 78;
    g.save(); g.beginPath(); g.rect(0, top, w, h - top); g.clip(); g.translate(0, top);
    const ph = h - top;
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, ph);
    if (t.load < 1 && !t.error) { /* blank while loading */ }
    else if (t.error) errorPage(this, g, w, ph, cur, top);
    else {
      const host = t.url.split('/')[0];
      const site = SITES[host];
      const kit = { region: (x, y, ww, hh, act, c) => this.kit.region(x, y + top - t.scroll, ww, hh, act, c) };
      const ctx = { b: this, os, t, g, w, h: ph, cur: { x: cur.x, y: cur.y - top + t.scroll }, top, kit };
      g.translate(0, -t.scroll);
      if (site) site.page(ctx); else genericPage(ctx);
      t.contentH = ctx.contentH || ph;
      g.translate(0, t.scroll);
      scrollbar(g, w - 9, 2, ph - 4, ph / Math.max(ph, t.contentH), t.scroll / Math.max(1, t.contentH - ph));
    }
    g.restore();
  }
  mouse(type, x, y) {
    if (type !== 'down' && type !== 'dbl') return;
    if (y > 78) this.addr = null;
    // page regions were registered in page space (scrolled)
    this.kit.click(x, y);
  }
  wheel(s) { const t = this.tab; t.scroll = Math.max(0, Math.min(Math.max(0, (t.contentH || 0) - (this.win.h - 110)), t.scroll + s * 60)); }
  key(e) {
    const t = this.tab;
    if (this.addr) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { const u = this.addr.s; this.addr = null; this.go(u); return; }
      if (e.code === 'Escape') { this.addr = null; return; }
      this.addr.key(e, this.os, false);
      return;
    }
    if ((e.ctrlKey && e.code === 'KeyL') || e.code === 'F6') { this.addr = new TextBuf(t.url); this.addr.anchor = 0; return; }
    if (e.ctrlKey && e.code === 'KeyT') { this.newTab('searchly.com'); return; }
    if (e.ctrlKey && e.code === 'KeyW') { if (this.tabs.length > 1) { this.tabs.splice(this.ti, 1); this.ti = Math.max(0, this.ti - 1); } else this.os.close(this.win); return; }
    if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyR')) { this.go(t.url, false); return; }
    if (e.altKey && e.code === 'ArrowLeft' && t.hist.length) { t.fwd.push(t.url); this.go(t.hist.pop(), false); return; }
    if (t.state.onKey) t.state.onKey(e);
  }
  cursor(x, y) { return this.kit.cursor(x, y); }
}

// ------------------------------------------------------------------ helpers for pages
function link(ctx, label, x, y, url, size = 14, col = '#1a0dab') {
  const g = ctx.g;
  font(g, size); g.fillStyle = col;
  const w = g.measureText(label).width;
  const hovd = inside(ctx.cur.x, ctx.cur.y, x, y - size, w, size + 4);
  g.fillText(label, x, y);
  if (hovd) g.fillRect(x, y + 2, w, 1);
  ctx.kit.region(x, y - size, w, size + 6, () => ctx.b.go(url), 'hand');
  return w;
}
function btn(ctx, x, y, w, h, label, act, col = '#1a73e8') {
  const g = ctx.g;
  const hv = inside(ctx.cur.x, ctx.cur.y, x, y, w, h);
  fillRR(g, x, y, w, h, h / 2, hv ? shade(col) : col);
  font(g, 14, 600); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h / 2 + 5); g.textAlign = 'left';
  ctx.kit.region(x, y, w, h, act, 'hand');
}
const shade = (c) => c === '#1a73e8' ? '#1765cc' : c;

function errorPage(b, g, w, h, cur, top) {
  const t = b.tab;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const x = Math.max(40, w / 2 - 300);
  // little unplugged-cable drawing
  g.strokeStyle = '#5f6368'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, 90); g.bezierCurveTo(x + 30, 60, x + 50, 110, x + 70, 80); g.stroke();
  fillRR(g, x + 68, 70, 26, 20, 3, '#5f6368'); g.fillStyle = '#fff'; g.fillRect(x + 72, 76, 4, 8); g.fillRect(x + 84, 76, 4, 8);
  font(g, 26, 400); g.fillStyle = '#202124';
  const titles = { offline: 'No internet', dns: 'Hmm, we can\'t reach this page.', unreachable: 'This site can\'t be reached', nxdomain: 'This site can\'t be reached' };
  g.fillText(titles[t.error], x, 160);
  font(g, 15); g.fillStyle = '#5f6368';
  if (t.error === 'offline') {
    g.fillText('Try:', x, 200);
    ['Checking the network cables, modem, and router', 'Reconnecting to Wi-Fi', 'Running Windows Network Diagnostics'].forEach((l, k) => g.fillText('•  ' + l, x + 16, 228 + k * 26));
    font(g, 12); g.fillText('ERR_INTERNET_DISCONNECTED', x, 330);
    font(g, 13); g.fillStyle = '#1a73e8'; g.fillText('Press Space to play CABLE RUNNER while you wait', x, 370);
    cableRunner(b, g, x, 390, Math.min(600, w - x - 40), 150);
  } else if (t.error === 'nxdomain') {
    g.fillText(`${t.url.split('/')[0]}'s server IP address could not be found.`, x, 200);
    font(g, 12); g.fillText('DNS_PROBE_FINISHED_NXDOMAIN', x, 240);
  } else {
    g.fillText(t.error === 'dns' ? 'The router is still connecting to your internet provider.' : 'The router isn\'t responding. Is it plugged in?', x, 200);
    font(g, 12); g.fillText(t.error === 'dns' ? 'DNS_PROBE_POSSIBLE' : 'ERR_CONNECTION_TIMED_OUT', x, 240);
  }
  void cur; void top;
}

// the offline dino-style game, but it's a little unplugged ethernet plug jumping over cable spools
function cableRunner(b, g, x, y, w, h) {
  const t = b.tab;
  const s = t.state.run || (t.state.run = { on: false, py: 0, vy: 0, obs: [], score: 0, speed: 260, dead: false, t: 0 });
  t.state.animate = true;
  t.state.onKey = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (!s.on || s.dead) Object.assign(s, { on: true, dead: false, obs: [], score: 0, speed: 260, py: 0, vy: 0 });
      else if (s.py === 0) s.vy = 520;
    }
  };
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - (s.last || now));
  s.last = now;
  if (s.on && !s.dead) {
    s.t += dt; s.score += dt * 10; s.speed += dt * 6;
    s.vy -= 1500 * dt; s.py = Math.max(0, s.py + s.vy * dt); if (s.py === 0) s.vy = Math.max(0, s.vy);
    for (const o of s.obs) o.x -= s.speed * dt;
    s.obs = s.obs.filter(o => o.x > -40);
    if (!s.obs.length || s.obs.at(-1).x < w - 180 - Math.random() * 300) s.obs.push({ x: w + 20, h: 18 + Math.random() * 22, wd: 16 + Math.random() * 14 });
    for (const o of s.obs) if (o.x < 60 && o.x + o.wd > 34 && s.py < o.h - 2) s.dead = true;
  }
  g.strokeStyle = '#5f6368'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + h - 10); g.lineTo(x + w, y + h - 10); g.stroke();
  // the plug
  const py = y + h - 10 - 26 - s.py;
  fillRR(g, x + 32, py, 28, 26, 4, '#535353'); g.fillStyle = '#fff'; g.fillRect(x + 54, py + 7, 4, 4);
  g.strokeStyle = '#535353'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 32, py + 13); g.quadraticCurveTo(x + 10, py + 30, x - 10, py + 24); g.stroke();
  for (const o of s.obs) { fillRR(g, x + o.x, y + h - 10 - o.h, o.wd, o.h, 3, '#535353'); g.fillStyle = '#888'; g.fillRect(x + o.x + 3, y + h - 10 - o.h + 4, o.wd - 6, 2); }
  font(g, 13, 600, MONO); g.fillStyle = '#535353'; g.textAlign = 'right'; g.fillText(String(Math.floor(s.score)).padStart(5, '0'), x + w, y + 14); g.textAlign = 'left';
  if (s.dead) { font(g, 15, 600); g.fillStyle = '#535353'; g.textAlign = 'center'; g.fillText('G A M E   O V E R', x + w / 2, y + 50); g.textAlign = 'left'; }
}

// ------------------------------------------------------------------ sites
function homePage(ctx) {
  const { g, w, t } = ctx;
  const q = decodeURIComponent((t.url.split('?q=')[1] || ''));
  if (t.url.includes('/search')) return searchPage(ctx, q);
  const cx = w / 2;
  font(g, 64, 700); g.textAlign = 'center';
  const word = 'Searchly', cols = ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853', '#ea4335', '#fbbc05', '#4285f4'];
  let x = cx - g.measureText(word).width / 2;
  g.textAlign = 'left';
  for (let k = 0; k < word.length; k++) { g.fillStyle = cols[k]; g.fillText(word[k], x, 190); x += g.measureText(word[k]).width; }
  fillRR(g, cx - 280, 230, 560, 46, 23, '#fff'); strokeRR(g, cx - 280, 230, 560, 46, 23, '#dfe1e5');
  font(g, 15); g.fillStyle = t.state.q ? '#202124' : '#9aa0a6';
  g.fillText(t.state.q !== undefined ? t.state.q + (Math.floor(performance.now() / 500) % 2 ? '|' : '') : 'Search the web or type a URL', cx - 250, 259);
  t.state.animate = t.state.q !== undefined;
  ctx.kit.region(cx - 280, 230, 560, 46, () => { t.state.q = t.state.q ?? ''; }, 'text');
  t.state.onKey = (e) => {
    if (t.state.q === undefined) t.state.q = '';
    if (e.code === 'Enter') ctx.b.go('searchly.com/search?q=' + encodeURIComponent(t.state.q));
    else if (e.code === 'Backspace') t.state.q = t.state.q.slice(0, -1);
    else if (e.key.length === 1 && !e.ctrlKey) t.state.q += e.key;
  };
  const tiles = [['FastCheck', 'fastcheck.net', '#0f9d58'], ['VidTube', 'vidtube.com', '#e62117'], ['News Today', 'news.today', '#1a73e8'], ['GameDrop', 'gamedrop.store', '#7b1fa2'], ['Router', '192.168.0.1', '#5f6368']];
  tiles.forEach(([n, u, c], k) => {
    const tx = cx - tiles.length * 60 + k * 120, ty = 320;
    const hv = inside(ctx.cur.x, ctx.cur.y, tx, ty, 100, 100);
    fillRR(g, tx, ty, 100, 100, 8, hv ? '#f1f3f4' : '#fff');
    g.fillStyle = c; g.beginPath(); g.arc(tx + 50, ty + 38, 22, 0, Math.PI * 2); g.fill();
    font(g, 18, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(n[0], tx + 50, ty + 45);
    font(g, 12); g.fillStyle = '#202124'; g.fillText(n, tx + 50, ty + 84); g.textAlign = 'left';
    ctx.kit.region(tx, ty, 100, 100, () => ctx.b.go(u), 'hand');
  });
}

function searchPage(ctx, q) {
  const { g, w } = ctx;
  font(g, 26, 700); g.fillStyle = '#4285f4'; g.fillText('Searchly', 30, 46);
  fillRR(g, 170, 20, Math.min(600, w - 200), 40, 20, '#fff'); strokeRR(g, 170, 20, Math.min(600, w - 200), 40, 20, '#dfe1e5');
  font(g, 15); g.fillStyle = '#202124'; g.fillText(q, 194, 46);
  g.fillStyle = '#ebebeb'; g.fillRect(0, 76, w, 1);
  const ql = q.toLowerCase();
  const known = [
    [/speed|internet|wifi|fast|ping/, 'fastcheck.net', 'FastCheck - Internet Speed Test', 'How fast is your internet? Test your download, upload and ping in seconds.'],
    [/video|watch|vid|music|lofi|funny/, 'vidtube.com', 'VidTube - Watch videos', 'Watch videos, music and live streams. Upload your own.'],
    [/news|today|weather/, 'news.today', 'News Today - Top stories', 'The latest headlines and local news.'],
    [/game|download|play|store/, 'gamedrop.store', 'GameDrop - PC games', 'Download games for your PC. Free and paid titles.'],
    [/router|192|admin|modem|netlink|password/, '192.168.0.1', 'NETLINK router setup (192.168.0.1)', 'Log in to your NETLINK router to change Wi-Fi settings, see devices and reboot.'],
  ];
  const res = known.filter(k => k[0].test(ql)).map(k => k.slice(1));
  const words = q.split(/\s+/).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  for (const [i, fmt] of [[0, 'What is %s? Everything you need to know'], [1, '%s - Wikipedia'], [2, 'The best %s guide (2026)'], [3, '10 things about %s nobody tells you']].entries()) {
    void i;
    const slug = words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'page';
    res.push([`${['wikipedia.org', 'howstuff.net', 'reddit.com', 'theguide.com'][res.length % 4]}/${slug}`, fmt.replace('%s', cap(q)), `${cap(q)}: ${['a quick explanation', 'history, facts and more', 'answers from people who know', 'tips, tricks and the full story'][res.length % 4]}.`]);
  }
  let y = 120;
  font(g, 13); g.fillStyle = '#70757a'; g.fillText(`About ${(Math.floor(q.length * 7919 + 13) * 1013 % 900000000 + 1000000).toLocaleString()} results (0.${(q.length * 37) % 90 + 10} seconds)`, 180, y - 10);
  for (const [u, title, desc] of res.slice(0, 8)) {
    font(g, 13); g.fillStyle = '#202124'; g.fillText(u.split('/')[0], 180, y + 18);
    link(ctx, title, 180, y + 44, u, 19);
    font(g, 14); g.fillStyle = '#4d5156'; text(g, desc, 180, y + 68, Math.min(640, w - 220));
    y += 104;
  }
  ctx.contentH = y + 40;
}

function genericPage(ctx) {
  const { g, w, t } = ctx;
  const host = t.url.split('/')[0];
  const topic = decodeURIComponent((t.url.split('/')[1] || host)).replace(/-/g, ' ');
  const T = topic.charAt(0).toUpperCase() + topic.slice(1);
  g.fillStyle = '#f8f9fa'; g.fillRect(0, 0, w, 60);
  font(g, 20, 700); g.fillStyle = '#202124'; g.fillText(host, 30, 38);
  const cw = Math.min(760, w - 80), x = (w - cw) / 2;
  font(g, 34, 700); g.fillStyle = '#202124'; g.fillText(T, x, 120);
  font(g, 16); g.fillStyle = '#3c4043';
  const text1 = `${T} is something a lot of people search for. This page has the basics: what it is, why people care about it, and where to learn more. ` +
    `If you're reading this inside BATTLESTATION, you're on a made-up website on a made-up internet that runs through the router next to your desk. Pull its power cable and this page won't load.`;
  let y = 170 + para(g, text1, x, 170, cw, 26);
  y += 20 + para(g, `People usually want to know three things about ${topic}: how it works, how much it costs, and whether it's worth it. The short answer is "it depends", which is the answer to almost everything on the internet.`, x, y + 20, cw, 26);
  ctx.contentH = y + 80;
}

function speedPage(ctx) {
  const { g, w, t, os } = ctx;
  const s = t.state.test || (t.state.test = { phase: 'idle', t: 0, ping: 0, down: 0, up: 0 });
  g.fillStyle = '#141526'; g.fillRect(0, 0, w, Math.max(ctx.h, 640));
  font(g, 22, 700); g.fillStyle = '#fff'; g.fillText('FastCheck', 30, 44);
  const cx = w / 2, cy = 300;
  const r = os.g.router;
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - (s.last || now)); s.last = now;
  if (s.phase !== 'idle' && s.phase !== 'done' && s.phase !== 'fail') {
    s.t += dt; t.state.animate = true; r.touch(2);
    const st = r.status(true);
    if (!st.internet) { s.phase = 'fail'; }
    const sp = r.speed(true);
    if (s.phase === 'ping' && s.t > 1.5) { s.ping = sp.ping; s.phase = 'down'; s.t = 0; }
    if (s.phase === 'down') { s.cur = sp.down * (0.8 + Math.random() * 0.25) * Math.min(1, s.t / 1.2); s.down = s.cur; if (s.t > 5) { s.phase = 'up'; s.t = 0; } }
    if (s.phase === 'up') { s.cur = sp.up * (0.8 + Math.random() * 0.25) * Math.min(1, s.t / 1.2); s.up = s.cur; if (s.t > 4) { s.phase = 'done'; s.cur = 0; } }
  } else t.state.animate = false;
  // gauge
  g.lineWidth = 18; g.lineCap = 'round';
  g.strokeStyle = '#2a2c45'; g.beginPath(); g.arc(cx, cy, 150, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  const val = s.phase === 'down' || s.phase === 'up' ? s.cur : 0;
  const frac = Math.min(1, Math.log10(1 + val) / Math.log10(1001));
  const grad = g.createLinearGradient(cx - 150, 0, cx + 150, 0); grad.addColorStop(0, '#2ee6d6'); grad.addColorStop(1, '#6c5cff');
  g.strokeStyle = grad; g.beginPath(); g.arc(cx, cy, 150, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * frac)); g.stroke();
  g.textAlign = 'center';
  if (s.phase === 'idle' || s.phase === 'done') {
    const hv = inside(ctx.cur.x, ctx.cur.y, cx - 70, cy - 70, 140, 140);
    g.lineWidth = 3; g.strokeStyle = hv ? '#6c5cff' : '#2ee6d6'; g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.stroke();
    font(g, 34, 700); g.fillStyle = '#fff'; g.fillText(s.phase === 'done' ? 'AGAIN' : 'GO', cx, cy + 12);
    ctx.kit.region(cx - 70, cy - 70, 140, 140, () => { Object.assign(s, { phase: 'ping', t: 0, ping: 0, down: 0, up: 0 }); }, 'hand');
  } else if (s.phase === 'fail') {
    font(g, 22, 700); g.fillStyle = '#ff6b6b'; g.fillText('Connection lost', cx, cy - 4);
    font(g, 14); g.fillStyle = '#aaa'; g.fillText('The test couldn\'t reach the server. Check your router.', cx, cy + 26);
    ctx.kit.region(cx - 150, cy - 60, 300, 120, () => { s.phase = 'idle'; }, 'hand');
  } else {
    font(g, 54, 700); g.fillStyle = '#fff'; g.fillText(s.phase === 'ping' ? '…' : val.toFixed(val > 100 ? 0 : 1), cx, cy + 16);
    font(g, 15); g.fillStyle = '#aaa'; g.fillText(s.phase === 'ping' ? 'Finding a server' : 'Mbps ' + (s.phase === 'down' ? 'download' : 'upload'), cx, cy + 50);
  }
  const cols = [['PING', s.ping ? s.ping + ' ms' : '–'], ['DOWNLOAD', s.down ? s.down.toFixed(1) + ' Mbps' : '–'], ['UPLOAD', s.up ? s.up.toFixed(1) + ' Mbps' : '–']];
  cols.forEach(([a, b], k) => { const x = cx - 240 + k * 240; font(g, 13, 700); g.fillStyle = '#8a8cab'; g.fillText(a, x, 520); font(g, 26, 600); g.fillStyle = '#fff'; g.fillText(b, x, 556); });
  font(g, 13); g.fillStyle = '#8a8cab';
  const st = r.status(true);
  g.fillText(`${r.plan.name}  ·  ${st.link === 'wifi' ? 'Wi-Fi (' + Math.round(r.signal() * 100) + '% signal)' : 'Ethernet'}`, cx, 610);
  g.textAlign = 'left';
  ctx.contentH = 660;
}

const VIDEOS = [
  ['I built a PC out of a fridge (it works??)', 'Tech Dumpster', 'pc', 14],
  ['lofi beats to study / chill to', 'Rainy Room', 'lofi', 180],
  ['Speedrunning DUSTLINE in 4 minutes', 'FastFingers', 'fps', 4],
  ['Cooking a burger with only a microwave', 'Bad Chef Dan', 'cook', 9],
  ['Rain on a car roof for 1 hour', 'Sleep Sounds', 'rain', 60],
  ['My router died and so did I', 'Net Guy', 'router', 7],
  ['Satisfying keyboard typing ASMR', 'ClackClack', 'keys', 21],
  ['Driving at night through the city', 'NightDrive', 'drive', 33],
];
function videoPage(ctx) {
  const { g, w, t, os } = ctx;
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, w, Math.max(ctx.h, 900));
  fillRR(g, 24, 16, 40, 28, 7, '#ff0033'); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(39, 23); g.lineTo(52, 30); g.lineTo(39, 37); g.closePath(); g.fill();
  font(g, 20, 700); g.fillStyle = '#fff'; g.fillText('VidTube', 74, 38);
  const v = t.state.watch;
  const r = os.g.router;
  if (v !== undefined) {
    const vid = VIDEOS[v];
    const pw = Math.min(w - 80, 1000), ph = pw * 9 / 16, px = 40, py = 70;
    const sp = r.speed(true);
    const st = r.status(true);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - (t.state.vl || now)); t.state.vl = now;
    const need = 6; // Mbps for HD
    t.state.buffer = (t.state.buffer ?? 0) + dt * (st.internet ? sp.down / need : 0) - (t.state.paused ? 0 : dt);
    t.state.buffer = Math.max(0, Math.min(30, t.state.buffer));
    const buffering = t.state.buffer <= 0.05 && !t.state.paused;
    if (!buffering && !t.state.paused) t.state.pos = (t.state.pos || 0) + dt;
    t.state.animate = true; t.state.video = true;
    if (st.internet) r.touch(0.5);
    g.fillStyle = '#000'; g.fillRect(px, py, pw, ph);
    g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    drawVideo(g, vid[2], t.state.pos || 0, px, py, pw, ph);
    g.restore();
    if (buffering) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(px, py, pw, ph); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(px + pw / 2, py + ph / 2, 26, now * 6, now * 6 + 4.5); g.stroke(); if (!st.internet) { font(g, 15); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('You\'re offline. Check your connection.', px + pw / 2, py + ph / 2 + 60); g.textAlign = 'left'; } }
    // progress
    const len = vid[3] * 60;
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(px, py + ph - 4, pw, 4);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(px, py + ph - 4, pw * Math.min(1, ((t.state.pos || 0) + t.state.buffer) / len), 4);
    g.fillStyle = '#ff0033'; g.fillRect(px, py + ph - 4, pw * Math.min(1, (t.state.pos || 0) / len), 4);
    ctx.kit.region(px, py, pw, ph, () => { t.state.paused = !t.state.paused; }, 'hand');
    font(g, 20, 700); g.fillStyle = '#fff'; text(g, vid[0], px, py + ph + 36, pw);
    font(g, 14); g.fillStyle = '#aaa'; g.fillText(`${vid[1]}  ·  ${(vid[0].length * 31337 % 9000 + 120).toLocaleString()}K views`, px, py + ph + 62);
    link(ctx, '← Back to videos', px, py + ph + 100, 'vidtube.com', 14, '#3ea6ff');
    ctx.kit.region(px, py + ph + 84, 140, 22, () => { t.state.watch = undefined; t.state.video = false; t.state.animate = false; }, 'hand');
    ctx.contentH = py + ph + 140;
    return;
  }
  t.state.video = false;
  const cols = Math.max(1, Math.floor((w - 40) / 300)), cw = (w - 40) / cols;
  VIDEOS.forEach((vid, k) => {
    const x = 20 + (k % cols) * cw, y = 70 + Math.floor(k / cols) * (cw * 9 / 16 + 90);
    const tw = cw - 20, th = tw * 9 / 16;
    g.save(); g.beginPath(); g.rect(x, y, tw, th); g.clip(); drawVideo(g, vid[2], 12 + k * 7, x, y, tw, th); g.restore();
    fillRR(g, x + tw - 54, y + th - 26, 48, 20, 3, 'rgba(0,0,0,0.8)'); font(g, 12, 600); g.fillStyle = '#fff'; g.fillText(`${vid[3]}:${String(k * 17 % 60).padStart(2, '0')}`, x + tw - 46, y + th - 11);
    font(g, 15, 600); g.fillStyle = '#fff'; text(g, vid[0], x, y + th + 24, tw);
    font(g, 13); g.fillStyle = '#aaa'; g.fillText(vid[1], x, y + th + 46);
    ctx.kit.region(x, y, tw, th + 50, () => { t.state.watch = k; t.state.pos = 0; t.state.buffer = 0; }, 'hand');
  });
  ctx.contentH = 70 + Math.ceil(VIDEOS.length / cols) * (cw * 9 / 16 + 90);
}

// procedural "footage" for the fake videos
function drawVideo(g, kind, tt, x, y, w, h) {
  const t = tt;
  if (kind === 'lofi' || kind === 'rain') {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2b2244'); gr.addColorStop(1, '#5b3a5e'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = '#1a1328'; g.fillRect(x + w * 0.1, y + h * 0.15, w * 0.45, h * 0.55);
    for (let k = 0; k < 60; k++) { const rx = x + w * 0.1 + ((k * 73 + t * 120) % (w * 0.45)), ry = y + h * 0.15 + ((k * 37 + t * 300 * (1 + k % 3)) % (h * 0.55)); g.fillStyle = 'rgba(180,200,255,0.5)'; g.fillRect(rx, ry, 1, 8); }
    g.fillStyle = '#ffcf8a'; g.beginPath(); g.arc(x + w * 0.75, y + h * 0.42, h * 0.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#20182e'; g.fillRect(x, y + h * 0.75, w, h * 0.25);
    for (let k = 0; k < 24; k++) { const bh = (Math.sin(t * 3 + k) * 0.5 + 0.5) * h * 0.12; g.fillStyle = 'rgba(255,200,230,0.6)'; g.fillRect(x + w * 0.62 + k * w * 0.012, y + h * 0.9 - bh, w * 0.008, bh); }
  } else if (kind === 'fps' || kind === 'drive') {
    const sky = g.createLinearGradient(0, y, 0, y + h / 2); sky.addColorStop(0, kind === 'drive' ? '#05060f' : '#7fb3ff'); sky.addColorStop(1, kind === 'drive' ? '#1b1e3a' : '#cfe3ff'); g.fillStyle = sky; g.fillRect(x, y, w, h / 2);
    g.fillStyle = kind === 'drive' ? '#111' : '#6b5a45'; g.fillRect(x, y + h / 2, w, h / 2);
    for (let k = 0; k < 12; k++) { const z = ((k / 12 + t * 0.5) % 1); const yy = y + h / 2 + z * z * h / 2; g.fillStyle = kind === 'drive' ? 'rgba(255,220,120,0.9)' : 'rgba(0,0,0,0.15)'; g.fillRect(x + w / 2 - z * 6, yy, z * 12, z * 30); }
    if (kind === 'drive') for (let k = 0; k < 14; k++) { const bx = x + ((k * 97 - t * 60) % w + w) % w; g.fillStyle = `rgba(${150 + k * 7},${120 + k * 5},255,0.7)`; g.fillRect(bx, y + h * 0.2 + (k % 4) * 10, 30, h * 0.3 - (k % 4) * 10); }
    else { g.fillStyle = '#333'; g.fillRect(x + w * 0.58, y + h * 0.62, w * 0.22, h * 0.38); g.fillStyle = '#ffeb3b'; g.fillRect(x + w / 2 - 2, y + h / 2 - 2, 4, 4); }
  } else if (kind === 'keys') {
    g.fillStyle = '#1b1b1f'; g.fillRect(x, y, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) { const down = Math.sin(t * 8 + r * 3 + c * 1.7) > 0.85; fillRR(g, x + w * 0.08 + c * w * 0.07, y + h * 0.25 + r * h * 0.14 + (down ? 3 : 0), w * 0.06, h * 0.11, 4, down ? '#7c6cff' : '#e9e4f5'); }
  } else if (kind === 'cook') {
    g.fillStyle = '#d9d2c5'; g.fillRect(x, y, w, h); g.fillStyle = '#333'; g.fillRect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.6);
    g.fillStyle = `rgba(255,200,80,${0.4 + 0.3 * Math.sin(t * 2)})`; g.fillRect(x + w * 0.24, y + h * 0.19, w * 0.4, h * 0.52);
    g.fillStyle = '#8d5524'; g.beginPath(); g.ellipse(x + w * 0.44, y + h * 0.5 + Math.sin(t) * 3, w * 0.1, h * 0.06, 0, 0, Math.PI * 2); g.fill();
    font(g, Math.round(h * 0.09), 700, MONO); g.fillStyle = '#7CFC00'; g.fillText(`${Math.max(0, 90 - Math.floor(t) % 90)}`, x + w * 0.68, y + h * 0.35);
  } else if (kind === 'router') {
    g.fillStyle = '#2d3436'; g.fillRect(x, y, w, h); fillRR(g, x + w * 0.35, y + h * 0.3, w * 0.3, h * 0.35, 10, '#ecf0f1');
    for (let k = 0; k < 4; k++) { g.fillStyle = k === 1 && Math.sin(t * 6) > 0 ? '#ff9800' : '#4caf50'; g.beginPath(); g.arc(x + w * 0.4 + k * w * 0.065, y + h * 0.5, h * 0.025, 0, Math.PI * 2); g.fill(); }
  } else {
    g.fillStyle = '#222'; g.fillRect(x, y, w, h);
    fillRR(g, x + w * 0.3, y + h * 0.15, w * 0.4, h * 0.7, 8, '#ddd');
    for (let k = 0; k < 3; k++) { g.fillStyle = `hsl(${(t * 60 + k * 120) % 360},90%,55%)`; g.beginPath(); g.arc(x + w / 2, y + h * (0.3 + k * 0.2), h * 0.07, 0, Math.PI * 2); g.fill(); }
  }
}

function newsPage(ctx) {
  const { g, w } = ctx;
  const d = new Date();
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, 2000);
  font(g, 34, 700, 'Georgia, serif'); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText('News Today', w / 2, 60);
  font(g, 13); g.fillStyle = '#666'; g.fillText(d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), w / 2, 86); g.textAlign = 'left';
  g.fillStyle = '#111'; g.fillRect(30, 100, w - 60, 2);
  const items = [
    ['Local man unplugs router, internet comes back after one minute', 'Tech support everywhere is shocked that "turning it off and on again" still works in ' + d.getFullYear() + '.'],
    ['Graphics card prices go up again for no reason', 'Experts say the reason is "because they can."'],
    ['Study: people who clean the dust out of their PC run 15 degrees cooler', 'The fans were apparently not decorative.'],
    ['Weather: ' + (d.getHours() >= 6 && d.getHours() < 19 ? 'clear for the rest of the day' : 'calm night ahead'), 'A good day to stay inside and play games, which you were going to do anyway.'],
    ['Internet provider apologizes for short outage', 'Service came back after a few minutes. Customers reported refreshing the page about 400 times.'],
  ];
  let y = 140;
  items.forEach(([h1, body], k) => {
    font(g, k ? 20 : 28, 700, 'Georgia, serif'); g.fillStyle = '#111';
    const hh = para(g, h1, 30, y, w - 60, k ? 26 : 34);
    font(g, 15); g.fillStyle = '#444';
    const bh = para(g, body, 30, y + hh + 6, w - 60, 22);
    y += hh + bh + 36;
    g.fillStyle = '#ddd'; g.fillRect(30, y - 18, w - 60, 1);
  });
  ctx.contentH = y + 40;
}

function storePage(ctx) {
  const { g, w, os } = ctx;
  g.fillStyle = '#1a1033'; g.fillRect(0, 0, w, 900);
  font(g, 26, 700); g.fillStyle = '#fff'; g.fillText('GameDrop', 30, 50);
  font(g, 14); g.fillStyle = '#b9a8e6'; g.fillText('Games for your PC. The ones marked INSTALLED are already in your Steam library.', 30, 80);
  const games = [['DUSTLINE', 'Old-school shooter. Heavy on the graphics card.', 'dustline'], ['SKIRMISH', 'Online arena shooter. Needs internet.', 'skirmish'], ['Mines', 'The classic. Runs on anything.', 'mines'], ['NEON HIGHWAY', 'Night racing. Coming soon.', null]];
  games.forEach(([n, d, id], k) => {
    const x = 30 + (k % 2) * Math.min(520, (w - 60) / 2), y = 110 + Math.floor(k / 2) * 150;
    fillRR(g, x, y, Math.min(500, (w - 80) / 2), 130, 10, '#2a1d4f');
    font(g, 20, 700); g.fillStyle = '#fff'; g.fillText(n, x + 20, y + 40);
    font(g, 13); g.fillStyle = '#cbbdf0'; g.fillText(d, x + 20, y + 66);
    fillRR(g, x + 20, y + 84, 110, 30, 15, id ? '#3d2c70' : '#555'); font(g, 13, 700); g.fillStyle = '#fff'; g.fillText(id ? 'INSTALLED' : 'SOON', x + 36, y + 104);
    if (id) ctx.kit.region(x + 20, y + 84, 110, 30, () => os.open(id), 'hand');
  });
  ctx.contentH = 420;
}

function routerPage(ctx) {
  const { g, w, t, os } = ctx;
  const r = os.g.router;
  g.fillStyle = '#eef1f5'; g.fillRect(0, 0, w, 900);
  g.fillStyle = '#2c3e50'; g.fillRect(0, 0, w, 56);
  font(g, 20, 700); g.fillStyle = '#fff'; g.fillText('NETLINK', 24, 36);
  font(g, 13); g.fillStyle = '#bdc3c7'; g.fillText('Gateway  ·  192.168.0.1', 130, 35);
  if (!t.state.logged) {
    const bx = w / 2 - 180;
    fillRR(g, bx, 120, 360, 260, 8, '#fff');
    font(g, 20, 700); g.fillStyle = '#2c3e50'; g.fillText('Log in to your router', bx + 30, 166);
    font(g, 13); g.fillStyle = '#7f8c8d'; g.fillText('Username: admin', bx + 30, 200);
    g.fillText('Password (it\'s on the sticker on the router):', bx + 30, 232);
    fillRR(g, bx + 30, 244, 300, 36, 4, '#f5f6f7'); strokeRR(g, bx + 30, 244, 300, 36, 4, '#bdc3c7');
    font(g, 15, 400, MONO); g.fillStyle = '#2c3e50'; g.fillText('•'.repeat((t.state.pw || '').length) + (Math.floor(performance.now() / 500) % 2 ? '|' : ''), bx + 42, 268);
    t.state.animate = true;
    if (t.state.err) { font(g, 12); g.fillStyle = '#e74c3c'; g.fillText(t.state.err, bx + 30, 300); }
    btn(ctx, bx + 30, 316, 300, 40, 'Log in', () => tryLogin(), '#2980b9');
    const tryLogin = () => { if ((t.state.pw || '') === 'admin' || t.state.pw === r.password) { t.state.logged = true; t.state.err = null; } else t.state.err = 'Wrong password. Try "admin" (the default).'; };
    t.state.onKey = (e) => { if (e.code === 'Enter') tryLogin(); else if (e.code === 'Backspace') t.state.pw = (t.state.pw || '').slice(0, -1); else if (e.key.length === 1) t.state.pw = (t.state.pw || '') + e.key; };
    return;
  }
  t.state.animate = true;
  const st = r.status(true);
  const card = (x, y, cw, ch, title) => { fillRR(g, x, y, cw, ch, 8, '#fff'); font(g, 15, 700); g.fillStyle = '#2c3e50'; g.fillText(title, x + 20, y + 32); };
  const cw = Math.min(460, (w - 72) / 2);
  card(24, 80, cw, 210, 'Internet');
  font(g, 14); g.fillStyle = r.wanUp() ? '#27ae60' : '#e67e22';
  g.fillText(r.wanUp() ? '● Connected' : r.outage > 0 ? '● Outage at your provider' : !r.wan ? '● Cable unplugged' : !r.realOnline ? '● No signal from your provider' : '● Connecting…', 44, 140);
  font(g, 13); g.fillStyle = '#555';
  g.fillText(`Plan: ${r.plan.name}`, 44, 170); g.fillText(`Uptime: ${Math.floor(r.bootT / 60)} min`, 44, 194); g.fillText('Public IP: 73.' + (r.ssid.length * 11) + '.204.18', 44, 218);
  btn(ctx, 44, 236, 120, 34, 'Reboot', () => { r.setPower(false); setTimeout(() => r.setPower(true), 1500); t.state.logged = false; ctx.b.go('192.168.0.1', false); }, '#c0392b');
  card(48 + cw, 80, cw, 210, 'Wi-Fi');
  font(g, 13); g.fillStyle = '#555';
  g.fillText(`Network name: ${r.ssid}`, 68 + cw, 140); g.fillText(`Password: ${r.password}`, 68 + cw, 166); g.fillText('Band: 2.4 GHz + 5 GHz', 68 + cw, 192);
  card(24, 310, cw * 2 + 24, 220, 'Connected devices');
  const devs = [[st.link ? os.hw.computerName : null, st.link === 'wifi' ? 'Wi-Fi' : 'Ethernet', '192.168.0.' + (st.link === 'wifi' ? 31 : 23)], ['Living-Room-TV', 'Wi-Fi', '192.168.0.44'], ['Phone', 'Wi-Fi', '192.168.0.52'], ['Console', 'Wi-Fi', '192.168.0.60']].filter(d => d[0]);
  devs.forEach(([n, l, ip], k) => { font(g, 13); g.fillStyle = '#2c3e50'; g.fillText(n, 44, 370 + k * 34); g.fillStyle = '#7f8c8d'; g.fillText(l, 44 + cw * 0.9, 370 + k * 34); g.fillText(ip, 44 + cw * 1.4, 370 + k * 34); });
  ctx.contentH = 560;
}
void FONT;
