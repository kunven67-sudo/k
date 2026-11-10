// BroCast PC: sockets, HTTP and WebSocket client. See net.h.
#include "net.h"

#ifdef _WIN32
#ifndef FD_SETSIZE
#define FD_SETSIZE 1024
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include <windows.h>
typedef SOCKET sock_t;
static const sock_t BAD_SOCK = INVALID_SOCKET;
static void closeSock(sock_t s) { closesocket(s); }
static bool wouldBlock() {
    int e = WSAGetLastError();
    return e == WSAEWOULDBLOCK || e == WSAEINPROGRESS;
}
static void setNonBlocking(sock_t s, bool on) {
    u_long v = on ? 1 : 0;
    ioctlsocket(s, FIONBIO, &v);
}
#else
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <ifaddrs.h>
#include <net/if.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>
typedef int sock_t;
static const sock_t BAD_SOCK = -1;
static void closeSock(sock_t s) { ::close(s); }
static bool wouldBlock() { return errno == EINPROGRESS || errno == EWOULDBLOCK || errno == EAGAIN; }
static void setNonBlocking(sock_t s, bool on) {
    int f = fcntl(s, F_GETFL, 0);
    fcntl(s, F_SETFL, on ? (f | O_NONBLOCK) : (f & ~O_NONBLOCK));
}
#endif

#include <algorithm>
#include <chrono>
#include <cstring>
#include <random>

namespace net {

int64_t nowUs() {
    return std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

bool init() {
#ifdef _WIN32
    WSADATA d;
    return WSAStartup(MAKEWORD(2, 2), &d) == 0;
#else
    return true;
#endif
}

std::string Addr::str() const {
    char b[32];
    snprintf(b, sizeof b, "%u.%u.%u.%u:%u", (ip >> 24) & 255, (ip >> 16) & 255, (ip >> 8) & 255, ip & 255, port);
    return b;
}

bool parseAddr(const std::string& text, Addr& out) {
    std::string t;
    for (char c : text) if (c != ' ' && c != '\t' && c != '\r' && c != '\n') t += c;
    if (t.rfind("http://", 0) == 0) t = t.substr(7);
    while (!t.empty() && t.back() == '/') t.pop_back();
    unsigned a, b, c, d, port = 8080;
    char tail;
    int n = sscanf(t.c_str(), "%u.%u.%u.%u:%u%c", &a, &b, &c, &d, &port, &tail);
    if (n == 4) port = 8080;
    else if (n != 5) return false;
    if (a > 255 || b > 255 || c > 255 || d > 255 || port == 0 || port > 65535) return false;
    out.ip = (a << 24) | (b << 16) | (c << 8) | d;
    out.port = (uint16_t)port;
    return out.ip != 0;
}

static sockaddr_in toSockaddr(const Addr& a) {
    sockaddr_in sa;
    memset(&sa, 0, sizeof sa);
    sa.sin_family = AF_INET;
    sa.sin_port = htons(a.port);
    sa.sin_addr.s_addr = htonl(a.ip);
    return sa;
}

static void setTimeouts(sock_t s, int ms) {
#ifdef _WIN32
    DWORD t = (DWORD)ms;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&t, sizeof t);
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&t, sizeof t);
#else
    timeval tv{ms / 1000, (ms % 1000) * 1000};
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);
#endif
}

/** Connects with a timeout. Returns a blocking socket, or BAD_SOCK. */
static sock_t connectTo(const Addr& a, int timeoutMs) {
    sock_t s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == BAD_SOCK) return BAD_SOCK;
    setNonBlocking(s, true);
    sockaddr_in sa = toSockaddr(a);
    int r = connect(s, (sockaddr*)&sa, sizeof sa);
    if (r != 0) {
        if (!wouldBlock()) {
            closeSock(s);
            return BAD_SOCK;
        }
        fd_set w, e;
        FD_ZERO(&w);
        FD_ZERO(&e);
        FD_SET(s, &w);
        FD_SET(s, &e);
        timeval tv{timeoutMs / 1000, (timeoutMs % 1000) * 1000};
        r = select((int)s + 1, nullptr, &w, &e, &tv);
        int err = 0;
        socklen_t len = sizeof err;
        if (r <= 0 || FD_ISSET(s, &e) || getsockopt(s, SOL_SOCKET, SO_ERROR, (char*)&err, &len) != 0 || err != 0) {
            closeSock(s);
            return BAD_SOCK;
        }
    }
    setNonBlocking(s, false);
    int one = 1;
    setsockopt(s, IPPROTO_TCP, TCP_NODELAY, (const char*)&one, sizeof one);
    setTimeouts(s, timeoutMs);
    return s;
}

