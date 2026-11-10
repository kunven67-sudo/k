"use strict";
/* OVERDRIVE window. Plain JavaScript, no outside libraries (works offline). */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WORDS = { running: "Working", done: "Done", partly: "Partly done", failed: "Failed", blocked: "Blocked" };
const RISK = { internal: "Bookkeeping", read: "Read", write: "Write (new)", destructive: "Change / replace", external: "Send off PC", money: "Spend money", invalid: "Bad inputs" };
const EFFORT = { low: "Low (fast, light)", medium: "Medium (normal)", high: "High (thinks more)", xhigh: "Extra high", max: "Max (slowest, heaviest)" };

const S = {
  token: "", state: null, setup: null, conv: null, tasks: new Map(), live: new Map(),
  cards: new Map(), seq: 0, tab: "chat", offlineOK: false, status: null, testRun: null,
  beeped: new Set(), titleTimer: null,
};

/* ---------------------------------------------------------------- api */
function readToken() {
  const m = location.hash.match(/t=([A-Za-z0-9_\-]+)/);
  try {
    if (m) sessionStorage.setItem("od_t", m[1]);
    return m ? m[1] : (sessionStorage.getItem("od_t") || "");
  } catch (e) { return m ? m[1] : ""; }
}

async function api(path, body, method) {
  const opts = { method: method || (body === undefined ? "GET" : "POST"), headers: { "X-OD-Token": S.token } };
  if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  let data = {};
  try { data = await r.json(); } catch (e) { /* not json */ }
  if (!r.ok) throw new Error(data.error || `${r.status} ${r.statusText}`);
  return data;
}

function toast(text, kind = "", ms = 5200) {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = text;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------------------------------------------------------------- tiny markdown (safe: escape first) */
function md(text) {
  const parts = String(text || "").split(/```/);
  let out = "";
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9_+-]*\n/, "");
      out += `<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`;
      return;
    }
    const lines = esc(part).split("\n");
    let list = null, para = [];
    const flush = () => { if (para.length) { out += `<p>${inline(para.join("<br>"))}</p>`; para = []; } };
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const line of lines) {
      const ul = line.match(/^\s*[-*•]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/), h = line.match(/^#{1,4}\s+(.*)$/);
      if (ul || ol) {
        flush();
        const want = ul ? "ul" : "ol";
        if (list !== want) { close(); out += `<${want}>`; list = want; }
        out += `<li>${inline((ul || ol)[1])}</li>`;
      } else if (h) { flush(); close(); out += `<h3>${inline(h[1])}</h3>`; }
      else if (!line.trim()) { flush(); close(); }
      else { close(); para.push(line); }
    }
    flush(); close();
  });
  return out;
}
function inline(s) {
  return s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 <span class=\"muted\">($2)</span>");
}
const ago = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
const money = (v) => (v == null ? "" : v < 0.01 ? "under $0.01" : `$${v.toFixed(2)}`);
const about = (v) => (v < 0.01 ? money(v) : `about ${money(v)}`);

/* ---------------------------------------------------------------- boot */
async function boot() {
  S.token = readToken();
  bindUI();
  try { await refreshState(); } catch (e) { toast("Can't reach OVERDRIVE: " + e.message, "bad", 10000); return; }
  checkSetup(false);
  connectEvents();
  setInterval(tickCards, 1000);
  setInterval(() => checkSetup(false, true), 60000);
}

async function refreshState() {
  const st = await api("/api/state");
  S.state = st;
  S.seq = Math.max(S.seq, st.event_seq || 0);
  S.cards = new Map((st.cards || []).map((c) => [c.id, c]));
  renderChats();
  renderUsage(st.usage);
  renderModelChip();
  if (st.current) {
    S.conv = st.current.conversation;
  } else if (!S.conv && st.conversations.length) {
    S.conv = st.conversations[0].id;
  }
  if (S.conv) await openConversation(S.conv, true); else renderFeed();
  updateRunning();
  renderNeeds();
}

/* ---------------------------------------------------------------- live events */
async function connectEvents() {
  let wait = 1000;
  for (;;) {
    try {
      const r = await fetch(`/api/events?since=${S.seq}`, { headers: { "X-OD-Token": S.token } });
      if (!r.ok || !r.body) throw new Error(String(r.status));
      wait = 1000;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.trim()) { try { handle(JSON.parse(line)); } catch (e) { console.error(e); } }
        }
      }
    } catch (e) { /* reconnect below */ }
    await new Promise((res) => setTimeout(res, wait));
    wait = Math.min(wait * 2, 8000);
    try { await refreshState(); } catch (e) { /* app closed */ }
  }
}

function handle(ev) {
  if (ev.seq) S.seq = Math.max(S.seq, ev.seq);
  switch (ev.type) {
    case "task": upsertTask(ev.task); break;
    case "delta": {
      S.live.set(ev.task, (S.live.get(ev.task) || "") + ev.text);
      const el = $(`#live-${ev.task}`);
      if (el) { el.textContent = S.live.get(ev.task); autoScroll(); }
      break;
    }
    case "card_open": S.cards.set(ev.card.id, ev.card); renderCards(); break;
    case "card_closed": S.cards.delete(ev.card.id); renderCards(); break;
    case "usage": renderUsage(ev.usage); break;
    case "warning": toast(ev.text, "warn", 9000); break;
    case "status": toast(ev.text, "", 4000); break;
    case "selftest": onTestProgress(ev.name, ev.result); break;
    case "selftest_done": onTestsDone(ev.summary); break;
    case "log": if (S.tab === "logs") debounceLogs(); break;
    default: break;
  }
}

/* ---------------------------------------------------------------- chats */
function renderChats() {
  const box = $("#chats");
  const convs = (S.state && S.state.conversations) || [];
  box.innerHTML = convs.length ? "" : `<div class="muted" style="padding:6px 10px;font-size:12.5px">No chats yet</div>`;
  for (const c of convs) {
    const b = document.createElement("button");
    b.className = "chat-item" + (c.id === S.conv ? " on" : "");
    b.textContent = c.title || "Chat";
    b.title = c.title;
    b.addEventListener("click", () => { switchTab("chat"); openConversation(c.id); });
    box.appendChild(b);
  }
}

