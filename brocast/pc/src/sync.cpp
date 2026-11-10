// BroCast PC: frame timing + sound pacing. See sync.h.
#include "sync.h"

#include <algorithm>

namespace avsync {

static const int64_t WINDOW_US = 4'000'000;   // "fastest arrival" is looked for over the last 4 s
static const int64_t REBASE_EXTRA_US = 400'000;
static const int REBASE_AFTER = 4;            // frames in a row that far behind: the phone's clock jumped
static const double GROW_MS = 30, SHRINK_MS = 10;
static const int64_t GROW_GAP_US = 500'000, CALM_US = 15'000'000, PEAK_MEMORY_S = 60;
static const double MARGIN_MS = 25;

VideoClock::VideoClock(double startCushionMs, double minCushionMs, double maxCushionMs)
    : cushionMs_(startCushionMs), minMs_(minCushionMs), maxMs_(maxCushionMs), startMs_(startCushionMs) {}

void VideoClock::reset() {
    window_.clear();
    peaks_.clear();
    haveBase_ = false;
    above_ = 0;
    // Keep the learned cushion: it's about this Wi-Fi, not this connection.
}

int64_t VideoClock::schedule(int64_t ptsUs, int64_t arrivalUs, bool learn) {
    int64_t offset = arrivalUs - ptsUs;
    if (!calmSinceUs_) calmSinceUs_ = arrivalUs;
    // After a still screen the phone's timeline skips the quiet time, so from then on every frame
    // looks a long way "behind" the old base: start over from the new one.
    if (haveBase_ && offset > base_ + (int64_t)(cushionMs_ * 1000) + REBASE_EXTRA_US) {
        if (++above_ >= REBASE_AFTER) {
            window_.clear();
            haveBase_ = false;
            above_ = 0;
        }
    } else {
        above_ = 0;
    }
    window_.emplace_back(arrivalUs, offset);
    while (!window_.empty() && arrivalUs - window_.front().first > WINDOW_US) window_.pop_front();
    int64_t mn = offset;
    for (auto& w : window_) mn = std::min(mn, w.second);
    if (!haveBase_ || mn != base_) {
        base_ = haveBase_ ? mn : offset;
        haveBase_ = true;
    }
    // How far behind the fastest arrival this one came, remembered per second for a minute: the
    // cushion never shrinks below the worst hiccup of the last minute.
    int64_t sec = arrivalUs / 1'000'000, jitter = offset - base_;
    if (peaks_.empty() || peaks_.back().first != sec) peaks_.emplace_back(sec, jitter);
    else peaks_.back().second = std::max(peaks_.back().second, jitter);
    while (!peaks_.empty() && sec - peaks_.front().first > PEAK_MEMORY_S) peaks_.pop_front();
    int64_t due = ptsUs + base_ + (int64_t)(cushionMs_ * 1000);
    if (!learn) {
        calmSinceUs_ = arrivalUs;
    } else if (due < arrivalUs - 5'000) {
        // Too late for its turn: the picture would have waited. Keep a bigger cushion.
        late_++;
        if (arrivalUs - lastGrowUs_ > GROW_GAP_US) {
            cushionMs_ = std::min(maxMs_, cushionMs_ + GROW_MS);
            lastGrowUs_ = arrivalUs;
        }
        calmSinceUs_ = arrivalUs;
    } else if (arrivalUs - calmSinceUs_ > CALM_US) {
        int64_t worst = 0;
        for (auto& p : peaks_) worst = std::max(worst, p.second);
        double floor = std::max(minMs_, worst / 1000.0 + MARGIN_MS);
        if (cushionMs_ > floor) cushionMs_ = std::max(floor, cushionMs_ - SHRINK_MS);
        calmSinceUs_ = arrivalUs;
    }
    return due;
}

double AudioPacer::target(double videoCushionMs, double deviceLatencyMs) {
    // Video also spends ~1 frame decoding and ~1 refresh on screen.
    return std::max(40.0, std::min(1000.0, videoCushionMs + 30 - deviceLatencyMs));
}

double AudioPacer::speed(double queuedMs, double targetMs) {
    double diff = queuedMs - targetMs;
    if (diff > 40) current_ = 1.02;
    else if (diff < -40) current_ = 0.98;
    else if (diff > -15 && diff < 15) current_ = 1.0;
    return current_;
}

}  // namespace avsync
