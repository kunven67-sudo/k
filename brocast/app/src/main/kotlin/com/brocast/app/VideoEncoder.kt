package com.brocast.app

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import com.brocast.core.VideoHub
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The phone's own video encoder (the same chip that records your screen), fed straight from the
 * screen mirror through a [Surface]. Every encoded frame goes to [VideoHub].
 *
 * Make one with [create]; it picks a size the chip actually supports.
 */
class VideoEncoder private constructor(
    private val codec: MediaCodec,
    private val hub: VideoHub,
    val width: Int,
    val height: Int,
    private val thread: HandlerThread,
    private val onFailed: (VideoEncoder) -> Unit,
) {
    private val handler = Handler(thread.looper)

    /** Where the screen mirror draws. */
    lateinit var surface: Surface
        private set

    @Volatile
    private var released = false

    private val callback = object : MediaCodec.Callback() {
        override fun onInputBufferAvailable(codec: MediaCodec, index: Int) = Unit // input comes from the surface

        override fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
            if (released) return
            try {
                val buffer = codec.getOutputBuffer(index)
                if (buffer != null && info.size > 0) {
                    val data = ByteArray(info.size)
                    buffer.position(info.offset)
                    buffer.limit(info.offset + info.size)
                    buffer.get(data)
                    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                        configureHub(data)
                    } else {
                        hub.publish(data, info.presentationTimeUs, info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0)
                    }
                }
                codec.releaseOutputBuffer(index, false)
            } catch (e: IllegalStateException) {
                // Stopped while this frame was on its way.
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Bad video data from the encoder", e)
            }
        }

        override fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat) {
            // Some encoders hand over the SPS/PPS only here, as csd-0 / csd-1.
            val sps = format.getByteBuffer("csd-0")
            val pps = format.getByteBuffer("csd-1")
            if (sps != null && pps != null && !released) configureHub(withStartCode(sps) + withStartCode(pps))
        }

        override fun onError(codec: MediaCodec, e: MediaCodec.CodecException) {
            Log.w(TAG, "Video encoder error", e)
            if (!released) onFailed(this@VideoEncoder)
        }
    }

    private fun configureHub(config: ByteArray) {
        try {
            hub.configure(width, height, config)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Odd encoder settings", e)
        }
    }

    /** Ask for a key frame now (a TV just joined or fell behind). Safe from any thread. */
    fun requestKeyFrame() {
        handler.post {
            if (released) return@post
            try {
                codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0) })
            } catch (e: IllegalStateException) {
                // Encoder is stopping.
            }
        }
    }

    /** Stops the encoder. Switch the screen mirror to another surface first. Safe to call twice. */
    fun release() {
        if (released) return
        released = true
        handler.post {
            try {
                codec.stop()
            } catch (e: IllegalStateException) {
                // Already stopped or broken.
            }
            codec.release()
            surface.release()
            thread.quitSafely()
        }
    }

    companion object {
        private const val TAG = "BroCast"
        private const val MIME = MediaFormat.MIMETYPE_VIDEO_AVC

        /**
         * Starts an encoder for content of [contentWidth] x [contentHeight], with the longest side
         * at most [maxLongSide]. Tries smaller sizes (and 30 fps) when the chip can't do the first
         * choice. Returns null if nothing works: then BroCast sends pictures instead.
         */
        fun create(
            hub: VideoHub,
            contentWidth: Int,
            contentHeight: Int,
            maxLongSide: Int,
            bitrate: Int,
            fps: Int,
            onFailed: (VideoEncoder) -> Unit,
        ): VideoEncoder? {
            val scales = doubleArrayOf(1.0, 0.85, 0.75, 0.66, 0.5, 0.4)
            val rates = if (fps > 30) intArrayOf(fps, 30) else intArrayOf(fps)
            for (rate in rates) {
                for (scale in scales) {
                    val (w, h) = sizeFor(contentWidth, contentHeight, (maxLongSide * scale).roundToInt())
                    val encoder = tryCreate(hub, w, h, bitrate, rate, onFailed)
                    if (encoder != null) return encoder
                }
            }
            return null
        }

        /** Keeps the shape, longest side at most [maxLongSide], both sides a multiple of 16 (what encoders like). */
        fun sizeFor(contentWidth: Int, contentHeight: Int, maxLongSide: Int): Pair<Int, Int> {
            val cw = contentWidth.coerceAtLeast(16)
            val ch = contentHeight.coerceAtLeast(16)
            val scale = minOf(1.0, maxLongSide.toDouble() / max(cw, ch))
            val w = ((cw * scale).roundToInt() / 16 * 16).coerceAtLeast(16)
            val h = ((ch * scale).roundToInt() / 16 * 16).coerceAtLeast(16)
            return w to h
        }

        private fun tryCreate(
            hub: VideoHub,
            w: Int,
            h: Int,
            bitrate: Int,
            fps: Int,
            onFailed: (VideoEncoder) -> Unit,
        ): VideoEncoder? {
            val codec = try {
                MediaCodec.createEncoderByType(MIME)
            } catch (e: Exception) {
                Log.w(TAG, "No video encoder", e)
                return null
            }
            val video = try {
                codec.codecInfo.getCapabilitiesForType(MIME).videoCapabilities
            } catch (e: RuntimeException) {
                null
            }
            if (video != null) {
                val fits = try {
                    video.areSizeAndRateSupported(w, h, fps.toDouble())
                } catch (e: RuntimeException) {
                    video.isSizeSupported(w, h)
                }
                if (!fits) {
                    codec.release()
                    return null
                }
            }
            val rate = video?.bitrateRange?.clamp(bitrate) ?: bitrate
            // Full settings first; if the chip refuses, again with just the basics.
            for (extras in booleanArrayOf(true, false)) {
                val thread = HandlerThread("BroCast-encoder").apply { start() }
                val encoder = VideoEncoder(codec, hub, w, h, thread, onFailed)
                var surface: Surface? = null
                try {
                    codec.setCallback(encoder.callback, encoder.handler)
                    codec.configure(format(w, h, rate, fps, extras), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
                    surface = codec.createInputSurface()
                    encoder.surface = surface
                    codec.start()
                    Log.i(TAG, "Video encoder ${codec.name}: ${w}x$h @ $fps fps, ${rate / 1000} kbps")
                    return encoder
                } catch (e: Exception) {
                    Log.w(TAG, "Encoder refused ${w}x$h @ $fps (extras=$extras)", e)
                    surface?.release()
                    thread.quitSafely()
                    try {
                        codec.reset()
                    } catch (e2: Exception) {
                        break
                    }
                }
            }
            codec.release()
            return null
        }

        private fun format(w: Int, h: Int, bitrate: Int, fps: Int, extras: Boolean): MediaFormat =
            MediaFormat.createVideoFormat(MIME, w, h).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
                setInteger(MediaFormat.KEY_FRAME_RATE, fps)
                // A key frame every 2 s: a TV that skipped ahead never waits long for the next one.
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
                // On a still screen, repeat the last frame now and then, so TVs keep getting pictures.
                setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 100_000L)
                if (extras) {
                    setInteger(MediaFormat.KEY_PRIORITY, 0) // real time
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        setFloat(MediaFormat.KEY_MAX_FPS_TO_ENCODER, fps.toFloat())
                        setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0) // no frame reordering: lowest delay
                    }
                }
            }

        private fun withStartCode(b: ByteBuffer): ByteArray {
            val data = ByteArray(b.remaining())
            b.duplicate().get(data)
            val hasStart = data.size >= 4 && data[0].toInt() == 0 && data[1].toInt() == 0 &&
                (data[2].toInt() == 1 || (data[2].toInt() == 0 && data[3].toInt() == 1))
            return if (hasStart) data else byteArrayOf(0, 0, 0, 1) + data
        }
    }
}
