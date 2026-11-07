package com.brocast.core

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Holds the newest JPEG frame and lets any number of viewer threads wait for a newer one.
 *
 * Only the latest frame is kept, so a slow screen simply skips frames instead of
 * building up a delay.
 */
class FrameHub {

    class Frame(val seq: Long, val jpeg: ByteArray, val width: Int, val height: Int)

    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private var latest: Frame? = null
    private var nextSeq = 1L

    @Volatile
    var isClosed = false
        private set

    /** True while the phone is actually capturing its screen. */
    @Volatile
    var isLive = false
        private set

    @Volatile
    var framesPublished = 0L
        private set

    /** True while the TVs hold the current picture: new frames wait in [held] until unfreeze. */
    @Volatile
    var isFrozen = false
        private set
    private var held: Frame? = null

    fun publish(jpeg: ByteArray, width: Int, height: Int) {
        lock.withLock {
            if (isClosed) return
            framesPublished++
            val frame = Frame(nextSeq++, jpeg, width, height)
            if (isFrozen) {
                held = frame
                return
            }
            latest = frame
            changed.signalAll()
        }
    }

    /**
     * Freeze ([on] true): viewers keep the picture they have. Unfreeze: the newest frame made in
     * the meantime goes out right away (a still screen might not make another one for a while).
     */
    fun setFrozen(on: Boolean) {
        lock.withLock {
            if (isClosed || on == isFrozen) return
            isFrozen = on
            if (!on) {
                held?.let { latest = it }
                held = null
                changed.signalAll()
            }
        }
    }

    fun latest(): Frame? = lock.withLock { latest }

    fun setLive(live: Boolean) {
        lock.withLock {
            isLive = live && !isClosed
            changed.signalAll()
        }
    }

    /**
     * Waits up to [timeoutMs] for a frame with a sequence number above [afterSeq].
     * Returns null on timeout, when the hub is closed, or when the thread is interrupted.
     */
    fun awaitNewer(afterSeq: Long, timeoutMs: Long): Frame? {
        var nanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs)
        lock.withLock {
            try {
                while (!isClosed) {
                    val frame = latest
                    if (frame != null && frame.seq > afterSeq) return frame
                    if (nanos <= 0L) return null
                    nanos = changed.awaitNanos(nanos)
                }
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
            return null
        }
    }

    fun close() {
        lock.withLock {
            isClosed = true
            isLive = false
            changed.signalAll()
        }
    }
}
