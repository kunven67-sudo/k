// Pockets (I key): the character pats their pockets and you look down at what's in your hands
// (DESIGN §39). The world dims and softens behind a fan of the real items, drawn in code; pick
// one to look closer — the wallet opens on your license and cash, the napkin shows the name.

import { injectStyle, el } from '../core/util.js';
import { t } from '../core/i18n.js';
import { bus } from '../core/events.js';
import { slice, roomNumber, character } from './state.js';
import { itemCanvas, walletOpen, fmtCash } from './items.js';
import { licenseFallback } from './phone/license.js';
import { sfx } from './sounds.js';

injectStyle(
  'life-pockets',
  `
.pk{position:absolute;inset:0;z-index:35;font-family:var(--font-ui);color:#f3ead8;opacity:0;transition:opacity .35s;
  background:radial-gradient(120% 90% at 50% 100%,rgba(8,6,4,.25) 0%,rgba(8,6,4,.72) 60%,rgba(4,3,2,.9) 100%)}
.pk.show{opacity:1}
.pk-head{position:absolute;left:calc(26px + var(--safe-left,0px));top:calc(22px + var(--safe-top,0px))}
.pk-head h2{margin:0;font:400 34px/1 var(--font-display);letter-spacing:.06em;color:#f3ead8}
.pk-head p{margin:6px 0 0;font-size:13px;opacity:.6}
.pk-fan{position:absolute;left:50%;bottom:calc(13vh + var(--safe-bottom,0px));width:0;height:0}
.pk-it{all:unset;position:absolute;left:0;bottom:0;cursor:pointer;transform-origin:50% 160%;
  transition:transform .35s cubic-bezier(.2,.9,.3,1.1),filter .25s,opacity .3s}
.pk-it canvas{display:block;height:auto;filter:drop-shadow(0 14px 16px rgba(0,0,0,.55)) drop-shadow(0 3px 3px rgba(0,0,0,.4))}
.pk-it .lb{position:absolute;left:0;right:0;top:calc(100% + 8px);text-align:center;font-size:12px;font-weight:600;
  letter-spacing:.08em;text-transform:uppercase;opacity:0;transition:opacity .2s}
.pk-it.sel .lb,.pk-it:hover .lb,.pk-it:focus-visible .lb{opacity:.9}
.pk-it.sel,.pk-it:hover{filter:brightness(1.12)}
.pk-insp{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;
  background:rgba(4,3,2,.55);padding:20px}
.pk-insp.show{display:flex;animation:pkIn .35s cubic-bezier(.2,.9,.3,1.1)}
.pk-insp canvas{max-width:min(560px,86vw);max-height:56vh;width:auto;height:auto;filter:drop-shadow(0 22px 26px rgba(0,0,0,.6))}
.pk-insp .tx{max-width:min(460px,86vw);text-align:center;font:17px/1.5 'Special Elite',var(--font-ui);color:#efe6d2}
.pk-insp .nm{font:400 28px/1 var(--font-display);letter-spacing:.08em;color:var(--gold-bright)}
.pk-close{all:unset;cursor:pointer;position:absolute;right:calc(22px + var(--safe-right,0px));top:calc(20px + var(--safe-top,0px));
  padding:9px 16px;border-radius:999px;background:rgba(20,16,12,.7);box-shadow:0 0 0 1px rgba(216,178,90,.35) inset;font-size:13px;font-weight:600}
.pk-close:hover{box-shadow:0 0 0 1.5px var(--gold) inset}
@keyframes pkIn{from{opacity:0;transform:scale(.92)}}
`,
);

const WIDTH = { wallet: 170, cash: 160, phone: 74, keycard: 150, napkin: 150, receipt: 92 };

export class Pockets {
  constructor({ engine, player, state }) {
    this.engine = engine;
    this.player = player;
    this.state = state;
    this.isOpen = false;
    this.sel = 0;
    this._onKey = (e) => this._key(e);
  }

  items() {
    const inv = slice('inventory').pockets || [];
    const cash = slice('money').cash;
    const list = [];
    for (const it of inv) {
      list.push(it);
      if (it.kind === 'wallet' && cash > 0) list.push({ id: 'cash', kind: 'cash' });
    }
    return list;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.player?.human?.play?.('pat-pockets');
    sfx('pocket.pat', { gain: 0.8 });
    window.__gamble?.input?.setPointerLock?.(false);
    const fx = this.engine.effects;
    this._blur0 = fx?.uBlur?.value ?? 0;
    this.root = el('div', { class: 'pk' });
    this.head = el('div', { class: 'pk-head' }, [el('h2', {}, [t('life.pockets.title')]), el('p', {}, [t('life.pockets.hint')])]);
    const closeBtn = el('button', { class: 'pk-close' }, [t('life.pockets.close')]);
    closeBtn.onclick = () => this.close();
    this.fan = el('div', { class: 'pk-fan' });
    this.insp = el('div', { class: 'pk-insp' });
    this.insp.onclick = () => this._uninspect();
    this.root.append(this.head, this.fan, this.insp, closeBtn);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    (this.engine.uiRoot || document.body).appendChild(this.root);
    this._layout();
    // Items come out of the pockets one by one, in sync with the pat.
    requestAnimationFrame(() => this.root.classList.add('show'));
    window.addEventListener('keydown', this._onKey);
    this.t = 0;
    bus.emit('pockets:open');
  }

