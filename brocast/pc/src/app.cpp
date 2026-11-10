// BroCast PC (Windows): the app. Finds your phone on the Wi-Fi, shows its screen with sound,
// full screen with F. Built only on Windows' own parts: Media Foundation decodes the video on the
// graphics card, Direct3D draws it, WASAPI plays the sound.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <shlobj.h>

#include <algorithm>
#include <cmath>
#include <deque>
#include <memory>
#include <string>
#include <vector>

#include "audio.h"
#include "decoder.h"
#include "fmp4.h"
#include "gfx.h"
#include "log.h"
#include "net.h"
#include "sync.h"

// ---------------------------------------------------------------- shared state

static const UINT WM_APP_UPDATE = WM_APP + 1;  // a background thread changed something: redraw the menus

static const uint32_t C_PURPLE = 0x7C5CFF, C_CYAN = 0x22D3EE, C_TEXT = 0xEEF2FF, C_DIM = 0x9AA4BF, C_BTN = 0x1C2438,
                      C_LIVE = 0xFF4D6D, C_ERR = 0xFF7A93, C_BAR = 0x0B0F1A;

enum class Screen { Searching, Pick, Typing, Pin, Waiting, Live };

struct Lock {
    CRITICAL_SECTION cs;
    Lock() { InitializeCriticalSection(&cs); }
};
struct Hold {
    Lock& l;
    explicit Hold(Lock& x) : l(x) { EnterCriticalSection(&l.cs); }
    ~Hold() { LeaveCriticalSection(&l.cs); }
};

struct Shared {
    Lock mu;
    Screen screen = Screen::Searching;
    std::vector<net::Phone> found;
    net::Phone phone;
    bool havePhone = false;
    std::string cookie;
    std::wstring pinError, typeError;
    bool reconnecting = false, phoneLive = false, authorized = true;
    int session = 0;          // new number for every phone picked: older threads see it and quit
    bool hwBroken = false;    // graphics card decoding failed once: use the CPU from then on
    bool onGraphicsCard = false;
    int64_t lastVideoUs = 0;
    std::string lastAddr;     // remembered between runs
    bool muted = false;
    bool busy = false;        // checking a typed address / PIN
};
static Shared g;
static volatile LONG g_running = 1;

static HWND g_hwnd = nullptr;
static Gfx g_gfx;
static AudioOut g_audio;
static HANDLE g_frameEvent = nullptr;

static void poke() { if (g_hwnd) PostMessageW(g_hwnd, WM_APP_UPDATE, 0, 0); }

static std::wstring widen(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w((size_t)n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], n);
    return w;
}

static std::string randomCid() {
    static const char* hex = "0123456789abcdef";
    std::string s = "pc";
    LARGE_INTEGER c;
    QueryPerformanceCounter(&c);
    uint64_t x = (uint64_t)c.QuadPart * 6364136223846793005ULL + GetCurrentProcessId();
    for (int i = 0; i < 12; i++) {
        x = x * 6364136223846793005ULL + 1442695040888963407ULL;
        s += hex[(x >> 59) & 15];
    }
    return s;
}

// ---------------------------------------------------------------- settings

static std::wstring settingsPath() {
    wchar_t* base = nullptr;
    std::wstring p;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &base))) {
        p = std::wstring(base) + L"\\BroCast";
        CoTaskMemFree(base);
        CreateDirectoryW(p.c_str(), nullptr);
        p += L"\\pc-settings.txt";
    }
    return p;
}

static void loadSettings() {
    FILE* f = _wfopen(settingsPath().c_str(), L"r");
    if (!f) return;
    char line[256];
    while (fgets(line, sizeof line, f)) {
        std::string s(line);
        while (!s.empty() && (s.back() == '\n' || s.back() == '\r')) s.pop_back();
        if (s.rfind("last=", 0) == 0) g.lastAddr = s.substr(5);
        if (s == "muted=1") g.muted = true;
    }
    fclose(f);
}

static void saveSettings() {
    std::string last;
    bool muted;
    {
        Hold h(g.mu);
        last = g.lastAddr;
        muted = g.muted;
    }
    FILE* f = _wfopen(settingsPath().c_str(), L"w");
    if (!f) return;
    fprintf(f, "last=%s\nmuted=%d\n", last.c_str(), muted ? 1 : 0);
    fclose(f);
}

// ---------------------------------------------------------------- frame slots

// The decoder fills slots; the window shows the one whose time has come.
struct Slots {
    enum State { FREE, FILLING, READY, SHOWN };
    Lock mu;
    State st[Gfx::SLOTS] = {};
    int64_t due[Gfx::SLOTS] = {};
    int shown = -1;

    int acquire() {
        Hold h(mu);
        for (int i = 0; i < Gfx::SLOTS; i++)
            if (st[i] == FREE) { st[i] = FILLING; return i; }
        // All waiting: drop the oldest waiting picture (never the one on screen).
        int best = -1;
        for (int i = 0; i < Gfx::SLOTS; i++)
            if (st[i] == READY && (best < 0 || due[i] < due[best])) best = i;
        if (best >= 0) st[best] = FILLING;
        return best;
    }
    void ready(int i, int64_t when) {
        Hold h(mu);
        due[i] = when;
        st[i] = READY;
    }
    void release(int i) {
        Hold h(mu);
        if (st[i] == FILLING) st[i] = FREE;
    }
    /** Picks the newest picture whose time has come. Returns true if what's on screen changed. */
    bool pick(int64_t now, int64_t& nextDue) {
        Hold h(mu);
        int best = -1;
        nextDue = INT64_MAX;
        for (int i = 0; i < Gfx::SLOTS; i++) {
            if (st[i] != READY) continue;
            if (due[i] <= now) {
                if (best < 0 || due[i] > due[best]) best = i;
            } else {
                nextDue = std::min(nextDue, due[i]);
            }
        }
        if (best < 0) return false;
        for (int i = 0; i < Gfx::SLOTS; i++)  // older ones that are due too: too late now, skip them
            if (st[i] == READY && due[i] <= due[best] && i != best) st[i] = FREE;
        if (shown >= 0 && st[shown] == SHOWN) st[shown] = FREE;
        st[best] = SHOWN;
        shown = best;
        return true;
    }
    void clearShown() {
        Hold h(mu);
        for (int i = 0; i < Gfx::SLOTS; i++)
            if (st[i] == READY || st[i] == SHOWN) st[i] = FREE;
        shown = -1;
    }
};
static Slots g_slots;

