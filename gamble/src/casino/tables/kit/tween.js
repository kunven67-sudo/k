// Frame-driven tweens and waits for table choreography. Everything a table animates goes through
// one Tweens instance updated from the station's idleUpdate, so game flows can be written as
// plain async code:   await tw.wait(0.4); await tw.to(1.2, (k) => …, ease.inOut);
// Time can be scaled (dealer speed / dev fast-forward) and a disposed table simply stops.

export const ease = {
  linear: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  outCubic: (x) => 1 - (1 - x) ** 3,
  inCubic: (x) => x * x * x,
  /** Overshoot then settle (anticipation/settle feel). */
  outBack: (x, k = 1.4) => 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2,
  smooth: (x) => x * x * (3 - 2 * x),
};

export class Tweens {
  constructor() {
    this.list = [];
    this.scale = 1;
    this.time = 0;
    this.dead = false;
  }

  /** Run fn(k, rawT) for `dur` seconds (k eased 0..1). Resolves when done. */
  to(dur, fn, e = ease.inOut) {
    if (this.dead) return new Promise(() => {});
    return new Promise((resolve) => {
      const tw = { t: 0, dur: Math.max(1e-4, dur), fn, e, resolve };
      this.list.push(tw);
      fn(0, 0);
    });
  }

  wait(sec) {
    return this.to(sec, () => {}, ease.linear);
  }

  /** Resolve when pred() becomes true (checked every frame). */
  until(pred) {
    if (this.dead) return new Promise(() => {});
    return new Promise((resolve) => {
      if (pred()) return resolve();
      this.list.push({ pred, resolve });
    });
  }

  update(dt) {
    if (this.dead) return;
    const d = dt * this.scale;
    this.time += d;
    const done = [];
    for (let i = 0; i < this.list.length; i++) {
      const tw = this.list[i];
      if (tw.pred) {
        if (tw.pred()) done.push(tw);
        continue;
      }
      tw.t += d;
      const u = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(u), u);
      if (u >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((tw) => !done.includes(tw));
      for (const tw of done) tw.resolve();
    }
  }

  dispose() {
    this.dead = true;
    this.list = [];
  }
}

/** Quadratic bezier point a→b with a lift of `h` at the middle (writes into out). */
export function arc(out, a, b, k, h) {
  out.lerpVectors(a, b, k);
  out.y += 4 * h * k * (1 - k);
  return out;
}
