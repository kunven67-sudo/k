// The built-in talking brain (no internet, no key). It reads what you typed, figures out what
// you mean (asking for money, asking to go out, saying hi, being rude...), and answers the way
// THIS person would: their personality, their mood, what they're doing, how much they like you,
// what you did before. Decisions always have causes (no coin flips): Dad says no to $20
// because you asked twice today, didn't do your chores, and he's strict.
//
//   think(npc, text, ctx) -> { say, mood?, opinion?, act?, anim? }
//   act: { type: 'money', amount } | { type: 'permit', key, hours } | { type: 'chore', id }
//        | { type: 'snack' } | { type: 'allowance' } | { type: 'end' }

import { clock } from '../core/clock.js';

const CUSS = /(\bf[\*#@]+[a-z\*]*|\bs[\*#@]+t\b|\*{3,})|\b(f+u+c+k+\w*|sh+i+t+\w*|bitch\w*|ass(hole)?|dick|damn|crap|bastard|stfu|wtf|piss\w*)\b/i;
const RUDE = /\b(stupid|dumb|idiot|ugly|loser|lame|annoying|hate you|shut up|fat|moron|trash|weirdo|suck)\b/i;
const NICE = /\b(you'?re|ur|you are|u r)\s+(so\s+|really\s+)?(nice|cool|awesome|the best|great|funny|smart|pretty|kind|amazing|sweet)\b|\blove you\b|\bbest (mom|dad|brother|sister|neighbou?r)\b/i;
const NSFW = /\b(sex|porn|naked|nude|boobs?|penis|vagina|horny|kiss me|make out|goon\w*)\b/i;

function seeded(n) {
  let x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function think(npc, text, ctx) {
  const raw = text.trim();
  const R = npc.rec;
  let t = raw.toLowerCase().replace(/[’`]/g, "'").replace(/\bplease\b|\bpls\b|\bplz\b/g, '').replace(/\s+/g, ' ').trim();
  // "hey mom, can I have $5?" -> the greeting + name don't matter, the question does.
  const names = ['mom', 'dad', 'mommy', 'daddy', 'mama', 'papa', 'ma', 'sir', "ma'am", 'mister', 'miss', R.name.toLowerCase(), (R.call || '').toLowerCase()].filter(Boolean);
  const g = t.match(/^(?:hi+|hey+|hello+|yo+|um+|uh+|so|okay|ok)\b[ ,!.]*(.*)$/);
  if (g && g[1]) {
    let rest = g[1];
    for (const nm of names) if (rest.startsWith(nm + ' ') || rest.startsWith(nm + ',')) rest = rest.slice(nm.length).replace(/^[ ,!.]+/, '');
    if (rest.split(' ').length >= 2) t = rest;
  }
  const T = R.traits;
  const mem = ctx.mem;
  const you = ctx.you;
  const rel = relation(R);
  const nick = petName(npc, ctx);
  let n = (mem.talks || 0) + t.length;
  const pick = (arr) => arr[Math.floor(seeded(n++) * arr.length) % arr.length];
  const warm = T.warmth > 0.55;
  const cold = T.warmth < 0.35;
  const out = (say, extra = {}) => ({ say, ...extra });
  const activity = npc.activity?.kind;

  // ---------------------------------------------------------------- state they're in
  if (activity === 'sleep') {
    if (rel === 'parent') return out(pick([`Mmh... ${nick}? It's the middle of the night. Go back to bed.`, "Whaa... what time is it? Go to sleep, honey.", "Ugh. Unless you're bleeding, it can wait till morning."]), { opinion: -1, mood: 'sleepy' });
    return out(pick(['Zzz... huh? Go away...', "I'm sleeping!"]), { opinion: -2 });
  }

  // ---------------------------------------------------------------- inappropriate
  if (NSFW.test(t)) {
    if (rel === 'parent') return out(pick([`Excuse me?! Where did you hear that? We're going to have a talk, ${you.name}.`, 'Hey. That is NOT okay to say. Go to your room and think about it.']), { opinion: -6, mood: 'angry', act: you.age < 18 ? { type: 'rule', rule: 'bad-language', severity: 0.6 } : null });
    return out(pick(['Uh... what? No. That\'s weird.', 'Okay, I\'m done talking to you.', 'What is wrong with you?']), { opinion: -10, mood: 'angry', act: { type: 'end' } });
  }

  // ---------------------------------------------------------------- rude / cussing
  const cussed = CUSS.test(t);
  if (cussed || RUDE.test(t)) {
    mem.insults = (mem.insults || 0) + 1;
    if (rel === 'parent') {
      if (cussed && you.age < 16)
        return out(pick([`Watch your mouth! Where did you learn that word?`, `Hey! We don't talk like that in this house, ${you.name}.`, `Say that again and you're grounded. I mean it.`]), { opinion: -5, mood: 'angry', act: { type: 'rule', rule: 'bad-language', severity: T.strictness > 0.6 ? 0.7 : 0.4 } });
      return out(pick([`Wow. Okay. That really hurt, ${you.name}.`, "Don't talk to me like that. I'm your parent.", `Go to your room. Now.`]), { opinion: -6, mood: 'sad', anim: 'shake' });
    }
    if (rel === 'staff') return out(pick(["Sir, I just work here.", "Okay, I don't get paid enough for this.", "I can get my manager if you want."]), { opinion: -6, mood: 'angry' });
    if (rel === 'kid' || rel === 'sibling') {
      if (T.swears > 0.5 && R.age >= 11) return out(pick(['Shut up, you\'re the loser.', 'Wow, real mature.', 'Whatever, crybaby.']), { opinion: -6, mood: 'angry' });
      return out(pick(["I'm telling!", 'That\'s mean!', 'You\'re mean. I\'m not playing with you.']), { opinion: -8, mood: 'sad', act: rel === 'sibling' ? { type: 'tattle', rule: 'bad-language' } : null });
    }
    if (mem.insults > 2) return out(pick(["I'm not doing this. Bye.", 'Get away from me, kid.', 'Go home. I mean it.']), { opinion: -8, mood: 'angry', act: { type: 'end' } });
    return out(pick([`Excuse me? Does your mother know you talk like that?`, "Whoa. Somebody's having a bad day.", "That's not very nice."]), { opinion: -7, mood: 'angry' });
  }

  // ---------------------------------------------------------------- nice
  if (NICE.test(t)) {
    if (rel === 'parent') return out(pick([`Aww, ${nick}. Love you too.`, 'Okay, what do you want? ...Kidding. Thank you, that made my day.', `You're sweet. Come here.`]), { opinion: 4, mood: 'happy', anim: 'laugh' });
    if (rel === 'staff') return out(pick(['Ha, thanks! Nobody ever says that.', "Aw, thank you. You're nice too.", 'Well that just made my shift better.']), { opinion: 5, mood: 'happy' });
    return out(pick(['Thanks! You\'re pretty cool too.', 'Aww. Thank you!', 'Ha, I know.']), { opinion: 4, mood: 'happy' });
  }

  // ---------------------------------------------------------------- greetings / goodbyes
  if (/^(hi+|hey+|hello+|yo+|sup|wass?up|what'?s up|howdy|hiya|good (morning|afternoon|evening))\b/.test(t)) {
    const first = !mem.met;
    if (rel === 'parent') {
      const h = clock.hour;
      return out(h < 10 ? pick([`Morning, ${nick}. Sleep okay?`, `Good morning, sunshine.`, `Hey ${nick}. You want some breakfast?`]) : h > 20 ? pick([`Hey ${nick}. Shouldn't you be getting ready for bed?`, `Hey you. Long day?`]) : pick([`Hey ${nick}. What's up?`, `Hi honey. You need something?`, `Hey, there you are.`]), { opinion: 0.5 });
    }
    if (rel === 'staff') return out(first ? pick([`Hi! Welcome to ${storeName(R.store)}. Let me know if you need anything.`, `Hey there. Finding everything okay?`]) : pick([`Hey, you again! What's up?`, `Hi again.`]));
    if (first) {
      if (rel === 'kid') return out(pick([`Hi. I'm ${R.name}. You live on this street?`, `Hey... I'm ${R.name}. Who are you?`, `Hi! I'm ${R.name}! Wanna play?`]), { opinion: 2, met: true });
      return out(pick([`Well hi there! I'm ${R.name}, I live at ${R.address || 'the house down the street'}. You must be the ${lastName(ctx)} kid.`, `Hey kiddo. ${R.name}. Nice to meet you.`, cold ? `Hi.` : `Oh, hello! I don't think we've met. I'm ${R.name}.`]), { opinion: 2, met: true });
    }
    return out(pick([`Hey ${you.name}!`, `Oh, hi ${you.name}.`, warm ? `Well look who it is! How you doing, ${you.name}?` : `Hey.`]), { opinion: 1 });
  }
  if (/\b(bye+|see (ya|you)|later|good ?night|gtg|gotta go|cya)\b/.test(t)) {
    if (rel === 'parent') return out(/night/.test(t) ? pick([`Night, ${nick}. Love you.`, 'Goodnight. Brush your teeth!', 'Night night. Don\'t let the bedbugs bite.']) : pick(['Okay. Be careful.', `Bye ${nick}.`, 'See you later, alligator.']), { act: { type: 'end' } });
    return out(pick(['Bye!', 'See ya.', `Later, ${you.name}.`, 'Take care now.']), { act: { type: 'end' } });
  }

  // ---------------------------------------------------------------- about them
  if (/what'?s your name|who are you|your name\??$/.test(t)) {
    if (rel === 'parent') return out(pick([`Very funny. It's ${R.call}. Or ${R.name}, if you're being weird.`, `...${R.call}? Are you feeling okay?`]), { anim: 'laugh' });
    return out(rel === 'staff' ? `I'm ${R.name}. It's on my name tag.` : `${R.name}. ${R.name} ${R.last}.`, { met: true });
  }
  const myName = t.match(/(?:my name is|call me|i'?m called)\s+([a-z][a-z'-]{1,15})/);
  if (myName) {
    const nm = cap(myName[1]);
    mem.facts.calls = nm;
    if (rel === 'parent') return out(nm.toLowerCase() === you.name.toLowerCase() ? `I know your name, ${nick}. I picked it.` : pick([`Okay, "${nm}". Whatever you say.`, `Is this a new phase? Fine. ${nm} it is.`]), { anim: 'laugh' });
    return out(pick([`Nice to meet you, ${nm}.`, `${nm}. Got it.`, `Cool name.`]), { met: true, opinion: 1 });
  }
  if (/how (are|r) (you|u)|how'?s it going|how you doing|you (good|ok|okay)\??/.test(t)) {
    const busy = activity === 'work' ? (R.role === 'staff' ? "Busy. It's been nonstop today." : 'Working, you know.') : activity === 'cook' ? "Good, just making food. Don't touch the stove." : null;
    if (busy) return out(busy);
    const m = npc.mood || 'neutral';
    if (m === 'sad') return out(pick(["Honestly? Kind of a rough day. But thanks for asking.", "I'm alright. Just tired."]), { opinion: 2 });
    return out(warm ? pick(["I'm good! Better now. How about you?", "Doing great, thanks for asking!", "Can't complain! You?"]) : pick(['Fine.', "I'm okay.", 'Same old.']), { opinion: 1 });
  }
  if (/how old (are|r) (you|u)/.test(t)) return out(rel === 'parent' ? pick([`Old enough to be your ${R.call.toLowerCase()}.`, `${R.age}. Don't remind me.`]) : R.age < 16 ? `I'm ${R.age}. How old are you?` : R.age > 60 ? `Old enough to remember when gas was a dollar.` : `That's a rude question! ...I'm ${R.age}.`);
  if (/what do you do|your job|where do you work|do you work/.test(t)) {
    if (R.job === 'retired') return out(pick(["I'm retired! I did 30 years at the plant. Now I garden and yell at squirrels.", 'Retired. Best job I ever had.']));
    if (R.job === 'school' || R.job === 'kindergarten') return out(R.age < 6 ? 'I go to kindergarten!' : 'I go to Maple Hollow Elementary. Same as everybody.');
    return out(pick([`I'm a ${R.job}.`, `I work as a ${R.job}. It pays the bills.`, `${cap(R.job)}. Don't ask, it's boring.`]));
  }
  if (/what are you doing|whatcha doing|wyd|what you doing/.test(t)) {
    const a = { cook: "Making food. You hungry?", tv: "Watching TV. Trying to relax.", sit: 'Just sitting. Resting my feet.', work: R.role === 'staff' ? 'Working. Some of us have jobs, kid.' : 'Working.', 'wander-store': 'Restocking. These shelves don\'t fill themselves.', play: 'Playing! Wanna play?', 'walk-park': 'Just taking my walk. Doctor says I need it.', 'walk-street': 'Taking a little walk.', stand: 'Nothing much.' }[activity];
    return out(a || 'Not much. You?');
  }

  // ---------------------------------------------------------------- practical questions
  if (/what time is it|what'?s the time/.test(t)) return out(`It's ${clock.timeText()}.`);
  if (/what day is it|what'?s today/.test(t)) return out(`It's ${clock.weekdayName}.`);
  if (/weather|is it (cold|hot|raining|snowing)/.test(t)) return out(weatherLine(ctx, pick));
  const where = t.match(/where(?:'s| is| are| can i (?:find|get|buy))\s+(?:the\s+|a\s+|an\s+|some\s+)?([a-z0-9' -]+?)\??$/);
  if (where) return out(directions(where[1], ctx, R, pick));

  // ---------------------------------------------------------------- family stuff
  if (rel === 'parent') {
    const p = parentDecisions(npc, t, ctx, pick, nick);
    if (p) return p;
  }
  if (rel === 'staff') {
    if (/\b(help|find|looking for|do you (have|sell))\b/.test(t)) return out(pick(['What are you looking for? Most stuff has signs above the aisles.', "If it's not on the shelf, we're probably out. Truck comes Thursday.", 'Check the end caps, sometimes stuff gets moved.']));
    if (/\b(discount|free|cheaper|deal)\b/.test(t)) return out(pick(["Ha, I wish. Prices are prices.", "I can't do that, sorry. I'd get fired.", 'Sales are on the yellow tags.']));
    if (/\b(job|hiring|work here)\b/.test(t)) return out(you.age < 16 ? "You gotta be 16 to work here. Come back in a few years!" : 'We\'re always hiring. Applications are online.');
  }
  if ((rel === 'kid' || rel === 'sibling') && /\b(play|wanna|want to|hang out|tag|hide and seek|game)\b/.test(t)) {
    if (npc.activity?.kind === 'play' || rel === 'sibling') return out(pick(["Okay! You're it!", 'Sure! But I pick the game.', 'Yeah! Let\'s go to the playground.']), { opinion: 3, mood: 'happy', act: { type: 'play' } });
    return out(pick(["I can't right now, I have to be home.", 'Maybe later? My mom says I gotta stay in.']));
  }
  if (/\b(sorry|my bad|apologi[sz]e)\b/.test(t)) {
    const was = mem.insults || 0;
    if (was > 0) {
      mem.insults = Math.max(0, was - 1);
      return out(T.patience > 0.4 ? pick(["It's okay. Thanks for saying sorry.", "Okay. Apology accepted.", "Alright. Just don't do it again."]) : pick(["Yeah, you should be.", "Hmph. We'll see."]), { opinion: T.patience > 0.4 ? 4 : 1 });
    }
    return out(pick(['Sorry for what?', "You didn't do anything!", 'Uh, okay?']));
  }
  if (/\b(thank|thanks|thx|ty)\b/.test(t)) return out(pick(["You're welcome!", 'No problem.', 'Anytime.', rel === 'parent' ? 'Of course, honey.' : 'Sure thing.']), { opinion: 1 });
  if (/joke|something funny|make me laugh/.test(t)) return out(pick(["Why don't eggs tell jokes? They'd crack each other up.", "What do you call a fake noodle? An impasta.", "I told my wife she was drawing her eyebrows too high. She looked surprised.", "Why did the scarecrow win an award? He was outstanding in his field."]), { anim: 'laugh', opinion: 1 });
  if (/\b(yes|yeah|yep|sure|ok|okay)\b/.test(t) && t.length < 12) return out(pick(['Okay then.', 'Alright.', 'Cool.']));
  if (/\b(no|nope|nah)\b/.test(t) && t.length < 10) return out(pick(['Okay.', 'Suit yourself.', 'Fine by me.']));
  if (/\?$/.test(raw)) return out(pick(["Hmm. I don't really know.", "That's a good question. No idea.", 'Why are you asking me?', "I'm not sure, kiddo."]));
  return out(T.talkative > 0.6 ? pick(["Huh. Interesting. Anyway, how's school going?", "Ha, okay. You're a funny kid.", "Mm-hm. Kids say the darnedest things."]) : pick(['Okay.', 'Uh-huh.', 'Hm.', 'Sure.']));
}

// ---------------------------------------------------------------- parents
function parentDecisions(npc, t, ctx, pick, nick) {
  const R = npc.rec;
  const T = R.traits;
  const you = ctx.you;
  const mem = ctx.mem;
  const out = (say, extra = {}) => ({ say, ...extra });
  const chores = ctx.chores;
  const wealthCap = { poor: 2, working: 5, middle: 10, rich: 25, veryrich: 60 }[ctx.wealth] ?? 10;
  // How willing they are right now (all real reasons, no dice).
  const asksToday = (mem.asks.day === clock.dayIndex ? mem.asks.n : 0) || 0;
  let mood = (mem.opinion - 50) / 100 + (T.warmth - 0.5) * 0.6 - (T.strictness - 0.5) * 0.6;
  if (chores) mood += chores.doneToday * 0.12 - chores.leftToday.length * 0.06 - Math.min(0.3, (chores.d.skipped || 0) * 0.05);
  mood -= asksToday * 0.18;
  if (you.grounded) mood -= 1;
  if (npc.mood === 'angry') mood -= 0.3;
  const asked = () => {
    if (mem.asks.day !== clock.dayIndex) mem.asks = { day: clock.dayIndex, n: 0 };
    mem.asks.n++;
  };

  // Allowance owed for chores.
  if (/allowance|money for (my )?chores|pay me|you owe me/.test(t)) {
    const owed = chores?.owed || 0;
    if (owed <= 0) return out(chores?.leftToday.length ? `For what? You haven't done your chores yet: ${listText(chores.leftToday)}. Then we'll talk.` : 'Allowance is on Sunday, and only if you do your chores.');
    if (T.strictness > 0.65 && clock.weekday !== 0) return out(`You'll get it Sunday, like always. You've earned $${owed.toFixed(2)} so far.`);
    return out(pick([`Fair's fair. Here's $${owed.toFixed(2)}.`, `You did your chores, so here. $${owed.toFixed(2)}. Don't spend it all on candy.`]), { act: { type: 'allowance' }, opinion: 0.5 });
  }

  // Money.
  const money = t.match(/\$\s?(\d+(?:\.\d{1,2})?)|(\d+)\s?(?:dollars?|bucks)/);
  if (money || /\b(money|cash|dollars?|bucks|can i have some|gimme some)\b/.test(t)) {
    const amount = money ? +(money[1] || money[2]) : Math.min(5, wealthCap);
    asked();
    const reason = /\b(lunch|food|school|book|field trip|lemonade|supplies|birthday|present|gift)\b/.test(t);
    const score = mood + (reason ? 0.25 : 0) - amount / wealthCap;
    if (you.grounded) return out(`You're grounded, remember? No.`);
    if (amount > wealthCap * 2.5) return out(pick([`$${amount}?! Do I look like an ATM? No way.`, `Ha! No. Money doesn't grow on trees, ${nick}.`, `For $${amount} you'd better be cleaning this whole house.`]), { opinion: -0.5 });
    if (asksToday >= 2) return out(pick(["You already asked me today. The answer is no.", "Again? No. Stop asking.", "What did I just say?"]), { opinion: -1, mood: 'angry' });
    if (score > 0.05) {
      const give = Math.min(amount, wealthCap);
      return out(give < amount ? `I can do $${give}, not $${amount}. Take it or leave it.` : pick([`Alright, here's $${give}. What's it for?`, `Fine. $${give}. And I want the change back.`, `Here you go. Don't lose it.`]), { act: { type: 'money', amount: give } });
    }
    if (score > -0.3 && chores) {
      const left = chores.leftToday;
      if (left.length) return out(`Do your chores first: ${listText(left)}. Then you'll get your allowance.`);
      const offer = ['dishes', 'trash', 'bed'].find((id) => !chores.today.some((c) => c.id === id) && id !== 'bed');
      if (offer) return out(`Tell you what: ${offer === 'dishes' ? 'wash the dishes' : 'take out the trash'} and I'll pay you for it.`, { act: { type: 'chore', id: offer } });
    }
    return out(pick([`Not today, ${nick}. Money's tight.`, 'No. You have your piggy bank.', 'Nope. Earn it.', T.strictness > 0.6 ? 'No. And don\'t ask again.' : "Sorry bud, not right now."]));
  }

  // Chores: asking what to do / offering help.
  if (/\b(chores?|can i help|need (any )?help|what should i do|anything i can do)\b/.test(t)) {
    if (!chores) return out('Just keep your room clean.');
    const left = chores.leftToday;
    if (left.length) return out(`Yes: ${listText(left)}. Thanks for asking!`, { opinion: 1 });
    const offer = !chores.today.some((c) => c.id === 'dishes') ? 'dishes' : !chores.today.some((c) => c.id === 'trash') ? 'trash' : null;
    if (offer) return out(`Well look at you! Sure: ${offer === 'dishes' ? 'you can wash the dishes' : 'take out the kitchen trash'}. I'll add it to your allowance.`, { act: { type: 'chore', id: offer }, opinion: 2 });
    return out("You've done everything today. I'm proud of you.", { opinion: 1, mood: 'happy' });
  }

  // Food.
  if (/\b(hungry|starving|snack|what'?s for dinner|when'?s dinner|what'?s for breakfast|food|make me)\b/.test(t)) {
    const h = clock.hourFloat;
    if (h > 16.5 && h < 18.4) return out(pick(["Dinner's in a bit. Don't spoil it.", 'Dinner at six-thirty. You can have an apple.']));
    if (h >= 18.4 && h < 19.5) return out('Dinner is on the table! Sit down.');
    if (npc.activity?.kind === 'cook') return out("I'm cooking right now, it'll be ready soon.");
    if (T.warmth > 0.45) return out(pick(['There\'s stuff in the fridge. Want me to make you a sandwich?', "Okay, okay. I'll make you a sandwich."]), { act: { type: 'snack' } });
    return out("You know where the fridge is.");
  }

  // Permissions: going out, the store, staying up, games, a cookie...
  const perm = t.match(/(?:can|could|may) i\s+(.+)|(?:am i allowed to|is it ok(?:ay)? if i)\s+(.+)|let me\s+(.+)/);
  if (perm) {
    const what = (perm[1] || perm[2] || perm[3] || '').replace(/[?.!]+$/, '');
    return permission(npc, what, mood, ctx, pick, nick);
  }
  if (/\b(grounded)\b/.test(t) && you.grounded) return out(`Because of what you did. ${you.groundedFor || ''} You're grounded until ${you.groundedUntil}.`);
  return null;
}

function permission(npc, what, mood, ctx, pick, nick) {
  const R = npc.rec;
  const T = R.traits;
  const you = ctx.you;
  const h = clock.hourFloat;
  const out = (say, extra = {}) => ({ say, ...extra });
  const dark = clock.isNight || h >= 20 || h < 6.5;
  const age = you.age;
  if (you.grounded && !/bathroom|toilet|pee|water|drink/.test(what)) return out(pick([`You're grounded. So no.`, `Grounded people don't get to ask that.`]));
  // Outside / park / friend's house.
  if (/\b(go|play)\b.*\b(out|outside|park|playground|friend|walk|bike|ride|yard|street)\b|\bgo out\b|\bplay outside\b/.test(what)) {
    if (dark) return out(age < 13 ? pick([`It's dark out. No way.`, `Not this late, ${nick}. Tomorrow.`]) : 'Be back in an hour. And take your phone.', age < 13 ? {} : { act: { type: 'permit', key: 'outside', hours: 1 } });
    if (ctx.badWeather) return out(pick(["In this weather? No, stay in.", "It's nasty out. Find something to do inside."]));
    if (clock.isSchoolDay && h < 15 && h > 7.5) return out('You should be at school right now!');
    const homework = ctx.homeworkLeft;
    if (homework && T.strictness > 0.55) return out('Homework first. Then you can go out.');
    if (T.style === 'overprotective' || R.style === 'overprotective') {
      if (/park|friend|street/.test(what) && age < 11) return out("Only in the yard where I can see you. Not the park, it's too far.", { act: { type: 'permit', key: 'yard', hours: 2 } });
    }
    const hours = h > 18 ? Math.max(0.5, 20 - h) : 2;
    if (mood > -0.45) return out(pick([`Sure. Be back by ${clockText(h + hours)}.`, `Okay! Stay on our street and don't talk to strangers.`, `Go for it. Back before ${clockText(h + hours)}.`]), { act: { type: 'permit', key: 'outside', hours } });
    return out(pick(['Not right now.', "No. You've been pushing it today."]));
  }
  // The store alone.
  if (/\b(store|walmort|best ?bye|ikeo|shop|plaza|buy)\b/.test(what)) {
    if (dark) return out("Not by yourself at night. Absolutely not.");
    if (age < 10 && T.strictness > 0.4) return out(`You're ${Math.floor(age)}. You're not crossing Elm by yourself.`);
    if (mood > -0.2) return out(pick([`Okay, but look both ways on Elm, and come straight back.`, `Fine. Use the crosswalk. And no candy for dinner.`]), { act: { type: 'permit', key: 'store', hours: 1.5 } });
    return out('No. Maybe this weekend I\'ll take you.');
  }
  // Staying up late.
  if (/\b(stay up|go to bed later|bedtime)\b/.test(what)) {
    if (clock.isSchoolDay && clock.weekday !== 5) return out(pick(["It's a school night. No.", `Nice try. Bed at ${age < 11 ? '8:30' : '9:30'}.`]));
    if (mood > -0.3) return out(pick(["It's the weekend... okay, one more hour.", 'Fine, but not too late.']), { act: { type: 'permit', key: 'stayup', hours: 1.5 } });
    return out('No. Bed.');
  }
  // Screens.
  if (/\b(video ?games?|play games|xbox|playstashun|ps5|switch|tv|watch|ipad|tablet|phone|computer|pc)\b/.test(what)) {
    if (T.strictness > 0.6 && ctx.homeworkLeft) return out('After your homework.');
    if (mood > -0.4) return out(pick(['Sure, one hour.', 'Okay, but not all day.', 'Go ahead.']), { act: { type: 'permit', key: 'screens', hours: 1 } });
    return out("You've had enough screen time.");
  }
  // Sweets.
  if (/\b(cookie|candy|ice cream|soda|pop|chips|dessert|sweet)\b/.test(what)) {
    const h2 = clock.hourFloat;
    if (h2 > 16.5 && h2 < 18.5) return out("Not before dinner.");
    if (mood > -0.3) return out(pick(['One. Just one.', 'Okay, a small one.', 'Fine.']), { act: { type: 'permit', key: 'sweets', hours: 0.5 } });
    return out("No more sugar for you today.");
  }
  if (/\b(sleepover|sleep over|have a friend over|friend over)\b/.test(what)) return out(R.style === 'fun' || mood > 0.1 ? "Maybe Friday. Ask me again then." : 'Not this week.');
  if (/\b(drive|the car)\b/.test(what)) return out(age < 16 ? `You're ${Math.floor(age)}. Ha. No.` : 'Do you even have your license? No.');
  if (/\b(beer|drink|alcohol|wine)\b/.test(what) && age < 21) return out(`Absolutely not! You're ${Math.floor(age)}!`, { opinion: -3 });
  if (/\b(pet|dog|cat|puppy|kitten|hamster)\b/.test(what)) return out(pick(['A pet is a lot of work. Who\'s going to walk it?', "We'll think about it. Show me you can keep your room clean first."]));
  if (/\b(bathroom|toilet|pee|water|drink of water)\b/.test(what)) return out("You don't have to ask for that, silly.");
  return out(mood > 0 ? pick(['Sure, I guess.', 'Okay.', "As long as you're careful."]) : pick(['No.', 'I don\'t think so.', 'Ask me later.']), mood > 0 ? { act: { type: 'permit', key: 'misc', hours: 1 } } : {});
}

// ---------------------------------------------------------------- helpers
export function relation(R) {
  if (R.family) return R.role === 'sibling' ? 'sibling' : 'parent';
  if (R.role === 'staff') return 'staff';
  if (R.age < 16) return 'kid';
  return 'adult';
}

function petName(npc, ctx) {
  const R = npc.rec;
  const you = ctx.you;
  if (R.role === 'sibling') return you.name;
  const T = R.traits;
  if (ctx.mem.facts.calls && ctx.mem.facts.calls !== you.name && T.humor > 0.5) return ctx.mem.facts.calls;
  const list = T.warmth > 0.65 ? (you.sex === 'f' ? ['sweetie', 'honey', 'kiddo'] : ['buddy', 'champ', 'kiddo']) : T.warmth > 0.4 ? ['kiddo', you.name] : [you.name];
  return list[(ctx.mem.talks || 0) % list.length];
}

function storeName(id) {
  return id === 'grocery' ? 'Walmort' : id === 'electronics' ? 'Best Bye' : 'IKEO';
}

function lastName(ctx) {
  return ctx.lastName || 'new';
}

/** "make your bed, wash the dishes and take out the trash" */
function listText(list) {
  const w = list.map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1));
  return w.length > 1 ? `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}` : w[0] || '';
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function clockText(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60 / 15) * 15;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}${mm % 60 ? ':' + String(mm % 60).padStart(2, '0') : ''}${hh < 12 ? ' AM' : ' PM'}`;
}

function weatherLine(ctx, pick) {
  const s = clock.season;
  if (ctx.weather?.rain > 0.3) return pick(["It's pouring. Take an umbrella.", 'Raining cats and dogs out there.']);
  if (s === 'winter') return pick(["Freezing. Wear your coat. And a hat!", "It's cold. They said more snow tonight."]);
  if (s === 'summer') return pick(["Hot. Drink some water if you go out.", "It's a scorcher today."]);
  if (s === 'fall') return pick(['Nice and crisp. Good hoodie weather.', 'Getting chilly. Leaves are everywhere.']);
  return pick(['Pretty nice out actually.', 'Spring weather. Could rain later.']);
}

function directions(thing, ctx, R, pick) {
  const x = thing.trim();
  if (/walmort|grocer|food|milk|snack|candy|soda/.test(x)) return 'Walmort is in the plaza on Elm Avenue. Go to the end of Maple, cross at the crosswalk, it\'s the big blue one.';
  if (/best ?bye|electronic|game|tv|phone|computer|graphics card|gpu/.test(x)) return 'Best Bye, in the plaza on Elm. Right next to Walmort.';
  if (/ikeo|furniture|couch|bed|desk/.test(x)) return "IKEO, the yellow and blue one at the end of the plaza on Elm.";
  if (/park|playground|swing/.test(x)) return 'The park is at the end of Maple, past the cul-de-sac. Can\'t miss it.';
  if (/school/.test(x)) return 'Maple Hollow Elementary is across the street, behind the fence.';
  if (/bathroom|restroom|toilet/.test(x)) return R.role === 'staff' ? 'Restrooms are in the back, past the coolers.' : 'Down the hall.';
  if (/remote/.test(x)) return pick(['Check the couch cushions.', "Wherever you left it, I bet."]);
  if (/(mom|dad|mother|father)/.test(x)) {
    const p = ctx.people?.parents.find((n) => new RegExp(n.rec.role).test(x));
    if (!p) return "I don't know.";
    if (p.away) return p.lastExit === 'driveway' ? `${p.rec.call} is at work.` : `${p.rec.call} went out.`;
    return `${p.rec.call}'s around here somewhere.`;
  }
  return pick(["Hmm, I'm not sure.", 'No idea, sorry.', 'Have you tried looking it up?']);
}
