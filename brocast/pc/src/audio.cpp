// BroCast PC (Windows): WASAPI sound output. See audio.h.
#include "audio.h"

#include <audioclient.h>
#include <mmdeviceapi.h>

#include <algorithm>
#include <cmath>

#include "log.h"

#define SAFE_RELEASE(p) do { if (p) { (p)->Release(); (p) = nullptr; } } while (0)

static const GUID kMMDeviceEnumerator = {0xBCDE0395, 0xE52F, 0x467C, {0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E}};
static const GUID kIMMDeviceEnumerator = {0xA95664D2, 0x9614, 0x4F35, {0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6}};
static const GUID kIAudioClient = {0x1CB9AD4C, 0xDBFA, 0x4C32, {0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2}};
static const GUID kIAudioRenderClient = {0xF294ACFC, 0x3146, 0x4483, {0xA7, 0xBF, 0xAD, 0xDC, 0xA7, 0xC2, 0x60, 0xE2}};

#ifndef AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM
#define AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM 0x80000000
#endif
#ifndef AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY
#define AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY 0x08000000
#endif

AudioOut::AudioOut() {
    InitializeCriticalSection(&cs_);
    capacity_ = 48000 * 3;  // up to 3 s waiting
    ring_.assign(capacity_ * 2, 0.f);
}

AudioOut::~AudioOut() {
    stop();
    DeleteCriticalSection(&cs_);
}

void AudioOut::start() {
    if (thread_) return;
    stop_ = 0;
    thread_ = CreateThread(nullptr, 0, threadMain, this, 0, nullptr);
}

void AudioOut::stop() {
    if (!thread_) return;
    InterlockedExchange(&stop_, 1);
    WaitForSingleObject(thread_, 3000);
    CloseHandle(thread_);
    thread_ = nullptr;
}

void AudioOut::setFormat(int rate, int channels) {
    EnterCriticalSection(&cs_);
    if (rate > 0 && channels > 0 && (rate != rate_ || channels != channels_)) {
        rate_ = rate;
        channels_ = channels;
        head_ = count_ = 0;
        priming_ = true;
    }
    LeaveCriticalSection(&cs_);
}

void AudioOut::push(const int16_t* pcm, size_t samples) {
    EnterCriticalSection(&cs_);
    int ch = std::max(1, channels_);
    size_t frames = samples / (size_t)ch;
    for (size_t i = 0; i < frames; i++) {
        float l = pcm[i * ch] / 32768.f;
        float r = ch > 1 ? pcm[i * ch + 1] / 32768.f : l;
        if (count_ == capacity_) {  // full: forget the oldest
            head_ = (head_ + 1) % capacity_;
            count_--;
        }
        size_t at = (head_ + count_) % capacity_;
        ring_[at * 2] = l;
        ring_[at * 2 + 1] = r;
        count_++;
    }
    LeaveCriticalSection(&cs_);
}

void AudioOut::setVideoCushion(double ms) {
    EnterCriticalSection(&cs_);
    cushionMs_ = ms;
    LeaveCriticalSection(&cs_);
}

void AudioOut::setMuted(bool muted) {
    EnterCriticalSection(&cs_);
    muted_ = muted;
    LeaveCriticalSection(&cs_);
}

void AudioOut::clear() {
    EnterCriticalSection(&cs_);
    head_ = count_ = 0;
    frac_ = 0;
    priming_ = true;
    LeaveCriticalSection(&cs_);
}

DWORD WINAPI AudioOut::threadMain(void* self) {
    ((AudioOut*)self)->run();
    return 0;
}

