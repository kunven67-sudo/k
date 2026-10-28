package com.brocast.app.translate

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import com.brocast.core.VoicePitch
import java.util.Locale

/**
 * Reads the English subtitles out loud with the phone's text-to-speech voices: a guy's or a
 * girl's voice depending on how high the original voice was ([say]'s pitch). While it talks, the
 * show's sound is turned down a bit (Android "ducks" it), like a voice-over.
 */
class SubtitleVoice(context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private val audio = context.getSystemService(AudioManager::class.java)
    private val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener { }
        .build()
    private val tts = TextToSpeech(context.applicationContext) { status -> main.post { onReady(status) } }

    private var ready = false
    private var closed = false
    private var girl: Voice? = null
    private var guy: Voice? = null
    private var lastHigh = false
    private var lastText = ""
    private var lastTextAt = 0L
    private var nextId = 0

    /** Lines handed to the speech engine and not finished yet (main thread). */
    private val pending = HashSet<String>()
    private var holdingFocus = false

    /** True while an English line is being spoken (the show's own voice can't be measured then). */
    @Volatile
    var speaking = false
        private set

    /** Says [english]. [pitchHz]: how high the original voice was, null if unknown. Any thread. */
    fun say(english: String, pitchHz: Float?) {
        main.post { sayNow(english, pitchHz) }
    }

    fun close() {
        main.post {
            if (closed) return@post
            closed = true
            try {
                tts.stop()
                tts.shutdown()
            } catch (e: RuntimeException) {
                Log.w(TAG, "Speech engine shutdown failed", e)
            }
            releaseFocus()
            speaking = false
        }
    }

    // ---------------------------------------------------------------- main thread

    private fun onReady(status: Int) {
        if (closed) return
        if (status != TextToSpeech.SUCCESS) {
            Log.w(TAG, "No text-to-speech engine ($status)")
            return
        }
        tts.setAudioAttributes(attributes)
        // Voices that work offline and are installed; US English first.
        val english = try {
            tts.voices.orEmpty()
        } catch (e: RuntimeException) {
            emptySet()
        }.filter { v ->
            v.locale.language == "en" && !v.isNetworkConnectionRequired &&
                v.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true
        }.sortedBy { if (it.locale.country == "US") 0 else 1 }
        girl = english.firstOrNull { genderOf(it.name) == true }
        guy = english.firstOrNull { genderOf(it.name) == false }
        if (girl == null && guy == null) {
            try {
                tts.setLanguage(Locale.US)
            } catch (e: RuntimeException) {
                Log.w(TAG, "No US English voice", e)
            }
        }
        Log.i(TAG, "English voices: girl=${girl?.name} guy=${guy?.name}")
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                speaking = true
            }

            override fun onDone(utteranceId: String?) {
                main.post { lineEnded(utteranceId) }
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                main.post { lineEnded(utteranceId) }
            }

            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                main.post { lineEnded(utteranceId) }
            }
        })
        ready = true
    }

    private fun sayNow(english: String, pitchHz: Float?) {
        if (!ready || closed || english.isBlank()) return
        val now = SystemClock.uptimeMillis()
        // The same line again (the subtitle blinked): once is enough.
        if (english == lastText && now - lastTextAt < 6_000) return
        lastText = english
        lastTextAt = now
        val high = pitchHz?.let { it > VoicePitch.HIGH_VOICE_HZ } ?: lastHigh
        lastHigh = high
        val voice = if (high) girl else guy
        val pitch = when {
            voice != null -> 1f
            // No voice of that kind on this phone: bend the one there is.
            high -> if (girl == null && guy != null) 1.45f else 1.15f
            else -> if (guy == null && girl != null) 0.72f else 0.85f
        }
        (voice ?: girl ?: guy)?.let { tts.voice = it }
        tts.setPitch(pitch)
        // Behind already: talk faster. Way behind: skip to the newest line so the voice follows the show.
        tts.setSpeechRate(if (pending.isNotEmpty()) 1.3f else 1.08f)
        val mode = if (pending.size >= 2) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
        if (mode == TextToSpeech.QUEUE_FLUSH) pending.clear()
        if (!holdingFocus) {
            holdingFocus = audio.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
        val id = "line${nextId++}"
        if (tts.speak(english, mode, null, id) == TextToSpeech.SUCCESS) {
            pending += id
        } else if (pending.isEmpty()) {
            releaseFocus()
        }
    }

    private fun lineEnded(id: String?) {
        if (!pending.remove(id) || pending.isNotEmpty()) return
        speaking = false
        releaseFocus()
    }

    private fun releaseFocus() {
        if (!holdingFocus) return
        holdingFocus = false
        audio.abandonAudioFocusRequest(focus)
    }

    companion object {
        private const val TAG = "BroCast"

        // Google's and Samsung's English voices by name ("en-us-x-iom-local", "en-US-SMTf00").
        private val GIRL = setOf("sfg", "iob", "iog", "tpc", "tpf")
        private val GUY = setOf("iol", "iom", "tpd", "rjs")

        /** true: a girl's voice, false: a guy's, null: can't tell from the name. */
        fun genderOf(name: String): Boolean? {
            val n = name.lowercase()
            val parts = n.split('-', '_', '#', ' ')
            return when {
                parts.any { it in GIRL } || "female" in n || Regex("smtf\\d").containsMatchIn(n) -> true
                parts.any { it in GUY } || Regex("(^|[^e])male").containsMatchIn(n) || Regex("smtm\\d").containsMatchIn(n) -> false
                else -> null
            }
        }
    }
}
