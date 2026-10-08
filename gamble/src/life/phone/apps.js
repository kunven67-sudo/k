// Phone apps. buildApp(name, phone) → { el, dark?, update?(dt), back?() → handled, dispose?() }.

import { clock } from '../../core/clock.js';
import { save } from '../../core/save.js';
import { t } from '../../core/i18n.js';
import { el, formatMoney } from '../../core/util.js';
import { openSettings } from '../../ui/settings.js';
import { say } from '../../player/voice.js';
import { slice, character } from '../state.js';
import { sfx } from '../sounds.js';
import { MapView } from './map.js';
import { licenseFallback } from './license.js';
import './calltones.js';

function bar(phone, title, right = []) {
  const back = el('button', { class: 'ph-btn', 'aria-label': t('life.phone.back') });
  back.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  back.onclick = () => phone.back();
  return el('div', { class: 'ph-bar' }, [back, el('span', { class: 'ttl' }, [title]), ...right]);
}

function shell(phone, title, { dark = false, right = [] } = {}) {
  const scroll = el('div', { class: 'ph-scroll' });
  const root = el('div', { class: 'ph-app' + (dark ? ' dark' : '') }, [bar(phone, title, right), scroll, phone.navBar()]);
  return { root, scroll };
}

const fmtTime = (h, m, loc) => new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, 0, 1, h, m)));

// ---- Clock (alarm) ----------------------------------------------------------------------------

function clockApp(phone) {
  const { root, scroll } = shell(phone, t('life.phone.clock'), { dark: true });
  const loc = phone._locale();
  const a = phone.data.alarm;
  const now = el('div', { class: 'ph-clockbig' });
  const date = el('div', { class: 'ph-hint', style: 'margin-top:0' });
  const at = el('div', { class: 'at' });
  const sw = el('div', { class: 'ph-sw' + (a.on ? ' on' : '') });
  const label = el('div', { class: 'ph-hint' });
  const refresh = () => {
    const [hm, ap] = fmtTime(a.hour, a.minute, loc).split(/\s(?=[AaPp])/);
    at.innerHTML = `${hm}<small>${ap || ''}</small>`;
    sw.classList.toggle('on', a.on);
    label.textContent = a.on ? t('life.phone.alarmOn', { time: fmtTime(a.hour, a.minute, loc) }) : t('life.phone.alarmOff');
  };
  sw.onclick = () =>
    phone.lag(() => {
      a.on = !a.on;
      save.markDirty();
      refresh();
    });
  const adj = (dh, dm) => () => {
    let mins = (a.hour * 60 + a.minute + dh * 60 + dm + 1440) % 1440;
    a.hour = Math.floor(mins / 60);
    a.minute = mins % 60;
    a.on = true;
    save.markDirty();
    refresh();
  };
  const btn = (txt, fn) => {
    const b = el('button', { class: 'ph-btn' }, [txt]);
    b.onclick = fn;
    return b;
  };
  scroll.append(
    now,
    date,
    el('div', { class: 'ph-alarm' }, [el('div', { style: 'flex:1' }, [el('div', { style: 'font-size:11px;opacity:.6;margin-bottom:2px' }, [t('life.phone.alarm')]), at]), sw]),
    el('div', { class: 'ph-adj' }, [btn('−', adj(-1, 0)), btn('+', adj(1, 0)), btn(':−', adj(0, -15)), btn(':+', adj(0, 15))]),
    label,
    el('div', { class: 'ph-hint' }, [t('life.phone.alarmHint')]),
  );
  refresh();
  const tick = () => {
    now.textContent = clock.format({ hour: 'numeric', minute: '2-digit' }, loc);
    date.textContent = clock.format({ weekday: 'long', month: 'long', day: 'numeric' }, loc);
  };
  tick();
  let acc = 0;
  return { el: root, dark: true, update: (dt) => (acc += dt) > 0.5 && ((acc = 0), tick()) };
}

// ---- Messages + calling --------------------------------------------------------------------------

function threads() {
  const napkin = slice('inventory').pockets?.find((p) => p.kind === 'napkin') || { number: '(775) 555-0134' };
  return [
    { id: 'unknown', name: t('life.phone.unknown'), number: napkin.number, color: '#8a8f98', preview: t('life.phone.napkinNumber'), msgs: [], time: '' },
    { id: 'carrier', name: 'SilverLine', number: '611', color: '#5b6fd6', preview: t('life.msg.carrier'), msgs: [t('life.msg.carrier')], time: t('life.msg.yesterday') },
    { id: 'spam', name: '72633', number: '72633', color: '#d9873b', preview: t('life.msg.spam'), msgs: [t('life.msg.spam')], time: t('life.msg.mon') },
  ];
}

