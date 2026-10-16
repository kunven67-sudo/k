// Everything on screen that isn't the 3D world: HUD, speech bubbles, news feed, chat, menus, panels.
import * as THREE from 'three';
import { h, put, clear, btn } from './dom.js';
import { settings, keyName } from '../core/settings.js';
import { input, actPressed, act, lockPointer, unlockPointer } from '../core/input.js';
import { quality } from '../core/quality.js';
import { sfx } from '../core/audio.js';
import { fmtMoney, fmtSize, sizeCompare, clamp } from '../core/util.js';
import { J } from '../life/body.js';
import { JOBS, TRAITS } from '../life/looks.js';
import { CORES } from '../gadgets/parts.js';
import { FORMS } from '../player/player.js';
import { TECH } from '../life/society.js';
import { buildMenus } from './menus.js';
import { buildPanels } from './panels.js';
import { CAMS } from './computer.js';

const _v = new THREE.Vector3();

const TASK_WORDS = {
  wander: 'walking around', watch: 'watching', flee: 'running away', fight: 'fighting', attackGiant: 'attacking your hand', eat: 'eating', eatCorpse: 'eating a body',
  drink: 'getting a drink', sleep: 'sleeping', warm: 'warming up', toilet: 'going to the toilet', wash: 'washing', hospital: 'going to the hospital', bandageSelf: 'bandaging a wound',
  heal: 'helping someone hurt', bury: 'burying someone', mourn: 'mourning', chat: 'chatting', romance: 'flirting', fun: 'having fun', party: 'partying', pray: 'praying',
  greetPlayer: 'coming to say hi', gather: 'gathering', haul: 'carrying stuff to camp', build: 'building', craft: 'making something', research: 'inventing', farm: 'farming',
  cook: 'cooking', trade: 'trading', graffiti: 'writing on the glass', escape: 'trying to break out', jailed: 'locked up', stay: 'staying close', play: 'playing',
  follow: 'following', come: 'coming to you', stay_here: 'staying put', stop: 'standing still', sit: 'sitting', dance: 'dancing', wave: 'waving', hide: 'hiding',
  give_player: 'bringing you something', leaveLab: 'looking for a way out', eatLoose: 'eating',
};