// ---------------------------------------------------------------- talking to the phone

static bool current(int session) {
    Hold h(g.mu);
    return g_running && g.havePhone && g.session == session;
}

static bool wantMedia(int session, net::Addr& addr, std::string& cookie) {
    Hold h(g.mu);
    if (!g_running || !g.havePhone || g.session != session || !g.phoneLive || !g.authorized) return false;
    addr = g.phone.addr;
    cookie = g.cookie;
    return true;
}

// Video comes in two steps. The network thread reads the phone's frames as they land and works out
// when each one should be on screen (VideoClock: a small cushion against Wi-Fi bursts), keeping
// them compressed (small) in a queue. The decode thread decodes each one just before its turn, so
// only a few decoded pictures ever wait (that's graphics memory), however big the cushion gets.

struct VFrame {
    bool isInit = false;
    std::vector<uint8_t> data;  // init segment, or the frame in Annex B form
    int64_t due = 0;            // when to show it (net::nowUs time)
    bool key = false;
};

struct VQueue {
    Lock mu;
    std::deque<VFrame> q;
    HANDLE ev = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    volatile LONG netDone = 0;  // the network thread for this session has finished
    double cushionMs = 200;
    ~VQueue() { CloseHandle(ev); }
};

static const int64_t DECODE_AHEAD_US = 50'000;  // decode this long before a frame's turn

struct VideoJob {
    int session;
    std::shared_ptr<VQueue> vq;
};

static DWORD WINAPI videoNetThread(void* arg) {
    VideoJob* job = (VideoJob*)arg;
    int session = job->session;
    std::shared_ptr<VQueue> vq = job->vq;
    delete job;
    avsync::VideoClock clock(200, 80, 800);
    std::string cid = randomCid();
    std::vector<uint8_t> msg;
    fmp4::Init init;
    int framesIn = 0;
    while (current(session)) {
        net::Addr addr;
        std::string cookie;
        if (!wantMedia(session, addr, cookie)) {
            Sleep(150);
            continue;
        }
        net::WebSocket ws;
        if (!ws.open(addr, "/video?cid=" + cid, cookie, 3000)) {
            Sleep(700);
            continue;
        }
        logf("video connected to %s", addr.str().c_str());
        clock.reset();
        init = fmp4::Init();
        int64_t connectedAt = net::nowUs(), lastMsg = connectedAt, lastStats = connectedAt;
        while (current(session)) {
            auto k = ws.next(msg, 400);
            int64_t now = net::nowUs();
            if (k == net::WebSocket::CLOSED) break;
            if (k == net::WebSocket::TIMEOUT) {
                if (now - lastMsg > 6'000'000) break;  // not even the phone's "still here" note: dead
                net::Addr a2;
                std::string c2;
                if (!wantMedia(session, a2, c2)) break;
                continue;
            }
            lastMsg = now;
            if (now - lastStats > 60'000'000) {
                logf("video: %d frames in, cushion %.0f ms, late %d", framesIn, clock.cushionMs(), clock.lateFrames());
                lastStats = now;
            }
            {
                // Anything from the phone (even its "still here" note on a still screen) means the connection is fine.
                Hold h(g.mu);
                g.lastVideoUs = now;
            }
            if (k != net::WebSocket::BINARY) continue;
            VFrame vf;
            if (msg.size() > 8 && memcmp(msg.data() + 4, "ftyp", 4) == 0) {
                if (!fmp4::parseInit(msg.data(), msg.size(), init)) continue;
                vf.isInit = true;
                vf.data = msg;
                vf.due = now;
            } else {
                if (!init.valid()) continue;
                fmp4::Frame f;
                if (!fmp4::parseFragment(msg.data(), msg.size(), init, f)) continue;
                framesIn++;
                bool learn = now - connectedAt > 1'500'000;  // the first burst (catching up to live) is late on purpose
                vf.due = clock.schedule(f.decodeTime * 100 / 9, now, learn);
                vf.key = f.keyFrame;
                vf.data = std::move(f.annexB);
            }
            {
                Hold h(vq->mu);
                vq->q.push_back(std::move(vf));
                vq->cushionMs = clock.cushionMs();
                // Something went very wrong (the decoder stopped?): don't pile up forever.
                while (vq->q.size() > 600) vq->q.pop_front();
            }
            SetEvent(vq->ev);
            g_audio.setVideoCushion(clock.cushionMs());
        }
        ws.close();
        logf("video connection ended");
        Sleep(200);
    }
    InterlockedExchange(&vq->netDone, 1);
    SetEvent(vq->ev);
    return 0;
}

