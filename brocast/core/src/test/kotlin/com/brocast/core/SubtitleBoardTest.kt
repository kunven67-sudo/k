package com.brocast.core

import java.net.Socket
import kotlin.concurrent.thread
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SubtitleBoardTest {
    @Test
    fun answersRightAwayWhenSomethingNewIsThere() {
        val board = SubtitleBoard()
        board.show("Where is my sword?", 0.2f, 0.8f, 0.8f, 0.86f, inPicture = false, highVoice = false, speak = true)
        val line = board.awaitAfter(0, 5_000)
        assertEquals(1, line.id)
        assertEquals("Where is my sword?", line.text)
        assertEquals(false, line.highVoice)
    }

    @Test
    fun waitsForTheNextLineThenWakesUp() {
        val board = SubtitleBoard()
        board.show("one", 0f, 0f, 1f, 1f, false, null, true)
        thread {
            Thread.sleep(150)
            board.show("two", 0f, 0f, 1f, 1f, false, true, true)
        }
        val started = System.nanoTime()
        val line = board.awaitAfter(1, 5_000)
        val waited = (System.nanoTime() - started) / 1_000_000
        assertEquals("two", line.text)
        assertTrue(waited in 100..3_000, "woke up when the line came ($waited ms)")
    }

    @Test
    fun timesOutWithTheSameLineAndClearsOnce() {
        val board = SubtitleBoard()
        board.show("one", 0f, 0f, 1f, 1f, false, null, true)
        assertEquals(1, board.awaitAfter(1, 50).id)
        board.clear()
        assertEquals("", board.current.text)
        val id = board.current.id
        board.clear() // already empty: no change, nobody wakes up for nothing
        assertEquals(id, board.current.id)
    }

    @Test
    fun serverHandsTheLineToThePage() {
        val hub = FrameHub()
        val board = SubtitleBoard()
        val server = StreamServer(hub, subtitles = board)
        val port = server.start(0)
        try {
            board.show("I won't \"give up\"", 0.1f, 0.7f, 0.9f, 0.8f, inPicture = false, highVoice = true, speak = true)
            val body = get(port, "/subs?after=0")
            assertTrue("\"text\":\"I won't \\\"give up\\\"\"" in body, body)
            assertTrue("\"high\":true" in body && "\"speak\":true" in body && "\"l\":0.1" in body, body)
            // Asking with the current id waits for the next change.
            thread {
                Thread.sleep(150)
                board.clear()
            }
            val next = get(port, "/subs?after=1")
            assertTrue("\"id\":2" in next && "\"text\":\"\"" in next, next)
            assertTrue("\"subs\":true" in get(port, "/status"))
        } finally {
            server.stop()
            hub.close()
        }
    }

    private fun get(port: Int, path: String): String = Socket("127.0.0.1", port).use { s ->
        s.soTimeout = 10_000
        s.getOutputStream().write("GET $path HTTP/1.1\r\nHost: 127.0.0.1:$port\r\nConnection: close\r\n\r\n".toByteArray())
        val text = s.getInputStream().readBytes().toString(Charsets.UTF_8)
        text.substringAfter("\r\n\r\n")
    }
}
