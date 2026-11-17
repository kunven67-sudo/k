"use strict";
/* OVERDRIVE Piece 4 window parts: its own app window, its own ears, sounds, looks, music hooks, profiles,
   task list, slash commands, roleplay... Loaded before app.js; uses app.js helpers only when called. */

const P4 = { host: window.OD_HOST || null, vs: { sid: 0, active: null } };

/* ================================================================ its own window (OVERDRIVE.exe --window)
   Links to websites open in your normal browser, never inside OVERDRIVE's window. */
P4.post = function (o) { if (P4.host) P4.host.post(o); };
P4.openLink = function (url) {
  if (P4.host) P4.post({ cmd: "open", url });
  else window.open(url, "_blank", "noopener");
};
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  if (/^(https?:|ms-settings:)/i.test(href) && !href.startsWith(location.origin)) {
    e.preventDefault();
    P4.openLink(href);
  }
}, true);
window.OD_HOST_EVENT = function (ev) {
  if (ev && ev.type === "fullscreen") document.body.classList.toggle("is-full", !!ev.on);
  if (P4.os && P4.os.hostEvent) P4.os.hostEvent(ev);
};
P4.flash = function () { if (document.hidden || !document.hasFocus()) P4.post({ cmd: "flash" }); };
document.addEventListener("keydown", (e) => {
  if (e.key === "F11" && P4.host) { e.preventDefault(); P4.post({ cmd: "fullscreen" }); }
});

/* small window / zoomed in: the side (menu + chats) slides in from the left */
document.addEventListener("click", (e) => {
  if (e.target.closest && e.target.closest("#side-toggle")) { document.body.classList.toggle("side-open"); return; }
  if (document.body.classList.contains("side-open") && e.target.closest && e.target.closest("#side .chat-item, #nav button, #new-chat"))
    setTimeout(() => document.body.classList.remove("side-open"), 120);
});

/* ================================================================ its own ears (offline speech typing)
   Same shape as the browser's SpeechRecognition, so the Piece 3 mic + voice mode code works unchanged. */
P4.useOwnEars = function () {
  const pick = (S.state && S.state.settings && S.state.settings.voice_engine) || "auto";
  const browser = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (pick === "own") return true;
  if (pick === "browser") return !browser;
  return !!P4.host || !browser;           // auto: its own window has no speech typing, so its own ears
};
class OwnEars {
  constructor() { this.continuous = true; this.interimResults = true; this.lang = "en-US"; this.onresult = null; this.onerror = null; this.onend = null; this._sid = 0; this._ended = false; }
  async start() {
    P4.vs.active = this;
    let r;
    try { r = await api("/api/voice", { action: "start", for: P3.v.recFor || "dict" }); }
    catch (e) { this._fail("start", e.message); return; }
    if (P4.vs.active !== this) { api("/api/voice", { action: "stop" }).catch(() => {}); return; }
    if (r.downloading) { P4.voicePackToast(r); this._fail("downloading"); return; }
    this._sid = r.session; P4.vs.sid = r.session;
    P4.sound("mic_on");
  }
  abort() { this.stop(); }
  stop() {
    if (P4.vs.active === this) { P4.vs.active = null; api("/api/voice", { action: "stop" }).catch(() => {}); P4.sound("mic_off"); }
    this._end();
  }
  _end() { if (this._ended) return; this._ended = true; setTimeout(() => this.onend && this.onend(), 0); }
  _fail(code, msg) {
    if (P4.vs.active === this) P4.vs.active = null;
    if (msg) toast(msg, "bad", 10000);
    if (this.onerror) this.onerror({ error: code === "downloading" ? "aborted" : "own-ears" });
    this._ended = true;     // don't restart by itself after a failure
    if (P3.v.recFor === "dict") P3.endDictation(); else P3.endVoice();
  }
  _result(text, final) {
    const alt = { transcript: (final ? text + " " : text) };
    const res = [Object.assign([alt], { isFinal: final, 0: alt, length: 1 })];
    if (this.onresult) this.onresult({ resultIndex: 0, results: res });
  }
}
P4.OwnEars = OwnEars;
P4.voiceEvent = function (ev) {
  const ears = P4.vs.active;
  switch (ev.kind) {
    case "partial": if (ears && ev.session === ears._sid) ears._result(ev.text, false); break;
    case "final": if (ears && ev.session === ears._sid) ears._result(ev.text, true); break;
    case "level": P4.micLevel(ev.level); break;
    case "error": toast(ev.error, "bad", 11000); if (ears && (!ev.session || ev.session === ears._sid)) ears._fail("own-ears"); break;
    case "end": if (ears && ev.session === ears._sid) { P4.vs.active = null; ears._end(); } break;
    case "download": P4.voicePackProgress(ev.done, ev.total); break;
    case "download_done": P4.voicePackProgress(1, 1); toast("Voice pack ready. Press the mic again and talk.", "ok", 6000); P4.sound("success"); break;
    default: break;
  }
};
P4.micLevel = function (lvl) {
  document.documentElement.style.setProperty("--mic-level", String(lvl || 0));
};
P4.voicePackToast = function (st) {
  toast(`Getting OVERDRIVE's voice pack first (about ${st.size_mb || 40} MB, only once). The mic works by itself after that, even offline.`, "ok", 9000);
  P4.voicePackProgress(0, 1);
};
P4.voicePackProgress = function (done, total) {
  let el = $("#vpack");
  if (!el) { document.body.insertAdjacentHTML("beforeend", `<div id="vpack" class="vpack"><b>Voice pack</b><div class="vp-bar"><i></i></div><span class="vp-pct">0%</span></div>`); el = $("#vpack"); }
  const pct = total ? Math.round((100 * done) / total) : 0;
  el.querySelector("i").style.width = pct + "%";
  el.querySelector(".vp-pct").textContent = pct >= 100 ? "ready" : pct + "%";
  if (pct >= 100) setTimeout(() => el.remove(), 2500);
};

