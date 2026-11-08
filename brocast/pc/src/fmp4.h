// BroCast PC: reads the phone's video pieces (fragmented MP4 over the /video WebSocket).
#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace fmp4 {

/** From the init segment: the H.264 settings (SPS + PPS) and NAL length size. */
struct Init {
    std::vector<uint8_t> sps, pps;
    int lengthSize = 4;
    bool valid() const { return !sps.empty() && !pps.empty(); }
};

/** One frame: H.264 in Annex B form (start codes), ready for a decoder. */
struct Frame {
    std::vector<uint8_t> annexB;
    int64_t decodeTime = 0;  // 90 kHz ticks
    uint32_t duration = 0;   // 90 kHz ticks
    bool keyFrame = false;
};

bool parseInit(const uint8_t* d, size_t n, Init& out);

/**
 * Reads one moof+mdat piece. For key frames the SPS + PPS from [init] go in front, so the decoder
 * can start (or restart) right there.
 */
bool parseFragment(const uint8_t* d, size_t n, const Init& init, Frame& out);

/** What the H.264 settings say about colors (from the SPS's VUI). */
struct ColorInfo {
    int matrix = 0;     // 1 = BT.709, 5/6 = BT.601, 0 = not said
    bool fullRange = false;
    int width = 0, height = 0;
};

ColorInfo readSps(const std::vector<uint8_t>& sps);

}  // namespace fmp4
