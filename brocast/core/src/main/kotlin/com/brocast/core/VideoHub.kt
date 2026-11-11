package com.brocast.core

import java.util.ArrayDeque
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Takes the phone's H.264 video (one encoded frame at a time) and hands it to every watching
 * browser as fragmented MP4.
 *
 * Every viewer gets its own small queue, so one slow TV never holds up the encoder or the other
 * screens. When a queue gets too long (Wi-Fi can't keep up), the frames waiting in it are
 * thrown away and that viewer jumps straight to the next key frame: the picture skips ahead
 * instead of freezing or falling further and further behind.
 */
class VideoHub(
    private val maxQueueFrames: Int = 24,
    private val maxQueueBytes: Long = 4_000_000,
    private val maxGopBytes: Long = 8_000_000,
    private val clock: () -> Long = ::monotonicMs,
) {
    /** What the browser needs before any frame: codec name, size and the MP4 "init segment". */
    class Format(val generation: Int, val width: Int, val height: Int, val codec: String, val init: ByteArray)

    /** One frame for a [Tap]: the plain H.264 pieces plus the settings to decode them ([generation] changes with them). */
    class TapFrame(
        val generation: Int,
        val width: Int,
        val height: Int,
        val sps: ByteArray,
        val pps: ByteArray,
        val nals: List<ByteArray>,
        val ptsUs: Long,
        val keyFrame: Boolean,
    )

    /** Gets every frame as it's published (on the publishing thread: return quickly). */
    fun interface Tap {
        fun onFrame(frame: TapFrame)
    }

    /** Also hands every frame to this (e.g. to read subtitles from the video), or null. */
    @Volatile
    var tap: Tap? = null

    sealed interface Message

    /** Sent before the first frame and whenever the video changes size (e.g. the phone rotated). */
    class InitMessage(val format: Format) : Message

    /** One frame, ready to append. [decodeTime] is in 90 kHz ticks. */
    class FrameMessage(val data: ByteArray, val keyFrame: Boolean, val decodeTime: Long) : Message

    private val lock = ReentrantLock()
    private var format: Format? = null
    private var sps: ByteArray? = null
    private var pps: ByteArray? = null
    private var width = 0
    private var height = 0
    private var generation = 0
    private var basePtsUs = NO_TIME
    private var lastDecodeTime = NO_TIME
    private var lastDuration = DEFAULT_DURATION
    private var sequence = 0

    // Frames since the last key frame, so a new viewer gets a picture right away (even on a still screen).
    private val gop = ArrayList<FrameMessage>()
    private var gopBytes = 0L
    private var gopValid = false

    private val clients = LinkedHashSet<Client>()
    private var lastKeyRequestAt = NO_TIME

    /** Asks the encoder for a key frame. Must not block (it's called from the hub's own threads). */
    @Volatile
    var keyFrameRequester: (() -> Unit)? = null

    /** True while the phone's video encoder is running. */
    @Volatile
    var isLive = false
        private set

    @Volatile
    var isClosed = false
        private set

    @Volatile
    var framesPublished = 0L
        private set

    /** [monotonicMs] time of the newest frame, 0 if none yet. */
    @Volatile
    var lastFrameAt = 0L
        private set

    /** How long ago the newest frame came in, in milliseconds (-1 if none yet). */
    val millisSinceLastFrame: Long get() = lastFrameAt.let { if (it == 0L) -1L else clock() - it }

    val currentFormat: Format? get() = lock.withLock { format }
    val clientCount: Int get() = lock.withLock { clients.size }

    fun setLive(live: Boolean) {
        lock.withLock {
            isLive = live && !isClosed
            for (c in clients) c.ready.signalAll()
        }
    }

    /** New stream (encoder started or restarted at a new size). [config] holds the SPS + PPS in Annex B form. */
    fun configure(width: Int, height: Int, config: ByteArray) {
        val nals = H264.splitAnnexB(config)
        val sps = nals.firstOrNull { H264.nalType(it) == H264.NAL_SPS }
        val pps = nals.firstOrNull { H264.nalType(it) == H264.NAL_PPS }
        require(sps != null && pps != null && sps.size >= 4) { "Config needs an SPS and a PPS" }
        lock.withLock {
            // Same settings again (some encoders report them twice): nothing changes for the viewers.
            if (format != null && width == this.width && height == this.height && sps.contentEquals(this.sps) &&
                pps.contentEquals(this.pps)
            ) {
                return
            }
            configureLocked(width, height, sps, pps)
        }
    }

    /**
     * One encoded frame in Annex B form. [ptsUs] is the capture time in microseconds (any clock
     * that only goes forward). Frames before the first [configure] are dropped.
     */
    fun publish(annexB: ByteArray, ptsUs: Long, keyFrame: Boolean) {
        var wantKey = false
        var forTap: TapFrame? = null
        val t = tap
        lock.withLock {
            if (isClosed) return
            var newSps: ByteArray? = null
            var newPps: ByteArray? = null
            val body = ArrayList<ByteArray>(2)
            for (nal in H264.splitAnnexB(annexB)) {
                when (H264.nalType(nal)) {
                    H264.NAL_SPS -> newSps = nal
                    H264.NAL_PPS -> newPps = nal
                    H264.NAL_AUD -> Unit
                    else -> body += nal
                }
            }
            // Some encoders repeat the SPS/PPS before key frames. Only a real change needs a new init segment.
            if (newSps != null || newPps != null) {
                val s = newSps ?: sps
                val p = newPps ?: pps
                if (s != null && p != null && s.size >= 4 && (!s.contentEquals(sps) || !p.contentEquals(pps))) {
                    configureLocked(width, height, s, p)
                }
            }
            val fmt = format ?: return
            if (body.isEmpty()) return
            val isKey = keyFrame || body.any { H264.nalType(it) == H264.NAL_IDR }
            if (t != null) {
                val s = sps
                val p = pps
                if (s != null && p != null) forTap = TapFrame(fmt.generation, width, height, s, p, body, ptsUs, isKey)
            }

            if (basePtsUs == NO_TIME) basePtsUs = ptsUs
            var decodeTime = ((ptsUs - basePtsUs) * 9 / 100).coerceAtLeast(0L)
            if (lastDecodeTime != NO_TIME) {
                // Browsers need every frame later than the one before.
                if (decodeTime <= lastDecodeTime) decodeTime = lastDecodeTime + 1
                lastDuration = (decodeTime - lastDecodeTime).coerceIn(1L, MAX_DURATION.toLong()).toInt()
            }
            lastDecodeTime = decodeTime
            sequence++
            val frame = FrameMessage(Mp4.fragment(sequence, decodeTime, lastDuration, isKey, body), isKey, decodeTime)
            framesPublished++
            lastFrameAt = clock()

            if (isKey) {
                gop.clear()
                gopBytes = 0
                gopValid = true
            }
            if (gopValid) {
                gop += frame
                gopBytes += frame.data.size
                if (gopBytes > maxGopBytes || gop.size > MAX_GOP_FRAMES) {
                    gop.clear()
                    gopBytes = 0
                    gopValid = false
                    wantKey = true
                }
            }
            for (c in clients) if (offer(c, frame, fmt)) wantKey = true
        }
        forTap?.let { t?.onFrame(it) }
        if (wantKey) requestKeyFrame()
    }

    /** A new viewer. It starts with the current init segment plus the frames since the last key frame. */
    fun openClient(): Client {
        val c = Client()
        var wantKey = false
        lock.withLock {
            if (isClosed) {
                c.closed = true
                return c
            }
            clients += c
            val fmt = format
            if (fmt != null && gopValid && gop.isNotEmpty()) {
                c.push(InitMessage(fmt))
                c.generation = fmt.generation
                for (f in gop) c.push(f)
                c.graceFrames = gop.size
                c.graceBytes = gopBytes
                c.waitingForKey = false
                // A long group of frames means a big catch-up burst for the next viewer too: start a fresh one.
                if (gop.size > FRESH_KEY_AFTER_FRAMES) wantKey = true
            } else {
                wantKey = true
            }
        }
        if (wantKey) requestKeyFrame()
        return c
    }

    /** Asks the encoder for a key frame, at most twice a second. */
    fun requestKeyFrame() {
        val requester = keyFrameRequester ?: return
        lock.withLock {
            val now = clock()
            if (lastKeyRequestAt != NO_TIME && now - lastKeyRequestAt < KEY_REQUEST_GAP_MS) return
            lastKeyRequestAt = now
        }
        try {
            requester()
        } catch (e: RuntimeException) {
            // The encoder may be restarting; the next request will get through.
        }
    }

    fun close() {
        lock.withLock {
            isClosed = true
            isLive = false
            for (c in clients) {
                c.closed = true
                c.ready.signalAll()
            }
            clients.clear()
            gop.clear()
        }
    }

    // ---------------------------------------------------------------- under the lock

    private fun configureLocked(width: Int, height: Int, sps: ByteArray, pps: ByteArray) {
        this.width = width
        this.height = height
        this.sps = sps
        this.pps = pps
        generation++
        format = Format(generation, width, height, H264.codecString(sps), Mp4.initSegment(width, height, sps, pps))
        // Frames from before can't be decoded with the new settings.
        gop.clear()
        gopBytes = 0
        gopValid = false
    }

    /** Queues [frame] for [c]. Returns true if a key frame is needed. */
    private fun offer(c: Client, frame: FrameMessage, fmt: Format): Boolean {
        if (c.closed) return false
        if (c.generation != fmt.generation) {
            if (!frame.keyFrame) {
                c.waitingForKey = true
                c.dropped++
                return true
            }
            c.push(InitMessage(fmt))
            c.generation = fmt.generation
            c.waitingForKey = false
            c.push(frame)
            return false
        }
        if (c.waitingForKey) {
            if (!frame.keyFrame) {
                c.dropped++
                return false
            }
            c.waitingForKey = false
            c.push(frame)
            return false
        }
        if (c.frames >= maxQueueFrames + c.graceFrames || c.bytes + frame.data.size > maxQueueBytes + c.graceBytes) {
            // This screen's Wi-Fi can't keep up: skip what's waiting and continue from a key frame.
            c.dropMedia()
            if (frame.keyFrame) {
                c.push(frame)
                return false
            }
            c.waitingForKey = true
            c.dropped++
            return true
        }
        c.push(frame)
        return false
    }

    /** One watching browser. [next] hands out what to send, in order. */
    inner class Client internal constructor() : AutoCloseable {
        internal val ready = lock.newCondition()
        private val queue = ArrayDeque<Message>()
        internal var frames = 0
        internal var bytes = 0L
        internal var generation = -1
        internal var waitingForKey = true
        internal var graceFrames = 0
        internal var graceBytes = 0L

        @Volatile
        internal var closed = false

        /** Frames this viewer skipped because it was too far behind. */
        @Volatile
        var dropped = 0L
            internal set

        internal fun push(m: Message) {
            queue.addLast(m)
            if (m is FrameMessage) {
                frames++
                bytes += m.data.size
            }
            ready.signalAll()
        }

        internal fun dropMedia() {
            val it = queue.iterator()
            while (it.hasNext()) {
                val m = it.next()
                if (m is FrameMessage) {
                    it.remove()
                    dropped++
                }
            }
            frames = 0
            bytes = 0
            graceFrames = 0
            graceBytes = 0
        }

        /** Waits up to [timeoutMs] for the next thing to send. Null on timeout or once closed. */
        fun next(timeoutMs: Long): Message? {
            var nanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs)
            lock.withLock {
                try {
                    while (!closed && !isClosed) {
                        val m = queue.pollFirst()
                        if (m != null) {
                            if (m is FrameMessage) {
                                frames--
                                bytes -= m.data.size
                                if (graceFrames > 0) graceFrames--
                                graceBytes = (graceBytes - m.data.size).coerceAtLeast(0)
                            }
                            return m
                        }
                        if (nanos <= 0L) return null
                        nanos = ready.awaitNanos(nanos)
                    }
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
                return null
            }
        }

        val isOpen: Boolean get() = !closed && !isClosed

        override fun close() {
            lock.withLock {
                closed = true
                clients.remove(this)
                ready.signalAll()
            }
        }
    }

    private companion object {
        const val NO_TIME = Long.MIN_VALUE
        const val DEFAULT_DURATION = 3_000 // 1/30 s
        const val MAX_DURATION = 9_000 // 1/10 s: longer gaps are still screens, not slow frames
        const val MAX_GOP_FRAMES = 240
        const val FRESH_KEY_AFTER_FRAMES = 45
        const val KEY_REQUEST_GAP_MS = 500L
    }
}
