package com.error.chillcharge;

import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.display.DisplayManager;
import android.provider.Settings;
import android.view.Display;

/**
 * BIG UNLOCK: after a one-time "pm grant ... WRITE_SECURE_SETTINGS" from a PC (adb), the SAVE POWER button can
 * also change settings Android normally keeps away from apps. Every old value is saved and put back on Turn off.
 */
final class Unlock {
    private Unlock() {}

    static final String PERM = "android.permission.WRITE_SECURE_SETTINGS";

    // table, key, value while saving, what to say (empty = part of the line above), value if it was never set
    private static final String[][] ITEMS = {
            {"system", "peak_refresh_rate", "60.0", "screen 60 Hz", ""},
            {"system", "min_refresh_rate", "0.0", "", "0.0"},
            {"global", "low_power", "1", "Battery Saver on", "0"},
            {"global", "animator_duration_scale", "0.5", "quicker animations", "1.0"},
            {"global", "transition_animation_scale", "0.5", "", "1.0"},
            {"global", "window_animation_scale", "0.5", "", "1.0"},
            {"global", "wifi_scan_always_enabled", "0", "background Wi-Fi scanning off", "1"},
            {"global", "ble_scan_always_enabled", "0", "background Bluetooth scanning off", "1"},
            {"secure", "location_mode", "0", "location off", "3"},
    };

    static boolean ok(Context c) {
        return c.checkSelfPermission(PERM) == PackageManager.PERMISSION_GRANTED;
    }

    private static String get(ContentResolver cr, String t, String k) {
        switch (t) {
            case "system": return Settings.System.getString(cr, k);
            case "global": return Settings.Global.getString(cr, k);
            default: return Settings.Secure.getString(cr, k);
        }
    }

    private static boolean put(ContentResolver cr, String t, String k, String v) {
        try {
            switch (t) {
                case "system": return Settings.System.putString(cr, k, v);
                case "global": return Settings.Global.putString(cr, k, v);
                default: return Settings.Secure.putString(cr, k, v);
            }
        } catch (Exception e) {
            return false;
        }
    }

    /** The phone's fastest screen mode (what "peak refresh rate" goes back to if it was never set). */
    private static String maxHz(Context c) {
        float m = 60;
        try {
            Display d = c.getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
            for (Display.Mode mode : d.getSupportedModes()) m = Math.max(m, mode.getRefreshRate());
        } catch (Exception ignored) { }
        return String.valueOf(m);
    }

    static float hz(Context c) {
        try { return c.getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY).getRefreshRate(); }
        catch (Exception e) { return 0; }
    }

    /** Turns the extra savers on. Returns what actually worked, like "screen 60 Hz, Battery Saver on". */
    static String apply(Context c) {
        if (!ok(c)) return "";
        ContentResolver cr = c.getContentResolver();
        SharedPreferences p = Boost.prefs(c);
        SharedPreferences.Editor e = p.edit();
        boolean saved = p.getBoolean("u_saved", false);
        StringBuilder did = new StringBuilder();
        for (String[] it : ITEMS) {
            if (!saved) {
                String old = get(cr, it[0], it[1]);
                e.putString("u_" + it[1], old == null ? "\u0000" : old);
            }
            boolean w = put(cr, it[0], it[1], it[2]);
            if (w && !it[3].isEmpty()) did.append(did.length() > 0 ? " · " : "").append(it[3]);
        }
        e.putBoolean("u_saved", true).putString("u_did", did.toString()).apply();
        return did.toString();
    }

    /** Puts every setting back the way it was before SAVE POWER. */
    static void restore(Context c) {
        SharedPreferences p = Boost.prefs(c);
        if (!p.getBoolean("u_saved", false) || !ok(c)) return;
        ContentResolver cr = c.getContentResolver();
        for (String[] it : ITEMS) {
            String old = p.getString("u_" + it[1], "\u0000");
            if ("\u0000".equals(old)) old = it[1].equals("peak_refresh_rate") ? maxHz(c) : it[4];
            put(cr, it[0], it[1], old);
        }
        p.edit().putBoolean("u_saved", false).putString("u_did", "").apply();
    }

    static String did(Context c) {
        return Boost.prefs(c).getString("u_did", "");
    }

    static boolean devOn(Context c) {
        return Settings.Global.getInt(c.getContentResolver(), Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1;
    }

    static boolean adbOn(Context c) {
        return Settings.Global.getInt(c.getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1;
    }
}
