package com.brocast.core

import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * The English subtitle the phone is showing right now, for the TV/PC page (it asks with
 * [awaitAfter] and gets an answer the moment a new line comes up).
 */
class SubtitleBoard(private val clock: () -> Long = { System.nanoTime() / 1_000_000 }) {
    /**
     * One state of the board. [id] goes up with every change. [text] is empty when nothing is shown.
     * [left]..[bottom]: where the original subtitle is, as 0..1 of the shared picture.
     * [inPicture]: the English is already drawn into the shared picture (whole-screen sharing).
     * [highVoice]: the voice in the show is high (a girl's), null if unknown.
     * [speak]: a new line the English voice should say.
     */
    class Line(
        val id: Long,
        val text: String,
        val left: Float = 0f,
        val top: Float = 0f,
        val right: Float = 0f,
        val bottom: Float = 0f,
        val inPicture: Boolean = false,
        val highVoice: Boolean? = null,
        val speak: Boolean = false,
    )

    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private var line = Line(0, "")

    val current: Line get() = lock.withLock { line }

    fun show(
        text: String,
        left: Float,
        top: Float,
        right: Float,
        bottom: Float,
        inPicture: Boolean,
        highVoice: Boolean?,
        speak: Boolean,
    ) {
        lock.withLock {
            line = Line(line.id + 1, text, left, top, right, bottom, inPicture, highVoice, speak)
            changed.signalAll()
        }
    }

    fun clear() {
        lock.withLock {
            if (line.text.isEmpty()) return
            line = Line(line.id + 1, "")
            changed.signalAll()
        }
    }

    /** The board once its id isn't [afterId] any more, or as it is after [timeoutMs]. */
    fun awaitAfter(afterId: Long, timeoutMs: Long): Line {
        val until = clock() + timeoutMs
        lock.withLock {
            while (line.id == afterId) {
                val left = until - clock()
                if (left <= 0) break
                changed.await(left, TimeUnit.MILLISECONDS)
            }
            return line
        }
    }
}
