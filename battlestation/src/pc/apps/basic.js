import { Kit, TextBuf, clientCursor, hov, scrollbar, FONT, MONO, font, fillRR, strokeRR, text, inside } from './kit.js';
import { icon, para } from '../gfx.js';

const BG = '#202020', PANEL = '#2b2b2b', LINE = 'rgba(255,255,255,0.08)', DIM = '#a0a0a0';

// ------------------------------------------------------------------ message box
export class MsgBox {
  static title = 'Message'; static icon = 'settings'; static w = 460; static h = 210;
  constructor(os, win, a) { this.os = os; this.win = win; this.a = a; this.kit = new Kit(); win.w = a.w || 460; win.h = a.h || 210; win.x = Math.round(800 - win.w / 2); win.y = Math.round(420 - win.h / 2); }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    const ic = this.a.kind === 'error' ? '#ff5d5d' : this.a.kind === 'warn' ? '#ffd166' : '#4cc2ff';
    g.fillStyle = ic; g.beginPath(); g.arc(36, 36, 15, 0, Math.PI * 2); g.fill();
    font(g, 18, 700); g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(this.a.kind === 'error' ? '×' : this.a.kind === 'warn' ? '!' : 'i', 36, 42);
    g.textAlign = 'left'; font(g, 14); g.fillStyle = '#eee';
    para(g, this.a.body || '', 66, 32, w - 90, 20);
    fillRR(g, 0, h - 54, w, 54, 0, PANEL);
    const btns = this.a.buttons || [{ label: 'OK' }];
    btns.forEach((b, k) => this.kit.button(g, clientCursor(this.os, this.win), w - (btns.length - k) * 110 - 6, h - 42, 100, 30, b.label, () => { this.os.close(this.win); b.act?.(); }, { primary: k === btns.length - 1 }));
  }
  mouse(t, x, y) { if (t === 'down') this.kit.click(x, y); }
  key(e) { if (e.code === 'Enter' || e.code === 'Escape') this.os.close(this.win); }
}

// ------------------------------------------------------------------ notepad
export class Notepad {
  static title = 'Notepad'; static icon = 'notepad'; static w = 820; static h = 560;
  constructor(os, win, a) {
    this.os = os; this.win = win; this.kit = new Kit();
    this.path = a.path || null;
    const f = this.path && os.files[this.path];
    this.buf = new TextBuf(f ? f.content : '');
    this.buf.caret = 0;
    this.saved = this.buf.s;
    this.scroll = 0; this.blink = 0; this.wrap = true;
    this.menuOpen = null;
    this.retitle();
  }
  get name() { return this.path ? this.path.split('/').pop() : 'Untitled'; }
  retitle() { this.win.title = `${this.buf.s !== this.saved ? '*' : ''}${this.name} - Notepad`; }
  save() {
    if (!this.path) {
      let n = 1;
      while (this.os.files[`Documents/note${n === 1 ? '' : ' ' + n}.txt`]) n++;
      this.path = `Documents/note${n === 1 ? '' : ' ' + n}.txt`;
    }
    this.os.files[this.path] = { type: 'file', name: this.name, path: this.path, app: 'notepad', content: this.buf.s, edited: Date.now() };
    this.saved = this.buf.s;
    this.os.save();
    this.retitle();
    this.os.notify('Saved', `${this.name} saved to Documents.`);
  }
  // lines after wrapping: [{ start, end }]
  layout(g, w) {
    font(g, 15, 400, MONO);
    const cw = g.measureText('M').width;
    this.cw = cw;
    const cols = this.wrap ? Math.max(10, Math.floor((w - 28) / cw)) : 1e9;
    const lines = [];
    let i = 0;
    const s = this.buf.s;
    for (const raw of s.split('\n')) {
      if (raw.length === 0) lines.push({ start: i, end: i });
      for (let k = 0; k < raw.length; k += cols) lines.push({ start: i + k, end: i + Math.min(raw.length, k + cols) });
      i += raw.length + 1;
    }
    return lines;
  }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, w, h);
    // menu bar
    g.fillStyle = BG; g.fillRect(0, 0, w, 32);
    font(g, 13); g.fillStyle = '#ddd';
    ['File', 'Edit', 'View'].forEach((m, k) => {
      const x = 8 + k * 54;
      if (hov(this.os, this.win, x, 2, 48, 28) || this.menuOpen === m) fillRR(g, x, 3, 48, 26, 4, 'rgba(255,255,255,0.08)');
      g.fillStyle = '#ddd'; g.fillText(m, x + 12, 21);
      this.kit.region(x, 2, 48, 28, () => { this.menuOpen = this.menuOpen === m ? null : m; });
    });
    const top = 34, bottom = h - 26;
    const lines = this.layout(g, w);
    this.lines = lines;
    const lh = 20;
    const vis = Math.floor((bottom - top - 8) / lh);
    // keep the caret visible
    const cl = this.caretLine();
    if (cl < this.scroll) this.scroll = cl; if (cl >= this.scroll + vis) this.scroll = cl - vis + 1;
    const sel = this.buf.sel();
    g.save(); g.beginPath(); g.rect(0, top, w, bottom - top); g.clip();
    font(g, 15, 400, MONO);
    for (let k = this.scroll; k < Math.min(lines.length, this.scroll + vis + 1); k++) {
      const L = lines[k], y = top + 8 + (k - this.scroll) * lh;
      if (sel && sel[1] > L.start && sel[0] <= L.end) {
        const a = Math.max(sel[0], L.start), b = Math.min(sel[1], L.end);
        g.fillStyle = 'rgba(76,194,255,0.35)'; g.fillRect(14 + (a - L.start) * this.cw, y, Math.max(4, (b - a) * this.cw), lh);
      }
      g.fillStyle = '#e8e8e8'; g.textAlign = 'left';
      g.fillText(this.buf.s.slice(L.start, L.end), 14, y + 15);
    }
    // caret
    if (this.os.focus === this.win && Math.floor(this.blink * 2) % 2 === 0) {
      const L = lines[cl];
      g.fillStyle = '#fff'; g.fillRect(14 + (this.buf.caret - L.start) * this.cw, top + 8 + (cl - this.scroll) * lh + 1, 1.5, lh - 2);
    }
    g.restore();
    scrollbar(g, w - 9, top + 2, bottom - top - 4, vis / Math.max(1, lines.length), this.scroll / Math.max(1, lines.length - vis));
    this.kit.region(0, top, w - 12, bottom - top, (x, y) => { this.placeCaret(x, y + top, false); this.dragSel = true; }, 'text');
    // status bar
    g.fillStyle = BG; g.fillRect(0, bottom, w, h - bottom);
    font(g, 12); g.fillStyle = DIM;
    const ln = this.buf.s.slice(0, this.buf.caret).split('\n');
    g.fillText(`Ln ${ln.length}, Col ${ln.at(-1).length + 1}`, 14, h - 8);
    g.fillText(`${this.buf.s.length} characters`, 160, h - 8);
    g.textAlign = 'right'; g.fillText('100%    Windows (CRLF)    UTF-8', w - 14, h - 8); g.textAlign = 'left';
    // dropdown
    if (this.menuOpen) {
      const items = { File: [['New', () => { this.buf = new TextBuf(''); this.path = null; this.saved = ''; }], ['Save    Ctrl+S', () => this.save()], ['Exit', () => this.os.close(this.win)]],
        Edit: [['Undo    Ctrl+Z', () => this.buf.key({ code: 'KeyZ', ctrlKey: true }, this.os)], ['Select all    Ctrl+A', () => this.buf.key({ code: 'KeyA', ctrlKey: true }, this.os)], ['Time/Date    F5', () => this.buf.insert(new Date().toLocaleString())]],
        View: [[`Word wrap ${this.wrap ? '(on)' : '(off)'}`, () => { this.wrap = !this.wrap; }]] }[this.menuOpen];
      const mx = 8 + ['File', 'Edit', 'View'].indexOf(this.menuOpen) * 54;
      fillRR(g, mx, 32, 220, items.length * 32 + 8, 6, '#2c2c2c'); strokeRR(g, mx, 32, 220, items.length * 32 + 8, 6, LINE);
      items.forEach(([label, act], k) => {
        const y = 36 + k * 32;
        if (hov(this.os, this.win, mx + 4, y, 212, 30)) fillRR(g, mx + 4, y, 212, 30, 4, 'rgba(255,255,255,0.08)');
        font(g, 13); g.fillStyle = '#eee'; g.fillText(label, mx + 16, y + 20);
        this.kit.region(mx + 4, y, 212, 30, () => { this.menuOpen = null; act(); this.retitle(); });
      });
    }
    this.retitle();
  }
  caretLine() {
    const c = this.buf.caret;
    const L = this.lines || [{ start: 0, end: 0 }];
    for (let k = L.length - 1; k >= 0; k--) if (L[k].start <= c) return k;
    return 0;
  }
  placeCaret(x, y, shift) {
    if (!this.lines) return;
    const k = Math.max(0, Math.min(this.lines.length - 1, this.scroll + Math.floor((y - 42) / 20)));
    const L = this.lines[k];
    const col = Math.round((x - 14) / (this.cw || 9));
    this.buf.move(L.start + Math.max(0, Math.min(L.end - L.start, col)), shift);
  }
  update(dt) { this.blink += dt; return this.os.focus === this.win; }
  mouse(t, x, y, b, buttons) {
    if (t === 'down' || t === 'dbl') {
      if (this.menuOpen && !this.kit.find(x, y)) this.menuOpen = null;
      if (t === 'dbl' && y > 34) { this.buf.anchor = this.buf.wordLeft(); this.buf.caret = this.buf.wordRight(); return; }
      this.kit.click(x, y);
    } else if (t === 'move' && this.dragSel && (buttons & 1)) { if (this.buf.anchor === null) this.buf.anchor = this.buf.caret; const a = this.buf.anchor; this.placeCaret(x, y, true); this.buf.anchor = a; }
    else if (t === 'up') this.dragSel = false;
  }
  wheel(s) { this.scroll = Math.max(0, Math.min((this.lines?.length || 1) - 1, this.scroll + Math.sign(s) * 3)); }
  key(e) {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { this.save(); return; }
    if (e.code === 'F5') { this.buf.insert(new Date().toLocaleString()); return; }
    this.blink = 0;
    this.buf.key(e, this.os, true);
    this.retitle();
  }
  cursor(x, y) { return y > 34 && y < this.win.h - 58 ? 'text' : 'arrow'; }
}

