"use strict";
/* OVERDRIVE window. Plain JavaScript, no outside libraries (works offline). */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WORDS = { running: "Working", done: "Done", partly: "Partly done", failed: "Failed", blocked: "Blocked" };
const RISK = { internal: "Bookkeeping", read: "Read", web: "Look things up online", write: "Write / edit in workspace", run: "Run programs", destructive: "Change / replace", external: "Send off PC", money: "Spend money", invalid: "Bad inputs" };
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
  if (typeof P4 !== "undefined") P4.sound(kind === "bad" ? "error" : "toast");
  setTimeout(() => t.remove(), ms);
}

/* ---------------------------------------------------------------- answers (md.js: safe markdown + copy pieces) */
function md(text) { return OD_MD.render(text, { pieces: false }).html; }
const PIECES = new Map();          // task id -> the pieces its numbered copy buttons copy
const numbersOn = () => !S.state || !S.state.settings || S.state.settings.copy_numbers !== false;
function answerHtml(t) {
  const on = numbersOn();
  const r = OD_MD.render(t.final_text, { pieces: on });
  PIECES.set(t.id, r.pieces);
  return `<div class="answer${on ? " numbered" : ""}" data-answer="${esc(t.id)}">${r.html}</div>`;
}
function piecesOf(id) {
  if (!PIECES.has(id)) { const t = S.tasks.get(id); PIECES.set(id, t ? OD_MD.render(t.final_text, { pieces: true }).pieces : []); }
  return PIECES.get(id);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* older window: fall back */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}
function flashPieces(id, nums) {
  const box = $(`[data-answer="${CSS.escape(id)}"]`);
  if (!box) return;
  for (const n of nums) {
    const el = $(`[data-pc="${n}"]`, box);
    if (!el) continue;
    el.classList.remove("copied"); void el.offsetWidth; el.classList.add("copied");
    setTimeout(() => el.classList.remove("copied"), 1300);
  }
}
async function copyPieces(id, nums) {
  const pieces = piecesOf(id);
  const text = nums.map((n) => (pieces[n - 1] || {}).text || "").filter(Boolean).join("\n\n");
  if (!text) return false;
  const ok = await copyText(text);
  if (ok) flashPieces(id, nums); else toast("Windows didn't let OVERDRIVE use the clipboard. Try again.", "bad");
  return ok;
}
function lastAnswer() {
  const done = Array.from(S.tasks.values()).filter((t) => t.status !== "running" && (t.final_text || "").trim());
  done.sort((a, b) => a.created.localeCompare(b.created));
  return done[done.length - 1] || null;
}
const listWords = (nums) => (nums.length === 1 ? `piece ${nums[0]}` : `pieces ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`);
// "copy 1 and 2" / "copy 2-4" / "copy all" / "copy code": copies from the last answer, never goes to Claude (no usage).
async function copyCommand(text) {
  if (!/^\s*copy\b/i.test(text)) return false;
  const last = lastAnswer();
  if (!last) return false;
  const pieces = piecesOf(last.id);
  const r = OD_MD.parseCopy(text, pieces);
  if (!r) return false;
  if (!r.idx.length) { toast(`The last answer has no ${r.missing.join(", ")} (it has ${pieces.length} piece${pieces.length === 1 ? "" : "s"}).`, "warn", 7000); return true; }
  if (await copyPieces(last.id, r.idx)) {
    const miss = r.missing.length ? ` There's no ${r.missing.join(", ")} (it has ${pieces.length}).` : "";
    toast(`Copied ${listWords(r.idx)}. No usage used.${miss}`, miss ? "warn" : "ok", 6000);
    $("#msg").value = ""; autoGrow();
  }
  return true;
}

