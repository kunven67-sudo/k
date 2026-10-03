/* AI Play - talking to Google's Gemini (the optional "coach" brain).
 *
 * Your API key is saved ONLY in this browser (localStorage on this computer). It's never in the
 * code, never in GitHub, never in the AI's saved brains - and it's only ever sent to Google
 * (generativelanguage.googleapis.com). "Forget key" deletes it.
 */
'use strict';

AIP.gemini = (function () {
  const STORE = 'aiplay.gemini.v1';
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const FALLBACK_MODEL = 'gemini-flash-latest';
  let cfg = { key: '', model: '', on: true };
  try { const raw = localStorage.getItem(STORE); if (raw) cfg = Object.assign(cfg, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  const st = { status: cfg.key ? (cfg.on ? 'ready' : 'off') : 'nokey', msg: '', backoffUntil: 0, backoffMs: 0, busy: 0, calls: 0, features: { schema: 'json', think: true } };
  const subs = [];
  const emit = () => subs.forEach((f) => { try { f(st); } catch (e) { /* ignore */ } });
  function setStatus(s, msg) { st.status = s; st.msg = msg || ''; emit(); }
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify({ key: cfg.key, model: cfg.model, on: cfg.on })); } catch (e) { /* ignore */ }
    emit();
  }

  async function fetchT(url, opts, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms || 25000);
    try { return await fetch(url, Object.assign({}, opts, { signal: ac.signal })); } finally { clearTimeout(t); }
  }
  function apiErr(status, j) {
    const e = new Error((j && j.error && j.error.message) || ('HTTP ' + status));
    e.status = status;
    e.reason = j && j.error && (j.error.details || []).map((d) => d.reason).filter(Boolean)[0];
    e.details = j && j.error && j.error.details;
    return e;
  }

  // Ask Google which models this key can use, and pick the newest fast "Flash" one.
  async function listModels(key) {
    const out = [];
    let token = '';
    for (let i = 0; i < 5; i++) {
      const r = await fetchT(BASE + '/models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { 'x-goog-api-key': key } }, 15000);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw apiErr(r.status, j);
      (j.models || []).forEach((m) => out.push(m));
      token = j.nextPageToken;
      if (!token) break;
    }
    return out;
  }
  function pickModel(models) {
    const names = models.filter((m) => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0).map((m) => String(m.name || '').replace(/^models\//, ''));
    const ver = (n) => { const m = /^gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; };
    const flash = names.filter((n) => /^gemini-\d+(\.\d+)?-flash/.test(n) && !/(image|tts|audio|live|omni|embed|computer|native|lite|robotics|veo)/.test(n));
    const score = (n) => ver(n) * 100 - (/(preview|exp)/.test(n) ? 2 : 0) - (/-\d{2,3}$/.test(n) ? 1 : 0);
    flash.sort((a, b) => score(b) - score(a));
    if (flash.length) return flash[0];
    if (names.indexOf(FALLBACK_MODEL) >= 0) return FALLBACK_MODEL;
    return names.find((n) => /flash/.test(n)) || names[0] || FALLBACK_MODEL;
  }

  // Check a key works + auto-pick the model. Returns { ok, model, error }
  async function test(key) {
    key = String(key || '').trim();
    if (!key) return { ok: false, error: 'no key' };
    setStatus('thinking', 'checking your key…');
    try {
      const models = await listModels(key);
      const model = pickModel(models);
      cfg.key = key; cfg.model = model; cfg.on = true;
      st.features = { schema: 'json', think: true };
      persist();
      setStatus('ready', 'using ' + model);
      return { ok: true, model, count: models.length };
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) { setStatus('offline', "can't reach Google"); return { ok: false, error: "Can't reach Google - are you online?" }; }
      setStatus(/key/i.test(e.message) || e.status === 403 ? 'badkey' : 'error', e.message);
      return { ok: false, error: e.message };
    }
  }

  function parseJSON(text) {
    let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    return JSON.parse(t);
  }
  // JSON Schema -> the older "OpenAPI" schema style (fallback if the model doesn't take JSON Schema)
  function toOpenApi(s) {
    if (!s || typeof s !== 'object') return s;
    const o = {};
    for (const k in s) {
      if (k === 'type') o.type = String(s.type).toUpperCase();
      else if (k === 'properties') { o.properties = {}; for (const p in s.properties) o.properties[p] = toOpenApi(s.properties[p]); }
      else if (k === 'items') o.items = toOpenApi(s.items);
      else if (k === 'additionalProperties') continue;
      else o[k] = s[k];
    }
    return o;
  }

  /**
   * Ask Gemini something. parts = [{text}, {inlineData:{mimeType, data}}...]
   * With a schema -> returns parsed JSON. Without -> returns text.
   * Throws an error with .kind = 'offline' | 'limit' | 'badkey' | 'nokey' | 'off' | 'error'
   */
  async function generate(req) {
    const fail = (kind, msg) => { const e = new Error(msg || kind); e.kind = kind; return e; };
    if (!cfg.key) throw fail('nokey', 'no API key');
    if (!cfg.on) throw fail('off', 'coach is off');
    if (navigator.onLine === false) { setStatus('offline', 'no internet'); throw fail('offline', 'no internet'); }
    if (Date.now() < st.backoffUntil) throw fail('limit', 'waiting for the free limit to refill');
    const model = cfg.model || FALLBACK_MODEL;
    const gc = { temperature: req.temperature == null ? 0.7 : req.temperature, maxOutputTokens: req.maxTokens || 1024 };
    if (req.schema) {
      gc.responseMimeType = 'application/json';
      if (st.features.schema === 'json') gc.responseJsonSchema = req.schema;
      else if (st.features.schema === 'openapi') gc.responseSchema = toOpenApi(req.schema);
    }
    if (st.features.think) gc.thinkingConfig = /^gemini-(\d{2,}|[3-9])/.test(model) ? { thinkingLevel: 'low' } : { thinkingBudget: 0 };
    const body = { contents: [{ role: 'user', parts: req.parts }], generationConfig: gc };
    if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
    st.busy++; st.calls++;
    if (st.status !== 'thinking') setStatus('thinking', req.label || '');
    let r, j;
    try {
      r = await fetchT(BASE + '/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body),
      }, req.timeoutMs || 30000);
      j = await r.json().catch(() => ({}));
    } catch (e) {
      st.busy--;
      setStatus('offline', "can't reach Google");
      throw fail('offline', "can't reach Google");
    }
    st.busy--;
    if (!r.ok) {
      const e = apiErr(r.status, j);
      const msg = e.message;
      // the model didn't like one of the optional settings -> switch it off and try again
      if (r.status === 400 && st.features.think && /think/i.test(msg)) { st.features.think = false; return generate(req); }
      if (r.status === 400 && st.features.schema === 'json' && /(json_?schema|responseJsonSchema|response_json_schema)/i.test(msg)) { st.features.schema = 'openapi'; return generate(req); }
      if (r.status === 400 && st.features.schema === 'openapi' && /schema/i.test(msg)) { st.features.schema = 'none'; return generate(req); }
      if (r.status === 429) {
        let wait = 0;
        (e.details || []).forEach((d) => { if (d.retryDelay) wait = Math.max(wait, parseFloat(d.retryDelay) * 1000 || 0); });
        st.backoffMs = Math.min(120000, Math.max(wait, st.backoffMs ? st.backoffMs * 2 : 10000));
        st.backoffUntil = Date.now() + st.backoffMs;
        setStatus('limit', 'hit the free limit - slowing down for ' + Math.round(st.backoffMs / 1000) + 's');
        throw fail('limit', msg);
      }
      if (r.status === 404 && cfg.model) { cfg.model = ''; persist(); setStatus('error', 'model not found - will use ' + FALLBACK_MODEL); throw fail('error', msg); }
      if (e.reason === 'API_KEY_INVALID' || r.status === 401 || r.status === 403) { setStatus('badkey', msg); throw fail('badkey', msg); }
      if (r.status >= 500) { st.backoffUntil = Date.now() + 5000; }
      setStatus('error', msg);
      throw fail('error', msg);
    }
    st.backoffMs = 0;
    const cand = j.candidates && j.candidates[0];
    const text = cand && cand.content && cand.content.parts ? cand.content.parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('') : '';
    if (!text) { setStatus('ready', 'Gemini gave no answer' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : '')); throw fail('error', 'empty answer'); }
    setStatus('ready', 'using ' + model);
    if (!req.schema) return text;
    try { return parseJSON(text); } catch (e) { throw fail('error', 'answer was not JSON'); }
  }

  return {
    get: () => ({ hasKey: !!cfg.key, model: cfg.model, on: cfg.on, masked: cfg.key ? cfg.key.slice(0, 4) + '…' + cfg.key.slice(-4) : '' }),
    state: () => st,
    ready: () => !!(cfg.key && cfg.on && navigator.onLine !== false),
    usable: () => !!(cfg.key && cfg.on && navigator.onLine !== false && Date.now() >= st.backoffUntil),
    setOn(v) { cfg.on = !!v; persist(); setStatus(cfg.key ? (v ? 'ready' : 'off') : 'nokey'); },
    setModel(m) { cfg.model = String(m || '').trim(); persist(); },
    forget() { cfg.key = ''; cfg.model = ''; persist(); setStatus('nokey'); },
    test, generate, pickModel, on: (f) => subs.push(f),
  };
})();