static DWORD WINAPI videoDecodeThread(void* arg) {
    VideoJob* job = (VideoJob*)arg;
    std::shared_ptr<VQueue> vq = job->vq;
    delete job;
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    Decoder dec;
    fmp4::Init init;
    fmp4::ColorInfo color;
    std::deque<int64_t> dues;  // the decoder hands pictures out in order: each takes the next due time
    std::vector<VFrame> gop;   // frames since the last key frame: a restarted decoder replays them (no waiting for the next key frame)
    size_t gopBytes = 0;
    bool needKey = true;
    int fails = 0, pictures = 0, skippedUntilKey = 0;
    int64_t lastStats = net::nowUs();
    while (!vq->netDone) {
        VFrame vf;
        bool have = false;
        DWORD wait = 50;
        {
            Hold h(vq->mu);
            if (!vq->q.empty()) {
                VFrame& head = vq->q.front();
                int64_t start = head.due - DECODE_AHEAD_US, now = net::nowUs();
                if (head.isInit || start <= now) {
                    vf = std::move(head);
                    vq->q.pop_front();
                    have = true;
                } else {
                    wait = (DWORD)std::min<int64_t>(50, (start - now) / 1000 + 1);
                }
            }
        }
        if (!have) {
            WaitForSingleObject(vq->ev, wait);
            continue;
        }
        if (vf.isInit) {
            // New settings (start, or the phone rotated): (re)start the decoder.
            if (!fmp4::parseInit(vf.data.data(), vf.data.size(), init)) continue;
            color = fmp4::readSps(init.sps);
            bool hw;
            {
                Hold h(g.mu);
                hw = !g.hwBroken;
            }
            if (!dec.open(hw ? g_gfx.device() : nullptr, color.width, color.height) && hw) dec.open(nullptr, color.width, color.height);
            {
                Hold h(g.mu);
                g.onGraphicsCard = dec.onGraphicsCard();
            }
            dues.clear();
            needKey = true;
            // What the video says about colors; unsaid: HD = BT.709, smaller = BT.601 (what players do).
            bool bt709 = color.matrix == 1 || (color.matrix == 0 && std::max(color.width, color.height) >= 1280);
            if (color.matrix == 5 || color.matrix == 6) bt709 = false;
            g_gfx.setColors(bt709, color.fullRange);
            logf("video %dx%d, colors %s %s, decoding on the %s", color.width, color.height, bt709 ? "BT.709" : "BT.601",
                 color.fullRange ? "full" : "limited", dec.onGraphicsCard() ? "graphics card" : "CPU");
            continue;
        }
        if (!dec.isOpen()) continue;
        if (vf.key) {
            gop.clear();
            gopBytes = 0;
        }
        if (vf.key || !gop.empty()) {
            gopBytes += vf.data.size();
            if (gopBytes < (16u << 20)) gop.push_back(vf);
            else gop.clear();
        }
        // A fresh decoder (or one that just failed) starts at a key frame.
        if (needKey && !vf.key) {
            skippedUntilKey++;
            continue;
        }
        needKey = false;
        dues.push_back(vf.due);
        bool slotProblem = false;
        bool ok = dec.decode(vf.data.data(), vf.data.size(), (vf.due / 10) * 100, vf.key, [&](const DecodedPicture& pic) {
            int64_t due = net::nowUs();
            if (!dues.empty()) {
                due = dues.front();
                dues.pop_front();
            }
            int slot = g_slots.acquire();
            if (slot < 0) return;
            bool put = pic.texture ? g_gfx.putHardware(slot, pic.texture, pic.subresource, pic.width, pic.height)
                                   : g_gfx.putSoftware(slot, pic.data, pic.pitch, pic.uvOffset, pic.width, pic.height);
            if (!put) {
                g_slots.release(slot);
                if (pic.texture) slotProblem = true;
                return;
            }
            g_slots.ready(slot, due);
            pictures++;
            SetEvent(g_frameEvent);
        });
        // A decoder that keeps some pictures inside never hands those back: don't let old times pile up.
        while (dues.size() > 8) dues.pop_front();
        if (slotProblem || !ok) fails++;
        else fails = 0;
        if (slotProblem || fails >= 3) {
            bool wasGpu = dec.onGraphicsCard();
            {
                Hold h(g.mu);
                if (wasGpu) g.hwBroken = true;
            }
            logf("decoding failed (%s): starting the decoder over%s", wasGpu ? "graphics card" : "CPU", wasGpu ? " on the CPU" : "");
            dec.open(wasGpu ? nullptr : g_gfx.device(), color.width, color.height);
            if (!dec.isOpen()) dec.open(nullptr, color.width, color.height);
            {
                Hold h(g.mu);
                g.onGraphicsCard = dec.onGraphicsCard();
            }
            dues.clear();
            needKey = true;
            fails = 0;
            // Catch the new decoder up from the last key frame (those pictures are mostly due already: only the newest shows).
            if (dec.isOpen() && !gop.empty() && gop.front().key) {
                std::vector<VFrame> replay;
                replay.swap(gop);
                gopBytes = 0;
                for (auto& r : replay) {
                    dues.push_back(r.due);
                    dec.decode(r.data.data(), r.data.size(), (r.due / 10) * 100, r.key, [&](const DecodedPicture& pic) {
                        int64_t due = dues.empty() ? net::nowUs() : dues.front();
                        if (!dues.empty()) dues.pop_front();
                        int slot = g_slots.acquire();
                        if (slot < 0) return;
                        bool put = pic.texture ? g_gfx.putHardware(slot, pic.texture, pic.subresource, pic.width, pic.height)
                                               : g_gfx.putSoftware(slot, pic.data, pic.pitch, pic.uvOffset, pic.width, pic.height);
                        if (put) g_slots.ready(slot, due);
                        else g_slots.release(slot);
                    });
                    gop.push_back(std::move(r));
                    gopBytes += gop.back().data.size();
                }
                while (dues.size() > 8) dues.pop_front();
                needKey = false;
                SetEvent(g_frameEvent);
            }
        }
        int64_t now = net::nowUs();
        if (now - lastStats > 60'000'000) {
            size_t waiting;
            {
                Hold h(vq->mu);
                waiting = vq->q.size();
            }
            logf("decode: %d pictures, %d frames waiting, %d skipped to a key frame (%s)", pictures, (int)waiting, skippedUntilKey,
                 dec.onGraphicsCard() ? "graphics card" : "CPU");
            lastStats = now;
        }
    }
    dec.close();
    CoUninitialize();
    return 0;
}

static DWORD WINAPI audioThread(void* arg) {
    int session = (int)(intptr_t)arg;
    std::string cid = randomCid();
    std::vector<uint8_t> msg;
    while (current(session)) {
        net::Addr addr;
        std::string cookie;
        if (!wantMedia(session, addr, cookie)) {
            Sleep(150);
            continue;
        }
        net::WebSocket ws;
        if (!ws.open(addr, "/audio?cid=" + cid, cookie, 3000)) {
            Sleep(1000);
            continue;
        }
        g_audio.clear();
        int64_t lastMsg = net::nowUs();
        while (current(session)) {
            auto k = ws.next(msg, 400);
            if (k == net::WebSocket::CLOSED) break;
            if (k == net::WebSocket::TIMEOUT) {
                if (net::nowUs() - lastMsg > 6'000'000) break;
                net::Addr a2;
                std::string c2;
                if (!wantMedia(session, a2, c2)) break;
                continue;
            }
            lastMsg = net::nowUs();
            if (k == net::WebSocket::TEXT) {
                std::string s(msg.begin(), msg.end());
                if (net::jsonString(s, "type") == "format")
                    g_audio.setFormat((int)net::jsonNumber(s, "rate", 48000), (int)net::jsonNumber(s, "channels", 2));
            } else if (k == net::WebSocket::BINARY && msg.size() >= 4) {
                g_audio.push((const int16_t*)msg.data(), msg.size() / 2);
            }
        }
        ws.close();
        g_audio.clear();
        Sleep(300);
    }
    return 0;
}