async function openConversation(id, quiet) {
  S.conv = id;
  try {
    const d = await api(`/api/conversation/${encodeURIComponent(id)}`);
    S.tasks = new Map(d.tasks.map((t) => [t.id, t]));
    $("#chat-title").textContent = d.conversation.title || "Chat";
  } catch (e) {
    if (!quiet) toast(e.message, "bad");
    S.tasks = new Map();
  }
  renderChats();
  renderFeed();
}

function newChat() {
  if (S.state && S.state.current) { toast("Wait until the running task is finished (or press STOP).", "warn"); return; }
  S.conv = null;
  S.tasks = new Map();
  $("#chat-title").textContent = "New chat";
  renderChats();
  renderFeed();
  $("#msg").focus();
}

function isStale(t) {
  const old = S.tasks.get(t.id);
  if (!old) return false;
  if (old.status !== "running" && t.status === "running") return true;   // a finished task never goes back
  return t.status === "running" && (old.calls || []).length > (t.calls || []).length;
}

function upsertTask(t) {
  if (isStale(t)) return;
  if (t.status === "running") {
    S.state.current = t;
    if (!S.conv || S.conv === t.conversation) S.conv = t.conversation;
  } else if (S.state.current && S.state.current.id === t.id) {
    S.state.current = null;
    S.live.delete(t.id);
  }
  if (!S.state.conversations.find((c) => c.id === t.conversation)) {
    S.state.conversations.unshift({ id: t.conversation, title: t.request.slice(0, 60), created: t.created });
    renderChats();
  }
  if (t.conversation === S.conv) {
    S.tasks.set(t.id, t);
    const old = $(`#turn-${t.id}`);
    const node = turnNode(t);
    if (old) old.replaceWith(node); else { $("#empty").classList.add("hidden"); $("#feed").appendChild(node); }
    renderCards();
    autoScroll();
  }
  updateRunning();
  if (t.status !== "running" && S.tab === "status") loadStatus();
}

function renderFeed() {
  const feed = $("#feed");
  $$(".turn", feed).forEach((n) => n.remove());
  const tasks = Array.from(S.tasks.values()).sort((a, b) => a.created.localeCompare(b.created));
  $("#empty").classList.toggle("hidden", tasks.length > 0);
  for (const t of tasks) feed.appendChild(turnNode(t));
  renderCards();
  feed.scrollTop = feed.scrollHeight;
}

function autoScroll() {
  const f = $("#feed");
  if (f.scrollHeight - f.scrollTop - f.clientHeight < 240) f.scrollTop = f.scrollHeight;
}

function critList(t) {
  const plan = t.plan;
  if (!plan) return "";
  const rep = (t.report && t.report.criteria) || [];
  const items = (plan.success_criteria || []).map((c, i) => {
    const r = rep[i];
    const mark = !r ? `<span class="m q">&middot;</span>` : r.met ? `<span class="m y">&#10003;</span>` : `<span class="m n">&#10007;</span>`;
    const tip = r ? ` title="${esc(r.evidence)}"` : "";
    return `<li${tip}>${mark}<span>${esc(c)}</span></li>`;
  }).join("");
  return `<div class="plan"><div class="goal">${esc(plan.goal)}</div><ul class="crit">${items}</ul></div>`;
}

