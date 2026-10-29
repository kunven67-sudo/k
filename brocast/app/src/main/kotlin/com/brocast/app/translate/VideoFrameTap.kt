package com.brocast.app.translate

import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.SystemClock
import android.util.Log
import com.brocast.core.VideoHub
import java.nio.ByteBuffer
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Lets the subtitle reader see the shared screen while it goes out as smooth video: the video the
 * phone sends is decoded once more (hardware decoder) and every [everyMs] a frame goes to [sink],
 * in gray (subtitles are about light and dark, and gray is the cheap part of a video frame).
 *
 * Without this, reading subtitles would need the picture-by-picture mode, which is what made the
 * TV freeze in the first place.
 */
class VideoFrameTap(
    private val sink: (Bitmap) -> Unit,
    private val needKeyFrame: () -> Unit,
    private val everyMs: Long = 250,
) : VideoHub.Tap {
    private val queue = LinkedBlockingQueue<VideoHub.TapFrame>(QUEUE_SIZE)

    @Volatile
    private var running = true

    @Volatile
    private var dropping = false

    // ---- decoder thread
    private var codec: MediaCodec? = null
    private var generation = -1
    private var waitForKey = true
    private var lastSentAt = 0L
    private var bitmap: Bitmap? = null
    private var pixels = IntArray(0)
    private var row = ByteArray(0)
    private val info = MediaCodec.BufferInfo()

    // Started last, once everything above is set up.
    private val thread = Thread(::loop, "BroCast-subtitle-video").apply {
        isDaemon = true
        start()
    }

    init {
        needKeyFrame() // something to start decoding from
    }

    /** From the video hub (publishing thread): just queue it. */
    override fun onFrame(frame: VideoHub.TapFrame) {
        if (!running) return
        if (dropping && !frame.keyFrame) return
        dropping = false
        if (!queue.offer(frame)) {
            // The decoder can't keep up: skip to the next key frame (frames in between need their elders).
            queue.clear()
            dropping = true
            needKeyFrame()
        }
    }

    fun close() {
        running = false
        thread.interrupt()
    }

    private fun loop() {
        try {
            while (running) {
                val frame = queue.poll(500, TimeUnit.MILLISECONDS)
                if (frame != null) decode(frame)
                drain()
            }
        } catch (e: InterruptedException) {
            // closing
        } catch (e: Exception) {
            Log.w(TAG, "Subtitle video reader stopped", e)
        } finally {
            releaseCodec()
            bitmap?.recycle()
            bitmap = null
        }
    }

    private fun decode(frame: VideoHub.TapFrame) {
        if (frame.generation != generation) {
            // New size or settings: a new decoder, from the next key frame.
            releaseCodec()
            generation = frame.generation
            waitForKey = true
            codec = startCodec(frame)
        }
        val c = codec ?: return
        if (waitForKey) {
            if (!frame.keyFrame) return
            waitForKey = false
        }
        var index = -1
        // Wait a little for room, giving finished frames back meanwhile.
        for (attempt in 0 until 10) {
            index = c.dequeueInputBuffer(10_000)
            if (index >= 0) break
            drain()
        }
        if (index < 0) {
            // Stuck: start over from a key frame.
            waitForKey = true
            needKeyFrame()
            return
        }
        val buffer = c.getInputBuffer(index) ?: return
        buffer.clear()
        var size = 0
        for (nal in frame.nals) {
            if (buffer.remaining() < nal.size + 4) break
            buffer.put(START_CODE)
            buffer.put(nal)
            size += nal.size + 4
        }
        c.queueInputBuffer(index, 0, size, frame.ptsUs, if (frame.keyFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
    }

    private fun drain() {
        val c = codec ?: return
        while (true) {
            val index = c.dequeueOutputBuffer(info, 0)
            if (index < 0) return // try later, or a format/buffer change (nothing to do for those)
            val now = SystemClock.uptimeMillis()
            if (now - lastSentAt >= everyMs && info.size > 0) {
                lastSentAt = now
                try {
                    c.getOutputImage(index)?.use { image -> toGray(image)?.let(sink) }
                } catch (e: RuntimeException) {
                    Log.w(TAG, "Couldn't read a video frame", e)
                }
            }
            c.releaseOutputBuffer(index, false)
        }
    }

    // The brightness part of the frame, as a gray picture.
    private fun toGray(image: android.media.Image): Bitmap? {
        val plane = image.planes.firstOrNull() ?: return null
        val crop = image.cropRect
        val w = crop.width()
        val h = crop.height()
        if (w <= 0 || h <= 0) return null
        val bmp = bitmap?.takeIf { it.width == w && it.height == h && !it.isRecycled }
            ?: Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
                bitmap?.recycle()
                bitmap = it
                pixels = IntArray(w * h)
            }
        val src: ByteBuffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        val rowBytes = (w - 1) * pixelStride + 1
        if (row.size < rowBytes) row = ByteArray(rowBytes)
        for (y in 0 until h) {
            src.position((crop.top + y) * rowStride + crop.left * pixelStride)
            src.get(row, 0, rowBytes)
            val base = y * w
            for (x in 0 until w) {
                val v = row[x * pixelStride].toInt() and 0xff
                pixels[base + x] = OPAQUE or (v shl 16) or (v shl 8) or v
            }
        }
        bmp.setPixels(pixels, 0, w, 0, 0, w, h)
        return bmp
    }

    private fun startCodec(frame: VideoHub.TapFrame): MediaCodec? = try {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, frame.width, frame.height).apply {
            setByteBuffer("csd-0", ByteBuffer.wrap(START_CODE + frame.sps))
            setByteBuffer("csd-1", ByteBuffer.wrap(START_CODE + frame.pps))
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        }
        MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC).apply {
            configure(format, null, null, 0)
            start()
        }
    } catch (e: Exception) {
        Log.w(TAG, "No decoder for subtitle reading", e)
        null
    }

    private fun releaseCodec() {
        val c = codec ?: return
        codec = null
        try {
            c.stop()
        } catch (e: RuntimeException) {
            // already stopped
        }
        c.release()
    }

    private companion object {
        const val TAG = "BroCast"
        const val QUEUE_SIZE = 90
        const val OPAQUE = 0xff shl 24
        val START_CODE = byteArrayOf(0, 0, 0, 1)
    }
}
