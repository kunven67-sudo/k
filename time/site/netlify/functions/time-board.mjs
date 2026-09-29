// TIME leaderboard, run by Netlify.
// GET  -> the leaderboard (name, hours played, times stopped time)
// POST {op:'claim', name}                         -> reserve a name, returns a secret key for this player
// POST {op:'update', key, token, addSecs, addStops} -> add play time and time stops for that player
// Names are checked here too (a player can't skip the check in the game), and "Bro", "bro" and "B ro" are the same name.
import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
export function isRudeName(s) {
  s = String(s || '');
  const joined = s.replace(/[^a-z0-9]/gi, ''), letters = s.replace(/[^a-z]/gi, '');
  const shapes = [s, joined, letters, joined.replace(/^x+|x+$/gi, ''), letters.replace(/^x+|x+$/gi, ''), s.replace(/\d+/g, ' '), ...s.split(/[^a-zA-Z0-9]+|(?<=[a-z])(?=[A-Z])/)];
  return shapes.some(v => v && matcher.hasMatch(v));
}
export const cleanName = n => String(n || '').replace(/\s+/g, ' ').trim();
export const nameKey = n => cleanName(n).toLowerCase().replace(/[\s_.-]+/g, '');
export function nameProblem(raw) {
  const n = cleanName(raw);
  if (n.length < 3) return 'Your name needs at least 3 characters.';
  if (n.length > 16) return 'Your name can be 16 characters at most.';
  if (!/^[A-Za-z0-9 _.-]+$/.test(n)) return 'Use letters, numbers, spaces and - _ . only.';
  if (!/[A-Za-z]/.test(n)) return 'Your name needs at least one letter.';
  if (isRudeName(n)) return "That name isn't allowed in TIME. Try another one.";
  return null;
}
const hash = t => createHash('sha256').update(String(t)).digest('hex');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handle(req, store) {
  if (req.method === 'GET') {
    const board = (await store.get('board', { type: 'json' })) || {};
    const players = Object.values(board).map(p => ({ name: p.name, secs: Math.round(p.secs || 0), stops: p.stops || 0 }));
    players.sort((a, b) => b.secs - a.secs);
    return json({ players: players.slice(0, 300), total: players.length });
  }
  if (req.method !== 'POST') return json({ error: 'Use GET or POST' }, 405);
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const now = Date.now();
  if (body.op === 'claim') {
    const problem = nameProblem(body.name); if (problem) return json({ error: problem, code: 'bad' }, 400);
    const name = cleanName(body.name), key = nameKey(name);
    if (await store.get('player/' + key, { type: 'json' })) return json({ error: 'That name is taken, try another one.', code: 'taken' }, 409);
    const token = randomBytes(24).toString('hex');
    await store.setJSON('player/' + key, { name, key, tokenHash: hash(token), secs: 0, stops: 0, created: now, last: now });
    // two people pressing at the same moment: whoever's record is actually saved keeps the name
    const saved = await store.get('player/' + key, { type: 'json' });
    if (!saved || saved.tokenHash !== hash(token)) return json({ error: 'That name is taken, try another one.', code: 'taken' }, 409);
    await updateBoard(store, key, { name, secs: 0, stops: 0 });
    return json({ ok: true, name, key, token });
  }
  if (body.op === 'update') {
    const key = nameKey(body.key || ''), rec = key && await store.get('player/' + key, { type: 'json' });
    if (!rec || rec.tokenHash !== hash(body.token || '')) return json({ error: 'Unknown player', code: 'auth' }, 403);
    // only believable amounts: no more play time than has really passed since the last update
    const since = Math.max(0, (now - (rec.last || now)) / 1000);
    const addSecs = Math.max(0, Math.min(Number(body.addSecs) || 0, since + 120, 3600));
    const addStops = Math.max(0, Math.min(Math.floor(Number(body.addStops) || 0), Math.ceil(addSecs / 2) + 3));
    rec.secs = (rec.secs || 0) + addSecs; rec.stops = (rec.stops || 0) + addStops; rec.last = now;
    await store.setJSON('player/' + key, rec);
    await updateBoard(store, key, { name: rec.name, secs: rec.secs, stops: rec.stops });
    return json({ ok: true, secs: Math.round(rec.secs), stops: rec.stops });
  }
  return json({ error: 'Unknown request' }, 400);
}
async function updateBoard(store, key, row) {
  const board = (await store.get('board', { type: 'json' })) || {};
  board[key] = row; await store.setJSON('board', board);
}
export default async req => handle(req, getStore({ name: 'time-board', consistency: 'strong' }));
