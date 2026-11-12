package com.adzap.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import java.util.ArrayDeque;
import java.util.List;

/** Watches the screen and taps the X / Skip on ads. */
public class ZapService extends AccessibilityService {
  static volatile boolean running;

  private static final int MAX_NODES = 2500;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private SharedPreferences prefs;
  private boolean adScreen;
  private String lastPkg = "";
  private long lastScan, lastZap;
  private String lastZapKey = "";
  private boolean queued;
  private int sw, sh;
  private float density;

  private final Runnable scanTask = new Runnable() {
    @Override public void run() { queued = false; scan(); }
  };
  // Inside an ad the X often pops up after a countdown without telling anyone, so keep looking.
  private final Runnable adPoll = new Runnable() {
    @Override public void run() {
      if (!adScreen || !running) return;
      scan();
      handler.postDelayed(this, 700);
    }
  };

  @Override protected void onServiceConnected() {
    running = true;
    prefs = getSharedPreferences("zap", Context.MODE_PRIVATE);
    readScreen();
  }

  @Override public void onDestroy() {
    running = false;
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  @Override public void onInterrupt() {}

  private void readScreen() {
    DisplayMetrics m = new DisplayMetrics();
    WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    wm.getDefaultDisplay().getRealMetrics(m);
    sw = m.widthPixels; sh = m.heightPixels; density = m.density;
  }

  private boolean paused() { return prefs != null && prefs.getBoolean("paused", false); }

  @Override public void onAccessibilityEvent(AccessibilityEvent e) {
    if (paused()) { adScreen = false; return; }
    String pkg = e.getPackageName() == null ? "" : e.getPackageName().toString();
    if (Rules.never(pkg)) return;

    if (e.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      String cls = e.getClassName() == null ? "" : e.getClassName().toString();
      boolean was = adScreen;
      if (Rules.isAdClass(cls)) adScreen = true;
      else if (Rules.looksLikeScreen(cls) || !pkg.equals(lastPkg)) adScreen = false;
      lastPkg = pkg;
      if (adScreen && !was) { readScreen(); handler.removeCallbacks(adPoll); handler.postDelayed(adPoll, 300); }
    }
    queueScan();
  }

  private void queueScan() {
    if (queued) return;
    // Outside ads, look less often so the phone doesn't lag or drain.
    long gap = adScreen ? 150 : 600;
    long wait = Math.max(80, lastScan + gap - SystemClock.uptimeMillis());
    queued = true;
    handler.postDelayed(scanTask, wait);
  }

  private void scan() {
    if (paused()) return;
    lastScan = SystemClock.uptimeMillis();
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

  private boolean scanRoot(AccessibilityNodeInfo root) {
    if (root == null) return false;
    String pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
    if (Rules.never(pkg)) return false;
    boolean ad = adScreen && pkg.equals(lastPkg);

    AccessibilityNodeInfo best = null;
    int bestScore = Rules.NONE;
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
      int s = Rules.score(str(n.getText()), str(n.getContentDescription()), n.getViewIdResourceName(), ad,
          n.isClickable(), r.left, r.top, r.right, r.bottom, sw, sh, density);
      if (s > bestScore) { best = n; bestScore = s; if (s == Rules.STRONG) break; }
    }
    return best != null && zap(best, pkg);
  }

  private static String str(CharSequence cs) { return cs == null ? "" : cs.toString(); }

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
    prefs.edit().putInt("count", prefs.getInt("count", 0) + 1).apply();
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
}
