package com.brocast.core

import java.io.ByteArrayInputStream
import kotlin.concurrent.thread
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class FrameHubTest {
    @Test
    fun returnsNewerFrameImmediately() {
        val hub = FrameHub()
        hub.publish(byteArrayOf(1), 10, 20)
        val f = hub.awaitNewer(0, 5_000)
        assertNotNull(f)
        assertEquals(1, f.seq)
        assertEquals(10, f.width)
    }

    @Test
    fun timesOutWhenNothingNew() {
        val hub = FrameHub()
        hub.publish(byteArrayOf(1), 1, 1)
        val start = System.nanoTime()
        assertNull(hub.awaitNewer(1, 150))
        val tookMs = (System.nanoTime() - start) / 1_000_000
        assertTrue(tookMs in 140..2_000, "took $tookMs ms")
    }

    @Test
    fun wakesUpWhenFramePublished() {
        val hub = FrameHub()
        thread {
            Thread.sleep(100)
            hub.publish(byteArrayOf(9), 1, 1)
        }
        val f = hub.awaitNewer(0, 5_000)
        assertNotNull(f)
        assertEquals(9, f.jpeg[0].toInt())
    }

    @Test
    fun closeWakesWaitersAndStopsPublishing() {
        val hub = FrameHub()
        hub.setLive(true)
        thread {
            Thread.sleep(100)
            hub.close()
        }
        val start = System.nanoTime()
        assertNull(hub.awaitNewer(0, 5_000))
        assertTrue((System.nanoTime() - start) / 1_000_000 < 2_000)
        assertFalse(hub.isLive)
        hub.publish(byteArrayOf(1), 1, 1)
        assertNull(hub.latest())
        hub.setLive(true)
        assertFalse(hub.isLive, "a closed hub can't go live again")
    }

    @Test
    fun interruptReturnsNull() {
        val hub = FrameHub()
        var result: FrameHub.Frame? = FrameHub.Frame(0, ByteArray(0), 0, 0)
        val t = thread { result = hub.awaitNewer(0, 10_000) }
        Thread.sleep(100)
        t.interrupt()
        t.join(2_000)
        assertFalse(t.isAlive)
        assertNull(result)
    }

    @Test
    fun onlyLatestFrameIsKept() {
        val hub = FrameHub()
        repeat(5) { hub.publish(byteArrayOf(it.toByte()), 1, 1) }
        assertEquals(5, hub.latest()!!.seq)
        assertEquals(5, hub.framesPublished)
        assertSame(hub.latest(), hub.awaitNewer(2, 10))
    }
}

class HttpRequestTest {
    private fun parse(raw: String) = HttpRequest.read(ByteArrayInputStream(raw.toByteArray(Charsets.ISO_8859_1)))

    @Test
    fun parsesPathQueryHeadersAndCookies() {
        val req = parse(
            "GET /status?cid=abc123&pin=12%2034&flag HTTP/1.1\r\n" +
                "Host: 192.168.1.5:8080\r\n" +
                "Cookie: a=1; brocast_auth=tok=en; z=9\r\n" +
                "\r\n",
        )
        assertNotNull(req)
        assertEquals("GET", req.method)
        assertEquals("/status", req.path)
        assertEquals("abc123", req.query["cid"])
        assertEquals("12 34", req.query["pin"])
        assertEquals("", req.query["flag"])
        assertEquals("192.168.1.5:8080", req.header("HOST"))
        assertEquals("tok=en", req.cookie("brocast_auth"))
        assertEquals("1", req.cookie("a"))
        assertNull(req.cookie("missing"))
    }

