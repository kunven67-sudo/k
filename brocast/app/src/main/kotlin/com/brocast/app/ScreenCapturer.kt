package com.brocast.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.Point
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Log
import android.view.Display
import android.view.Surface
import androidx.core.graphics.createBitmap
import com.brocast.core.FrameHub
import com.brocast.core.VideoHub
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Mirrors the screen and feeds it to the TVs in one of two ways:
 *
 *  - **Video** (normal): the phone's hardware encoder makes H.264 video ([VideoEncoder] → [VideoHub]).
 *    Small enough for any Wi-Fi, even for fast-moving stuff like anime.
 *  - **Pictures**: frames become JPEGs ([FrameHub]). Used while a browser that can't play the video
 *    is watching, or if this phone's encoder doesn't work.
 *
 * Android 14+ allows one screen mirror per sharing session, so it's created once and simply
 * pointed at the encoder or the picture reader.
 *
 * Everything runs on one background thread, so there are no locks.
 */
class ScreenCapturer(
    context: Context,
    private val projection: MediaProjection,
    private val hub: FrameHub,
    private val video: VideoHub?,
    initialQuality: Quality,
    private val listener: Listener,
    /** True while pictures are needed: a browser that can only show pictures, or [subtitleReader]. */
    private val picturesWanted: () -> Boolean = { false },
    /** SUBDUB on the phone while it's on: gets the picture-mode frames to read subtitles from. */
    private val subtitleReader: () -> ((Bitmap) -> Unit)? = { null },
    /** False while no browser wants JPEG pictures: frames then only go to [subtitleReader]. */
    private val jpegNeeded: () -> Boolean = { true },
) {
    interface Listener {
        /** Android (or the user, from the status bar) ended the capture. Called on the capture thread. */
        fun onCaptureStopped()

        /** Capture couldn't start. Called on the capture thread. */
        fun onCaptureFailed(message: String)
    }

    private enum class Mode { VIDEO, PICTURES }

    private val appContext = context.applicationContext
    private val displayManager = appContext.getSystemService(DisplayManager::class.java)
    private val densityDpi = appContext.resources.displayMetrics.densityDpi
    private val thread = HandlerThread("BroCast-capture").apply { start() }
    private val handler = Handler(thread.looper)

    @Volatile
    private var releaseRequested = false

    /** True while the picture goes out as video. */
    @Volatile
    var isVideo = false
        private set

    // ---- Only touched on the capture thread from here on.
    private var quality = initialQuality
    private var mode = Mode.PICTURES
    private var virtualDisplay: VirtualDisplay? = null
    private var reader: ImageReader? = null

    // Read from other threads too (key frame requests from the web server).
    @Volatile
    private var encoder: VideoEncoder? = null
    private var mirrorWidth = 0
    private var mirrorHeight = 0
    private var contentWidth = 0
    private var contentHeight = 0
    private var videoBroken = video == null
    private var encoderRestarts = 0

    // A still screen makes no new frames, so after a switch the TVs could wait for one: see checkMode.
    private var switchedAt = 0L
    private var framesAtSwitch = 0L
    private var nudged = false

    /** False when Android 14+ shares a single app: then that app's size matters, not the screen's. */
    private var followDisplay = true
    private var bitmap: Bitmap? = null
    private var packed: ByteBuffer? = null
    private val jpeg = ByteArrayOutputStream(256 * 1024)
    private var nextFrameAt = 0L
    private var frameScheduled = false
    private var released = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            if (released) return
            releaseOnThread()
            listener.onCaptureStopped()
        }

        // Android 14+: tells us the real size of what's being shared (whole screen or one app).
        override fun onCapturedContentResize(width: Int, height: Int) {
            if (released || width <= 0 || height <= 0) return
            val display = displaySize()
            followDisplay = sameSize(width, height, display.x, display.y)
            contentWidth = width
            contentHeight = height
            applySize()
        }
    }

    // Phone rotated or folded/unfolded: resize so the TV gets a full picture, not black bars.
    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) = Unit
        override fun onDisplayChanged(displayId: Int) {
            if (released || displayId != Display.DEFAULT_DISPLAY || !followDisplay) return
            val display = displaySize()
            contentWidth = display.x
            contentHeight = display.y
            applySize()
        }
    }

    private val imageListener = ImageReader.OnImageAvailableListener { r ->
        if (r === reader) scheduleFrame()
    }

    private val processFrame = Runnable { captureFrame() }

    // Twice a second: video or pictures? And is the video still flowing?
    private val modeCheck = object : Runnable {
        override fun run() {
            if (released) return
            checkMode()
            handler.postDelayed(this, MODE_CHECK_MS)
        }
    }

    fun start() {
        handler.post {
            if (released) return@post
            try {
                // Android 14 requires the callback to be registered before the virtual display.
                projection.registerCallback(projectionCallback, handler)
                val display = displaySize()
                contentWidth = display.x
                contentHeight = display.y
                val wanted = if (videoBroken || picturesWanted()) Mode.PICTURES else Mode.VIDEO
                val surface = prepare(wanted) ?: prepare(Mode.PICTURES)
                    ?: throw IllegalStateException("No picture reader")
                virtualDisplay = projection.createVirtualDisplay(
                    "BroCast", mirrorWidth, mirrorHeight, densityDpi,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    surface, null, handler,
                ) ?: throw IllegalStateException("No virtual display")
                displayManager.registerDisplayListener(displayListener, handler)
                // Video first: a TV checking in between must not see "live" before it knows it's video.
                video?.setLive(mode == Mode.VIDEO)
                hub.setLive(true)
                markSwitch()
                handler.postDelayed(modeCheck, MODE_CHECK_MS)
            } catch (e: Exception) {
                Log.e(TAG, "Capture failed to start", e)
                releaseOnThread()
                listener.onCaptureFailed("Couldn't start capturing your screen 😵 (${e.javaClass.simpleName}). Try again?")
            }
        }
    }

    fun setQuality(newQuality: Quality) {
        handler.post {
            if (released || newQuality == quality) return@post
            quality = newQuality
            rebuild()
        }
    }

    /** A TV joined or fell behind and needs a fresh starting point. Safe from any thread. */
    fun requestKeyFrame() {
        encoder?.requestKeyFrame()
    }

    /** Stops everything. Safe to call more than once, from any thread. */
    fun release() {
        if (releaseRequested) return
        releaseRequested = true
        handler.post { releaseOnThread() }
        thread.quitSafely()
    }

    // ---------------------------------------------------------------- capture thread

    /**
     * Makes the encoder or the picture reader for [m] at the right size and returns its surface,
     * or null if that didn't work. Sets [mode], [mirrorWidth] and [mirrorHeight] on success.
     */
    private fun prepare(m: Mode): Surface? {
        if (m == Mode.VIDEO) {
            val hubForVideo = video ?: return null
            val enc = VideoEncoder.create(
                hubForVideo, contentWidth, contentHeight,
                quality.videoLongSide, quality.videoBitrate, quality.videoFps,
                onFailed = { failed -> handler.post { onEncoderFailed(failed) } },
            )
            if (enc == null) {
                Log.w(TAG, "No usable video encoder: sending pictures instead")
                videoBroken = true
                return null
            }
            encoder = enc
            mode = Mode.VIDEO
            isVideo = true
            mirrorWidth = enc.width
            mirrorHeight = enc.height
            return enc.surface
        }
        val (w, h) = pictureSize()
        val r = try {
            newReader(w, h)
        } catch (e: RuntimeException) {
            Log.w(TAG, "Couldn't make a ${w}x$h picture reader", e)
            return null
        }
        reader = r
        mode = Mode.PICTURES
        isVideo = false
        mirrorWidth = w
        mirrorHeight = h
        return r.surface
    }

    /** Points the mirror at a fresh encoder / reader (new mode, new size or new quality). */
    private fun rebuild(target: Mode = mode) {
        val vd = virtualDisplay ?: return
        val oldEncoder = encoder
        val oldReader = reader
        encoder = null
        reader = null
        // From here on only the new encoder's frames may reach the TVs (old ones would show as garbage).
        oldEncoder?.muted = true
        val surface = prepare(target) ?: prepare(Mode.PICTURES)
        if (surface == null) {
            // Nothing new worked: keep what we had.
            oldEncoder?.muted = false
            encoder = oldEncoder
            reader = oldReader
            return
        }
        vd.resize(mirrorWidth, mirrorHeight, densityDpi)
        vd.surface = surface
        if (oldEncoder != null && oldEncoder !== encoder) oldEncoder.release()
        if (oldReader != null && oldReader !== reader) {
            oldReader.setOnImageAvailableListener(null, null)
            oldReader.close()
        }
        video?.setLive(mode == Mode.VIDEO)
        if (mode == Mode.VIDEO) handler.removeCallbacks(processFrame)
        markSwitch()
    }

    private fun totalFrames() = hub.framesPublished + (video?.framesPublished ?: 0L)

    private fun markSwitch() {
        switchedAt = SystemClock.uptimeMillis()
        framesAtSwitch = totalFrames()
        nudged = false
    }

    private fun checkMode() {
        val wanted = if (videoBroken || picturesWanted()) Mode.PICTURES else Mode.VIDEO
        if (wanted != mode) {
            Log.i(TAG, "Switching to $wanted")
            rebuild(wanted)
            return
        }
        // Subtitle reading switched on or off: sharper or normal pictures.
        if (mode == Mode.PICTURES) applySize()
        // Video mode with TVs watching but no frame for a while: nudge the encoder for a fresh one.
        val v = video
        val enc = encoder
        if (mode == Mode.VIDEO && v != null && enc != null && v.clientCount > 0 && v.millisSinceLastFrame > STALE_VIDEO_MS) {
            enc.requestKeyFrame()
        }
        // Nothing made since starting / switching, because the screen is still: Android only draws
        // the mirror when something changes, so the TV would sit on "Loading". Resizing the mirror a
        // hair makes Android draw it right away.
        val vd = virtualDisplay
        val someoneWaits = mode == Mode.PICTURES || (v?.clientCount ?: 0) > 0
        if (vd != null && !nudged && someoneWaits && totalFrames() == framesAtSwitch &&
            SystemClock.uptimeMillis() - switchedAt > NUDGE_AFTER_MS
        ) {
            nudged = true
            vd.resize(mirrorWidth, mirrorHeight - 2, densityDpi)
            handler.postDelayed({ if (!released && virtualDisplay === vd) vd.resize(mirrorWidth, mirrorHeight, densityDpi) }, 150)
        }
    }

    private fun onEncoderFailed(failed: VideoEncoder) {
        if (released || failed !== encoder) return
        encoderRestarts++
        if (encoderRestarts > MAX_ENCODER_RESTARTS) {
            Log.w(TAG, "Video encoder keeps failing: sending pictures instead")
            videoBroken = true
            rebuild(Mode.PICTURES)
        } else {
            rebuild(Mode.VIDEO)
        }
    }

    private fun newReader(width: Int, height: Int): ImageReader =
        ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3).apply {
            setOnImageAvailableListener(imageListener, handler)
        }

    private fun applySize() {
        if (virtualDisplay == null) return
        val (w, h) = if (mode == Mode.VIDEO) {
            VideoEncoder.sizeFor(contentWidth, contentHeight, quality.videoLongSide)
        } else {
            pictureSize()
        }
        if (w == mirrorWidth && h == mirrorHeight) return
        rebuild()
    }

    private fun pictureSize(): Pair<Int, Int> {
        val cw = contentWidth.coerceAtLeast(2)
        val ch = contentHeight.coerceAtLeast(2)
        // Reading subtitles wants sharp text: at least 1920 on the long side (or the screen's own size).
        val longSide = if (subtitleReader() != null) max(quality.maxLongSide, 1920) else quality.maxLongSide
        val scale = min(1.0, longSide.toDouble() / max(cw, ch))
        val w = ((cw * scale).roundToInt() / 2 * 2).coerceAtLeast(2)
        val h = ((ch * scale).roundToInt() / 2 * 2).coerceAtLeast(2)
        return w to h
    }

    // Frames are paced to the quality's frame rate. Throttled frames aren't dropped for good:
    // the next run grabs the newest one, so the TV always ends on the latest screen.
    private fun scheduleFrame() {
        if (released || frameScheduled) return
        frameScheduled = true
        val delay = (nextFrameAt - SystemClock.uptimeMillis()).coerceAtLeast(0L)
        handler.postDelayed(processFrame, delay)
    }

    private fun captureFrame() {
        frameScheduled = false
        if (released) return
        val r = reader ?: return
        val image = try {
            r.acquireLatestImage()
        } catch (e: RuntimeException) {
            Log.w(TAG, "acquireLatestImage failed", e)
            null
        } ?: return
        val started = SystemClock.uptimeMillis()
        val bmp = try {
            copyToBitmap(image)
        } catch (e: RuntimeException) {
            Log.w(TAG, "Frame copy failed", e)
            null
        } finally {
            image.close()
        }
        val toTv = jpegNeeded()
        val subtitles = subtitleReader()
        if (bmp != null) {
            if (subtitles != null) {
                try {
                    subtitles(bmp)
                } catch (e: RuntimeException) {
                    Log.w(TAG, "Subtitle reader failed", e)
                }
            }
            if (toTv) {
                jpeg.reset()
                if (bmp.compress(Bitmap.CompressFormat.JPEG, quality.jpegQuality, jpeg)) {
                    hub.publish(jpeg.toByteArray(), bmp.width, bmp.height)
                }
            }
        }
        // No TV wants pictures: a few a second are plenty for reading subtitles.
        nextFrameAt = started + if (toTv || subtitles == null) quality.frameIntervalMs else READ_ONLY_INTERVAL_MS
    }

    private fun copyToBitmap(image: Image): Bitmap? {
        val plane = image.planes.firstOrNull() ?: return null
        val width = image.width
        val height = image.height
        if (plane.pixelStride != 4 || width <= 0 || height <= 0) return null
        val rowBytes = width * 4
        val rowStride = plane.rowStride

        val bmp = bitmap?.takeIf { it.width == width && it.height == height && !it.isRecycled }
            ?: createBitmap(width, height).also {
                bitmap?.recycle()
                bitmap = it
            }

        val src = plane.buffer
        if (rowStride == rowBytes) {
            src.rewind()
            bmp.copyPixelsFromBuffer(src)
        } else {
            // Rows are padded (common!). Copy row by row; the last row has no padding, so
            // treating the buffer as one big padded image would read past its end.
            val dst = packed?.takeIf { it.capacity() == rowBytes * height }
                ?: ByteBuffer.allocateDirect(rowBytes * height).also { packed = it }
            dst.clear()
            for (y in 0 until height) {
                val start = y * rowStride
                src.limit(start + rowBytes)
                src.position(start)
                dst.put(src)
            }
            dst.flip()
            bmp.copyPixelsFromBuffer(dst)
        }
        // The screen is never see-through, but some phones leave the alpha byte at 0. Marking
        // the bitmap opaque makes the JPEG encoder ignore it instead of producing black.
        bmp.setHasAlpha(false)
        return bmp
    }

    private fun releaseOnThread() {
        if (released) return
        released = true
        hub.setLive(false)
        video?.setLive(false)
        isVideo = false
        handler.removeCallbacks(processFrame)
        handler.removeCallbacks(modeCheck)
        ignoring { displayManager.unregisterDisplayListener(displayListener) }
        ignoring { virtualDisplay?.release() }
        virtualDisplay = null
        encoder?.release()
        encoder = null
        reader?.let {
            it.setOnImageAvailableListener(null, null)
            ignoring { it.close() }
        }
        reader = null
        ignoring { projection.unregisterCallback(projectionCallback) }
        ignoring { projection.stop() }
        bitmap?.recycle()
        bitmap = null
        packed = null
    }

    @Suppress("DEPRECATION") // getRealSize is the simplest way to read the size from a Service.
    private fun displaySize(): Point {
        val point = Point()
        displayManager.getDisplay(Display.DEFAULT_DISPLAY)?.getRealSize(point)
        if (point.x <= 0 || point.y <= 0) {
            val metrics = appContext.resources.displayMetrics
            point.set(metrics.widthPixels, metrics.heightPixels)
        }
        return point
    }

    private fun sameSize(w: Int, h: Int, dw: Int, dh: Int) = (w == dw && h == dh) || (w == dh && h == dw)

    private inline fun ignoring(block: () -> Unit) {
        try {
            block()
        } catch (e: RuntimeException) {
            Log.w(TAG, "Ignored during cleanup", e)
        }
    }

    private companion object {
        const val TAG = "BroCast"
        const val MODE_CHECK_MS = 500L
        const val STALE_VIDEO_MS = 3_000L
        const val NUDGE_AFTER_MS = 1_000L
        const val READ_ONLY_INTERVAL_MS = 150L
        const val MAX_ENCODER_RESTARTS = 3
    }
}
