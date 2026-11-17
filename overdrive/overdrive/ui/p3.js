"use strict";
/* OVERDRIVE Piece 3 window parts. Loaded before app.js; uses app.js helpers ($, api, esc, toast...) only
   when called, never at load time. app.js calls the P3.* hooks below. */

const P3 = {
  mem: { cat: "all", q: "", archived: false, rows: [], total: 0, counts: {}, names: {}, editing: null, open: new Set() },
};

/* ---------------------------------------------------------------- hooks app.js calls */
P3.state = function (st) {
  P3.paintMemCount(st.memory_counts);
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
    default: break;
  }
};

P3.tab = function (tab) {
  if (tab === "memory") P3.loadMemory();
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
  return `<div class="st-sec"><h3>Memory</h3>
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
  $("#settings-body").addEventListener("click", (e) => { if (e.target.id === "set-mem-open") switchTab("memory"); });
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