// ------------------------------------------------------------------ calculator
export class Calc {
  static title = 'Calculator'; static icon = 'calc'; static w = 340; static h = 520; static single = true; static minW = 300; static minH = 460;
  constructor(os, win) { this.os = os; this.win = win; this.kit = new Kit(); this.v = '0'; this.acc = null; this.op = null; this.fresh = true; this.hist = ''; }
  press(k) {
    const num = parseFloat(this.v);
    if (/^[0-9]$/.test(k)) { this.v = this.fresh || this.v === '0' ? k : this.v + k; this.fresh = false; }
    else if (k === '.') { if (this.fresh) { this.v = '0.'; this.fresh = false; } else if (!this.v.includes('.')) this.v += '.'; }
    else if (k === 'C') { this.v = '0'; this.acc = null; this.op = null; this.hist = ''; this.fresh = true; }
    else if (k === 'CE') { this.v = '0'; this.fresh = true; }
    else if (k === '⌫') { this.v = this.v.length > 1 ? this.v.slice(0, -1) : '0'; }
    else if (k === '±') this.v = String(-num);
    else if (k === '%') this.v = String(num / 100);
    else if (k === '√') this.v = String(Math.sqrt(num));
    else if (k === 'x²') this.v = String(num * num);
    else if (k === '1/x') this.v = num === 0 ? 'Cannot divide by zero' : String(1 / num);
    else if ('+−×÷'.includes(k)) { if (this.acc !== null && !this.fresh) this.calc(); this.acc = parseFloat(this.v); this.op = k; this.hist = `${this.acc} ${k}`; this.fresh = true; }
    else if (k === '=') { if (this.op) { this.hist = `${this.acc} ${this.op} ${this.v} =`; this.calc(); this.op = null; this.acc = null; this.fresh = true; } }
    if (this.v.length > 16 && !isNaN(+this.v)) this.v = String(+(+this.v).toPrecision(12));
  }
  calc() {
    const b = parseFloat(this.v), a = this.acc;
    const r = this.op === '+' ? a + b : this.op === '−' ? a - b : this.op === '×' ? a * b : b === 0 ? NaN : a / b;
    this.v = isNaN(r) ? 'Cannot divide by zero' : String(+r.toPrecision(14));
  }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    font(g, 14, 600); g.fillStyle = '#fff'; g.fillText('Standard', 16, 28);
    font(g, 13); g.fillStyle = DIM; text(g, this.hist, w - 16, 70, w - 30, 'right');
    font(g, this.v.length > 12 ? 30 : 46, 600); g.fillStyle = '#fff'; text(g, this.v, w - 16, 124, w - 30, 'right');
    const keys = ['%', 'CE', 'C', '⌫', '1/x', 'x²', '√', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '='];
    const top = 146, bw = (w - 16) / 4, bh = (h - top - 8) / 6;
    const cur = clientCursor(this.os, this.win);
    keys.forEach((k, i) => {
      const x = 8 + (i % 4) * bw, y = top + Math.floor(i / 4) * bh;
      const isNum = /[0-9.±]/.test(k);
      const hv = inside(cur.x, cur.y, x + 2, y + 2, bw - 4, bh - 4);
      fillRR(g, x + 2, y + 2, bw - 4, bh - 4, 5, k === '=' ? (hv ? '#5cc8ff' : '#4cc2ff') : isNum ? (hv ? '#454545' : '#3b3b3b') : (hv ? '#3a3a3a' : '#323232'));
      font(g, 18, k === '=' ? 600 : 400); g.fillStyle = k === '=' ? '#000' : '#fff'; g.textAlign = 'center';
      g.fillText(k, x + bw / 2, y + bh / 2 + 6); g.textAlign = 'left';
      this.kit.region(x + 2, y + 2, bw - 4, bh - 4, () => this.press(k));
    });
  }
  mouse(t, x, y) { if (t === 'down' || t === 'dbl') this.kit.click(x, y); }
  key(e) {
    const map = { Enter: '=', NumpadEnter: '=', Escape: 'C', Backspace: '⌫', Delete: 'CE' };
    const k = map[e.code] || ({ '+': '+', '-': '−', '*': '×', '/': '÷', '=': '=', '.': '.', '%': '%' })[e.key] || (/^[0-9]$/.test(e.key) ? e.key : null);
    if (k) this.press(k);
  }
}