/** Asks the phone how it's doing once a second: sharing? PIN needed? Still there? */
static DWORD WINAPI statusThread(void* arg) {
    int session = (int)(intptr_t)arg;
    std::string cid = randomCid();
    int64_t lastOk = net::nowUs();
    while (current(session)) {
        net::Addr addr;
        std::string cookie;
        {
            Hold h(g.mu);
            addr = g.phone.addr;
            cookie = g.cookie;
        }
        net::HttpResult r;
        bool ok = net::httpGet(addr, "/status?cid=" + cid + "&t=" + std::to_string(net::nowUs()), cookie, 2500, r) && r.code == 200;
        int64_t now = net::nowUs();
        {
            Hold h(g.mu);
            if (!current(session)) break;
            if (ok) {
                lastOk = now;
                g.reconnecting = false;
                std::string name = net::jsonString(r.body, "name");
                if (!name.empty()) g.phone.name = name;
                bool pin = net::jsonBool(r.body, "pinRequired"), authorized = net::jsonBool(r.body, "authorized", true);
                g.phoneLive = net::jsonBool(r.body, "live");
                g.authorized = !pin || authorized;
                if (!g.authorized) g.screen = Screen::Pin;
                else if (!g.phoneLive) g.screen = Screen::Waiting;
                else g.screen = Screen::Live;
            } else if (now - lastOk > 20'000'000) {
                // Gone for a while (Wi-Fi changed, phone off): look for it again, it may have a new address.
                logf("phone gone: searching again");
                g.havePhone = false;
                g.phoneLive = false;
                g.screen = Screen::Searching;
                g.session++;
            } else if (now - lastOk > 3'000'000) {
                g.reconnecting = true;
            }
        }
        poke();
        Sleep(1000);
    }
    return 0;
}

static void connectTo(const net::Phone& p) {
    int session;
    {
        Hold h(g.mu);
        g.phone = p;
        g.havePhone = true;
        g.cookie.clear();
        g.pinError.clear();
        g.typeError.clear();
        g.phoneLive = p.live;
        g.authorized = !p.pinRequired;
        g.reconnecting = false;
        g.screen = p.pinRequired ? Screen::Pin : (p.live ? Screen::Live : Screen::Waiting);
        g.lastAddr = p.addr.str();
        session = ++g.session;
    }
    logf("picked %s at %s", p.name.c_str(), p.addr.str().c_str());
    saveSettings();
    g_slots.clearShown();
    for (auto fn : {statusThread, audioThread}) CloseHandle(CreateThread(nullptr, 0, fn, (void*)(intptr_t)session, 0, nullptr));
    auto vq = std::make_shared<VQueue>();
    CloseHandle(CreateThread(nullptr, 0, videoNetThread, new VideoJob{session, vq}, 0, nullptr));
    CloseHandle(CreateThread(nullptr, 0, videoDecodeThread, new VideoJob{session, vq}, 0, nullptr));
    poke();
}

/** Looks for phones while none is picked. */
static DWORD WINAPI finderThread(void*) {
    while (g_running) {
        Screen screen;
        bool have;
        std::string last;
        {
            Hold h(g.mu);
            screen = g.screen;
            have = g.havePhone;
            last = g.lastAddr;
        }
        if (have || screen == Screen::Typing) {
            Sleep(300);
            continue;
        }
        std::vector<net::Phone> list;
        net::Addr la;
        net::Phone lp;
        // The phone from last time first: that's usually the one, and it's quick to ask.
        if (!last.empty() && net::parseAddr(last, la) && net::probe(la, 800, lp)) list.push_back(lp);
        // 8080 first (what BroCast uses unless something else on the phone took it), then the next few.
        auto add = [&](const std::vector<net::Phone>& more) {
            for (auto& p : more) {
                bool dup = false;
                for (auto& q : list) if (q.sid == p.sid) dup = true;
                if (!dup) list.push_back(p);
            }
        };
        add(net::scanLan({8080}, 1200));
        if (list.empty()) add(net::scanLan({8081, 8082, 8083}, 1200));
        net::Phone pick;
        bool autoPick = false;
        {
            Hold h(g.mu);
            if (!g.havePhone && g.screen != Screen::Typing) {
                g.found = list;
                if (list.size() == 1) {
                    pick = list[0];
                    autoPick = true;
                } else if (list.size() > 1) {
                    // Several phones: the one from last time if it's sharing, else the only one sharing, else ask.
                    int sharing = 0;
                    for (auto& p : list) if (p.live) sharing++;
                    for (auto& p : list) if (p.live && (p.addr.str() == g.lastAddr || sharing == 1)) { pick = p; autoPick = true; }
                    if (!autoPick) g.screen = Screen::Pick;
                } else if (g.screen == Screen::Pick) {
                    g.screen = Screen::Searching;
                }
            }
        }
        if (autoPick) connectTo(pick);
        poke();
        for (int i = 0; i < 15 && g_running; i++) Sleep(100);
    }
    return 0;
}

struct TypedJob { std::string text; };

static DWORD WINAPI typedThread(void* arg) {
    TypedJob* job = (TypedJob*)arg;
    net::Addr a;
    net::Phone p;
    bool ok = net::parseAddr(job->text, a) && net::probe(a, 2500, p);
    {
        Hold h(g.mu);
        g.busy = false;
        if (!ok) g.typeError = net::parseAddr(job->text, a) ? L"No BroCast phone answered there. Is it sharing?" : L"That doesn't look like an address (like 192.168.1.23:8080).";
    }
    if (ok) connectTo(p);
    poke();
    delete job;
    return 0;
}

static DWORD WINAPI pinThread(void* arg) {
    TypedJob* job = (TypedJob*)arg;
    net::Addr a;
    int session;
    {
        Hold h(g.mu);
        a = g.phone.addr;
        session = g.session;
    }
    net::HttpResult r;
    bool answered = net::httpGet(a, "/auth?pin=" + job->text + "&t=" + std::to_string(net::nowUs()), "", 4000, r);
    {
        Hold h(g.mu);
        g.busy = false;
        if (g.session == session) {
            if (answered && r.code == 200 && !r.setCookie.empty()) {
                g.cookie = r.setCookie;
                g.authorized = true;
                g.pinError.clear();
                g.screen = g.phoneLive ? Screen::Live : Screen::Waiting;
            } else if (answered && r.body.find("Too many") != std::string::npos) {
                g.pinError = L"Too many wrong tries. Wait 60 seconds, then try again.";
            } else {
                g.pinError = answered ? L"Wrong PIN. Check your phone and try again." : L"No answer from your phone. Try again.";
            }
        }
    }
    poke();
    delete job;
    return 0;
}