  _layout() {
    this.fan.textContent = '';
    const ctx = { cash: slice('money').cash, room: roomNumber(this.state) };
    const items = this.items();
    this.btns = items.map((it, i) => {
      const cv = itemCanvas(it, ctx);
      const scale = Math.min(1.25, Math.max(0.5, innerWidth / 1100));
      const w = (WIDTH[it.kind] || 140) * scale;
      cv.style.width = `${w}px`;
      const label = it.kind === 'cash' ? fmtCash(ctx.cash) : t(`life.item.${it.kind}`);
      const b = el('button', { class: 'pk-it' }, [cv, el('span', { class: 'lb' }, [label])]);
      const n = items.length;
      const u = n > 1 ? i / (n - 1) - 0.5 : 0;
      const spread = Math.min(innerWidth * 0.86 - 150 * scale, 760);
      const x = u * spread;
      const y = -Math.cos(u * 1.6) * 40 + 40;
      const rot = u * 26;
      b.dataset.base = `translate(${x - w / 2}px, ${y}px) rotate(${rot}deg)`;
      b.style.transform = `translate(${x - w / 2}px, 60vh) rotate(${rot * 2}deg)`;
      b.style.transitionDelay = `${120 + i * 70}ms`;
      b.onclick = (e) => {
        e.stopPropagation();
        this.sel = i;
        this.inspect(it);
      };
      b.onmouseenter = () => this._select(i);
      this.fan.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => (b.style.transform = b.dataset.base)));
      setTimeout(() => (b.style.transitionDelay = '0ms'), 600 + i * 70);
      return b;
    });
    this._select(Math.min(this.sel, this.btns.length - 1));
  }

  _select(i) {
    this.sel = i;
    this.btns.forEach((b, k) => {
      b.classList.toggle('sel', k === i);
      b.style.transform = k === i ? `${b.dataset.base} translateY(-26px) scale(1.06)` : b.dataset.base;
      b.style.zIndex = k === i ? 5 : 1;
    });
  }

  inspect(it) {
    sfx(it.kind === 'wallet' ? 'wallet.open' : 'ui.paper', { bus: 'ui', gain: 0.7 });
    const ctx = { cash: slice('money').cash, room: roomNumber(this.state) };
    this.insp.textContent = '';
    let cv;
    let desc;
    if (it.kind === 'wallet') {
      const lic = this._license();
      cv = walletOpen(lic.ready ? lic.img : null, ctx.cash);
      if (!lic.ready) lic.img.onload = () => this.isOpen && this.inspecting === it && this.inspect(it);
      desc = `${t('life.item.wallet.desc')} ${t('life.item.cash.desc', { amount: fmtCash(ctx.cash) })}`;
    } else {
      cv = itemCanvas(it, ctx).cloneNode();
      cv.getContext('2d').drawImage(itemCanvas(it, ctx), 0, 0);
      desc = t(`life.item.${it.kind}.desc`, { room: ctx.room, name: it.name, number: it.number, amount: fmtCash(ctx.cash) });
    }
    cv.style.width = `${Math.min(cv.width / 2 * (it.kind === 'wallet' ? 1.3 : 1.7), innerWidth * 0.86)}px`;
    const title = it.kind === 'cash' ? fmtCash(ctx.cash) : t(`life.item.${it.kind}`);
    this.insp.append(el('div', { class: 'nm' }, [title]), cv, el('div', { class: 'tx' }, [desc]));
    this.insp.classList.add('show');
    this.inspecting = it;
    this.head.style.opacity = '0';
    this.fan.style.opacity = '0';
    // Looking at the phone just takes it out.
    if (it.kind === 'phone') {
      setTimeout(() => {
        if (this.inspecting !== it) return;
        this.close();
        bus.emit('life:phone-open-request');
      }, 650);
    }
  }

  _license() {
    if (this._lic) return this._lic;
    const src = character()?.licenseCard;
    if (src) {
      const img = new Image();
      const lic = { img, ready: false };
      img.onload = () => (lic.ready = true);
      img.src = src;
      if (img.complete) lic.ready = true;
      this._lic = lic;
    } else this._lic = { img: licenseFallback(), ready: true };
    return this._lic;
  }

  _uninspect() {
    this.insp.classList.remove('show');
    this.inspecting = null;
    this.head.style.opacity = '';
    this.fan.style.opacity = '';
  }

  _key(e) {
    if (!this.isOpen) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.inspecting) this._uninspect();
      else this.close();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') this._select(Math.min(this.btns.length - 1, this.sel + 1));
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._select(Math.max(0, this.sel - 1));
    else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (this.inspecting) this._uninspect();
      else this.inspect(this.items()[this.sel]);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    window.removeEventListener('keydown', this._onKey);
    const r = this.root;
    r.classList.remove('show');
    setTimeout(() => r.remove(), 360);
    sfx('cloth.rustle', { gain: 0.5 });
    window.__gamble?.input?.setPointerLock?.(true);
    this.inspecting = null;
    bus.emit('pockets:close');
  }

  update(dt) {
    if (!this.isOpen) {
      if (this._myBlur) this.releaseFx();
      return;
    }
    // The world goes soft behind your hands (our share only, on top of anything else).
    const fx = this.engine.effects;
    this.t += dt;
    const want = Math.min(1, this.t * 3) * 0.35;
    if (fx?.uBlur) {
      fx.uBlur.value = Math.max(0, fx.uBlur.value + want - (this._myBlur || 0));
      this._myBlur = want;
    }
  }

  releaseFx() {
    const fx = this.engine.effects;
    if (fx?.uBlur && this._myBlur) fx.uBlur.value = Math.max(0, fx.uBlur.value - this._myBlur);
    this._myBlur = 0;
  }

  dispose() {
    this.close();
    this.releaseFx();
  }
}
