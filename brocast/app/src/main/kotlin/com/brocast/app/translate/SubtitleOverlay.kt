package com.brocast.app.translate

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.provider.Settings
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A small see-through window over every app (Android's "display over other apps") that puts the
 * English right over the foreign subtitle. Use from the main thread.
 *
 * The window is only as big as the English box. Android 12+ throws away taps that land on another
 * app's window, so a full-screen layer would block every tap on the app playing the show.
 */
class SubtitleOverlay(context: Context) {
    /**
     * What to show: [english] over [rect] (screen pixels), which holds [lines] lines of the original.
     * [above]: just above it instead of on it.
     */
    data class Cover(val english: String, val rect: Rect, val above: Boolean, val lines: Int = 1)

    private val appContext = context.applicationContext
    private val wm = appContext.getSystemService(WindowManager::class.java)
    private val density = appContext.resources.displayMetrics.density
    private val text = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    private var view: BoxView? = null
    private var params: WindowManager.LayoutParams? = null
    private var shown: Cover? = null
    private var screenWidth = 0
    private var screenHeight = 0

    val allowed: Boolean get() = Settings.canDrawOverlays(appContext)

    /** Shows [cover] ([screenW] x [screenH]: the screen size its rect is measured in), or hides the box (null). */
    fun show(cover: Cover?, screenW: Int, screenH: Int) {
        if (cover == null) {
            shown = null
            view?.visibility = View.GONE
            return
        }
        if (cover == shown && screenW == screenWidth && screenH == screenHeight && view?.visibility == View.VISIBLE) return
        shown = cover
        screenWidth = screenW
        screenHeight = screenH
        val box = place(cover, screenW, screenH) ?: return
        val v = view ?: attach() ?: return
        val lp = params ?: return
        v.box = box
        lp.x = box.x
        lp.y = box.y
        lp.width = box.width
        lp.height = box.height
        v.visibility = View.VISIBLE
        try {
            wm.updateViewLayout(v, lp)
        } catch (e: RuntimeException) {
            Log.w(TAG, "Couldn't move the subtitle box", e)
        }
    }

    fun close() {
        val v = view ?: return
        view = null
        params = null
        shown = null
        try {
            wm.removeView(v)
        } catch (e: RuntimeException) {
            // already gone
        }
    }

    private fun attach(): BoxView? {
        if (!allowed) return null
        val v = BoxView(appContext, density)
        val flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        val lp = WindowManager.LayoutParams(
            1, 1, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, flags, PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) fitInsetsTypes = 0
            title = "BroCast English subtitles"
        }
        return try {
            wm.addView(v, lp)
            view = v
            params = lp
            v
        } catch (e: RuntimeException) {
            Log.w(TAG, "Couldn't show the subtitle box", e)
            null
        }
    }

    /** One laid-out box: where it goes on the screen and the English inside it. */
    class Box(val x: Int, val y: Int, val width: Int, val height: Int, val layout: StaticLayout)

    // Starts at the original subtitle's text size and shrinks until the English fits in 3 lines.
    private fun place(c: Cover, screenW: Int, screenH: Int): Box? {
        if (screenW <= 0 || screenH <= 0 || c.english.isBlank()) return null
        val r = c.rect
        val pad = (10 * density).roundToInt()
        val maxText = (screenW * 0.92f - 2 * pad).toInt().coerceAtLeast(1)
        var size = (r.height().toFloat() / max(1, c.lines) * 0.78f).coerceIn(14 * density, 34 * density)
        var layout: StaticLayout
        while (true) {
            text.textSize = size
            val want = min(maxText.toFloat(), max(r.width().toFloat(), text.measureText(c.english))).toInt().coerceAtLeast(1)
            layout = StaticLayout.Builder.obtain(c.english, 0, c.english.length, text, want)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setLineSpacing(0f, 1f)
                .setIncludePad(false)
                .build()
            if (layout.lineCount <= 3 || size <= 12 * density) break
            size *= 0.9f
        }
        var textWidth = 0f
        for (i in 0 until layout.lineCount) textWidth = max(textWidth, layout.getLineWidth(i))
        // Covering: centered on the original and at least as big, so it's fully hidden.
        // Above: sits just over it, leaving the original visible.
        val width = min(screenW, max(r.width() + 2 * pad, ceil(textWidth).toInt() + 2 * pad))
        val height = if (c.above) layout.height + 2 * pad else max(layout.height, r.height()) + 2 * pad
        val x = (r.centerX() - width / 2).coerceIn(0, max(0, screenW - width))
        val y = if (c.above) {
            (r.top - height - (6 * density).roundToInt()).coerceAtLeast(0)
        } else {
            (r.centerY() - height / 2).coerceIn(0, max(0, screenH - height))
        }
        return Box(x, y, width, height, layout)
    }

    /** Draws the box: dark rounded rectangle, English in white, centered. */
    private class BoxView(context: Context, private val density: Float) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(235, 12, 12, 18) }
        private val area = RectF()

        var box: Box? = null
            set(value) {
                field = value
                invalidate()
            }

        override fun onDraw(canvas: Canvas) {
            val b = box ?: return
            area.set(0f, 0f, width.toFloat(), height.toFloat())
            canvas.drawRoundRect(area, 10 * density, 10 * density, paint)
            canvas.save()
            canvas.translate((width - b.layout.width) / 2f, (height - b.layout.height) / 2f)
            b.layout.draw(canvas)
            canvas.restore()
        }
    }

    private companion object {
        const val TAG = "BroCast"
    }
}
