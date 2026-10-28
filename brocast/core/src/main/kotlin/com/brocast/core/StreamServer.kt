package com.brocast.core

import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.Closeable
import java.io.IOException
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Serves the phone screen to any web browser on the same network.
 *
 *  - `/`              the viewer page (open it on the TV / PC)
 *  - `/video`         WebSocket with the live picture as H.264 in fragmented MP4 (when [videoHub] is given)
 *  - `/stream.mjpeg`  live picture as an MJPEG stream (for browsers that can't play the H.264 one)
 *  - `/frame.jpg`     long-poll for a single newer frame (fallback for browsers that choke on MJPEG)
 *  - `/audio`         WebSocket with the phone's sound as raw PCM (when [audioHub] is given)
 *  - `/status`        small JSON the page polls to know if the phone is sharing
 *  - `/auth`          checks the PIN and hands out a cookie
 *
 * One request per connection keeps the code small; the stream connection simply never ends.
 */
class StreamServer(
    private val hub: FrameHub,
    private val audioHub: AudioHub? = null,
    private val videoHub: VideoHub? = null,
    private val pinConfig: () -> PinConfig? = { null },
    private val deviceName: String = "Phone",
    private val maxConnections: Int = 32,
    /** A picture/sound connection whose write is stuck this long is closed (the page reconnects). */
    private val writeStallMs: Long = 10_000L,
    /** English subtitles from the phone, for the page to show and say (null: none). */
    private val subtitles: SubtitleBoard? = null,
) {
    /** Random per server instance, so the page notices when the phone starts a new session. */
    val sessionId: String = randomHex(6)

    @Volatile
    var port: Int = -1
        private set

    data class ViewerStats(val count: Int, val addresses: List<String>)

    /** [needsJpeg]: an MJPEG viewer that can't play video (keeps the phone sending pictures). */
    private class StreamInfo(val key: String, val ip: String, val startedAt: Long, val socket: Socket, val needsJpeg: Boolean) {
        @Volatile var lastWriteAt = 0L
        @Volatile var frames = 0L

        /** When the write in progress started, 0 while not writing. */
        @Volatile var writingSince = 0L

        inline fun <T> writing(block: () -> T): T {
            writingSince = monotonicMs()
            try {
                return block()
            } finally {
                writingSince = 0L
            }
        }
    }

    private class Poller(val ip: String, @Volatile var lastSeen: Long, val needsJpeg: Boolean)

    private val running = AtomicBoolean(false)
    @Volatile private var serverSocket: ServerSocket? = null
    private val sockets: MutableSet<Socket> = ConcurrentHashMap.newKeySet()
    private val streams = ConcurrentHashMap<Long, StreamInfo>()
    private val videoStreams = ConcurrentHashMap<Long, StreamInfo>()
    private val audioStreams = ConcurrentHashMap<Long, StreamInfo>()
    private val pollers = ConcurrentHashMap<String, Poller>()
    private val streamIds = AtomicLong()
    private val guard = PinGuard()
    private val executor = Executors.newCachedThreadPool { r ->
        Thread(r, "BroCast-http").apply { isDaemon = true }
    }
    private val viewerPage: ByteArray = resource("viewer.html")
    private val keepAwakeVideo: ByteArray = resource("keepawake.mp4")

    val isRunning: Boolean get() = running.get()

    /**
     * Binds to [preferredPort], or the next free one after it. Pass 0 for any free port.
     * Returns the port actually used.
     */
    @Throws(IOException::class)
    fun start(preferredPort: Int = DEFAULT_PORT, attempts: Int = 20): Int {
        check(running.compareAndSet(false, true)) { "Server already started" }
        val candidates = if (preferredPort == 0) listOf(0) else (preferredPort until preferredPort + attempts).toList()
        var lastError: IOException? = null
        for (candidate in candidates) {
            val ss = ServerSocket()
            try {
                ss.reuseAddress = true
                ss.bind(InetSocketAddress(candidate), 64)
                serverSocket = ss
                port = ss.localPort
                break
            } catch (e: IOException) {
                lastError = e
                ss.closeQuietly()
            }
        }
        val ss = serverSocket
        if (ss == null) {
            running.set(false)
            executor.shutdownNow()
            throw lastError ?: IOException("No free port")
        }
        Thread({ acceptLoop(ss) }, "BroCast-accept").apply {
            isDaemon = true
            start()
        }
        Thread(::janitor, "BroCast-janitor").apply {
            isDaemon = true
            start()
        }
        return port
    }

    fun stop() {
        if (!running.compareAndSet(true, false)) return
        serverSocket?.closeQuietly()
        for (s in sockets) s.closeQuietly()
        executor.shutdownNow()
        streams.clear()
        videoStreams.clear()
        audioStreams.clear()
        pollers.clear()
    }

    /** True while any browser is getting JPEG pictures (MJPEG stream or single frames). */
    fun pictureViewerActive(): Boolean {
        val now = monotonicMs()
        return streams.isNotEmpty() || pollers.values.any { now - it.lastSeen < VIEWER_TIMEOUT_MS }
    }

    /**
     * True while a browser is watching the MJPEG picture (one that can't play H.264). The phone
     * then sends JPEG pictures instead of video.
     */
    fun jpegViewerActive(): Boolean {
        val now = monotonicMs()
        // An open picture stream counts even while it waits for its first picture (a still screen
        // makes none): dead ones are noticed and dropped by the stream loop itself.
        if (streams.values.any { it.needsJpeg }) return true
        return pollers.values.any { it.needsJpeg && now - it.lastSeen < VIEWER_TIMEOUT_MS }
    }

    /** Screens currently watching, counted per browser tab (not per connection). */
    fun viewerStats(): ViewerStats {
        val now = monotonicMs()
        val byKey = HashMap<String, String>()
        for (info in streams.values + videoStreams.values) {
            if (now - maxOf(info.startedAt, info.lastWriteAt) < VIEWER_TIMEOUT_MS) byKey[info.key] = info.ip
        }
        pollers.entries.removeAll { now - it.value.lastSeen > VIEWER_TIMEOUT_MS }
        for ((key, poller) in pollers) byKey[key] = poller.ip
        return ViewerStats(byKey.size, byKey.values.distinct().sorted())
    }

    // ---------------------------------------------------------------- connection handling

    private fun acceptLoop(ss: ServerSocket) {
        while (running.get()) {
            val socket = try {
                ss.accept()
            } catch (e: IOException) {
                if (!running.get()) break
                sleepQuietly(50) // e.g. out of file descriptors: back off instead of spinning
                continue
            }
            if (sockets.size >= maxConnections) {
                socket.closeQuietly()
                continue
            }
            sockets.add(socket)
            try {
                executor.execute { handle(socket) }
            } catch (e: RejectedExecutionException) {
                sockets.remove(socket)
                socket.closeQuietly()
            }
        }
    }

    /**
     * Closes picture/sound connections whose writes have been stuck for a while. A TV that drops
     * off Wi-Fi without saying goodbye would otherwise keep a connection (and a thread) busy for
     * many minutes, until Android's own network timeout, and enough of those lock new viewers out.
     */
    private fun janitor() {
        while (running.get()) {
            sleepQuietly(minOf(1_000L, writeStallMs / 4))
            val now = monotonicMs()
            for (map in listOf(streams, videoStreams, audioStreams)) {
                for (info in map.values) {
                    val since = info.writingSince
                    if (since != 0L && now - since > writeStallMs) info.socket.closeQuietly()
                }
            }
        }
    }

    private fun handle(socket: Socket) {
        try {
            if (!running.get()) return
            socket.tcpNoDelay = true
            socket.soTimeout = 15_000
            val input = BufferedInputStream(socket.getInputStream())
            val out = BufferedOutputStream(socket.getOutputStream(), 64 * 1024)
            val request = HttpRequest.read(input) ?: return
            val ip = socket.inetAddress?.hostAddress ?: "unknown"
            route(request, ip, socket, out)
            out.flush()
        } catch (e: IOException) {
            // Browser went away mid-request. Totally normal.
        } catch (e: RuntimeException) {
            // Never let one weird request take the server down.
        } finally {
            sockets.remove(socket)
            socket.closeQuietly()
        }
    }

    private fun route(req: HttpRequest, ip: String, socket: Socket, out: OutputStream) {
        val head = req.method == "HEAD"
        if (req.method != "GET" && !head) {
            sendText(out, 405, "Only GET is supported.", head)
            return
        }
        if (!isAllowedHost(req.header("host"))) {
            sendText(out, 403, "Open BroCast using the number address shown on your phone (like 192.168.1.23:$port).", head)
            return
        }
        when (req.path) {
            "/", "/index.html" -> send(out, 200, "text/html; charset=utf-8", viewerPage, head, PAGE_HEADERS)
            "/status" -> status(req, out, head)
            "/auth" -> auth(req, ip, out, head)
            "/video" -> if (authorized(req)) video(req, ip, socket, out, head) else unauthorized(out, head)
            "/stream.mjpeg" -> if (authorized(req)) stream(req, ip, socket, out, head) else unauthorized(out, head)
            "/frame.jpg" -> if (authorized(req)) singleFrame(req, ip, out, head) else unauthorized(out, head)
            "/audio" -> if (authorized(req)) audio(req, ip, socket, out, head) else unauthorized(out, head)
            "/subs" -> if (authorized(req)) subs(req, out, head) else unauthorized(out, head)
            "/keepawake.mp4" -> sendRanged(out, "video/mp4", keepAwakeVideo, req.header("range"), head)
            "/favicon.ico" -> send(out, 204, null, EMPTY, head)
            else -> sendText(out, 404, "Nothing here, bro.", head)
        }
    }

    // ---------------------------------------------------------------- endpoints

    private fun status(req: HttpRequest, out: OutputStream, head: Boolean) {
        val cfg = pinConfig()
        val authorized = isAuthorized(req, cfg)
        val frame = hub.latest()
        val stream = req.query["cid"]?.let { latestStreamFor(it) }
        val now = monotonicMs()
        val streaming = stream != null && now - maxOf(stream.startedAt, stream.lastWriteAt) < STALL_MS
        val vh = videoHub
        val videoLive = vh != null && vh.isLive && !vh.isClosed
        val json = Json()
            .put("app", "BroCast")
            .put("sid", sessionId)
            .put("name", deviceName)
            .put("live", hub.isLive)
            .put("hasFrame", frame != null)
            .put("audio", audioHub?.isLive == true)
            .put("pinRequired", cfg != null)
            .put("authorized", authorized)
            .put("streaming", streaming)
            .put("frames", stream?.frames ?: 0L)
            .put("width", if (authorized) frame?.width ?: 0 else 0)
            .put("height", if (authorized) frame?.height ?: 0 else 0)
            // "h264": the picture is sent as video on /video. "jpeg": as pictures on /stream.mjpeg.
            .put("video", if (videoLive) "h264" else "jpeg")
            .put("vframes", if (authorized && vh != null) vh.framesPublished else 0L)
            .put("vage", if (authorized && vh != null && vh.lastFrameAt > 0) now - vh.lastFrameAt else -1L)
            .put("subs", subtitles != null)
        send(out, 200, JSON_TYPE, json.bytes(), head)
    }

    // The English subtitle: answers as soon as it differs from the page's ?after= (or after 20 s).
    private fun subs(req: HttpRequest, out: OutputStream, head: Boolean) {
        val board = subtitles
        val line = if (board == null) {
            SubtitleBoard.Line(0, "")
        } else {
            board.awaitAfter(req.query["after"]?.toLongOrNull() ?: -1L, SUBS_WAIT_MS)
        }
        val json = Json()
            .put("id", line.id)
            .put("text", line.text)
            .put("l", line.left)
            .put("t", line.top)
            .put("r", line.right)
            .put("b", line.bottom)
            .put("inPicture", line.inPicture)
            .put("high", line.highVoice)
            .put("speak", line.speak)
        send(out, 200, JSON_TYPE, json.bytes(), head)
    }

    private fun auth(req: HttpRequest, ip: String, out: OutputStream, head: Boolean) {
        val cfg = pinConfig()
        if (cfg == null) {
            send(out, 200, JSON_TYPE, Json().put("ok", true).bytes(), head)
            return
        }
        val locked = guard.lockedForMillis(ip)
        if (locked > 0) {
            sendLocked(out, locked, head)
            return
        }
        val pin = req.query["pin"].orEmpty()
        if (pin.isNotEmpty() && constantTimeEquals(pin, cfg.pin)) {
            guard.recordSuccess(ip)
            val cookie = "$AUTH_COOKIE=${cfg.token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict"
            send(out, 200, JSON_TYPE, Json().put("ok", true).bytes(), head, listOf("Set-Cookie" to cookie))
            return
        }
        val left = guard.recordFailure(ip)
        if (left == 0) {
            sendLocked(out, guard.lockedForMillis(ip), head)
        } else {
            send(out, 401, JSON_TYPE, Json().put("ok", false).put("error", "wrong").put("attemptsLeft", left).bytes(), head)
        }
    }

    private fun sendLocked(out: OutputStream, lockedMs: Long, head: Boolean) {
        val seconds = ((lockedMs + 999) / 1000).coerceAtLeast(1)
        send(out, 429, JSON_TYPE, Json().put("ok", false).put("error", "locked").put("retryIn", seconds).bytes(), head)
    }

    private fun stream(req: HttpRequest, ip: String, socket: Socket, out: OutputStream, head: Boolean) {
        writeHead(out, 200, "multipart/x-mixed-replace; boundary=$BOUNDARY", null, NO_CACHE)
        if (head) return
        out.write(PART_START)
        out.flush()
        try {
            socket.sendBufferSize = 256 * 1024
        } catch (e: SocketException) {
            // Not fatal, just means a bit more buffering.
        }

        val key = req.query["cid"]?.takeIf(::isValidClientId) ?: "$ip:${socket.port}"
        // "v=1": a page that can play video, just waiting for the phone to switch back to it.
        val info = StreamInfo(key, ip, monotonicMs(), socket, needsJpeg = req.query["v"] != "1")
        val id = streamIds.incrementAndGet()
        streams[id] = info
        try {
            var lastSeq = 0L
            while (running.get() && !socket.isClosed && !hub.isClosed) {
                var frame = hub.awaitNewer(lastSeq, KEEPALIVE_MS)
                if (frame == null) {
                    if (Thread.currentThread().isInterrupted || hub.isClosed) break
                    // Screen hasn't changed for a while: resend the last picture. That keeps
                    // the connection alive and lets us notice when the TV has gone away.
                    frame = hub.latest()
                    if (frame == null) {
                        // No picture yet to send: check the TV is still there some other way.
                        if (!stillConnected(socket)) break
                        continue
                    }
                }
                info.writing {
                    out.write(frame.jpeg)
                    // Chrome only draws a part once it has seen the *next* part's headers, so they
                    // go out right after each picture. Otherwise a still screen would lag a whole
                    // keepalive behind.
                    out.write(PART_END)
                    out.write(PART_START)
                    out.flush()
                }
                lastSeq = frame.seq
                info.frames++
                info.lastWriteAt = monotonicMs()
            }
        } finally {
            streams.remove(id)
        }
    }

    /**
     * WebSocket with the picture as H.264 video. Text messages are JSON notes for the page
     * (`{"type":"init",...}` comes right before each init segment); binary messages are MP4
     * pieces to append, in order.
     */
    private fun video(req: HttpRequest, ip: String, socket: Socket, out: OutputStream, head: Boolean) {
        val vh = videoHub
        if (vh == null || vh.isClosed) {
            sendText(out, 404, "This phone isn't sending video.", head)
            return
        }
        if (!upgradeToWebSocket(req, out, head)) return
        try {
            socket.sendBufferSize = 256 * 1024 // ~0.3 s of video: enough to ride out hiccups, small enough to notice a slow TV
        } catch (e: SocketException) {
            // Not fatal.
        }
        val key = req.query["cid"]?.takeIf(::isValidClientId) ?: "$ip:${socket.port}"
        val info = StreamInfo(key, ip, monotonicMs(), socket, needsJpeg = false)
        val id = streamIds.incrementAndGet()
        videoStreams[id] = info
        val client = vh.openClient()
        try {
            writeWsFrame(out, WS_TEXT, Json().put("type", "hello").bytes())
            out.flush()
            info.lastWriteAt = monotonicMs()
            while (running.get() && !socket.isClosed && client.isOpen) {
                val m = client.next(KEEPALIVE_MS)
                if (m == null && (Thread.currentThread().isInterrupted || !client.isOpen)) break
                info.writing {
                    if (m == null) {
                        // Still screen: a note the page can see, so it knows the connection is alive.
                        writeWsFrame(out, WS_TEXT, TICK)
                    } else {
                        writeVideoMessage(out, m)
                        if (m is VideoHub.FrameMessage) info.frames++
                        // Send whatever else is already waiting in the same go.
                        while (true) {
                            val more = client.next(0) ?: break
                            writeVideoMessage(out, more)
                            if (more is VideoHub.FrameMessage) info.frames++
                        }
                    }
                    out.flush()
                }
                info.lastWriteAt = monotonicMs()
            }
            writeWsFrame(out, WS_CLOSE, EMPTY)
            out.flush()
        } catch (e: IOException) {
            // Browser went away.
        } finally {
            client.close()
            videoStreams.remove(id)
        }
    }

    private fun writeVideoMessage(out: OutputStream, m: VideoHub.Message) {
        when (m) {
            is VideoHub.InitMessage -> {
                val f = m.format
                val note = Json().put("type", "init").put("codec", f.codec).put("width", f.width)
                    .put("height", f.height).put("gen", f.generation)
                writeWsFrame(out, WS_TEXT, note.bytes())
                writeWsFrame(out, WS_BINARY, f.init)
            }
            is VideoHub.FrameMessage -> writeWsFrame(out, WS_BINARY, m.data)
        }
    }

    /** Checks it's a WebSocket request from our own page and answers the handshake. False if refused. */
    private fun upgradeToWebSocket(req: HttpRequest, out: OutputStream, head: Boolean): Boolean {
        // WebSockets skip the browser's usual cross-site protection, so check it's our own page.
        if (!isSameOrigin(req)) {
            sendText(out, 403, "Wrong origin.", head)
            return false
        }
        val key = req.header("sec-websocket-key")
        if (head || key.isNullOrBlank() || !req.header("upgrade").equals("websocket", ignoreCase = true)) {
            sendText(out, 400, "Expected a WebSocket.", head)
            return false
        }
        out.write(
            ascii(
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                    "Sec-WebSocket-Accept: ${websocketAccept(key)}\r\n\r\n",
            ),
        )
        return true
    }

    /**
     * Is the browser on the other end of [socket] still there? Browsers send nothing more after
     * asking for a stream, so a quick read either times out (still there) or finds the connection
     * closed. Used while there's nothing to write that would tell us.
     */
    private fun stillConnected(socket: Socket): Boolean {
        val old = try {
            socket.soTimeout
        } catch (e: SocketException) {
            return false
        }
        return try {
            socket.soTimeout = 1
            socket.getInputStream().read() != -1
        } catch (e: SocketTimeoutException) {
            true
        } catch (e: IOException) {
            false
        } finally {
            try {
                socket.soTimeout = old
            } catch (e: SocketException) {
                // closed meanwhile
            }
        }
    }

    private fun singleFrame(req: HttpRequest, ip: String, out: OutputStream, head: Boolean) {
        val key = req.query["cid"]?.takeIf(::isValidClientId) ?: ip
        val now = monotonicMs()
        pollers[key] = Poller(ip, now, needsJpeg = req.query["v"] != "1")

        var after = req.query["after"]?.toLongOrNull() ?: 0L
        val current = hub.latest()
        // A number from an older session (the phone restarted sharing): start over.
        if (current != null && after > current.seq) after = 0L
        val frame = if (head) current else hub.awaitNewer(after, POLL_WAIT_MS)
        pollers[key]?.lastSeen = monotonicMs()
        when {
            frame != null -> send(
                out, 200, "image/jpeg", frame.jpeg, head,
                NO_CACHE + listOf("X-Frame-Seq" to frame.seq.toString()),
            )
            !hub.isLive -> sendText(out, 503, "The phone isn't sharing right now.", head)
            else -> send(out, 204, null, EMPTY, head)
        }
    }

    /** WebSocket that pushes the phone's sound. First a text message with the format, then binary PCM. */
    private fun audio(req: HttpRequest, ip: String, socket: Socket, out: OutputStream, head: Boolean) {
        val sound = audioHub
        if (sound == null) {
            sendText(out, 404, "This phone isn't sending sound.", head)
            return
        }
        if (!upgradeToWebSocket(req, out, head)) return
        // Start from here: sound that arrives while the format note goes out still counts.
        val startSeq = sound.latestSeq
        val format = Json().put("type", "format").put("rate", sound.sampleRate).put("channels", sound.channels)
        writeWsFrame(out, WS_TEXT, format.bytes())
        out.flush()

        val info = StreamInfo(req.query["cid"]?.takeIf(::isValidClientId) ?: ip, ip, monotonicMs(), socket, needsJpeg = false)
        val id = streamIds.incrementAndGet()
        audioStreams[id] = info
        try {
            audioLoop(sound, startSeq, socket, out, info)
        } finally {
            audioStreams.remove(id)
        }
    }

    private fun audioLoop(sound: AudioHub, startSeq: Long, socket: Socket, out: OutputStream, info: StreamInfo) {
        var lastSeq = startSeq
        var lastWrite = monotonicMs()
        info.lastWriteAt = lastWrite
        while (running.get() && !socket.isClosed && !sound.isClosed) {
            val chunks = sound.awaitAfter(lastSeq, 1_000, MAX_AUDIO_BEHIND)
            if (chunks.isEmpty()) {
                if (Thread.currentThread().isInterrupted) break
                // Quiet for a while: ping so a vanished browser is noticed and cleaned up.
                if (monotonicMs() - lastWrite >= KEEPALIVE_MS) {
                    info.writing {
                        writeWsFrame(out, WS_PING, EMPTY)
                        out.flush()
                    }
                    lastWrite = monotonicMs()
                    info.lastWriteAt = lastWrite
                }
                continue
            }
            val payload = if (chunks.size == 1) {
                chunks[0].pcm
            } else {
                val joined = ByteArray(chunks.sumOf { it.pcm.size })
                var offset = 0
                for (c in chunks) {
                    c.pcm.copyInto(joined, offset)
                    offset += c.pcm.size
                }
                joined
            }
            info.writing {
                writeWsFrame(out, WS_BINARY, payload)
                out.flush()
            }
            lastSeq = chunks.last().seq
            lastWrite = monotonicMs()
            info.lastWriteAt = lastWrite
        }
        try {
            writeWsFrame(out, WS_CLOSE, EMPTY)
            out.flush()
        } catch (e: IOException) {
            // Already gone.
        }
    }

    private fun unauthorized(out: OutputStream, head: Boolean) {
        send(out, 401, JSON_TYPE, Json().put("ok", false).put("error", "pin").bytes(), head)
    }

    // ---------------------------------------------------------------- helpers

    private fun authorized(req: HttpRequest) = isAuthorized(req, pinConfig())

    private fun isAuthorized(req: HttpRequest, cfg: PinConfig?): Boolean {
        if (cfg == null) return true
        val token = req.cookie(AUTH_COOKIE) ?: return false
        return constantTimeEquals(token, cfg.token)
    }

    private fun latestStreamFor(key: String): StreamInfo? =
        streams.values.filter { it.key == key }.maxByOrNull { it.startedAt }

    private fun sendText(out: OutputStream, code: Int, text: String, head: Boolean) =
        send(out, code, "text/plain; charset=utf-8", text.toByteArray(Charsets.UTF_8), head)

    private fun send(
        out: OutputStream,
        code: Int,
        contentType: String?,
        body: ByteArray,
        head: Boolean,
        extra: List<Pair<String, String>> = emptyList(),
    ) {
        writeHead(out, code, contentType, if (code == 204) null else body.size.toLong(), extra)
        if (!head && code != 204) out.write(body)
    }

    /** Video players (Safari especially) insist on byte ranges, so support the simple single-range case. */
    private fun sendRanged(out: OutputStream, contentType: String, body: ByteArray, range: String?, head: Boolean) {
        val match = range?.let { RANGE.matchEntire(it.trim()) }
        if (match == null) {
            send(out, 200, contentType, body, head, listOf("Accept-Ranges" to "bytes"))
            return
        }
        val size = body.size.toLong()
        val (startText, endText) = match.destructured
        val start: Long
        val end: Long
        if (startText.isEmpty()) {
            val suffix = endText.toLongOrNull() ?: 0L
            start = (size - suffix).coerceAtLeast(0)
            end = size - 1
        } else {
            start = startText.toLongOrNull() ?: Long.MAX_VALUE
            end = (endText.toLongOrNull() ?: (size - 1)).coerceAtMost(size - 1)
        }
        if (start >= size || start > end) {
            writeHead(out, 416, null, 0, listOf("Content-Range" to "bytes */$size"))
            return
        }
        val slice = body.copyOfRange(start.toInt(), end.toInt() + 1)
        writeHead(
            out, 206, contentType, slice.size.toLong(),
            listOf("Accept-Ranges" to "bytes", "Content-Range" to "bytes $start-$end/$size"),
        )
        if (!head) out.write(slice)
    }

    private fun writeHead(
        out: OutputStream,
        code: Int,
        contentType: String?,
        contentLength: Long?,
        extra: List<Pair<String, String>>,
    ) {
        val sb = StringBuilder(256)
        sb.append("HTTP/1.1 ").append(code).append(' ').append(reason(code)).append("\r\n")
        if (contentType != null) sb.append("Content-Type: ").append(contentType).append("\r\n")
        if (contentLength != null) sb.append("Content-Length: ").append(contentLength).append("\r\n")
        sb.append("Connection: close\r\n")
        sb.append("X-Content-Type-Options: nosniff\r\n")
        if (extra.none { it.first == "Cache-Control" }) sb.append("Cache-Control: no-store\r\n")
        for ((name, value) in extra) sb.append(name).append(": ").append(value).append("\r\n")
        sb.append("\r\n")
        out.write(ascii(sb.toString()))
    }

    companion object {
        const val DEFAULT_PORT = 8080
        const val AUTH_COOKIE = "brocast_auth"
        private const val BOUNDARY = "BroCastFrame"
        private val PART_START = ascii("--$BOUNDARY\r\nContent-Type: image/jpeg\r\n\r\n")
        private val PART_END = ascii("\r\n")
        private const val JSON_TYPE = "application/json; charset=utf-8"
        private const val KEEPALIVE_MS = 2_000L
        private const val POLL_WAIT_MS = 5_000L
        private const val STALL_MS = 5_000L
        private const val SUBS_WAIT_MS = 20_000L
        private const val VIEWER_TIMEOUT_MS = 6_000L

        /** If a listener is more than this many 20 ms chunks behind, it skips ahead. */
        private const val MAX_AUDIO_BEHIND = 15
        private const val WS_TEXT = 0x1
        private const val WS_BINARY = 0x2
        private const val WS_CLOSE = 0x8
        private const val WS_PING = 0x9
        private const val WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        private val EMPTY = ByteArray(0)
        private val TICK = ascii("""{"type":"tick"}""")
        private val RANGE = Regex("""bytes=(\d*)-(\d*)""")
        private val IPV4 = Regex("""\d{1,3}(\.\d{1,3}){3}""")
        private val CLIENT_ID = Regex("""[A-Za-z0-9_-]{1,64}""")
        private val NO_CACHE = listOf(
            "Cache-Control" to "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma" to "no-cache",
        )
        private val PAGE_HEADERS = listOf(
            "Content-Security-Policy" to "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; " +
                "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws: data:; frame-ancestors 'none'",
            "Referrer-Policy" to "no-referrer",
            "X-Frame-Options" to "DENY",
        )

        /**
         * Only answer to addresses typed as numbers (or localhost / .local names). This blocks
         * "DNS rebinding", where a random website tricks a browser into reading the stream.
         */
        internal fun isAllowedHost(host: String?): Boolean {
            if (host.isNullOrBlank()) return true
            val h = host.trim().lowercase()
            if (h.startsWith("[")) return h.indexOf(']') > 1
            val name = h.substringBefore(':')
            if (name == "localhost" || name.endsWith(".local")) return true
            if (!IPV4.matches(name)) return false
            return name.split('.').all { it.toInt() <= 255 }
        }

        internal fun isValidClientId(id: String) = CLIENT_ID.matches(id)

        /** True when there's no Origin (not a browser) or it matches the address the page was opened on. */
        internal fun isSameOrigin(req: HttpRequest): Boolean {
            val origin = req.header("origin") ?: return true
            val host = req.header("host") ?: return false
            return origin.equals("http://$host", ignoreCase = true)
        }

        internal fun websocketAccept(key: String): String {
            val sha1 = MessageDigest.getInstance("SHA-1").digest((key.trim() + WS_GUID).toByteArray(Charsets.ISO_8859_1))
            return Base64.getEncoder().encodeToString(sha1)
        }

        /** Writes one unmasked (server-to-browser) WebSocket frame. */
        internal fun writeWsFrame(out: OutputStream, opcode: Int, payload: ByteArray) {
            val len = payload.size
            val header = when {
                len < 126 -> byteArrayOf((0x80 or opcode).toByte(), len.toByte())
                len < 65_536 -> byteArrayOf((0x80 or opcode).toByte(), 126, (len ushr 8).toByte(), len.toByte())
                else -> ByteArray(10).also {
                    it[0] = (0x80 or opcode).toByte()
                    it[1] = 127
                    for (i in 0 until 8) it[2 + i] = (len.toLong() ushr (56 - 8 * i)).toByte()
                }
            }
            out.write(header)
            out.write(payload)
        }

        private fun reason(code: Int) = when (code) {
            200 -> "OK"
            400 -> "Bad Request"
            204 -> "No Content"
            206 -> "Partial Content"
            401 -> "Unauthorized"
            403 -> "Forbidden"
            404 -> "Not Found"
            405 -> "Method Not Allowed"
            416 -> "Range Not Satisfiable"
            429 -> "Too Many Requests"
            503 -> "Service Unavailable"
            else -> "OK"
        }

        private fun resource(name: String): ByteArray =
            StreamServer::class.java.getResourceAsStream("/brocast/$name")?.use { it.readBytes() }
                ?: throw IllegalStateException("Missing resource $name")
    }
}

/** Minimal JSON object writer; enough for flat status replies. */
internal class Json {
    private val sb = StringBuilder("{")

    fun put(key: String, value: Any?): Json {
        if (sb.length > 1) sb.append(',')
        quote(key)
        sb.append(':')
        when (value) {
            null -> sb.append("null")
            is Boolean, is Int, is Long -> sb.append(value.toString())
            is Float -> sb.append(if (value.isFinite()) value.toString() else "0")
            else -> quote(value.toString())
        }
        return this
    }

    fun bytes(): ByteArray = (sb.toString() + "}").toByteArray(Charsets.UTF_8)

    private fun quote(s: String) {
        sb.append('"')
        for (c in s) {
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' || c == '\u2028' || c == '\u2029' -> sb.append("\\u").append(c.code.toString(16).padStart(4, '0'))
                else -> sb.append(c)
            }
        }
        sb.append('"')
    }
}

internal fun monotonicMs(): Long = System.nanoTime() / 1_000_000

private fun ascii(s: String) = s.toByteArray(Charsets.ISO_8859_1)

private fun Closeable.closeQuietly() {
    try {
        close()
    } catch (e: IOException) {
        // ignore
    }
}

private fun sleepQuietly(ms: Long) {
    try {
        Thread.sleep(ms)
    } catch (e: InterruptedException) {
        Thread.currentThread().interrupt()
    }
}