// ---------------------------------------------------------------- window + drawing

struct Button {
    RECT r;
    int id;
};
enum { B_TYPE = 1, B_CONNECT, B_BACK, B_SOUND, B_FULL, B_SEARCH, B_PHONE0 = 100 };

static Canvas g_canvas;
static std::vector<Button> g_buttons;
static std::string g_typed, g_pin;
static bool g_fullscreen = false;
static WINDOWPLACEMENT g_place = {sizeof(WINDOWPLACEMENT)};
static int64_t g_lastMouseUs = 0;
static bool g_cursorHidden = false, g_overlayDirty = true;
static float g_dpi = 1.f;
static float g_barAlpha = 1.f;
static int g_pickIndex = 0;
static int g_draws = 0;
static int64_t g_drawUs = 0, g_drawMaxUs = 0, g_lastDrawLog = 0;

static int S(float v) { return (int)std::lround(v * g_dpi); }

static void addButton(int id, int x, int y, int w, int h, const std::wstring& label, bool primary, bool small = false) {
    g_canvas.roundRect((float)x, (float)y, (float)w, (float)h, h / 2.f, primary ? C_PURPLE : C_BTN, 1.f);
    int size = S(small ? 15.f : 19.f);
    g_canvas.textCentered(label, x + w / 2, y + (h - size * 4 / 3) / 2, size, true, primary ? 0xFFFFFF : C_TEXT);
    g_buttons.push_back({{x, y, x + w, y + h}, id});
}

static void drawLogo(int cx, int y, int size) {
    std::wstring bro = L"Bro", cast = L"Cast";
    int wb = g_canvas.textWidth(bro, size, true), wc = g_canvas.textWidth(cast, size, true);
    int x = cx - (wb + wc) / 2;
    g_canvas.text(bro, x, y, size, true, C_PURPLE);
    g_canvas.text(cast, x + wb, y, size, true, C_CYAN);
}

