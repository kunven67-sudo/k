// Stickmen: a real walking rig (feet planted on the ground, knees bend, arms swing, hips bob) + a ragdoll for
// falling / being thrown / being blown up. No faces. When they die they just vanish (light motes, no body, no blood).
import { clamp, lerp, rand, pick } from './util.js';

// joint indices
export const J = { head: 0, neck: 1, pelvis: 2, elbL: 3, handL: 4, elbR: 5, handR: 6, kneeL: 7, footL: 8, kneeR: 9, footR: 10 };
const BONES = [[1, 0, 'neck'], [1, 2, 'torso'], [1, 3, 'ua'], [3, 4, 'fa'], [1, 5, 'ua'], [5, 6, 'fa'], [2, 7, 'th'], [7, 8, 'sh'], [2, 9, 'th'], [9, 10, 'sh']];
export const COLORS = ['#e8453c', '#f28c28', '#f2c230', '#5cbf4a', '#2fa7a0', '#3d8fe0', '#6a5ae0', '#b35ad8', '#e0559a', '#8b5a3c', '#2b2b2b', '#e9e9e9', '#7fd6f5', '#a4d65e', '#ff9f8a', '#c4a35a', '#4a6b8a', '#d94f70'];

function ik(hx, hy, fx, fy, l1, l2, bendDir) { // two-bone IK: returns knee/elbow point
  let dx = fx - hx, dy = fy - hy; let d = Math.hypot(dx, dy) || 1e-4;
  const maxd = l1 + l2 - 1e-3; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = hx + dx * a / d, my = hy + dy * a / d;
  return [mx - dy / d * h * bendDir, my + dx / d * h * bendDir];
}

