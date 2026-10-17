// Title screen, pause menu, settings and controls.
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { saveSettings } from '../core/settings.js';

const $ = (id) => document.getElementById(id);

export class Menu {
  constructor(game) {
    this.game = game;
    this.screens = { title: $('title'), pause: $('pause'), settings: $('settings'), controls: $('controls') };
    this.backTo = 'title';
    this.open = null;
    this._wire();
  }

  show(name) {
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== name;
    this.open = name || null;
    if (name === 'settings') this._fillSettings();
    if (name === 'title') $('btn-continue').hidden = !this.game.hasSave();
    const first = name && this.screens[name].querySelector('button');
    first?.focus({ preventScroll: true });
  }

  hide() {
    this.show(null);
  }

  _click(id, fn) {
    $(id).addEventListener('click', () => {
      audio.init();
      audio.uiConfirm();
      fn();
    });
  }

  _wire() {
    const g = this.game;
    this._click('btn-new', () => g.newGame());
    this._click('btn-continue', () => g.continueGame());
    this._click('btn-settings', () => {
      this.backTo = 'title';
      this.show('settings');
    });
    this._click('btn-controls', () => {
      this.backTo = 'title';
      this.show('controls');
    });
    this._click('btn-resume', () => g.resume());
    this._click('btn-psettings', () => {
      this.backTo = 'pause';
      this.show('settings');
    });
    this._click('btn-pcontrols', () => {
      this.backTo = 'pause';
      this.show('controls');
    });
    this._click('btn-quit', () => g.quitToTitle());
    this._click('btn-setback', () => this.show(this.backTo));
    this._click('btn-ctlback', () => this.show(this.backTo));
    for (const b of document.querySelectorAll('button.big')) b.addEventListener('mouseenter', () => audio.ctx && audio.uiMove());

    const s = g.settings;
    const bind = (id, key, parse = Number, ev = 'input') => {
      $(id).addEventListener(ev, (e) => {
        s[key] = parse(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        g.applySettings();
        saveSettings(s);
      });
    };
    bind('s-master', 'master');
    bind('s-music', 'music');
    bind('s-sfx', 'sfx');
    bind('s-voicevol', 'voiceVol');
    bind('s-sens', 'sens');
    bind('s-fov', 'fov');
    bind('s-invert', 'invertY', Boolean, 'change');
    bind('s-voice', 'voice', String, 'change');
    bind('s-quality', 'quality', String, 'change');
    $('s-song').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      audio.init();
      music.setCustom(f);
      $('songname').textContent = `Playing: ${f.name}`;
      e.target.value = '';
    });
    $('s-songclear').addEventListener('click', () => {
      music.clearCustom();
      $('songname').textContent = '';
    });
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.open === 'settings' || this.open === 'controls') this.show(this.backTo);
      else if (this.open === 'pause') g.resume();
    });
  }

  _fillSettings() {
    const s = this.game.settings;
    $('s-master').value = s.master;
    $('s-music').value = s.music;
    $('s-sfx').value = s.sfx;
    $('s-voicevol').value = s.voiceVol;
    $('s-sens').value = s.sens;
    $('s-fov').value = s.fov;
    $('s-invert').checked = s.invertY;
    $('s-voice').value = s.voice;
    $('s-quality').value = s.quality;
    $('songname').textContent = music.customName ? `Playing: ${music.customName}` : '';
    const d = this.game.dialogue;
    let info;
    if (!d.tts) info = "Your browser can't speak out loud, so characters talk with cartoon babble + subtitles.";
    else if (!d.hasVoices) info = 'No computer voices found yet. Subtitles still work.';
    else {
      const names = [...new Set([...d.voices.m.slice(0, 2), ...d.voices.f.slice(0, 1)].map((v) => v.name))].join(', ');
      info = `Computer voices in use: ${names}. Tip: in Microsoft Edge the voices sound way more human.`;
    }
    $('voiceinfo').textContent = info;
  }
}
