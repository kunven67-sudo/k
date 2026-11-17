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

/* ================================================================ hooks app.js / p3.js call */
P4.state = function (st) {
  P3.SR = P4.useOwnEars() ? OwnEars : (window.SpeechRecognition || window.webkitSpeechRecognition || OwnEars);
  if (window.FX) FX.apply(st.settings);
};
P4.event = function (ev) {
  switch (ev.type) {
    case "voice": P4.voiceEvent(ev); break;
    default: break;
  }
};
