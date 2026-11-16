const { chromium } = require('playwright');
const svg = (c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151c24"/><stop offset="1" stop-color="#06090c"/></linearGradient>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="8" y="8" width="240" height="240" rx="56" fill="url(#bg)"/>
<rect x="8.5" y="8.5" width="239" height="239" rx="55.5" fill="none" stroke="${c1}" stroke-opacity=".35" stroke-width="3"/>
<path filter="url(#gl)" d="M128 38 58 64v52c0 44 29 77 70 90 41-13 70-46 70-90V64L128 38Z" fill="none" stroke="url(#sh)" stroke-width="15" stroke-linejoin="round"/>
<g stroke="${c1}" stroke-width="13" stroke-linecap="round" filter="url(#gl)">
<path d="M92 120v14"/><path d="M110 104v46"/><path d="M128 92v70"/><path d="M146 104v46"/><path d="M164 120v14"/></g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, c1, c2] of [['ok', '#5dffbb', '#1fcf86'], ['bad', '#ff7a86', '#e5293d']]) {
    for (const s of [16, 20, 24, 32, 40, 48, 64, 128, 256]) {
      await p.setViewportSize({ width: s, height: s });
      await p.setContent(`<html><body style="margin:0;background:transparent">${svg(c1, c2).replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
      await p.screenshot({ path: `${__dirname}/${name}-${s}.png`, omitBackground: true });
    }
  }
  await b.close();
})();
