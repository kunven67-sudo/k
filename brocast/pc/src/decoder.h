// BroCast PC (Windows): H.264 decoding with Windows' own decoder (Media Foundation). With the
// Direct3D device it decodes on the graphics card (DXVA), otherwise on the CPU.
#pragma once

#include <windows.h>
#include <d3d11.h>
#include <mfapi.h>
#include <mftransform.h>

#include <cstdint>
#include <functional>

struct DecodedPicture {
    ID3D11Texture2D* texture = nullptr;  // decoded on the graphics card
    UINT subresource = 0;
    const uint8_t* data = nullptr;       // decoded on the CPU: NV12, Y rows then UV rows
    int pitch = 0;
    size_t uvOffset = 0;
    int width = 0, height = 0;           // the picture (without encoder padding)
    int64_t time100ns = 0;
};

class Decoder {
public:
    ~Decoder() { close(); }
    /** [device] null = decode on the CPU. [width]/[height]: the picture size from the SPS. */
    bool open(ID3D11Device* device, int width, int height);
    void close();
    bool isOpen() const { return mft_ != nullptr; }
    bool onGraphicsCard() const { return manager_ != nullptr; }

    /** One Annex B frame in; finished pictures come out through [onPicture] (valid during the call only). */
    bool decode(const uint8_t* data, size_t n, int64_t time100ns, bool keyFrame,
                const std::function<void(const DecodedPicture&)>& onPicture);

private:
    IMFTransform* mft_ = nullptr;
    IMFDXGIDeviceManager* manager_ = nullptr;
    UINT token_ = 0;
    int width_ = 0, height_ = 0, outW_ = 0, outH_ = 0;
    LONG stride_ = 0;
    bool providesSamples_ = false;
    DWORD outSize_ = 0;
    bool pickOutputType();
    bool drain(const std::function<void(const DecodedPicture&)>& onPicture);
};
