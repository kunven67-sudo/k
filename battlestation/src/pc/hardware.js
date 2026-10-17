// What's in your PC: detected from your REAL machine (what a browser is allowed to see),
// upgraded with exact parts if you ran the scanner, plus spare parts you can swap in.
import { gpuClass } from '../world/pctower.js';

// performance score: GT 1030 = 10
export const GPU_DB = [
  ['Intel UHD Graphics', 4, 0, 15], ['Intel Iris Xe Graphics', 7, 0, 20], ['AMD Radeon Graphics', 8, 0, 25],
  ['NVIDIA GeForce GT 710', 3, 2, 19], ['NVIDIA GeForce GT 730', 4, 2, 38], ['NVIDIA GeForce GT 1030', 10, 2, 30],
  ['NVIDIA GeForce GTX 750 Ti', 12, 2, 60], ['NVIDIA GeForce GTX 1050 Ti', 18, 4, 75], ['NVIDIA GeForce GTX 1060', 26, 6, 120],
  ['NVIDIA GeForce GTX 1650', 24, 4, 75], ['NVIDIA GeForce GTX 1660 SUPER', 34, 6, 125], ['NVIDIA GeForce RTX 2060', 42, 6, 160],
  ['NVIDIA GeForce RTX 3050', 38, 8, 130], ['NVIDIA GeForce RTX 3060', 52, 12, 170], ['NVIDIA GeForce RTX 3070', 75, 8, 220],
  ['NVIDIA GeForce RTX 4060', 60, 8, 115], ['NVIDIA GeForce RTX 4070', 95, 12, 200], ['NVIDIA GeForce RTX 4080', 140, 16, 320],
  ['NVIDIA GeForce RTX 4090', 190, 24, 450], ['NVIDIA GeForce RTX 5070', 110, 12, 250], ['NVIDIA GeForce RTX 5090', 260, 32, 575],
  ['AMD Radeon RX 550', 9, 2, 50], ['AMD Radeon RX 580', 30, 8, 185], ['AMD Radeon RX 6600', 55, 8, 132],
  ['AMD Radeon RX 6700 XT', 75, 12, 230], ['AMD Radeon RX 7800 XT', 110, 16, 263], ['AMD Radeon RX 7900 XTX', 160, 24, 355],
].map(([name, score, vram, watts]) => ({ name, score, vram, watts, cls: gpuClass(name) }));

export function parseGpu(raw) {
  // "ANGLE (NVIDIA, NVIDIA GeForce GT 1030 (0x00001D01) Direct3D11 vs_5_0 ps_5_0, D3D11)"
  let s = String(raw || '');
  const m = s.match(/^ANGLE \(([^,]*),\s*(.*?)(?:,\s*[^,]*\))?$/);
  if (m) s = m[2];
  s = s.replace(/\(0x[0-9a-f]+\)/ig, '').replace(/Direct3D.*$/i, '').replace(/OpenGL.*$/i, '').replace(/vs_\d.*$/i, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\(R\)|\(TM\)/g, '').trim();
  return s || 'Unknown graphics';
}

export function gpuInfo(name) {
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const g of GPU_DB) {
    const key = g.name.toLowerCase().replace(/^(nvidia|amd) (geforce |radeon )?/, '');
    if (n.includes(key)) { if (!best || key.length > best.key) best = { g, key: key.length }; }
  }
  if (best) return { ...best.g, name };
  // unknown: guess from the series number
  const rtx = n.match(/rtx ?(\d)0(\d)0/);
  if (rtx) return { name, score: 30 + (+rtx[1] - 2) * 25 + +rtx[2] * 18, vram: 8, watts: 200, cls: gpuClass(name) };
  if (/intel|uhd|iris/.test(n)) return { name, score: 5, vram: 0, watts: 15, cls: 'igpu' };
  return { name, score: 20, vram: 4, watts: 120, cls: gpuClass(name) };
}

