// Graphics presets + smart AUTO (watches FPS and picks the best look that stays smooth).
import { settings, saveSettings } from './settings.js';

export const PRESETS = {
  low:    { pixel: 0.6, shadows: false, shadowSize: 512,  grass: 0,    jiggle: 0.5, blood: 0.4, water: false, people: 0.5, particles: 0.4, aniso: 1 },
  medium: { pixel: 0.8, shadows: true,  shadowSize: 1024, grass: 0.4,  jiggle: 1,   blood: 0.7, water: false, people: 0.8, particles: 0.7, aniso: 2 },
  high:   { pixel: 1.0, shadows: true,  shadowSize: 2048, grass: 0.8,  jiggle: 1,   blood: 1,   water: true,  people: 1,   particles: 1,   aniso: 4 },
  ultra:  { pixel: 1.25, shadows: true, shadowSize: 2048, grass: 1,    jiggle: 1,   blood: 1,   water: true,  people: 1,   particles: 1.3, aniso: 8 },
  insane: { pixel: 1.6, shadows: true,  shadowSize: 4096, grass: 1.6,  jiggle: 1,   blood: 1.5, water: true,  people: 1,   particles: 2,   aniso: 16 },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];

export const quality = {
  level: 'high', // the preset currently in use (auto moves this)
  p: PRESETS.high,
  fps: 60,
  listeners: new Set(),
};

export function effectiveQuality() {
  const p = { ...quality.p };
  if (!settings.shadows) p.shadows = false;
  if (!settings.grass) p.grass = 0;
  if (!settings.jiggle) p.jiggle = 0;
  if (!settings.reflections) p.water = false;
  p.blood *= settings.blood;
  p.pixel *= settings.resScale;
  return p;
}

export function setQualityLevel(level) {
  if (!PRESETS[level]) level = 'high';
  quality.level = level;
  quality.p = PRESETS[level];
  for (const fn of quality.listeners) fn(effectiveQuality());
}

export function applyQualitySetting() {
  if (settings.quality === 'auto') {
    // start from a level that the GPU can usually hold, auto adjusts from there
    setQualityLevel(quality.level === 'insane' ? 'high' : quality.level || 'medium');
  } else setQualityLevel(settings.quality);
}

let acc = 0, frames = 0, lowTime = 0, highTime = 0, cooldown = 0, upBlock = 0;
export function tickQuality(dt) {
  acc += dt; frames++;
  if (acc >= 0.5) {
    quality.fps = frames / acc;
    acc = 0; frames = 0;
  }
  if (settings.quality !== 'auto') return;
  cooldown -= dt; upBlock -= dt;
  if (quality.fps < 42) { lowTime += dt; highTime = 0; } else if (quality.fps > 57) { highTime += dt; lowTime = 0; } else { lowTime = highTime = 0; }
  const i = ORDER.indexOf(quality.level);
  if (cooldown <= 0 && lowTime > 2.5 && i > 0) {
    setQualityLevel(ORDER[i - 1]);
    cooldown = 6; upBlock = 40; lowTime = 0;
  } else if (cooldown <= 0 && upBlock <= 0 && highTime > 10 && i >= 0 && i < ORDER.length - 2) {
    // auto never goes above HIGH on its own: ULTRA/INSANE are a manual choice
    setQualityLevel(ORDER[i + 1]);
    cooldown = 8; highTime = 0;
  }
}

export function setQualityChoice(choice) {
  settings.quality = choice;
  saveSettings();
  applyQualitySetting();
}