function messagesApp(phone) {
  const { root, scroll } = shell(phone, t('life.phone.messages'));
  let sub = null; // the open thread / call screen
  const list = () => {
    scroll.textContent = '';
    for (const th of threads()) {
      const av = el('div', { class: 'ph-av' }, [th.id === 'unknown' ? '?' : th.name[0]]);
      av.style.background = th.color;
      const row = el('div', { class: 'ph-row' }, [av, el('div', { class: 'mid' }, [el('div', { class: 'nm' }, [th.name]), el('div', { class: 'pv' }, [th.preview])]), el('div', { class: 'tm' }, [th.time])]);
      row.onclick = () => phone.lag(() => openThread(th));
      scroll.appendChild(row);
    }
  };
  const openThread = (th) => {
    const callBtn = el('button', { class: 'ph-btn', 'aria-label': t('life.phone.call') });
    callBtn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1f9a47" stroke-width="2" stroke-linejoin="round"><path d="M7.5 4h2.2l1.4 4-1.8 1.2a10 10 0 0 0 4.5 4.5l1.2-1.8 4 1.4v2.2A2 2 0 0 1 17 17.5 13.5 13.5 0 0 1 5.5 6 2 2 0 0 1 7.5 4z"/></svg>';
    callBtn.onclick = () => phone.lag(() => call(th));
    const body = el('div', { class: 'ph-scroll', style: 'display:flex;flex-direction:column;padding-bottom:10px' });
    body.appendChild(el('div', { class: 'ph-note' }, [th.number]));
    if (!th.msgs.length) body.appendChild(el('div', { class: 'ph-empty' }, [t('life.phone.noMessages')]));
    for (const m of th.msgs) body.appendChild(el('div', { class: 'ph-msg in' }, [m]));
    const b = bar(phone, th.name, [callBtn]);
    sub = el('div', { class: 'ph-app' }, [b, body, phone.navBar()]);
    root.appendChild(sub);
  };
  const call = (th) => {
    const st = el('div', { class: 'st' }, [t('life.phone.calling')]);
    const end = el('button', { class: 'end', 'aria-label': t('life.phone.endCall') });
    end.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 9c-3.3 0-6.3.9-8.4 2.4-.6.4-.7 1.2-.3 1.8l1.2 1.6c.4.5 1.1.7 1.7.4l2.2-1.1c.5-.2.8-.7.8-1.2v-1.2c.9-.3 1.8-.4 2.8-.4s1.9.1 2.8.4v1.2c0 .5.3 1 .8 1.2l2.2 1.1c.6.3 1.3.1 1.7-.4l1.2-1.6c.4-.6.3-1.4-.3-1.8C18.3 9.9 15.3 9 12 9z"/></svg>';
    const av = el('div', { class: 'av' });
    av.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="#c9ced6"><circle cx="12" cy="8.5" r="4"/><path d="M4 20c1-4 4.5-6 8-6s7 2 8 6z"/></svg>';
    const screen = el('div', { class: 'ph-call' }, [av, el('div', { class: 'nm' }, [th.id === 'unknown' ? th.number : th.name]), st, end]);
    root.appendChild(screen);
    const timers = [];
    let tone = null;
    let speech = null;
    const hang = () => {
      timers.forEach(clearTimeout);
      tone?.stop?.(0.05);
      speech?.cancel?.();
      screen.remove();
      callState = null;
    };
    end.onclick = hang;
    callState = { hang };
    phone.player?.human?.setExpression?.('nervous', 0.5);
    // Two rings… then the three rising tones and the recording.
    timers.push(setTimeout(() => (tone = sfx('life.ringback', { bus: 'ui', gain: 0.35 })), 600));
    timers.push(
      setTimeout(() => {
        tone?.stop?.(0.05);
        tone = sfx('life.sit', { bus: 'ui', gain: 0.35 });
        st.textContent = t('life.phone.notInService');
      }, 7600),
    );
    timers.push(setTimeout(() => (speech = say(t('life.phone.notInService'), { male: false, pitch: 1.05, rate: 0.95, volume: 0.7 })), 8700));
    timers.push(setTimeout(hang, 16000));
  };
  let callState = null;
  list();
  return {
    el: root,
    back() {
      if (callState) return callState.hang(), true;
      if (sub) return sub.remove(), (sub = null), true;
      return false;
    },
    dispose: () => callState?.hang(),
  };
}

// ---- Wallet -----------------------------------------------------------------------------------

function walletApp(phone) {
  const { root, scroll } = shell(phone, t('life.phone.wallet'));
  const m = slice('money');
  const card = (label, value, bg) => {
    const c = el('div', { class: 'ph-card' }, [el('div', { class: 'lb' }, [label]), el('div', { class: 'v' }, [value])]);
    c.style.background = bg;
    return c;
  };
  const fill = () => {
    scroll.textContent = '';
    scroll.append(
      card(t('life.phone.cash'), formatMoney(m.cash, { cents: m.cash % 1 !== 0 }), 'linear-gradient(135deg,#2f7d58,#1a4d36)'),
      card(t('life.phone.bank'), formatMoney(m.bank), 'linear-gradient(135deg,#3b4a6b,#1d2638)'),
      card(t('life.phone.chips'), formatMoney(m.chips), 'linear-gradient(135deg,#8a2330,#4a1219)'),
      el('div', { class: 'ph-hint', style: 'text-align:left;margin:16px 16px 4px;opacity:.6;font-weight:600' }, [t('life.phone.idCard')]),
    );
    const id = el('div', { class: 'ph-id' });
    const src = character()?.licenseCard;
    if (src) id.appendChild(el('img', { src, alt: t('life.phone.idCard') }));
    else id.appendChild(licenseFallback());
    scroll.appendChild(id);
  };
  fill();
  return { el: root };
}

