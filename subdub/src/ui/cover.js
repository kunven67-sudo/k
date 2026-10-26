// Covers a foreign subtitle burned into the picture with its English, in the same spot.
import { h } from './dom.js';

// box: subtitle box as parts of the picture (0..1). area: the element the picture fills (object-fit: contain).
export function coverEl(box, area, vw, vh, text) {
  const sc = Math.min(area.width / vw, area.height / vh), ox = (area.width - vw * sc) / 2, oy = (area.height - vh * sc) / 2;
  const w = (box.w + 0.04) * vw * sc, lineH = box.h * vh * sc;
  // as big as the original letters, but small enough to fit the English in two lines
  const fit = (2 * w) / (0.55 * Math.max(8, text.length));
  const fs = Math.max(14, Math.min(lineH * 0.8, 46, fit));
  const cx = ox + (box.x + box.w / 2) * vw * sc;
  return h('div', {
    class: 'cover',
    style: {
      left: Math.max(4, cx - w / 2) + 'px', width: Math.min(area.width - 8, w) + 'px',
      // keep the bottom edge where the subtitle's bottom edge is, grow upward if the English is longer
      bottom: Math.max(2, area.height - (oy + (box.y + box.h + 0.012) * vh * sc)) + 'px',
      minHeight: (box.h + 0.024) * vh * sc + 'px', fontSize: fs + 'px',
    },
  }, text);
}
