import { Kit, clientCursor, scrollbar, font, fillRR, strokeRR, text, inside } from './kit.js';
import { para } from '../gfx.js';
import { colorFor } from '../os.js';

// Your game library ("Steam"). Shows your REAL installed Steam/Epic games (with their real covers)
// after a scan, plus the games that actually run inside the in-game PC (marked PLAYABLE).
export const PLAYABLE = [
  { id: 'dustline', name: 'DUSTLINE', desc: 'A fast retro shooter. Heavy on the graphics card: on a weak GPU it really lags.', online: false, col: '#b5651d' },
  { id: 'skirmish', name: 'SKIRMISH', desc: 'Online top-down arena shooter. Needs internet. Pull the router\'s cable mid-match and see what happens.', online: true, col: '#2e86de' },
  { id: 'mines', name: 'Mines', desc: 'The classic. Runs on literally anything.', online: false, col: '#2ecc71' },
];
const ONLINE = /counter-strike|cs2|dota|apex|pubg|rust|rocket league|destiny|warframe|team fortress|fall guys|the finals|marvel rivals|overwatch|naraka|valorant|fortnite|league of legends|roblox|gta|grand theft auto|call of duty|warzone|battlefield|rainbow six|dead by daylight|paladins|smite|lost ark|new world|elder scrolls online|final fantasy xiv|world of warcraft|path of exile|deadlock|halo infinite|brawlhalla|war thunder|world of tanks|among us|lethal company|helldivers|sea of thieves|vrchat|rec room|delta force|bloodhunt|spectre|multiversus|xdefiant|splitgate/i;

