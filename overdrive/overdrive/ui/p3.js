"use strict";
/* OVERDRIVE Piece 3 window parts. Loaded before app.js; uses app.js helpers ($, api, esc, toast...) only
   when called, never at load time. app.js calls the P3.* hooks below. */

const P3 = {
  mem: { cat: "all", q: "", archived: false, rows: [], total: 0, counts: {}, names: {}, editing: null, open: new Set() },
};

/* ---------------------------------------------------------------- hooks app.js calls */
P3.state = function (st) {
  P4.state(st);
  P3.paintMemCount(st.memory_counts);
  P3.renderQueue(st.queue);
  P3.paintAwayChip(st.away);
  P3.paintNet(st.net);
  P3.btw.items = st.btw || [];
  P3.applyLooks(st.settings);
  P3.paintMind(st.feelings);
  if (!P3.imp.loaded) { P3.imp.loaded = true; P3.loadImported(); }
  P3.interrupted(st.interrupted);
  P3.loadDraft();
  P3.paintAccount(st.accounts);
  $("#nav-jobs").textContent = st.jobs ? String(st.jobs) : "";
  P3.maybeTour();
  const last = st.away && (st.away.reports || []).slice(-1)[0];
  if (last && !last.seen) P3.awayReport(last);
  const notes = st.notes || [];
  for (const n of notes) {
    const key = "od_note_" + n;
    let seen = false;
    try { seen = sessionStorage.getItem(key) === "1"; sessionStorage.setItem(key, "1"); } catch (e) { /* private window */ }
    if (!seen) toast(n, "ok", 12000);
  }
};

P3.event = function (ev) {
  switch (ev.type) {
    case "memory_changed":
      // never redraw under the human's hands: an open edit box would lose what they typed
      if (S.tab === "memory" && !P3.mem.editing) P3.loadMemory();
      else P3.refreshMemCount();
      break;
    case "queue": if (S.state) S.state.queue = ev.queue; P3.renderQueue(ev.queue); break;
    case "away": P3.paintAwayChip(ev.away); if (S.tab === "away") P3.loadAway(); break;
    case "away_report": P3.awayReport(ev.report); if (S.tab === "away") P3.loadAway(); break;
    case "btw": P3.btwItem(ev.item); break;
    case "feelings": P3.paintMind(ev.feelings); break;
    case "restart":
      document.body.insertAdjacentHTML("beforeend", `<div class="restarting"><div class="face big excited"><i></i><i></i><b></b></div><h2>Restarting into its new version...</h2><p class="muted">A new window opens by itself in a few seconds. You can close this one.</p></div>`);
      break;
    case "net": if (S.state) S.state.net = ev.net; P3.paintNet(ev.net); break;
    case "accounts": P3.paintAccount(ev.accounts); break;
    case "limit_hit": P3.limitHit(ev); P4.limitScreen(ev); break;
    case "schedule": if (S.tab === "schedule" && !P3.sched.editing) P3.loadSchedule(); else $("#nav-jobs").textContent = (ev.jobs || []).filter((j) => j.enabled).length || ""; break;
    case "chats_done_ask":
      P3.banner("chatsdone", `<span class="bn-ic"></span><div>${ev.chats.length} old chat${ev.chats.length === 1 ? "" : "s"} nobody used for a while: <b>${ev.chats.slice(0, 3).map((c) => esc(c.title)).join(", ")}${ev.chats.length > 3 ? "..." : ""}</b>. Move ${ev.chats.length === 1 ? "it" : "them"} to the Done folder?</div>
        <button class="ghost sm" data-chats-done="${esc(ev.chats.map((c) => c.id).join(","))}">Yes, move ${ev.chats.length === 1 ? "it" : "them"}</button>`);
      break;
    case "projects_done": P3.askDone(ev.ask); if (ev.marked && ev.marked.length) toast(`Marked done (nobody touched them): ${ev.marked.join(", ")}`, "ok", 8000); break;
    default: P4.event(ev); break;
  }
};

P3.tab = function (tab) {
  if (tab === "memory") P3.loadMemory();
  if (tab === "schedule") P3.loadSchedule();
  if (tab === "away") P3.loadAway();
};

/* extra bits under an answer: "Saved to memory" with Undo */
P3.turnExtras = function (t) {
  const ch = t.memory_changes || [];
  if (!ch.length) return "";
  const word = { remember: "Saved to memory", update: "Updated in memory", archive: "Archived in memory" };
  return `<div class="memsaved">${ch.map((m, i) => `<div class="ms-row${m.undone ? " undone" : ""}">
      <span class="ms-ic"></span><span>${esc(word[m.op] || "Memory")}: <b>${esc(m.title || "")}</b>
      <span class="muted">(${esc(m.category || P3.kindName(m.kind))}${m.decision === "yes" ? ", you said Yes" : ""})</span></span>
      ${m.undone ? `<span class="muted">undone</span>` : `<button class="ghost xs" data-memundo="${esc(t.id)}" data-i="${i}">Undo</button>`}
    </div>`).join("")}</div>`;
};

P3.feedClick = function (e) {
  const u = e.target.closest("[data-memundo]");
  if (u) P3.undoMemory(u.dataset.memundo, Number(u.dataset.i));
};

P3.settingsHtml = function (s, opt, sw, num) {
  return P3.looksHtml(s, opt) + P4.looksHtml(s, opt) + P3.settingsHtml2(s, opt, sw, num);
};
P3.settingsHtml2 = function (s, opt, sw, num) {
  const voices = P3.voices().slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  const vOpts = opt("", "Best natural voice (automatic)", s.voice_name) + voices.map((v) => opt(v.name, `${v.name} (${v.lang})`, s.voice_name)).join("");
  const range = (k, min, max, step) => `<span class="range"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><b data-rv="${k}">${Number(s[k]).toFixed(2)}x</b></span>`;
  return `<div class="st-sec"><h3>Voice</h3>
      <div class="row2"><label>Its voice</label><span class="inl"><select data-k="voice_name">${vOpts}</select><button type="button" class="ghost" id="voice-test">Test</button></span></div>
      <div class="hint row2"><span></span><span class="hint">The \u201cNatural\u201d voices sound like a real person (Edge gives them free, they need the internet). The others work offline.</span></div>
      <div class="row2"><label>Talking speed</label>${range("voice_rate", 0.6, 1.6, 0.05)}</div>
      <div class="row2"><label>Pitch</label>${range("voice_pitch", 0.6, 1.4, 0.02)}</div>
      <div class="row2"><label>Read answers out loud</label><select data-k="voice_read">${opt("voice_mode", "Only in voice mode", s.voice_read)}${opt("always", "Always", s.voice_read)}${opt("off", "Never", s.voice_read)}</select></div>
      <div class="row2"><label>Voice follows its mood</label>${sw("voice_moods", "a bit faster when it's excited, slower when it's down")}</div>
      <div class="hint row2"><span></span><span class="hint">Mic button (Ctrl+Space): you talk, it types. Voice mode (Ctrl+Shift+Space): you talk, it talks back, even while it builds. Ctrl+M mutes your mic. No wake word, ever.</span></div>
    </div>
    <div class="st-sec"><h3>Memory</h3>
      <div class="row2"><label>Saving to memory</label><select data-k="memory_save">${opt("tell", "Saves normal things and tells me (Undo button)", s.memory_save)}${opt("ask", "Always ask me first", s.memory_save)}</select></div>
      <div class="hint row2"><span></span><span class="hint">Personal things (health, money, family, love life, feelings) and new rules ALWAYS ask first, whatever this says. The same thing is never saved twice.</span></div>
      <div class="btns"><button type="button" class="ghost" id="set-mem-open">Open the Memory page</button></div>
    </div>
    <div class="st-sec"><h3>Help</h3><div class="btns"><button type="button" class="ghost" id="set-tour">Show the tour again</button><button type="button" class="ghost" id="set-accts">Claude accounts</button><button type="button" class="ghost" id="set-impchats">Import my claude.ai chats</button><button type="button" class="ghost" id="set-versions">Its own versions</button></div></div>`;
};

P3.bind = function () {
  try { const l = JSON.parse(localStorage.getItem("od_looks") || "null"); if (l) P3.applyLooks(l, true); } catch (e) { /* first start */ }
  $("#mem-q").addEventListener("input", () => { clearTimeout(P3._mq); P3._mq = setTimeout(() => { P3.mem.q = $("#mem-q").value.trim(); P3.loadMemory(); }, 220); });
  $("#mem-arch").addEventListener("change", () => { P3.mem.archived = $("#mem-arch").checked; P3.loadMemory(); });
  $("#mem-import-btn").addEventListener("click", P3.showImport);
  $("#mem-body").addEventListener("click", P3.memClick);
  $("#settings-body").addEventListener("click", (e) => {
    if (e.target.id === "set-mem-open") switchTab("memory");
    if (e.target.id === "set-tour") P3.startTour();
    if (e.target.id === "set-accts") P3.showAccounts();
    if (e.target.id === "set-impchats") P3.showImportChats();
    if (e.target.id === "set-versions") P3.showVersions();
    if (e.target.id === "voice-test") {
      const sel = $("[data-k=voice_name]"), rate = $("[data-k=voice_rate]"), pitch = $("[data-k=voice_pitch]");
      const keep = Object.assign({}, S.state.settings);
      Object.assign(S.state.settings, { voice_name: sel.value, voice_rate: Number(rate.value), voice_pitch: Number(pitch.value) });
      P3.shush(); P3.say("Yo! This is how I sound. Pretty good, right?");
      Object.assign(S.state.settings, { voice_name: keep.voice_name, voice_rate: keep.voice_rate, voice_pitch: keep.voice_pitch });
    }
  });
  $("#settings-body").addEventListener("input", (e) => { const k = e.target.dataset && e.target.dataset.k; if (k && e.target.type === "range") { const b = $(`[data-rv="${k}"]`); if (b) b.textContent = Number(e.target.value).toFixed(2) + "x"; } });
  $("#queue-box").addEventListener("click", P3.queueClick);
  $("#away-body").addEventListener("click", P3.awayClick);
  $("#away-body").addEventListener("change", P3.awayChange);
  $("#banners").addEventListener("click", P3.bannerClick);
  $("#sched-body").addEventListener("click", P3.schedClick);
  $("#acct-chip").addEventListener("click", P3.showAccounts);
  $("#net-light").addEventListener("click", () => { const n = P3.net.last; toast(!n ? "Checking the internet..." : n.online ? "The internet is working." : "No internet right now. Claude can't think until it's back.", n && n.online === false ? "warn" : "ok", 4000); });
  $("#drawer-body").addEventListener("click", P3.accountsClick);
  $("#tour").addEventListener("click", P3.tourClick);
  P3.bind5b();
  $("#mind-chip").addEventListener("click", P3.showMind);
  $("#live-toggle").addEventListener("click", () => P3.toggleLive());
  $("#live-x").addEventListener("click", () => P3.toggleLive(false));
  $("#live-body").addEventListener("click", (e) => { if (e.target.closest("[data-livepic]") && P3.live.task) { LB.pics = (P3.live.task.pictures || []).filter((x) => x && x.file); LB.i = LB.pics.length - 1; if (LB.pics.length) { showPicture(); $("#lightbox").classList.remove("hidden"); } } });
  $("#drawer-body").addEventListener("click", P3.mindClick);
  const closeBtw = () => { $("#btw").classList.add("hidden"); $("#btw-toggle").classList.remove("on"); $("#tab-chat").classList.remove("btw-open"); };
  $("#btw-toggle").addEventListener("click", () => { if ($("#btw").classList.contains("hidden")) P3.openBtw(true); else closeBtw(); });
  $("#btw-x").addEventListener("click", closeBtw);
  $("#btw-form").addEventListener("submit", (e) => { e.preventDefault(); P3.askBtw($("#btw-q").value); });
  document.addEventListener("keydown", (e) => { if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); P3.openBtw(true); } });
  window.addEventListener("resize", () => { if (P3.tourAt >= 0) P3.paintTour(); });
  $("#learn-now").addEventListener("click", async () => {
    try { await api("/api/away/action", { action: "learn_now" }); toast("It's learning something now (in the \u201cWhile you were away\u201d chat).", "ok", 5000); P3.loadAway(); }
    catch (e) { toast(e.message, "bad"); }
  });
  $("#mic").addEventListener("click", P3.toggleDictation);
  $("#voice").addEventListener("click", P3.toggleVoice);
  $("#vb-mute").addEventListener("click", P3.toggleMute);
  $("#vb-skip").addEventListener("click", P3.shush);
  $("#vb-end").addEventListener("click", P3.endVoice);
  $("#vb-orb").addEventListener("click", () => { if (P3.v.speaking) P3.shush(); else P3.toggleMute(); });
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (S.tab === "settings" && !$("[data-k=voice_name]:focus")) renderSettings(); };
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.code === "Space") { e.preventDefault(); if (e.shiftKey) P3.toggleVoice(); else P3.toggleDictation(); }
    else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "m" && P3.v.mode) { e.preventDefault(); P3.toggleMute(); }
    else if (e.key === "Escape" && P3.v.speaking) P3.shush();
  });
  // Enter while the mic is typing: stop the mic first so the last words aren't lost
  $("#msg").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && P3.v.dict) P3.endDictation(); }, true);
};

