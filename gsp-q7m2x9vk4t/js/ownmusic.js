/* Your own songs for the home screen (Documents\Game System 3\Music).
   Each new song gets measured once and turned up/down to about as loud as the console music. */
import { Music } from './music.js';

const TARGET = -25.5;   /* dB, the console menu songs' loudness (quiet parts left out) */
let own = [];
let leveling = false;
const tried = new Set();   /* never measure the same song twice in a row (if saving its level fails) */

export function ownSongs() { return own; }

export async function refreshOwn() {
  try { own = await window.gs.invoke('music:list') || []; } catch (e) { own = []; }
  Music.setOwn(own);
  levelNew();
  return own;
}

/* how loud a song is: average power of the parts that aren't silent, both channels mixed */
async function measure(name) {
  try {
    const r = await fetch('gs3://music/' + encodeURIComponent(name));
    const buf = await r.arrayBuffer();
    const audio = await new OfflineAudioContext(1, 22050, 22050).decodeAudioData(buf);
    const chans = [];
    for (let c = 0; c < audio.numberOfChannels; c++) chans.push(audio.getChannelData(c));
    const block = Math.round(audio.sampleRate / 2);
    let sum = 0, blocks = 0, n = 0;
    for (let i = 0; i < audio.length; i += block) {
      const end = Math.min(audio.length, i + block);
      let ms = 0;
      for (let j = i; j < end; j++) {
        let v = 0;
        for (let c = 0; c < chans.length; c++) v += chans[c][j];
        v /= chans.length;
        ms += v * v;
      }
      ms /= (end - i);
      if (ms > 1e-6) { sum += ms; blocks++; }
      if (++n % 200 === 0) await new Promise(function (res) { setTimeout(res, 0); });   /* keep the screen smooth */
    }
    if (!blocks) return 1;
    const db = 10 * Math.log10(sum / blocks);
    return Math.pow(10, (TARGET - db) / 20);
  } catch (e) {
    return 1;   /* can't read it: leave it as it is */
  }
}

async function levelNew() {
  if (leveling) return;
  const todo = own.filter(function (s) { return s.gain == null && !tried.has(s.name); });
  if (!todo.length) return;
  leveling = true;
  try {
    for (const s of todo) tried.add(s.name);
    for (const s of todo) await window.gs.invoke('music:level', s.name, await measure(s.name));
  } finally { leveling = false; }
  refreshOwn();
}
