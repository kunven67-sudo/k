package com.brocast.app

import android.content.Context
import androidx.core.content.edit
import java.security.SecureRandom

enum class Quality(
    val emoji: String,
    val label: String,
    val description: String,
    /** Longest side of the pictures (JPEG mode) sent to the TV, in pixels. */
    val maxLongSide: Int,
    val jpegQuality: Int,
    val frameIntervalMs: Long,
    /** Video mode: longest side, bits per second and frames per second. */
    val videoLongSide: Int,
    val videoBitrate: Int,
    val videoFps: Int,
) {
    SAVER("🔋", "Saver", "Easy on Wi-Fi and battery. Pick this if it's laggy.", 960, 60, 50, 1280, 2_500_000, 30),
    BALANCED("⚖️", "Balanced", "Smooth and clear. Best for most stuff.", 1280, 70, 33, 1920, 6_000_000, 30),
    SHARP("💎", "Sharp", "Extra smooth (60 fps) and detailed. Needs strong Wi-Fi.", 1920, 80, 33, 1920, 12_000_000, 60);

    companion object {
        fun fromName(name: String?): Quality = entries.firstOrNull { it.name == name } ?: BALANCED
    }
}

class ShareSettings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("brocast", Context.MODE_PRIVATE)

    var quality: Quality
        get() = Quality.fromName(prefs.getString(KEY_QUALITY, null))
        set(value) = prefs.edit { putString(KEY_QUALITY, value.name) }

    var pinEnabled: Boolean
        get() = prefs.getBoolean(KEY_PIN_ENABLED, false)
        set(value) = prefs.edit { putBoolean(KEY_PIN_ENABLED, value) }

    val pin: String
        get() = prefs.getString(KEY_PIN, null) ?: newPin()

    /** Random per install; mixed into the PIN cookie so it can't be guessed from the PIN alone. */
    val salt: String
        get() = prefs.getString(KEY_SALT, null) ?: randomString(16).also { prefs.edit { putString(KEY_SALT, it) } }

    var soundEnabled: Boolean
        get() = prefs.getBoolean(KEY_SOUND, true)
        set(value) = prefs.edit { putBoolean(KEY_SOUND, value) }

    var askedForNotifications: Boolean
        get() = prefs.getBoolean(KEY_ASKED_NOTIFICATIONS, false)
        set(value) = prefs.edit { putBoolean(KEY_ASKED_NOTIFICATIONS, value) }

    fun newPin(): String {
        val random = SecureRandom()
        var pin: String
        do {
            // padStart, not "%04d": format() would use Arabic/Persian digits on some phones.
            pin = random.nextInt(10_000).toString().padStart(4, '0')
        } while (pin.toSet().size == 1 || pin in OBVIOUS_PINS) // no 0000 / 1234 style PINs
        prefs.edit { putString(KEY_PIN, pin) }
        return pin
    }

    private fun randomString(bytes: Int): String {
        val data = ByteArray(bytes).also { SecureRandom().nextBytes(it) }
        return data.joinToString("") { (it.toInt() and 0xff).toString(16).padStart(2, '0') }
    }

    private companion object {
        const val KEY_QUALITY = "quality"
        const val KEY_PIN_ENABLED = "pin_enabled"
        const val KEY_PIN = "pin"
        const val KEY_SALT = "salt"
        const val KEY_ASKED_NOTIFICATIONS = "asked_notifications"
        const val KEY_SOUND = "sound"
        val OBVIOUS_PINS = setOf("1234", "4321", "0123", "1212", "6969", "1004", "2580", "0852")
    }
}
