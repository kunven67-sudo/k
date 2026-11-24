// Reads how THEIR real PC looks (only reads, never changes anything): wallpaper, dark/light, taskbar
// settings, desktop icons, pinned taskbar apps, Start menu apps, their name, network type.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const IS_WIN = process.platform === 'win32';

function reg(key, value) { // one registry value as a string (or null)
  if (!IS_WIN) return null;
  try {
    const out = cp.execFileSync('reg', ['query', key, '/v', value], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
    const m = out.split(/\r?\n/).find(l => l.includes(value) && /REG_/.test(l));
    if (!m) return null;
    const parts = m.trim().split(/\s{2,}|\t/);
    const v = parts[parts.length - 1];
    if (/REG_DWORD/.test(m)) return String(parseInt(v, 16));
    return v;
  } catch (e) { return null; }
}
const ADV = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';

function listFiles(dir) { try { return fs.readdirSync(dir).map(n => path.join(dir, n)); } catch (e) { return []; } }
function hiddenOrSystem(p) {
  const n = path.basename(p).toLowerCase();
  return n === 'desktop.ini' || n.startsWith('~$') || n === 'thumbs.db';
}
function niceName(p) { return path.basename(p).replace(/\.(lnk|url|appref-ms)$/i, ''); }

async function iconOf(app, p, size, nativeImage) {
  try { const W = require('./win32')(); const b = W.bigIcon(p); if (b) return nativeImage.createFromBitmap(bgra(Buffer.from(b.rgba, 'base64')), { width: b.w, height: b.h }).toDataURL(); } catch (e) { }
  try { const im = await app.getFileIcon(p, { size: size || 'large' }); if (im && !im.isEmpty()) return im.toDataURL(); } catch (e) { }
  return null;
}

async function read(app, nativeImage) {
  const look = {
    user: os.userInfo().username || 'Player',
    light: false, accent: '#4cc2ff', taskbarAlign: 'center', searchMode: 2, taskView: true, widgets: false,
    wallpaper: null, wallpaperStyle: 'fill', wallColor: '#0b3b6f',
    desktop: [], pinned: [], start: [], recycle: null, network: 'ethernet', real: IS_WIN,
  };
  if (IS_WIN) {
    const light = reg('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'SystemUsesLightTheme');
    look.light = light === '1';
    const al = reg(ADV, 'TaskbarAl'); if (al === '0') look.taskbarAlign = 'left';
    const sm = reg('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'SearchboxTaskbarMode'); if (sm !== null) look.searchMode = +sm;
    const tv = reg(ADV, 'ShowTaskViewButton'); if (tv === '0') look.taskView = false;
    const ac = reg('HKCU\\Software\\Microsoft\\Windows\\DWM', 'AccentColor');
    if (ac) { const n = (+ac) >>> 0; const r = n & 255, g = (n >> 8) & 255, b = (n >> 16) & 255; look.accentRaw = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); }
    const st = reg('HKCU\\Control Panel\\Desktop', 'WallpaperStyle'), tile = reg('HKCU\\Control Panel\\Desktop', 'TileWallpaper');
    look.wallpaperStyle = tile === '1' ? 'tile' : ({ '0': 'center', '2': 'stretch', '6': 'fit', '10': 'fill', '22': 'span' }[st] || 'fill');
    const bg = reg('HKCU\\Control Panel\\Colors', 'Background'); if (bg) { const c = bg.split(' ').map(Number); if (c.length === 3) look.wallColor = 'rgb(' + c.join(',') + ')'; }
    // wallpaper picture: Windows keeps a copy of whatever is on the desktop here
    const tw = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
    let wp = null;
    try { if (fs.statSync(tw).size > 1000) wp = tw; } catch (e) { }
    if (!wp) { const p = reg('HKCU\\Control Panel\\Desktop', 'WallPaper'); if (p && fs.existsSync(p)) wp = p; }
    if (wp) {
      try {
        const buf = fs.readFileSync(wp);
        const isPng = buf[0] === 0x89 && buf[1] === 0x50, isBmp = buf[0] === 0x42 && buf[1] === 0x4d;
        if (isBmp) { const im = nativeImage.createFromBuffer(buf); look.wallpaper = im.toDataURL(); }
        else look.wallpaper = 'data:image/' + (isPng ? 'png' : 'jpeg') + ';base64,' + buf.toString('base64');
      } catch (e) { }
    }
    // network: wired or Wi-Fi
    const ifs = Object.keys(os.networkInterfaces());
    if (ifs.some(n => /wi-?fi|wlan|wireless/i.test(n)) && !ifs.some(n => /^ethernet/i.test(n))) look.network = 'wifi';
    // desktop icons (their own desktop + the shared one + OneDrive desktop)
    const home = os.homedir();
    const dirs = [path.join(home, 'Desktop'), path.join(home, 'OneDrive', 'Desktop'), path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')];
    const seen = new Set();
    for (const d of dirs) for (const p of listFiles(d)) {
      if (hiddenOrSystem(p)) continue;
      const nm = niceName(p); if (seen.has(nm.toLowerCase())) continue; seen.add(nm.toLowerCase());
      look.desktop.push({ name: nm, path: p, folder: (() => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } })() });
      if (look.desktop.length >= 60) break;
    }
    // pinned taskbar apps, in their real order (order is stored in the Taskband registry blob)
    const pinDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
    let pins = listFiles(pinDir).filter(p => /\.lnk$/i.test(p));
    try {
      const out = cp.execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Taskband', '/v', 'Favorites'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
      const hex = (out.match(/REG_BINARY\s+([0-9A-F]+)/i) || [])[1];
      if (hex) {
        const blob = Buffer.from(hex, 'hex').toString('utf16le');
        pins.sort((a, b) => { const ia = blob.indexOf(path.basename(a)), ib = blob.indexOf(path.basename(b)); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); });
      }
    } catch (e) { }
    look.pinned = pins.slice(0, 14).map(p => ({ name: niceName(p), path: p }));
    // Start menu apps
    const sm1 = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const sm2 = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const apps = [], names = new Set();
    const walk = (d, depth) => {
      for (const p of listFiles(d)) {
        let st; try { st = fs.statSync(p); } catch (e) { continue; }
        if (st.isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
        if (!/\.(lnk|url)$/i.test(p)) continue;
        const nm = niceName(p);
        if (/uninstall|readme|help|website|documentation|release notes|license/i.test(nm) || names.has(nm.toLowerCase())) continue;
        names.add(nm.toLowerCase()); apps.push({ name: nm, path: p });
      }
    };
    walk(sm2, 0); walk(sm1, 0);
    apps.sort((a, b) => a.name.localeCompare(b.name));
    look.start = apps.slice(0, 120);
  }
  // icons (real ones from Windows)
  const all = [...look.desktop, ...look.pinned, ...look.start];
  await Promise.all(all.map(async it => { it.icon = await iconOf(app, it.path, 'large', nativeImage); }));
  for (const it of all) delete it.path; // the game never needs (or opens) their real files
  try {
    const W = require('./win32')();
    const rb = W.stockIcon(31, true);
    if (rb) look.recycle = nativeImage.createFromBitmap(bgra(Buffer.from(rb.rgba, 'base64')), { width: rb.w, height: rb.h }).toDataURL();
    look.cursors = W.cursors();
  } catch (e) { look.cursors = {}; }
  return look;
}
function bgra(rgba) { const b = Buffer.from(rgba); for (let i = 0; i < b.length; i += 4) { const r = b[i]; b[i] = b[i + 2]; b[i + 2] = r; } return b; }

module.exports = { read };
