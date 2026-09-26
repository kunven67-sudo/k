// Achievements + the "Ways to Die" collection. Both persist across playthroughs.
import { ui } from '../core/ui.js';

const KEY = 'pocketsize.achievements.v1';
const DKEY = 'pocketsize.deaths.v1';

export const ACHIEVEMENTS = [
  { id: 'doomscroll', icon: '📱', name: 'Doom Scroller', desc: 'Watch all five shorts before bed.' },
  { id: 'liker', icon: '❤️', name: 'Generous Thumb', desc: 'Like every short you watched.' },
  { id: 'shrunk', icon: '🔍', name: 'Honey, I Shrunk Me', desc: 'Wake up pocket sized.' },
  { id: 'leap', icon: '🪂', name: 'Leap of Faith', desc: 'Jump from the bed onto the pillow.' },
  { id: 'underdoor', icon: '🚪', name: 'Mind the Gap', desc: 'Squeeze under a door.' },
  { id: 'explorer', icon: '🧭', name: 'House Tour', desc: 'Visit the bedroom, living room, kitchen and bathroom.' },
  { id: 'sneaky', icon: '🐕', name: 'Let Sleeping Dogs Lie', desc: 'Get the paper airplane without waking Biscuit.' },
  { id: 'airplane', icon: '✈️', name: 'Heavy Lifting', desc: 'Pick up the paper airplane.' },
  { id: 'climber', icon: '🧗', name: 'Summit the Bed', desc: 'Climb the blanket back onto the bed.' },
  { id: 'pilot', icon: '🛬', name: 'Tiny Pilot', desc: 'Land the paper airplane on the desk.' },
  { id: 'coins', icon: '🪙', name: 'Pocket Change', desc: 'Find all 8 lost coins in the house.' },
  { id: 'crumbs', icon: '🥣', name: 'Five Second Rule', desc: 'Eat a crumb off the floor.' },
  { id: 'inphone', icon: '💾', name: 'Jacked In', desc: 'Enter your own phone.' },
  { id: 'antivirus', icon: '🦠', name: 'Human Antivirus', desc: 'Delete 5 viruses inside the phone.' },
  { id: 'nosignal', icon: '📵', name: 'No Signal', desc: 'Try to call for help from inside the phone.' },
  { id: 'wires', icon: '⚡', name: 'I Wouldn\'t Try That', desc: 'Connect a mystery wire. Against all advice.', secret: true },
  { id: 'pestcontrol', icon: '🪳', name: 'Pest Control', desc: 'Defeat 5 bugs inside the house.' },
  { id: 'cleansweep', icon: '🤖', name: 'Clean Sweep', desc: 'Watch SuckBot vacuum up a bug.' },
  { id: 'bugbuffet', icon: '🦴', name: 'Bug Buffet', desc: 'Watch Biscuit eat a bug.' },
  { id: 'fleacircus', icon: '🐾', name: 'Flea Circus', desc: 'Watch Biscuit scratch his fleas.' },
  { id: 'outside', icon: '🌳', name: 'Touch Grass', desc: 'Make it outside.' },
  { id: 'sunburn', icon: '☀️', name: 'Magnifying Glass Energy', desc: 'Get fried by the sun.', secret: true },
  { id: 'bushnope', icon: '🕷️', name: 'Nope. Nope. Nope.', desc: 'Flee the bush.' },
  { id: 'firstaxe', icon: '🪓', name: 'Tool Time', desc: 'Craft your first axe.' },
  { id: 'lumberjack', icon: '🌾', name: 'Lawn Mower', desc: 'Cut down 25 blades of grass.' },
  { id: 'armed', icon: '🗡️', name: 'Armed & Tiny', desc: 'Craft a weapon.' },
  { id: 'builder', icon: '🏠', name: 'Tiny Home', desc: 'Build a structure.' },
  { id: 'exterminator', icon: '🐜', name: 'Exterminator', desc: 'Defeat 25 bugs.' },
  { id: 'spiderslayer', icon: '🕸️', name: 'Arachnophobia Cured', desc: 'Defeat a spider.' },
  { id: 'broodmother', icon: '👁️', name: 'You Weren\'t Supposed To Find Her', desc: 'Find the giant spider hiding deep in the bush.', secret: true },
  { id: 'broodslayer', icon: '👑', name: 'Queen Slayer', desc: 'Defeat the Brood Mother.', secret: true },
  { id: 'fleatick', icon: '🔎', name: 'Needle in a Bush', desc: 'Find the hidden fleas and ticks.' },
  { id: 'roadkill', icon: '🚗', name: 'Why Did The Human Cross The Road', desc: 'Get flattened by a car.', secret: true },
  { id: 'germ', icon: '🧫', name: 'Germ Size', desc: 'Shrink to microscopic size.' },
  { id: 'waterbear', icon: '🐻', name: 'Water Bear Hug', desc: 'Defeat the Tardigrade.' },
  { id: 'microcraft', icon: '🔬', name: 'Micro Engineering', desc: 'Craft a microscopic weapon.' },
  { id: 'fullsize', icon: '🏆', name: 'Full Size', desc: 'Grow back to normal. Finish the story.' },
  { id: 'deaths5', icon: '💀', name: 'Dumb Ways To Die', desc: 'Discover 5 different ways to die.' },
  { id: 'deathsall', icon: '☠️', name: 'Completionist of Doom', desc: 'Discover every way to die.' },
  { id: 'pacifist', icon: '🕊️', name: 'Pacifist Pilot', desc: 'Reach the phone without taking any damage.' },
  { id: 'speedy', icon: '⏱️', name: 'Speed Shrinker', desc: 'Reach the desk within 6 minutes of waking up.' },
];

