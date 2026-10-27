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
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.brocast.app.ui.BroCastTheme
import com.brocast.app.ui.HomeScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    companion object {
        /** Tests turn this off so they can check the Start button on its own. */
        @VisibleForTesting
        var autoStart = true

        /** BroCast 1.0. Its signing key is gone, so 2.0 is a separate app and offers to remove it. */
        const val OLD_PACKAGE = "com.brocast.app"
    }

    private lateinit var settings: ShareSettings
    private var quality by mutableStateOf(Quality.BALANCED)
    private var pinEnabled by mutableStateOf(false)
    private var pin by mutableStateOf("")
    private var soundEnabled by mutableStateOf(true)
    private var wifiAddresses by mutableStateOf(listOf<String>())
    private var oldAppInstalled by mutableStateOf(false)
    private var translateEnabled by mutableStateOf(false)
    private var overlayAllowed by mutableStateOf(false)

    private val captureLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            ShareState.set(ShareStatus.Starting)
            if (!ScreenShareService.start(this, result.resultCode, data)) {
                ShareState.set(ShareStatus.Failed("Couldn't start sharing 😵 Try again?"))
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
                    onAllowOverlay = ::openOverlaySettings,
                )
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
        ScreenShareService.setTranslate(this, translateEnabled && overlayAllowed)
    }

    private fun changeTranslate(on: Boolean) {
        translateEnabled = on
        settings.translateEnabled = on
        if (on && !Settings.canDrawOverlays(this)) openOverlaySettings()
        ScreenShareService.setTranslate(this, on && Settings.canDrawOverlays(this))
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
