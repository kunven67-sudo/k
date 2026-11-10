// BroCast PC tests (run on Linux): the parts that don't need Windows, checked on their own and
// against the fake phone (DevServer). Usage: test_main [phone-address [pin-phone-address out.h264]]
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "../src/fmp4.h"
#include "../src/net.h"
#include "../src/sync.h"

static int failures = 0;
#define CHECK(cond, ...)                                   \
    do {                                                   \
        if (cond) {                                        \
            printf("  PASS ");                             \
        } else {                                           \
            printf("  FAIL ");                             \
            failures++;                                    \
        }                                                  \
        printf(__VA_ARGS__);                               \
        printf("\n");                                      \
    } while (0)

static void unitTests() {
    printf("addresses\n");
    net::Addr a;
    CHECK(net::parseAddr("192.168.1.23:8080", a) && a.str() == "192.168.1.23:8080", "plain");
    CHECK(net::parseAddr(" http://192.168.1.23:8081/ ", a) && a.port == 8081, "with http:// and a slash");
    CHECK(net::parseAddr("192.168.1.23", a) && a.port == 8080, "no port = 8080");
    CHECK(!net::parseAddr("192.168.1.300:8080", a), "bad number refused");
    CHECK(!net::parseAddr("phone:8080", a), "names refused");

    printf("json\n");
    std::string j = R"({"app":"BroCast","name":"Bro’s \"razr\"","live":true,"pinRequired":false,"kbps":4500})";
    CHECK(net::jsonString(j, "app") == "BroCast", "string");
    CHECK(net::jsonString(j, "name") == "Bro\xE2\x80\x99s \"razr\"", "escapes: %s", net::jsonString(j, "name").c_str());
    CHECK(net::jsonBool(j, "live") && !net::jsonBool(j, "pinRequired", true), "bools");
    CHECK(net::jsonNumber(j, "kbps") == 4500 && net::jsonNumber(j, "nope", -1) == -1, "numbers");

    printf("video clock\n");
    {
        avsync::VideoClock c(200, 80, 800);
        // 30 fps, Wi-Fi adds 5-60 ms (bursty). After the start, nothing should be late.
        unsigned seed = 7;
        auto rnd = [&]() { seed = seed * 1103515245u + 12345u; return (seed >> 8) % 1000 / 1000.0; };
        int64_t lastDue = 0;
        bool ordered = true;
        int lateBefore = 0;
        for (int i = 0; i < 900; i++) {
            int64_t pts = i * 33'333LL;
            int64_t arrival = 10'000'000 + pts + 5'000 + (int64_t)(rnd() * 55'000);
            int64_t due = c.schedule(pts, arrival);
            if (i > 0 && due <= lastDue) ordered = false;
            lastDue = due;
            if (i == 150) lateBefore = c.lateFrames();
        }
        CHECK(ordered, "frames shown in order, evenly");
        CHECK(c.lateFrames() == lateBefore, "no late frames once settled (late %d)", c.lateFrames());
        CHECK(c.cushionMs() <= 200, "cushion didn't need to grow: %.0f ms", c.cushionMs());
    }
    {
        avsync::VideoClock c(100, 80, 800);
        // Hiccups of 300 ms every 2 s: the cushion grows until they're covered.
        int lateFirst = 0, lateLast = 0;
        for (int i = 0; i < 1800; i++) {
            int64_t pts = i * 33'333LL;
            int64_t t = pts % 2'000'000;
            int64_t extra = t < 300'000 ? 300'000 - t : 0;  // frames made during a hiccup all land at its end
            int64_t arrival = 10'000'000 + pts + 5'000 + extra;
            int before = c.lateFrames();
            c.schedule(pts, arrival);
            if (c.lateFrames() > before) (i < 600 ? lateFirst : lateLast)++;
        }
        CHECK(lateFirst > 0 && lateLast == 0, "learns choppy Wi-Fi: late %d at first, %d after", lateFirst, lateLast);
        CHECK(c.cushionMs() >= 250 && c.cushionMs() <= 450, "cushion covers the ~280 ms hiccups: %.0f ms", c.cushionMs());
    }
    {
        avsync::VideoClock c(200, 80, 800);
        for (int i = 0; i < 60; i++) c.schedule(i * 33'333LL, 1'000'000 + i * 33'333LL + 10'000);
        // Still screen for 5 s: the phone's timeline skips it, so frames now "arrive" 5 s later.
        int64_t pts = 60 * 33'333LL;
        int64_t first = 0;
        for (int i = 0; i < 30; i++) {
            int64_t arrival = 1'000'000 + pts + 5'000'000 + 10'000 + i * 33'333LL;
            int64_t due = c.schedule(pts + i * 33'333LL, arrival);
            if (i == 10) first = due - arrival;
        }
        CHECK(first > 100'000 && first < 300'000, "after a still screen it settles on a normal delay again (%lld ms)", (long long)(first / 1000));
    }
    {
        avsync::AudioPacer p;
        double t = avsync::AudioPacer::target(200, 20);
        CHECK(t > 150 && t < 260, "sound waits about as long as the picture: %.0f ms", t);
        CHECK(p.speed(t + 100, t) > 1 && p.speed(t + 20, t) > 1 && p.speed(t, t) == 1 && p.speed(t - 100, t) < 1, "speed nudges");
    }
}

static int64_t ms() { return net::nowUs() / 1000; }

static void liveTests(const char* phoneAddr, const char* pinPhone, const char* outFile) {
    net::Addr a;
    if (!net::parseAddr(phoneAddr, a)) {
        printf("bad address %s\n", phoneAddr);
        failures++;
        return;
    }
    printf("phone at %s\n", a.str().c_str());
    net::Phone ph;
    CHECK(net::probe(a, 2000, ph), "found by asking its address");
    CHECK(ph.name == "Dev Phone" && !ph.sid.empty(), "name %s, session %s", ph.name.c_str(), ph.sid.c_str());

    // Looking around the local network finds it too (the test server listens on every address).
    int64_t t0 = ms();
    auto found = net::scanLan({a.port}, 1500);
    bool seen = false;
    for (auto& f : found) if (f.sid == ph.sid) seen = true;
    auto locals = net::localAddresses();
    CHECK(seen || locals.empty(), "LAN scan finds it (%zu phones, %zu local addresses, %lld ms)", found.size(), locals.size(), (long long)(ms() - t0));

    // Video: init, then frames with a seamless timeline, decodable.
    net::WebSocket ws;
    CHECK(ws.open(a, "/video?cid=pctest", "", 3000), "video connection");
    fmp4::Init init;
    std::vector<fmp4::Frame> frames;
    bool sawInit = false, sawHello = false;
    int64_t end = ms() + 4000;
    std::vector<uint8_t> msg;
    FILE* out = outFile ? fopen(outFile, "wb") : nullptr;
    while (ms() < end) {
        auto k = ws.next(msg, 1000);
        if (k == net::WebSocket::CLOSED) break;
        if (k == net::WebSocket::TEXT) {
            std::string s(msg.begin(), msg.end());
            if (net::jsonString(s, "type") == "hello") sawHello = true;
            if (net::jsonString(s, "type") == "init") sawInit = true;
        } else if (k == net::WebSocket::BINARY) {
            if (msg.size() > 8 && memcmp(msg.data() + 4, "ftyp", 4) == 0) {
                CHECK(fmp4::parseInit(msg.data(), msg.size(), init), "init segment read (SPS %zu bytes, PPS %zu)", init.sps.size(), init.pps.size());
                auto ci = fmp4::readSps(init.sps);
                printf("    SPS says %dx%d, matrix %d, full range %d\n", ci.width, ci.height, ci.matrix, ci.fullRange);
                CHECK(ci.width > 0 && ci.height > 0, "size from the SPS");
            } else {
                fmp4::Frame f;
                if (fmp4::parseFragment(msg.data(), msg.size(), init, f)) {
                    frames.push_back(f);
                    if (out) fwrite(f.annexB.data(), 1, f.annexB.size(), out);
                }
            }
        }
    }
    if (out) fclose(out);
    ws.close();
    CHECK(sawHello && sawInit, "hello + init notes");
    CHECK(frames.size() > 60, "%zu frames in 4 s", frames.size());
    CHECK(!frames.empty() && frames[0].keyFrame, "starts on a key frame");
    bool seamless = true;
    for (size_t i = 1; i < frames.size(); i++)
        if (frames[i].decodeTime != frames[i - 1].decodeTime + frames[i - 1].duration) seamless = false;
    CHECK(seamless, "every frame starts where the one before ends");

    // Sound.
    net::WebSocket au;
    CHECK(au.open(a, "/audio?cid=pctest", "", 3000), "sound connection");
    int chunks = 0;
    size_t bytes = 0;
    bool fmt = false;
    end = ms() + 1500;
    while (ms() < end) {
        auto k = au.next(msg, 500);
        if (k == net::WebSocket::CLOSED) break;
        if (k == net::WebSocket::TEXT && net::jsonNumber(std::string(msg.begin(), msg.end()), "rate") == 48000) fmt = true;
        if (k == net::WebSocket::BINARY) { chunks++; bytes += msg.size(); }
    }
    CHECK(fmt, "sound format 48 kHz");
    CHECK(chunks > 40, "%d sound pieces in 1.5 s (%zu bytes)", chunks, bytes);

    if (pinPhone) {
        net::Addr p;
        net::parseAddr(pinPhone, p);
        net::Phone pp;
        CHECK(net::probe(p, 2000, pp) && pp.pinRequired, "PIN phone says it needs a PIN");
        net::HttpResult r;
        net::httpGet(p, "/video", "", 2000, r);
        CHECK(r.code == 401, "no video without the PIN (%d)", r.code);
        net::httpGet(p, "/auth?pin=1111", "", 2000, r);
        CHECK(r.code != 200 && r.setCookie.empty(), "wrong PIN refused (%d)", r.code);
        net::httpGet(p, "/auth?pin=4821", "", 2000, r);
        CHECK(r.code == 200 && !r.setCookie.empty(), "right PIN gives a cookie: %s", r.setCookie.c_str());
        net::WebSocket w2;
        CHECK(w2.open(p, "/video?cid=pctest2", r.setCookie, 3000), "video with the cookie");
        int got = 0;
        end = ms() + 1500;
        while (ms() < end && got < 5) if (w2.next(msg, 500) == net::WebSocket::BINARY) got++;
        CHECK(got >= 5, "frames arrive");
    }
}

int main(int argc, char** argv) {
    net::init();
    unitTests();
    if (argc > 1) liveTests(argv[1], argc > 2 ? argv[2] : nullptr, argc > 3 ? argv[3] : nullptr);
    printf(failures ? "\n%d FAILED\n" : "\nALL PC CHECKS PASSED\n", failures);
    return failures ? 1 : 0;
}
