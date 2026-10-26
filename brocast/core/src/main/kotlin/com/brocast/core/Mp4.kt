package com.brocast.core

import java.io.ByteArrayOutputStream

/** Small helpers for raw H.264 as phone encoders hand it out ("Annex B": NAL units split by 00 00 01). */
object H264 {
    const val NAL_IDR = 5
    const val NAL_SEI = 6
    const val NAL_SPS = 7
    const val NAL_PPS = 8
    const val NAL_AUD = 9

    fun nalType(nal: ByteArray): Int = if (nal.isEmpty()) -1 else nal[0].toInt() and 0x1f

    /** Splits Annex B data into NAL units (start codes removed). Data without start codes counts as one NAL. */
    fun splitAnnexB(data: ByteArray, offset: Int = 0, length: Int = data.size - offset): List<ByteArray> {
        val end = offset + length
        val out = ArrayList<ByteArray>(4)
        var i = offset
        var nalStart = -1
        while (i + 2 < end) {
            if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 && data[i + 2].toInt() == 1) {
                if (nalStart >= 0) out += trimmed(data, nalStart, i)
                i += 3
                nalStart = i
            } else {
                i++
            }
        }
        if (nalStart >= 0) {
            out += trimmed(data, nalStart, end)
        } else if (length > 0) {
            out += data.copyOfRange(offset, end)
        }
        return out.filter { it.isNotEmpty() }
    }

    // A 4-byte start code (00 00 00 01) leaves a zero at the end of the NAL before it.
    private fun trimmed(data: ByteArray, from: Int, to: Int): ByteArray {
        var end = to
        while (end > from && data[end - 1].toInt() == 0) end--
        return data.copyOfRange(from, end)
    }

    /** "avc1.64001f" style codec name that browsers understand, read from the SPS. */
    fun codecString(sps: ByteArray): String {
        require(sps.size >= 4) { "SPS too short" }
        return "avc1." + hex(sps[1]) + hex(sps[2]) + hex(sps[3])
    }

    private fun hex(b: Byte) = (b.toInt() and 0xff).toString(16).padStart(2, '0')
}

/**
 * Builds fragmented MP4 (the format browsers' Media Source Extensions eat): one "init segment"
 * describing the video, then one tiny fragment per frame. Timestamps use a 90 kHz clock.
 */
object Mp4 {
    const val TIMESCALE = 90_000

    fun initSegment(width: Int, height: Int, sps: ByteArray, pps: ByteArray): ByteArray {
        val ftyp = box("ftyp", ascii("isom"), int32(0x200), ascii("isom"), ascii("iso6"), ascii("avc1"), ascii("mp41"))
        val mvhd = fullBox(
            "mvhd", 0, 0,
            int32(0), int32(0), int32(1000), int32(0), // created, modified, timescale, duration
            int32(0x00010000), int16(0x0100), ByteArray(10), MATRIX, ByteArray(24),
            int32(2), // next track id
        )
        val tkhd = fullBox(
            "tkhd", 0, 3, // enabled + in movie
            int32(0), int32(0), int32(TRACK_ID), int32(0), int32(0),
            ByteArray(8), int16(0), int16(0), int16(0), int16(0), MATRIX,
            int32(width shl 16), int32(height shl 16),
        )
        val mdhd = fullBox("mdhd", 0, 0, int32(0), int32(0), int32(TIMESCALE), int32(0), int16(0x55C4), int16(0))
        val hdlr = fullBox("hdlr", 0, 0, int32(0), ascii("vide"), ByteArray(12), ascii("BroCast"), byteArrayOf(0))
        val vmhd = fullBox("vmhd", 0, 1, int16(0), ByteArray(6))
        val dinf = box("dinf", fullBox("dref", 0, 0, int32(1), fullBox("url ", 0, 1)))
        val avc1 = box(
            "avc1",
            ByteArray(6), int16(1), // reserved, data reference index
            int16(0), int16(0), ByteArray(12),
            int16(width), int16(height),
            int32(0x00480000), int32(0x00480000), int32(0), int16(1),
            ByteArray(32), int16(0x18), int16(0xffff),
            avcC(sps, pps),
        )
        val stbl = box(
            "stbl",
            fullBox("stsd", 0, 0, int32(1), avc1),
            fullBox("stts", 0, 0, int32(0)),
            fullBox("stsc", 0, 0, int32(0)),
            fullBox("stsz", 0, 0, int32(0), int32(0)),
            fullBox("stco", 0, 0, int32(0)),
        )
        val trak = box("trak", tkhd, box("mdia", mdhd, hdlr, box("minf", vmhd, dinf, stbl)))
        val mvex = box("mvex", fullBox("trex", 0, 0, int32(TRACK_ID), int32(1), int32(0), int32(0), int32(0)))
        return ftyp + box("moov", mvhd, trak, mvex)
    }