function stepsList(t) {
  const calls = (t.calls || []).filter((c) => c.tool !== "task_plan" && c.tool !== "task_report");
  if (!calls.length) return "";
  return `<div class="steps">${calls.map((c) => {
    const icon = c.ok === true ? `<span class="s-ok">&#10003;</span>` : c.ok === false ? `<span class="s-bad">&#10007;</span>` : `<span class="s-bad">&#8856;</span>`;
    const tag = c.decision === "yes" ? `<span class="tag yes">you said Yes</span>` : (c.decision === "no" ? `<span class="tag no">you said No</span>` :
      c.decision === "timeout" ? `<span class="tag no">no answer</span>` : c.decision === "blocked" ? `<span class="tag no">blocked</span>` :
      c.decision === "invalid" ? `<span class="tag no">bad inputs</span>` : "");
    const what = c.args && c.args.path ? ` <span class="mono">${esc(c.args.path)}</span>` : c.args && c.args.expression ? ` <span class="mono">${esc(c.args.expression)}</span>` : "";
    return `<div class="step">${icon}<div>${esc(c.title || c.tool)}${what}${tag}${c.ok === null ? ` <span class="muted">${esc(c.summary)}</span>` : ""}</div><span>${c.ms ? c.ms + " ms" : ""}</span></div>`;
  }).join("")}</div>`;
}

function turnNode(t) {
  const wrap = document.createElement("div");
  wrap.className = "turn";
  wrap.id = `turn-${t.id}`;
  const running = t.status === "running";
  const head = running
    ? `<span class="spin"></span><span class="badge running">Working</span><span class="od-reason">${t.plan ? "Following its plan" : "Planning"}...</span>`
    : `<span class="badge ${esc(t.status)}">${esc(WORDS[t.status] || t.status)}</span><span class="od-reason">${esc(t.status_reason)}</span>`;
  const answer = running
    ? `<div class="live answer" id="live-${t.id}">${esc(S.live.get(t.id) || "")}</div>`
    : (t.final_text ? `<div class="answer">${md(t.final_text)}</div>` : "");
  const changes = (t.changes || []).length ? `<div class="changes">Changed: ${t.changes.map((c) =>
    `<span class="f">${esc(c.path)}</span> <span class="muted">(${c.op === "created" ? "new" : "replaced, old copy saved"})</span>`).join(", ")}
    ${!running && !t.undo ? `<button class="ghost sm" data-undo="${t.id}">Undo these changes</button>` : ""}</div>` : "";
  const undone = t.undo ? `<div class="changes">Undone: ${t.undo.map((u) => `${esc(u.path)} &rarr; ${esc(u.result)}`).join("; ")}</div>` : "";
  const flags = (t.flags || []).filter((f) => !f.startsWith("First words") && !f.startsWith("Second check cost"));
  const flagHtml = flags.length ? `<div class="flags">${flags.map(esc).join("<br>")}</div>` : "";
  const err = t.error && t.status !== "done" ? `<div class="err">${esc(t.error)}</div>` : "";
  const checks = (t.checks || []).length ? `<details class="checks"><summary>How OVERDRIVE checked this (${t.checks.filter((c) => c.ok).length}/${t.checks.length} passed)</summary>
    ${t.checks.map((c) => `<div class="c"><span class="${c.ok ? "s-ok" : "s-bad"}">${c.ok ? "&#10003;" : "&#10007;"}</span><b>${esc(c.name)}</b><span>${esc(c.detail)}</span></div>`).join("")}</details>` : "";
  const bits = [];
  if (t.model) bits.push(esc(t.model));
  if (t.cli_version) bits.push(`Claude Code ${esc(t.cli_version)}`);
  if (t.turns) bits.push(`${t.turns} step${t.turns === 1 ? "" : "s"}`);
  if (t.duration_ms) bits.push(`${(t.duration_ms / 1000).toFixed(1)} s`);
  if (t.cost_usd != null) bits.push(`${about(t.cost_usd)} API-equivalent`);
  const foot = running ? "" : `<div class="foot">${bits.map((b) => `<span>${b}</span>`).join("")}
      <button class="ghost" data-details="${t.id}">Details</button>${t.status !== "done" ? `<button class="ghost" data-rerun="${t.id}">Try again</button>` : ""}</div>`;
  wrap.innerHTML = `<div class="me"><div>${esc(t.request)}</div></div>
    <div class="od"><div class="od-head">${head}</div>${critList(t)}${stepsList(t)}${answer}${err}${changes}${undone}${flagHtml}${checks}
      <div class="cards-slot" data-task="${t.id}"></div>${foot}</div>`;
  return wrap;
}

/* ---------------------------------------------------------------- cards (approvals + questions) */
function cardNode(c) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.card = c.id;
  if (c.kind === "approval") {
    const b = c.body || {}, p = b.preview || {};
    let prev = "";
    if (p.diff) {
      prev = `<div class="prev">${p.diff.split("\n").map((l) => {
        const cls = l.startsWith("+") && !l.startsWith("+++") ? "add" : l.startsWith("-") && !l.startsWith("---") ? "del" : l.startsWith("@@") ? "hunk" : "";
        return `<span class="${cls}">${esc(l)}</span>`;
      }).join("\n")}</div>`;
    } else if (p.preview !== undefined) {
      prev = `<div class="prev">${esc(p.preview || "(empty file)")}</div>`;
    } else if (p.inputs) {
      prev = `<div class="prev">${esc(JSON.stringify(p.inputs, null, 2))}</div>`;
    }
    const what = p.path ? `<span class="chip mono">${esc(p.path)}</span><span class="chip">${p.lines ?? "?"} lines</span>` : "";
    el.innerHTML = `<h4>${esc(c.title)}</h4>
      <div class="meta"><span class="risk ${esc(c.risk)}">${esc(b.risk_label || RISK[c.risk] || c.risk)}</span>${what}${b.network ? `<span class="chip">uses internet</span>` : ""}</div>
      ${b.reason ? `<div class="why"><b>Claude's reason:</b> ${esc(b.reason)}</div>` : ""}
      ${prev}
      ${p.reversible ? `<div class="muted">Can it be undone? ${esc(p.reversible)}</div>` : ""}
      <div class="card-actions"><button class="ok" data-yes>Yes, do it</button><button data-no>No</button>
        <input data-note placeholder="Optional note for Claude (why No, or what to change)" maxlength="500">
        <span class="count" data-count></span></div>`;
    $("[data-yes]", el).addEventListener("click", () => answerCard(c.id, "yes", null, $("[data-note]", el).value));
    $("[data-no]", el).addEventListener("click", () => answerCard(c.id, "no", null, $("[data-note]", el).value));
  } else {
    const qs = (c.body && c.body.questions) || [];
    el.innerHTML = `<h4>${esc(c.title)}</h4>` + qs.map((q, qi) => `
      <div class="q" data-q="${qi}"><div class="meta">${q.header ? `<span class="chip">${esc(q.header)}</span>` : ""}${q.multiSelect ? `<span class="chip">pick any</span>` : ""}</div>
      <div class="why"><b>${esc(q.question)}</b></div>
      <div class="qopts">${(q.options || []).map((o, oi) => `<button data-opt="${oi}">${esc(o.label)}${o.description ? `<span class="d">${esc(o.description)}</span>` : ""}</button>`).join("")}</div>
      <input data-other placeholder="Or type your own answer" maxlength="1000" style="width:100%"></div>`).join("") +
      `<div class="card-actions"><button class="primary" data-send>Send answer</button><span class="count" data-count></span></div>`;
    $$("[data-q]", el).forEach((qel) => {
      const q = qs[Number(qel.dataset.q)];
      $$("[data-opt]", qel).forEach((btn) => btn.addEventListener("click", () => {
        if (!q.multiSelect) $$("[data-opt]", qel).forEach((x) => x.classList.remove("sel"));
        btn.classList.toggle("sel");
      }));
    });
    $("[data-send]", el).addEventListener("click", () => {
      const answers = {};
      let missing = false;
      $$("[data-q]", el).forEach((qel) => {
        const q = qs[Number(qel.dataset.q)];
        const picked = $$(".sel", qel).map((b) => q.options[Number(b.dataset.opt)].label);
        const other = $("[data-other]", qel).value.trim();
        const val = other || picked.join(", ");
        if (!val) missing = true;
        answers[q.question] = val;
      });
      if (missing) { toast("Answer every question first (pick an option or type one).", "warn"); return; }
      answerCard(c.id, "answered", answers, "");
    });
  }
  return el;
}

async function answerCard(id, status, answer, note) {
  try {
    await api("/api/card", { id, status, answer, note });
    S.cards.delete(id);
    renderCards();
  } catch (e) { toast(e.message, "bad"); }
}

function renderCards() {
  $$(".cards-slot").forEach((slot) => {
    const want = Array.from(S.cards.values()).filter((c) => c.task_id === slot.dataset.task && c.status === "open");
    const have = new Set($$(".card", slot).map((n) => n.dataset.card));
    $$(".card", slot).forEach((n) => { if (!S.cards.has(n.dataset.card)) n.remove(); });
    for (const c of want) if (!have.has(c.id)) slot.appendChild(cardNode(c));
  });
  renderNeeds();
  tickCards();
}

function renderNeeds() {
  const open = Array.from(S.cards.values()).filter((c) => c.status === "open");
  const bar = $("#needs-you");
  if (!open.length) {
    bar.classList.add("hidden");
    if (S.titleTimer) { clearInterval(S.titleTimer); S.titleTimer = null; }
    document.title = "OVERDRIVE";
    return;
  }
  bar.classList.remove("hidden");
  bar.textContent = open[0].kind === "question" ? "OVERDRIVE has a question for you (below)" : "OVERDRIVE needs your Yes or No (below)";
  bar.onclick = async () => {
    switchTab("chat");
    let n = $(`[data-card="${open[0].id}"]`);
    if (!n && S.state.current) { await openConversation(S.state.current.conversation); n = $(`[data-card="${open[0].id}"]`); }
    if (n) n.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  for (const c of open) if (!S.beeped.has(c.id)) { S.beeped.add(c.id); beep(); }
  if (!S.titleTimer) {
    let flip = false;
    S.titleTimer = setInterval(() => { flip = !flip; document.title = flip ? "(!) OVERDRIVE needs you" : "OVERDRIVE"; }, 900);
  }
}

function tickCards() {
  for (const c of S.cards.values()) {
    const el = $(`[data-card="${c.id}"] [data-count]`);
    if (!el) continue;
    const left = Math.max(0, Math.round(new Date(c.created).getTime() / 1000 + c.timeout_s - Date.now() / 1000));
    el.textContent = `auto-No in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(ctx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.stop(ctx.currentTime + 0.2);
  } catch (e) { /* no audio */ }
}

