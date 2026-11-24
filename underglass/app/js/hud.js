// UNDERGLASS menu (TAB): spawn, powers, tools, settings. Its own look (dark cracked glass), not a Windows menu.
import { el, esc, toast, asset, ipc } from './util.js';
import { ITEMS, thumb } from './items.js';
import { POWERS } from './powers.js';
import { audio } from './audio.js';

const CATS = [['people', 'PEOPLE'], ['universe', 'THE UNIVERSE'], ['boom', 'BOOM'], ['stuff', 'STUFF'], ['heavy', 'HEAVY'], ['bouncy', 'BOUNCY'], ['food', 'FOOD + DRINK'], ['home', 'FURNITURE'], ['nature', 'NATURE']];
const TOOLS = [['hand', 'Hand', 'Use Windows normally. Pull anything to rip it off. Grab, throw. Right-click a thing to use it.'], ['delete', 'Delete', 'Click anything to delete it.'],
  ['clone', 'Copy', 'Click anything to make a copy.'], ['pin', 'Pin', 'Click to nail it in the air. Click again to let go.'], ['glue', 'Glue', 'Click two things to glue them together.'],
  ['grow', 'Grow', 'Click to make it bigger.'], ['shrink', 'Shrink', 'Click to make it smaller.']];

export class Hud {
  constructor(g) {
    this.g = g; g.hud = this; this.root = document.getElementById('hud'); this.tab = 'spawn'; this.lastSpawn = null;
    this.settings = { volume: 0.8, mic: false, quality: 'auto' };
    const h = el('div', '', ''); h.id = 'hud-handle'; document.body.appendChild(h); h.onclick = () => this.toggle();
    this.build();
  }
  build() {
    const r = this.root; r.innerHTML = '';
    const p = el('div', 'panel');
    p.innerHTML = `<div class="brand"><b>UNDERGLASS</b><span>PIECE 1</span></div>
      <div class="tabs"><div class="tab" data-t="spawn">SPAWN</div><div class="tab" data-t="powers">POWERS</div><div class="tab" data-t="tools">TOOLS</div><div class="tab" data-t="set">SETTINGS</div></div>
      <div class="page" data-p="spawn"></div><div class="page" data-p="powers"></div><div class="page" data-p="tools"></div><div class="page" data-p="set"></div>`;
    r.appendChild(p);
    p.querySelectorAll('.tab').forEach(t => t.onclick = () => this.open(t.dataset.t));
    // spawn
    const sp = p.querySelector('[data-p=spawn]');
    sp.innerHTML = `<div class="size">SIZE <input type="range" min="0.3" max="3" step="0.05" value="1"><b>1.0x</b></div><div class="hint">Click a thing, then click where it goes. Hold SHIFT to drop many. R = drop the last one again.</div>`;
    const sz = sp.querySelector('input'); sz.oninput = () => { this.g.spawnSize = +sz.value; sp.querySelector('b').textContent = (+sz.value).toFixed(1) + 'x'; };
    for (const [c, name] of CATS) {
      sp.appendChild(el('h4', '', name)); const grid = el('div', 'grid'); sp.appendChild(grid);
      let list = ITEMS.filter(i => i.cat === c).map(i => ({ id: i.id, name: i.name, img: thumb(i.id) }));
      if (c === 'people') list = [{ id: 'stickman', name: 'Stickman', img: stickThumb(false) }, { id: 'kid', name: 'Kid', img: stickThumb(true) }];
      if (c === 'universe') list = [{ id: 'worldball', name: 'Tiny Universe', img: asset('space/deepfield.webp'), round: true }];
      for (const it of list) {
        const cell = el('div', 'cell', `<img src="${it.img}" ${it.round ? 'style="border-radius:50%;width:56%;max-height:none;aspect-ratio:1;object-fit:cover"' : ''}><span>${esc(it.name)}</span>`);
        cell.onclick = () => { this.g.placing = it.id; this.lastSpawn = it.id; this.close(); this.g.powers.set(null); this.g.setTool('hand'); toast('Click to drop: ' + it.name + '  (right-click = stop)', 1600); };
        grid.appendChild(cell);
      }
    }
    // powers
    const pw = p.querySelector('[data-p=powers]');
    pw.appendChild(el('div', 'hint', 'Number keys pick powers (Shift + number for the second row). Esc = normal mouse again.'));
    for (const q of POWERS) {
      const d = el('div', 'pw', `<div class="key">${esc(q.key)}</div><div><div class="nm">${esc(q.name)}</div><div class="ds">${esc(q.desc)}</div></div>`); d.dataset.id = q.id;
      d.onclick = () => { this.g.setTool('hand'); this.g.powers.set(this.g.powers.active === q.id ? null : q.id); this.close(); };
      pw.appendChild(d);
    }
    // tools
    const tl = p.querySelector('[data-p=tools]');
    for (const [id, nm, ds] of TOOLS) {
      const d = el('div', 'pw', `<div class="key">${nm[0]}</div><div><div class="nm">${esc(nm)}</div><div class="ds">${esc(ds)}</div></div>`); d.dataset.tool = id;
      d.onclick = () => { this.g.setTool(id); this.close(); if (id !== 'hand') toast(nm + ' tool  (Esc = back to Hand)', 1600); };
      tl.appendChild(d);
    }
    tl.appendChild(el('h4', '', 'TRICKS'));
    tl.appendChild(el('div', 'hint', 'Hold on the wallpaper, then pull = tear it off.<br>Yank a window fast by its title bar = rip it off.<br>Double-click the clock = it turns into a bomb.<br>Turn on Mic Powers and yell = your mic blows up.<br>Right-click (or E) on things: pull the grenade pin, fire the pistol, fire the cannon, open a gas valve (it flies), pour fuel, turn a light on.<br>Mouse wheel while holding = spin it.<br>Start menu power button: Restart = fixes everything. Shut down = quits.'));
    // settings
    const st = p.querySelector('[data-p=set]');
    st.innerHTML = `<div class="row">Volume <input type="range" min="0" max="1.2" step="0.05" value="${this.settings.volume}" data-s="vol"></div>
      <div class="row"><div>Mic Powers<div class="ds" style="font-size:11px;color:rgba(255,255,255,.45)">Your mic shows on the taskbar. Yell = it blows up.</div></div><div class="tog ${this.settings.mic ? 'on' : ''}" data-s="mic"></div></div>
      <div class="row">Time speed <input type="range" min="0.1" max="2" step="0.05" value="1" data-s="time"></div>
      <h4>FIX</h4><div class="btn" data-a="repair">FIX WINDOWS (PUT IT ALL BACK)</div><div class="btn" data-a="clear">CLEAR EVERYTHING I SPAWNED</div>
      <h4>KEYS</h4><div class="hint">TAB menu · Q spawn page · 1-0 powers · T slow time · E use · DEL delete · Esc normal mouse · Ctrl+Shift+Q quit any time</div>
      <div class="btn red" data-a="quit">QUIT UNDERGLASS</div>`;
    st.querySelector('[data-s=vol]').oninput = (e) => { this.settings.volume = +e.target.value; audio.setVolume(+e.target.value); this.saveSettings(); };
    st.querySelector('[data-s=time]').oninput = (e) => { this.g.timeScale = +e.target.value; audio.slow = Math.max(0.5, Math.min(1.3, +e.target.value)); };
    st.querySelector('[data-s=mic]').onclick = () => this.toggleMicPower();
    st.querySelector('[data-a=repair]').onclick = () => { this.g.repair(); audio.win('logon', 0.6); toast('Windows is fixed. Go break it again.'); };
    st.querySelector('[data-a=clear]').onclick = () => { for (const b of this.g.P.bodies.slice()) if (b.kind === 'item' || b.fromItem) this.g.P.remove(b); for (const s of this.g.sticks) s.gone = true; if (this.g.worlds) this.g.worlds.clearBalls(); };
    st.querySelector('[data-a=quit]').onclick = () => { this.g.save(); ipc.send('quit'); };
    this.open(this.tab, true); this.refresh();
  }
  toggleMicPower() {
    this.settings.mic = !this.settings.mic; this.g.micOn = this.settings.mic;
    if (this.settings.mic) { this.g.powers.ensureMic(); toast('Mic Powers ON. Yell and see what happens.'); } else { this.g.powers.stopMic(); }
    this.root.querySelector('[data-s=mic]').classList.toggle('on', this.settings.mic); this.saveSettings();
  }
  async loadSettings() { const s = await ipc.invoke('load', 'settings.json'); if (s) Object.assign(this.settings, s); audio.setVolume(this.settings.volume); this.build(); if (this.settings.mic) { this.settings.mic = false; this.toggleMicPower(); } }
  saveSettings() { ipc.invoke('save', 'settings.json', this.settings); }
  open(t, silent) { this.tab = t; this.root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.t === t)); this.root.querySelectorAll('.page').forEach(x => x.classList.toggle('on', x.dataset.p === t)); if (!silent) this.root.classList.add('open'); }
  close() { this.root.classList.remove('open'); }
  toggle() { this.root.classList.toggle('open'); audio.play('whoosh', { vol: 0.15, rate: 1.8, noSlow: true }); }
  refresh() {
    this.root.querySelectorAll('[data-id]').forEach(d => d.classList.toggle('on', this.g.powers.active === d.dataset.id));
    this.root.querySelectorAll('[data-tool]').forEach(d => d.classList.toggle('on', this.g.tool === d.dataset.tool && !this.g.powers.active));
  }
}
function stickThumb(kid) { // menu picture of a stickman (drawn the same way the game draws them)
  const c = document.createElement('canvas'); c.width = 120; c.height = 120; const x = c.getContext('2d');
  const h = kid ? 70 : 96, cx = 60, g = 112, col = kid ? '#f2c230' : '#3d8fe0';
  const hip = g - h * 0.48, neck = hip - h * 0.31, hr = h * 0.075 * (kid ? 1.12 : 1);
  x.lineCap = 'round'; x.strokeStyle = col; x.lineWidth = Math.max(3, h * 0.04);
  x.beginPath(); x.moveTo(cx, neck); x.lineTo(cx, hip); x.moveTo(cx, hip); x.lineTo(cx - h * 0.1, hip + h * 0.24); x.lineTo(cx - h * 0.12, g); x.moveTo(cx, hip); x.lineTo(cx + h * 0.08, hip + h * 0.24); x.lineTo(cx + h * 0.14, g);
  x.moveTo(cx, neck + 3); x.lineTo(cx - h * 0.14, neck + h * 0.15); x.lineTo(cx - h * 0.16, neck + h * 0.3); x.moveTo(cx, neck + 3); x.lineTo(cx + h * 0.12, neck + h * 0.16); x.lineTo(cx + h * 0.2, neck + h * 0.28); x.stroke();
  x.fillStyle = col; x.beginPath(); x.arc(cx, neck - h * 0.05 - hr, hr, 0, 7); x.fill();
  return c.toDataURL();
}
