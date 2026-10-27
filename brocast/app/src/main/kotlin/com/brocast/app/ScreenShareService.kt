package com.brocast.app

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Point
import android.hardware.display.DisplayManager
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.Display
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.brocast.app.translate.LiveSubtitles
import com.brocast.app.translate.SubtitleVoice
import com.brocast.core.AudioHub
import com.brocast.core.FrameHub
import com.brocast.core.PinConfig
import com.brocast.core.StreamServer
import com.brocast.core.VideoHub
import com.brocast.core.VoicePitch
import java.io.IOException

/**
 * Runs the whole sharing session: screen capture + the web server the TV connects to.
 * It's a foreground service, so sharing keeps going while you use other apps.
 */
class ScreenShareService : Service() {

    private class Session(
        val hub: FrameHub,
        val video: VideoHub,
        val server: StreamServer,
        val capturer: ScreenCapturer,
        val audioHub: AudioHub?,
        val audio: AudioCapturer?,
        val sound: SoundStatus,
        val pin: String?,
        val wifiLocks: List<WifiManager.WifiLock>,
        val startedAt: Long,
    ) {
        /** SUBDUB on the phone, while it's on. Set on the main thread, read by the capture thread. */
        @Volatile
        var subtitles: LiveSubtitles? = null

        /** Reads the English out loud, while that's on. */
        var voice: SubtitleVoice? = null
        var lastFrames = 0L
        var addresses: List<String> = emptyList()
        var ticks = 0
        var notificationText = ""
    }