/* ================================================================ sounds (filled in by fx.js) */
P4.sound = function (name) { if (window.FX) FX.play(name); };

/* ================================================================ finishing sounds + Windows notifications */
P4.taskFinished = function (t) {
  const big = (t.duration_ms || 0) > 180000 || (t.turns || 0) >= 15;
  if (t.status === "done") P4.sound(big ? "big_done" : "done");
  else if (t.status === "failed") P4.sound("error");
  else P4.sound("pop");
  if (document.hidden || !document.hasFocus()) {
    P4.flash();
    P4.notify(t.status === "done" ? "Done" : t.status === "failed" ? "It hit a problem" : "Finished",
      (t.final_text || t.error || t.request || "").replace(/[#*_`>]/g, "").slice(0, 160), "task:" + t.id);
  }
};
P4.notify = function (title, body, tag) {
  // Windows notification (only while OVERDRIVE's window is in the back; Settings > Notifications)
  if (S.state && S.state.settings && S.state.settings.notify === false) return;
  if (P4.host) { P4.post({ cmd: "notify", title: "OVERDRIVE: " + title, text: body || "" }); return; }
  try {
    if (!("Notification" in window)) return;
    const go = () => { const n = new Notification("OVERDRIVE: " + title, { body, tag, icon: "/static/favicon.svg", silent: true }); n.onclick = () => { P4.post({ cmd: "front" }); window.focus(); n.close(); }; };
    if (Notification.permission === "granted") go();
    else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => { if (p === "granted") go(); });
  } catch (e) { /* no notifications here */ }
};
P4.notifyNeedsYou = function () { if (document.hidden || !document.hasFocus()) P4.notify("It needs you", "A Yes / No question is waiting in OVERDRIVE.", "needs"); };

/* ================================================================ hooks app.js / p3.js call */
P4.state = function (st) {
  if (!P4.booted) { P4.booted = true; if (window.FX) { FX.s = st.settings || {}; document.documentElement.dataset.motion = FX.s.motion || "full"; FX.boot(); } }
  P3.SR = P4.useOwnEars() ? OwnEars : (window.SpeechRecognition || window.webkitSpeechRecognition || OwnEars);
  if (window.FX) FX.apply(st.settings);
};
P4.event = function (ev) {
  switch (ev.type) {
    case "voice": P4.voiceEvent(ev); break;
    case "limit_hit": P4.limitScreen(ev); break;
    default: break;
  }
};

/* ================================================================ Settings > Looks: moving background, animations, sounds */
P4.thumbs = {};
P4.looksHtml = function (s, opt) {
  const scenes = Object.keys(FX.SCENE_NAMES);
  const tile = (key, label) => `<button type="button" class="bg-tile${s.background === key ? " on" : ""}" data-bg="${key}">
      <span class="bg-thumb" data-thumb="${key}"></span><span class="bg-name">${esc(label)}</span></button>`;
  return `<div class="st-sec"><h3>Moving background</h3>
    <input type="hidden" data-k="background" value="${esc(s.background)}"><input type="hidden" data-k="bg_custom" value="${esc(s.bg_custom || "")}">
    <div class="bg-grid">${scenes.map((k) => tile(k, FX.SCENE_NAMES[k])).join("")}
      <button type="button" class="bg-tile${s.background === "none" ? " on" : ""}" data-bg="none"><span class="bg-thumb none"></span><span class="bg-name">No background</span></button></div>
    <div class="bg-own"><b>Your own</b> <span class="muted">a picture or a video (MP4 / WebM) from your PC</span>
      <button type="button" class="ghost sm" id="bg-add">Add a picture or video</button><input type="file" id="bg-file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" hidden>
      <div class="bg-grid own" id="bg-own-list"><span class="muted">Loading...</span></div></div>
    <div class="row2"><label>Background darkness</label><span class="range"><input type="range" data-k="bg_dim" min="0" max="90" step="5" value="${Number(s.bg_dim)}"><b data-rv-pct="bg_dim">${Number(s.bg_dim)}%</b></span></div>
    <div class="row2"><label>Animations</label><select data-k="motion">${opt("full", "Full (everything moves, shines and slides)", s.motion)}${opt("calm", "Calm (slower, no shine)", s.motion)}${opt("off", "Off (nothing moves, lightest on the PC)", s.motion)}</select></div>
    <div class="hint row2"><span></span><span class="hint">It draws the background small and at 30 frames a second, and stops completely when the window is hidden. If your graphics card struggles, it lowers the quality by itself.</span></div>
  </div>
  <div class="st-sec"><h3>Sounds</h3>
    <div class="row2"><label>Sounds</label><label class="switch"><input type="checkbox" data-k="sounds" ${s.sounds !== false ? "checked" : ""}> clicks, mic beeps, done and needs-you sounds</label></div>
    <div class="row2"><label>Sound style</label><select data-k="sound_pack">${opt("studio", "Studio (real recorded clicks and switches)", s.sound_pack)}${opt("soft", "Soft (gentle tones)", s.sound_pack)}${opt("arcade", "Arcade (retro blips)", s.sound_pack)}</select></div>
    <div class="row2"><label>Sound volume</label><span class="range"><input type="range" data-k="sound_volume" min="0" max="100" step="5" value="${Number(s.sound_volume)}"><b data-rv-pct="sound_volume">${Number(s.sound_volume)}%</b></span></div>
    <div class="row2"><label></label><span class="btns"><button type="button" class="ghost sm" data-try-sound="click">Try a click</button><button type="button" class="ghost sm" data-try-sound="done">Done</button><button type="button" class="ghost sm" data-try-sound="needs_you">Needs you</button><button type="button" class="ghost sm" data-try-sound="mic_on">Mic on</button><button type="button" class="ghost sm" data-try-sound="big_done">Big job done</button></span></div>
    <div class="row2"><label>Windows notifications</label><label class="switch"><input type="checkbox" data-k="notify" ${s.notify !== false ? "checked" : ""}> when a job finishes or it needs you while the window is in the back</label></div>
  </div>`;
};
P4.paintThumbs = function () {
  $$("[data-thumb]").forEach((el) => {
    const k = el.dataset.thumb;
    if (!FX.SCENE_NAMES[k]) return;
    if (!P4.thumbs[k]) P4.thumbs[k] = FX.preview(k, 192, 112);
    if (P4.thumbs[k]) el.style.backgroundImage = `url(${P4.thumbs[k]})`;
  });
};
P4.bgUrl = (name) => `/bgfile/${encodeURIComponent(name)}?k=${encodeURIComponent(S.token)}`;
P4.loadOwnBgs = async function () {
  const box = $("#bg-own-list");
  if (!box) return;
  let d;
  try { d = await api("/api/bg"); } catch (e) { box.innerHTML = `<span class="err">${esc(e.message)}</span>`; return; }
  const cur = $("[data-k=bg_custom]") ? $("[data-k=bg_custom]").value : "";
  const bgNow = $("[data-k=background]") ? $("[data-k=background]").value : "";
  box.innerHTML = d.files.length ? d.files.map((f) => `<button type="button" class="bg-tile${bgNow === "custom" && cur === f.name ? " on" : ""}" data-bg="custom" data-file="${esc(f.name)}">
      <span class="bg-thumb">${f.video ? `<video src="${P4.bgUrl(f.name)}" muted preload="metadata"></video><i class="vid-badge">video</i>` : `<img src="${P4.bgUrl(f.name)}" alt="">`}</span>
      <span class="bg-name">${f.video ? "Video" : "Picture"} &middot; ${f.mb} MB <span class="bg-x" data-bg-x="${esc(f.name)}" title="Remove">&times;</span></span></button>`).join("")
    : `<span class="muted">None yet. Add a picture or a video and it becomes the background.</span>`;
};
P4.previewLooks = function () {
  const v = Object.assign({}, S.state.settings);
  $$("#settings-body [data-k]").forEach((el) => {
    const k = el.dataset.k;
    if (!["background", "bg_custom", "bg_dim", "motion", "sounds", "sound_pack", "sound_volume"].includes(k)) return;
    v[k] = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
  });
  FX.apply(v);
};
P4.uploadBg = async function (file) {
  if (!file) return;
  if (file.size > 400 * 1024 * 1024) { toast("That file is too big (400 MB max).", "bad"); return; }
  toast(`Adding ${file.name}...`, "", 3000);
  try {
    const r = await fetch("/api/bg/upload", { method: "POST", headers: { "X-OD-Token": S.token, "Content-Type": "application/octet-stream" }, body: file });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.statusText);
    $("[data-k=background]").value = "custom"; $("[data-k=bg_custom]").value = d.file;
    $$(".bg-tile").forEach((t) => t.classList.remove("on"));
    await P4.loadOwnBgs();
    P4.previewLooks();
    toast("Added. It's your background now (press Save to keep it).", "ok", 6000);
    FX.play("success");
  } catch (e) { toast(e.message, "bad", 8000); }
};
P4.settingsClick = async function (e) {
  const rem = e.target.closest("[data-bg-x]");
  if (rem) {
    e.stopPropagation();
    if (!confirm("Remove this background from OVERDRIVE?")) return;
    try {
      await api("/api/bg/delete", { name: rem.dataset.bgX });
      if ($("[data-k=bg_custom]").value === rem.dataset.bgX) { $("[data-k=bg_custom]").value = ""; $("[data-k=background]").value = "aurora"; }
      P4.loadOwnBgs(); P4.previewLooks();
    } catch (err) { toast(err.message, "bad"); }
    return;
  }
  const t = e.target.closest("[data-bg]");
  if (t) {
    $("[data-k=background]").value = t.dataset.bg;
    if (t.dataset.file) $("[data-k=bg_custom]").value = t.dataset.file;
    $$(".bg-tile").forEach((x) => x.classList.toggle("on", x === t));
    P4.previewLooks();
    return;
  }
  const ts = e.target.closest("[data-try-sound]");
  if (ts) { P4.previewLooks(); setTimeout(() => FX.play(ts.dataset.trySound), 30); return; }
  if (e.target.id === "bg-add") $("#bg-file").click();
};
P4.bindSettings = function () {
  const body = $("#settings-body");
  if (!body || body._p4) return;
  body._p4 = true;
  body.addEventListener("click", P4.settingsClick);
  body.addEventListener("change", (e) => {
    if (e.target.id === "bg-file") { P4.uploadBg(e.target.files[0]); e.target.value = ""; return; }
    const k = e.target.dataset && e.target.dataset.k;
    if (["motion", "sounds", "sound_pack"].includes(k)) P4.previewLooks();
  });
  body.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (["bg_dim", "sound_volume"].includes(k)) { P4.previewLooks(); const b = $(`[data-rv-pct="${k}"]`); if (b) b.textContent = e.target.value + "%"; }
  });
};
P4.afterSettings = function () { P4.bindSettings(); P4.paintThumbs(); P4.loadOwnBgs(); };

