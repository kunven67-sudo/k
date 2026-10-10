// Dev page: slot machines (lane C). Modes:
//   slots.html?view=symbols           all symbol atlases (art review)
import { symbolAtlas, THEME_ART } from '../src/casino/slots/art/atlas.js';
import { slotFontsReady } from '../src/casino/slots/art/paint.js';

const q = Object.fromEntries(new URLSearchParams(location.search));

async function symbolsView() {
  await slotFontsReady();
  document.body.style.cssText = 'background:#222;overflow:auto;margin:0';
  document.getElementById('app').style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;padding:12px';
  document.body.append(wrap);
  for (const theme of Object.keys(THEME_ART)) {
    const a = symbolAtlas(theme, 160);
    const c = document.createElement('canvas');
    c.width = a.canvas.width;
    c.height = a.canvas.height;
    const g = c.getContext('2d');
    g.fillStyle = theme === 'classic-fruit' ? '#f4ecd9' : theme === 'space' ? '#120a30' : theme === 'dragon' ? '#3a0406' : '#2a170c';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(q.blur ? a.blur : a.canvas, 0, 0);
    c.style.cssText = 'width:480px;border:1px solid #555';
    wrap.append(c);
  }
  window.__ready = true;
}

if (q.view === 'symbols') symbolsView();
