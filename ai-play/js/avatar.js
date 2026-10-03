/* AI Play - the AI's LOOK. Each AI designs its own face when it's born (random), and the face
 * changes with its feelings: angry brows, tears, sweat, sparkles, X-eyes when hurt, zzz when dreaming.
 */
'use strict';

AIP.avatar = (function () {
  const U = AIP.util;
  const HEADS = ['round', 'square', 'tv', 'hex', 'blob', 'egg'];
  const EYES = ['round', 'dot', 'square', 'visor', 'oval', 'cyclops'];
  const ANTENNA = ['none', 'ball', 'double', 'bolt', 'spring', 'leaf'];
  const MOUTHS = ['line', 'grill', 'smile', 'teeth'];
  const EXTRAS = ['none', 'headphones', 'cap', 'bowtie', 'blush', 'scar', 'bolts'];

  function design() {
    const hue = U.randi(0, 359);
    return {
      hue, hue2: (hue + U.pick([150, 180, 200, 120, 40])) % 360,
      head: U.pick(HEADS), eyes: U.pick(EYES), antenna: U.pick(ANTENNA), mouth: U.pick(MOUTHS), extra: U.pick(EXTRAS),
      sat: U.randi(55, 85), light: U.randi(48, 62),
    };
  }

  function headShape(look, fill, stroke) {
    const a = `fill="${fill}" stroke="${stroke}" stroke-width="3"`;
    switch (look.head) {
      case 'square': return `<rect x="22" y="30" width="76" height="70" rx="14" ${a}/>`;
      case 'tv': return `<rect x="16" y="32" width="88" height="66" rx="9" ${a}/><rect x="40" y="98" width="40" height="7" rx="3" fill="${stroke}"/>`;
      case 'hex': return `<polygon points="60,24 96,44 96,86 60,106 24,86 24,44" ${a}/>`;
      case 'blob': return `<path d="M60 26 C88 24 102 44 98 66 C96 92 80 104 58 102 C34 102 20 88 22 64 C22 40 36 28 60 26 Z" ${a}/>`;
      case 'egg': return `<ellipse cx="60" cy="66" rx="36" ry="40" ${a}/>`;
      default: return `<circle cx="60" cy="66" r="39" ${a}/>`;
    }
  }
  function antenna(look, glow, stroke) {
    const top = look.head === 'hex' ? 24 : look.head === 'egg' ? 26 : 30;
    switch (look.antenna) {
      case 'ball': return `<line x1="60" y1="${top}" x2="60" y2="10" stroke="${stroke}" stroke-width="3"/><circle cx="60" cy="9" r="6" fill="${glow}" class="glowdot"/>`;
      case 'double': return `<line x1="48" y1="${top + 2}" x2="40" y2="10" stroke="${stroke}" stroke-width="3"/><line x1="72" y1="${top + 2}" x2="80" y2="10" stroke="${stroke}" stroke-width="3"/><circle cx="40" cy="9" r="4.5" fill="${glow}" class="glowdot"/><circle cx="80" cy="9" r="4.5" fill="${glow}" class="glowdot"/>`;
      case 'bolt': return `<polyline points="60,${top} 54,18 64,18 58,4" fill="none" stroke="${glow}" stroke-width="4" stroke-linejoin="round" class="glowdot"/>`;
      case 'spring': return `<path d="M60 ${top} q-8 -4 0 -6 q8 -2 0 -6 q-8 -2 0 -6" fill="none" stroke="${stroke}" stroke-width="3"/><circle cx="60" cy="8" r="5" fill="${glow}" class="glowdot"/>`;
      case 'leaf': return `<line x1="60" y1="${top}" x2="60" y2="14" stroke="${stroke}" stroke-width="3"/><path d="M60 15 C66 4 80 6 80 6 C78 16 68 18 60 15 Z" fill="#7dff9a"/>`;
      default: return '';
    }
  }
  function eyes(look, f, eyeCol) {
    const open = U.clamp(f.eyeOpen, 0.05, 1.3);
    const yy = 58;
    const pairs = look.eyes === 'cyclops' ? [60] : [45, 75];
    let s = '';
    if (f.pain > 0.5 && !f.zzz) {
      // squeezed "> <" eyes when it hurts
      return `<polyline points="38,52 48,58 38,64" fill="none" stroke="${eyeCol}" stroke-width="4" stroke-linecap="round"/><polyline points="82,52 72,58 82,64" fill="none" stroke="${eyeCol}" stroke-width="4" stroke-linecap="round"/>`;
    }
    if (look.eyes === 'visor') {
      const h = Math.max(2, 12 * open);
      return `<rect x="32" y="${yy - h / 2}" width="56" height="${h}" rx="${h / 2}" fill="${eyeCol}" class="eyeglow"/>`;
    }
    for (const cx of pairs) {
      const big = look.eyes === 'cyclops' ? 1.6 : 1;
      if (look.eyes === 'square') s += `<rect x="${cx - 7 * big}" y="${yy - 7 * open * big}" width="${14 * big}" height="${Math.max(2, 14 * open * big)}" rx="2" fill="${eyeCol}" class="eyeglow"/>`;
      else if (look.eyes === 'dot') s += `<ellipse cx="${cx}" cy="${yy}" rx="${4.5 * big}" ry="${Math.max(1, 4.5 * open)}" fill="${eyeCol}" class="eyeglow"/>`;
      else if (look.eyes === 'oval') s += `<ellipse cx="${cx}" cy="${yy}" rx="${6 * big}" ry="${Math.max(1.5, 10 * open)}" fill="${eyeCol}" class="eyeglow"/>`;
      else s += `<ellipse cx="${cx}" cy="${yy}" rx="${8 * big}" ry="${Math.max(1.5, 8 * open * big)}" fill="${eyeCol}" class="eyeglow"/>`;
      if (open > 0.3 && look.eyes !== 'dot') s += `<circle cx="${cx + (f.lookX || 0) * 2}" cy="${yy + 1}" r="${2.6 * big}" fill="#0b0820"/>`;
    }
    return s;
  }
  function brows(look, f, col) {
    const b = f.brow; // -1 angry .. +1 worried
    if (Math.abs(b) < 0.2) return '';
    const inner = b < 0 ? 47 + (-b) * 5 : 47 - b * 5;
    const outer = b < 0 ? 46 - (-b) * 3 : 46 + b * 2;
    if (look.eyes === 'cyclops') return `<line x1="46" y1="${outer}" x2="74" y2="${outer}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`;
    return `<line x1="36" y1="${outer}" x2="53" y2="${inner}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/><line x1="84" y1="${outer}" x2="67" y2="${inner}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  function mouth(look, f, col) {
    const c = f.mouth, o = f.open;
    const y = 82;
    if (o > 0.45) return `<ellipse cx="60" cy="${y + 1}" rx="${7 + o * 4}" ry="${3 + o * 7}" fill="#0b0820" stroke="${col}" stroke-width="2.5"/>`;
    if (f.pain > 0.5 || (c < -0.3 && f.brow < -0.3)) return `<polyline points="45,${y + 2} 50,${y - 2} 55,${y + 2} 60,${y - 2} 65,${y + 2} 70,${y - 2} 75,${y + 2}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>`;
    const curve = c * 9;
    let s = `<path d="M44 ${y} Q60 ${y + curve} 76 ${y}" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`;
    if (look.mouth === 'grill') s = `<rect x="44" y="${y - 5}" width="32" height="10" rx="3" fill="#0b0820" stroke="${col}" stroke-width="2"/><path d="M44 ${y} Q60 ${y + curve * 0.6} 76 ${y}" fill="none" stroke="${col}" stroke-width="2"/>` + [50, 56, 62, 68].map((x) => `<line x1="${x + 1}" y1="${y - 4}" x2="${x + 1}" y2="${y + 4}" stroke="${col}" stroke-width="1" opacity=".6"/>`).join('');
    if (look.mouth === 'teeth' && c > 0.2) s += `<path d="M48 ${y + 1} L72 ${y + 1}" stroke="#fff" stroke-width="2.5"/>`;
    return s;
  }
  function extras(look, fill, stroke, glow) {
    switch (look.extra) {
      case 'headphones': return `<path d="M22 64 C20 26 100 26 98 64" fill="none" stroke="${stroke}" stroke-width="5"/><rect x="12" y="56" width="12" height="22" rx="5" fill="${glow}"/><rect x="96" y="56" width="12" height="22" rx="5" fill="${glow}"/>`;
      case 'cap': return `<path d="M26 44 C28 18 92 18 94 44 Z" fill="${glow}" stroke="${stroke}" stroke-width="2"/><path d="M60 42 L104 46 L60 48 Z" fill="${glow}" stroke="${stroke}" stroke-width="2"/>`;
      case 'bowtie': return `<polygon points="60,106 46,99 46,113" fill="${glow}"/><polygon points="60,106 74,99 74,113" fill="${glow}"/><circle cx="60" cy="106" r="3.5" fill="${stroke}"/>`;
      case 'blush': return `<ellipse cx="36" cy="74" rx="6" ry="3.5" fill="#ff7aa8" opacity=".55"/><ellipse cx="84" cy="74" rx="6" ry="3.5" fill="#ff7aa8" opacity=".55"/>`;
      case 'scar': return `<path d="M78 40 L90 54 M80 48 L86 44 M84 52 L90 48" stroke="${stroke}" stroke-width="2"/>`;
      case 'bolts': return `<circle cx="20" cy="66" r="5" fill="${stroke}"/><circle cx="100" cy="66" r="5" fill="${stroke}"/>`;
      default: return '';
    }
  }
  function effects(f) {
    let s = '';
    if (f.tears) s += `<path d="M40 66 q-3 8 0 12 q3 -4 0 -12 Z" fill="#5ab8ff" class="tear"/><path d="M80 66 q-3 8 0 12 q3 -4 0 -12 Z" fill="#5ab8ff" class="tear t2"/>`;
    if (f.sweat) s += `<path d="M98 40 q-5 9 0 13 q5 -4 0 -13 Z" fill="#9fe4ff" class="sweat"/>`;
    if (f.anger) s += `<g transform="translate(92 30)" class="anger"><path d="M-7 -2 h5 v-5 M2 -7 v5 h5 M7 2 h-5 v5 M-2 7 v-5 h-5" stroke="#ff3b3b" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    if (f.sparkle) s += `<g class="sparkle"><path d="M16 30 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z" fill="#fff07a"/><path d="M100 98 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z" fill="#fff07a"/></g>`;
    if (f.question) s += `<text x="98" y="34" font-size="22" font-weight="900" fill="#2fe0c8" class="qmark">?</text>`;
    if (f.zzz) s += `<g class="zzz" fill="#cfd4ff" font-weight="900"><text x="88" y="30" font-size="12">z</text><text x="96" y="20" font-size="15">z</text><text x="105" y="9" font-size="18">Z</text></g>`;
    if (f.pain > 0.25) s += `<rect x="0" y="0" width="120" height="120" fill="#ff1744" opacity="${(f.pain * 0.28).toFixed(2)}" rx="20"/>`;
    return s;
  }

  // Draws the AI as an SVG string. face = from heart.face() (or a calm default)
  function svg(look, face) {
    const f = Object.assign({ eyeOpen: 1, brow: 0, mouth: 0.4, open: 0, pain: 0 }, face || {});
    const fill = `hsl(${look.hue} ${look.sat}% ${look.light}%)`;
    const stroke = `hsl(${look.hue} ${look.sat}% ${look.light - 28}%)`;
    const glow = `hsl(${look.hue2} 95% 62%)`;
    const eyeCol = f.glow || glow;
    const plate = look.head === 'tv' ? '<rect x="26" y="40" width="68" height="52" rx="8" fill="#0b0820"/>' : '<rect x="30" y="42" width="60" height="50" rx="18" fill="#0b0820" opacity=".92"/>';
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="bot ${f.anim || ''}" aria-hidden="true">
      ${antenna(look, glow, stroke)}
      ${look.extra === 'headphones' ? '' : ''}
      ${headShape(look, fill, stroke)}
      ${plate}
      ${eyes(look, f, eyeCol)}
      ${brows(look, f, eyeCol)}
      ${mouth(look, f, eyeCol)}
      ${extras(look, fill, stroke, glow)}
      ${effects(f)}
    </svg>`;
  }
  return { design, svg };
})();