export class Stick {
  constructor(o) {
    this.scene = o.scene; this.x = o.x; this.y = o.y; this.h = o.h || 120; this.color = o.color || pick(COLORS);
    this.kid = !!o.kid; this.age = o.age ?? 25; this.name = o.name || ''; this.sex = o.sex || (Math.random() < 0.5 ? 'm' : 'f');
    this.dir = Math.random() < 0.5 ? 1 : -1; this.v = 0; this.phase = Math.random(); this.alive = true; this.vanish = 0;
    this.mode = 'stand'; // stand | ragdoll | getup | held | dead
    this.act = 'idle'; // idle walk run sit sleep dance punch drunk carry cheer talk read flail panic
    this.target = null; this.speedWalk = 1; this.drunk = 0; this.burn = 0; this.frozen = 0; this.fear = 0;
    this.pts = []; for (let i = 0; i < 11; i++) this.pts.push([this.x, this.y]); this.prev = this.pts.map(p => p.slice());
    this.t = rand(0, 100); this.airT = 0; this.vy = 0; this.onBody = null; this.restT = 0; this.getupT = 0;
    this.lookT = 0; this.headTilt = 0; this.punchT = 0; this.talkT = 0; this.layer = 0; this.alpha = 1; this.id = Stick.nextId++;
    this.setSize(this.h); this.ground = this.y; this.pose(0);
    for (let i = 0; i < 11; i++) this.prev[i] = this.pts[i].slice();
  }
  setSize(h) {
    this.h = h; const k = this.kid ? 1.12 : 1; // kids: bigger head for their size
    this.L = { th: h * 0.245, sh: h * 0.245, torso: h * 0.31, ua: h * 0.165, fa: h * 0.16, neck: h * 0.05, head: h * 0.075 * k, w: Math.max(1.6, h * 0.034) };
  }
  get legLen() { return this.L.th + this.L.sh; }
  // ---------- procedural pose (alive + standing) ----------
  pose(dt) {
    const L = this.L, d = this.dir, P = this.pts; this.t += dt;
    const speed = Math.abs(this.v), act = this.act;
    const running = act === 'run' || act === 'panic' || speed > this.h * 1.6;
    const S = this.h * (running ? 1.25 : 0.82) * (this.kid ? 0.9 : 1); // stride length (2 steps)
    if (speed > 1) this.phase = (this.phase + speed * dt / S) % 1; else this.phase = lerp(this.phase, Math.round(this.phase * 2) / 2, Math.min(1, dt * 6));
    const ph = this.phase, moving = speed > 1;
    let lean = moving ? (running ? 0.22 : 0.07) * d : 0;
    let sway = 0;
    if (this.drunk > 0.25) { sway = Math.sin(this.t * 1.7) * 0.18 * this.drunk + Math.sin(this.t * 3.1) * 0.06 * this.drunk; lean += sway; }
    if (act === 'panic') lean += Math.sin(this.t * 14) * 0.05;
    const g = this.ground;
    // pelvis height + bob
    let hipY = g - this.legLen * (moving ? 0.955 : 0.985);
    if (moving) hipY -= Math.cos(ph * Math.PI * 4) * this.h * (running ? 0.022 : 0.012) - this.h * 0.006;
    else hipY += Math.sin(this.t * 1.6) * this.h * 0.003; // breathing
    let hipX = this.x;
    if (act === 'sit') hipY = g - (this.seatH ?? this.legLen * 0.55);
    if (act === 'dance') hipY += Math.abs(Math.sin(this.t * 7)) * this.h * -0.035 + this.h * 0.02, hipX += Math.sin(this.t * 3.5) * this.h * 0.03;
    if (act === 'cheer') hipY += -Math.abs(Math.sin(this.t * 6)) * this.h * 0.05;
    // legs
    const feet = [];
    for (let i = 0; i < 2; i++) {
      let fx, fy;
      if (act === 'sit') { fx = hipX + d * (this.L.th * 0.95) + (i ? 3 : -3); fy = g; }
      else if (moving) {
        const p = (ph + i * 0.5) % 1;
        if (p < 0.5) { fx = hipX + d * S * (0.25 - p); fy = this.groundAt(fx); }
        else { const q = (p - 0.5) * 2; fx = hipX + d * S * (-0.25 + q * 0.5); fy = lerp(this.groundAt(fx), this.groundAt(fx), 0.5) - Math.sin(q * Math.PI) * this.h * (running ? 0.11 : 0.06); }
      } else { fx = hipX + (i ? 1 : -1) * this.h * 0.055 + d * this.h * 0.01; fy = this.groundAt(fx); }
      if (this.drunk > 0.5 && moving) fx += Math.sin(this.t * 5 + i * 2) * this.h * 0.03 * this.drunk;
      feet.push([fx, Math.min(fy, hipY + this.legLen * 0.999 + 40)]);
    }
    const hip = [hipX, hipY];
    // spine
    const nx = hipX + Math.sin(lean) * L.torso, ny = hipY - Math.cos(lean) * L.torso;
    let headA = lean * 1.1 + this.headTilt;
    if (act === 'sleep') headA = 0;
    const hx = nx + Math.sin(headA) * (L.neck + L.head), hy = ny - Math.cos(headA) * (L.neck + L.head);
    P[J.pelvis][0] = hipX; P[J.pelvis][1] = hipY; P[J.neck][0] = nx; P[J.neck][1] = ny; P[J.head][0] = hx; P[J.head][1] = hy;
    const shY = ny + L.torso * 0.06, shX = nx + Math.sin(lean) * -L.torso * 0.06;
    for (let i = 0; i < 2; i++) {
      const knee = ik(hip[0], hip[1], feet[i][0], feet[i][1], L.th, L.sh, -d);
      P[i ? J.kneeR : J.kneeL] = knee; P[i ? J.footR : J.footL] = feet[i];
    }
    // arms
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1; let hand;
      if (act === 'dance') { const a = Math.PI + Math.sin(this.t * 7 + i * Math.PI) * 0.9; hand = [shX + Math.sin(a) * (L.ua + L.fa) * 0.9 * side * 0.6, shY + Math.cos(a) * (L.ua + L.fa) * 0.9]; }
      else if (act === 'cheer' || act === 'panic') { const w = Math.sin(this.t * (act === 'panic' ? 16 : 8) + i * 2) * 0.35; hand = [shX + (side * 0.35 + w) * (L.ua + L.fa), shY - (L.ua + L.fa) * 0.85]; }
      else if (act === 'punch' && i === 1) { const k = this.punchT > 0 ? Math.sin(clamp(1 - this.punchT / 0.3, 0, 1) * Math.PI) : 0; hand = [shX + d * (L.ua + L.fa) * (0.35 + 0.62 * k), shY + L.ua * 0.1]; }
      else if (act === 'carry' || act === 'read' || act === 'eat' || act === 'drink') { hand = [shX + d * L.ua * (act === 'carry' ? 0.95 : 0.6), shY + L.ua * (act === 'carry' ? 0.35 : 0.5) - (act === 'drink' && i === 1 ? L.ua * 0.9 : 0)]; }
      else if (act === 'sit') { hand = [shX + d * L.ua * 0.7, shY + L.ua * 1.15]; }
      else if (act === 'talk') { const w = Math.sin(this.t * 5 + i) * 0.25; hand = [shX + d * L.ua * (0.5 + w), shY + L.ua * (0.95 - w)]; }
      else {
        const sw = moving ? Math.sin((ph + i * 0.5) * Math.PI * 2) * (running ? 0.85 : 0.45) : Math.sin(this.t * 1.3 + i) * 0.03;
        const a = sw * d; const len = L.ua + L.fa * (running ? 0.6 : 0.97);
        hand = [shX + Math.sin(a) * len + side * this.h * 0.012, shY + Math.cos(a) * len];
        if (this.drunk > 0.4) hand[0] += Math.sin(this.t * 2 + i) * this.h * 0.04;
      }
      const elb = ik(shX, shY, hand[0], hand[1], L.ua, L.fa, act === 'punch' ? -d : d * (i ? 1 : 1));
      P[i ? J.elbR : J.elbL] = elb; P[i ? J.handR : J.handL] = hand;
    }
    if (act === 'sleep') this.layFlat();
  }
  layFlat() { // lying down (bed / ground): rotate the standing pose 90 degrees around the feet
    const P = this.pts, cx = this.x, cy = this.ground - this.h * 0.04 - (this.bedH || 0);
    const base = this.standPose(); const a = -Math.PI / 2 * this.dir;
    for (let i = 0; i < 11; i++) { const dx = base[i][0] - this.x, dy = base[i][1] - this.ground; P[i] = [cx + dx * Math.cos(a) - dy * Math.sin(a) - this.dir * this.h * 0.45, cy + dx * Math.sin(a) + dy * Math.cos(a) + (i === J.head ? 0 : 0)]; }
    for (const i of [J.handL, J.handR, J.elbL, J.elbR]) P[i][1] = Math.min(P[i][1], cy);
  }
  standPose() { // a neutral standing pose at x/ground (points copy)
    const L = this.L, g = this.ground, x = this.x;
    const hipY = g - this.legLen * 0.99, ny = hipY - L.torso;
    return [[x, ny - L.neck - L.head], [x, ny], [x, hipY], [x - 2, ny + L.ua * 0.95], [x - 2, ny + L.ua + L.fa * 0.97], [x + 2, ny + L.ua * 0.95], [x + 2, ny + L.ua + L.fa * 0.97],
      [x - this.h * 0.05, hipY + L.th], [x - this.h * 0.055, g], [x + this.h * 0.05, hipY + L.th], [x + this.h * 0.055, g]];
  }
  groundAt(x) { return this.scene.groundAt(x, this.ground - this.h * 0.3, this); }
  // ---------- ragdoll (verlet) ----------
  knock(vx, vy, spin = 0) {
    if (this.mode === 'dead') return;
    if (this.mode !== 'ragdoll' && this.mode !== 'held') { this.prev = this.pts.map(p => p.slice()); }
    this.mode = 'ragdoll'; this.restT = 0; this.act = 'flail';
    const dt = 1 / 60;
    for (let i = 0; i < 11; i++) { const r = i === J.head ? 1.15 : 1; this.prev[i][0] = this.pts[i][0] - (vx * r + rand(-30, 30) + spin * (this.pts[i][1] - this.pts[J.pelvis][1]) * 0.02) * dt; this.prev[i][1] = this.pts[i][1] - (vy * r + rand(-30, 30)) * dt; }
  }
  ragdoll(dt) {
    const P = this.pts, Q = this.prev, g = this.scene.gravity * (this.scene.timeScale ?? 1);
    const ts = this.scene.timeScale ?? 1; const d = dt * ts;
    for (let i = 0; i < 11; i++) {
      if (this.mode === 'held' && i === this.heldJ) continue;
      const p = P[i], q = Q[i]; const vx = (p[0] - q[0]) * 0.995, vy = (p[1] - q[1]) * 0.995;
      q[0] = p[0]; q[1] = p[1]; p[0] += vx; p[1] += vy + g * d * d;
    }
    if (this.mode === 'held') { P[this.heldJ][0] = this.holdX; P[this.heldJ][1] = this.holdY; }
    const L = this.L, len = { neck: L.neck + L.head, torso: L.torso, ua: L.ua, fa: L.fa, th: L.th, sh: L.sh };
    let hitSpeed = 0;
    for (let it = 0; it < 6; it++) {
      for (const [a, b, k] of BONES) {
        const pa = P[a], pb = P[b]; const dx = pb[0] - pa[0], dy = pb[1] - pa[1]; const dd = Math.hypot(dx, dy) || 1e-4; const diff = (dd - len[k]) / dd;
        const wa = (this.mode === 'held' && a === this.heldJ) ? 0 : 0.5, wb = (this.mode === 'held' && b === this.heldJ) ? 0 : 0.5;
        const s = wa + wb || 1; pa[0] += dx * diff * wa / s * (wa && wb ? 1 : 1); pa[1] += dy * diff * wa / s; pb[0] -= dx * diff * wb / s; pb[1] -= dy * diff * wb / s;
      }
      // soft limits: keep head away from pelvis (no folding in half) and knees from crossing too far
      softDist(P[J.head], P[J.pelvis], (L.torso + L.neck) * 0.85);
      softDist(P[J.neck], P[J.footL], L.torso * 0.6); softDist(P[J.neck], P[J.footR], L.torso * 0.6);
      softDist(P[J.pelvis], P[J.footL], L.th * 0.5); softDist(P[J.pelvis], P[J.footR], L.th * 0.5);
      for (let i = 0; i < 11; i++) {
        const p = P[i]; const r = i === J.head ? L.head : L.w;
        const c = this.scene.collidePoint(p[0], p[1], r, this);
        if (c) { const sp = Math.hypot(p[0] - Q[i][0], p[1] - Q[i][1]) / Math.max(1e-3, d); hitSpeed = Math.max(hitSpeed, sp); p[0] = c[0]; p[1] = c[1]; Q[i][0] = lerp(Q[i][0], p[0], 0.35); Q[i][1] = lerp(Q[i][1], p[1], 0.35); }
      }
    }
    if (hitSpeed > this.scene.deadlySpeed && this.mode === 'ragdoll' && this.alive) this.hurt(hitSpeed / this.scene.deadlySpeed - 0.6, 'fall');
    // resting? then get up
    let mv = 0; for (let i = 0; i < 11; i++) mv = Math.max(mv, Math.hypot(P[i][0] - Q[i][0], P[i][1] - Q[i][1]));
    if (this.mode === 'ragdoll') {
      if (mv < this.h * 0.004) this.restT += dt; else this.restT = 0;
      if (this.restT > 1.1 && this.alive && this.frozen < 0.5) this.startGetup();
    }
    this.x = P[J.pelvis][0];
  }
  startGetup() {
    this.mode = 'getup'; this.getupT = 0; this.from = this.pts.map(p => p.slice());
    const pel = this.pts[J.pelvis]; this.x = pel[0];
    this.ground = this.scene.groundAt(this.x, pel[1] - this.h * 0.2, this);
    this.dir = this.pts[J.head][0] > pel[0] ? 1 : -1; this.act = 'idle'; this.v = 0;
  }
  hold(j, x, y) { if (this.mode === 'dead') return; if (this.mode !== 'ragdoll') this.prev = this.pts.map(p => p.slice()); this.mode = 'held'; this.heldJ = j; this.holdX = x; this.holdY = y; this.act = 'flail'; }
  release(vx, vy) { if (this.mode !== 'held') return; this.mode = 'ragdoll'; this.restT = 0; const p = this.prev[this.heldJ]; p[0] = this.holdX - vx / 60; p[1] = this.holdY - vy / 60; }
  nearestJoint(x, y) { let bi = -1, bd = 1e9; for (let i = 0; i < 11; i++) { const d = Math.hypot(this.pts[i][0] - x, this.pts[i][1] - y); if (d < bd) { bd = d; bi = i; } } return [bi, bd]; }
  bounds() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of this.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1 }; }
  center() { const p = this.pts[J.neck], q = this.pts[J.pelvis]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }
  // ---------- life ----------
  hurt(amount, cause) { if (!this.alive) return; this.hp = (this.hp ?? 1) - amount; if (this.hp <= 0) this.die(cause); }
  die(cause) {
    if (!this.alive) return; this.alive = false; this.cause = cause; this.vanish = 0.0001;
    if (this.mode !== 'ragdoll' && this.mode !== 'held') this.knock(rand(-20, 20), -40);
    if (this.scene.onDeath) this.scene.onDeath(this, cause);
  }
  update(dt) {
    if (this.vanish > 0) { // fading out into light: no body is ever left behind
      this.vanish += dt / 1.1;
      if (this.mode === 'ragdoll' || this.mode === 'held') this.ragdoll(dt);
      if (this.vanish >= 1) { this.gone = true; }
      return;
    }
    if (this.frozen > 0.5 && this.mode !== 'ragdoll' && this.mode !== 'held') return; // frozen solid
    if (this.mode === 'ragdoll' || this.mode === 'held') { this.ragdoll(dt); return; }
    if (this.mode === 'getup') {
      this.getupT += dt / 0.7; const k = Math.min(1, this.getupT); const s = k * k * (3 - 2 * k);
      const to = this.standPose();
      for (let i = 0; i < 11; i++) { this.pts[i][0] = lerp(this.from[i][0], to[i][0], s); this.pts[i][1] = lerp(this.from[i][1], to[i][1], s); }
      if (k >= 1) { this.mode = 'stand'; this.prev = this.pts.map(p => p.slice()); }
      return;
    }
    // standing / walking: move x toward target, keep feet on whatever is below
    const ts = this.scene.timeScale ?? 1; const d = dt * ts;
    if (this.punchT > 0) this.punchT -= d;
    let want = 0;
    if (this.target !== null && this.target !== undefined) {
      const dx = this.target - this.x;
      if (Math.abs(dx) > this.h * 0.08) { this.dir = Math.sign(dx); want = this.dir * this.h * (this.act === 'run' || this.act === 'panic' ? 2.6 : 0.85) * this.speedWalk * (this.kid ? 1.1 : 1) * (this.drunk > 0.5 ? 0.7 : 1) * (this.scene.walkMul || 1); }
      else { this.target = null; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(this); } }
    }
    this.v = lerp(this.v, want, Math.min(1, d * 6));
    const nx = this.x + this.v * d;
    const g = this.scene.groundAt(nx, this.ground - this.h * 0.35, this);
    if (g > this.ground + this.h * 0.6) { // edge: walk off and fall
      this.x = nx; this.knock(this.v, 0); return;
    }
    if (g < this.ground - this.h * 0.32) { this.v = 0; this.target = null; this.dir *= -1; } // wall / too high: turn around
    else { this.x = nx; this.ground = lerp(this.ground, g, Math.min(1, d * 18)); }
    if (this.scene.clampX) { const c = this.scene.clampX(this.x, this); if (c !== this.x) { this.x = c; this.dir *= -1; this.target = null; } }
    if (this.drunk > 0.85 && Math.random() < d * 0.15 * this.drunk) { this.knock(this.v * 0.5 + this.dir * 40, -30); return; }
    this.pose(d);
  }
  // ---------- drawing ----------
  draw(ctx, light = 1) {
    const P = this.pts, L = this.L; const a = this.vanish > 0 ? Math.max(0, 1 - this.vanish) : this.alpha;
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let col = this.color; if (this.frozen > 0.3) col = mix(col, '#bfe8ff', this.frozen * 0.75); if (this.burnLook > 0) col = mix(col, '#1c1410', clamp(this.burnLook, 0, 0.85));
    if (this.vanish > 0) col = mix(col, '#ffffff', Math.min(1, this.vanish * 1.6));
    const back = mix(col, '#000000', 0.22), edge = 'rgba(0,0,0,0.35)';
    const w = L.w;
    const seg = (i, j) => { ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); };
    // far side limbs (darker), then body, then near side
    const far = this.dir > 0 ? [J.elbL, J.handL, J.kneeL, J.footL] : [J.elbR, J.handR, J.kneeR, J.footR];
    const farArm = this.dir > 0 ? [[1, J.elbL], [J.elbL, J.handL]] : [[1, J.elbR], [J.elbR, J.handR]];
    const farLeg = this.dir > 0 ? [[2, J.kneeL], [J.kneeL, J.footL]] : [[2, J.kneeR], [J.kneeR, J.footR]];
    const nearArm = this.dir > 0 ? [[1, J.elbR], [J.elbR, J.handR]] : [[1, J.elbL], [J.elbL, J.handL]];
    const nearLeg = this.dir > 0 ? [[2, J.kneeR], [J.kneeR, J.footR]] : [[2, J.kneeL], [J.kneeL, J.footL]];
    const stroke = (pairs, c, ww) => { ctx.beginPath(); for (const [i, j] of pairs) seg(i, j); ctx.strokeStyle = edge; ctx.lineWidth = ww + 1.6; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = ww; ctx.stroke(); };
    stroke(farArm.concat(farLeg), back, w);
    stroke([[1, 2]], col, w * 1.15);
    stroke(nearLeg.concat(nearArm), col, w);
    // head (no face)
    const hx = P[0][0], hy = P[0][1], r = L.head;
    ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(hx, hy, r + 0.9, 0, Math.PI * 2); ctx.fill();
    const gr = ctx.createRadialGradient(hx - r * 0.35, hy - r * 0.4, r * 0.1, hx, hy, r);
    gr.addColorStop(0, mix(col, '#ffffff', 0.28)); gr.addColorStop(1, col); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
Stick.nextId = 1;
function softDist(a, b, min) { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-4; if (d < min) { const k = (min - d) / d * 0.25; a[0] -= dx * k; a[1] -= dy * k; b[0] += dx * k; b[1] += dy * k; } }
const mixCache = new Map();
export function mix(c1, c2, t) {
  const key = c1 + c2 + (t * 50 | 0); if (mixCache.has(key)) return mixCache.get(key);
  const p = (c) => { if (c.startsWith('rgb')) return c.match(/\d+/g).map(Number); const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const a = p(c1), b = p(c2); const r = `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  if (mixCache.size > 4000) mixCache.clear(); mixCache.set(key, r); return r;
}