/* ---------------------------------------------------------------- sending + stop */
async function send(text) {
  text = (text || "").trim();
  if (!text) return;
  if (S.setup && !S.setup.ready) { $("#setup").classList.remove("hidden"); renderSetup(); return; }
  $("#send").disabled = true;
  try {
    const d = await api("/api/send", { text, conversation: S.conv });
    $("#msg").value = "";
    autoGrow();
    if (S.conv !== d.task.conversation) { S.conv = d.task.conversation; S.tasks = new Map(); renderFeed(); }
    $("#chat-title").textContent = (S.state.conversations.find((c) => c.id === S.conv) || {}).title || d.task.request.slice(0, 60);
    upsertTask(d.task);
  } catch (e) { toast(e.message, "bad"); }
  updateRunning();
}

function updateRunning() {
  const running = !!(S.state && S.state.current);
  $("#stop").classList.toggle("hidden", !running);
  $("#send").disabled = running;
  $("#msg").placeholder = running ? "OVERDRIVE is working... (press STOP to end it)" : "Tell OVERDRIVE what to do...";
  renderBrain();
}

async function stop() {
  try { await api("/api/stop", {}); toast("Stopping...", "", 2500); } catch (e) { toast(e.message, "bad"); }
}

function autoGrow() { const m = $("#msg"); m.style.height = "auto"; m.style.height = Math.min(m.scrollHeight, 220) + "px"; }

/* ---------------------------------------------------------------- brain + usage */
function renderBrain() {
  const led = $("#brain-line .led"), txt = $("#brain-text");
  led.className = "led";
  if (S.state && S.state.current) { led.classList.add("busy"); txt.textContent = "Working on a task..."; return; }
  const s = S.setup;
  if (!s) { txt.textContent = "Checking Claude Code..."; return; }
  if (s.ready) { led.classList.add("ok"); txt.textContent = `Claude Code ${s.version} · signed in`; }
  else { led.classList.add("bad"); txt.textContent = "Setup needed (click)"; }
}

