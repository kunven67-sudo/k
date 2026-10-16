// Things tiny people say on their own (to each other, to themselves, when scared...).
// Who they are changes how they say it. Some people cuss a lot, some never do.
import { rand } from '../core/util.js';

export function cusses(p) {
  if (p.has('polite') || p.kid || p.has('religious') && !p.has('hothead')) return 0;
  let c = 0.12;
  if (p.has('cusser')) c += 0.55;
  if (p.has('hothead')) c += 0.25;
  if (p.has('grumpy') || p.has('rebel') || p.has('cruel')) c += 0.15;
  if (p.job === 'soldier' || p.job === 'mechanic' || p.job === 'builder') c += 0.1;
  return Math.min(0.9, c);
}

const SWEAR_START = ['Damn,', 'Shit,', 'Hell,', 'Oh for fuck\'s sake,', 'Goddamn it,', 'Crap,'];
const SWEAR_MID = ['damn', 'freaking', 'goddamn', 'fucking', 'stupid'];
const SWEAR_END = ['damn it.', 'for real.', 'man.', 'holy shit.', 'what the hell.'];

// sprinkle swearing into a line if this person talks like that
export function flavor(p, line, heat = 0.5) {
  const c = cusses(p) * (0.4 + heat);
  if (rand() < c * 0.5) line = rand.pick(SWEAR_START) + ' ' + line[0].toLowerCase() + line.slice(1);
  else if (rand() < c * 0.35) line = line.replace(/\b(the|this|that|my|your) (\w+)/i, (m, a, b) => `${a} ${rand.pick(SWEAR_MID)} ${b}`);
  else if (rand() < c * 0.25) line = line.replace(/[.!?]$/, '') + ', ' + rand.pick(SWEAR_END);
  if (p.fear > 75 && rand() < 0.3) line = line.replace(/^(\w)/, '$1-$1'); // stutter when scared
  return line;
}

const pick = (a) => rand.pick(a);

