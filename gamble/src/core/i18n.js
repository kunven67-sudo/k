// English + Spanish UI strings. Each feature module registers its own namespace so no single
// file becomes a merge hotspot:
//
//   import { i18n, t } from '../core/i18n.js';
//   i18n.register('menu', { en: { play: 'Play' }, es: { play: 'Jugar' } });
//   t('menu.play')                      // -> 'Play' / 'Jugar'
//   t('phone.unread', { n: 3 })         // '{n}' placeholders
//
// Missing Spanish strings fall back to English, missing keys render as the key (visible in dev).

import { settings } from './settings.js';
import { bus } from './events.js';

const tables = { en: {}, es: {} };

export const i18n = {
  register(namespace, dict) {
    for (const lang of Object.keys(tables)) {
      const src = dict[lang] || {};
      for (const [k, v] of Object.entries(src)) tables[lang][`${namespace}.${k}`] = v;
    }
  },
  get language() {
    return settings.get('language');
  },
};

export function t(key, vars) {
  const lang = settings.get('language');
  let str = tables[lang]?.[key] ?? tables.en[key] ?? key;
  if (vars) str = str.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  return str;
}

// Re-render hook: UIs call this to refresh text when the language changes.
export function onLanguageChange(fn) {
  return bus.on('settings:changed', ({ key }) => {
    if (key === 'language') fn(settings.get('language'));
  });
}

i18n.register('common', {
  en: {
    back: 'Back',
    close: 'Close',
    confirm: 'Confirm',
    cancel: 'Cancel',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    on: 'On',
    off: 'Off',
  },
  es: {
    back: 'Atrás',
    close: 'Cerrar',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    yes: 'Sí',
    no: 'No',
    loading: 'Cargando…',
    on: 'Sí',
    off: 'No',
  },
});
