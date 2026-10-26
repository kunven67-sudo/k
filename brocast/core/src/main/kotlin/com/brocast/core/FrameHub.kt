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

    fun publish(jpeg: ByteArray, width: Int, height: Int) {
        lock.withLock {
            if (isClosed) return
            latest = Frame(nextSeq++, jpeg, width, height)
            framesPublished++
            changed.signalAll()
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
