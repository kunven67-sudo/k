package com.brocast.app

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [36], qualifiers = "w411dp-h915dp-xxhdpi")
class MainActivityTest {
    init {
        MainActivity.autoStart = false
    }

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private val app: Application get() = ApplicationProvider.getApplicationContext()

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
    }

    @Test
    fun idleScreenShowsBigStartButton() {
        compose.onNodeWithText("▶  Start sharing").assertIsDisplayed()
        compose.onNodeWithText("BroCast").assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/1-idle.png")
    }

    @Test
    fun liveScreenShowsAddressPinAndViewers() {
        compose.runOnUiThread {
            ShareState.set(
                ShareStatus.Live(
                    port = 8080,
                    addresses = listOf("192.168.1.23", "10.0.0.5"),
                    viewers = 1,
                    viewerAddresses = listOf("192.168.1.50"),
                    fps = 24,
                    pin = "4821",
                    noPicture = false,
                    sound = SoundStatus.ON,
                ),
            )
        }
        compose.onNodeWithText("192.168.1.23:8080").assertIsDisplayed()
        compose.onNodeWithText("🔊 Sound is on. On the TV/PC, press OK or click once to hear it.").assertExists()
        compose.onNodeWithText("LIVE").assertIsDisplayed()
        compose.onNodeWithText("⚡ 24 fps").assertIsDisplayed()
        compose.onNodeWithText("4821").assertExists()
        compose.onNodeWithText("Doesn't load? Try: 10.0.0.5:8080").assertExists()
        compose.onNodeWithText("📺 1 screen is watching").assertExists()
        compose.onNodeWithText("■  Stop sharing").assertExists()
        // How-to card is hidden while live; PIN switch is locked.
        compose.onNodeWithText("🧭 How it works").assertDoesNotExist()
        compose.onRoot().captureRoboImage("build/screenshots/2-live.png")
    }

    @Test
    fun tappingAddressCopiesLink() {
        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, listOf("192.168.1.23"), 0, emptyList(), 0, null, false))
        }
        compose.onNodeWithText("192.168.1.23:8080").performClick()
        val clipboard = app.getSystemService(android.content.ClipboardManager::class.java)
        assertEquals("http://192.168.1.23:8080", clipboard.primaryClip!!.getItemAt(0).text.toString())
    }

    @Test
    fun liveWithoutWifiAndNoPictureShowsHelp() {
        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, emptyList(), 0, emptyList(), 0, null, noPicture = true))
        }
        compose.onNodeWithText("📶 No Wi-Fi!").assertIsDisplayed()
        compose.onNodeWithText("👀 Waiting for a screen to connect…").assertExists()
        compose.onNodeWithText("😴 screen is still").assertExists()
        compose.onNodeWithText("😶", substring = true).assertExists()
    }

    @Test
    fun failedStateShowsMessageAndRetry() {
        compose.runOnUiThread { ShareState.set(ShareStatus.Failed("Android said no 😤")) }
        compose.onNodeWithText("Ugh, that didn't work 😩").assertIsDisplayed()
        compose.onNodeWithText("Android said no 😤").assertIsDisplayed()
        compose.onNodeWithText("▶  Start sharing").assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/3-failed.png")
    }

    @Test
    fun qualityChoiceIsSaved() {
        compose.onNodeWithText("Sharp").performScrollTo().performClick()
        assertEquals(Quality.SHARP, ShareSettings(app).quality)
        compose.onNodeWithText(Quality.SHARP.description).assertExists()
        compose.onNodeWithText("Saver").performClick()
        assertEquals(Quality.SAVER, ShareSettings(app).quality)
    }

    @Test
    fun pinSwitchShowsPinAndIsLockedWhileLive() {
        compose.onNodeWithText("Your PIN:").assertDoesNotExist()
        compose.onAllNodes(isToggleable())[2].performScrollTo().performClick()
        assertTrue(ShareSettings(app).pinEnabled)
        val pin = ShareSettings(app).pin
        assertTrue(pin.matches(Regex("\\d{4}")))
        compose.onNodeWithText(pin).performScrollTo().assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/4-pin.png")

        compose.onNodeWithText("🎲 New PIN").performClick()
        val newPin = ShareSettings(app).pin
        assertTrue(newPin != pin)
        compose.onNodeWithText(newPin).assertIsDisplayed()

        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, listOf("192.168.1.23"), 0, emptyList(), 0, newPin, false))
        }
        compose.onNodeWithText("🎲 New PIN").performScrollTo().assertIsNotEnabled()
        compose.onAllNodes(isToggleable())[2].assertIsNotEnabled()
        // Both the sound and the PIN switch are locked while sharing.
        compose.onAllNodesWithText("Stop sharing to change this.").assertCountEquals(2)
    }

    @Test
    fun startAsksForNotificationsOnceThenOpensCapturePrompt() {
        compose.onNodeWithText("▶  Start sharing").performClick()
        val shadow = shadowOf(compose.activity)
        // Android 13+: first tap asks for the notification permission (for the Stop button).
        val request = shadow.lastRequestedPermission
        assertNotNull(request)
        assertEquals(
            listOf(Manifest.permission.POST_NOTIFICATIONS, Manifest.permission.RECORD_AUDIO),
            request!!.requestedPermissions.toList(),
        )
        assertTrue(ShareSettings(app).askedForNotifications)

        // Answer "deny" to both: we still continue to the screen capture prompt.
        compose.runOnUiThread {
            compose.activity.onRequestPermissionsResult(
                request.requestCode,
                request.requestedPermissions,
                IntArray(request.requestedPermissions.size) { android.content.pm.PackageManager.PERMISSION_DENIED },
            )
        }
        compose.waitForIdle()
        val capture = shadow.nextStartedActivityForResult
        assertNotNull("screen capture prompt should open", capture)
        val status = ShareState.status.value
        assertFalse(status is ShareStatus.Failed)
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [36], qualifiers = "w411dp-h915dp-xxhdpi")
class MainActivitySoundTest {
    init {
        MainActivity.autoStart = false
    }

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private val app: Application get() = ApplicationProvider.getApplicationContext()

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
    }

    @Test
    fun soundSwitchIsSavedAndSkipsTheRecordAudioQuestion() {
        compose.onNodeWithText("🔊 Sound on the TV").assertIsDisplayed()
        compose.onNodeWithText("record audio", substring = true).assertExists()
        compose.onAllNodes(isToggleable())[1].performScrollTo().performClick()
        assertFalse(ShareSettings(app).soundEnabled)
        compose.onNodeWithText("record audio", substring = true).assertDoesNotExist()

        // Sound off -> only the notification question.
        compose.onNodeWithText("▶  Start sharing").performClick()
        val request = shadowOf(compose.activity).lastRequestedPermission!!
        assertEquals(listOf(Manifest.permission.POST_NOTIFICATIONS), request.requestedPermissions.toList())
    }

    @Test
    fun recordAudioAlreadyGrantedGoesStraightToCapture() {
        shadowOf(app).grantPermissions(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
        compose.onNodeWithText("▶  Start sharing").performClick()
        val shadow = shadowOf(compose.activity)
        assertEquals(null, shadow.lastRequestedPermission)
        assertNotNull(shadow.nextStartedActivityForResult)
    }

    @Test
    fun soundStatusLinesAndFixItButton() {
        fun live(sound: SoundStatus) = compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, listOf("192.168.1.23"), 0, emptyList(), 0, null, false, sound))
        }
        live(SoundStatus.NO_PERMISSION)
        compose.onNodeWithText("🔇 No sound: Android's \"record audio\" permission is off.").assertExists()
        compose.onNodeWithText("Fix it").performClick()
        val settingsIntent = shadowOf(compose.activity).nextStartedActivity
        assertEquals(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, settingsIntent.action)
        assertEquals("package:${app.packageName}", settingsIntent.dataString)
        compose.onRoot().captureRoboImage("build/screenshots/6-no-sound-permission.png")

        live(SoundStatus.FAILED)
        compose.onNodeWithText("🔇 Android wouldn't hand over the sound this time. Stop and start again.").assertExists()
        live(SoundStatus.OFF)
        compose.onNodeWithText("🔇 Sound is off (you can turn it on below, after stopping).").assertExists()
        // Sound switch is locked while sharing.
        compose.onAllNodes(isToggleable())[1].performScrollTo().assertIsNotEnabled()
    }

    @Test
    @Config(sdk = [28])
    fun oldAndroidExplainsNoSound() {
        compose.onNodeWithText("Needs Android 10 or newer, sorry 😢 The picture still works.").assertExists()
        compose.onAllNodes(isToggleable())[1].assertIsNotEnabled()
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ScreenShareServiceTest {
    private val app: Application get() = ApplicationProvider.getApplicationContext()

    @Before
    fun setUp() {
        ShareState.set(ShareStatus.Starting)
    }

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
    }

    @Test
    fun badPermissionDataFailsGracefullyAndCleansUp() {
        // What ScreenShareService.start() sends, but with a permission result Android won't accept.
        assertTrue(ScreenShareService.start(app, android.app.Activity.RESULT_OK, Intent()))
        val started = shadowOf(app).nextStartedService
        assertNotNull(started)

        val controller = Robolectric.buildService(ScreenShareService::class.java, started).create()
        controller.startCommand(0, 1)

        val status = ShareState.status.value
        assertTrue("expected Failed, got $status", status is ShareStatus.Failed)
        // The foreground notification went up (with our icon/channel) and came back down.
        val nm = app.getSystemService(NotificationManager::class.java)
        assertNotNull(nm.getNotificationChannel("sharing"))
        assertEquals(0, nm.activeNotifications.size)
        assertTrue(shadowOf(controller.get()).isStoppedBySelf)
        controller.destroy()
        assertTrue(ShareState.status.value is ShareStatus.Failed)
    }

    @Test
    fun badPermissionDataWithSoundPermissionAlsoCleansUp() {
        shadowOf(app).grantPermissions(Manifest.permission.RECORD_AUDIO)
        assertTrue(ScreenShareService.start(app, android.app.Activity.RESULT_OK, Intent()))
        val controller = Robolectric.buildService(ScreenShareService::class.java, shadowOf(app).nextStartedService).create()
        controller.startCommand(0, 1)
        assertTrue(ShareState.status.value is ShareStatus.Failed)
        assertTrue(shadowOf(controller.get()).isStoppedBySelf)
        controller.destroy()
    }

    @Test
    fun stopWhenNotSharingIsHarmless() {
        ScreenShareService.stop(app)
        val started = shadowOf(app).nextStartedService
        val controller = Robolectric.buildService(ScreenShareService::class.java, started).create()
        controller.startCommand(0, 1)
        assertTrue(ShareState.status.value is ShareStatus.Idle)
        assertTrue(shadowOf(controller.get()).isStoppedBySelf)
        controller.destroy()
    }

    @Test
    fun qualityChangeIgnoredWhenNotLive() {
        ScreenShareService.setQuality(app, Quality.SHARP)
        assertEquals(null, shadowOf(app).nextStartedService)
    }
}