function renderUsage(u) {
  if (!u) return;
  const box = $("#usage-bars");
  const t = u.today || {};
  let html = `<div class="ub-row"><span>Today: ${t.tasks || 0} task${t.tasks === 1 ? "" : "s"}</span><span>${t.cost_usd ? about(t.cost_usd) : ""}</span></div>`;
  const lims = (u.limits || []).filter((l) => l.type !== "general" || l.status !== "allowed");
  for (const l of lims) {
    const pct = l.utilization != null ? Math.round(l.utilization * 100) : null;
    const cls = pct == null ? "" : pct >= 85 ? "hi" : pct >= 60 ? "mid" : "";
    const reset = l.resets_at ? new Date(l.resets_at * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    const label = pct != null ? `${pct}%` : l.status === "rejected" ? "used up" : l.status === "allowed_warning" ? "close to limit" : "ok";
    html += `<div class="ub-row"><span>Claude ${esc(l.name)}${reset ? ` (resets ${esc(reset)})` : ""}</span><span>${esc(label)}</span>
      ${pct != null ? `<div class="ub"><i class="${cls}" data-w="${pct}"></i></div>` : ""}</div>`;
  }
  if (!lims.length) html += `<div class="ub-row"><span class="muted">Claude usage bars show up once Claude Code reports them.</span></div>`;
  box.innerHTML = html;
  applyWidths(box);
}

function applyWidths(root) { $$("[data-w]", root).forEach((el) => { el.style.width = Math.max(0, Math.min(100, Number(el.dataset.w))) + "%"; }); }

function renderModelChip() {
  const s = S.state && S.state.settings;
  if (!s) return;
  $("#chip-model").textContent = `${s.model} · effort ${s.effort}`;
}

/* ---------------------------------------------------------------- setup */
async function checkSetup(force, quiet) {
  try { S.setup = await api("/api/setup", force ? {} : undefined); } catch (e) { if (!quiet) toast(e.message, "bad"); return; }
  renderBrain();
  if (!S.setup.ready && !S.offlineOK && !quiet) { $("#setup").classList.remove("hidden"); }
  if (S.setup.ready) $("#setup").classList.add("hidden");
  renderSetup();
}

function renderSetup() {
  const s = S.setup || {};
  const installed = !!s.version;
  const signed = !!s.ready;
  const removed = (S.state && S.state.removed_env) || [];
  $("#setup-steps").innerHTML = `
    <div class="sstep"><div class="n ${installed ? "ok" : "bad"}">${installed ? "&#10003;" : "1"}</div><div>
      <h3>Claude Code ${installed ? `is installed (${esc(s.version)})` : "isn't installed yet"}</h3>
      ${installed ? `<div class="muted mono">${esc(s.cli)}</div>` : `<div class="muted">It's Anthropic's free official app. One click installs it in a new window; when it says it's done, press Check again.</div>
      <div class="btns" style="margin-top:8px"><button class="primary" data-install="winget">Install (winget)</button><button data-install="powershell">Install (PowerShell)</button></div>
      <div class="cmd">winget: winget install --id Anthropic.ClaudeCode -e<br>PowerShell: irm https://claude.ai/install.ps1 | iex</div>`}
    </div></div>
    <div class="sstep"><div class="n ${signed ? "ok" : installed ? "bad" : ""}">${signed ? "&#10003;" : "2"}</div><div>
      <h3>${signed ? "Signed in with your claude.ai plan" : "Sign in with your claude.ai account"}</h3>
      ${signed ? `<div class="muted">Method: ${esc((s.auth || {}).method || "")}</div>` : `<div class="muted">${installed ? esc(s.problem || "A window opens, then your browser: pick your claude.ai account (Pro or Max) and press Allow.") : "Do step 1 first."}</div>
      ${installed ? `<div class="btns" style="margin-top:8px"><button class="primary" data-signin>Sign in</button></div>` : ""}`}
    </div></div>
    ${removed.length ? `<div class="muted" style="margin-top:8px">Note: OVERDRIVE ignores ${removed.map(esc).join(", ")} on this PC so it can never bill an API account.</div>` : ""}`;
  $$("[data-install]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/api/setup/install", { method: b.dataset.install }); toast("Installer window opened. When it finishes, press Check again.", "ok", 9000); }
    catch (e) { toast(e.message, "bad", 9000); }
  }));
  const si = $("[data-signin]");
  if (si) si.addEventListener("click", async () => {
    try { await api("/api/setup/signin", {}); toast("Sign-in window opened. After you press Allow in the browser, press Check again.", "ok", 9000); }
    catch (e) { toast(e.message, "bad", 9000); }
  });
  $("#setup-go").disabled = !s.ready;
}

/* ---------------------------------------------------------------- tabs */
function switchTab(tab) {
  S.tab = tab;
  $$("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $$(".tab").forEach((t) => t.classList.toggle("on", t.id === `tab-${tab}`));
  if (tab === "status") loadStatus();
  if (tab === "logs") loadLogs();
  if (tab === "tools") renderTools();
  if (tab === "settings") renderSettings();
}

/* ---------------------------------------------------------------- status */
async function loadStatus() {
  try { S.status = await api("/api/status"); } catch (e) { $("#status-body").innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  renderStatus();
}

function renderStatus() {
  const d = S.status;
  if (!d) return;
  const g = d.grid, t = g.totals, rs = g.rules_summary;
  $("#nav-points").textContent = `${t.green}/5000`;
  const seg = (n, cls) => n ? `<i class="${cls}" data-w="${(n / 50).toFixed(3)}" title="${n}"></i>` : "";
  const st = d.selftest || {};
  const res = d.selftest_results || {};
  const names = Object.keys(res);
  const run = S.testRun;
  const testsHtml = names.length ? names.map((n) => {
    const r = (run && run[n]) || res[n];
    const cls = r.ok === true ? "pass" : r.ok === false ? "fail" : "skip";
    const word = r.ok === true ? "PASS" : r.ok === false ? "FAIL" : "skip";
    return `<div class="t" title="${esc(r.error || r.skipped || "")}"><span class="${cls}">${word}</span><span>${esc(r.title || n)}</span><span class="r">rules ${(r.rules || []).join(", ")}</span></div>`;
  }).join("") : `<div class="muted">No self-test results on this PC yet. Press <b>Run self-tests</b> (top right): about a minute, $0.</div>`;
  const perf = d.perf || {};
  const toolMs = Object.entries(perf.tool_ms || {}).map(([k, v]) => `${esc(k)}: avg ${v.avg} ms (max ${v.max}, ${v.n}x)`).join("<br>") || "No tool runs yet.";
  $("#status-body").innerHTML = `
    <div class="hero"><div><div class="num">${t.green.toLocaleString()} <small>/ 5,000</small></div><div class="lbl">blueprint points proven on this PC</div></div>
      <div><div class="stack">${seg(t.green, "g-green")}${seg(t.red, "g-red")}${seg(t.untested, "g-untested")}${seg(t.guided, "g-guided")}${seg(t.not_started, "g-off")}</div>
      <div class="legend"><span class="lg-green">${t.green} proven</span><span class="lg-red">${t.red} failing</span><span class="lg-untested">${t.untested} not tested yet</span>
      <span class="lg-guided">${t.guided} guided (never counted)</span><span class="lg-off">${t.not_started.toLocaleString()} not built yet</span></div>
      <div class="muted" style="margin-top:8px;font-size:12.5px">The blueprint = 100 rules &times; 50 areas. Stage 1 makes <b>${rs.real}</b> rules real (${rs.green} proven right now), <b>${rs.guided}</b> guided, <b>${rs.later}</b> wait for later stages.
      A point turns green only if its area runs on the core <i>and</i> the tests for that rule passed here.</div></div></div>
    <h2>Self-tests ${st.when ? `<span class="muted" style="font-weight:400;font-size:12.5px">last run ${esc(new Date(st.when).toLocaleString())}: ${st.passed} passed, ${st.failed} failed, ${st.skipped} skipped${(st.regressions || []).length ? `, <b style="color:var(--bad)">new failures: ${st.regressions.map(esc).join(", ")}</b>` : ""}</span>` : ""}</h2>
    <div class="box"><div class="tests" id="tests-list">${testsHtml}</div></div>
    <h2>The 50 areas <span class="muted" style="font-weight:400;font-size:12.5px">(click one to see its 100 points)</span></h2>
    <div class="areas">${g.areas.map((a) => `<button class="area ${a.started ? "started" : ""}" data-area="${a.n}">
      <div class="an">${esc(a.name)}</div><div class="ar">${a.first}-${a.last} &middot; ${a.started ? `${a.green} green` : "not built yet"}</div>
      <div class="cells">${a.cells.map((c) => `<i class="g-${c}"></i>`).join("")}</div></button>`).join("")}</div>
    <div class="cols" style="margin-top:22px">
      <div><h2 style="margin-top:0">Versions</h2><div class="box kv">${Object.entries(d.compat).map(([k, v]) => `<div>${esc(k.replace(/_/g, " "))}</div><div class="mono">${esc(v)}</div>`).join("")}</div></div>
      <div><h2 style="margin-top:0">Speed</h2><div class="box kv"><div>Tasks (last 50)</div><div>${perf.tasks || 0}</div><div>Average task</div><div>${perf.avg_task_s != null ? perf.avg_task_s + " s" : "-"}</div>
        <div>Results</div><div>${Object.entries(perf.status_counts || {}).map(([k, v]) => `${esc(WORDS[k])}: ${v}`).join(", ")}</div><div>Tools</div><div class="mono">${toolMs}</div></div></div>
    </div>
    <h2>Known limitations</h2><div class="box md">${md(d.limitations || "")}</div>`;
  applyWidths($("#status-body"));
  $$("[data-area]").forEach((b) => b.addEventListener("click", () => showArea(Number(b.dataset.area))));
}

function showArea(n) {
  const g = S.status.grid;
  const a = g.areas.find((x) => x.n === n);
  const subject = a.subject;
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">${esc(a.name)} <span class="muted" style="font-weight:400">(points ${a.first}-${a.last})</span></h2>
    <div class="muted">${esc(a.note)}</div>
    <div class="rules10">${a.cells.map((c, i) => `<button class="g-${c}" data-rule="${i + 1}" title="Rule ${i + 1}">${i + 1}</button>`).join("")}</div>
    <div id="rule-detail" class="box muted">Click a number to see that point.</div>`;
  $$("[data-rule]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-rule]").forEach((x) => x.classList.toggle("picked", x === b));
    const r = g.rules[Number(b.dataset.rule) - 1];
    const pt = a.first + r.n - 1;
    const tests = r.tests.map((t) => {
      const tr = r.test_results[t];
      const s = !tr ? "not run yet" : tr.ok === true ? "PASS" : tr.ok === false ? "FAIL" : "skipped";
      return `<div class="mono">${esc(t)}: ${s}</div>`;
    }).join("") || "<div>No test (later stage).</div>";
    $("#rule-detail").innerHTML = `<div><b style="color:var(--text)">Point ${pt}:</b> The ${esc(subject)} system must ${esc(r.text)}</div>
      <div style="margin-top:8px"><b style="color:var(--text)">${r.mode === "real" ? "Built in Stage 1" : r.mode === "guided" ? "Guided (never counted)" : "Later: " + esc(r.stage_name)}</b> &middot; ${esc(r.how)}</div>
      <div style="margin-top:8px">${a.started ? "" : "This area isn't built yet, so this point stays grey even if the core rule works.<br>"}${tests}</div>`;
  }));
  $("#drawer").classList.remove("hidden");
}