// ------------------------------------------------------------------ terminal
export class Terminal {
  static title = 'Command Prompt'; static icon = 'terminal'; static w = 860; static h = 500;
  constructor(os, win) {
    this.os = os; this.win = win;
    this.lines = [`Microsoft Windows [Version 10.0.22631.4317]`, `(c) Microsoft Corporation. All rights reserved.`, ``];
    this.cwd = `C:\\Users\\${os.user.name}`;
    this.buf = new TextBuf('');
    this.history = []; this.hi = 0; this.busy = null; this.blink = 0; this.scroll = 0;
  }
  out(s) { for (const l of String(s).split('\n')) this.lines.push(l); if (this.lines.length > 600) this.lines.splice(0, 100); this.scroll = 0; }
  run(cmd) {
    const os = this.os, hw = os.hw, r = os.g.router;
    this.out(`${this.cwd}>${cmd}`);
    const [c0, ...args] = cmd.trim().split(/\s+/);
    const c = (c0 || '').toLowerCase();
    if (!c) return;
    if (c === 'help') this.out('Commands: cls, dir, cd, echo, ipconfig, ping <host>, systeminfo, tasklist, taskkill /im <name>, netsh wlan show interfaces, whoami, hostname, date, time, ver, nvidia-smi, shutdown /s /r /t 0, exit');
    else if (c === 'cls') this.lines = [];
    else if (c === 'echo') this.out(args.join(' '));
    else if (c === 'whoami') this.out(`${hw.computerName.toLowerCase()}\\${os.user.name.toLowerCase()}`);
    else if (c === 'hostname') this.out(hw.computerName);
    else if (c === 'ver') this.out('Microsoft Windows [Version 10.0.22631.4317]');
    else if (c === 'date') this.out('The current date is: ' + new Date().toLocaleDateString());
    else if (c === 'time') this.out('The current time is: ' + new Date().toLocaleTimeString());
    else if (c === 'exit') os.close(this.win);
    else if (c === 'dir') { const files = Object.values(os.files).filter(f => f.type === 'file'); this.out(` Directory of ${this.cwd}\n`); for (const f of files) this.out(`${new Date(f.edited || Date.now()).toLocaleDateString().padEnd(12)}   ${String(f.content?.length || 0).padStart(8)} ${f.path.replace(/\//g, '\\')}`); this.out(`               ${files.length} File(s)`); }
    else if (c === 'cd') { if (args[0] === '..') this.cwd = this.cwd.split('\\').slice(0, -1).join('\\') || 'C:'; else if (args[0]) this.cwd += '\\' + args.join(' '); else this.out(this.cwd); }
    else if (c === 'ipconfig') {
      const st = r.status(true);
      this.out('\nWindows IP Configuration\n');
      if (st.link === 'ethernet') this.out(`Ethernet adapter Ethernet:\n\n   Connection-specific DNS Suffix  . : home\n   IPv4 Address. . . . . . . . . . . : 192.168.0.23\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.0.1\n`);
      else this.out('Ethernet adapter Ethernet:\n\n   Media State . . . . . . . . . . . : Media disconnected\n');
      if (st.link === 'wifi') this.out(`Wireless LAN adapter Wi-Fi:\n\n   IPv4 Address. . . . . . . . . . . : 192.168.0.31\n   Default Gateway . . . . . . . . . : 192.168.0.1\n`);
      else this.out('Wireless LAN adapter Wi-Fi:\n\n   Media State . . . . . . . . . . . : Media disconnected\n');
    } else if (c === 'ping') {
      const host = args.find(a => !a.startsWith('-')) || '8.8.8.8';
      const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : host === 'localhost' ? '127.0.0.1' : '142.250.' + (host.length * 7 % 200) + '.' + (host.length * 13 % 250);
      const local = ip.startsWith('192.168.') || ip.startsWith('127.');
      this.out(`\nPinging ${host === ip ? ip : host + ' [' + ip + ']'} with 32 bytes of data:`);
      let n = 0, ok = 0; const times = [];
      this.busy = setInterval(() => {
        const st = r.status(true);
        if (!st.link && !ip.startsWith('127.')) this.out('PING: transmit failed. General failure.');
        else if (!st.internet && !local) this.out('Request timed out.');
        else { const t = ip.startsWith('127.') ? 0 : local ? (st.link === 'wifi' ? 3 + Math.round(Math.random() * 4) : 1) : r.speed(true).ping; times.push(t); ok++; this.out(`Reply from ${ip}: bytes=32 time${t < 1 ? '<1' : '=' + t}ms TTL=${local ? 64 : 117}`); }
        r.touch(0.3);
        os.dirty = true;
        if (++n >= 4) {
          clearInterval(this.busy); this.busy = null;
          this.out(`\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = ${ok}, Lost = ${4 - ok} (${Math.round((4 - ok) / 4 * 100)}% loss),`);
          if (times.length) this.out(`Approximate round trip times in milli-seconds:\n    Minimum = ${Math.min(...times)}ms, Maximum = ${Math.max(...times)}ms, Average = ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`);
          this.out('');
        }
      }, 1000);
    } else if (c === 'systeminfo') {
      this.out(`\nHost Name:                 ${hw.computerName}\nOS Name:                   Microsoft ${hw.osName} Home\nSystem Manufacturer:       ${(hw.board || '').split(' ')[0]}\nProcessor(s):              ${hw.cpuName}\nTotal Physical Memory:     ${(hw.parts.ram.gb * 1024).toLocaleString()} MB\nGraphics:                  ${hw.parts.gpu.name}\nNetwork Card(s):           ${hw.netAdapter === 'wifi' ? 'Wi-Fi adapter' : 'Ethernet controller'}\n`);
    } else if (c === 'tasklist') {
      this.out('\nImage Name                     PID Session Name        Mem Usage\n========================= ======== ================ ============');
      for (const p of processes(os)) this.out(`${p.exe.padEnd(25)} ${String(p.pid).padStart(8)} Console          ${(p.mem * 1024).toFixed(0).padStart(9)} K`);
    } else if (c === 'taskkill') {
      const name = args[args.indexOf('/im') + 1] || args.at(-1);
      const w = os.windows.find(x => processes(os).find(p => p.win === x && p.exe.toLowerCase() === (name || '').toLowerCase()));
      if (w) { os.close(w); this.out(`SUCCESS: The process "${name}" has been terminated.`); } else this.out(`ERROR: The process "${name}" not found.`);
    } else if (c === 'netsh') {
      const st = r.status(true);
      if (st.link !== 'wifi') this.out('There is 1 interface on the system:\n\n    Name                   : Wi-Fi\n    State                  : disconnected\n');
      else this.out(`There is 1 interface on the system:\n\n    Name                   : Wi-Fi\n    State                  : connected\n    SSID                   : ${r.ssid}\n    Radio type             : 802.11ax\n    Signal                 : ${Math.round(r.signal() * 100)}%\n`);
    } else if (c === 'nvidia-smi') {
      const gname = hw.parts.gpu.name;
      if (!/nvidia/i.test(gname)) this.out("'nvidia-smi' is not recognized as an internal or external command,\noperable program or batch file.");
      else this.out(`+-----------------------------------------------------------------------------+\n| ${gname.padEnd(30)}  Temp ${Math.round(hw.temps.gpu)}C   Util ${Math.round(hw.load.gpu * 100)}%            |\n| Memory ${String(Math.round(hw.parts.gpu.vram * 1024 * (0.15 + hw.load.gpu * 0.6))).padStart(6)}MiB / ${String(hw.parts.gpu.vram * 1024).padStart(5)}MiB                                    |\n+-----------------------------------------------------------------------------+`);
    } else if (c === 'shutdown') {
      if (args.includes('/s')) os.shutdown(false); else if (args.includes('/r')) os.shutdown(true); else this.out('Usage: shutdown [/s] [/r] [/t xxx]');
    } else this.out(`'${c0}' is not recognized as an internal or external command,\noperable program or batch file.`);
  }
  draw(g, w, h) {
    g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, w, h);
    font(g, 14, 400, MONO); g.fillStyle = '#cccccc'; g.textAlign = 'left';
    const lh = 18;
    const all = [...this.lines];
    const prompt = this.busy ? '' : `${this.cwd}>`;
    all.push(prompt + this.buf.s);
    const vis = Math.floor((h - 16) / lh);
    const start = Math.max(0, all.length - vis - this.scroll);
    for (let k = start; k < Math.min(all.length, start + vis); k++) g.fillText(all[k], 10, 18 + (k - start) * lh);
    if (!this.busy && this.os.focus === this.win && Math.floor(this.blink * 2) % 2 === 0 && this.scroll === 0) {
      const cx = 10 + g.measureText(prompt + this.buf.s.slice(0, this.buf.caret)).width;
      g.fillRect(cx, 18 + (all.length - 1 - start) * lh + 3, 9, 3);
    }
  }
  update(dt) { this.blink += dt; return this.os.focus === this.win; }
  wheel(s) { this.scroll = Math.max(0, Math.min(this.lines.length, this.scroll - Math.sign(s) * 3)); }
  key(e) {
    if (this.busy) { if (e.ctrlKey && e.code === 'KeyC') { clearInterval(this.busy); this.busy = null; this.out('^C'); } return; }
    this.blink = 0;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { const c = this.buf.s; this.history.push(c); this.hi = this.history.length; this.buf = new TextBuf(''); this.run(c); return; }
    if (e.code === 'ArrowUp') { if (this.hi > 0) { this.hi--; this.buf = new TextBuf(this.history[this.hi]); } return; }
    if (e.code === 'ArrowDown') { if (this.hi < this.history.length - 1) { this.hi++; this.buf = new TextBuf(this.history[this.hi]); } else { this.hi = this.history.length; this.buf = new TextBuf(''); } return; }
    this.buf.key(e, this.os, false);
  }
  close() { if (this.busy) clearInterval(this.busy); }
  cursor() { return 'text'; }
}