class ShareSettingsLogicTest {
    @Test
    fun qualityFallsBackToBalanced() {
        assertEquals(Quality.BALANCED, Quality.fromName(null))
        assertEquals(Quality.BALANCED, Quality.fromName("NOPE"))
        assertEquals(Quality.SHARP, Quality.fromName("SHARP"))
    }

    @Test
    fun qualityPresetsAreSane() {
        Quality.entries.forEach {
            assertTrue(it.maxLongSide in 640..1920)
            assertTrue(it.jpegQuality in 40..90)
            assertTrue(it.frameIntervalMs in 30..100)
        }
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [36], qualifiers = "w320dp-h640dp-xhdpi")
class SmallPhoneTest {
    init {
        MainActivity.autoStart = false
    }

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
    }

    @Test
    fun longestAddressFitsOnTinyPhone() {
        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8099, listOf("192.168.100.123"), 2, listOf("192.168.100.7", "192.168.100.9"), 30, "0852", false))
        }
        compose.onNodeWithText("192.168.100.123:8099").assertIsDisplayed()
        compose.onNodeWithText("📺 2 screens are watching").assertExists()
        compose.onRoot().captureRoboImage("build/screenshots/5-small-phone.png")
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class AutoStartTest {
    private val app: Application get() = ApplicationProvider.getApplicationContext()

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
        MainActivity.autoStart = false
    }

    @Test
    fun openingFromHomeScreenStartsSharingRightAway() {
        MainActivity.autoStart = true
        shadowOf(app).grantPermissions(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
        val launch = Intent(app, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        androidx.test.core.app.ActivityScenario.launch<MainActivity>(launch).use { scenario ->
            scenario.onActivity { activity ->
                // Android's "Start sharing?" prompt opens without touching any button in the app.
                assertNotNull(shadowOf(activity).nextStartedActivityForResult)
            }
        }
    }

    @Test
    fun openingFromTheNotificationDoesNotStartAgain() {
        MainActivity.autoStart = true
        val fromNotification = Intent(app, MainActivity::class.java)
        androidx.test.core.app.ActivityScenario.launch<MainActivity>(fromNotification).use { scenario ->
            scenario.onActivity { activity ->
                assertEquals(null, shadowOf(activity).nextStartedActivityForResult)
                assertEquals(null, shadowOf(activity).lastRequestedPermission)
            }
        }
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [36], qualifiers = "w411dp-h915dp-xxhdpi")
class VersionTwoTest {
    init {
        MainActivity.autoStart = false
    }

    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private val app: Application get() = ApplicationProvider.getApplicationContext()

    @After
    fun reset() {
        ShareState.set(ShareStatus.Idle())
    }

    @Test
    fun offersToRemoveTheOldBroCast() {
        compose.onNodeWithText("🧹  Remove the old BroCast").assertDoesNotExist()
        shadowOf(app.packageManager).installPackage(PackageInfo().apply { packageName = MainActivity.OLD_PACKAGE })
        compose.activityRule.scenario.recreate()
        compose.onNodeWithText("👋 The old BroCast is still on your phone").assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/7-old-app.png")
        compose.onNodeWithText("🧹  Remove the old BroCast").performClick()
        val intent = shadowOf(app).nextStartedActivity
        assertEquals(Intent.ACTION_DELETE, intent.action)
        assertEquals("package:com.brocast.app", intent.dataString)
    }

    @Test
    fun liveCardSaysVideoOrPictures() {
        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, listOf("192.168.1.23"), 1, listOf("192.168.1.5"), 30, null, false, video = true))
        }
        compose.onNodeWithText("🎬 Sending smooth video").performScrollTo().assertIsDisplayed()
        compose.runOnUiThread {
            ShareState.set(ShareStatus.Live(8080, listOf("192.168.1.23"), 1, listOf("192.168.1.5"), 12, null, false, video = false))
        }
        compose.onNodeWithText("🖼️ Sending pictures (a screen that can't play the video is watching)").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun englishSubtitlesSwitchAsksForTheOverlayPermission() {
        compose.onNodeWithText("💬 English subtitles on this phone").performScrollTo().assertIsDisplayed()
        compose.onAllNodes(isToggleable())[0].performScrollTo().performClick()
        assertTrue(ShareSettings(app).translateEnabled)
        // Android's "display over other apps" page for this app.
        val intent = shadowOf(compose.activity).nextStartedActivity
        assertEquals(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, intent.action)
        assertEquals("package:${app.packageName}", intent.dataString)
        compose.onNodeWithText("Allow").performScrollTo().assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/8-subtitles-permission.png")

        // Allowed: back in the app, the tips show instead.
        org.robolectric.shadows.ShadowSettings.setCanDrawOverlays(true)
        compose.activityRule.scenario.recreate()
        compose.onNodeWithText("Allow").assertDoesNotExist()
        compose.onNodeWithText("A single app", substring = true).performScrollTo().assertIsDisplayed()
        compose.onRoot().captureRoboImage("build/screenshots/9-subtitles-on.png")
        // English voices: on by default, its own switch right under it.
        assertTrue(ShareSettings(app).voicesEnabled)
        compose.onNodeWithText("🗣️ Say them out loud too").performScrollTo().assertIsDisplayed()
        compose.onAllNodes(isToggleable())[1].performScrollTo().performClick()
        assertFalse(ShareSettings(app).voicesEnabled)
        compose.onAllNodes(isToggleable())[0].performScrollTo().performClick()
        assertFalse(ShareSettings(app).translateEnabled)
        compose.onNodeWithText("A single app", substring = true).assertDoesNotExist()
    }

    @Test
    fun liveCardShowsTheSubtitleLanguage() {
        compose.runOnUiThread {
            ShareState.set(
                ShareStatus.Live(8080, listOf("192.168.1.23"), 0, emptyList(), 6, null, false, video = false, translate = "Spanish → English ✅"),
            )
        }
        compose.onNodeWithText("💬 English subtitles: Spanish → English ✅").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("🖼️ Sending pictures (English subtitles are on)").assertExists()
    }

    @Test
    fun englishVoicesAreToldApartByName() {
        val genderOf = com.brocast.app.translate.SubtitleVoice.Companion::genderOf
        assertEquals(true, genderOf("en-us-x-sfg-local"))
        assertEquals(true, genderOf("en-us-x-tpf-network"))
        assertEquals(false, genderOf("en-us-x-iom-local"))
        assertEquals(false, genderOf("en-gb-x-rjs-local"))
        assertEquals(true, genderOf("en-US-SMTf00"))
        assertEquals(false, genderOf("en-US-SMTm00"))
        assertEquals(true, genderOf("English Female"))
        assertEquals(false, genderOf("English male 2"))
        assertEquals(null, genderOf("en-us-x-abc-local"))
        assertEquals(null, genderOf("en-US-language"))
    }

    @Test
    fun newIdAndName() {
        assertEquals("com.brocast.live", app.packageName)
        assertEquals("BroCast 2", app.getString(R.string.app_name))
    }

    @Test
    fun videoSizesSuitEncoders() {
        // Phone screens in both directions, all three quality levels.
        for ((w, h) in listOf(1080 to 2400, 2400 to 1080, 1440 to 3200, 720 to 1600, 1080 to 1920)) {
            for (q in Quality.entries) {
                val (vw, vh) = VideoEncoder.sizeFor(w, h, q.videoLongSide)
                assertEquals(0, vw % 16)
                assertEquals(0, vh % 16)
                assertTrue("$vw x $vh fits ${q.videoLongSide}", maxOf(vw, vh) <= q.videoLongSide)
                // Same shape (within the rounding to 16).
                assertTrue(kotlin.math.abs(vw.toDouble() / vh - w.toDouble() / h) < 0.03)
            }
        }
        assertEquals(1920 to 864, VideoEncoder.sizeFor(2400, 1080, 1920))
        assertEquals(16 to 16, VideoEncoder.sizeFor(1, 1, 1920))
    }

    @Test
    fun qualityLevelsGoUp() {
        val q = Quality.entries
        assertTrue(q.zipWithNext().all { (a, b) -> b.videoBitrate > a.videoBitrate && b.videoFps >= a.videoFps })
        assertTrue(q.all { it.videoBitrate in 1_000_000..20_000_000 && it.videoFps in 24..60 })
    }
}
