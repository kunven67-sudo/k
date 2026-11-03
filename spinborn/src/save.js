// Saved characters + settings (kept in this browser / this PC app). Every read/write is guarded so a blocked storage never breaks the game.
const KEY = 'spinborn.chars.v1', SKEY = 'spinborn.settings.v1';
export const DEFAULTS = { fast: false, auto: false, mirror: true, chance: false, flash: 'full', music: 0.45, sfx: 0.9, quality: 'auto' };

export const Store = {
  chars() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } },
  saveChar(C) {
    const list = this.chars().filter(c => c.id !== C.id);
    const keep = { ...C }; delete keep._nerfed;
    list.unshift(keep);
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); return true; } catch (e) { return false; }
  },
  remove(id) { try { localStorage.setItem(KEY, JSON.stringify(this.chars().filter(c => c.id !== id))); } catch (e) { } },
  settings() { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SKEY) || '{}') || {}) }; } catch (e) { return { ...DEFAULTS }; } },
  saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { } }
};
