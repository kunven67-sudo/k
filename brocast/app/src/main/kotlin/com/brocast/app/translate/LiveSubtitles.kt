package com.brocast.app.translate

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Point
import android.graphics.Rect
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.brocast.core.SubtitleText
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * SUBDUB on the phone: watches the shared screen for subtitles in other languages and covers them
 * with English.
 *
 * The screen capture hands over frames ([offer], capture thread). A quick look at the subtitle area
 * decides if anything changed; if so, that strip is read (text reader), translated (offline
 * translator) and the English goes on the overlay, right over the original.
 *
 * If the screen recording includes the overlay itself (whole-screen sharing instead of one app),
 * covering would hide the next subtitle from the reader too: then the English goes just above the
 * original instead.
 */
class LiveSubtitles(context: Context, private val screenSize: () -> Point) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "BroCast-subtitles") }
    private val ocr = SubtitleOcr()
    private val translator = SubtitleTranslator { note = it }
    private val overlay = SubtitleOverlay(context)
    private val busy = AtomicBoolean(false)

    @Volatile
    private var closed = false

    /** Set when a read missed the shown subtitle: look again on the next frame, not 1.5 s later. */
    @Volatile
    private var recheck = false

    /** Gets each new English line (worker thread), e.g. to read it out loud. */
    @Volatile
    var onNewEnglish: ((String) -> Unit)? = null

    /** A short line for the app's screen, like "Spanish → English". */
    @Volatile
    var note: String = LOOKING
        private set

    // ---- capture thread
    private var lastOfferAt = 0L
    private var playing = true
    private var prevSignature: BooleanArray? = null
    private var lastReadAt = 0L
    private var boxAt = 0L
    private val boxes = ArrayDeque<FloatArray>() // recent picture areas (left, top, right, bottom as 0..1)
    private var boxFor = 0L
    private val smallStrip = Bitmap.createBitmap(SW, SH, Bitmap.Config.ARGB_8888)
    private val smallFrame = Bitmap.createBitmap(PW, PH, Bitmap.Config.ARGB_8888)
    private val stripPixels = IntArray(SW * SH)
    private val framePixels = IntArray(PW * PH)
    private val smooth = Paint(Paint.FILTER_BITMAP_FLAG)

    // ---- worker thread
    private var current: Shown? = null
    private val ownEnglish = ArrayDeque<String>()
    private var recordingSeesOverlay = false

    private class Shown(
        val text: String,
        var english: String?,
        var rect: Rect,
        val lines: Int,
        var seenAt: Long,
        var screen: Point,
    )

    /**
     * The newest frame of the shared screen ([frame] belongs to the caller: whatever's needed is
     * copied right away). Cheap when nothing changed; the reading happens on another thread.
     */
    fun offer(frame: Bitmap) {
        if (closed) return
        val now = SystemClock.uptimeMillis()
        if (now - lastOfferAt < OFFER_EVERY_MS || busy.get()) return
        lastOfferAt = now
        // Only while a show is playing. Otherwise text near the bottom of the screen is a chat or the
        // keyboard: a box there would block taps on it.
        val nowPlaying = audio?.isMusicActive ?: true
        if (nowPlaying != playing) {
            playing = nowPlaying
            if (!nowPlaying) {
                prevSignature = null
                onWorker {
                    current = null
                    hide()
                    note = WAITING
                }
            } else {
                onWorker { if (note == WAITING) note = LOOKING }
            }
        }
        if (!nowPlaying) return
        val w = frame.width
        val h = frame.height
        val pic = pictureArea(frame, now)
        // The subtitle strip: the lower part of the picture, down to the bottom of the screen
        // (some subtitles sit in the black bar under the picture).
        val top = pic.top + (pic.height() * 0.62f).roundToInt()
        val strip = Rect(pic.left, top, pic.right, h)
        if (strip.width() < 32 || strip.height() < 16) return
        val signature = signature(frame, strip)
        val prev = prevSignature
        var diff = Int.MAX_VALUE
        if (prev != null) {
            diff = 0
            for (i in signature.indices) if (signature[i] != prev[i]) diff++
        }
        // Read again when the strip looks different, and every 1.5 s anyway.
        if (diff < SAME_PICTURE && now - lastReadAt < 1500 && !recheck) return
        prevSignature = signature
        lastReadAt = now
        recheck = false
        val crop = try {
            Bitmap.createBitmap(frame, strip.left, strip.top, strip.width(), strip.height())
        } catch (e: RuntimeException) {
            return
        }
        val screen = screenSize()
        if (screen.x <= 0 || screen.y <= 0) screen.set(w, h)
        busy.set(true)
        val queued = onWorker {
            try {
                read(crop, strip, pic, screen, w, h, now)
            } catch (e: Exception) {
                Log.w(TAG, "Subtitle read failed", e)
            } finally {
                crop.recycle()
                busy.set(false)
            }
        }
        if (!queued) {
            crop.recycle()
            busy.set(false)
        }
    }

    fun close() {
        if (closed) return
        closed = true
        onWorker {
            ocr.close()
            translator.close()
        }
        worker.shutdown()
        main.post { overlay.close() }
    }

    private fun onWorker(task: () -> Unit): Boolean = try {
        worker.execute(task)
        true
    } catch (e: RejectedExecutionException) {
        false // closed meanwhile
    }

    // ---------------------------------------------------------------- worker thread

    private fun read(crop: Bitmap, strip: Rect, pic: Rect, screen: Point, w: Int, h: Int, now: Long) {
        if (closed) return
        val sx = screen.x.toFloat() / w
        val sy = screen.y.toFloat() / h
        // Lines in frame pixels -> screen pixels.
        val raw = ocr.read(crop, strip.left, strip.top).map {
            SubtitleText.Line(
                it.text,
                (it.left * sx).roundToInt(), (it.top * sy).roundToInt(),
                (it.right * sx).roundToInt(), (it.bottom * sy).roundToInt(),
                it.confidence,
            )
        }
        val shown = current
        // Our own English read back: the recording includes the overlay. Put it above from now on.
        val shownEnglish = shown?.english
        if (!recordingSeesOverlay && shown != null && !shownEnglish.isNullOrBlank() &&
            raw.any { SubtitleText.sameText(it.text, shownEnglish) }
        ) {
            recordingSeesOverlay = true
            Log.i(TAG, "The recording sees the English box: placing it above the subtitle")
            post(shown)
        }
        val picked = SubtitleText.pickSubtitle(
            raw,
            (pic.left * sx).roundToInt(), (pic.right * sx).roundToInt(),
            (pic.height() * sy).roundToInt(), (pic.bottom * sy).roundToInt(),
            ownEnglish.toList(),
        )
        if (picked.isEmpty()) {
            // Gone (or never there). Give it a moment: a read can miss once.
            if (shown != null) {
                if (now - shown.seenAt > GONE_AFTER_MS) {
                    current = null
                    hide()
                } else {
                    recheck = true
                }
            }
            return
        }
        val text = picked.joinToString("\n") { it.text }
        val rect = Rect(picked.minOf { it.left }, picked.minOf { it.top }, picked.maxOf { it.right }, picked.maxOf { it.bottom })
        if (shown != null && SubtitleText.sameText(shown.text, text)) {
            // Same subtitle: keep the English, follow it if it moved.
            shown.seenAt = now
            if (rect != shown.rect || screen != shown.screen) {
                shown.rect = rect
                shown.screen = screen
                post(shown)
            }
            return
        }
        val oneLine = text.replace('\n', ' ')
        val lang = translator.language(oneLine)
        val next = Shown(text, null, rect, picked.size, now, screen)
        current = next
        if (lang == null || lang == "en") {
            // Already English (or can't tell): nothing to cover.
            if (lang == "en") note = "These subtitles are already English 👍"
            hide()
            return
        }
        val english = translator.toEnglish(oneLine, lang)
        if (closed || current !== next) return
        if (english.isNullOrBlank() || SubtitleText.sameText(english, oneLine)) {
            hide()
            return
        }
        next.english = english
        ownEnglish.addLast(english)
        while (ownEnglish.size > 4) ownEnglish.removeFirst()
        note = "${SubtitleTranslator.name(lang)} → English ✅"
        post(next)
        onNewEnglish?.invoke(english)
    }

    private fun post(s: Shown) {
        val english = s.english ?: return
        val cover = SubtitleOverlay.Cover(english, Rect(s.rect), recordingSeesOverlay, s.lines)
        val screen = s.screen
        main.post { if (!closed) overlay.show(cover, screen.x, screen.y) }
    }

    private fun hide() {
        main.post { if (!closed) overlay.show(null, 0, 0) }
    }

    // ---------------------------------------------------------------- capture thread helpers

    /**
     * Where the picture is in [frame]: a 16:9 show on a taller phone screen has black bars around
     * it. Bars must be there in 3 looks in a row (2 s apart) to count; a dark scene isn't a bar.
     */
    private fun pictureArea(frame: Bitmap, now: Long): Rect {
        val key = frame.width.toLong() shl 32 or frame.height.toLong()
        if (key != boxFor) {
            boxFor = key
            boxes.clear()
            boxAt = 0
        }
        if (now - boxAt > 2000) {
            boxAt = now
            val found = findPicture(frame)
            if (found != null) {
                boxes.addLast(found)
                while (boxes.size > 5) boxes.removeFirst()
            }
        }
        if (boxes.size < 3) return Rect(0, 0, frame.width, frame.height)
        // The union of the recent looks: a dark corner in one scene doesn't shrink the picture.
        var l = 1f
        var t = 1f
        var r = 0f
        var b = 0f
        for (x in boxes) {
            l = minOf(l, x[0])
            t = minOf(t, x[1])
            r = max(r, x[2])
            b = max(b, x[3])
        }
        return Rect((l * frame.width).toInt(), (t * frame.height).toInt(), (r * frame.width).roundToInt(), (b * frame.height).roundToInt())
    }

    private fun findPicture(frame: Bitmap): FloatArray? {
        shrink(frame, Rect(0, 0, frame.width, frame.height), smallFrame)
        smallFrame.getPixels(framePixels, 0, PW, 0, 0, PW, PH)
        val rows = BooleanArray(PH)
        val cols = BooleanArray(PW)
        for (y in 0 until PH) for (x in 0 until PW) {
            if (luma(framePixels[y * PW + x]) > 28) {
                rows[y] = true
                cols[x] = true
            }
        }
        val top = rows.indexOfFirst { it }
        val bottom = rows.indexOfLast { it }
        val left = cols.indexOfFirst { it }
        val right = cols.indexOfLast { it }
        if (top < 0 || bottom - top < PH / 4 || right - left < PW / 4) return null
        return floatArrayOf(
            max(0, left - 1).toFloat() / PW, max(0, top - 1).toFloat() / PH,
            minOf(PW, right + 2).toFloat() / PW, minOf(PH, bottom + 2).toFloat() / PH,
        )
    }

    // Sharp light/dark edges in a small copy of the strip: subtitle letters are full of them.
    private fun signature(frame: Bitmap, strip: Rect): BooleanArray {
        shrink(frame, strip, smallStrip)
        smallStrip.getPixels(stripPixels, 0, SW, 0, 0, SW, SH)
        val sig = BooleanArray(SW * SH)
        for (y in 0 until SH) for (x in 1 until SW) {
            val i = y * SW + x
            sig[i] = kotlin.math.abs(luma(stripPixels[i]) - luma(stripPixels[i - 1])) > 60
        }
        return sig
    }

    private fun shrink(frame: Bitmap, part: Rect, into: Bitmap) {
        Canvas(into).drawBitmap(frame, part, Rect(0, 0, into.width, into.height), smooth)
    }

    private fun luma(c: Int): Int = (((c shr 16) and 0xff) * 3 + ((c shr 8) and 0xff) * 6 + (c and 0xff)) / 10

    private companion object {
        const val TAG = "BroCast"
        const val LOOKING = "Looking for subtitles… 👀"
        const val WAITING = "Waiting for a video to play ▶️"
        const val OFFER_EVERY_MS = 300L
        const val GONE_AFTER_MS = 600L
        const val SAME_PICTURE = 25
        const val SW = 160
        const val SH = 40
        const val PW = 96
        const val PH = 54
    }
}
