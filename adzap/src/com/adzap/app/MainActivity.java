package com.adzap.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** The one screen: is it on, how many ads it zapped, and the buttons to turn it on. */
public class MainActivity extends Activity {
  private static final int BG = 0xFF101116, CARD = 0xFF1B1D25, RED = 0xFFE82E3C, GREEN = 0xFF2ECC71, DIM = 0xFF9AA0AE;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private SharedPreferences prefs;
  private TextView status, count, help;
  private Button turnOn, restricted, pause;

  private final Runnable tick = new Runnable() {
    @Override public void run() { refresh(); handler.postDelayed(this, 1000); }
  };

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().setStatusBarColor(BG);
    getWindow().setNavigationBarColor(BG);
    prefs = getSharedPreferences("zap", Context.MODE_PRIVATE);

    LinearLayout col = new LinearLayout(this);
    col.setOrientation(LinearLayout.VERTICAL);
    int pad = dp(22);
    col.setPadding(pad, dp(36), pad, pad);

    TextView title = text("AD ZAP", 34, Color.WHITE);
    title.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
    title.setLetterSpacing(0.04f);
    col.addView(title);
    col.addView(text("Taps the X on ads for you. Any app.", 15, DIM), lp(4));

    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(18), dp(18), dp(18));
    card.setBackground(round(CARD, 18));
    status = text("", 22, Color.WHITE);
    status.setTypeface(Typeface.DEFAULT_BOLD);
    count = text("", 15, DIM);
    card.addView(status);
    card.addView(count, lp(6));
    col.addView(card, lp(26));

    turnOn = button("Turn on AD ZAP", RED);
    turnOn.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View v) { open(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); }
    });
    col.addView(turnOn, lp(22));

    help = text("", 14, DIM);
    help.setLineSpacing(0, 1.15f);
    col.addView(help, lp(14));

    restricted = button("Allow restricted settings", 0xFF2A2D38);
    restricted.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View v) {
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
      }
    });
    col.addView(restricted, lp(12));

    pause = button("", 0xFF2A2D38);
    pause.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View v) {
        prefs.edit().putBoolean("paused", !prefs.getBoolean("paused", false)).apply();
        refresh();
      }
    });
    col.addView(pause, lp(22));

    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(BG);
    scroll.addView(col);
    setContentView(scroll);
  }

  @Override protected void onResume() { super.onResume(); handler.post(tick); }
  @Override protected void onPause() { super.onPause(); handler.removeCallbacks(tick); }

  private boolean serviceOn() {
    String on = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    if (on == null) return false;
    ComponentName me = new ComponentName(this, ZapService.class);
    for (String s : on.split(":")) {
      ComponentName c = ComponentName.unflattenFromString(s);
      if (me.equals(c)) return true;
    }
    return false;
  }

  private void refresh() {
    boolean on = serviceOn();
    boolean paused = prefs.getBoolean("paused", false);
    int n = prefs.getInt("count", 0);
    if (!on) {
      status.setText("OFF");
      status.setTextColor(RED);
    } else if (paused) {
      status.setText("PAUSED");
      status.setTextColor(0xFFF1C40F);
    } else {
      status.setText("ON - zapping ads");
      status.setTextColor(GREEN);
    }
    count.setText(n == 1 ? "1 ad zapped" : n + " ads zapped");
    turnOn.setVisibility(on ? View.GONE : View.VISIBLE);
    restricted.setVisibility(on ? View.GONE : View.VISIBLE);
    help.setVisibility(on ? View.GONE : View.VISIBLE);
    help.setText("Android keeps this off until you switch it on.\n\n"
        + "Tap Turn on AD ZAP, find AD ZAP in the list (sometimes under Downloaded apps), and switch it on.\n\n"
        + "Greyed out with \"Restricted setting\"? Tap the button below, tap the 3 dots at the top right, "
        + "pick Allow restricted settings, then try again.");
    pause.setVisibility(on ? View.VISIBLE : View.GONE);
    pause.setText(paused ? "Start zapping again" : "Pause");
  }

  private void open(Intent i) {
    try { startActivity(i); } catch (RuntimeException e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
  }

  private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

  private LinearLayout.LayoutParams lp(int top) {
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    p.topMargin = dp(top);
    return p;
  }

  private TextView text(String s, int sp, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(sp);
    t.setTextColor(color);
    return t;
  }

  private GradientDrawable round(int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(radius));
    return d;
  }

  private Button button(String s, int color) {
    Button b = new Button(this);
    b.setText(s);
    b.setAllCaps(false);
    b.setTextSize(17);
    b.setTextColor(Color.WHITE);
    b.setTypeface(Typeface.DEFAULT_BOLD);
    b.setGravity(Gravity.CENTER);
    b.setMinHeight(dp(56));
    b.setStateListAnimator(null);
    b.setBackground(round(color, 14));
    return b;
  }
}