/* ---------------------------------------------------------------- memory page */
P3.KIND = { fact: "Fact", experience: "Experience", instruction: "Rule", project: "Project", relationship: "Person" };
P3.kindName = (k) => P3.KIND[k] || k || "";
P3.CATS = [["all", "All"], ["projects", "Projects"], ["about", "About me"], ["rules", "Rules"], ["people", "People"], ["experiences", "Experiences"], ["facts", "Facts"]];

P3.paintMemCount = function (c) { if (c) $("#nav-mem").textContent = c.all ? String(c.all) : ""; };
P3.refreshMemCount = async function () {
  try { const d = await api("/api/memory?limit=1"); P3.paintMemCount(d.counts); } catch (e) { /* closed */ }
};

P3.loadMemory = async function () {
  const m = P3.mem;
  const params = new URLSearchParams({ cat: m.cat, limit: "150" });
  if (m.q) params.set("q", m.q);
  if (m.archived) params.set("archived", "1");
  let d;
  try { d = await api(`/api/memory?${params}`); } catch (e) { $("#mem-body").innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  m.rows = d.rows; m.total = d.total; m.counts = d.counts; m.names = d.names;
  P3.paintMemCount(d.counts);
  P3.renderMemory();
};

P3.renderMemory = function () {
  const m = P3.mem;
  $("#mem-cats").innerHTML = P3.CATS.map(([k, label]) => `<button class="mc${m.cat === k ? " on" : ""}" data-mcat="${k}">${esc(label)} <span>${m.counts[k] ?? 0}</span></button>`).join("") +
    (m.counts.archived ? `<span class="muted mc-arch">${m.counts.archived} archived</span>` : "");
  $$("[data-mcat]").forEach((b) => b.addEventListener("click", () => { m.cat = b.dataset.mcat; P3.loadMemory(); }));
  const body = $("#mem-body");
  // A redraw (from any source) must never lose what the human is typing in an open edit box.
  const ed = m.editing && $(`.mem-row.editing[data-mid="${CSS.escape(m.editing)}"]`);
  const keep = ed ? { t: $(".me-title", ed).value, c: $(".me-content", ed).value, g: $(".me-tags", ed).value,
    f: document.activeElement && ed.contains(document.activeElement) ? document.activeElement.className : "" } : null;
  // the row being edited stays on screen even if a new search or filter would hide it
  if (m.editing && m.editRow && !m.rows.some((r) => r.id === m.editing)) m.rows = [m.editRow, ...m.rows];
  P3.paintRows(body);
  if (keep && m.editing) {
    const ne = $(`.mem-row.editing[data-mid="${CSS.escape(m.editing)}"]`);
    if (ne) {
      $(".me-title", ne).value = keep.t; $(".me-content", ne).value = keep.c; $(".me-tags", ne).value = keep.g;
      if (keep.f) { const el = $("." + keep.f.split(" ")[0], ne); if (el) el.focus(); }
    }
  }
};

P3.paintRows = function (body) {
  const m = P3.mem;
  if (!m.rows.length) {
    const none = m.q ? `Nothing in memory matches \u201c${esc(m.q)}\u201d.` : (m.counts.all ? "Nothing here yet." : "Memory is empty.");
    body.innerHTML = `<div class="mem-empty"><h2>${none}</h2>
      ${!m.counts.all ? `<p class="muted">Bring in everything from your old notes once (one memory only, no pasting), with <b>Import my memory</b> up top. After that it saves new things by itself and tells you.</p>` : ""}
      ${m.q ? `<button class="primary" data-memask="${esc(m.q)}">Ask OVERDRIVE about \u201c${esc(m.q)}\u201d</button>` : ""}</div>`;
    return;
  }
  const more = m.total > m.rows.length ? `<div class="muted" style="margin:10px 2px">Showing ${m.rows.length} of ${m.total}. Search to find the rest.</div>` : "";
  body.innerHTML = `<div class="mem-list">${m.rows.map(P3.memRow).join("")}</div>${more}
    ${m.q ? `<div style="margin-top:14px"><button class="ghost" data-memask="${esc(m.q)}">Ask OVERDRIVE what it remembers about \u201c${esc(m.q)}\u201d (uses a little usage)</button></div>` : ""}`;
};

P3.memRow = function (r) {
  const m = P3.mem;
  const pinned = (r.tags || []).includes("pinned");
  const tags = (r.tags || []).filter((t) => t !== "pinned" && t !== "imported");
  if (m.editing === r.id) {
    return `<div class="mem-row editing" data-mid="${esc(r.id)}">
      <input class="me-title" value="${esc(r.title)}" maxlength="160">
      <textarea class="me-content" rows="8" maxlength="20000">${esc(r.content)}</textarea>
      <input class="me-tags" value="${esc((r.tags || []).join(", "))}" placeholder="tags, comma separated">
      <div class="btns"><button class="primary" data-mact="save">Save</button><button class="ghost" data-mact="cancel">Cancel</button>
      <span class="muted">The old text is kept as history.</span></div></div>`;
  }
  const long = r.content.length > 420 || r.content.split("\n").length > 6;
  const open = m.open.has(r.id);
  const date = r.updated ? new Date(r.updated).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
  return `<div class="mem-row${pinned ? " pinned" : ""}${r.status !== "active" ? " arch" : ""}" data-mid="${esc(r.id)}">
    <div class="mr-head"><span class="mk mk-${esc(r.category)}">${esc(m.names[r.category] || r.category)}</span>
      <b class="mr-title">${esc(r.title)}</b>${pinned ? `<span class="pin-on" title="Pinned: always in its mind">pinned</span>` : ""}
      ${(r.flags || []).length ? `<span class="chip warn-chip" title="Text that looks like orders for an AI was found here. It's stored as data only.">flagged</span>` : ""}</div>
    <div class="mr-body${long && !open ? " clamp" : ""}">${md(r.content)}</div>
    ${long ? `<button class="linkish" data-mact="more">${open ? "Show less" : "Show all"}</button>` : ""}
    <div class="mr-foot"><span class="muted">${esc(date)}${tags.length ? " &middot; " + tags.map(esc).join(", ") : ""} &middot; <span title="${esc(r.provenance)}">from ${esc(P3.source(r.provenance))}</span></span>
      <span class="mr-acts">
        ${r.status === "active" ? `<button class="ghost xs" data-mact="${pinned ? "unpin" : "pin"}">${pinned ? "Unpin" : "Pin"}</button>
        <button class="ghost xs" data-mact="edit">Edit</button><button class="ghost xs" data-mact="archive">Archive</button>`
        : `<button class="ghost xs" data-mact="unarchive">Bring back</button>`}
        <button class="ghost xs danger-t" data-mact="forget">Delete</button></span></div>
  </div>`;
};

P3.source = function (prov) {
  const p = String(prov || "");
  if (p.startsWith("import:")) return "your imported notes";
  if (p.startsWith("task:")) return "a chat";
  if (p.startsWith("you")) return "you";
  return p.slice(0, 40) || "?";
};

P3.memClick = async function (e) {
  const ask = e.target.closest("[data-memask]");
  if (ask) { switchTab("chat"); newChat(); $("#msg").value = `What do you remember about ${ask.dataset.memask}?`; autoGrow(); $("#msg").focus(); return; }
  const b = e.target.closest("[data-mact]");
  if (!b) return;
  const rowEl = b.closest("[data-mid]");
  const id = rowEl && rowEl.dataset.mid;
  const r = P3.mem.rows.find((x) => x.id === id);
  if (!r) return;
  const act = b.dataset.mact;
  if (act === "more") { if (P3.mem.open.has(id)) P3.mem.open.delete(id); else P3.mem.open.add(id); P3.renderMemory(); return; }
  if (act === "edit") { P3.mem.editing = id; P3.mem.editRow = r; P3.renderMemory(); const t = $(".me-content", $(`[data-mid="${CSS.escape(id)}"]`)); if (t) t.focus(); return; }
  if (act === "cancel") { P3.mem.editing = null; P3.renderMemory(); return; }
  try {
    if (act === "save") {
      const title = $(".me-title", rowEl).value.trim(), content = $(".me-content", rowEl).value;
      const tags = $(".me-tags", rowEl).value.split(",").map((x) => x.trim()).filter(Boolean);
      const changes = { id };
      if (title !== r.title) changes.title = title;
      if (content !== r.content) changes.content = content;
      if (JSON.stringify(tags) !== JSON.stringify(r.tags || [])) changes.tags = tags;
      if (Object.keys(changes).length > 1) { await api("/api/memory/edit", changes); toast("Saved. The old text is kept as history.", "ok", 3000); }
      P3.mem.editing = null;
    } else if (act === "forget") {
      if (!confirm(`Delete this memory for good?\n\n"${r.title}"\n\nIt can't come back (a new import won't bring it back either). Archive keeps it hidden instead.`)) return;
      await api("/api/memory/forget", { id });
      toast("Deleted.", "ok", 2500);
    } else {
      await api("/api/memory/set", { id, action: act });
      toast({ pin: "Pinned: it always keeps this in mind.", unpin: "Unpinned.", archive: "Archived (hidden, not deleted).", unarchive: "It's back." }[act] || "Done.", "ok", 2600);
    }
  } catch (err) { toast(err.message, "bad"); }
  P3.loadMemory();
};

P3.showImport = function () {
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Import my memory</h2>
    <p class="muted">Reads your notes ONE time into OVERDRIVE's own memory, sorted into Projects, About me, Rules, People and Experiences. After that there's only one memory. Running it again with newer notes updates what changed and never makes copies. Things you deleted here never come back.</p>
    <ol class="muted imp-steps"><li>Get your notes as a folder or a .zip (for a GitHub notes repo: the green <b>Code</b> button, then <b>Download ZIP</b>).</li>
    <li>In File Explorer, hold <b>Shift</b>, right-click the folder or .zip, pick <b>Copy as path</b>.</li><li>Paste it here and press Import.</li></ol>
    <div class="imp-row"><input id="imp-path" placeholder="C:\\Users\\you\\Downloads\\notes.zip" spellcheck="false"><button class="primary" id="imp-go">Import</button></div>
    <div class="muted" style="font-size:12.5px">Only text notes (.md, .txt) are read: pictures, sounds and code are skipped. Nothing leaves your PC.</div>
    <div id="imp-out"></div>`;
  $("#drawer").classList.remove("hidden");
  $("#imp-path").focus();
  const go = async () => {
    const path = $("#imp-path").value.trim();
    if (!path) { toast("Paste the folder or .zip path first.", "warn"); return; }
    $("#imp-go").disabled = true; $("#imp-out").innerHTML = `<div class="loading">Reading your notes...</div>`;
    try {
      const r = await api("/api/memory/import", { path });
      const kinds = Object.entries(r.by_kind || {}).map(([k, v]) => `${v} ${esc(P3.kindName(k).toLowerCase())}${v === 1 ? "" : "s"}`).join(", ");
      $("#imp-out").innerHTML = `<div class="box imp-done"><b>Done.</b> Read ${r.files} note file${r.files === 1 ? "" : "s"}: <b>${r.added}</b> new, <b>${r.updated}</b> updated, ${r.unchanged} already there${r.kept_deleted ? `, ${r.kept_deleted} you deleted stayed deleted` : ""}.
        ${kinds ? `<div class="muted">${kinds}</div>` : ""}${(r.errors || []).length ? `<div class="err">${r.errors.map(esc).join("<br>")}</div>` : ""}</div>`;
      P3.loadMemory();
    } catch (e) { $("#imp-out").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    $("#imp-go").disabled = false;
  };
  $("#imp-go").addEventListener("click", go);
  $("#imp-path").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
};

P3.undoMemory = async function (taskId, i) {
  try { const r = await api("/api/memory/undo", { task: taskId, index: i }); upsertTask(r.task); toast("Undone. Memory is back the way it was.", "ok", 3000); }
  catch (e) { toast(e.message, "bad"); }
};

/* ================================================================ Part 2: voice + the waiting queue
   Talking: Edge's own speech typing (SpeechRecognition) and Edge's voices (speechSynthesis). Edge has
   free "Natural" voices that sound real. No wake word: you press the mic button or Ctrl+Space. */
P3.SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
P3.v = { rec: null, recFor: "", dict: false, mode: false, muted: false, speaking: false, base: "", heard: "",
  silence: null, spoken: new Map(), streamed: new Map(), done: new Set(), q: [], restartAt: 0, errors: 0 };

P3.queued = function (item) {
  toast(item.source === "voice" ? "Got it. It goes in right after this step." : "It's still working, so your message waits and goes in right after this step.", "ok", 4500);
};
P3.renderQueue = function (queue) {
  const box = $("#queue-box");
  if (!box) return;
  const q = queue || [];
  box.classList.toggle("hidden", !q.length);
  box.innerHTML = q.map((x) => `<div class="qi"><span class="qi-tag">${x.source === "voice" ? "Said" : "Waiting"}</span>
    <span class="qi-text" title="${esc(x.text)}">${esc(x.text)}</span>
    <button class="ghost xs" data-qsend="${esc(x.id)}">Send now</button><button class="ghost xs" data-qdel="${esc(x.id)}">Remove</button></div>`).join("");
};
P3.queueClick = async function (e) {
  const s = e.target.closest("[data-qsend]"), d = e.target.closest("[data-qdel]");
  if (!s && !d) return;
  try { await api("/api/queue", { id: (s || d).dataset[s ? "qsend" : "qdel"], action: s ? "send" : "remove" }); }
  catch (err) { toast(err.message, "warn"); }
};

/* ---- the mic (dictation: letters show up while you talk) */
P3.micError = function (err) {
  const why = {
    "not-allowed": "The microphone is blocked. When Edge asks, press Allow. If it never asks: Windows Settings > Privacy > Microphone > let desktop apps use it.",
    "service-not-allowed": "Edge's speech typing is turned off on this PC. Windows key + H also types what you say, anywhere.",
    "audio-capture": "No microphone found. Plug one in (or pick it in Windows sound settings), then try again.",
    network: "Edge's speech typing needs the internet. Windows key + H works too.",
  }[err];
  if (why) toast(why, "bad", 11000);
};
P3.startRec = function (forWhat) {
  if (!P3.SR) { toast("This window can't hear you (no speech typing in it). Windows key + H types what you say, anywhere.", "bad", 9000); return false; }
  P3.stopRec();
  const r = new P3.SR();
  r.continuous = true; r.interimResults = true; r.lang = navigator.language || "en-US";
  r.onresult = (ev) => {
    let fin = "", mid = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) fin += t; else mid += t;
    }
    if (P3.v.recFor === "dict") P3.dictText(fin, mid); else P3.voiceHeard(fin, mid);
  };
  r.onerror = (ev) => { if (ev.error !== "no-speech" && ev.error !== "aborted") { P3.v.errors++; P3.micError(ev.error); if (["not-allowed", "service-not-allowed", "audio-capture"].includes(ev.error)) { P3.endDictation(); P3.endVoice(); } } };
  r.onend = () => {
    if (P3.v.rec !== r) return;
    P3.v.rec = null;
    // Edge stops listening after a quiet spell: keep going while the mic or voice mode is on
    if (P3.v.recFor === "dict" && P3.v.dict) { P3.v.base = $("#msg").value; P3.startRec("dict"); }
    else if (P3.v.recFor === "voice" && P3.v.mode && !P3.v.muted && !P3.v.speaking && P3.v.errors < 5) setTimeout(() => P3.listen(), 250);
  };
  P3.v.rec = r; P3.v.recFor = forWhat;
  try { r.start(); } catch (e) { return false; }
  return true;
};
P3.stopRec = function () { const r = P3.v.rec; P3.v.rec = null; if (r) { try { r.abort(); } catch (e) { /* already stopped */ } } };

P3.toggleDictation = function () { if (P3.v.dict) P3.endDictation(); else P3.startDictation(); };
P3.startDictation = function () {
  if (P3.v.mode) P3.endVoice();
  P3.v.base = $("#msg").value;
  if (!P3.startRec("dict")) return;
  P3.v.dict = true;
  $("#mic").classList.add("on");
  $("#msg").focus();
};
P3.endDictation = function () {
  if (!P3.v.dict) return;
  P3.v.dict = false;
  if (P3.v.recFor === "dict") P3.stopRec();
  $("#mic").classList.remove("on");
};
P3.dictText = function (fin, mid) {
  const m = $("#msg");
  const join = (a, b) => (a && b && !/\s$/.test(a) ? a + " " + b.trim() : a + b.trim());
  if (fin) P3.v.base = join(P3.v.base, fin);
  m.value = mid ? join(P3.v.base, mid) : P3.v.base;
  autoGrow();
};

/* ---- voice mode: talk with it out loud (works in Chat AND Build mode) */
P3.toggleVoice = function () { if (P3.v.mode) P3.endVoice(); else P3.startVoice(); };
P3.startVoice = function () {
  if (!P3.SR) { toast("This window can't hear you (no speech typing in it).", "bad", 8000); return; }
  if (!window.speechSynthesis) { toast("This window has no voices to talk with.", "bad", 8000); return; }
  P3.endDictation();
  P3.v.mode = true; P3.v.muted = false; P3.v.errors = 0; P3.v.heard = "";
  $("#voice-bar").classList.remove("hidden");
  $("#voice").classList.add("on");
  // anything already said for a running task is not read out again
  for (const t of S.tasks.values()) P3.v.done.add(t.id);
  if (S.state && S.state.current) P3.v.done.delete(S.state.current.id);
  P3.paintVoice();
  P3.listen();
};
P3.endVoice = function () {
  if (!P3.v.mode) return;
  P3.v.mode = false;
  clearTimeout(P3.v.silence);
  if (P3.v.recFor === "voice") P3.stopRec();
  P3.shush();
  $("#voice-bar").classList.add("hidden");
  $("#voice").classList.remove("on");
};
P3.listen = function () {
  if (!P3.v.mode || P3.v.muted || P3.v.speaking || P3.v.rec) { P3.paintVoice(); return; }
  P3.startRec("voice");
  P3.paintVoice();
};
P3.toggleMute = function () {
  if (!P3.v.mode) return;
  P3.v.muted = !P3.v.muted;
  if (P3.v.muted) { P3.stopRec(); clearTimeout(P3.v.silence); } else P3.listen();
  P3.paintVoice();
};
P3.voiceHeard = function (fin, mid) {
  if (fin) P3.v.heard = (P3.v.heard + " " + fin).trim();
  $("#vb-heard").textContent = (P3.v.heard + " " + mid).trim() || "Say something...";
  clearTimeout(P3.v.silence);
  // you stopped talking for a moment: send what you said
  P3.v.silence = setTimeout(P3.voiceSend, mid ? 2200 : 1300);
};
P3.voiceSend = async function () {
  const text = P3.v.heard.trim();
  P3.v.heard = "";
  if (!text || !P3.v.mode) return;
  const low = text.toLowerCase().replace(/[.!?]/g, "").trim();
  if (["stop talking", "be quiet", "shut up", "stop"].includes(low)) { P3.shush(); P3.paintVoice(); return; }
  if (["end voice", "end voice mode", "goodbye", "bye"].includes(low)) { P3.endVoice(); return; }
  $("#vb-heard").textContent = text;
  const btw = text.match(/^by the way[,\s]+(.+)/i);
  if (btw && S.state && S.state.current) { await P3.askBtw(btw[1]); P3.paintVoice(); return; }
  await send(text, "voice");
  P3.paintVoice();
};
P3.paintVoice = function () {
  if (!$("#voice-bar")) return;
  const running = !!(S.state && S.state.current);
  const state = P3.v.muted ? "muted" : P3.v.speaking ? "talking" : running ? "thinking" : "listening";
  $("#vb-orb").className = "vb-orb " + state;
  $("#vb-state").textContent = { muted: "Mic muted", talking: "Talking", thinking: running && !P3.v.muted ? "Working on it (you can still talk)" : "Working on it", listening: "Listening" }[state];
  $("#vb-mute").textContent = P3.v.muted ? "Unmute mic" : "Mute mic";
  $("#vb-mute").classList.toggle("on", P3.v.muted);
  $("#vb-skip").classList.toggle("hidden", !P3.v.speaking);
};

/* ---- reading answers out loud, sentence by sentence while they stream in */
P3.readOn = () => { const r = (S.state && S.state.settings && S.state.settings.voice_read) || "voice_mode"; return r === "always" || (r === "voice_mode" && P3.v.mode); };
P3.speakable = function (text) {
  let t = String(text || "");
  t = t.replace(/```[\s\S]*?```/g, " I put the code on the screen. ").replace(/```[\s\S]*$/g, " ");
  t = t.split("\n").filter((l) => !/^\s*\|/.test(l)).join("\n");                     // tables: on screen only
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, "a link");
  t = t.replace(/`([^`]*)`/g, "$1").replace(/[*_#>~]+/g, "").replace(/^\s*[-+]\s+/gm, "").replace(/^\s*(\d+)\.\s+/gm, "$1, ");
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "");
  return t.replace(/[ \t]+/g, " ").trim();
};
P3.nextSentences = function (id, final) {
  // complete sentences that haven't been said yet (code blocks are skipped until they close)
  const all = P3.v.streamed.get(id) || "";
  const from = P3.v.spoken.get(id) || 0;
  let rest = all.slice(from);
  const fences = (all.slice(0, from).match(/```/g) || []).length;
  if (fences % 2 === 1) {                                   // inside a code block: wait for it to close
    const close = rest.indexOf("```");
    if (close < 0) return "";
    P3.v.spoken.set(id, from + close + 3);
    return P3.nextSentences(id, final);
  }
  let cut = -1;
  const open = rest.indexOf("```");
  const scan = open >= 0 ? rest.slice(0, open) : rest;
  const re = /[.!?:](\s|$)|\n\n|\n(?=\s*(\d+\.|[-*])\s)/g;
  let m;
  while ((m = re.exec(scan))) cut = m.index + m[0].length;
  if (final) cut = rest.length;
  else if (open >= 0 && cut < 0 && scan.trim()) cut = open;
  if (cut <= 0) return "";
  P3.v.spoken.set(id, from + cut);
  return rest.slice(0, cut);
};
P3.onDelta = function (ev) {
  if (!P3.readOn() || P3.v.done.has(ev.task)) return;
  P3.v.streamed.set(ev.task, (P3.v.streamed.get(ev.task) || "") + ev.text);
  const say = P3.nextSentences(ev.task, false);
  if (say) P3.say(say);
};
P3.onTask = function (t) {
  P3.liveTask(t);
  if (P3.v.mode) P3.paintVoice();
  if (t.status === "running" || P3.v.done.has(t.id)) return;
  P3.v.done.add(t.id);
  if (!P3.readOn()) return;
  if (P3.v.streamed.has(t.id)) {
    const rest = P3.nextSentences(t.id, true);
    if (rest) P3.say(rest);
  } else if (t.final_text) P3.say(t.final_text);
  if (t.error && t.status !== "done") P3.say("Something went wrong. " + t.error.split(/[.(]/)[0] + ".");
  P3.v.streamed.delete(t.id); P3.v.spoken.delete(t.id);
};

P3.voices = () => (window.speechSynthesis ? speechSynthesis.getVoices() : []);
P3.pickVoice = function () {
  const all = P3.voices();
  if (!all.length) return null;
  const want = (S.state && S.state.settings && S.state.settings.voice_name) || "";
  if (want) { const v = all.find((x) => x.name === want); if (v) return v; }
  const lang = (navigator.language || "en-US").toLowerCase();
  const score = (v) => (/natural/i.test(v.name) ? 4 : 0) + (/online/i.test(v.name) ? 1 : 0) +
    (v.lang.toLowerCase() === lang ? 3 : v.lang.toLowerCase().startsWith(lang.slice(0, 2)) ? 2 : 0) + (v.localService ? 0 : 0.5);
  return all.slice().sort((a, b) => score(b) - score(a))[0];
};
P3.tone = function (sentence) {
  const s = (S.state && S.state.settings) || {};
  let rate = Number(s.voice_rate || 1), pitch = Number(s.voice_pitch || 1);
  if (s.voice_moods !== false && P3.moodTone) { const m = P3.moodTone(); rate *= m.rate; pitch *= m.pitch; }
  if (/!\s*$/.test(sentence)) rate *= 1.05;                 // excited line: a bit faster
  if (/\?\s*$/.test(sentence)) pitch *= 1.04;               // a question goes up a little
  return { rate: Math.max(0.5, Math.min(2, rate)), pitch: Math.max(0.5, Math.min(1.6, pitch)) };
};
P3.say = function (text) {
  if (!window.speechSynthesis) return;
  const clean = P3.speakable(text);
  if (!clean) return;
  const parts = clean.match(/[^.!?\n]+[.!?]*|\n+/g) || [clean];
  for (const p of parts) if (p.trim()) P3.v.q.push(p.trim());
  P3.pump();
};
P3.pump = function () {
  if (P3.v.current || !P3.v.q.length) {
    if (!P3.v.current && !P3.v.q.length && P3.v.speaking) { P3.v.speaking = false; P3.paintVoice(); setTimeout(P3.listen, 350); }
    return;
  }
  const line = P3.v.q.shift();
  const u = new SpeechSynthesisUtterance(line);
  const v = P3.pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; }
  const t = P3.tone(line);
  u.rate = t.rate; u.pitch = t.pitch;
  const next = () => { if (P3.v.current === u) { P3.v.current = null; P3.pump(); } };
  u.onend = next; u.onerror = next;
  if (!P3.v.speaking) {
    P3.v.speaking = true;
    // don't listen to itself: the mic pauses while it talks (words you already said still get sent)
    if (P3.v.recFor === "voice") P3.stopRec();
    P3.paintVoice();
  }
  P3.v.current = u;
  speechSynthesis.speak(u);
};
P3.shush = function () {
  P3.v.q = [];
  P3.v.current = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (P3.v.speaking) { P3.v.speaking = false; P3.paintVoice(); setTimeout(P3.listen, 250); }
};

