// The pause menu: Esc (or the mouse getting freed) stops the game and shows
// Resume, Settings, Save, Load, Controls help and Quit. It's also the start
// screen the first time: Sandbox (play freely) or Story (missions with an ending).
//
// Browsers swallow the Esc key while the mouse is captured (Esc just frees the
// mouse), so we open the menu when the mouse gets freed, unless another window
// (shop, phone, chat, backpack...) freed it on purpose.
export class PauseMenu {
  constructor({ input, canvas, settingsPanel, save, load, toast, isBusy, start = true, storyInfo = null, onSandbox = null, onStory = null }) {
    Object.assign(this, { input, canvas, settingsPanel, save, load, toast, isBusy, storyInfo, onSandbox, onStory });
    this.el = document.getElementById('pausemenu');
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'pausemenu'; document.body.appendChild(this.el); }
    this.paused = false;
    this.started = !start;
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      // (on the start screen, clicking the game doesn't skip choosing a mode)
      if (locked) { if (!this.started && this.choosing) { document.exitPointerLock?.(); return; } this.started = true; if (this.paused) this.hide(); return; }
      // the mouse got freed: if nothing else asked for it, that was Esc → pause
      if (this.started && !this.paused && !this.isBusy?.() && !this.settingsPanel.isOpen) this.show();
    });
    addEventListener('keydown', (e) => {
      // another window (shop, phone, settings...) already used this Esc to close itself
      if (e.code !== 'Escape' || e.defaultPrevented || this.settingsPanel.binding || this.settingsPanel.isOpen) return;
      // the same Esc press can free the mouse (which already opened the menu): don't also close it
      if (this.paused) { if (this.choosing) return; if (performance.now() - this.shownAt > 400) { e.preventDefault(); this.resume(); } }
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
    this.choosing = first && !!this.onStory;
    const st = this.storyInfo?.() || {};
    const startButtons = this.onStory
      ? `<button data-act="sandbox" class="main">🏖 Sandbox <small>do whatever you want</small></button>
      ${st.saved ? `<button data-act="story-continue" class="main">📖 Continue story <small>Mission ${st.mission} of 10</small></button>
      <button data-act="story-new">📖 New story</button>` : '<button data-act="story-new" class="main">📖 Story <small>Tiny Town Ruler · 10 missions</small></button>'}`
      : '<button data-act="resume" class="main">▶ Play</button>';
    this.el.innerHTML = `<div class="box">
      <h1>${first ? 'TORTURE HUMANS' : 'Paused'}</h1>
      ${first ? '<p class="sub">a game about being big, and being very, very small</p>' : ''}
      ${!first && st.playing ? `<p class="sub">📖 Mission ${st.mission}: ${st.title}</p>` : ''}
      ${first ? startButtons : '<button data-act="resume" class="main">▶ Resume</button>'}
      <button data-act="settings">⚙ Settings</button>
      ${first ? '' : '<button data-act="save">💾 Save game</button>\n      <button data-act="load">📂 Load game</button>'}
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
    else if (act === 'sandbox' || act === 'story-new' || act === 'story-continue') {
      if (this.busyStart) return;
      if (act === 'story-new' && this.storyInfo?.().saved && !confirm('Start the story over from Mission 1?')) return;
      this.busyStart = true;
      this.choosing = false;
      try {
        if (act === 'sandbox') await this.onSandbox?.();
        else await this.onStory?.({ resume: act === 'story-continue' });
      } finally { this.busyStart = false; }
      this.resume();
    }
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
      if (this.started) this.save(); // (not from the start screen: nothing to save yet)
      window.close();
      this.toast?.('Saved. You can close the window now.');
    }
  }
}
