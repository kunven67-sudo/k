package com.error.chillcharge;

import android.app.AppOpsManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Process;

/**
 * CLAUDE MODE: while the Claude app is open (and the screen is on) this keeps the lo-fi playing,
 * keeps the boost on, and feeds your charging into the reactor. Leave Claude = it all stops.
 */
public class ClaudeService extends Service {
    static final String CLAUDE = "com.anthropic.claude";
    static final String STOP = "com.error.chillcharge.CLAUDE_STOP";
    static final int TRACKS = 6;
    private static final long TICK = 2000;

    private final Handler h = new Handler(Looper.getMainLooper());
    private String fg = "";
    private long lastTick = 0;
    private MediaPlayer mp;
    private int track = (int) (Math.random() * TRACKS);
    static volatile boolean appVisible = false; // Chill Charge itself is open: it plays its own music

    static boolean usageOk(Context c) {
        AppOpsManager ao = c.getSystemService(AppOpsManager.class);
        @SuppressWarnings("deprecation") int m = ao.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        return m == AppOpsManager.MODE_ALLOWED;
    }

    static boolean isOn(Context c) {
        return Boost.prefs(c).getBoolean("claudeMode", false);
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            step();
            h.postDelayed(this, TICK);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            Boost.prefs(this).edit().putBoolean("claudeMode", false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("claude", "Claude mode", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 2,
                new Intent(this, ClaudeService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(this, "claude")
                .setSmallIcon(R.drawable.ic_note)
                .setContentTitle("Claude mode")
                .setContentText("Music, boost + reactor run while Claude is open")
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder((android.graphics.drawable.Icon) null, "Turn off", stop).build())
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(2, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(2, n);
        }
        h.removeCallbacks(tick);
        lastTick = System.currentTimeMillis();
        h.post(tick);
        return START_STICKY;
    }

    private void step() {
        long now = System.currentTimeMillis();
        double dt = Math.min(10, (now - lastTick) / 1000.0);
        lastTick = now;

        // which app is on screen? (needs Usage access)
        if (usageOk(this)) {
            UsageStatsManager um = getSystemService(UsageStatsManager.class);
            UsageEvents ev = um.queryEvents(now - 15000, now);
            UsageEvents.Event e = new UsageEvents.Event();
            while (ev.hasNextEvent()) {
                ev.getNextEvent(e);
                if (e.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED) fg = e.getPackageName();
            }
        }
        PowerManager pm = getSystemService(PowerManager.class);
        boolean inClaude = CLAUDE.equals(fg) && pm.isInteractive() && !appVisible;
        boolean charging = Boost.isCharging(this);
        SharedPreferences p = Boost.prefs(this);

        // music
        if (inClaude) playMusic(); else pauseMusic();

        // boost (only the one Claude mode turned on; a boost you started yourself is left alone)
        if (inClaude && charging && !Boost.isOn(this)) {
            int pct = p.getInt("pct", 20);
            Boost.turnOn(this, pct, Boost.canWrite(this), false);
            p.edit().putBoolean("byClaude", true).apply();
        } else if ((!inClaude || !charging) && Boost.isOn(this) && p.getBoolean("byClaude", false)) {
            Boost.turnOff(this);
        }

        // reactor
        if (inClaude && charging) Boost.addWh(this, Boost.watts(this) * dt / 3600.0);
    }

    private void playMusic() {
        if (mp != null && mp.isPlaying()) return;
        if (mp != null) { mp.start(); return; }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            AssetFileDescriptor fd = getAssets().openFd("music/t" + (track + 1) + ".ogg");
            mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            fd.close();
            mp.setVolume(0.7f, 0.7f);
            mp.setOnCompletionListener(m -> { releaseMusic(); track = (track + 1) % TRACKS; playMusic(); });
            mp.prepare();
            mp.start();
        } catch (Exception e) {
            releaseMusic();
        }
    }

    private void pauseMusic() {
        if (mp != null && mp.isPlaying()) mp.pause();
    }

    private void releaseMusic() {
        if (mp != null) { try { mp.release(); } catch (Exception ignored) { } }
        mp = null;
    }

    @Override
    public void onDestroy() {
        h.removeCallbacks(tick);
        releaseMusic();
        if (Boost.isOn(this) && Boost.prefs(this).getBoolean("byClaude", false)) Boost.turnOff(this);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
