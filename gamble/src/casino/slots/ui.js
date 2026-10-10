// Seated slot controls (DOM over the close-up): a leather wallet tray on the right with your
// bills ($1 / $5 / $20 / $100 from pocket cash) and TITO tickets, and a slim lit control bar that
// mirrors the machine's own deck (the 3D buttons and lever are clickable too). The machine's
// meters stay on the machine — this layer never shows a HUD.

import { el, injectStyle } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { slice } from '../../life/state.js';
import { tickets } from '../tickets.js';
import { fmt$ } from './screen.js';

const BILLS = [1, 5, 20, 100];

injectStyle(
  'slots-ui',
  `
.slots-wallet { position:absolute; right:max(12px, env(safe-area-inset-right)); top:max(12px, env(safe-area-inset-top)); width:212px; pointer-events:auto;
  padding:12px 12px 10px; border-radius:16px; color:#f3e6cc; font:500 12px/1.3 var(--font-ui);
  background: radial-gradient(120% 80% at 30% 0%, rgba(120,70,40,.55), transparent 60%), linear-gradient(170deg, #4a2a18, #2a160c 60%, #1e0f08);
  box-shadow: 0 10px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,220,180,.18), inset 0 0 0 1px rgba(0,0,0,.6);
  transition: transform .35s cubic-bezier(.2,1.3,.4,1), opacity .25s; }
.slots-wallet::before { content:''; position:absolute; inset:5px; border-radius:12px; border:1.5px dashed rgba(230,190,140,.28); pointer-events:none; }
.slots-wallet.collapsed { transform: translateX(calc(100% - 46px)); }
.slots-wallet.nudge { animation: slots-nudge .6s ease; }
@keyframes slots-nudge { 0%,100%{transform:none} 25%{transform:translateX(-10px)} 60%{transform:translateX(5px)} }
.slots-wallet h4 { margin:0 0 6px; font:400 17px/1 var(--font-display); letter-spacing:.12em; color:#ffd88a; display:flex; justify-content:space-between; align-items:center; }
.slots-wallet .cash { font:400 15px var(--font-display); letter-spacing:.06em; color:#cfe8b8; }
.slots-tab { position:absolute; left:-2px; top:10px; width:30px; height:30px; border-radius:8px; border:0; cursor:pointer;
  background:linear-gradient(#6a3a20,#3a1e0e); color:#ffd88a; font:400 16px var(--font-display); box-shadow:inset 0 1px 0 rgba(255,220,180,.25); display:none; }
.slots-wallet.collapsed .slots-tab { display:block; left:8px; }
.slots-bills { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin:8px 0 10px; }
.slots-bill { position:relative; height:44px; border:0; border-radius:4px; cursor:pointer; color:#1d3a1a; text-align:left; padding:0 8px;
  font:400 22px/44px var(--font-display); letter-spacing:.04em; overflow:hidden;
  background: radial-gradient(ellipse at 70% 50%, rgba(255,255,255,.35), transparent 40%), repeating-linear-gradient(90deg, rgba(40,80,40,.08) 0 2px, transparent 2px 5px), linear-gradient(#d9e6c8, #b8cca2);
  box-shadow: 0 2px 4px rgba(0,0,0,.5), inset 0 0 0 2px rgba(60,100,60,.45), inset 0 0 0 4px rgba(230,240,220,.6); transition: transform .12s, filter .12s; }
.slots-bill::after { content:''; position:absolute; right:8px; top:9px; width:24px; height:24px; border-radius:50%; border:2px solid rgba(40,80,40,.4); background:radial-gradient(circle, rgba(40,80,40,.18), transparent 70%); }
.slots-bill:hover { transform: translateY(-2px) rotate(-1deg); filter:brightness(1.06); }
.slots-bill:active { transform: translateY(1px) scale(.98); }
.slots-bill:disabled { filter: grayscale(.8) brightness(.55); cursor:not-allowed; transform:none; }
.slots-tickets { display:flex; flex-direction:column; gap:6px; max-height:160px; overflow:auto; }
.slots-ticket { border:0; cursor:pointer; text-align:left; padding:6px 8px 6px 34px; border-radius:2px; position:relative; color:#222;
  font:600 11px var(--font-ui); background: linear-gradient(#fbfaf5, #ecebe2); box-shadow:0 2px 3px rgba(0,0,0,.45); }
.slots-ticket b { font:400 18px var(--font-display); letter-spacing:.04em; display:block; }
.slots-ticket::before { content:''; position:absolute; left:6px; top:6px; bottom:6px; width:20px;
  background: repeating-linear-gradient(0deg, #111 0 1px, transparent 1px 3px, #111 3px 5px, transparent 5px 6px); }
.slots-ticket:hover { filter:brightness(1.05); transform:translateX(-2px); }
.slots-none { opacity:.55; font-size:11px; }
.slots-bar { position:absolute; right:max(12px, env(safe-area-inset-right)); bottom:max(14px, env(safe-area-inset-bottom)); left:150px;
  display:flex; justify-content:flex-end; align-items:flex-end; gap:8px; pointer-events:none; flex-wrap:wrap; }
.slots-btn { pointer-events:auto; min-width:64px; height:42px; padding:0 10px; border-radius:7px; border:0; cursor:pointer;
  font:400 16px/1 var(--font-display); letter-spacing:.08em; color:#1a1208; white-space:pre-line;
  background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.55), transparent 60%), linear-gradient(var(--c1), var(--c2));
  box-shadow: 0 0 14px var(--glow), 0 3px 0 rgba(0,0,0,.55), inset 0 0 0 2px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.6);
  transition: transform .08s, box-shadow .08s, filter .1s; }
.slots-btn:hover { filter:brightness(1.12); }
.slots-btn:active, .slots-btn.down { transform: translateY(3px); box-shadow: 0 0 20px var(--glow), 0 0 0 rgba(0,0,0,.5), inset 0 0 0 2px rgba(0,0,0,.35); }
.slots-btn.spin { width:86px; height:86px; min-width:0; border-radius:50%; font-size:24px; letter-spacing:.1em; }
.slots-btn.dim { filter: grayscale(.6) brightness(.6); }
.slots-hint { position:absolute; left:150px; bottom:max(18px, env(safe-area-inset-bottom)); color:rgba(255,240,210,.55); font:500 11px var(--font-ui); pointer-events:none; }
.slots-toast { position:absolute; left:50%; top:16%; transform:translateX(-50%); padding:9px 16px; border-radius:10px; pointer-events:none;
  background:rgba(14,10,8,.82); color:#ffe9c0; font:600 14px var(--font-ui); box-shadow:0 6px 20px rgba(0,0,0,.5); border:1px solid rgba(255,200,120,.3);
  opacity:0; transition: opacity .25s, transform .25s; }
.slots-toast.in { opacity:1; transform:translateX(-50%) translateY(4px); }
.slots-float-toast { position:absolute; left:50%; top:18%; transform:translateX(-50%); padding:9px 16px; border-radius:10px; pointer-events:none;
  background:rgba(14,10,8,.82); color:#ffe9c0; font:600 14px var(--font-ui); border:1px solid rgba(255,200,120,.3); transition: opacity .6s; }
.slots-float-toast.out { opacity:0; }
@media (max-width: 640px) {
  .slots-wallet { width:176px; padding:10px; }
  .slots-bill { height:38px; font-size:19px; line-height:38px; }
  .slots-bar { left:12px; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 52px); gap:6px; }
  .slots-btn { min-width:54px; height:38px; font-size:14px; padding:0 7px; }
  .slots-btn.spin { width:74px; height:74px; font-size:21px; }
  .slots-hint { display:none; }
}
`,
);

