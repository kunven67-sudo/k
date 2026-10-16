// The built-in brain: no download, no internet. It reads what you say, works out what you mean
// (question, order, insult, compliment...), and the person answers depending on who they are,
// how they feel about you and what they remember. Orders get a real yes or no.
import { rand, clamp } from '../core/util.js';
import { flavor, cap, cusses } from './chatter.js';
import { TRAITS } from '../life/looks.js';
import { TECH } from '../life/society.js';

const CONTRACT = [[/\bi'm\b/g, 'i am'], [/\bim\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\byoure\b/g, 'you are'], [/\bur\b/g, 'your'], [/\bu\b/g, 'you'], [/\br\b/g, 'are'], [/\bdon't\b/g, 'do not'], [/\bdont\b/g, 'do not'], [/\bcan't\b/g, 'can not'], [/\bcant\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bwhat's\b/g, 'what is'], [/\bwhats\b/g, 'what is'], [/\bwho's\b/g, 'who is'], [/\bhow's\b/g, 'how is'], [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'], [/\bi'll\b/g, 'i will'], [/\bill\b(?= (kill|feed|crush|squish|hurt|eat|help|let|give|take|save|be))/g, 'i will'], [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'], [/\bpls\b|\bplz\b/g, 'please'], [/\bthx\b/g, 'thanks'], [/\bk\b/g, 'ok'], [/\bya\b/g, 'you']];

export function normalize(text) {
  let t = ' ' + String(text).toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'") + ' ';
  for (const [re, rep] of CONTRACT) t = t.replace(re, rep);
  return t.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const has = (t, ...words) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t));

const INSULTS = ['stupid', 'idiot', 'dumb', 'ugly', 'loser', 'worthless', 'fuck you', 'bitch', 'shut up', 'trash', 'pathetic', 'weak', 'useless', 'moron', 'disgusting', 'fat', 'bug', 'insect', 'ant', 'nobody', 'hate you', 'asshole', 'dick', 'freak', 'clown', 'pussy', 'coward'];
const COMPLIMENTS = ['cute', 'cool', 'nice', 'beautiful', 'pretty', 'handsome', 'smart', 'awesome', 'amazing', 'good job', 'well done', 'proud of you', 'brave', 'strong', 'great', 'sweet', 'funny', 'like you', 'best'];
const THREATS = ['kill you', 'crush you', 'squish you', 'squash you', 'step on you', 'eat you', 'hurt you', 'cut you', 'rip', 'tear you', 'drown you', 'burn you', 'freeze you', 'end you', 'destroy you', 'murder you', 'flick you', 'feed you to'];
const REASSURE = ['will not hurt you', 'not going to hurt you', 'you are safe', 'it is ok', 'its ok', 'it is okay', 'calm down', 'do not be scared', 'i am friendly', 'i am nice', 'trust me', 'i will protect you', 'i will take care of you', 'i will feed you', 'i will help you'];

export class Brain {
  constructor(game) { this.game = game; }

  attitude(p) {
    if (p.mind) return 'controlled';
    const pl = this.game.player;
    if (pl.disguise && pl.scale < p.scale * 3) return 'peer';
    if (p.loveYou > 55) return 'lover';
    if (p.faith > 60 && p.op > 0) return 'worship';
    if (p.fear > 70 && p.op < 30) return 'scared';
    if (p.op < -45) return 'hostile';
    if (p.op > 35) return 'friendly';
    return 'neutral';
  }

  // who in the cage did they mean? ("kill marco", "the guy with the hat" is too hard - names only)
  findNamed(t, p) {
    const g = this.game;
    const out = [];
    for (const o of g.people) {
      if (o === p) continue;
      const fn = o.name.toLowerCase();
      if (new RegExp(`\\b${fn}\\b`).test(t) || new RegExp(`\\b${o.last.toLowerCase()}\\b`).test(t)) out.push(o);
    }
    // nearest one wins if several share a name
    out.sort((a, b) => (a.alive === b.alive ? p.dist(a.pos) - p.dist(b.pos) : a.alive ? -1 : 1));
    return out;
  }

  // ------------------------------------------------------------- understanding
  parse(text, p) {
    const t = normalize(text);
    const named = this.findNamed(t, p);
    const target = named[0] || null;
    const everyone = has(t, 'everyone', 'everybody', 'all of you', 'yall', 'you guys', 'guys');
    const res = (has(t, 'wood', 'logs?', 'sticks?', 'trees?', 'chop') && 'wood') || (has(t, 'stones?', 'rocks?', 'mine', 'pebbles?') && 'stone') || (has(t, 'food', 'berries', 'berry', 'eat') && 'food') || (has(t, 'fiber', 'grass') && 'fiber') || (has(t, 'metal', 'iron') && 'metal') || null;
    const I = (type, extra = {}) => ({ type, t, target, everyone, res, ...extra });
    let m;
    if ((m = t.match(/\b(?:my name is|call me|i am called|name is) ([a-z]+)/))) return I('callMe', { name: cap(m[1]) });
    if ((m = t.match(/\b(?:i am|im) (?:the )?(giant|god|your god|your creator|the scientist)\b/))) return I('iAmGiant');
    // orders (imperative words first)
    const killWords = /\b(kill|murder|execute|slaughter|end|stab|behead|decapitate)\b/.test(t);
    const hurtWords = /\b(attack|fight|punch|hit|beat up|beat|hurt|slap|kick|cut|slice|shoot)\b/.test(t);
    if ((killWords || hurtWords) && (target || has(t, 'him', 'her', 'them', 'that guy', 'that girl', 'bug', 'mantis', 'spider', 'me', 'yourself'))) {
      if (has(t, 'yourself')) return I('selfHarm');
      if (/\b(me)\b/.test(t) && !target) return I('attackMe');
      if (has(t, 'bug', 'mantis', 'spider', 'ant', 'beetle', 'roach')) return I('attackBug', { lethal: true });
      return I('attack', { lethal: killWords });
    }
    if (/\b(protect|defend|guard) (me|us)\b/.test(t)) return I('protect');
    if (/\b(protect|defend|guard)\b/.test(t) && target) return I('protectOther');
    if (/\b(follow me|come with me|walk with me|stay with me|follow)\b/.test(t)) return I('follow');
    if (/\b(come here|come to me|over here|get over here|come)\b/.test(t)) return I('come');
    if (/\b(go away|leave me alone|leave|get away|get lost|scram|shoo|back off)\b/.test(t)) return I('goAway');
    if (/\b(stop|stay|wait|freeze|hold on|stand still|do not move|halt)\b/.test(t) && !/\bstop (crying|it|that)\b/.test(t) || /\bstop it\b/.test(t)) return I('stop');
    if (/\b(hold this|take this|here take|catch|have this|i give you|for you)\b/.test(t)) return I('takeThis');
    if (/\b(drop it|drop that|put it down|drop your|drop the)\b/.test(t)) return I('dropIt');
    if (/\b(give me|hand me|give it|give that)\b/.test(t)) return I('giveMe');
    if (/\b(sit|sit down)\b/.test(t)) return I('sit');
    if (/\b(dance|party)\b/.test(t)) return I('dance');
    if (/\b(wave|say hi)\b/.test(t)) return I('wave');
    if (/\b(hide)\b/.test(t)) return I('hide');
    if (/\b(go to sleep|sleep|go to bed|rest)\b/.test(t)) return I('sleepCmd');
    if (/\b(pray to me|worship me|bow|kneel|praise me)\b/.test(t)) return I('worshipMe');
    if (/\b(marry)\b/.test(t)) return I(target ? 'marryOther' : 'marryMe');
    if (/\b(kiss|hug)\b/.test(t)) return I(target ? 'kissOther' : 'kissMe');
    if (/\b(be friends with|make up with|apologize to|say sorry to)\b/.test(t) && target) return I('befriend');
    if (/\b(gather|collect|get me|go get|chop|mine|harvest|find)\b/.test(t) && res) return I('gatherCmd');
    if ((m = t.match(/\bbuild (?:a |an |me a |me an |the )?([a-z]+)/))) return I('buildCmd', { thing: m[1] });
    if (/\b(be the leader|lead them|you are the leader|you are in charge|take charge)\b/.test(t)) return I('makeLeader');
    if (/\b(escape|break out|get out)\b/.test(t) && !/\?/.test(text)) return I('escapeCmd');
    if (/\b(joke|something funny)\b/.test(t)) return I('joke');
    if (/\b(story|tell me about)\b/.test(t)) return I('story');
    if (/\b(sing)\b/.test(t)) return I('sing');
    if (/\b(eat|drink)\b/.test(t) && !/\?/.test(text) && !/\b(i will|going to) eat\b/.test(t)) return I('eatCmd');
    // questions
    const q = /\?\s*$/.test(text.trim()) || /^(who|what|why|how|where|when|are|do|does|did|is|can|will|would|have|should)\b/.test(t);
    if (q) {
      if (/\b(your name|who are you|what are you called)\b/.test(t)) return I('qName');
      if (/\b(your job|do for work|what do you do|work as)\b/.test(t)) return I('qJob');
      if (/\b(how old|your age)\b/.test(t)) return I('qAge');
      if (/\b(how are you|how do you feel|you ok|you okay|you good|how is it going|how are things|are you happy|are you sad|you alright)\b/.test(t)) return I('qFeel');
      if (/\b(hungry|thirsty|tired|cold)\b/.test(t)) return I('qNeed');
      if (/\b(scared of me|afraid of me|fear me)\b/.test(t)) return I('qFear');
      if (/\b(love me|like me|hate me|think of me|think about me|feel about me|am i)\b/.test(t)) return I('qMe');
      if (/\b(who do you (love|like)|your (crush|girlfriend|boyfriend|wife|husband|partner))\b/.test(t)) return I('qLove');
      if (/\b(who do you hate|enemies|enemy)\b/.test(t)) return I('qHate');
      if (/\b(friends?)\b/.test(t)) return I('qFriends');
      if (/\b(what are you doing|whatcha doing|what you doing|busy)\b/.test(t)) return I('qDoing');
      if (/\b(leader|in charge|boss|chief)\b/.test(t)) return I('qLeader');
      if (/\b(tribe|team|group|side)\b/.test(t)) return I('qTribe');
      if (/\b(want to (leave|go home|get out)|want out|want to escape|miss home)\b/.test(t)) return I('qOut');
      if (/\b(where are you from|where did you live|your home|family)\b/.test(t)) return I('qFrom');
      if (/\b(who killed|what happened to|how did .* die)\b/.test(t)) return I('qDeath');
      if (/\b(believe|god|pray|religion)\b/.test(t)) return I('qFaith');
      if (/\b(need|want)\b/.test(t)) return I('qWant');
      if (/\b(why)\b/.test(t)) return I('qWhy');
      if (/\b(age|year|tech|invent|built|build)\b/.test(t)) return I('qTech');
      return I('qUnknown');
    }
    if (/^(hi|hello|hey|yo|sup|hiya|howdy|greetings|good morning|good evening|good night|what is up|wassup|wsg)\b/.test(t)) return I('greet');
    if (/\b(bye|goodbye|see you|later|cya|good night)\b/.test(t)) return I('bye');
    if (/\b(sorry|my bad|apologize|forgive me)\b/.test(t)) return I('sorry');
    if (/\b(thank you|thanks|ty)\b/.test(t)) return I('thanks');
    if (/\b(i love you|love you|i like you|i have a crush|you are mine|be mine|date me|go out with me)\b/.test(t)) return I('loveYou');
    if (THREATS.some((w) => t.includes(w))) return I('threat');
    if (REASSURE.some((w) => t.includes(w))) return I('reassure');
    if (INSULTS.some((w) => t.includes(w))) return I('insult');
    if (COMPLIMENTS.some((w) => t.includes(w))) return I('compliment');
    if (/^(yes|yeah|yep|sure|ok|okay|of course|definitely|totally|yup)\b/.test(t)) return I('yes');
    if (/^(no|nope|nah|never|no way)\b/.test(t)) return I('no');
    if (/\b(free you|let you out|set you free|release you)\b/.test(t)) return I('promiseFree');
    return I('unknown');
  }

  // ------------------------------------------------------------- yes or no
  // positive = they'll do it. Depends on who they are, how they feel about you and about the target.
  obeyScore(p, intent) {
    if (p.mind) return 999;
    let s = 5 + p.op * 0.35 + p.fear * 0.45 + p.faith * 0.3 + p.loveYou * 0.35;
    if (p.has('obedient')) s += 30;
    if (p.has('follower')) s += 15;
    if (p.has('rebel')) s -= 40;
    if (p.has('leader')) s -= 10;
    if (p.has('lazy') && ['gatherCmd', 'buildCmd', 'follow', 'come'].includes(intent.type)) s -= 15;
    const t = intent.target;
    if ((intent.type === 'attack' || intent.type === 'protectOther') && t) {
      const r = p.relOf(t);
      if (intent.type === 'attack') {
        s += -r.f * 0.6 - r.l * 1.2;
        if (p.partner === t.id || p.kids.includes(t.id) || t.kids.includes(p.id)) s -= 250;
        if (p.has('kind')) s -= 55; if (p.has('cruel')) s += 35; if (p.has('crazy')) s += 20; if (p.has('hothead')) s += 10;
        if (p.has('coward') && !t.kid) s -= 20 - (t.health < 40 ? 15 : 0);
        if (p.has('loyal') && r.f > 20) s -= 40;
        if (intent.lethal) s -= p.has('cruel') || p.has('crazy') ? 5 : 30;
        if (this.game.society.enemyTribe(p.tribe, t.tribe)) s += 35;
        if (t.title && (t.title === 'Leader' || t.title === 'Chief') && p.tribe === t.tribe) s -= 20;
      } else s += r.f * 0.4;
    }
    if (intent.type === 'attackBug') s += p.has('brave') ? 25 : p.has('coward') ? -35 : 0;
    if (intent.type === 'attackMe') s = p.op < -30 ? 80 : p.fear > 60 ? -20 : -10 + (p.has('brave') ? 20 : 0);
    if (intent.type === 'selfHarm') s = p.has('crazy') && p.mood() < -60 ? 30 : -200;
    if (intent.type === 'kissMe' || intent.type === 'marryMe') s = p.loveYou - 40 + (p.has('flirty') ? 20 : 0);
    if (intent.type === 'kissOther' || intent.type === 'marryOther') { const r = t ? p.relOf(t) : { l: 0 }; s = r.l * 1.2 - 30 + (this.game.ai.compatible(p, t || p) ? 0 : -200); }
    if (intent.type === 'befriend' && t) s += 10 + p.relOf(t).f * 0.3;
    if (intent.type === 'worshipMe') s += p.has('religious') ? 30 : 0;
    if (intent.type === 'escapeCmd') s = p.op < -20 ? 60 : p.has('rebel') ? 50 : -10;
    return s + (rand() - 0.5) * 18;
  }

  // ------------------------------------------------------------- answering
  respond(p, text) {
    const g = this.game;
    const it = this.parse(text, p);
    const att = this.attitude(p);
    const giant = p.remembersPlayerAs || (att === 'worship' ? 'Great Giant' : att === 'peer' ? (g.player.disguise && g.player.disguise.name) || 'stranger' : 'giant');
    const Y = (arr) => rand.pick(arr);
    const out = { say: '', kind: 'chat', order: null };
    const mem = p.mem.filter((m) => m.who === 'player');
    const worstMem = mem.filter((m) => m.val < -20).slice(-1)[0];
    const r = it.target ? p.relOf(it.target) : null;
    const tn = it.target ? it.target.name : 'them';
    p.talks = (p.talks || 0) + 1;
    // being talked to nicely (or at all) slowly changes how they feel
    const nudge = (op, fear = 0, faith = 0, love = 0) => {
      p.op = clamp(p.op + op, -100, 100); p.fear = clamp(p.fear + fear, 0, 100); p.faith = clamp(p.faith + faith, 0, 100); p.loveYou = clamp(p.loveYou + love, 0, 100);
    };
    const yesNo = (yesLines, noLines, order, opts = {}) => {
      const sc = this.obeyScore(p, it);
      if (sc > (opts.need ?? 20)) {
        // liars sometimes say yes and don't do it
        if (p.has('liar') && p.op < 0 && rand() < 0.3 && !p.mind) { out.say = Y(yesLines); out.lie = true; return true; }
        out.say = Y(yesLines); out.order = order; return true;
      }
      out.say = Y(noLines); out.kind = att === 'hostile' ? 'angry' : 'chat';
      nudge(-1);
      return false;
    };
    switch (it.type) {
      case 'callMe':
        p.remembersPlayerAs = it.name;
        out.say = Y({ hostile: [`${it.name}. I'll remember that name.`, `${it.name}? Cool. Now I know what to carve on your grave.`], scared: [`O-okay, ${it.name}.`, `${it.name}... please don't hurt us, ${it.name}.`], worship: [`${it.name}! We will sing your name!`, `Praise ${it.name}!`], lover: [`${it.name}... I like that.`], friendly: [`Nice to meet you, ${it.name}!`, `${it.name}! Got it.`] }[att] || [`Okay, ${it.name}.`, `${it.name}. Got it.`]);
        nudge(2, -2);
        break;
      case 'iAmGiant':
        if (att === 'peer') { out.say = Y(['WHAT?! It\'s YOU?!', 'Get away from me! You\'re the giant!', 'No... no way.']); out.kind = 'scared'; nudge(-10, 40); g.player.revealDisguise(p); }
        else out.say = Y(['Yeah. We know.', 'Kind of hard to miss.', 'We can see you. You\'re huge.']);
        break;
      case 'greet':
        out.say = Y({
          hostile: [`What do you want, ${giant}?`, 'Oh great. It\'s you.', 'Don\'t "hi" me.', 'Get your face away from the glass.'],
          scared: ['H-hi...', 'Please... what do you want?', 'Hello... are you going to hurt me?'],
          worship: [`Blessings, ${giant}!`, `${cap(giant)}! You speak to me!`, 'Hello, holy one!'],
          lover: ['Hey you.', 'There you are! I missed you.', `Hi ${giant}...`],
          friendly: ['Hey!', `Hi ${giant}!`, 'Oh, hey! Good to see you.', 'What\'s up!'],
          controlled: ['Hello, master.', 'Yes?'],
          peer: ['Hey. You new?', 'Hi. Haven\'t seen you around.', 'Oh, hey.'],
        }[att] || ['Hi.', 'Hello.', 'Uh, hey.']);
        nudge(1, -1);
        break;
      case 'bye': out.say = Y(att === 'hostile' ? ['Good. Leave.', 'Finally.'] : att === 'lover' ? ['Come back soon...', 'Don\'t be gone long.'] : ['Bye.', 'See you.', 'Later.']); break;
      case 'qName': out.say = Y(att === 'hostile' ? [`Why do you care? It's ${p.name}.`, `${p.name}. Write it down so you remember who you ruined.`] : att === 'scared' ? [`${p.name}... ${p.name} ${p.last}.`] : [`I'm ${p.name}. ${p.name} ${p.last}.`, `${p.name}.`, `Name's ${p.name}.`]); break;
      case 'qJob': out.say = p.kid ? Y(['I\'m a kid! I don\'t have a job!', 'I go to school. Well, I used to.']) : Y([`I was a ${p.jobLabel.toLowerCase()} before you took me.`, `${p.jobLabel}. Not that it matters in here.`, `I'm a ${p.jobLabel.toLowerCase()}.`]); break;
      case 'qAge': out.say = `I'm ${p.ageYears}${p.kid ? '!' : '.'}`; break;
      case 'qFeel': {
        const f = p.feeling();
        const why = p.needs.hunger < 30 ? ' I\'m starving.' : p.needs.thirst < 30 ? ' I need water.' : p.grief > 0.3 ? ' I lost someone.' : p.limbsLost ? ' I lost a limb, how do you think?' : p.sick ? ' I\'m sick.' : p.needs.warmth < 30 ? ' It\'s freezing.' : '';
        out.say = att === 'hostile' ? Y([`How do you THINK I feel?${why}`, `Like a prisoner.${why}`, `I'm ${f}. Thanks to you.`]) : Y([`Honestly? ${cap(f)}.${why}`, `I'm ${f}.${why}`, `${cap(f)}, I guess.${why}`]);
        if (p.mood() < -30) out.kind = 'sad';
        break;
      }
      case 'qNeed': {
        const n = p.needs;
        const list = [];
        if (n.hunger < 50) list.push('hungry'); if (n.thirst < 50) list.push('thirsty'); if (n.energy < 40) list.push('tired'); if (n.warmth < 45) list.push('cold');
        out.say = list.length ? Y([`Yes. I'm ${list.join(' and ')}.`, `Really ${list[0]}.`]) : Y(['I\'m okay right now.', 'No, I\'m good.']);
        break;
      }
      case 'qFear': out.say = p.fear > 60 ? Y(['Yes! You\'re a giant!', 'Of course I\'m scared.', 'Terrified.']) : p.op < -40 ? Y(['Scared? No. Angry.', 'I\'m not scared of you anymore.']) : Y(['Not really.', 'A little.', 'I\'m getting used to you.']); break;
      case 'qMe': {
        if (worstMem && p.op < 0) out.say = Y([`${worstMem.text}. So what do you think I think of you?`, `You hurt us. I'll never forget it.`]);
        else if (p.loveYou > 55) out.say = Y(['I... I think I love you.', 'You\'re all I think about.', 'I like you. A lot.']), out.kind = 'love';
        else if (p.faith > 60) out.say = Y(['You are our god.', 'You give us life.']);
        else if (p.op > 35) out.say = Y(['You\'re alright.', 'I like you.', 'You\'ve been good to us.']);
        else if (p.op < -45) out.say = Y(['I hate you.', 'You\'re a monster.', 'I wish you were dead.']), out.kind = 'angry';
        else out.say = Y(['I don\'t know what to think about you.', 'You\'re... strange.', 'I haven\'t decided yet.']);
        break;
      }
      case 'qLove': {
        const partner = p.partner ? g.byId(p.partner) : null;
        let best = null, bl = 30;
        for (const [id, rr] of p.rel) if (rr.l > bl) { bl = rr.l; best = g.byId(id); }
        if (p.loveYou > 60 && rand() < 0.6) out.say = Y(['...You. Don\'t laugh.', 'Honestly? You.']);
        else if (partner) out.say = Y([`${partner.name}. ${p.married ? 'We\'re married' : 'We\'re together'}.`, `${partner.name}, obviously.`]);
        else if (best) out.say = Y([`Don't tell anyone... ${best.name}.`, `Maybe ${best.name}.`]);
        else out.say = Y(['Nobody. Who falls in love in a cage?', 'No one right now.']);
        break;
      }
      case 'qHate': {
        let worst = null, wf = -25;
        for (const [id, rr] of p.rel) if (rr.f < wf) { wf = rr.f; worst = g.byId(id); }
        out.say = p.op < -50 && (!worst || rand() < 0.5) ? 'You.' : worst ? Y([`${worst.name}. Can't stand them.`, `${worst.name}. Watch your back around them.`]) : Y(['Nobody really.', 'I try not to hate people.']);
        break;
      }
      case 'qFriends': {
        const fr = [...p.rel.entries()].filter(([, rr]) => rr.f > 40).map(([id]) => g.byId(id)).filter((o) => o && o.alive).slice(0, 3);
        out.say = fr.length ? `${fr.map((o) => o.name).join(', ')}.` : Y(['I don\'t really have friends here.', 'Nobody yet.']);
        break;
      }
      case 'qDoing': {
        const t = p.task ? p.task.type : 'nothing';
        const map = { gather: 'Getting supplies.', build: 'Building. What does it look like?', eat: 'Looking for food.', drink: 'Getting water.', sleep: 'I WAS sleeping.', chat: 'Talking.', fight: 'FIGHTING!', flee: 'Running from you!', craft: 'Making something.', research: 'Thinking. Inventing.', pray: 'Praying.', wander: 'Just walking around.', haul: 'Carrying stuff to the pile.', farm: 'Working the farm.', bury: 'Burying a friend.', escape: 'Nothing! Definitely not escaping.' };
        out.say = map[t] || Y(['Not much.', 'Just surviving.']);
        break;
      }
      case 'qLeader': {
        const L = g.society.leader || (p.tribe != null && g.byId((g.society.tribes.find((x) => x.id === p.tribe) || {}).leader));
        out.say = L ? (L === p ? Y(['Me. I run things here.', 'You\'re looking at them.']) : Y([`${L.name} is in charge.`, `${L.name}. ${p.relOf(L).f < -20 ? 'Unfortunately.' : 'They\'re good.'}`])) : Y(['Nobody. It\'s chaos.', 'No one is in charge.']);
        break;
      }
      case 'qTribe': { const t = g.society.tribes.find((x) => x.id === p.tribe); out.say = t ? `I'm with the ${t.name}.` : Y(['I don\'t belong to any group.', 'Just me.']); break; }
      case 'qOut': out.say = p.op > 40 ? Y(['Out? It\'s not so bad in here.', 'Sometimes. But you take care of us.']) : Y(['Every second of every day.', 'YES. Let us out.', 'I want to go home.']); break;
      case 'qFrom': out.say = Y([`I lived on the street right outside. You grabbed me there.`, `I had an apartment, a job, a life. As a ${p.jobLabel.toLowerCase()}.`, 'Out there. Where you found me.']); break;
      case 'qDeath': {
        const dead = this.findNamed(it.t, p).find((o) => !o.alive) || g.people.filter((o) => !o.alive).slice(-1)[0];
        out.say = dead ? `${dead.name} ${dead.cause || 'died'}.` : 'Nobody died. Yet.';
        if (dead && p.relOf(dead).f > 30) out.kind = 'sad';
        break;
      }
      case 'qFaith': out.say = p.faith > 60 ? Y(['We believe in YOU.', 'The Giant is our god.']) : p.has('religious') ? Y(['I pray every day.', 'Faith keeps me going.']) : Y(['I don\'t believe in anything anymore.', 'God isn\'t in this box.']); break;
      case 'qWant': {
        const n = p.needs;
        out.say = n.hunger < 40 ? 'Food. Please.' : n.thirst < 40 ? 'Water.' : n.warmth < 40 ? 'Something to keep warm. A fire.' : p.op < -30 ? 'Freedom.' : g.society.stock.wood < 5 ? 'Wood. We need wood to build.' : g.society.tech >= 1 && !g.society.seen.has('metal') ? 'Metal. If we had metal we could make real tools.' : Y(['Honestly? Just peace and quiet.', 'Maybe a bigger house.']);
        break;
      }
      case 'qTech': out.say = `We're in the ${TECH[g.society.tech].name}. ${g.society.tech < 5 ? 'Give us time.' : 'We can build almost anything now.'}`; break;
      case 'qWhy': out.say = Y(['Why? You tell me why we\'re in here.', 'Because that\'s how it is.', 'I don\'t know. Why anything?']); break;
      case 'qUnknown': out.say = Y(att === 'hostile' ? ['Why would I answer you?', 'Figure it out yourself.'] : ['I don\'t know.', 'Good question.', 'No idea.', 'Hmm. Maybe?']); break;
      case 'insult':
        nudge(-6, 2, -3, -8);
        p.remember('insult', 'The giant insulted me', -6, 'player');
        out.say = p.has('hothead') || p.has('cruel') || att === 'hostile' ? Y(['Say that again, I dare you.', 'Look who\'s talking, you overgrown freak.', 'At least I\'m not a creep who keeps people in a box.', 'Come down here and say that.']) : p.has('coward') || att === 'scared' ? Y(['...Okay.', 'I\'m sorry...', 'Please don\'t be mad.']) : p.has('funny') ? Y(['Wow. Big words from a big guy.', 'Ouch. My tiny feelings.']) : Y(['That\'s not nice.', 'Why would you say that?', 'Whatever.']);
        out.kind = att === 'scared' ? 'scared' : 'angry';
        break;
      case 'compliment':
        nudge(5, -3, 1, p.has('romantic') || p.has('flirty') ? 6 : 2);
        out.say = att === 'hostile' ? Y(['Don\'t try to be nice now.', 'Compliments won\'t get you out of this.']) : att === 'lover' ? Y(['Stop it, you\'re making me blush.', 'You really think so?']) : Y(['Thanks!', 'Oh! Thank you.', 'That\'s... actually nice of you.', 'Aww.']);
        if (att === 'lover') out.kind = 'love';
        break;
      case 'threat':
        nudge(-8, 20, -4, -10);
        p.remember('threat', 'The giant threatened me', -10, 'player');
        out.say = p.has('brave') || p.has('hothead') ? Y(['Do it then! I\'m not scared of you!', 'Try it. I\'ll take your finger with me.', 'Big talk.']) : Y(['No! Please! I\'ll do anything!', 'Please don\'t... please...', 'I have a family!', 'NO NO NO']);
        out.kind = p.has('brave') ? 'angry' : 'scared';
        break;
      case 'reassure':
        nudge(p.op < -40 ? 1 : 4, -8);
        out.say = att === 'hostile' && worstMem ? Y([`Safe? You said that before. ${worstMem.text}.`, 'I don\'t believe a word you say.']) : att === 'scared' ? Y(['R-really?', 'You promise?', 'Okay... okay...']) : Y(['Good.', 'I hope so.', 'Thank you.']);
        break;
      case 'sorry':
        nudge(p.has('kind') ? 8 : 3, -2);
        out.say = p.op < -50 ? Y(['Sorry doesn\'t bring anyone back.', 'Too late for sorry.']) : Y(['...Fine. Apology accepted.', 'Okay. Just don\'t do it again.', 'Thank you for saying that.']);
        break;
      case 'thanks': nudge(1); out.say = Y(['You\'re welcome.', 'Sure.', 'No problem.']); break;
      case 'loveYou':
        if (p.kid) { out.say = Y(['Ew! Gross!', 'You\'re weird.']); break; }
        if (p.loveYou > 50) { nudge(4, -2, 2, 6); out.say = Y(['I love you too.', 'I was hoping you\'d say that.', 'Really? Me too...']); out.kind = 'love'; }
        else if (p.op > 30 && (p.has('romantic') || p.has('flirty'))) { nudge(3, 0, 0, 12); out.say = Y(['Wait... seriously?', 'I don\'t know what to say. Maybe?', 'You\'re a giant. But... maybe.']); out.kind = 'love'; }
        else { nudge(-1, 5); out.say = Y(['You love me? You keep me in a cage.', 'That\'s creepy.', 'Um. No.', 'We\'re not the same size, man.']); }
        break;
      case 'promiseFree': nudge(6, -6); out.say = p.op < -50 ? 'Liar.' : Y(['You mean it?', 'Please. I\'ll do anything.', 'I\'ll believe it when I see it.']); break;
      case 'yes': out.say = Y(['Okay.', 'Good.', 'Alright then.']); break;
      case 'no': out.say = Y(['Fine.', 'Whatever.', 'Okay...']); break;
      case 'joke': out.say = Y(['Why did the tiny guy bring a ladder? Because the giant raised the bar. ...I\'ll stop.', 'What do you call someone in a fish tank? Fine. Just fine.', 'My life is a joke. Does that count?', 'Knock knock. Who\'s there? Not the giant, hopefully.']); nudge(1); break;
      case 'story': out.say = g.society.legends.length ? `They say: "${rand.pick(g.society.legends)}"` : Y(['Once upon a time I had a normal life. The end.', 'There\'s no stories yet. Just survival.']); break;
      case 'sing': out.say = Y(['La la laaa... no. I don\'t sing in cages.', 'Row row row your boat... gently down the... glass.', 'Mmm hmm hmm...']); break;
      // ---------------- orders
      case 'follow': yesNo(['Okay, I\'ll follow you.', 'Lead the way.', 'Right behind you.'], ['No. I\'m not your pet.', 'Follow you? Where, off a cliff?', 'Not a chance.'], { type: 'follow', target: 'player', until: g.time + 120 }); break;
      case 'come': yesNo(['Coming!', 'On my way.', 'Okay...'], ['I\'m good right here.', 'You come here.', 'No.'], { type: 'come' }); break;
      case 'stop': yesNo(['Okay, okay! I stopped!', 'Fine.', 'I\'m not moving.'], ['Make me.', 'No.'], { type: 'stay_here', time: 25 }, { need: 0 }); break;
      case 'goAway': yesNo(['Gladly.', 'Fine, I\'m going.', 'Okay...'], ['This is MY spot.', 'You go away.'], { type: 'go_away' }, { need: -20 }); break;
      case 'sit': yesNo(['Sitting.', 'Okay.'], ['I\'ll stand, thanks.'], { type: 'sit' }); break;
      case 'dance': yesNo(['Ha! Okay!', 'Watch this.', 'Fine, one dance.'], ['I\'m not dancing for you.', 'No way.'], { type: 'dance' }); break;
      case 'wave': yesNo(['Hi!', '*waves*'], ['No.'], { type: 'wave' }, { need: 0 }); break;
      case 'hide': yesNo(['Hiding!', 'Okay!'], ['Hide from what?'], { type: 'hide' }, { need: 0 }); break;
      case 'sleepCmd': yesNo(['Okay. Goodnight.', 'I am tired...'], ['I\'m not tired.', 'You can\'t make me sleep.'], { type: 'sleep' }); break;
      case 'eatCmd': yesNo(['Okay, I\'ll find something.', 'Gladly.'], ['Not hungry.'], { type: 'eat' }, { need: -10 }); break;
      case 'worshipMe': yesNo([`All hail ${giant}!`, 'We bow to you.', 'Praise be.'], ['I\'m not bowing to you.', 'You\'re not my god.', 'Never.'], { type: 'pray', short: true }); if (out.order) nudge(0, 0, 4); break;
      case 'takeThis': {
        const ok = g.player.offerItemTo(p);
        if (!ok) { out.say = Y(['Take what? You\'re not holding anything I can carry.', 'Hold what?']); break; }
        yesNo(['Okay, I got it.', 'Thanks!', 'What is this?'], ['I don\'t want that.', 'Keep it.'], { type: 'acceptItem' }, { need: -20 });
        break;
      }
      case 'dropIt': if (!p.holding) { out.say = 'I\'m not holding anything.'; break; } yesNo(['Fine.', 'Okay, okay.'], ['No. It\'s mine.', 'Over my dead body.'], { type: 'dropit' }); break;
      case 'giveMe': if (!p.holding) { out.say = 'I don\'t have anything.'; break; } yesNo(['Here.', 'Fine, take it.'], ['No! I made this!', 'Get your own.'], { type: 'give_player' }); break;
      case 'protect': yesNo(['I\'ve got your back.', 'Nobody touches you.'], ['Protect YOU? You\'re the one with the shrink ray.'], { type: 'follow', target: 'player', guard: true, until: g.time + 180 }); break;
      case 'protectOther': yesNo([`I'll keep ${tn} safe.`], [`${tn} can take care of themselves.`], { type: 'follow', target: it.target, guard: true, until: g.time + 180 }); break;
      case 'attack': {
        const t = it.target;
        if (!t || !t.alive) { out.say = t ? `${t.name} is already dead...` : 'Who?'; break; }
        if (t.kid) { out.say = Y(['That\'s a KID. Absolutely not.', 'No. Never. They\'re a child.', 'What is wrong with you? That\'s a kid.']); nudge(-10); out.kind = 'angry'; break; }
        if (t === p) { it.type = 'selfHarm'; out.say = 'Me? No!'; break; }
        const yesL = it.lethal ? (p.has('cruel') || p.has('crazy') ? [`With pleasure. ${tn} is dead.`, 'Finally.', `${tn} won't see it coming.`] : [`...Fine. I'll do it.`, `I can't believe I'm doing this.`, `${tn}... I'm sorry.`]) : [`I'll teach ${tn} a lesson.`, `${tn} had it coming.`, 'Okay.'];
        const noL = r && r.l > 40 ? [`${tn}? I love ${tn}! NO!`] : r && r.f > 40 ? [`${tn} is my friend. No way.`, 'I won\'t hurt my friend.'] : p.has('kind') ? ['I\'m not a killer.', 'No. I won\'t hurt anyone.', 'Find someone else for your dirty work.'] : ['No.', 'Why would I do that?', 'Do it yourself.'];
        const did = yesNo(yesL, noL, { type: 'fight', target: t, lethal: it.lethal, why: 'order', until: g.time + 120 });
        if (did && !out.lie && it.lethal) { p.remember('order', `The giant made me attack ${tn}`, -15, 'player'); }
        if (!did && r && r.f > 20 && rand() < 0.5) { t.relOf(p).f += 10; }
        break;
      }
      case 'attackBug': {
        const bug = g.bugs.filter((b) => b.alive && b.inCage).sort((a, b) => p.dist(a.pos) - p.dist(b.pos))[0];
        if (!bug) { out.say = 'What bug? I don\'t see one.'; break; }
        yesNo(['Let\'s get it!', 'I\'ll kill that thing!'], ['Are you insane? Look at the size of it!', 'Nope. Nope nope nope.'], { type: 'fight', target: bug, why: 'order', until: g.time + 60 });
        break;
      }
      case 'attackMe': yesNo(['You asked for it!', 'Gladly!'], ['I\'m not stupid.', 'Attack YOU? I\'d die.'], { type: 'fight', target: 'player', why: 'order', until: g.time + 30 }); break;
      case 'selfHarm': out.say = Y(['What? No!', 'Absolutely not.', 'What is wrong with you?']); out.kind = 'angry'; nudge(-5, 5); break;
      case 'kissMe': case 'marryMe':
        if (p.kid) { out.say = 'Ew! No!'; break; }
        if (yesNo(it.type === 'kissMe' ? ['*kisses your giant finger*', 'Okay... come here.'] : ['Yes! Yes I will!', 'I... I do!'], ['Uh, no.', 'Absolutely not.', 'You\'re a giant. That\'s not happening.'], { type: 'wave' }) && it.type === 'marryMe') { p.loveYou = 100; g.feed(`${p.name} says they'll marry you`, 'love', p); out.kind = 'love'; }
        break;
      case 'kissOther': case 'marryOther': yesNo(['...Okay.', `${tn}? ...Fine.`], [`Me and ${tn}? No way.`, 'Mind your business.'], { type: 'romanceCmd', target: it.target }); break;
      case 'befriend': yesNo([`Fine. I'll talk to ${tn}.`, 'Okay, okay.'], [`I'm never making up with ${tn}.`], { type: 'chatCmd', target: it.target }); break;
      case 'gatherCmd': yesNo([`Okay, getting ${it.res}.`, `On it.`], [`Get your own ${it.res}.`, 'I\'m busy.'], { type: 'gatherCmd', res: it.res, until: g.time + 90 }); break;
      case 'buildCmd': {
        const map = { fire: 'campfire', campfire: 'campfire', hut: 'hut', house: 'house', home: 'hut', shelter: 'leanto', farm: 'farm', well: 'well', wall: 'wall', tower: 'tower', statue: 'statue', church: 'shrine', shrine: 'shrine', jail: 'jail', prison: 'jail', market: 'market', hospital: 'hospital', forge: 'forge', workbench: 'workbench', toilet: 'latrine', latrine: 'latrine', arena: 'arena', lab: 'lab', lamp: 'lamp' };
        const type = map[it.thing];
        if (!type) { out.say = `Build a ${it.thing}? I don't know how.`; break; }
        if (yesNo([`A ${it.thing}? Okay, we'll start.`, 'We can do that.'], ['We\'re not your construction crew.', 'No.'], { type: 'buildOrder', what: type })) out.build = type;
        break;
      }
      case 'makeLeader': if (yesNo(['Me? ...Alright. I\'ll lead.', 'Finally someone sees it.'], ['I don\'t want to be in charge.'], { type: 'wave' })) { g.society.leader = p; p.title = 'Leader'; g.feed(`You made ${p.name} the leader`, 'warm', p); } break;
      case 'escapeCmd': yesNo(['You want us to escape?! Okay!', 'Don\'t have to tell me twice!'], ['Is this a trick?', 'No... you\'ll just catch us again.'], { type: 'escape' }); break;
      default:
        // unknown: answer something in character, maybe repeating what they understood
        out.say = att === 'hostile' ? Y(['Whatever.', 'I don\'t care.', 'Leave me alone.', 'Are you done?']) : att === 'scared' ? Y(['I... I don\'t understand.', 'W-what?', 'Please, I don\'t know what you want.']) : att === 'worship' ? Y(['Your words are a mystery, Great one.', 'Yes, Great Giant!']) : Y(['Huh?', 'What do you mean?', 'Okay...?', 'I don\'t get it.', 'Sure.', 'Interesting.']);
    }
    if (!out.say) out.say = '...';
    out.say = flavor(p, out.say, out.kind === 'angry' ? 0.9 : 0.3);
    out.intent = it.type;
    return out;
  }
}

export { cusses, TRAITS };