/* ---------------------------------------------------------------- pictures + the big picture view */
const picUrl = (p) => `/pic/${encodeURIComponent(p.file)}?k=${encodeURIComponent(S.token)}`;
function picsHtml(t) {
  const pics = (t.pictures || []).filter((p) => p && p.file);
  if (!pics.length) return "";
  const caps = [...new Set(pics.map((p) => p.caption).filter(Boolean))];
  return `<div class="pics-wrap">${caps.length ? `<div class="pics-cap">${esc(caps.join(" / "))}</div>` : ""}<div class="pics n${Math.min(pics.length, 4)}">${pics.map((p, i) =>
    `<figure class="pic" data-pic="${esc(t.id)}" data-i="${i}" tabindex="0" title="${esc(p.title)}"><img src="${picUrl(p)}" alt="${esc(p.title)}" loading="lazy"><figcaption>${esc(p.title)}</figcaption></figure>`).join("")}</div></div>`;
}
const LB = { pics: [], i: 0 };
function openPicture(taskId, i) {
  const t = S.tasks.get(taskId);
  LB.pics = ((t && t.pictures) || []).filter((p) => p && p.file);
  if (!LB.pics.length) return;
  LB.i = Math.max(0, Math.min(LB.pics.length - 1, i));
  showPicture();
  $("#lightbox").classList.remove("hidden");
}
function showPicture() {
  const p = LB.pics[LB.i];
  $("#lb-img").src = picUrl(p);
  $("#lb-img").alt = p.title || "";
  const who = p.creator ? ` by ${esc(p.creator)}` : "";
  const src = p.page && /^https:\/\//.test(p.page) ? ` &middot; <a href="${esc(p.page)}" target="_blank" rel="noopener noreferrer">Source page</a>` : "";
  $("#lb-cap").innerHTML = `<b>${esc(p.title)}</b>${who}<span class="muted"> &middot; ${esc(p.license || "")} &middot; ${esc(p.source || "")}</span>${src}` +
    ` &middot; <a href="${picUrl(p)}" download="${esc((p.title || "picture").replace(/[^\w .-]+/g, "").slice(0, 60) || "picture")}.${esc(p.file.split(".").pop())}">Save picture</a>` +
    `<span class="muted"> &middot; ${LB.i + 1} / ${LB.pics.length}</span>`;
  $("#lb-prev").classList.toggle("hidden", LB.pics.length < 2);
  $("#lb-next").classList.toggle("hidden", LB.pics.length < 2);
}
function stepPicture(d) { if (LB.pics.length > 1) { LB.i = (LB.i + d + LB.pics.length) % LB.pics.length; showPicture(); } }
const closePicture = () => { $("#lightbox").classList.add("hidden"); $("#lb-img").removeAttribute("src"); };

/* live answers: rendered as they stream in (at most ~12 times a second) */
const liveTimers = new Map();
function paintLive(id) {
  if (liveTimers.has(id)) return;
  liveTimers.set(id, setTimeout(() => {
    liveTimers.delete(id);
    const el = $(`#live-${id}`);
    if (el) { el.innerHTML = md(S.live.get(id) || ""); autoScroll(); }
  }, 80));
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
  P3.state(st);
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
    case "conversation": {
      const list = S.state.conversations || [];
      const c = list.find((x) => x.id === ev.conversation.id);
      const oldTitle = c && c.title;
      if (c) Object.assign(c, ev.conversation); else list.unshift(ev.conversation);
      if (!c || oldTitle !== ev.conversation.title) renderChats();
      if (ev.conversation.id === S.conv) $("#chat-title").textContent = ev.conversation.title || "Chat";
      renderMode();
      try { renderModelChip(); } catch (e) { /* not ready yet */ }
      break;
    }
    case "delta": {
      S.live.set(ev.task, (S.live.get(ev.task) || "") + ev.text);
      paintLive(ev.task);
      P3.onDelta(ev);
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
    case "setup": {
      S.setup = ev.setup; renderBrain(); renderSetup();
      if (ev.setup && ev.setup.ready) {
        const was = !$("#setup").classList.contains("hidden");
        $("#setup").classList.add("hidden");
        if (was || ev.account) { toast(`Signed in${ev.plan ? ` (${ev.plan})` : ""}. You're good to go.`, "ok", 6000); P4.sound("success"); }
        P3.maybeTour();
      } else if (ev.setup && ev.ok === false) toast(ev.setup.problem || "Signed in, but this account can't be used yet.", "warn", 12000);
      break;
    }
    default: P3.event(ev); break;
  }
}

