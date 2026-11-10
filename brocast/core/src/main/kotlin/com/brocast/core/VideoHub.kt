package com.brocast.core

import java.util.ArrayDeque
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Takes the phone's H.264 video (one encoded frame at a time) and hands it to every watching
 * screen (a browser page or the BroCast PC app) as fragmented MP4.
 *
 * Every viewer gets its own queue, so one slow TV never holds up the encoder or the other screens.
 * Wi-Fi delivers in bursts and has hiccups of a few hundred milliseconds all the time, so a queue
 * rides those out: a frame may wait up to [maxQueueMs] before that viewer gives up on what's
 * waiting and continues from a fresh key frame (asked for right away, not at the next 2 s mark).
 *
 * Waiting frames also steer the encoder's bitrate ([bitrateListener], see [BitrateGovernor]):
 * when the Wi-Fi can't carry what the encoder makes (busy anime fights are the worst), the encoder
 * is asked for fewer bits until it can, so the queue never gets near [maxQueueMs] in the first
 * place. Skipping is the emergency brake, not the plan.
 */
class VideoHub(
    private val maxQueueMs: Long = 1_200,
    private val maxQueueBytes: Long = 8_000_000,
    private val maxGopBytes: Long = 8_000_000,
    private val clock: () -> Long = ::monotonicMs,
) {
    /** What the screen needs before any frame: codec name, size and the MP4 "init segment". */
    class Format(val generation: Int, val width: Int, val height: Int, val codec: String, val init: ByteArray)

    sealed interface Message

    /** Sent before the first frame and whenever the video changes size (e.g. the phone rotated). */
    class InitMessage(val format: Format) : Message

    /** One frame, ready to append. [decodeTime] and [duration] are in 90 kHz ticks. */
    class FrameMessage(val data: ByteArray, val keyFrame: Boolean, val decodeTime: Long, val duration: Int = 0) : Message

    private class Entry(val message: Message, val queuedAt: Long)

    private val lock = ReentrantLock()
    private var format: Format? = null
    private var sps: ByteArray? = null
    private var pps: ByteArray? = null
    private var width = 0
    private var height = 0
    private var generation = 0
    private var lastPtsUs = NO_TIME
    private var lastDecodeTime = NO_TIME
    private var lastDuration = DEFAULT_DURATION
    private var typicalDuration = DEFAULT_DURATION
    private var sequence = 0

    // Frames since the last key frame, so a new viewer gets a picture right away (even on a still screen).
    private val gop = ArrayList<FrameMessage>()
    private var gopBytes = 0L
    private var gopValid = false

    private val clients = LinkedHashSet<Client>()
    private var lastKeyRequestAt = NO_TIME
    private var lastKeyFrameAt = NO_TIME

    /** Asks the encoder for a key frame. Must not block (it's called from the hub's own threads). */
    @Volatile
    var keyFrameRequester: (() -> Unit)? = null

    /** Tells the encoder a new bitrate (bits per second). Must not block. */
    @Volatile
    var bitrateListener: ((Int) -> Unit)? = null

    /** Null until [setMaxBitrate]: then the hub steers the encoder's bitrate. */
    @Volatile
    private var governor: BitrateGovernor? = null

    /** The bitrate the encoder should be using right now (for a new encoder after a rotation), or 0 if not steered. */
    val targetBitrate: Int get() = governor?.current ?: 0

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

    /** Times a viewer had to skip ahead because its Wi-Fi couldn't keep up (for the stats). */
    @Volatile
    var skips = 0L
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

    /**
     * The quality picked on the phone (top bitrate). From now on the hub lowers the encoder's
     * bitrate when the Wi-Fi can't keep up and raises it back when it can. Starts at the top again.
     */
    fun setMaxBitrate(bps: Int) {
        val g = governor
        if (g == null) governor = BitrateGovernor(bps, clock) else g.reset(bps)
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
        var newRate: Int? = null
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

            // The timeline has no holes: every frame starts exactly where the one before ends.
            // Browsers treat a frame that comes more than twice "the last frame's length" late as a
            // break in the video and throw away everything up to the next key frame (up to 2 s on
            // a phone): that was the picture stopping on anime while the sound went on. Phones
            // make frames unevenly (24 fps video on a 60-165 Hz screen, dropped frames, a repeat
            // after 100 ms of still picture, a still screen for minutes), so the real gaps can't
            // be used as they are. Each frame lasts as long as the gap before it, kept within
            // 4-100 ms; anything outside that (the very first frame, frames read in a burst, the
            // first frame after a still screen) gets the usual frame length instead.
            val gap = if (lastPtsUs == NO_TIME) -1L else (ptsUs - lastPtsUs) * 9 / 100
            if (lastPtsUs == NO_TIME || ptsUs > lastPtsUs) lastPtsUs = ptsUs
            val duration = if (gap in MIN_DURATION..MAX_DURATION) {
                typicalDuration = ((typicalDuration * 7L + gap) / 8).toInt()
                gap.toInt()
            } else {
                typicalDuration
            }
            val decodeTime = if (lastDecodeTime == NO_TIME) 0L else lastDecodeTime + lastDuration
            lastDecodeTime = decodeTime
            lastDuration = duration
            sequence++
            framesPublished++
            val now = clock()
            lastFrameAt = now
            if (isKey) lastKeyFrameAt = now
            val frame = FrameMessage(Mp4.fragment(sequence, decodeTime, duration, isKey, body), isKey, decodeTime, duration)

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
            var skipped = false
            var waitMs = 0L
            for (c in clients) {
                when (offer(c, frame, fmt, now)) {
                    Offer.QUEUED -> Unit
                    Offer.NEEDS_KEY -> wantKey = true
                    Offer.SKIPPED -> {
                        wantKey = true
                        skipped = true
                    }
                    Offer.SKIPPED_TO_KEY -> skipped = true
                }
                waitMs = maxOf(waitMs, c.waitingMs(now))
            }
            newRate = governor?.update(waitMs, skipped, clients.size)
        }
        newRate?.let { rate ->
            try {
                bitrateListener?.invoke(rate)
            } catch (e: RuntimeException) {
                // The encoder may be restarting; it picks up targetBitrate when it starts.
            }
        }
        if (wantKey) requestKeyFrame(urgent = true)
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
            val now = clock()
            if (fmt != null && gopValid && gop.isNotEmpty()) {
                c.push(InitMessage(fmt), now)
                c.generation = fmt.generation
                for (f in gop) c.push(f, now)
                c.graceBytes = gopBytes
                c.waitingForKey = false
                // A long group of frames means a big catch-up burst for the next viewer too: start a fresh one.
                if (gop.size > FRESH_KEY_AFTER_FRAMES) wantKey = true
            } else {
                wantKey = true
            }
        }
        if (wantKey) requestKeyFrame(urgent = true)
        return c
    }

    /**
     * Asks the encoder for a key frame. [urgent]: a screen is waiting for one (it joined, or had to
     * skip), so ask now unless a request is already on its way. Otherwise at most twice a second.
     */
    fun requestKeyFrame(urgent: Boolean = false) {
        val requester = keyFrameRequester ?: return
        lock.withLock {
            val now = clock()
            if (lastKeyRequestAt != NO_TIME) {
                val since = now - lastKeyRequestAt
                // Asked already and no key frame since: it's coming, don't pile up requests
                // (every key frame is big, and big frames are what overflow a slow Wi-Fi).
                val pending = lastKeyFrameAt == NO_TIME || lastKeyFrameAt < lastKeyRequestAt
                if (pending && since < PENDING_RETRY_MS) return
                if (!pending && since < (if (urgent) URGENT_KEY_GAP_MS else KEY_REQUEST_GAP_MS)) return
            }
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

    private enum class Offer { QUEUED, NEEDS_KEY, SKIPPED, SKIPPED_TO_KEY }

    /** Queues [frame] for [c]. */
    private fun offer(c: Client, frame: FrameMessage, fmt: Format, now: Long): Offer {
        if (c.closed) return Offer.QUEUED
        if (c.generation != fmt.generation) {
            if (!frame.keyFrame) {
                c.waitingForKey = true
                c.dropped++
                return Offer.NEEDS_KEY
            }
            c.push(InitMessage(fmt), now)
            c.generation = fmt.generation
            c.waitingForKey = false
            c.push(frame, now)
            return Offer.QUEUED
        }
        if (c.waitingForKey) {
            if (!frame.keyFrame) {
                c.dropped++
                return Offer.NEEDS_KEY
            }
            c.waitingForKey = false
            c.push(frame, now)
            return Offer.QUEUED
        }
        if (c.waitingMs(now) > maxQueueMs || c.bytes + frame.data.size > maxQueueBytes + c.graceBytes) {
            // This screen's Wi-Fi hasn't kept up for a long while: skip what's waiting and go on
            // from a fresh key frame instead of falling further and further behind.
            c.dropMedia()
            skips++
            if (frame.keyFrame) {
                c.push(frame, now)
                return Offer.SKIPPED_TO_KEY
            }
            c.waitingForKey = true
            c.dropped++
            return Offer.SKIPPED
        }
        c.push(frame, now)
        return Offer.QUEUED
    }

    /** One watching screen. [next] hands out what to send, in order. */
    inner class Client internal constructor() : AutoCloseable {
        internal val ready = lock.newCondition()
        private val queue = ArrayDeque<Entry>()
        internal var frames = 0
        internal var bytes = 0L
        internal var generation = -1
        internal var waitingForKey = true
        internal var graceBytes = 0L

        @Volatile
        internal var closed = false

        /** Frames this viewer skipped because it was too far behind. */
        @Volatile
        var dropped = 0L
            internal set

        internal fun push(m: Message, now: Long) {
            queue.addLast(Entry(m, now))
            if (m is FrameMessage) {
                frames++
                bytes += m.data.size
            }
            ready.signalAll()
        }

        /** How long the oldest frame still waiting here has been waiting (0 when none waits). */
        internal fun waitingMs(now: Long): Long {
            for (e in queue) if (e.message is FrameMessage) return (now - e.queuedAt).coerceAtLeast(0L)
            return 0L
        }

        internal fun dropMedia() {
            val it = queue.iterator()
            while (it.hasNext()) {
                if (it.next().message is FrameMessage) {
                    it.remove()
                    dropped++
                }
            }
            frames = 0
            bytes = 0
            graceBytes = 0
        }

        /** Waits up to [timeoutMs] for the next thing to send. Null on timeout or once closed. */
        fun next(timeoutMs: Long): Message? {
            var nanos = TimeUnit.MILLISECONDS.toNanos(timeoutMs)
            lock.withLock {
                try {
                    while (!closed && !isClosed) {
                        val e = queue.pollFirst()
                        if (e != null) {
                            val m = e.message
                            if (m is FrameMessage) {
                                frames--
                                bytes -= m.data.size
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
        const val MIN_DURATION = 360L // 4 ms: closer than that is a burst, not real frame timing
        const val MAX_DURATION = 9_000L // 1/10 s: longer gaps are still screens, not slow frames
        const val MAX_GOP_FRAMES = 240
        const val FRESH_KEY_AFTER_FRAMES = 45
        const val KEY_REQUEST_GAP_MS = 500L
        const val URGENT_KEY_GAP_MS = 200L
        const val PENDING_RETRY_MS = 1_000L
    }
}
