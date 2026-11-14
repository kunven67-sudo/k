// ---------- TERRA: your real watts terraform a planet you can watch change ----------
(() => {
  const TW = 512, TH = 256, CW = 320, CH = 236, R = 80, CX = CW / 2, CY = CH / 2;
  const POP = ["0", "1 million", "40 million", "500 million", "2 billion", "8 billion", "20 billion"];
  const PL = [
    { k: "water", name: "Comet Water", max: 5, base: 30, g: 4, add: 1, d: l => `Oceans cover ${[0, 20, 35, 50, 62, 72][l]}%` },
    { k: "air", name: "Air Factories", max: 5, base: 60, g: 4, add: 1, d: l => l ? `Atmosphere level ${l}` : "No air yet" },
    { k: "cloud", name: "Cloud Seeding", max: 4, base: 600, g: 5, add: 2, req: s => s.water >= 2 && s.air >= 2, rq: "Needs Comet Water 2 + Air 2", d: l => `${l * 15}% clouds` },
    { k: "ice", name: "Polar Ice", max: 3, base: 900, g: 5, add: 2, req: s => s.water >= 2, rq: "Needs Comet Water 2", d: l => `Ice caps level ${l}` },
    { k: "plant", name: "Seed Life", max: 5, base: 3000, g: 5, add: 4, req: s => s.water >= 3 && s.air >= 2, rq: "Needs Comet Water 3 + Air 2", d: l => `Grass + plants level ${l}` },
    { k: "forest", name: "Forests", max: 5, base: 3e4, g: 5, add: 8, req: s => s.plant >= 2, rq: "Needs Seed Life 2", d: l => `Forests level ${l}` },
    { k: "city", name: "Cities", max: 6, base: 3e5, g: 6, add: 20, req: s => s.forest >= 1, rq: "Needs Forests 1", d: l => `Population ${POP[l]}` },
    { k: "moon", name: "Moon", max: 2, base: 8e6, g: 25, add: 50, req: s => s.city >= 2, rq: "Needs Cities 2", d: l => ["No moon", "A moon", "Moon base"][l] },
    { k: "station", name: "Space Stations", max: 5, base: 4e7, g: 6, add: 100, req: s => s.moon >= 1, rq: "Needs a Moon", d: l => `${l} stations in orbit` },
    { k: "ring", name: "Planet Ring", max: 1, base: 2e9, g: 1, add: 500, req: s => s.station >= 3, rq: "Needs 3 Space Stations", d: l => l ? "Ring built" : "No ring" },
  ];
  const cost = (p, l) => p.base * Math.pow(p.g, l);
  let st = null, el = null, raf = 0, ctx = null, maps = null, tex = null, pix = null, last = 0, rot = 0, stars = null;
  const def = () => ({ tp: 0, total: 0, t: Date.now(), seed: 1 + Math.floor(Math.random() * 1e6), p: Object.fromEntries(PL.map(p => [p.k, 0])) });
  const save = () => { if (st) { st.t = Date.now(); KV.set("planet", st); } };
  const life = () => 1 + PL.reduce((s, p) => s + st.p[p.k] * p.add, 0);
  const rate = () => (W > 0 ? W : 0.25) * life();

  // ---- seeded 3D value noise (sampled on the sphere, so the map wraps with no seam)
  function makeNoise(seed) {
    const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 2654435761) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const sm = t => t * t * (3 - 2 * t);
    const vn = (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
      const l = (a, b, t) => a + (b - a) * t;
      return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
        l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf), zf);
    };
    return (x, y, z, oct, f) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { s += vn(x * f, y * f, z * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; };
  }
  function buildMaps() {
    const nH = makeNoise(st.seed), nM = makeNoise(st.seed + 7), nC = makeNoise(st.seed + 13), nK = makeNoise(st.seed + 29);
    const H = new Float32Array(TW * TH), M = new Float32Array(TW * TH), C = new Float32Array(TW * TH), K = new Float32Array(TW * TH);
    let lo = 1, hi = 0;
    for (let v = 0; v < TH; v++) {
      const lat = (0.5 - (v + 0.5) / TH) * Math.PI;
      for (let u = 0; u < TW; u++) {
        const lon = (u / TW) * 2 * Math.PI, x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon), i = v * TW + u;
        H[i] = nH(x + 5, y + 5, z + 5, 5, 1.6); M[i] = nM(x + 9, y + 9, z + 9, 4, 1.8);
        C[i] = nC(x * 1.3 + 3, y * 2.2 + 3, z * 1.3 + 3, 5, 2.2); K[i] = nK(x + 1, y + 1, z + 1, 4, 9);
        if (H[i] < lo) lo = H[i]; if (H[i] > hi) hi = H[i];
      }
    }
    for (let i = 0; i < H.length; i++) H[i] = (H[i] - lo) / (hi - lo);
    const norm = a => { let l = 1, h = 0; a.forEach(x => { if (x < l) l = x; if (x > h) h = x; }); for (let i = 0; i < a.length; i++) a[i] = (a[i] - l) / (h - l); };
    norm(M); norm(C); norm(K);
    maps = { H, M, C, K };
  }
  // ---- the planet's surface colors for the current terraforming
  function buildTex() {
    const p = st.p, { H, M, K } = maps;
    const col = new Uint8ClampedArray(TW * TH * 3), ocean = new Uint8Array(TW * TH), lights = new Float32Array(TW * TH);
    const sea = p.water ? 0.32 + 0.065 * p.water : -1, iceLat = p.ice ? 90 - 13 * p.ice : 999;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let v = 0; v < TH; v++) {
      const latD = Math.abs((0.5 - (v + 0.5) / TH) * 180);
      for (let u = 0; u < TW; u++) {
        const i = v * TW + u, h = H[i], m = M[i];
        let c;
        if (latD > iceLat - h * 10) c = [232, 240, 246];
        else if (h < sea) {
          const d = Math.min(1, (sea - h) / Math.max(0.1, sea));
          c = mix([46, 132, 186], [10, 34, 82], Math.pow(d, 0.7));
          if (!p.air) c = mix(c, [70, 80, 96], 0.35);
          ocean[i] = 1;
        } else {
          const hh = sea > 0 ? (h - sea) / (1 - sea) : h;
          c = hh < 0.5 ? mix([88, 72, 60], [138, 120, 100], hh * 2) : mix([138, 120, 100], [196, 186, 172], (hh - 0.5) * 2);
          if (p.air >= 2) c = mix(c, [150, 110, 80], 0.12);
          if (p.plant && m > 1 - 0.14 * p.plant && hh < 0.7) c = mix(c, [108, 154, 70], Math.min(1, (m - (1 - 0.14 * p.plant)) * 6));
          else if (p.plant >= 2 && m < 0.25 && hh < 0.5) c = mix(c, [200, 176, 122], 0.5);
          if (p.forest && m > 1 - 0.11 * p.forest && hh < 0.6) c = mix(c, [44, 92, 44], Math.min(1, (m - (1 - 0.11 * p.forest)) * 7));
          if (p.city && K[i] > 1 - 0.065 * p.city && hh < 0.65) { c = mix(c, [150, 148, 142], 0.35); lights[i] = Math.min(1, (K[i] - (1 - 0.065 * p.city)) * 9); }
        }
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
    }
    tex = { col, ocean, lights };
  }
  // ---- per screen pixel: where it lands on the map, how lit it is (fixed, because only the planet spins)
  function buildPix() {
    const S = 2 * R + 2, n = S * S, u0 = new Float32Array(n), vv = new Uint16Array(n), dif = new Float32Array(n), spec = new Float32Array(n), inside = new Uint8Array(n), edge = new Float32Array(n);
    const L = [-0.62, -0.38, 0.69], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
    const Hh = [L[0], L[1], L[2] + 1], hn = Math.hypot(...Hh);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x - R - 0.5) / R, ny = (y - R - 0.5) / R, d2 = nx * nx + ny * ny, i = y * S + x;
      if (d2 >= 1) continue;
      const nz = Math.sqrt(1 - d2);
      inside[i] = 1; edge[i] = Math.min(1, (1 - Math.sqrt(d2)) * R / 1.5);
      u0[i] = Math.atan2(nx, nz) / (2 * Math.PI);
      vv[i] = Math.min(TH - 1, Math.max(0, Math.floor((0.5 - Math.asin(-ny) / Math.PI) * TH)));
      dif[i] = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      spec[i] = Math.pow(Math.max(0, (nx * Hh[0] + ny * Hh[1] + nz * Hh[2]) / hn), 60);
    }
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    pix = { S, u0, vv, dif, spec, inside, edge, cv, cx: cv.getContext("2d") };
    pix.img = pix.cx.createImageData(S, S);
    stars = Array.from({ length: 70 }, () => [Math.random() * CW, Math.random() * CH, Math.random() * 1.2 + 0.2, Math.random()]);
  }
  function drawPlanet() {
    const { S, u0, vv, dif, spec, inside, edge, img } = pix, d = img.data, { col, ocean, lights } = tex, C = maps.C;
    const cl = st.p.cloud, thr = 1 - 0.13 * cl, air = st.p.air;
    for (let i = 0; i < S * S; i++) {
      const o = i * 4;
      if (!inside[i]) { d[o + 3] = 0; continue; }
      let u = u0[i] + rot; u -= Math.floor(u);
      const t = vv[i] * TW + ((u * TW) | 0), di = dif[i], lit = 0.06 + 0.94 * di;
      let r = col[t * 3] * lit, g = col[t * 3 + 1] * lit, b = col[t * 3 + 2] * lit;
      if (ocean[t]) { const s = spec[i] * 110 * (air ? 1 : 0.5); r += s; g += s; b += s; }
      if (lights[t] && di < 0.22) { const k = lights[t] * (1 - di / 0.22); r += 255 * k; g += 196 * k; b += 110 * k; }
      if (cl) {
        let uc = u0[i] + rot * 1.25; uc -= Math.floor(uc);
        const cv = C[vv[i] * TW + ((uc * TW) | 0)], a = Math.min(0.85, Math.max(0, (cv - thr) * 4));
        if (a > 0) { const w = 255 * (0.12 + 0.88 * di); r += (w - r) * a; g += (w - g) * a; b += (w - b) * a; }
      }
      if (air) { const lim = Math.pow(1 - Math.min(1, edge[i] * 0.06), 3) * 0.12 * air * (0.3 + di); r += 90 * lim; g += 160 * lim; b += 255 * lim; }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255 * Math.min(1, edge[i]);
    }
    pix.cx.putImageData(img, 0, 0);
  }
  // orbiting stuff: draw the half behind the planet first, then the planet, then the half in front
  function orbiters(t, front) {
    const p = st.p;
    if (p.ring) {
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(-0.28); ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.8, R * 0.36, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
      ctx.strokeStyle = "rgba(214,196,160,.55)"; ctx.lineWidth = 11; ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,210,.35)"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    }
    for (let k = 0; k < p.station; k++) {
      const a = t * 0.0005 + k * 2 * Math.PI / p.station, s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const x = CX + Math.cos(a) * R * 1.38, y = CY + s * R * 0.42 - Math.cos(a) * 18;
      ctx.fillStyle = "rgba(142,240,216,.25)"; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      ctx.fillStyle = "#dffcf4"; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
    }
    if (p.moon) {
      const a = t * 0.00018, s = Math.sin(a);
      if ((s > 0) === front) {
        const x = CX + Math.cos(a) * R * 1.75, y = CY + s * R * 0.3 - 16, mr = R * 0.17;
        const g = ctx.createRadialGradient(x - mr * 0.4, y - mr * 0.4, mr * 0.1, x, y, mr);
        g.addColorStop(0, "#d8d6d0"); g.addColorStop(1, "#5c5a58");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, mr, 0, 7); ctx.fill();
        if (p.moon >= 2) { ctx.fillStyle = "#ffd98a"; [[-3, 2], [2, -1], [4, 4]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 1.6, 1.6)); }
      }
    }
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || t - last < 50) return;
    const dt = last ? (t - last) / 1000 : 0; last = t;
    rot += dt * 0.022;
    ctx.clearRect(0, 0, CW, CH);
    for (const s of stars) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t / 2000 + s[3] * 9)); ctx.fillStyle = "#fff"; ctx.fillRect(s[0], s[1], s[2], s[2]); }
    ctx.globalAlpha = 1;
    orbiters(t, false);
    if (st.p.air) { const g = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, R * 1.22); g.addColorStop(0, `rgba(110,180,255,${0.1 * st.p.air})`); g.addColorStop(1, "rgba(110,180,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, R * 1.22, 0, 7); ctx.fill(); }
    drawPlanet(); ctx.drawImage(pix.cv, CX - R - 1, CY - R - 1);
    orbiters(t, true);
  }

  function render() {
    el.innerHTML = `<div class="gtitle"><h2>TERRA</h2><span class="money" id="plTp"></span></div>
      <div class="space"><canvas id="plCanvas" width="${CW}" height="${CH}"></canvas></div>
      <div class="plstats"><div class="stat"><i>LIFE</i><b id="plLife"></b></div><div class="stat"><i>PEOPLE</i><b id="plPop"></b></div>
        <div class="stat"><i>MAKING</i><b id="plRate"></b></div></div>
      <div class="badge" id="plBadge"></div>
      <div class="ebar"><div class="head2">TERRAFORM</div><div class="head2">EVERY BUY CHANGES THE PLANET</div></div>
      <div class="shop" id="plShop"></div>`;
    ctx = $("plCanvas").getContext("2d");
    renderShop(); paint();
  }
  function renderShop() {
    $("plShop").innerHTML = PL.map(p => { const l = st.p[p.k], open = !p.req || p.req(st.p), maxed = l >= p.max;
      return `<div class="bld${open ? "" : " locked"}"><div class="ico" style="--c1:#24806b;--c2:#103d33"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18"/></svg></div>
        <div class="t"><b>${p.name}</b><span class="${open ? "" : "req"}">${open ? (maxed ? p.d(l) + " · MAX" : p.d(l) + " &rarr; " + p.d(l + 1)) : p.rq}</span>
        <div class="pips">${Array.from({ length: p.max }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div></div>
        ${open && !maxed ? `<button class="buy" id="plU_${p.k}"></button>` : ""}</div>`; }).join("");
    PL.forEach(p => { const b = $("plU_" + p.k); if (b) b.onclick = () => buy(p); });
  }
  function buy(p) {
    const l = st.p[p.k], c = cost(p, l);
    if (st.tp < c || l >= p.max) return;
    st.tp -= c; st.p[p.k]++; save(); buildTex(); renderShop(); paint(); P.buzz("0,20,40,20");
    toast(`${p.name}: ${p.d(st.p[p.k])}`);
  }
  function paint() {
    if (!el || !$("plTp")) return;
    $("plTp").textContent = fmt(st.tp) + " TP";
    $("plLife").textContent = "x" + fmt(life());
    $("plPop").textContent = POP[st.p.city].replace(" million", "M").replace(" billion", "B");
    $("plRate").textContent = fmt(rate()) + "/s";
    $("plBadge").innerHTML = W > 0 ? `<b>${W.toFixed(1)} W</b> real charging x <b>${fmt(life())}</b> life = ${fmt(rate())} terraform points a second`
      : `<b>Not charging:</b> only sunlight (0.25 W). Plug in to terraform way faster`;
    PL.forEach(p => { const b = $("plU_" + p.k); if (b) { const c = cost(p, st.p[p.k]); b.textContent = fmt(c) + " TP"; b.disabled = st.tp < c; } });
  }
  let lastT = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = Math.min(2, (now - lastT) / 1000); lastT = now;
    if (st && curGame === "planet") { const g = rate() * dt; st.tp += g; st.total += g; paint(); }
  }, 250);
  setInterval(() => { if (curGame === "planet") save(); }, 10000);

  GAMES.planet = {
    name: "Terra", sub: "Your watts terraform a planet you can watch change", c1: "#24806b", c2: "#103d33",
    icon: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="11" ry="3.5" transform="rotate(-20 12 12)"/>',
    status: () => st ? `Life x${fmt(life())} · ${fmt(st.tp)} TP` : "",
    async open() {
      const s = await KV.get("planet");
      st = Object.assign(def(), s || {}); st.p = Object.assign(def().p, st.p);
      // sunlight kept going while you were away (max 8 h)
      const away = Math.min(8 * 3600, Math.max(0, (Date.now() - (st.t || Date.now())) / 1000));
      if (s && away > 60) { const g = 0.25 * life() * away; st.tp += g; st.total += g; toast(`While you were away, sunlight made ${fmt(g)} TP`); }
      el = $("g-planet"); if (!maps || maps.seed !== st.seed) { buildMaps(); maps.seed = st.seed; } buildTex(); if (!pix) buildPix();
      render(); last = 0; lastT = Date.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); save();
    },
    close() { cancelAnimationFrame(raf); save(); },
  };
  KV.get("planet").then(s => { if (!st && s) { st = Object.assign(def(), s); st.p = Object.assign(def().p, st.p); } });
})();