export class Library {
  static title = 'Steam'; static icon = 'library'; static w = 1220; static h = 740; static single = true; static exe = 'steam.exe';
  constructor(os, win, a) {
    this.os = os; this.win = win; this.kit = new Kit();
    this.sel = 0; this.scroll = 0;
    this.epic = /epic/i.test(a.title || '');
    win.title = this.epic ? 'Epic Games Launcher' : 'Steam';
    this.wasOnline = os.g.router.status(true).internet;
    if (!this.wasOnline) setTimeout(() => os.msgbox(this.epic ? 'Epic Games Launcher' : 'Steam - Offline', 'Could not connect to the network. You can still play games that don\'t need the internet in offline mode.', { kind: 'warn' }), 600);
    this.mem = 260; this.cpuLoad = 0.02;
  }
  games() {
    const scan = this.os.g.scan;
    const real = ((this.epic ? scan?.epic : scan?.steam) || []).map(g => ({ ...g, real: true }));
    return [...PLAYABLE.map(p => ({ ...p, playable: true })), ...real];
  }
  cover(gm) {
    if (gm.coverImg) return gm.coverImg;
    if (gm.cover && !gm._loading) { gm._loading = true; const im = new Image(); im.onload = () => { gm.coverImg = im; this.os.dirty = true; }; im.src = 'data:image/jpeg;base64,' + gm.cover; }
    return null;
  }
  draw(g, w, h) {
    this.kit.begin();
    const os = this.os, cur = clientCursor(os, this.win);
    const online = os.g.router.status(true).internet;
    g.fillStyle = '#171d25'; g.fillRect(0, 0, w, h);
    // top nav
    g.fillStyle = '#171a21'; g.fillRect(0, 0, w, 52);
    font(g, 15, 700); g.fillStyle = '#dcdedf';
    ['STORE', 'LIBRARY', 'COMMUNITY', os.user.name.toUpperCase()].forEach((t, k) => { g.fillStyle = k === 1 ? '#1a9fff' : '#dcdedf'; g.fillText(t, 24 + k * 130, 33); });
    if (!online) { fillRR(g, w - 210, 14, 190, 26, 4, '#5c2e00'); font(g, 12, 700); g.fillStyle = '#ffb35c'; g.fillText('OFFLINE MODE', w - 190, 32); }
    // left list
    const games = this.games();
    this.sel = Math.min(this.sel, games.length - 1);
    g.fillStyle = '#1e2329'; g.fillRect(0, 52, 300, h - 52);
    font(g, 12, 700); g.fillStyle = '#7f8b96'; g.fillText(`ALL GAMES (${games.length})`, 18, 80);
    const rowH = 34, top = 92, vis = Math.floor((h - top - 50) / rowH);
    games.slice(this.scroll, this.scroll + vis).forEach((gm, k) => {
      const i = k + this.scroll, y = top + k * rowH;
      if (i === this.sel) fillRR(g, 8, y, 284, rowH - 2, 3, '#3d4450');
      else if (inside(cur.x, cur.y, 8, y, 284, rowH - 2)) fillRR(g, 8, y, 284, rowH - 2, 3, '#2a3039');
      const cv = this.cover(gm);
      if (cv) g.drawImage(cv, 16, y + 4, 18, 26); else fillRR(g, 16, y + 4, 18, 26, 2, gm.col || colorFor(gm.name));
      font(g, 13); g.fillStyle = gm.playable ? '#fff' : '#b8bcbf'; text(g, gm.name, 44, y + 21, 170);
      if (gm.playable) { font(g, 10, 700); g.fillStyle = '#5ba32b'; g.fillText('PLAYABLE', 226, y + 21); }
      this.kit.region(8, y, 284, rowH - 2, () => { this.sel = i; });
    });
    scrollbar(g, 292, top, vis * rowH, vis / games.length, this.scroll / Math.max(1, games.length - vis));
    if (!this.os.g.scan) {
      fillRR(g, 12, h - 96, 276, 84, 6, '#2a3b4f');
      font(g, 12); g.fillStyle = '#c7d5e0'; para(g, 'Your real Steam games show up here after you scan your PC (desktop shortcut "Scan my real PC").', 24, h - 74, 252, 17);
    }
    // detail
    const gm = games[this.sel];
    if (!gm) return;
    const x0 = 300, cw = w - x0;
    const cv = this.cover(gm);
    const hh = Math.min(330, h * 0.42);
    const gr = g.createLinearGradient(0, 52, 0, 52 + hh);
    gr.addColorStop(0, gm.col || colorFor(gm.name)); gr.addColorStop(1, '#171d25');
    g.fillStyle = gr; g.fillRect(x0, 52, cw, hh);
    if (cv) { g.globalAlpha = 0.35; g.drawImage(cv, x0, 52 - cw * 0.3, cw, cw * 1.5); g.globalAlpha = 1; g.fillStyle = 'rgba(23,29,37,0.55)'; g.fillRect(x0, 52, cw, hh); g.drawImage(cv, x0 + 40, 52 + 40, (hh - 80) * 2 / 3, hh - 80); }
    const tx = cv ? x0 + 60 + (hh - 80) * 2 / 3 : x0 + 40;
    font(g, 36, 700); g.fillStyle = '#fff'; text(g, gm.name, tx, 52 + hh - 90, cw - (tx - x0) - 40);
    const needNet = gm.online || (gm.real && ONLINE.test(gm.name));
    font(g, 13); g.fillStyle = '#c7d5e0';
    g.fillText(gm.playable ? 'Installed  ·  PLAYABLE in BATTLESTATION' : `Installed on your real PC${gm.size ? '  ·  ' + (gm.size / 1e9).toFixed(1) + ' GB' : ''}`, tx, 52 + hh - 60);
    if (needNet) { g.fillStyle = online ? '#5ba32b' : '#ff8a5c'; g.fillText(online ? 'Online game  ·  connected' : 'Online game  ·  needs internet', tx, 52 + hh - 38); }
    const pb = { x: tx, y: 52 + hh - 20, w: 160, h: 46 };
    const hv = inside(cur.x, cur.y, pb.x, pb.y, pb.w, pb.h);
    fillRR(g, pb.x, pb.y, pb.w, pb.h, 3, hv ? '#70d61d' : '#5ba32b');
    font(g, 18, 700); g.fillStyle = '#fff'; g.fillText('▶  PLAY', pb.x + 34, pb.y + 30);
    this.kit.region(pb.x, pb.y, pb.w, pb.h, () => this.play(gm));
    font(g, 14); g.fillStyle = '#acb2b8';
    para(g, gm.desc || (gm.real ? 'This is a game from your real Steam library. Its files are on your real PC.' : ''), x0 + 40, 52 + hh + 70, cw - 80, 22);
    if (gm.lastPlayed) { font(g, 12); g.fillStyle = '#7f8b96'; g.fillText('Last played ' + new Date(gm.lastPlayed * 1000).toLocaleDateString(), x0 + 40, 52 + hh + 130); }
  }
  play(gm) {
    const os = this.os;
    const online = os.g.router.status(true).internet;
    const needNet = gm.online || (gm.real && ONLINE.test(gm.name));
    if (gm.playable) { os.open(gm.id); return; }
    if (needNet && !online) { os.msgbox(gm.name, `${gm.name} couldn't connect to the game servers. Check your internet connection and try again.`, { kind: 'error' }); return; }
    os.open('realapp', { title: gm.name, item: { name: gm.name, img: this.cover(gm) || undefined } });
  }
  mouse(t, x, y) { if (t === 'down' || t === 'dbl') { this.kit.click(x, y); if (t === 'dbl' && x < 300) this.play(this.games()[this.sel]); } }
  wheel(s, x) { if (x < 300) this.scroll = Math.max(0, Math.min(Math.max(0, this.games().length - 10), this.scroll + Math.sign(s) * 3)); }
  key(e) {
    const n = this.games().length;
    if (e.code === 'ArrowDown') this.sel = Math.min(n - 1, this.sel + 1);
    if (e.code === 'ArrowUp') this.sel = Math.max(0, this.sel - 1);
    if (e.code === 'Enter') this.play(this.games()[this.sel]);
  }
}
void strokeRR;
