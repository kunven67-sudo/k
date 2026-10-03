// A stand-in for the claude.ai Artifact runtime, so the app can be clicked
// through locally without a Claude account. Bolt's answers here are canned;
// the real ones come from Claude when the app runs on claude.ai.
//
// Tests steer it through window.__mockConfig (set before this script runs)
// and window.__mock (live): queue replies, force a failure, read every call.
(() => {
  const M = (window.__mock = Object.assign({
    uid: 'u_local_test',
    host: true,          // false: no window.claude at all (a plain file)
    sample: true,        // false: claude.use('sample') resolves null
    db: true,
    images: true,
    perm: 'prompt',
    delay: 12,           // ms between streamed chunks
    chunk: 18,           // characters per streamed chunk
    calls: [],           // every sample() call: { input, opts }
    replies: [],         // queued chat replies (strings), used before the canned ones
    fail: null,          // { code, text } -> the next sample() call rejects with it
    overlaps: 0,         // writes started on a doc while another write to it was in flight
    writes: 0,
  }, window.__mockConfig || {}));
  if (!M.host) return;

  const tick = (ms = 4) => new Promise(r => setTimeout(r, ms));
  const DBKEY = '__mockdb';
  const load = () => { try { return new Map(Object.entries(JSON.parse(localStorage.getItem(DBKEY) || '{}'))); } catch { return new Map(); } };
  const store = load();
  const persist = () => { try { localStorage.setItem(DBKEY, JSON.stringify(Object.fromEntries(store))); } catch {} };
  const inflight = new Set();
  M.dump = () => Object.fromEntries(store);

  const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
  function check(path, wantDoc) {
    const s = String(path).split('/');
    if (s.some(x => !SEG.test(x) || x === '.' || x === '..')) throw new TypeError('bad path segment in ' + path);
    if (wantDoc && s.length % 2) throw new TypeError('a document path needs an even number of segments: ' + path);
    if (!wantDoc && !(s.length % 2)) throw new TypeError('a collection path needs an odd number of segments: ' + path);
    return s;
  }
  const visible = s => !(s[0] === 'data' && s[1] === 'users') || s[2] === M.uid;
  const snap = (path, v) => ({
    id: path.split('/').pop(), exists: v !== undefined,
    data: () => (v === undefined ? undefined : Object.freeze(JSON.parse(JSON.stringify(v)))),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  async function write(path, fn) {
    if (inflight.has(path)) M.overlaps++;
    inflight.add(path);
    try { await tick(6); fn(); M.writes++; persist(); } finally { inflight.delete(path); }
  }
  function doc(path) {
    const s = check(path, true);
    return {
      id: s[s.length - 1], path,
      async get() {
        await tick();
        const f = M.getFail; // { match: 'idx-', times: 2, code: 'unavailable' } makes reads of matching docs fail
        if (f && f.times > 0 && path.includes(f.match)) { f.times--; throw { code: f.code || 'unavailable', message: 'mock read failure' }; }
        return snap(path, visible(s) ? store.get(path) : undefined);
      },
      async set(data) {
        if (!visible(s)) throw { code: 'invalid_argument', message: 'not your subtree' };
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw { code: 'invalid_argument', message: 'body must be an object' };
        const json = JSON.stringify(data);
        if (new Blob([json]).size > 262144) throw { code: 'invalid_argument', message: 'document over 256 KiB' };
        if (M.dbFail) { const f = M.dbFail; M.dbFail = null; throw f; }
        await write(path, () => store.set(path, JSON.parse(json)));
      },
      async update(data) {
        if (!store.has(path)) throw { code: 'invalid_argument', message: 'update needs an existing document' };
        await write(path, () => store.set(path, Object.assign(store.get(path), JSON.parse(JSON.stringify(data)))));
      },
      async delete() { if (!visible(s)) throw { code: 'invalid_argument', message: 'not your subtree' }; await write(path, () => store.delete(path)); },
      onSnapshot(next) { setTimeout(() => next(snap(path, store.get(path))), 0); return () => {}; },
      collection: sub => coll(path + '/' + sub),
    };
  }
  function coll(path) {
    check(path, false);
    return {
      path,
      doc: id => doc(path + '/' + (id || Math.random().toString(36).slice(2))),
      async get() {
        await tick();
        const docs = [...store.keys()].filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1 && visible(k.split('/'))).map(k => snap(k, store.get(k)));
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
      },
    };
  }
  const db = Object.freeze({ doc, collection: coll });

  // ---- sample ----
  const lastUser = input => (Array.isArray(input) ? input[input.length - 1].content : String(input));
  function canned(input) {
    if (typeof input === 'string') {
      if (/memory notes/.test(input)) {
        return JSON.stringify({ title: 'Times tables practice', subject: 'math', summary: 'Practiced 7 × 8 with skip counting and got it alone.', notes: ['Learning the 7 and 8 times tables', 'Skip counting helps them'] });
      }
      if (/spelling test/.test(input)) {
        const m = input.match(/Use exactly these \d+ words, in this order: (.*)\./);
        const words = m ? m[1].split(', ') : ['because', 'friend', 'necessary', 'beautiful', 'different', 'answer', 'enough', 'people', 'favorite', 'library'];
        const n = m ? words.length : +(input.match(/Pick (\d+)/) || [0, 5])[1];
        return JSON.stringify({ title: 'Tricky words', words: words.slice(0, n).map(w => ({ word: w, sentence: `I wrote ${w} in my notebook.`, clue: `A clue about ${w}.`, tip: 'Say each part slowly.' })) });
      }
      if (/multiple-choice/.test(input)) {
        const n = +(input.match(/Write exactly (\d+)/) || [0, 5])[1];
        return JSON.stringify({ title: 'Times tables', questions: Array.from({ length: n }, (_, i) => ({ q: `What is ${i + 2} × 3?`, choices: [String((i + 2) * 3 + 1), String((i + 2) * 3), String((i + 2) * 3 + 3), String((i + 2) * 3 - 2)], answer: 1, hint: 'Count by 3s.', explain: `${i + 2} groups of 3 make ${(i + 2) * 3}.` })) });
      }
      return 'OK';
    }
    if (M.replies.length) return M.replies.shift();
    const u = lastUser(input);
    if (/still don't get it/i.test(u)) return 'No problem! Let me try a **new way**. 🍕 Imagine 8 pizzas with 7 slices each.\n\nHow many slices is that if you count by 7s?';
    if (/hint/i.test(u)) return '💡 Hint: try counting by 7s, eight times. What do you get?';
    if (/example/i.test(u)) return 'Here\'s a different one: **6 × 3**.\n1. Count by 3s: 3, 6, 9, 12, 15, 18\n2. So 6 × 3 = 18\n\nNow try yours the same way!';
    if (/56/.test(u)) return 'Beep boop! **Yes!** 7 × 8 = 56 is right, because 8 groups of 7 make 56. 🎉 [[STAR]]';
    if (/homework 📸|help me with this/i.test(u)) return '📸 I see: a worksheet with 7 × 8 at the top.\n\nLet\'s start there! What is 7 × 4?';
    return 'Beep boop! Let\'s figure it out together. 🤖\n\n- **Multiplying** means adding the same number again and again.\n- 7 × 8 means 8 groups of 7.\n\nWhat do you get if you count by 7s?';
  }
  function validate(input, opts) {
    if (opts != null && (typeof opts !== 'object' || Object.getPrototypeOf(opts) !== Object.prototype)) return 'options must be a plain object';
    if (typeof input === 'string') return input ? null : 'empty input';
    if (!Array.isArray(input) || !input.length) return 'input must be a string or turns';
    if (input[0].role !== 'user' || input[input.length - 1].role !== 'user') return 'turns must start and end on user';
    if (input.some(t => !t || !['user', 'assistant'].includes(t.role) || typeof t.content !== 'string' || !t.content.trim())) return 'bad turn';
    if (opts && opts.signal && !(opts.signal instanceof AbortSignal)) return 'signal must be an AbortSignal';
    if (opts && 'cache' in opts && opts.tools) return 'cache with tools';
    if (opts && opts.modelTier && !['default', 'quick', 'complex'].includes(opts.modelTier)) return 'bad modelTier';
    return null;
  }
  function sample(input, opts = {}) {
    const bad = validate(input, opts);
    M.calls.push({ input, opts: { modelTier: opts.modelTier, cache: opts.cache, images: opts.images ? (opts.images.size || true) : null }, bad });
    if (bad) return Promise.reject({ code: 'invalid_request', message: bad });
    if (opts.images && !M.images) return Promise.reject({ code: 'images_unavailable', message: 'no images here' });
    if (M.perm === 'denied') return Promise.reject({ code: 'not_granted', message: 'declined' });
    const fail = M.fail; M.fail = null;
    const full = fail ? (fail.text || '') : canned(input);
    return new Promise((resolve, reject) => {
      let i = 0, sent = '';
      const sig = opts.signal;
      const onAbort = () => { clearTimeout(timer); reject(sent ? { code: 'cancelled', message: 'aborted', text: sent } : { code: 'cancelled', message: 'aborted' }); };
      if (sig) { if (sig.aborted) return onAbort(); sig.addEventListener('abort', onAbort, { once: true }); }
      let timer;
      const step = () => {
        if (i >= full.length) {
          if (sig) sig.removeEventListener('abort', onAbort);
          if (fail) return reject(Object.assign({ code: fail.code, message: 'mock failure' }, sent ? { text: sent } : {}));
          M.used = true;
          return resolve({ text: full, truncated: false, modelTierApplied: opts.modelTier || 'default' });
        }
        const delta = full.slice(i, i + M.chunk); i += M.chunk; sent += delta;
        try { if (opts.onText) opts.onText({ text: sent, delta }); } catch (e) { console.error('onText threw', e); }
        timer = setTimeout(step, M.delay);
      };
      timer = setTimeout(step, M.delay * 3);
    });
  }
  sample.json = async (input, opts) => {
    const { text } = await sample(input, opts);
    try { return JSON.parse(text); } catch { throw { code: 'invalid_json', message: 'not JSON', text }; }
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, ...(M.images ? { images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } } : {}) });

  const user = Object.freeze({
    id: async () => M.uid, isOwner: async () => true, canEdit: async () => true, can: async () => true,
    me: async () => ({ id: M.uid, name: '', email: null, avatarUrl: '', color: '#888', isOwner: true, canEdit: true }),
  });
  const permissions = Object.freeze({
    state: async name => (name ? (name === 'sample' ? (M.used ? 'granted' : M.perm) : 'granted') : { sample: M.perm }),
    request: async () => ({ sample: M.perm }),
    manage: async () => { M.managed = (M.managed || 0) + 1; if (M.permAfterManage) M.perm = M.permAfterManage; },
  });
  const caps = { db: () => (M.db ? db : null), user: () => user, sample: () => (M.sample ? sample : null), permissions: () => permissions };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(caps[name] ? caps[name]() : null), 20)) };
})();