/* ================================================================ out of usage: the fuel gauge screen */
P4.limitScreen = function (ev) {
  const old = $("#limit-screen");
  if (old) old.remove();
  clearInterval(P4._lsT);
  const paused = ev.kind === "paused";
  const others = (ev.others || []).filter((n) => n !== ev.account);
  const acct = (S.state && S.state.accounts && S.state.accounts.accounts || []).find((a) => a.name === ev.account) || {};
  const pct = paused ? Math.round(ev.pct || 90) : 100;
  const el = document.createElement("div");
  el.id = "limit-screen";
  el.className = "limit-screen" + (paused ? " paused" : "");
  const ticks = Array.from({ length: 11 }, (_, i) => `<i style="--a:${-95 + i * 19}deg"></i>`).join("");
  el.innerHTML = `<div class="ls-card">
    <div class="ls-gauge"><div class="ls-ticks">${ticks}</div>
      <span class="ls-f">F</span><span class="ls-e">E</span>
      <div class="ls-needle" style="--to:${paused ? -95 + (100 - pct) * 1.9 : -95}deg"></div><div class="ls-hub"></div>
      <div class="ls-glow"></div></div>
    <h2>${paused ? `Paused at ${pct}% of your Claude usage` : "Out of Claude usage for now"}</h2>
    <p class="muted">${esc(ev.text || "")}${acct.plan ? ` <span class="plan-badge p-${esc(acct.plan.split(" ")[0].toLowerCase())}">${esc(acct.plan)}</span>` : ""}</p>
    <div class="ls-count"><span class="muted">${ev.resets_at ? "Back in" : "Comes back by itself"}</span><b id="ls-left">${ev.resets_at ? "" : "soon"}</b>
      ${ev.resets_at ? `<span class="muted" id="ls-at"></span>` : ""}</div>
    <div class="ls-btns">${others.map((n) => `<button class="primary" data-ls-use="${esc(n)}">Use ${esc(n)}</button>`).join("")}
      <button class="ghost" data-ls="schedule">Schedule it for when it's back</button>
      ${paused ? `<button class="ghost" data-ls="raise">Change the pause %</button>` : ""}
      <button class="ghost" data-ls="music">Play chill music while I wait</button>
      ${others.length ? "" : `<button class="ghost" data-ls="accounts">Add another account</button>`}
      <button class="ghost" data-ls="close">Close</button></div>
    <div class="muted ls-note">It never switches accounts by itself (that can get accounts banned). Everything you made is saved.</div>
  </div>`;
  ($("#tab-chat") || document.body).appendChild(el);
  P4.sound("limit");
  const tick = () => {
    const left = ev.resets_at ? Math.max(0, ev.resets_at * 1000 - Date.now()) : 0;
    const b = $("#ls-left");
    if (!b) { clearInterval(P4._lsT); return; }
    if (!ev.resets_at) return;
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
    b.textContent = left <= 0 ? "now" : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
    const at = $("#ls-at");
    if (at) at.textContent = "at " + new Date(ev.resets_at * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (left <= 0) { clearInterval(P4._lsT); el.classList.add("refilled"); P4.sound("success"); }
  };
  tick();
  P4._lsT = setInterval(tick, 1000);
  el.addEventListener("click", async (e) => {
    const u = e.target.closest("[data-ls-use]"), b = e.target.closest("[data-ls]");
    if (u) {
      try { await api("/api/accounts/action", { action: "switch", name: u.dataset.lsUse }); toast(`Now using the ${u.dataset.lsUse} account. Send your message again.`, "ok", 6000);
        P3.banners.delete("limit"); P3.paintBanners(); checkSetup(true, true); P4.closeLimit(); }
      catch (err) { toast(err.message, "bad"); }
      return;
    }
    if (!b) return;
    const what = b.dataset.ls;
    if (what === "close") P4.closeLimit();
    else if (what === "schedule") { P4.closeLimit(); switchTab("schedule"); }
    else if (what === "raise") { P4.closeLimit(); switchTab("settings"); S.setQ = "usage"; renderSettings(); }
    else if (what === "accounts") { P4.closeLimit(); P3.showAccounts(); }
    else if (what === "music") { if (window.MUSIC) MUSIC.play(); else toast("Music comes with the music player.", "", 4000); }
  });
};
P4.closeLimit = function () { const el = $("#limit-screen"); if (el) { el.classList.add("out"); setTimeout(() => el.remove(), 300); } clearInterval(P4._lsT); };
P4.limitFromError = function (msg) {
  const m = String(msg || "");
  const paused = m.match(/usage is at (\d+)%/);
  if (!paused && !/limit is used up/i.test(m)) return false;
  const lim = (S.state && S.state.usage && S.state.usage.limits) || [];
  const fh = lim.find((x) => x.type === "five_hour") || lim[0] || {};
  P4.limitScreen({ kind: paused ? "paused" : "out", pct: paused ? Number(paused[1]) : 100, text: m,
    account: S.state && S.state.accounts ? S.state.accounts.active : "main",
    others: S.state && S.state.accounts ? S.state.accounts.accounts.map((a) => a.name) : [], resets_at: fh.resets_at || null });
  return true;
};
