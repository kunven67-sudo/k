// HUD: missions list, gun dial + fluid, prompts, toasts, title cards, fades.
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export class HUD {
  constructor() {
    this.root = $('hud');
    this.prompt = $('prompt');
    this.crosshair = $('crosshair');
    this.objlist = $('objlist');
    this.objectives = $('objectives');
    this.dialcode = $('dialcode');
    this.dialname = $('dialname');
    this.dialnote = $('dialnote');
    this.fluid = $('fluid');
    this.fluidBar = this.fluid.firstElementChild;
    this.fluidLabel = $('fluidlabel');
    this.toastEl = $('toast');
    this.card = $('card');
    this.fadeEl = $('fade');
    this.flashEl = $('flash');
    this.hint = $('hint');
    this.subtitle = $('subtitle');
    this._toastEnd = 0;
    this._cardEnd = 0;
    this._promptText = '';
    this._objKey = '';
    this._hintKey = '';
  }

  show(v) {
    this.root.hidden = !v;
  }

  setPrompt(text) {
    if (text === this._promptText) return;
    this._promptText = text;
    if (!text) {
      this.prompt.hidden = true;
      this.crosshair.classList.remove('hot');
      return;
    }
    this.prompt.hidden = false;
    this.prompt.innerHTML = `<kbd>E</kbd>${esc(text)}`;
    this.crosshair.classList.add('hot');
  }

  setObjectives(list) {
    const key = JSON.stringify(list);
    if (key === this._objKey) return;
    this._objKey = key;
    this.objectives.hidden = list.length === 0;
    this.objlist.innerHTML = list.map((o) => `<li class="${o.done ? 'done' : ''} ${o.secret ? 'secret' : ''}">${esc(o.text)}</li>`).join('');
  }

  setDial(code, name, note) {
    this.dialcode.textContent = code;
    this.dialname.textContent = name;
    this.dialnote.textContent = note;
  }

  setFluid(f) {
    const pct = Math.round(f * 100);
    this.fluidBar.style.width = `${pct}%`;
    this.fluid.classList.toggle('low', f < 0.2);
    this.fluidLabel.textContent = `Portal fluid ${pct}%`;
  }

  setGunVisible(v) {
    $('gunhud').hidden = !v;
    this.crosshair.hidden = !v && this.crosshair.dataset.force !== '1';
  }

  setHint(html) {
    if (html === this._hintKey) return;
    this._hintKey = html;
    this.hint.hidden = !html;
    this.hint.innerHTML = html;
  }

  // timers use the real clock so they stay right even when the frame rate drops
  toast(text, bad = false, secs = 3) {
    this.toastEl.textContent = text;
    this.toastEl.classList.toggle('bad', bad);
    this.toastEl.classList.add('show');
    this._toastEnd = performance.now() + secs * 1000;
  }

  showCard(title, sub = '', secs = 3) {
    this.card.firstElementChild.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    this.card.classList.add('show');
    this._cardEnd = performance.now() + secs * 1000;
  }

  hideCard() {
    this.card.classList.remove('show');
    this._cardEnd = 0;
  }

  fade(to, secs = 0.8) {
    this.fadeEl.style.transition = `opacity ${secs}s`;
    this.fadeEl.style.opacity = to;
    return new Promise((r) => setTimeout(r, secs * 1000));
  }

  flash() {
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  update() {
    const now = performance.now();
    if (this._toastEnd && now > this._toastEnd) {
      this._toastEnd = 0;
      this.toastEl.classList.remove('show');
    }
    if (this._cardEnd && now > this._cardEnd) {
      this._cardEnd = 0;
      this.card.classList.remove('show');
    }
  }
}