// running processes (shared by Task Manager + tasklist)
export function processes(os) {
  const list = [];
  let pid = 1200;
  for (const w of os.windows) list.push({ name: w.title.replace(/^\*/, ''), exe: (w.app.constructor.exe || (w.appId + '.exe')), cpu: (w.app.cpuLoad || 0.004) * 100, mem: w.app.mem || 40 + (w.id * 37) % 160, gpu: (w.app.gpuLoad || 0) * 100, pid: pid + w.id * 4, win: w, app: true });
  const bg = [['Desktop Window Manager', 'dwm.exe', 0.6, 84, 1.2], ['Antimalware Service Executable', 'MsMpEng.exe', 0.3, 212, 0], ['Windows Explorer', 'explorer.exe', 0.2, 96, 0.2], ['Service Host: Network Service', 'svchost.exe', 0.1, 14, 0], ['System', 'System', 0.4, 0.1, 0], ['NETLINK Router Helper', 'nlhelper.exe', 0.05, 9, 0], ['Audio Device Graph Isolation', 'audiodg.exe', 0.2, 18, 0]];
  for (const [name, exe, c, m, gp] of bg) list.push({ name, exe, cpu: c + Math.random() * 0.3, mem: m, gpu: gp, pid: (pid += 92) });
  return list;
}

