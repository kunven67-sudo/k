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

    static final int SLEEP_MS = 15000;
    /** Small extra savers the one button also turns off: auto-rotate sensor, touch vibration, touch sounds. */
    static final String[] EXTRA = {Settings.System.ACCELEROMETER_ROTATION, Settings.System.HAPTIC_FEEDBACK_ENABLED,
            Settings.System.SOUND_EFFECTS_ENABLED}; // screen turns off after 15 s of not touching it

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
                for (String k : EXTRA) e.putInt("old_" + k, Settings.System.getInt(cr, k, -1));
                e.putBoolean("saved", true);
            }
            for (String k : EXTRA) {
                try { Settings.System.putInt(cr, k, 0); } catch (Exception ignored) { } // some phones block one of these
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
            for (String k : EXTRA) {
                int v = p.getInt("old_" + k, -1);
                if (v >= 0) try { Settings.System.putInt(cr, k, v); } catch (Exception ignored) { }
            }
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

    // charge counter samples: {time ms, uAh, plugged 0/1}
    private static final java.util.ArrayDeque<long[]> samples = new java.util.ArrayDeque<>();
    private static final long WINDOW_MS = 360000, MIN_SPAN_MS = 15000, HOLD_MS = 180000;
    private static double lastRate = Double.NaN;
    private static long lastRateT = 0;

    /** Battery's mAh counter right now in uAh (-1 = phone doesn't have one). */
    static long counter(Context c) {
        BatteryManager bm = c.getSystemService(BatteryManager.class);
        int v = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
        return (v == Integer.MIN_VALUE || v <= 0) ? -1 : v;
    }

    /**
     * Real power in (+) or out (-) of the battery, from how fast its mAh counter moves. NaN = not known yet.
     * Phones only update that counter in steps (every few seconds on some, every 30+ s on Motorola), so we measure
     * between the moments it CHANGED, never across a flat stretch (that was the "0 W while charging" bug), and keep
     * showing the last good number for a while when it hasn't moved yet.
     */
    static synchronized double rateW(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (b == null) return Double.NaN;
        long plug = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0 ? 1 : 0;
        long cc = counter(c);
        if (cc < 0) return Double.NaN;
        long now = android.os.SystemClock.elapsedRealtime();
        long[] last = samples.peekLast();
        // plugged/unplugged changed, or we were asleep a long time: start fresh
        if (last != null && (last[2] != plug || now - last[0] > 60000)) { samples.clear(); lastRate = Double.NaN; last = null; }
        if (last == null || now - last[0] >= 1000) samples.addLast(new long[]{now, cc, plug});
        while (samples.size() > 2 && now - samples.peekFirst()[0] > WINDOW_MS) samples.pollFirst();
        // the moments the counter changed
        long[] first = null, end = null; long prev = Long.MIN_VALUE; int changes = 0;
        for (long[] s2 : samples) {
            if (prev != Long.MIN_VALUE && s2[1] != prev) { if (first == null) first = s2; end = s2; changes++; }
            prev = s2[1];
        }
        double volt = b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 3850) / 1000.0;
        if (changes >= 2 && end[0] - first[0] >= MIN_SPAN_MS) {
            double amps = ((end[1] - first[1]) / 1e6) / ((end[0] - first[0]) / 3.6e6);
            lastRate = amps * volt;
            lastRateT = now;
        }
        if (!Double.isNaN(lastRate) && now - lastRateT < HOLD_MS) return lastRate;
        return Double.NaN;
    }

    /** -1 while we don't know yet (kept for the phone check). */
    static double counterWatts(Context c) {
        double r = rateW(c);
        return Double.isNaN(r) ? -1 : Math.max(0, r);
    }

    /** Watts going INTO the battery: the mAh counter when known, else the sensor. */
    static double watts(Context c) {
        if (!isCharging(c)) return 0;
        double r = rateW(c);
        return Double.isNaN(r) ? sensorWatts(c) : Math.max(0, r);
    }

    /** Watts the phone is USING from its battery while unplugged (-1 = not known yet). */
    static double usingW(Context c) {
        if (isCharging(c)) return -1;
        double r = rateW(c);
        return Double.isNaN(r) ? -1 : Math.max(0, -r);
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
