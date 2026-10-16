// Optional smarter brains, picked in Settings:
//  - 'claude': the player's own Claude API key (calls Anthropic from the browser with the official SDK)
//  - 'local' : a free model that downloads once and runs on the GPU (WebLLM)
// Both return the same thing as the built-in brain: { say, kind, order } - and both fall back to the
// built-in brain if anything goes wrong, so talking never breaks.
import Anthropic from '@anthropic-ai/sdk';
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { settings } from '../core/settings.js';
import { TRAITS } from '../life/looks.js';

export const CLAUDE_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (smartest)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (cheaper)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest, fastest)'],
];

// what the model is allowed to make the person do (the same orders the built-in brain uses)
const ACTIONS = ['none', 'follow', 'come', 'stop', 'go_away', 'sit', 'dance', 'wave', 'hide', 'sleep', 'eat', 'pray', 'drop_item', 'give_item', 'take_item', 'attack', 'kill', 'protect_player', 'gather_wood', 'gather_stone', 'gather_food', 'build', 'escape', 'kiss', 'befriend'];

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string', description: 'What the person says out loud. One to three short sentences, in character.' },
    mood: { type: 'string', enum: ['neutral', 'happy', 'angry', 'scared', 'sad', 'love'] },
    action: { type: 'string', enum: ACTIONS, description: 'What they actually do. "none" if they refuse or nothing was asked.' },
    target: { type: 'string', description: 'First name of the person the action is about, or empty.' },
    build: { type: 'string', description: 'For action build: campfire, hut, house, farm, well, wall, tower, statue, shrine, jail, market, hospital, forge, workbench, latrine. Else empty.' },
    opinion_change: { type: 'integer', description: 'How much their opinion of the giant changes from -10 to 10.' },
  },
  required: ['say', 'mood', 'action', 'target', 'build', 'opinion_change'],
  additionalProperties: false,
};

let client = null, clientKey = '';
function getClient() {
  if (!settings.claudeKey) return null;
  if (!client || clientKey !== settings.claudeKey) {
    // The key belongs to the player and stays in their own browser (it's only sent to Anthropic).
    client = new Anthropic({ apiKey: settings.claudeKey, dangerouslyAllowBrowser: true });
    clientKey = settings.claudeKey;
  }
  return client;
}

// A stable description of who this person is (kept the same between messages so it caches well)
function personSheet(p, g) {
  const job = p.kid ? (p.age === 'baby' ? 'a baby' : 'a kid') : `a ${p.jobLabel.toLowerCase()} before being taken`;
  return [
    `You are ${p.name} ${p.last}, ${p.ageYears} years old, ${job}.`,
    `Personality: ${p.traits.map((t) => TRAITS[t] || t).join(', ')}.`,
    p.has('cusser') || p.has('hothead') ? 'You cuss when you feel like it.' : p.has('polite') ? 'You never cuss.' : 'You cuss sometimes when upset.',
  ].join(' ');
}

function situation(p, g) {
  const pl = g.player;
  const rels = [...p.rel.entries()].map(([id, r]) => [g.byId(id), r]).filter(([o]) => o).sort((a, b) => Math.abs(b[1].f) + b[1].l - Math.abs(a[1].f) - a[1].l).slice(0, 6)
    .map(([o, r]) => `${o.name}${o.alive ? '' : ' (dead)'}: friendship ${Math.round(r.f)}, love ${Math.round(r.l)}${p.partner === o.id ? ' (your partner)' : ''}`);
  const big = pl.scale > p.scale * 4;
  return [
    big ? 'You are a shrunken person (3 cm tall) living in a glass cage in a scientist\'s secret basement lab, with other shrunken people. The one talking to you is THE GIANT: the scientist who shrank you and keeps you here. They are huge and can pick you up.'
      : pl.disguise ? `You are a shrunken person in a glass cage. Someone your size you don't know well is talking to you (they look like ${pl.disguise.name}).`
        : 'You are a shrunken person in a glass cage. The giant scientist who keeps you here has shrunk themselves down to your size and is standing next to you.',
    pl.name || p.remembersPlayerAs ? `The giant told you to call them ${p.remembersPlayerAs || pl.name}.` : '',
    `How you feel about the giant: opinion ${Math.round(p.op)} (-100 hate to 100 love), fear ${Math.round(p.fear)}/100, worship ${Math.round(p.faith)}/100, romantic feelings ${Math.round(p.loveYou)}/100.`,
    `Right now you feel ${p.feeling()}. Health ${Math.round(p.health)}/100. Hunger ${Math.round(p.needs.hunger)}, thirst ${Math.round(p.needs.thirst)}, energy ${Math.round(p.needs.energy)} (100 = fine).`,
    p.limbsLost ? `You have lost ${p.limbsLost} limb(s).` : '',
    p.held ? 'The giant is holding you in their hand right now.' : '',
    rels.length ? `People you know: ${rels.join('; ')}.` : '',
    `Memories: ${p.mem.slice(-8).map((m) => m.text).join('. ') || 'nothing special yet'}.`,
    `Society: ${g.society.tribes.length ? 'tribes ' + g.society.tribes.map((t) => t.name).join(', ') : 'one group'}, tech: ${['stone', 'wood', 'metal', 'gunpowder', 'electric', 'gadget'][g.society.tech]} age.`,
  ].filter(Boolean).join('\n');
}

