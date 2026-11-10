// BroCast PC (Windows): Media Foundation H.264 decoder. See decoder.h.
#include "decoder.h"

#include <mferror.h>
#include <mfidl.h>

#include "log.h"

#define SAFE_RELEASE(p) do { if (p) { (p)->Release(); (p) = nullptr; } } while (0)

// Written out here so nothing depends on which SDK headers define them.
static const GUID kH264Decoder = {0x62CE7E72, 0x4C71, 0x4D20, {0xB1, 0x5D, 0x45, 0x28, 0x31, 0xA8, 0x7D, 0x9D}};
static const GUID kLowLatency = {0x9C27891A, 0xED7A, 0x40E1, {0x88, 0xE8, 0xB2, 0x27, 0x27, 0xA0, 0x24, 0xEE}};
static const GUID kD3D11Aware = {0x206B4FC8, 0xFCF9, 0x4C51, {0xAF, 0xE3, 0x97, 0x64, 0x36, 0x9E, 0x33, 0xA0}};
static const GUID kIMFTransform = {0xbf94c121, 0x5b05, 0x4e6f, {0x80, 0x00, 0xba, 0x59, 0x89, 0x61, 0x41, 0x4d}};
static const GUID kIMFDXGIBuffer = {0xe7174cfa, 0x1c9e, 0x48b1, {0x88, 0x66, 0x62, 0x62, 0x26, 0xbf, 0xc2, 0x58}};
static const GUID kIMF2DBuffer = {0x7dc9d5f9, 0x9ed9, 0x44ec, {0x9b, 0xbf, 0x06, 0x00, 0xbb, 0x58, 0x9f, 0xbb}};
static const GUID kID3D11Texture2D = {0x6f15aaf2, 0xd208, 0x4e89, {0x9a, 0xb4, 0x48, 0x95, 0x35, 0xd3, 0x4f, 0x9c}};

static bool g_mfStarted = false;

void Decoder::close() {
    if (mft_) {
        mft_->ProcessMessage(MFT_MESSAGE_NOTIFY_END_OF_STREAM, 0);
        mft_->ProcessMessage(MFT_MESSAGE_COMMAND_FLUSH, 0);
        if (manager_) mft_->ProcessMessage(MFT_MESSAGE_SET_D3D_MANAGER, 0);
    }
    SAFE_RELEASE(mft_);
    SAFE_RELEASE(manager_);
}

bool Decoder::open(ID3D11Device* device, int width, int height) {
    close();
    if (!g_mfStarted) {
        if (FAILED(MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET))) {
            logf("MFStartup failed");
            return false;
        }
        g_mfStarted = true;
    }
    width_ = width;
    height_ = height;
    HRESULT hr = CoCreateInstance(kH264Decoder, nullptr, CLSCTX_INPROC_SERVER, kIMFTransform, (void**)&mft_);
    if (FAILED(hr)) {
        logf("no H.264 decoder in Windows (%08lx)", (unsigned long)hr);
        return false;
    }
    IMFAttributes* attr = nullptr;
    if (SUCCEEDED(mft_->GetAttributes(&attr)) && attr) {
        // Hand each picture out as soon as it's decoded (no waiting to reorder: the phone never sends B-frames).
        attr->SetUINT32(kLowLatency, TRUE);
        UINT32 aware = 0;
        if (device && SUCCEEDED(attr->GetUINT32(kD3D11Aware, &aware)) && aware) {
            if (SUCCEEDED(MFCreateDXGIDeviceManager(&token_, &manager_)) && SUCCEEDED(manager_->ResetDevice(device, token_)) &&
                SUCCEEDED(mft_->ProcessMessage(MFT_MESSAGE_SET_D3D_MANAGER, (ULONG_PTR)manager_))) {
                logf("decoding on the graphics card");
            } else {
                SAFE_RELEASE(manager_);
                logf("graphics card decoding not available: on the CPU");
            }
        }
        attr->Release();
    }
    IMFMediaType* in = nullptr;
    MFCreateMediaType(&in);
    in->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    in->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
    MFSetAttributeSize(in, MF_MT_FRAME_SIZE, (UINT32)width, (UINT32)height);
    MFSetAttributeRatio(in, MF_MT_FRAME_RATE, 30, 1);
    in->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    hr = mft_->SetInputType(0, in, 0);
    in->Release();
    if (FAILED(hr)) {
        logf("decoder refused H.264 %dx%d (%08lx)", width, height, (unsigned long)hr);
        close();
        return false;
    }
    if (!pickOutputType()) {
        close();
        return false;
    }
    mft_->ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0);
    mft_->ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0);
    logf("decoder open: %dx%d (%s)", width, height, manager_ ? "graphics card" : "CPU");
    return true;
}

bool Decoder::pickOutputType() {
    for (DWORD i = 0;; i++) {
        IMFMediaType* t = nullptr;
        if (FAILED(mft_->GetOutputAvailableType(0, i, &t))) break;
        GUID sub{};
        t->GetGUID(MF_MT_SUBTYPE, &sub);
        if (sub == MFVideoFormat_NV12 && SUCCEEDED(mft_->SetOutputType(0, t, 0))) {
            UINT32 w = 0, h = 0;
            MFGetAttributeSize(t, MF_MT_FRAME_SIZE, &w, &h);
            outW_ = (int)w;
            outH_ = (int)h;
            UINT32 stride = 0;
            stride_ = SUCCEEDED(t->GetUINT32(MF_MT_DEFAULT_STRIDE, &stride)) ? (LONG)(int32_t)stride : (LONG)w;
            t->Release();
            MFT_OUTPUT_STREAM_INFO info{};
            mft_->GetOutputStreamInfo(0, &info);
            providesSamples_ = (info.dwFlags & (MFT_OUTPUT_STREAM_PROVIDES_SAMPLES | MFT_OUTPUT_STREAM_CAN_PROVIDE_SAMPLES)) != 0;
            outSize_ = info.cbSize;
            return true;
        }
        t->Release();
    }
    logf("decoder has no NV12 output");
    return false;
}

