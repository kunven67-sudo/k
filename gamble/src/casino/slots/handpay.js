// Hand pay: the slot attendant brings a Form W-2G clipboard. Slot jackpots of $1,200 or more are
// reportable; with an SSN nothing is withheld, without one the casino must take 24 % federal
// backup withholding (Nevada has no state income tax). The player picks, signs, and the cash is
// counted out. Resolves { net, withheld, ssn }.

import { el, injectStyle } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { save } from '../../core/save.js';
import { clock } from '../../core/clock.js';
import { fmt$ } from './screen.js';
import { machineSound } from './sound.js';

injectStyle(
  'slots-w2g',
  `
.w2g-wrap { position:absolute; inset:0; display:grid; place-items:center; pointer-events:auto; z-index:5;
  background: radial-gradient(120% 90% at 50% 40%, rgba(8,6,10,.25), rgba(4,3,5,.78)); opacity:0; transition: opacity .3s; padding:12px; box-sizing:border-box; }
.w2g-wrap.in { opacity:1; }
.w2g-board { position:relative; width:min(560px, 100%); max-height:calc(100dvh - 24px); overflow:auto; border-radius:14px; padding:44px 16px 16px;
  background: linear-gradient(160deg, #7a5432, #5a3a20); box-shadow: 0 30px 70px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,220,180,.25);
  transform: translateY(30px) rotate(-1.5deg); transition: transform .5s cubic-bezier(.2,1.3,.4,1); }
.w2g-wrap.in .w2g-board { transform: rotate(-.6deg); }
.w2g-clip { position:absolute; left:50%; top:8px; transform:translateX(-50%); width:150px; height:34px; border-radius:6px 6px 10px 10px;
  background: linear-gradient(#e8e8ea, #9aa0a8 50%, #d0d4d8); box-shadow: 0 3px 6px rgba(0,0,0,.5); }
.w2g-paper { background: linear-gradient(#fbfaf3, #f1efe4); color:#1a1a1a; padding:16px 18px 14px; box-shadow: 0 2px 6px rgba(0,0,0,.35);
  font:500 12px/1.35 var(--font-ui); }
.w2g-top { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1a1a1a; padding-bottom:6px; margin-bottom:8px; }
.w2g-top h2 { margin:0; font:700 24px/1 var(--font-casino); }
.w2g-top small { font:600 11px var(--font-ui); letter-spacing:.04em; }
.w2g-grid { display:grid; grid-template-columns: 1fr 1fr; border-left:1px solid #555; border-top:1px solid #555; }
.w2g-box { border-right:1px solid #555; border-bottom:1px solid #555; padding:4px 6px 6px; min-height:38px; }
.w2g-box label { display:block; font:600 9.5px var(--font-ui); text-transform:uppercase; letter-spacing:.03em; color:#444; }
.w2g-box .v { font:400 17px var(--font-type); color:#0a2a7a; }
.w2g-box.wide { grid-column: span 2; }
.w2g-explain { margin:10px 0 10px; font:500 12.5px/1.45 var(--font-ui); color:#222; background:rgba(255,230,150,.35); padding:8px 10px; border-left:3px solid #c08a00; }
.w2g-choices { display:flex; gap:8px; flex-wrap:wrap; }
.w2g-btn { flex:1 1 180px; padding:11px 12px; border-radius:8px; border:0; cursor:pointer; font:400 18px var(--font-display); letter-spacing:.06em;
  color:#1a1208; background: linear-gradient(#ffe680, #d09a00); box-shadow: 0 3px 0 #6a4a00, inset 0 1px 0 rgba(255,255,255,.6); }
.w2g-btn.alt { background: linear-gradient(#e8e4dc, #b8b0a4); box-shadow: 0 3px 0 #5a5248, inset 0 1px 0 rgba(255,255,255,.6); }
.w2g-btn.sel { outline: 3px solid #0a2a7a; outline-offset: 2px; }
.w2g-btn:disabled { opacity:.5; cursor:not-allowed; }
.w2g-sign { margin-top:12px; display:flex; align-items:center; gap:10px; }
.w2g-sign .net { flex:1; font:400 30px var(--font-display); letter-spacing:.04em; color:#0a4a1a; }
.w2g-sig { font: italic 400 26px var(--font-casino); color:#0a2a7a; border-bottom:1px solid #333; min-width:140px; text-align:center; height:32px; }
`,
);

