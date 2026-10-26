// SUBDUB wordmark: starts as Japanese (サブダブ字幕) and glitches letter by letter into English,
// like a subtitle switching language. Plays again on hover.
const FINAL = ['S', 'U', 'B', 'D', 'U', 'B'];
const START = ['サ', 'ブ', 'ダ', 'ブ', '字', '幕'];
const JUNK = 'アイウエオカキクケコサシスセソ字幕ΣΔ#%&@'.split('');

export function mountLogo(el) {
  el.textContent = '';
  const spans = FINAL.map((_, i) => {
    const s = document.createElement('span');
    s.className = 'l ' + (i < 3 ? 'sub' : 'dub');
    s.textContent = FINAL[i];
    el.append(s);
    return s;
  });
  const tail = document.createElement('i'); tail.className = 'logo-tail'; el.append(tail);
  let busy = false;
  const play = () => {
    if (busy) return; busy = true;
    spans.forEach((s, i) => { s.textContent = START[i]; });
    spans.forEach((s, i) => setTimeout(() => {
      let n = 0;
      const t = setInterval(() => {
        if (n++ < 3) { s.textContent = JUNK[(Math.random() * JUNK.length) | 0]; s.classList.add('glitch'); }
        else { s.textContent = FINAL[i]; s.classList.remove('glitch'); clearInterval(t); if (i === spans.length - 1) busy = false; }
      }, 55);
    }, 250 + i * 120));
  };
  play();
  el.addEventListener('mouseenter', play);
}
