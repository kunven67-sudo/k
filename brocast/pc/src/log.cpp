// BroCast PC: log file. See log.h.
#include "log.h"

#include <cstdarg>
#include <cstdio>
#include <ctime>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <shlobj.h>
// (The Windows build's compiler has no std::mutex: Windows' own lock instead.)
struct Lock {
    CRITICAL_SECTION cs;
    Lock() { InitializeCriticalSection(&cs); }
};
static Lock g_mu;
struct Guard {
    Guard() { EnterCriticalSection(&g_mu.cs); }
    ~Guard() { LeaveCriticalSection(&g_mu.cs); }
};
#else
#include <mutex>
static std::mutex g_mu_;
struct Guard {
    std::lock_guard<std::mutex> g{g_mu_};
};
#endif

static FILE* g_log = nullptr;

void logOpen() {
#ifdef _WIN32
    wchar_t* base = nullptr;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &base))) {
        std::wstring dir = std::wstring(base) + L"\\BroCast";
        CoTaskMemFree(base);
        CreateDirectoryW(dir.c_str(), nullptr);
        std::wstring path = dir + L"\\pc.log";
        // Start over when it gets big.
        WIN32_FILE_ATTRIBUTE_DATA fa;
        bool big = GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &fa) && (fa.nFileSizeHigh || fa.nFileSizeLow > 1000000);
        g_log = _wfopen(path.c_str(), big ? L"w" : L"a");
    }
#endif
    logf("---- BroCast PC 3.0 started");
}

void logf(const char* fmt, ...) {
    Guard lock;
    char line[1024];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(line, sizeof line, fmt, ap);
    va_end(ap);
    time_t t = time(nullptr);
    char when[32];
    strftime(when, sizeof when, "%Y-%m-%d %H:%M:%S", localtime(&t));
    FILE* f = g_log ? g_log : stderr;
    fprintf(f, "%s %s\n", when, line);
    fflush(f);
}