// ---- Maps -------------------------------------------------------------------------------------------

function mapsApp(phone) {
  const canvas = el('canvas', { style: 'width:100%;height:100%;display:block;touch-action:none' });
  const zoomIn = el('button', { class: 'ph-btn', style: 'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);width:34px;height:34px;font-size:18px' }, ['+']);
  const zoomOut = el('button', { class: 'ph-btn', style: 'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);width:34px;height:34px;font-size:18px' }, ['−']);
  const zbox = el('div', { style: 'position:absolute;right:10px;bottom:16px;display:flex;flex-direction:column;gap:8px' }, [zoomIn, zoomOut]);
  const wrap = el('div', { style: 'flex:1;position:relative;overflow:hidden' }, [canvas, zbox]);
  const root = el('div', { class: 'ph-app' }, [bar(phone, t('life.phone.maps')), wrap, phone.navBar()]);
  const view = new MapView(canvas);
  zoomIn.onclick = () => phone.lag(() => view.setZoom(view.zoom * 1.5));
  zoomOut.onclick = () => phone.lag(() => view.setZoom(view.zoom / 1.5));
  canvas.addEventListener('wheel', (e) => view.setZoom(view.zoom * (e.deltaY < 0 ? 1.15 : 0.87)), { passive: true });
  // GPS updates are choppy on this phone: redraw ~6 times a second.
  let acc = 1;
  return {
    el: root,
    update(dt) {
      acc += dt;
      if (acc < 0.16) return;
      const p = phone.player?.position;
      const yaw = phone.player?.cam?.yaw ?? (phone.engine.camera ? camYaw(phone.engine.camera) : null);
      view.draw(acc, p, yaw);
      acc = 0;
    },
  };
}

function camYaw(cam) {
  const e = cam.matrixWorld.elements;
  // Forward = -Z column; yaw 0 means facing -Z (north), positive turns east.
  return Math.atan2(-e[8], e[10]) * -1;
}

// ---- Camera -----------------------------------------------------------------------------------------

function cameraApp(phone) {
  const thumb = el('div', { class: 'ph-thumb' });
  const shut = el('button', { class: 'ph-shut', 'aria-label': t('life.phone.shutter') });
  const flip = el('div', { style: 'width:40px;height:40px;display:grid;place-items:center;opacity:.85' });
  flip.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>';
  const flash = el('div', { class: 'ph-flash' });
  const modes = el('div', { class: 'ph-modes' }, ['Video', el('b', {}, ['Photo']), 'Portrait']);
  const ui = el('div', { class: 'ph-camui' }, [el('div', { class: 'grid' }), modes, el('div', { class: 'bot' }, [thumb, shut, flip]), flash]);
  const root = el('div', { class: 'ph-app dark', style: 'background:transparent' }, [ui]);
  // The viewfinder is a hole in the screen: the lens sees what's behind the phone.
  phone.screen.style.background = 'transparent';
  shut.onclick = () => {
    const url = capture(phone.engine);
    sfx('phone.camera', { bus: 'ui', gain: 0.7 });
    flash.style.transition = 'none';
    flash.style.opacity = '0.9';
    requestAnimationFrame(() => {
      flash.style.transition = 'opacity .35s';
      flash.style.opacity = '0';
    });
    if (!url) return;
    thumb.style.backgroundImage = `url(${url})`;
    const d = phone.data;
    d.photos = (d.photos || 0) + 1;
    save.markDirty();
    const p = clock.local;
    const pad = (n) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `IMG_${p.year}${pad(p.month)}${pad(p.day)}_${pad(p.hour)}${pad(p.minute)}${pad(p.second)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    phone.lag(() => phone.toast(t('life.phone.saved')), 300);
  };
  return {
    el: root,
    dark: true,
    dispose: () => (phone.screen.style.background = ''),
  };
}

/** Render the 3D view once more and read it back in the same task (no preserveDrawingBuffer needed). */
function capture(engine) {
  try {
    if (engine.composer) engine.composer.render();
    else engine.renderer.render(engine.scene, engine.camera);
    return engine.renderer.domElement.toDataURL('image/png');
  } catch (err) {
    console.warn('[phone] capture failed', err);
    return null;
  }
}

// ---- Settings -----------------------------------------------------------------------------------

function settingsApp(phone) {
  // The settings sheet is a full overlay: the phone dips out of view until it closes.
  phone.root.style.visibility = 'hidden';
  openSettings(phone.engine, {
    onClose: () => {
      phone.root.style.visibility = '';
      if (phone.isOpen) phone._input()?.setPointerLock?.(false);
    },
  });
  return null;
}

const APPS = { clock: clockApp, messages: messagesApp, wallet: walletApp, maps: mapsApp, camera: cameraApp, settings: settingsApp };

export function buildApp(name, phone) {
  return APPS[name]?.(phone) || null;
}
