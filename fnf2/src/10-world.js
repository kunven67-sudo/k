// FNF 2 - characters + stages, built from Friday Night Funkin's own data files
// (preload/data/characters/*.json, preload/data/stages/*.json), following the
// rules of BaseCharacter/Bopper/Stage in the Funkin' engine.

// ------------------------------------------------------------------ Bopper helpers
// Sprites that dance every N beats (characters + animated stage props)
function bopperDance(spr, force) {
  if (spr.anims.danceLeft) { spr._danced = !spr._danced; spr.play((spr._danced ? 'danceRight' : 'danceLeft') + (spr.idleSuffix || ''), force); }
  else spr.play('idle' + (spr.idleSuffix || ''), force);
}
// Flixel addAtlasAnimations / addTextureAtlasAnimations for a list of FNF anim defs
function addAnims(spr, list, srcFor) {
  for (const a of list || []) {
    const src = srcFor ? srcFor(a) : null;
    const ok = spr.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped, a.frameIndices && a.frameIndices.length ? a.frameIndices : null, src);
    if (ok && a.flipX) spr.anims[a.name].flip = true;
    spr.animOffsets[a.name] = a.offsets || [0, 0];
  }
}

// ------------------------------------------------------------------ Character
G.Character = class extends G.Sprite {
  constructor(id, type) {
    super(0, 0);
    this.id = id; this.type = type || 'other'; // 'bf' | 'dad' | 'gf'
    const d = this.data = G.A.json('preload/data/characters/' + id + '.json') || {};
    this.name = d.name || id;
    this.useAnimOffsets = true;
    this.globalOffsets = d.offsets || [0, 0];
    this.cameraOffsets = d.cameraOffsets || [0, 0];
    this.singTime = d.singTime != null ? d.singTime : 8;
    this.danceEvery = d.danceEvery != null ? d.danceEvery : 1;
    this.baseScale = d.scale != null ? d.scale : 1;
    this.isPixel = !!d.isPixel; this.antialias = !d.isPixel;
    this.holdTimer = 0; this.isDead = false;
    const rt = d.renderType || 'sparrow';
    const main = G.A.imagePath(d.assetPath || '');
    const isAtlas = rt === 'animateatlas' || rt === 'multianimateatlas';
    if (rt === 'own') { /* drawn live by its fx (e.g. 31-wrath-eye.js) */ }
    else if (isAtlas) this.loadAtlas(main); else this.loadSparrow(main);
    // multi* characters: each animation may come from its own sheet/atlas
    const srcFor = a => {
      if (!a.assetPath || (rt !== 'multisparrow' && rt !== 'multianimateatlas')) return null;
      const p = G.A.imagePath(a.assetPath);
      if (a.renderType === 'sparrow' || rt === 'multisparrow') return G.Sparrow.load(p);
      return G.Atlas.load(p);
    };
    addAnims(this, d.animations, srcFor);
    // (mods sometimes leave an animation's assetPath out although it lives in one of the character's other
    // atlases, like Darnell's Mixtape's miss poses: look for it there, like the real engine finds it)
    if (rt === 'multianimateatlas' || rt === 'multisparrow') {
      const others = [...new Set((d.animations || []).filter(a => a.assetPath).map(a => a.assetPath))];
      for (const a of d.animations || []) {
        if (this.anims[a.name] || a.assetPath) continue;
        for (const ap of others) { addAnims(this, [Object.assign({}, a, { assetPath: ap })], srcFor); if (this.anims[a.name]) break; }
      }
    }
    this.setBaseScale(this.baseScale);
    this.healthIcon = Object.assign({ id: id, flipX: false, isPixel: false }, d.healthIcon || {});
    this.deathData = d.death || {};
    this.startingAnimation = d.startingAnimation || null;
    // our own characters can bring live tricks (30-own-chars.js), e.g. WRATH's changing eye
    this.fx = d.fx && G.OwnFX && G.OwnFX[d.fx] || null;
    if (this.fx && this.fx.init) this.fx.init(this);
    this.script = (G.CharScripts && (G.CharScripts[id] || G.CharScripts[id.split('-')[0]])) || null;
    if (this.script && this.script.init) this.script.init(this);
    this.dance(true);
    this.updateHitbox();
  }
  setBaseScale(s) { this.scale.x = this.scale.y = s; }
  // stage placement: feet on pos (bottom-centre of the idle frame), then global offsets
  place(pos, stageScale) {
    this.dance(true);
    const s = this.baseScale * (stageScale == null ? 1 : stageScale);
    this.scale.x = this.scale.y = s;
    this.updateHitbox();
    this.x = pos[0] - this.width / 2 + this.globalOffsets[0];
    this.y = pos[1] - this.height + this.globalOffsets[1];
    this.originalPosition = { x: this.x, y: this.y };
    this.resetCameraFocus();
  }
  resetCameraFocus() {
    this.camFocus = { x: this.originalPosition.x + this.width / 2 + this.cameraOffsets[0], y: this.originalPosition.y + this.height / 2 + this.cameraOffsets[1] };
  }
  isSinging() { return this.animName.startsWith('sing') && !this.animName.endsWith('-end'); }
  dance(force) {
    if (this.isDead || this._locked) return;          // (locked = a special animation must play out)
    if (this.script && this.script.dance) { this.script.dance(this, force); return; }
    if (!force) {
      if (this.isSinging()) return;
      if (!this.animName.startsWith('dance') && !this.animName.startsWith('idle') && !this.finished) return;
    }
    bopperDance(this, force);
  }
  // FNF playAnimation with "-hold" follow-ups
  playAnim(name, force) {
    if (!this.anims[name]) {
      // fall back like correctAnimationName: strip suffixes
      const base = name.replace(/-(alt|hold|end|censor).*$/, '').replace(/miss$/, '');
      if (this.anims[base]) name = base; else return false;
    }
    this.play(name, force);
    return true;
  }
  sing(dir, miss, suffix) {
    if (this.swapLR && (dir === 0 || dir === 3)) dir = 3 - dir;      // mirrored onto the other side (see play setupWorld)
    const n = 'sing' + ['LEFT', 'DOWN', 'UP', 'RIGHT'][dir] + (miss ? 'miss' : '') + (suffix || this.singSuffix || '');
    this.holdTimer = 0;
    if (!this.playAnim(n, true) && miss) this.playAnim('sing' + ['LEFT', 'DOWN', 'UP', 'RIGHT'][dir], true);
    if (this.fx && this.fx.onSing) this.fx.onSing(this, dir, miss);
  }
  // per-frame: hold timers + "-hold" follow-up animations (BaseCharacter.onUpdate)
  tick(dt, stepSec, holdingNote) {
    this.update(dt);
    if (this.fx && this.fx.update) this.fx.update(this, dt);
    if (this.script && this.script.tick) this.script.tick(this, dt);
    if (this.isDead) return;
    if (this.finished && !this.animName.endsWith('-hold') && this.anims[this.animName + '-hold']) this.play(this.animName + '-hold');
    if (this.isSinging()) {
      this.holdTimer += dt;
      let sing = this.singTime * stepSec;
      if (this.animName.endsWith('miss')) sing *= 2;
      const stop = this.type === 'bf' ? !holdingNote : true;
      if (this.holdTimer > sing && stop) {
        this.holdTimer = 0;
        const end = this.animName.replace(/-hold$/, '') + '-end';
        if (this.anims[end]) this.play(end); else this.dance(true);
      }
    } else this.holdTimer = 0;
    if (this.finished && (this.animName.endsWith('-end') && !this.animName.startsWith('idle') && !this.animName.startsWith('dance'))) this.dance(true);
  }
  onStep(step) { if (this.danceEvery > 0 && step % Math.round(this.danceEvery * 4) === 0) this.dance(false); }
  draw(ctx, cam) {
    // per-animation flip from the data (some sheets mirror an anim)
    const f = this.cur && this.cur.flip;
    if (f) this.flipX = !this.flipX;
    super.draw(ctx, cam);
    if (f) this.flipX = !this.flipX;
  }
};

