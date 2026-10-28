package com.brocast.core

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.Socket
import kotlin.concurrent.thread
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class StreamServerTest {
    private lateinit var hub: FrameHub
    private lateinit var server: StreamServer
    private var pin: PinConfig? = null
    private var port = 0

    @BeforeTest
    fun setUp() {
        hub = FrameHub()
        server = StreamServer(hub, pinConfig = { pin }, deviceName = "Test \"Phone\"")
        port = server.start(0)
    }

    @AfterTest
    fun tearDown() {
        server.stop()
        hub.close()
    }

    class Response(val code: Int, val headers: Map<String, String>, val body: ByteArray) {
        val text get() = String(body, Charsets.UTF_8)
    }

    private fun get(path: String, host: String = "127.0.0.1:$port", extra: String = "", method: String = "GET"): Response {
        Socket("127.0.0.1", port).use { s ->
            s.soTimeout = 10_000
            s.getOutputStream().write("$method $path HTTP/1.1\r\nHost: $host\r\n$extra\r\n".toByteArray())
            val input = BufferedInputStream(s.getInputStream())
            val (code, headers) = readHead(input)
            val body = input.readBytes()
            return Response(code, headers, body)
        }
    }

    private fun readHead(input: InputStream): Pair<Int, Map<String, String>> {
        val lines = mutableListOf<String>()
        val line = StringBuilder()
        while (true) {
            val b = input.read()
            check(b != -1) { "EOF in head" }
            if (b == '\n'.code) {
                val l = line.toString().trimEnd('\r')
                line.setLength(0)
                if (l.isEmpty()) break
                lines += l
            } else {
                line.append(b.toChar())
            }
        }
        val code = lines[0].split(' ')[1].toInt()
        val headers = lines.drop(1).associate { it.substringBefore(':').lowercase() to it.substringAfter(':').trim() }
        return code to headers
    }

    private fun readLine(input: InputStream): String {
        val sb = StringBuilder()
        while (true) {
            val b = input.read()
            check(b != -1) { "EOF" }
            if (b == '\n'.code) return sb.toString().trimEnd('\r')
            sb.append(b.toChar())
        }
    }

    /** Reads a part's boundary + headers. The server sends these *before* the picture they belong to. */
    private fun readPartHeaders(input: InputStream) {
        assertEquals("--BroCastFrame", readLine(input))
        assertEquals("Content-Type: image/jpeg", readLine(input))
        assertEquals("", readLine(input))
    }

    /** Reads one picture: everything up to the next boundary, plus that next part's headers. */
    private fun readPart(input: InputStream): ByteArray {
        val marker = "\r\n".toByteArray()
        val buf = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            check(b != -1) { "EOF in part" }
            buf.write(b)
            if (b == '\n'.code) {
                val bytes = buf.toByteArray()
                // A part ends with CRLF followed by the next "--BroCastFrame" line.
                if (bytes.size >= 2 && bytes[bytes.size - 2] == marker[0]) {
                    input.mark(64)
                    val peek = ByteArray(14)
                    var n = 0
                    while (n < peek.size) {
                        val r = input.read(peek, n, peek.size - n)
                        if (r <= 0) break
                        n += r
                    }
                    input.reset()
                    if (String(peek, 0, n, Charsets.ISO_8859_1) == "--BroCastFrame") {
                        readPartHeaders(input)
                        return bytes.copyOfRange(0, bytes.size - 2)
                    }
                }
            }
        }
    }

    @Test
    fun servesViewerPage() {
        val r = get("/")
        assertEquals(200, r.code)
        assertTrue(r.headers["content-type"]!!.startsWith("text/html"))
        assertTrue(r.text.contains("BroCast"))
        assertTrue(r.headers.containsKey("content-security-policy"))
        assertEquals(r.body.size, r.headers["content-length"]!!.toInt())
    }

    @Test
    fun headRequestHasNoBody() {
        val r = get("/", method = "HEAD")
        assertEquals(200, r.code)
        assertEquals(0, r.body.size)
        assertTrue(r.headers["content-length"]!!.toInt() > 1000)
    }

    @Test
    fun rejectsOtherMethodsAndUnknownPaths() {
        assertEquals(405, get("/", method = "POST").code)
        assertEquals(404, get("/nope").code)
        assertEquals(204, get("/favicon.ico").code)
    }

    @Test
    fun blocksDnsRebindingHosts() {
        assertEquals(403, get("/", host = "evil.example.com").code)
        assertEquals(403, get("/status", host = "evil.example.com:8080").code)
        assertEquals(403, get("/", host = "999.1.1.1").code)
        assertEquals(200, get("/", host = "192.168.1.23:8080").code)
        assertEquals(200, get("/", host = "[fe80::1]:8080").code)
        assertEquals(200, get("/", host = "localhost:8080").code)
        assertEquals(200, get("/", host = "my-phone.local").code)
    }

    @Test
    fun statusReportsLiveFrameAndEscapesName() {
        var r = get("/status")
        assertEquals(200, r.code)
        assertTrue(r.text.contains("\"live\":false"))
        assertTrue(r.text.contains("\"hasFrame\":false"))
        assertTrue(r.text.contains("\"name\":\"Test \\\"Phone\\\"\""))
        assertTrue(r.text.contains("\"sid\":\"${server.sessionId}\""))
        hub.setLive(true)
        hub.publish(byteArrayOf(1, 2, 3), 640, 360)
        r = get("/status")
        assertTrue(r.text.contains("\"live\":true"))
        assertTrue(r.text.contains("\"hasFrame\":true"))
        assertTrue(r.text.contains("\"width\":640"))
        assertTrue(r.text.contains("\"pinRequired\":false"))
        assertTrue(r.text.contains("\"authorized\":true"))
    }

    @Test
    fun mjpegStreamDeliversFramesAndKeepalives() {
        hub.setLive(true)
        hub.publish(byteArrayOf(10), 1, 1)
        Socket("127.0.0.1", port).use { s ->
            s.soTimeout = 10_000
            s.getOutputStream().write("GET /stream.mjpeg?cid=tv1 HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
            val input = BufferedInputStream(s.getInputStream())
            val (code, headers) = readHead(input)
            assertEquals(200, code)
            assertEquals("multipart/x-mixed-replace; boundary=BroCastFrame", headers["content-type"])
            readPartHeaders(input)
            assertContentEquals(byteArrayOf(10), readPart(input))

            hub.publish(byteArrayOf(11), 1, 1)
            assertContentEquals(byteArrayOf(11), readPart(input))

            // Viewer is counted once, and status knows this tab's stream is healthy.
            val stats = server.viewerStats()
            assertEquals(1, stats.count)
            assertEquals(listOf("127.0.0.1"), stats.addresses)
            val status = get("/status?cid=tv1").text
            assertTrue(status.contains("\"streaming\":true"), status)
            assertTrue(status.contains("\"frames\":2"), status)

            // No new frames: the last one is resent as a keepalive within ~2 s.
            val start = System.nanoTime()
            assertContentEquals(byteArrayOf(11), readPart(input))
            val waited = (System.nanoTime() - start) / 1_000_000
            assertTrue(waited in 1_500..4_000, "keepalive after $waited ms")
        }
    }

    @Test
    fun slowViewerSkipsToLatestFrame() {
        hub.setLive(true)
        hub.publish(byteArrayOf(1), 1, 1)
        Socket("127.0.0.1", port).use { s ->
            s.soTimeout = 10_000
            s.getOutputStream().write("GET /stream.mjpeg HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
            val input = BufferedInputStream(s.getInputStream())
            readHead(input)
            readPartHeaders(input)
            assertContentEquals(byteArrayOf(1), readPart(input))
            Thread.sleep(200) // give the server time to block waiting for a newer frame
            for (i in 2..50) hub.publish(byteArrayOf(i.toByte()), 1, 1)
            // The server never queues frames, so we're at most a couple behind the newest.
            var last = 0
            while (last != 50) last = readPart(input)[0].toInt()
        }
    }

    @Test
    fun singleFrameLongPoll() {
        hub.setLive(true)
        hub.publish(byteArrayOf(5), 1, 1)
        val r = get("/frame.jpg?after=0&cid=p1")
        assertEquals(200, r.code)
        assertEquals("1", r.headers["x-frame-seq"])
        assertContentEquals(byteArrayOf(5), r.body)

        thread {
            Thread.sleep(300)
            hub.publish(byteArrayOf(6), 1, 1)
        }
        val r2 = get("/frame.jpg?after=1&cid=p1")
        assertEquals(200, r2.code)
        assertEquals("2", r2.headers["x-frame-seq"])
        assertEquals(1, server.viewerStats().count)

        // A sequence number from an older session restarts from the current frame.
        val r3 = get("/frame.jpg?after=999&cid=p1")
        assertEquals(200, r3.code)
        assertEquals("2", r3.headers["x-frame-seq"])
    }

    @Test
    fun singleFrameTimesOutWith204AndReports503WhenNotLive() {
        hub.setLive(true)
        hub.publish(byteArrayOf(5), 1, 1)
        val start = System.nanoTime()
        assertEquals(204, get("/frame.jpg?after=1").code)
        assertTrue((System.nanoTime() - start) / 1_000_000 >= 4_500)
        hub.setLive(false)
        assertEquals(503, get("/frame.jpg?after=1").code)
    }

    @Test
    fun pinProtectsStreamAndLocksOutGuessers() {
        pin = PinConfig("4821", "salt")
        hub.setLive(true)
        hub.publish(byteArrayOf(1), 1, 1)

        assertEquals(401, get("/stream.mjpeg").code)
        assertEquals(401, get("/frame.jpg").code)
        val status = get("/status").text
        assertTrue(status.contains("\"pinRequired\":true"))
        assertTrue(status.contains("\"authorized\":false"))
        assertTrue(status.contains("\"width\":0"), "no details leak before the PIN")

        val wrong = get("/auth?pin=0000")
        assertEquals(401, wrong.code)
        assertTrue(wrong.text.contains("\"attemptsLeft\":4"))

        val ok = get("/auth?pin=4821")
        assertEquals(200, ok.code)
        val cookie = ok.headers["set-cookie"]!!
        assertTrue(cookie.startsWith("brocast_auth=${pin!!.token};"))
        assertTrue(cookie.contains("HttpOnly"))
        val cookieHeader = "Cookie: ${cookie.substringBefore(';')}\r\n"
        assertTrue(get("/status", extra = cookieHeader).text.contains("\"authorized\":true"))
        assertEquals(200, get("/frame.jpg", extra = cookieHeader).code)
        assertEquals(401, get("/frame.jpg", extra = "Cookie: brocast_auth=forged\r\n").code)

        // Five wrong guesses -> locked, even for the right PIN.
        repeat(4) { assertEquals(401, get("/auth?pin=1111").code) }
        val locked = get("/auth?pin=2222")
        assertEquals(429, locked.code)
        assertTrue(locked.text.contains("\"retryIn\":60"))
        assertEquals(429, get("/auth?pin=4821").code)

        // Changing the PIN invalidates old cookies.
        pin = PinConfig("9999", "salt")
        assertEquals(401, get("/frame.jpg", extra = cookieHeader).code)
    }

    @Test
    fun keepAwakeVideoSupportsRanges() {
        val full = get("/keepawake.mp4")
        assertEquals(200, full.code)
        assertEquals("bytes", full.headers["accept-ranges"])
        val size = full.body.size
        assertTrue(size > 500)

        val part = get("/keepawake.mp4", extra = "Range: bytes=0-1\r\n")
        assertEquals(206, part.code)
        assertEquals("bytes 0-1/$size", part.headers["content-range"])
        assertContentEquals(full.body.copyOfRange(0, 2), part.body)

        val open = get("/keepawake.mp4", extra = "Range: bytes=100-\r\n")
        assertEquals(206, open.code)
        assertEquals(size - 100, open.body.size)

        val suffix = get("/keepawake.mp4", extra = "Range: bytes=-10\r\n")
        assertEquals(206, suffix.code)
        assertContentEquals(full.body.copyOfRange(size - 10, size), suffix.body)

        assertEquals(416, get("/keepawake.mp4", extra = "Range: bytes=${size + 5}-\r\n").code)
    }

    @Test
    fun stopClosesActiveStreamsQuickly() {
        hub.setLive(true)
        hub.publish(byteArrayOf(1), 1, 1)
        Socket("127.0.0.1", port).use { s ->
            s.soTimeout = 5_000
            s.getOutputStream().write("GET /stream.mjpeg HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
            val input = BufferedInputStream(s.getInputStream())
            readHead(input)
            readPartHeaders(input)
            readPart(input)
            val start = System.nanoTime()
            server.stop()
            val rest = ByteArrayOutputStream()
            try {
                input.copyTo(rest)
            } catch (e: java.net.SocketException) {
                // reset is fine too
            }
            assertTrue((System.nanoTime() - start) / 1_000_000 < 3_000)
        }
        assertFalse(server.isRunning)
        assertEquals(0, server.viewerStats().count)
    }

    @Test
    fun picksNextPortWhenBusy() {
        val other = StreamServer(FrameHub())
        try {
            val p = other.start(port, attempts = 5)
            assertTrue(p in port + 1..port + 4)
        } finally {
            other.stop()
        }
    }

    @Test
    fun tooManyConnectionsAreDropped() {
        val small = StreamServer(hub, maxConnections = 2)
        val p = small.start(0)
        try {
            hub.setLive(true)
            hub.publish(byteArrayOf(1), 1, 1)
            val held = (1..2).map {
                Socket("127.0.0.1", p).also { s ->
                    s.getOutputStream().write("GET /stream.mjpeg HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
                    readHead(BufferedInputStream(s.getInputStream()))
                }
            }
            Socket("127.0.0.1", p).use { s ->
                s.soTimeout = 3_000
                s.getOutputStream().write("GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
                assertEquals(-1, s.getInputStream().read())
            }
            held.forEach { it.close() }
            // Once those close, new requests are served again.
            var served = false
            repeat(100) {
                if (!served) {
                    Socket("127.0.0.1", p).use { s ->
                        s.soTimeout = 3_000
                        s.getOutputStream().write("GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
                        served = s.getInputStream().read() != -1
                    }
                    if (!served) Thread.sleep(100)
                }
            }
            assertTrue(served)
        } finally {
            small.stop()
        }
    }

    /** Reads one server WebSocket frame: (opcode, payload). */
    private fun readWsFrame(input: InputStream): Pair<Int, ByteArray> {
        val b0 = input.read()
        val b1 = input.read()
        check(b0 != -1 && b1 != -1) { "EOF in frame" }
        assertEquals(0, b1 and 0x80, "server frames must not be masked")
        var len = (b1 and 0x7f).toLong()
        if (len == 126L) len = ((input.read() shl 8) or input.read()).toLong()
        if (len == 127L) { len = 0; repeat(8) { len = (len shl 8) or input.read().toLong() } }
        val data = ByteArray(len.toInt())
        var read = 0
        while (read < data.size) {
            val n = input.read(data, read, data.size - read)
            check(n > 0)
            read += n
        }
        return (b0 and 0x0f) to data
    }

    private fun openAudio(p: Int, extra: String = ""): Pair<Socket, BufferedInputStream> {
        val s = Socket("127.0.0.1", p)
        s.soTimeout = 5_000
        s.getOutputStream().write(
            ("GET /audio?cid=tv HTTP/1.1\r\nHost: 127.0.0.1:$p\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n" +
                "Origin: http://127.0.0.1:$p\r\n$extra\r\n").toByteArray(),
        )
        return s to BufferedInputStream(s.getInputStream())
    }

    @Test
    fun audioWebSocketStreamsPcm() {
        val audio = AudioHub()
        val sound = StreamServer(FrameHub(), audioHub = audio)
        val p = sound.start(0)
        try {
            assertTrue(get("/status").text.contains("\"audio\":false"), "server without a hub says no audio")
            audio.setLive(true)
            audio.publish(byteArrayOf(9, 9)) // old: a new listener must not get this
            val (s, input) = openAudio(p)
            s.use {
                val (code, headers) = readHead(input)
                assertEquals(101, code)
                assertEquals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", headers["sec-websocket-accept"])
                val (op, fmt) = readWsFrame(input)
                assertEquals(1, op)
                assertEquals("""{"type":"format","rate":48000,"channels":2}""", String(fmt))
                audio.publish(byteArrayOf(1, 2, 3, 4))
                val (op2, pcm) = readWsFrame(input)
                assertEquals(2, op2)
                assertContentEquals(byteArrayOf(1, 2, 3, 4), pcm)
                // Several chunks waiting -> sent together in one message.
                Thread.sleep(50)
                audio.publish(byteArrayOf(5, 6))
                audio.publish(byteArrayOf(7, 8))
                var got = ByteArray(0)
                while (got.size < 4) got += readWsFrame(input).second
                assertContentEquals(byteArrayOf(5, 6, 7, 8), got)
            }
        } finally {
            sound.stop()
            audio.close()
        }
    }

    @Test
    fun audioStatusAndRejections() {
        val audio = AudioHub()
        pin = null
        val sound = StreamServer(FrameHub(), audioHub = audio, pinConfig = { pin })
        val p = sound.start(0)
        try {
            audio.setLive(true)
            Socket("127.0.0.1", p).use { s ->
                s.getOutputStream().write("GET /status HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n".toByteArray())
                assertTrue(String(s.getInputStream().readBytes()).contains("\"audio\":true"))
            }
            // Another website trying to listen in.
            Socket("127.0.0.1", p).use { s ->
                s.getOutputStream().write(
                    ("GET /audio HTTP/1.1\r\nHost: 127.0.0.1:$p\r\nUpgrade: websocket\r\n" +
                        "Sec-WebSocket-Key: x\r\nOrigin: http://evil.example\r\n\r\n").toByteArray(),
                )
                assertEquals(403, readHead(BufferedInputStream(s.getInputStream())).first)
            }
            // Plain request without the WebSocket upgrade.
            Socket("127.0.0.1", p).use { s ->
                s.getOutputStream().write("GET /audio HTTP/1.1\r\nHost: 127.0.0.1:$p\r\n\r\n".toByteArray())
                assertEquals(400, readHead(BufferedInputStream(s.getInputStream())).first)
            }
            // PIN on: no cookie, no sound.
            pin = PinConfig("1234", "s")
            val (s, input) = openAudio(p)
            s.use { assertEquals(401, readHead(input).first) }
            val (s2, input2) = openAudio(p, "Cookie: brocast_auth=${pin!!.token}\r\n")
            s2.use { assertEquals(101, readHead(input2).first) }
        } finally {
            sound.stop()
            audio.close()
        }
        // A server without sound says so.
        pin = null
        assertEquals(404, get("/audio").code)
    }

    @Test
    fun clientIdValidation() {
        assertTrue(StreamServer.isValidClientId("abc123XYZ_-"))
        assertFalse(StreamServer.isValidClientId(""))
        assertFalse(StreamServer.isValidClientId("a b"))
        assertFalse(StreamServer.isValidClientId("x".repeat(65)))
        assertNotNull(server.sessionId)
    }
}