export class Hardware {
  constructor(game) {
    this.g = game;
    const raw = game.renderer.gpuName();
    this.gpuRaw = raw;
    this.realGpu = gpuInfo(parseGpu(raw));
    this.threads = navigator.hardwareConcurrency || 4;
    this.ramGB = navigator.deviceMemory ? (navigator.deviceMemory >= 8 ? 16 : navigator.deviceMemory) : 16;
    this.ramExact = false;
    this.cpuName = `${this.threads}-thread processor`;
    this.os = /Windows/.test(navigator.userAgent) ? 'Windows' : (/Mac/.test(navigator.platform) ? 'macOS' : 'Linux');
    this.osName = this.os === 'Windows' ? 'Windows 11' : this.os;
    this.screen = `${Math.round(screen.width * devicePixelRatio)} x ${Math.round(screen.height * devicePixelRatio)}`;
    this.board = 'Motherboard';
    this.drives = [{ letter: 'C:', name: 'Local Disk', size: 512e9, free: 180e9, model: 'NVMe SSD' }];
    this.computerName = 'DESKTOP-' + (raw.length * 7919 % 0xfffff).toString(16).toUpperCase().padStart(5, '0') + 'K';
    this.ramSticks = 2;
    this.netAdapter = 'ethernet';
    if (navigator.userAgentData?.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['platformVersion']).then(v => {
        if (this.os === 'Windows' && v.platformVersion) this.osName = parseInt(v.platformVersion) >= 13 ? 'Windows 11' : 'Windows 10';
      }).catch(() => {});
    }
    // what's physically in the in-game tower right now
    this.parts = { gpu: { ...this.realGpu, yours: true }, ram: { sticks: this.ramSticks, gb: this.ramGB, yours: true } };
    // the box of spare parts in the closet
    this.box = [
      { kind: 'gpu', ...gpuInfo('NVIDIA GeForce RTX 4070'), id: 'g4070' },
      { kind: 'gpu', ...gpuInfo('NVIDIA GeForce RTX 3060'), id: 'g3060' },
      { kind: 'gpu', ...gpuInfo('AMD Radeon RX 7800 XT'), id: 'g7800' },
      { kind: 'gpu', ...gpuInfo('NVIDIA GeForce RTX 4090'), id: 'g4090' },
      { kind: 'ram', sticks: 4, gb: 32, id: 'ram32', name: '32 GB (4 x 8 GB) DDR4-3600' },
    ];
    this.temps = { cpu: 32, gpu: 30 };
    this.load = { cpu: 0.02, gpu: 0.01 };
    this.dust = 0;
    this.time = 0;
  }

  // the scanner's file tells us the exact parts
  applyScan(s) {
    if (!s || !s.hw) return;
    const h = s.hw;
    if (h.cpu) this.cpuName = h.cpu;
    if (h.threads) this.threads = h.threads;
    if (h.ramGB) { this.ramGB = Math.round(h.ramGB); this.ramExact = true; }
    if (h.ramSticks) this.ramSticks = h.ramSticks;
    if (h.gpu) { this.realGpu = { ...gpuInfo(h.gpu), vram: h.vramGB || gpuInfo(h.gpu).vram }; }
    if (h.board) this.board = h.board;
    if (h.os) this.osName = h.os.replace(/^Microsoft /, '');
    if (h.computer) this.computerName = h.computer;
    if (h.drives?.length) this.drives = h.drives;
    if (h.net) this.netAdapter = h.net;
    if (this.parts.gpu.yours) this.parts.gpu = { ...this.realGpu, yours: true };
    if (this.parts.ram.yours) this.parts.ram = { sticks: this.ramSticks, gb: this.ramGB, yours: true };
  }

  get gpu() { return this.parts.gpu; }

  // how fast an in-game game runs on the in-game parts. demand = GPU score needed for 60 fps
  fps(demand, cap = 165) {
    const g = this.parts.gpu;
    let perf = g ? g.score : 3;
    if (this.temps.gpu > 88) perf *= 0.68; // thermal throttling
    const cpuLimit = 40 + this.threads * 14;
    return Math.max(4, Math.min(cap, cpuLimit, 60 * perf / demand));
  }

  // heat: rises with load and dust, falls back when idle. called every frame
  update(dt, on, loadGpu, loadCpu) {
    this.time += dt;
    if (on) this.dust = Math.min(1, this.dust + dt / (3 * 3600));
    this.load.gpu += (loadGpu - this.load.gpu) * Math.min(1, dt * 2);
    this.load.cpu += (loadCpu - this.load.cpu) * Math.min(1, dt * 3);
    const g = this.parts.gpu;
    const heat = g ? Math.min(1.3, g.watts / 200) : 0.3;
    const amb = 24;
    const tg = on ? amb + 8 + this.load.gpu * (38 + heat * 14) + this.dust * 16 : amb;
    const tc = on ? amb + 10 + this.load.cpu * 42 + this.dust * 12 : amb;
    this.temps.gpu += (tg - this.temps.gpu) * Math.min(1, dt * 0.15);
    this.temps.cpu += (tc - this.temps.cpu) * Math.min(1, dt * 0.25);
  }

  ramText() { const r = this.parts.ram; return `${r.gb} GB${r.yours && !this.ramExact ? ' (browser says at least)' : ''}`; }
}
