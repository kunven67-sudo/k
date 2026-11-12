package com.adzap.app;

/**
 * Finds a close "X" drawn in a top corner of a screenshot, for ads whose X is only a picture (nothing to read).
 * Works on a grey picture (0..255 per pixel). No Android code, so it can be tested anywhere.
 *
 * An X here = a small square where both diagonals are one colour (the lines), the straight up/down/left/right arms
 * around the middle are another, even colour (the background between the lines), and the lines stop at the corners.
 */
final class XFinder {
  private XFinder() {}

  /** Right corner first: almost every ad puts its X there. Left corners are skipped on purpose: that's where the speaker button lives. */
  static int[] find(int[] g, int w, int h, int shortSide) {
    int minS = Math.max(12, shortSide * 22 / 1000), maxS = Math.max(minS + 4, shortSide * 8 / 100);
    int regionH = Math.min(h, (int) Math.max(h * 0.12f, shortSide * 0.22f));
    int regionW = Math.min(w, (int) Math.max(w * 0.18f, shortSide * 0.3f));
    int x0Min = w - regionW;
    float best = 0;
    int[] hit = null;
    for (int s = minS; s <= maxS; s += Math.max(2, s / 8)) {
      int stride = Math.max(1, s / 12);
      for (int y = 1; y + s < regionH; y += stride) {
        for (int x = x0Min; x + s < w - 1; x += stride) {
          float sc = score(g, w, h, x, y, s);
          if (sc > best) { best = sc; hit = new int[] {x + s / 2, y + s / 2, s}; }
        }
      }
    }
    return hit;
  }

  private static int px(int[] g, int w, int h, int x, int y) {
    if (x < 0) x = 0; else if (x >= w) x = w - 1;
    if (y < 0) y = 0; else if (y >= h) y = h - 1;
    return g[y * w + x];
  }

  /** The pixel in the 3x3 around (x, y) that is closest to `want`: line strokes are thin and land between samples. */
  private static int near(int[] g, int w, int h, int x, int y, int want) {
    int bestV = px(g, w, h, x, y), bestD = Math.abs(bestV - want);
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      int v = px(g, w, h, x + dx, y + dy), d = Math.abs(v - want);
      if (d < bestD) { bestD = d; bestV = v; }
    }
    return bestV;
  }

  static float score(int[] g, int w, int h, int x0, int y0, int s) {
    int cx = x0 + s / 2, cy = y0 + s / 2;
    // quick no: the middle has to stand out from the gaps around it (skips almost every spot cheaply)
    int c0 = px(g, w, h, cx, cy), arm = Math.round(0.24f * s);
    if (Math.abs(c0 - px(g, w, h, cx, y0 + arm)) < 40 && Math.abs(c0 - px(g, w, h, x0 + arm, cy)) < 40) return 0;
    // background: the gaps between the X's arms (straight up, down, left and right of the middle)
    int[] bg = new int[12];
    float[] ts = {0.16f, 0.24f, 0.32f};
    int k = 0, sum = 0;
    for (float t : ts) {
      int a = Math.round(t * s), b = Math.round((1 - t) * s);
      bg[k++] = px(g, w, h, cx, y0 + a); bg[k++] = px(g, w, h, cx, y0 + b);
      bg[k++] = px(g, w, h, x0 + a, cy); bg[k++] = px(g, w, h, x0 + b, cy);
    }
    for (int v : bg) sum += v;
    int bgMean = sum / bg.length;
    // mostly even (an X straight over a video has a busier background, so a few may be off)
    int off = 0;
    for (int v : bg) if (Math.abs(v - bgMean) > 26) off++;
    if (off > 4) return 0;

    // the middle is where both lines cross: it must stand out
    int ink = px(g, w, h, cx, cy), far = Math.abs(ink - bgMean);
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
      int v = px(g, w, h, cx + dx, cy + dy);
      if (Math.abs(v - bgMean) > far) { far = Math.abs(v - bgMean); ink = v; }
    }
    int contrast = Math.abs(ink - bgMean);
    if (contrast < (off == 0 ? 55 : 110)) return 0;
    int tol = Math.max(40, contrast * 2 / 5);
    // every background spot must still be clearly not line colour
    for (int v : bg) if (Math.abs(v - ink) < contrast / 2) return 0;

    // both diagonals must be line colour all the way
    int ok = 0, total = 0;
    for (int i = 1; i <= 9; i++) {
      float t = 0.1f + i * 0.08f;
      if (t > 0.42f && t < 0.58f) continue;
      int a = Math.round(t * s), b = Math.round((1 - t) * s);
      int[][] pts = {{x0 + a, y0 + a}, {x0 + b, y0 + a}};
      for (int[] p : pts) {
        int v = near(g, w, h, p[0], p[1], ink);
        total++;
        if (Math.abs(v - ink) <= tol && Math.abs(v - bgMean) >= contrast / 2) ok++;
      }
    }
    if (ok < total - (s < 18 ? 0 : 1)) return 0; // small shapes must be perfect

    // the lines stop: just past each corner is not line colour (not a crossing in a grid or a pattern)
    int m = Math.max(2, s / 6), stops = 0;
    int[][] outs = {{x0 - m, y0 - m}, {x0 + s + m, y0 - m}, {x0 - m, y0 + s + m}, {x0 + s + m, y0 + s + m}};
    for (int[] p : outs) if (Math.abs(px(g, w, h, p[0], p[1]) - ink) > tol) stops++;
    if (stops < 3) return 0;

    // not a filled shape: halfway between the arms and the lines, near the edge, is background
    int[][] side = {{x0 + s / 2, y0 + 1}, {x0 + s / 2, y0 + s - 1}, {x0 + 1, y0 + s / 2}, {x0 + s - 1, y0 + s / 2}};
    for (int[] p : side) if (Math.abs(px(g, w, h, p[0], p[1]) - bgMean) > tol) return 0;

    // thin lines: the wedges between each line and the arms (22 degrees off the line) are background too
    float r1 = 0.30f * s, r2 = 0.13f * s;
    int[][] wedge = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
    for (int[] q : wedge) {
      int ax = cx + Math.round(q[0] * r1), ay = cy + Math.round(q[1] * r2);
      int bx = cx + Math.round(q[0] * r2), by = cy + Math.round(q[1] * r1);
      if (Math.abs(px(g, w, h, ax, ay) - bgMean) > tol || Math.abs(px(g, w, h, bx, by) - bgMean) > tol) return 0;
    }

    return ok * 10f + contrast / 10f + s / 100f;
  }

  /** ARGB pixels -> grey. */
  static int grey(int argb) {
    int r = (argb >> 16) & 255, gg = (argb >> 8) & 255, b = argb & 255;
    return (r * 299 + gg * 587 + b * 114) / 1000;
  }
}
