package com.brocast.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.VisibleForTesting
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.brocast.app.ui.BroCastTheme
import com.brocast.app.ui.AppPicker
import com.brocast.app.ui.HomeScreen
import com.brocast.app.ui.WatchApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    companion object {
        /** Tests turn this off so they can check the Start button on its own. */
        @VisibleForTesting
        var autoStart = true

        /** BroCast 1.0. Its signing key is gone, so 2.0 is a separate app and offers to remove it. */
        const val OLD_PACKAGE = "com.brocast.app"

        private val VIDEO_WORDS = listOf(
            "anime", "crunchy", "funimation", "hidive", "netflix", "youtube", "bilibili", "iqiyi", "viki", "tubi",
            "pluto", "aniyomi", "dantotsu", "tachi", "prime video", "disney", "hulu", "video", "tv", "stream", "movie",
        )
    }

    private lateinit var settings: ShareSettings
    private var quality by mutableStateOf(Quality.BALANCED)
    private var pinEnabled by mutableStateOf(false)
    private var pin by mutableStateOf("")
    private var soundEnabled by mutableStateOf(true)
    private var wifiAddresses by mutableStateOf(listOf<String>())
    private var oldAppInstalled by mutableStateOf(false)
    private var translateEnabled by mutableStateOf(false)
    private var voicesEnabled by mutableStateOf(true)
    private var overlayAllowed by mutableStateOf(false)
    private var watchAppLabel by mutableStateOf<String?>(null)
    private var pickingApp by mutableStateOf(false)
    private var pickerApps by mutableStateOf<List<WatchApp>?>(null)

    private val main = Handler(Looper.getMainLooper())

    // Waiting on Android's "display over other apps" page; BroCast comes back on its own once it's on.
    private var waitingForOverlay = false
    private var startAfterOverlay = false
    private var leftForOverlay = false
    private var overlayAskedAt = 0L
    private val overlayCheck = object : Runnable {
        override fun run() {
            if (!waitingForOverlay) return
            if (Settings.canDrawOverlays(this@MainActivity)) {
                // Allowed: jump back here (apps with this permission may; Android 15+ also wants one of
                // its windows on screen, so a see-through dot shows for a moment), onResume carries on.
                val dot = showDot()
                try {
                    startActivity(
                        Intent(this@MainActivity, MainActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
                    )
                } catch (e: RuntimeException) {
                    // They come back by hand then.
                }
                if (dot != null) {
                    main.postDelayed({
                        try {
                            windowManager.removeView(dot)
                        } catch (e: RuntimeException) {
                            // already gone
                        }
                    }, 1500)
                }
            } else if (SystemClock.uptimeMillis() - overlayAskedAt < 3 * 60_000) {
                main.postDelayed(this, 400)
            }
        }
    }

    private val captureLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            ShareState.set(ShareStatus.Starting)
            if (!ScreenShareService.start(this, result.resultCode, data)) {
                ShareState.set(ShareStatus.Failed("Couldn't start sharing 😵 Try again?"))
            } else if (translateEnabled && Settings.canDrawOverlays(this)) {
                // Sharing one app (Android 14+): Android opens that app itself. Whole screen: BroCast is
                // still in front, so open the app the shows are watched on.
                main.postDelayed({
                    val s = ShareState.status.value
                    if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) &&
                        (s is ShareStatus.Live || s is ShareStatus.Starting)
                    ) {
                        openWatchApp()
                    }
                }, 1500)
            }
        } else {
            ShareState.set(ShareStatus.Idle("No worries, nothing was shared. Tap Start when you're ready."))
        }
    }

    // Whatever the answers, carry on to the screen capture prompt (no sound / no notification is fine).
    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { launchCapture() }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        settings = ShareSettings(this)
        quality = settings.quality
        pinEnabled = settings.pinEnabled
        pin = settings.pin
        soundEnabled = settings.soundEnabled
        translateEnabled = settings.translateEnabled
        watchAppLabel = settings.watchApp?.let(::appLabel)
        voicesEnabled = settings.voicesEnabled
        overlayAllowed = Settings.canDrawOverlays(this)

        setContent {
            BroCastTheme {
                val status by ShareState.status.collectAsStateWithLifecycle()

                // Keep the "you're not on Wi-Fi" hint fresh while the app is open.
                LaunchedEffect(Unit) {
                    repeatOnLifecycle(Lifecycle.State.STARTED) {
                        while (true) {
                            wifiAddresses = withContext(Dispatchers.IO) { NetUtils.lanAddresses() }
                            delay(3_000)
                        }
                    }
                }

                HomeScreen(
                    status = status,
                    wifiAddresses = wifiAddresses,
                    quality = quality,
                    pinEnabled = pinEnabled,
                    pin = pin,
                    soundEnabled = soundEnabled,
                    soundSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q,
                    onSoundEnabledChange = {
                        settings.soundEnabled = it
                        soundEnabled = it
                    },
                    onFixSoundPermission = ::openAppSettings,
                    onStart = ::onStartClicked,
                    onStop = { ScreenShareService.stop(this) },
                    onQualityChange = ::changeQuality,
                    onPinEnabledChange = {
                        settings.pinEnabled = it
                        pinEnabled = it
                    },
                    onNewPin = { pin = settings.newPin() },
                    onCopy = ::copyToClipboard,
                    oldAppInstalled = oldAppInstalled,
                    onRemoveOldApp = ::removeOldApp,
                    translateEnabled = translateEnabled,
                    overlayAllowed = overlayAllowed,
                    onTranslateChange = ::changeTranslate,
                    voicesEnabled = voicesEnabled,
                    watchAppLabel = watchAppLabel,
                    onChangeWatchApp = ::showAppPicker,
                    onVoicesChange = {
                        voicesEnabled = it
                        settings.voicesEnabled = it
                        ScreenShareService.setTranslate(this, translateEnabled && overlayAllowed, it)
                    },
                    onAllowOverlay = { askForOverlay(startAfter = true) },
                )
                if (pickingApp) {
                    AppPicker(pickerApps, onPick = ::pickWatchApp, onDismiss = { pickingApp = false })
                }
            }
        }

        // Opening BroCast from the home screen starts sharing right away: tap the icon,
        // tap Android's "Start", done. (Not on rotation, or when opened from the notification.)
        if (savedInstanceState == null && autoStart && intent?.action == Intent.ACTION_MAIN) onStartClicked()
    }

    override fun onResume() {
        super.onResume()
        oldAppInstalled = isInstalled(OLD_PACKAGE)
        // Back from Android's "display over other apps" page: subtitles start if it's allowed now.
        overlayAllowed = Settings.canDrawOverlays(this)
        ScreenShareService.setTranslate(this, translateEnabled && overlayAllowed, voicesEnabled)
        // (The first onResume right after asking is still before Android's page covers this one.)
        if (waitingForOverlay && leftForOverlay) {
            waitingForOverlay = false
            leftForOverlay = false
            main.removeCallbacks(overlayCheck)
            // Allowed: carry on starting. Not allowed: the card shows the Allow button.
            if (overlayAllowed && startAfterOverlay) onStartClicked()
        }
    }

    override fun onPause() {
        super.onPause()
        if (waitingForOverlay) leftForOverlay = true
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun changeTranslate(on: Boolean) {
        translateEnabled = on
        settings.translateEnabled = on
        if (on && !Settings.canDrawOverlays(this)) askForOverlay(startAfter = false)
        ScreenShareService.setTranslate(this, on && Settings.canDrawOverlays(this), voicesEnabled)
    }

    private fun showDot(): android.view.View? {
        val dot = android.view.View(applicationContext)
        val lp = android.view.WindowManager.LayoutParams(
            1, 1,
            android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            android.graphics.PixelFormat.TRANSLUCENT,
        )
        return try {
            windowManager.addView(dot, lp)
            dot
        } catch (e: RuntimeException) {
            null
        }
    }

    /** Opens Android's switch for it, then comes back by itself once it's on ([startAfter]: and starts sharing). */
    private fun askForOverlay(startAfter: Boolean) {
        waitingForOverlay = true
        leftForOverlay = false
        startAfterOverlay = startAfter
        overlayAskedAt = SystemClock.uptimeMillis()
        Toast.makeText(this, "Turn on BroCast 2 here, only once 👇", Toast.LENGTH_LONG).show()
        openOverlaySettings()
        main.removeCallbacks(overlayCheck)
        main.postDelayed(overlayCheck, 400)
    }

    // Android's own page with the "Allow display over other apps" switch for BroCast.
    private fun openOverlaySettings() {
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.fromParts("package", packageName, null)))
        } catch (e: ActivityNotFoundException) {
            try {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))
            } catch (e2: ActivityNotFoundException) {
                Toast.makeText(this, "Settings → Apps → BroCast 2 → Display over other apps", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun isInstalled(packageName: String): Boolean = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(packageName, 0)
        }
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    // Android shows its own "Uninstall this app?" box; the card goes away once it's gone (onResume).
    private fun removeOldApp() {
        try {
            startActivity(Intent(Intent.ACTION_DELETE, Uri.fromParts("package", OLD_PACKAGE, null)))
        } catch (e: ActivityNotFoundException) {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", OLD_PACKAGE, null)))
            } catch (e2: ActivityNotFoundException) {
                Toast.makeText(this, "Hold the old BroCast icon and pick Uninstall", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun onStartClicked() {
        val status = ShareState.status.value
        if (status is ShareStatus.Live || status is ShareStatus.Starting) return
        // English subtitles need Android's "display over other apps" OK, once. BroCast comes back
        // by itself as soon as it's switched on, and carries on.
        if (translateEnabled && !Settings.canDrawOverlays(this)) {
            askForOverlay(startAfter = true)
            return
        }
        val ask = mutableListOf<String>()
        // Notifications: asked once, so the Stop button can show in the notification. Never nag after that.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !granted(Manifest.permission.POST_NOTIFICATIONS) &&
            !settings.askedForNotifications
        ) {
            settings.askedForNotifications = true
            ask += Manifest.permission.POST_NOTIFICATIONS
        }
        // Sound: Android calls capturing other apps' sound "record audio".
        if (soundEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !granted(Manifest.permission.RECORD_AUDIO)) {
            ask += Manifest.permission.RECORD_AUDIO
        }
        if (ask.isEmpty()) launchCapture() else permissionLauncher.launch(ask.toTypedArray())
    }

    private fun granted(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun openAppSettings() {
        try {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Open Settings → Apps → BroCast → Permissions", Toast.LENGTH_LONG).show()
        }
    }

    private fun launchCapture() {
        try {
            val manager = getSystemService(MediaProjectionManager::class.java)
            captureLauncher.launch(manager.createScreenCaptureIntent())
        } catch (e: ActivityNotFoundException) {
            ShareState.set(ShareStatus.Failed("This phone doesn't allow screen capture 😢"))
        } catch (e: RuntimeException) {
            // Some modified Androids throw here (e.g. capture blocked by a work profile policy).
            ShareState.set(ShareStatus.Failed("This phone blocked screen capture 😢 (${e.javaClass.simpleName})"))
        }
    }

    /** Opens the app the shows are watched on, or asks which one it is (first time). */
    private fun openWatchApp() {
        val launch = settings.watchApp?.let { packageManager.getLaunchIntentForPackage(it) }
        if (launch == null) {
            showAppPicker()
            return
        }
        try {
            startActivity(launch)
        } catch (e: ActivityNotFoundException) {
            showAppPicker()
        }
    }

    private fun showAppPicker() {
        pickingApp = true
        if (pickerApps != null) return
        lifecycleScope.launch {
            pickerApps = withContext(Dispatchers.IO) { launchableApps() }
        }
    }

    private fun pickWatchApp(app: WatchApp) {
        pickingApp = false
        settings.watchApp = app.packageName
        watchAppLabel = app.label
        val s = ShareState.status.value
        if (s is ShareStatus.Live || s is ShareStatus.Starting) openWatchApp()
    }

    private fun appLabel(pkg: String): String? = try {
        @Suppress("DEPRECATION")
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
        null
    }

    // Apps on the home screen, video apps first.
    private fun launchableApps(): List<WatchApp> {
        val pm = packageManager
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        val found = pm.queryIntentActivities(home, 0)
        return found
            .filter { it.activityInfo.packageName != packageName }
            .distinctBy { it.activityInfo.packageName }
            .map { info ->
                val icon = try {
                    info.loadIcon(pm).toBitmap(96, 96).asImageBitmap()
                } catch (e: RuntimeException) {
                    null
                }
                WatchApp(info.loadLabel(pm).toString(), info.activityInfo.packageName, icon)
            }
            .sortedWith(compareBy({ !looksLikeVideoApp(it) }, { it.label.lowercase() }))
    }

    private fun looksLikeVideoApp(app: WatchApp): Boolean {
        val name = (app.label + " " + app.packageName).lowercase()
        return VIDEO_WORDS.any { it in name }
    }

    private fun changeQuality(newQuality: Quality) {
        quality = newQuality
        settings.quality = newQuality
        ScreenShareService.setQuality(this, newQuality)
    }

    private fun copyToClipboard(text: String) {
        getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("BroCast address", text))
        // Android 13+ shows its own "Copied" bubble.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            Toast.makeText(this, "Copied! 📋", Toast.LENGTH_SHORT).show()
        }
    }
}
