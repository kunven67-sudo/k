// Eating -> growing. A little growth right away (the abdomen swells), the rest is stored for the next MOLT, where the
// spider splits its old skin, crawls out bigger and soft (weak for a while), and picks an evolution card.
// Powers are stolen from what you eat. Your lair is where you rest and save. Outgrowing a zone moves you up the ladder.
import * as THREE from 'three';
import { SPECIES, POWERS } from '../spider/species.js';
import { OUTGROW, ZONE_ORDER } from '../world/zones.js';
import { clamp, rand, pick, sizeText, asBig } from '../core/util.js';

export const MOLT_NEED = 0.22;

// what eating something gives you (kind -> power)
const POWER_FROM = { giantroach: 'armor', rat: null, gecko: null, server: 'electric', cryo: 'frost', car: 'armor', tank: 'armor', bird: 'glide', heli: 'glide', jet: 'glide', reactor: 'rad', nuke: 'rad', star: 'stars', sun: 'stars', blackhole: 'void', alien: 'alien', volcano: 'fire', gasstation: 'fire' };

export class Growth {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.pendingPowers = []; this.lair = null; this.peak = 0.004; this.moltCount = 0; this.starveT = 0; this.grow = 0; }

  feed(mass, target) {
    const G = this.game, p = G.player;
    const r = mass / p.mass;
    const gain = Math.log(1 + 0.4 * Math.min(r, 2.5)) / 3;
    p.targetSize = (p.targetSize || p.sizeM) * Math.exp(gain * 0.4);
    p.moltStore = (p.moltStore || 0) + gain * 0.6;
    p.hunger = Math.min(1, p.hunger + clamp(r * 0.9, 0.02, 1));
    p.heal(10 + 30 * Math.min(r, 1));
    p.mutationPoints += Math.max(1, Math.round(Math.log2(1 + r * 4) * 3));
    G.stats.eaten++; G.stats.biomass += mass;
    const pw = target && target.type === 'c' ? POWER_FROM[target.c.kind] : null;
    if (pw && !p.powers[pw] && !this.pendingPowers.includes(pw)) { this.pendingPowers.push(pw); G.hud.toast(`You can feel something new in your blood: ${POWERS[pw].name}. Molt to keep it.`, 3.5); }
    if (p.moltStore >= MOLT_NEED && !this.toldMolt) { this.toldMolt = true; G.hud.hint('molt', 'Your skin is too tight. Find somewhere safe and press M to MOLT.'); }
    G.audio.crunch();
  }
  vial(kind) {
    const G = this.game, p = G.player;
    if (kind === 'growth') { p.targetSize = (p.targetSize || p.sizeM) * 1.22; p.moltStore = (p.moltStore || 0) + 0.12; G.hud.toast('Growth serum. You can feel your body stretching.', 3); G.cam.addShake(0.3); G.audio.heartbeat(0.6); }
    else { const pw = pick(['electric', 'frost', 'armor', 'glide']); if (!p.powers[pw]) { this.pendingPowers.push(pw); G.hud.toast(`Mutation serum: ${POWERS[pw].name} is waiting in your blood. Molt to keep it.`, 3.5); } else { p.legsLost = 0; p.heal(100); G.hud.toast('Mutation serum: your missing legs grow back.', 3); } }
    G.stats.vials = (G.stats.vials || 0) + 1;
  }
  update(dt) {
    const G = this.game, p = G.player; if (!p || G.state === 'dead') return;
    if (!p.targetSize) p.targetSize = p.sizeM;
    // smooth size changes
    if (Math.abs(p.targetSize - p.sizeM) > p.sizeM * 1e-4) { p.sizeM += (p.targetSize - p.sizeM) * (1 - Math.exp(-dt * 1.6)); }
    this.peak = Math.max(this.peak, p.sizeM);
    if (G.state !== 'play') return;
    // hunger
    const drain = 0.0035 * (G.realistic ? 1.6 : G.difficulty === 'hard' ? 1.25 : 1) * (p.mode === 'molt' ? 0 : 1);
    p.hunger = Math.max(0, p.hunger - drain * dt * (G.input.is('sprint') ? 1.6 : 1));
    if (p.hunger <= 0) {
      this.starveT += dt;
      p.hp -= dt * 1.2; if (p.hp <= 0) G.die('starved');
      if (p.targetSize > this.peak * 0.85) p.targetSize *= Math.exp(-0.002 * dt);
      if (this.starveT > 1 && !this.toldStarve) { this.toldStarve = true; G.hud.toast('You are starving. You are getting smaller and weaker. Eat.', 3); }
    } else { this.starveT = 0; if (p.hunger > 0.4 && p.hp < p.maxHp) p.heal(dt * 1.5); }
    // the abdomen looks full or empty
    const ab = p.body.userData.abMesh; if (ab) { const k = 0.85 + 0.25 * p.hunger + 0.15 * clamp((p.moltStore || 0) / MOLT_NEED, 0, 1); ab.scale.setScalar(k); }
    p.molt = clamp((p.moltStore || 0) / MOLT_NEED, 0, 1);
    // outgrow the zone -> the camera pulls out to the next one
    const z = G.zone; if (z && p.sizeM > OUTGROW[z.id] && G.state === 'play' && !G.story.transitioning) { const i = ZONE_ORDER.indexOf(z.id); if (ZONE_ORDER[i + 1]) G.story.transition(ZONE_ORDER[i + 1]); }
  }

  tryMolt() {
    const G = this.game, p = G.player;
    if ((p.moltStore || 0) < MOLT_NEED) { G.hud.toast(`Not ready to molt (${Math.round(p.molt * 100)}%). Eat more.`, 1.6); return; }
    if (p.mode !== 'ground' && p.mode !== 'dangle') { G.hud.toast('Hold on to something to molt.', 1.5); return; }
    this.startMolt();
  }
  startMolt() {
    const G = this.game, p = G.player;
    p.mode = 'molt'; p.rig.mode = 'molt';
    G.state = 'cutscene';
    this.moltT = 0;
    G.audio.molt();
    G.hud.toast('Molting... your old skin splits open.', 4);
    const body = p.body;
    // the old skin (exuvia): a pale see-through copy left behind in the world
    const skin = body.clone(true);
    skin.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshPhysicalMaterial({ color: 0xc8b89a, roughness: 0.55, transparent: true, opacity: 0.55, transmission: 0.2, sheen: 0.5, side: THREE.DoubleSide, depthWrite: false }); o.castShadow = false; } });
    skin.position.copy(body.position); skin.quaternion.copy(body.quaternion); skin.scale.copy(body.scale);
    this.exuvia = skin;
    const start = performance.now();
    const step = () => {
      const t = (performance.now() - start) / 1000;
      body.position.copy(p.pos).addScaledVector(p.up, Math.sin(t * 30) * p.s * 0.01 * (t < 3 ? 1 : 0));
      if (t < 3.2) { requestAnimationFrame(step); return; }
      // crawl out: bigger, pale and soft
      G.zone.scene.add(skin);
      this.moltCount++; G.stats.molts++;
      const jump = Math.exp(p.moltStore) * 1.08;
      p.moltStore = 0; this.toldMolt = false;
      p.targetSize = p.sizeM * jump; p.sizeM *= Math.sqrt(jump);
      p.soft = 1; p.applySoft();
      p.mode = 'ground'; p.rig.initDone = false;
      G.audio.ui('level');
      G.hud.toast(`Molt ${this.moltCount}: you are ${sizeText(p.targetSize)} now. Soft and weak for a while.`, 4);
      this.offerCards();
    };
    requestAnimationFrame(step);
  }
  // evolution cards: grow / new species / traits / a stolen power
  offerCards() {
    const G = this.game, p = G.player;
    const cards = [];
    cards.push({ kind: 'grow', title: 'GROW', text: 'Put everything into size. +20% right now.', apply: () => { p.targetSize *= 1.2; } });
    const sizeOk = (id) => { const sz = p.targetSize; if (['goliath'].includes(id)) return sz > 0.02; return true; };
    const sp = Object.keys(SPECIES).filter(k => !SPECIES[k].npc && k !== p.speciesId && sizeOk(k));
    const pickSp = sp.sort(() => Math.random() - 0.5)[0];
    if (pickSp) cards.push({ kind: 'species', species: pickSp, title: SPECIES[pickSp].name.toUpperCase(), text: SPECIES[pickSp].blurb, stats: SPECIES[pickSp].stats, apply: () => { p.setSpecies(pickSp); p.applyPowerLooks(); } });
    if (this.pendingPowers.length) { const pw = this.pendingPowers[0]; cards.push({ kind: 'power', power: pw, title: POWERS[pw].name.toUpperCase(), text: POWERS[pw].desc, apply: () => { p.powers[pw] = (p.powers[pw] || 0) + 1; this.pendingPowers.shift(); p.applyPowerLooks(); } }); }
    const traits = [['venom', 'VENOM', 'Your bite paralyzes faster.'], ['silk', 'SILK', 'Stronger silk: webs hold bigger prey longer.'], ['body', 'SHELL', 'Harder shell, stronger bite.'], ['senses', 'SENSES', 'Feel vibrations further. See threats sooner.'], ['speed', 'SPEED', 'Run faster.']];
    while (cards.length < 3) { const t = pick(traits); if (cards.some(c => c.trait === t[0])) continue; cards.push({ kind: 'trait', trait: t[0], title: t[1] + ' +1', text: t[2], apply: () => { p.evo[t[0]]++; } }); }
    G.state = 'evolve';
    G.input.unlock();
    G.menus.evolve(cards, (c) => { if (c) c.apply(); G.trophy('molt' + Math.min(this.moltCount, 10), 'Molted ' + this.moltCount + ' times'); G.startPlay(); });
  }

  makeLair() {
    const G = this.game, p = G.player;
    if (p.mode !== 'ground') { G.hud.toast('Make your lair on solid ground.', 1.5); return; }
    if (p.silk < 0.3) { G.hud.toast('Not enough silk for a lair (needs 30%).', 1.5); return; }
    p.silk -= 0.3;
    this.lair = { pos: p.pos.clone(), up: p.up.clone(), zone: G.zone.id };
    G.webs.trap(p);
    G.hud.toast('Lair spun. Rest here (R) to save. Anything that walks into your web gets stuck.', 3.5);
    G.story.flags.lair = true;
  }
  rest() {
    const G = this.game, p = G.player;
    if (!this.lair || this.lair.zone !== G.zone.id || this.lair.pos.distanceTo(p.pos) > p.s * 12) { G.hud.toast('You can only rest + save at your lair (L to make one).', 2); return; }
    p.heal(p.maxHp); p.soft = 0; p.applySoft();
    G.saveAtLair(this.lair);
  }
  usePower(k) {
    const G = this.game, p = G.player;
    if (k === 1) { if (p.silk < 0.25) { G.hud.toast('Not enough silk for a trap web.', 1.2); return; } if (G.webs.trap(p)) { p.silk -= 0.25; G.hud.toast('Trap web spun. You will feel it when something hits it.', 2); } else G.hud.toast('Nothing to anchor a web to here.', 1.5); return; }
    const list = Object.keys(p.powers);
    const pw = list[k - 2]; if (!pw) { G.hud.toast('No power in that slot yet. Eat things to steal powers.', 1.5); return; }
    if ((p.powerCD || 0) > G.time) return; p.powerCD = G.time + 4;
    const s = p.s;
    if (pw === 'electric') { G.fx.sparks(p.pos, s, 40, [0.5, 0.85, 1, 1]); for (const c of G.zone.creatures.near(p.pos, s * 6)) c.hurt(30 * s / c.L, 30); G.cam.addShake(0.3); }
    else if (pw === 'frost') { G.fx.sparks(p.pos, s, 40, [0.8, 0.95, 1, 1]); for (const c of G.zone.creatures.near(p.pos, s * 6)) c.webbed(10); }
    else if (pw === 'fire' || pw === 'stars') { G.fx.sparks(p.pos, s, 50, [1, 0.6, 0.2, 1]); for (const c of G.zone.creatures.near(p.pos, s * 5)) c.hurt(60, 0); }
    else if (pw === 'void') { G.timeSlow = 4; G.hud.toast('Time slows around you.', 1.5); }
    else if (pw === 'rad') { G.fx.sparks(p.pos, s, 40, [0.5, 1, 0.3, 1]); for (const c of G.zone.creatures.near(p.pos, s * 8)) c.hurt(20, 60); }
    else if (pw === 'glide') { p.vel.addScaledVector(p.up, s * 6); p.startFall(); }
    else if (pw === 'armor') { p.invuln = 3; G.hud.toast('Plates locked. You shrug off hits for a moment.', 1.5); }
    else if (pw === 'alien') { p.heal(40); }
  }
}
