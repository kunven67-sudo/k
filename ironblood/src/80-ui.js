
// ---------- HUD + menus ----------
const $ = (id) => document.getElementById(id);
const ui = (() => {
  let msgT = 0, subT = 0;
  // body diagram: one shape per hit zone, colored by that part's health
  const SHAPES = {
    head: '<circle cx="30" cy="11" r="8"/>', neck: '<rect x="27" y="19" width="6" height="5"/>',
    chest: '<rect x="19" y="24" width="22" height="18" rx="3"/>', belly: '<rect x="20" y="42" width="20" height="16" rx="3"/>',
    ruarm: '<rect x="11" y="25" width="7" height="17" rx="3"/>', rfarm: '<rect x="9" y="43" width="7" height="17" rx="3"/>',
    luarm: '<rect x="42" y="25" width="7" height="17" rx="3"/>', lfarm: '<rect x="44" y="43" width="7" height="17" rx="3"/>',
    rthigh: '<rect x="20" y="59" width="9" height="25" rx="3"/>', rshin: '<rect x="20" y="85" width="8" height="28" rx="3"/>',
    lthigh: '<rect x="31" y="59" width="9" height="25" rx="3"/>', lshin: '<rect x="32" y="85" width="8" height="28" rx="3"/>',
  };
  function buildBody(svg) {
    svg.innerHTML = Object.entries(SHAPES).map(([k, s]) => s.replace('/>', ` data-k="${k}" stroke="rgba(0,0,0,.6)" stroke-width="1"/>`)).join('');
    return [...svg.children];
  }
  const selfParts = buildBody($('selfBody')), lockParts = buildBody($('lockBody'));
  function colorBody(els, f) {
    for (const el of els) {
      const p = f.parts[el.dataset.k];
      if (p.gone) { el.setAttribute('fill', '#120202'); el.setAttribute('stroke', '#c21'); el.setAttribute('stroke-dasharray', '2 2'); continue; }
      const r = Math.max(0, p.hp / p.max);
      const c = r > 0.6 ? `rgb(${Math.round(90 + (1 - r) * 300)},190,90)` : r > 0.3 ? `rgb(230,${Math.round(120 + r * 120)},60)` : `rgb(220,${Math.round(40 + r * 100)},40)`;
      el.setAttribute('fill', c); el.setAttribute('stroke', 'rgba(0,0,0,.6)'); el.removeAttribute('stroke-dasharray');
    }
  }
  // drips under the logo
  const drips = $('drips');
  for (let i = 0; i < 14; i++) { const d = document.createElement('i'); d.style.left = (20 + Math.random() * 480) + 'px'; d.style.animationDelay = (Math.random() * 3.5) + 's'; d.style.width = (3 + Math.random() * 5) + 'px'; drips.appendChild(d); }
  // swing direction arrow in the middle of the screen
  const dirSvg = $('dir');
  function drawDir(d) {
    const rot = { R: 180, L: 0, U: 90, D: -90, S: null }[d];
    dirSvg.innerHTML = rot === null || rot === undefined ? '<circle r="5" fill="none" stroke="#fff" stroke-width="2"/>'
      : `<g transform="rotate(${rot})"><path d="M-14 0 L10 0 M4 -7 L12 0 L4 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  const dmgEls = [];
  const _p = new THREE.Vector3();
  function toScreen(v) {
    _p.copy(v).project(camera);
    return { x: (_p.x * 0.5 + 0.5) * innerWidth, y: (-_p.y * 0.5 + 0.5) * innerHeight, vis: _p.z < 1 && _p.z > -1 };
  }
  function bar(id, v, max) { const el = $(id); el.querySelector('i').style.width = Math.max(0, v / max * 100) + '%'; el.querySelector('b').textContent = Math.max(0, Math.ceil(v)) + ' / ' + max; }
  function weaponCard() {
    const w = player.sword;
    $('wName').textContent = w.name; $('wSub').textContent = w.sub;
    const rows = [['Weight', w.weight / 3.2, w.weight.toFixed(1) + ' kg'], ['Damage', w.dmg / 74, w.dmg], ['Speed', w.speed / 1.3, Math.round(w.speed * 100) + '%'], ['Reach', w.reach / 1.42, w.reach.toFixed(2) + ' m'], ['Vs armor', w.pierce / 0.62, Math.round(w.pierce * 100) + '%']];
    $('wStats').innerHTML = rows.map(([n, f, t]) => `<div class="stat"><span>${n}</span><div class="track"><i style="width:${Math.round(Math.min(1, f) * 100)}%"></i></div><em>${t}</em></div>`).join('')
      + `<div class="stat" style="margin-top:6px"><span>Swords</span><em style="grid-column:span 2;text-align:left">${unlockedSwords().length} / ${SWORDS.length} (X to switch)</em></div>`;
  }
  function update(dt) {
    const f = player;
    bar('hpBar', f.hp, f.maxHp); bar('arBar', f.armorHp, 100); bar('stBar', f.stamina, 100);
    const st = [];
    if (f.bleed > 0.05) st.push(`<span class="bleed">BLEEDING</span>`);
    if (f.legMult < 0.8) st.push('LIMPING');
    if (f.spdMult < 0.8) st.push('SWORD ARM HURT');
    if (bandaging > 0) st.push(`BANDAGING ${Math.round((1 - bandaging / 2.5) * 100)}%`);
    st.push(`<span style="opacity:.7">BANDAGES ${bandages}</span>`);
    $('status').innerHTML = st.join(' &nbsp; ');
    colorBody(selfParts, f);
    $('kills').textContent = stats.kills + (stats.kills === 1 ? ' KILL' : ' KILLS');
    const combo = $('combo');
    combo.style.opacity = f.heat >= 1 ? 1 : 0;
    combo.textContent = 'COMBO x' + Math.floor(f.heat) + '  (+' + Math.round(f.heat * 5) + '% dmg)';
    $('levels').innerHTML = `STRENGTH ${stats.str} &nbsp; SWORD SPEED ${stats.spd}`;
    // where the next swing will come from
    if (f.attack) drawDir(f.attack.dir); else if (mouse.hist.length) {
      const t = performance.now(); let dx = 0, dy = 0;
      for (const h of mouse.hist) if (t - h.t < 160) { dx += h.dx; dy += h.dy; }
      drawDir(Math.hypot(dx, dy) < 12 ? (lastAuto === 'R' ? 'L' : 'R') : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy < 0 ? 'U' : 'D'));
    }
    dirSvg.style.display = lockTarget ? 'none' : 'block';
    // lock-on panel + reticle
    const lk = $('lock'), ret = $('reticle');
    if (lockTarget) {
      lk.style.display = 'block';
      $('lockName').textContent = lockTarget.name;
      $('lockHp').textContent = Math.max(0, Math.ceil(lockTarget.hp)) + ' / ' + lockTarget.maxHp + (lockTarget.bleed > 0.05 ? '  bleeding' : '') + (lockTarget.stagger > 0 ? '  staggered' : '');
      colorBody(lockParts, lockTarget);
      const s = toScreen(lockTarget.b.Spine2.getWorldPosition(_p.clone()));
      ret.style.display = s.vis ? 'block' : 'none'; ret.style.left = s.x + 'px'; ret.style.top = s.y + 'px';
    } else { lk.style.display = 'none'; ret.style.display = 'none'; }
    // health over heads
    const tags = $('tags');
    for (const o of fighters) {
      if (o.isPlayer) continue;
      const show = o.alive && (o.ai && (o.ai.alert || o.hp < o.maxHp)) && o.pos.distanceTo(f.pos) < 24;
      if (!show) { if (o.tag) o.tag.style.display = 'none'; continue; }
      if (!o.tag) { o.tag = document.createElement('div'); o.tag.className = 'tag'; o.tag.innerHTML = '<div class="tn"></div><div class="tv"></div><div class="tb"><i></i></div>'; tags.appendChild(o.tag); }
      const head = o.b.HeadTop_End.getWorldPosition(new THREE.Vector3()); head.y += 0.25;
      const s = toScreen(head);
      if (!s.vis) { o.tag.style.display = 'none'; continue; }
      o.tag.style.display = 'block'; o.tag.style.left = s.x + 'px'; o.tag.style.top = s.y + 'px';
      o.tag.children[0].textContent = o.name;
      o.tag.children[1].textContent = Math.max(0, Math.ceil(o.hp)) + ' / ' + o.maxHp;
      o.tag.querySelector('i').style.width = Math.max(0, o.hp / o.maxHp * 100) + '%';
    }
    // damage numbers float up and fade
    for (let i = dmgEls.length - 1; i >= 0; i--) {
      const d = dmgEls[i]; d.t += dt; d.p.y += dt * 0.6;
      const s = toScreen(d.p);
      d.el.style.left = s.x + 'px'; d.el.style.top = s.y + 'px'; d.el.style.opacity = Math.max(0, 1 - d.t / 1.1);
      d.el.style.display = s.vis ? 'block' : 'none';
      if (d.t > 1.1) { d.el.remove(); dmgEls.splice(i, 1); }
    }
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
    if (subT > 0) { subT -= dt; if (subT <= 0) $('sub').style.opacity = 0; }
    // red edges when hurt
    const hurt = 1 - f.hp / f.maxHp;
    $('vignette').style.background = `radial-gradient(ellipse at center, transparent ${60 - hurt * 25}%, rgba(110,0,0,${Math.max(0, hurt - 0.35) * 1.2}) 100%)`;
  }
  return {
    update, weaponCard,
    message(t, dur = 1.5) { $('msg').textContent = t; $('msg').style.opacity = 1; msgT = dur; },
    sub(t, dur = 2) { $('sub').textContent = t; $('sub').style.opacity = 1; subT = dur; },
    damageNumber(p, n, cut) {
      if (dmgEls.length > 24) { dmgEls[0].el.remove(); dmgEls.shift(); }
      const el = document.createElement('div'); el.className = 'dmg' + (cut ? ' cut' : ''); el.textContent = Math.round(n);
      $('hud').appendChild(el); dmgEls.push({ el, p: p.clone(), t: 0 });
    },
  };
})();

// ---------- settings menu ----------
function applyQuality(name) {
  qName = name; Q = QUALITY[qName];
  try { localStorage.setItem('ironblood.quality', qName); } catch (e) {}
  renderer.setPixelRatio(Q.ratio); renderer.setSize(innerWidth, innerHeight);
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  clearGrass(); updateGrass(player.pos.x, player.pos.z, true);
}
function bindSettings() {
  const GORE = ['Off', 'Some', 'Max'];
  const rows = [['sMaster', 'master', v => v + '%'], ['sMusic', 'music', v => v + '%'], ['sSfx', 'sfx', v => v + '%'], ['sGore', 'gore', v => GORE[v]], ['sSens', 'sens', v => v + '%']];
  for (const [id, key, fmt] of rows) {
    const el = $(id), em = el.parentElement.querySelector('em');
    el.value = settings[key]; em.textContent = fmt(+el.value);
    el.oninput = () => { settings[key] = +el.value; em.textContent = fmt(+el.value); applyVolumes(); saveSettings(); };
  }
  $('sQuality').value = qName; $('sQuality').onchange = (e) => applyQuality(e.target.value);
  $('sDmgNums').value = String(settings.dmgNums); $('sDmgNums').onchange = (e) => { settings.dmgNums = +e.target.value; saveSettings(); };
  $('sHard').value = String(settings.hard); $('sHard').onchange = (e) => { settings.hard = +e.target.value; saveSettings(); };
}
bindSettings();
let pauseFromTitle = false;
function openPause(fromTitle) {
  paused = true; pauseFromTitle = !!fromTitle;
  $('pause').style.display = 'flex';
  $('resumeBtn').textContent = fromTitle ? 'BACK' : 'RESUME';
  if (fromTitle) $('title').style.display = 'none';
}
$('resumeBtn').onclick = () => {
  $('pause').style.display = 'none';
  if (pauseFromTitle) { $('title').style.display = 'flex'; paused = false; return; }
  paused = false; requestLock();
};
$('titleSettings').onclick = () => openPause(true);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement && playing && player.alive && !paused) openPause(false);
});
