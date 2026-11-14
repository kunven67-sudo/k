// ---------- VOLT RUSH: your real watts = your car's top speed in auto races ----------
(() => {
  const LEAGUES = [
    { name: "ROOKIE", base: 150, len: 600 }, { name: "STREET", base: 200, len: 750 }, { name: "PRO", base: 265, len: 900 },
    { name: "ELITE", base: 350, len: 1050 }, { name: "LEGEND", base: 460, len: 1200 }, { name: "HYPER", base: 600, len: 1400 },
  ];
  const RIVALS = ["BLITZ", "NOVA", "DASH", "KILO", "RAZOR", "JINX", "ECHO", "VIPER", "ZED", "ORBIT"];
  const COLORS = ["#ff6a6a", "#ffcf5a", "#59c8ff", "#c5b3ff", "#ff9bd2", "#9be36a"];
  const PRIZE = [120, 70, 45, 30, 20, 12];
  const UP = [
    { k: "eng", name: "Engine", base: 60, d: l => `Top speed ${Math.round(140 * Math.pow(1.12, l))} km/h` },
    { k: "tire", name: "Tires", base: 50, d: l => `Grip x${Math.pow(1.1, l).toFixed(2)}` },
    { k: "aero", name: "Aero Kit", base: 70, d: l => `+${l * 3}% top speed` },
    { k: "nitro", name: "Nitro", base: 90, d: l => `Fills ${6 + 2 * l}%/s` },
    { k: "volt", name: "Watt Motor", base: 120, d: l => `Each real watt +${(3 + 0.5 * l).toFixed(1)}% speed` },
  ];
  const cost = (u, l) => u.base * Math.pow(1.6, l);
  let st = null, el = null, race = null, raf = 0, timers = [];
  const def = () => ({ cash: 0, league: 0, sel: 0, wins: [0, 0, 0, 0, 0, 0], races: 0, p: { eng: 0, tire: 0, aero: 0, nitro: 0, volt: 0 } });
  const save = () => st && KV.set("race", st);
  const wb = () => 1 + W * (0.03 + 0.005 * st.p.volt);
  const myTop = () => 140 * Math.pow(1.12, st.p.eng) * (1 + 0.03 * st.p.aero) * wb();

  const carSvg = (c, me) => `<svg viewBox="0 0 58 28" width="58" height="28">
    <path d="M3 19c0-4 3-6 8-7l9-6h16l10 6c6 1 9 3 9 7v3H3z" fill="${c}"/>
    <path d="M21 8h8v5h-13zM31 8h5l7 5H31z" fill="#0a0918" opacity=".55"/>
    ${me ? '<path d="M0 15h4M0 19h3" stroke="#8ef0d8" stroke-width="2"/>' : ""}
    <circle cx="15" cy="22" r="5" fill="#111"/><circle cx="15" cy="22" r="2" fill="#888"/>
    <circle cx="45" cy="22" r="5" fill="#111"/><circle cx="45" cy="22" r="2" fill="#888"/></svg>`;

  function render() {
    el.innerHTML = `<div class="gtitle"><h2>VOLT RUSH</h2><span class="money" id="rcCash"></span></div>
      <div class="leagues" id="rcLeagues"></div>
      <div class="track" id="rcTrack" style="margin-top:10px"><div class="finish"></div>${Array.from({ length: 6 }, (_, i) =>
        `<div class="lane${i === 0 ? " me" : ""}"><span class="nm" id="rcN${i}"></span><div class="car" id="rcC${i}"></div></div>`).join("")}
        <div class="count" id="rcCount"></div></div>
      <div class="speedo"><div class="stat"><i>SPEED</i><b id="rcSpd">0</b></div><div class="stat"><i>PLACE</i><b id="rcPos">-</b></div>
        <div class="stat"><i>WINS</i><b id="rcWins"></b></div></div>
      <div class="nitro" id="rcNitro"><i></i></div>
      <div class="badge" id="rcBadge"></div>
      <div class="results" id="rcRes"></div>
      <button class="bigbtn" id="rcGo">RACE</button>
      <div class="ebar"><div class="head2">GARAGE</div><div class="head2" id="rcTop"></div></div>
      <div class="shop" id="rcShop"></div>`;
    $("rcGo").onclick = () => race ? null : start();
    renderLeagues(); renderShop(); grid(); paint();
  }
  function renderLeagues() {
    $("rcLeagues").innerHTML = LEAGUES.map((l, i) => `<button data-l="${i}" class="${i === st.sel ? "on" : ""}" ${i > st.league ? "disabled" : ""}>
      ${l.name}${i < st.league ? " · BEAT" : ""}</button>`).join("");
    document.querySelectorAll("#rcLeagues button").forEach(b => b.onclick = () => { if (race) return; st.sel = +b.dataset.l; save(); renderLeagues(); grid(); paint(); });
  }
  function rivalsFor(L, seed) {
    return [0.86, 0.92, 0.97, 1.01, 1.06].map((k, i) => ({ name: RIVALS[(seed + i * 3) % RIVALS.length], top: L.base * k * (0.97 + Math.random() * 0.06), acc: 0.42 }));
  }
  function grid() {
    const L = LEAGUES[st.sel];
    $("rcN0").textContent = "YOU";
    $("rcC0").innerHTML = carSvg("#8ef0d8", true);
    for (let i = 1; i < 6; i++) { $("rcN" + i).textContent = RIVALS[(st.sel * 2 + (i - 1) * 3) % RIVALS.length]; $("rcC" + i).innerHTML = carSvg(COLORS[i - 1]); $("rcC" + i).style.transform = ""; }
    $("rcC0").style.transform = "";
  }
  function renderShop() {
    $("rcShop").innerHTML = UP.map(u => { const l = st.p[u.k];
      return `<div class="bld"><div class="ico" style="--c1:#1f6f8b;--c2:#103745"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M5 5l2 2"/></svg></div>
        <div class="t"><b>${u.name} <small style="color:var(--dim)">LV ${l}</small></b><span>${u.d(l)} &rarr; ${u.d(l + 1)}</span></div>
        <button class="buy" id="rcU_${u.k}"></button></div>`; }).join("");
    UP.forEach(u => $("rcU_" + u.k).onclick = () => {
      const c = cost(u, st.p[u.k]); if (st.cash < c || race) return;
      st.cash -= c; st.p[u.k]++; save(); P.buzz("0,14"); renderShop(); paint();
    });
  }
  function paint() {
    if (!el || !$("rcCash")) return;
    $("rcCash").textContent = "$" + fmt(st.cash);
    $("rcBadge").innerHTML = wattBadge(wb(), "speed");
    $("rcWins").textContent = `${st.wins[st.sel] || 0}/3`;
    $("rcTop").textContent = `TOP SPEED ${Math.round(myTop())} KM/H`;
    $("rcGo").disabled = !!race;
    $("rcGo").textContent = race ? "RACING..." : `RACE ${LEAGUES[st.sel].name} · ${LEAGUES[st.sel].len} M`;
    UP.forEach(u => { const b = $("rcU_" + u.k); if (b) { const c = cost(u, st.p[u.k]); b.textContent = "$" + fmt(c); b.disabled = st.cash < c || !!race; } });
  }
  function start() {
    const L = LEAGUES[st.sel];
    const cars = [{ name: "YOU", top: myTop(), acc: 0.35 * Math.pow(1.1, st.p.tire), me: true }].concat(rivalsFor(L, st.sel * 2));
    cars.forEach(c => { c.v = 0; c.x = 0; c.t = 0; c.done = false; });
    race = { L, cars, nitro: 0, boost: 0, go: false, order: [] };
    $("rcRes").classList.remove("show"); paint();
    let n = 3; const cd = $("rcCount"); cd.classList.add("show"); cd.textContent = n;
    const tick = () => { n--; if (n > 0) { cd.textContent = n; timers.push(setTimeout(tick, 700)); } else { cd.textContent = "GO"; timers.push(setTimeout(() => cd.classList.remove("show"), 500)); race.go = true; race.t0 = performance.now(); race.last = race.t0; loop(); } };
    timers.push(setTimeout(tick, 700));
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    const r = race; if (!r) return;
    const now = performance.now(), dt = Math.min(0.05, (now - r.last) / 1000); r.last = now;
    const me = r.cars[0];
    me.top = myTop();
    r.nitro += (6 + 2 * st.p.nitro) * dt * (1 + W / 40);
    if (r.nitro >= 100) { r.nitro = 0; r.boost = 2.5; P.buzz("0,30"); }
    if (r.boost > 0) r.boost -= dt;
    const tw = $("rcTrack").clientWidth - 76;
    r.cars.forEach((c, i) => {
      if (c.done) return;
      const top = (c.top * (c.me && r.boost > 0 ? 1.35 : 1)) / 3.6;   // m/s
      c.v += (top - c.v) * c.acc * dt * (c.me ? 1 : (0.95 + Math.random() * 0.1));
      c.x += c.v * dt; c.t += dt;
      if (c.x >= r.L.len) { c.x = r.L.len; c.done = true; r.order.push(i); }
      $("rcC" + i).style.transform = `translateX(${(c.x / r.L.len * tw).toFixed(1)}px)`;
    });
    const place = 1 + r.cars.filter((c, i) => i && (c.x > me.x || (c.done && r.order.indexOf(i) < r.order.indexOf(0)))).length;
    $("rcSpd").textContent = Math.round(me.v * 3.6);
    $("rcPos").textContent = "P" + (me.done ? r.order.indexOf(0) + 1 : place);
    const nb = $("rcNitro"); nb.classList.toggle("fire", r.boost > 0); nb.firstChild.style.width = (r.boost > 0 ? 100 : r.nitro) + "%";
    if (r.cars.every(c => c.done)) finish();
  }
  function finish() {
    cancelAnimationFrame(raf);
    const r = race, place = r.order.indexOf(0);
    const prize = PRIZE[place] * Math.pow(2.2, r.L === LEAGUES[st.sel] ? st.sel : 0);
    st.cash += prize; st.races++;
    let unlocked = "";
    if (place === 0) {
      st.wins[st.sel] = (st.wins[st.sel] || 0) + 1;
      if (st.wins[st.sel] >= 3 && st.league === st.sel && st.league < LEAGUES.length - 1) { st.league++; unlocked = LEAGUES[st.league].name; }
      P.buzz("0,40,60,80");
    }
    $("rcRes").innerHTML = r.order.map((i, k) => `<div class="${i === 0 ? "me" : ""}"><span>P${k + 1}  ${r.cars[i].name}</span><span>${r.cars[i].t.toFixed(2)} s</span></div>`).join("")
      + `<div class="me"><span>Prize</span><span>+$${fmt(prize)}</span></div>` + (unlocked ? `<div class="me"><span>NEW LEAGUE</span><span>${unlocked}</span></div>` : "");
    $("rcRes").classList.add("show");
    race = null; save(); renderLeagues(); paint();
  }

  GAMES.race = {
    name: "Volt Rush", sub: "Your watts = your car's top speed", c1: "#1f6f8b", c2: "#103745",
    icon: '<path d="M3 15c0-2 2-3 4-3l3-3h6l4 3c1.5.5 2 1.5 2 3v2H3z"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
    status: () => st ? `${LEAGUES[st.league].name} league · $${fmt(st.cash)}` : "",
    async open() { st = Object.assign(def(), await KV.get("race") || {}); st.p = Object.assign(def().p, st.p); el = $("g-race"); render(); },
    close() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; race = null; save(); },
  };
  setInterval(() => { if (curGame === "race" && !race) paint(); }, 1000);
  KV.get("race").then(s => { if (!st) st = Object.assign(def(), s || {}); });
})();
