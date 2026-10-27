package com.brocast.core

import com.brocast.core.SubtitleText.Line
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SubtitleTextTest {
    @Test
    fun languages() {
        assertEquals("ja", SubtitleText.guessLanguage("ここで何をしているの？"))
        assertEquals("zh", SubtitleText.guessLanguage("你在这里做什么"))
        assertEquals("ko", SubtitleText.guessLanguage("여기서 뭐 하는 거야?"))
        assertEquals("es", SubtitleText.guessLanguage("¿Qué estás haciendo aquí?"))
        assertEquals("pt", SubtitleText.guessLanguage("Eu não sei o que fazer agora"))
        assertEquals("en", SubtitleText.guessLanguage("What are you doing here"))
        assertEquals("ru", SubtitleText.guessLanguage("Что ты здесь делаешь"))
        assertNull(SubtitleText.guessLanguage("123 !!"))
    }

    @Test
    fun sameTextForgivesSmallMisreads() {
        assertTrue(SubtitleText.sameText("What are you doing here?", "What are y0u doing here"))
        assertTrue(SubtitleText.sameText("ここで何をしているの？", "ここで何をしているの"))
        assertFalse(SubtitleText.sameText("What are you doing here?", "Let's go home now"))
    }

    private val W = 1080
    private val H = 2400

    private fun line(text: String, top: Int, width: Int = 500, height: Int = 60, center: Int = W / 2) =
        Line(text, center - width / 2, top, center + width / 2, top + height)

    @Test
    fun picksTheForeignLineOfAPair() {
        val got = SubtitleText.pickSubtitle(
            listOf(line("你在这里做什么", 2000), line("What are you doing here", 2070, 700)),
            0, W, H, H,
        )
        assertEquals(listOf("你在这里做什么"), got.map { it.text })
    }

    @Test
    fun ignoresTinyFarOffAndUnderThePictureText() {
        val got = SubtitleText.pickSubtitle(
            listOf(
                line("¿Qué estás haciendo aquí?", 1500, 600),
                line("12:30", 1700, 100, 20), // tiny clock
                line("Next episode", 1600, 300, center = 100), // off to the side
                line("Skip intro", 1950, 400), // under the picture (black bar)
            ),
            0, W, 1800, 1900,
        )
        assertEquals(listOf("¿Qué estás haciendo aquí?"), got.map { it.text })
    }

    @Test
    fun aSubtitleOnlyUnderThePictureStillCounts() {
        val got = SubtitleText.pickSubtitle(listOf(line("Eu não sei o que fazer agora", 1950, 700)), 0, W, 1800, 1900)
        assertEquals(1, got.size)
    }

    @Test
    fun neverReadsOurOwnEnglishBack() {
        val got = SubtitleText.pickSubtitle(
            listOf(line("What are you doing here?", 1900, 700), line("¿Qué estás haciendo aquí?", 2000, 650)),
            0, W, H, H, ownEnglish = listOf("What are you doing here?"),
        )
        assertEquals(listOf("¿Qué estás haciendo aquí?"), got.map { it.text })
    }
}