    private var session: Session? = null
    private val main = Handler(Looper.getMainLooper())
    private val ticker = object : Runnable {
        override fun run() {
            tick()
            if (session != null) main.postDelayed(this, 1000)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart(intent)
            ACTION_STOP -> endSession(ShareStatus.Idle("Stopped. Catch you later ✌️"))
            ACTION_SET_QUALITY -> {
                val quality = Quality.fromName(intent.getStringExtra(EXTRA_QUALITY))
                session?.capturer?.setQuality(quality) ?: stopSelf()
            }
            ACTION_SET_TRANSLATE -> {
                val s = session
                if (s == null) {
                    stopSelf()
                } else {
                    setTranslate(s, intent.getBooleanExtra(EXTRA_ON, false), intent.getBooleanExtra(EXTRA_VOICES, true))
                }
            }
            else -> if (session == null) stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        main.removeCallbacks(ticker)
        val s = session
        session = null
        if (s != null) {
            teardown(s)
            ShareState.set(ShareStatus.Idle())
        }
        super.onDestroy()
    }

    private fun handleStart(intent: Intent) {
        val settings = ShareSettings(this)
        var sound = when {
            !settings.soundEnabled -> SoundStatus.OFF
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q -> SoundStatus.UNSUPPORTED
            !hasRecordAudioPermission() -> SoundStatus.NO_PERMISSION
            else -> SoundStatus.ON
        }
        // Must be foreground *before* asking for the projection (Android 14+ enforces this).
        // Sound needs the "microphone" type too, or Android hands over silence once you leave the app.
        if (!enterForeground(withMicrophone = sound == SoundStatus.ON)) {
            if (sound == SoundStatus.ON && enterForeground(withMicrophone = false)) {
                sound = SoundStatus.FAILED // picture only
            } else {
                endSession(ShareStatus.Failed("Android wouldn't let BroCast start sharing 😤 Try again?"))
                return
            }
        }
        session?.let {
            session = null
            teardown(it)
        }

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
        val data = IntentCompat.getParcelableExtra(intent, EXTRA_DATA, Intent::class.java)
        if (data == null) {
            endSession(ShareStatus.Failed("The screen sharing permission got lost 🤔 Tap Start again."))
            return
        }

        val pinConfig = if (settings.pinEnabled) PinConfig(settings.pin, settings.salt) else null
        val hub = FrameHub()
        val video = VideoHub()
        val audioHub = if (sound == SoundStatus.ON) AudioHub() else null
        val server = StreamServer(hub, audioHub = audioHub, videoHub = video, pinConfig = { pinConfig }, deviceName = deviceName())
        try {
            server.start(StreamServer.DEFAULT_PORT)
        } catch (e: IOException) {
            Log.e(TAG, "Server failed to start", e)
            hub.close()
            video.close()
            audioHub?.close()
            endSession(ShareStatus.Failed("Couldn't open a connection for your TV 😵 Turn Wi-Fi off and on, then try again."))
            return
        }

        val projection: MediaProjection? = try {
            getSystemService(MediaProjectionManager::class.java).getMediaProjection(resultCode, data)
        } catch (e: RuntimeException) {
            Log.e(TAG, "getMediaProjection failed", e)
            null
        }
        if (projection == null) {
            server.stop()
            hub.close()
            video.close()
            audioHub?.close()
            endSession(ShareStatus.Failed("Android said no to screen capture 😤 Tap Start and pick \"Start now\"."))
            return
        }

        lateinit var newSession: Session
        val listener = object : ScreenCapturer.Listener {
            override fun onCaptureStopped() {
                main.post {
                    if (session === newSession) {
                        endSession(ShareStatus.Idle("Sharing ended (stopped from the status bar or the screen locked)."))
                    }
                }
            }

            override fun onCaptureFailed(message: String) {
                main.post { if (session === newSession) endSession(ShareStatus.Failed(message)) }
            }
        }
        // Video normally. Pictures while a browser that can't play video is watching, or while
        // SUBDUB on the phone reads subtitles (it needs the pictures; TVs then get pictures too).
        val subtitlesOn = { newSession.subtitles }
        val capturer = ScreenCapturer(
            this, projection, hub, video, settings.quality, listener,
            picturesWanted = { subtitlesOn() != null || server.jpegViewerActive() },
            subtitleReader = { subtitlesOn()?.let { subs -> subs::offer } },
            jpegNeeded = { subtitlesOn() == null || server.pictureViewerActive() },
        )
        video.keyFrameRequester = capturer::requestKeyFrame
        var audio: AudioCapturer? = null
        if (audioHub != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            val audioCapturer = AudioCapturer(projection, audioHub)
            val problem = audioCapturer.start()
            if (problem == null) {
                audio = audioCapturer
            } else {
                Log.w(TAG, "No sound this time: $problem")
                sound = SoundStatus.FAILED
                audioHub.close()
            }
        }
        newSession = Session(
            hub, video, server, capturer, audioHub, audio, sound, pinConfig?.pin, acquireWifiLocks(),
            SystemClock.elapsedRealtime(),
        )
        session = newSession
        setTranslate(newSession, settings.translateEnabled, settings.voicesEnabled)
        capturer.start()

        main.removeCallbacks(ticker)
        tick()
        main.postDelayed(ticker, 1000)
    }

    /** Ends sharing, publishes [status] to the UI and shuts the service down. */
    private fun endSession(status: ShareStatus) {
        main.removeCallbacks(ticker)
        val s = session
        session = null
        if (s != null) teardown(s)
        ShareState.set(status)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * SUBDUB on the phone on or off (it needs "display over other apps" for the English box), and
     * the English [voices] with it.
     */
    private fun setTranslate(s: Session, on: Boolean, voices: Boolean) {
        if (on && s.subtitles == null && Settings.canDrawOverlays(this)) {
            s.subtitles = LiveSubtitles(this) { realScreenSize() }
        } else if (!on) {
            s.subtitles?.close()
            s.subtitles = null
        }
        val subs = s.subtitles
        if (subs != null && voices) {
            val voice = s.voice ?: SubtitleVoice(this).also { s.voice = it }
            // Guy or girl voice: hear how high the show's voices are (needs the sound capture).
            val hub = s.audioHub
            val pitch = if (hub != null) VoicePitch(hub.sampleRate, hub.channels) else null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Our own English is in the captured sound too: don't measure it.
                s.audio?.tap = pitch?.let { p -> { pcm: ByteArray -> if (voice.speaking) p.clear() else p.feed(pcm) } }
            }
            subs.onNewEnglish = { english -> voice.say(english, pitch?.recentPitch()) }
        } else {
            subs?.onNewEnglish = null
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) s.audio?.tap = null
            s.voice?.close()
            s.voice = null
        }
    }

