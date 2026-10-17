// Real AI brains for talking (Settings > Talking brain):
//   'claude' -> your own Claude API key (understands everything; daily $ limit you set)
//   'local'  -> a free local model through Ollama (http://localhost:11434 by default)
// The AI only writes what the person says + picks from the same actions the built-in brain
// uses. The game still checks every action (a parent can't hand over more cash than they have,
// a kid can never be given alcohol, etc).
//
//   const r = await aiReply(npc, text, ctx)   // -> same shape as brain.think(), or null on failure

import { settings } from '../core/settings.js';
import { clock } from '../core/clock.js';
import { relation } from './brain.js';
import { bus } from '../core/events.js';

const SPEND_KEY = 'reallife.aiSpend.v1';
// The models the game knows how to call (price per million tokens, input / output, for the
// daily $ limit). Anything else typed in Settings falls back to the first one.
const MODELS = {
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-opus-5-5': { in: 4, out: 20 },
};
export const CLAUDE_MODELS = Object.keys(MODELS);

function spendToday() {
  try {
    const s = JSON.parse(localStorage.getItem(SPEND_KEY) || '{}');
    return s.day === new Date().toDateString() ? s.usd : 0;
  } catch {
    return 0;
  }
}

function addSpend(usd) {
  try {
    const day = new Date().toDateString();
    localStorage.setItem(SPEND_KEY, JSON.stringify({ day, usd: spendToday() + usd }));
  } catch {
    /* no storage: limit can't persist across reloads */
  }
}

const claudeKey = () => String(settings.get('claudeKey') || '').trim();

/** Which brain talks (Settings > People > Talking brain). */
export function brainMode() {
  return settings.get('aiBrain') || 'builtin';
}

// Pasting a key switches the talking brain to Claude (people used to paste a key and keep the
// built-in brain without noticing the switch). Saves that already have a key get switched once.
bus.on('settings:changed', ({ key, value }) => {
  if (key === 'claudeKey' && String(value || '').trim() && settings.get('aiBrain') === 'builtin') settings.set('aiBrain', 'claude');
});
if (claudeKey() && settings.get('aiBrain') === 'builtin' && !settings.get('aiKeySwitched')) {
  settings.set('aiBrain', 'claude');
  settings.set('aiKeySwitched', true);
}

export function aiStatus() {
  const mode = brainMode();
  if (mode === 'claude') {
    if (!claudeKey()) return { ok: false, mode, why: 'No Claude API key in Settings.' };
    if (!claudeKey().startsWith('sk-ant-')) return { ok: false, mode, why: 'That does not look like a Claude API key (they start with sk-ant-).' };
    if (spendToday() >= (settings.get('aiDailyLimit') || 1)) return { ok: false, mode, why: "Today's AI spending limit is used up." };
  }
  return { ok: mode === 'claude' || mode === 'local', mode };
}

