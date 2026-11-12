package com.adzap.app;

import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/** Runs XFinder on real screenshots: java -cp build/test com.adzap.app.XFinderTest <png> [expectX expectY | none] ... */
public class XFinderTest {
  public static void main(String[] a) throws Exception {
    int fails = 0;
    for (int i = 0; i < a.length; ) {
      File f = new File(a[i++]);
      boolean none = a[i].equals("none");
      int ex = none ? 0 : Integer.parseInt(a[i]), ey = none ? 0 : Integer.parseInt(a[i + 1]);
      i += none ? 1 : 2;
      BufferedImage im = ImageIO.read(f);
      int W = im.getWidth(), H = im.getHeight(), shortSide = Math.min(W, H);
      int step = Math.max(1, shortSide / 540);   // same as the phone
      int gw = W / step, gh = Math.min(H / step, XFinder.regionH(H / step, shortSide / step) + 2);
      int[] g = new int[gw * gh], sat = new int[gw * gh];
      for (int y = 0; y < gh; y++) for (int x = 0; x < gw; x++) {
        int c = im.getRGB(x * step, Math.min(H - 1, y * step));
        g[y * gw + x] = XFinder.grey(c);
        sat[y * gw + x] = XFinder.sat(c);
      }
      long t0 = System.nanoTime();
      String which = "x";
      int[] hit = XFinder.find(g, gw, gh, shortSide / step);
      if (hit == null) { hit = XFinder.findBadge(g, sat, gw, gh, shortSide / step); which = "round"; } // same order as the phone
      if (hit == null) { hit = XFinder.findSkip(g, gw, gh, shortSide / step); which = "skip"; }
      long ms = (System.nanoTime() - t0) / 1000000;
      String got = hit == null ? "none" : which + " " + (hit[0] * step) + "," + (hit[1] * step) + " size " + (hit[2] * step);
      boolean pass = none ? hit == null
          : hit != null && Math.abs(hit[0] * step - ex) < 30 && Math.abs(hit[1] * step - ey) < 30;
      if (!pass) fails++;
      System.out.println((pass ? "PASS " : "FAIL ") + f.getName() + ": found " + got + " (" + ms + " ms)");
    }
    System.out.println(fails == 0 ? "X PASS" : fails + " X FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