export class UI {
  constructor(game, root) {
    this.g = game;
    this.root = root;
    this.state = 'menu';
    this.modal = null;
    this.bubbles = new Map();
    this.feedOn = true;
    this.focusPerson = null;
    this.infoOn = false;
    this.chatOpen = false;
    this.micOn = false;
    this.hudT = 0;
    this.aimT = 0;
    this.aimHit = null;
    this.camList = CAMS;
    this.buildHud();
    this.menus = buildMenus(this);
    this.panels = buildPanels(this);
    input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.modal && !this.chatOpen && !this.g.over) this.menus.pause();
    };
    this.g.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'play' && !this.modal && !this.chatOpen && !this.g.over) lockPointer();
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.modal && !this.modal.locked) { e.preventDefault(); this.close(); }
    });
  }

  get modalOpen() { return !!this.modal || this.chatOpen || this.state !== 'play'; }

  // ------------------------------------------------------------- HUD
  buildHud() {
    const hud = this.hud = h('div', { id: 'hud' });
    this.cross = h('div', { class: 'crosshair' });
    this.prompt = h('div', { class: 'prompt', style: { display: 'none' } });
    this.hotbarEl = h('div', { class: 'hotbar' });
    this.statsEl = h('div', { class: 'stats' });
    this.watchEl = h('div', { class: 'watch' });
    this.topEl = h('div', { class: 'topright' });
    this.feedEl = h('div', { class: 'feed' });
    this.fpsEl = h('div', { class: 'fps', style: { display: 'none' } });
    this.vignette = h('div', { class: 'vignette' });
    this.bubbleLayer = h('div', { class: 'passive' });
    this.tagLayer = h('div', { class: 'passive' });
    this.info = h('div', { class: 'infocard panel', style: { display: 'none' } });
    this.micEl = h('div', { class: 'mic', style: { display: 'none' } });
    put(hud, this.bubbleLayer, this.tagLayer, this.vignette, this.cross, this.prompt, this.hotbarEl, this.statsEl, this.watchEl, this.topEl, this.feedEl, this.fpsEl, this.info, this.micEl);
    put(this.root, hud);
    this.fadeEl = h('div', { class: 'fade' });
    this.toastEl = null;
    put(this.root, this.fadeEl);
    hud.style.display = 'none';
  }

  showHud(on) { this.hud.style.display = on ? '' : 'none'; }

  toast(text) {
    if (!text) return;
    if (this.toastEl) this.toastEl.remove();
    const el = this.toastEl = h('div', { class: 'toast passive' }, text);
    put(this.root, el);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.remove(); if (this.toastEl === el) this.toastEl = null; }, 2600 + text.length * 25);
  }

  feed(n) {
    if (!n.text) return;
    const who = n.who != null ? this.g.byId(n.who) : null;
    const el = h('div', { class: 'item ' + (n.kind || '') + (who ? ' click' : ''), onclick: () => { if (who && this.g.people.includes(who)) { this.focusPerson = who; this.g.follow = who; this.close(); lockPointer(); } } }, n.text);
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 7) this.feedEl.lastChild.remove();
    setTimeout(() => { el.style.transition = 'opacity 1s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 1000); }, 12000);
  }

  moneyPop(n, why) {
    const el = h('div', { class: 'toast passive', style: { top: '64px', left: 'auto', right: '14px', transform: 'none', fontSize: '13px', color: n >= 0 ? '#a6f5c8' : '#ff9c9c' } }, `${n >= 0 ? '+' : '-'}${fmtMoney(Math.abs(n))}${why ? '  ' + why : ''}`);
    put(this.root, el);
    setTimeout(() => el.remove(), 2200);
  }

  hurtFlash(dmg) {
    this.vignette.style.boxShadow = `inset 0 0 ${120 + dmg * 6}px rgba(170,0,0,${clamp(0.25 + dmg / 40, 0, 0.85)})`;
    clearTimeout(this.hurtT);
    this.hurtT = setTimeout(() => { this.vignette.style.boxShadow = ''; }, 260);
  }

  fade(mid) {
    this.fadeEl.style.opacity = '1';
    setTimeout(() => { if (mid) mid(); this.fadeEl.style.opacity = '0'; }, 650);
  }

  // ------------------------------------------------------------- speech
  bubble(p, text, kind = 'chat', dur = 3) {
    if (!settings.subtitles) return;
    let b = this.bubbles.get(p);
    if (!b) { b = { el: h('div', { class: 'bubble' }) }; this.bubbles.set(p, b); put(this.bubbleLayer, b.el); }
    b.el.className = 'bubble ' + kind;
    clear(b.el).append(h('span', { class: 'who' }, p.name), text);
    b.until = this.g.time + dur;
    b.think = false;
  }

  thinking(p, on) {
    if (!on) { const b = this.bubbles.get(p); if (b && b.think) { b.el.remove(); this.bubbles.delete(p); } return; }
    let b = this.bubbles.get(p);
    if (!b) { b = { el: h('div', { class: 'bubble' }) }; this.bubbles.set(p, b); put(this.bubbleLayer, b.el); }
    b.el.className = 'bubble think';
    clear(b.el).append(h('span', { class: 'who' }, p.name), '...');
    b.until = this.g.time + 30; b.think = true;
  }

  playerSaid(text, p) {
    const el = h('div', { class: 'toast passive', style: { top: 'auto', bottom: '150px', background: 'rgba(20,60,50,.8)', fontSize: '14px' } }, `You to ${p ? p.name : 'everyone'}: "${text}"`);
    put(this.root, el);
    setTimeout(() => el.remove(), 3500);
  }

  forget(p) {
    const b = this.bubbles.get(p);
    if (b) { b.el.remove(); this.bubbles.delete(p); }
    if (this.focusPerson === p) this.focusPerson = null;
    if (this.g.follow === p) this.g.follow = null;
  }

  onDeath(p) { if (this.g.follow === p) setTimeout(() => { if (this.g.follow === p) this.g.follow = null; }, 4000); }

  // project a world point to the screen; null if behind the camera
  toScreen(pos) {
    _v.copy(pos).project(this.g.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight };
  }

  updateBubbles() {
    const g = this.g;
    for (const [p, b] of this.bubbles) {
      if (g.time > b.until || (!p.isPet && !g.people.includes(p))) { b.el.remove(); this.bubbles.delete(p); continue; }
      const head = p.objectForm ? p.objectForm.mesh.position.clone().add(_v.set(0, p.height * 1.1, 0)) : p.headPos(new THREE.Vector3()).add(_v.set(0, p.height * 0.16, 0));
      const near = g.audibleVol(p.pos, 1) > 0.015 || this.focusPerson === p || p.held || g.player.possess === p;
      const s = near && (g.entityVisible(p.pos) || p.held) ? this.toScreen(head) : null;
      if (!s || s.x < -100 || s.x > innerWidth + 100 || s.y < -50 || s.y > innerHeight + 50) { b.el.style.display = 'none'; continue; }
      b.el.style.display = '';
      b.el.style.left = s.x + 'px';
      b.el.style.top = s.y + 'px';
    }
  }

  updateTags() {
    const g = this.g;
    clear(this.tagLayer);
    if (g.player.possess) return;
    const list = [];
    if (this.aimHit && this.aimHit.kind === 'person') list.push(this.aimHit.ref);
    if (this.focusPerson && !list.includes(this.focusPerson) && g.people.includes(this.focusPerson)) list.push(this.focusPerson);
    for (const p of list) {
      if (this.bubbles.has(p) && this.bubbles.get(p).el.style.display !== 'none') continue;
      const s = this.toScreen(p.objectForm ? p.objectForm.mesh.position.clone().add(_v.set(0, p.height * 1.1, 0)) : p.headPos(new THREE.Vector3()).add(_v.set(0, p.height * 0.14, 0)));
      if (!s) continue;
      const hp = p.alive ? `${Math.max(0, Math.round(p.health))}/100` : 'dead';
      put(this.tagLayer, h('div', { class: 'nametag', style: { left: s.x + 'px', top: s.y + 'px' } }, `${p.name}${p.isClone ? ' (clone)' : ''}  ${hp}`));
    }
  }

  // ------------------------------------------------------------- per frame
  update(dt) {
    const g = this.g;
    if (this.state !== 'play') { this.updateBubbles(); return; }
    this.keys();
    this.updateBubbles();
    this.aimT -= dt;
    if (this.aimT <= 0) {
      this.aimT = 0.066;
      const pl = g.player;
      this.aimHit = null;
      if (!pl.possess && !g.driving && !g.follow) {
        const aim = pl.aim();
        this.aimHit = g.pick(aim.origin, aim.dir, Math.max(pl.reach * 3, pl.height * 6), { notPlayer: true });
      }
      this.updateTags();
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.drawHud(); }
  }

  keys() {
    const g = this.g;
    if (this.modal || this.chatOpen || g.over) {
      if (this.micOn && !act('mic')) this.endMic();
      return;
    }
    if (actPressed('talk')) { this.openChat(); return; }
    if (actPressed('mic')) this.startMic();
    if (this.micOn && !act('mic')) this.endMic();
    if (actPressed('info')) { this.infoOn = !this.infoOn; if (this.infoOn) this.focusOnAim(); sfx('click'); }
    if (actPressed('feed')) { this.feedOn = !this.feedOn; this.feedEl.style.display = this.feedOn ? '' : 'none'; }
    if (actPressed('follow')) {
      if (g.follow) { g.follow = null; this.toast('Back to you.'); }
      else { const p = this.focusOnAim(); if (p) { g.follow = p; this.toast(`Following ${p.name}. Mouse to look around, scroll to zoom, K to stop.`); } else this.toast('Look at someone to follow them.'); }
    }
    if (actPressed('changer')) this.open('changer');
    if (actPressed('backpack')) this.open('backpack');
    if (input.pressed.has('KeyH')) this.menus.help();
  }

  focusOnAim() {
    const a = this.aimHit;
    if (a && a.kind === 'person') { this.focusPerson = a.ref; return a.ref; }
    const h0 = this.g.player.holding;
    if (h0 && h0.kind === 'person') { this.focusPerson = h0.ref; return h0.ref; }
    return this.focusPerson;
  }

  drawHud() {
    const g = this.g;
    const pl = g.player;
    // crosshair + prompt
    const a = this.aimHit;
    const grabby = pl.tool === 'hand' && !pl.holding && a && a.dist < pl.reach && (a.kind === 'person' || a.kind === 'item' || a.kind === 'bug' || a.kind === 'car');
    this.cross.className = 'crosshair' + (grabby ? ' grab' : '');
    this.cross.style.display = g.follow || g.driving ? 'none' : '';
    let prompt = '';
    if (g.camView) prompt = `${g.camLabel || 'CAM'}   left/right arrows: switch camera   Esc: stop`;
    else if (g.job) prompt = `Working: ${g.job.name}... ${Math.ceil(g.job.t / 40)}h left`;
    else if (g.driving) prompt = `[${keyName(settings.keys.interact)}] get out   WASD drive   Space brake`;
    else if (pl.possess) prompt = `You are controlling ${pl.possess.name}. [${keyName(settings.keys.interact)}] leave their body`;
    else if (g.follow) prompt = `Following ${g.follow.name}   [${keyName(settings.keys.follow)}] stop`;
    else if (g.hover) prompt = `[${keyName(settings.keys.interact)}] ${g.hover.label}${g.hover.jar && g.hover.jar.occupant ? ': ' + (g.hover.jar.occupant.name || '') : ''}`;
    else if (pl.holding && pl.holding.kind === 'person') prompt = `[${keyName(settings.keys.throw)}] throw   [${keyName(settings.keys.squeeze)}] squeeze   [${keyName(settings.keys.pullLimb)}] pull a limb   [${keyName(settings.keys.talk)}] talk   right mouse: look close`;
    else if (pl.holding) prompt = `Click: drop   [${keyName(settings.keys.throw)}] throw`;
    else if (a && a.kind === 'person' && a.dist < pl.height * 6) prompt = `${a.ref.name}${a.ref.alive ? '' : ' (dead)'}${grabby ? '   click: pick up' : ''}   [${keyName(settings.keys.talk)}] talk   [${keyName(settings.keys.info)}] info`;
    else if (grabby) prompt = `${a.ref.name || (a.ref.def && a.ref.def.label) || ''}   click: pick up`;
    else if (g.brush) prompt = `Brush: ${g.brush.tool}   hold click to paint   right click: put it away`;
    this.prompt.style.display = prompt ? '' : 'none';
    this.prompt.textContent = prompt;
    // hotbar
    const sig = pl.hotbar.map((t) => (t && typeof t === 'object' ? t.id + t.name : t)).join('|') + pl.slot + pl.bottle.length + pl.bottleLid + pl.form;
    if (sig !== this.hotSig) {
      this.hotSig = sig;
      clear(this.hotbarEl);
      this.batBars = [];
      pl.hotbar.forEach((t, i) => {
        let label = '';
        if (t === 'hand') label = FORMS[pl.form].gadgets ? 'Hand' : (pl.form === 'cat' ? 'Claws' : 'Raptor arms');
        else if (t === 'bottle') label = `Bottle${pl.bottle.length ? ' (' + pl.bottle.length + ')' : ''}${pl.bottleLid ? '' : ' open'}`;
        else if (t === 'headband') label = 'Mind headband';
        else if (t && t.potion) label = `${t.name} x${t.uses ?? 1}`;
        else if (t) label = t.name;
        const bar = h('div', { class: 'bat' }, h('i'));
        const slot = h('div', { class: 'slot' + (pl.slot === i ? ' on' : '') }, h('span', { class: 'n' }, i + 1), label, t && typeof t === 'object' && !t.potion && g.mode === 'money' ? bar : null);
        if (t && typeof t === 'object' && t.opts && t.opts.color != null) slot.style.borderBottom = `3px solid #${(t.opts.color >>> 0).toString(16).padStart(6, '0')}`;
        this.batBars[i] = t && typeof t === 'object' ? { bar, t } : null;
        put(this.hotbarEl, slot);
      });
    }
    for (const b of this.batBars || []) if (b) b.bar.firstChild.style.width = Math.round((b.t.charge ?? 1) * 100) + '%';
    // stats
    clear(this.statsEl);
    const bar = (label, v, col) => h('div', { class: 'stat' }, h('span', { style: { width: '58px' } }, label), h('div', { class: 'bar' }, h('i', { style: { width: clamp(v, 0, 100) + '%', background: col } })));
    put(this.statsEl, h('div', { class: 'stat' }, h('span', { class: 'hp', style: { color: pl.health < 30 ? '#ff7a7a' : '#e9f1ee' } }, `${Math.max(0, Math.ceil(pl.health))}`), h('span', { class: 'muted' }, '/100 health'), h('span', { class: 'tag', style: { marginLeft: 'auto' } }, FORMS[pl.form].label + (pl.disguise ? ': ' + pl.disguise.name : ''))));
    put(this.statsEl, bar('Health', pl.health, pl.health < 30 ? '#ff5d5d' : '#63e6be'));
    if (settings.yourNeeds && !FORMS[pl.form].noNeeds) { put(this.statsEl, bar('Hunger', pl.needs.hunger, '#ffb347'), bar('Thirst', pl.needs.thirst, '#5ab0ff'), bar('Energy', pl.needs.energy, '#c0a0ff')); }
    // size watch
    const H = pl.height;
    const glow = pl.watchGlow > 0.05;
    clear(this.watchEl).append(h('div', { class: 'muted' }, 'SIZE WATCH'), h('div', { class: 'big' }, fmtSize(H)), h('div', {}, sizeCompare(H)), h('div', { class: 'muted' }, `hold ${keyName(settings.keys.shrink)} shrink  ·  hold ${keyName(settings.keys.grow)} grow`));
    this.watchEl.style.borderColor = glow ? '#63e6be' : '';
    this.watchEl.style.boxShadow = glow ? '0 0 22px rgba(99,230,190,.45)' : '';
    // top right
    clear(this.topEl);
    put(this.topEl, h('div', { class: 'timebox' }, g.world.timeString()));
    const sp = g.world.speed;
    put(this.topEl, h('div', { class: 'timebox' }, sp === 0 ? 'cage time PAUSED' : `cage time ${sp}x  (${keyName(settings.keys.slower)} / ${keyName(settings.keys.faster)})`));
    if (g.mode === 'money') put(this.topEl, h('div', { class: 'money' }, fmtMoney(g.money)));
    const wanted = g.streetLife.wanted;
    if (wanted > 0) put(this.topEl, h('div', { class: 'wanted' }, 'WANTED ' + '■'.repeat(Math.ceil(wanted)) + '□'.repeat(5 - Math.ceil(wanted))));
    const alive = g.people.filter((p) => p.alive && p.inCage).length;
    put(this.topEl, h('div', { class: 'timebox' }, `${alive} alive in the cage · ${TECH[g.society.tech] ? TECH[g.society.tech].name : ''}`));
    // fps
    this.fpsEl.style.display = settings.showFps ? '' : 'none';
    if (settings.showFps) this.fpsEl.textContent = `${Math.round(quality.fps)} fps  ${quality.level}  ${g.renderer.info.render.calls} calls`;
    // info card
    this.drawInfo();
  }

  drawInfo() {
    const g = this.g;
    const p = this.infoOn ? (this.focusPerson && g.people.includes(this.focusPerson) ? this.focusPerson : null) : null;
    if (!p) { this.info.style.display = 'none'; return; }
    this.info.style.display = '';
    clear(this.info);
    const job = p.kid ? (p.age === 'baby' ? 'Baby' : 'Kid') : (JOBS[p.job] ? JOBS[p.job].label : p.job);
    const opinion = p.op > 60 ? 'loves you' : p.op > 25 ? 'likes you' : p.op > -15 ? 'unsure about you' : p.op > -50 ? 'doesn\'t like you' : 'HATES you';
    const rels = [...p.rel.entries()].map(([id, r]) => [g.byId(id), r]).filter(([o]) => o && o !== p);
    const loves = rels.filter(([, r]) => r.l > 40).sort((a, b) => b[1].l - a[1].l).slice(0, 2).map(([o]) => o.name);
    const friends = rels.filter(([, r]) => r.f > 40).sort((a, b) => b[1].f - a[1].f).slice(0, 3).map(([o]) => o.name);
    const hates = rels.filter(([, r]) => r.f < -30).sort((a, b) => a[1].f - b[1].f).slice(0, 2).map(([o]) => o.name);
    const partner = p.partner ? g.byId(p.partner) : null;
    const tribe = p.tribe != null ? g.society.tribes.find((t) => t.id === p.tribe) : null;
    const action = p.objectForm ? `stuck as a ${p.objectForm.type}` : p.loc === 'jar' ? 'in a jar' : p.loc === 'table' ? 'strapped to the table' : p.held ? 'in your hand' : p.loc === 'bottle' ? 'in your bottle' : p.asleep ? 'sleeping' : p.task ? (TASK_WORDS[p.task.type] || p.task.type) + (p.task.order ? ' (you told them to)' : '') : 'thinking';
    const thought = !p.alive ? `Cause of death: ${p.cause}` : p.thought || this.guessThought(p);
    const needs = ['hunger', 'thirst', 'energy', 'social', 'fun', 'hygiene', 'warmth', 'bladder'];
    put(this.info, 
      h('h3', {}, `${p.name} ${p.last}${p.isClone ? ' (clone)' : ''}${p.title ? ' · ' + p.title : ''}`),
      h('div', { class: 'muted' }, `${p.ageYears} years old · ${job}${p.kid ? '' : ' · ' + (p.sex === 'm' ? 'man' : 'woman')}`),
      h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'hp', style: { color: p.health < 30 ? '#ff7a7a' : '#e9f1ee' } }, p.alive ? `${Math.max(0, Math.round(p.health))}/100` : 'DEAD'), h('span', {}, p.alive ? p.feeling() : ''), p.sick ? h('span', { class: 'tag bad' }, 'sick: ' + p.sick.kind) : null, p.bleed > 0.1 ? h('span', { class: 'tag bad' }, p.bandaged > 0 ? 'bandaged' : 'bleeding') : null, p.limbsLost ? h('span', { class: 'tag bad' }, `${p.limbsLost} limb${p.limbsLost > 1 ? 's' : ''} lost`) : null, p.brokenLeg != null ? h('span', { class: 'tag bad' }, 'broken leg') : null),
      h('div', { class: 'thought' }, `"${thought}"`),
      h('div', {}, p.traits.map((t) => h('span', { class: 'tag' }, TRAITS[t] ? t : t))),
      h('div', { class: 'kv' },
        h('b', {}, 'Doing'), h('span', {}, p.alive ? action : '-'),
        h('b', {}, 'You'), h('span', {}, `${opinion} (${Math.round(p.op)})${p.faith > 50 ? ', worships you' : ''}${p.loveYou > 50 ? ', in love with you' : ''}`),
        h('b', {}, 'Fear'), h('span', {}, `${Math.round(p.fear)}/100`),
        h('b', {}, 'Partner'), h('span', {}, partner ? partner.name + (p.married ? ' (married)' : '') : 'none'),
        h('b', {}, 'Loves'), h('span', {}, loves.join(', ') || '-'),
        h('b', {}, 'Friends'), h('span', {}, friends.join(', ') || '-'),
        h('b', {}, 'Hates'), h('span', {}, hates.join(', ') || '-'),
        h('b', {}, 'Tribe'), h('span', {}, tribe ? tribe.name + (tribe.leader === p.id ? ' (leader)' : '') : g.society.leader === p ? 'everyone\'s leader' : '-'),
        h('b', {}, 'Kids'), h('span', {}, p.kids.map((id) => g.byId(id)).filter(Boolean).map((k) => k.name).join(', ') || '-'),
        h('b', {}, 'Kills'), h('span', {}, String(p.kills || 0)),
        h('b', {}, 'Money'), h('span', {}, g.society.money ? String(Math.round(p.money)) : '-'),
      ),
      p.alive ? h('div', { style: { marginTop: '6px' } }, needs.map((k) => h('div', { class: 'stat', style: { fontSize: '11px' } }, h('span', { style: { width: '58px' } }, k), h('div', { class: 'bar' }, h('i', { style: { width: Math.round(p.needs[k]) + '%', background: p.needs[k] < 25 ? '#ff5d5d' : '#63e6be' } }))))) : null,
      h('div', { class: 'muted', style: { marginTop: '6px' } }, `${keyName(settings.keys.info)}: close   ${keyName(settings.keys.follow)}: follow cam`),
    );
  }

  guessThought(p) {
    const n = p.needs;
    if (p.held) return p.op > 50 ? 'Okay... I trust you.' : 'Put me down put me down put me down';
    if (p.fear > 80) return 'I don\'t want to die here.';
    if (n.hunger < 20) return 'I\'m so hungry...';
    if (n.thirst < 20) return 'Water. I need water.';
    if (p.grief > 0.3) { const m = p.mem.filter((x) => x.kind === 'grief').slice(-1)[0]; return m ? `${m.text}. I can't stop thinking about it.` : 'I miss them.'; }
    if (p.partner) { const q = this.g.byId(p.partner); if (q) return `I love ${q.name}.`; }
    if (p.op < -50) return 'One day we\'ll get out. And then the giant pays.';
    if (p.faith > 60) return 'The Giant watches over us.';
    if (p.task && p.task.type === 'build') return 'If we build it, we can survive here.';
    const last = p.mem.slice(-1)[0];
    return last ? last.text : 'What is this place?';
  }

  // ------------------------------------------------------------- chat + mic
  chatTarget() {
    const g = this.g;
    const a = this.aimHit;
    if (a && a.kind === 'person' && a.ref.alive) return a.ref;
    const hd = g.player.holding;
    if (hd && hd.kind === 'person') return hd.ref;
    if (this.focusPerson && g.people.includes(this.focusPerson) && this.focusPerson.alive && g.audibleVol(this.focusPerson.pos) > 0.05) return this.focusPerson;
    return null;
  }

  nearbyListeners() {
    const g = this.g;
    return g.people.filter((p) => p.alive && !p.kid && g.audibleVol(p.pos, 1) > 0.25).sort((a, b) => g.audibleVol(b.pos) - g.audibleVol(a.pos)).slice(0, 6);
  }

  openChat() {
    const target = this.chatTarget();
    const g = this.g;
    this.chatOpen = true;
    let to = target;
    const toEl = h('span', { class: 'to' }, target ? `to ${target.name}` : 'to everyone nearby');
    const inp = h('input', { type: 'text', placeholder: target ? `Say something to ${target.name}...  (Enter to send, Esc to cancel)` : 'Say something to everyone nearby...', maxlength: 240 });
    const wrap = h('div', { class: 'chat' }, toEl, inp);
    put(this.root, wrap);
    setTimeout(() => inp.focus(), 0);
    const done = () => { this.chatOpen = false; wrap.remove(); input.typing = false; };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') { e.preventDefault(); done(); }
      if (e.code === 'Enter') {
        const text = inp.value.trim();
        done();
        if (!text) return;
        this.say(text, to);
      }
      if (e.code === 'Tab') { e.preventDefault(); to = to ? null : this.chatTarget(); toEl.textContent = to ? `to ${to.name}` : 'to everyone nearby'; }
    });
    void g;
  }

  say(text, to) {
    const g = this.g;
    if (to) { g.talk.tell(to, text); this.focusPerson = to; return; }
    const ls = this.nearbyListeners();
    if (!ls.length) { this.toast('Nobody close enough to hear you.'); return; }
    this.playerSaid(text, null);
    ls.forEach((p, i) => setTimeout(() => { if (g.people.includes(p)) g.talk.tell(p, text); }, i * 450));
  }

  startMic() {
    const g = this.g;
    this.micTarget = this.chatTarget();
    if (!g.talk.startMic((t) => { this.micEl.textContent = 'Listening: ' + t; })) return;
    this.micOn = true;
    this.micEl.style.display = '';
    this.micEl.textContent = `Listening${this.micTarget ? ' (to ' + this.micTarget.name + ')' : ''}... let go of ${keyName(settings.keys.mic)} to send`;
  }

  endMic() {
    this.micOn = false;
    this.micEl.style.display = 'none';
    const text = this.g.talk.stopMic().trim();
    if (text) this.say(text, this.micTarget && this.g.people.includes(this.micTarget) ? this.micTarget : null);
  }

  // ------------------------------------------------------------- modals
  // a modal window: {title, body (element), buttons [[label, fn, cls]], wide, onClose, locked}
  showModal(name, { title, body, buttons = [], wide = false, onClose = null, locked = false, tabs = null }) {
    this.close(true);
    const box = h('div', { class: 'modal panel', style: wide ? { width: 'min(1100px, 96vw)' } : {} });
    const head = h('header', {}, h('h2', {}, title), locked ? null : h('button', { class: 'x', onclick: () => this.close() }, '×'));
    put(box, head);
    if (tabs) put(box, tabs);
    const bodyEl = h('div', { class: 'body' }, body);
    put(box, bodyEl);
    if (buttons.length) put(box, h('footer', {}, buttons.map(([l, fn, cls]) => btn(l, fn, cls))));
    const wrap = h('div', { class: 'modal-wrap' }, box);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && !locked) this.close(); });
    put(this.root, wrap);
    this.modal = { name, el: wrap, body: bodyEl, onClose, locked };
    unlockPointer();
    return this.modal;
  }

  close(silent = false) {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    m.el.remove();
    if (m.onClose) m.onClose();
    if (!silent && this.state === 'play' && !this.g.over) lockPointer();
  }

  open(name, ...args) {
    const fn = this.panels[name];
    if (!fn) { this.toast(`(${name} not available)`); return; }
    sfx('ui');
    fn(...args);
  }

  headbandAt(aim) {
    const g = this.g;
    const hit = g.pick(aim.origin, aim.dir, g.player.reach * 2.5, { notPlayer: true });
    if (!hit || hit.kind !== 'person') { this.toast('Point the headband at a person and click.'); return; }
    this.open('headband', hit.ref);
  }

  tv(on) {
    const g = this.g;
    if (!on) { this.toast('TV off.'); return; }
    const missing = g.streetLife.posters.length;
    const lines = [
      missing ? `NEWS: ${missing} ${missing === 1 ? 'person has' : 'people have'} gone missing on Maple Street. Police ask anyone who saw something to call.` : 'NEWS: Quiet day on Maple Street. A local man won a pie-eating contest.',
      g.streetLife.wanted > 2 ? 'NEWS: Police are searching the neighborhood after reports of a "man in a lab coat" grabbing people.' : 'WEATHER: Sunny, then cloudy. Light breeze.',
    ];
    this.toast(lines.join('   '));
  }

  gameOver(from) { this.menus.gameOver(from); }
  autosave() { this.menus.autosave(); }
  dailyMoney(d) { if (this.panels.dailyMoney) this.panels.dailyMoney(d); }
}

export { CORES };
