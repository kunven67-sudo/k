package com.error.chillcharge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.net.Inet4Address;
import java.nio.charset.StandardCharsets;

/**
 * PC LINK: serves Chill Charge on your Wi-Fi so your PC can watch the phone charge and play
 * Power Empire while the phone is locked. Only people with the key in the link can use it.
 */
public class LinkService extends Service {
    static final int PORT = 8080;
    static final String STOP = "com.error.chillcharge.LINK_STOP";
    static volatile boolean running = false;

    private final MiniHttp http = new MiniHttp();
    private final Handler h = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wake;
    private WifiManager.WifiLock wifi;

    static String key(Context c) {
        android.content.SharedPreferences p = Boost.prefs(c);
        String k = p.getString("linkKey", null);
        if (k == null) {
            k = String.valueOf(1000 + new java.security.SecureRandom().nextInt(9000));
            p.edit().putString("linkKey", k).apply();
        }
        return k;
    }

    static String ip(Context c) {
        try {
            ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);
            Network n = cm.getActiveNetwork();
            LinkProperties lp = n == null ? null : cm.getLinkProperties(n);
            if (lp != null) for (LinkAddress a : lp.getLinkAddresses())
                if (a.getAddress() instanceof Inet4Address && !a.getAddress().isLoopbackAddress())
                    return a.getAddress().getHostAddress();
        } catch (Exception ignored) { }
        return "";
    }

    static String url(Context c) {
        String ip = ip(c);
        return ip.isEmpty() ? "" : "http://" + ip + ":" + PORT + "/?k=" + key(c);
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            Game.credit(LinkService.this); // pays out real charging even when nobody is looking
            boolean charging = Boost.isCharging(LinkService.this);
            if (charging && !wake.isHeld()) wake.acquire(6 * 3600 * 1000L);
            if (!charging && wake.isHeld()) wake.release();
            h.postDelayed(this, 5000);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("link", "PC link", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 3, new Intent(this, LinkService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        String u = url(this);
        Notification n = new Notification.Builder(this, "link")
                .setSmallIcon(R.drawable.ic_note)
                .setContentTitle("PC link is on")
                .setContentText(u.isEmpty() ? "Connect to Wi-Fi" : "On your PC: " + u)
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder((android.graphics.drawable.Icon) null, "Turn off", stop).build())
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(3, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(3, n);

        if (!running) {
            try {
                http.start(PORT, this::route);
                running = true;
            } catch (Exception e) {
                stopSelf();
                return START_NOT_STICKY;
            }
            PowerManager pm = getSystemService(PowerManager.class);
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chillcharge:link");
            WifiManager wm = getApplicationContext().getSystemService(WifiManager.class);
            //noinspection deprecation
            wifi = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "chillcharge:link");
            wifi.acquire();
            h.post(tick);
        }
        return START_STICKY;
    }

    private MiniHttp.Res route(String method, String path, java.util.Map<String, String> q,
                               java.util.Map<String, String> hd, byte[] body) throws Exception {
        if (path.startsWith("/api/")) {
            if (!key(this).equals(q.get("k"))) return MiniHttp.Res.text(403, "text/plain", "wrong key");
            String json = "application/json; charset=utf-8";
            switch (path) {
                case "/api/phone": return MiniHttp.Res.text(200, json, PhoneState.json(this));
                case "/api/game":
                    if ("POST".equals(method)) {
                        boolean ok = Game.put(this, new String(body, StandardCharsets.UTF_8));
                        return MiniHttp.Res.text(ok ? 200 : 409, json, ok ? Game.get(this) : "{\"conflict\":true}");
                    }
                    return MiniHttp.Res.text(200, json, Game.credit(this));
                default: return null;
            }
        }
        String f = path.equals("/") ? "index.html" : path.substring(1);
        if (f.contains("..")) return null;
        String type = f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".ogg") ? "audio/ogg"
                : f.endsWith(".ttf") ? "font/ttf" : f.endsWith(".js") ? "application/javascript" : "application/octet-stream";
        MiniHttp.Res r = new MiniHttp.Res();
        r.type = type;
        try (AssetFileDescriptor fd = getAssets().openFd(f)) { r.len = fd.getLength(); } catch (Exception compressed) { r.len = -1; }
        r.in = getAssets().open(f);
        if (r.len < 0) { // compressed in the APK: read it all so we know the size
            java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int k;
            while ((k = r.in.read(buf)) > 0) b.write(buf, 0, k);
            r.in.close(); r.in = null; r.data = b.toByteArray();
        }
        return r;
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(tick);
        http.stop();
        running = false;
        if (wake != null && wake.isHeld()) wake.release();
        if (wifi != null && wifi.isHeld()) wifi.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
