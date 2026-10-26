package com.brocast.core

import java.security.MessageDigest
import java.security.SecureRandom

/** PIN settings for one share session. [salt] is a per-install random string. */
class PinConfig(val pin: String, val salt: String) {
    /** Value of the cookie a browser gets after typing the right PIN. Changes when the PIN changes. */
    val token: String = sha256Hex("brocast-v1:$salt:$pin")
}

/**
 * Stops PIN guessing: after [maxFailures] wrong tries a device is locked out for [lockMillis].
 * A 4-digit PIN has only 10,000 options, so without this it could be brute-forced in seconds.
 */
class PinGuard(
    private val maxFailures: Int = 5,
    private val lockMillis: Long = 60_000,
    private val clock: () -> Long = { System.currentTimeMillis() },
) {
    private class Entry {
        var failures = 0
        var lockedUntil = 0L
    }

    private val entries = HashMap<String, Entry>()

    @Synchronized
    fun lockedForMillis(client: String): Long {
        val entry = entries[client] ?: return 0
        return (entry.lockedUntil - clock()).coerceAtLeast(0)
    }

    /** Records a wrong PIN. Returns how many tries are left; 0 means the client is now locked out. */
    @Synchronized
    fun recordFailure(client: String): Int {
        if (entries.size > 512) prune()
        val entry = entries.getOrPut(client) { Entry() }
        entry.failures++
        if (entry.failures >= maxFailures) {
            entry.failures = 0
            entry.lockedUntil = clock() + lockMillis
            return 0
        }
        return maxFailures - entry.failures
    }

    @Synchronized
    fun recordSuccess(client: String) {
        entries.remove(client)
    }

    private fun prune() {
        val now = clock()
        entries.entries.removeAll { it.value.lockedUntil <= now }
    }
}

internal fun sha256Hex(text: String): String =
    MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)).toHex()

internal fun randomHex(bytes: Int): String = ByteArray(bytes).also { SecureRandom().nextBytes(it) }.toHex()

internal fun ByteArray.toHex(): String {
    val digits = "0123456789abcdef"
    val sb = StringBuilder(size * 2)
    for (b in this) {
        val v = b.toInt() and 0xff
        sb.append(digits[v ushr 4]).append(digits[v and 0x0f])
    }
    return sb.toString()
}

/** Compares secrets without leaking how many leading characters matched. */
internal fun constantTimeEquals(a: String, b: String): Boolean =
    MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