void AudioOut::fill(float* out, uint32_t frames, double deviceQueuedMs) {
    EnterCriticalSection(&cs_);
    double rate = rate_ > 0 ? rate_ : 48000;
    double queuedMs = count_ * 1000.0 / rate + deviceQueuedMs;
    double target = avsync::AudioPacer::target(cushionMs_, deviceLatencyMs_);
    // Way too much waiting (the PC was busy, or the picture got faster): skip ahead to the target.
    if (queuedMs > target + 400) {
        size_t drop = (size_t)((queuedMs - target) * rate / 1000.0);
        drop = std::min(drop, count_);
        head_ = (head_ + drop) % capacity_;
        count_ -= drop;
        queuedMs = count_ * 1000.0 / rate + deviceQueuedMs;
    }
    if (priming_ && queuedMs >= target) priming_ = false;
    double speed = pacer_.speed(queuedMs, target);
    for (uint32_t i = 0; i < frames; i++) {
        float l = 0, r = 0;
        if (!priming_ && count_ >= 2) {
            size_t a = head_, b = (head_ + 1) % capacity_;
            float t = (float)frac_;
            l = ring_[a * 2] + (ring_[b * 2] - ring_[a * 2]) * t;
            r = ring_[a * 2 + 1] + (ring_[b * 2 + 1] - ring_[a * 2 + 1]) * t;
            frac_ += speed;
            while (frac_ >= 1.0 && count_ > 1) {
                frac_ -= 1.0;
                head_ = (head_ + 1) % capacity_;
                count_--;
            }
        } else if (!priming_) {
            priming_ = true;  // ran dry: wait until there's a cushion again
        }
        out[i * 2] = muted_ ? 0.f : l;
        out[i * 2 + 1] = muted_ ? 0.f : r;
    }
    LeaveCriticalSection(&cs_);
}

void AudioOut::run() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    while (!stop_) {
        IMMDeviceEnumerator* en = nullptr;
        IMMDevice* dev = nullptr;
        IAudioClient* client = nullptr;
        IAudioRenderClient* render = nullptr;
        HANDLE ev = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        bool ok = false;
        HRESULT hr = CoCreateInstance(kMMDeviceEnumerator, nullptr, CLSCTX_ALL, kIMMDeviceEnumerator, (void**)&en);
        if (SUCCEEDED(hr)) hr = en->GetDefaultAudioEndpoint(eRender, eConsole, &dev);
        if (SUCCEEDED(hr)) hr = dev->Activate(kIAudioClient, CLSCTX_ALL, nullptr, (void**)&client);
        int rate = 48000;
        EnterCriticalSection(&cs_);
        rate = rate_;
        LeaveCriticalSection(&cs_);
        if (SUCCEEDED(hr)) {
            WAVEFORMATEX f{};
            f.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
            f.nChannels = 2;
            f.nSamplesPerSec = (DWORD)rate;
            f.wBitsPerSample = 32;
            f.nBlockAlign = 8;
            f.nAvgBytesPerSec = f.nSamplesPerSec * 8;
            hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                    AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,
                                    300000 /* 30 ms */, 0, &f, nullptr);
        }
        UINT32 bufFrames = 0;
        if (SUCCEEDED(hr)) hr = client->SetEventHandle(ev);
        if (SUCCEEDED(hr)) hr = client->GetBufferSize(&bufFrames);
        if (SUCCEEDED(hr)) hr = client->GetService(kIAudioRenderClient, (void**)&render);
        if (SUCCEEDED(hr)) {
            REFERENCE_TIME lat = 0;
            client->GetStreamLatency(&lat);
            EnterCriticalSection(&cs_);
            deviceLatencyMs_ = lat / 10000.0;
            deviceRate_ = rate;
            LeaveCriticalSection(&cs_);
            hr = client->Start();
            ok = SUCCEEDED(hr);
            logf("sound out: %d Hz, buffer %u frames, latency %.0f ms", rate, bufFrames, lat / 10000.0);
        } else {
            // (No speakers plugged in, or Windows' audio restarting. Said once, then every 30 tries.)
            static int failures = 0;
            if (failures++ % 30 == 0) logf("sound out failed to start (%08lx), trying again soon", (unsigned long)hr);
        }
        while (ok && !stop_) {
            WaitForSingleObject(ev, 100);
            EnterCriticalSection(&cs_);
            bool formatChanged = rate_ != deviceRate_;
            LeaveCriticalSection(&cs_);
            if (formatChanged) break;
            UINT32 pad = 0;
            hr = client->GetCurrentPadding(&pad);
            if (FAILED(hr)) break;  // e.g. headphones unplugged: start over on the new default device
            UINT32 avail = bufFrames - pad;
            if (!avail) continue;
            BYTE* data = nullptr;
            if (FAILED(render->GetBuffer(avail, &data))) break;
            fill((float*)data, avail, pad * 1000.0 / rate);
            render->ReleaseBuffer(avail, 0);
        }
        if (client) client->Stop();
        SAFE_RELEASE(render);
        SAFE_RELEASE(client);
        SAFE_RELEASE(dev);
        SAFE_RELEASE(en);
        CloseHandle(ev);
        for (int i = 0; i < 10 && !stop_; i++) Sleep(ok ? 20 : 100);
    }
    CoUninitialize();
}
