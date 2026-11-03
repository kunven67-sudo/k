// SPINBORN reply brain: reads your comment, then after each spin decides if a meme pops up, which one, and what it says.
// Built in (no account / no key). His real pop-ups (BAKED) are used when they fit; clean pictures get new lines in his style.
import { BAKED, CLEAN } from '../assets/memes/memes.js';

// ---------- your comment ----------
const WORDS = {
  cocky: /\b(best|strongest|goat|god|op|broken|unbeatable|untouchable|danger|built different|cant lose|can't lose|no verse|nobody|king|top|peak|insane|crazy|unstoppable|win|carry|ez|easy|like that|him|her)\b/i,
  humble: /\b(cooked|weak|trash|bad|loser|lose|nobody|unlucky|scared|nervous|hope|pray|please|try|maybe|average|mid|normal)\b/i,
  fast: /\b(fast|speed|quick|flash|sonic|ftl|light)\b/i, strong: /\b(strong|strength|power|punch|muscle|destroy|smash)\b/i,
  smart: /\b(smart|iq|genius|brain|big brain|omniscient)\b/i, tough: /\b(tank|tough|immortal|unkillable|durab|cant die|can't die)\b/i,
  god: /\b(god|deity|divine|lucifer|devil|demon)\b/i, danger: /danger/i
};
export function readComment(text) {
  const t = (text || '').toLowerCase();
  const neg = /\b(not|never|wont|won't|aint|ain't|no)\b/.test(t);
  let mood = 'neutral';
  if (WORDS.cocky.test(t) && !(neg && WORDS.humble.test(t))) mood = 'cocky';
  if (WORDS.humble.test(t) && !/\bbest|strongest|goat|op\b/.test(t)) mood = 'humble';
  if (/let me try|try this|lets see|let's see/.test(t)) mood = 'neutral';
  return { text, mood, fast: WORDS.fast.test(t), strong: WORDS.strong.test(t), smart: WORDS.smart.test(t), tough: WORDS.tough.test(t), god: WORDS.god.test(t), danger: WORDS.danger.test(t) };
}
export const READY_COMMENTS = [
  "I'm gonna be the best", "I'm like that", 'No verse is touching me', "I'm not in danger, I AM THE DANGER!", 'Let me try this',
  "I'm built different", "Watch me be a god", "I'm gonna be fast af", "Big brain incoming", "I'm cooked fr", "Put me in chief, promise I wont be a dissapointment", "Ez run"
];

// ---------- new lines (for clean pictures), same voice as his ----------
const NEW = {
  cocky_start: ['Are you sure about that?', 'We will see about that', 'Big words for someone who hasnt spun yet', 'Bro said that with his chest', 'Ok bet. Lets see.'],
  humble_start: ['Lets see what bro does', 'Dont count yourself out yet', 'Humble.. i like that', 'Lets see who u WILL BE'],
  neutral_start: ['Lets see what bro does', 'Bet bet.. lets get into the stats', 'Lets see who this mf is', 'Ayo lets go'],
  cocky_low: ['Are you sure about that?', "You're not like that", 'So much for being the best..', 'Thats what "the best" looks like?', 'You said what at the start??'],
  humble_high: ['And you said you were cooked??', 'Bro lied to us', 'Humble af and still broken', 'HOLY SHIT.. i apologize for Earlier misunderstandings..'],
  claim_true: ['Ok.. you are like that', 'Bro wasnt lying', 'You actually meant it huh', 'He said it and did it'],
  low: ['Man u are cooked..', 'Thats tough..', 'Nah bro..', 'Bro got robbed', 'Pain.', 'Ts aint it bro'],
  high: ['WTF??', 'Bro is NOT normal', 'Okay you are crazy wtf?', 'Nah thats crazy', 'Yo chill..'],
  max: ['MAXED?? HELL NAH', 'Thats literally the top', 'Nobody is touching that', 'Bro hit the ceiling'],
  nerf: ['First nerf..', 'NOOOO', 'Painful nerf', 'Dang it not so fast'],
  unnerf: ['And he actually did..', 'Bro undid the nerf', 'Back on track'],
  upgrade: ['Dayum.. what was that upgrade', 'HUGE UPGRADE', 'Nice upgrade hehehe'],
  death: ['Bro is gone..', 'Rest in peace bro', 'Pack it up boys', 'Nah he did not just die', 'Thats what he did?? Die??'],
  golden: ['GOLDEN SPIN???', 'THE WHEEL IS GOLD??', 'Bro got the golden wheel'],
  nopowers: ['Do i have to say anything?', 'No powers.. pack it up', 'Just a guy'],
  powerop: ['Crazily dangerous powers..', 'Thats a broken power', 'Yo thats actually OP'],
  win: ['Easy stuff.', 'Not even a challenge', 'Ez for u ngl'],
  shock: ['WHAT THE ACTUAL FUCK', 'Huh?????', 'Ayo wtf', 'Bro what'],
  hype: ['NICEEEE', 'Ngl thats tuff', 'Yessirrr not bad', 'W'],
  end: ['peak run ngl..', 'peakest run OAT?', 'Craziest run Its a whole movie atp', 'One of the best runs istg'],
  endshort: ['Already??', 'Why such short journey???'],
  endmid: ['thank GOD..', 'Mid run ngl', 'It was a run i guess'],
  captured: ['Bro got locked up', 'Man got CAPTURED', 'Escape plan when?'],
  spared: ['They let him live?? lucky', 'Spared.. barely'],
  world: ['Lets see how bro does out there', 'Good luck in there bro', 'The world aint ready']
};

const STATWORD = { str: /strength|strong/i, spd: /fast|speed|legs|ftl/i, dur: /dura|unkillable|untouchable|immovable/i, iq: /iq|omniscient|science|smart/i, fight: /fight|throw hand/i };
const anyStat = /strength|strong|fast|speed|legs|ftl|dura|unkillable|iq|omniscient|science|fight|throw hand/i;

export function createBrain(opts = {}) {
  const used = new Set();
  let sinceMeme = 9, claim = readComment(''), insulted = false, spins = 0, lastDecision = null;
  const rnd = opts.rng || Math.random;
  const pickOne = (arr) => arr[Math.floor(rnd() * arr.length)];

  function baked(tag, stat, extra) {
    let c = BAKED.filter(m => m.t.includes(tag) && !used.has(m.f));
    if (stat) c = c.filter(m => !anyStat.test(m.line) || STATWORD[stat]?.test(m.line));
    else c = c.filter(m => !anyStat.test(m.line) || tag === 'end' || tag === 'shock' || tag === 'hype');
    if (extra) c = c.filter(extra);
    if (!c.length) return null;
    const m = pickOne(c); used.add(m.f);
    return { kind: 'baked', file: 'baked/' + m.f, video: m.v, line: m.line, snd: m.snd ? 'snd/' + m.snd : null, aspect: m.a, name: m.n };
  }
  function clean(lines) {
    const m = pickOne(CLEAN);
    return { kind: 'clean', file: 'clean/' + m.n + '.webp', video: false, line: pickOne(lines), snd: m.snd ? 'snd/' + m.snd : null, name: m.n };
  }
  const say = (tag, stat, lines, extra) => baked(tag, stat, extra) || clean(lines || NEW[tag] || NEW.shock);

  function decide(e) {
    const C = e.C;
    let out = null, important = false, flash = false;
    const ratio = (e.idx != null && e.n) ? e.idx / (e.n - 1) : null;
    switch (e.type) {
      case 'comment': claim = readComment(e.text); important = true;
        out = claim.mood === 'cocky' ? clean(NEW.cocky_start) : claim.mood === 'humble' ? say('start', null, NEW.humble_start) : say('start', null, NEW.neutral_start); break;
      case 'race':
        if (e.label === 'Hybrid') break;
        if (['Eternal', 'Devil', 'Deviant', 'Ghost', 'Saiyan', 'Viltrumite'].includes(e.label)) { out = baked('race:' + e.label); important = !!out; }
        if (!out && ['Shinigami', 'Quincy', 'Arrancar'].includes(e.label)) out = baked('race:Bleach');
        if (!out && e.power >= 3) { out = say('shock', null, ['A ' + e.label + '??', 'Okayyy scary start']); important = true; }
        if (!out && e.power === 0 && ['Goblin', 'Gnome', 'Hobbit', 'Slime', 'Zombie', 'Skeleton'].includes(e.label)) out = say('start', null, ['Lets see what bro does', 'A ' + e.label.toLowerCase() + '.. lets see']);
        break;
      case 'hybrid': out = say('hybrid', null, ['LETS SEE DA PARENTS']); important = true; break;
      case 'parents': if (e.father === 'Quincy' && e.mother === 'Shinigami' || e.father === 'Shinigami' && e.mother === 'Quincy') { out = baked('race:Bleach', null, m => /ichigo/i.test(m.line)) || clean(['Is bro ichigo???']); important = true; } break;
      case 'extra':
        if (e.boost >= 3) { out = say('shock', null, ['WTFFF?', e.label.split(' — ')[0] + '???']); important = true; }
        else if (e.id === 'bankai' && e.label === 'Yes' && C.extras.shikai === 'Yes') { out = baked('race:Bleach', null, m => /bankai/i.test(m.line)) || clean(['Both shikai and bankai?? God have mercy..']); important = true; }
        else if (e.id === 'zanpakuto' && /Ryūjin/.test(e.label)) { out = baked('race:Bleach', null, m => /yamamoto/i.test(m.line)) || clean(['YAMAMOTO\'S ZANPAKUTO??? WTFFFF?']); important = true; }
        break;
      case 'age': if (e.idx === 3) out = say('old', null, ['Old ahh unc', 'Becareful not to get heart attacks UNC']); else if (e.idx >= 9) out = say('shock', null, ['Bro is OLDER than the planet??', 'Old asf']); break;
      case 'height': if (e.inches >= 92) out = say('tall'); else if (e.inches <= 50) out = say('short'); else if (e.inches >= 72 && e.inches <= 84 && rnd() < 0.5) out = say('perfectheight'); break;
      case 'background': if (e.nobody) { C.nobody = true; if (rnd() < 0.35) out = say('start', null, ['Lets see who u WILL BE']); } break;
      case 'luck': if (e.value >= 0.8) { out = say('hype', null, ['+25% chance to max out EVERYTHING', 'The wheel likes you now']); important = true; } else if (e.value <= -0.7) out = clean(['Cursed luck?? its over', 'Nah the wheel hates u']); break;
      case 'personality': if (rnd() < 0.15) out = say('personality', null, ['personality suiting you perfectly']); break;
      case 'stat': {
        const s = e.stat, prev = e.prev;
        const respin = prev != null && prev >= 0;
        const top = (s === 'str' || s === 'dur') ? e.idx >= 17 : s === 'spd' ? e.idx >= 13 : (s === 'iq' ? e.idx >= 9 : e.idx >= 9);
        if (top && ['str', 'dur', 'spd', 'iq'].includes(s)) { flash = true; important = true; }
        if (respin) {
          if (e.idx < prev) { out = say(C._nerfed ? 'nerf' : 'nerf', s); C._nerfed = (C._nerfed || 0) + 1; important = prev - e.idx >= 2; }
          else if (e.idx > prev) { out = C._nerfed ? say('unnerf', s) : say('upgrade', s); if (C._nerfed) C._nerfed = Math.max(0, C._nerfed - 1); important = e.idx - prev >= 2 || top; }
          else out = rnd() < 0.4 ? clean(['Same thing again lmao', 'Nothing changed..']) : null;
        } else if (ratio <= 0.16) {
          if (claim.mood === 'cocky' && (claim[s === 'str' ? 'strong' : s === 'spd' ? 'fast' : s === 'iq' ? 'smart' : s === 'dur' ? 'tough' : 'strong'] || rnd() < 0.5)) { out = clean(NEW.cocky_low); important = true; }
          else if (C.nobody && s === 'str') out = baked('low', null, m => /nobody/i.test(m.line)) || say('low', s);
          else out = say('low', s);
          insulted = true; important = important || ratio <= 0.08;
        } else if (top || ratio >= 0.8) {
          if (insulted && s === 'iq') { out = baked('iqhigh', null, m => /sorry|apologize/i.test(m.line)) || clean(NEW.humble_high); insulted = false; }
          else if (claim.mood === 'humble' && rnd() < 0.5) out = clean(NEW.humble_high);
          else if (claim.mood === 'cocky' && rnd() < 0.35) out = clean(NEW.claim_true);
          else if (s === 'iq' && e.idx >= 8) out = baked('iqhigh', 'iq') || say('high', s, NEW.high);
          else if (top) out = flash ? say('flash', null, NEW.shock) : say('max', s);
          else out = say('high', s);
          important = true;
        } else if (ratio >= 0.6 && rnd() < 0.3) out = say('hype', s);
        if (e.gold) { important = true; if (!out) out = clean(NEW.golden); }
        break; }
      case 'weapon': if (e.none && rnd() < 0.4) out = say('weaponbad', null, ['No weapon.. fists it is']); else if (!e.none && rnd() < 0.25) out = say('weapongood', null, ['Perfect weapon too???']); break;
      case 'legend': out = say('weapongood', null, ['A LEGENDARY weapon??', '-' + e.label.replace(/^\d+\.\s*/, '').split(' — ')[0].toLowerCase() + ' what??']); important = true; break;
      case 'powercount':
        if (e.n === 0) { out = say('nopowers'); important = true; }
        else if (e.n >= 3) { out = baked('powerop', null, m => /three|3 powers/i.test(m.line)) || clean([`${e.n} POWERS??`, 'THREE POWERS?']); important = true; }
        else if (e.n === 1 && rnd() < 0.3) out = say('powerone', null, ['Only 1?']);
        break;
      case 'power': if (/Omnipotence|Reality|Existence|Conceptual|Law|Narrative|Time|Black Hole|Matter Erasure/.test(e.label)) { out = baked('powerop', null, m => /reality/i.test(m.line) || !/three|3 powers/i.test(m.line)) || clean(NEW.powerop); important = true; } else if (rnd() < 0.2) out = say('powerop', null, NEW.powerop); break;
      case 'transform': if (e.boost >= 3) { out = say('shock', null, ['Even strongest form doesnt Stop bro']); important = true; } break;
      case 'weakness': if (e.none && rnd() < 0.5) out = say('noweakness', null, ['No weakness??', 'Bro made sure to be untouchable']); break;
      case 'title': if (rnd() < 0.35) out = say('title', null, ['What a name', 'PEAK NAME']); break;
      case 'monster': if (e.tier >= 12) out = say('monster', null, ['Oh sh here we go again. We got another beast', 'A ' + e.label.toUpperCase() + '??']); break;
      case 'fight': if (e.win) { if (rnd() < 0.5) out = say('win'); } break;
      case 'death': out = baked('lose') || clean(NEW.death); important = true; break;
      case 'captured': out = clean(NEW.captured); important = true; break;
      case 'spared': if (rnd() < 0.5) out = clean(NEW.spared); break;
      case 'quest': if (e.danger === 'deadly') out = say('quest', null, ['WHAT KIND OF QUEST IS THIS!?', 'I have a crazy feelin abt ts']); break;
      case 'reward': if (/Godly|Cosmic|Legendary/.test(e.label) && rnd() < 0.6) out = say('hype', null, ['NOW DAS WHAT AM TALKIN ABT']); break;
      case 'followers': case 'org': {
        const n = e.n || 0;
        if (n >= 10000 || (e.tier || 0) >= 14) { out = say('followers', null, ['Bro has a whole army now', 'Lord have mercy']); important = true; }
        else if (n && n <= 50 && rnd() < 0.5) out = say('followerssmall', null, ['Rlly? Only that much?']);
        break; }
      case 'enemy': if ((e.tier || 0) >= 14) out = say('enemy', null, ['Bro made the WRONG enemy']); break;
      case 'ally': if ((e.tier || 0) >= 14) out = say('followers', null, ['Bro has OP allies now']); break;
      case 'business': if (/Bankrupt|Scammed|broke/i.test(e.outcome)) out = say('business', null, ['Can bro be any more broke than this?']); else if (/Forbidden|Godly/.test(e.outcome)) out = baked('powerop', null, m => /reality/i.test(m.line)) || clean(['Manipulating REALITY???']); break;
      case 'medicine': if (/Regeneration/.test(e.label)) out = say('regen', null, ['And you regenerate??']); break;
      case 'world': out = clean(NEW.world); important = true; break;
      case 'end': {
        const sc = e.score;
        if (e.short) out = say('endshort');
        else if (sc >= 0.62) out = baked('end', null, m => m.n === 'glowing-paper') || say('end');
        else if (sc >= 0.45) out = say('end');
        else out = say('endok', null, NEW.endmid);
        important = true; break; }
      default: break;
    }
    spins++;
    if (!out) { sinceMeme++; return null; }
    const show = important || sinceMeme >= 2 || (sinceMeme >= 1 && rnd() < 0.35);
    if (!show) { sinceMeme++; return null; }
    sinceMeme = 0;
    lastDecision = { ...out, flash };
    return lastDecision;
  }
  return { decide, readComment, get claim() { return claim; } };
}

// 0..1 how good a run was (for the end meme + card)
export function runScore(C) {
  const s = C.stats;
  const n = (v, m) => (v < 0 ? 0 : v / (m - 1));
  let sc = 0.25 * n(s.str, 20) + 0.25 * n(s.dur, 20) + 0.18 * n(s.spd, 15) + 0.12 * n(s.iq, 10) + 0.1 * n(s.fight, 10) + 0.05 * Math.min(1, C.powers.length / 3);
  sc += 0.05 * Math.min(1, (C.raceBoost + C.extraBoost) / 5);
  return Math.max(0, Math.min(1, sc));
}
