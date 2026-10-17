
// ---------- talking: a small AI inside the game, with a built-in brain as backup ----------
const brain = { state: 'off', engine: null, progress: 0, text: '', busy: false, model: '' };
const BRAIN_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
async function loadBrain() {
  if (brain.state === 'loading' || brain.state === 'ready') return;
  brain.state = 'loading'; brain.text = 'Starting the village brain...'; talkUI.brainLine();
  try {
    if (!navigator.gpu) throw new Error('This browser has no WebGPU. Use Chrome or Edge.');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU graphics adapter found.');
    const f16 = adapter.features.has('shader-f16');
    brain.model = f16 ? 'Llama-3.2-1B-Instruct-q4f16_1-MLC' : 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
    const webllm = await import(BRAIN_URL);
    brain.engine = await webllm.CreateMLCEngine(brain.model, { initProgressCallback: (r) => { brain.progress = r.progress || 0; brain.text = r.text || ''; talkUI.brainLine(); } });
    brain.state = 'ready'; brain.text = 'Village brain ready.';
  } catch (e) {
    console.warn('brain failed', e);
    brain.state = 'failed'; brain.text = 'The AI brain could not start (' + (e.message || e) + '). People use the built-in brain.';
  }
  talkUI.brainLine();
}
const BANNED = /\b(sex|sexual|naked|nude|nudity|undress|breasts?|boobs?|tits?|nipples?|genitals?|penis|vagina|cock|dick|pussy|orgasm|moan(?:ing|s)?|lick(?:ing)? (?:your|my) body|bed with|sleep with|make love|horny|aroused|arousal|fuck(?:ing)? (?:you|me|her))\b/i;
function cleanLine(s, name) {
  s = (s || '').replace(/\[[^\]]*\]/g, '').replace(/^\s*["']|["']\s*$/g, '').replace(new RegExp('^\\s*' + name + '\\s*:\\s*', 'i'), '').replace(/\*[^*]{0,80}\*/g, (m) => m).trim();
  s = s.split('\n')[0];
  const sent = s.match(/[^.!?]+[.!?]*/g) || [s];
  s = sent.slice(0, 2).join(' ').trim();
  if (s.length > 230) s = s.slice(0, 227).replace(/\s+\S*$/, '') + '...';
  if (/as an ai|language model|assistant|i cannot assist/i.test(s)) return '';
  return s;
}
function relationText(st, p) {
  const bits = [];
  bits.push(st.opinion <= -60 ? 'You hate him.' : st.opinion <= -25 ? 'You dislike and distrust him.' : st.opinion < 10 ? 'You do not know him well and are a little wary.' : st.opinion < 40 ? 'You like him.' : 'You like and trust him a great deal.');
  if (st.fear > 50) bits.push('You are afraid of him.');
  if (p.romance) bits.push({ stranger: '', friend: 'You see him as a friend.', courting: 'You are courting him, it is still new and exciting.', lover: 'He is your lover and you love him.', ex: 'He used to be your lover, you broke up and it still stings.' }[st.stage] || '');
  if (p.romance && st.aff > 30 && st.stage !== 'ex') bits.push(st.aff > 70 ? 'You are deeply attracted to him.' : 'You find him attractive.');
  return bits.filter(Boolean).join(' ');
}
function situationText(f) {
  const h = hourNow(), bits = [];
  bits.push('It is ' + (h < 5 ? 'the middle of the night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'late at night') + ', day ' + vsave.day + '.');
  if (player.blood > 0.4) bits.push("He is covered in other men's blood.");
  if (drunk > 0.5) bits.push('He is drunk and smells of ale.');
  if (raid.active) bits.push('Knights are raiding the village right now!');
  if (stats.kills > 0) bits.push('People say he has killed ' + stats.kills + ' knights.');
  const dead = PERSONAS.filter(q => !vsave.people[q.id].alive).map(q => q.name);
  if (dead.length) bits.push('Dead villagers: ' + dead.join(', ') + '.');
  const others = PERSONAS.filter(q => q.romance && q !== f.vill.p && ['courting', 'lover'].includes(vsave.people[q.id].stage));
  if (others.length && f.vill.st.mem.some(m => /kiss|court/.test(m))) bits.push('You know he is also with ' + others.map(q => q.name).join(' and ') + '.');
  return bits.join(' ');
}
function systemPrompt(f, decision) {
  const p = f.vill.p, st = f.vill.st;
  return `You are ${p.name}, ${p.age}, ${p.title} in the medieval village of Ashford. You are a ${p.sex === 'f' ? 'woman' : 'man'}. Personality: ${p.desc}. You like: ${p.likes.join(', ')}. You dislike: ${p.dislikes.join(', ')}.
You are talking to a tall stranger in black scratched plate armor, a dark hood and a helmet with glowing red eye slits. He is a swordsman.
${relationText(st, p)}
Things you remember: ${st.mem.length ? st.mem.slice(-5).join('; ') : 'nothing yet, you just met him'}.
${situationText(f)}
${decision ? 'What you decided: ' + decision + ' Say it in your own words.' : ''}
Rules: stay in character as a real medieval villager. Answer in 1 or 2 short sentences of plain old-fashioned English. Never say you are an AI. Mild swearing is fine if it suits you. Romance stays sweet: flirting, holding hands, kissing and making out with clothes on at most. If he asks for anything sexual or more than that, refuse firmly and in character. Never describe sexual acts. At the very end add one tag for how his words made you feel: [+2], [+1], [0], [-1] or [-2].`;
}
async function aiLine(f, said, decision) {
  if (brain.state !== 'ready' || brain.busy) return null;
  brain.busy = true;
  try {
    const hist = (f.vill.hist || []).slice(-6);
    const msgs = [{ role: 'system', content: systemPrompt(f, decision) }, ...hist, { role: 'user', content: said }];
    const job = brain.engine.chat.completions.create({ messages: msgs, max_tokens: 80, temperature: 0.85, top_p: 0.9 });
    const r = await Promise.race([job, new Promise(res => setTimeout(() => res(null), 30000))]);
    const raw = r && r.choices && r.choices[0] && r.choices[0].message.content;
    if (!raw) return null;
    const tag = raw.match(/\[([+-]?\d)\]/);
    const line = cleanLine(raw, f.vill.p.name);
    if (!line || BANNED.test(line)) return null;
    return { line, mood: tag ? Math.max(-2, Math.min(2, +tag[1])) : 0 };
  } catch (e) { console.warn(e); return null; }
  finally { brain.busy = false; }
}

// ---------- the built-in brain: reads what you said, decides, answers in character ----------
const INTENTS = [
  ['explicit', BANNED],
  ['bye', /\b(bye|farewell|goodbye|good night|see you|later|i must go|gotta go)\b/i],
  ['breakup', /\b(it'?s over|break up|we'?re done|leave you|not love you|done with you)\b/i],
  ['makeout', /\b(make out|makeout|snog|hold me close|cuddle)\b/i],
  ['kiss', /\b(kiss|smooch)\b/i],
  ['love', /\b(i love you|love you|marry me|be my wife)\b/i],
  ['court', /\b(be my (girl|lady|woman|love|sweetheart)|court(ing)? you|go out with me|be mine|be together|walk out with me|a chance with you)\b/i],
  ['fight', /\b(fight (with|beside) me|join me|come with me|follow me|help me fight|fight together|watch my back)\b/i],
  ['dismiss', /\b(go home|stay here|wait here|leave me|you can go|stop following)\b/i],
  ['threat', /\b(kill you|cut you|gut you|i'?ll hurt|you'?ll die|i'?ll burn|threat)\b/i],
  ['insult', /\b(stupid|ugly|idiot|whore|bitch|fool|shut up|hate you|dumb|wench|cow|pig|peasant scum|worthless|fat)\b/i],
  ['flirt', /\b(beautiful|pretty|lovely|gorgeous|cute|your eyes|i like you|fancy you|handsome|sweet thing|stunning|you look nice|you'?re nice to look at|date)\b/i],
  ['sorry', /\b(sorry|apolog|forgive me|my fault)\b/i],
  ['thanks', /\b(thank|thanks|grateful)\b/i],
  ['greet', /\b(hi|hello|hail|good (morrow|morning|day|evening)|hey|greetings|howdy|yo)\b/i],
  ['howare', /\b(how are you|how fare|how do you do|how'?s it going|are you well|you ok)\b/i],
  ['name', /\b(who are you|your name|what are you called|what do you do)\b/i],
  ['me', /\b(who am i|what do you think of me|do you like me|do you trust me|am i)\b/i],
  ['trade', /\b(buy|sell|trade|wares|price|cost|shop|goods)\b/i],
  ['knights', /\b(knights?|camps?|raid|raiders|house|red|blue|green|gold|black|enemy|war|battle)\b/i],
  ['village', /\b(village|ashford|this place|where am i|town|people here|who lives)\b/i],
  ['drink', /\b(ale|drink|beer|mead|wine|drunk)\b/i],
  ['weather', /\b(weather|rain|sun|cold|warm|snow|storm)\b/i],
  ['news', /\b(news|rumou?r|gossip|heard|anything new|what'?s happening)\b/i],
];
function intentOf(text) { for (const [k, re] of INTENTS) if (re.test(text)) return k; return 'chat'; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function fill(s, f) {
  const p = f.vill.p;
  const other = PERSONAS.find(q => q.romance && q !== p && ['courting', 'lover'].includes(vsave.people[q.id].stage));
  return s.replace(/\{addr\}/g, p.addr).replace(/\{name\}/g, p.name).replace(/\{oath\}/g, p.oath).replace(/\{title\}/g, p.title).replace(/\{other\}/g, other ? other.name : 'another').replace(/\{kills\}/g, stats.kills);
}
function toneOf(st) { return st.fear > 60 || st.opinion <= -40 ? 'cold' : st.opinion < 10 ? 'wary' : st.opinion < 40 ? 'warm' : 'close'; }
const LINES = {
  greet: { cold: ['What do you want.', 'Keep walking, {addr}.', 'Stay back from me.'], wary: ['...Good day.', 'Aye? What is it?', '{oath} Can I help you?'], warm: ['Good morrow, {addr}!', 'Ah, it is you again.', 'Well met, {addr}.'], close: ['There you are! I was hoping you would come by.', 'Hello, you.', 'My favorite knight.'] },
  howare: { cold: ['Better when you are gone.'], wary: ['I am well enough.', 'Getting by. Like everyone.'], warm: ['Not bad at all, thank you for asking.', 'Busy, but well.'], close: ['Better now that you are here.', 'Good. Truly good.'] },
  thanks: { cold: ['Hmph.'], wary: ['Mm.', 'Aye.'], warm: ['Think nothing of it.', 'Any time.'], close: ['For you? Always.'] },
  sorry: { cold: ['Words cost nothing.', 'Sorry does not undo it.'], wary: ['...Fine. We will see.'], warm: ['It is forgotten.', 'Alright. I believe you.'], close: ['Come here, you fool. It is alright.'] },
  insult: { cold: ['Piss off.', 'Go to the devil.'], wary: ['How dare you.', 'Mind your tongue, {addr}.'], warm: ['That was cruel. Why would you say that?'], close: ['That... hurt. Truly.'] },
  threat: { cold: ['Then do it, butcher, and be damned.', 'Help! Edric!'], wary: ['Stay away from me!'], warm: ['You do not mean that. Do you?'], close: ['Is that what I am to you?'] },
  drink: { cold: ['Drink alone.'], wary: ['Godric sells ale at The Red Boar.'], warm: ['A mug at The Red Boar sounds fine.', "Godric's ale is cheap and strong. Mostly strong."], close: ['Buy me one and I will keep you company.'] },
  weather: { cold: ['Ask the sky.'], wary: ['Fair enough today.'], warm: ['The fields could use rain.', 'The sky looks mean over the battlefield again.'], close: ['Any weather is fine with you here.'] },
  village: { cold: ['It was quiet before you came.'], wary: ['Ashford. Farmers, a smith, an inn. Nothing worth stealing.'], warm: ['Ashford is small, but we look after each other. Wulf has the forge, Godric the inn, Agnes heals.', 'The Red Boar is the inn, the forge is Wulf\'s, the healer has the green cross.'], close: ['It is home. Maybe it could be yours too.'] },
  bye: { cold: ['Good riddance.'], wary: ['Farewell.'], warm: ['Fare you well, {addr}.', 'Safe roads.'], close: ['Come back to me soon.', 'Do not get yourself killed.'] },
  chat: { cold: ['I have nothing to say to you.', 'Leave me be.'], wary: ['Hm. If you say so.', 'I would not know about that.', 'Strange thing to say.'], warm: ['Ha, maybe so.', 'I suppose you are right.', 'That is one way to see it.', 'Hm, I had not thought of that.'], close: ['I could listen to you talk all day.', 'Ha! You always say the strangest things.', 'Tell me more.'] },
};
function newsLine(f) {
  const angry = Object.entries(vsave.anger).sort((a, b) => b[1] - a[1])[0];
  const dead = PERSONAS.filter(q => !vsave.people[q.id].alive);
  const opts = [];
  if (angry && angry[1] >= 2) opts.push(`They say the ${angry[0]} house is furious about the knights you killed. They will come for Ashford, mark me.`);
  if (dead.length) opts.push(`We buried ${dead[dead.length - 1].name}. The village is not the same.`);
  const couple = PERSONAS.find(q => q.romance && ['courting', 'lover'].includes(vsave.people[q.id].stage));
  if (couple && couple !== f.vill.p) opts.push(`Everyone is talking about you and ${couple.name}.`);
  if (stats.kills > 5) opts.push(`Folk say you have killed ${stats.kills} knights. Some call you a hero. Some call you a butcher.`);
  opts.push('Knights camp all around the fields. The houses fight each other and take it out on us.', 'Piers swears he saw a ghost knight on the battlefield. Piers also sees two of everything.', 'The castle lord stopped protecting us years ago. We pay for nothing.');
  return pick(opts);
}
// how a person reacts to being asked for something romantic
function decide(f, what) {
  const p = f.vill.p, st = f.vill.st;
  const watchers = witnesses(f.pos, 10, f).length;
  const partner = PERSONAS.find(q => q.romance && q !== p && ['courting', 'lover'].includes(vsave.people[q.id].stage));
  if (!p.romance || p.sex !== 'f') return { ok: false, line: pick(p.married ? ["I'm a married woman. Go on with you."] : p.sex === 'm' ? ['Ha! Not my type, knight.', 'I will pretend you did not say that.'] : ['Oh, I am far too old for that nonsense, {addr}.']) };
  if (p.married) return { ok: false, line: "I'm married, and happily." };
  if (st.fear > 50 || st.opinion < 0) return { ok: false, line: pick(['Stay away from me.', 'After what you have done? No.']) };
  if (player.blood > 0.55) return { ok: false, line: pick(["You are soaked in blood! Wash first, gods' sake.", 'Not while you are dripping with some poor man\'s blood.']) };
  if (drunk > 0.75) return { ok: false, line: pick(['You reek of ale. Ask me when you are sober.', 'You can barely stand. No.']) };
  if (what === 'court') {
    if (st.stage === 'courting' || st.stage === 'lover') return { ok: false, line: 'We are already together, silly.' };
    if (st.stage === 'ex' && st.aff < 55) return { ok: false, line: 'We tried that. You broke my heart once already.' };
    if (partner && st.mem.some(m => m.includes(partner.name))) return { ok: false, line: `And what about ${partner.name}? I know about her.` };
    if (st.aff >= 35 + (1 - (p.bold || 0.5)) * 10 && st.opinion >= 20) return { ok: true, line: pick(['...Yes. I would like that.', 'Ha! I thought you would never ask. Yes.', 'Alright, knight. Court me, then. Do not make me regret it.']) };
    return { ok: false, line: pick(['I hardly know you.', 'Slow down. Win me first.', 'Maybe one day. Not today.']) };
  }
  if (what === 'kiss') {
    if (!['courting', 'lover'].includes(st.stage)) return { ok: false, line: st.aff > 30 ? pick(['Ask me properly first. We are not courting.', 'Ha. Not so fast.']) : pick(['Excuse me?', 'Certainly not.']) };
    if (p.shy && watchers > 0) return { ok: false, line: 'Not here. People are watching...' };
    if (st.aff < 45) return { ok: false, line: 'Not yet. Be patient with me.' };
    return { ok: true };
  }
  if (what === 'makeout') {
    if (st.stage !== 'lover') return { ok: false, line: st.stage === 'courting' ? 'Steady. We have only just begun courting.' : 'What? No.' };
    if (watchers > 0) return { ok: false, line: pick(['Not in front of everyone!', 'Somewhere quieter, love.']) };
    if (st.aff < 70) return { ok: false, line: 'Not tonight. Just kiss me.' };
    return { ok: true };
  }
  if (what === 'love') {
    if (st.stage === 'lover') return { ok: true, line: pick(['And I love you. Gods help me.', 'I know. I love you too.']) };
    if (st.stage === 'courting' && st.aff >= 65) return { ok: true, promote: true, line: pick(['...I love you too. There, I said it.', 'I have wanted to hear that. I love you.']) };
    return { ok: false, line: st.stage === 'courting' ? 'That is a big word. Give it time.' : 'You barely know me!' };
  }
  return { ok: false };
}
function builtinReply(f, text, forced) {
  const p = f.vill.p, st = f.vill.st;
  const intent = forced || intentOf(text);
  const t = toneOf(st);
  let line = '', dOp = 0, dAff = 0, dFear = 0, action = null, decision = '';
  const L = (k) => fill(pick((LINES[k] && (LINES[k][t] || LINES[k].wary)) || LINES.chat[t]), f);
  // likes and dislikes in what you said
  const lower = text.toLowerCase();
  const liked = p.likes.filter(w => lower.includes(w)).length, disliked = p.dislikes.filter(w => lower.includes(w)).length;
  switch (intent) {
    case 'explicit':
      line = pick(p.sex === 'f' ? ['How dare you speak to me like that.', 'Filthy brute. Get away from me.', 'That is no way to talk to a woman. Shame on you.'] : ['Watch your mouth, knight.', 'Disgusting. Go cool your head in the river.']);
      dOp = -8; dAff = -12; decision = 'You refuse, offended.'; break;
    case 'greet': line = L('greet'); dOp = st.metDay === vsave.day ? 0 : 1; st.metDay = vsave.day; break;
    case 'howare': line = L('howare'); dOp = 1; break;
    case 'name': line = fill(`I am {name}, {title}.`, f) + (t === 'cold' ? '' : ' ' + fill(pick(['And you?', 'Who are you under all that iron?', 'You are the knight everyone talks about.']), f)); dOp = 1; break;
    case 'me': line = t === 'cold' ? 'I think you are a butcher.' : t === 'wary' ? 'I do not know you yet.' : st.stage === 'lover' ? 'I think you know exactly what I think of you.' : t === 'close' ? 'I like you. More than I should.' : 'You seem alright. For a man in that much steel.'; break;
    case 'thanks': line = L('thanks'); dOp = 1; break;
    case 'sorry': line = L('sorry'); dOp = st.opinion < 0 ? 3 : 0; dFear = -3; break;
    case 'insult': line = L('insult'); dOp = -7; dAff = -10; break;
    case 'threat': line = L('threat'); dOp = -12; dAff = -15; dFear = 18; break;
    case 'drink': line = L('drink'); if (p.likes.includes('ale')) dOp = 1; break;
    case 'weather': line = L('weather'); break;
    case 'village': line = L('village'); dOp = 1; break;
    case 'news': case 'knights': line = t === 'cold' ? 'Ask someone else.' : newsLine(f); break;
    case 'trade': line = p.shop ? (st.opinion <= -30 ? 'I will not sell to you.' : pick(['Have a look, then.', 'Coin first, then goods.', 'See anything you like?'])) : "I have nothing to sell. Try the stalls, the inn or Wulf's forge."; action = p.shop && st.opinion > -30 ? 'trade' : null; break;
    case 'flirt': {
      if (!p.romance) { line = p.sex === 'm' ? pick(['Ha! Flattery will not get you a discount.', 'Keep that for the ladies, knight.']) : 'Oh, stop it. I am old enough to be your mother.'; break; }
      const open = st.opinion >= 5 && st.fear < 40 && st.stage !== 'ex';
      if (!open) { line = pick(['Save your sweet words.', 'Is that supposed to work on me?']); dAff = -1; break; }
      const k = st.aff + (p.bold || 0.5) * 20;
      line = k > 60 ? pick(['Keep talking like that and I might believe you.', 'You are trouble, you know that?', 'Ha! And you are not so bad yourself.']) : k > 30 ? pick(['Flatterer.', 'Oh, you. Stop it.', '*laughs* Is that so?']) : pick(['Hm. Bold of you.', 'You do not waste time, do you?']);
      dAff = 3 + (p.bold || 0.5) * 2; dOp = 1; break;
    }
    case 'court': { const r = decide(f, 'court'); line = fill(r.line, f); if (r.ok) { action = 'court'; dAff = 5; } else dAff = -1; decision = r.ok ? 'You say yes, you will court him.' : 'You say no: ' + r.line; break; }
    case 'love': { const r = decide(f, 'love'); line = fill(r.line || 'Hm.', f); if (r.promote) action = 'lover'; dAff = r.ok ? 4 : -1; decision = r.ok ? 'You love him too and say so.' : 'You do not say it back: ' + (r.line || ''); break; }
    case 'kiss': { const r = decide(f, 'kiss'); if (r.ok) { action = 'kiss'; line = pick(['Come here, then.', '*smiles and steps closer*', 'I was waiting for that.']); } else { line = fill(r.line, f); dAff = -1; } decision = r.ok ? 'You say yes and lean in to kiss him.' : 'You refuse: ' + r.line; break; }
    case 'makeout': { const r = decide(f, 'makeout'); if (r.ok) { action = 'makeout'; line = pick(['*pulls you close* Come here.', 'Nobody is watching...', 'I thought you would never ask.']); } else { line = fill(r.line, f); } decision = r.ok ? 'You say yes and pull him close.' : 'You refuse: ' + r.line; break; }
    case 'breakup':
      if (['courting', 'lover'].includes(st.stage)) { action = 'breakup'; line = pick(['...What? After everything?', 'Fine. Go, then. Go!', 'You bastard. I trusted you.']); dAff = -40; dOp = -20; decision = 'He just broke up with you. You are hurt and angry.'; }
      else line = 'We were never together, you fool.';
      break;
    case 'fight': {
      if (!p.fighter) { line = pick(["I'm no fighter.", 'Me? I would only get in your way.']); break; }
      if (p.married) { line = 'My place is here with my family.'; break; }
      if (vsave.ally === p.id) { line = "I'm already with you."; break; }
      const ok = st.opinion >= 30 || ['courting', 'lover'].includes(st.stage);
      if (ok) { action = 'ally'; line = pick(p.id === 'maren' ? ['Finally, something fun. Lead on.', 'Try to keep up.'] : p.id === 'hedda' ? ['About time someone asked. Let me get my sword.', 'Ha! Let us go break some knights.'] : p.id === 'wulf' ? ['Hmph. For a while. My forge waits.'] : ['Aye. I will watch your back.']); }
      else line = pick(['I do not know you well enough to bleed for you.', 'Earn my trust first.']);
      decision = ok ? 'You agree to fight beside him.' : 'You refuse to fight beside him.'; break;
    }
    case 'dismiss':
      if (vsave.ally === p.id) { action = 'dismiss'; line = pick(['Alright. I will head back.', 'Call on me when you need a sword.']); }
      else line = 'I was not following you.';
      break;
    default:
      line = L('chat');
  }
  if (liked) { dOp += Math.min(2, liked); dAff += p.romance ? Math.min(4, liked * 2) : 0; if (['greet', 'howare', 'thanks', 'name'].includes(intent)) line += ' ' + pick(['And you like ' + p.likes.find(w => lower.includes(w)) + '? Now we are talking.', 'Ha, you know the way to my heart.']); if (intent === 'chat') line = pick(['Oh, now you are speaking my language.', 'Ha! You know about that?', 'Now that is something I care about.', 'You and I will get along.']); }
  if (disliked) { dOp -= Math.min(2, disliked); dAff -= Math.min(3, disliked * 2); if (intent === 'chat') line = pick(['I do not care for that.', 'Hm. Let us talk of something else.']); }
  // first words of the day: blood and ale get noticed
  if (st.lastLook !== vsave.day * 100 + Math.floor(hourNow())) {
    st.lastLook = vsave.day * 100 + Math.floor(hourNow());
    if (player.blood > 0.4) { line = pick(['Saints, you are covered in blood!', 'Is that... all blood?']) + ' ' + line; if (p.id === 'maren') dAff += 1; else if (p.warmth > 0.7 || p.id === 'agnes') dOp -= 1; }
    else if (drunk > 0.6) line = pick(['You smell like a brewery.', 'How much have you had?']) + ' ' + line;
  }
  return { intent, line, dOp, dAff, dFear, action, decision };
}
function applyFeelings(f, r, aiMood = 0) {
  const st = f.vill.st, p = f.vill.p;
  // people warm up slowly: each day only so much goodwill from talk alone
  if (st.gainDay !== vsave.day) { st.gainDay = vsave.day; st.gained = 0; }
  let up = Math.max(0, r.dOp + aiMood * 0.5), upA = Math.max(0, r.dAff + (p.romance ? aiMood : 0));
  const room = Math.max(0, 14 - st.gained);
  const scale = room / 14;
  up *= scale; upA *= scale; st.gained += up + upA * 0.5;
  st.opinion = clampO(st.opinion + up + Math.min(0, r.dOp + aiMood));
  if (p.romance && st.opinion > -10) st.aff = Math.max(0, Math.min(100, st.aff + upA + Math.min(0, r.dAff)));
  st.fear = Math.max(0, Math.min(100, st.fear + r.dFear));
  if (st.stage === 'stranger' && st.opinion >= 20) st.stage = 'friend';
  // courting that has gone sour ends
  if (['courting', 'lover'].includes(st.stage) && st.aff < 18) { st.stage = 'ex'; remember(st, 'I broke it off with the dark knight'); setTimeout(() => npcSay(f, pick(["We're finished. Don't come to me again.", 'I cannot do this anymore. It is over.'])), 1600); }
  vSave();
}

// ---------- romance: witnesses, jealousy, scenes ----------
function jealousy(o, what, saw) {
  const st = o.vill.st, p = o.vill.p;
  if (!['courting', 'lover'].includes(st.stage)) return;
  st.aff = Math.max(0, st.aff - (12 + 30 * (p.jealous || 0.5)));
  st.opinion = clampO(st.opinion - 10);
  remember(st, (saw ? 'saw' : 'heard about') + ' him ' + what);
  st.angry = what;
  if (st.aff < 20) { st.stage = 'ex'; remember(st, 'broke up with him over ' + what); }
  if (saw && !o.inside) { sfx.murmur(o.pos, 'You... how could you!', 1, true); ui.sub(p.name + ' saw you ' + what + '!', 3); }
  vSave();
}
function romanceWitnessed(f, what) {
  for (const q of PERSONAS) {
    if (!q.romance || q === f.vill.p) continue;
    const st = vsave.people[q.id], o = personFor(q.id);
    if (!st.alive || !['courting', 'lover'].includes(st.stage) || !o) continue;
    if (!o.inside && o.pos.distanceTo(f.pos) < 22) jealousy(o, what, true);
    else st.pending.push({ at: vsave.day * 24 + hourNow() + 1 + Math.random() * 3, text: what, jealous: true });
  }
  // the village gossips about who you court
  for (const w of witnesses(f.pos, 18, f)) if (Math.random() < 0.6) remember(w.vill.st, 'saw the dark knight ' + what);
}
let scene0 = null;
function startScene(f, kind) {
  closeTalkPanel();
  const P = player, v = f.vill;
  v.mode = 'scene'; cutscene = true;
  const dir = _vw.copy(f.pos).sub(P.pos).setY(0); if (dir.lengthSq() < 0.01) dir.set(Math.sin(P.facing), 0, Math.cos(P.facing)); dir.normalize();
  P.facing = Math.atan2(dir.x, dir.z); P.root.rotation.y = P.facing;
  P.vel.set(0, 0, 0); P.blocking = false; P.attack = null;
  f.pos.copy(P.pos).addScaledVector(dir, 0.85); f.pos.y = groundH(f.pos.x, f.pos.z);
  f.facing = P.facing + Math.PI; f.root.rotation.y = f.facing;
  P.noArms = true; f.noArms = true;
  if (P.swordMesh) P.swordMesh.visible = false;
  P.helmet(false);
  scene0 = { f, kind, dir: dir.clone(), t: 0, dur: kind === 'kiss' ? 5 : 12, side: Math.random() < 0.5 ? 1 : -1, smacks: 0 };
  romanceWitnessed(f, kind === 'kiss' ? 'kissing ' + v.p.name : 'making out with ' + v.p.name);
}
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(0, 1, 0), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _pl = new THREE.Vector3();
function leanBody(o, lean, tilt, look) {
  const q = o.root.quaternion;
  const right = _ax.set(-1, 0, 0).applyQuaternion(q);
  rotateBoneWorld(o.b.Spine1, right, -lean * 0.55);
  rotateBoneWorld(o.b.Spine2, right, -lean * 0.4);
  rotateBoneWorld(o.b.Head, right, -look);
  const fwd = _ax.set(0, 0, 1).applyQuaternion(q);
  rotateBoneWorld(o.b.Head, fwd, tilt);
}
function armTo(o, side, target, poleDir) {
  const up = side === 'L' ? o.b.LeftArm : o.b.RightArm, fo = side === 'L' ? o.b.LeftForeArm : o.b.RightForeArm, ha = side === 'L' ? o.b.LeftHand : o.b.RightHand;
  if (o.parts[side === 'L' ? 'luarm' : 'ruarm'].gone || o.parts[side === 'L' ? 'lfarm' : 'rfarm'].gone) return;
  solveArm(up, fo, ha, target, poleDir);
}
function updateScene(dt) {
  const s = scene0; if (!s) return;
  s.t += dt;
  const P = player, f = s.f, t = s.t, mk = s.kind === 'makeout';
  // she steps in close first, then they lean in; at the end they ease apart
  const appr = smooth(0, 1.2, t);
  f.pos.copy(P.pos).addScaledVector(s.dir, lerp(0.85, mk ? 0.46 : 0.52, appr)); f.pos.y = groundH(f.pos.x, f.pos.z);
  f.speed = (1 - appr) * 0.6;
  const w = smooth(0.7, 1.9, t) * (1 - smooth(s.dur - 1.3, s.dur, t));
  // heads tilt the same way (their own right) so they meet; making out they slowly trade sides,
  // part for a breath now and then and keep moving
  const sideNow = mk ? Math.tanh(Math.sin(t * 0.62 + 0.4) * 2.4) : s.side;
  const breath = mk ? Math.pow(Math.max(0, Math.sin(t * 0.85 - 1.2)), 10) : 0;
  const nod = mk ? Math.sin(t * 2.2) * 0.05 + Math.sin(t * 3.4 + 1) * 0.025 : Math.sin(t * 1.6) * 0.02;
  const lean = w * (1 - breath * 0.25);
  // he is taller: he bends down to her, she lifts her face and goes up on her toes
  leanBody(P, lean * 0.62, w * 0.3 * sideNow, w * (0.3 + nod));
  leanBody(f, lean * 0.22, w * 0.3 * sideNow, -w * (0.36 + nod * 0.8));
  f.root.position.y = groundH(f.pos.x, f.pos.z) + 0.05 * w;
  if (mk) { const sway = Math.sin(t * 0.9) * 0.05 * w; rotateBoneWorld(P.b.Spine1, _ay, sway); rotateBoneWorld(f.b.Spine1, _ay, -sway); }
  // arms: her hands go to his chest, then slide up round his neck; his hands hold her waist, then her back
  const up = mk ? smooth(1.3, 3.0, t) : smooth(1.0, 2.4, t) * 0.35;
  const aw = smooth(0.4, 1.6, t) * (1 - smooth(s.dur - 1.1, s.dur - 0.1, t));
  if (aw > 0.02) {
    const pq = P.root.quaternion, fq = f.root.quaternion;
    const pNeck = P.b.Neck.getWorldPosition(new THREE.Vector3()), fSpine = f.b.Spine1.getWorldPosition(new THREE.Vector3());
    for (const sd of ['L', 'R']) {
      const sgn = sd === 'L' ? 1 : -1;
      const chest = new THREE.Vector3(sgn * 0.1, -0.22, 0.07), nape = new THREE.Vector3(sgn * 0.08, 0.02, -0.07);
      const tgt = pNeck.clone().add(chest.lerp(nape, up).applyQuaternion(pq));
      if (mk) tgt.y += Math.sin(t * 0.8 + sgn) * 0.02;
      armTo(f, sd, tgt.lerp(f.b[sd === 'L' ? 'LeftHand' : 'RightHand'].getWorldPosition(new THREE.Vector3()), 1 - aw), _ax.set(sgn * 0.6, -1, -0.3).applyQuaternion(fq));
      // his hands slowly move over her back
      const roam = mk ? Math.sin(t * 0.55 + sgn * 1.3) * 0.07 : 0;
      const ht = fSpine.clone().add(_ax.set(sgn * 0.17, lerp(-0.12, 0.04, up) + roam, lerp(0.02, -0.12, up)).applyQuaternion(fq));
      armTo(P, sd, ht.lerp(P.b[sd === 'L' ? 'LeftHand' : 'RightHand'].getWorldPosition(new THREE.Vector3()), 1 - aw), _ax.set(sgn * 0.7, -1, -0.2).applyQuaternion(pq));
    }
  }
  if (w > 0.9 && breath < 0.3 && t > 1.9 + s.smacks * (mk ? 1.7 : 9)) { s.smacks++; sfx.kiss(); }
  // a slow side shot that drifts in closer
  const mid = P.pos.clone().lerp(f.pos, 0.5); mid.y += 1.52;
  const side = _ax.set(Math.cos(P.facing), 0, -Math.sin(P.facing));
  const orbit = Math.sin(t * 0.22) * 0.45, dist = lerp(2.0, 1.35, smooth(0, s.dur, t));
  sceneCam = { pos: mid.clone().addScaledVector(side, dist * Math.cos(orbit)).addScaledVector(_t1.set(Math.sin(P.facing), 0, Math.cos(P.facing)), dist * Math.sin(orbit) - 0.25).add(_t2.set(0, 0.06, 0)), look: mid };
  if (t >= s.dur) endScene();
}
function endScene() {
  const s = scene0; if (!s) return;
  scene0 = null; sceneCam = null; cutscene = false;
  const P = player, f = s.f, st = f.vill.st, p = f.vill.p;
  P.noArms = false; f.noArms = false;
  if (P.swordMesh) P.swordMesh.visible = true;
  P.helmet(true);
  f.vill.mode = 'life'; f.vill.goal = null; f.vill.wait = 3;
  st.aff = Math.min(100, st.aff + (s.kind === 'kiss' ? 4 : 6)); st.opinion = clampO(st.opinion + 2);
  st.kissedDay = vsave.day;
  remember(st, s.kind === 'kiss' ? 'kissed him' : 'made out with him');
  lovedT = 600;
  ui.message(s.kind === 'kiss' ? p.name.toUpperCase() + ' KISSED YOU' : 'LOVED', 1.8);
  ui.sub('Loved: stamina comes back faster for a while.', 3);
  vSave(); requestLock();
}

// ---------- the talk panel ----------
let talk = null;
function talkWho() { return talk && talk.f; }
const talkUI = {
  el: null,
  init() {
    this.el = document.getElementById('talk');
    document.getElementById('talkSend').onclick = () => this.send();
    document.getElementById('talkIn').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.send(); if (e.key === 'Escape') endTalk(); });
    document.getElementById('talkIn').addEventListener('keyup', (e) => e.stopPropagation());
  },
  header() {
    if (!talk) return;
    const f = talk.f, p = f.vill.p, st = f.vill.st;
    document.getElementById('talkName').textContent = p.name;
    document.getElementById('talkTitle').textContent = p.title + ', ' + p.age;
    const op = st.fear > 60 ? 'Afraid of you' : st.opinion <= -60 ? 'Hates you' : st.opinion <= -25 ? 'Dislikes you' : st.opinion < 10 ? 'Wary of you' : st.opinion < 40 ? 'Likes you' : 'Trusts you';
    const rom = p.romance ? ' | ' + ({ stranger: 'Stranger', friend: 'Friend', courting: 'Courting you', lover: 'Your lover', ex: 'Your ex' }[st.stage]) + ' | Heart ' + Math.round(st.aff) + '/100' : '';
    document.getElementById('talkRel').textContent = op + ' (' + Math.round(st.opinion) + ')' + rom;
    this.buttons();
  },
  buttons() {
    const f = talk.f, p = f.vill.p, st = f.vill.st, box = document.getElementById('talkBtns');
    const b = [['Greet', () => say('Good day to you.', 'greet')], ['Ask about news', () => say('Any news around here?', 'news')]];
    if (p.shop) b.push(['Trade', () => openShop(f)]);
    if (Object.keys(vsave.items).some(k => ITEMS[k].gift)) b.push(['Give a gift', () => this.gifts()]);
    if (p.romance && st.stage !== 'lover') b.push(['Flirt', () => say(pick(['You look lovely today.', 'I could not stop thinking about you.', 'Your smile could stop a war.']), 'flirt')]);
    if (p.romance && ['friend', 'ex', 'stranger'].includes(st.stage)) b.push(['Ask to court her', () => say('Would you let me court you?', 'court')]);
    if (p.romance && ['courting', 'lover'].includes(st.stage)) b.push(['Kiss', () => say('*leans in for a kiss*', 'kiss')]);
    if (p.romance && st.stage === 'courting') b.push(['Say "I love you"', () => say('I love you.', 'love')]);
    if (p.romance && st.stage === 'lover') b.push(['Make out', () => say('*pulls you close*', 'makeout')]);
    if (p.fighter && vsave.ally !== p.id) b.push(['Fight with me', () => say('Will you fight beside me?', 'fight')]);
    if (vsave.ally === p.id) b.push(['Go home', () => say('Go home and rest. I will manage.', 'dismiss')]);
    if (p.romance && ['courting', 'lover'].includes(st.stage)) b.push(['Break up', () => say("I'm sorry. It's over between us.", 'breakup')]);
    b.push(['Goodbye', () => { say('Farewell.', 'bye'); setTimeout(endTalk, 900); }]);
    box.innerHTML = '';
    for (const [t, fn] of b) { const el = document.createElement('button'); el.className = 'chip'; el.textContent = t; el.onclick = fn; box.appendChild(el); }
  },
  gifts() {
    const box = document.getElementById('talkBtns'); box.innerHTML = '';
    for (const id of Object.keys(vsave.items)) {
      if (!ITEMS[id].gift) continue;
      const el = document.createElement('button'); el.className = 'chip'; el.textContent = ITEMS[id].name + ' x' + vsave.items[id];
      el.onclick = () => giveGift(talk.f, id); box.appendChild(el);
    }
    const back = document.createElement('button'); back.className = 'chip ghost'; back.textContent = 'Back'; back.onclick = () => this.buttons(); box.appendChild(back);
  },
  log(who, text, cls) {
    const box = document.getElementById('talkLog');
    const d = document.createElement('div'); d.className = 'line ' + (cls || '');
    d.innerHTML = '<b></b> <span></span>'; d.children[0].textContent = who + ':'; d.children[1].textContent = text;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
    while (box.children.length > 40) box.removeChild(box.firstChild);
    return d;
  },
  send() {
    const inp = document.getElementById('talkIn'), t = inp.value.trim();
    if (!t || !talk) return;
    inp.value = '';
    say(t);
  },
  brainLine() {
    const el = document.getElementById('brainLine'); if (!el) return;
    const opt = document.getElementById('brainAsk');
    if (settings.brain !== 'ai') { el.textContent = 'Built-in brain (switch to the AI brain in Settings)'; opt.style.display = 'none'; return; }
    if (brain.state === 'off') { el.textContent = ''; opt.style.display = settings.brainAsked ? 'none' : 'block'; if (settings.brainAsked) loadBrain(); return; }
    opt.style.display = 'none';
    el.textContent = brain.state === 'loading' ? brain.text.replace(/\[.*?\]/g, '').slice(0, 120) + ' (' + Math.round(brain.progress * 100) + '%) - people use the built-in brain until it is ready' : brain.text;
  },
};
function openTalk(f) {
  talk = { f };
  f.vill.mode = 'talk'; f.vill.hist = f.vill.hist || [];
  uiOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
  talkUI.el.style.display = 'flex';
  document.getElementById('talkLog').innerHTML = '';
  talkUI.header(); talkUI.brainLine();
  for (const h of f.vill.hist.slice(-4)) talkUI.log(h.role === 'user' ? 'You' : f.vill.p.name, h.content, h.role === 'user' ? 'me' : '');
  const st = f.vill.st;
  // a jealous lover confronts you first
  if (st.angry) { npcSay(f, pick([`I know about you ${st.angry}. Do not lie to me.`, `${st.angry}? Really? In front of the whole village?`])); st.angry = null; vSave(); }
  else npcSay(f, builtinReply(f, '', 'greet').line);
  setTimeout(() => { const i = document.getElementById('talkIn'); if (i) i.focus(); }, 50);
}
function closeTalkPanel() { if (talkUI.el) talkUI.el.style.display = 'none'; uiOpen = shopOpen; talk = null; }
function endTalk() {
  if (!talk) return;
  const f = talk.f;
  if (f.vill.mode === 'talk') { f.vill.mode = 'life'; f.vill.wait = 2; }
  closeTalkPanel();
  if (!cutscene && !shopOpen) requestLock();
}
function npcSay(f, line) {
  if (!line) return;
  const p = f.vill.p;
  if (talk && talk.f === f) talkUI.log(p.name, line);
  else ui.sub(p.name + ': ' + line, 4);
  f.vill.hist = f.vill.hist || [];
  f.vill.hist.push({ role: 'assistant', content: line }); if (f.vill.hist.length > 12) f.vill.hist.shift();
  sfx.murmur(f.pos, line.replace(/\*[^*]*\*/g, ''), f.vill.p.pitch, p.sex === 'f');
}
async function say(text, forced) {
  if (!talk) return;
  const f = talk.f;
  talkUI.log('You', text, 'me');
  f.vill.hist.push({ role: 'user', content: text }); if (f.vill.hist.length > 12) f.vill.hist.shift();
  const r = builtinReply(f, text, forced);
  let line = r.line, mood = 0;
  // the AI words it; the game still decides what actually happens
  if (brain.state === 'ready' && settings.brain === 'ai' && r.intent !== 'explicit' && r.intent !== 'trade') {
    const typing = talkUI.log(f.vill.p.name, '...', 'typing');
    const out = await aiLine(f, text, r.decision);
    typing.remove();
    if (talk && talk.f === f && out) { line = out.line; mood = r.action || r.decision ? 0 : out.mood; }
  }
  if (!talk || talk.f !== f) return;
  applyFeelings(f, r, mood);
  npcSay(f, line);
  doAction(f, r.action);
  if (talk) talkUI.header();
}
function doAction(f, a) {
  if (!a) return;
  const st = f.vill.st, p = f.vill.p;
  if (a === 'trade') setTimeout(() => openShop(f), 500);
  if (a === 'court') { st.stage = 'courting'; remember(st, 'agreed to let the dark knight court me'); romanceWitnessed(f, 'courting ' + p.name); ui.message('COURTING ' + p.name.toUpperCase(), 2); }
  if (a === 'lover') { st.stage = 'lover'; remember(st, 'told him I love him'); ui.message(p.name.toUpperCase() + ' LOVES YOU', 2); }
  if (a === 'breakup') { st.stage = 'ex'; remember(st, 'he broke up with me'); spreadWord(f, 'that the dark knight left ' + p.name, -2, 0, 1); setTimeout(endTalk, 1500); }
  if (a === 'kiss' || a === 'makeout') setTimeout(() => { if (f.alive && f.vill.mode === 'talk') startScene(f, a); }, 900);
  if (a === 'ally') setTimeout(() => { endTalk(); vsave.ally = p.id; toFight(f, { follow: true }); vSave(); ui.sub(p.name + ' fights beside you now. Talk to her or him again to send them home.', 3.5); }, 800);
  if (a === 'dismiss') { vsave.ally = null; toLife(f); vSave(); setTimeout(endTalk, 900); }
  vSave();
}
function giveGift(f, id) {
  const p = f.vill.p, st = f.vill.st;
  addItem(id, -1);
  const v = p.gifts ? (p.gifts[id] ?? 0) : (id === 'honeycake' ? 1 : 0);
  const name = ITEMS[id].name.toLowerCase();
  talkUI.log('You', '*gives ' + p.name + ' the ' + name + '*', 'me');
  const line = v >= 3 ? pick([`Oh! The ${name}... it is perfect.`, `For me? Truly? Thank you!`]) : v >= 1 ? pick([`That is kind of you. Thank you.`, `A ${name}? You remembered.`]) : v === 0 ? pick(['Oh. Thank you, I suppose.', 'Hm. Well, it is the thought.']) : pick([`What am I meant to do with a ${name}?`, `...You do not know me at all, do you?`]);
  applyFeelings(f, { dOp: 1 + Math.max(0, v), dAff: p.romance ? v * 3 + 1 : 0, dFear: -2 }, 0);
  npcSay(f, line);
  remember(st, 'he gave me a ' + name);
  talkUI.header();
}

// ---------- shops ----------
let shopOpen = false, shopWho = null;
const haggles = {};
const SWORD_PRICE = { arming: 24, falchion: 72, katana: 216, longsword: 168, claymore: 360, zwei: 480 };
function priceFor(f, base) { const op = f.vill.st.opinion; return Math.max(1, Math.round(base * (1 - op * 0.0018) * (raid.active ? 1.3 : 1))); }
function shopRows(f) {
  const kind = f.vill.p.shop, P = player, rows = [];
  const buy = (key, label, base, sub, fn, can = true) => rows.push({ key, label, base, sub, fn, can });
  if (kind === 'smith') {
    for (const s of SWORDS) if (!vsave.owned.includes(s.id)) buy('sw_' + s.id, s.name, SWORD_PRICE[s.id], s.sub + ' | dmg ' + s.dmg + ', ' + s.weight + ' kg', () => { vsave.owned.push(s.id); ui.weaponCard(); ui.sub('Bought the ' + s.name + '. Press X to switch swords.', 3); });
    const dmg = Math.round(100 - P.armorHp);
    if (dmg > 0) buy('repair', 'Repair your armor', Math.max(4, Math.round(dmg * 1.2)), 'Hammer out the dents (' + Math.round(P.armorHp) + '% now)', () => { P.armorHp = 100; });
    if (vsave.armorLvl < 3) buy('armor', 'Thicker plates (level ' + (vsave.armorLvl + 1) + ')', [120, 300, 600][vsave.armorLvl], 'Takes the edge off every hit, forever', () => { vsave.armorLvl++; });
    if (vsave.edge < 3) buy('edge', 'Sharpen and temper your blades (level ' + (vsave.edge + 1) + ')', [40, 90, 180][vsave.edge], '+5% damage with every sword, forever', () => { vsave.edge++; });
    vsave.goods.forEach((g, i) => rows.push({ key: 'sell_' + i + g.name, label: 'Sell: ' + g.name, base: Math.round(g.value * 0.55), sub: 'Loot from a dead knight', sell: true, fn: () => { vsave.goods.splice(i, 1); } }));
  }
  if (kind === 'tavern') {
    buy('bread', 'Bread', 3, '+10 health, take it with you', () => addItem('bread'));
    buy('stew', 'Bowl of stew', 8, '+25 health, take it with you', () => addItem('stew'));
    buy('ale', 'Mug of ale', 4, 'Drink it now. Too many and you pass out.', () => { drinkAle(0.28); sfx.ui(300); });
    buy('mead', 'Cup of mead', 6, 'Sweet and strong. Drink it now.', () => { drinkAle(0.4); sfx.ui(300); });
    buy('room', 'A room for the night', 12, 'Sleep until morning, wake up healed', () => setTimeout(sleepAtInn, 200), hourNow() >= 18 || hourNow() < 6);
  }
  if (kind === 'healer') {
    buy('bandage', 'Linen bandage', 6, 'Stops bleeding (B)', () => { bandages++; });
    buy('draught', 'Healing draught', 15, '+50 health and stops bleeding (H)', () => addItem('draught'));
    let missing = 0; for (const k in P.parts) if (!P.parts[k].gone) missing += P.parts[k].max - P.parts[k].hp;
    if (missing > 3 || P.hp < P.maxHp) buy('mend', 'Stitch and set your wounds', Math.max(10, Math.round(missing * 0.4 + (P.maxHp - P.hp) * 0.3)), 'Heals every wound. No one can grow back a lost limb.', () => { for (const k in P.parts) if (!P.parts[k].gone) P.parts[k].hp = P.parts[k].max; P.hp = P.maxHp; P.bleed = 0; });
  }
  if (kind === 'gifts') {
    buy('ribbon', 'Silk ribbon', 5, 'A gift', () => addItem('ribbon'));
    buy('comb', 'Carved comb', 8, 'A gift', () => addItem('comb'));
    buy('perfume', 'Rose perfume', 14, 'A gift', () => addItem('perfume'));
    buy('ring', 'Silver ring', 36, 'A serious gift', () => addItem('ring'));
  }
  if (kind === 'bakery') {
    buy('bread', 'Bread', 2, '+10 health', () => addItem('bread'));
    buy('honeycake', 'Honey cake', 4, '+6 health, or a sweet gift', () => addItem('honeycake'));
    buy('flowers', 'Wildflowers', 2, 'Picked this morning. A gift.', () => addItem('flowers'));
  }
  return rows;
}
function openShop(f) {
  if (f.vill.st.opinion <= -30) { npcSay(f, pick(['I will not sell to you. Get out.', 'Your coin is no good here, butcher.'])); return; }
  shopOpen = true; shopWho = f; uiOpen = true;
  if (talkUI.el) talkUI.el.style.display = 'none';
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('shop').style.display = 'flex';
  renderShop();
}
function closeShop() {
  if (!shopOpen) return;
  shopOpen = false; document.getElementById('shop').style.display = 'none';
  if (talk && talk.f === shopWho && shopWho.alive) { talkUI.el.style.display = 'flex'; talkUI.header(); uiOpen = true; }
  else { uiOpen = !!talk; if (!uiOpen && !cutscene) requestLock(); }
}
function renderShop() {
  const f = shopWho, p = f.vill.p;
  document.getElementById('shopName').textContent = p.name + ', ' + p.title;
  document.getElementById('shopPurse').textContent = 'Your purse: ' + money(vsave.coins) + (Object.keys(vsave.items).length ? ' | Carrying: ' + Object.entries(vsave.items).map(([k, n]) => ITEMS[k].name + ' x' + n).join(', ') : '');
  const box = document.getElementById('shopRows'); box.innerHTML = '';
  for (const r of shopRows(f)) {
    const hk = p.id + r.key + vsave.day, hg = haggles[hk];
    let price = r.sell ? Math.round(r.base * (1 + f.vill.st.opinion * 0.001)) : priceFor(f, r.base);
    if (hg) price = Math.round(price * hg.mult);
    const row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = '<div><b></b><small></small></div><em></em><button class="chip"></button><button class="chip ghost">Haggle</button>';
    row.querySelector('b').textContent = r.label; row.querySelector('small').textContent = r.sub; row.querySelector('em').textContent = money(price);
    const bb = row.children[2], hb = row.children[3];
    bb.textContent = r.sell ? 'Sell' : 'Buy';
    bb.disabled = !r.can || (!r.sell && vsave.coins < price);
    if (!r.can) bb.title = 'Rooms are only rented in the evening';
    bb.onclick = () => {
      if (r.sell) addCoins(price); else { if (vsave.coins < price) return; addCoins(-price); }
      sfx.coins(); r.fn(); vSave();
      if (!r.sell) f.vill.st.opinion = clampO(f.vill.st.opinion + 0.5);
      renderShop();
    };
    hb.disabled = !!hg;
    hb.onclick = () => {
      // haggling: how much they like you and how stubborn they are
      const chance = 0.32 + f.vill.st.opinion / 220 + (p.id === 'rosalind' ? -0.12 : 0) + (p.id === 'piers' ? 0.2 : 0);
      const win = Math.random() < chance;
      haggles[hk] = { mult: r.sell ? (win ? 1.2 : 0.95) : (win ? 0.8 : 1.1) };
      npcSay(f, win ? pick(['Fine, fine. You drive a hard bargain.', 'Alright, for you. Do not tell anyone.', 'Ugh. Deal.']) : pick(['No. That is my price. Now it is higher for wasting my time.', 'Do I look like a fool? No.', 'Haggle with someone else.']));
      if (!talk || talk.f !== f) ui.sub(p.name + ': ' + (win ? 'Deal.' : 'No.'), 2);
      if (!win) f.vill.st.opinion = clampO(f.vill.st.opinion - 1);
      renderShop();
    };
    box.appendChild(row);
  }
  if (!box.children.length) box.innerHTML = '<div class="srow"><div><b>Nothing for you right now.</b></div></div>';
}
function initTalk() {
  talkUI.init();
  document.getElementById('shopBack').onclick = () => closeShop();
  document.getElementById('brainYes').onclick = () => { settings.brainAsked = 1; settings.brain = 'ai'; saveSettings(); loadBrain(); talkUI.brainLine(); };
  document.getElementById('brainNo').onclick = () => { settings.brainAsked = 1; settings.brain = 'builtin'; saveSettings(); talkUI.brainLine(); const s = document.getElementById('sBrain'); if (s) s.value = 'builtin'; };
  if (settings.brain === 'ai' && settings.brainAsked) setTimeout(loadBrain, 4000);
}