// ------------------------------------------------------------------ Stage
G.Stage = class {
  constructor(id) {
    this.id = id;
    const d = this.data = G.A.json('preload/data/stages/' + id + '.json') || { props: [], characters: {}, cameraZoom: 1 };
    this.zoom = d.cameraZoom || 1;
    this.dir = d.directory || 'shared';
    this.props = []; this.boppers = [];
    for (const p of d.props || []) {
      const spr = new G.Sprite(0, 0);
      const solid = (p.assetPath || '').startsWith('#');
      const animated = p.animations && p.animations.length > 0;
      const sc = Array.isArray(p.scale) ? p.scale : [p.scale != null ? p.scale : 1, p.scale != null ? p.scale : 1];
      if (solid) spr.makeSolid(sc[0], sc[1], p.assetPath);
      else {
        const base = G.A.imagePath(p.assetPath, this.dir);
        if (animated && p.animType === 'animateatlas') spr.loadAtlas(base);
        else if (animated || G.A.text(base + '.xml')) spr.loadSparrow(base);
        else spr.loadImage(base + '.png');
        spr.scale.x = sc[0]; spr.scale.y = sc[1];
      }
      spr.updateHitbox();
      spr.x = p.position[0]; spr.y = p.position[1];
      spr.alpha = p.alpha != null ? p.alpha : 1;
      spr.antialias = !p.isPixel;
      spr.scroll.x = p.scroll ? p.scroll[0] : 1; spr.scroll.y = p.scroll ? p.scroll[1] : 1;
      spr.angle = p.angle || 0; spr.zIndex = p.zIndex || 0;
      spr.flipX = !!p.flipX; spr.flipY = !!p.flipY;
      if (p.blend) spr.blend = { add: 'lighter', multiply: 'multiply', screen: 'screen', overlay: 'overlay', lighten: 'lighten', darken: 'darken' }[String(p.blend).toLowerCase()] || null;
      spr.name = p.name;
      if (animated) {
        spr.useAnimOffsets = true;
        addAnims(spr, p.animations);
        spr.danceEvery = p.danceEvery || 0;
        if (p.startingAnimation) spr.play(p.startingAnimation);
        else if (spr.danceEvery > 0) bopperDance(spr, true);
        this.boppers.push(spr);
      }
      this.props.push(spr);
    }
    this.chars = {}; this.extras = [];
  }
  // extra sprites that belong to a character (Nene's A-Bot speaker...), drawn in zIndex order with the stage
  addExtra(spr, owner) { spr.owner = owner; this.extras.push(spr); }
  // add a character at its stage slot (bf/dad/gf)
  addCharacter(ch, slot) {
    const cd = (this.data.characters || {})[slot] || { position: [0, 0], zIndex: 0, cameraOffsets: [0, 0] };
    const dataFlip = !!ch.data.flipX;
    ch.flipX = slot === 'bf' ? !dataFlip : dataFlip;
    ch.type = slot;
    ch.zIndex = cd.zIndex || 0;
    ch.place(cd.position || [0, 0], cd.scale);
    const co = cd.cameraOffsets || [0, 0];
    ch.camFocus.x += co[0]; ch.camFocus.y += co[1];
    this.chars[slot] = ch;
    if (ch.script && ch.script.attach) ch.script.attach(ch, this);
  }
  ordered() {
    const all = this.props.slice();
    for (const k in this.chars) if (this.chars[k]) all.push(this.chars[k]);
    for (const e of this.extras) if (!e.owner || Object.values(this.chars).includes(e.owner)) all.push(e);
    return all.sort((a, b) => a.zIndex - b.zIndex);
  }
  update(dt) { for (const p of this.props) p.update(dt); }
  onStep(step) { for (const b of this.boppers) if (b.danceEvery > 0 && step % Math.round(b.danceEvery * 4) === 0) bopperDance(b, false); }
  draw(ctx, cam) { for (const s of this.ordered()) s.draw(ctx, cam); }
};
