/* The background: the picked game's art, crossfading, slowly drifting. */
let layers = null;
let cur = 0;
let shown = undefined;
let timer = null;

function init() {
  if (layers) return;
  const bg = document.getElementById('bg');
  layers = Array.from(bg.querySelectorAll('.bg-art'));
}

let mode = 'game';      /* 'game' = the picked game's art, 'console' = always the console's own background */
let wanted = null;
export const Bg = {
  setMode(m) {
    m = m === 'console' ? 'console' : 'game';
    if (m === mode) return;
    mode = m;
    const w = wanted;
    wanted = null;
    this.set(w);
  },
  set(url) {
    wanted = url || null;
    if (mode === 'console') url = null;
    init();
    if (url === shown) return;
    shown = url;
    clearTimeout(timer);
    const bg = document.getElementById('bg');
    /* tiny wait so flicking quickly through games doesn't flash every picture */
    timer = setTimeout(function () {
      if (!url) {
        layers.forEach(function (l) { l.classList.remove('on'); });
        bg.classList.add('plain');
        return;
      }
      const img = new Image();
      img.onload = img.onerror = function () {
        if (shown !== url) return;
        bg.classList.remove('plain');
        const next = layers[1 - cur];
        next.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
        next.classList.add('on');
        layers[cur].classList.remove('on');
        cur = 1 - cur;
      };
      img.src = url;
    }, 90);
  }
};