export const DEATHS = [
  { id: 'dog', name: 'Snack Sized', text: 'Biscuit woke up. You were exactly bite-sized. He is a very good boy, which is the tragic part.' },
  { id: 'vacuum', name: 'Vacuumed', text: 'The robot vacuum did its job. You are now in a bag with dust, dog hair and three LEGO pieces.' },
  { id: 'toilet', name: 'Flushed Away', text: 'You went in the toilet. Somebody flushed. It was a long trip.' },
  { id: 'mousetrap', name: 'Snap!', text: 'The mousetrap had cheese on it. You thought it was a free snack. It was not.' },
  { id: 'waterbowl', name: 'Drowned in a Dog Bowl', text: 'At your size, Biscuit\'s water bowl is an ocean. You are not a strong swimmer.' },
  { id: 'roach', name: 'Roach Food', text: 'Something lived under the fridge. It was hungry and it was fast.' },
  { id: 'centipede', name: 'Forty Legs, No Mercy', text: 'The house centipede under your bed is fast, fierce, and has more legs than you have fingers and toes. Combined.' },
  { id: 'housebugs', name: 'House Guests', text: 'You found out what really lives in your house. It found you first.' },
  { id: 'fall', name: 'Gravity Always Wins', text: 'Even at pocket size, that was too far to fall onto something hard.' },
  { id: 'virus', name: 'Corrupted', text: 'The viruses rewrote you into a pop-up ad. You now sell car insurance forever.' },
  { id: 'wires', name: 'Short Circuit', text: 'The wire was never a way home. The phone exploded with you inside it.' },
  { id: 'sun', name: 'Crispy', text: 'At your size the sun feels like a magnifying glass. You should have stayed in the shade.' },
  { id: 'bugs', name: 'Eaten Alive', text: 'The bugs out here do not care that you used to be big.' },
  { id: 'spider', name: 'Wrapped Up', text: 'Spider silk: stronger than steel, stickier than regret.' },
  { id: 'car', name: 'Flattened', text: 'Cars do not brake for someone the size of a raisin.' },
  { id: 'microbe', name: 'Digested', text: 'At germ size, even an amoeba is an apex predator.' },
  { id: 'drown', name: 'Puddle Trouble', text: 'Surface tension is a wall when you are this small. You did not get back out.' },
];

let unlocked = new Set();
let deathsSeen = new Set();
try { unlocked = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* ignore */ }
try { deathsSeen = new Set(JSON.parse(localStorage.getItem(DKEY) || '[]')); } catch (e) { /* ignore */ }

export function unlock(id) {
  if (unlocked.has(id)) return false;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return false;
  unlocked.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...unlocked])); } catch (e) { /* ignore */ }
  ui.achievement(a.icon, a.name);
  return true;
}

export function has(id) { return unlocked.has(id); }
export function allUnlocked() { return unlocked; }

export function recordDeath(id) {
  const isNew = !deathsSeen.has(id);
  deathsSeen.add(id);
  try { localStorage.setItem(DKEY, JSON.stringify([...deathsSeen])); } catch (e) { /* ignore */ }
  if (deathsSeen.size >= 5) unlock('deaths5');
  if (deathsSeen.size >= DEATHS.length) unlock('deathsall');
  return isNew;
}

export function deathsDiscovered() { return deathsSeen; }
export function deathInfo(id) { return DEATHS.find((d) => d.id === id) || { id, name: 'You Died', text: '' }; }
