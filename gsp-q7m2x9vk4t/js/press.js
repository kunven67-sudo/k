/* Click animations like the real consoles: whatever you press squishes a little and springs back.
   Works for mouse clicks and for Enter / A / Cross (the thing that has the highlight). */
const FX = {
  gs3: { k: [1, .97, 1], ms: 170, ease: 'cubic-bezier(.3,.7,.3,1)' },
  ps5: { k: [1, .955, 1], ms: 210, ease: 'cubic-bezier(.3,.7,.3,1)' },
  ps4: { k: [1, .965, 1], ms: 180, ease: 'ease-out' },
  xbox: { k: [1, .94, 1], ms: 140, ease: 'cubic-bezier(.2,.8,.3,1)' },
  /* Switch: a springy bump */
  switch: { k: [1, .92, 1.035, 1], ms: 280, ease: 'cubic-bezier(.3,.7,.3,1)' }
};
const SEL = 'button, [data-f], .tile, .gcell, .xb-tile, .xb-stile, .sw-tile, .sw-btn, .ps4-tile, .ps4-fbtn, .qcard, .qctrl';
const last = new WeakMap();

export function press(el) {
  if (!el || !el.animate || document.body.classList.contains('reduce-motion')) return;
  const now = performance.now();
  if (now - (last.get(el) || 0) < 120) return;
  last.set(el, now);
  /* big things (a whole settings row, a menu line) only dip a tiny bit, small buttons dip more */
  const fx = FX[document.body.dataset.skin] || FX.gs3;
  const w = el.offsetWidth || 0;
  const k = w > 420 ? fx.k.map(function (v) { return 1 - (1 - v) * .35; }) : fx.k;
  el.animate(k.map(function (v) { return { scale: String(v) }; }), { duration: fx.ms, easing: fx.ease });
}

/* the highlighted thing on screen right now (pop-up first, then the screen) */
export function focusedNow() {
  return document.querySelector('#modals .focus') ||
    document.querySelector('#qm:not([hidden]) .focus, #hang:not([hidden]) .focus') ||
    document.querySelector('.topbar .focus') ||
    document.querySelector('.screen:not([hidden]) .focus, .screen:not([hidden]) .ring');
}

document.addEventListener('click', function (e) {
  const el = e.target && e.target.closest && e.target.closest(SEL);
  if (el) press(el);
}, true);