// ------------------------------------------------------------------ task manager
export class TaskMgr {
  static title = 'Task Manager'; static icon = 'taskmgr'; static w = 900; static h = 600; static single = true; static exe = 'Taskmgr.exe';
  constructor(os, win) { this.os = os; this.win = win; this.kit = new Kit(); this.tab = 'perf'; this.sel = 'CPU'; this.hist = { CPU: [], Memory: [], GPU: [], Net: [] }; this.t = 0; this.procs = processes(os); }
  update(dt) {
    this.t += dt;
    if (this.t < 1) return false;
    this.t = 0;
    const hw = this.os.hw, os = this.os;
    const push = (k, v) => { const a = this.hist[k]; a.push(v); if (a.length > 60) a.shift(); };
    push('CPU', hw.load.cpu * 100 * (0.85 + Math.random() * 0.3));
    push('Memory', 28 + os.windows.length * 3 + hw.load.gpu * 8);
    push('GPU', hw.load.gpu * 100 * (0.9 + Math.random() * 0.15));
    push('Net', Math.min(100, os.g.router.activity * 30));
    this.procs = processes(os);
    return true;
  }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    const cur = clientCursor(this.os, this.win);
    // left rail
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 200, h);
    [['procs', 'Processes'], ['perf', 'Performance'], ['startup', 'Startup apps']].forEach(([id, label], k) => {
      const y = 12 + k * 40;
      if (this.tab === id) { fillRR(g, 8, y, 184, 36, 4, 'rgba(255,255,255,0.07)'); fillRR(g, 8, y + 10, 3, 16, 2, '#4cc2ff'); }
      else if (inside(cur.x, cur.y, 8, y, 184, 36)) fillRR(g, 8, y, 184, 36, 4, 'rgba(255,255,255,0.04)');
      font(g, 13); g.fillStyle = '#eee'; g.fillText(label, 24, y + 23);
      this.kit.region(8, y, 184, 36, () => { this.tab = id; });
    });
    g.save(); g.translate(200, 0);
    if (this.tab === 'perf') this.drawPerf(g, w - 200, h, cur);
    else if (this.tab === 'procs') this.drawProcs(g, w - 200, h);
    else { font(g, 18, 600); g.fillStyle = '#fff'; g.fillText('Startup apps', 24, 40); font(g, 13); g.fillStyle = DIM; ['NETLINK Router Helper    Enabled    Low impact', 'Steam Client Bootstrapper    Enabled    High impact', 'Security notification icon    Enabled    Low impact'].forEach((l, k) => g.fillText(l, 24, 80 + k * 30)); }
    g.restore();
  }
  drawProcs(g, w, h) {
    font(g, 18, 600); g.fillStyle = '#fff'; g.fillText('Processes', 24, 40);
    const cols = [['Name', 24], ['CPU', w - 360], ['Memory', w - 270], ['GPU', w - 160], ['', w - 80]];
    font(g, 12); g.fillStyle = DIM; for (const [c, x] of cols) g.fillText(c, x, 76);
    g.fillStyle = LINE; g.fillRect(16, 84, w - 32, 1);
    this.procs.forEach((p, k) => {
      const y = 90 + k * 30;
      if (y > h - 20) return;
      font(g, 13); g.fillStyle = '#eee'; text(g, p.name, 24, y + 19, w - 420);
      const heat = (v, x) => { fillRR(g, x - 8, y + 2, 84, 26, 2, `rgba(255,190,60,${Math.min(0.5, v / 100 * 2 + 0.03)})`); g.fillStyle = '#eee'; g.fillText(v.toFixed(1) + ' %', x, y + 19); };
      heat(p.cpu, w - 360); g.fillStyle = '#eee'; g.fillText(p.mem.toFixed(1) + ' MB', w - 270, y + 19); heat(p.gpu, w - 160);
      if (p.app) this.kit.region(16, y, w - 32, 28, () => {});
    });
    font(g, 12); g.fillStyle = DIM; g.fillText('Select an app and press Delete to end it.', 24, h - 14);
  }
  drawPerf(g, w, h, cur) {
    const hw = this.os.hw, r = this.os.g.router;
    const st = r.status(true);
    const items = [['CPU', `${Math.round(this.hist.CPU.at(-1) || 0)}%  ${Math.round(hw.temps.cpu)} °C`, '#4cc2ff'], ['Memory', `${(hw.parts.ram.gb * (this.hist.Memory.at(-1) || 30) / 100).toFixed(1)}/${hw.parts.ram.gb} GB`, '#c084fc'],
      ['GPU', `${Math.round(this.hist.GPU.at(-1) || 0)}%  ${Math.round(hw.temps.gpu)} °C`, '#4ade80'], ['Net', st.link ? (st.link === 'wifi' ? 'Wi-Fi' : 'Ethernet') + (st.internet ? '' : ' (no internet)') : 'Not connected', '#f59e0b']];
    items.forEach(([k, sub, col], i) => {
      const y = 12 + i * 64;
      if (this.sel === k) fillRR(g, 8, y, 210, 58, 4, 'rgba(255,255,255,0.07)');
      spark(g, 16, y + 8, 60, 40, this.hist[k], col);
      font(g, 14); g.fillStyle = '#fff'; g.fillText(k === 'Net' ? (st.link === 'wifi' ? 'Wi-Fi' : 'Ethernet') : k, 88, y + 26);
      font(g, 11.5); g.fillStyle = DIM; text(g, sub, 88, y + 44, 126);
      this.kit.region(8, y, 210, 58, () => { this.sel = k; });
    });
    const x0 = 236, gw = w - x0 - 24;
    const titles = { CPU: ['CPU', hw.cpuName], Memory: ['Memory', `${hw.parts.ram.gb} GB`], GPU: ['GPU', hw.parts.gpu.name], Net: [st.link === 'wifi' ? 'Wi-Fi' : 'Ethernet', st.link === 'wifi' ? r.ssid : 'Ethernet controller'] };
    const [t1, t2] = titles[this.sel];
    font(g, 26, 600); g.fillStyle = '#fff'; g.fillText(t1, x0, 44);
    font(g, 14); g.fillStyle = '#eee'; text(g, t2, x0 + gw, 44, gw - 160, 'right');
    const col = items.find(i => i[0] === this.sel)[2];
    font(g, 12); g.fillStyle = DIM; g.fillText(this.sel === 'Memory' ? 'Memory usage' : '% Utilization', x0, 74);
    strokeRR(g, x0, 82, gw, h - 250, 0, col, 1);
    spark(g, x0, 82, gw, h - 250, this.hist[this.sel], col, true);
    const rows = this.sel === 'CPU' ? [['Utilization', `${Math.round(this.hist.CPU.at(-1) || 0)}%`], ['Temperature', `${Math.round(hw.temps.cpu)} °C`], ['Logical processors', hw.threads], ['Processes', this.procs.length]]
      : this.sel === 'GPU' ? [['Utilization', `${Math.round(this.hist.GPU.at(-1) || 0)}%`], ['GPU Temperature', `${Math.round(hw.temps.gpu)} °C${hw.temps.gpu > 85 ? '  (hot!)' : ''}`], ['Dedicated memory', `${hw.parts.gpu.vram || 0} GB`], ['Dust in the case', `${Math.round(hw.dust * 100)}%`]]
        : this.sel === 'Memory' ? [['In use', `${(hw.parts.ram.gb * (this.hist.Memory.at(-1) || 30) / 100).toFixed(1)} GB`], ['Slots used', `${hw.parts.ram.sticks} of 4`], ['Speed', '3200 MT/s']]
          : [['Send', st.internet ? `${(r.activity * 300).toFixed(0)} Kbps` : '0 Kbps'], ['Receive', st.internet ? `${(r.activity * 2400).toFixed(0)} Kbps` : '0 Kbps'], ['IPv4 address', st.link ? (st.link === 'wifi' ? '192.168.0.31' : '192.168.0.23') : '-'], ['Signal strength', st.link === 'wifi' ? `${Math.round(r.signal() * 100)}%` : '-']];
    rows.forEach(([a, b], k) => { font(g, 12); g.fillStyle = DIM; g.fillText(a, x0 + (k % 2) * 260, h - 140 + Math.floor(k / 2) * 52); font(g, 20, 600); g.fillStyle = '#fff'; g.fillText(String(b), x0 + (k % 2) * 260, h - 116 + Math.floor(k / 2) * 52); });
    void cur;
  }
  mouse(t, x, y) { if (t === 'down') this.kit.click(x, y); }
}

function spark(g, x, y, w, h, data, col, big) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (big) { g.strokeStyle = 'rgba(255,255,255,0.06)'; for (let k = 1; k < 10; k++) { g.beginPath(); g.moveTo(x + w * k / 10, y); g.lineTo(x + w * k / 10, y + h); g.moveTo(x, y + h * k / 10); g.lineTo(x + w, y + h * k / 10); g.stroke(); } }
  if (data.length > 1) {
    g.beginPath();
    data.forEach((v, k) => { const px = x + w - (data.length - 1 - k) * (w / 59), py = y + h - Math.min(100, v) / 100 * h; if (k) g.lineTo(px, py); else g.moveTo(px, py); });
    g.strokeStyle = col; g.lineWidth = big ? 1.5 : 1; g.stroke();
    g.lineTo(x + w, y + h); g.lineTo(x + w - (data.length - 1) * (w / 59), y + h); g.closePath();
    g.globalAlpha = 0.15; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
  }
  if (!big) strokeRR(g, x, y, w, h, 0, col);
  g.restore();
}