static bool sendAll(sock_t s, const char* d, size_t n) {
    while (n > 0) {
        int k = send(s, d, (int)std::min<size_t>(n, 1 << 20), 0);
        if (k <= 0) return false;
        d += k;
        n -= (size_t)k;
    }
    return true;
}

static std::string requestHead(const Addr& a, const std::string& path, const std::string& cookie) {
    std::string r = "GET " + path + " HTTP/1.1\r\nHost: " + a.str() + "\r\nUser-Agent: BroCastPC/3.0\r\n";
    if (!cookie.empty()) r += "Cookie: " + cookie + "\r\n";
    return r;
}

static std::string lower(std::string s) {
    for (auto& c : s) c = (char)tolower((unsigned char)c);
    return s;
}

/** Splits an HTTP response head: status code + a header's value (lower-case name). */
static int statusCode(const std::string& head) {
    int code = 0;
    if (sscanf(head.c_str(), "HTTP/%*s %d", &code) != 1) return 0;
    return code;
}

static std::string headerValue(const std::string& head, const char* name) {
    std::string h = lower(head), key = std::string("\r\n") + name + ":";
    size_t i = h.find(key);
    if (i == std::string::npos) return "";
    i += key.size();
    size_t e = head.find("\r\n", i);
    std::string v = head.substr(i, e == std::string::npos ? std::string::npos : e - i);
    while (!v.empty() && v[0] == ' ') v.erase(0, 1);
    return v;
}

bool httpGet(const Addr& a, const std::string& path, const std::string& cookie, int timeoutMs, HttpResult& out) {
    out = HttpResult();
    sock_t s = connectTo(a, timeoutMs);
    if (s == BAD_SOCK) return false;
    std::string req = requestHead(a, path, cookie) + "Connection: close\r\n\r\n";
    std::string resp;
    if (sendAll(s, req.data(), req.size())) {
        char b[8192];
        int64_t deadline = nowUs() + (int64_t)timeoutMs * 1000;
        while (resp.size() < (4u << 20) && nowUs() < deadline) {
            int k = recv(s, b, sizeof b, 0);
            if (k <= 0) break;
            resp.append(b, (size_t)k);
        }
    }
    closeSock(s);
    size_t he = resp.find("\r\n\r\n");
    if (he == std::string::npos) return false;
    std::string head = resp.substr(0, he);
    out.code = statusCode(head);
    out.body = resp.substr(he + 4);
    std::string sc = headerValue(head, "set-cookie");
    if (!sc.empty()) out.setCookie = sc.substr(0, sc.find(';'));
    return out.code > 0;
}

// ---------------------------------------------------------------- tiny JSON

static size_t findKey(const std::string& json, const char* key) {
    std::string k = std::string("\"") + key + "\"";
    size_t i = json.find(k);
    if (i == std::string::npos) return i;
    i = json.find(':', i + k.size());
    if (i == std::string::npos) return i;
    i++;
    while (i < json.size() && (json[i] == ' ' || json[i] == '\t')) i++;
    return i;
}

std::string jsonString(const std::string& json, const char* key) {
    size_t i = findKey(json, key);
    if (i == std::string::npos || i >= json.size() || json[i] != '"') return "";
    std::string out;
    for (i++; i < json.size() && json[i] != '"'; i++) {
        char c = json[i];
        if (c == '\\' && i + 1 < json.size()) {
            char n = json[++i];
            if (n == 'n') out += ' ';
            else if (n == 'u' && i + 4 < json.size()) {
                unsigned cp = (unsigned)strtoul(json.substr(i + 1, 4).c_str(), nullptr, 16);
                i += 4;
                // UTF-8 encode (BMP only is plenty for a phone name).
                if (cp < 0x80) out += (char)cp;
                else if (cp < 0x800) { out += (char)(0xC0 | (cp >> 6)); out += (char)(0x80 | (cp & 63)); }
                else { out += (char)(0xE0 | (cp >> 12)); out += (char)(0x80 | ((cp >> 6) & 63)); out += (char)(0x80 | (cp & 63)); }
            } else out += n;
        } else out += c;
    }
    return out;
}

bool jsonBool(const std::string& json, const char* key, bool fallback) {
    size_t i = findKey(json, key);
    if (i == std::string::npos) return fallback;
    if (json.compare(i, 4, "true") == 0) return true;
    if (json.compare(i, 5, "false") == 0) return false;
    return fallback;
}