/* ================================================================ Part 3: while you're away */
P3.away = { data: null };
P3.setNow = async function (changes) {
  try {
    const r = await api("/api/settings", { changes });
    S.state.settings = r.settings;
    if (r.note) toast(r.note, "warn", 9000);
    return true;
  } catch (e) { toast(e.message, "bad"); return false; }
};
P3.loadAway = async function () {
  try { P3.away.data = await api("/api/away"); } catch (e) { $("#away-body").innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  P3.renderAway();
};
P3.ago = function (iso) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};
P3.paintAwayChip = function (a) {
  if (!a) return;
  const chip = $("#away-chip");
  if (chip) chip.textContent = a.away ? (a.hunting ? `Away: checking ${a.hunting}` : a.learning ? "Away: learning" : "Away") : "You're here";
  $("#nav-away").textContent = a.bugs_open ? String(a.bugs_open) : "";
};
P3.renderAway = function () {
  const d = P3.away.data, s = S.state.settings, a = d.away;
  P3.paintAwayChip(a);
  const used = a.learn_used_pct, cap = a.learn_cap_pct, pct = Math.min(100, (used / cap) * 100);
  const sw = (k, label) => `<label class="switch big"><input type="checkbox" data-now="${k}" ${s[k] ? "checked" : ""}><span>${esc(label)}</span></label>`;
  const seg = (k, vals) => `<span class="seg">${vals.map(([v, l]) => `<button data-seg="${k}" data-v="${esc(String(v))}" class="${String(s[k]) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</span>`;
  const projects = d.projects.map((p) => `<tr class="${p.done ? "pdone" : ""}">
      <td><b>${esc(p.name)}</b>${p.done ? ` <span class="chip">done</span>` : ""}</td>
      <td class="muted">${p.changed_days == null ? "-" : p.changed_days < 1 ? "today" : Math.round(p.changed_days) + " days ago"}</td>
      <td>${p.bugs ? `<span class="bugn">${p.bugs}</span>` : `<span class="muted">0</span>`}</td>
      <td class="muted">${esc(P3.ago(p.checked))}</td>
      ${s.bug_scope === "picked" ? `<td><input type="checkbox" data-pick="${esc(p.name)}" ${(s.bug_picked || []).includes(p.name) ? "checked" : ""} ${p.done ? "disabled" : ""}></td>` : ""}
      <td><label class="switch"><input type="checkbox" data-pdone="${esc(p.name)}" ${p.done ? "checked" : ""}> done</label></td>
      <td><button class="ghost xs" data-pcheck="${esc(p.name)}" ${p.done ? "disabled" : ""}>Check now</button><button class="ghost xs" data-pversions="${esc(p.name)}">Versions</button></td></tr>`).join("");
  const groups = {};
  for (const b of d.bugs) (groups[b.project] = groups[b.project] || []).push(b);
  const bugs = Object.entries(groups).map(([proj, list]) => `<div class="bug-group"><h4>${esc(proj)} <span class="muted">${list.length}</span></h4>
      ${list.map((b) => `<div class="bug ${esc(b.severity)}"><span class="sev">${b.severity === "bug" ? "Bug" : "Heads up"}</span>
        <span class="mono bf">${esc(b.file.split("/").slice(1).join("/") || b.file)}${b.line ? ":" + b.line : ""}</span><span class="bm">${esc(b.message)}</span>
        <button class="ghost xs" data-bugx="${esc(b.id)}" title="Not a bug: hide it">Not a bug</button></div>`).join("")}</div>`).join("");
  const learned = d.learned.map((r) => `<div class="lrn"><b>${esc(r.title)}</b><div class="muted">${esc(r.content.slice(0, 220))}${r.content.length > 220 ? "..." : ""}</div></div>`).join("");
  const reports = (a.reports || []).slice().reverse().slice(0, 6).map((r) => `<div class="rep"><span class="muted">${esc(new Date(r.from).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))} &middot; ${r.minutes} min away</span>
      <span>${P3.reportLine(r)}</span></div>`).join("");
  $("#away-body").innerHTML = `
    ${a.idle_known ? "" : `<div class="box muted" style="margin-bottom:14px">This PC can't tell when you're away (this works on Windows), so nothing here runs by itself. "Check now" and "Learn something now" still work.</div>`}
    <div class="away-cards">
      <div class="acard ${s.away_learn ? "on" : ""}"><div class="ac-head">${sw("away_learn", "Learn")}<span class="cost">uses a little usage</span></div>
        <p class="muted">It picks a topic that helps your projects (or something it wants to get better at), reads about it, and saves a few short lessons to memory.</p>
        <div class="row-i"><span>Daily cap</span>${seg("away_learn_cap", [[5, "5% a day"], [10, "10% a day"]])}</div>
        <div class="capbar"><i data-w="${pct.toFixed(1)}"></i></div>
        <div class="muted capline">Today: ${used.toFixed(1)}% of ${cap}% of your 5-hour limit${d.five_hour != null ? ` &middot; your 5-hour meter is at ${Math.round(d.five_hour)}%` : ""}${!d.can_learn && s.away_learn ? ` &middot; <i>waiting: ${esc(d.why_not)}</i>` : ""}</div>
      </div>
      <div class="acard ${s.away_bugs ? "on" : ""}"><div class="ac-head">${sw("away_bugs", "Bug hunt")}<span class="cost free">zero usage</span></div>
        <p class="muted">Checks your projects on this PC: code that won't compile, broken files, missing pictures and sounds, error logs, crash files, pictures too big for your graphics card. It only looks, it never changes anything.</p>
        <div class="row-i"><span>Which projects</span>${seg("bug_scope", [["all", "All"], ["picked", "Only the ones I pick"]])}</div>
        <div class="muted capline">Done projects are always skipped.</div>
      </div>
    </div>
    <div class="st-sec away-opts">
      <div class="row2"><label>I'm away after</label><select data-now-sel="away_after_min">${[5, 10, 15, 30, 60].map((m) => `<option value="${m}" ${s.away_after_min === m ? "selected" : ""}>${m} minutes with no mouse or keyboard</option>`).join("")}</select></div>
      <div class="row2"><label>When I close the window</label>${sw("keep_running", "keep working in the background (Settings > Quit stops it)")}</div>
      <div class="row2"><label>Start with Windows</label>${sw("start_with_windows", "starts hidden, so it can work while you're away and pick up after a power cut")}</div>
      <div class="row2"><label>Projects nobody touched for</label><span class="inl"><select data-now-sel="auto_done_days">${[7, 14, 30, 60].map((n) => `<option value="${n}" ${s.auto_done_days === n ? "selected" : ""}>${n} days</option>`).join("")}</select>
        <select data-now-sel="auto_done">${[["ask", "ask me if they're done"], ["always", "mark them done by itself"], ["never", "leave them alone"]].map(([v, l]) => `<option value="${v}" ${s.auto_done === v ? "selected" : ""}>${l}</option>`).join("")}</select></span></div>
    </div>
    <h2>Your projects</h2>
    ${d.projects.length ? `<table class="tbl ptbl"><thead><tr><th>Project</th><th>Changed</th><th>Bugs</th><th>Checked</th>${s.bug_scope === "picked" ? "<th>Pick</th>" : ""}<th>Done</th><th></th></tr></thead><tbody>${projects}</tbody></table>`
      : `<div class="box muted">No projects in the workspace yet. Every game or app it builds gets its own folder there.</div>`}
    <h2>Bugs it found ${d.bugs.length ? `<span class="muted" style="font-weight:400;font-size:13px">${d.bugs.length} open</span>` : ""}</h2>
    ${d.bugs.length ? `<div class="btns" style="margin-bottom:10px"><button class="primary" id="bugs-explain">Explain these (uses a little usage)</button><button class="ghost" id="bugs-fix">Fix them (Build mode)</button></div>${bugs}`
      : `<div class="box muted">No open bugs. The hunt runs while you're away, or press Check now on a project.</div>`}
    <h2>What it learned</h2>${learned || `<div class="box muted">Nothing yet. It learns while you're away (when Learn is on).</div>`}
    ${reports ? `<h2>While you were away</h2><div class="box">${reports}</div>` : ""}`;
  applyWidths($("#away-body"));
};
P3.reportLine = function (r) {
  const bits = [];
  if (r.learned && r.learned.length) bits.push(`learned ${r.learned.length} thing${r.learned.length === 1 ? "" : "s"}`);
  if (r.bugs_new) bits.push(`found ${r.bugs_new} new bug${r.bugs_new === 1 ? "" : "s"}`);
  if (r.bugs_fixed) bits.push(`${r.bugs_fixed} old bug${r.bugs_fixed === 1 ? " is" : "s are"} gone`);
  if (r.checked && r.checked.length && !r.bugs_new) bits.push(`checked ${r.checked.length} project${r.checked.length === 1 ? "" : "s"}, nothing new`);
  return bits.join(", ") || "nothing new";
};
P3.awayClick = async function (e) {
  const t = e.target;
  const segB = t.closest("[data-seg]");
  if (segB) { const k = segB.dataset.seg, v = segB.dataset.v; if (await P3.setNow({ [k]: k === "away_learn_cap" ? Number(v) : v })) P3.loadAway(); return; }
  const pv = t.closest("[data-pversions]");
  if (pv) { P3.showVersionsOf(pv.dataset.pversions); return; }
  const chk = t.closest("[data-pcheck]");
  if (chk) {
    chk.disabled = true; chk.textContent = "Checking...";
    try { const r = await api("/api/away/action", { action: "check", project: chk.dataset.pcheck }); toast(`Checked ${r.files} files: ${r.new} new, ${r.open} open${r.fixed ? `, ${r.fixed} fixed` : ""}.`, r.new ? "warn" : "ok", 6000); }
    catch (err) { toast(err.message, "bad"); }
    P3.loadAway(); return;
  }
  const x = t.closest("[data-bugx]");
  if (x) { try { await api("/api/away/action", { action: "dismiss", bug: x.dataset.bugx }); } catch (err) { toast(err.message, "bad"); } P3.loadAway(); return; }
  if (t.id === "bugs-explain" || t.id === "bugs-fix") {
    const list = P3.away.data.bugs.slice(0, 40).map((b) => `- ${b.file}${b.line ? ":" + b.line : ""}: ${b.message}`).join("\n");
    const fix = t.id === "bugs-fix";
    switchTab("chat"); newChat();
    if (fix) { S.nextMode = "build"; renderMode(); }
    $("#msg").value = (fix ? "Fix these bugs your bug hunt found (check each one first, it might be a false alarm):\n" : "Explain these bugs your bug hunt found, simply, and which ones matter most:\n") + list;
    autoGrow(); $("#msg").focus();
  }
};
P3.awayChange = async function (e) {
  const t = e.target;
  if (t.dataset.now) { await P3.setNow({ [t.dataset.now]: t.checked }); P3.loadAway(); return; }
  if (t.dataset.nowSel) { await P3.setNow({ [t.dataset.nowSel]: /^\d+$/.test(t.value) ? Number(t.value) : t.value }); P3.loadAway(); return; }
  if (t.dataset.pdone) {
    try { await api("/api/away/action", { action: "done", project: t.dataset.pdone, done: t.checked }); toast(t.checked ? "Marked done: the bug hunt skips it now." : "Not done anymore.", "ok", 3000); }
    catch (err) { toast(err.message, "bad"); }
    P3.loadAway(); return;
  }
  if (t.dataset.pick) {
    const cur = new Set(S.state.settings.bug_picked || []);
    if (t.checked) cur.add(t.dataset.pick); else cur.delete(t.dataset.pick);
    await P3.setNow({ bug_picked: Array.from(cur) });
  }
};

/* banners at the top of the chat: they stay until you press X (so you see them even if you were away) */
P3.banners = new Map();
P3.banner = function (id, html, kind) {
  P3.banners.set(id, { html, kind: kind || "" });
  P3.paintBanners();
};
P3.paintBanners = function () {
  const box = $("#banners");
  if (!box) return;
  box.innerHTML = Array.from(P3.banners.entries()).map(([id, b]) => `<div class="banner ${esc(b.kind)}" data-bn="${esc(id)}">${b.html}<button class="bn-x" data-bnx="${esc(id)}" title="Close">&times;</button></div>`).join("");
};
P3.bannerClick = async function (e) {
  const x = e.target.closest("[data-bnx]");
  if (x) {
    const id = x.dataset.bnx;
    P3.banners.delete(id); P3.paintBanners();
    if (id === "away") { try { await api("/api/away/action", { action: "seen" }); } catch (err) { /* closed */ } }
    if (P3.onBannerClose) P3.onBannerClose(id);
    return;
  }
  const go = e.target.closest("[data-go]");
  if (go) switchTab(go.dataset.go);
  const lu = e.target.closest("[data-limit-use]");
  if (lu) { try { await api("/api/accounts/action", { action: "switch", name: lu.dataset.limitUse }); toast(`Now using the ${lu.dataset.limitUse} account. Send your message again.`, "ok", 6000); P3.banners.delete("limit"); P3.paintBanners(); checkSetup(true, true); } catch (err) { toast(err.message, "bad"); } return; }
  if (e.target.closest("[data-acct-open]")) { P3.showAccounts(); return; }
  const cd = e.target.closest("[data-chats-done]");
  if (cd) { for (const id of cd.dataset.chatsDone.split(",")) { try { await api("/api/chat/done", { conversation: id, done: true }); const c = (S.state.conversations || []).find((x) => x.id === id); if (c) c.done = true; } catch (err) { /* deleted meanwhile */ } } P3.banners.delete("chatsdone"); P3.paintBanners(); renderChats(); return; }
  const pd = e.target.closest("[data-askdone]");
  if (pd) {
    const [name, yes] = [pd.dataset.askdone, pd.dataset.yes === "1"];
    if (yes) { try { await api("/api/away/action", { action: "done", project: name, done: true }); } catch (err) { toast(err.message, "bad"); } }
    P3.banners.delete("done:" + name); P3.paintBanners();
  }
};
P3.awayReport = function (r) {
  if (!r || r.seen) return;
  P3.banner("away", `<span class="bn-ic moon"></span><div><b>While you were away</b> (${r.minutes} min): ${esc(P3.reportLine(r))}.
    ${r.learned && r.learned.length ? `<div class="muted">Learned: ${r.learned.slice(0, 3).map(esc).join(" &middot; ")}</div>` : ""}</div>
    <button class="ghost sm" data-go="away">See it</button>`, "away");
};
P3.askDone = function (names) {
  for (const n of names || []) {
    P3.banner("done:" + n, `<span class="bn-ic"></span><div>Is <b>${esc(n)}</b> done? Nobody touched it for a while. Done projects skip the bug hunt.</div>
      <button class="ghost sm" data-askdone="${esc(n)}" data-yes="1">Yes, it's done</button><button class="ghost sm" data-askdone="${esc(n)}" data-yes="0">Not done</button>`);
  }
};