async function runTests() {
  const e2e = $("#st-e2e").checked;
  try {
    await api("/api/selftest", { e2e });
    S.testRun = {};
    $("#run-tests").disabled = true;
    $("#run-tests").textContent = "Running...";
    toast("Self-tests started. They use a fake Claude on this PC: $0, no usage.", "ok");
  } catch (e) { toast(e.message, "bad"); }
}
function onTestProgress(name, result) {
  if (!S.testRun) S.testRun = {};
  S.testRun[name] = result;
  if (S.tab === "status" && S.status) {
    S.status.selftest_results = Object.assign({}, S.status.selftest_results, { [name]: result });
    renderStatus();
  }
}
function onTestsDone(summary) {
  $("#run-tests").disabled = false;
  $("#run-tests").textContent = "Run self-tests";
  S.testRun = null;
  if (summary.error) toast("Self-tests crashed: " + summary.error, "bad", 10000);
  else toast(`Self-tests done: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`, summary.failed ? "bad" : "ok", 8000);
  if (S.tab === "status") loadStatus();
}

/* ---------------------------------------------------------------- logs */
let logTimer = null;
function debounceLogs() { clearTimeout(logTimer); logTimer = setTimeout(loadLogs, 700); }
async function loadLogs() {
  const day = $("#log-day").value, q = $("#log-q").value.trim(), kinds = $("#log-kind").value;
  const params = new URLSearchParams({ limit: "400" });
  if (day) params.set("day", day);
  if (q) params.set("q", q);
  if (kinds) params.set("kinds", kinds);
  let d;
  try { d = await api(`/api/logs?${params}`); } catch (e) { toast(e.message, "bad"); return; }
  const sel = $("#log-day");
  const cur = sel.value;
  sel.innerHTML = `<option value="">All days</option>` + d.days.slice().reverse().map((x) => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
  const body = $("#log-table tbody");
  body.innerHTML = d.entries.map((e, i) => `<tr class="row" data-i="${i}"><td class="t">${esc(new Date(e.ts).toLocaleTimeString())}</td><td class="k">${esc(e.kind)}</td>
    <td class="t">${esc(e.task ? e.task.slice(-4) : "")}</td><td class="d">${esc(summaryOf(e))}</td></tr>`).join("") ||
    `<tr><td colspan="4" class="muted">Nothing found.</td></tr>`;
  $$("tr.row", body).forEach((tr) => tr.addEventListener("click", () => {
    const e = d.entries[Number(tr.dataset.i)];
    $("#drawer-body").innerHTML = `<h2 style="margin-top:0">${esc(e.kind)} <span class="muted" style="font-weight:400">#${e.seq}</span></h2>
      <div class="kv"><div>Time</div><div>${esc(new Date(e.ts).toLocaleString())}</div><div>Task</div><div class="mono">${esc(e.task || "-")}</div>
      <div>Hash</div><div class="mono">${esc(e.h.slice(0, 24))}...</div></div><h2>Data</h2><div class="json">${esc(JSON.stringify(e.data, null, 2))}</div>`;
    $("#drawer").classList.remove("hidden");
  }));
}
function summaryOf(e) {
  const d = e.data || {};
  if (e.kind === "tool_result") return `${d.tool} ${d.ok ? "ok" : "FAILED"} (${d.ms} ms) ${String(d.output || "").slice(0, 120)}`;
  if (e.kind === "task_start") return d.request;
  if (e.kind === "task_end") return `${d.status}: ${d.reason || ""}`;
  if (e.kind === "settings_changed") return Object.entries(d.changes || {}).map(([k, v]) => `${k}: ${JSON.stringify(v[0])} -> ${JSON.stringify(v[1])}`).join(", ");
  if (e.kind === "card_answered") return `${d.kind} "${d.title}": ${d.status}${d.note ? ` (${d.note})` : ""}`;
  return JSON.stringify(d).slice(0, 180);
}
async function verifyLogs() {
  const out = $("#log-verify-out");
  try {
    const v = await api("/api/logs/verify");
    out.className = v.ok ? "good" : "badv";
    out.textContent = v.ok ? `Chain OK: ${v.entries} entries in ${v.files} file(s), nothing changed or removed.${v.warning ? " (" + v.warning + ")" : ""}`
      : `Chain BROKEN at ${v.broken_at}: ${v.reason}`;
  } catch (e) { out.className = "badv"; out.textContent = e.message; }
}

/* ---------------------------------------------------------------- tools */
function renderTools() {
  const tools = (S.state && S.state.tools) || [];
  $("#tools-body").innerHTML = tools.map((t) => {
    const props = (t.schema && t.schema.properties) || {};
    const form = t.risk === "read" ? `<form data-tool="${esc(t.name)}">${Object.entries(props).map(([k, p]) =>
      `<input name="${esc(k)}" placeholder="${esc(k)}${p.default !== undefined ? " (" + p.default + ")" : ""}" ${p.type === "integer" ? 'type="number"' : ""} ${(t.schema.required || []).includes(k) ? "required" : ""}>`).join("")}
      <button class="primary">Run</button><button type="button" class="ghost" data-test="${esc(t.selftest)}">Self-test</button></form><div class="out hidden"></div>`
      : `<div class="btns" style="margin-top:8px"><button type="button" class="ghost" data-test="${esc(t.selftest)}">Self-test</button><span class="muted">Only Claude can use this one (with your Yes when needed).</span></div>`;
    return `<div class="tool"><div class="tool-head"><b>${esc(t.title)}</b><span class="mono muted">${esc(t.name)}</span>
      <span class="risk ${esc(t.risk === "depends on inputs" ? "write" : t.risk)}">${esc(t.risk === "depends on inputs" ? "Write or change" : RISK[t.risk] || t.risk)}</span>
      <span class="chip">${esc(t.status)}</span>${t.network ? `<span class="chip">uses internet</span>` : `<span class="chip">offline</span>`}</div>
      <div class="desc">${esc(t.description)}</div><ul>${t.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${form}</div>`;
  }).join("");
  $$("form[data-tool]").forEach((f) => f.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const args = {};
    const tool = tools.find((t) => t.name === f.dataset.tool);
    for (const inp of $$("input", f)) {
      if (!inp.value) continue;
      const p = tool.schema.properties[inp.name] || {};
      args[inp.name] = p.type === "integer" ? Number(inp.value) : inp.value;
    }
    const out = f.nextElementSibling;
    out.classList.remove("hidden");
    out.textContent = "Running...";
    try { const r = await api("/api/tools/run", { tool: f.dataset.tool, args }); out.textContent = r.text; }
    catch (e) { out.textContent = e.message; }
  }));
  $$("[data-test]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/api/selftest", { e2e: true, only: [b.dataset.test] }); toast(`Running ${b.dataset.test}...`, "", 3000); }
    catch (e) { toast(e.message, "bad"); }
  }));
}

