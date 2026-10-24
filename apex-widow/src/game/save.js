// Saving: the run is saved ONLY when you rest at your lair (permadeath = dying deletes it).
// Records, trophies and the bestiary survive death.
const RUN = 'aw.run', META = 'aw.meta';
export function saveRun(data) { try { localStorage.setItem(RUN, JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch (e) { return false; } }
export function loadRun() { try { return JSON.parse(localStorage.getItem(RUN) || 'null'); } catch (e) { return null; } }
export function deleteRun() { try { localStorage.removeItem(RUN); } catch (e) {} }
export function loadMeta() {
  let m = null; try { m = JSON.parse(localStorage.getItem(META) || 'null'); } catch (e) {}
  return Object.assign({ runs: 0, deaths: 0, bestSize: 0.004, bestZone: 'tower', totalEaten: 0, humansWrapped: 0, planets: 0, stars: 0, galaxies: 0, universes: 0,
    bestTime: 0, trophies: {}, bestiary: {}, deathsBy: {}, endings: 0, lastDeath: null }, m || {});
}
export function saveMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) {} }
