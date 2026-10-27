package com.brocast.app.translate

import android.util.LruCache
import com.brocast.core.SubtitleText
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Any language -> English with Google's offline translator (ML Kit). Each language's translator is
 * downloaded once (about 30 MB, needs internet that one time), then works offline.
 * Call from one background thread.
 */
class SubtitleTranslator(private val onStatus: (String) -> Unit = {}) {
    private val translators = HashMap<String, Translator>()
    private val ready = HashSet<String>()
    private val failedAt = HashMap<String, Long>()
    private val memo = LruCache<String, String>(300)
    private val languageId = LanguageIdentification.getClient(
        LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.05f).build(),
    )

    /** How many subtitles came up in each language: a show mostly sticks to one. */
    private val seen = HashMap<String, Int>()

    /** "es", "ja", ... for a subtitle, "en" for English, or null if it can't tell. */
    fun language(text: String): String? {
        val usual = seen.maxByOrNull { it.value }?.takeIf { it.value >= 3 }?.key
        val lang = pickLanguage(text, usual) ?: return null
        if (lang != "en") seen[lang] = (seen[lang] ?: 0) + 1
        return lang
    }

    private fun pickLanguage(text: String, usual: String?): String? {
        SubtitleText.languageFromScript(text)?.let {
            // A line of only kanji looks Chinese; in a Japanese show it's Japanese.
            return if (it == "zh" && usual == "ja") "ja" else it
        }
        if (SubtitleText.looksEnglish(text)) return "en"
        val guesses = try {
            Tasks.await(languageId.identifyPossibleLanguages(text), 3, TimeUnit.SECONDS)
        } catch (e: Exception) {
            emptyList()
        }.filter { it.languageTag != "und" }
        // Short lines get mixed up (Spanish read as Galician...) and every new language is a 30 MB
        // download, so the show's usual language wins whenever it's one of the guesses.
        if (usual != null && guesses.any { it.languageTag.substringBefore('-') == usual }) return usual
        val best = guesses.maxByOrNull { it.confidence }
        if (best != null && best.confidence >= 0.4f) return best.languageTag.substringBefore('-')
        return usual ?: SubtitleText.guessLanguage(text)
    }

    /** English for [text] in [lang], or null when this language can't be translated (yet). */
    fun toEnglish(text: String, lang: String): String? {
        if (lang == "en") return text
        val key = "$lang|$text"
        memo.get(key)?.let { return it }
        val source = TranslateLanguage.fromLanguageTag(lang) ?: return null
        // No internet the last time: try the download again after a minute, not on every subtitle.
        failedAt[lang]?.let { if (android.os.SystemClock.uptimeMillis() - it < 60_000) return null }
        val translator = translators.getOrPut(lang) {
            Translation.getClient(
                TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(TranslateLanguage.ENGLISH).build(),
            )
        }
        if (lang !in ready) {
            onStatus("Getting the ${name(lang)} translator (one time, about 30 MB)…")
            try {
                Tasks.await(translator.downloadModelIfNeeded(DownloadConditions.Builder().build()), 5, TimeUnit.MINUTES)
                ready += lang
                onStatus("${name(lang)} → English ready")
            } catch (e: Exception) {
                failedAt[lang] = android.os.SystemClock.uptimeMillis()
                onStatus("Couldn't get the ${name(lang)} translator. Check your internet.")
                return null
            }
        }
        val english = try {
            Tasks.await(translator.translate(text), 10, TimeUnit.SECONDS)
        } catch (e: Exception) {
            return null
        }
        memo.put(key, english)
        return english
    }

    fun close() {
        for (t in translators.values) t.close()
        translators.clear()
        languageId.close()
    }

    companion object {
        fun name(lang: String): String = Locale.forLanguageTag(lang).getDisplayLanguage(Locale.ENGLISH).ifBlank { lang }
    }
}
