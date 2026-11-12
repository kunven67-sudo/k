package com.adzap.app;

/** Plain-Java checks for Rules (no phone needed): java -cp build/test com.adzap.app.RulesTest */
public class RulesTest {
  static int fails;
  static void is(boolean got, boolean want, String what) {
    if (got != want) { fails++; System.out.println("FAIL: " + what + " (got " + got + ")"); }
  }
  static int score(String t, String d, String id, boolean ad, boolean click, int l, int top, int r, int b) {
    return Rules.score(t, d, id, ad, click, l, top, r, b, 1080, 2400, 2.75f);
  }

  public static void main(String[] a) {
    // ad screens
    is(Rules.isAdClass("com.google.android.gms.ads.AdActivity"), true, "AdMob");
    is(Rules.isAdClass("com.unity3d.services.ads.adunit.AdUnitActivity"), true, "Unity");
    is(Rules.isAdClass("com.applovin.adview.AppLovinFullscreenActivity"), true, "AppLovin");
    is(Rules.isAdClass("com.example.anime.PlayerActivity"), false, "anime player is not an ad");
    is(Rules.isAdClass("com.example.anime.LoadingActivity"), false, "'loading' is not 'ad'");
    is(Rules.looksLikeScreen("android.widget.FrameLayout"), false, "frame is not a screen");
    is(Rules.looksLikeScreen("com.example.anime.MainActivity"), true, "activity is a screen");

    // strong = any app
    is(score("Skip Ad", "", null, false, true, 800, 2000, 1050, 2100) == Rules.STRONG, true, "Skip Ad");
    is(score("Skip ads ▶", "", null, false, true, 800, 2000, 1050, 2100) == Rules.STRONG, true, "Skip ads arrow");
    is(score("", "Close ad", null, false, true, 980, 40, 1060, 120) == Rules.STRONG, true, "Close ad desc");
    is(score("", "Interstitial close button", null, false, true, 980, 40, 1060, 120) == Rules.STRONG, true, "AdMob X");
    // normal app buttons are left alone
    is(score("Close", "", null, false, true, 980, 40, 1060, 120) == Rules.NONE, true, "Close outside ads");
    is(score("Skip", "", null, false, true, 800, 2000, 1050, 2100) == Rules.NONE, true, "Skip outside ads (intro skip)");
    is(score("", "", null, false, true, 980, 40, 1060, 120) == Rules.NONE, true, "corner icon outside ads");
    is(score("Skip ad in 5", "", null, false, true, 800, 2000, 1050, 2100) == Rules.NONE, true, "countdown");
    is(score("Add to list", "", null, false, true, 0, 0, 300, 100) == Rules.NONE, true, "'add' is not 'ad'");
    is(score("Download ad-free", "", null, false, true, 0, 0, 300, 100) == Rules.NONE, true, "upsell is not close");

    // inside ad screens
    is(score("×", "", null, true, true, 980, 40, 1060, 120) == Rules.WEAK, true, "x symbol");
    is(score("X", "", null, true, true, 980, 40, 1060, 120) == Rules.WEAK, true, "letter X");
    is(score("Close", "", null, true, true, 980, 40, 1060, 120) == Rules.WEAK, true, "Close in ad");
    is(score("Skip 5", "", null, true, true, 980, 40, 1060, 120) == Rules.NONE, true, "countdown in ad");
    is(score("", "", "com.x:id/close_button", true, true, 980, 40, 1060, 120) == Rules.WEAK, true, "close id");
    is(score("", "", null, true, true, 990, 50, 1070, 130) == Rules.CORNER, true, "unlabeled top-right X");
    is(score("", "", null, true, true, 20, 50, 100, 130) == Rules.CORNER, true, "unlabeled top-left X");
    is(score("", "", null, true, true, 500, 50, 580, 130) == Rules.NONE, true, "middle top is not an X");
    is(score("", "", null, true, true, 990, 1200, 1070, 1280) == Rules.NONE, true, "middle right is not an X");
    is(score("", "", null, true, true, 0, 0, 1080, 2400) == Rules.NONE, true, "the whole ad");
    is(score("", "", null, true, false, 990, 50, 1070, 130) == Rules.NONE, true, "not clickable corner");
    is(score("Install", "", null, true, true, 300, 2000, 780, 2150) == Rules.NONE, true, "Install button");

    // never tap big areas
    is(Rules.smallEnough(0, 0, 1080, 2400, 1080, 2400), false, "full screen too big");
    is(Rules.smallEnough(980, 40, 1060, 120, 1080, 2400), true, "X is small");
    // never touch these apps
    is(Rules.never("com.android.settings"), true, "settings");
    is(Rules.never("com.google.android.inputmethod.latin"), true, "keyboard");
    is(Rules.never("com.adzap.app"), true, "itself");
    is(Rules.never("com.example.anime"), false, "anime app");

    System.out.println(fails == 0 ? "ALL PASS" : fails + " FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