export function chatter(p, topic, g, other = null, extra = null) {
  const giant = p.remembersPlayerAs || (p.faith > 60 ? 'the Great Giant' : 'the giant');
  const n = p.needs;
  const o = other ? other.name : '';
  let line;
  switch (topic) {
    case 'idle': {
      const pool = [];
      if (n.hunger < 40) pool.push('I\'m so hungry...', 'When do we eat?', 'I would kill for a burger right now.');
      if (n.thirst < 40) pool.push('I need water.', 'My throat is so dry.');
      if (n.energy < 30) pool.push('I\'m exhausted.', 'I need to sleep.');
      if (n.warmth < 40) pool.push('It\'s freezing in here.', 'I can\'t feel my fingers.');
      if (p.grief > 0.3) pool.push('I miss them so much.', 'It should have been me.');
      if (p.op < -40) pool.push(`I hate ${giant}.`, 'One day we\'ll get out of this box.', 'We\'re just animals in a zoo to that thing.');
      if (p.op > 40) pool.push(`${cap(giant)} takes care of us.`, 'Honestly it\'s not that bad here.');
      if (p.has('smart')) pool.push('The glass has to have a weak spot somewhere.', 'If we get metal we can make real tools.');
      if (p.has('funny')) pool.push('Day whatever in the fish tank. Still no WiFi.', 'Anyone else think the giant has bad breath?');
      if (p.has('religious')) pool.push('The light above is a sign.', 'Have faith.');
      if (p.job === 'chef') pool.push('If I had salt I could make this place a restaurant.');
      if (p.job === 'cop') pool.push('Somebody has to keep order around here.');
      if (p.job === 'programmer') pool.push('I had a deploy on Friday. They\'re probably wondering where I am.');
      if (p.job === 'office') pool.push('I don\'t even miss my job. That\'s how bad my job was.');
      pool.push('What day is it even?', 'I used to have a normal life.', 'Did anyone else hear that?', 'This place is so weird.', 'I wonder what\'s outside the glass.');
      line = pick(pool);
      break;
    }
    case 'chat': {
      const r = p.relOf(other);
      const pool = [];
      if (r.l > 50 && g.ai.compatible(p, other)) pool.push(`You look nice today, ${o}.`, `I'm glad you're here, ${o}.`, 'Stay close to me tonight.');
      if (r.f < -30) pool.push(`What do you want, ${o}?`, 'Don\'t talk to me.', 'You\'re getting on my nerves.');
      if (r.f > 40) pool.push(`${o}! There you are.`, 'You\'re the only one I trust in here.', 'Remember when we first got here?');
      pool.push('Did you see what the giant did?', 'I heard someone is building a shrine.', 'How did you end up here?', 'I was on my way to work when it happened.',
        'Do you think anyone is looking for us?', 'I think the giant is watching us right now.', 'We need more wood.', 'The food here sucks.',
        'If we work together we can survive this.', 'Some of these people are crazy.', 'Did you sleep at all?', 'I had a dream I was big again.');
      if (g.society.tribes.length && p.tribe != null) { const t = g.society.tribes.find((x) => x.id === p.tribe); if (t) pool.push(`The ${t.name} will run this place one day.`); }
      if (g.society.leader && g.society.leader !== p) pool.push(rand() < 0.5 ? `${g.society.leader.name} is a good leader.` : `I don't trust ${g.society.leader.name}.`);
      const dead = g.people.filter((q) => !q.alive && q.inCage);
      if (dead.length) pool.push(`I still think about ${pick(dead).name}.`);
      if (p.has('liar')) pool.push('I used to be a millionaire, you know.', 'I can talk to the giant. It listens to me.');
      line = pick(pool);
      break;
    }
    case 'flee': line = pick(['RUN!', 'Get away from me!', 'It\'s coming!', 'HIDE!', 'Oh no oh no oh no', 'Not again!', 'Somebody help!']); break;
    case 'giant': line = p.op > 40 ? pick(['Look! The giant is here!', 'Hi up there!', 'It\'s watching us again.']) : pick(['It\'s back...', 'Don\'t move. Maybe it won\'t see us.', 'What does it want now?', 'Everybody stay calm.']); break;
    case 'fightGiant': line = pick(['Take THIS!', 'Get your finger away from us!', 'You think you can just grab us?!', 'For everyone you killed!', 'Come on then, big guy!']); break;
    case 'fight': {
      const t = other ? other.name : 'you';
      line = pick([`I'm gonna end you, ${t}!`, `You had this coming, ${t}!`, 'Come here!', 'That\'s it!', `Stay down, ${t}!`]);
      break;
    }
    case 'hungry': line = pick(['There\'s no food anywhere...', 'We\'re going to starve in here.', 'Please... somebody feed us.']); break;
    case 'thirsty': line = pick(['There\'s no water!', 'I need water...']); break;
    case 'help': line = pick(['I\'m bleeding! Help!', 'Somebody help me, please!', 'I can\'t stop the bleeding!']); break;
    case 'heal': line = pick([`Hold still, ${o}. I got you.`, 'Press here. Hard.', 'You\'re gonna be okay. Breathe.', 'This is gonna sting.']); break;
    case 'grief': line = pick(['Why... why them?', 'I can\'t do this without you.', 'Rest easy.', 'It\'s not fair.']); break;
    case 'bury': line = pick([`Rest in peace, ${o}.`, 'You deserve better than this place.', 'I\'ll take care of you.']); break;
    case 'pray': line = p.faith > 70 ? pick([`Praise ${giant}!`, `${cap(giant)}, give us food and light.`, 'We are yours.', `Bless us, ${giant}.`]) : pick(['If anyone is listening... please.', 'Let us survive another day.']); break;
    case 'greet': line = pick([`Hey! It's you! ${cap(giant)}!`, 'You came down to visit us!', 'Welcome! Want to see what we built?']); break;
    case 'research': line = pick(['If I connect these... maybe.', 'I think I figured something out.', 'Give me time and I can build anything.']); break;
    case 'escape': line = pick(['We\'re getting out of here.', 'Help me break this glass!', 'This is our chance!', 'Freedom or nothing!']); break;
    case 'noResource': line = pick([`We're out of ${extra}.`, `Where are we supposed to find ${extra}?`, `We need ${extra} and there's none.`]); break;
    case 'flirt': line = pick([`So, ${o}... you wanna hang out later?`, `${o}, I really like you.`, 'You make this cage feel less like a cage.', 'Can I hold your hand?']); break;
    case 'reject': line = pick(['Uh... no. Sorry.', 'I don\'t see you like that.', 'Ew. No.', 'Not happening.', 'I have someone.']); break;
    default: line = '...';
  }
  return flavor(p, line, topic === 'fight' || topic === 'fightGiant' || topic === 'escape' ? 0.9 : 0.4);
}

export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
