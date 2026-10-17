import SCRIPT from './scan.ps1';
import { appFor } from './apps/index.js';

// Gets your REAL PC into the game. A browser page isn't allowed to look at your taskbar, so:
// 1. the game hands you a small scanner (.bat) with its own folder baked in,
// 2. you run it once, it writes battlestation-mypc.js next to the game,
// 3. the game sees the file appear and loads it (or you drag the file in).
// Every launch after that loads the last scan by itself.
const FILE = 'battlestation-mypc.js';

export class Scanner {
  constructor(g) {
    this.g = g;
    this.status = '';
    this.ok = false;
    this.waiting = false;
    this.local = location.protocol === 'file:';
    this.folder = this.local ? folderOf(location) : null;
    addEventListener('dragover', e => { if (hasFile(e)) e.preventDefault(); });
    addEventListener('drop', e => { if (!hasFile(e)) return; e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) this.readFile(f); });
  }

  // at boot: a scan file next to the game, or the last one we kept
  async boot() {
    if (this.local) { const s = await this.peek(); if (s) { this.apply(s, true); return; } }
    const kept = await idb('get');
    if (kept) this.apply(kept, true);
  }

  // try loading battlestation-mypc.js from the game's folder (file:// lets <script> do this)
  peek() {
    return new Promise(res => {
      const el = document.createElement('script');
      delete window.__BATTLESTATION_SCAN__;
      el.src = FILE + '?t=' + Date.now();
      el.onload = () => { el.remove(); res(window.__BATTLESTATION_SCAN__ || null); };
      el.onerror = () => { el.remove(); res(null); };
      document.head.appendChild(el);
    });
  }

  batFile() {
    const lines = ['@echo off', 'setlocal', 'title BATTLESTATION scanner'];
    if (this.folder) {
      lines.push(`set "BS_OUT64=${b64utf16(this.folder)}"`, 'set "BS_AUTO=1"');
    }
    lines.push('set "BS_SELF=%~f0"');
    lines.push('powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:BS_SELF);$i=$t.IndexOf(\'#BS\'+\'SCAN\');if($env:BS_OUT64){$env:BS_OUT=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($env:BS_OUT64))};iex $t.Substring($i)"');
    lines.push('exit /b', '#BSSCAN');
    return (lines.join('\r\n') + '\r\n' + SCRIPT.replace(/\r?\n/g, '\r\n'));
  }

  download() {
    const blob = new Blob([this.batFile()], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'battlestation-scan.bat';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.ok = false;
    this.status = this.local ? 'Scanner downloaded. Run it from your Downloads (double-click). This waits for it...' : 'Scanner downloaded. Run it, then drag battlestation-mypc.js onto this window.';
    this.g.os.dirty = true;
    if (this.local) this.wait();
  }

  async wait() {
    if (this.waiting) return;
    this.waiting = true;
    const t0 = Date.now();
    while (this.waiting && Date.now() - t0 < 15 * 60 * 1000) {
      await sleep(2500);
      const s = await this.peek();
      if (s && (!this.scan || s.made !== this.scan.made)) { this.apply(s); break; }
    }
    this.waiting = false;
  }

  readFile(f) {
    const r = new FileReader();
    r.onload = () => {
      const t = String(r.result || '');
      try { this.apply(JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))); }
      catch (e) { this.status = 'That file isn\'t a BATTLESTATION scan.'; this.ok = false; this.g.toast(this.status); }
    };
    r.readAsText(f);
  }

  forget() { idb('del'); this.g.toast('Forgot your scan. Restart the game to go back to the default PC.'); this.scan = null; }

  action(a) { if (a === 'download') this.download(); else if (a === 'forget') this.forget(); else if (a === 'load') this.pick(); }

  pick() {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = '.js,.json';
    i.onchange = () => { if (i.files[0]) this.readFile(i.files[0]); };
    i.click();
  }

  helpHTML() {
    return `<ol class="steps">
      <li>Click <b>Download scanner</b>. Your browser may ask if you want to keep <b>battlestation-scan.bat</b>: keep it.</li>
      <li>Double-click it. If Windows says "Windows protected your PC", click <b>More info</b> then <b>Run anyway</b>. (Right-click it and Edit to read every line first. It only reads stuff.)</li>
      <li>${this.local ? 'Come back here. The game loads your PC by itself.' : 'Drag the <b>battlestation-mypc.js</b> file it made onto this window.'}</li></ol>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn primary" data-scan="download">Download scanner</button><button class="btn" data-scan="load">Load scan file</button>${this.scan ? '<button class="btn" data-scan="forget">Forget my scan</button>' : ''}</div>
      <p class="muted">${this.status || ''}</p>`;
  }

  // ------------------------------------------------------------------ put the scan into the game
  apply(s, quiet) {
    const g = this.g, os = g.os;
    this.scan = s;
    g.scan = s;
    g.hw.applyScan(s);
    const pin = (p) => ({ name: p.name, iconData: p.icon || null, path: p.target || null, aumid: p.aumid, real: true, app: appFor({ name: p.name }) });
    if (s.pins?.length) os.pins = s.pins.map(pin);
    if (s.desktop) {
      const items = [{ name: 'Recycle Bin', app: 'explorer', path: 'bin', kind: 'bin' }];
      for (const d of s.desktop) {
        const it = { name: d.name, iconData: d.icon || null, real: true, kind: d.kind, ext: d.ext };
        it.app = d.kind === 'folder' ? 'explorer' : /\.(txt|log|md|ini|cfg)$/.test(d.ext || '') ? 'notepad' : appFor({ name: d.name, kind: steamName(s, d.name) ? 'game' : '' });
        if (it.app === 'explorer') it.path = 'Desktop';
        if (steamName(s, d.name)) it.steamId = steamName(s, d.name).appid;
        items.push(it);
      }
      items.push({ name: 'BATTLESTATION games', app: 'library' });
      os.desktopItems = items;
    }
    if (s.start?.length) {
      os.startApps = [...s.start.map(a => ({ name: a.name, iconData: a.icon || null, real: true, app: appFor({ name: a.name }) })),
        { name: 'DUSTLINE', app: 'dustline' }, { name: 'SKIRMISH', app: 'skirmish' }, { name: 'Mines', app: 'mines' }];
    }
    if (s.open?.length) os.openAtLogin = s.open.map(o => ({ name: o.name, iconData: o.icon || null, real: true, app: appFor({ name: o.name }) }));
    if (s.user?.name) { os.user.name = s.user.full || s.user.name; os.user.pic = s.user.pic || null; }
    if (s.theme) {
      os.theme.dark = s.theme.dark !== false;
      if (s.theme.accent) os.theme.accent = s.theme.accent;
      os.theme.align = s.theme.align || 'center';
      os.theme.clock24 = !!s.theme.clock24;
      os.theme.win = s.theme.win || 11;
    }
    if (s.wallpaper) {
      const im = new Image();
      im.onload = () => { os.realWallpaper = im; if (!os.useDefaultWp) os.setWallpaper(im); os.dirty = true; };
      im.src = 'data:image/jpeg;base64,' + s.wallpaper;
    } else if (s.wallpaperColor) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 9;
      const x = c.getContext('2d'); x.fillStyle = s.wallpaperColor; x.fillRect(0, 0, 16, 9);
      os.realWallpaper = c; os.setWallpaper(c);
    }
    os.dirty = true;
    this.ok = true;
    const games = (s.steam?.length || 0) + (s.epic?.length || 0);
    this.status = `Loaded your PC: ${s.pins?.length || 0} taskbar apps, ${s.desktop?.length || 0} desktop items, ${games} games, ${s.hw?.gpu || 'your parts'}.`;
    if (!quiet) { g.toast('Your real PC is in the game now.'); os.notify('Scan loaded', this.status); }
    idb('put', s);
    g.rig?.save();
  }
}

function steamName(s, name) {
  const n = String(name).toLowerCase();
  return (s.steam || []).find(x => x.name.toLowerCase() === n);
}
function hasFile(e) { return [...(e.dataTransfer?.types || [])].includes('Files'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function folderOf(loc) {
  // file:///C:/Users/you/Downloads/battlestation.html -> C:\Users\you\Downloads
  let p = decodeURIComponent(loc.pathname);
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  if (loc.host) p = '\\\\' + loc.host + p; // network share
  p = p.replace(/\//g, '\\');
  return p.slice(0, p.lastIndexOf('\\'));
}
function b64utf16(str) {
  const b = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); b[i * 2] = c & 255; b[i * 2 + 1] = c >> 8; }
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

// a tiny IndexedDB store for the last scan (it can be a few MB with icons + covers)
function idb(op, val) {
  return new Promise(res => {
    let req;
    try { req = indexedDB.open('battlestation', 1); } catch (e) { res(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => res(null);
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite');
        const st = tx.objectStore('kv');
        const r = op === 'get' ? st.get('scan') : op === 'put' ? st.put(val, 'scan') : st.delete('scan');
        r.onsuccess = () => res(op === 'get' ? r.result || null : true);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    };
  });
}
