// Achievement definitions + localStorage-backed unlock tracking + toast notifications.

const STORAGE_KEY = 'dhg_achievements_v1';

export const ENDING_ACHIEVEMENT_IDS = [
  'static_cling',
  'steady_hands',
  'through_the_screen',
  'quiet_route',
  'some_things',
];

export const ACHIEVEMENTS = [
  { id: 'first_shot', name: 'First Shot Fired', desc: 'Pulled the trigger for the very first time.' },
  { id: 'first_duck', name: 'Feathers Fly', desc: 'Downed your first duck.' },
  { id: 'round1_clear', name: 'Warming Up', desc: 'Cleared Round 1.' },
  { id: 'round3_clear', name: 'Midway Marksman', desc: 'Cleared Round 3.' },
  { id: 'final_round_clear', name: 'Last Round Standing', desc: 'Cleared the final round.' },
  { id: 'perfect_round', name: 'Not a Feather Out of Place', desc: 'Finished a round without a single miss.' },
  { id: 'talked_to_mom', name: '"Can I Get The Game?"', desc: 'Talked to Mom in the kitchen.' },
  { id: 'opened_box', name: 'Unboxing Day', desc: 'Opened the delivery box.' },
  { id: 'inserted_disc', name: 'Insert To Start', desc: 'Loaded the disc into the console.' },
  { id: 'explored_house', name: 'Grand Tour', desc: 'Walked through every room in the house.' },
  { id: 'graphics_ultra', name: 'Maximum Overdrive', desc: 'Cranked the graphics preset all the way to Ultra.' },
  { id: 'reload_pressure', name: 'Hot Reload', desc: 'Fired again just moments after finishing a reload.' },
  { id: 'cold_streak', name: 'Ice Cold', desc: 'Missed five shots in a row.' },
  { id: 'something_off', name: "Something's Off", desc: 'Noticed the dog somewhere it had no business being.' },
  { id: 'dont_look_away', name: "Don't Look Away", desc: 'Held your nerve through a strange moment instead of raising the gun.' },
  { id: 'steady_hands', name: 'Steady Hands', desc: 'Stood your ground and came home with a fine score.' },
  { id: 'through_the_screen', name: 'Through the Screen', desc: 'A flawless round, and reality had no choice but to bend.' },
  { id: 'quiet_route', name: 'The Quiet Route', desc: 'Finished the whole game without ever firing a shot.' },
  { id: 'some_things', name: "Some Things You Don't Do", desc: '??? A secret best left undiscovered.', secret: true },
  { id: 'static_cling', name: 'Static Cling', desc: 'Made it home, static and all.' },
  { id: 'full_circle', name: 'Full Circle', desc: 'Witnessed every ending the TV has to offer.' },
];

const ID_SET = new Set(ACHIEVEMENTS.map(a => a.id));

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = load();
const unlockListeners = new Set();
export function onUnlock(fn) { unlockListeners.add(fn); return () => unlockListeners.delete(fn); }

export function isUnlocked(id) { return !!state[id]; }

export function unlock(id) {
  if (!ID_SET.has(id)) return false;
  if (state[id]) return false; // already unlocked, no duplicate toast
  state[id] = true;
  save(state);
  const def = ACHIEVEMENTS.find(a => a.id === id);
  unlockListeners.forEach(fn => fn(def));
  if (ENDING_ACHIEVEMENT_IDS.includes(id)) checkFullCircle();
  return true;
}

function checkFullCircle() {
  const allSeen = ENDING_ACHIEVEMENT_IDS.every(id => state[id]);
  if (allSeen) unlock('full_circle');
}

export function getAll() {
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!state[a.id] }));
}

export function resetAll() {
  state = {};
  save(state);
}