export function openHandPay(machine, amount) {
  return new Promise((resolve) => {
    const root = machine.engine?.uiRoot || document.getElementById('ui-root');
    const life = save.life;
    const name = life?.character?.name || life?.character?.params?.name || '—';
    const ssnLast = String(1000 + (hash(name) % 9000));
    const date = new Date(clock.gameMs || Date.now());
    let ssn = null;

    const box = (label, value, wide = false) => el('div', { class: `w2g-box${wide ? ' wide' : ''}` }, [el('label', { text: label }), el('div', { class: 'v', text: value })]);
    const withheldBox = box(t('slots.w2g.box4'), '—');
    const winnerBox = box(t('slots.w2g.winner'), name);
    const grid = el('div', { class: 'w2g-grid' }, [
      box(t('slots.w2g.payer'), t('slots.w2g.payerName'), true),
      box(t('slots.w2g.box1'), fmt$(amount)),
      box(t('slots.w2g.box2'), date.toLocaleDateString('en-US')),
      box(t('slots.w2g.box3'), t('slots.w2g.slot')),
      withheldBox,
      box(t('slots.w2g.box7'), machine.id.toUpperCase()),
      winnerBox,
    ]);
    const yes = el('button', { class: 'w2g-btn', text: t('slots.w2g.giveSsn') });
    const no = el('button', { class: 'w2g-btn alt', text: t('slots.w2g.decline') });
    const net = el('div', { class: 'net', text: '' });
    const sig = el('div', { class: 'w2g-sig', text: '' });
    const sign = el('button', { class: 'w2g-btn', text: t('slots.w2g.sign'), disabled: true });
    const paper = el('div', { class: 'w2g-paper' }, [
      el('div', { class: 'w2g-top' }, [el('h2', { text: t('slots.w2g.title') }), el('small', { text: t('slots.w2g.subtitle') })]),
      grid,
      el('div', { class: 'w2g-explain', text: t('slots.w2g.explain') }),
      el('div', { class: 'w2g-choices' }, [yes, no]),
      el('div', { class: 'w2g-sign' }, [net, sig]),
      el('div', { style: { marginTop: '10px' } }, [sign]),
    ]);
    const wrap = el('div', { class: 'w2g-wrap' }, [el('div', { class: 'w2g-board' }, [el('div', { class: 'w2g-clip' }), paper])]);
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.append(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    machineSound(machine, 'ui.paper', { gain: 0.8 });

    const choose = (give) => {
      ssn = give;
      yes.classList.toggle('sel', give);
      no.classList.toggle('sel', !give);
      const withheld = give ? 0 : Math.round(amount * 0.24 * 100) / 100;
      withheldBox.querySelector('.v').textContent = fmt$(withheld);
      winnerBox.querySelector('.v').textContent = `${name} · ${give ? t('slots.w2g.ssnMasked', { d: ssnLast }) : t('slots.w2g.noSsn')}`;
      net.textContent = `${t('slots.w2g.net')} ${fmt$(amount - withheld)}`;
      sign.disabled = false;
      machineSound(machine, 'ui.click', { gain: 0.6 });
    };
    yes.addEventListener('click', () => choose(true));
    no.addEventListener('click', () => choose(false));
    sign.addEventListener('click', () => {
      if (ssn == null) return;
      sig.textContent = name;
      machineSound(machine, 'ui.paper', { gain: 0.8 });
      machineSound(machine, 'cash.count', { gain: 0.9 });
      const withheld = ssn ? 0 : Math.round(amount * 0.24 * 100) / 100;
      setTimeout(() => {
        wrap.classList.remove('in');
        setTimeout(() => wrap.remove(), 350);
        resolve({ net: Math.round((amount - withheld) * 100) / 100, withheld, ssn });
      }, 700);
    });
  });
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
