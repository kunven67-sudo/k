// BroCast PC: talking to the phone over Wi-Fi (plain sockets, HTTP and WebSocket client).
// Works on Windows (Winsock) and Linux (for the tests).
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace net {

bool init();

/** An IPv4 address + port, like 192.168.1.23:8080. */
struct Addr {
    uint32_t ip = 0;  // host byte order
    uint16_t port = 0;
    bool valid() const { return ip != 0 && port != 0; }
    std::string str() const;
    bool operator==(const Addr& o) const { return ip == o.ip && port == o.port; }
};

/** Reads "192.168.1.23:8080", "192.168.1.23" (port 8080) or with http:// and a trailing slash. */
bool parseAddr(const std::string& text, Addr& out);

struct HttpResult {
    int code = 0;           // 0 = no answer
    std::string body;
    std::string setCookie;  // "name=value" from Set-Cookie, if any
};

/** One GET (the phone answers one request per connection). False if it couldn't connect or got no answer. */
bool httpGet(const Addr& a, const std::string& path, const std::string& cookie, int timeoutMs, HttpResult& out);

/** Tiny JSON readers for the phone's flat status object. */
std::string jsonString(const std::string& json, const char* key);
bool jsonBool(const std::string& json, const char* key, bool fallback = false);
long long jsonNumber(const std::string& json, const char* key, long long fallback = 0);

/** A phone found on the network. */
struct Phone {
    Addr addr;
    std::string name;
    std::string sid;
    bool live = false;
    bool pinRequired = false;
};

/** Asks one address whether a BroCast phone is there. */
bool probe(const Addr& a, int timeoutMs, Phone& out);

/**
 * Looks for BroCast phones on every local network this PC is on (each one's /24 around this PC),
 * on the given ports, all at once. Takes about [timeoutMs].
 */
std::vector<Phone> scanLan(const std::vector<uint16_t>& ports, int timeoutMs);

/** This PC's IPv4 addresses (host byte order), loopback left out. */
std::vector<uint32_t> localAddresses();

/** WebSocket client for the phone's /video and /audio. One reader thread, closed from any thread. */
class WebSocket {
public:
    enum Kind { NONE, TEXT, BINARY, CLOSED, TIMEOUT };

    WebSocket() = default;
    ~WebSocket();
    WebSocket(const WebSocket&) = delete;
    WebSocket& operator=(const WebSocket&) = delete;

    bool open(const Addr& a, const std::string& path, const std::string& cookie, int timeoutMs);

    /** Waits up to [timeoutMs] for the next message. TIMEOUT keeps the connection; CLOSED ends it. */
    Kind next(std::vector<uint8_t>& payload, int timeoutMs);

    /** Closes the connection; a thread blocked in next() returns CLOSED. Safe from any thread. */
    void close();

    bool isOpen() const { return fd_ != kBad; }

private:
    static constexpr intptr_t kBad = -1;
    intptr_t fd_ = kBad;
    std::vector<uint8_t> buf_;
    size_t pos_ = 0;
    bool readMore(int timeoutMs, bool& timedOut);
    bool sendFrame(int opcode, const uint8_t* data, size_t len);
};

/** Microseconds from a steady clock. */
int64_t nowUs();

}  // namespace net
