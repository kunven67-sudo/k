package com.brocast.core

import java.awt.BasicStroke
import java.awt.Color
import java.awt.Font
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO

/**
 * A fake phone for testing the TV page on a computer. It streams a moving test picture.
 *
 * Options:
 *   --port N          port to try first (default 8080)
 *   --pin 1234        require a PIN
 *   --fps N           frames per second (default 30)
 *   --static          publish one frame, then nothing (tests keepalives / last-frame display)
 *   --rotate-every S  flip between portrait and landscape every S seconds
 *   --live-after S    stay "not sharing" for S seconds first
 *   --no-audio        don't send sound (by default a quiet 440 Hz test tone is sent)
 *   --jpeg-only       act like a phone whose video encoder doesn't work (pictures only)
 *   --pause-every S   every S seconds, stop sending pictures for --pause-for seconds (a still screen)
 *   --pause-for S     (default 4)
 *
 * By default it sends H.264 video made by ffmpeg (needs ffmpeg on the PATH), and switches to
 * JPEG pictures while a browser that can't play the video is watching, like the real phone.
 */
fun main(args: Array<String>) {
    System.setProperty("java.awt.headless", "true")
    fun opt(name: String): String? = args.indexOf(name).takeIf { it >= 0 }?.let { args.getOrNull(it + 1) }
    val port = opt("--port")?.toInt() ?: StreamServer.DEFAULT_PORT
    val pin = opt("--pin")
    val fps = opt("--fps")?.toInt() ?: 30
    val static = "--static" in args
    val rotateEvery = opt("--rotate-every")?.toLong()
    val liveAfter = opt("--live-after")?.toLong() ?: 0L
    val audio = if ("--no-audio" in args) null else AudioHub()
    val jpegOnly = "--jpeg-only" in args
    val pauseEvery = opt("--pause-every")?.toLong()
    val pauseFor = opt("--pause-for")?.toLong() ?: 4L

    val hub = FrameHub()
    val video = VideoHub()
    val encoder = if (jpegOnly) null else FakeEncoder(video, fps)
    video.keyFrameRequester = { encoder?.keyRequests?.incrementAndGet() }
    val pinConfig = pin?.let { PinConfig(it, "dev-salt") }
    val server = StreamServer(hub, audioHub = audio, videoHub = video, pinConfig = { pinConfig }, deviceName = "Dev Phone")
    val actualPort = server.start(port)
    println("READY http://127.0.0.1:$actualPort/")
    System.out.flush()

    Runtime.getRuntime().addShutdownHook(Thread { encoder?.stop(); server.stop(); hub.close(); video.close(); audio?.close() })
    if (audio != null) startTone(audio, liveAfter * 1000)

    val started = System.currentTimeMillis()
    var frameNo = 0
    var lastStats = 0L
    while (true) {
        val elapsed = System.currentTimeMillis() - started
        if (!hub.isLive && elapsed >= liveAfter * 1000) hub.setLive(true)
        val landscape = rotateEvery != null && (elapsed / 1000 / rotateEvery) % 2 == 1L
        val (w, h) = if (landscape) 1280 to 720 else 720 to 1280
        val paused = pauseEvery != null && elapsed / 1000 >= pauseEvery && (elapsed / 1000) % pauseEvery < pauseFor
        // Like the phone: video unless a browser that needs pictures is watching.
        val useVideo = encoder != null && hub.isLive && !server.jpegViewerActive()
        video.setLive(useVideo)
        if (encoder != null) {
            encoder.size(w, h)
            encoder.paused = !useVideo || paused || (static && encoder.published > 0)
        }
        if (hub.isLive && !useVideo && !paused && (!static || frameNo == 0)) {
            hub.publish(render(frameNo, w, h), w, h)
            frameNo++
        }
        if (elapsed - lastStats >= 1000) {
            lastStats = elapsed
            val stats = server.viewerStats()
            println(
                "STATS frames=$frameNo vframes=${video.framesPublished} viewers=${stats.count} ips=${stats.addresses} " +
                    "mode=${if (useVideo) "h264" else "jpeg"} keyreq=${encoder?.keyRequests?.get() ?: 0}",
            )
            System.out.flush()
        }
        Thread.sleep(1000L / fps)
    }
}

/** Publishes a 440 Hz tone at 1/4 volume in real-time 20 ms chunks, like the phone does. */
private fun startTone(audio: AudioHub, delayMs: Long) {
    Thread({
        Thread.sleep(delayMs)
        audio.setLive(true)
        val framesPerChunk = audio.sampleRate / 50
        var sample = 0L
        val start = System.nanoTime()
        var chunkNo = 0L
        while (!audio.isClosed) {
            val pcm = ByteArray(framesPerChunk * audio.channels * 2)
            var i = 0
            repeat(framesPerChunk) {
                val v = (Math.sin(2 * Math.PI * 440 * sample / audio.sampleRate) * 8192).toInt()
                sample++
                repeat(audio.channels) {
                    pcm[i++] = v.toByte()
                    pcm[i++] = (v shr 8).toByte()
                }
            }
            audio.publish(pcm)
            chunkNo++
            val due = start + chunkNo * 20_000_000L
            val wait = (due - System.nanoTime()) / 1_000_000
            if (wait > 0) Thread.sleep(wait)
        }
    }, "dev-tone").apply { isDaemon = true; start() }
}