bool Decoder::decode(const uint8_t* data, size_t n, int64_t time100ns, bool keyFrame,
                     const std::function<void(const DecodedPicture&)>& onPicture) {
    if (!mft_) return false;
    IMFMediaBuffer* buf = nullptr;
    if (FAILED(MFCreateMemoryBuffer((DWORD)n, &buf))) return false;
    BYTE* p = nullptr;
    if (SUCCEEDED(buf->Lock(&p, nullptr, nullptr))) {
        memcpy(p, data, n);
        buf->Unlock();
    }
    buf->SetCurrentLength((DWORD)n);
    IMFSample* s = nullptr;
    MFCreateSample(&s);
    s->AddBuffer(buf);
    s->SetSampleTime(time100ns);
    s->SetSampleDuration(333333);
    if (keyFrame) s->SetUINT32(MFSampleExtension_CleanPoint, TRUE);
    HRESULT hr = mft_->ProcessInput(0, s, 0);
    bool ok = true;
    if (hr == MF_E_NOTACCEPTING) {
        ok = drain(onPicture);
        hr = mft_->ProcessInput(0, s, 0);
    }
    s->Release();
    buf->Release();
    if (FAILED(hr)) {
        logf("decoder input failed %08lx", (unsigned long)hr);
        return false;
    }
    return drain(onPicture) && ok;
}

bool Decoder::drain(const std::function<void(const DecodedPicture&)>& onPicture) {
    for (int guard = 0; guard < 16; guard++) {
        MFT_OUTPUT_DATA_BUFFER ob{};
        IMFSample* own = nullptr;
        if (!providesSamples_) {
            IMFMediaBuffer* mb = nullptr;
            DWORD size = outSize_ ? outSize_ : (DWORD)(outW_ * outH_ * 3 / 2);
            if (FAILED(MFCreateMemoryBuffer(size, &mb))) return false;
            MFCreateSample(&own);
            own->AddBuffer(mb);
            mb->Release();
            ob.pSample = own;
        }
        DWORD status = 0;
        HRESULT hr = mft_->ProcessOutput(0, 1, &ob, &status);
        SAFE_RELEASE(ob.pEvents);
        if (hr == MF_E_TRANSFORM_NEED_MORE_INPUT) {
            SAFE_RELEASE(own);
            return true;
        }
        if (hr == MF_E_TRANSFORM_STREAM_CHANGE) {
            SAFE_RELEASE(own);
            if (providesSamples_ && ob.pSample) ob.pSample->Release();
            if (!pickOutputType()) return false;
            continue;
        }
        if (FAILED(hr) || !ob.pSample) {
            SAFE_RELEASE(own);
            if (providesSamples_ && ob.pSample) ob.pSample->Release();
            logf("decoder output failed %08lx", (unsigned long)hr);
            return false;
        }
        IMFSample* out = ob.pSample;
        LONGLONG t = 0;
        out->GetSampleTime(&t);
        IMFMediaBuffer* mb = nullptr;
        if (SUCCEEDED(out->GetBufferByIndex(0, &mb)) && mb) {
            DecodedPicture pic;
            pic.width = width_ > 0 && width_ <= outW_ ? width_ : outW_;
            pic.height = height_ > 0 && height_ <= outH_ ? height_ : outH_;
            pic.time100ns = t;
            IMFDXGIBuffer* db = nullptr;
            if (SUCCEEDED(mb->QueryInterface(kIMFDXGIBuffer, (void**)&db)) && db) {
                ID3D11Texture2D* tex = nullptr;
                UINT sub = 0;
                if (SUCCEEDED(db->GetResource(kID3D11Texture2D, (void**)&tex)) && tex) {
                    db->GetSubresourceIndex(&sub);
                    pic.texture = tex;
                    pic.subresource = sub;
                    onPicture(pic);
                    tex->Release();
                }
                db->Release();
            } else {
                IMF2DBuffer* b2 = nullptr;
                BYTE* bits = nullptr;
                LONG pitch = 0;
                if (SUCCEEDED(mb->QueryInterface(kIMF2DBuffer, (void**)&b2)) && b2 && SUCCEEDED(b2->Lock2D(&bits, &pitch))) {
                    pic.data = bits;
                    pic.pitch = (int)pitch;
                    pic.uvOffset = (size_t)pitch * (size_t)outH_;
                    onPicture(pic);
                    b2->Unlock2D();
                } else {
                    DWORD max = 0, cur = 0;
                    if (SUCCEEDED(mb->Lock(&bits, &max, &cur))) {
                        LONG st = stride_ < 0 ? -stride_ : stride_;
                        pic.data = bits;
                        pic.pitch = (int)st;
                        pic.uvOffset = (size_t)st * (size_t)outH_;
                        if (pic.uvOffset + (size_t)st * outH_ / 2 <= cur) onPicture(pic);
                        mb->Unlock();
                    }
                }
                SAFE_RELEASE(b2);
            }
            mb->Release();
        }
        if (own) own->Release();
        else out->Release();
    }
    return true;
}
