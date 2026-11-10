// BroCast PC: fragmented MP4 + H.264 header reading. See fmp4.h.
#include "fmp4.h"

#include <cstring>

namespace fmp4 {

static uint32_t be32(const uint8_t* p) { return (uint32_t)p[0] << 24 | (uint32_t)p[1] << 16 | (uint32_t)p[2] << 8 | p[3]; }
static uint64_t be64(const uint8_t* p) { return (uint64_t)be32(p) << 32 | be32(p + 4); }

/** Finds the first box called [type] directly inside [d, d+n). */
static bool findBox(const uint8_t* d, size_t n, const char* type, const uint8_t** body, size_t* len) {
    size_t i = 0;
    while (i + 8 <= n) {
        uint64_t size = be32(d + i);
        size_t hdr = 8;
        if (size == 1) {
            if (i + 16 > n) return false;
            size = be64(d + i + 8);
            hdr = 16;
        } else if (size == 0) {
            size = n - i;
        }
        if (size < hdr || i + size > n) return false;
        if (memcmp(d + i + 4, type, 4) == 0) {
            *body = d + i + hdr;
            *len = (size_t)size - hdr;
            return true;
        }
        i += (size_t)size;
    }
    return false;
}

bool parseInit(const uint8_t* d, size_t n, Init& out) {
    out = Init();
    // The avcC box sits deep inside moov/trak/mdia/minf/stbl/stsd/avc1; look for its tag.
    for (size_t i = 4; i + 4 <= n; i++) {
        if (memcmp(d + i, "avcC", 4) != 0) continue;
        uint32_t size = be32(d + i - 4);
        if (size < 8 + 7 || i - 4 + size > n) continue;
        const uint8_t* p = d + i + 4;
        const uint8_t* end = d + i - 4 + size;
        if (p[0] != 1) continue;
        out.lengthSize = (p[4] & 3) + 1;
        int nSps = p[5] & 31;
        p += 6;
        for (int k = 0; k < nSps; k++) {
            if (p + 2 > end) return false;
            size_t l = (size_t)p[0] << 8 | p[1];
            p += 2;
            if (p + l > end) return false;
            if (k == 0) out.sps.assign(p, p + l);
            p += l;
        }
        if (p + 1 > end) return false;
        int nPps = p[0];
        p++;
        for (int k = 0; k < nPps; k++) {
            if (p + 2 > end) return false;
            size_t l = (size_t)p[0] << 8 | p[1];
            p += 2;
            if (p + l > end) return false;
            if (k == 0) out.pps.assign(p, p + l);
            p += l;
        }
        return out.valid();
    }
    return false;
}

static void addNal(std::vector<uint8_t>& o, const uint8_t* p, size_t n) {
    static const uint8_t start[4] = {0, 0, 0, 1};
    o.insert(o.end(), start, start + 4);
    o.insert(o.end(), p, p + n);
}

bool parseFragment(const uint8_t* d, size_t n, const Init& init, Frame& out) {
    out = Frame();
    const uint8_t *moof, *traf, *tfdt, *trun, *mdat;
    size_t moofLen, trafLen, tfdtLen, trunLen, mdatLen;
    if (!findBox(d, n, "moof", &moof, &moofLen)) return false;
    if (!findBox(moof, moofLen, "traf", &traf, &trafLen)) return false;
    if (findBox(traf, trafLen, "tfdt", &tfdt, &tfdtLen) && tfdtLen >= 8) {
        out.decodeTime = tfdt[0] == 1 && tfdtLen >= 12 ? (int64_t)be64(tfdt + 4) : (int64_t)be32(tfdt + 4);
    }
    out.keyFrame = false;
    if (findBox(traf, trafLen, "trun", &trun, &trunLen) && trunLen >= 8) {
        uint32_t flags = be32(trun) & 0xFFFFFF;
        uint32_t count = be32(trun + 4);
        const uint8_t* p = trun + 8;
        const uint8_t* end = trun + trunLen;
        if (flags & 0x001) p += 4;  // data offset
        uint32_t firstFlags = 0;
        bool haveFirst = false;
        if (flags & 0x004) {
            if (p + 4 > end) return false;
            firstFlags = be32(p);
            haveFirst = true;
            p += 4;
        }
        if (count >= 1) {
            if (flags & 0x100) { if (p + 4 > end) return false; out.duration = be32(p); p += 4; }
            if (flags & 0x200) p += 4;
            if (flags & 0x400) { if (p + 4 > end) return false; firstFlags = be32(p); haveFirst = true; p += 4; }
        }
        // "sample_is_non_sync_sample" clear = a key frame.
        if (haveFirst) out.keyFrame = (firstFlags & 0x00010000) == 0;
    }
    if (!findBox(d, n, "mdat", &mdat, &mdatLen)) return false;
    const int ls = init.lengthSize;
    bool hasIdr = false;
    size_t i = 0;
    std::vector<uint8_t> body;
    body.reserve(mdatLen + 64);
    while (i + (size_t)ls <= mdatLen) {
        size_t l = 0;
        for (int k = 0; k < ls; k++) l = l << 8 | mdat[i + (size_t)k];
        i += (size_t)ls;
        if (l == 0 || i + l > mdatLen) break;
        int type = mdat[i] & 0x1F;
        if (type == 5) hasIdr = true;
        if (type != 9) addNal(body, mdat + i, l);  // access unit delimiters aren't needed
        i += l;
    }
    if (body.empty()) return false;
    if (hasIdr) out.keyFrame = true;
    if (out.keyFrame && init.valid()) {
        addNal(out.annexB, init.sps.data(), init.sps.size());
        addNal(out.annexB, init.pps.data(), init.pps.size());
    }
    out.annexB.insert(out.annexB.end(), body.begin(), body.end());
    return true;
}

// ---------------------------------------------------------------- SPS

namespace {
struct Bits {
    std::vector<uint8_t> d;
    size_t pos = 0;  // in bits
    bool bad = false;
    unsigned u(int n) {
        unsigned v = 0;
        for (int i = 0; i < n; i++) {
            if (pos >= d.size() * 8) { bad = true; return 0; }
            v = v << 1 | ((d[pos >> 3] >> (7 - (pos & 7))) & 1);
            pos++;
        }
        return v;
    }
    unsigned ue() {
        int zeros = 0;
        while (u(1) == 0) {
            if (bad || ++zeros > 31) { bad = true; return 0; }
        }
        return zeros ? ((1u << zeros) - 1 + u(zeros)) : 0;
    }
    int se() {
        unsigned k = ue();
        return (k & 1) ? (int)((k + 1) / 2) : -(int)(k / 2);
    }
};
}  // namespace

ColorInfo readSps(const std::vector<uint8_t>& sps) {
    ColorInfo c;
    if (sps.size() < 4) return c;
    Bits b;
    // Without the emulation prevention bytes (00 00 03 -> 00 00), and without the NAL header byte.
    int zeros = 0;
    for (size_t i = 1; i < sps.size(); i++) {
        uint8_t x = sps[i];
        if (zeros >= 2 && x == 3) {
            zeros = 0;
            continue;
        }
        b.d.push_back(x);
        zeros = x == 0 ? zeros + 1 : 0;
    }
    unsigned profile = b.u(8);
    b.u(16);  // constraints + level
    b.ue();   // id
    unsigned chroma = 1;
    if (profile == 100 || profile == 110 || profile == 122 || profile == 244 || profile == 44 || profile == 83 ||
        profile == 86 || profile == 118 || profile == 128 || profile == 138 || profile == 139 || profile == 134 || profile == 135) {
        chroma = b.ue();
        if (chroma == 3) b.u(1);
        b.ue();
        b.ue();
        b.u(1);
        if (b.u(1)) {
            int lists = chroma != 3 ? 8 : 12;
            for (int i = 0; i < lists; i++) {
                if (!b.u(1)) continue;
                int size = i < 6 ? 16 : 64, last = 8, next = 8;
                for (int j = 0; j < size; j++) {
                    if (next != 0) next = (last + b.se() + 256) % 256;
                    last = next == 0 ? last : next;
                }
            }
        }
    }
    b.ue();  // log2_max_frame_num
    unsigned poc = b.ue();
    if (poc == 0) {
        b.ue();
    } else if (poc == 1) {
        b.u(1);
        b.se();
        b.se();
        unsigned cycle = b.ue();
        for (unsigned i = 0; i < cycle && !b.bad; i++) b.se();
    }
    b.ue();   // max refs
    b.u(1);   // gaps
    unsigned wMbs = b.ue() + 1, hMap = b.ue() + 1;
    unsigned frameMbsOnly = b.u(1);
    if (!frameMbsOnly) b.u(1);
    b.u(1);
    unsigned cl = 0, cr = 0, ct = 0, cb = 0;
    if (b.u(1)) {
        cl = b.ue();
        cr = b.ue();
        ct = b.ue();
        cb = b.ue();
    }
    unsigned cropX = chroma == 0 || chroma == 3 ? 1 : 2;
    unsigned cropY = (chroma == 1 ? 2 : 1) * (2 - frameMbsOnly);
    c.width = (int)(wMbs * 16 - (cl + cr) * cropX);
    c.height = (int)((2 - frameMbsOnly) * hMap * 16 - (ct + cb) * cropY);
    if (b.u(1)) {  // VUI
        if (b.u(1)) {
            if (b.u(8) == 255) b.u(32);
        }
        if (b.u(1)) b.u(1);
        if (b.u(1)) {
            b.u(3);
            c.fullRange = b.u(1) != 0;
            if (b.u(1)) {
                b.u(8);
                b.u(8);
                c.matrix = (int)b.u(8);
            }
        }
    }
    if (b.bad) {
        c.matrix = 0;
        c.fullRange = false;
    }
    return c;
}

}  // namespace fmp4
