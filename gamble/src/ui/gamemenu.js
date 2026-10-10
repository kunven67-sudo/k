// In-game menu (Esc / the ☰ touch button). Single player has no pause (DESIGN §1): the world keeps
// going while this is open — you just stand still and the clock keeps ticking behind the felt.
//
//   const m = openGameMenu(engine, { onClose, onQuit });   m.close()
//
// Card-table style like the settings sheet: Resume · Settings · Main menu. Quitting saves first;
// the life keeps going while you're away (catch-up on return).

import { el } from '../core/util.js';
import { t, i18n } from '../core/i18n.js';
import { save } from '../core/save.js';
import { clock } from '../core/clock.js';
import { ensureStyles } from './styles.js';
import { overlay, button, showCard } from './kit.js';
import { openSettings } from './settings.js';
import { uiSound } from './sfx.js';

i18n.register('gmenu', {
  en: {
    kicker: 'STILL IN RENO',
    title: 'Take a breather',
    note: 'There’s no pause in Reno — the world keeps going while this is open.',
    resume: 'Back to it',
    settings: 'Settings',
    quit: 'Main menu',
    quitTitle: 'Leave for now?',
    quitBody: 'Your life is saved. Time in Reno keeps moving while you’re gone — *rent included*.',
    quitYes: 'Main menu',
    quitNo: 'Stay',
  },
  es: {
    kicker: 'SIGUES EN RENO',
    title: 'Un respiro',
    note: 'En Reno no hay pausa: el mundo sigue mientras esto está abierto.',
    resume: 'Volver',
    settings: 'Ajustes',
    quit: 'Menú principal',
    quitTitle: '¿Te vas por ahora?',
    quitBody: 'Tu vida está guardada. El tiempo en Reno sigue mientras no estás, *renta incluida*.',
    quitYes: 'Menú principal',
    quitNo: 'Quedarme',
  },
});

let current = null;

export function isGameMenuOpen() {
  return !!current;
}

export function openGameMenu(engine, { onClose, onQuit } = {}) {
  if (current) return current;
  ensureStyles();
  const root = engine?.uiRoot || document.getElementById('ui-root');
  let sub = false; // settings / confirm card on top

  const close = () => {
    if (!current || sub) return;
    current = null;
    clearInterval(tick);
    uiSound('ui.back');
    ov.close();
    onClose?.();
  };

  const ov = overlay(root, { onDismiss: close, className: 'gx-gamemenu' });
  const time = el('div', { class: 'gx-kicker gm-time' });
  const updateTime = () => {
    const p = clock.local;
    const h = p.hour % 12 || 12;
    time.textContent = `${t('gmenu.kicker')} · ${h}:${String(p.minute).padStart(2, '0')} ${p.hour < 12 ? 'AM' : 'PM'}`;
  };
  updateTime();
  const tick = setInterval(updateTime, 1000);

  const resume = button(t('gmenu.resume'), close, { sound: 'ui.confirm' });
  const settingsBtn = button(t('gmenu.settings'), () => {
    sub = true;
    openSettings(engine, { onClose: () => (sub = false) });
  }, { ghost: true });
  const quit = button(t('gmenu.quit'), async () => {
    sub = true;
    const yes = await showCard(root, {
      title: t('gmenu.quitTitle'),
      body: t('gmenu.quitBody'),
      suit: '♠',
      actions: [{ label: t('gmenu.quitNo'), value: false, ghost: true }, { label: t('gmenu.quitYes'), value: true }],
    });
    sub = false;
    if (!yes) return;
    try {
      save.commit();
    } catch {
      /* storage full / private mode: the autosave already ran */
    }
    current = null;
    clearInterval(tick);
    ov.close();
    onQuit?.();
    engine.go('menu');
  }, { ghost: true });

  const table = el('div', { class: 'gx-table gm-table', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'gx-felt' }, [
      el('div', { class: 'gx-head' }, [time, el('h2', { class: 'gx-title', text: t('gmenu.title') })]),
      el('div', { class: 'gx-body gm-body' }, [
        el('div', { class: 'gm-buttons' }, [resume, settingsBtn, quit]),
        el('p', { class: 'gm-note', text: t('gmenu.note') }),
      ]),
    ]),
  ]);
  ov.el.appendChild(table);
  injectOnce();
  setTimeout(() => resume.focus(), 60);
  current = { close, el: ov.el };
  return current;
}

let injected = false;
function injectOnce() {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = `
.gm-table { width: min(440px, 100%); }
.gm-body { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-bottom: 26px; }
.gm-buttons { display: flex; flex-direction: column; gap: 12px; width: min(260px, 100%); margin-top: 8px; }
.gm-buttons .gx-btn { min-width: 0; }
.gm-note { margin: 4px 8px 0; text-align: center; font: 400 .86em/1.4 var(--font-ui); color: #d9cfae; opacity: .75; max-width: 30ch; }
.gm-time { font-variant-numeric: tabular-nums; }
`;
  document.head.appendChild(s);
}
