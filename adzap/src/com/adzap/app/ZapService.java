package com.adzap.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Path;
import android.graphics.Rect;
import android.hardware.HardwareBuffer;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import java.util.ArrayDeque;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Watches the screen: presses Watch Ad, hides + mutes the ad, taps its X, and shuts the Play Store pop-up it opens. */
public class ZapService extends AccessibilityService {
  static volatile boolean running;

  private static final int MAX_NODES = 2500;
  private static final String STORE = "com.android.vending";
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private SharedPreferences prefs;
  private AudioManager audio;
  private boolean adScreen, queued, shotBusy;
  private String lastPkg = "";
  private long lastScan, lastZap, lastWatch, lastShot, lastBack, adStart, adEnd;
  private String lastZapKey = "";
  private int sw, sh;
  private float density;
  private final HashMap<String, Boolean> activities = new HashMap<>();
  private volatile String lastLogged = "";
  private View cover;

  private final Runnable scanTask = new Runnable() {
    @Override public void run() { queued = false; scan(); }
  };
  // Inside an ad the X often shows up after a countdown without telling anyone, so keep looking.
  private final Runnable adPoll = new Runnable() {
    @Override public void run() {
      if (!adScreen || !running) return;
      scan();
      // never leave the phone muted or covered if an ad somehow never ends
      if (SystemClock.uptimeMillis() - adStart > 150_000) { log("Ad took over 2.5 min: stopped hiding it"); setAd(false); return; }
      handler.postDelayed(this, 500);
    }
  };
  private final Runnable back = new Runnable() {
    @Override public void run() { performGlobalAction(GLOBAL_ACTION_BACK); }
  };

  @Override protected void onServiceConnected() {
    running = true;
    prefs = getSharedPreferences("zap", Context.MODE_PRIVATE);
    audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
    mute(false); // in case AD ZAP was stopped in the middle of an ad
    readScreen();
  }

  @Override public void onDestroy() {
    running = false;
    handler.removeCallbacksAndMessages(null);
    mute(false);
    hideCover();
    worker.shutdownNow();
    super.onDestroy();
  }

  @Override public void onInterrupt() {}

  private boolean on(String key) { return prefs != null && prefs.getBoolean(key, true); }

  private void readScreen() {
    DisplayMetrics m = new DisplayMetrics();
    WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    wm.getDefaultDisplay().getRealMetrics(m);
    sw = m.widthPixels; sh = m.heightPixels; density = m.density;
  }

