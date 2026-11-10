// BroCast PC (Windows): plays the phone's sound (WASAPI, Windows' own audio), kept in step with
// the picture by letting it wait about as long as the video does.
#pragma once

#include <windows.h>

#include <cstdint>
#include <vector>

#include "sync.h"

class AudioOut {
public:
    AudioOut();
    ~AudioOut();
    void start();
    void stop();
    /** The phone's sound format (it says so first on the sound connection). */
    void setFormat(int rate, int channels);
    /** 16-bit PCM, channels interleaved. Called from the network thread. */
    void push(const int16_t* pcm, size_t samples);
    /** How long the picture waits (ms): the sound waits about as long, so mouths match. */
    void setVideoCushion(double ms);
    void setMuted(bool muted);
    /** Throw away what's waiting (the phone stopped, or a new connection). */
    void clear();

private:
    static DWORD WINAPI threadMain(void* self);
    void run();
    void fill(float* out, uint32_t frames, double deviceQueuedMs);

    CRITICAL_SECTION cs_;
    std::vector<float> ring_;  // stereo frames
    size_t capacity_ = 0, head_ = 0, count_ = 0;
    double frac_ = 0;
    int rate_ = 48000, channels_ = 2, deviceRate_ = 0;
    volatile LONG stop_ = 0;
    HANDLE thread_ = nullptr;
    double cushionMs_ = 200, deviceLatencyMs_ = 30;
    bool muted_ = false, priming_ = true;
    avsync::AudioPacer pacer_;
};
