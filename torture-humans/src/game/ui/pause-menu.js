// The pause menu: Esc (or the mouse getting freed) stops the game and shows
// Resume, Settings, Save, Load, Controls help and Quit. It's also the start
// screen ("Play") the first time.
//
// Browsers swallow the Esc key while the mouse is captured (Esc just frees the
// mouse), so we open the menu when the mouse gets freed, unless another window
// (shop, phone, chat, backpack...) freed it on purpose.
export class PauseMenu {
  constructor({ input, canvas, settingsPanel, save, load, toast, isBusy, start = true }) {
    Object.assign(this, { input, canvas, settingsPanel, save, load, toast, isBusy });
    this.el = document.getElementById('pausemenu');
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'pausemenu'; document.body.appendChild(this.el); }
    this.paused = false;
    this.started = !start;
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) { this.started = true; if (this.paused) this.hide(); return; }
      // the mouse got freed: if nothing else asked for it, that was Esc → pause
      if (this.started && !this.paused && !this.isBusy?.() && !this.settingsPanel.isOpen) this.show();
    });
    addEventListener('keydown', (e) => {
      // another window (shop, phone, settings...) already used this Esc to close itself
      if (e.code !== 'Escape' || e.defaultPrevented || this.settingsPanel.binding || this.settingsPanel.isOpen) return;
      // the same Esc press can free the mouse (which already opened the menu): don't also close it
      if (this.paused) { if (performance.now() - this.shownAt > 400) { e.preventDefault(); this.resume(); } }
      else if (this.started && !this.isBusy?.()) { e.preventDefault(); this.show(); }
    });
    if (start) this.show({ title: true });
  }

  show({ title = false } = {}) {
    this.paused = true;
    this.shownAt = performance.now();
    this.input.enabled = false;
    this.input.clear();
    if (document.pointerLockElement) document.exitPointerLock?.();
    const first = title || !this.started;
    this.el.innerHTML = `<div class="box">
      <h1>${first ? 'TORTURE HUMANS' : 'Paused'}</h1>
      ${first ? '<p class="sub">a game about being big, and being very, very small</p>' : ''}
      <button data-act="resume" class="main">${first ? '▶ Play' : '▶ Resume'}</button>
      <button data-act="settings">⚙ Settings</button>
      ${first ? '' : '<button data-act="save">💾 Save game</button>'}
      <button data-act="load">📂 Load game</button>
      <button data-act="help">❓ Controls</button>
      <button data-act="quit">✖ Quit</button>
    </div>`;
    this.el.hidden = false;
  }

  hide() {
    this.paused = false;
    this.el.hidden = true;
    this.input.enabled = true;
  }

  resume() {
    this.hide();
    this.started = true;
    this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  async onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'resume') this.resume();
    else if (act === 'settings') {
      this.el.hidden = true;
      this.settingsPanel.open({ onClose: () => { this.el.hidden = false; this.input.enabled = false; } });
    } else if (act === 'save') this.toast?.(this.save() ? 'Game saved' : 'Could not save');
    else if (act === 'load') {
      const ok = await this.load();
      this.toast?.(ok ? 'Game loaded' : 'No saved game yet');
      if (ok) this.resume();
    } else if (act === 'help') {
      const c = document.getElementById('controls');
      if (c) c.hidden = !c.hidden;
    } else if (act === 'quit') {
      this.save();
      window.close();
      this.toast?.('Saved. You can close the window now.');
    }
  }
}
