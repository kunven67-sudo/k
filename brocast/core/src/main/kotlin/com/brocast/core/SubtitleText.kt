package com.brocast.core

/**
 * Text helpers for reading subtitles off the screen (the phone version of SUBDUB): which language a
 * line is in, whether two reads are the same subtitle, and which of the lines found are the subtitle.
 * Plain Kotlin, so it's tested on a PC.
 */
object SubtitleText {

    /** One line of text found on screen, in screen pixels. */
    data class Line(val text: String, val left: Int, val top: Int, val right: Int, val bottom: Int, val confidence: Float = 1f) {
        val height get() = bottom - top
        val width get() = right - left
        val centerX get() = (left + right) / 2
    }

    /** Counts of letters per writing system. */
    data class Scripts(val kana: Int, val hangul: Int, val han: Int, val latin: Int, val cyrillic: Int, val other: Int) {
        val total get() = kana + hangul + han + latin + cyrillic + other
    }

    fun scripts(text: String): Scripts {
        var kana = 0
        var hangul = 0
        var han = 0
        var latin = 0
        var cyr = 0
        var other = 0
        var i = 0
        while (i < text.length) {
            val c = text.codePointAt(i)
            i += Character.charCount(c)
            when {
                c in 0x3040..0x30ff || c in 0x31f0..0x31ff || c in 0xff66..0xff9d -> kana++
                c in 0xac00..0xd7af || c in 0x1100..0x11ff || c in 0x3130..0x318f -> hangul++
                c in 0x4e00..0x9fff || c in 0x3400..0x4dbf -> han++
                Character.UnicodeScript.of(c) == Character.UnicodeScript.LATIN -> latin++
                Character.UnicodeScript.of(c) == Character.UnicodeScript.CYRILLIC -> cyr++
                Character.isLetter(c) -> other++
            }
        }
        return Scripts(kana, hangul, han, latin, cyr, other)
    }

    /** Language from the letters alone ("ja", "ko", "zh", "ru"), or null for Latin letters. */
    fun languageFromScript(text: String): String? {
        val s = scripts(text)
        if (s.total == 0) return null
        return when {
            s.kana * 10 > s.total -> "ja"
            s.hangul * 10 > s.total * 3 -> "ko"
            s.han * 2 > s.total -> "zh"
            s.cyrillic * 2 > s.total -> "ru"
            else -> null
        }
    }

    private val EN_WORDS = (
        "the a an and or but is are was were be been i you he she it we they me him her us them my your his its our " +
            "their this that what who why how where when do does did not no yes to of in on for with at by from up out " +
            "just so can will would could should have has had get got go going know like oh hey okay ok right well " +
            "don't i'm it's you're that's there here now come let's please sorry thank thanks"
        ).split(' ').toSet()

    /** Looks like English: Latin letters only and lots of everyday English words. */
    fun looksEnglish(text: String): Boolean {
        val words = Regex("[a-z']+").findAll(text.lowercase()).map { it.value }.toList()
        if (words.isEmpty()) return false
        val s = scripts(text)
        if (s.latin * 10 < s.total * 9) return false
        val hits = words.count { it in EN_WORDS }
        return if (words.size <= 2) hits == words.size else hits * 10 >= words.size * 3
    }

    private val STOP = mapOf(
        "es" to "que el la los las de del y en un una por para con no es está estás qué yo tú te me mi se lo le pero muy ya eso esto aquí ahora",
        "pt" to "que o a os as de do da e em um uma por para com não é está você eu meu minha se isso aqui agora muito já então também sei",
        "fr" to "le la les de des et en un une que qui ne pas est je tu il elle nous vous mon ma ce cette mais pour avec",
        "it" to "il lo la gli le di e in un una che non è sono io tu lui lei noi voi mio mia questo quello ma per con",
        "de" to "der die das und ist nicht ich du er sie wir ihr ein eine zu mit auf für aber was wie mein dein",
        "id" to "yang dan di ini itu aku kamu tidak ada untuk dengan dari ke juga saja sudah akan bisa apa",
    ).mapValues { it.value.split(' ').toSet() }