    /**
     * One frame as a movie fragment. [nals] are the frame's NAL units without start codes;
     * [decodeTime] and [duration] are in 90 kHz ticks.
     */
    fun fragment(sequence: Int, decodeTime: Long, duration: Int, keyFrame: Boolean, nals: List<ByteArray>): ByteArray {
        val sampleSize = nals.sumOf { 4 + it.size }
        val flags = if (keyFrame) 0x02000000 else 0x01010000 // depends on nothing / depends on others + not a sync sample
        fun moof(dataOffset: Int) = box(
            "moof",
            fullBox("mfhd", 0, 0, int32(sequence)),
            box(
                "traf",
                fullBox("tfhd", 0, 0x020000, int32(TRACK_ID)), // default-base-is-moof
                fullBox("tfdt", 1, 0, int64(decodeTime)),
                fullBox("trun", 0, 0x000701, int32(1), int32(dataOffset), int32(duration), int32(sampleSize), int32(flags)),
            ),
        )
        val moofSize = moof(0).size
        val out = ByteArrayOutputStream(moofSize + 8 + sampleSize)
        out.write(moof(moofSize + 8))
        out.write(int32(8 + sampleSize))
        out.write(ascii("mdat"))
        for (nal in nals) {
            out.write(int32(nal.size))
            out.write(nal)
        }
        return out.toByteArray()
    }

    private fun avcC(sps: ByteArray, pps: ByteArray): ByteArray {
        val body = ByteArrayOutputStream()
        body.write(1)
        body.write(sps[1].toInt() and 0xff)
        body.write(sps[2].toInt() and 0xff)
        body.write(sps[3].toInt() and 0xff)
        body.write(0xff) // 4-byte NAL lengths
        body.write(0xe1) // one SPS
        body.write(int16(sps.size))
        body.write(sps)
        body.write(1) // one PPS
        body.write(int16(pps.size))
        body.write(pps)
        if ((sps[1].toInt() and 0xff) in HIGH_PROFILES) {
            // 4:2:0, 8-bit: what every phone encoder makes.
            body.write(0xfd)
            body.write(0xf8)
            body.write(0xf8)
            body.write(0)
        }
        return box("avcC", body.toByteArray())
    }

    private const val TRACK_ID = 1
    private val HIGH_PROFILES = setOf(100, 110, 122, 144)
    private val MATRIX = int32(0x00010000) + int32(0) + int32(0) + int32(0) + int32(0x00010000) + int32(0) +
        int32(0) + int32(0) + int32(0x40000000)

    private fun box(type: String, vararg parts: ByteArray): ByteArray {
        val size = 8 + parts.sumOf { it.size }
        val out = ByteArrayOutputStream(size)
        out.write(int32(size))
        out.write(ascii(type))
        for (p in parts) out.write(p)
        return out.toByteArray()
    }

    private fun fullBox(type: String, version: Int, flags: Int, vararg parts: ByteArray): ByteArray =
        box(type, int32((version shl 24) or (flags and 0xffffff)), *parts)

    private fun ascii(s: String) = s.toByteArray(Charsets.ISO_8859_1)
    private fun int16(v: Int) = byteArrayOf((v ushr 8).toByte(), v.toByte())
    private fun int32(v: Int) = byteArrayOf((v ushr 24).toByte(), (v ushr 16).toByte(), (v ushr 8).toByte(), v.toByte())
    private fun int64(v: Long) = int32((v ushr 32).toInt()) + int32(v.toInt())
}
