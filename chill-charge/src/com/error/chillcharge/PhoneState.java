package com.error.chillcharge;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

/** Battery + app status as JSON. Used by the phone screen AND the PC link. */
final class PhoneState {
    private PhoneState() {}

    static String json(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        BatteryManager bm = c.getSystemService(BatteryManager.class);
        PowerManager pm = c.getSystemService(PowerManager.class);
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
        int bright = Settings.System.getInt(c.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, -1);
        DevicePolicyManager dpm = c.getSystemService(DevicePolicyManager.class);
        boolean admin = dpm.isAdminActive(new ComponentName(c, AdminReceiver.class));
        return "{\"level\":" + level + ",\"scale\":" + scale + ",\"plugged\":" + plugged
                + ",\"status\":" + status + ",\"temp\":" + temp + ",\"volt\":" + volt
                + ",\"current\":" + (current == Long.MIN_VALUE ? 0 : current)
                + ",\"left\":" + left
                + ",\"w\":" + Boost.watts(c)
                + ",\"measured\":" + (Boost.counterWatts(c) >= 0)
                + ",\"use\":" + Boost.usingW(c)
                + ",\"cc\":" + Boost.counter(c)
                + ",\"saver\":" + pm.isPowerSaveMode()
                + ",\"screen\":" + pm.isInteractive()
                + ",\"canWrite\":" + Boost.canWrite(c)
                + ",\"boost\":" + Boost.isOn(c)
                + ",\"bright\":" + bright
                + ",\"sdk\":" + Build.VERSION.SDK_INT
                + ",\"claudeMode\":" + ClaudeService.isOn(c)
                + ",\"usageOk\":" + ClaudeService.usageOk(c)
                + ",\"adminOk\":" + admin
                + ",\"hasClaude\":" + (c.getPackageManager().getLaunchIntentForPackage(ClaudeService.CLAUDE) != null)
                + ",\"link\":" + LinkService.running
                + ",\"linkUrl\":\"" + LinkService.url(c) + "\""
                + "}";
    }
}
