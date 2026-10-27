package com.brocast.core

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class VoicePitchTest {
    // A voice-ish sound: a pitch with harmonics that fade (like vocal cords), slightly wobbling,
    // as 48 kHz stereo 16-bit PCM in 20 ms chunks (what the phone captures).
    private fun voice(hz: Double, seconds: Double, loud: Double = 6000.0, noise: Double = 0.0, seed: Int = 1): List<ByteArray> {
        val rate = 48_000
        val rnd = Random(seed)
        val total = (rate * seconds).toInt()
        val chunks = mutableListOf<ByteArray>()
        var phase = 0.0
        var chunk = ByteArray(rate / 50 * 4)
        var at = 0
        for (i in 0 until total) {
            val f = hz * (1 + 0.02 * sin(2 * PI * 5 * i / rate)) // vibrato
            phase += 2 * PI * f / rate
            var v = 0.0
            for (h in 1..8) v += sin(h * phase) / h
            v = v * loud * 0.6 + (rnd.nextDouble() * 2 - 1) * noise
            val s = v.toInt().coerceIn(-32768, 32767)
            for (c in 0 until 2) {
                chunk[at++] = (s and 0xff).toByte()
                chunk[at++] = (s shr 8).toByte()
            }
            if (at == chunk.size) {
                chunks += chunk
                chunk = ByteArray(chunk.size)
                at = 0
            }
        }
        return chunks
    }

    private fun heard(chunks: List<ByteArray>): Float? {
        val p = VoicePitch(48_000, 2)
        chunks.forEach { p.feed(it) }
        return p.recentPitch()
    }

    @Test
    fun guyAndGirlVoices() {
        for (hz in listOf(95.0, 120.0, 150.0, 210.0, 260.0, 320.0)) {
            val got = assertNotNull(heard(voice(hz, 1.5)), "$hz Hz")
            assertTrue(abs(got - hz) / hz < 0.06, "$hz Hz heard as $got")
            assertTrue((got > VoicePitch.HIGH_VOICE_HZ) == (hz > VoicePitch.HIGH_VOICE_HZ), "$hz Hz")
        }
    }

    @Test
    fun voiceOverSomeBackgroundNoiseStillCounts() {
        val got = assertNotNull(heard(voice(230.0, 1.5, noise = 1500.0)))
        assertTrue(abs(got - 230) < 15, "heard $got")
    }

    @Test
    fun silenceAndNoiseHaveNoPitch() {
        assertNull(heard(voice(200.0, 1.5, loud = 0.0)))
        assertNull(heard(voice(200.0, 1.5, loud = 0.0, noise = 8000.0)))
    }

    @Test
    fun onlyTheLastMomentCounts() {
        val p = VoicePitch(48_000, 2)
        voice(110.0, 2.0).forEach { p.feed(it) }
        voice(280.0, 1.0).forEach { p.feed(it) }
        val got = assertNotNull(p.recentPitch(800))
        assertTrue(abs(got - 280) < 20, "heard $got")
        p.clear()
        assertNull(p.recentPitch())
    }

    @Test
    fun monoAndOddChunkSizesWork() {
        val p = VoicePitch(44_100, 1)
        val rate = 44_100
        val pcm = ByteArray(rate * 2)
        var phase = 0.0
        for (i in 0 until rate) {
            phase += 2 * PI * 140 / rate
            var v = 0.0
            for (h in 1..6) v += sin(h * phase) / h
            val s = (v * 5000).toInt()
            pcm[2 * i] = (s and 0xff).toByte()
            pcm[2 * i + 1] = (s shr 8).toByte()
        }
        var at = 0
        while (at < pcm.size) {
            val n = minOf(1234, pcm.size - at) // odd sizes on purpose: whole frames only
            val part = pcm.copyOfRange(at, at + n - n % 2)
            p.feed(part)
            at += part.size
        }
        val got = assertNotNull(p.recentPitch())
        assertTrue(abs(got - 140) < 8, "heard $got")
    }
}
