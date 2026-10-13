// Device detection -> graphics tier. Weak GPUs and phones start low so the game stays smooth.
import { settings } from './settings.js';

const ua = navigator.userAgent || '';
export const device = {
  isIOS: /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  isAndroid: /Android/i.test(ua),
  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
};
device.isMobile = device.isIOS || device.isAndroid;

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'unknown';
  }
}
export const gpu = gpuName();

function autoTier() {
  const r = gpu.toLowerCase();
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r === 'none') return 'low';
  if (device.isMobile) return device.isIOS ? 'medium' : 'low';
  // Entry-level cards (GT-series, MX laptop chips, integrated graphics) start on medium.
  if (/gt \d{3}\b|mx\s?\d{3}|intel|uhd|iris|vega \d\b|radeon\(tm\) graphics/.test(r)) return 'medium';
  if (/rtx [2-9]0[6-9]0|rtx [4-9]0[7-9]0|rx [67]\d{3}|rx 9\d{3}|arc a7/.test(r)) return 'ultra';
  return 'high';
}
export const detectedTier = autoTier();

export const TIERS = {
  low: { name: 'low', pixelRatio: 0.85, shadows: false, cascades: 0, shadowSize: 512, bloom: false, ao: false, aa: 'fxaa', detail: 0.4, maxLights: 2, crowd: 0.5 },
  medium: { name: 'medium', pixelRatio: 1, shadows: true, cascades: 2, shadowSize: 1024, bloom: true, ao: false, aa: 'fxaa', detail: 0.7, maxLights: 3, crowd: 0.75 },
  high: { name: 'high', pixelRatio: 1.25, shadows: true, cascades: 3, shadowSize: 2048, bloom: true, ao: true, aa: 'smaa', detail: 1, maxLights: 4, crowd: 1 },
  ultra: { name: 'ultra', pixelRatio: 2, shadows: true, cascades: 4, shadowSize: 4096, bloom: true, ao: true, aa: 'smaa', detail: 1.5, maxLights: 8, crowd: 1.3 },
};

// ?q=low|medium|high|ultra forces a tier for this page load only (testing, screenshots).
const urlTier = new URLSearchParams(location.search).get('q');

export function currentTier() {
  const q = urlTier || settings.get('quality');
  const t = TIERS[q === 'auto' ? detectedTier : q] || TIERS.medium;
  // Auto: the detected tier, with the auto quality free to add/remove effects while you play.
  return q === 'auto' && !urlTier ? { ...t, auto: true } : t;
}
