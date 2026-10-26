package com.brocast.app

import android.Manifest
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Process
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.annotation.RequiresPermission
import com.brocast.core.AudioHub

/**
 * Grabs the sound other apps are playing (videos, games, music) through the screen-share
 * permission and feeds it to [AudioHub] in 20 ms chunks. It never touches the microphone:
 * Android just files this under the "record audio" permission.
 */
@RequiresApi(Build.VERSION_CODES.Q)
class AudioCapturer(private val projection: MediaProjection, private val hub: AudioHub) {

    @Volatile
    private var running = false
    private var record: AudioRecord? = null
    private var thread: Thread? = null

    /** Starts capturing. Returns null when it worked, otherwise a short reason why not. */
    @RequiresPermission(Manifest.permission.RECORD_AUDIO)
    fun start(): String? {
        val rec = try {
            val config = AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(hub.sampleRate)
                .setChannelMask(if (hub.channels == 2) AudioFormat.CHANNEL_IN_STEREO else AudioFormat.CHANNEL_IN_MONO)
                .build()
            val minBuffer = AudioRecord.getMinBufferSize(
                hub.sampleRate,
                if (hub.channels == 2) AudioFormat.CHANNEL_IN_STEREO else AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
            )
            // Room for ~200 ms so a busy phone doesn't lose sound between reads.
            val bufferBytes = maxOf(minBuffer * 2, bytesPerSecond() / 5)
            AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferBytes)
                .setAudioPlaybackCaptureConfig(config)
                .build()
        } catch (e: Exception) {
            Log.w(TAG, "Sound capture unavailable", e)
            return e.javaClass.simpleName
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            rec.release()
            return "not initialized"
        }
        try {
            rec.startRecording()
        } catch (e: IllegalStateException) {
            rec.release()
            return "couldn't start"
        }
        if (rec.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            rec.release()
            return "not recording"
        }
        record = rec
        running = true
        hub.setLive(true)
        thread = Thread({ pump(rec) }, "BroCast-audio").apply { start() }
        return null
    }

    private fun pump(rec: AudioRecord) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        val chunkBytes = bytesPerSecond() / 50 // 20 ms
        while (running) {
            val chunk = ByteArray(chunkBytes)
            var filled = 0
            while (running && filled < chunkBytes) {
                val n = rec.read(chunk, filled, chunkBytes - filled)
                when {
                    n < 0 -> {
                        Log.w(TAG, "Sound capture ended ($n)")
                        running = false
                    }
                    n == 0 -> Thread.sleep(2) // shouldn't happen in blocking mode; don't spin if it does
                    else -> filled += n
                }
            }
            if (filled == chunkBytes) hub.publish(chunk)
        }
        hub.setLive(false)
    }

    /** Stops capturing. Safe to call more than once. */
    fun release() {
        running = false
        val rec = record ?: return
        record = null
        try {
            rec.stop() // also wakes up a read() that's waiting
        } catch (e: IllegalStateException) {
            // Already stopped.
        }
        thread?.join(300)
        thread = null
        rec.release()
        hub.setLive(false)
    }

    private fun bytesPerSecond() = hub.sampleRate * hub.channels * 2

    private companion object {
        const val TAG = "BroCast"
    }
}
