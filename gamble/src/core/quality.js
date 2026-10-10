// Device capability detection -> a quality tier that every renderer-facing module reads.
// Gaming PCs get 'ultra', phones get a smooth-first tier (design bible §33).

import { settings } from './settings.js';
import { bus } from './events.js';

const ua = navigator.userAgent || '';
export const device = {
  isIOS: /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  isAndroid: /Android/i.test(ua),
  isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  isStandalone:
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
};
device.isMobile = device.isIOS || device.isAndroid;

function detectGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { renderer: 'none', vendor: 'none' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  } catch {
    return { renderer: 'unknown', vendor: 'unknown' };
  }
}

export const gpu = detectGpu();

function autoTier() {
  const r = String(gpu.renderer).toLowerCase();
  if (r.includes('swiftshader') || r.includes('llvmpipe') || r === 'none') return 'low';
  if (device.isMobile) {
    // Newer iPhones (A15+) handle 'medium' smoothly; older/unknown phones get 'low'.
    return device.isIOS ? 'medium' : 'low';
  }
  if (/rtx|radeon rx|rx \d{4}|arc a\d|apple m\d (pro|max|ultra)/.test(r)) return 'ultra';
  if (/gtx|geforce|radeon|apple m\d/.test(r)) return 'high';
  if (/intel|uhd|iris/.test(r)) return 'medium';
  return 'high';
}

// Per-tier knobs. Modules read these instead of hard-coding quality decisions.
export const TIERS = {
  low: {
    name: 'low', pixelRatioCap: 1.0, shadows: false, shadowMapSize: 512, bloom: false, ssao: false,
    reflections: false, softBodyCars: false, maxNpcs: 12, drawDistance: 140, hairStrands: false,
    clothSim: false, particlesScale: 0.35, mirrorRes: 0, antialias: false, postFx: false,
  },
  medium: {
    name: 'medium', pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, bloom: true, ssao: false,
    reflections: false, softBodyCars: false, maxNpcs: 24, drawDistance: 220, hairStrands: false,
    clothSim: false, particlesScale: 0.6, mirrorRes: 256, antialias: true, postFx: true,
  },
  high: {
    name: 'high', pixelRatioCap: 2.0, shadows: true, shadowMapSize: 2048, bloom: true, ssao: true,
    reflections: true, softBodyCars: true, maxNpcs: 48, drawDistance: 360, hairStrands: true,
    clothSim: true, particlesScale: 1.0, mirrorRes: 512, antialias: true, postFx: true,
  },
  ultra: {
    name: 'ultra', pixelRatioCap: 2.5, shadows: true, shadowMapSize: 4096, bloom: true, ssao: true,
    reflections: true, softBodyCars: true, maxNpcs: 80, drawDistance: 600, hairStrands: true,
    clothSim: true, particlesScale: 1.4, mirrorRes: 1024, antialias: true, postFx: true,
  },
};

export const detectedTier = autoTier();

export function currentTier() {
  const s = settings.get('quality');
  return TIERS[s === 'auto' ? detectedTier : s] || TIERS.medium;
}

bus.on('settings:changed', ({ key }) => {
  if (key === 'quality') bus.emit('quality:changed', currentTier());
});