static void redrawCanvas() {
    RECT rc;
    GetClientRect(g_hwnd, &rc);
    int W = std::max(1L, rc.right), H = std::max(1L, rc.bottom);
    if (g_canvas.w != W || g_canvas.h != H) g_canvas.resize(W, H);
    else g_canvas.clear();
    g_buttons.clear();
    Screen screen;
    std::vector<net::Phone> found;
    net::Phone phone;
    std::wstring pinError, typeError;
    bool reconnecting, busy, muted, onGpu;
    int64_t lastVideo;
    {
        Hold h(g.mu);
        screen = g.screen;
        found = g.found;
        phone = g.phone;
        pinError = g.pinError;
        typeError = g.typeError;
        reconnecting = g.reconnecting;
        busy = g.busy;
        muted = g.muted;
        lastVideo = g.lastVideoUs;
        onGpu = g.onGraphicsCard;
    }
    int cx = W / 2;
    int top = std::max(S(40), H / 2 - S(190));
    switch (screen) {
    case Screen::Searching: {
        drawLogo(cx, top, S(64));
        g_canvas.textCentered(L"Looking for your phone...", cx, top + S(110), S(26), true, C_TEXT);
        g_canvas.textCentered(L"Open BroCast 3 on your phone and tap Start sharing.", cx, top + S(160), S(18), false, C_DIM);
        g_canvas.textCentered(L"Your phone and this PC need to be on the same Wi-Fi.", cx, top + S(190), S(18), false, C_DIM);
        // A little moving dot row, so it's clear it's working.
        int dots = (int)((GetTickCount64() / 300) % 4);
        for (int i = 0; i < 3; i++) g_canvas.circle((float)(cx - S(24) + i * S(24)), (float)(top + S(245)), (float)S(6), i < dots ? C_CYAN : C_BTN, 1.f);
        addButton(B_TYPE, cx - S(170), top + S(290), S(340), S(52), L"Type the address instead", false);
        break;
    }
    case Screen::Pick: {
        drawLogo(cx, top - S(10), S(48));
        g_canvas.textCentered(L"Which phone?", cx, top + S(80), S(26), true, C_TEXT);
        int y = top + S(135);
        for (size_t i = 0; i < found.size() && i < 6; i++) {
            std::wstring label = std::to_wstring(i + 1) + L".  " + widen(found[i].name) + L"   " + widen(found[i].addr.str()) +
                                 (found[i].live ? L"   (sharing)" : L"");
            addButton(B_PHONE0 + (int)i, cx - S(260), y, S(520), S(52), label, (int)i == g_pickIndex);
            y += S(64);
        }
        g_canvas.textCentered(L"Click one, or press its number.", cx, y + S(10), S(16), false, C_DIM);
        break;
    }
    case Screen::Typing: {
        drawLogo(cx, top - S(10), S(48));
        g_canvas.textCentered(L"Type the address your phone shows", cx, top + S(80), S(26), true, C_TEXT);
        g_canvas.textCentered(L"It's on BroCast's screen on your phone, like 192.168.1.23:8080", cx, top + S(122), S(17), false, C_DIM);
        int bw = S(420), bh = S(60), bx = cx - bw / 2, by = top + S(165);
        g_canvas.roundRect((float)bx, (float)by, (float)bw, (float)bh, (float)S(14), C_BTN, 1.f);
        g_canvas.roundRect((float)bx, (float)by, (float)bw, (float)bh, (float)S(14), C_CYAN, 0.12f);
        std::wstring t = widen(g_typed);
        bool caret = (GetTickCount64() / 500) % 2 == 0;
        int tw = g_canvas.textWidth(t, S(28), true);
        g_canvas.text(t, cx - tw / 2, by + S(12), S(28), true, C_TEXT);
        if (caret) g_canvas.roundRect((float)(cx + tw / 2 + S(3)), (float)(by + S(14)), (float)S(3), (float)S(32), 1, C_CYAN, 1.f);
        if (busy) g_canvas.textCentered(L"Checking...", cx, by + S(78), S(18), false, C_DIM);
        else if (!typeError.empty()) g_canvas.textCentered(typeError, cx, by + S(78), S(18), false, C_ERR);
        addButton(B_BACK, cx - S(210), by + S(120), S(200), S(52), L"Back", false);
        addButton(B_CONNECT, cx + S(10), by + S(120), S(200), S(52), L"Connect", true);
        break;
    }
    case Screen::Pin: {
        drawLogo(cx, top - S(10), S(48));
        g_canvas.textCentered(L"Type the PIN shown on your phone", cx, top + S(80), S(26), true, C_TEXT);
        g_canvas.textCentered(widen(phone.name) + L" asks for a PIN, so nobody else on the Wi-Fi can watch.", cx, top + S(122), S(17), false, C_DIM);
        int box = S(70), gap = S(16), x0 = cx - (4 * box + 3 * gap) / 2, y = top + S(165);
        for (int i = 0; i < 4; i++) {
            int x = x0 + i * (box + gap);
            g_canvas.roundRect((float)x, (float)y, (float)box, (float)(box + S(10)), (float)S(14), C_BTN, 1.f);
            if (i == (int)g_pin.size()) g_canvas.roundRect((float)x, (float)y, (float)box, (float)(box + S(10)), (float)S(14), C_CYAN, 0.18f);
            if (i < (int)g_pin.size()) g_canvas.textCentered(std::wstring(1, (wchar_t)g_pin[(size_t)i]), x + box / 2, y + S(14), S(40), true, C_TEXT);
        }
        if (busy) g_canvas.textCentered(L"Checking...", cx, y + S(100), S(18), false, C_DIM);
        else if (!pinError.empty()) g_canvas.textCentered(pinError, cx, y + S(100), S(18), false, C_ERR);
        addButton(B_SEARCH, cx - S(130), y + S(150), S(260), S(48), L"Pick another phone", false, true);
        break;
    }
    case Screen::Waiting: {
        drawLogo(cx, top, S(56));
        g_canvas.textCentered(L"Connected to " + widen(phone.name), cx, top + S(100), S(26), true, C_TEXT);
        g_canvas.textCentered(L"Tap Start sharing in BroCast on your phone.", cx, top + S(148), S(18), false, C_DIM);
        g_canvas.textCentered(L"The picture shows up here by itself.", cx, top + S(178), S(18), false, C_DIM);
        addButton(B_SEARCH, cx - S(130), top + S(240), S(260), S(48), L"Pick another phone", false, true);
        break;
    }
    case Screen::Live: {
        bool noVideoYet = g_slots.shown < 0;
        if (noVideoYet) {
            drawLogo(cx, top, S(56));
            g_canvas.textCentered(L"Starting the picture...", cx, top + S(100), S(24), true, C_TEXT);
        }
        // The bar at the top (fades out while you watch; move the mouse to bring it back).
        int bw = std::min(W - S(32), S(760)), bh = S(60), bx = cx - bw / 2, by = S(18);
        g_canvas.roundRect((float)bx, (float)by, (float)bw, (float)bh, bh / 2.f, C_BAR, 0.82f);
        g_canvas.circle((float)(bx + S(30)), (float)(by + bh / 2), (float)S(7), C_LIVE, 1.f);
        int x = bx + S(46);
        x += g_canvas.text(L"LIVE", x, by + S(17), S(19), true, C_LIVE) + S(14);
        std::wstring name = widen(phone.name);
        if (name.size() > 22) name = name.substr(0, 21) + L"...";
        g_canvas.text(name, x, by + S(18), S(18), false, C_DIM);
        int b2 = S(150), b1 = S(130), bhh = S(40), byy = by + (bh - bhh) / 2;
        addButton(B_FULL, bx + bw - S(12) - b2, byy, b2, bhh, g_fullscreen ? L"Exit full screen" : L"Full screen", true, true);
        addButton(B_SOUND, bx + bw - S(24) - b2 - b1, byy, b1, bhh, muted ? L"Sound off" : L"Sound on", false, true);
        g_canvas.textCentered(std::wstring(L"F = full screen   M = sound   ") + (onGpu ? L"Graphics card" : L"CPU"), cx, by + bh + S(10), S(14), false, C_DIM);
        int64_t since = net::nowUs() - lastVideo;
        if (reconnecting || (!noVideoYet && lastVideo && since > 2'500'000)) {
            std::wstring t = L"Wi-Fi hiccup, getting the picture back...";
            int tw = g_canvas.textWidth(t, S(18), true) + S(48);
            g_canvas.roundRect((float)(cx - tw / 2), (float)(H - S(90)), (float)tw, (float)S(50), (float)S(25), C_BAR, 0.85f);
            g_canvas.textCentered(t, cx, H - S(77), S(18), true, C_TEXT);
        }
        break;
    }
    }
    if (screen != Screen::Live) g_canvas.textCentered(L"BroCast 3 for PC", cx, H - S(36), S(14), false, C_DIM, 0.7f);
    g_gfx.setOverlay(g_canvas);
}