function systemPrompt(npc, ctx) {
  const R = npc.rec;
  const T = R.traits;
  const you = ctx.you;
  const rel = relation(R);
  const who =
    rel === 'parent'
      ? `You are ${R.name} ${R.last}, the player's ${R.call === 'Mom' ? 'mother' : R.call === 'Dad' ? 'father' : R.role}. The player calls you "${R.call}". Parenting style: ${R.style}.`
      : rel === 'sibling'
        ? `You are ${R.name}, the player's ${R.age > you.age ? 'older' : 'younger'} sibling, age ${R.age}.`
        : rel === 'staff'
          ? `You are ${R.name}, ${R.age}, working as a ${R.job} in Maple Hollow, Ohio.`
          : `You are ${R.name} ${R.last}, age ${R.age}, a neighbour on Maple Street in Maple Hollow, Ohio. Job: ${R.job}.`;
  const traits = Object.entries(T)
    .map(([k, v]) => `${k} ${Math.round(v * 10)}/10`)
    .join(', ');
  const mem = ctx.mem;
  const recent = (mem.said || []).slice(-8).map((x) => `Player: ${x.you}\nYou: ${x.them}`).join('\n');
  const chores = ctx.chores ? `Player's chores today: ${ctx.chores.today.map((c) => `${c.label} (${c.done ? 'done' : 'not done'})`).join('; ') || 'none'}. Allowance owed: $${ctx.chores.owed.toFixed(2)}.` : '';
  return [
    `This is REAL LIFE, a life-sim video game. Stay in character as a real person. Reply with ONE short line of natural spoken dialogue (max 2 sentences), like a real person talks. No narration, no emojis, no stage directions.`,
    who,
    `Personality (0-10): ${traits}. Your opinion of the player: ${Math.round(mem.opinion)}/100. Times you've talked: ${mem.talks}.`,
    `Right now: ${clock.weekdayName}, ${clock.timeText()}, ${clock.season}. You are ${npc.activity?.kind || 'standing around'}. Your mood: ${npc.mood || 'neutral'}.`,
    `The player: ${you.name}, ${Math.floor(you.age)} years old${you.grounded ? ', currently grounded' : ''}${you.smelly ? ', smells bad (hasn\'t showered)' : ''}. Family wealth: ${ctx.wealth}.`,
    chores,
    you.age < 18
      ? `The player is a CHILD. Keep everything appropriate for a kid. Never anything romantic or sexual. If they say something inappropriate, react like a real adult would to a kid saying that.`
      : `Never sexual content. Romance stays non-explicit.`,
    `Mild swearing is fine only if your personality swears a lot and you're talking to an adult. Use parody brands only (Walmort, Best Bye, IKEO, Pepsy, McDanny's).`,
    `Decide like a real person with your personality and opinion would. You can say no. Asking repeatedly annoys people.`,
    `Fill in the reply form: "say" = your spoken line; "mood" = how you feel now; "opinion_change" = -10..10; "action" = what you DO: "none", "money" (amount = dollars you hand over), "permit" (key = outside|store|stayup|screens|sweets|misc, hours = how long), "chore" (id = dishes|trash|bed: you give the player that chore), "snack" (you give them a snack), "allowance" (you pay what you owe), "end" (you walk away / end the chat). Unused fields: 0 or "".`,
    `Only give money/permission/chores if YOU would actually do that right now. "end" = you walk away / end the chat.`,
    recent ? `Recent conversation:\n${recent}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// The reply form Claude must fill in (structured outputs: always valid JSON in this shape).
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string' },
    mood: { type: 'string', enum: ['neutral', 'happy', 'sad', 'angry', 'scared'] },
    opinion_change: { type: 'integer' },
    action: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['none', 'money', 'permit', 'chore', 'snack', 'allowance', 'end'] },
        amount: { type: 'number' },
        key: { type: 'string' },
        hours: { type: 'number' },
        id: { type: 'string' },
      },
      required: ['type', 'amount', 'key', 'hours', 'id'],
      additionalProperties: false,
    },
  },
  required: ['say', 'mood', 'opinion_change', 'action'],
  additionalProperties: false,
};

function parse(textOut) {
  const m = textOut.match(/\{[\s\S]*\}/);
  if (!m) return textOut.trim() ? { say: textOut.trim().slice(0, 300) } : null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j.say !== 'string' || !j.say.trim()) return null;
    const act = j.action && typeof j.action === 'object' && j.action.type && j.action.type !== 'none' ? j.action : null;
    return { say: j.say.slice(0, 400), mood: j.mood, opinion: Math.max(-10, Math.min(10, +j.opinion_change || 0)), act };
  } catch {
    return null;
  }
}

/** What went wrong, in words a player understands (shown once in the chat). */
function claudeError(status, body) {
  const msg = body?.error?.message || '';
  if (status === 401) return 'Claude said your API key is not valid. Copy it again from console.anthropic.com (Settings > People).';
  if (status === 403) return `Claude refused the key: ${msg || 'no permission for this model.'}`;
  if (status === 402 || /credit|billing|balance/i.test(msg)) return 'Your Claude account has no credits left. Add credits at console.anthropic.com > Billing.';
  if (status === 404) return `Claude doesn't know that model name. Using ${CLAUDE_MODELS[0]} from now on.`;
  if (status === 429) return 'Claude says too many messages too fast. Wait a few seconds.';
  if (status === 529 || status >= 500) return 'Claude is busy right now. Try again in a bit.';
  return `Claude error ${status}: ${msg || 'bad request'}`;
}

let _lastErr = '';

export async function aiReply(npc, text, ctx) {
  const st = aiStatus();
  if (!st.ok) {
    if (st.mode === 'claude' && st.why && st.why !== _lastErr) {
      _lastErr = st.why;
      return { fail: st.why };
    }
    return null;
  }
  const sys = systemPrompt(npc, ctx);
  try {
    if (st.mode === 'claude') {
      let model = String(settings.get('claudeModel') || '').trim();
      if (!MODELS[model]) model = CLAUDE_MODELS[0];
      const body = {
        model,
        max_tokens: 1024,
        system: sys,
        messages: [{ role: 'user', content: text.slice(0, 600) }],
        output_config: { format: { type: 'json_schema', schema: REPLY_SCHEMA } },
      };
      // One spoken line doesn't need deep thinking: Haiku can switch it off (default effort is
      // fine for that); Sonnet and Opus can't, so they think at low effort instead.
      if (model === 'claude-haiku-5-5') body.thinking = { type: 'disabled' };
      else body.output_config.effort = 'low';
      const call = (b) =>
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': claudeKey(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify(b),
        });
      let res;
      let j;
      try {
        res = await call(body);
        j = await res.json().catch(() => null);
        // If the reply form or the thinking switch is ever rejected, ask once more the plain way
        // (the prompt still asks for the same fields; parse() copes with plain text too).
        if (res.status === 400 && /output_config|format|schema|thinking|effort/i.test(j?.error?.message || '')) {
          console.warn('[talk] Claude rejected the request shape, retrying plain:', j?.error?.message);
          res = await call({ model, max_tokens: 2048, system: `${sys}\nReply with the form as one JSON object.`, messages: body.messages });
          j = await res.json().catch(() => null);
        }
      } catch {
        return { fail: "Couldn't reach Claude (no internet, or something is blocking api.anthropic.com)." };
      }
      if (!res.ok) {
        if (res.status === 404) settings.set('claudeModel', CLAUDE_MODELS[0]);
        console.warn('[talk] Claude', res.status, j?.error);
        return { fail: claudeError(res.status, j) };
      }
      _lastErr = '';
      const price = MODELS[model];
      addSpend(((j.usage?.input_tokens || 800) * price.in + (j.usage?.output_tokens || 80) * price.out) / 1e6);
      if (j.stop_reason === 'refusal') return null; // the built-in brain answers instead
      const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      return parse(out);
    }
    const url = (settings.get('localAiUrl') || 'http://localhost:11434').replace(/\/$/, '');
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: settings.get('localAiModel') || 'llama3.2', stream: false, format: 'json', messages: [{ role: 'system', content: sys }, { role: 'user', content: text.slice(0, 600) }] }),
    });
    if (!res.ok) throw new Error(`Local AI ${res.status}`);
    const j = await res.json();
    return parse(j.message?.content || '');
  } catch (e) {
    console.warn('[talk] AI brain failed, using the built-in one:', e.message);
    return null;
  }
}
