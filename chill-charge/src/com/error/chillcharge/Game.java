package com.error.chillcharge;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.BatteryManager;

import org.json.JSONObject;

/**
 * The Power Empire save lives here (not in the page) so the phone screen, the PC link and the
 * background service all play the SAME empire. Energy is paid from the battery's real mAh counter.
 */
final class Game {
    private Game() {}

    static final double BANK_DRAIN_W = 1.0; // unplugged: the bank feeds the empire like a 1 W charger

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("empire", Context.MODE_PRIVATE);
    }

    static synchronized String get(Context c) {
        return p(c).getString("g", "{}");
    }

    /** Saves the page's changes only if nobody else changed the save since it was read (v must match). */
    static synchronized boolean put(Context c, String json) {
        try {
            JSONObject in = new JSONObject(json);
            JSONObject cur = new JSONObject(get(c));
            if (cur.optLong("v", 0) != in.optLong("v", 0)) return false;
            // the page never moves the battery baseline
            if (cur.has("cc")) in.put("cc", cur.getLong("cc"));
            if (cur.has("t")) in.put("t", cur.getLong("t"));
            in.put("v", cur.optLong("v", 0) + 1);
            p(c).edit().putString("g", in.toString()).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Pays out everything since the last payout and returns the save. */
    static synchronized String credit(Context c) {
        try {
            JSONObject g = new JSONObject(get(c));
            long now = System.currentTimeMillis();
            long cc = Boost.counter(c);
            Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            boolean plugged = b != null && b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
            double volt = b != null ? b.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 3850) / 1000.0 : 3.85;
            long lastCc = g.optLong("cc", 0), lastT = g.optLong("t", 0);
            double m = Math.max(1, g.optDouble("m", 1));
            double cap = g.optDouble("bankCap", 2), out = g.optDouble("bankOut", 1), bank = g.optDouble("bank", 0);
            double j = 0, wh = 0, used = 0;
            if (lastCc > 0 && cc > lastCc) {
                wh = (cc - lastCc) / 1e6 * volt;               // real Wh that went into the battery
                j = wh * 3600 * m;
                bank = Math.min(cap, bank + wh);               // charging fills the power bank too
            } else if (!plugged && lastT > 0 && bank > 0) {
                double hours = Math.max(0, now - lastT) / 3.6e6;
                used = Math.min(bank, BANK_DRAIN_W * hours);  // unplugged: run off the bank
                bank -= used;
                j = used * 3600 * m * out;
            }
            if (j > 0) {
                g.put("e", g.optDouble("e", 0) + j);
                g.put("total", g.optDouble("total", 0) + j);
                if (lastT > 0 && now - lastT > 30000) {       // big gap = "while you were gone"
                    JSONObject a = new JSONObject();
                    a.put("j", j); a.put("wh", wh); a.put("bank", used); a.put("s", (now - lastT) / 1000);
                    g.put("away", a);
                }
            }
            g.put("bank", bank);
            if (cc > 0) g.put("cc", cc);
            g.put("t", now);
            g.put("v", g.optLong("v", 0) + 1);
            String s = g.toString();
            p(c).edit().putString("g", s).apply();
            return s;
        } catch (Exception e) {
            return get(c);
        }
    }
}