/* ---------------------------------------------------------------- chats */
const PENCIL = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M11.3 2.3l2.4 2.4-8 8-3.1.7.7-3.1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const BIN = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
function chatRow(c, snippet) {
  const row = document.createElement("div");
  row.className = "chat-row" + (c.id === S.conv ? " on" : "");
  row.dataset.chat = c.id;
  row.innerHTML = `<button class="chat-item" title="${esc(c.title)}">${esc(c.title || "Chat")}${snippet ? `<span class="snip">${esc(snippet)}</span>` : ""}</button>
    <span class="chat-acts"><button class="ic-btn" data-done title="${c.done ? "Bring back from Done" : "Move to the Done folder"}">${c.done ? UNDONE : DONEI}</button><button class="ic-btn" data-ren title="Rename">${PENCIL}</button><button class="ic-btn" data-del title="Delete">${BIN}</button></span>`;
  $(".chat-item", row).addEventListener("click", () => { switchTab("chat"); openConversation(c.id); });
  $("[data-done]", row).addEventListener("click", (e) => { e.stopPropagation(); P3.chatDone(c.id, !c.done); });
  $("[data-ren]", row).addEventListener("click", (e) => { e.stopPropagation(); renameChat(c.id); });
  $("[data-del]", row).addEventListener("click", (e) => { e.stopPropagation(); deleteChat(c.id); });
  return row;
}
const DONEI = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2 5h12v8H2zM2 5l1.5-2.5h9L14 5M6 8.5l1.5 1.5L10.5 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const UNDONE = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.6M3 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function renderChats() {
  if (S.chatHits) return renderChatHits();
  const box = $("#chats");
  const convs = (S.state && S.state.conversations) || [];
  const live = convs.filter((c) => !c.done), done = convs.filter((c) => c.done);
  box.innerHTML = live.length ? "" : `<div class="muted" style="padding:6px 10px;font-size:12.5px">${done.length ? "All chats are in Done" : "No chats yet"}</div>`;
  for (const c of live) box.appendChild(chatRow(c));
  if (done.length) {
    const head = document.createElement("button");
    head.className = "done-head" + (S.doneOpen ? " open" : "");
    head.innerHTML = `<span class="tri"></span>Done <span class="muted">${done.length}</span>`;
    head.addEventListener("click", () => { S.doneOpen = !S.doneOpen; renderChats(); });
    box.appendChild(head);
    if (S.doneOpen) for (const c of done) { const r = chatRow(c); r.classList.add("is-done"); box.appendChild(r); }
  }
  P3.renderImported(box);
}
function renderChatHits() {
  const box = $("#chats");
  box.innerHTML = S.chatHits.length || (P3.imp.hits || []).length ? "" : `<div class="muted" style="padding:6px 10px;font-size:12.5px">Nothing found</div>`;
  for (const h of S.chatHits) box.appendChild(chatRow(h, h.snippet));
  P3.renderImportedHits(box);
}
let chatQTimer = null;
function searchChats() {
  clearTimeout(chatQTimer);
  const q = $("#chat-q").value.trim();
  if (!q) { S.chatHits = null; P3.imp.hits = []; renderChats(); return; }
  P3.searchImported(q);
  const low = q.toLowerCase();                             // names first, right away; then what was said, from the PC
  S.chatHits = ((S.state && S.state.conversations) || []).filter((c) => (c.title || "").toLowerCase().includes(low)).map((c) => ({ id: c.id, title: c.title }));
  renderChatHits();
  chatQTimer = setTimeout(async () => {
    try {
      const d = await api(`/api/chat/search?q=${encodeURIComponent(q)}`);
      if ($("#chat-q").value.trim() === q) { S.chatHits = d.hits; renderChatHits(); }
    } catch (e) { /* keep the name matches */ }
  }, 250);
}
function renameChat(id) {
  const c = ((S.state && S.state.conversations) || []).find((x) => x.id === id);
  let row = $(`.chat-row[data-chat="${CSS.escape(id)}"]`);
  if (c && !row && S.chatHits) { $("#chat-q").value = ""; S.chatHits = null; renderChats(); row = $(`.chat-row[data-chat="${CSS.escape(id)}"]`); }
  if (!c || !row) return;
  const inp = document.createElement("input");
  inp.className = "chat-rename"; inp.value = c.title || ""; inp.maxLength = 80;
  row.replaceChildren(inp);
  inp.focus(); inp.select();
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const title = inp.value.trim();
    if (save && title && title !== c.title) {
      try {
        const r = await api("/api/chat/rename", { conversation: id, title });
        Object.assign(c, r.conversation);
        (S.chatHits || []).forEach((h) => { if (h.id === id) h.title = c.title; });
        if (S.conv === id) $("#chat-title").textContent = c.title;
        toast("Renamed.", "ok", 2000);
      } catch (e) { toast(e.message, "bad"); }
    }
    renderChats();
  };
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } if (e.key === "Escape") { e.stopPropagation(); finish(false); } });
  inp.addEventListener("blur", () => finish(true));
}
async function deleteChat(id) {
  const c = ((S.state && S.state.conversations) || []).find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Delete the chat "${c.title}"?\n\nIts messages are removed for good. Files it made stay in the workspace, and the log keeps a record.`)) return;
  try {
    await api("/api/chat/delete", { conversation: id });
    S.state.conversations = S.state.conversations.filter((x) => x.id !== id);
    if (S.chatHits) S.chatHits = S.chatHits.filter((x) => x.id !== id);
    if (S.conv === id) newChat(); else renderChats();
    toast("Chat deleted.", "ok", 2500);
  } catch (e) { toast(e.message, "bad"); }
}

async function openConversation(id, quiet) {
  P3.leaveImported();
  if (id !== S.conv) { P3.saveDraft(); P3.draftFor = undefined; }
  S.conv = id;
  renderMode();
  try { renderModelChip(); } catch (e) { /* not ready yet */ }
  try {
    const d = await api(`/api/conversation/${encodeURIComponent(id)}`);
    S.tasks = new Map(d.tasks.map((t) => [t.id, t]));
    $("#chat-title").textContent = d.conversation.title || "Chat";
    const known = (S.state.conversations || []).find((x) => x.id === id);
    if (known) Object.assign(known, d.conversation);
  } catch (e) {
    if (!quiet) toast(e.message, "bad");
    S.tasks = new Map();
  }
  renderChats();
  renderFeed();
  if (P3.draftFor === undefined) { $("#msg").value = ""; P3.loadDraft(); autoGrow(); }
}

function newChat() {
  if (S.state && S.state.current && !S.state.current.background) { toast("Wait until the running task is finished (or press STOP).", "warn"); return; }
  P3.leaveImported();
  P3.saveDraft();
  S.conv = null;
  $("#msg").value = ""; P3.loadDraft();
  S.tasks = new Map();
  $("#chat-title").textContent = "New chat";
  S.nextMode = null;
  renderMode();
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
  if (t.rewound) { S.tasks.delete(t.id); const n = $(`#turn-${t.id}`); if (n) n.remove(); return; }
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
  const before = S.tasks.get(t.id);
  if (before && before.status === "running" && t.status !== "running") P4.taskFinished(t);
  if (t.conversation === S.conv) {
    S.tasks.set(t.id, t);
    const old = $(`#turn-${t.id}`);
    const node = turnNode(t);
    if (old) old.replaceWith(node); else { node.classList.add("fresh"); $("#empty").classList.add("hidden"); $("#feed").appendChild(node); }
    renderCards();
    autoScroll();
  }
  updateRunning();
  if (t.status !== "running" && S.tab === "status") loadStatus();
  P3.onTask(t);
}

