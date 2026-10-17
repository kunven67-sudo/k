// Small math/timing helpers shared by every module.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v), 0, 1));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Frame-rate independent exponential smoothing: move `current` toward `target`
// so that after `halfLife` seconds half the distance is covered.
export const damp = (current, target, halfLife, dt) =>
  lerp(target, current, Math.pow(2, -dt / Math.max(1e-5, halfLife)));

export const dampAngle = (current, target, halfLife, dt) => {
  let delta = wrapAngle(target - current);
  return current + delta * (1 - Math.pow(2, -dt / Math.max(1e-5, halfLife)));
};

export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

export const DEG = Math.PI / 180;

// Critically-damped spring (used for jiggle, camera, UI). Mutates `state` {x, v}.
export function springStep(state, target, stiffness, damping, dt) {
  const f = -stiffness * (state.x - target) - damping * state.v;
  state.v += f * dt;
  state.x += state.v * dt;
  return state.x;
}

export const formatMoney = (amount, { cents = false } = {}) => {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return `${neg ? '-' : ''}$${str}`;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Inject a <style> block once per id (feature modules keep their CSS next to their code).
export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
