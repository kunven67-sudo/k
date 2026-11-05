package com.error.chillcharge;

import android.app.ActivityManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.BatteryManager;
import android.os.Build;
import android.provider.Settings;

/** Everything the boost really changes on the phone, and how it puts it back. */
final class Boost {
    private Boost() {}

    static final int SLEEP_MS = 15000; // screen turns off after 15 s of not touching it

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("boost", Context.MODE_PRIVATE);
    }

    static boolean isOn(Context c) {
        return prefs(c).getBoolean("on", false);
    }

    static boolean canWrite(Context c) {
        return Settings.System.canWrite(c);
    }

    static boolean isCharging(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b == null) return false;
        return b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
    }

    /** pct = brightness 1..100 (of the phone's max). Returns how many apps got closed (-1 = Android does it itself). */
    static int turnOn(Context c, int pct, boolean dim, boolean kill) {
        ContentResolver cr = c.getContentResolver();
        SharedPreferences p = prefs(c);
        SharedPreferences.Editor e = p.edit();
        if (dim && canWrite(c)) {
            if (!p.getBoolean("saved", false)) {
                e.putInt("oldMode", Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, 0));
                e.putInt("oldBright", Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS, 128));
                e.putInt("oldSleep", Settings.System.getInt(cr, Settings.System.SCREEN_OFF_TIMEOUT, 30000));
                e.putBoolean("saved", true);
            }
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE,
                    Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
            setBrightness(c, pct);
            Settings.System.putInt(cr, Settings.System.SCREEN_OFF_TIMEOUT, SLEEP_MS);
        }
        e.putInt("pct", pct).putBoolean("dim", dim).putBoolean("on", true).apply();
        return kill ? killBackground(c) : 0;
    }

    static void setBrightness(Context c, int pct) {
        if (!canWrite(c) || !prefs(c).getBoolean("saved", false)) return; // only while boost dimmed it
        int v = Math.max(1, Math.min(255, Math.round(pct * 255f / 100f)));
        Settings.System.putInt(c.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, v);
    }

    /** Puts brightness + sleep time back the way they were before the boost. */
    static void turnOff(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getBoolean("saved", false) && canWrite(c)) {
            ContentResolver cr = c.getContentResolver();
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, p.getInt("oldBright", 128));
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, p.getInt("oldMode", 0));
            Settings.System.putInt(cr, Settings.System.SCREEN_OFF_TIMEOUT, p.getInt("oldSleep", 30000));
        }
        p.edit().putBoolean("on", false).putBoolean("saved", false).putBoolean("byClaude", false).apply();
    }

    /** Watts from the phone's current sensor (some phones, like Motorola, report this wrong). */
    static double sensorWatts(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b == null || b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) == 0) return 0;
        BatteryManager bm = c.getSystemService(BatteryManager.class);
        long raw = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
        if (raw == Long.MIN_VALUE || raw == 0) return 0;
        long cur = Math.abs(raw);
        if (cur > 20000000L) return 0;
        if (cur < 20000) cur *= 1000; // phone reports mA instead of uA
        return cur * b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) / 1e9;
    }

    // charge counter samples: {time ms, uAh}
    private static final java.util.ArrayDeque<long[]> samples = new java.util.ArrayDeque<>();
    private static final long WINDOW_MS = 90000, MIN_SPAN_MS = 25000;

    /** Battery's mAh counter right now in uAh (-1 = phone doesn't have one). */
    static long counter(Context c) {
        BatteryManager bm = c.getSystemService(BatteryManager.class);
        int v = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
        return (v == Integer.MIN_VALUE || v <= 0) ? -1 : v;
    }

    /** Real power filling the battery, measured from how fast its mAh counter goes up. -1 = not enough data yet. */
    static synchronized double counterWatts(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b == null || b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) == 0) { samples.clear(); return -1; }
        long cc = counter(c);
        if (cc < 0) return -1;
        long now = android.os.SystemClock.elapsedRealtime();
        if (samples.isEmpty() || now - samples.peekLast()[0] >= 2000) samples.addLast(new long[]{now, cc});
        while (samples.size() > 2 && now - samples.peekFirst()[0] > WINDOW_MS) samples.pollFirst();
        long[] a = samples.peekFirst(), z = samples.peekLast();
        long span = z[0] - a[0];
        if (span < MIN_SPAN_MS) return -1;
        long d = z[1] - a[1];
        if (d < 0) { samples.clear(); return -1; } // went down = not really charging, start over
        double amps = (d / 1e6) / (span / 3.6e6);
        return amps * b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) / 1000.0;
    }

    /** Best guess of watts going into the battery: the mAh counter once it has 25 s of data, else the sensor. */
    static double watts(Context c) {
        double w = counterWatts(c);
        return w >= 0 ? w : sensorWatts(c);
    }

    /** Reactor energy (Wh your charging fed into it). */
    static synchronized double addWh(Context c, double wh) {
        SharedPreferences p = prefs(c);
        double v = Double.longBitsToDouble(p.getLong("wh", Double.doubleToLongBits(0))) + wh;
        if (v < 0) v = 0;
        p.edit().putLong("wh", Double.doubleToLongBits(v)).apply();
        return v;
    }

    static synchronized void setWh(Context c, double v) {
        prefs(c).edit().putLong("wh", Double.doubleToLongBits(v)).apply();
    }

    /**
     * Closes apps sitting in the background. Android 14+ only lets an app close its OWN
     * background stuff, but on 14+ Android freezes background apps by itself, so we skip it there.
     */
    static int killBackground(Context c) {
        if (Build.VERSION.SDK_INT >= 34) return -1;
        ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
        PackageManager pm = c.getPackageManager();
        int n = 0;
        for (ApplicationInfo ai : pm.getInstalledApplications(0)) {
            if ((ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0) continue;
            if (ai.packageName.equals(c.getPackageName())) continue;
            try {
                am.killBackgroundProcesses(ai.packageName);
                n++;
            } catch (Exception ignored) { }
        }
        return n;
    }
}
