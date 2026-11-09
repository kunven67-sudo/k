// Reusable pieces: animated cursor previews and background layers.
import { h } from './lib.js';
import { renderFrame, resolveDef, frameCountFor, fpsFor, buildFrames, defHotspot } from '../../shared/cursor-render.mjs';
import { runBackground } from '../../shared/backgrounds.mjs';
import { state } from './state.js';

// ------------------------------------------------------------ cursor previews

const animated = new Set();
let rafOn = false;
function tickAll(now) {
  for (const p of animated) {
    if (!p.canvas.isConnected) { animated.delete(p); continue; }
    p.draw(now);
  }
  if (animated.size) requestAnimationFrame(tickAll); else rafOn = false;
}

// A canvas showing a cursor. mode: 'static' | 'hover' | 'always'
export function cursorCanvas(id, cfg, size, mode = 'static', displaySize = size) {
  const canvas = h('canvas', { width: size, height: size, style: { width: `${displaySize}px`, height: `${displaySize}px` } });
  const ctx = canvas.getContext('2d');
  const p = { canvas, id, cfg, start: performance.now() };
  p.draw = (now) => {
    const def = resolveDef(p.id, state.customDefs);
    const n = frameCountFor(def, p.cfg);
    const fps = fpsFor(def, p.cfg);
    const t = n > 1 ? (((now - p.start) / 1000) * fps / n) % 1 : 0;
    const frame = n > 1 ? Math.floor(t * n) / n : 0;
    if (frame === p.lastFrame && p.lastCfg === p.cfg) return;
    p.lastFrame = frame; p.lastCfg = p.cfg;
    try { renderFrame(ctx, def, p.cfg, frame, size); } catch (err) { console.warn(err); }
  };
  p.draw(performance.now());
  const startAnim = () => { animated.add(p); if (!rafOn) { rafOn = true; requestAnimationFrame(tickAll); } };
  if (mode === 'always') startAnim();
  if (mode === 'hover') {
    canvas.addEventListener('pointerenter', startAnim);
    canvas.addEventListener('pointerleave', () => { animated.delete(p); p.lastFrame = null; p.draw(0); });
  }
  canvas.update = (nid, ncfg) => { p.id = nid; p.cfg = ncfg; p.lastFrame = null; p.draw(performance.now()); };
  canvas.hoverTarget = (el) => {
    el.addEventListener('pointerenter', startAnim);
    el.addEventListener('pointerleave', () => { animated.delete(p); p.lastFrame = null; p.draw(0); });
  };
  return canvas;
}

// CSS cursor (first frame) so the user can test the look inside the app.
export function cssCursor(id, cfg) {
  const def = resolveDef(id, state.customDefs);
  const S = Math.min(128, Math.max(16, Math.round(cfg.size || 32)));
  const { frames, hotspot } = buildFrames(def, { ...cfg, anim: 'none', colorMode: cfg.colorMode === 'rainbow' ? 'original' : cfg.colorMode }, S);
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  c.getContext('2d').putImageData(new ImageData(frames[0].data, S, S), 0, 0);
  void defHotspot;
  return `url(${c.toDataURL()}) ${Math.round(hotspot[0])} ${Math.round(hotspot[1])}, auto`;
}

// ------------------------------------------------------------ backgrounds

export function mediaUrl(rel) {
  return `cv://media/${String(rel).split('/').map(encodeURIComponent).join('/')}`;
}

// Fills `host` with the chosen background. Returns { update(bg), destroy() }.
export function backgroundLayer(host, bg, lowPower) {
  let ctrl = null;
  let key = '';
  const dim = h('div', { class: 'dim' });
  const apply = (b) => {
    const k = JSON.stringify([b.type, b.animated, b.file, lowPower]);
    if (k !== key) {
      key = k;
      ctrl?.stop(); ctrl = null;
      host.replaceChildren();
      if (b.type === 'animated') {
        const c = h('canvas');
        host.append(c);
        ctrl = runBackground(c, b.animated, { lowPower });
      } else if ((b.type === 'image' || b.type === 'video') && b.file) {
        const url = mediaUrl(b.file);
        const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(b.file);
        host.append(isVideo ? h('video', { src: url, autoplay: true, loop: true, muted: true, playsInline: true }) : h('img', { src: url }));
      }
      host.append(dim);
    }
    const media = host.firstElementChild;
    if (media && media !== dim) media.style.filter = b.blur ? `blur(${b.blur}px)` : '';
    if (media && media !== dim) media.style.transform = b.blur ? 'scale(1.06)' : '';
    dim.style.opacity = String((Number(b.dim) || 0) / 100);
  };
  apply(bg);
  return {
    update: apply,
    pause: (p) => ctrl?.pause(p),
    destroy: () => { ctrl?.stop(); host.replaceChildren(); },
  };
}