    @Test
    fun rejectsGarbageAndTruncatedRequests() {
        assertNull(parse(""))
        assertNull(parse("GET / HTTP/1.1\r\nHost: x\r\n")) // never finished
        assertNull(parse("HELLO\r\n\r\n"))
        assertNull(parse("GET http://evil/ HTTP/1.1\r\n\r\n"))
        assertNull(parse("GET / FTP/1.0\r\n\r\n"))
        assertNull(parse("GET /" + "a".repeat(HttpRequest.MAX_HEAD_BYTES) + " HTTP/1.1\r\n\r\n"))
    }

    @Test
    fun rejectsTlsHandshakeImmediately() {
        // A TLS ClientHello never contains "\r\n\r\n"; we must not sit waiting for one.
        val hello = byteArrayOf(0x16, 0x03, 0x01, 0x02, 0x00, 0x01) + ByteArray(500) { 7 }
        val input = object : java.io.InputStream() {
            var i = 0
            override fun read(): Int {
                if (i < hello.size) return hello[i++].toInt() and 0xff
                throw AssertionError("read past the first byte of a TLS hello")
            }
        }
        assertNull(HttpRequest.read(input))
        assertEquals(1, input.i)
    }

    @Test
    fun handlesBadPercentEscapes() {
        val req = parse("GET /x?a=%zz&b=ok HTTP/1.1\r\n\r\n")
        assertNotNull(req)
        assertNull(req.query["a"])
        assertEquals("ok", req.query["b"])
    }

    @Test
    fun handlesStrayCarriageReturns() {
        val req = parse("GET /a HTTP/1.1\r\nX: 1\r\r\n\r\n")
        assertNotNull(req)
        assertEquals("/a", req.path)
    }
}

class PinGuardTest {
    @Test
    fun locksAfterTooManyFailuresThenUnlocks() {
        var clock = 1_000L
        val guard = PinGuard(maxFailures = 3, lockMillis = 10_000, clock = { clock })
        assertEquals(2, guard.recordFailure("tv"))
        assertEquals(1, guard.recordFailure("tv"))
        assertEquals(0, guard.lockedForMillis("tv"))
        assertEquals(0, guard.recordFailure("tv"))
        assertEquals(10_000, guard.lockedForMillis("tv"))
        assertEquals(0, guard.lockedForMillis("other"), "other devices aren't affected")
        clock += 9_999
        assertEquals(1, guard.lockedForMillis("tv"))
        clock += 1
        assertEquals(0, guard.lockedForMillis("tv"))
        assertEquals(2, guard.recordFailure("tv"), "counter starts fresh after a lockout")
    }

    @Test
    fun successResetsCounter() {
        val guard = PinGuard(maxFailures = 3)
        guard.recordFailure("tv")
        guard.recordFailure("tv")
        guard.recordSuccess("tv")
        assertEquals(2, guard.recordFailure("tv"))
    }

    @Test
    fun tokenDependsOnPinAndSalt() {
        val a = PinConfig("1234", "salt")
        assertEquals(a.token, PinConfig("1234", "salt").token)
        assertTrue(a.token != PinConfig("1235", "salt").token)
        assertTrue(a.token != PinConfig("1234", "pepper").token)
        assertEquals(64, a.token.length)
    }

    @Test
    fun constantTimeEqualsWorks() {
        assertTrue(constantTimeEquals("1234", "1234"))
        assertFalse(constantTimeEquals("1234", "1235"))
        assertFalse(constantTimeEquals("1234", "12345"))
        assertFalse(constantTimeEquals("", "1"))
    }
}

class JsonTest {
    @Test
    fun escapesStrings() {
        val s = String(Json().put("a", "q\"b\\n\n\u0001").put("n", 5).put("b", true).put("x", null).bytes())
        assertEquals("""{"a":"q\"b\\n\n\u0001","n":5,"b":true,"x":null}""", s)
    }
}

class AudioHubTest {
    @Test
    fun deliversChunksInOrderFromWhereListenerStarted() {
        val hub = AudioHub(capacity = 8)
        hub.publish(byteArrayOf(1))
        val start = hub.latestSeq
        hub.publish(byteArrayOf(2))
        hub.publish(byteArrayOf(3))
        val got = hub.awaitAfter(start, 100, maxBehind = 10)
        assertEquals(listOf(2, 3), got.map { it.pcm[0].toInt() })
    }

