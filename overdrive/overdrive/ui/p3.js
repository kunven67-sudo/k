"use strict";
/* OVERDRIVE Piece 3 window parts. Loaded before app.js; uses app.js helpers ($, api, esc, toast...) only
   when called, never at load time. app.js calls the P3.* hooks below. */

const P3 = {
  mem: { cat: "all", q: "", archived: false, rows: [], total: 0, counts: {}, names: {}, editing: null, open: new Set() },
};

/* ---------------------------------------------------------------- hooks app.js calls */
P3.state = function (st) {
  P3.paintMemCount(st.memory_counts);
  P3.renderQueue(st.queue);
  P3.paintAwayChip(st.away);
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
    case "projects_done": P3.askDone(ev.ask); if (ev.marked && ev.marked.length) toast(`Marked done (nobody touched them): ${ev.marked.join(", ")}`, "ok", 8000); break;
    default: break;
  }
};

P3.tab = function (tab) {
  if (tab === "memory") P3.loadMemory();
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
    </div>`;
};

P3.bind = function () {
  $("#mem-q").addEventListener("input", () => { clearTimeout(P3._mq); P3._mq = setTimeout(() => { P3.mem.q = $("#mem-q").value.trim(); P3.loadMemory(); }, 220); });
  $("#mem-arch").addEventListener("change", () => { P3.mem.archived = $("#mem-arch").checked; P3.loadMemory(); });
  $("#mem-import-btn").addEventListener("click", P3.showImport);
  $("#mem-body").addEventListener("click", P3.memClick);
  $("#settings-body").addEventListener("click", (e) => {
    if (e.target.id === "set-mem-open") switchTab("memory");
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
      <td><button class="ghost xs" data-pcheck="${esc(p.name)}" ${p.done ? "disabled" : ""}>Check now</button></td></tr>`).join("");
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
