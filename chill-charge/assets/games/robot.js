// ---------- WATTBOT ARENA: your real watts power a robot that auto-fights bosses ----------
(() => {
  const NAMES = ["VOLTAR", "GRIDLOCK", "OHMEGA", "CAPACITRON", "SURGE KING", "AMPERION", "STATIC REX", "BLACKOUT", "TESLAX", "KILOWRATH",
    "DYNAMOX", "FUSEBREAKER", "OVERLOAD", "SPARK TITAN", "MEGAOHM", "ARC LORD", "BROWNOUT", "THUNDRAX", "JOULE BEAST", "PLASMA QUEEN"];
  const atk = l => 10 * Math.pow(1.28, l), hp = l => 120 * Math.pow(1.25, l), red = l => 1 - 1 / (1 + 0.12 * l);
  const beamX = l => 6 + 2 * l, wpw = l => 0.25 + 0.05 * l;
  const UP = [
    { k: "atk", name: "Plasma Fists", base: 20, d: l => `Hit ${fmt(atk(l))}` },
    { k: "core", name: "Reactor Core", base: 20, d: l => `HP ${fmt(hp(l))}` },
    { k: "arm", name: "Armor Plates", base: 30, d: l => `Blocks ${Math.round(red(l) * 100)}%` },
    { k: "spec", name: "Mega Beam", base: 50, d: l => `Beam does x${beamX(l)}` },
    { k: "volt", name: "Watt Coils", base: 80, d: l => `Each real watt +${Math.round(wpw(l) * 100)}% power` },
  ];
  const cost = (u, l) => u.base * Math.pow(1.55, l);
  const boss = n => {
    const mega = n % 5 === 0;
    return { n, mega, hp: 200 * Math.pow(1.32, n - 1) * (mega ? 2.5 : 1), atk: 8 * Math.pow(1.22, n - 1) * (mega ? 1.4 : 1),
      name: NAMES[(n - 1) % NAMES.length] + (n > NAMES.length ? " MK " + (Math.floor((n - 1) / NAMES.length) + 1) : ""),
      hue: (n * 67) % 360, sides: 3 + (n % 6), spikes: n >= 8, eyes: 1 + (n % 3) };
  };
  const reward = n => 25 * Math.pow(1.3, n - 1) * (n % 5 === 0 ? 3 : 1);
  let st = null, el = null, fight = null, timers = [];
  const def = () => ({ lvl: 1, best: 1, scrap: 0, wins: 0, up: { atk: 0, core: 0, arm: 0, spec: 0, volt: 0 }, auto: false });
  const save = () => st && KV.set("robot", st);
  const wm = () => 1 + W * wpw(st.up.volt);

  function robotSvg() {
    const u = st.up, plates = u.arm >= 3, big = Math.min(1, u.atk / 15);
    return `<svg width="104" height="132" viewBox="0 0 100 128">
      <rect x="30" y="92" width="14" height="32" rx="4" fill="#3a3478"/><rect x="56" y="92" width="14" height="32" rx="4" fill="#3a3478"/>
      <rect x="22" y="44" width="56" height="52" rx="12" fill="#5b52b8"/>
      ${plates ? '<path d="M16 44h16v20H12zM68 44h16l4 20H68z" fill="#8ef0d8" opacity=".8"/>' : ""}
      <circle cx="50" cy="68" r="${7 + u.spec * 0.8}" fill="#c5b3ff"><animate attributeName="opacity" values="1;.5;1" dur="1.6s" repeatCount="indefinite"/></circle>
      <rect x="32" y="14" width="36" height="30" rx="10" fill="#6d63d0"/><rect x="38" y="24" width="24" height="8" rx="4" fill="#8ef0d8"/>
      <rect x="78" y="${52 - big * 4}" width="${20 + big * 8}" height="${12 + big * 8}" rx="5" fill="#8ef0d8"/>
      <rect x="4" y="54" width="18" height="12" rx="5" fill="#5b52b8"/></svg>`;
  }
  function bossSvg(b) {
    const R = b.mega ? 52 : 44, cx = 60, cy = 64, pts = [];
    const n = b.spikes ? b.sides * 2 : b.sides;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = b.spikes && i % 2 ? R * 0.68 : R;
      pts.push((cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1));
    }
    const eyes = Array.from({ length: b.eyes }, (_, i) => `<circle cx="${cx + (i - (b.eyes - 1) / 2) * 16}" cy="${cy - 6}" r="6" fill="#fff"/>
      <circle cx="${cx + (i - (b.eyes - 1) / 2) * 16 - 2}" cy="${cy - 5}" r="3" fill="#0a0918"/>`).join("");
    return `<svg width="${b.mega ? 150 : 128}" height="${b.mega ? 150 : 128}" viewBox="0 0 120 128">
      <polygon points="${pts.join(" ")}" fill="hsl(${b.hue},62%,48%)" stroke="hsl(${b.hue},70%,70%)" stroke-width="3"/>
      ${eyes}<rect x="${cx - 14}" y="${cy + 12}" width="28" height="6" rx="3" fill="#0a0918"/>
      ${b.mega ? `<path d="M36 18l8 12 8-14 8 14 8-14 8 12" fill="none" stroke="#ffd27a" stroke-width="4" stroke-linejoin="round"/>` : ""}</svg>`;
  }

  function render() {
    el.innerHTML = `<div class="gtitle"><h2>WATTBOT ARENA</h2><span class="money" id="rbScrap"></span></div>
      <div class="arena" id="rbArena">
        <div class="hpbars"><div class="hpb" id="hpMe"><span><b>WATTBOT</b><em id="rbHpMe"></em></span><div class="bar"><i></i></div></div>
          <div class="hpb" id="hpBoss"><span><b id="rbBossLvl"></b><em id="rbHpBoss"></em></span><div class="bar"><i></i></div></div></div>
        <div class="fighter" id="rbMe">${robotSvg()}</div><div class="fighter" id="rbBoss"></div>
        <div class="meter"><i id="rbMeter"></i></div><div class="bossname" id="rbBossName"></div>
        <div class="banner" id="rbBanner"><div><b id="rbBanT"></b><span id="rbBanS"></span></div></div>
      </div>
      <div class="badge" id="rbBadge"></div>
      <button class="bigbtn" id="rbGo">FIGHT</button>
      <div class="toggle"><span>Auto: keep fighting the next boss</span><div class="sw" id="rbAuto"></div></div>
      <div class="ebar"><div class="head2">UPGRADE YOUR BOT</div><div class="head2" id="rbBest"></div></div>
      <div class="shop" id="rbShop"></div>`;
    $("rbGo").onclick = () => fight ? null : start();
    $("rbAuto").parentElement.onclick = () => { st.auto = !st.auto; save(); paint(); };
    showBoss(); renderShop(); paint();
  }
  function showBoss() {
    const b = boss(st.lvl);
    $("rbBoss").innerHTML = bossSvg(b); $("rbBoss").className = "fighter";
    $("rbBossName").textContent = (b.mega ? "MEGA BOSS · " : "") + b.name;
    $("rbBossLvl").textContent = "BOSS " + st.lvl;
    setHp(1, 1, hp(st.up.core), b.hp);
  }
  function setHp(fm, fb, mh, bh) {
    document.querySelector("#hpMe i").style.width = Math.max(0, fm * 100) + "%";
    document.querySelector("#hpBoss i").style.width = Math.max(0, fb * 100) + "%";
    $("rbHpMe").textContent = fmt(Math.max(0, fm * mh)); $("rbHpBoss").textContent = fmt(Math.max(0, fb * bh));
  }
  function renderShop() {
    $("rbShop").innerHTML = UP.map(u => { const l = st.up[u.k];
      return `<div class="bld"><div class="ico"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-13h-7z"/></svg></div>
        <div class="t"><b>${u.name} <small style="color:var(--dim)">LV ${l}</small></b><span>${u.d(l)} &rarr; ${u.d(l + 1)}</span></div>
        <button class="buy" id="rbU_${u.k}"></button></div>`; }).join("");
    UP.forEach(u => $("rbU_" + u.k).onclick = () => {
      const c = cost(u, st.up[u.k]); if (st.scrap < c || fight) return;
      st.scrap -= c; st.up[u.k]++; save(); P.buzz("0,14"); $("rbMe").innerHTML = robotSvg(); renderShop(); paint();
      if (!fight) showBoss();
    });
  }
  function paint() {
    if (!el || !$("rbScrap")) return;
    $("rbScrap").textContent = fmt(st.scrap) + " SCRAP";
    $("rbBadge").innerHTML = wattBadge(wm(), "robot power");
    $("rbAuto").classList.toggle("on", st.auto);
    $("rbBest").textContent = "BEST: BOSS " + st.best;
    $("rbGo").disabled = !!fight;
    $("rbGo").textContent = fight ? "FIGHTING..." : "FIGHT BOSS " + st.lvl;
    UP.forEach(u => { const b = $("rbU_" + u.k); if (b) { const c = cost(u, st.up[u.k]); b.textContent = fmt(c); b.disabled = st.scrap < c || !!fight; } });
  }
  function pop(txt, cls, x) {
    const a = $("rbArena"); if (!a) return;
    const d = document.createElement("div"); d.className = "dmg " + cls; d.textContent = txt;
    d.style.left = x + "%"; d.style.top = (70 + Math.random() * 50) + "px"; a.appendChild(d); setTimeout(() => d.remove(), 900);
  }
  const later = (f, ms) => timers.push(setTimeout(f, ms));
  function start() {
    const b = boss(st.lvl), mh = hp(st.up.core);
    fight = { b, me: mh, mh, bh: b.hp, meter: 0 };
    $("rbBanner").classList.remove("show"); showBoss(); paint();
    const meTurn = () => {
      if (!fight) return;
      const f = fight, crit = Math.random() < 0.1;
      let d = atk(st.up.atk) * wm() * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1);
      $("rbMe").classList.add("lunge-r"); later(() => $("rbMe") && $("rbMe").classList.remove("lunge-r"), 140);
      f.meter += 18 * (1 + 0.15 * st.up.spec);
      if (f.meter >= 100) {
        f.meter = 0; d = atk(st.up.atk) * wm() * beamX(st.up.spec);
        const bm = document.createElement("div"); bm.className = "beam"; $("rbArena").appendChild(bm); later(() => bm.remove(), 750);
        P.buzz("0,60"); pop("BEAM " + fmt(d), "crit", 55);
      } else pop(fmt(d), crit ? "crit" : "", 62);
      f.bh -= d; $("rbBoss").classList.remove("hit"); void $("rbBoss").offsetWidth; $("rbBoss").classList.add("hit");
      $("rbMeter").style.width = f.meter + "%";
      setHp(f.me / f.mh, f.bh / f.b.hp, f.mh, f.b.hp);
      if (f.bh <= 0) return end(true);
      later(meTurn, 650);
    };
    const bossTurn = () => {
      if (!fight) return;
      const f = fight, d = f.b.atk * (1 - red(st.up.arm)) * (0.85 + Math.random() * 0.3);
      $("rbBoss").classList.add("lunge-l"); later(() => $("rbBoss") && $("rbBoss").classList.remove("lunge-l"), 140);
      f.me -= d; pop("-" + fmt(d), "me", 14);
      $("rbMe").classList.remove("hit"); void $("rbMe").offsetWidth; $("rbMe").classList.add("hit");
      setHp(f.me / f.mh, f.bh / f.b.hp, f.mh, f.b.hp);
      if (f.me <= 0) return end(false);
      later(bossTurn, 900);
    };
    later(meTurn, 400); later(bossTurn, 900);
  }
  function end(win) {
    const n = st.lvl, r = reward(n) * (win ? 1 : 0.3);
    timers.forEach(clearTimeout); timers = [];
    fight = null; st.scrap += r;
    (win ? $("rbBoss") : $("rbMe")).classList.add("dead");
    $("rbBanT").textContent = win ? (n % 5 === 0 ? "MEGA BOSS DOWN" : "VICTORY") : "DEFEATED";
    $("rbBanS").textContent = `+${fmt(r)} scrap` + (win ? "" : " · upgrade and try again");
    $("rbBanner").classList.add("show");
    if (win) { st.lvl++; st.wins++; st.best = Math.max(st.best, st.lvl); P.buzz("0,40,60,80"); }
    save(); renderShop(); paint();
    later(() => { if (!$("rbArena")) return; $("rbMe").className = "fighter"; $("rbBanner").classList.remove("show"); showBoss();
      if (win && st.auto && curGame === "robot") start(); }, 1800);
  }

  GAMES.robot = {
    name: "Wattbot Arena", sub: "Your watts power a robot that fights bosses", c1: "#5b52b8", c2: "#241f52",
    icon: '<rect x="6" y="8" width="12" height="11" rx="3"/><rect x="8" y="3" width="8" height="5" rx="2"/><path d="M18 12h4M2 12h4M9 19v3M15 19v3"/>',
    status: () => st ? `Boss ${st.lvl} · ${fmt(st.scrap)} scrap` : "",
    async open() { st = Object.assign(def(), await KV.get("robot") || {}); st.up = Object.assign(def().up, st.up); el = $("g-robot"); render(); },
    close() { timers.forEach(clearTimeout); timers = []; fight = null; save(); },
  };
  setInterval(() => { if (curGame === "robot") paint(); }, 1000);
  KV.get("robot").then(s => { if (!st) st = Object.assign(def(), s || {}); });
})();
