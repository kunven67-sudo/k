// Built-in browser: tabs, address/search bar, speed dial, history, ad blocker.
// Mounted once and kept alive so tabs survive switching pages.
import { h, toast, prompt, button, debounce, select, toggle } from '../lib.js';
import { state, set } from '../state.js';
import { backgroundLayer } from '../components.js';
import { showHelp } from '../help-ui.js';
import { ENGINES, toUrl } from '../../../shared/url.mjs';

const cv = window.cv;

let root = null;
let tabs = [];
let active = null;
let seq = 0;
let closed = [];
let els = {};
let blockedCount = 0;

function browserBg() {
  const b = state.settings.background;
  return b.browserSame ? b.app : b.browser;
}

const saveTabs = debounce(() => {
  if (!state.settings.browser.restoreTabs) return;
  const list = tabs.filter((t) => t.kind === 'web' && t.url).map((t) => ({ url: t.url }));
  set({ browser: { tabs: list.slice(0, 30) } });
}, 800);

// ---------------------------------------------------------------- home & history views

function homeView(tab) {
  const bgSlot = h('div', { class: 'bgslot' });
  const search = h('input', {
    class: 'search', placeholder: `Search ${ENGINES[state.settings.browser.searchEngine]?.name || 'the web'} or type a website`,
    onkeydown: (e) => { if (e.key === 'Enter') navigate(tab, e.target.value); },
  });
  const dial = h('div', { class: 'dial' });
  const drawDial = () => dial.replaceChildren(
    ...state.settings.browser.speedDial.map((d, i) => {
      let host = '';
      try { host = new URL(d.url).hostname; } catch { /* bad url */ }
      const img = h('img', { src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`, alt: '' });
      const letter = h('div', { class: 'letter' }, (d.name || '?')[0].toUpperCase());
      img.addEventListener('error', () => img.replaceWith(letter));
      return h('div', { class: 'dial-tile', title: d.url, onclick: () => navigate(tab, d.url) },
        img, h('div', { class: 'nm' }, d.name),
        h('button', { class: 'rm', title: 'Remove', onclick: (e) => { e.stopPropagation(); const list = state.settings.browser.speedDial.filter((_, k) => k !== i); set({ browser: { speedDial: list } }); setTimeout(drawDial, 30); } }, '✖'));
    }),
    h('div', { class: 'dial-tile', onclick: async () => {
      const url = await prompt('Add a site', 'like youtube.com');
      if (!url) return;
      const full = toUrl(url);
      let name = url;
      try { name = new URL(full).hostname.replace(/^www\./, '').split('.')[0]; name = name[0].toUpperCase() + name.slice(1); } catch { /* keep */ }
      set({ browser: { speedDial: [...state.settings.browser.speedDial, { name, url: full }] } });
      setTimeout(drawDial, 30);
    } }, h('div', { class: 'letter' }, '+'), h('div', { class: 'nm' }, 'Add site')),
  );
  drawDial();
  const view = h('div', { class: 'home' }, bgSlot,
    h('div', { class: 'content' }, h('h1', {}, 'CursorVerse'), search, dial,
      h('p', { class: 'hint', style: { marginTop: '24px', textShadow: '0 1px 4px #000' } }, `🛡️ Ad blocker ${state.settings.browser.adblock ? 'on' : 'off'} · change the background in 🌌 Backgrounds`)));
  view.bg = backgroundLayer(bgSlot, browserBg(), state.settings.lowPower);
  view.focusSearch = () => setTimeout(() => search.focus(), 30);
  view.redrawDial = drawDial;
  return view;
}

function historyView() {
  const list = h('div', { class: 'list' });
  const q = h('input', { class: 'text', placeholder: '🔍 Search history', style: { maxWidth: '320px' }, oninput: () => draw() });
  let items = [];
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    let lastDay = '';
    list.replaceChildren();
    for (const it of items) {
      if (s && !`${it.title} ${it.url}`.toLowerCase().includes(s)) continue;
      const day = new Date(it.at).toDateString();
      if (day !== lastDay) { lastDay = day; list.append(h('h3', { style: { marginTop: '12px' } }, day)); }
      list.append(h('div', { class: 'item' },
        h('small', {}, new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        h('a', { class: 'grow', href: '#', onclick: (e) => { e.preventDefault(); openTab(it.url); } }, it.title || it.url),
        h('small', { class: 'grow', style: { maxWidth: '260px' } }, it.url),
        button('✖', async () => { items = await cv.history.remove(it.at); draw(); }, 'small')));
    }
    if (!list.children.length) list.append(h('p', { class: 'muted' }, 'No history 🧹'));
  };
  cv.history.list().then((l) => { items = l; draw(); });
  return h('div', { class: 'home history-page', style: { alignItems: 'stretch' } },
    h('div', { class: 'page-head' }, h('h2', {}, '🕘 History'),
      h('div', { class: 'row' }, q, button('🧹 Clear all history', async () => { items = await cv.history.clear(); draw(); toast('History cleared', 'good'); }, 'danger'))),
    list);
}

// ---------------------------------------------------------------- tabs

function makeWebview(tab, url) {
  const wv = h('webview', { src: url, partition: 'persist:browser', allowpopups: true, webpreferences: 'contextIsolation=yes,sandbox=yes' });
  wv.addEventListener('did-start-loading', () => { tab.loading = true; drawTabs(); });
  wv.addEventListener('did-stop-loading', () => { tab.loading = false; drawTabs(); updateNav(); });
  wv.addEventListener('page-title-updated', (e) => { tab.title = e.title; drawTabs(); cv.history.title(tab.url, e.title); });
  wv.addEventListener('page-favicon-updated', (e) => { tab.favicon = e.favicons?.[0] || null; drawTabs(); });
  const onNav = (url) => {
    tab.url = url;
    if (tab === active) els.address.value = url;
    cv.history.add({ url, title: tab.title });
    updateNav();
    saveTabs();
  };
  wv.addEventListener('did-navigate', (e) => onNav(e.url));
  wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) onNav(e.url); });
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return;
    tab.title = `😵 Could not load (${e.errorDescription || e.errorCode})`;
    drawTabs();
  });
  wv.addEventListener('enter-html-full-screen', () => wv.classList.add('wv-full'));
  wv.addEventListener('leave-html-full-screen', () => wv.classList.remove('wv-full'));
  wv.addEventListener('dom-ready', updateNav);
  return wv;
}

function setView(tab, el) {
  const old = tab.el;
  tab.el = el;
  if (old) { old.bg?.destroy(); old.replaceWith(el); } else els.views.append(el);
  el.classList.toggle('hidden', tab !== active);
}

export function openTab(url, { background = false } = {}) {
  const tab = { id: ++seq, url: null, title: 'New tab', favicon: null, kind: 'home', loading: false, el: null };
  tabs.push(tab);
  if (url && url !== 'history') {
    tab.kind = 'web';
    tab.url = url;
    tab.title = url;
    setView(tab, makeWebview(tab, url));
  } else if (url === 'history') {
    tab.kind = 'history';
    tab.title = '🕘 History';
    setView(tab, historyView());
  } else {
    setView(tab, homeView(tab));
  }
  if (!background) activate(tab); else drawTabs();
  saveTabs();
  return tab;
}

function navigate(tab, input) {
  const url = toUrl(input, state.settings.browser.searchEngine);
  if (!url) return;
  if (tab.kind === 'web') {
    tab.el.loadURL(url).catch(() => { /* failure shows via did-fail-load */ });
    tab.url = url;
  } else {
    tab.kind = 'web';
    tab.url = url;
    tab.title = url;
    setView(tab, makeWebview(tab, url));
    tab.el.classList.toggle('hidden', tab !== active);
  }
  els.address.value = url;
  drawTabs();
  saveTabs();
}

function activate(tab) {
  active = tab;
  for (const t of tabs) {
    t.el.classList.toggle('hidden', t !== tab);
    t.el.bg?.pause(t !== tab);
  }
  els.address.value = tab.kind === 'web' ? tab.url || '' : '';
  drawTabs();
  updateNav();
  if (tab.kind === 'home') tab.el.focusSearch?.();
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i < 0) return;
  if (tab.kind === 'web' && tab.url) closed.push(tab.url);
  if (closed.length > 20) closed.shift();
  tab.el.bg?.destroy();
  tab.el.remove();
  tabs.splice(i, 1);
  if (!tabs.length) { openTab(); return; }
  if (tab === active) activate(tabs[Math.min(i, tabs.length - 1)]);
  else drawTabs();
  saveTabs();
}

function drawTabs() {
  els.tabbar.replaceChildren(
    ...tabs.map((t) => h('div', {
      class: `tab${t === active ? ' active' : ''}${t.loading ? ' loading' : ''}`, title: t.title,
      onclick: () => activate(t),
      onauxclick: (e) => { if (e.button === 1) closeTab(t); },
    },
    t.favicon ? h('img', { src: t.favicon, onerror: (e) => e.target.remove() }) : h('span', {}, t.kind === 'home' ? '🏠' : t.kind === 'history' ? '🕘' : '🌐'),
    h('span', { class: 'title' }, t.title || t.url || 'New tab'),
    h('button', { class: 'x', title: 'Close tab', onclick: (e) => { e.stopPropagation(); closeTab(t); } }, '✕'))),
    h('button', { class: 'tab', style: { minWidth: '38px', justifyContent: 'center' }, title: 'New tab (Ctrl+T)', onclick: () => openTab() }, '+'),
  );
  const isBookmarked = active?.kind === 'web' && state.settings.browser.speedDial.some((d) => d.url === active.url);
  els.star.textContent = isBookmarked ? '★' : '☆';
}

function updateNav() {
  const wv = active?.kind === 'web' ? active.el : null;
  let back = false, fwd = false;
  try { back = !!wv?.canGoBack(); fwd = !!wv?.canGoForward(); } catch { /* not ready yet */ }
  els.back.disabled = !back;
  els.fwd.disabled = !fwd;
  els.reload.textContent = active?.loading ? '✕' : '⟳';
}

function toggleBookmark() {
  if (active?.kind !== 'web' || !active.url) return;
  const list = state.settings.browser.speedDial;
  if (list.some((d) => d.url === active.url)) {
    set({ browser: { speedDial: list.filter((d) => d.url !== active.url) } });
    toast('Removed from speed dial');
  } else {
    let name = active.title || active.url;
    if (name.length > 24) { try { name = new URL(active.url).hostname.replace(/^www\./, ''); } catch { /* keep */ } }
    set({ browser: { speedDial: [...list, { name, url: active.url }] } });
    toast('⭐ Added to speed dial', 'good');
  }
  setTimeout(() => { drawTabs(); for (const t of tabs) t.el.redrawDial?.(); }, 30);
}

function settingsMenu() {
  const b = state.settings.browser;
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal card' },
      h('h3', {}, '🌐 Browser settings'),
      h('div', { class: 'stack' },
        select({ label: 'Search engine', value: b.searchEngine, options: Object.entries(ENGINES).map(([value, e]) => ({ value, label: e.name })), onChange: (v) => set({ browser: { searchEngine: v } }) }),
        toggle({ label: '🛡️ Ad & tracker blocker', desc: `${blockedCount} blocked this session`, checked: b.adblock, onChange: (v) => set({ browser: { adblock: v } }) }),
        toggle({ label: 'Reopen my tabs next time', checked: b.restoreTabs, onChange: (v) => set({ browser: { restoreTabs: v, tabs: v ? b.tabs : [] } }) })),
      h('div', { class: 'modal-actions' }, button('🕘 History', () => { close(); openTab('history'); }), button('Done', close, 'primary'))));
  document.body.append(wrap);
}

// ---------------------------------------------------------------- page API

export default {
  id: 'browser', title: 'Browser', emoji: '🌐', persistent: true,
  mount(container) {
    root = container;
    els.tabbar = h('div', { class: 'tabbar' });
    els.back = h('button', { class: 'nav', title: 'Back (Alt+Left)', onclick: () => active?.el.goBack?.() }, '←');
    els.fwd = h('button', { class: 'nav', title: 'Forward (Alt+Right)', onclick: () => active?.el.goForward?.() }, '→');
    els.reload = h('button', { class: 'nav', title: 'Reload (F5)', onclick: () => { if (active?.kind !== 'web') return; if (active.loading) active.el.stop(); else active.el.reload(); } }, '⟳');
    els.home = h('button', { class: 'nav', title: 'Home', onclick: () => { if (!active) return; active.kind = 'home'; active.url = null; active.title = 'New tab'; active.favicon = null; setView(active, homeView(active)); activate(active); saveTabs(); } }, '🏠');
    els.address = h('input', {
      class: 'address', placeholder: 'Search or type a website',
      onfocus: (e) => e.target.select(),
      onkeydown: (e) => { if (e.key === 'Enter' && active) { navigate(active, e.target.value); e.target.blur(); } },
    });
    els.star = h('button', { class: 'nav', title: 'Add to speed dial (Ctrl+D)', onclick: toggleBookmark }, '☆');
    els.shield = h('span', { class: 'shield', title: 'Ads and trackers blocked' }, '🛡️ 0');
    els.menu = h('button', { class: 'nav', title: 'Browser settings', onclick: settingsMenu }, '⚙');
    els.help = h('button', { class: 'nav', title: 'What does this do?', onclick: () => showHelp('browser') }, '❓');
    els.views = h('div', { class: 'views' });
    root.append(els.tabbar, h('div', { class: 'navbar' }, els.back, els.fwd, els.reload, els.home, els.address, els.star, els.shield, els.menu, els.help), els.views);

    cv.on.adblockCount((n) => { blockedCount = n; els.shield.textContent = `🛡️ ${n}`; });
    const saved = state.settings.browser.restoreTabs ? state.settings.browser.tabs : [];
    if (saved.length) {
      saved.forEach((t, i) => openTab(t.url, { background: i > 0 }));
      activate(tabs[0]);
    } else openTab();
  },
  show(container, arg) {
    if (arg) openTab(arg);
    if (active?.kind === 'home') active.el.focusSearch?.();
  },
  hide() {},
  openTab(url) { openTab(url); },
  newTab() { openTab(); },
  shortcut(name) {
    switch (name) {
      case 'new-tab': openTab(); break;
      case 'close-tab': if (active) closeTab(active); break;
      case 'reopen-tab': if (closed.length) openTab(closed.pop()); break;
      case 'focus-address': els.address.focus(); break;
      case 'next-tab': if (tabs.length > 1) activate(tabs[(tabs.indexOf(active) + 1) % tabs.length]); break;
      case 'prev-tab': if (tabs.length > 1) activate(tabs[(tabs.indexOf(active) - 1 + tabs.length) % tabs.length]); break;
      case 'reload': if (active?.kind === 'web') active.el.reload(); break;
      case 'back': active?.el.goBack?.(); break;
      case 'forward': active?.el.goForward?.(); break;
      case 'history': openTab('history'); break;
      case 'bookmark': toggleBookmark(); break;
      default: break;
    }
  },
  onSettings(s, changed) {
    if (changed.includes('background') || changed.includes('lowPower')) {
      for (const t of tabs) if (t.kind === 'home') { setView(t, homeView(t)); }
      if (active) activate(active);
    }
    if (changed.includes('browser')) {
      drawTabs();
      for (const t of tabs) t.el.redrawDial?.();
    }
  },
  render() {},
};