/** Test picture. The top-left 40x40 block encodes the frame number in its red channel so tests can see changes. */
private fun render(frameNo: Int, w: Int, h: Int): ByteArray {
    val img = BufferedImage(w, h, BufferedImage.TYPE_INT_RGB)
    val g = img.createGraphics()
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
    g.color = Color(16, 20, 38)
    g.fillRect(0, 0, w, h)
    g.color = Color((frameNo * 17) % 256, 40, 200)
    g.fillRect(0, 0, 40, 40)
    g.color = Color(124, 92, 255)
    val x = ((frameNo * 8) % (w - 120))
    g.fillRoundRect(x, h / 2 - 60, 120, 120, 30, 30)
    g.color = Color.WHITE
    g.font = Font(Font.SANS_SERIF, Font.BOLD, w / 9)
    g.drawString("#$frameNo", w / 10, h / 3)
    g.font = Font(Font.SANS_SERIF, Font.PLAIN, w / 24)
    g.drawString(if (w > h) "landscape ${w}x$h" else "portrait ${w}x$h", w / 10, h / 3 + w / 12)
    g.stroke = BasicStroke(6f)
    g.color = Color(34, 211, 238)
    g.drawRect(3, 3, w - 6, h - 6)
    g.dispose()
    val out = ByteArrayOutputStream()
    ImageIO.write(img, "jpg", out)
    return out.toByteArray()
}

/**
 * Stands in for the phone's hardware encoder: ffmpeg makes a moving H.264 test picture in real
 * time, and every frame goes to the [VideoHub]. Changing [size] restarts it, like a rotation.
 */
private class FakeEncoder(private val hub: VideoHub, private val fps: Int) {
    val keyRequests = java.util.concurrent.atomic.AtomicLong()

    @Volatile
    var paused = false

    @Volatile
    var published = 0L
        private set

    private var process: Process? = null
    private var width = 0
    private var height = 0

    @Synchronized
    fun size(w: Int, h: Int) {
        if (w == width && h == height && process?.isAlive == true) return
        stop()
        width = w
        height = h
        val p = ProcessBuilder(
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-re",
            "-f", "lavfi", "-i", "testsrc2=size=${w}x$h:rate=$fps",
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-g", "$fps", "-bf", "0", "-x264-params", "aud=1:repeat-headers=1",
            "-f", "h264", "-",
        ).redirectError(ProcessBuilder.Redirect.DISCARD).start()
        process = p
        Thread({ pump(p, w, h) }, "dev-encoder").apply { isDaemon = true; start() }
    }

    @Synchronized
    fun stop() {
        process?.destroyForcibly()
        process = null
    }

    private fun pump(p: Process, w: Int, h: Int) {
        val input = p.inputStream
        val buf = java.io.ByteArrayOutputStream()
        val chunk = ByteArray(64 * 1024)
        var configured = false
        // A real encoder never skips frames it made; frames it didn't make (still screen) just don't
        // exist. So after a pause, carry on from a key frame, or the next frames would point at
        // pictures the viewer never got.
        var needKey = true
        while (true) {
            val n = try {
                input.read(chunk)
            } catch (e: java.io.IOException) {
                -1
            }
            if (n < 0) break
            buf.write(chunk, 0, n)
            val data = buf.toByteArray()
            // Access units start with an AUD (00 00 00 01 09): publish every complete one.
            val starts = ArrayList<Int>()
            var i = 0
            while (i + 4 < data.size) {
                if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 && data[i + 2].toInt() == 0 &&
                    data[i + 3].toInt() == 1 && (data[i + 4].toInt() and 0x1f) == H264.NAL_AUD
                ) {
                    starts += i
                    i += 5
                } else {
                    i++
                }
            }
            if (starts.size < 2) continue
            for (k in 0 until starts.size - 1) {
                val au = data.copyOfRange(starts[k], starts[k + 1])
                val nals = H264.splitAnnexB(au)
                if (!configured) {
                    val sps = nals.firstOrNull { H264.nalType(it) == H264.NAL_SPS } ?: continue
                    val pps = nals.firstOrNull { H264.nalType(it) == H264.NAL_PPS } ?: continue
                    hub.configure(w, h, byteArrayOf(0, 0, 0, 1) + sps + byteArrayOf(0, 0, 0, 1) + pps)
                    configured = true
                }
                val key = nals.any { H264.nalType(it) == H264.NAL_IDR }
                if (paused || process !== p) {
                    needKey = true
                    continue
                }
                if (needKey && !key) continue
                needKey = false
                hub.publish(au, System.nanoTime() / 1000, key)
                published++
            }
            buf.reset()
            buf.write(data, starts.last(), data.size - starts.last())
        }
    }
}