// ------------------------------------------------------------------ settings
export class Settings {
  static title = 'Settings'; static icon = 'settings'; static w = 980; static h = 640; static single = true; static exe = 'SystemSettings.exe';
  constructor(os, win, a) { this.os = os; this.win = win; this.kit = new Kit(); this.page = a.page || 'system'; this.nameBuf = null; }
  draw(g, w, h) {
    this.kit.begin();
    const os = this.os, hw = os.hw;
    const cur = clientCursor(os, this.win);
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    g.drawImage(icon('user', 56), 20, 16, 56, 56);
    font(g, 15, 600); g.fillStyle = '#fff'; text(g, os.user.name, 88, 40, 170);
    font(g, 12); g.fillStyle = DIM; g.fillText('Local account', 88, 60);
    const pages = [['system', 'System'], ['network', 'Network & internet'], ['personal', 'Personalization'], ['accounts', 'Accounts'], ['time', 'Time & language'], ['display', 'Display'], ['about', 'About']];
    pages.forEach(([id, label], k) => {
      const y = 96 + k * 38;
      if (this.page === id) { fillRR(g, 12, y, 256, 34, 4, 'rgba(255,255,255,0.07)'); fillRR(g, 12, y + 9, 3, 16, 2, '#4cc2ff'); }
      else if (inside(cur.x, cur.y, 12, y, 256, 34)) fillRR(g, 12, y, 256, 34, 4, 'rgba(255,255,255,0.04)');
      font(g, 13); g.fillStyle = '#eee'; g.fillText(label, 28, y + 22);
      this.kit.region(12, y, 256, 34, () => { this.page = id; });
    });
    const x = 300, cw = w - x - 30;
    let y = 50;
    const head = (t) => { font(g, 26, 600); g.fillStyle = '#fff'; g.fillText(t, x, y); y += 30; };
    const card = (title, sub, right, act) => {
      fillRR(g, x, y, cw, 62, 6, PANEL);
      if (act && inside(cur.x, cur.y, x, y, cw, 62)) fillRR(g, x, y, cw, 62, 6, 'rgba(255,255,255,0.05)');
      font(g, 14); g.fillStyle = '#fff'; text(g, title, x + 20, y + 27, cw - 260);
      font(g, 12); g.fillStyle = DIM; text(g, sub, x + 20, y + 46, cw - 260);
      if (right) { font(g, 13); g.fillStyle = '#ddd'; text(g, right, x + cw - 20, y + 36, 300, 'right'); }
      if (act) this.kit.region(x, y, cw, 62, act);
      y += 68;
    };
    const p = this.page;
    if (p === 'system' || p === 'about') {
      head(p === 'about' ? 'About' : 'System');
      if (p === 'system') {
        fillRR(g, x, y, cw, 120, 8, PANEL);
        g.drawImage(icon('pc', 90), x + 20, y + 15, 90, 90);
        font(g, 20, 600); g.fillStyle = '#fff'; g.fillText(hw.computerName, x + 130, y + 52);
        font(g, 13); g.fillStyle = DIM; g.fillText(`${hw.osName}  ·  ${hw.parts.gpu.name}`, x + 130, y + 78);
        y += 136;
      }
      card('Device name', hw.computerName, '', null);
      card('Processor', hw.cpuName, '', null);
      card('Installed RAM', `${hw.parts.ram.gb} GB${hw.parts.ram.yours && !hw.ramExact ? '  (scan your PC for the exact amount)' : ''}`, `${hw.parts.ram.sticks} sticks`, null);
      card('Graphics card', hw.parts.gpu.name + (hw.parts.gpu.yours ? '  (your real one)' : '  (swapped in)'), hw.parts.gpu.vram ? hw.parts.gpu.vram + ' GB' : 'shared', null);
      card('Edition', hw.osName + ' Home', '', null);
      if (p === 'about') card('Motherboard', hw.board, '', null);
    } else if (p === 'network') {
      head('Network & internet');
      const r = os.g.router, st = r.status(true);
      fillRR(g, x, y, cw, 110, 8, PANEL);
      g.drawImage(os.netIcon(64), x + 24, y + 22, 64, 64);
      font(g, 18, 600); g.fillStyle = '#fff'; g.fillText(st.link === 'ethernet' ? 'Ethernet' : st.link === 'wifi' ? r.ssid : 'Not connected', x + 110, y + 48);
      font(g, 13); g.fillStyle = st.internet ? '#6ccb5f' : '#ffd166';
      g.fillText(st.internet ? 'Connected, secured' : st.link ? (st.state === 'connecting' ? 'Identifying… (the router is still getting online)' : 'No internet. Check the cables on the router.') : 'No network. The ethernet cable is unplugged and Wi-Fi isn\'t connected.', x + 110, y + 74);
      y += 126;
      const sp = r.speed(true);
      card('Internet plan', r.plan.name, st.internet ? `ping ~${sp.ping} ms` : '', null);
      card('Wi-Fi', st.link === 'wifi' ? `Connected to ${r.ssid}  ·  Signal ${Math.round(r.signal() * 100)}%` : (r.pcKnowsWifi ? 'Available' : 'Password needed (it\'s on the router sticker)'), '', null);
      card('Ethernet', r.lan ? 'Cable plugged in' : 'Cable unplugged', '', null);
      card('Network troubleshooter', 'Find and fix problems', 'Run ›', () => {
        const msg = !r.power ? 'The router has no power. Plug its power cable back in.' : !r.wan ? 'The router\'s internet cable (coax) is unplugged.' : !r.booted() ? 'The router is still starting up. Give it a minute.' : !r.realOnline ? 'Your real internet is down, so the in-game internet is down too.' : r.outage > 0 ? 'Your internet provider is having an outage. It should come back in a few minutes.' : !st.link ? 'No connection between the PC and the router. Plug in the ethernet cable or connect to Wi-Fi.' : 'Everything looks fine.';
        os.msgbox('Network troubleshooter', msg, { kind: msg.startsWith('Everything') ? 'info' : 'warn' });
      });
    } else if (p === 'personal') {
      head('Personalization');
      card('Background', os.realWallpaper ? 'Your real wallpaper (from the scan)' : 'Default', 'Change ›', () => { os.useDefaultWp = !os.useDefaultWp; os.setWallpaper(os.useDefaultWp ? null : os.realWallpaper); });
      card('Mode', os.theme.dark ? 'Dark' : 'Light', 'Toggle ›', () => { os.theme.dark = !os.theme.dark; if (!os.realWallpaper || os.useDefaultWp) os.setWallpaper(null); os.save(); });
      card('Taskbar alignment', os.theme.align === 'left' ? 'Left' : 'Center', 'Toggle ›', () => { os.theme.align = os.theme.align === 'left' ? 'center' : 'left'; os.save(); });
      font(g, 13); g.fillStyle = '#fff'; g.fillText('Accent color', x, y + 18); y += 30;
      ['#4cc2ff', '#0078d4', '#e3008c', '#ff8c00', '#00cc6a', '#8764b8', '#e81123', '#ffb900'].forEach((c, k) => {
        g.fillStyle = c; g.beginPath(); g.arc(x + 20 + k * 44, y + 18, 16, 0, Math.PI * 2); g.fill();
        if (os.theme.accent === c) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x + 20 + k * 44, y + 18, 19, 0, Math.PI * 2); g.stroke(); }
        this.kit.region(x + 4 + k * 44, y + 2, 32, 32, () => { os.theme.accent = c; os.save(); });
      });
    } else if (p === 'accounts') {
      head('Accounts');
      card('Your name', this.nameBuf ? this.nameBuf.s + '|' : os.user.name, this.nameBuf ? 'Enter to save' : 'Edit ›', () => { this.nameBuf = new TextBuf(os.user.name); });
      card('Sign-in options', 'No password (it\'s your room)', '', null);
    } else if (p === 'time') {
      head('Time & language');
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      card('Current time', new Date().toLocaleString(), '', null);
      card('Time zone', tz + '  (from your real PC)', '', null);
      card('Language', navigator.language, '', null);
    } else if (p === 'display') {
      head('Display');
      os.displays.forEach((d, k) => card(`Display ${k + 1}`, `${d.mon.res[0]} × ${d.mon.res[1]}  ·  ${k === 0 ? '27"' : '24"'} monitor`, k === 0 ? 'Main display' : 'Extend', null));
      card('Your real screen', hw.screen, '', null);
    }
  }
  mouse(t, x, y) { if (t === 'down') this.kit.click(x, y); }
  key(e) {
    if (this.nameBuf) {
      if (e.code === 'Enter') { const n = this.nameBuf.s.trim().slice(0, 24); if (n) this.os.user.name = n; this.nameBuf = null; this.os.save(); }
      else if (e.code === 'Escape') this.nameBuf = null;
      else this.nameBuf.key(e, this.os, false);
    }
  }
}

