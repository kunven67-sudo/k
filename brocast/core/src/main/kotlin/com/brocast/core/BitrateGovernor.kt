package com.brocast.core

import kotlin.math.max
import kotlin.math.min

/**
 * Picks how many bits per second the phone's video encoder should use, from how long frames are
 * waiting to go out to the TVs. That wait is the best Wi-Fi meter there is: on a link that keeps
 * up it stays near zero, and it grows the moment the encoder makes more than the Wi-Fi can carry
 * (a busy anime fight scene, someone else downloading, the TV moving out of range).
 *
 * Down fast (frames waiting = the picture is about to stutter), up slowly (only after the Wi-Fi
 * has kept up for a while), the same idea video calls use. Never below [minBps], so the picture
 * stays watchable, and never above [maxBps], the quality picked on the phone.
 */
class BitrateGovernor(
    maxBps: Int,
    private val clock: () -> Long = ::monotonicMs,
) {
    @Volatile
    var maxBps: Int = maxBps.coerceAtLeast(MIN_FLOOR)
        private set

    val minBps: Int get() = max(MIN_FLOOR, maxBps * FLOOR_PERCENT / 100)

    @Volatile
    var current: Int = this.maxBps
        private set

    private var lastDownAt = NEVER
    private var lastUpAt = NEVER
    private var calmSince = NEVER

    /** A new top quality (picked on the phone). Starts from it again. */
    @Synchronized
    fun reset(newMaxBps: Int = maxBps) {
        maxBps = newMaxBps.coerceAtLeast(MIN_FLOOR)
        current = maxBps
        lastDownAt = NEVER
        lastUpAt = NEVER
        calmSince = NEVER
    }

    /**
     * Called for every frame. [waitMs] is the longest any frame has been waiting for any viewer
     * right now (0 when nothing waits), [skipped] true when a viewer just had to skip frames.
     * Returns the new bitrate when it changes, null when it stays.
     */
    @Synchronized
    fun update(waitMs: Long, skipped: Boolean, viewers: Int): Int? {
        val now = clock()
        if (viewers <= 0) {
            calmSince = NEVER
            return null
        }
        if (skipped || waitMs >= CONGESTED_MS) {
            calmSince = NEVER
            // Give the encoder a moment to act on the last change before cutting again.
            if (lastDownAt != NEVER && now - lastDownAt < DOWN_GAP_MS) return null
            lastDownAt = now
            val factor = if (skipped) SKIP_FACTOR else SLOW_FACTOR
            return change(max(minBps, (current * factor).toInt()))
        }
        if (waitMs > CALM_MS) {
            calmSince = NEVER // a little backed up: hold where we are
            return null
        }
        if (calmSince == NEVER) calmSince = now
        if (current >= maxBps) return null
        val calmLongEnough = now - calmSince >= UP_AFTER_CALM_MS
        val notRightAfterCut = lastDownAt == NEVER || now - lastDownAt >= UP_AFTER_DOWN_MS
        val notRightAfterRaise = lastUpAt == NEVER || now - lastUpAt >= UP_GAP_MS
        if (!calmLongEnough || !notRightAfterCut || !notRightAfterRaise) return null
        lastUpAt = now
        return change(min(maxBps, max(current + UP_STEP_MIN, (current * UP_FACTOR).toInt())))
    }

    private fun change(next: Int): Int? {
        if (next == current) return null
        current = next
        return next
    }

    companion object {
        private const val NEVER = Long.MIN_VALUE

        /** Frames waiting this long: the Wi-Fi isn't keeping up. */
        const val CONGESTED_MS = 250L

        /** Frames waiting at most this long: the Wi-Fi keeps up fine. */
        const val CALM_MS = 70L

        const val DOWN_GAP_MS = 700L
        const val UP_AFTER_CALM_MS = 3_000L
        const val UP_AFTER_DOWN_MS = 5_000L
        const val UP_GAP_MS = 2_000L

        const val SLOW_FACTOR = 0.75
        const val SKIP_FACTOR = 0.6
        const val UP_FACTOR = 1.15
        const val UP_STEP_MIN = 250_000

        /** Never below this share of the picked quality... */
        const val FLOOR_PERCENT = 30

        /** ...nor below this, whatever the quality. */
        const val MIN_FLOOR = 800_000
    }
}