function renderFeed() {
  const feed = $("#feed");
  $$(".turn", feed).forEach((n) => n.remove());
  const tasks = Array.from(S.tasks.values()).filter((t) => !t.rewound).sort((a, b) => a.created.localeCompare(b.created));
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
    const what = c.args && c.args.search ? ` <span class="mono">${esc(c.args.search)}</span>` : c.args && c.args.path ? ` <span class="mono">${esc(c.args.path)}</span>` : c.args && c.args.expression ? ` <span class="mono">${esc(c.args.expression)}</span>` : "";
    return `<div class="step">${icon}<div>${esc(c.title || c.tool)}${what}${tag}${c.ok === null ? ` <span class="muted">${esc(c.summary)}</span>` : ""}</div><span>${c.ms ? c.ms + " ms" : ""}</span></div>`;
  }).join("")}</div>`;
}

function turnNode(t) {
  const wrap = document.createElement("div");
  wrap.className = "turn" + (t.status === "running" ? " working" : "");
  wrap.id = `turn-${t.id}`;
  const running = t.status === "running";
  const head = running
    ? `<span class="spin"></span><span class="badge running">Working</span><span class="od-reason">${t.plan ? "Following its plan" : "Planning"}...</span>`
    : `<span class="badge ${esc(t.status)}">${esc(WORDS[t.status] || t.status)}</span><span class="od-reason">${esc(t.status_reason)}</span>`;
  const answer = running
    ? `<div class="answer live-md" id="live-${t.id}">${md(S.live.get(t.id) || "")}</div>`
    : (t.final_text ? answerHtml(t) : "");
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
      ${t.final_text ? `<button class="ghost" data-copyall="${t.id}" title="Copy the whole answer">Copy</button>` : ""}<button class="ghost" data-details="${t.id}">Details</button><button class="ghost" data-rerun="${t.id}" title="Send the same message again">${t.status !== "done" ? "Try again" : "Ask again"}</button></div>`;
  const mine = t.request.startsWith("GO. I said Yes") ? "" : `<div class="me-acts"><button class="ghost xs" data-edit="${t.id}" title="Put this message back in the box to change it">Edit</button><button class="ghost xs" data-copyreq="${t.id}">Copy</button></div>`;
  const meBubble = t.background
    ? `<div class="me-auto"><details><summary>It started this by itself while you were away (learning, capped by your setting)</summary><pre>${esc(t.request)}</pre></details></div>`
    : `<div class="me">${P3.meExtras(t)}<div>${esc(t.request)}</div></div>${mine}`;
  wrap.innerHTML = `${meBubble}
    <div class="od"><div class="od-head">${head}</div>${critList(t)}${stepsList(t)}${picsHtml(t)}${answer}${P3.turnExtras(t)}${err}${changes}${undone}${flagHtml}${checks}
      <div class="cards-slot" data-task="${t.id}"></div>${foot}</div>`;
  P3.decorate(wrap, t);
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
    } else if (p.plan !== undefined) {
      // "Ready to build?": the plan, the steps, and the model + effort it wants
      prev = `<div class="build-plan"><div>${esc(p.plan)}</div>
        ${(p.steps || []).length ? `<ol>${p.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
        <div class="muted">Model: <b>${esc(p.model || "")}</b>${p.now && p.now !== p.model ? ` (now: ${esc(p.now)})` : ""}</div>
        ${p.usage_guess ? `<div class="usage-guess">${esc(p.usage_guess)}</div>` : ""}
        ${p.note ? `<div class="muted">${esc(p.note)}</div>` : ""}</div>`;
    } else if (p.command !== undefined) {
      prev = `${p.what ? `<div class="muted">${esc(p.what)}</div>` : ""}<div class="prev mono">${esc(p.command)}</div>`;
    } else if (p.edits) {
      prev = `<div class="prev">${p.edits.map((e) => `<span class="del">- ${esc(e.old)}</span>\n<span class="add">+ ${esc(e.new)}</span>`).join("\n\n")}</div>`;
    } else if (p.url || p.query) {
      prev = `<div class="prev mono">${esc(p.url || p.query)}</div>`;
    } else if (p.content_preview !== undefined || p.old_title !== undefined) {
      // memory: what it wants to save / change
      prev = `<div class="prev">${p.kind ? `<b>${esc(P3.kindName(p.kind))}</b>: ` : ""}${esc(p.title || p.new_title || "")}${p.old_title && p.old_title !== p.new_title ? `\n(was: ${esc(p.old_title)})` : ""}${p.content_preview ? "\n\n" + esc(p.content_preview) : ""}</div>`;
    } else if (p.inputs) {
      prev = `<div class="prev">${esc(JSON.stringify(p.inputs, null, 2))}</div>`;
    }
    const why = p.why ? `<div class="why"><b>Why it asks:</b> ${esc(p.why)}</div>` : "";
    const what = p.path ? `<span class="chip mono">${esc(p.path)}</span><span class="chip">${p.lines ?? "?"} lines</span>` : "";
    el.innerHTML = `<h4>${esc(c.title)}</h4>
      <div class="meta"><span class="risk ${esc(c.risk)}">${esc(b.risk_label || RISK[c.risk] || c.risk)}</span>${what}${b.network ? `<span class="chip">uses internet</span>` : ""}</div>
      ${b.reason ? `<div class="why"><b>Claude's reason:</b> ${esc(b.reason)}</div>` : ""}
      ${why}${prev}
      ${p.reversible ? `<div class="muted">Can it be undone? ${esc(p.reversible)}</div>` : ""}
      <div class="card-actions"><button class="ok" data-yes>Yes, do it</button><button data-no>No</button>
        <input data-note placeholder="Optional note for Claude (why No, or what to change)" maxlength="500">
        <span class="count" data-count></span></div>`;
    if (b.tool === "start_build" && p.plan) {
      const later = document.createElement("button");
      later.textContent = "Schedule it for later"; later.className = "ghost";
      later.addEventListener("click", () => P3.scheduleInstead(c, p));
      $(".card-actions", el).insertBefore(later, $("[data-note]", el));
    }
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
  // a question card needs you: its own sound + the taskbar button blinks if the window is in the back
  P4.sound("needs_you");
  P4.flash();
  P4.notifyNeedsYou();
}

/* ---------------------------------------------------------------- sending + stop */
async function send(text, source) {
  text = (text || "").trim();
  if (!text) return;
  if (await copyCommand(text)) return;
  if (S.setup && !S.setup.ready) { $("#setup").classList.remove("hidden"); renderSetup(); return; }
  // a fast double Enter / double click must send it once, not twice
  const typed = source !== "voice";
  if (typed && S.sending === text) return;
  if (typed) { S.sending = text; if ($("#msg").value.trim() === text) { $("#msg").value = ""; autoGrow(); } }
  $("#send").disabled = true;
  let att = [];
  try {
    // queue: if it's still working, the message waits and goes in right after (Piece 3)
    att = source === "voice" ? [] : P3.takeAttachments();
    const d = await api("/api/send", { text, conversation: S.conv, mode: S.conv ? undefined : (S.nextMode || "chat"), queue: true, source: source || "typed", attachments: att });
    S.nextMode = null;
    if (source !== "voice") { $("#msg").value = ""; autoGrow(); P3.clearDraft(); }
    if (d.queued) { P3.queued(d.queued); $("#send").disabled = false; return; }
    P4.sound("send");
    if (S.conv !== d.task.conversation) { S.conv = d.task.conversation; S.tasks = new Map(); renderFeed(); }
    P3.draftFor = S.conv;            // a new chat got its id: the box now belongs to it
    $("#chat-title").textContent = (S.state.conversations.find((c) => c.id === S.conv) || {}).title || d.task.request.slice(0, 60);
    upsertTask(d.task);
  } catch (e) {
    if (!P4.limitFromError(e.message)) toast(e.message, "bad");
    if (typed && !$("#msg").value) { $("#msg").value = text; autoGrow(); }   // nothing lost
    if (att.length) { P3.att = att.concat(P3.att); P3.paintAtt(); }
  } finally { if (typed) setTimeout(() => { if (S.sending === text) S.sending = null; }, 400); }
  updateRunning();
}

function updateRunning() {
  const running = !!(S.state && S.state.current);
  document.body.classList.toggle("od-working", running);
  $("#stop").classList.toggle("hidden", !running);
  $("#send").disabled = false;
  $("#msg").placeholder = running ? "It's working... you can still type: it goes in right after this step" : "Tell OVERDRIVE what to do...";
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
  const cv = S.conv && ((S.state.conversations || []).find((x) => x.id === S.conv) || {});
  $("#chip-model").textContent = `${(cv && cv.model) || s.model} · effort ${(cv && cv.effort) || s.effort}`;
}

/* ---------------------------------------------------------------- setup */
async function checkSetup(force, quiet) {
  try { S.setup = await api("/api/setup", force ? {} : undefined); } catch (e) { if (!quiet) toast(e.message, "bad"); return; }
  renderBrain();
  if (!S.setup.ready && !S.offlineOK && !quiet) { $("#setup").classList.remove("hidden"); }
  if (S.setup.ready) { $("#setup").classList.add("hidden"); P3.maybeTour(); }
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
      <h3>${signed ? `Signed in${(s.auth || {}).plan ? ` <span class="plan-badge p-${esc(((s.auth || {}).plan || "").split(" ")[0].toLowerCase())}">${esc(s.auth.plan)}</span>` : ""}` : "Sign in with your claude.ai account"}</h3>
      ${signed ? `<div class="muted">${(s.auth || {}).email ? esc(s.auth.email) + " &middot; " : ""}${s.long_token ? "stays signed in for a year" : "normal sign-in"}</div>` : `<div class="muted">${installed ? esc(s.problem || "A window opens, then your browser: pick your claude.ai account (Pro or Max) and press Allow.") : "Do step 1 first."}</div>
      ${installed ? `<div class="btns" style="margin-top:8px"><button class="primary" data-signin>Sign in</button></div>
      <div class="muted wait-line hidden" id="signin-wait"><span class="spin"></span>Waiting for you to press Allow in the browser... it updates by itself.</div>` : ""}`}
    </div></div>
    ${installed ? `<div class="sstep"><div class="n ${s.long_token ? "ok" : ""}">${s.long_token ? "&#10003;" : "3"}</div><div>
      <h3>Stay signed in for a year <span class="muted" style="font-weight:400">(optional, no more codes)</span></h3>
      ${s.long_token ? `<div class="muted">On. You won't be asked to sign in again for about a year.</div>` : `<div class="muted">Normal sign-ins can run out and ask for a code from your email or phone. This makes one long sign-in code instead:
        press the button, press Allow in the browser, then copy the long code the window shows (it starts with <span class="mono">sk-ant-oat</span>) and paste it here. Needs Pro or Max.</div>
      <div class="btns" style="margin-top:8px"><button data-longsignin>Make my year-long code</button></div>
      <div class="imp-row" style="margin-top:8px"><input id="long-code" type="password" placeholder="Paste the code here" autocomplete="off" spellcheck="false"><button class="primary" data-longsave>Save</button></div>`}
    </div></div>` : ""}
    ${removed.length ? `<div class="muted" style="margin-top:8px">Note: OVERDRIVE ignores ${removed.map(esc).join(", ")} on this PC so it can never bill an API account.</div>` : ""}`;
  $$("[data-install]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/api/setup/install", { method: b.dataset.install }); toast("Installer window opened. When it finishes, press Check again.", "ok", 9000); }
    catch (e) { toast(e.message, "bad", 9000); }
  }));
  const si = $("[data-signin]");
  if (si) si.addEventListener("click", async () => {
    try { await api("/api/setup/signin", {}); toast("Sign-in window opened. Press Allow in the browser: OVERDRIVE sees it by itself.", "ok", 7000); $("#signin-wait") && $("#signin-wait").classList.remove("hidden"); }
    catch (e) { toast(e.message, "bad", 9000); }
  });
  const ls = $("[data-longsignin]");
  if (ls) ls.addEventListener("click", async () => {
    try { await api("/api/setup/signin", { long: true }); toast("A window opened. Press Allow in the browser, then copy the long code it shows and paste it here.", "ok", 10000); }
    catch (e) { toast(e.message, "bad", 9000); }
  });
  const lsave = $("[data-longsave]");
  if (lsave) lsave.addEventListener("click", async () => {
    const code = $("#long-code").value.trim();
    if (!code) { toast("Paste the code first.", "warn"); return; }
    try { await api("/api/accounts/action", { action: "long_token", name: (S.state && S.state.accounts && S.state.accounts.active) || "main", token: code });
      $("#long-code").value = ""; toast("Saved. It stays signed in for about a year now.", "ok", 6000); checkSetup(true, true); }
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
  P3.tab(tab);
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
      <div class="muted" style="margin-top:8px;font-size:12.5px">The blueprint = 100 rules &times; 50 areas. Built so far makes <b>${rs.real}</b> rules real (${rs.green} proven right now), <b>${rs.guided}</b> guided, <b>${rs.later}</b> wait for later stages.
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
      <div style="margin-top:8px"><b style="color:var(--text)">${r.mode === "real" ? "Built" : r.mode === "guided" ? "Guided (never counted)" : "Later: " + esc(r.stage_name)}</b> &middot; ${esc(r.how)}</div>
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
  const permRows = ["read", "web", "write", "run", "destructive", "external", "money"].map((r) => `<div class="perm"><span>${esc(RISK[r])}</span>
    ${["auto", "ask", "block"].map((p) => `<label><input type="radio" name="perm-${r}" value="${p}" ${s.permissions[r] === p ? "checked" : ""} ${locked[r] && p === "auto" ? "disabled" : ""}> ${p}</label>`).join("")}
    <span class="lock">${locked[r] ? "locked: can never be auto" : ""}</span></div>`).join("");
  const sw = (k, label) => `<label class="switch"><input type="checkbox" data-k="${k}" ${s[k] !== false ? "checked" : ""}> ${esc(label)}</label>`;
  const picOpts = [["real", "Real pictures (free open photo libraries)"], ["both", "Both (real now, AI-made later)"],
    ["ai", "AI-made only (needs the RTX 3050, not built yet)"], ["off", "Off"]].map(([v, l]) => opt(v, l, s.pictures)).join("");
  $("#settings-body").innerHTML = `
    <div class="set-search"><input id="set-q" type="search" placeholder="Search settings (e.g. pictures, copy, model, usage)..." value="${esc(S.setQ || "")}" autocomplete="off" spellcheck="false"></div>
    <div class="st-sec"><h3>Talking (ChatGPT mode)</h3>
      <div class="row2"><label>Talk like ChatGPT</label>${sw("chat_style", "lists, tables, no rushing to build")}</div>
      <div class="hint row2"><span></span><span class="hint">In Chat mode it digs into your idea, gives options with its own pick, and never pushes "ready to build?". Off = plain answers.</span></div>
      <div class="row2"><label>Pictures</label><select data-k="pictures">${picOpts}</select></div>
      <div class="hint row2"><span></span><span class="hint">It shows pictures of what it's talking about, right in the chat. Real ones come from Openverse + Wikimedia Commons (free, with the source and license). Click a picture to see it big.</span></div>
      <div class="row2"><label>Its own ideas</label>${sw("own_ideas", "\u201cMy ideas:\u201d after plans, option lists and builds")}</div>
      <div class="row2"><label>Copy buttons on answers</label>${sw("copy_numbers", "number + copy button on every piece")}</div>
      <div class="hint row2"><span></span><span class="hint">Every paragraph, list item, table and code block gets a number. Click it to copy, or type \u201ccopy 1 and 2\u201d, \u201ccopy 2-4\u201d, \u201ccopy code\u201d or \u201ccopy all\u201d in the message box (that never uses usage).</span></div>
    </div>
    ${P3.settingsHtml(s, opt, sw, num)}
    <div class="st-sec"><h3>Brain (Claude)</h3>
      <div class="row2"><label>Model</label><select data-k="model">${modelOpts}</select></div>
      <div class="row2"><label>Backup model if Claude is busy</label><select data-k="fallback_model">${fbOpts}</select></div>
      <div class="row2"><label>Thinking effort</label><select data-k="effort">${Object.entries(EFFORT).map(([k, v]) => opt(k, v, s.effort)).join("")}</select></div>
      <div class="row2"><label>Switching model for a big job</label><select data-k="model_switch">${opt("ask", "Show it, I click OK", s.model_switch)}${opt("auto", "Switch by itself (and tell me)", s.model_switch)}</select></div>
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
  $("#set-q").addEventListener("input", (e) => { S.setQ = e.target.value; filterSettings(); });
  filterSettings();
  P4.afterSettings();
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

/* settings search: hides rows that don't match (a hint row stays with the row above it) */
function filterSettings() {
  const q = (S.setQ || "").trim().toLowerCase();
  for (const sec of $$("#settings-body .st-sec")) {
    const head = ($("h3", sec) || {}).textContent || "";
    const secHit = !!q && head.toLowerCase().includes(q);
    let shown = 0, lastShown = false;
    for (const row of $$(":scope > .row2, :scope > .perm, :scope > .btns, :scope > .muted", sec)) {
      const isHint = row.classList.contains("hint");
      const hit = !q || secHit || (isHint ? lastShown : row.textContent.toLowerCase().includes(q) ||
        $$("option", row).some((o) => o.textContent.toLowerCase().includes(q)));
      row.classList.toggle("hidden", !hit);
      if (!isHint) lastShown = hit;
      if (hit) shown++;
    }
    sec.classList.toggle("hidden", !!q && !shown);
  }
}

async function saveSettings() {
  const s = S.state.settings;
  const changes = {};
  $$("#settings-body [data-k]").forEach((el) => {
    const k = el.dataset.k;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") v = k.endsWith("_usd") ? Number(v) : parseInt(v, 10);
    if (el.type === "range") v = Number(v);
    if (el.tagName === "SELECT" && typeof s[k] === "number") v = Number(v);
    if (JSON.stringify(v) !== JSON.stringify(s[k])) changes[k] = v;
  });
  const perms = {};
  for (const r of ["read", "web", "write", "run", "destructive", "external", "money"]) {
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
    if ("copy_numbers" in r.changed) { PIECES.clear(); renderFeed(); }
    P3.applyLooks(r.settings);
    FX.apply(r.settings);
    FX.play("save");
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
  $("#mode").addEventListener("click", toggleMode);
  renderMode();
  $("#msg").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send($("#msg").value); } });
  $("#msg").addEventListener("input", autoGrow);
  $("#stop").addEventListener("click", stop);
  $$(".ex").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
  $("#feed").addEventListener("click", (e) => {
    const u = e.target.closest("[data-undo]"), d = e.target.closest("[data-details]"), r = e.target.closest("[data-rerun]");
    if (u) undoTask(u.dataset.undo);
    if (d) showDetails(d.dataset.details);
    if (r) { const t = S.tasks.get(r.dataset.rerun); if (t) send(t.request); }
    const cp = e.target.closest("[data-copy]");
    if (cp) { const box = cp.closest("[data-answer]"); const n = Number(cp.dataset.copy); if (box) copyPieces(box.dataset.answer, [n]).then((ok) => ok && toast(`Copied piece ${n}.`, "ok", 2200)); }
    const ca = e.target.closest("[data-copyall]");
    if (ca) { const t = S.tasks.get(ca.dataset.copyall); if (t) copyText(t.final_text).then((ok) => toast(ok ? "Copied the whole answer." : "Couldn't copy.", ok ? "ok" : "bad", 2200)); }
    const cr = e.target.closest("[data-copyreq]");
    if (cr) { const t = S.tasks.get(cr.dataset.copyreq); if (t) copyText(t.request).then((ok) => ok && toast("Copied your message.", "ok", 2200)); }
    const ed = e.target.closest("[data-edit]");
    if (ed) P3.startEdit(ed.dataset.edit);
    const pic = e.target.closest("[data-pic]");
    if (pic) openPicture(pic.dataset.pic, Number(pic.dataset.i));
    P3.feedClick(e);
  });
  $("#feed").addEventListener("keydown", (e) => { const pic = e.target.closest && e.target.closest("[data-pic]"); if (pic && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPicture(pic.dataset.pic, Number(pic.dataset.i)); } });
  $("#lb-x").addEventListener("click", closePicture);
  $("#lb-prev").addEventListener("click", () => stepPicture(-1));
  $("#lb-next").addEventListener("click", () => stepPicture(1));
  $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closePicture(); });
  P3.bind();
  $("#chat-q").addEventListener("input", searchChats);
  $("#chat-title").addEventListener("dblclick", () => { if (S.conv) renameChat(S.conv); });
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
  $("#setup-go").addEventListener("click", () => { $("#setup").classList.add("hidden"); P3.maybeTour(); });
  document.addEventListener("keydown", (e) => {
    const lb = !$("#lightbox").classList.contains("hidden");
    if (e.key === "Escape") { if (lb) closePicture(); else $("#drawer").classList.add("hidden"); }
    if (lb && e.key === "ArrowLeft") stepPicture(-1);
    if (lb && e.key === "ArrowRight") stepPicture(1);
  });
}

boot();

// ---- Chat mode / Build mode (Piece 1) ----
function currentMode() {
  if (!S.conv) return S.nextMode || "chat";
  const c = ((S.state && S.state.conversations) || []).find((x) => x.id === S.conv);
  return (c && c.mode) || "chat";
}
function renderMode() {
  const b = document.getElementById("mode");
  if (!b) return;
  const m = currentMode();
  b.textContent = m === "build" ? "Build mode" : "Chat mode";
  b.className = "mode-pill " + m;
  b.title = m === "build"
    ? "Build mode: it makes things, runs them and tests them. Click to go back to Chat mode."
    : "Chat mode: talk, lists, look things up. It asks you before it builds anything. Click for Build mode.";
}
async function toggleMode() {
  const next = currentMode() === "build" ? "chat" : "build";
  if (!S.conv) { S.nextMode = next; renderMode(); return; }
  try {
    const r = await api("/api/mode", { conversation: S.conv, mode: next });
    const c = (S.state.conversations || []).find((x) => x.id === S.conv);
    if (c) Object.assign(c, r.conversation);
    renderMode();
    toast(next === "build" ? "Build mode on: it can make, run and test things now." : "Chat mode on: talk first, it asks before building.", "ok");
  } catch (e) { toast(e.message, "bad"); }
}
