// Screens + HUD (plain HTML on top of the 3D view).
const $ = s => document.querySelector(s);
const SI = [[1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm'], [1e-15, 'fm'], [1e-18, 'am'], [1e-21, 'zm'], [1e-24, 'ym'], [1e-27, 'rm'], [1e-30, 'qm']];
export function fmtSize(m) {
  if (m >= 1) return m.toFixed(2) + ' m';
  if (m < 1e-30) { const e = Math.floor(Math.log10(m)); return (m / Math.pow(10, e)).toFixed(2) + ' × 10' + sup(e) + ' m'; }
  for (const [u, n] of SI) if (m >= u * 0.999) { const v = m / u; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + n; }
  return m.toExponential(2) + ' m';
}
const sup = e => String(e).split('').map(c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('');
const AS = [[1.2, 'a person'], [0.35, 'a cat'], [0.12, 'a mouse'], [0.035, 'a beetle'], [0.009, 'a big ant'], [0.003, 'a small ant'], [0.0009, 'a flea'], [0.00025, 'a dust mite'], [6e-5, 'a hair is wider than you'], [8e-6, 'a red blood cell'], [1.5e-6, 'a bacterium'], [2e-7, 'a virus'], [2e-8, 'a protein'], [2.2e-9, 'DNA is as wide as you'], [3e-10, 'an atom'], [3e-11, 'inside an atom'], [6e-15, 'a nucleus'], [8e-16, 'a proton'], [1e-18, 'a quark (nobody knows if they even have a size)'], [2e-35, 'smaller than anything ever measured'], [1.5e-35, 'the Planck length - the smallest size physics can describe'], [0, 'nothing. Size has stopped meaning anything']];
export const asBigAs = m => { for (const [s, t] of AS) if (m >= s) return t; return AS[AS.length - 1][1]; };
export function fmtSpeed(v) {
  const C = 299792458;
  if (v >= C * 0.01) return (v / C).toFixed(v >= C * 10 ? 0 : 2) + '× light speed';
  if (v >= 1000) return (v / 1000).toFixed(1) + ' km/s';
  return v.toFixed(v < 10 ? 1 : 0) + ' m/s';
}

export class UI {
  constructor() {
    this.h = {}; this.msgs = [];
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { this.emit(b.dataset.act); }));
    this.figure = $('#figure');
  }
  on(e, f) { this.h[e] = f; }
  emit(e, v) { this.h[e]?.(v); }
  loading(p) { const b = $('#loadbar'); if (b) b.style.width = (p * 100).toFixed(0) + '%'; if (p >= 1) setTimeout(() => $('#loading').classList.add('gone'), 300); }
  show(name) {
    for (const id of ['menu', 'hud', 'pause', 'death', 'bench', 'settings', 'controls']) $('#' + id)?.classList.toggle('on', id === name || (name === 'hud' && id === 'hud'));
    if (name === 'pause') $('#hud').classList.add('on');
    this.screen = name;
  }
  initSettings(s) {
    const vol = $('#setVol'), sens = $('#setSens'), q = $('#setQ');
    vol.value = s.vol; sens.value = s.sens; q.value = s.quality;
    const send = () => this.emit('settings', { vol: +vol.value, sens: +sens.value, quality: q.value });
    vol.oninput = send; sens.oninput = send; q.onchange = send;
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { this.back = this.screen; this.show(b.dataset.open); }));
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => this.show(this.back || 'menu')));
  }
  message(text, dur = 4) {
    const box = $('#msgs'), el = document.createElement('div'); el.className = 'msg'; el.textContent = text; box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 600); }, dur * 1000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  clearMessages() { $('#msgs').innerHTML = ''; }
  controlsHint() { const c = $('#keys'); c.classList.add('on'); clearTimeout(this.kt); this.kt = setTimeout(() => c.classList.remove('on'), 26000); }
  hud(d) {
    $('#size').textContent = d.size; $('#as').textContent = d.as;
    const sp = $('#speed'); sp.classList.toggle('on', d.speed > 2 && !d.deep);
    if (d.speed > 2) {
      const C = 299792458; $('#speedV').textContent = fmtSpeed(d.speed);
      $('#speedSub').textContent = d.speed >= C * 0.01 ? `${(d.speed / 1000).toExponential(2)} km/s` : d.speed > 300 ? `Mach ${(d.speed / 343).toFixed(d.speed > 3430 ? 0 : 1)}` : `${(d.speed * 3.6).toFixed(0)} km/h`;
    }
    $('#realm').textContent = d.realm; $('#realm').classList.toggle('on', d.deep);
    const b = d.body, hp = b.health;
    $('#hpbar').style.width = hp.toFixed(1) + '%'; $('#hpbar').classList.toggle('low', hp < 35);
    $('#blood').textContent = `Blood ${Math.max(0, b.blood).toFixed(0)}%` + (b.bleeding > 0.02 ? ' · bleeding' : '');
    for (const p of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
      const el = this.figure.querySelector('#f_' + p); if (!el) continue;
      const v = b.hp[p] / 100;
      el.style.fill = v > 0.75 ? 'rgba(235,240,245,0.85)' : v > 0.45 ? '#e8c35a' : v > 0.15 ? '#e0673a' : '#8a1010';
      el.classList.toggle('broken', b.broken[p]); el.classList.toggle('bleeding', b.bleed[p] > 0.02); el.classList.toggle('burnt', b.burn[p] > 30);
    }
    $('#injuries').textContent = ['legL', 'legR', 'armL', 'armR'].filter(p => b.broken[p]).map(p => ({ legL: 'Left leg broken', legR: 'Right leg broken', armL: 'Left arm broken', armR: 'Right arm broken' })[p]).join(' · ');
    $('#power').style.width = Math.max(0, d.power).toFixed(0) + '%';
    $('#temp').textContent = `Core ${d.temp.toFixed(0)}°C`; $('#temp').classList.toggle('hot', d.temp > 80);
    const s = d.suit, flags = [];
    if (!s.limiter) flags.push('LIMITER REMOVED'); if (s.oc) flags.push('OVERCLOCKED'); if (s.mass) flags.push('FULL MASS'); if (!s.shield) flags.push('NO HEAT SHIELD'); if (!s.speedWire) flags.push('SPEED CUT'); if (!s.shrinkWire) flags.push('SHRINK CUT'); if (!s.battery) flags.push('NO POWER');
    if (d.speedOn) flags.unshift('SPEED SUIT ON');
    $('#flags').textContent = flags.join(' · ');
  }
  death(cause, st) {
    $('#dCause').textContent = cause;
    $('#dStats').innerHTML = `<div><b>${st.lived < 1 ? Math.max(1, Math.round(st.lived * 60)) + ' s' : st.lived.toFixed(1) + ' min'}</b><span>lived</span></div><div><b>${st.smallest}</b><span>smallest you got</span></div><div><b>${st.fastest}</b><span>fastest</span></div><div><b>${st.dist > 1000 ? (st.dist / 1000).toFixed(st.dist > 1e6 ? 0 : 1) + ' km' : st.dist.toFixed(0) + ' m'}</b><span>traveled</span></div>`;
    this.show('death');
  }
}
