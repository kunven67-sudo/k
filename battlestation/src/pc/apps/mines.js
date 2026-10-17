import { Kit, clientCursor, font, fillRR } from './kit.js';
import { makeIcon } from './dustline.js';

// Mines: the classic. Left click to dig, right click to flag.
export class Mines {
  static title = 'Mines'; static icon = 'game'; static w = 560; static h = 640; static exe = 'Mines.exe';
  constructor(os, win) { this.os = os; this.win = win; this.kit = new Kit(); win.img = makeIcon('M', '#2ecc71'); this.newGame(); }
  newGame() { this.N = 14; this.M = 28; this.grid = []; for (let i = 0; i < this.N * this.N; i++) this.grid.push({ mine: false, open: false, flag: false, n: 0 }); this.started = false; this.over = 0; this.time = 0; }
  plant(safe) {
    let left = this.M;
    while (left) { const i = Math.floor(Math.random() * this.N * this.N); if (this.grid[i].mine || Math.abs(i % this.N - safe % this.N) <= 1 && Math.abs(Math.floor(i / this.N) - Math.floor(safe / this.N)) <= 1) continue; this.grid[i].mine = true; left--; }
    for (let i = 0; i < this.grid.length; i++) this.grid[i].n = this.nb(i).filter(j => this.grid[j].mine).length;
    this.started = true;
  }
  nb(i) { const x = i % this.N, y = Math.floor(i / this.N), r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < this.N && ny < this.N) r.push(ny * this.N + nx); } return r; }
  dig(i) {
    if (!this.started) this.plant(i);
    const c = this.grid[i];
    if (c.open || c.flag) return;
    c.open = true;
    if (c.mine) { this.over = -1; for (const d of this.grid) if (d.mine) d.open = true; this.os.g.audio?.beep(120, 0.3, { vol: 0.06, type: 'sawtooth' }); return; }
    if (c.n === 0) for (const j of this.nb(i)) this.dig(j);
    if (this.grid.every(d => d.mine || d.open)) this.over = 1;
  }
  update(dt) { if (this.started && !this.over) { this.time += dt; return Math.floor(this.time) !== Math.floor(this.time - dt); } return false; }
  draw(g, w, h) {
    this.kit.begin();
    const cur = clientCursor(this.os, this.win);
    g.fillStyle = '#1f2a1f'; g.fillRect(0, 0, w, h);
    font(g, 16, 700); g.fillStyle = '#fff';
    g.fillText(`Mines: ${this.M - this.grid.filter(c => c.flag).length}`, 20, 32);
    g.textAlign = 'right'; g.fillText(`Time: ${Math.floor(this.time)}`, w - 20, 32); g.textAlign = 'left';
    this.kit.button(g, cur, w / 2 - 50, 12, 100, 30, this.over === 1 ? 'You win!' : this.over ? 'Try again' : 'New', () => this.newGame(), this.over ? { primary: true, accent: this.over === 1 ? '#2ecc71' : '#e67e22' } : {});
    const cs = Math.floor(Math.min(w - 40, h - 80) / this.N), ox = (w - cs * this.N) / 2, oy = 60;
    const cols = ['', '#4fc3f7', '#81c784', '#e57373', '#9575cd', '#ffb74d', '#4db6ac', '#eee', '#999'];
    this.grid.forEach((c, i) => {
      const x = ox + (i % this.N) * cs, y = oy + Math.floor(i / this.N) * cs;
      const hv = cur.x >= x && cur.y >= y && cur.x < x + cs && cur.y < y + cs;
      fillRR(g, x + 1, y + 1, cs - 2, cs - 2, 3, c.open ? (c.mine ? '#c0392b' : '#d8d2c0') : (hv ? '#5fbf6a' : ((i + Math.floor(i / this.N)) % 2 ? '#4caf50' : '#43a047')));
      g.textAlign = 'center';
      if (c.open && c.mine) { g.fillStyle = '#111'; g.beginPath(); g.arc(x + cs / 2, y + cs / 2, cs * 0.25, 0, Math.PI * 2); g.fill(); }
      else if (c.open && c.n) { font(g, cs * 0.55, 800); g.fillStyle = cols[c.n]; g.fillText(c.n, x + cs / 2, y + cs * 0.7); }
      else if (c.flag) { g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(x + cs * 0.35, y + cs * 0.2); g.lineTo(x + cs * 0.72, y + cs * 0.35); g.lineTo(x + cs * 0.35, y + cs * 0.5); g.closePath(); g.fill(); g.fillStyle = '#222'; g.fillRect(x + cs * 0.33, y + cs * 0.2, 2.5, cs * 0.6); }
      g.textAlign = 'left';
      this.kit.region(x, y, cs, cs, () => {});
    });
    this.geo = { cs, ox, oy };
  }
  mouse(t, x, y, b) {
    if (t !== 'down' && t !== 'dbl') return;
    if (this.kit.find(x, y) && y < 50) { this.kit.click(x, y); return; }
    if (this.over || !this.geo) return;
    const { cs, ox, oy } = this.geo;
    const cx = Math.floor((x - ox) / cs), cy = Math.floor((y - oy) / cs);
    if (cx < 0 || cy < 0 || cx >= this.N || cy >= this.N) return;
    const i = cy * this.N + cx;
    if (b === 2) { if (!this.grid[i].open) this.grid[i].flag = !this.grid[i].flag; }
    else this.dig(i);
  }
}