    private fun teardown(s: Session) {
        s.capturer.release()
        s.subtitles?.close()
        s.subtitles = null
        s.voice?.close()
        s.voice = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) s.audio?.release()
        s.server.stop()
        s.hub.close()
        s.video.close()
        s.audioHub?.close()
        for (lock in s.wifiLocks) {
            try {
                if (lock.isHeld) lock.release()
            } catch (e: RuntimeException) {
                Log.w(TAG, "Wi-Fi lock release failed", e)
            }
        }
    }

    private fun tick() {
        val s = session ?: return
        val frames = s.hub.framesPublished + s.video.framesPublished
        val fps = (frames - s.lastFrames).toInt().coerceAtLeast(0)
        s.lastFrames = frames
        if (s.ticks % 3 == 0) s.addresses = NetUtils.lanAddresses()
        s.ticks++
        val viewers = s.server.viewerStats()
        ShareState.set(
            ShareStatus.Live(
                port = s.server.port,
                addresses = s.addresses,
                viewers = viewers.count,
                viewerAddresses = viewers.addresses,
                fps = fps,
                pin = s.pin,
                noPicture = frames == 0L && SystemClock.elapsedRealtime() - s.startedAt > NO_PICTURE_AFTER_MS,
                // Sound can die mid-session (e.g. Android's audio system restarts).
                sound = if (s.sound == SoundStatus.ON && s.audioHub?.isLive != true) SoundStatus.FAILED else s.sound,
                video = s.capturer.isVideo,
                translate = s.subtitles?.note,
            ),
        )
        val text = notificationText(s.addresses.firstOrNull(), s.server.port, viewers.count)
        if (text != s.notificationText) {
            s.notificationText = text
            updateNotification(text)
        }
    }

    private fun notificationText(address: String?, port: Int, viewers: Int): String = when {
        address == null -> "Connect to Wi-Fi so your TV or PC can find your phone 📶"
        viewers == 0 -> "On your TV or PC browser, go to $address:$port"
        viewers == 1 -> "📺 1 screen watching • $address:$port"
        else -> "📺 $viewers screens watching • $address:$port"
    }

    // ---------------------------------------------------------------- notification

    private fun enterForeground(withMicrophone: Boolean): Boolean = try {
        var type = 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        // The "microphone" type exists from Android 11; before that, background sound capture just works.
        if (withMicrophone && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification("Getting ready…"), type)
        true
    } catch (e: RuntimeException) {
        Log.e(TAG, "startForeground failed", e)
        false
    }

    private fun buildNotification(text: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Screen sharing", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shows while BroCast is sharing your screen"
                    setShowBadge(false)
                },
            )
        }
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            flags,
        )
        val stop = PendingIntent.getService(
            this, 1,
            Intent(this, ScreenShareService::class.java).setAction(ACTION_STOP),
            flags,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF7C5CFF.toInt())
            .setContentTitle("Sharing your screen 📡")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(open)
            .addAction(0, "■ Stop sharing", stop)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun updateNotification(text: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(text))
    }

    // ---------------------------------------------------------------- helpers

    private fun hasRecordAudioPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /**
     * Keeps Wi-Fi out of power saving while sharing. Power saving makes the phone's Wi-Fi nap
     * between beacons, which shows up on the TV as stutters and short freezes.
     * "Low latency" only works while BroCast is on screen (Android's rule), so "high performance"
     * is held too: it also covers the time you're in another app, like the one playing the video.
     */
    @Suppress("DEPRECATION")
    private fun acquireWifiLocks(): List<WifiManager.WifiLock> {
        val wifi = applicationContext.getSystemService(WifiManager::class.java) ?: return emptyList()
        val modes = mutableListOf(WifiManager.WIFI_MODE_FULL_HIGH_PERF)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) modes += WifiManager.WIFI_MODE_FULL_LOW_LATENCY
        return modes.mapNotNull { mode ->
            try {
                wifi.createWifiLock(mode, "BroCast:share:$mode").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            } catch (e: RuntimeException) {
                Log.w(TAG, "Wi-Fi lock $mode unavailable", e)
                null
            }
        }
    }

    @Suppress("DEPRECATION") // getRealSize: simplest way to read the screen size from a Service.
    private fun realScreenSize(): Point {
        val p = Point()
        getSystemService(DisplayManager::class.java)?.getDisplay(Display.DEFAULT_DISPLAY)?.getRealSize(p)
        return p
    }

    /** "Galaxy S24" style name for the TV page, falling back to the model number. */
    private fun deviceName(): String {
        val name = try {
            Settings.Global.getString(contentResolver, Settings.Global.DEVICE_NAME)
        } catch (e: RuntimeException) {
            null
        }
        return name?.takeIf { it.isNotBlank() } ?: Build.MODEL ?: "Phone"
    }

    companion object {
        private const val TAG = "BroCast"
        private const val CHANNEL_ID = "sharing"
        private const val NOTIFICATION_ID = 1
        private const val NO_PICTURE_AFTER_MS = 6_000L
        private const val ACTION_START = "com.brocast.app.action.START"
        private const val ACTION_STOP = "com.brocast.app.action.STOP"
        private const val ACTION_SET_QUALITY = "com.brocast.app.action.SET_QUALITY"
        private const val ACTION_SET_TRANSLATE = "com.brocast.app.action.SET_TRANSLATE"
        private const val EXTRA_ON = "on"
        private const val EXTRA_VOICES = "voices"
        private const val EXTRA_RESULT_CODE = "result_code"
        private const val EXTRA_DATA = "data"
        private const val EXTRA_QUALITY = "quality"

        /** Starts sharing with the permission result from the system's screen capture dialog. */
        fun start(context: Context, resultCode: Int, data: Intent): Boolean {
            val intent = Intent(context, ScreenShareService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_DATA, data)
            return try {
                ContextCompat.startForegroundService(context, intent)
                true
            } catch (e: RuntimeException) {
                Log.e(TAG, "Couldn't start service", e)
                false
            }
        }

        fun stop(context: Context) {
            try {
                context.startService(Intent(context, ScreenShareService::class.java).setAction(ACTION_STOP))
            } catch (e: RuntimeException) {
                Log.w(TAG, "Couldn't reach service to stop it", e)
                ShareState.set(ShareStatus.Idle())
            }
        }

        fun setQuality(context: Context, quality: Quality) {
            if (ShareState.status.value !is ShareStatus.Live) return
            try {
                context.startService(
                    Intent(context, ScreenShareService::class.java)
                        .setAction(ACTION_SET_QUALITY)
                        .putExtra(EXTRA_QUALITY, quality.name),
                )
            } catch (e: RuntimeException) {
                Log.w(TAG, "Couldn't change quality", e)
            }
        }

        /** English subtitles (and [voices]) on the phone on or off, right away if sharing. */
        fun setTranslate(context: Context, on: Boolean, voices: Boolean) {
            if (ShareState.status.value !is ShareStatus.Live) return
            try {
                context.startService(
                    Intent(context, ScreenShareService::class.java)
                        .setAction(ACTION_SET_TRANSLATE)
                        .putExtra(EXTRA_ON, on)
                        .putExtra(EXTRA_VOICES, voices),
                )
            } catch (e: RuntimeException) {
                Log.w(TAG, "Couldn't switch the subtitles", e)
            }
        }
    }
}
