/* Steam Big Picture style: the picked game's art big at the top with a green PLAY button and your stats,
   "Recent games" underneath, and the round buttons (search, settings, power) top right. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState, isRunning } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems, clockText, saveSize, fmtBytes } from './common.js';
import { logoFont } from '../covermaker.js';

export function make(root, ctx) {
  let zone = 'row';
  let sel = 0;
  let tsel = 0;
  let items = [];
  let visible = false;
  const sys = systemItems(ctx);

  const hero = h('div.st-hero');
  const heroArt = h('div.st-heroart');
  const heroBox = h('div.st-herobox');
  const tools = h('div.st-tools');
  const track = h('div.st-track');
  const clock = h('div.st-clock');
  root.appendChild(h('div.st',
    h('div.st-top', h('div.st-nav', h('span.on', 'Home'), h('span', { onclick: function () { Sound.press(); ctx.openLibrary(); } }, 'Library')), h('div.st-right', tools, clock)),
    hero, h('div.st-rowtitle', 'Recent games'), h('div.st-row', track)));
  hero.appendChild(heroArt);
  hero.appendChild(heroBox);

  function build() {
    items = recentGames().map(function (g) { return { g: g }; });
    items.push({ lib: true });
    sel = Math.min(sel, items.length - 1);
    tools.textContent = '';
    sys.forEach(function (s, i) {
      if (s.id === 'lib') return;
      const b = h('button.st-tool', { html: icon(s.icon), title: s.name });
      b.addEventListener('click', function () { zone = 'tools'; tsel = i - 1; paint(); Sound.press(); s.run(); });
      tools.appendChild(b);
    });
    track.textContent = '';
    /* tall capsules cut the sides off a cover, so the name logo is drawn as text over the clean picture */
    function capsuleArt(g) {
      const named = g.logo && g.logo.on && g.coverClean;
      return h('div.cart', { style: { backgroundImage: css(named ? g.coverClean : g.cover) } },
        !g.cover ? h('div.cnoart', g.name) : named ? h('div.st-cname', { style: logoFont(g.logo.style) }, g.name) : null);
    }
    items.forEach(function (it, i) {
      const c = it.lib ? h('div.st-cap.lib', h('span', { html: icon('grid') }), h('div', 'Library'))
        : h('div.st-cap', capsuleArt(it.g));
      c.addEventListener('click', function () { if (zone === 'row' && sel === i) activate(); else { zone = 'row'; sel = i; Sound.move(); paint(); } });
      c.addEventListener('dblclick', function () { sel = i; activate(); });
      if (it.g) c.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(it.g.id); });
      track.appendChild(c);
    });
    paint();
  }

  function paint() {
    clock.textContent = clockText();
    Array.from(track.children).forEach(function (c, i) { c.classList.toggle('focus', zone === 'row' && i === sel); c.classList.toggle('picked', i === sel); });
    Array.from(tools.children).forEach(function (b, i) { b.classList.toggle('focus', zone === 'tools' && i === tsel); });
    const it = items[sel];
    heroBox.textContent = '';
    if (!it || it.lib) {
      heroArt.style.backgroundImage = 'none';
      heroBox.appendChild(h('div.st-name', 'Library'));
      heroBox.appendChild(h('div.st-stats', St.games.size + ' games and apps'));
      const b = h('button.st-play', 'Open');
      b.addEventListener('click', function () { Sound.press(); ctx.openLibrary(); });
      heroBox.appendChild(b);
      Music.want(null);
    } else {
      const g = it.g;
      heroArt.style.backgroundImage = css(g.cover);
      heroBox.appendChild(h('div.st-name', g.name));
      const play = h('button.st-play', h('span', { html: icon(isRunning(g.id) ? 'resume' : 'play') }), isRunning(g.id) ? 'Resume' : 'Play');
      play.addEventListener('click', function () { ctx.play(g.id, heroArt); });
      const stats = h('div.st-stats', status(g) || infoLine(g));
      heroBox.appendChild(h('div.st-actions', play, stats));
      saveSize(g.id, function (n) { if (items[sel] === it && n) stats.textContent = (status(g) || infoLine(g)) + '  ·  Saved data ' + fmtBytes(n); });
      Music.want(g.music);
    }
    const c = track.children[sel];
    if (c) c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function activate() {
    if (zone === 'tools') { tools.children[tsel].click(); return; }
    const it = items[sel];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(it.g.id, heroArt);
  }

  function key(a) {
    if (zone === 'tools') {
      if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(tools.children.length - 1, tsel + (a === 'left' ? -1 : 1))); if (n !== tsel) { tsel = n; Sound.move(); paint(); } return true; }
      if (a === 'down' || a === 'back') { zone = 'row'; Sound.move(); paint(); return true; }
      if (a === 'ok') { activate(); return true; }
      return true;
    }
    if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(items.length - 1, sel + (a === 'left' ? -1 : 1))); if (n !== sel) { sel = n; Sound.move(); paint(); } return true; }
    if (a === 'up') { zone = 'tools'; Sound.move(); paint(); return true; }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options') { const it = items[sel]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

  setInterval(function () { if (visible) clock.textContent = clockText(); }, 5000);
  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () {},
    takeFocus: function () { zone = 'row'; paint(); },
    refreshSaves: function () { paint(); }
  };
}