    @Test
    fun slowListenerSkipsToNewestChunks() {
        val hub = AudioHub(capacity = 8)
        repeat(20) { hub.publish(byteArrayOf(it.toByte())) }
        // Asked from the very start, but only the newest 3 come back (and never more than the ring holds).
        assertEquals(listOf(17, 18, 19), hub.awaitAfter(0, 100, maxBehind = 3).map { it.pcm[0].toInt() })
        assertEquals(8, hub.awaitAfter(0, 100, maxBehind = 100).size)
    }

    @Test
    fun waitsForNewChunkAndTimesOut() {
        val hub = AudioHub()
        thread {
            Thread.sleep(100)
            hub.publish(byteArrayOf(7))
        }
        assertEquals(7, hub.awaitAfter(0, 5_000, 10).single().pcm[0].toInt())
        val t = System.nanoTime()
        assertTrue(hub.awaitAfter(hub.latestSeq, 150, 10).isEmpty())
        assertTrue((System.nanoTime() - t) / 1_000_000 >= 140)
    }

    @Test
    fun closeWakesListeners() {
        val hub = AudioHub()
        hub.setLive(true)
        thread {
            Thread.sleep(100)
            hub.close()
        }
        assertTrue(hub.awaitAfter(0, 5_000, 10).isEmpty())
        assertFalse(hub.isLive)
        hub.publish(byteArrayOf(1))
        assertEquals(0, hub.latestSeq)
    }
}

class WebSocketHelpersTest {
    @Test
    fun acceptKeyMatchesRfcExample() {
        // RFC 6455 section 1.3.
        assertEquals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", StreamServer.websocketAccept("dGhlIHNhbXBsZSBub25jZQ=="))
    }

    @Test
    fun framesUseRightLengthEncoding() {
        fun frame(size: Int): ByteArray {
            val out = java.io.ByteArrayOutputStream()
            StreamServer.writeWsFrame(out, 0x2, ByteArray(size) { 5 })
            return out.toByteArray()
        }
        frame(10).let {
            assertEquals(0x82.toByte(), it[0])
            assertEquals(10, it[1].toInt())
            assertEquals(12, it.size)
        }
        frame(3840).let {
            assertEquals(126, it[1].toInt())
            assertEquals(3840, ((it[2].toInt() and 0xff) shl 8) or (it[3].toInt() and 0xff))
            assertEquals(3844, it.size)
        }
        frame(70_000).let {
            assertEquals(127, it[1].toInt())
            var len = 0L
            for (i in 2 until 10) len = (len shl 8) or (it[i].toLong() and 0xff)
            assertEquals(70_000L, len)
            assertEquals(70_010, it.size)
        }
    }

    @Test
    fun originMustMatchHost() {
        fun req(origin: String?, host: String?): HttpRequest {
            val raw = "GET /audio HTTP/1.1\r\n" +
                (host?.let { "Host: $it\r\n" } ?: "") +
                (origin?.let { "Origin: $it\r\n" } ?: "") + "\r\n"
            return HttpRequest.read(ByteArrayInputStream(raw.toByteArray()))!!
        }
        assertTrue(StreamServer.isSameOrigin(req("http://192.168.1.5:8080", "192.168.1.5:8080")))
        assertTrue(StreamServer.isSameOrigin(req(null, "192.168.1.5:8080")))
        assertFalse(StreamServer.isSameOrigin(req("http://evil.com", "192.168.1.5:8080")))
        assertFalse(StreamServer.isSameOrigin(req("http://192.168.1.5:8081", "192.168.1.5:8080")))
        assertFalse(StreamServer.isSameOrigin(req("http://192.168.1.5:8080", null)))
    }
}
