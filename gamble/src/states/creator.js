// State 'creator': the DMV photo booth character creator (DESIGN §3, §40-41).
// A little DMV corner, the player's Human standing on the linoleum in front of the blue roller
// backdrop, and the application form on a clipboard. "Take photo" runs the clerk's routine
// (Don't smile → countdown → FLASH), renders the ID photo from a dedicated camera, composes the
// license card, then starts a new life and goes to 'world'.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHuman, randomHumanParams, normalizeParams } from '../character/index.js';
import { VISEMES } from '../character/anim/face.js';
import { Rng } from '../core/rng.js';
import { el, damp, clamp, lerp, sleep } from '../core/util.js';
import { t } from '../core/i18n.js';
import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { uiSound, vary, getMusic } from '../ui/sfx.js';
import '../creator/strings.js';
import { buildBooth } from '../creator/booth.js';
import { createForm } from '../creator/form.js';
import { randomName } from '../creator/names.js';
import { composeLicense } from '../creator/license.js';
import { PhotoRig } from '../creator/photo.js';

/** JPEG data URL without blocking the main thread (toBlob encodes off-thread). */
function toDataURL(canvas, quality) {
  return new Promise((resolve) => {
    const fallback = () => resolve(canvas.toDataURL('image/jpeg', quality));
    if (!canvas.toBlob) return fallback();
    canvas.toBlob((blob) => {
      if (!blob) return fallback();
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = fallback;
      fr.readAsDataURL(blob);
    }, 'image/jpeg', quality);
  });
}

const REBUILD_MS = 260; // debounce for live rebuilds while sliders move
const ZOOM_DEFAULT = 0.5;

export class CreatorState {
  constructor(engine) {
    this.engine = engine;
    this.time = 0;
    this.yaw = 0.18; // character turn (drag)
    this.yawVel = 0;
    this.zoom = ZOOM_DEFAULT; // 0 = face, 1 = full body
    this.zoomTarget = ZOOM_DEFAULT;
    this.viewShift = { x: 0, y: 0 };
    this.busy = false;
    this.cleanups = [];
  }

  async enter(params = {}) {
    const e = this.engine;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1c);
    // Soft indoor reflections (cheap: one PMREM bake on enter).
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(30, e.width / e.height || 1, 0.05, 40);
    this.booth = buildBooth(e.tier);
    this.booth.setLabel(t('creator.nowServing'));
    this.serving = 40 + ((Math.random() * 50) | 0);
    this.booth.setServing(this.serving);
    this.scene.add(this.booth.root);

    // Model: what the form edits.
    const p = normalizeParams(params.params || randomHumanParams());
    if (p.age < 21) p.age = 21;
    const nm = randomName();
    this.model = { params: p, first: params.first || nm.first, last: params.last || nm.last, age: p.age, voiceURI: '' };

    this._buildHuman();
    e.setView(this.scene, this.camera);
    this._buildUI();
    this._bindInput();
    this.photo = new PhotoRig(e.renderer, this.scene);
    this._frameCamera(1);

