// BroCast PC: when to show each frame, and how much sound to keep waiting, so the picture runs
// smoothly through Wi-Fi hiccups and mouths match the voices.
#pragma once

#include <cstdint>
#include <deque>
#include <utility>

namespace avsync {

/**
 * Shows frames at the phone's own pace, a small cushion after the fastest they ever arrive.
 *
 * Wi-Fi delivers in bursts: one frame comes 5 ms after it was made, the next 120 ms. Showing each
 * one the moment it lands looks choppy; waiting a fixed cushion after "the fastest arrival"
 * smooths that out. When a frame still comes too late for its turn, the cushion grows a bit (the
 * Wi-Fi is choppier than thought); after a calm while it shrinks again.
 */
class VideoClock {
public:
    explicit VideoClock(double startCushionMs = 200, double minCushionMs = 80, double maxCushionMs = 800);

    /**
     * A frame made at phone time [ptsUs] arrived at local time [arrivalUs]: when to show it (local us).
     * [learn] false: don't adapt the cushion to this one (the catch-up burst right after connecting
     * is late on purpose).
     */
    int64_t schedule(int64_t ptsUs, int64_t arrivalUs, bool learn = true);

    double cushionMs() const { return cushionMs_; }
    int lateFrames() const { return late_; }
    void reset();

private:
    std::deque<std::pair<int64_t, int64_t>> window_;  // (arrival, arrival - pts)
    std::deque<std::pair<int64_t, int64_t>> peaks_;   // (second, biggest lateness that second) for the last minute
    int64_t base_ = 0;
    bool haveBase_ = false;
    int above_ = 0;
    double cushionMs_, minMs_, maxMs_, startMs_;
    int64_t lastGrowUs_ = 0, calmSinceUs_ = 0;
    int late_ = 0;
};

/**
 * Sound has no timestamps (20 ms pieces as they're played on the phone), so it's kept waiting
 * about as long as the picture: [target] says how much should be queued, [speed] nudges toward it
 * by playing up to 2% faster or slower (too little to hear).
 */
class AudioPacer {
public:
    /** How much sound (ms) should be waiting to play, for a video cushion of [videoCushionMs]. */
    static double target(double videoCushionMs, double deviceLatencyMs);

    /** Playback speed for [queuedMs] waiting against [targetMs]; keeps its own little memory. */
    double speed(double queuedMs, double targetMs);

private:
    double current_ = 1.0;
};

}  // namespace avsync