const COLORS = {
  spin: ['#b8ff8a', '#1fae2a', 'rgba(80,255,90,.55)'],
  lever: ['#ff9a8a', '#c0101c', 'rgba(255,60,40,.5)'],
  cashout: ['#ffe680', '#c89000', 'rgba(255,200,40,.45)'],
  help: ['#a8dcff', '#2a72c0', 'rgba(80,170,255,.4)'],
  lines: ['#ffffff', '#b0b8c4', 'rgba(255,255,255,.3)'],
  betminus: ['#ff9a8a', '#c0202a', 'rgba(255,80,60,.4)'],
  betplus: ['#b8ff9a', '#2aa03a', 'rgba(90,255,100,.4)'],
  maxbet: ['#ffc070', '#d86000', 'rgba(255,150,40,.45)'],
  betone: ['#ffffff', '#b0b8c4', 'rgba(255,255,255,.3)'],
  betmax: ['#ffc070', '#d86000', 'rgba(255,150,40,.45)'],
};

export function buildSlotUI(machine) {
  const ui = machine.ui;
  if (!ui) return { update() {}, refresh() {}, dispose() {}, toast() {}, openWallet() {}, nudgeWallet() {} };
  const sfx = (n) => machine.sound(n, { gain: 0.6 });

  // ---- wallet ----
  const wallet = el('div', { class: 'slots-wallet' });
  const tab = el('button', { class: 'slots-tab', text: '$' });
  const cashEl = el('span', { class: 'cash' });
  const head = el('h4', {}, [document.createTextNode(t('slots.ui.insertBill')), cashEl]);
  const bills = el('div', { class: 'slots-bills' });
  const billBtns = BILLS.map((b) => {
    const btn = el('button', { class: 'slots-bill', text: `$${b}` });
    btn.addEventListener('click', () => {
      sfx('ui.paper');
      machine.insertBill(b).then(() => refresh());
      refresh();
    });
    bills.append(btn);
    return btn;
  });
  const tkHead = el('h4', { text: t('slots.ui.tickets') });
  const tkList = el('div', { class: 'slots-tickets' });
  wallet.append(tab, head, bills, tkHead, tkList);
  tab.addEventListener('click', () => wallet.classList.remove('collapsed'));
  if (innerWidth < 640) wallet.classList.add('collapsed');
  wallet.addEventListener('pointerdown', (e) => e.stopPropagation());

  // ---- control bar ----
  const bar = el('div', { class: 'slots-bar' });
  const layout =
    machine.kind === 'stepper'
      ? [['betone', 'ui.betOne'], ['betmax', 'ui.betMax'], ['cashout', 'ui.cashOut'], ['lever', 'ui.pull', 'spin']]
      : machine.par.kind === 'ways'
        ? [['help', 'ui.pays'], ['betminus', 'ui.betMinus'], ['betplus', 'ui.betPlus'], ['maxbet', 'ui.maxBet'], ['cashout', 'ui.cashOut'], ['spin', 'ui.spin', 'spin']]
        : [['help', 'ui.pays'], ['lines', 'ui.lines'], ['betminus', 'ui.betMinus'], ['betplus', 'ui.betPlus'], ['maxbet', 'ui.maxBet'], ['cashout', 'ui.cashOut'], ['spin', 'ui.spin', 'spin']];
  const btns = {};
  for (const [type, key, cls] of layout) {
    const b = el('button', { class: `slots-btn ${cls || ''}`, text: t(`slots.${key}`) });
    const [c1, c2, glow] = COLORS[type];
    b.style.setProperty('--c1', c1);
    b.style.setProperty('--c2', c2);
    b.style.setProperty('--glow', glow);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => machine.press(type));
    bar.append(b);
    btns[type] = b;
  }
  const hint = el('div', { class: 'slots-hint', text: t('slots.ui.keys') });
  const toastEl = el('div', { class: 'slots-toast' });
  ui.append(wallet, bar, hint, toastEl);

  let tkSig = '';
  function refresh() {
    const cash = slice('money').cash;
    cashEl.textContent = fmt$(cash);
    billBtns.forEach((b, i) => (b.disabled = cash < BILLS[i] || machine.phase === 'handpay'));
    const list = tickets.list().filter((tk) => tk.amount > 0);
    const sig = list.map((x) => x.id).join(',');
    if (sig !== tkSig) {
      tkSig = sig;
      tkList.replaceChildren();
      if (!list.length) tkList.append(el('div', { class: 'slots-none', text: t('slots.ui.noTickets') }));
      for (const tk of list.slice(0, 8)) {
        const b = el('button', { class: 'slots-ticket' }, [el('b', { text: fmt$(tk.amount) }), document.createTextNode(tk.validation)]);
        b.addEventListener('click', () => {
          sfx('ui.paper');
          machine.insertTicket(tk).then(() => refresh());
        });
        tkList.append(b);
      }
    }
    const busy = machine.phase !== 'idle';
    for (const [type, b] of Object.entries(btns)) {
      const dim = (busy && !['spin', 'help'].includes(type)) || (type === 'cashout' && machine.balance <= 0);
      b.classList.toggle('dim', dim);
    }
  }

  let toastTimer = 0;
  let acc = 0;
  refresh();
  return {
    refresh,
    update(dt) {
      acc += dt;
      if (acc > 0.4) {
        acc = 0;
        refresh();
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.classList.remove('in');
      }
    },
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('in');
      toastTimer = 2.6;
    },
    openWallet() {
      wallet.classList.remove('collapsed');
      this.nudgeWallet();
    },
    nudgeWallet() {
      wallet.classList.remove('collapsed');
      wallet.classList.remove('nudge');
      void wallet.offsetWidth;
      wallet.classList.add('nudge');
    },
    pressVisual(type) {
      const b = btns[type];
      if (!b) return;
      b.classList.add('down');
      setTimeout(() => b.classList.remove('down'), 140);
    },
    dispose() {
      wallet.remove();
      bar.remove();
      hint.remove();
      toastEl.remove();
    },
  };
}
