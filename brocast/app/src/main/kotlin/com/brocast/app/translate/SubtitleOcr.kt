package com.brocast.app.translate

import android.graphics.Bitmap
import com.brocast.core.SubtitleText
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.TimeUnit

/**
 * Reads text in a picture with Google's on-phone text readers (ML Kit, works offline). There's one
 * reader per writing system; the one that worked last time goes first, so a show in one language
 * only needs one read per subtitle. Call from one background thread.
 */
class SubtitleOcr {
    enum class Kind(val script: (SubtitleText.Scripts) -> Int) {
        LATIN({ it.latin }),
        JAPANESE({ it.kana + it.han }),
        CHINESE({ it.han }),
        KOREAN({ it.hangul }),
    }

    private val readers = HashMap<Kind, TextRecognizer>()
    private var lastKind = Kind.LATIN
    private var emptyReads = 0

    private fun reader(kind: Kind): TextRecognizer = readers.getOrPut(kind) {
        when (kind) {
            Kind.LATIN -> TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            Kind.JAPANESE -> TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
            Kind.CHINESE -> TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
            Kind.KOREAN -> TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
        }
    }

    /**
     * Text lines in [bitmap], in its own pixels. Empty when there's no text. [offsetX]/[offsetY] are
     * added to every box (where the bitmap sits in the bigger picture).
     */
    fun read(bitmap: Bitmap, offsetX: Int = 0, offsetY: Int = 0): List<SubtitleText.Line> {
        val image = InputImage.fromBitmap(bitmap, 0)
        var kind = lastKind
        var lines = run(kind, image, offsetX, offsetY).orEmpty()
        if (lines.isEmpty()) {
            // Nothing. A reader can miss a writing system it doesn't know completely, so every
            // third empty look another reader gets a turn (one at a time: empty screens stay cheap).
            if (++emptyReads % 3 != 0) return emptyList()
            val others = Kind.entries.filter { it != lastKind }
            kind = others[(emptyReads / 3) % others.size]
            lines = run(kind, image, offsetX, offsetY).orEmpty()
            if (lines.isEmpty()) return emptyList()
        }
        emptyReads = 0
        if (fits(kind, lines)) {
            lastKind = kind
            return lines
        }
        // Text, but not in the writing system we expected: let the other readers try, keep the best.
        var best = lines
        var bestScore = score(kind, lines)
        var bestKind = kind
        for (other in Kind.entries) {
            if (other == kind) continue
            val found = run(other, image, offsetX, offsetY) ?: continue
            val s = score(other, found)
            if (s > bestScore) {
                best = found
                bestScore = s
                bestKind = other
            }
            if (fits(other, found)) break
        }
        lastKind = bestKind
        return best
    }

    fun close() {
        for (r in readers.values) {
            try {
                r.close()
            } catch (e: RuntimeException) {
                // already closed
            }
        }
        readers.clear()
    }

    private fun run(kind: Kind, image: InputImage, dx: Int, dy: Int): List<SubtitleText.Line>? = try {
        val text: Text = Tasks.await(reader(kind).process(image), 10, TimeUnit.SECONDS)
        text.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
                val box = line.boundingBox ?: return@mapNotNull null
                val conf = line.confidence.takeIf { it > 0f && !it.isNaN() } ?: 0.8f
                SubtitleText.Line(line.text, box.left + dx, box.top + dy, box.right + dx, box.bottom + dy, conf)
            }
        }
    } catch (e: Exception) {
        null // a reader that isn't available on this phone, or a timeout: skip it
    }

    // Mostly letters of this reader's own writing system, read with good confidence.
    private fun fits(kind: Kind, lines: List<SubtitleText.Line>): Boolean {
        if (lines.isEmpty()) return false
        val s = SubtitleText.scripts(lines.joinToString(" ") { it.text })
        if (s.total == 0) return false
        val own = kind.script(s)
        val mostlyOwn = own * 10 >= s.total * 7
        val sure = lines.map { it.confidence }.average() >= 0.7
        // A Latin read of Japanese/Chinese/Korean comes out as nonsense Latin letters: confidence decides.
        return mostlyOwn && sure && (kind != Kind.LATIN || s.latin == s.total)
    }

    private fun score(kind: Kind, lines: List<SubtitleText.Line>): Double {
        if (lines.isEmpty()) return 0.0
        val s = SubtitleText.scripts(lines.joinToString(" ") { it.text })
        if (s.total == 0) return 0.0
        val ownShare = kind.script(s).toDouble() / s.total
        return lines.map { it.confidence.toDouble() }.average() * (0.5 + ownShare)
    }
}
