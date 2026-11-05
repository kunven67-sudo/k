package com.error.chillcharge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** Tiny watcher: while boost is on it waits for the charger to come out, then puts everything back. */
public class WatchService extends Service {
    static final String STOP = "com.error.chillcharge.STOP";
    private BroadcastReceiver unplug;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            Boost.turnOff(this);
            stopSelf();
            return START_NOT_STICKY;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("boost", "Boost", NotificationManager.IMPORTANCE_LOW));

        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, WatchService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(this, "boost")
                .setSmallIcon(R.drawable.ic_note)
                .setContentTitle("Boost is on")
                .setContentText("Unplug and your screen goes back to normal")
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder((android.graphics.drawable.Icon) null, "Stop boost", stop).build())
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, n);
        }

        if (unplug == null) {
            unplug = new Unplug();
            registerReceiver(unplug, new IntentFilter(Intent.ACTION_POWER_DISCONNECTED));
        }
        if (!Boost.isCharging(this)) { // already unplugged before we got here
            Boost.turnOff(this);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (unplug != null) unregisterReceiver(unplug);
        unplug = null;
        super.onDestroy();
    }

    /** Charger came out: put everything back and stop watching. */
    class Unplug extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent i) {
            Boost.turnOff(c);
            stopSelf();
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