long long jsonNumber(const std::string& json, const char* key, long long fallback) {
    size_t i = findKey(json, key);
    if (i == std::string::npos || i >= json.size()) return fallback;
    char* end = nullptr;
    long long v = strtoll(json.c_str() + i, &end, 10);
    return end == json.c_str() + i ? fallback : v;
}

// ---------------------------------------------------------------- finding phones

static bool readPhone(const std::string& body, const Addr& a, Phone& out) {
    if (jsonString(body, "app") != "BroCast") return false;
    out.addr = a;
    out.name = jsonString(body, "name");
    out.sid = jsonString(body, "sid");
    out.live = jsonBool(body, "live");
    out.pinRequired = jsonBool(body, "pinRequired");
    if (out.name.empty()) out.name = "Phone";
    return true;
}

bool probe(const Addr& a, int timeoutMs, Phone& out) {
    HttpResult r;
    if (!httpGet(a, "/status?t=" + std::to_string(nowUs()), "", timeoutMs, r) || r.code != 200) return false;
    return readPhone(r.body, a, out);
}

std::vector<uint32_t> localAddresses() {
    std::vector<uint32_t> out;
#ifdef _WIN32
    ULONG size = 32 * 1024;
    std::vector<uint8_t> buf(size);
    auto* list = (IP_ADAPTER_ADDRESSES*)buf.data();
    ULONG flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;
    if (GetAdaptersAddresses(AF_INET, flags, nullptr, list, &size) == ERROR_BUFFER_OVERFLOW) {
        buf.resize(size);
        list = (IP_ADAPTER_ADDRESSES*)buf.data();
    }
    if (GetAdaptersAddresses(AF_INET, flags, nullptr, list, &size) == NO_ERROR) {
        for (auto* ad = list; ad; ad = ad->Next) {
            if (ad->OperStatus != IfOperStatusUp || ad->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
            for (auto* u = ad->FirstUnicastAddress; u; u = u->Next) {
                if (u->Address.lpSockaddr->sa_family != AF_INET) continue;
                uint32_t ip = ntohl(((sockaddr_in*)u->Address.lpSockaddr)->sin_addr.s_addr);
                if ((ip >> 24) == 127 || (ip >> 16) == 0xA9FE) continue; // loopback, link-local
                out.push_back(ip);
            }
        }
    }
#else
    ifaddrs* ifs = nullptr;
    if (getifaddrs(&ifs) == 0) {
        for (auto* i = ifs; i; i = i->ifa_next) {
            if (!i->ifa_addr || i->ifa_addr->sa_family != AF_INET || !(i->ifa_flags & IFF_UP)) continue;
            uint32_t ip = ntohl(((sockaddr_in*)i->ifa_addr)->sin_addr.s_addr);
            if ((ip >> 24) == 127 || (ip >> 16) == 0xA9FE) continue;
            out.push_back(ip);
        }
        freeifaddrs(ifs);
    }
#endif
    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

std::vector<Phone> scanLan(const std::vector<uint16_t>& ports, int timeoutMs) {
    std::vector<Addr> targets;
    for (uint32_t me : localAddresses()) {
        uint32_t net24 = me & 0xFFFFFF00u;
        for (uint32_t h = 1; h < 255; h++) {
            uint32_t ip = net24 | h;
            for (uint16_t p : ports) targets.push_back(Addr{ip, p});
        }
    }
    std::vector<Phone> found;
    // A batch at a time: select() takes at most FD_SETSIZE (1024) sockets; one /24 on two ports fits.
    const size_t batch = 600;
    for (size_t start = 0; start < targets.size(); start += batch) {
        size_t end = std::min(targets.size(), start + batch);
        struct Pending { sock_t s; Addr a; int stage; std::string got; };
        std::vector<Pending> ps;
        for (size_t i = start; i < end; i++) {
            sock_t s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
            if (s == BAD_SOCK) continue;
#ifndef _WIN32
            if (s >= FD_SETSIZE) { closeSock(s); continue; }
#endif
            setNonBlocking(s, true);
            sockaddr_in sa = toSockaddr(targets[i]);
            int r = connect(s, (sockaddr*)&sa, sizeof sa);
            if (r != 0 && !wouldBlock()) { closeSock(s); continue; }
            ps.push_back({s, targets[i], 0, ""});
        }
        int64_t deadline = nowUs() + (int64_t)timeoutMs * 1000;
        while (nowUs() < deadline) {
            fd_set w, rd;
            FD_ZERO(&w);
            FD_ZERO(&rd);
            int maxfd = 0, waiting = 0;
            for (auto& p : ps) {
                if (p.s == BAD_SOCK) continue;
                if (p.stage == 0) FD_SET(p.s, &w);
                else FD_SET(p.s, &rd);
                maxfd = std::max(maxfd, (int)p.s);
                waiting++;
            }
            if (!waiting) break;
            int64_t left = std::max<int64_t>(1, (deadline - nowUs()) / 1000);
            timeval tv{(long)(left / 1000), (long)((left % 1000) * 1000)};
            if (select(maxfd + 1, &rd, &w, nullptr, &tv) <= 0) break;
            for (auto& p : ps) {
                if (p.s == BAD_SOCK) continue;
                if (p.stage == 0 && FD_ISSET(p.s, &w)) {
                    int err = 0;
                    socklen_t len = sizeof err;
                    getsockopt(p.s, SOL_SOCKET, SO_ERROR, (char*)&err, &len);
                    std::string req = requestHead(p.a, "/status", "") + "Connection: close\r\n\r\n";
                    if (err != 0 || send(p.s, req.data(), (int)req.size(), 0) != (int)req.size()) {
                        closeSock(p.s);
                        p.s = BAD_SOCK;
                    } else {
                        p.stage = 1;
                    }
                } else if (p.stage == 1 && FD_ISSET(p.s, &rd)) {
                    char b[4096];
                    int k = recv(p.s, b, sizeof b, 0);
                    if (k > 0 && p.got.size() < 16384) {
                        p.got.append(b, (size_t)k);
                        continue;
                    }
                    closeSock(p.s);
                    p.s = BAD_SOCK;
                    size_t he = p.got.find("\r\n\r\n");
                    Phone ph;
                    if (he != std::string::npos && statusCode(p.got) == 200 && readPhone(p.got.substr(he + 4), p.a, ph)) found.push_back(ph);
                }
            }
        }
        for (auto& p : ps) if (p.s != BAD_SOCK) closeSock(p.s);
    }
    // One entry per phone (it may answer on two ports, or on two networks).
    std::vector<Phone> unique;
    for (auto& p : found) {
        bool dup = false;
        for (auto& u : unique) if (!p.sid.empty() && u.sid == p.sid) dup = true;
        if (!dup) unique.push_back(p);
    }
    return unique;
}

// ---------------------------------------------------------------- WebSocket

WebSocket::~WebSocket() {
    if (fd_ != kBad) closeSock((sock_t)fd_);
}

static std::string base64(const uint8_t* d, size_t n) {
    static const char* t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string o;
    for (size_t i = 0; i < n; i += 3) {
        uint32_t v = (uint32_t)d[i] << 16 | (i + 1 < n ? (uint32_t)d[i + 1] << 8 : 0) | (i + 2 < n ? d[i + 2] : 0);
        o += t[(v >> 18) & 63];
        o += t[(v >> 12) & 63];
        o += i + 1 < n ? t[(v >> 6) & 63] : '=';
        o += i + 2 < n ? t[v & 63] : '=';
    }
    return o;
}

bool WebSocket::open(const Addr& a, const std::string& path, const std::string& cookie, int timeoutMs) {
    close();
    if (fd_ != kBad) {
        closeSock((sock_t)fd_);
        fd_ = kBad;
    }
    buf_.clear();
    pos_ = 0;
    sock_t s = connectTo(a, timeoutMs);
    if (s == BAD_SOCK) return false;
    uint8_t key[16];
    std::random_device rd;
    for (auto& k : key) k = (uint8_t)rd();
    std::string req = requestHead(a, path, cookie) +
        "Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: " + base64(key, 16) + "\r\n\r\n";
    if (!sendAll(s, req.data(), req.size())) {
        closeSock(s);
        return false;
    }
    // Read the head; whatever comes after it is the first frames.
    std::string resp;
    char b[4096];
    size_t he = std::string::npos;
    while (he == std::string::npos && resp.size() < 16384) {
        int k = recv(s, b, sizeof b, 0);
        if (k <= 0) break;
        resp.append(b, (size_t)k);
        he = resp.find("\r\n\r\n");
    }
    if (he == std::string::npos || statusCode(resp) != 101) {
        closeSock(s);
        return false;
    }
    buf_.assign(resp.begin() + (long)he + 4, resp.end());
    // Big receive buffer: a key frame can be a few hundred KB.
    int rcv = 2 << 20;
    setsockopt(s, SOL_SOCKET, SO_RCVBUF, (const char*)&rcv, sizeof rcv);
    fd_ = (intptr_t)s;
    return true;
}

bool WebSocket::readMore(int timeoutMs, bool& timedOut) {
    timedOut = false;
    sock_t s = (sock_t)fd_;
    if (s == BAD_SOCK) return false;
    fd_set r;
    FD_ZERO(&r);
    FD_SET(s, &r);
    timeval tv{timeoutMs / 1000, (timeoutMs % 1000) * 1000};
    int sel = select((int)s + 1, &r, nullptr, nullptr, &tv);
    if (sel == 0) {
        timedOut = true;
        return true;
    }
    if (sel < 0) return false;
    if (pos_ > 0 && pos_ == buf_.size()) {
        buf_.clear();
        pos_ = 0;
    } else if (pos_ > (1u << 20)) {
        buf_.erase(buf_.begin(), buf_.begin() + (long)pos_);
        pos_ = 0;
    }
    size_t old = buf_.size();
    buf_.resize(old + 256 * 1024);
    int k = recv(s, (char*)buf_.data() + old, 256 * 1024, 0);
    if (k <= 0) {
        buf_.resize(old);
        return false;
    }
    buf_.resize(old + (size_t)k);
    return true;
}

bool WebSocket::sendFrame(int opcode, const uint8_t* data, size_t len) {
    sock_t s = (sock_t)fd_;
    if (s == BAD_SOCK || len > 125) return false;
    uint8_t f[2 + 4 + 125];
    f[0] = (uint8_t)(0x80 | opcode);
    f[1] = (uint8_t)(0x80 | len); // clients must mask
    uint8_t mask[4] = {0x12, 0x34, 0x56, 0x78};
    memcpy(f + 2, mask, 4);
    for (size_t i = 0; i < len; i++) f[6 + i] = data[i] ^ mask[i & 3];
    return sendAll(s, (const char*)f, 6 + len);
}

WebSocket::Kind WebSocket::next(std::vector<uint8_t>& payload, int timeoutMs) {
    int64_t deadline = nowUs() + (int64_t)timeoutMs * 1000;
    std::vector<uint8_t> assembled;
    int firstOp = -1;
    while (true) {
        // A whole frame waiting?
        size_t avail = buf_.size() - pos_;
        if (avail >= 2) {
            const uint8_t* p = buf_.data() + pos_;
            bool fin = (p[0] & 0x80) != 0;
            int op = p[0] & 0x0F;
            bool masked = (p[1] & 0x80) != 0;
            uint64_t len = p[1] & 0x7F;
            size_t hdr = 2;
            if (len == 126) {
                if (avail < 4) goto more;
                len = (uint64_t)p[2] << 8 | p[3];
                hdr = 4;
            } else if (len == 127) {
                if (avail < 10) goto more;
                len = 0;
                for (int i = 0; i < 8; i++) len = len << 8 | p[2 + i];
                hdr = 10;
            }
            if (masked) hdr += 4;
            if (len > (64u << 20)) return CLOSED; // nonsense
            if (avail < hdr + len) goto more;
            const uint8_t* body = p + hdr;
            std::vector<uint8_t> data(body, body + len);
            if (masked) {
                const uint8_t* m = p + hdr - 4;
                for (size_t i = 0; i < data.size(); i++) data[i] ^= m[i & 3];
            }
            pos_ += hdr + (size_t)len;
            if (op == 0x9) { // ping
                sendFrame(0xA, data.data(), std::min<size_t>(data.size(), 125));
                continue;
            }
            if (op == 0xA) continue; // pong
            if (op == 0x8) return CLOSED;
            if (op == 0x0 && firstOp >= 0) {
                assembled.insert(assembled.end(), data.begin(), data.end());
            } else if (op == 0x1 || op == 0x2) {
                firstOp = op;
                assembled = std::move(data);
            } else {
                continue;
            }
            if (!fin) continue;
            payload = std::move(assembled);
            return firstOp == 0x1 ? TEXT : BINARY;
        }
    more:
        int64_t left = (deadline - nowUs()) / 1000;
        if (left <= 0) return TIMEOUT;
        bool timedOut = false;
        if (!readMore((int)std::min<int64_t>(left, 1000), timedOut)) return CLOSED;
        (void)timedOut;
    }
}

void WebSocket::close() {
    sock_t s = (sock_t)fd_;
    if (s == BAD_SOCK) return;
#ifdef _WIN32
    shutdown(s, SD_BOTH);
#else
    shutdown(s, SHUT_RDWR);
#endif
}

}  // namespace net