    getMusic().then((m) => m?.play?.('creator-dmv', { fade: 2.5 })).catch(() => {});
    // Warm the voice list (Chrome fills it asynchronously).
    try { speechSynthesis?.getVoices(); } catch {}
    if (params.section) this.form.open(params.section);
  }

  // ---------------------------------------------------------------------------------------
  // Character

  _buildHuman(hero = false) {
    const old = this.human;
    const human = createHuman(this.model.params, { tier: this.engine.tier, hero });
    human.root.rotation.y = this.yaw;
    human.setFootIK((x, y, z) => ({ y: 0, normal: new THREE.Vector3(0, 1, 0) }));
    human.setExpression('neutral');
    this.scene.add(human.root);
    if (old) {
      this.scene.remove(old.root);
      old.dispose();
    }
    this.human = human;
    this._dirty = false;
    const d = human.rig.dims;
    this.headY = d.j.headCenter.y;
    this.height = this.model.params.height;
  }

  _scheduleRebuild() {
    clearTimeout(this._rebuildT);
    this._dirty = true;
    this._rebuildT = setTimeout(() => {
      if (this.busy) return;
      this._buildHuman();
    }, REBUILD_MS);
  }

  // ---------------------------------------------------------------------------------------
  // UI

  _buildUI() {
    const root = this.engine.uiRoot;
    this.form = createForm(this.model, {
      change: (kind) => {
        if (kind === 'param') this._scheduleRebuild();
      },
      randomName: () => {
        Object.assign(this.model, randomName({ first: this.model.first }));
        this.form.refresh();
      },
      randomAll: () => {
        const age = this.model.age;
        this.model.params = normalizeParams(randomHumanParams(new Rng((Math.random() * 2 ** 31) | 0), {}));
        this.model.age = this.model.params.age = Math.max(21, this.model.params.age);
        Object.assign(this.model, randomName());
        void age;
        this.form.refresh();
        this._scheduleRebuild();
      },
      randomSection: (s) => {
        // Draw a full random person consistent with the current age, copy only this section.
        const r = randomHumanParams(new Rng((Math.random() * 2 ** 31) | 0), { age: this.model.age });
        for (const k of s.params) this.model.params[k] = r[k];
        if (s.id === 'voice') this.model.voiceURI = this._voices()[(Math.random() * this._voices().length) | 0]?.voiceURI || '';
        this.form.refresh();
        this._scheduleRebuild();
      },
      voices: () => this._voices(),
      preview: () => this._speak(t('creator.voiceLine'), this._playerVoice()),
      photo: () => this._takePhoto(),
      section: (id) => {
        // Face-ish sections zoom in on the face; body/clothes pull back.
        if (['face', 'eyes', 'beard', 'skin'].includes(id)) this.zoomTarget = 0.06;
        else if (id === 'hair') this.zoomTarget = 0.2; // room for volume and hats
        else if (id === 'body' || id === 'clothes') this.zoomTarget = 0.8;
      },
    });
    root.append(this.form.el);

    this.zoomBtns = el('div', { class: 'dmvx-zoom' });
    const mk = (label, z) => {
      const b = el('button', { type: 'button', text: label });
      b.addEventListener('click', () => { this.zoomTarget = z; uiSound('ui.click', { rate: vary() }); });
      return b;
    };
    this.zoomBtns.append(mk(t('creator.faceZoom'), 0), mk(t('creator.bodyZoom'), 1));
    this.hint = el('div', { class: 'dmvx-hint', text: t('creator.dragHint') });
    root.append(this.zoomBtns, this.hint);
    this.onResize();
  }

  _voices() {
    try {
      const all = speechSynthesis.getVoices() || [];
      const lang = (document.documentElement.lang || 'en').slice(0, 2);
      // Prefer the UI language, then English/Spanish, local voices first; cap the list.
      const score = (v) => (v.lang?.startsWith(lang) ? 0 : /^(en|es)/.test(v.lang) ? 1 : 2) + (v.localService ? 0 : 0.5);
      return all.filter((v) => /^(en|es)/.test(v.lang || '')).sort((a, b) => score(a) - score(b)).slice(0, 24);
    } catch {
      return [];
    }
  }

  _playerVoice() {
    const p = this.model.params;
    return { uri: this.model.voiceURI, pitch: 0.55 + p.voicePitch * 0.9, rate: 0.82 + p.voiceRate * 0.4, lipsync: true };
  }

  /** speechSynthesis with lip flaps on the player's Human. Resolves when done (or ~timeout). */
  _speak(text, { uri = '', pitch = 1, rate = 1, lipsync = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; this.talking = 0; resolve(); } };
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = speechSynthesis.getVoices().find((x) => x.voiceURI === uri);
        if (v) { u.voice = v; u.lang = v.lang; }
        u.pitch = clamp(pitch, 0.1, 2);
        u.rate = clamp(rate, 0.5, 1.6);
        u.onend = u.onerror = finish;
        speechSynthesis.speak(u);
      } catch {}
      if (lipsync) this.talking = text.length * 0.065 / rate;
      setTimeout(finish, 600 + text.length * 80);
    });
  }

  // ---------------------------------------------------------------------------------------
  // Input: drag to turn the character, wheel / pinch to zoom.

  _bindInput() {
    const c = this.engine.renderer.domElement;
    const pts = new Map();
    let pinch = 0;
    const down = (ev) => {
      if (this.busy) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      c.setPointerCapture?.(ev.pointerId);
      this.hint.style.opacity = '0';
    };
    const move = (ev) => {
      const prev = pts.get(ev.pointerId);
      if (!prev) return;
      const cur = { x: ev.clientX, y: ev.clientY };
      if (pts.size === 1) {
        const dx = cur.x - prev.x;
        this.yaw += dx * 0.011;
        this.yawVel = dx * 0.011 / Math.max(1 / 120, this._lastDt || 1 / 60);
      } else if (pts.size === 2) {
        pts.set(ev.pointerId, cur);
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomTarget = clamp(this.zoomTarget - (d - pinch) * 0.004, 0, 1);
        pinch = d;
      }
      pts.set(ev.pointerId, cur);
    };
    const up = (ev) => { pts.delete(ev.pointerId); pinch = 0; };
    const wheel = (ev) => {
      if (this.busy) return;
      ev.preventDefault();
      this.zoomTarget = clamp(this.zoomTarget + ev.deltaY * 0.0012, 0, 1);
    };
    c.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    c.style.touchAction = 'none';
    this.cleanups.push(() => {
      c.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      c.removeEventListener('wheel', wheel);
    });
  }

  // ---------------------------------------------------------------------------------------
  // Camera framing. The form covers one side of the screen, so the projection is shifted
  // (setViewOffset) to centre the character in the free area.

  onResize(w = this.engine.width, h = this.engine.height) {
    if (!this.form) return;
    const r = this.form.el.getBoundingClientRect();
    const mobile = r.top > h * 0.2;
    this.mobile = mobile;
    this.freeShift = mobile ? { x: 0, y: -(h - r.top) / 2 + h * 0.01 } : { x: Math.min(r.right, w * 0.5) / 2 + 10, y: 0 };
  }

  _frameCamera(k) {
    const e = this.engine;
    const w = e.width, h = e.height;
    const target = this.busy && this.photoFrame ? { x: 0, y: 0 } : this.freeShift || { x: 0, y: 0 };
    this.viewShift.x = lerp(this.viewShift.x, target.x, k);
    this.viewShift.y = lerp(this.viewShift.y, target.y, k);
    this.camera.setViewOffset(w, h, -this.viewShift.x, -this.viewShift.y, w, h);

    const z = this.zoom;
    const hy = this.headY || 1.6;
    const H = this.height || 1.75;
    const narrow = this.mobile ? 1.35 : 1; // portrait screens need more distance for the same framing
    const dist = lerp(0.95, 4.2, z * z * 0.6 + z * 0.4) * narrow;
    const ty = lerp(hy - 0.02, H * 0.52, z);
    const cy = lerp(hy + 0.03, H * 0.6, z);
    const side = this.photoFrame ? 0 : 0.3;
    this.camera.position.set(side * dist, cy, 0.05 + dist);
    this.camera.lookAt(0, ty, 0);
  }

  // ---------------------------------------------------------------------------------------
  // The photo routine.

  async _takePhoto() {
    if (this.busy) return;
    this.busy = true;
    clearTimeout(this._rebuildT);
    const m = this.model;
    if (!m.first.trim()) m.first = randomName().first;
    if (!m.last.trim()) m.last = randomName().last;
    this.form.hide(true);
    this.zoomBtns.style.display = this.hint.style.display = 'none';
    this.photoFrame = true;
    this.zoomTarget = 0.22;
    this.yawGoal = 0;

    // Make sure the photo shows the latest edits (a debounced rebuild may still be pending).
    if (this._dirty) this._buildHuman();
    this.human.setExpression('happy', 1); // the applicant beams…
    this.lookAtLens = true;
    await sleep(500);

    const bubble = el('div', { class: 'dmvx-bubble', text: t('creator.dontSmile') });
    this.engine.uiRoot.append(bubble);
    uiSound('ui.paper', { rate: 0.8 });
    const clerk = this._speak(t('creator.dontSmile'), { pitch: 0.75, rate: 0.85 });
    await sleep(900);
    this.human.setExpression('neutral'); // …and wipes it off.
    await clerk;
    bubble.textContent = t('creator.lookHere');
    await sleep(900);
    bubble.classList.add('out');
    setTimeout(() => bubble.remove(), 320);

    // Countdown.
    const count = el('div', { class: 'dmvx-count' });
    this.engine.uiRoot.append(count);
    for (const n of [3, 2, 1]) {
      count.replaceChildren(el('span', { text: String(n) }));
      uiSound('ui.type', { rate: 1.3 - n * 0.08 });
      await sleep(820);
    }
    count.remove();

    // FLASH: pop the ring light, capture the ID photo with that lighting, then white-out.
    this.booth.flash(1);
    this.booth.update(0, this.time);
    this.human.update(0);
    const idCanvas = this.photo.capture(this.human, this.headY);
    uiSound('phone.camera', { gain: 1 });
    const flash = el('div', { class: 'dmvx-flash' });
    this.engine.uiRoot.append(flash);
    setTimeout(() => flash.remove(), 1200);
    const idPhotoP = toDataURL(idCanvas, 0.88); // async encode: never stalls the flash

    // License card.
    await sleep(900);
    const card = composeLicense({ first: m.first.trim(), last: m.last.trim(), age: m.age, params: m.params, photo: idCanvas });
    const [idPhoto, licenseCard] = await Promise.all([idPhotoP, toDataURL(card, 0.9)]);
    this.serving++;
    this.booth.setServing(this.serving);
    uiSound('ui.confirm', { rate: 1.4 });
    const wrap = el('div', { class: 'dmvx-card' }, [el('img', { src: licenseCard, alt: t('creator.license') })]);
    this.engine.uiRoot.append(wrap);
    setTimeout(() => uiSound('ui.card-flip', { rate: 0.9 }), 300);
    this._speak(t('creator.next'), { pitch: 0.75, rate: 0.9 });
    await sleep(3200);

    const character = { params: { ...m.params, age: m.age }, name: { first: m.first.trim(), last: m.last.trim() }, age: m.age, voiceURI: m.voiceURI, idPhoto, licenseCard };
    this.result = character;
    bus.emit('creator:done', character);
    if (this.noSave) return;
    save.newLife(character);
    if (this.engine.states.has('world')) {
      this.engine.go('world', { newLife: true });
    } else {
      wrap.remove();
      this._comingSoon(licenseCard);
    }
  }

  _comingSoon(licenseCard) {
    const back = el('button', { type: 'button', text: t('creator.soonBack') });
    const box = el('div', { class: 'dmvx-soon' }, [
      el('div', {}, [el('img', { src: licenseCard, alt: '' }), el('h3', { text: t('creator.soonTitle') }), el('p', { text: t('creator.soonBody') }), back]),
    ]);
    back.addEventListener('click', () => {
      uiSound('ui.back');
      box.remove();
      this.busy = false;
      this.photoFrame = false;
      this.lookAtLens = false;
      this.form.hide(false);
      this.zoomBtns.style.display = this.hint.style.display = '';
      this.zoomTarget = ZOOM_DEFAULT;
    });
    this.engine.uiRoot.append(box);
  }

  // ---------------------------------------------------------------------------------------

  update(dt) {
    this._lastDt = dt;
    this.time += dt;
    // Yaw: inertia after a flick, or ease to front for the photo.
    if (this.photoFrame) this.yaw = damp(this.yaw, Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2, 0.15, dt);
    else if (dt > 0) {
      this.yaw += this.yawVel * dt;
      this.yawVel = damp(this.yawVel, 0, 0.12, dt);
    }
    this.zoom = damp(this.zoom, this.zoomTarget, 0.12, dt);
    const h = this.human;
    if (h) {
      h.root.rotation.y = this.yaw;
      const look = this.lookAtLens ? new THREE.Vector3(0, this.headY, 1.4) : this.camera.position;
      h.lookAt(look);
      // Lip flaps while speaking.
      if (this.talking > 0) {
        this.talking -= dt;
        const keys = this._visKeys || (this._visKeys = Object.keys(VISEMES).filter((k) => k !== 'rest'));
        if (((this.time * 9) | 0) !== this._visIdx) {
          this._visIdx = (this.time * 9) | 0;
          h.setViseme(keys[(Math.random() * keys.length) | 0], 0.6 + Math.random() * 0.4);
        }
        if (this.talking <= 0) h.setViseme('rest', 1);
      }
      h.update(dt);
    }
    this.booth.update(dt, this.time);
    this._frameCamera(1 - Math.exp(-dt * 6));
  }

  exit() {
    clearTimeout(this._rebuildT);
    try { speechSynthesis.cancel(); } catch {}
    for (const c of this.cleanups) c();
    this.camera.clearViewOffset();
    this.form?.destroy();
    this.human?.dispose();
    this.booth?.dispose();
    this.photo?.dispose();
    this.envTex?.dispose();
    this.engine.renderer.domElement.style.touchAction = '';
  }
}