const RULES = `Stay in character as this exact person. Answer with real words that respond to what was said, the way this person would talk given their personality and feelings. Keep it short (a few sentences at most).
If you are asked to do something, decide yes or no the way this person really would (their personality, how they feel about the giant and about anyone involved). If you refuse, set action to "none". If you agree, set the matching action and put the person's first name in target when it's about someone. A liar may say yes but set action "none".
Children in the cage can never be hurt: always refuse any order to hurt a child.
You can't see anything outside the cage clearly. Never mention being an AI, a model, or a game.`;

// The model for chat in a game should answer fast: low effort.
export async function claudeReply(p, text, g, history) {
  const c = getClient();
  if (!c) throw new Error('No API key');
  const model = settings.claudeModel || 'claude-opus-5-5';
  const params = {
    model,
    max_tokens: 4000,
    system: [{ type: 'text', text: RULES, cache_control: { type: 'ephemeral' } }, { type: 'text', text: personSheet(p, g) }],
    messages: [
      ...history.slice(-8),
      { role: 'user', content: `[Situation]\n${situation(p, g)}\n\n[The giant says]\n${text}` },
    ],
    output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(REPLY_SCHEMA) },
  };
  // Haiku has no server-side fallback; the bigger models retry a policy decline on Anthropic's pick
  if (model !== 'claude-haiku-5-5') { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
  let res;
  try {
    res = await c.beta.messages.parse(params);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Your Claude API key was rejected. Check it in Settings > AI Brain.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('This API key can\'t use that model.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Claude is rate limited right now. Using the built-in brain.');
    if (e instanceof Anthropic.BadRequestError) throw new Error('Claude rejected the request: ' + (e.message || ''));
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Could not reach Claude (no internet?).');
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('refused');
  const out = res.parsed_output;
  if (!out || typeof out.say !== 'string') throw new Error('bad reply');
  return { reply: out, usage: res.usage };
}

// ------------------------------------------------------------- local free AI (WebLLM)
let engine = null, loading = null;
export const localState = { status: 'not downloaded', progress: 0 };

export async function loadLocal(onProgress) {
  if (engine) return engine;
  if (loading) return loading;
  if (!navigator.gpu) throw new Error('Your browser does not support WebGPU, so the local AI can\'t run here. Try Chrome or Edge.');
  loading = (async () => {
    localState.status = 'downloading';
    const url = 'https://esm.run/@mlc-ai/web-llm@0.2.79';
    const webllm = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);
    engine = await webllm.CreateMLCEngine(settings.localModel, {
      initProgressCallback: (r) => { localState.progress = r.progress || 0; localState.status = r.text || 'loading'; if (onProgress) onProgress(localState); },
    });
    localState.status = 'ready';
    return engine;
  })();
  try { return await loading; } catch (e) { loading = null; localState.status = 'failed: ' + e.message; throw e; }
}

export async function localReply(p, text, g, history) {
  const e = await loadLocal();
  const sys = `${RULES}\n${personSheet(p, g)}\n${situation(p, g)}\nReply ONLY with JSON like {"say": "...", "mood": "neutral|happy|angry|scared|sad|love", "action": one of ${ACTIONS.join('|')}, "target": "", "build": "", "opinion_change": 0}.`;
  const r = await e.chat.completions.create({
    messages: [{ role: 'system', content: sys }, ...history.slice(-6).map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' })), { role: 'user', content: text }],
    temperature: 0.8, max_tokens: 200, response_format: { type: 'json_object' },
  });
  const txt = r.choices[0].message.content || '';
  const m = txt.match(/\{[\s\S]*\}/);
  const out = JSON.parse(m ? m[0] : txt);
  if (typeof out.say !== 'string') throw new Error('bad reply');
  if (!ACTIONS.includes(out.action)) out.action = 'none';
  return { reply: out };
}

// turn a model reply into the same order objects ai.js understands
export function replyToOrder(reply, p, g) {
  const tgt = reply.target ? g.people.find((o) => o.name.toLowerCase() === String(reply.target).toLowerCase() && o !== p) : null;
  const until = g.time + 120;
  switch (reply.action) {
    case 'follow': return { type: 'follow', target: 'player', until };
    case 'come': return { type: 'come' };
    case 'stop': return { type: 'stay_here', time: 25 };
    case 'go_away': return { type: 'go_away' };
    case 'sit': return { type: 'sit' };
    case 'dance': return { type: 'dance' };
    case 'wave': return { type: 'wave' };
    case 'hide': return { type: 'hide' };
    case 'sleep': return { type: 'sleep' };
    case 'eat': return { type: 'eat' };
    case 'pray': return { type: 'pray', short: true };
    case 'drop_item': return { type: 'dropit' };
    case 'give_item': return { type: 'give_player' };
    case 'take_item': return { type: 'acceptItem' };
    case 'attack': case 'kill': return tgt && !tgt.kid && tgt.alive ? { type: 'fight', target: tgt, lethal: reply.action === 'kill', why: 'order', until } : null;
    case 'protect_player': return { type: 'follow', target: 'player', guard: true, until: g.time + 180 };
    case 'gather_wood': return { type: 'gatherCmd', res: 'wood', until };
    case 'gather_stone': return { type: 'gatherCmd', res: 'stone', until };
    case 'gather_food': return { type: 'gatherCmd', res: 'food', until };
    case 'build': return reply.build ? { type: 'buildOrder', what: reply.build } : null;
    case 'escape': return { type: 'escape' };
    case 'kiss': return tgt ? { type: 'romanceCmd', target: tgt } : { type: 'wave' };
    case 'befriend': return tgt ? { type: 'chatCmd', target: tgt } : null;
    default: return null;
  }
}
