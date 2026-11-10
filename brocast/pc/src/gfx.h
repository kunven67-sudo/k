// BroCast PC (Windows): draws the video and the menus with Direct3D 11 (the graphics card does
// the work: color conversion, scaling, blending).
#pragma once

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>

#include <cstdint>
#include <string>
#include <vector>

/** A picture the menus are drawn into (premultiplied BGRA), then shown over the video. */
class Canvas {
public:
    int w = 0, h = 0;
    std::vector<uint32_t> px;

    void resize(int width, int height);
    void clear();
    /** Rounded rectangle, anti-aliased. Color is 0xRRGGBB, alpha 0..1. */
    void roundRect(float x, float y, float rw, float rh, float radius, uint32_t rgb, float alpha);
    void circle(float cx, float cy, float r, uint32_t rgb, float alpha);
    /** Text with its top-left at (x, y). Returns its width. size in pixels. */
    int text(const std::wstring& s, int x, int y, int size, bool bold, uint32_t rgb, float alpha = 1.f);
    int textWidth(const std::wstring& s, int size, bool bold);
    /** Text centered on cx. */
    void textCentered(const std::wstring& s, int cx, int y, int size, bool bold, uint32_t rgb, float alpha = 1.f);

private:
    void blend(int x, int y, uint32_t rgb, float a);
};

class Gfx {
public:
    Gfx() { InitializeCriticalSection(&colorLock_); }
    ~Gfx();
    bool init(HWND hwnd);
    ID3D11Device* device() const { return dev_; }
    /** The window changed size. */
    void resize();

    /** Number of picture slots the decoder can fill while one is on screen. */
    static const int SLOTS = 8;

    /** Hardware decoding: copies the decoder's picture into [slot]. */
    bool putHardware(int slot, ID3D11Texture2D* src, UINT subresource, int width, int height);
    /** Software decoding: uploads an NV12 picture (Y rows, then UV rows at [uvOffset]) into [slot]. */
    bool putSoftware(int slot, const uint8_t* nv12, int pitch, size_t uvOffset, int width, int height);
    /** BT.709 or BT.601, limited or full range (from the video's settings). */
    void setColors(bool bt709, bool fullRange);

    /** The menus picture changed. */
    void setOverlay(const Canvas& c);

    /** Draws [slot] (or nothing, -1) letterboxed, the menus on top at [overlayAlpha], and shows it. */
    void draw(int slot, float overlayAlpha);

    bool hardwareTexturesOk() const { return nv12Ok_; }

private:
    struct Slot {
        ID3D11Texture2D* nv12 = nullptr;  // hardware path
        ID3D11ShaderResourceView* nv12Y = nullptr;
        ID3D11ShaderResourceView* nv12UV = nullptr;
        ID3D11Texture2D* y = nullptr;     // software path
        ID3D11Texture2D* uv = nullptr;
        ID3D11ShaderResourceView* ySrv = nullptr;
        ID3D11ShaderResourceView* uvSrv = nullptr;
        int texW = 0, texH = 0;           // texture size
        int w = 0, h = 0;                 // picture size inside it
        bool hw = false;
        void release();
    };

    HWND hwnd_ = nullptr;
    ID3D11Device* dev_ = nullptr;
    ID3D11DeviceContext* ctx_ = nullptr;
    IDXGISwapChain* swap_ = nullptr;
    bool flipModel_ = false;
    ID3D11RenderTargetView* rtv_ = nullptr;
    ID3D11VertexShader* vs_ = nullptr;
    ID3D11PixelShader* psVideo_ = nullptr;
    ID3D11PixelShader* psOverlay_ = nullptr;
    ID3D11SamplerState* sampler_ = nullptr;
    ID3D11BlendState* blend_ = nullptr;
    ID3D11Buffer* cb_ = nullptr;
    ID3D11Texture2D* overlay_ = nullptr;
    ID3D11ShaderResourceView* overlaySrv_ = nullptr;
    int overlayW_ = 0, overlayH_ = 0;
    int width_ = 0, height_ = 0;
    Slot slots_[SLOTS];
    float matrix_[16];
    CRITICAL_SECTION colorLock_;  // the decoder thread sets colors while this one draws
    bool nv12Ok_ = true;

    bool createTargets();
    bool compileShaders();
};
