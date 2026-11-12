package com.adzap.app;

import java.util.Locale;

/** Decides what counts as an ad screen and an ad's close button. No Android code, so it can be tested anywhere. */
final class Rules {
  private Rules() {}

  /** Parts of the class names that ad companies use for their full-screen ads. */
  static final String[] AD_CLASS_HINTS = {
    "com.google.android.gms.ads", "adactivity", "com.unity3d.services.ads", "com.unity3d.ads",
    "com.applovin", "com.facebook.ads", "com.ironsource", "com.vungle", "com.mbridge", "com.bytedance.sdk.openadsdk",
    "com.pangle", "com.inmobi", "com.chartboost", "com.adcolony", "com.fyber", "com.my.target", "com.yandex.mobile.ads",
    "com.startapp", "com.smaato", "com.amazon.device.ads", "com.tapjoy", "com.digitalturbine", "com.mintegral",
    "interstitial", "rewardedvideo", "fullscreenad", "adunitactivity"
  };

  /** Apps AD ZAP never touches. */
  static final String[] NEVER = {
    "com.adzap.app", "com.android.systemui", "com.android.settings", "com.google.android.packageinstaller",
    "com.android.packageinstaller", "com.android.vending", "com.google.android.permissioncontroller"
  };

  static boolean never(String pkg) {
    if (pkg == null || pkg.isEmpty()) return true;
    for (String p : NEVER) if (p.equals(pkg)) return true;
    return pkg.contains("inputmethod") || pkg.contains("keyboard");
  }

  static boolean isAdClass(String cls) {
    if (cls == null) return false;
    String c = cls.toLowerCase(Locale.ROOT);
    for (String h : AD_CLASS_HINTS) if (c.contains(h)) return true;
    return false;
  }

  /** Popups and plain views also send "new screen" events; only a real screen change should end ad mode. */
  static boolean looksLikeScreen(String cls) {
    if (cls == null || cls.isEmpty()) return false;
    return !(cls.startsWith("android.widget.") || cls.startsWith("android.view.") || cls.startsWith("android.webkit.")
        || cls.contains("Dialog") || cls.contains("PopupWindow") || cls.contains("Toast"));
  }

  /** "Skip Ad >" -> "skip ad". Digits stay so "Skip in 5" can be told apart. */
  static String norm(CharSequence cs) {
    if (cs == null) return "";
    String s = cs.toString().toLowerCase(Locale.ROOT);
    s = s.replaceAll("[\\s\\p{Punct}\\u25B6\\u25BA\\u00BB\\u2192\\u203A\\u276F]+", " ");
    return s.trim();
  }

  /** Labels that only ever mean "close this ad": safe to tap in any app. */
  static boolean strongLabel(String s) {
    if (s.isEmpty() || s.length() > 40) return false;
    return s.matches("(skip|close|dismiss|hide)( this)? (ad|ads|advert|advertisement)( button| now)?")
        || s.equals("interstitial close button") || s.equals("close ad button") || s.equals("ad close button");
  }

  /** Labels that mean close/skip, but are only trusted inside a full-screen ad. */
  static boolean weakLabel(String s) {
    if (s.isEmpty() || s.length() > 24) return false;
    if (s.matches(".*\\d.*")) return false; // "Skip in 5" is a countdown, not a button yet
    switch (s) {
      case "x": case "×": case "✕": case "✖": case "╳": case "⨯":
      case "close": case "skip": case "skip video": case "close video": case "dismiss": case "close button":
      case "no thanks": case "skip button": case "cancel":
        return true;
      default:
        return false;
    }
  }

  /** Resource ids like "...:id/close_button" or "...:id/ad_skip". */
  static boolean closeId(String id) {
    if (id == null) return false;
    int slash = id.indexOf(":id/");
    String n = (slash >= 0 ? id.substring(slash + 4) : id).toLowerCase(Locale.ROOT);
    return n.contains("close") || n.contains("skip") || n.contains("dismiss") || n.equals("x") || n.equals("btn_x");
  }

  /**
   * A small, square-ish, unlabeled button in a top corner of a full-screen ad: the classic picture-only X.
   * Never the big ad itself (tapping that opens the ad).
   */
  static boolean cornerIcon(int l, int t, int r, int b, int sw, int sh, float density) {
    int w = r - l, h = b - t;
    if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return false;
    float min = 14 * density, max = Math.max(72 * density, sw * 0.16f);
    if (w < min || h < min || w > max || h > max) return false;
    float ratio = (float) w / h;
    if (ratio < 0.6f || ratio > 1.65f) return false;
    float cx = (l + r) / 2f, cy = (t + b) / 2f;
    boolean top = cy < sh * 0.2f;
    boolean side = cx < sw * 0.24f || cx > sw * 0.76f;
    return top && side;
  }

  /** Something we may tap: never a big area (that would be the ad, and it would open). */
  static boolean smallEnough(int l, int t, int r, int b, int sw, int sh) {
    long area = (long) Math.max(0, r - l) * Math.max(0, b - t);
    return area > 0 && area <= (long) sw * sh / 6;
  }

  static final int NONE = 0, CORNER = 1, WEAK = 2, STRONG = 3;

  /** How sure we are that this node is an ad's close button. */
  static int score(String text, String desc, String id, boolean adScreen, boolean clickable,
                   int l, int t, int r, int b, int sw, int sh, float density) {
    String nt = norm(text), nd = norm(desc);
    if (strongLabel(nt) || strongLabel(nd)) return STRONG;
    if (!adScreen) return NONE;
    if (weakLabel(nt) || weakLabel(nd) || (closeId(id) && nt.isEmpty() && !nd.matches(".*\\d.*"))) return WEAK;
    if (clickable && nt.isEmpty() && nd.isEmpty() && cornerIcon(l, t, r, b, sw, sh, density)) return CORNER;
    return NONE;
  }
}