// ------------------------------------------------------------------ file explorer
export class Explorer {
  static title = 'File Explorer'; static icon = 'folder'; static w = 980; static h = 600; static exe = 'explorer.exe';
  constructor(os, win, a) { this.os = os; this.win = win; this.kit = new Kit(); this.loc = a.path === 'pc' ? 'pc' : a.path === 'bin' ? 'bin' : (a.path || 'home'); this.sel = -1; this.retitle(); }
  retitle() { this.win.title = { home: 'Home', pc: 'This PC', bin: 'Recycle Bin' }[this.loc] || this.loc; }
  items() {
    const os = this.os;
    if (this.loc === 'home' || this.loc === 'pc') return null;
    if (this.loc === 'bin') return [];
    if (this.loc === 'Desktop') return (os.desktopItems || []).filter(i => i.app !== 'explorer').map(i => ({ name: i.name, it: i }));
    return Object.values(os.files).filter(f => f.path.startsWith(this.loc + '/')).map(f => ({ name: f.name, file: f }));
  }
  draw(g, w, h) {
    this.kit.begin();
    const os = this.os, cur = clientCursor(os, this.win);
    g.fillStyle = '#191919'; g.fillRect(0, 0, w, h);
    // address bar
    g.fillStyle = BG; g.fillRect(0, 0, w, 50);
    fillRR(g, 110, 10, w - 340, 30, 4, '#2b2b2b');
    font(g, 13); g.fillStyle = '#eee'; text(g, '  ›  ' + (this.loc === 'home' ? 'Home' : this.loc === 'pc' ? 'This PC' : this.loc === 'bin' ? 'Recycle Bin' : `This PC  ›  Local Disk (C:)  ›  Users  ›  ${os.user.name}  ›  ${this.loc}`), 118, 30, w - 360);
    fillRR(g, w - 220, 10, 200, 30, 4, '#2b2b2b'); g.fillStyle = DIM; g.fillText('Search', w - 206, 30);
    g.fillStyle = '#ddd'; font(g, 18); g.fillText('←', 18, 32); g.fillText('↑', 64, 32);
    this.kit.region(10, 10, 40, 30, () => { this.loc = 'home'; this.retitle(); });
    this.kit.region(56, 10, 40, 30, () => { this.loc = this.loc === 'home' ? 'home' : 'pc'; this.retitle(); });
    // sidebar
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 50, 210, h - 50);
    const side = [['home', 'Home', 'folder'], ['Desktop', 'Desktop', 'pc'], ['Documents', 'Documents', 'folder'], ['Downloads', 'Downloads', 'folder'], ['Pictures', 'Pictures', 'image'], ['Music', 'Music', 'folder'], ['Videos', 'Videos', 'folder'], ['pc', 'This PC', 'pc']];
    side.forEach(([id, label, ic], k) => {
      const y = 60 + k * 32;
      if (this.loc === id) fillRR(g, 8, y, 194, 30, 4, 'rgba(255,255,255,0.08)');
      else if (inside(cur.x, cur.y, 8, y, 194, 30)) fillRR(g, 8, y, 194, 30, 4, 'rgba(255,255,255,0.04)');
      g.drawImage(icon(ic, 18), 18, y + 6, 18, 18);
      font(g, 13); g.fillStyle = '#eee'; g.fillText(label, 46, y + 20);
      this.kit.region(8, y, 194, 30, () => { this.loc = id; this.sel = -1; this.retitle(); });
    });
    const x0 = 230, y0 = 70;
    if (this.loc === 'home' || this.loc === 'pc') {
      font(g, 15, 600); g.fillStyle = '#fff'; g.fillText(this.loc === 'pc' ? 'Devices and drives' : 'Quick access', x0, y0 + 10);
      if (this.loc === 'home') {
        ['Desktop', 'Documents', 'Downloads', 'Pictures'].forEach((f, k) => {
          const x = x0 + k * 170, y = y0 + 30;
          if (inside(cur.x, cur.y, x, y, 160, 70)) fillRR(g, x, y, 160, 70, 6, 'rgba(255,255,255,0.05)');
          g.drawImage(icon(f === 'Pictures' ? 'image' : 'folder', 40), x + 10, y + 15, 40, 40);
          font(g, 13); g.fillStyle = '#fff'; g.fillText(f, x + 60, y + 32); font(g, 11); g.fillStyle = DIM; g.fillText('Stored locally', x + 60, y + 50);
          this.kit.region(x, y, 160, 70, () => { this.loc = f; this.retitle(); });
        });
      }
      const dy = this.loc === 'home' ? y0 + 140 : y0 + 30;
      if (this.loc === 'home') { font(g, 15, 600); g.fillStyle = '#fff'; g.fillText('Drives', x0, dy - 8); }
      os.hw.drives.forEach((d, k) => {
        const x = x0 + (k % 2) * 340, y = dy + Math.floor(k / 2) * 80;
        fillRR(g, x, y, 320, 70, 6, 'rgba(255,255,255,0.04)');
        g.drawImage(icon('drive', 44), x + 10, y + 13, 44, 44);
        font(g, 13); g.fillStyle = '#fff'; text(g, `${d.name || 'Local Disk'} (${d.letter})`, x + 66, y + 24, 240);
        const used = 1 - (d.free / d.size || 0);
        fillRR(g, x + 66, y + 34, 230, 12, 2, '#3a3a3a'); fillRR(g, x + 66, y + 34, 230 * used, 12, 2, used > 0.9 ? '#e81123' : '#4cc2ff');
        font(g, 11); g.fillStyle = DIM; g.fillText(`${fmtGB(d.free)} free of ${fmtGB(d.size)}`, x + 66, y + 62);
      });
      return;
    }
    const items = this.items();
    if (!items.length) { font(g, 13); g.fillStyle = DIM; g.fillText(this.loc === 'bin' ? 'Recycle Bin is empty.' : 'This folder is empty.', x0 + 200, y0 + 60); return; }
    items.forEach((it, k) => {
      const x = x0 + (k % 6) * 120, y = y0 + Math.floor(k / 6) * 120;
      if (k === this.sel) fillRR(g, x, y, 112, 112, 4, 'rgba(76,194,255,0.25)');
      else if (inside(cur.x, cur.y, x, y, 112, 112)) fillRR(g, x, y, 112, 112, 4, 'rgba(255,255,255,0.05)');
      const img = it.it ? os.itemIcon(it.it, 56) : icon(it.file.app === 'notepad' ? 'notepad' : 'file', 56);
      g.drawImage(img, x + 28, y + 10, 56, 56);
      font(g, 12); g.fillStyle = '#eee'; text(g, it.name, x + 56, y + 86, 104, 'center');
      this.kit.region(x, y, 112, 112, () => { this.sel = k; });
    });
  }
  mouse(t, x, y) {
    if (t === 'down') this.kit.click(x, y);
    if (t === 'dbl') {
      this.kit.click(x, y);
      const items = this.items();
      const it = items && items[this.sel];
      if (it?.file) this.os.open(it.file.app || 'notepad', { path: it.file.path });
      else if (it?.it) this.os.launch(it.it);
    }
  }
}
const fmtGB = (b) => b >= 1e12 ? (b / 1e12).toFixed(1) + ' TB' : Math.round(b / 1e9) + ' GB';

