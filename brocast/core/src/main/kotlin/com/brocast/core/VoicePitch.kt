package com.brocast.core

import kotlin.math.sqrt

/**
 * Listens to the sound a show plays and tells how high the voices are right now, so the English
 * voice can be a guy's or a girl's. Feed it 16-bit PCM ([feed], any thread); ask [recentPitch].
 *
 * Works on 40 ms slices: loud enough ones get their pitch from autocorrelation (the delay at which
 * the wave best matches itself). Music and noise mostly don't line up and get skipped.
 */
class VoicePitch(inputRate: Int, private val channels: Int) {
    // Voices sit far below 6 kHz: averaging down to ~12 kHz makes the math 16x cheaper.
    private val step = maxOf(1, inputRate / 12_000)
    private val sampleRate = inputRate / step
    private val sliceSamples = sampleRate / 25 // 40 ms
    private val slice = FloatArray(sliceSamples)
    private var filled = 0
    private var partSum = 0f
    private var partCount = 0
    private var sliceIndex = 0L

    // Pitch of each voiced slice with the slice number it came from.
    private val pitches = ArrayDeque<Pair<Long, Float>>()
    private val lock = Any()

    /** Interleaved 16-bit little-endian PCM, as captured. */
    fun feed(pcm: ByteArray, length: Int = pcm.size) {
        val frameBytes = 2 * channels
        var i = 0
        while (i + frameBytes <= length) {
            var sum = 0f
            for (c in 0 until channels) {
                val lo = pcm[i + 2 * c].toInt() and 0xff
                val hi = pcm[i + 2 * c + 1].toInt()
                sum += ((hi shl 8) or lo).toShort().toFloat()
            }
            partSum += sum / channels
            if (++partCount == step) {
                slice[filled++] = partSum / step
                partSum = 0f
                partCount = 0
                if (filled == sliceSamples) {
                    analyze()
                    filled = 0
                }
            }
            i += frameBytes
        }
    }

    /**
     * Middle pitch (Hz) of the voiced slices in the last [millis] ms, or null if nobody spoke
     * clearly enough (fewer than 3 voiced slices).
     */
    fun recentPitch(millis: Int = 1500): Float? {
        val keep = millis / 40
        synchronized(lock) {
            val newest = sliceIndex
            val recent = pitches.filter { newest - it.first <= keep }.map { it.second }.sorted()
            if (recent.size < 3) return null
            return recent[recent.size / 2]
        }
    }

    /** Forget what was heard (e.g. while our own English voice talks). */
    fun clear() {
        synchronized(lock) { pitches.clear() }
    }

    private fun analyze() {
        val n = sliceSamples
        var mean = 0f
        for (v in slice) mean += v
        mean /= n
        var energy = 0.0
        for (k in 0 until n) {
            slice[k] -= mean
            energy += slice[k] * slice[k]
        }
        val rms = sqrt(energy / n)
        val pitch = if (rms < MIN_RMS) null else pitchOf(energy)
        synchronized(lock) {
            sliceIndex++
            if (pitch != null) pitches.addLast(sliceIndex to pitch)
            while (pitches.size > 200) pitches.removeFirst()
        }
    }

    // Normalized autocorrelation between 70 and 450 Hz; the first strong peak is the pitch
    // (later ones are its multiples). Null when nothing repeats clearly: music chords, noise.
    private fun pitchOf(energy: Double): Float? {
        val minLag = sampleRate / MAX_HZ
        val maxLag = minOf(sampleRate / MIN_HZ, sliceSamples / 2)
        val corr = DoubleArray(maxLag + 2)
        var best = 0.0
        for (lag in minLag..maxLag + 1) {
            var s = 0.0
            for (k in 0 until sliceSamples - lag) s += slice[k] * slice[k + lag]
            corr[lag] = s / energy * sliceSamples / (sliceSamples - lag)
            if (corr[lag] > best) best = corr[lag]
        }
        if (best < MIN_CLARITY) return null
        for (lag in minLag + 1..maxLag) {
            val c = corr[lag]
            if (c >= best * 0.85 && c >= corr[lag - 1] && c >= corr[lag + 1]) {
                // Between samples: fit a parabola through the peak and its neighbors.
                val a = corr[lag - 1]
                val b = corr[lag + 1]
                val d = a - 2 * c + b
                val shift = if (d != 0.0) (0.5 * (a - b) / d).coerceIn(-0.5, 0.5) else 0.0
                return (sampleRate / (lag + shift)).toFloat()
            }
        }
        return null
    }

    companion object {
        private const val MIN_HZ = 70
        private const val MAX_HZ = 450
        private const val MIN_RMS = 300.0 // about -40 dB: quieter is silence or background
        private const val MIN_CLARITY = 0.55

        /** Above this, a voice sounds like a girl's / woman's (guys mostly sit at 85-160 Hz). */
        const val HIGH_VOICE_HZ = 175f
    }
}
