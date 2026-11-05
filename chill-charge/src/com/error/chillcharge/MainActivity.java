package com.error.chillcharge;

import android.app.Activity;
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
                    + ",\"saver\":" + pm.isPowerSaveMode()
                    + ",\"canWrite\":" + Boost.canWrite(MainActivity.this)
                    + ",\"boost\":" + Boost.isOn(MainActivity.this)
                    + ",\"bright\":" + bright
                    + ",\"sdk\":" + Build.VERSION.SDK_INT + "}";
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
