/* Line icons, drawn for Game System 3 (24x24, 1.75 stroke). */
import { SETS } from './iconsets.js';
const P = {
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  play: '<path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
  resume: '<path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" stroke="none"/><path d="M4 5v14"/>',
  more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M10.5 18.5h3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/>',
  grid9: '<rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="16" y="3.5" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="16" y="9.75" width="4.5" height="4.5" rx="1"/><rect x="3.5" y="16" width="4.5" height="4.5" rx="1"/><rect x="9.75" y="16" width="4.5" height="4.5" rx="1"/><rect x="16" y="16" width="4.5" height="4.5" rx="1"/>',
  gear: '<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>',
  folderOpen: '<path d="M3.5 17V7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H18a1.5 1.5 0 0 1 1.5 1.5V11"/><path d="M3.5 17 6 11.5h15L18.5 17.5a1.5 1.5 0 0 1-1.4 1H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>',
  power: '<path d="M12 3.5v8"/><path d="M7.3 6.4a7 7 0 1 0 9.4 0"/>',
  moon: '<path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5a7.8 7.8 0 1 0 9.7 9.7z"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
  save: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="5" rx=".8"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15"/>',
  download: '<path d="M12 4.5v11M7.5 11 12 15.5 16.5 11"/><path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.9 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.5 7.5A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-1"/>',
  volume: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  dnd: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  expand: '<path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  pad: '<path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.5l-1 4.3a2.3 2.3 0 0 1-4 .9L14.5 16h-5l-1.9 2.2a2.3 2.3 0 0 1-4-.9l-1-4.3A4.5 4.5 0 0 1 7 7.5z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="15.5" cy="11" r=".7" fill="currentColor"/><circle cx="17.5" cy="13" r=".7" fill="currentColor"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4"/>',
  box: '<path d="M12 3.5 20 8v8l-8 4.5L4 16V8z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2z"/>',
  text: '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
  motion: '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/>',
  zap: '<path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6z"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="1.6"/><path d="M8.5 20h7M12 16.5V20"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

/* Every icon is a <use> of one shared picture sheet (sprite), so switching the console look swaps every icon on
   screen at once: Game System 3's own line icons, or the console's (iconsets.js: PS5 thin outlines, PS4 solid glyphs,
   Switch chunky rounded, Xbox = Microsoft's Fluent icons). */
let setName = '';
const used = new Map(); /* name -> symbol element */
let sheet = null;
function sheetEl() {
  if (sheet) return sheet;
  sheet = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  (document.body || document.documentElement).appendChild(sheet);
  return sheet;
}
function symbolBody(name) {
  const set = setName && SETS[setName];
  if (set && set.icons[name]) return { box: set.viewBox, html: '<g fill="currentColor" stroke="none">' + set.icons[name] + '</g>' };
  return { box: '0 0 24 24', html: '<g>' + (P[name] || P.info) + '</g>' };
}
function ensure(name) {
  if (!P[name]) name = 'info';
  if (used.has(name)) return name;
  const sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  sym.id = 'gi-' + name;
  const b = symbolBody(name);
  sym.setAttribute('viewBox', b.box);
  sym.innerHTML = b.html;
  sheetEl().appendChild(sym);
  used.set(name, sym);
  return name;
}
export function icon(name, cls) {
  name = ensure(name);
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '><use href="#gi-' + name + '" width="24" height="24"/></svg>';
}
/* the solid version (PS5 Settings uses filled glyphs while the rest of the PS5 is thin lines). Shown only where a
   console's CSS asks for it (.solid), next to the normal one */
const solids = new Set();
export function iconSolid(name) {
  if (!P[name]) name = 'info';
  const set = SETS.ps4;
  if (!solids.has(name) && set && set.icons[name]) {
    const sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    sym.id = 'gis-' + name;
    sym.setAttribute('viewBox', set.viewBox);
    sym.innerHTML = '<g fill="currentColor" stroke="none">' + set.icons[name] + '</g>';
    sheetEl().appendChild(sym);
    solids.add(name);
  }
  if (!solids.has(name)) return '';
  return '<svg class="solid" viewBox="0 0 24 24" aria-hidden="true"><use href="#gis-' + name + '" width="24" height="24"/></svg>';
}
/* switch every icon on screen to a console's set ('' = Game System 3's own) */
export function setIconSet(name) {
  name = SETS[name] ? name : '';
  if (name === setName) return;
  setName = name;
  used.forEach(function (sym, n) { const b = symbolBody(n); sym.setAttribute('viewBox', b.box); sym.innerHTML = b.html; });
  urls.forEach(function (color, n) { document.documentElement.style.setProperty('--gi-url-' + n, urlOf(n, color)); });
}

/* icons used as a CSS background (search boxes): a CSS variable that follows the console's set too */
const urls = new Map();
function urlOf(name, color) {
  const b = symbolBody(name);
  const c = color || '#9aa0ab';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="' + b.box + '" fill="none" stroke="' + c + '" stroke-width="' + (b.box === '0 0 24 24' ? 1.75 : 0) + '" stroke-linecap="round" stroke-linejoin="round">' + b.html.replace(/currentColor/g, c) + '</svg>';
  return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
}
export function iconUrl(name, color) {
  if (!P[name]) name = 'info';
  if (!urls.has(name)) { urls.set(name, color); document.documentElement.style.setProperty('--gi-url-' + name, urlOf(name, color)); }
  return 'var(--gi-url-' + name + ')';
}