  private void mute(boolean want) {
    if (audio == null || prefs == null) return;
    boolean ours = prefs.getBoolean("mutedByUs", false);
    try {
      if (want && !ours && on("mute") && !audio.isStreamMute(AudioManager.STREAM_MUSIC)) {
        audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0);
        prefs.edit().putBoolean("mutedByUs", true).apply();
        log("Muted the ad");
      } else if (!want && ours) {
        audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, 0);
        prefs.edit().putBoolean("mutedByUs", false).apply();
      }
    } catch (RuntimeException e) {
      log("Couldn't change the sound: " + e.getClass().getSimpleName());
    }
  }

  private void setAd(boolean ad) {
    if (ad == adScreen) return;
    adScreen = ad;
    long now = SystemClock.uptimeMillis();
    handler.removeCallbacks(adPoll);
    if (ad) {
      adStart = now;
      readScreen();
      mute(true);
      showCover();
      handler.postDelayed(adPoll, 300);
    } else {
      adEnd = now;
      mute(false);
      hideCover();
      log("Ad over");
    }
  }

  /** Is this a real app screen (an activity)? Pop-ups and parts inside an ad are not. */
  private boolean isActivity(String pkg, String cls) {
    String k = pkg + "/" + cls;
    Boolean b = activities.get(k);
    if (b == null) {
      try { getPackageManager().getActivityInfo(new ComponentName(pkg, cls), 0); b = true; }
      catch (Exception e) { b = false; }
      activities.put(k, b);
    }
    return b;
  }

  /** A short list of what happened (newest first), shown in the app so ads that get through can be fixed. */
  void log(String s) {
    if (prefs == null || s.equals(lastLogged)) return;
    lastLogged = s;
    String line = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date()) + "  " + s;
    String[] old = prefs.getString("log", "").split("\n");
    StringBuilder b = new StringBuilder(line);
    for (int i = 0; i < old.length && i < 39; i++) if (!old[i].isEmpty()) b.append('\n').append(old[i]);
    prefs.edit().putString("log", b.toString()).apply();
  }

  private static String shortName(String cls) {
    int a = cls.lastIndexOf('.'), b2 = a > 0 ? cls.lastIndexOf('.', a - 1) : -1;
    return b2 >= 0 ? cls.substring(b2 + 1) : cls;
  }

  /**
   * Black cover over the whole ad so you never see it. The top-right corner stays open: that's where the X is,
   * and AD ZAP has to see it. Touches go straight through (it never blocks a tap).
   */
  private void showCover() {
    if (cover != null || !on("hideAds")) return;
    WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    cover = new View(this) {
      final Paint black = new Paint(), big = new Paint(Paint.ANTI_ALIAS_FLAG), small = new Paint(Paint.ANTI_ALIAS_FLAG);
      {
        black.setColor(Color.BLACK);
        big.setColor(0xFF8A8F9C); big.setTextAlign(Paint.Align.CENTER); big.setFakeBoldText(true);
        small.setColor(0xFF5C6170); small.setTextAlign(Paint.Align.CENTER);
      }
      @Override protected void onDraw(Canvas c) {
        int w = getWidth(), h = getHeight(), s = Math.min(w, h);
        // same corner XFinder looks in, a bit bigger so the edges of the X button show too
        int cw = Math.round(Math.max(w * 0.18f, s * 0.3f) * 1.25f), ch = Math.round(Math.max(h * 0.12f, s * 0.22f) * 1.25f);
        c.drawRect(0, 0, w - cw, h, black);
        c.drawRect(w - cw, ch, w, h, black);
        big.setTextSize(s * 0.05f);
        small.setTextSize(s * 0.03f);
        c.drawText("Ad hidden", w / 2f, h / 2f, big);
        c.drawText("AD ZAP closes it as soon as it can", w / 2f, h / 2f + s * 0.06f, small);
      }
    };
    WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT);
    if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    try {
      wm.addView(cover, lp);
      log("Hid the ad");
    } catch (RuntimeException e) {
      cover = null;
      log("Couldn't hide the ad: " + e.getClass().getSimpleName());
    }
  }

  private void hideCover() {
    if (cover == null) return;
    try { ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).removeView(cover); } catch (RuntimeException ignored) {}
    cover = null;
  }

  @Override public void onAccessibilityEvent(AccessibilityEvent e) {
    if (prefs == null) return;
    if (prefs.getBoolean("paused", false)) { setAd(false); return; }
    if (cover != null && !on("hideAds")) hideCover();
    String pkg = e.getPackageName() == null ? "" : e.getPackageName().toString();
    long now = SystemClock.uptimeMillis();

    // The ad opened the Play Store's little install box: shut it. Only right after an ad, never when you open the store.
    if (STORE.equals(pkg)) {
      if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && on("closeStore")
          && (adScreen || now - adEnd < 10_000) && now - lastBack > 1500) {
        lastBack = now;
        handler.postDelayed(back, 350);
        count();
        log("Closed the Play Store box");
      }
      return;
    }
    if (Rules.never(pkg)) return;

    if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      String cls = e.getClassName() == null ? "" : e.getClassName().toString();
      boolean screen = isActivity(pkg, cls);
      if (screen || Rules.isAdClass(cls)) log("Screen: " + shortName(cls));
      if (Rules.isAdClass(cls)) {
        if (!adScreen) log("AD STARTED");
        setAd(true);
      } else if (screen || !pkg.equals(lastPkg)) {
        // only a real app screen (or another app) ends the ad, not a pop-up or a part inside the ad
        setAd(false);
      }
      lastPkg = pkg;
    }
    queueScan();
  }

  private void queueScan() {
    if (queued) return;
    // Outside ads, look less often so the phone doesn't lag or drain.
    long gap = adScreen ? 150 : 500;
    long wait = Math.max(80, lastScan + gap - SystemClock.uptimeMillis());
    queued = true;
    handler.postDelayed(scanTask, wait);
  }

  private void scan() {
    if (prefs == null || prefs.getBoolean("paused", false)) return;
    lastScan = SystemClock.uptimeMillis();
    if (adScreen) readScreen(); // ads often turn the phone sideways
    List<AccessibilityWindowInfo> windows = null;
    try { windows = getWindows(); } catch (RuntimeException ignored) {}
    if (windows != null && !windows.isEmpty()) {
      for (AccessibilityWindowInfo w : windows) {
        if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
        if (scanRoot(w.getRoot())) return;
      }
    } else {
      scanRoot(getRootInActiveWindow());
    }
  }

  /** True when this window got handled (something tapped or a picture check started). */
  private boolean scanRoot(AccessibilityNodeInfo root) {
    if (root == null) return false;
    String pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
    if (Rules.never(pkg)) return false;
    boolean ad = adScreen && pkg.equals(lastPkg);

    List<Rules.Node> nodes = new ArrayList<>();
    List<AccessibilityNodeInfo> infos = new ArrayList<>();
    Rect r = new Rect();
    ArrayDeque<AccessibilityNodeInfo> todo = new ArrayDeque<>();
    todo.add(root);
    int seen = 0;
    while (!todo.isEmpty() && seen++ < MAX_NODES) {
      AccessibilityNodeInfo n = todo.poll();
      if (n == null || !n.isVisibleToUser()) continue;
      for (int i = 0; i < n.getChildCount(); i++) {
        AccessibilityNodeInfo c = n.getChild(i);
        if (c != null) todo.add(c);
      }
      if (!n.isEnabled()) continue;
      n.getBoundsInScreen(r);
      nodes.add(new Rules.Node(str(n.getText()), str(n.getContentDescription()), n.getViewIdResourceName(),
          n.isClickable(), r.left, r.top, r.right, r.bottom));
      infos.add(n);
    }

    int[] d = Rules.decide(nodes, ad, on("autoWatch"), sw, sh, density);
    long now = SystemClock.uptimeMillis();
    switch (d[0]) {
      case Rules.TAP_WATCH:
        if (now - lastWatch < 4000) return true;
        if (press(infos.get(d[1]))) { lastWatch = now; log("Pressed Watch Ad"); }
        return true;
      case Rules.TAP_RESUME:
        log("Pressed Resume (kept your reward)");
        return press(infos.get(d[1]));
      case Rules.TAP_CLOSE:
        return zap(infos.get(d[1]), pkg);
      case Rules.LOOK_FOR_X:
        AccessibilityNodeInfo corner = d[1] >= 0 ? infos.get(d[1]) : null;
        if (on("seeX") && Build.VERSION.SDK_INT >= 30) { lookForX(); return true; }
        return corner != null && zap(corner, pkg);
      default:
        return false;
    }
  }

  private static String str(CharSequence cs) { return cs == null ? "" : cs.toString(); }

  private void count() { prefs.edit().putInt("count", prefs.getInt("count", 0) + 1).apply(); }

  /** Press a normal button (Watch Ad, Resume). */
  private boolean press(AccessibilityNodeInfo node) {
    AccessibilityNodeInfo t = node;
    for (int up = 0; t != null && !t.isClickable() && up < 3; up++) t = t.getParent();
    if (t != null && t.isClickable() && t.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
    Rect r = new Rect();
    node.getBoundsInScreen(r);
    return Rules.smallEnough(r.left, r.top, r.right, r.bottom, sw, sh) && tap(r.exactCenterX(), r.exactCenterY());
  }

  private boolean zap(AccessibilityNodeInfo node, String pkg) {
    Rect r = new Rect();
    node.getBoundsInScreen(r);
    String key = pkg + r.toShortString();
    long now = SystemClock.uptimeMillis();
    if (now - lastZap < 600) return false;
    if (key.equals(lastZapKey) && now - lastZap < 2000) return false;

    // Tap the button itself, or a small parent that holds it. Never a big parent: that's the ad, and it would open.
    AccessibilityNodeInfo target = node;
    Rect pr = new Rect();
    for (int up = 0; target != null && !target.isClickable() && up < 4; up++) target = target.getParent();
    boolean done = false;
    if (target != null && target.isClickable()) {
      target.getBoundsInScreen(pr);
      if (Rules.smallEnough(pr.left, pr.top, pr.right, pr.bottom, sw, sh)) {
        done = target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
      }
    }
    if (!done && Rules.smallEnough(r.left, r.top, r.right, r.bottom, sw, sh)) done = tap(r.exactCenterX(), r.exactCenterY());
    if (!done) return false;
    lastZap = now;
    lastZapKey = key;
    count();
    log("Tapped \"" + (str(node.getText()) + str(node.getContentDescription())).trim() + "\"");
    return true;
  }

  private boolean tap(float x, float y) {
    if (x < 0 || y < 0) return false;
    Path p = new Path();
    p.moveTo(x, y);
    GestureDescription g = new GestureDescription.Builder()
        .addStroke(new GestureDescription.StrokeDescription(p, 0, 50)).build();
    return dispatchGesture(g, null, null);
  }

  /** The ad's X (or skip) is only a picture: look at the screen itself and find its shape. */
  private void lookForX() {
    long now = SystemClock.uptimeMillis();
    if (Build.VERSION.SDK_INT < 30 || shotBusy || now - lastShot < 800 || now - lastZap < 1200) return;
    shotBusy = true;
    lastShot = now;
    try {
      takeScreenshot(Display.DEFAULT_DISPLAY, worker, new TakeScreenshotCallback() {
        @Override public void onSuccess(ScreenshotResult res) {
          int[] hit = null;
          int bw = 1, bh = 1;
          HardwareBuffer hb = res.getHardwareBuffer();
          try {
            Bitmap hw = Bitmap.wrapHardwareBuffer(hb, res.getColorSpace());
            if (hw != null) {
              Bitmap soft = hw.copy(Bitmap.Config.ARGB_8888, false);
              hw.recycle();
              if (soft != null) {
                bw = soft.getWidth(); bh = soft.getHeight();
                hit = findX(soft);
                soft.recycle();
              }
            }
          } catch (RuntimeException ex) {
            log("Couldn't read the screen: " + ex.getClass().getSimpleName());
          } finally {
            hb.close();
          }
          final int[] h = hit;
          final float fx = h == null ? 0 : h[0] * (float) sw / bw, fy = h == null ? 0 : h[1] * (float) sh / bh;
          handler.post(new Runnable() {
            @Override public void run() {
              shotBusy = false;
              if (h == null) { log("Looked for X: none yet"); return; }
              if (!adScreen) return;
              long t = SystemClock.uptimeMillis();
              String key = "x" + Math.round(fx) + "," + Math.round(fy);
              if (key.equals(lastZapKey) && t - lastZap < 2000) return;
              if (tap(fx, fy)) { lastZap = t; lastZapKey = key; count(); log("Tapped the X/skip picture at " + Math.round(fx) + "," + Math.round(fy)); }
            }
          });
        }
        @Override public void onFailure(final int code) {
          handler.post(new Runnable() { @Override public void run() { shotBusy = false; log("Screen look failed (code " + code + ")"); } });
        }
      });
    } catch (RuntimeException e) {
      shotBusy = false;
    }
  }

  /** Grey copy of the top strip only (that's where X buttons live), half size on big screens. */
  private static int[] findX(Bitmap bm) {
    int w = bm.getWidth(), h = bm.getHeight(), shortSide = Math.min(w, h);
    int step = Math.max(1, shortSide / 540);
    int gw = w / step, gh = Math.min(h / step, (int) Math.max(h * 0.12f, shortSide * 0.22f) / step + 1);
    int[] row = new int[w], g = new int[gw * gh], sat = new int[gw * gh];
    for (int y = 0; y < gh; y++) {
      bm.getPixels(row, 0, w, 0, Math.min(h - 1, y * step), w, 1);
      for (int x = 0; x < gw; x++) {
        int c = row[x * step];
        g[y * gw + x] = XFinder.grey(c);
        sat[y * gw + x] = XFinder.sat(c);
      }
    }
    // an X first; no X = a round grey skip/close button (like the skip-to-end one)
    int[] hit = XFinder.find(g, gw, gh, shortSide / step);
    if (hit == null) hit = XFinder.findBadge(g, sat, gw, gh, shortSide / step);
    return hit == null ? null : new int[] {hit[0] * step, hit[1] * step};
  }
}
