package com.brocast.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class SoundStatus {
    ON,

    /** Turned off in BroCast's settings. */
    OFF,

    /** Android's "record audio" permission wasn't given. */
    NO_PERMISSION,

    /** Android 9 or older: capturing other apps' sound isn't possible. */
    UNSUPPORTED,

    /** Android refused or the sound capture stopped. */
    FAILED,
}

sealed interface ShareStatus {
    /** Not sharing. [note] is an optional friendly line about what just happened. */
    data class Idle(val note: String? = null) : ShareStatus

    data object Starting : ShareStatus

    data class Live(
        val port: Int,
        val addresses: List<String>,
        val viewers: Int,
        val viewerAddresses: List<String>,
        val fps: Int,
        val pin: String?,
        /** True if Android hasn't sent a single frame after several seconds (something's off). */
        val noPicture: Boolean,
        val sound: SoundStatus = SoundStatus.OFF,
        /** True when the picture goes out as video (false: picture by picture, for an older TV). */
        val video: Boolean = true,
        /** English subtitles on this phone: what it's doing ("Spanish → English"), null when off. */
        val translate: String? = null,
    ) : ShareStatus

    data class Failed(val message: String) : ShareStatus
}

/** Single source of truth shared by the screen-share service and the UI (same process). */
object ShareState {
    private val _status = MutableStateFlow<ShareStatus>(ShareStatus.Idle())
    val status: StateFlow<ShareStatus> = _status

    fun set(status: ShareStatus) {
        _status.value = status
    }
}