/* ================================================================ Part 4: schedule, accounts, internet, done chats, tour */
P3.chatDone = async function (id, done) {
  try {
    const r = await api("/api/chat/done", { conversation: id, done });
    const c = (S.state.conversations || []).find((x) => x.id === id);
    if (c) Object.assign(c, r.conversation);
    renderChats();
    toast(done ? "Moved to the Done folder (bottom of the list)." : "Brought back.", "ok", 2500);
  } catch (e) { toast(e.message, "bad"); }
};

/* ---- internet light: always there; a drop shows a banner that stays until you close it */
P3.net = { last: null };
P3.paintNet = function (n) {
  if (!n) return;
  const el = $("#net-light");
  el.className = "net-light " + (n.online === false ? "down" : n.online ? "up" : "");
  $("#net-text").textContent = n.online === false ? "No internet" : n.online ? "Internet" : "Checking...";
  el.title = n.online === false ? `Internet down since ${new Date(n.since * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Internet is working";
  const prev = P3.net.last;
  P3.net.last = n;
  if (prev && prev.online === true && n.online === false) {
    P3.banner("net", `<div class="sig"><i></i><i></i><i></i><i></i></div><div><b class="glitch" data-text="SIGNAL LOST">SIGNAL LOST</b>
      <div class="muted">Your internet dropped at ${new Date(n.since * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Claude can't think until it's back; the Tools page and the bug hunt still work.</div></div>`, "net down");
  } else if (prev && prev.online === false && n.online === true && P3.banners.has("net")) {
    const d = (n.drops || []).slice(-1)[0];
    const mins = d && d.seconds != null ? (d.seconds < 90 ? `${d.seconds} seconds` : `${Math.round(d.seconds / 60)} minutes`) : "a bit";
    P3.banner("net", `<div class="sig back"><i></i><i></i><i></i><i></i></div><div><b>BACK ONLINE</b>
      <div class="muted">The internet came back at ${new Date(n.since * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (it was out for ${mins}).</div></div>`, "net up");
  }
};

/* ---- accounts: one click to switch, it never switches by itself */
P3.paintAccount = function (a) { if (a) $("#acct-name").textContent = a.active; };
P3.showAccounts = async function () {
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Claude accounts</h2><div class="loading">Checking sign-ins...</div>`;
  $("#drawer").classList.remove("hidden");
  let d;
  try { d = await api("/api/accounts"); } catch (e) { $("#drawer-body").innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  P3.paintAccount(d);
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Claude accounts</h2>
    <p class="muted">Each account has its own usage limits. When one runs out, OVERDRIVE tells you and you pick another here (one click). It never switches by itself: switching accounts automatically to dodge limits can get accounts banned. Chats keep going on the new account.</p>
    <div class="accts">${d.accounts.map((a) => `<div class="acct${a.active ? " on" : ""}">
      <div class="acct-main"><b>${esc(a.name)}</b>${a.main ? ` <span class="muted">(this PC's normal sign-in)</span>` : ""}
        <div class="muted">${a.signed_in ? `signed in${a.email ? " as " + esc(a.email) : ""}` : "not signed in yet"}${a.note ? " &middot; " + esc(a.note) : ""}</div></div>
      <div class="btns">${a.active ? `<span class="chip on-chip">in use</span>` : `<button class="primary sm" data-acct-use="${esc(a.name)}" ${a.signed_in ? "" : "disabled"}>Use this one</button>`}
        <button class="ghost sm" data-acct-signin="${esc(a.name)}">${a.signed_in ? "Sign in again" : "Sign in"}</button>
        ${a.main ? "" : `<button class="ghost sm danger-t" data-acct-del="${esc(a.name)}">Remove</button>`}</div></div>`).join("")}</div>
    <h2>Add an account</h2><div class="imp-row"><input id="acct-new" placeholder="A name for it, like: second account" maxlength="40"><button class="primary" id="acct-add">Add + sign in</button></div>
    <div class="muted" style="font-size:12.5px">A sign-in window opens: pick that claude.ai account in your browser and press Allow. Then come back here.</div>`;
};
P3.accountsClick = async function (e) {
  const use = e.target.closest("[data-acct-use]"), si = e.target.closest("[data-acct-signin]"), del = e.target.closest("[data-acct-del]");
  try {
    if (use) { await api("/api/accounts/action", { action: "switch", name: use.dataset.acctUse }); toast(`Now using the ${use.dataset.acctUse} account.`, "ok"); P3.banners.delete("limit"); P3.paintBanners(); checkSetup(true, true); P3.showAccounts(); }
    else if (si) { const r = await api("/api/accounts/action", { action: "signin", name: si.dataset.acctSignin }); toast(r.opened ? "Sign-in window opened. Press Allow in the browser, then come back." : r.note, r.opened ? "ok" : "warn", 9000); }
    else if (del) { if (!confirm(`Remove the account "${del.dataset.acctDel}" from OVERDRIVE?`)) return; await api("/api/accounts/action", { action: "remove", name: del.dataset.acctDel }); P3.showAccounts(); }
    else if (e.target.id === "acct-add") {
      const name = $("#acct-new").value.trim();
      if (!name) { toast("Give it a name first.", "warn"); return; }
      const r = await api("/api/accounts/action", { action: "add", name });
      toast(r.opened ? "Added. A sign-in window opened: press Allow in the browser." : `Added. ${r.note || ""}`, "ok", 9000);
      P3.showAccounts();
    }
  } catch (err) { toast(err.message, "bad"); }
};
P3.limitHit = function (ev) {
  const others = (ev.others || []).filter((n) => n !== ev.account);
  if (S.tab !== "chat") toast(`Your ${ev.account} account's limit is used up. See the Chat page to pick another account.`, "warn", 10000);
  const when = ev.resets_at ? new Date(ev.resets_at * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  P3.banner("limit", `<span class="bn-ic"></span><div><b>Your ${esc(ev.account)} account's limit is used up${when ? ` (it resets at ${esc(when)})` : ""}.</b>
    <div class="muted">${others.length ? "Pick another account to keep going, or schedule it for after the reset." : "Add another account, or schedule it for after the reset."}</div></div>
    ${others.map((n) => `<button class="primary sm" data-limit-use="${esc(n)}">Use ${esc(n)}</button>`).join("")}<button class="ghost sm" data-go="schedule">Schedule it</button>
    ${others.length ? "" : `<button class="ghost sm" data-acct-open>Accounts</button>`}`, "limit");
};

/* ---- schedule page */
P3.sched = { jobs: [], chats: [], editing: null };
P3.loadSchedule = async function () {
  try { const d = await api("/api/schedule"); P3.sched.jobs = d.jobs; P3.sched.chats = d.chats; } catch (e) { $("#sched-body").innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  P3.renderSchedule();
};
P3.localStamp = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
P3.whenText = function (j) {
  if (j.when === "usage_reset") return "When my 5-hour usage resets";
  const d = new Date(j.at);
  const day = d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return j.repeat === "daily" ? `Every day at ${t}` : j.repeat === "weekly" ? `Every ${d.toLocaleDateString([], { weekday: "long" })} at ${t}` : `${day} at ${t}`;
};
P3.renderSchedule = function () {
  const { jobs, chats, editing } = P3.sched;
  const job = editing && editing !== "new" ? jobs.find((j) => j.id === editing) : null;
  const pad = (n) => String(n).padStart(2, "0");
  const soon = new Date(Date.now() + 3600e3);
  const defAt = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:00`;
  const f = job || { title: "", text: "", when: "time", at: defAt, repeat: "once", mode: "chat", conversation: "", missed: "run" };
  const form = editing ? `<div class="st-sec sched-form"><h3>${job ? "Change the job" : "New job"}</h3>
      <div class="row2"><label>What it should do</label><textarea id="sj-text" rows="3" maxlength="8000" placeholder="Like: work on the racing game's night map and test it">${esc(f.text)}</textarea></div>
      <div class="row2"><label>Name (optional)</label><input id="sj-title" maxlength="80" value="${esc(job ? f.title : "")}" placeholder="Night map"></div>
      <div class="row2"><label>When</label><span class="inl"><select id="sj-when"><option value="time" ${f.when === "time" ? "selected" : ""}>At a day and time</option><option value="usage_reset" ${f.when === "usage_reset" ? "selected" : ""}>When my 5-hour usage resets</option></select>
        <input type="datetime-local" id="sj-at" value="${esc(f.at || defAt)}" ${f.when === "time" ? "" : "disabled"}>
        <select id="sj-repeat" ${f.when === "time" ? "" : "disabled"}>${[["once", "Just once"], ["daily", "Every day"], ["weekly", "Every week"]].map(([v, l]) => `<option value="${v}" ${f.repeat === v ? "selected" : ""}>${l}</option>`).join("")}</select></span></div>
      <div class="row2"><label>Mode</label><select id="sj-mode"><option value="chat" ${f.mode === "chat" ? "selected" : ""}>Chat (talk, look things up, plan)</option><option value="build" ${f.mode === "build" ? "selected" : ""}>Build (make, run and test things)</option></select></div>
      <div class="row2"><label>In which chat</label><select id="sj-conv"><option value="">A new chat</option>${chats.map((c) => `<option value="${esc(c.id)}" ${f.conversation === c.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>
      <div class="row2"><label>If the PC is off then</label><select id="sj-missed"><option value="run" ${f.missed === "run" ? "selected" : ""}>Do it when the PC is back</option><option value="skip" ${f.missed === "skip" ? "selected" : ""}>Skip that time</option></select></div>
      <div class="btns"><button class="primary" id="sj-save">${job ? "Save" : "Add to schedule"}</button><button class="ghost" id="sj-cancel">Cancel</button></div></div>` : "";
  const upcoming = jobs.filter((j) => j.enabled).sort((a, b) => (a.when === "time" ? a.at : "9") .localeCompare(b.when === "time" ? b.at : "9"));
  const old = jobs.filter((j) => !j.enabled);
  const row = (j) => `<div class="job${j.enabled ? "" : " off"}" data-job="${esc(j.id)}">
      <div class="job-when"><b>${esc(P3.whenText(j))}</b><span class="chip">${j.mode === "build" ? "Build" : "Chat"}</span>${j.by && j.by.startsWith("OVERDRIVE") ? `<span class="chip">it suggested, you said Yes</span>` : ""}</div>
      <div class="job-title">${esc(j.title)}</div>${j.text !== j.title ? `<div class="muted job-text">${esc(j.text.slice(0, 240))}</div>` : ""}
      <div class="mr-foot"><span class="muted">${j.last_run ? "last ran " + esc(P3.ago(j.last_run)) : j.finished ? "done" : "hasn't run yet"}</span>
        <span class="mr-acts"><button class="ghost xs" data-jact="run">Run now</button><button class="ghost xs" data-jact="edit">Change</button>
        <button class="ghost xs" data-jact="toggle">${j.enabled ? "Pause" : "Turn on"}</button><button class="ghost xs danger-t" data-jact="delete">Delete</button></span></div></div>`;
  $("#sched-body").innerHTML = `${editing ? form : `<div class="btns" style="margin-bottom:14px"><button class="primary" id="sj-new">+ New job</button>
      <span class="muted">Or just tell it in a chat: “do this Friday at 3” or “build it when my usage resets”.</span></div>`}
    ${upcoming.length ? `<div class="jobs">${upcoming.map(row).join("")}</div>` : (editing ? "" : `<div class="box muted">Nothing scheduled.</div>`)}
    ${old.length ? `<h2>Paused or finished</h2><div class="jobs">${old.map(row).join("")}</div>` : ""}
    <div class="muted" style="margin-top:16px;font-size:12.5px">Jobs run while OVERDRIVE is running. Turn on “Keep working when the window is closed” and “Start with Windows” on the While away page so they never get missed.</div>`;
  $("#nav-jobs").textContent = upcoming.length ? String(upcoming.length) : "";
  const whenSel = $("#sj-when");
  if (whenSel) whenSel.addEventListener("change", () => { const t = whenSel.value === "time"; $("#sj-at").disabled = !t; $("#sj-repeat").disabled = !t; });
};
P3.schedClick = async function (e) {
  const t = e.target;
  if (t.id === "sj-new") { P3.sched.editing = "new"; P3.renderSchedule(); $("#sj-text").focus(); return; }
  if (t.id === "sj-cancel") { P3.sched.editing = null; P3.renderSchedule(); return; }
  if (t.id === "sj-save") {
    const job = { text: $("#sj-text").value.trim(), title: $("#sj-title").value.trim(), when: $("#sj-when").value, at: $("#sj-at").value,
      repeat: $("#sj-repeat").value, mode: $("#sj-mode").value, conversation: $("#sj-conv").value, missed: $("#sj-missed").value };
    try {
      if (P3.sched.editing === "new") await api("/api/schedule/action", { action: "add", job });
      else await api("/api/schedule/action", { action: "update", id: P3.sched.editing, job });
      P3.sched.editing = null; toast("Saved to your schedule.", "ok", 3000); P3.loadSchedule();
    } catch (err) { toast(err.message, "bad"); }
    return;
  }
  const b = t.closest("[data-jact]");
  if (!b) return;
  const id = b.closest("[data-job]").dataset.job, act = b.dataset.jact, j = P3.sched.jobs.find((x) => x.id === id);
  try {
    if (act === "edit") { P3.sched.editing = id; P3.renderSchedule(); return; }
    if (act === "delete") { if (!confirm(`Delete the job "${j.title}"?`)) return; await api("/api/schedule/action", { action: "delete", id }); }
    if (act === "toggle") await api("/api/schedule/action", { action: "update", id, job: { enabled: !j.enabled, ...(j.when === "time" && !j.enabled && j.repeat === "once" && new Date(j.at) < new Date() ? { at: P3.localStamp(new Date(Date.now() + 600e3)) } : {}) } });
    if (act === "run") { const r = await api("/api/schedule/action", { action: "run", id }); switchTab("chat"); await refreshState(); openConversation(r.conversation); return; }
    P3.loadSchedule();
  } catch (err) { toast(err.message, "bad"); }
};

/* ---- the first-start tour, then it asks if you have questions */
P3.TOUR = [
  ["#composer", "Talk here", "Type what you want. Chat mode talks and plans; it only builds after you click Yes."],
  ["#mode", "Chat or Build", "Click to switch. Build mode makes, runs and tests things for real."],
  ["#mic", "Talk instead of typing", "The mic types what you say (Ctrl+Space). The wave button is voice mode: it talks back out loud, even while it builds (Ctrl+Shift+Space)."],
  ["#nav [data-tab=memory]", "Its memory", "Everything it remembers, sorted. Pin, change or delete anything. Personal things always ask before saving."],
  ["#nav [data-tab=away]", "While you're away", "When you leave the PC it hunts bugs for free and learns a little (your 5% or 10% pick)."],
  ["#nav [data-tab=schedule]", "Schedule", "Jobs for later, like a calendar: “do this Friday” or “when my usage resets”."],
  ["#net-light", "Internet light + accounts", "Green = internet works. If it drops, a banner stays until you close it. Next to it: your Claude accounts, one click to switch."],
  ["#nav [data-tab=settings]", "Settings", "Every feature has a switch here. Search them at the top."],
];
P3.tourAt = -1;
P3.startTour = function () { P3.tourAt = 0; switchTab("chat"); $("#tour").classList.remove("hidden"); P3.paintTour(); };
P3.paintTour = function () {
  const card = $("#tour-card"), hole = $("#tour-hole");
  if (P3.tourAt >= P3.TOUR.length) {
    hole.style.display = "none";
    card.className = "tour-card center";
    card.innerHTML = `<h3>That's the tour!</h3><p>Got any questions about OVERDRIVE? Ask anything, it answers in a chat.</p>
      <textarea id="tour-q" rows="2" placeholder="Like: how does voice mode work?"></textarea>
      <div class="btns"><button class="primary" id="tour-ask">Ask it</button><button class="ghost" id="tour-end">No questions, let's go</button></div>`;
    $("#tour-q").focus();
    return;
  }
  const [sel, title, text] = P3.TOUR[P3.tourAt];
  const el = $(sel);
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2 - 100, top: innerHeight / 2 - 30, width: 200, height: 60 };
  hole.style.display = "block";
  Object.assign(hole.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
  card.className = "tour-card";
  card.innerHTML = `<div class="muted tour-n">${P3.tourAt + 1} / ${P3.TOUR.length}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
    <div class="btns"><button class="primary" id="tour-next">${P3.tourAt === P3.TOUR.length - 1 ? "Finish" : "Next"}</button>${P3.tourAt ? `<button class="ghost" id="tour-back">Back</button>` : ""}<button class="ghost" id="tour-skip">Skip the tour</button></div>`;
  const cw = 330, below = r.top + r.height + 18 + 190 < innerHeight;
  card.style.left = Math.max(16, Math.min(innerWidth - cw - 16, r.left + r.width / 2 - cw / 2)) + "px";
  card.style.top = (below ? r.top + r.height + 18 : Math.max(16, r.top - 18 - card.offsetHeight)) + "px";
  if (!below) requestAnimationFrame(() => { card.style.top = Math.max(16, r.top - 18 - card.offsetHeight) + "px"; });
};
P3.endTour = async function () {
  $("#tour").classList.add("hidden"); P3.tourAt = -1;
  if (!S.state.settings.tour_done) await P3.setNow({ tour_done: true });
};
P3.tourClick = async function (e) {
  const id = e.target.id;
  if (id === "tour-next") { P3.tourAt++; P3.paintTour(); }
  if (id === "tour-back") { P3.tourAt--; P3.paintTour(); }
  if (id === "tour-skip" || id === "tour-end") P3.endTour();
  if (id === "tour-ask") {
    const q = $("#tour-q").value.trim();
    await P3.endTour();
    if (q) { newChat(); send("I just did the OVERDRIVE tour. My question: " + q); }
  }
};

/* ================================================================ Part 5: the "by the way" box */
P3.btw = { items: [] };
P3.openBtw = function (focus) { $("#btw").classList.remove("hidden"); $("#btw-toggle").classList.add("on"); $("#tab-chat").classList.add("btw-open"); if (focus) $("#btw-q").focus(); P3.paintBtw(); };
P3.paintBtw = function () {
  const list = $("#btw-list");
  list.innerHTML = P3.btw.items.length ? P3.btw.items.map((i) => `<div class="btw-item ${esc(i.status)}"><div class="btw-q">${esc(i.q)}</div>
      <div class="btw-a">${i.status === "thinking" ? `<span class="spin"></span> thinking...` : md(i.a)}</div></div>`).join("")
    : `<div class="muted btw-empty">Ask anything while it works: “what does that error mean?”, “how long will this take?”. The answer shows up here, not in the main chat, and the main job doesn't stop or slow down.</div>`;
  list.scrollTop = list.scrollHeight;
};
P3.btwItem = function (item) {
  const i = P3.btw.items.findIndex((x) => x.id === item.id);
  if (i >= 0) P3.btw.items[i] = item; else P3.btw.items.push(item);
  P3.btw.items = P3.btw.items.slice(-20);
  if (item.status !== "thinking") {
    if ($("#btw").classList.contains("hidden")) toast("By the way answer is ready (top right).", "ok", 4000);
    if (P3.v && P3.v.mode) P3.say(item.a);
  }
  P3.paintBtw();
};
P3.askBtw = async function (q) {
  q = (q || "").trim();
  if (!q) return;
  P3.openBtw(false);
  try { const r = await api("/api/btw", { text: q }); P3.btwItem(r.item); $("#btw-q").value = ""; }
  catch (e) { toast(e.message, "warn"); }
};


/* ================================================================ Part 5b: pictures, real Edit, quick read, idea buttons,
   "I was in the middle of X", drafts, looks */
P3.att = [];
P3.takeAttachments = function () { const a = P3.att.slice(); P3.att = []; P3.paintAtt(); return a; };
P3.paintAtt = function () {
  const tray = $("#att-tray");
  tray.classList.toggle("hidden", !P3.att.length);
  tray.innerHTML = P3.att.map((f, i) => `<span class="att"><img src="${picUrl({ file: f })}" alt=""><button type="button" data-attx="${i}" title="Remove">&times;</button></span>`).join("") +
    (P3.att.length ? `<span class="muted att-note">${P3.att.length} picture${P3.att.length === 1 ? "" : "s"} go with your next message</span>` : "");
};
P3.addFiles = async function (files) {
  for (const f of Array.from(files || [])) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) { toast(`${f.name || "That file"} isn't a picture OVERDRIVE can send (PNG, JPG, GIF or WebP).`, "warn"); continue; }
    if (f.size > 15 * 1024 * 1024) { toast(`${f.name} is too big (15 MB max).`, "warn"); continue; }
    if (P3.att.length >= 6) { toast("6 pictures max per message.", "warn"); break; }
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    try { const d = await api("/api/upload", { data }); if (!P3.att.includes(d.file)) P3.att.push(d.file); }
    catch (e) { toast(e.message, "bad"); }
  }
  P3.paintAtt();
  $("#msg").focus();
};
P3.meExtras = function (t) {
  const pics = (t.attachments || []).map((f, i) => `<figure class="pic me-pic" data-mepic="${esc(t.id)}" data-i="${i}"><img src="${picUrl({ file: f })}" alt="your picture" loading="lazy" onerror="this.parentNode.classList.add('gone')"></figure>`).join("");
  return (pics ? `<div class="me-pics">${pics}</div>` : "") + (t.rerun_of ? `<span class="edited-tag">edited</span>` : "");
};
P3.startEdit = function (id) {
  const t = S.tasks.get(id);
  const turn = $(`#turn-${id}`);
  if (!t || !turn) return;
  if (S.state && S.state.current && !S.state.current.background) { toast("Wait until it's done (or press STOP), then edit.", "warn"); return; }
  const me = $(".me", turn);
  me.classList.add("editing");
  me.innerHTML = `<textarea class="edit-box" rows="3" maxlength="20000"></textarea>
    <div class="edit-acts"><span class="muted">Everything after this message goes away and it answers this new version.</span><button class="ghost sm" data-editx>Cancel</button><button class="primary sm" data-editgo>Send</button></div>`;
  const box = $(".edit-box", me);
  box.value = t.request; box.focus(); box.setSelectionRange(box.value.length, box.value.length);
  const cancel = () => { const n = turnNode(t); turn.replaceWith(n); };
  const go = async () => {
    const text = box.value.trim();
    if (!text) return;
    if (text === t.request) { cancel(); return; }
    try {
      const r = await api("/api/edit", { task: id, text, attachments: t.attachments || [] });
      for (const [k, v] of S.tasks) if (v.created >= t.created && k !== r.task.id) { S.tasks.delete(k); const n = $(`#turn-${k}`); if (n) n.remove(); }
      upsertTask(r.task);
    } catch (e) { toast(e.message, "bad"); }
  };
  $("[data-editx]", me).addEventListener("click", cancel);
  $("[data-editgo]", me).addEventListener("click", go);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } if (e.key === "Escape") cancel(); });
};
/* Quick read line + buttons on its own ideas */
P3.decorate = function (wrap, t) {
  const ans = $(".answer[data-answer]", wrap);
  if (!ans || t.status === "running") return;
  const first = $("p, .pc", ans);
  if (first && /^\s*(\d+\s*)?Quick read:/i.test(first.textContent)) first.classList.add("quick-read");
  const heads = $$("p, h2, h3, .pc", ans).filter((el) => /^\s*(\d+\s*)?My ideas:?\s*$/i.test(el.textContent.replace(/[*]/g, "")));
  for (const h of heads) {
    let list = h.nextElementSibling;
    while (list && !/^(UL|OL)$/.test(list.tagName) && !$("ul, ol", list)) list = list.nextElementSibling;
    if (!list) continue;
    const ul = /^(UL|OL)$/.test(list.tagName) ? list : $("ul, ol", list);
    $$(":scope > li", ul).forEach((li, i) => {
      if ($(".idea-go", li)) return;
      const b = document.createElement("button");
      b.className = "ghost xs idea-go"; b.textContent = "Do this one"; b.dataset.idea = li.textContent.replace(/\s+/g, " ").trim();
      li.appendChild(b);
    });
    h.classList.add("ideas-head");
  }
};
P3.ideaClick = function (e) {
  const b = e.target.closest(".idea-go");
  if (!b) return false;
  e.stopPropagation();
  send(`Let's do your idea: ${b.dataset.idea.replace(/Do this one$/, "").trim()}`);
  return true;
};
/* "I was in the middle of X" after a power cut */
P3.interrupted = function (list) {
  const it = (list || [])[0];
  if (!it) return;
  const auto = S.state.settings.auto_resume;
  P3.banner("resume", `<span class="bn-ic"></span><div><b>I was in the middle of something</b> when OVERDRIVE or the PC turned off:
    <div class="muted">“${esc(it.request.slice(0, 160))}”${auto ? ` &middot; keeping going by itself in <span id="resume-count">25</span> s` : ""}</div></div>
    <button class="primary sm" data-resume="${esc(it.task)}">Keep going</button><button class="ghost sm" data-resume-leave="${esc(it.task)}">Leave it</button>`, "away");
  if (auto) {
    let n = 25;
    clearInterval(P3._rc);
    P3._rc = setInterval(() => { n--; const el = $("#resume-count"); if (el) el.textContent = String(Math.max(0, n)); if (n <= 0 || !P3.banners.has("resume")) { clearInterval(P3._rc); P3.banners.delete("resume"); P3.paintBanners(); } }, 1000);
  }
};
P3.resumeClick = async function (e) {
  const k = e.target.closest("[data-resume]"), l = e.target.closest("[data-resume-leave]");
  if (!k && !l) return false;
  clearInterval(P3._rc);
  P3.banners.delete("resume"); P3.paintBanners();
  try {
    if (k) { const r = await api("/api/interrupted", { task: k.dataset.resume }); await openConversation(r.task.conversation); upsertTask(r.task); }
    else await api("/api/interrupted", { task: l.dataset.resumeLeave, action: "leave" });
  } catch (err) { toast(err.message, "warn"); }
  return true;
};
/* drafts: what you were typing survives a crash or power cut (kept on this PC only) */
P3.draftKey = (c) => "od_draft_" + (c || "new");
P3.draftFor = undefined;          // which chat the text in the box belongs to (undefined = not loaded yet: never save over a draft)
P3.saveDraft = function () {
  if (P3.draftFor === undefined) return;
  try { const v = $("#msg").value; if (v) localStorage.setItem(P3.draftKey(P3.draftFor), v); else localStorage.removeItem(P3.draftKey(P3.draftFor)); } catch (e) { /* storage off */ }
};
P3.clearDraft = function () { try { localStorage.removeItem(P3.draftKey(P3.draftFor)); localStorage.removeItem(P3.draftKey(S.conv)); } catch (e) { /* storage off */ } };
P3.loadDraft = function () {
  P3.draftFor = S.conv || null;
  try { const v = localStorage.getItem(P3.draftKey(P3.draftFor)); if (v && !$("#msg").value) { $("#msg").value = v; autoGrow(); } } catch (e) { /* storage off */ }
};
/* looks: black or white, font, text size, accent color */
P3.FONTS = { default: ["Default", "\"Segoe UI\", system-ui, sans-serif"], bahnschrift: ["Bahnschrift (techy)", "Bahnschrift, \"Segoe UI\", sans-serif"],
  verdana: ["Verdana (wide, easy to read)", "Verdana, \"Segoe UI\", sans-serif"], trebuchet: ["Trebuchet (round)", "\"Trebuchet MS\", \"Segoe UI\", sans-serif"],
  georgia: ["Georgia (classic)", "Georgia, \"Times New Roman\", serif"], cascadia: ["Cascadia (code look)", "\"Cascadia Code\", Consolas, monospace"] };
P3.ACCENTS = [["#ff6a2b", "Orange"], ["#3b82f6", "Blue"], ["#a855f7", "Purple"], ["#22c55e", "Green"], ["#ef4444", "Red"], ["#ec4899", "Pink"], ["#eab308", "Gold"], ["#14b8a6", "Teal"]];
P3.applyLooks = function (s, noSave) {
  if (!s) return;
  if (!noSave) { try { localStorage.setItem("od_looks", JSON.stringify({ theme: s.theme, font: s.font, text_size: s.text_size, accent: s.accent })); } catch (e) { /* storage off */ } }
  const r = document.documentElement;
  r.dataset.theme = s.theme === "light" ? "light" : "dark";
  r.style.setProperty("--font", (P3.FONTS[s.font] || P3.FONTS.default)[1]);
  document.body.style.zoom = String((Number(s.text_size) || 100) / 100);
  const a = /^#[0-9a-f]{6}$/i.test(s.accent || "") ? s.accent : "#ff6a2b";
  const n = parseInt(a.slice(1), 16), rr = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * 0.3);
  r.style.setProperty("--accent", a);
  r.style.setProperty("--accent2", `rgb(${mix(rr)}, ${mix(g)}, ${mix(b)})`);
  r.style.setProperty("--accent-rgb", `${rr}, ${g}, ${b}`);
  r.style.setProperty("--accent-bg", `rgba(${rr}, ${g}, ${b}, .14)`);
};
P3.looksHtml = function (s, opt) {
  return `<div class="st-sec"><h3>Looks</h3>
    <div class="row2"><label>Background</label><select data-k="theme">${opt("dark", "Black (dark)", s.theme)}${opt("light", "White (light)", s.theme)}</select></div>
    <div class="row2"><label>Font</label><select data-k="font">${Object.entries(P3.FONTS).map(([k, v]) => opt(k, v[0], s.font)).join("")}</select></div>
    <div class="row2"><label>Text size</label><span class="range"><input type="range" data-k="text_size" min="80" max="140" step="5" value="${s.text_size}"><b data-rv-pct="text_size">${s.text_size}%</b></span></div>
    <div class="row2"><label>Accent color</label><span class="swatches">${P3.ACCENTS.map(([c, n]) => `<button type="button" class="sw${s.accent.toLowerCase() === c ? " on" : ""}" data-accent="${c}" title="${n}" style="--c:${c}"></button>`).join("")}
      <input type="color" data-k="accent" value="${esc(s.accent)}" title="Any color"></span></div>
    <div class="hint row2"><span></span><span class="hint">Changes show right away; press Save to keep them.</span></div>
  </div>
  <div class="st-sec"><h3>Chats</h3>
    <div class="row2"><label>Chat names</label><select data-k="chat_names">${opt("smart", "A short real name after the first answer", s.chat_names)}${opt("first_words", "The first words of my message", s.chat_names)}</select></div>
    <div class="row2"><label>Quick read line</label><label class="switch"><input type="checkbox" data-k="quick_read" ${s.quick_read ? "checked" : ""}> long answers start with a one-line summary</label></div>
    <div class="row2"><label>After a power cut</label><label class="switch"><input type="checkbox" data-k="auto_resume" ${s.auto_resume ? "checked" : ""}> keep going by itself (25 seconds to say Leave it)</label></div>
    <div class="row2"><label>Chat pictures</label><span class="inl"><select data-k="pictures_keep_days">${[[0, "Keep forever"], [7, "Delete after 7 days"], [30, "Delete after 30 days"], [90, "Delete after 90 days"], [365, "Delete after a year"]].map(([v, l]) => `<option value="${v}" ${Number(s.pictures_keep_days) === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-k="pictures_max_mb">${[[200, "or over 200 MB"], [500, "or over 500 MB"], [1000, "or over 1 GB"], [5000, "or over 5 GB"]].map(([v, l]) => `<option value="${v}" ${Number(s.pictures_max_mb) === v ? "selected" : ""}>${l}</option>`).join("")}</select></span></div>
    <div class="hint row2"><span></span><span class="hint">Old chat pictures get deleted after that time, or the oldest ones when the folder gets too big. Checked each time OVERDRIVE starts.</span></div>
    <div class="row2"><label>Your PC (no-lag check)</label><input data-k="pc_profile" maxlength="400" value="${esc(s.pc_profile || "")}" placeholder="Automatic (it reads your CPU, RAM and graphics card)"></div>
    <div class="hint row2"><span></span><span class="hint">Every game it builds must run smooth on this PC: auto quality, light textures, and it tests the frame rate.</span></div>
  </div>`;
};
P3.bind5b = function () {
  $("#attach").addEventListener("click", () => $("#attach-file").click());
  $("#attach-file").addEventListener("change", (e) => { P3.addFiles(e.target.files); e.target.value = ""; });
  $("#att-tray").addEventListener("click", (e) => { const x = e.target.closest("[data-attx]"); if (x) { P3.att.splice(Number(x.dataset.attx), 1); P3.paintAtt(); } });
  $("#msg").addEventListener("paste", (e) => { const files = Array.from((e.clipboardData || {}).files || []).filter((f) => f.type.startsWith("image/")); if (files.length) { e.preventDefault(); P3.addFiles(files); } });
  const chat = $("#tab-chat");
  chat.addEventListener("dragover", (e) => { if (Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); chat.classList.add("dropping"); } });
  chat.addEventListener("dragleave", (e) => { if (e.target === chat || !chat.contains(e.relatedTarget)) chat.classList.remove("dropping"); });
  chat.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); chat.classList.remove("dropping"); P3.addFiles(e.dataTransfer.files); } });
  $("#feed").addEventListener("click", (e) => {
    P3.ideaClick(e);
    const mp = e.target.closest("[data-mepic]");
    if (mp) { const t = S.tasks.get(mp.dataset.mepic); if (t) { LB.pics = (t.attachments || []).map((f) => ({ file: f, title: "Your picture" })); LB.i = Number(mp.dataset.i); showPicture(); $("#lightbox").classList.remove("hidden"); } }
  }, true);
  $("#banners").addEventListener("click", P3.resumeClick, true);
  let dt = null;
  $("#msg").addEventListener("input", () => { clearTimeout(dt); dt = setTimeout(P3.saveDraft, 600); });
  $("#settings-body").addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k || !["theme", "font", "text_size", "accent"].includes(k)) return;
    const preview = Object.assign({}, S.state.settings, { [k]: k === "text_size" ? Number(e.target.value) : e.target.value });
    P3.applyLooks(preview, true);
    const b = $(`[data-rv-pct="${k}"]`); if (b) b.textContent = e.target.value + "%";
  });
  $("#settings-body").addEventListener("change", (e) => { const k = e.target.dataset && e.target.dataset.k; if (k === "theme" || k === "font") { const v = Object.assign({}, S.state.settings, { [k]: e.target.value }); P3.applyLooks(v, true); } });
  $("#settings-body").addEventListener("click", (e) => {
    const sw = e.target.closest("[data-accent]");
    if (!sw) return;
    $("[data-k=accent]").value = sw.dataset.accent;
    $$(".sw").forEach((x) => x.classList.toggle("on", x === sw));
    P3.applyLooks(Object.assign({}, S.state.settings, { accent: sw.dataset.accent }), true);
  });
};


/* ================================================================ Part 5c: your old claude.ai chats */
P3.imp = { folders: [], open: new Set(), hits: [], viewing: null };
P3.loadImported = async function () {
  try { P3.imp.folders = (await api("/api/imported")).folders; } catch (e) { P3.imp.folders = []; }
  if (!S.chatHits) renderChats();
};
P3.dateShort = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); };
P3.impRow = function (c, snippet) {
  const row = document.createElement("div");
  row.className = "chat-row imp-row" + (P3.imp.viewing === c.key ? " on" : "");
  row.innerHTML = `<button class="chat-item" title="${esc(c.name)}">${c.first_ever ? `<span class="first-badge">First chat ever</span>` : ""}${esc(c.name)}
    <span class="imp-date">${esc(P3.dateShort(c.created))} &middot; ${c.messages} msg${c.messages === 1 ? "" : "s"}</span>${snippet ? `<span class="snip">${esc(snippet)}</span>` : ""}</button>`;
  $(".chat-item", row).addEventListener("click", () => { switchTab("chat"); P3.showImported(c.key); });
  return row;
};
P3.renderImported = function (box) {
  const f = P3.imp.folders || [];
  if (!f.length) return;
  const head = document.createElement("div");
  head.className = "imp-head";
  head.innerHTML = `<span>Imported from claude.ai</span><button class="ghost xs" data-impnew title="Import another export">+ Import</button>`;
  head.querySelector("[data-impnew]").addEventListener("click", P3.showImportChats);
  box.appendChild(head);
  for (const folder of f) {
    const open = P3.imp.open.has(folder.account);
    const fh = document.createElement("button");
    fh.className = "done-head imp-folder" + (open ? " open" : "");
    fh.innerHTML = `<span class="tri"></span><span class="imp-acc">${esc(folder.account)}</span> <span class="muted">${folder.count}</span>`;
    fh.addEventListener("click", () => { if (open) P3.imp.open.delete(folder.account); else P3.imp.open.add(folder.account); renderChats(); });
    box.appendChild(fh);
    if (open) for (const c of folder.chats) box.appendChild(P3.impRow(c));
  }
};
P3.searchImported = async function (q) {
  clearTimeout(P3._iq);
  P3._iq = setTimeout(async () => {
    try { const d = await api(`/api/imported?q=${encodeURIComponent(q)}`); if ($("#chat-q").value.trim() === q) { P3.imp.hits = d.hits; if (S.chatHits) renderChatHits(); } }
    catch (e) { /* none */ }
  }, 300);
};
P3.renderImportedHits = function (box) {
  const hits = P3.imp.hits || [];
  if (!hits.length) return;
  const head = document.createElement("div");
  head.className = "imp-head"; head.innerHTML = "<span>Imported chats</span>";
  box.appendChild(head);
  for (const h of hits) box.appendChild(P3.impRow(h, h.snippet));
};
P3.leaveImported = function () { if (P3.imp.viewing) { P3.imp.viewing = null; const v = $(".imp-view"); if (v) v.remove(); } };
P3.showImported = async function (key) {
  let d;
  try { d = await api(`/api/imported?key=${encodeURIComponent(key)}`); } catch (e) { toast(e.message, "bad"); return; }
  if (S.state && S.state.current && !S.state.current.background && S.conv === S.state.current.conversation) { /* leaving a working chat is fine: it keeps going */ }
  P3.saveDraft(); P3.draftFor = null;
  S.conv = null; S.tasks = new Map(); renderFeed();
  P3.imp.viewing = key;
  const m = d.meta;
  $("#chat-title").textContent = m.name;
  $("#empty").classList.add("hidden");
  const view = document.createElement("div");
  view.className = "imp-view";
  view.innerHTML = `<div class="imp-top">${m.first_ever ? `<span class="first-badge big">First chat ever</span>` : ""}<b>${esc(m.name)}</b>
      <span class="muted">from claude.ai &middot; ${esc(m.account)} &middot; made ${esc(new Date(m.created).toLocaleString([], { dateStyle: "long", timeStyle: "short" }))} &middot; ${m.messages} messages</span>
      <button class="primary sm" data-impgo="${esc(key)}">Keep going in a new chat</button></div>
    ${d.messages.map((x) => x.who === "you"
      ? `<div class="me"><div>${esc(x.text)}${x.files.length ? `<span class="imp-files">${x.files.map(esc).join(", ")}</span>` : ""}</div></div>`
      : `<div class="od imp-od"><div class="answer">${md(x.text)}</div><div class="muted imp-when">${esc(x.when ? new Date(x.when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "")}</div></div>`).join("")}`;
  $("#feed").appendChild(view);
  $("#feed").scrollTop = 0;
  $("[data-impgo]", view).addEventListener("click", async () => {
    try { const r = await api("/api/imported", { action: "continue", key }); P3.leaveImported(); await refreshState(); await openConversation(r.conversation); }
    catch (e) { toast(e.message, "bad"); }
  });
  renderChats();
};
P3.showImportChats = function () {
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Import your claude.ai chats</h2>
    <ol class="muted imp-steps"><li>On claude.ai: <b>Settings</b> &gt; <b>Privacy</b> &gt; <b>Export data</b>. Claude emails you a download link (it can take a while).</li>
    <li>Download the zip. In File Explorer hold <b>Shift</b>, right-click it, <b>Copy as path</b>.</li><li>Paste it here. Do this once per account.</li></ol>
    <div class="imp-row"><input id="impc-path" placeholder="C:\\Users\\you\\Downloads\\data-2026-11-17.zip" spellcheck="false"></div>
    <div class="imp-row"><input id="impc-acc" placeholder="Account name (blank = the email inside the export)" maxlength="80"><button class="primary" id="impc-go">Import</button></div>
    <div class="muted" style="font-size:12.5px">Every chat keeps its real name and the date you made it, in one folder per account, newest on top. Your oldest chat of all gets a \u201cFirst chat ever\u201d badge. Importing the same export again adds nothing twice. Nothing leaves your PC.</div>
    <div id="impc-out"></div>`;
  $("#drawer").classList.remove("hidden");
  $("#impc-go").addEventListener("click", async () => {
    const path = $("#impc-path").value.trim();
    if (!path) { toast("Paste the zip's path first.", "warn"); return; }
    $("#impc-go").disabled = true; $("#impc-out").innerHTML = `<div class="loading">Reading your chats (a big export can take a minute)...</div>`;
    try {
      const r = await api("/api/imported", { action: "import", path, account: $("#impc-acc").value.trim() });
      $("#impc-out").innerHTML = `<div class="box imp-done"><b>Done.</b> ${r.chats} chats in the export from <b>${esc(r.account)}</b>: ${r.added} new, ${r.updated} updated, ${r.skipped} already there.</div>`;
      P3.imp.open.add(r.account);
      P3.loadImported();
    } catch (e) { $("#impc-out").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    $("#impc-go").disabled = false;
  });
};


/* ================================================================ Part 5c: feelings, wants, its own upgrades */
P3.feel = null;
P3.MOODWORD = { happy: "happy", excited: "hyped", curious: "curious", proud: "proud", worried: "worried", frustrated: "frustrated", calm: "calm" };
P3.paintMind = function (f) {
  if (!f) return;
  P3.feel = f;
  $("#mind-word").textContent = f.word;
  $("#mind-chip .face").className = "face " + f.mood;
  if (!$("#drawer").classList.contains("hidden") && $("#mind-body")) P3.showMind();
};
P3.moodTone = function () {
  const m = (P3.feel && P3.feel.mood) || "calm";
  return { excited: { rate: 1.08, pitch: 1.06 }, happy: { rate: 1.03, pitch: 1.03 }, proud: { rate: 1.0, pitch: 1.02 },
    curious: { rate: 1.02, pitch: 1.04 }, worried: { rate: 0.97, pitch: 0.98 }, frustrated: { rate: 0.94, pitch: 0.95 } }[m] || { rate: 1, pitch: 1 };
};
P3.showMind = function () {
  const f = P3.feel;
  if (!f) return;
  $("#drawer-body").innerHTML = `<div id="mind-body"><h2 style="margin-top:0">How OVERDRIVE feels</h2>
    <div class="mind-top"><span class="face big ${esc(f.mood)}"><i></i><i></i><b></b></span><div><div class="mind-word">${esc(f.word)}</div>
      <div class="muted">${f.recent ? "Last thing that moved it: " + esc(f.recent) : "Nothing much happened yet."}</div></div></div>
    <div class="mood-bars">${Object.entries(f.moods).map(([k, v]) => `<div class="mb"><span>${esc(P3.MOODWORD[k] || k)}</span><div class="ub"><i class="mood-${esc(k)}" data-w="${v}"></i></div><b>${v}</b></div>`).join("")}</div>
    <p class="muted" style="font-size:12.5px">Its moods move with what happens (finishing things, failing, you being happy or mad, learning) and drift back to calm over a few hours. Its mood shows a little in how it talks and in its voice. Honest note: nobody can prove an AI truly feels.</p>
    <h2>Things it wants to get better at</h2>
    <div class="wants">${(f.wants || []).filter((w) => !w.done).map((w) => `<div class="want"><span>${esc(w.text)}</span><span class="muted">${esc(w.by)}</span><button class="ghost xs" data-dropwant="${esc(w.id)}">Remove</button></div>`).join("") || `<div class="muted">Nothing yet. It adds things when something goes wrong, or you can add some.</div>`}</div>
    <div class="imp-row"><input id="want-new" maxlength="200" placeholder="Something it should get better at"><button class="ghost" id="want-add">Add</button></div>
    <h2>Its own upgrades</h2>
    <div class="ups">${(f.upgrades || []).slice().reverse().map((u) => `<div class="up${u.on ? "" : " off"}"><div><b>${esc(u.title)}</b> <span class="chip">${esc(u.kind)}</span><div class="muted">${esc(u.change)}</div></div>
      <div class="btns"><button class="ghost xs" data-up="${esc(u.id)}" data-act="${u.on ? "upgrade_off" : "upgrade_on"}">${u.on ? "Turn off" : "Turn on"}</button><button class="ghost xs danger-t" data-up="${esc(u.id)}" data-act="upgrade_delete">Delete</button></div></div>`).join("") || `<div class="muted">None yet. When it finds a better way to work or talk, it asks you with a Yes/No card.</div>`}</div></div>`;
  applyWidths($("#drawer-body"));
  $("#drawer").classList.remove("hidden");
};
P3.mindClick = async function (e) {
  const dw = e.target.closest("[data-dropwant]"), up = e.target.closest("[data-up]");
  try {
    if (dw) P3.paintMind(await api("/api/feelings", { action: "drop_want", id: dw.dataset.dropwant }));
    else if (up) P3.paintMind(await api("/api/feelings", { action: up.dataset.act, id: up.dataset.up }));
    else if (e.target.id === "want-add") { const t = $("#want-new").value.trim(); if (t) P3.paintMind(await api("/api/feelings", { action: "add_want", text: t })); }
  } catch (err) { toast(err.message, "bad"); }
};

P3.showVersions = async function () {
  let d;
  try { d = await api("/api/selfmod"); } catch (e) { toast(e.message, "bad"); return; }
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">Its own versions</h2>
    <p class="muted">Every time it changes itself (after your Yes), the version before is kept here. Going back restarts OVERDRIVE. Your chats, memory and settings stay.</p>
    ${d.versions.length ? d.versions.map((v) => `<div class="want"><span>${esc(v.name.replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2}).*/, "$1-$2-$3 $4:$5"))}</span><button class="ghost xs" data-goback="${esc(v.name)}">Go back to this one</button></div>`).join("")
      : `<div class="muted">No older versions yet.</div>`}`;
  $("#drawer").classList.remove("hidden");
  $$("[data-goback]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Go back to that version? OVERDRIVE restarts.")) return;
    try { await api("/api/selfmod", { name: b.dataset.goback }); } catch (e) { toast(e.message, "bad"); }
  }));
};


/* ================================================================ Part 5d: live view, schedule instead, versions, your PC */
P3.live = { task: null };
P3.liveOpen = () => !$("#live").classList.contains("hidden");
P3.toggleLive = function (on) {
  const show = on === undefined ? !P3.liveOpen() : on;
  $("#live").classList.toggle("hidden", !show);
  $("#live-toggle").classList.toggle("on", show);
  $("#tab-chat").classList.toggle("live-open", show);
  if (show) P3.paintLive();
};
P3.paintLive = function () {
  if (!P3.liveOpen()) return;
  const t = P3.live.task || (S.state && S.state.current) || null;
  const body = $("#live-body");
  if (!t) { body.innerHTML = `<div class="muted live-empty">Nothing running right now. When it works, every step shows up here live: commands, files it changes, and screenshots from its game eyes.</div>`; return; }
  const calls = (t.calls || []).filter((c) => c.tool !== "task_plan");
  const last = calls[calls.length - 1];
  const pic = (t.pictures || []).slice(-1)[0];
  const running = t.status === "running";
  body.innerHTML = `<div class="live-now ${running ? "on" : ""}">${running ? `<span class="spin"></span> Working` : `<b>${esc(WORDS[t.status] || t.status)}</b>`}<span class="muted"> &middot; ${esc((t.request || "").slice(0, 80))}</span></div>
    ${last ? `<div class="live-step"><span class="muted">${running ? "Now" : "Last"}:</span> <b>${esc(last.title || last.tool)}</b> <span class="mono">${esc((last.args && (last.args.command || last.args.path || last.args.file_path || last.args.query || last.args.action)) || "")}</span></div>` : ""}
    ${pic ? `<figure class="live-pic" data-livepic><img src="${picUrl(pic)}" alt=""><figcaption>${esc(pic.title || "")}</figcaption></figure>` : ""}
    <div class="live-steps">${calls.slice(-10).reverse().map((c) => `<div class="ls ${c.ok === false ? "bad" : c.ok === null ? "wait" : "ok"}"><i></i><span>${esc(c.title || c.tool)}</span><span class="muted">${c.ms ? c.ms + " ms" : ""}</span></div>`).join("")}</div>
    ${(t.changes || []).length ? `<div class="live-files"><div class="muted">Files changed</div>${t.changes.slice(-8).map((c) => `<div class="mono">${esc(c.path)}</div>`).join("")}</div>` : ""}`;
};
P3.liveTask = function (t) {
  if (t.background && !P3.liveOpen()) return;
  if (t.status === "running" || !P3.live.task || P3.live.task.id === t.id) P3.live.task = t;
  P3.paintLive();
};
P3.scheduleInstead = function (card, p) {
  answerCard(card.id, "no", null, "Not now: I scheduled this for when my 5-hour usage resets.");
  switchTab("schedule");
  P3.sched.editing = "new";
  P3.loadSchedule().then(() => {
    $("#sj-text").value = "Build this (we planned it already): " + p.plan + ((p.steps || []).length ? "\nSteps: " + p.steps.join("; ") : "");
    $("#sj-mode").value = "build";
    $("#sj-when").value = "usage_reset"; $("#sj-at").disabled = true; $("#sj-repeat").disabled = true;
    $("#sj-title").value = p.plan.slice(0, 60);
    toast("Pick when, then press Add to schedule.", "ok", 5000);
  });
};
P3.showVersionsOf = async function (project) {
  let d;
  try { d = await api(`/api/timemachine?project=${encodeURIComponent(project)}`); } catch (e) { toast(e.message, "bad"); return; }
  $("#drawer-body").innerHTML = `<h2 style="margin-top:0">${esc(project)}: every version</h2>
    <p class="muted">A version is saved after each build that changed it. <b>Open a copy</b> puts an old version next to the current one (nothing is lost). <b>Go back</b> makes it the current one (the current one is saved first).</p>
    <div class="btns" style="margin-bottom:12px"><button class="ghost" data-tmsave>Save a version now</button></div>
    ${d.versions.length ? d.versions.map((v, i) => `<div class="tmv"><div><b>${esc(new Date(v.when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</b>${i === 0 ? ` <span class="chip">newest</span>` : ""}
        <div class="muted">${esc(v.why)} &middot; ${v.files} files</div></div>
        <div class="btns"><button class="ghost xs" data-tmopen="${esc(v.id)}">Open a copy</button>${i ? `<button class="ghost xs" data-tmback="${esc(v.id)}">Go back to this one</button>` : ""}</div></div>`).join("")
      : `<div class="muted">No versions yet. One is saved after the next build that changes it, or press Save a version now.</div>`}`;
  $("#drawer").classList.remove("hidden");
  const act = async (action, version) => {
    try {
      const r = await api("/api/timemachine", { action, project, version });
      toast(action === "open_copy" ? `Opened a copy in ${r.folder}` : action === "go_back" ? "Went back. The newer version was saved first." : r.saved ? "Saved a version." : "Nothing changed since the last version.", "ok", 6000);
      P3.showVersionsOf(project);
    } catch (e) { toast(e.message, "bad"); }
  };
  $$("[data-tmopen]").forEach((b) => b.addEventListener("click", () => act("open_copy", b.dataset.tmopen)));
  $$("[data-tmback]").forEach((b) => b.addEventListener("click", () => { if (confirm("Go back to this version? The current one is saved first.")) act("go_back", b.dataset.tmback); }));
  $("[data-tmsave]").addEventListener("click", () => act("save", ""));
};

P3.maybeTour = function () {
  // the first-start tour: once, and only when the setup screen isn't in the way
  if (P3.toured || !S.state || S.state.settings.tour_done) return;
  setTimeout(() => {
    if (P3.toured || S.state.settings.tour_done || !$("#setup").classList.contains("hidden") || P3.tourAt >= 0) return;
    P3.toured = true; P3.startTour();
  }, 900);
};
