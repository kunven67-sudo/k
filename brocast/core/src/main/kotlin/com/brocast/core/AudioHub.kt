package com.brocast.core

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The last couple of seconds of phone sound, as small chunks of 16-bit little-endian PCM,
 * shared by any number of listeners. A listener that falls behind skips ahead instead of
 * drifting further and further out of sync with the picture.
 */
class AudioHub(
    val sampleRate: Int = 48_000,
    val channels: Int = 2,
    private val capacity: Int = 128,
) {
    class Chunk(val seq: Long, val pcm: ByteArray)

    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private val ring = arrayOfNulls<Chunk>(capacity)
    private var nextSeq = 1L

    @Volatile
    var isLive = false
        private set

    @Volatile
    var isClosed = false
        private set

    /** Sequence number of the newest chunk (0 if none yet). New listeners start from here. */
    val latestSeq: Long get() = lock.withLock { nextSeq - 1 }

    fun publish(pcm: ByteArray) {
        lock.withLock {
            if (isClosed) return
            val chunk = Chunk(nextSeq++, pcm)
            ring[(chunk.seq % capacity).toInt()] = chunk
            changed.signalAll()
        }
    }

    fun setLive(live: Boolean) {
        lock.withLock {
            isLive = live && !isClosed
            changed.signalAll()
        }
    }

    /**
     * Returns the chunks after [afterSeq], oldest first, waiting up to [timeoutMs] for at least
     * one. If more than [maxBehind] are waiting, only the newest [maxBehind] are returned.
     * Returns an empty list on timeout, close or interrupt.
     */
    fun awaitAfter(afterSeq: Long, timeoutMs: Long, maxBehind: Int): List<Chunk> {
        var nanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs)
        lock.withLock {
            try {
                while (!isClosed) {
                    val latest = nextSeq - 1
                    if (latest > afterSeq) {
                        val from = maxOf(afterSeq + 1, latest - capacity + 1, latest - maxBehind + 1, 1L)
                        val result = ArrayList<Chunk>((latest - from + 1).toInt())
                        for (seq in from..latest) {
                            ring[(seq % capacity).toInt()]?.takeIf { it.seq == seq }?.let(result::add)
                        }
                        return result
                    }
                    if (nanos <= 0L) return emptyList()
                    nanos = changed.awaitNanos(nanos)
                }
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
            return emptyList()
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
