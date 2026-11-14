package com.error.chillcharge;

import android.content.Context;

/** Saves for the extra games, shared by the phone screen and the PC link. */
final class Kv {
    private Kv() {}

    static String get(Context c, String name) {
        return c.getSharedPreferences("kv", Context.MODE_PRIVATE).getString(name, "");
    }

    static void set(Context c, String name, String json) {
        if (name == null || name.length() > 40 || json == null || json.length() > 200000) return;
        c.getSharedPreferences("kv", Context.MODE_PRIVATE).edit().putString(name, json).apply();
    }
}