/* ---------------------------------------------------------------- settings */
function renderSettings() {
  const s = S.state.settings, models = S.state.models;
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  const modelOpts = Object.entries(models).map(([k, v]) => opt(k, v, s.model)).join("");
  const fbOpts = opt("", "None (tell me instead)", s.fallback_model) + Object.entries(models).map(([k, v]) => opt(k, v, s.fallback_model)).join("");
  const num = (k, step, min, max) => `<input type="number" data-k="${k}" value="${s[k]}" step="${step}" min="${min}" max="${max}">`;
  const locked = { destructive: 1, external: 1, money: 1 };
  const permRows = ["read", "write", "destructive", "external", "money"].map((r) => `<div class="perm"><span>${esc(RISK[r])}</span>
    ${["auto", "ask", "block"].map((p) => `<label><input type="radio" name="perm-${r}" value="${p}" ${s.permissions[r] === p ? "checked" : ""} ${locked[r] && p === "auto" ? "disabled" : ""}> ${p}</label>`).join("")}
    <span class="lock">${locked[r] ? "locked: can never be auto" : ""}</span></div>`).join("");
  $("#settings-body").innerHTML = `
    <div class="st-sec"><h3>Brain (Claude)</h3>
      <div class="row2"><label>Model</label><select data-k="model">${modelOpts}</select></div>
      <div class="row2"><label>Backup model if Claude is busy</label><select data-k="fallback_model">${fbOpts}</select></div>
      <div class="row2"><label>Thinking effort</label><select data-k="effort">${Object.entries(EFFORT).map(([k, v]) => opt(k, v, s.effort)).join("")}</select></div>
      <div class="row2"><label>Explanations</label><select data-k="detail">${opt("simple", "Simple (short, easy words)", s.detail)}${opt("normal", "Normal", s.detail)}${opt("deep", "Deep (more detail)", s.detail)}</select></div>
    </div>
    <div class="st-sec"><h3>Limits</h3>
      <div class="row2"><label>Max steps per task</label>${num("max_steps", 1, 1, 200)}</div>
      <div class="row2"><label>Max minutes per task</label>${num("max_minutes", 1, 1, 240)}</div>
      <div class="row2"><label>Usage cap per task ($ API-equivalent)</label>${num("task_budget_usd", 0.05, 0.05, 100)}</div>
      <div class="row2"><label>Usage cap per day ($ API-equivalent)</label>${num("daily_budget_usd", 0.5, 0.1, 1000)}</div>
      <div class="hint row2"><span></span><span class="hint">Your claude.ai plan isn't charged per message; this is Claude Code's estimate, used as a brake.</span></div>
      <div class="row2"><label>Pause new tasks at Claude usage %</label>${num("pause_at_usage_pct", 1, 10, 100)}</div>
    </div>
    <div class="st-sec"><h3>Permissions</h3>${permRows}
      <div class="muted" style="margin-top:10px;font-size:12.5px">auto = just do it &middot; ask = Yes/No card &middot; block = never. OVERDRIVE can't change these itself; every change is logged.</div></div>
    <div class="st-sec"><h3>Safety</h3>
      <div class="row2"><label>Network (lets Claude think)</label><label class="switch"><input type="checkbox" data-k="network" ${s.network ? "checked" : ""}> on</label></div>
      <div class="row2"><label>Second check by a fresh Claude</label><label class="switch"><input type="checkbox" data-k="double_check" ${s.double_check ? "checked" : ""}> for tasks that changed files</label></div>
      <div class="row2"><label>Auto-No after (minutes)</label>${num("approval_timeout_min", 1, 1, 120)}</div>
    </div>
    <div class="st-sec"><h3>Claude Code</h3>
      <div class="row2"><label>Path</label><input data-k="cli_path" value="${esc(s.cli_path)}" placeholder="${esc((S.setup && S.setup.cli) || "auto-detect")}"></div>
      <div class="btns"><button class="ghost" id="set-check">Check again</button><button class="ghost" id="set-setup">Open setup</button></div></div>
    <div class="st-sec"><h3>Your data</h3><div class="muted mono" style="margin-bottom:10px">${esc(S.state.home)}</div>
      <div class="btns"><button class="ghost" data-open="workspace">Open workspace</button><button class="ghost" data-open="versions">Old versions</button>
        <button class="ghost" data-open="logs">Logs folder</button><button class="ghost" id="export">Export everything (zip)</button>
        <button class="danger" id="quit">Quit OVERDRIVE</button></div></div>`;
  $("#set-check").addEventListener("click", () => checkSetup(true));
  $("#set-setup").addEventListener("click", () => { $("#setup").classList.remove("hidden"); renderSetup(); });
  $$("[data-open]").forEach((b) => b.addEventListener("click", async () => { try { await api("/api/open", { what: b.dataset.open }); } catch (e) { toast(e.message, "bad"); } }));
  $("#export").addEventListener("click", async () => {
    try { const r = await api("/api/export", {}); toast(`Saved ${r.name} in the exports folder.`, "ok", 9000); await api("/api/open", { what: "exports" }); }
    catch (e) { toast(e.message, "bad"); }
  });
  $("#quit").addEventListener("click", async () => {
    if (!confirm("Quit OVERDRIVE? (Open OVERDRIVE.exe to start it again.)")) return;
    try { await api("/api/quit", {}); } catch (e) { /* closing */ }
    document.body.innerHTML = `<div class="empty"><h1>OVERDRIVE is closed</h1><p>You can close this window.</p></div>`;
  });
}

