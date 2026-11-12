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
    is(Rules.isAdClass("com.google.android.gms.internal.ads.zzcfo"), true, "Google's scrambled ad parts");
    is(Rules.isAdClass("com.example.anime.DownloadsActivity"), false, "'downloads' is not an ad");
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
    is(score("", "", null, true, true, 20, 50, 100, 130) == Rules.NONE, true, "top-left = speaker, not X");
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

    // their anime app: "Watch an ad to start watching" [Close Ad] [Watch Ad] -> press Watch Ad, never Close Ad
    java.util.List<Rules.Node> gate = new java.util.ArrayList<>();
    gate.add(new Rules.Node("Episode 21 DUB", "", null, false, 200, 50, 1000, 120));
    gate.add(new Rules.Node("Start watching", "", null, false, 1200, 470, 1500, 540));
    gate.add(new Rules.Node("Watch an ad to start watching", "", null, false, 1100, 540, 1600, 590));
    gate.add(new Rules.Node("Close Ad", "", null, true, 900, 630, 1360, 730));
    gate.add(new Rules.Node("Watch Ad", "", null, true, 1390, 630, 1850, 730));
    int[] d = Rules.decide(gate, false, true, 2640, 1080, 2.75f);
    is(d[0] == Rules.TAP_WATCH && d[1] == 4, true, "gate -> Watch Ad");
    d = Rules.decide(gate, false, false, 2640, 1080, 2.75f);
    is(d[0] == Rules.LEAVE, true, "gate with auto-watch off -> leave it");
    // a "watch ad for coins?" box without show words: leave it alone (never press Close Ad there)
    java.util.List<Rules.Node> coins = new java.util.ArrayList<>();
    coins.add(new Rules.Node("Double your coins!", "", null, false, 300, 500, 800, 560));
    coins.add(new Rules.Node("Close ad", "", null, true, 300, 600, 500, 680));
    coins.add(new Rules.Node("Watch ad", "", null, true, 600, 600, 800, 680));
    is(Rules.decide(coins, false, true, 1080, 2400, 2.75f)[0] == Rules.LEAVE, true, "coins box left alone");
    // rewarded ad: "Close video? You will lose your reward" [CLOSE VIDEO] [RESUME VIDEO] -> Resume
    java.util.List<Rules.Node> warn = new java.util.ArrayList<>();
    warn.add(new Rules.Node("Close video?", "", null, false, 300, 900, 800, 960));
    warn.add(new Rules.Node("You will lose your reward", "", null, false, 300, 980, 900, 1030));
    warn.add(new Rules.Node("CLOSE VIDEO", "", null, true, 300, 1100, 550, 1180));
    warn.add(new Rules.Node("RESUME VIDEO", "", null, true, 600, 1100, 900, 1180));
    d = Rules.decide(warn, true, true, 1080, 2400, 2.75f);
    is(d[0] == Rules.TAP_RESUME && d[1] == 3, true, "keep the reward -> Resume");
    // inside an ad: labeled X wins; unlabeled corner -> check the picture first
    java.util.List<Rules.Node> ad = new java.util.ArrayList<>();
    ad.add(new Rules.Node("Install", "", null, true, 1400, 330, 2200, 420));
    ad.add(new Rules.Node("", "Close", null, true, 2430, 30, 2500, 100));
    d = Rules.decide(ad, true, true, 2640, 1080, 2.75f);
    is(d[0] == Rules.TAP_CLOSE && d[1] == 1, true, "labeled X in ad");
    ad.set(1, new Rules.Node("", "", null, true, 2430, 30, 2500, 100));
    d = Rules.decide(ad, true, true, 2640, 1080, 2.75f);
    is(d[0] == Rules.LOOK_FOR_X && d[1] == 1, true, "unlabeled X -> picture check, corner as backup");
    is(Rules.decide(ad, false, true, 2640, 1080, 2.75f)[0] == Rules.LEAVE, true, "normal screen -> nothing");
    is(score("Close video", "", null, true, true, 300, 1100, 550, 1180) == Rules.NONE, true, "never Close video");

    is(score("", "Skip to next ad", null, true, true, 2540, 30, 2610, 100) == Rules.WEAK, true, "skip to next in ad");
    is(score("Next", "", null, false, true, 900, 2000, 1050, 2100) == Rules.NONE, true, "Next outside ads");

    System.out.println(fails == 0 ? "ALL PASS" : fails + " FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
