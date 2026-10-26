// English voice line-up. Each voice = a blend of Kokoro voices + an optional pitch shift (semitones).
// Characters get the next unused voice in their group so everyone sounds different.
export const GROUPS = {
  girl: [
    { id: 'g1', label: 'Bright girl', mix: [['jf_alpha', 0.7], ['af_bella', 0.3]], shift: 0 },
    { id: 'g2', label: 'Sweet girl', mix: [['jf_nezumi', 0.6], ['af_heart', 0.4]], shift: 0 },
    { id: 'g3', label: 'Energetic girl', mix: [['af_bella', 0.6], ['jf_alpha', 0.4]], shift: 1 },
    { id: 'g4', label: 'Cool girl', mix: [['af_sky', 0.5], ['jf_gongitsune', 0.5]], shift: 0 },
    { id: 'g5', label: 'Shy girl', mix: [['af_nicole', 0.5], ['jf_tebukuro', 0.5]], shift: 1 },
    { id: 'g6', label: 'Tomboy girl', mix: [['af_kore', 0.5], ['jf_alpha', 0.5]], shift: 0 },
  ],
  littlegirl: [
    { id: 'lg1', label: 'Little girl', mix: [['jf_tebukuro', 0.6], ['af_bella', 0.4]], shift: 3 },
    { id: 'lg2', label: 'Tiny girl', mix: [['jf_nezumi', 0.6], ['af_sky', 0.4]], shift: 4 },
  ],
  woman: [
    { id: 'w1', label: 'Woman', mix: [['af_heart', 1]], shift: 0 },
    { id: 'w2', label: 'Calm woman', mix: [['af_nova', 0.7], ['af_sarah', 0.3]], shift: 0 },
    { id: 'w3', label: 'Mature woman', mix: [['bf_emma', 0.6], ['af_river', 0.4]], shift: 0 },
    { id: 'w4', label: 'Strong woman', mix: [['af_kore', 0.6], ['af_aoede', 0.4]], shift: 0 },
    { id: 'w5', label: 'Elegant woman', mix: [['bf_isabella', 0.7], ['af_heart', 0.3]], shift: 0 },
  ],
  boy: [
    { id: 'b1', label: 'Teen boy', mix: [['am_puck', 0.7], ['jm_kumo', 0.3]], shift: 2 },
    { id: 'b2', label: 'Hero boy', mix: [['am_liam', 0.6], ['am_echo', 0.4]], shift: 2 },
    { id: 'b3', label: 'Cool boy', mix: [['am_echo', 0.7], ['am_eric', 0.3]], shift: 1 },
    { id: 'b4', label: 'Loud boy', mix: [['am_fenrir', 0.5], ['am_puck', 0.5]], shift: 2 },
    { id: 'b5', label: 'Smart boy', mix: [['am_eric', 0.6], ['jm_kumo', 0.4]], shift: 2 },
  ],
  littleboy: [
    { id: 'lb1', label: 'Little boy', mix: [['am_puck', 0.5], ['jm_kumo', 0.3], ['af_bella', 0.2]], shift: 4 },
    { id: 'lb2', label: 'Kid boy', mix: [['am_liam', 0.6], ['af_sky', 0.4]], shift: 4 },
  ],
  man: [
    { id: 'm1', label: 'Man', mix: [['am_michael', 1]], shift: 0 },
    { id: 'm2', label: 'Tough man', mix: [['am_fenrir', 0.7], ['am_onyx', 0.3]], shift: 0 },
    { id: 'm3', label: 'Smooth man', mix: [['am_adam', 0.6], ['am_eric', 0.4]], shift: 0 },
    { id: 'm4', label: 'British man', mix: [['bm_george', 1]], shift: 0 },
    { id: 'm5', label: 'Old man', mix: [['bm_lewis', 0.6], ['am_santa', 0.4]], shift: 0 },
  ],
  deepman: [
    { id: 'd1', label: 'Deep man', mix: [['am_onyx', 0.8], ['bm_george', 0.2]], shift: -1 },
    { id: 'd2', label: 'Giant man', mix: [['am_onyx', 0.6], ['bm_lewis', 0.4]], shift: -2 },
  ],
};
export const ALL_VOICES = Object.entries(GROUPS).flatMap(([g, list]) => list.map(v => ({ ...v, group: g })));
export const voiceById = (id) => ALL_VOICES.find(v => v.id === id);

// Which group fits a character: their girl/boy side + how high their real voice is
export function groupFor(gender, pitch) {
  if (gender === 'girl') return pitch >= 430 ? 'littlegirl' : pitch > 0 && pitch < 205 ? 'woman' : 'girl';
  return pitch >= 330 ? 'littleboy' : pitch >= 165 ? 'boy' : pitch > 0 && pitch < 98 ? 'deepman' : 'man';
}