async function saveSettings() {
  const s = S.state.settings;
  const changes = {};
  $$("#settings-body [data-k]").forEach((el) => {
    const k = el.dataset.k;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") v = k.endsWith("_usd") ? Number(v) : parseInt(v, 10);
    if (JSON.stringify(v) !== JSON.stringify(s[k])) changes[k] = v;
  });
  const perms = {};
  for (const r of ["read", "write", "destructive", "external", "money"]) {
    const sel = $(`input[name="perm-${r}"]:checked`);
    if (sel && sel.value !== s.permissions[r]) perms[r] = sel.value;
  }
  if (Object.keys(perms).length) changes.permissions = perms;
  if (!Object.keys(changes).length) { $("#set-msg").textContent = "Nothing changed."; return; }
  try {
    const r = await api("/api/settings", { changes });
    S.state.settings = r.settings;
    const list = Object.entries(r.changed).map(([k, v]) => `${k}: ${JSON.stringify(v[0])} → ${JSON.stringify(v[1])}`).join(", ");
    $("#set-msg").textContent = "Saved.";
    toast("Saved: " + list, "ok", 7000);
    renderModelChip();
    renderSettings();
  } catch (e) { toast(e.message, "bad", 9000); }
}

/* ---------------------------------------------------------------- task details + undo + rerun */
async function showDetails(id) {
  const t = S.tasks.get(id);
  let logs = [];
  try { logs = (await api(`/api/logs?task=${encodeURIComponent(id)}&limit=300`)).entries; } catch (e) { /* ignore */ }
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Task ${esc(id)}</h2>
    <div class="kv"><div>Status</div><div>${esc(WORDS[t.status] || t.status)}: ${esc(t.status_reason)}</div><div>Model</div><div>${esc(t.model || "-")}</div>
    <div>Claude Code</div><div>${esc(t.cli_version || "-")}</div><div>Session</div><div class="mono">${esc(t.session_id || "-")}</div>
    <div>Settings</div><div class="mono">${esc(JSON.stringify(t.settings))}</div></div>
    ${t.report ? `<h2>Claude's report</h2><div class="json">${esc(JSON.stringify(t.report, null, 2))}</div>` : ""}
    <h2>Every step (audit log)</h2>${logs.slice().reverse().map((e) => `<div class="mono" style="margin:3px 0"><span class="muted">${esc(new Date(e.ts).toLocaleTimeString())}</span> <span style="color:var(--accent2)">${esc(e.kind)}</span> ${esc(summaryOf(e))}</div>`).join("")}`;
  $("#drawer").classList.remove("hidden");
}

async function undoTask(id) {
  if (!confirm("Undo every change this task made? Old versions come back; new files move to the versions folder (nothing is deleted).")) return;
  try { const r = await api("/api/undo", { task: id }); upsertTask(r.task); toast("Undone.", "ok"); } catch (e) { toast(e.message, "bad"); }
}

/* ---------------------------------------------------------------- wiring */
function bindUI() {
  $$("#nav button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $("#new-chat").addEventListener("click", newChat);
  $("#composer").addEventListener("submit", (e) => { e.preventDefault(); send($("#msg").value); });
  $("#msg").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("#msg").value); } });
  $("#msg").addEventListener("input", autoGrow);
  $("#stop").addEventListener("click", stop);
  $$(".ex").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
  $("#feed").addEventListener("click", (e) => {
    const u = e.target.closest("[data-undo]"), d = e.target.closest("[data-details]"), r = e.target.closest("[data-rerun]");
    if (u) undoTask(u.dataset.undo);
    if (d) showDetails(d.dataset.details);
    if (r) { const t = S.tasks.get(r.dataset.rerun); if (t) send(t.request); }
  });
  $("#run-tests").addEventListener("click", runTests);
  $("#log-verify").addEventListener("click", verifyLogs);
  $("#log-day").addEventListener("change", loadLogs);
  $("#log-kind").addEventListener("change", loadLogs);
  $("#log-q").addEventListener("input", debounceLogs);
  $("#save-settings").addEventListener("click", saveSettings);
  $("#drawer-x").addEventListener("click", () => $("#drawer").classList.add("hidden"));
  $("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") $("#drawer").classList.add("hidden"); });
  $("#brain-line").addEventListener("click", () => { if (S.setup && !S.setup.ready) { $("#setup").classList.remove("hidden"); renderSetup(); } });
  $("#setup-recheck").addEventListener("click", () => checkSetup(true));
  $("#setup-skip").addEventListener("click", () => { S.offlineOK = true; $("#setup").classList.add("hidden"); switchTab("tools"); });
  $("#setup-go").addEventListener("click", () => $("#setup").classList.add("hidden"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#drawer").classList.add("hidden"); });
}

boot();
