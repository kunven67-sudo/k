// ---------- GAMES: menu + saves (shared by phone and PC) ----------
const KV = {
  async get(n) {
    try {
      if (window.Phone) return JSON.parse(P.kvGet(n) || "null");
      if (PCMODE) { const r = await fetch(`/api/kv?k=${KEY}&name=${n}`); const t = r.ok ? await r.text() : ""; return t ? JSON.parse(t) : null; }
      return JSON.parse(localStorage.getItem("kv_" + n) || "null");
    } catch (e) { return null; }
  },
  set(n, o) {
    const s = JSON.stringify(o);
    try {
      if (window.Phone) P.kvSet(n, s);
      else if (PCMODE) fetch(`/api/kv?k=${KEY}&name=${n}`, { method: "POST", body: s });
      else localStorage.setItem("kv_" + n, s);
    } catch (e) {}
  },
};
const GAMES = {};   // id -> { name, sub, icon, c1, c2, status(), open(), close() }
let curGame = null;
const GORDER = ["robot", "race", "planet", "empire"];
GAMES.empire = {
  name: "Power Empire", sub: "Build from a hand crank to a black hole engine", c1: "#3b3486", c2: "#1d1946",
  icon: '<path d="M13 2 4 14h7l-1 8 9-13h-7z"/>', status: () => window.Emp ? Emp.status() : "", open() {}, close() {},
};
function renderPick() {
  $("gpick").innerHTML = `<div class="gwatt"><span>YOUR REAL WATTS</span><b id="gpw">--</b><em>More watts = stronger in every game</em></div>` +
    GORDER.filter(id => GAMES[id]).map(id => { const g = GAMES[id]; return `<button class="gcard" data-g="${id}">
    <div class="ico" style="--c1:${g.c1};--c2:${g.c2}"><svg viewBox="0 0 24 24">${g.icon}</svg></div>
    <div class="t"><b>${g.name}</b><span>${g.sub}</span><em id="gst_${id}"></em></div></button>`; }).join("");
  document.querySelectorAll(".gcard").forEach(b => b.onclick = () => openGame(b.dataset.g));
}
function openGame(id) {
  if (curGame && GAMES[curGame]) GAMES[curGame].close();
  curGame = id;
  $("gpick").style.display = "none"; $("gview").classList.add("show");
  document.querySelectorAll(".game").forEach(g => g.classList.toggle("show", g.id === "g-" + id));
  GAMES[id].open(); scrollTo(0, 0);
}
function closeGame() {
  if (curGame && GAMES[curGame]) GAMES[curGame].close();
  curGame = null; $("gview").classList.remove("show"); $("gpick").style.display = "";
}
$("gback").onclick = closeGame;
// shared "watt boost" line every game shows
function wattBadge(mult, label) {
  return W > 0 ? `<b>${W.toFixed(1)} W</b> real charging = <b>x${mult.toFixed(1)}</b> ${label}`
    : `<b>Not charging</b> = x1 ${label}. Plug in to power up`;
}
setInterval(() => {
  if ($("gpick").offsetParent) {
    $("gpw").textContent = W > 0 ? W.toFixed(1) + " W" : "plug in";
    GORDER.forEach(id => { const e = $("gst_" + id); if (e && GAMES[id]) e.textContent = GAMES[id].status() || ""; });
  }
}, 1000);
window.addEventListener("load", renderPick);
