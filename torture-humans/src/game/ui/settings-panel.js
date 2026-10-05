// F10: the settings panel. Graphics, sound, gameplay, and the "just for fun"
// tiny-world switches (the realistic tiny stuff is always on; these aren't realistic).
const TINY = [
  ['superJump', 'Super jump when tiny', 'Jump ~20× your height like a flea (real humans couldn\'t)'],
  ['talkingBugs', 'Talking bugs', 'Ants, spiders, beetles and dust mites talk to you'],
  ['moreTinyCities', 'More tiny cities', 'A second tiny village in the park (after a restart)'],
  ['rideCritters', 'Ride your pet rat', 'When tiny, E on your rat to ride it'],
  ['labels', 'Tiny labels', 'Look at tiny things to see what they are'],
];

export class SettingsPanel {
  constructor({ settings, input, canvas, toast }) {
    Object.assign(this, { settings, input, canvas, toast });
    this.el = document.getElementById('settingspanel');
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'settingspanel'; this.el.className = 'panel'; this.el.hidden = true; document.body.appendChild(this.el); }
    this.el.addEventListener('change', (e) => this.onChange(e));
    this.el.addEventListener('input', (e) => { if (e.target.type === 'range') this.onChange(e); });
    this.el.addEventListener('click', (e) => { if (e.target.dataset.act === 'close') this.close(); });
    addEventListener('keydown', (e) => {
      if (e.code === 'F10') { e.preventDefault(); this.el.hidden ? this.open() : this.close(); }
      else if (e.code === 'Escape' && !this.el.hidden) { e.preventDefault(); this.close(); }
    });
  }

  open() {
    this.render();
    this.el.hidden = false;
    this.input.enabled = false;
    this.input.clear();
    document.exitPointerLock?.();
  }

  close() {
    this.el.hidden = true;
    this.input.enabled = true;
    this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  render() {
    const g = (p) => this.settings.get(p);
    const sel = (path, opts) => `<select data-path="${path}">${opts.map(([v, l]) => `<option value="${v}" ${g(path) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    this.el.innerHTML = `<h3>Settings</h3>
      <div class="row"><span>Graphics</span>${sel('graphics.preset', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']])}</div>
      <div class="row"><span>Volume</span><input type="range" min="0" max="1" step="0.05" data-path="audio.master" value="${g('audio.master') ?? 1}"></div>
      <div class="row"><span>Difficulty</span>${sel('gameplay.difficulty', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['creative', 'Creative (can\'t get hurt)']])}</div>
      <div class="row"><span>Gore</span>${sel('gameplay.gore', [['none', 'None'], ['some', 'Some'], ['full', 'Full']])}</div>
      <div class="row"><span>Mouse sensitivity</span><input type="range" min="0.2" max="3" step="0.1" data-path="controls.mouseSensitivity" value="${g('controls.mouseSensitivity') ?? 1}"></div>
      <h4>Tiny world: just for fun <i>(not realistic, off by default)</i></h4>
      ${TINY.map(([k, label, note]) => `<label class="row"><span>${label} <i>${note}</i></span><input type="checkbox" data-path="tiny.${k}" ${g(`tiny.${k}`) ? 'checked' : ''}></label>`).join('')}
      <p class="note">The realistic tiny stuff is always on: crumbs are meals, bugs and pets are dangerous, feet and vacuums, wind, raindrops, cold, blurry eyes, slow-motion world, and your body giving out below 2 cm.</p>
      <div class="foot"><button data-act="close">Close (F10 / Esc)</button></div>`;
  }

  onChange(e) {
    const t = e.target;
    const path = t.dataset.path;
    if (!path) return;
    const value = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
    const [a, b] = path.split('.');
    this.settings.set({ [a]: { [b]: value } });
    if (path === 'tiny.moreTinyCities') this.toast?.('More tiny cities: restart the game to build them');
  }

  update() {}
}
