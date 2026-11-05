package com.error.chillcharge;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int BG = 0xFF0A0918;
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);

        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new Client());
        web.addJavascriptInterface(new Bridge(), "Phone");
        web.loadUrl("https://app.local/index.html");
        setContentView(web);
    }

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            return serve(r);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            return !"app.local".equals(r.getUrl().getHost());
        }
    }

    /** Serves the files inside the app (page, music, font) from a pretend https address. */
    private WebResourceResponse serve(WebResourceRequest r) {
        Uri u = r.getUrl();
        if (!"app.local".equals(u.getHost())) return null;
        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        path = path.substring(1);
        String mime = path.endsWith(".html") ? "text/html"
                : path.endsWith(".js") ? "application/javascript"
                : path.endsWith(".css") ? "text/css"
                : path.endsWith(".ogg") ? "audio/ogg"
                : path.endsWith(".ttf") ? "font/ttf" : "application/octet-stream";
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        try {
            long len = -1;
            try (AssetFileDescriptor fd = getAssets().openFd(path)) {
                len = fd.getLength();
            } catch (Exception compressed) { /* small compressed files: no length needed */ }
            InputStream in = getAssets().open(path);
            String range = r.getRequestHeaders().get("Range");
            if (range == null) range = r.getRequestHeaders().get("range");
            if (len > 0 && range != null && range.startsWith("bytes=")) {
                String[] ab = range.substring(6).split("-", 2);
                long start = ab[0].isEmpty() ? 0 : Long.parseLong(ab[0].trim());
                long end = (ab.length < 2 || ab[1].trim().isEmpty()) ? len - 1 : Long.parseLong(ab[1].trim());
                end = Math.min(end, len - 1);
                long skip = start;
                while (skip > 0) {
                    long k = in.skip(skip);
                    if (k <= 0) break;
                    skip -= k;
                }
                h.put("Accept-Ranges", "bytes");
                h.put("Content-Range", "bytes " + start + "-" + end + "/" + len);
                h.put("Content-Length", String.valueOf(end - start + 1));
                return new WebResourceResponse(mime, null, 206, "Partial Content", h, in);
            }
            if (len > 0) {
                h.put("Accept-Ranges", "bytes");
                h.put("Content-Length", String.valueOf(len));
            }
            return new WebResourceResponse(mime, "html".equals(ext(path)) ? "utf-8" : null, 200, "OK", h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, null);
        }
    }

    private static String ext(String p) {
        int i = p.lastIndexOf('.');
        return i < 0 ? "" : p.substring(i + 1);
    }

    @Override
    protected void onResume() {
        super.onResume();
        ClaudeService.appVisible = true;
        web.onResume();
        // boost was on but the phone got unplugged while we were closed: put things back
        if (Boost.isOn(this) && !Boost.isCharging(this)) {
            Boost.turnOff(this);
            stopService(new Intent(this, WatchService.class));
        }
        web.evaluateJavascript("window.appResume&&appResume()", null);
    }

    @Override
    protected void onPause() {
        ClaudeService.appVisible = false;
        // music stops when you leave (so it won't play over your anime)
        web.evaluateJavascript("window.appPause&&appPause()", null);
        web.onPause();
        super.onPause();
    }

    /** What the page can ask the phone. */
    class Bridge {
        @JavascriptInterface
        public String state() {
            Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            BatteryManager bm = getSystemService(BatteryManager.class);
            PowerManager pm = getSystemService(PowerManager.class);
            int level = -1, scale = 100, plugged = 0, status = 0, temp = 0, volt = 0;
            if (b != null) {
                level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                plugged = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
                status = b.getIntExtra(BatteryManager.EXTRA_STATUS, 0);
                temp = b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0);
                volt = b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0);
            }
            long current = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
            long left = Build.VERSION.SDK_INT >= 28 ? bm.computeChargeTimeRemaining() : -1;
            int bright = Settings.System.getInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, -1);
            return "{\"level\":" + level + ",\"scale\":" + scale + ",\"plugged\":" + plugged
                    + ",\"status\":" + status + ",\"temp\":" + temp + ",\"volt\":" + volt
                    + ",\"current\":" + (current == Long.MIN_VALUE ? 0 : current)
                    + ",\"left\":" + left
                    + ",\"w\":" + Boost.watts(MainActivity.this)
                    + ",\"measured\":" + (Boost.counterWatts(MainActivity.this) >= 0)
                    + ",\"cc\":" + Boost.counter(MainActivity.this)
                    + ",\"saver\":" + pm.isPowerSaveMode()
                    + ",\"canWrite\":" + Boost.canWrite(MainActivity.this)
                    + ",\"boost\":" + Boost.isOn(MainActivity.this)
                    + ",\"bright\":" + bright
                    + ",\"sdk\":" + Build.VERSION.SDK_INT
                    + ",\"wh\":" + Boost.addWh(MainActivity.this, 0)
                    + ",\"claudeMode\":" + ClaudeService.isOn(MainActivity.this)
                    + ",\"usageOk\":" + ClaudeService.usageOk(MainActivity.this)
                    + ",\"adminOk\":" + adminOk()
                    + ",\"hasClaude\":" + (getPackageManager().getLaunchIntentForPackage(ClaudeService.CLAUDE) != null)
                    + "}";
        }

        private boolean adminOk() {
            DevicePolicyManager dpm = getSystemService(DevicePolicyManager.class);
            return dpm.isAdminActive(new ComponentName(MainActivity.this, AdminReceiver.class));
        }

        /** Screen off right now (fastest charging). First time it asks you to allow screen lock. */
        @JavascriptInterface
        public void lockNow() {
            runOnUiThread(() -> {
                if (adminOk()) {
                    getSystemService(DevicePolicyManager.class).lockNow();
                } else {
                    Intent i = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
                    i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, new ComponentName(MainActivity.this, AdminReceiver.class));
                    i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                            "Lets the LOCK SCREEN button turn your screen off instantly. That's all it can do.");
                    startActivity(i);
                }
            });
        }

        /** Black mode: makes THIS screen as dark as the phone allows (only while the app is open). */
        @JavascriptInterface
        public void windowDim(boolean on) {
            runOnUiThread(() -> {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.screenBrightness = on ? 0.01f : WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                getWindow().setAttributes(lp);
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void buzz(String pattern) {
            try {
                String[] a = pattern.split(",");
                long[] t = new long[a.length];
                for (int i = 0; i < a.length; i++) t[i] = Long.parseLong(a[i].trim());
                Vibrator v = getSystemService(Vibrator.class);
                if (v != null) v.vibrate(VibrationEffect.createWaveform(t, -1));
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public double addWh(double wh) { return Boost.addWh(MainActivity.this, wh); }

        @JavascriptInterface
        public void setWh(double wh) { Boost.setWh(MainActivity.this, wh); }

        @JavascriptInterface
        public void askUsage() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));
        }

        @JavascriptInterface
        public void claudeMode(boolean on, int pct) {
            Boost.prefs(MainActivity.this).edit().putBoolean("claudeMode", on).putInt("pct", pct).apply();
            Intent i = new Intent(MainActivity.this, ClaudeService.class);
            if (on) {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != 0) {
                    runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7));
                }
                startForegroundService(i);
            } else {
                stopService(i);
            }
        }

        /** Everything Error needs to pick the right charger. */
        @JavascriptInterface
        public String report(String test) {
            Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            BatteryManager bm = getSystemService(BatteryManager.class);
            StringBuilder r = new StringBuilder("CHILL CHARGE PHONE CHECK\n");
            r.append("Phone: ").append(Build.MANUFACTURER).append(" ").append(Build.MODEL)
             .append(" (").append(Build.DEVICE).append(")\n");
            r.append("Android: ").append(Build.VERSION.RELEASE).append(" (SDK ").append(Build.VERSION.SDK_INT).append(")\n");
            if (b != null) {
                int pl = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
                r.append("Plugged into: ").append(pl == 1 ? "wall charger" : pl == 2 ? "USB port" : pl == 4 ? "wireless" : pl == 0 ? "nothing" : "other").append("\n");
                int mc = b.getIntExtra("max_charging_current", -1), mv = b.getIntExtra("max_charging_voltage", -1);
                if (mc > 0) r.append("Charger max current: ").append(mc > 20000 ? mc / 1000 : mc).append(" mA\n");
                if (mv > 0) r.append("Charger max voltage: ").append(String.format(java.util.Locale.US, "%.1f", mv > 100000 ? mv / 1e6 : mv / 1e3)).append(" V\n");
                r.append("Battery: ").append(b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)).append("%, ")
                 .append(b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0).append(" C, ")
                 .append(b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)).append(" mV, health ")
                 .append(b.getIntExtra(BatteryManager.EXTRA_HEALTH, 0)).append(", ")
                 .append(b.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)).append("\n");
                int lvl = b.getIntExtra(BatteryManager.EXTRA_LEVEL, 0);
                int cc = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
                if (cc > 0 && lvl > 5) r.append("Battery size (guess): ").append(cc / 10 / lvl).append(" mAh\n");
            }
            double cw = Boost.counterWatts(MainActivity.this);
            r.append("Power in (sensor): ").append(String.format(java.util.Locale.US, "%.1f", Boost.sensorWatts(MainActivity.this))).append(" W\n");
            r.append("Power in (measured from mAh): ").append(cw >= 0 ? String.format(java.util.Locale.US, "%.1f W", cw) : "not enough data (keep the app open 30 s)").append("\n");
            if (test != null && !test.isEmpty()) r.append("Charger test: ").append(test).append("\n");
            return r.toString();
        }

        /** Copies the phone check and opens Claude so you just paste it. */
        @JavascriptInterface
        public void sendReport(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = getSystemService(ClipboardManager.class);
                cm.setPrimaryClip(ClipData.newPlainText("Phone check", text));
                Intent open = getPackageManager().getLaunchIntentForPackage(ClaudeService.CLAUDE);
                if (open != null) {
                    startActivity(open);
                } else {
                    Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Send phone check"));
                }
            });
        }

        @JavascriptInterface
        public void askWrite() {
            runOnUiThread(() -> {
                Intent i = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                        Uri.parse("package:" + getPackageName()));
                startActivity(i);
            });
        }

        @JavascriptInterface
        public void openSaver() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS));
                } catch (Exception e) {
                    startActivity(new Intent(Intent.ACTION_POWER_USAGE_SUMMARY));
                }
            });
        }

        /** Returns apps closed (-1 = Android 14+ does it by itself). */
        @JavascriptInterface
        public int boost(int pct, boolean dim, boolean kill) {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != 0) {
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7));
            }
            int n = Boost.turnOn(MainActivity.this, pct, dim, kill);
            startForegroundService(new Intent(MainActivity.this, WatchService.class));
            return n;
        }

        @JavascriptInterface
        public void brightness(int pct) {
            if (Boost.isOn(MainActivity.this)) Boost.setBrightness(MainActivity.this, pct);
        }

        @JavascriptInterface
        public void stop() {
            Boost.turnOff(MainActivity.this);
            stopService(new Intent(MainActivity.this, WatchService.class));
        }
    }
}