    /** Best guess of the language ("en", "es", "ja", ...) for a short subtitle, or null. */
    fun guessLanguage(text: String): String? {
        languageFromScript(text)?.let { return it }
        if (scripts(text).total == 0) return null
        if (looksEnglish(text)) return "en"
        val words = Regex("[\\p{L}']+").findAll(text.lowercase()).map { it.value }.toList()
        var best: String? = null
        var bestScore = 0
        for ((lang, set) in STOP) {
            var score = words.count { it in set }
            if (lang == "es" && Regex("[ñ¿¡]").containsMatchIn(text)) score += 2
            if (lang == "pt" && Regex("[ãõç]|ção|ções").containsMatchIn(text)) score += 2
            if (lang == "fr" && Regex("[èêëçœ]|\\b(c'est|j'ai|qu')").containsMatchIn(text)) score += 2
            if (lang == "de" && Regex("[äöüß]").containsMatchIn(text)) score += 2
            if (score > bestScore) {
                bestScore = score
                best = lang
            }
        }
        return if (bestScore > 0) best else null
    }

    /** Two reads of the same text, give or take a few misread letters or spaces. */
    fun sameText(a: String, b: String): Boolean {
        val x = normalize(a)
        val y = normalize(b)
        if (x.isEmpty() || y.isEmpty()) return x == y
        val limit = maxOf(1, Math.round(maxOf(x.length, y.length) * 0.2f))
        if (kotlin.math.abs(x.length - y.length) > limit) return false
        var prev = IntArray(y.length + 1) { it }
        for (i in 1..x.length) {
            val cur = IntArray(y.length + 1)
            cur[0] = i
            for (j in 1..y.length) {
                cur[j] = minOf(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + if (x[i - 1] == y[j - 1]) 0 else 1)
            }
            prev = cur
        }
        return prev[y.length] <= limit
    }

    private fun normalize(t: String) = t.lowercase().filter { it.isLetterOrDigit() }

    /**
     * Which of the lines found in the subtitle area are the subtitle:
     *  - a sensible size for subtitle text, and roughly centered on the picture,
     *  - not text under the picture (buttons, a status line) while a subtitle is inside it,
     *  - not our own English (when the screen recording includes it),
     *  - with two subtitles at once (e.g. Chinese + English), just the one you can't read.
     * [pictureLeft]..[pictureRight] and [pictureBottom]: where the picture is, in the same pixels.
     */
    fun pickSubtitle(
        lines: List<Line>,
        pictureLeft: Int,
        pictureRight: Int,
        pictureHeight: Int,
        pictureBottom: Int,
        ownEnglish: List<String> = emptyList(),
    ): List<Line> {
        val center = (pictureLeft + pictureRight) / 2
        val width = (pictureRight - pictureLeft).coerceAtLeast(1)
        var picked = lines.filter { l ->
            l.text.isNotBlank() && scripts(l.text).total >= 2 &&
                l.height > pictureHeight * 0.022 && l.height < pictureHeight * 0.14 &&
                kotlin.math.abs(l.centerX - center) < width * 0.3 && l.width > width * 0.04 &&
                l.confidence >= 0.4f &&
                ownEnglish.none { sameText(it, l.text) || it.contains(l.text.trim(), ignoreCase = true) && l.text.trim().length > 3 }
        }
        if (picked.size > 1) {
            val inside = picked.filter { it.top < pictureBottom - 2 }
            if (inside.isNotEmpty()) picked = inside
        }
        if (picked.size > 1) {
            val langs = picked.map { guessLanguage(it.text) }
            if ("en" in langs) {
                val foreign = picked.filterIndexed { i, _ -> langs[i] != null && langs[i] != "en" }
                if (foreign.isNotEmpty()) picked = foreign
            }
        }
        return picked.sortedWith(compareBy({ it.top }, { it.left }))
    }
}
