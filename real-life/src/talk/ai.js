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

const SPEND_KEY = 'reallife.aiSpend.v1';
// Rough price per million tokens (input / output) for budgeting the daily limit.
const PRICE = { in: 1, out: 5 };

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

export function aiStatus() {
  const mode = settings.get('aiBrain');
  if (mode === 'claude') {
    if (!settings.get('claudeKey')) return { ok: false, why: 'No Claude API key in Settings.' };
    if (spendToday() >= (settings.get('aiDailyLimit') || 1)) return { ok: false, why: "Today's AI spending limit is used up." };
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
    `Answer ONLY with JSON: {"say": "...", "mood": "neutral|happy|sad|angry|scared", "opinion_change": -10..10, "action": null | {"type":"money","amount":N} | {"type":"permit","key":"outside|store|stayup|screens|sweets|misc","hours":N} | {"type":"chore","id":"dishes|trash|bed"} | {"type":"snack"} | {"type":"allowance"} | {"type":"end"}}`,
    `Only give money/permission/chores if YOU would actually do that right now. "end" = you walk away / end the chat.`,
    recent ? `Recent conversation:\n${recent}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parse(textOut) {
  const m = textOut.match(/\{[\s\S]*\}/);
  if (!m) return { say: textOut.trim().slice(0, 300) };
  try {
    const j = JSON.parse(m[0]);
    if (typeof j.say !== 'string') return null;
    return { say: j.say.slice(0, 400), mood: j.mood, opinion: Math.max(-10, Math.min(10, +j.opinion_change || 0)), act: j.action && typeof j.action === 'object' ? j.action : null };
  } catch {
    return null;
  }
}

export async function aiReply(npc, text, ctx) {
  const st = aiStatus();
  if (!st.ok) return null;
  const sys = systemPrompt(npc, ctx);
  try {
    if (st.mode === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': settings.get('claudeKey'),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: settings.get('claudeModel') || 'claude-haiku-5-5', max_tokens: 220, system: sys, messages: [{ role: 'user', content: text.slice(0, 600) }] }),
      });
      if (!res.ok) throw new Error(`Claude ${res.status}`);
      const j = await res.json();
      addSpend(((j.usage?.input_tokens || 800) * PRICE.in + (j.usage?.output_tokens || 80) * PRICE.out) / 1e6);
      return parse(j.content?.map((c) => c.text || '').join('') || '');
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
