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
    "interstitial", "rewardedvideo", "fullscreenad", "adunitactivity",
    // inside an open ad, Google's parts have scrambled names like com.google.android.gms.internal.ads.zzcfo
    "gms.internal.ads", "ads.internal", "admob", ".ads."
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
      case "\u2717": case "\u2718": case "\u274C":
      case "close": case "skip": case "skip video": case "dismiss": case "close button": case "close dialog":
      case "no thanks": case "skip button": case "next": case "next ad": case "skip to next": case "skip to next ad":
      case "skip to end": case "skip forward": case "continue to app": case "close and continue":
      case "omitir": case "saltar": case "cerrar": case "siguiente": case "omitir anuncio": case "cerrar anuncio":
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
    return top && cx > sw * 0.76f; // right only: the top-left button is usually the ad's speaker
  }

  /** Something we may tap: never a big area (that would be the ad, and it would open). */
  static boolean smallEnough(int l, int t, int r, int b, int sw, int sh) {
    long area = (long) Math.max(0, r - l) * Math.max(0, b - t);
    return area > 0 && area <= (long) sw * sh / 6;
  }

  /** "Watch Ad", "Watch an ad", "View ad": the app asking before an ad, not the ad itself. */
  static boolean watchAd(String s) {
    return s.length() <= 30 && s.matches("(watch|view|play|see)( an| a| the)? (ad|ads|video ad|advert|advertisement)( now)?");
  }

  /** The words around a "watch an ad to watch your show" question. */
  static boolean gateText(String s) {
    return s.contains("start watching") || s.contains("continue watching") || s.contains("keep watching")
        || s.contains("ad to watch") || s.contains("ad to start") || s.contains("ad to continue") || s.contains("ad to unlock")
        || s.contains("to unlock this") || s.contains("to watch this") || s.contains("watch an ad to");
  }

  /** "Close video? You will lose your reward": closing now would waste the whole ad. */
  static boolean rewardWarning(String s) {
    return (s.contains("reward") && (s.contains("lose") || s.contains("won t") || s.contains("will not")
        || s.contains("not get") || s.contains("forfeit") || s.contains("miss"))) || s.equals("close video");
  }

  static boolean resume(String s) {
    return s.equals("resume video") || s.equals("resume") || s.equals("keep watching") || s.equals("back to video")
        || s.equals("return to video") || s.equals("continue video") || s.equals("resume ad");
  }

  /** One thing on screen, as AD ZAP sees it. */
  static final class Node {
    final String text, desc, id;
    final boolean clickable;
    final int l, t, r, b;
    Node(String text, String desc, String id, boolean clickable, int l, int t, int r, int b) {
      this.text = text; this.desc = desc; this.id = id; this.clickable = clickable;
      this.l = l; this.t = t; this.r = r; this.b = b;
    }
  }

  static final int TAP_CLOSE = 1, TAP_WATCH = 2, TAP_RESUME = 3, LOOK_FOR_X = 4, LEAVE = 5;

  /** What to do with one window: {action, index of the node to tap (or -1)}. */
  static int[] decide(java.util.List<Node> nodes, boolean adScreen, boolean autoWatch, int sw, int sh, float density) {
    boolean warn = false, gate = false;
    int resumeAt = -1, watchAt = -1;
    for (int i = 0; i < nodes.size(); i++) {
      Node n = nodes.get(i);
      String nt = norm(n.text), nd = norm(n.desc);
      if (rewardWarning(nt) || rewardWarning(nd)) warn = true;
      if (gateText(nt) || gateText(nd)) gate = true;
      if (resumeAt < 0 && (resume(nt) || resume(nd))) resumeAt = i;
      if (watchAt < 0 && (watchAd(nt) || watchAd(nd))) watchAt = i;
    }
    // never throw away a reward: hit Resume
    if (warn && resumeAt >= 0) return new int[] {TAP_RESUME, resumeAt};
    // the app asking "watch an ad?": its "Close Ad" button means "no", so never press that
    if (watchAt >= 0) return gate && autoWatch ? new int[] {TAP_WATCH, watchAt} : new int[] {LEAVE, -1};

    int best = -1, bestScore = NONE;
    for (int i = 0; i < nodes.size(); i++) {
      Node n = nodes.get(i);
      int sc = score(n.text, n.desc, n.id, adScreen, n.clickable, n.l, n.t, n.r, n.b, sw, sh, density);
      if (sc > bestScore) { best = i; bestScore = sc; }
    }
    // an unlabeled corner button is only a guess: let the picture check (real X shape) go first
    if (bestScore >= WEAK) return new int[] {TAP_CLOSE, best};
    if (adScreen) return new int[] {LOOK_FOR_X, bestScore == CORNER ? best : -1};
    return new int[] {LEAVE, -1};
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