static void setFullscreen(bool on) {
    if (on == g_fullscreen) return;
    DWORD style = (DWORD)GetWindowLongW(g_hwnd, GWL_STYLE);
    if (on) {
        GetWindowPlacement(g_hwnd, &g_place);
        MONITORINFO mi = {sizeof mi};
        GetMonitorInfoW(MonitorFromWindow(g_hwnd, MONITOR_DEFAULTTONEAREST), &mi);
        SetWindowLongW(g_hwnd, GWL_STYLE, (LONG)((style & ~WS_OVERLAPPEDWINDOW) | WS_POPUP));
        SetWindowPos(g_hwnd, HWND_TOP, mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.right - mi.rcMonitor.left,
                     mi.rcMonitor.bottom - mi.rcMonitor.top, SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
    } else {
        SetWindowLongW(g_hwnd, GWL_STYLE, (LONG)((style & ~WS_POPUP) | WS_OVERLAPPEDWINDOW));
        SetWindowPlacement(g_hwnd, &g_place);
        SetWindowPos(g_hwnd, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
    }
    g_fullscreen = on;
    g_overlayDirty = true;
}

static void toggleMute() {
    bool m;
    {
        Hold h(g.mu);
        g.muted = !g.muted;
        m = g.muted;
    }
    g_audio.setMuted(m);
    saveSettings();
    g_overlayDirty = true;
}

static void backToSearch() {
    {
        Hold h(g.mu);
        g.havePhone = false;
        g.session++;
        g.screen = Screen::Searching;
        g.found.clear();
        g.phoneLive = false;
    }
    g_slots.clearShown();
    g_audio.clear();
    g_overlayDirty = true;
}

static void submitTyped() {
    {
        Hold h(g.mu);
        if (g.busy) return;
        g.busy = true;
        g.typeError.clear();
    }
    CloseHandle(CreateThread(nullptr, 0, typedThread, new TypedJob{g_typed}, 0, nullptr));
}

static void submitPin() {
    {
        Hold h(g.mu);
        if (g.busy) return;
        g.busy = true;
        g.pinError.clear();
    }
    CloseHandle(CreateThread(nullptr, 0, pinThread, new TypedJob{g_pin}, 0, nullptr));
    g_pin.clear();
}

static void pressButton(int id) {
    Screen screen;
    std::vector<net::Phone> found;
    {
        Hold h(g.mu);
        screen = g.screen;
        found = g.found;
    }
    if (id == B_TYPE) {
        Hold h(g.mu);
        g.screen = Screen::Typing;
        g.typeError.clear();
        if (g_typed.empty() && !g.lastAddr.empty()) g_typed = g.lastAddr;
    } else if (id == B_BACK) {
        Hold h(g.mu);
        g.screen = Screen::Searching;
    } else if (id == B_CONNECT) {
        submitTyped();
    } else if (id == B_SOUND) {
        toggleMute();
    } else if (id == B_FULL) {
        setFullscreen(!g_fullscreen);
    } else if (id == B_SEARCH) {
        backToSearch();
    } else if (id >= B_PHONE0 && id - B_PHONE0 < (int)found.size()) {
        connectTo(found[(size_t)(id - B_PHONE0)]);
    }
    (void)screen;
    g_overlayDirty = true;
}

static Screen currentScreen() {
    Hold h(g.mu);
    return g.screen;
}

static LRESULT CALLBACK wndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_SIZE:
        if (wp != SIZE_MINIMIZED) {
            g_gfx.resize();
            g_overlayDirty = true;
        }
        return 0;
    case WM_DPICHANGED: {
        g_dpi = HIWORD(wp) / 96.f;
        RECT* r = (RECT*)lp;
        SetWindowPos(hwnd, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top, SWP_NOZORDER | SWP_NOACTIVATE);
        g_overlayDirty = true;
        return 0;
    }
    case WM_APP_UPDATE:
        g_overlayDirty = true;
        return 0;
    case WM_MOUSEMOVE:
        g_lastMouseUs = net::nowUs();
        if (g_cursorHidden) {
            g_cursorHidden = false;
            SetCursor(LoadCursorW(nullptr, IDC_ARROW));
        }
        return 0;
    case WM_SETCURSOR:
        if (LOWORD(lp) == HTCLIENT && g_cursorHidden) {
            SetCursor(nullptr);
            return TRUE;
        }
        break;
    case WM_LBUTTONDOWN: {
        g_lastMouseUs = net::nowUs();
        POINT p = {GET_X_LPARAM(lp), GET_Y_LPARAM(lp)};
        bool barVisible = currentScreen() != Screen::Live || g_barAlpha > 0.5f;
        if (barVisible)
            for (auto& b : g_buttons)
                if (PtInRect(&b.r, p)) {
                    pressButton(b.id);
                    return 0;
                }
        return 0;
    }
    case WM_LBUTTONDBLCLK:
        if (currentScreen() == Screen::Live) setFullscreen(!g_fullscreen);
        return 0;
    case WM_KEYDOWN: {
        Screen screen = currentScreen();
        if (wp == VK_F11) {
            setFullscreen(!g_fullscreen);
            return 0;
        }
        if (wp == VK_ESCAPE) {
            if (g_fullscreen) setFullscreen(false);
            else if (screen == Screen::Typing) pressButton(B_BACK);
            return 0;
        }
        if (screen == Screen::Live) {
            if (wp == 'F' || wp == VK_RETURN) setFullscreen(!g_fullscreen);
            if (wp == 'M') toggleMute();
            g_lastMouseUs = net::nowUs();
        } else if (screen == Screen::Searching) {
            if (wp == 'T' || wp == VK_RETURN) pressButton(B_TYPE);
        } else if (screen == Screen::Pick) {
            std::vector<net::Phone> found;
            {
                Hold h(g.mu);
                found = g.found;
            }
            if (wp == VK_DOWN) g_pickIndex = std::min((int)found.size() - 1, g_pickIndex + 1);
            if (wp == VK_UP) g_pickIndex = std::max(0, g_pickIndex - 1);
            if (wp == VK_RETURN && g_pickIndex < (int)found.size()) connectTo(found[(size_t)g_pickIndex]);
            if (wp >= '1' && wp <= '9' && (int)(wp - '1') < (int)found.size()) connectTo(found[(size_t)(wp - '1')]);
            if (wp >= VK_NUMPAD1 && wp <= VK_NUMPAD9 && (int)(wp - VK_NUMPAD1) < (int)found.size()) connectTo(found[(size_t)(wp - VK_NUMPAD1)]);
        } else if (screen == Screen::Typing) {
            if (wp == VK_RETURN) submitTyped();
            if (wp == VK_BACK && !g_typed.empty()) g_typed.pop_back();
        } else if (screen == Screen::Pin) {
            if (wp == VK_BACK && !g_pin.empty()) g_pin.pop_back();
        }
        g_overlayDirty = true;
        return 0;
    }
    case WM_CHAR: {
        Screen screen = currentScreen();
        wchar_t c = (wchar_t)wp;
        if (screen == Screen::Typing && ((c >= L'0' && c <= L'9') || c == L'.' || c == L':') && g_typed.size() < 21) g_typed += (char)c;
        if (screen == Screen::Pin && c >= L'0' && c <= L'9' && g_pin.size() < 4) {
            g_pin += (char)c;
            if (g_pin.size() == 4) submitPin();
        }
        g_overlayDirty = true;
        return 0;
    }
    case WM_CLOSE:
        InterlockedExchange(&g_running, 0);
        DestroyWindow(hwnd);
        return 0;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static float windowDpi(HWND hwnd) {
    typedef UINT(WINAPI * GetDpiForWindowFn)(HWND);
    auto fn = (GetDpiForWindowFn)(void*)GetProcAddress(GetModuleHandleW(L"user32.dll"), "GetDpiForWindow");
    UINT dpi = fn ? fn(hwnd) : 96;
    return (dpi ? dpi : 96) / 96.f;
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, LPWSTR, int show) {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    logOpen();
    net::init();
    loadSettings();
    g_audio.setMuted(g.muted);
    g_frameEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);

    WNDCLASSEXW wc = {sizeof wc};
    wc.style = CS_DBLCLKS;
    wc.lpfnWndProc = wndProc;
    wc.hInstance = inst;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
    wc.hbrBackground = CreateSolidBrush(RGB(0x0B, 0x0F, 0x1A));
    wc.lpszClassName = L"BroCastPC";
    RegisterClassExW(&wc);
    // 1280x720 picture area, centered, scaled for the screen's DPI.
    POINT origin = {0, 0};
    float dpi = 1.f;
    {
        HMONITOR mon = MonitorFromPoint(origin, MONITOR_DEFAULTTOPRIMARY);
        typedef HRESULT(WINAPI * GetDpiForMonitorFn)(HMONITOR, int, UINT*, UINT*);
        HMODULE shcore = LoadLibraryW(L"shcore.dll");
        auto fn = shcore ? (GetDpiForMonitorFn)(void*)GetProcAddress(shcore, "GetDpiForMonitor") : nullptr;
        UINT dx = 96, dy = 96;
        if (fn && SUCCEEDED(fn(mon, 0, &dx, &dy))) dpi = dx / 96.f;
    }
    RECT r = {0, 0, (LONG)(1280 * dpi), (LONG)(720 * dpi)};
    AdjustWindowRect(&r, WS_OVERLAPPEDWINDOW, FALSE);
    RECT work;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
    int ww = std::min(r.right - r.left, work.right - work.left), wh = std::min(r.bottom - r.top, work.bottom - work.top);
    g_hwnd = CreateWindowExW(0, wc.lpszClassName, L"BroCast", WS_OVERLAPPEDWINDOW, work.left + (work.right - work.left - ww) / 2,
                             work.top + (work.bottom - work.top - wh) / 2, ww, wh, nullptr, nullptr, inst, nullptr);
    if (!g_hwnd) return 1;
    g_dpi = windowDpi(g_hwnd);
    if (!g_gfx.init(g_hwnd)) {
        MessageBoxW(g_hwnd, L"BroCast couldn't start the graphics (Direct3D 11). Updating your graphics card driver usually fixes this.",
                    L"BroCast", MB_ICONERROR);
        return 1;
    }
    ShowWindow(g_hwnd, show);
    UpdateWindow(g_hwnd);
    g_audio.start();
    CloseHandle(CreateThread(nullptr, 0, finderThread, nullptr, 0, nullptr));

    bool wasLive = false;
    int64_t lastAnim = 0;
    MSG m;
    while (g_running) {
        // Sleep until a new picture is due, a message comes, or it's time to animate.
        int64_t nextDue = INT64_MAX;
        int64_t now = net::nowUs();
        bool changed = g_slots.pick(now, nextDue);
        Screen screen = currentScreen();
        bool live = screen == Screen::Live;
        if (live != wasLive) {
            // Keep the screen on while watching.
            SetThreadExecutionState(live ? (ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED) : ES_CONTINUOUS);
            wasLive = live;
            g_overlayDirty = true;
        }
        // The bar fades away 2.5 s after the mouse stops (only while a picture is showing).
        float wantBar = (!live || g_slots.shown < 0 || now - g_lastMouseUs < 2'500'000) ? 1.f : 0.f;
        float oldBar = g_barAlpha;
        g_barAlpha += (wantBar - g_barAlpha) * 0.25f;
        if (std::fabs(g_barAlpha - wantBar) < 0.02f) g_barAlpha = wantBar;
        bool animating = g_barAlpha != oldBar;
        if (live && g_fullscreen && g_slots.shown >= 0 && now - g_lastMouseUs > 2'500'000 && !g_cursorHidden) {
            g_cursorHidden = true;
            POINT p;
            GetCursorPos(&p);
            if (WindowFromPoint(p) == g_hwnd) SetCursor(nullptr);
        }
        // Menus that move (dots, caret, hiccup note) redraw a few times a second.
        if (!live || g_slots.shown < 0 || (now - lastAnim > 500'000 && (g.reconnecting || now - g.lastVideoUs > 2'000'000))) {
            if (now - lastAnim > 250'000) {
                g_overlayDirty = true;
                lastAnim = now;
            }
        }
        if (g_overlayDirty) {
            redrawCanvas();
            g_overlayDirty = false;
            changed = true;
        }
        if (changed || animating) {
            if (!IsIconic(g_hwnd)) {
                int64_t t0 = net::nowUs();
                // Video only on the live screen (not behind "Waiting for your phone" with an old picture).
                g_gfx.draw(live ? g_slots.shown : -1, live ? std::max(g_barAlpha, (g.reconnecting ? 1.f : 0.f)) : 1.f);
                int64_t took = net::nowUs() - t0;
                g_draws++;
                g_drawUs += took;
                g_drawMaxUs = std::max(g_drawMaxUs, took);
            }
        }
        if (now - g_lastDrawLog > 60'000'000) {
            if (live) logf("screen: %d shows in 60 s, %.1f ms each, slowest %.1f ms", g_draws, g_draws ? g_drawUs / 1000.0 / g_draws : 0.0, g_drawMaxUs / 1000.0);
            g_draws = 0;
            g_drawUs = g_drawMaxUs = 0;
            g_lastDrawLog = now;
        }
        DWORD wait = 100;
        if (animating) wait = 0;
        else if (nextDue != INT64_MAX) wait = (DWORD)std::max<int64_t>(0, std::min<int64_t>(100, (nextDue - net::nowUs()) / 1000));
        MsgWaitForMultipleObjects(1, &g_frameEvent, FALSE, wait, QS_ALLINPUT);
        while (PeekMessageW(&m, nullptr, 0, 0, PM_REMOVE)) {
            if (m.message == WM_QUIT) InterlockedExchange(&g_running, 0);
            TranslateMessage(&m);
            DispatchMessageW(&m);
        }
    }
    SetThreadExecutionState(ES_CONTINUOUS);
    logf("bye");
    g_audio.stop();
    // Background threads see g_running = 0 within half a second; nothing they hold needs saving.
    ExitProcess(0);
}