// ------------------------------------------------------------------ a real app from your PC
// It's your real program, so it can't run inside the game. Opening it shows its launch splash
// and then says so plainly.
export class RealApp {
  static title = 'App'; static icon = 'game'; static w = 640; static h = 400;
  constructor(os, win, a) { this.os = os; this.win = win; this.a = a; this.t = 0; this.kit = new Kit(); this.cpuLoad = 0.15; }
  update(dt) { this.t += dt; if (this.t > 2.5) this.cpuLoad = 0.01; return this.t < 3; }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h);
    const img = this.os.itemIcon(this.a.item || this.win, 96);
    g.drawImage(img, w / 2 - 48, h / 2 - 110, 96, 96);
    font(g, 18, 600); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(this.win.title, w / 2, h / 2 + 18);
    if (this.t < 2.5) {
      for (let k = 0; k < 3; k++) { g.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(this.t * 5 - k * 0.6)); g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 - 16 + k * 16, h / 2 + 50, 4, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    } else {
      font(g, 13); g.fillStyle = '#bbb';
      g.fillText('This is your real app. It lives on your real PC, so it can\'t run in here.', w / 2, h / 2 + 52);
      g.fillText('The games marked PLAYABLE in the library run for real inside the in-game PC.', w / 2, h / 2 + 74);
      this.kit.button(g, clientCursor(this.os, this.win), w / 2 - 50, h - 60, 100, 32, 'Close', () => this.os.close(this.win), { primary: true });
    }
    g.textAlign = 'left';
  }
  mouse(t, x, y) { if (t === 'down') this.kit.click(x, y); }
}

// ------------------------------------------------------------------ scan help
export class ScanHelp {
  static title = 'Scan my real PC'; static icon = 'pc'; static w = 720; static h = 470; static single = true;
  constructor(os, win) { this.os = os; this.win = win; this.kit = new Kit(); }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    font(g, 22, 600); g.fillStyle = '#fff'; g.fillText('Bring your real PC in here', 30, 46);
    font(g, 13.5); g.fillStyle = '#ccc';
    const lines = [
      '1.  Click "Download scanner". A small file called battlestation-scan.bat downloads.',
      '2.  Double-click it. Windows may warn you once ("Keep" in Chrome, then "More info" -> "Run anyway").',
      '3.  Done. This game picks it up by itself: your taskbar, desktop, wallpaper, Start apps,',
      '     Steam + Epic games and your exact parts show up on this PC.',
      '',
      'The scanner only READS names, icons and your wallpaper. It doesn\'t change anything,',
      'doesn\'t install anything and doesn\'t send anything anywhere. It writes one file',
      '(battlestation-mypc.js) next to this game. You can open the .bat in Notepad to read it.',
    ];
    lines.forEach((l, k) => g.fillText(l, 30, 90 + k * 24));
    const scan = this.os.g.scanner;
    const st = scan?.status || '';
    if (st) { font(g, 13, 600); g.fillStyle = scan.ok ? '#6ccb5f' : '#ffd166'; text(g, st, 30, h - 80, w - 60); }
    this.kit.button(g, clientCursor(this.os, this.win), 30, h - 60, 200, 36, 'Download scanner', () => scan?.download(), { primary: true });
    this.kit.button(g, clientCursor(this.os, this.win), 244, h - 60, 140, 36, 'Close', () => this.os.close(this.win));
  }
  update() { return true; }
  mouse(t, x, y) { if (t === 'down') this.kit.click(x, y); }
}

// ------------------------------------------------------------------ paint
export class Paint {
  static title = 'Paint'; static icon = 'paint'; static w = 900; static h = 620;
  constructor(os, win) {
    this.os = os; this.win = win; this.kit = new Kit();
    this.c = document.createElement('canvas'); this.c.width = 1400; this.c.height = 900;
    this.cx = this.c.getContext('2d'); this.cx.fillStyle = '#fff'; this.cx.fillRect(0, 0, 1400, 900);
    this.color = '#111111'; this.size = 4; this.last = null;
  }
  draw(g, w, h) {
    this.kit.begin();
    g.fillStyle = BG; g.fillRect(0, 0, w, h);
    const cols = ['#111111', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#9e9e9e'];
    cols.forEach((c, k) => {
      g.fillStyle = c; g.beginPath(); g.arc(24 + k * 30, 28, 11, 0, Math.PI * 2); g.fill();
      if (this.color === c) { g.strokeStyle = '#4cc2ff'; g.lineWidth = 2; g.beginPath(); g.arc(24 + k * 30, 28, 14, 0, Math.PI * 2); g.stroke(); }
      this.kit.region(10 + k * 30, 14, 28, 28, () => { this.color = c; });
    });
    [2, 4, 8, 16, 32].forEach((s, k) => {
      const x = 340 + k * 34;
      fillRR(g, x, 12, 30, 32, 4, this.size === s ? 'rgba(76,194,255,0.3)' : 'rgba(255,255,255,0.06)');
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 15, 28, Math.min(12, s / 2 + 1), 0, Math.PI * 2); g.fill();
      this.kit.region(x, 12, 30, 32, () => { this.size = s; });
    });
    this.kit.button(g, clientCursor(this.os, this.win), 530, 12, 80, 32, 'Clear', () => { this.cx.fillStyle = '#fff'; this.cx.fillRect(0, 0, 1400, 900); });
    g.drawImage(this.c, 0, 0, w - 20, h - 76, 10, 56, w - 20, h - 76);
    strokeRR(g, 10, 56, w - 20, h - 76, 0, LINE);
  }
  paintAt(x, y) {
    const px = x - 10, py = y - 56;
    if (px < 0 || py < 0) { this.last = null; return; }
    const c = this.cx;
    c.strokeStyle = this.color; c.lineWidth = this.size; c.lineCap = 'round';
    c.beginPath();
    if (this.last) c.moveTo(this.last.x, this.last.y); else c.moveTo(px, py);
    c.lineTo(px, py); c.stroke();
    this.last = { x: px, y: py };
  }
  mouse(t, x, y, b, buttons) {
    if (t === 'down') { if (!this.kit.click(x, y)) { this.drawing = true; this.last = null; this.paintAt(x, y); } }
    else if (t === 'move' && this.drawing && (buttons & 1)) this.paintAt(x, y);
    else if (t === 'up') { this.drawing = false; this.last = null; }
  }
  cursor(x, y) { return y > 56 ? 'cross' : 'arrow'; }
}
