// BroCast PC (Windows): Direct3D 11 drawing + the menus' software canvas. See gfx.h.
#include "gfx.h"

#include <d3dcompiler.h>

#include <algorithm>
#include <cmath>
#include <map>

#include "log.h"

#define SAFE_RELEASE(p) do { if (p) { (p)->Release(); (p) = nullptr; } } while (0)

// ID3D10Multithread (lets the decoder thread and the drawing thread share the device safely).
static const GUID IID_D3D10Multithread_ = {0x9B7E4E00, 0x342C, 0x4106, {0xA1, 0x9F, 0x4F, 0x27, 0x04, 0xF6, 0x89, 0xF0}};
struct IMultithread : public IUnknown {
    virtual void STDMETHODCALLTYPE Enter() = 0;
    virtual void STDMETHODCALLTYPE Leave() = 0;
    virtual BOOL STDMETHODCALLTYPE SetMultithreadProtected(BOOL) = 0;
    virtual BOOL STDMETHODCALLTYPE GetMultithreadProtected() = 0;
};

// ---------------------------------------------------------------- canvas

void Canvas::resize(int width, int height) {
    w = std::max(1, width);
    h = std::max(1, height);
    px.assign((size_t)w * h, 0);
}

void Canvas::clear() { std::fill(px.begin(), px.end(), 0u); }

void Canvas::blend(int x, int y, uint32_t rgb, float a) {
    if (x < 0 || y < 0 || x >= w || y >= h || a <= 0.f) return;
    if (a > 1.f) a = 1.f;
    uint32_t& d = px[(size_t)y * w + x];
    float ia = 1.f - a;
    auto ch = [&](int shift, float src) {
        float dv = (float)((d >> shift) & 255);
        return (uint32_t)std::lround(src * a + dv * ia) & 255u;
    };
    uint32_t r = ch(16, (float)((rgb >> 16) & 255)), g = ch(8, (float)((rgb >> 8) & 255)), b = ch(0, (float)(rgb & 255));
    uint32_t al = (uint32_t)std::lround(255.f * a + (float)(d >> 24) * ia) & 255u;
    d = al << 24 | r << 16 | g << 8 | b;
}

void Canvas::roundRect(float x, float y, float rw, float rh, float radius, uint32_t rgb, float alpha) {
    radius = std::min(radius, std::min(rw, rh) / 2);
    int x0 = (int)std::floor(x), y0 = (int)std::floor(y), x1 = (int)std::ceil(x + rw), y1 = (int)std::ceil(y + rh);
    for (int py = std::max(0, y0); py < std::min(h, y1); py++) {
        for (int px_ = std::max(0, x0); px_ < std::min(w, x1); px_++) {
            float cx = px_ + 0.5f, cy = py + 0.5f;
            // Distance to the rounded rectangle's edge (negative inside).
            float qx = std::fabs(cx - (x + rw / 2)) - (rw / 2 - radius);
            float qy = std::fabs(cy - (y + rh / 2)) - (rh / 2 - radius);
            float ox = std::max(qx, 0.f), oy = std::max(qy, 0.f);
            float d = std::sqrt(ox * ox + oy * oy) + std::min(std::max(qx, qy), 0.f) - radius;
            float cov = std::min(1.f, std::max(0.f, 0.5f - d));
            if (cov > 0) blend(px_, py, rgb, cov * alpha);
        }
    }
}

void Canvas::circle(float cx, float cy, float r, uint32_t rgb, float alpha) { roundRect(cx - r, cy - r, 2 * r, 2 * r, r, rgb, alpha); }

namespace {
struct FontCache {
    std::map<int, HFONT> fonts;
    HDC dc = nullptr;
    HFONT get(int size, bool bold) {
        int key = size * 2 + (bold ? 1 : 0);
        auto it = fonts.find(key);
        if (it != fonts.end()) return it->second;
        HFONT f = CreateFontW(-size, 0, 0, 0, bold ? FW_BOLD : FW_SEMIBOLD, 0, 0, 0, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                              CLIP_DEFAULT_PRECIS, ANTIALIASED_QUALITY, DEFAULT_PITCH, L"Segoe UI");
        fonts[key] = f;
        return f;
    }
    HDC hdc() {
        if (!dc) dc = CreateCompatibleDC(nullptr);
        return dc;
    }
};
FontCache g_fonts;
}  // namespace

int Canvas::textWidth(const std::wstring& s, int size, bool bold) {
    HDC dc = g_fonts.hdc();
    HGDIOBJ old = SelectObject(dc, g_fonts.get(size, bold));
    SIZE sz{0, 0};
    GetTextExtentPoint32W(dc, s.c_str(), (int)s.size(), &sz);
    SelectObject(dc, old);
    return sz.cx;
}

int Canvas::text(const std::wstring& s, int x, int y, int size, bool bold, uint32_t rgb, float alpha) {
    if (s.empty()) return 0;
    HDC dc = g_fonts.hdc();
    HFONT font = g_fonts.get(size, bold);
    HGDIOBJ oldFont = SelectObject(dc, font);
    SIZE sz{0, 0};
    GetTextExtentPoint32W(dc, s.c_str(), (int)s.size(), &sz);
    int tw = sz.cx + 4, th = sz.cy + 4;
    // White text on black, grayscale smoothing: how white a pixel is = how much text covers it.
    BITMAPINFO bi{};
    bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bi.bmiHeader.biWidth = tw;
    bi.bmiHeader.biHeight = -th;
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB;
    void* bits = nullptr;
    HBITMAP bmp = CreateDIBSection(dc, &bi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!bmp || !bits) {
        SelectObject(dc, oldFont);
        return sz.cx;
    }
    HGDIOBJ oldBmp = SelectObject(dc, bmp);
    memset(bits, 0, (size_t)tw * th * 4);
    SetBkMode(dc, TRANSPARENT);
    SetTextColor(dc, RGB(255, 255, 255));
    TextOutW(dc, 2, 2, s.c_str(), (int)s.size());
    GdiFlush();
    const uint32_t* src = (const uint32_t*)bits;
    for (int py = 0; py < th; py++) {
        for (int px_ = 0; px_ < tw; px_++) {
            uint32_t v = src[(size_t)py * tw + px_];
            int cov = std::max(std::max((int)(v >> 16) & 255, (int)(v >> 8) & 255), (int)v & 255);
            if (cov) blend(x + px_ - 2, y + py - 2, rgb, cov / 255.f * alpha);
        }
    }
    SelectObject(dc, oldBmp);
    DeleteObject(bmp);
    SelectObject(dc, oldFont);
    return sz.cx;
}

void Canvas::textCentered(const std::wstring& s, int cx, int y, int size, bool bold, uint32_t rgb, float alpha) {
    text(s, cx - textWidth(s, size, bold) / 2, y, size, bold, rgb, alpha);
}

// ---------------------------------------------------------------- Direct3D

static const char* kShaders = R"(
Texture2D<float> ty : register(t0);
Texture2D<float2> tc : register(t1);
Texture2D<float4> to : register(t0);
SamplerState s : register(s0);
cbuffer C : register(b0) { row_major float4x4 m; float4 sc; };
struct O { float4 p : SV_Position; float2 uv : TEXCOORD0; };
O vs(uint id : SV_VertexID) {
    O o;
    float2 t = float2((id << 1) & 2, id & 2);
    o.uv = t;
    o.p = float4(t.x * 2 - 1, 1 - t.y * 2, 0, 1);
    return o;
}
float4 psv(O i) : SV_Target {
    float2 t = i.uv * sc.xy;
    float3 yuv = float3(ty.Sample(s, t), tc.Sample(s, t));
    return float4(saturate(mul(m, float4(yuv, 1)).rgb), 1);
}
float4 pso(O i) : SV_Target { return to.Sample(s, i.uv) * sc.z; }
)";

typedef HRESULT(WINAPI* D3DCompileFn)(LPCVOID, SIZE_T, LPCSTR, const D3D_SHADER_MACRO*, ID3DInclude*, LPCSTR, LPCSTR, UINT,
                                       UINT, ID3DBlob**, ID3DBlob**);

void Gfx::Slot::release() {
    SAFE_RELEASE(nv12Y);
    SAFE_RELEASE(nv12UV);
    SAFE_RELEASE(nv12);
    SAFE_RELEASE(ySrv);
    SAFE_RELEASE(uvSrv);
    SAFE_RELEASE(y);
    SAFE_RELEASE(uv);
    texW = texH = w = h = 0;
}

Gfx::~Gfx() {
    for (auto& s : slots_) s.release();
    SAFE_RELEASE(overlaySrv_);
    SAFE_RELEASE(overlay_);
    SAFE_RELEASE(cb_);
    SAFE_RELEASE(blend_);
    SAFE_RELEASE(sampler_);
    SAFE_RELEASE(psOverlay_);
    SAFE_RELEASE(psVideo_);
    SAFE_RELEASE(vs_);
    SAFE_RELEASE(rtv_);
    SAFE_RELEASE(swap_);
    SAFE_RELEASE(ctx_);
    SAFE_RELEASE(dev_);
}

bool Gfx::compileShaders() {
    HMODULE lib = LoadLibraryW(L"d3dcompiler_47.dll");
    if (!lib) lib = LoadLibraryW(L"d3dcompiler_43.dll");
    if (!lib) {
        logf("no shader compiler (d3dcompiler_47.dll)");
        return false;
    }
    auto compile = (D3DCompileFn)(void*)GetProcAddress(lib, "D3DCompile");
    if (!compile) return false;
    auto build = [&](const char* entry, const char* target, ID3DBlob** out) {
        ID3DBlob* err = nullptr;
        HRESULT hr = compile(kShaders, strlen(kShaders), "brocast", nullptr, nullptr, entry, target, D3DCOMPILE_OPTIMIZATION_LEVEL3, 0, out, &err);
        if (FAILED(hr)) logf("shader %s failed: %s", entry, err ? (const char*)err->GetBufferPointer() : "?");
        SAFE_RELEASE(err);
        return SUCCEEDED(hr);
    };
    ID3DBlob *v = nullptr, *pv = nullptr, *po = nullptr;
    bool ok = build("vs", "vs_4_0", &v) && build("psv", "ps_4_0", &pv) && build("pso", "ps_4_0", &po) &&
              SUCCEEDED(dev_->CreateVertexShader(v->GetBufferPointer(), v->GetBufferSize(), nullptr, &vs_)) &&
              SUCCEEDED(dev_->CreatePixelShader(pv->GetBufferPointer(), pv->GetBufferSize(), nullptr, &psVideo_)) &&
              SUCCEEDED(dev_->CreatePixelShader(po->GetBufferPointer(), po->GetBufferSize(), nullptr, &psOverlay_));
    SAFE_RELEASE(v);
    SAFE_RELEASE(pv);
    SAFE_RELEASE(po);
    return ok;
}

bool Gfx::init(HWND hwnd) {
    hwnd_ = hwnd;
    D3D_FEATURE_LEVEL levels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_10_0};
    UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_VIDEO_SUPPORT;
    HRESULT hr = E_FAIL;
    for (int attempt = 0; attempt < 4 && FAILED(hr); attempt++) {
        D3D_DRIVER_TYPE type = attempt < 2 ? D3D_DRIVER_TYPE_HARDWARE : D3D_DRIVER_TYPE_WARP;
        UINT f = (attempt % 2 == 0) ? flags : (UINT)D3D11_CREATE_DEVICE_BGRA_SUPPORT;
        int first = 0;
        hr = D3D11CreateDevice(nullptr, type, nullptr, f, levels + first, 4 - first, D3D11_SDK_VERSION, &dev_, nullptr, &ctx_);
        if (FAILED(hr)) hr = D3D11CreateDevice(nullptr, type, nullptr, f, levels + 1, 3, D3D11_SDK_VERSION, &dev_, nullptr, &ctx_);
        if (SUCCEEDED(hr)) logf("Direct3D device: %s, flags %x, level %x", attempt < 2 ? "hardware" : "WARP (software)", f, dev_->GetFeatureLevel());
    }
    if (FAILED(hr)) {
        logf("D3D11CreateDevice failed %08lx", (unsigned long)hr);
        return false;
    }
    IMultithread* mt = nullptr;
    if (SUCCEEDED(dev_->QueryInterface(IID_D3D10Multithread_, (void**)&mt)) || SUCCEEDED(ctx_->QueryInterface(IID_D3D10Multithread_, (void**)&mt))) {
        mt->SetMultithreadProtected(TRUE);
        mt->Release();
    } else {
        logf("no multithread protection on this device");
    }

    IDXGIDevice* dxgiDev = nullptr;
    IDXGIAdapter* adapter = nullptr;
    IDXGIFactory* factory = nullptr;
    dev_->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDev);
    if (dxgiDev) dxgiDev->GetAdapter(&adapter);
    if (adapter) {
        adapter->GetParent(__uuidof(IDXGIFactory), (void**)&factory);
        DXGI_ADAPTER_DESC ad;
        if (SUCCEEDED(adapter->GetDesc(&ad))) logf("graphics card: %ls", ad.Description);
    }
    if (!factory) return false;
    RECT rc;
    GetClientRect(hwnd, &rc);
    width_ = std::max(1L, rc.right - rc.left);
    height_ = std::max(1L, rc.bottom - rc.top);
    // Flip model (Windows 10): less delay and less work for the PC. Older: the classic way.
    IDXGIFactory2* f2 = nullptr;
    if (SUCCEEDED(factory->QueryInterface(__uuidof(IDXGIFactory2), (void**)&f2))) {
        DXGI_SWAP_CHAIN_DESC1 d{};
        d.Width = (UINT)width_;
        d.Height = (UINT)height_;
        d.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        d.SampleDesc.Count = 1;
        d.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
        d.BufferCount = 2;
        d.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
        IDXGISwapChain1* sc1 = nullptr;
        if (SUCCEEDED(f2->CreateSwapChainForHwnd(dev_, hwnd, &d, nullptr, nullptr, &sc1))) {
            swap_ = sc1;
            flipModel_ = true;
        }
        f2->Release();
    }
    if (!swap_) {
        DXGI_SWAP_CHAIN_DESC d{};
        d.BufferDesc.Width = (UINT)width_;
        d.BufferDesc.Height = (UINT)height_;
        d.BufferDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        d.SampleDesc.Count = 1;
        d.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
        d.BufferCount = 1;
        d.OutputWindow = hwnd;
        d.Windowed = TRUE;
        d.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;
        if (FAILED(factory->CreateSwapChain(dev_, &d, &swap_))) swap_ = nullptr;
    }
    if (swap_) factory->MakeWindowAssociation(hwnd, DXGI_MWA_NO_ALT_ENTER);
    SAFE_RELEASE(factory);
    SAFE_RELEASE(adapter);
    SAFE_RELEASE(dxgiDev);
    if (!swap_) {
        logf("no swap chain");
        return false;
    }
    logf("swap chain: %s", flipModel_ ? "flip" : "classic");
    if (!createTargets() || !compileShaders()) return false;

    D3D11_SAMPLER_DESC sd{};
    sd.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sd.AddressU = sd.AddressV = sd.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    sd.MaxLOD = D3D11_FLOAT32_MAX;
    dev_->CreateSamplerState(&sd, &sampler_);
    D3D11_BLEND_DESC bd{};
    bd.RenderTarget[0].BlendEnable = TRUE;
    bd.RenderTarget[0].SrcBlend = D3D11_BLEND_ONE;
    bd.RenderTarget[0].DestBlend = D3D11_BLEND_INV_SRC_ALPHA;
    bd.RenderTarget[0].BlendOp = D3D11_BLEND_OP_ADD;
    bd.RenderTarget[0].SrcBlendAlpha = D3D11_BLEND_ONE;
    bd.RenderTarget[0].DestBlendAlpha = D3D11_BLEND_INV_SRC_ALPHA;
    bd.RenderTarget[0].BlendOpAlpha = D3D11_BLEND_OP_ADD;
    bd.RenderTarget[0].RenderTargetWriteMask = D3D11_COLOR_WRITE_ENABLE_ALL;
    dev_->CreateBlendState(&bd, &blend_);
    D3D11_BUFFER_DESC cbd{};
    cbd.ByteWidth = 80;
    cbd.Usage = D3D11_USAGE_DEFAULT;
    cbd.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
    dev_->CreateBuffer(&cbd, nullptr, &cb_);
    setColors(true, false);
    return sampler_ && blend_ && cb_;
}

bool Gfx::createTargets() {
    SAFE_RELEASE(rtv_);
    ID3D11Texture2D* back = nullptr;
    if (FAILED(swap_->GetBuffer(0, __uuidof(ID3D11Texture2D), (void**)&back))) return false;
    HRESULT hr = dev_->CreateRenderTargetView(back, nullptr, &rtv_);
    back->Release();
    return SUCCEEDED(hr);
}

void Gfx::resize() {
    if (!swap_) return;
    RECT rc;
    GetClientRect(hwnd_, &rc);
    int w = rc.right - rc.left, h = rc.bottom - rc.top;
    if (w <= 0 || h <= 0 || (w == width_ && h == height_)) return;
    width_ = w;
    height_ = h;
    ctx_->OMSetRenderTargets(0, nullptr, nullptr);
    SAFE_RELEASE(rtv_);
    ctx_->Flush();
    HRESULT hr = swap_->ResizeBuffers(0, (UINT)w, (UINT)h, DXGI_FORMAT_UNKNOWN, 0);
    if (FAILED(hr)) logf("ResizeBuffers failed %08lx", (unsigned long)hr);
    createTargets();
}

void Gfx::setColors(bool bt709, bool fullRange) {
    float kr = bt709 ? 1.5748f : 1.402f, kgu = bt709 ? 0.1873f : 0.344136f, kgv = bt709 ? 0.4681f : 0.714136f,
          kb = bt709 ? 1.8556f : 1.772f;
    float ys = fullRange ? 1.f : 255.f / 219.f, yo = fullRange ? 0.f : -16.f / 255.f * ys;
    float cs = fullRange ? 1.f : 255.f / 224.f, co = -128.f / 255.f * cs;
    float m[16] = {
        ys, 0, kr * cs, yo + kr * co,
        ys, -kgu * cs, -kgv * cs, yo - kgu * co - kgv * co,
        ys, kb * cs, 0, yo + kb * co,
        0, 0, 0, 1,
    };
    EnterCriticalSection(&colorLock_);
    memcpy(matrix_, m, sizeof m);
    LeaveCriticalSection(&colorLock_);
}

bool Gfx::putHardware(int slot, ID3D11Texture2D* src, UINT sub, int width, int height) {
    Slot& s = slots_[slot];
    D3D11_TEXTURE2D_DESC sd;
    src->GetDesc(&sd);
    if (!s.hw || !s.nv12 || s.texW != (int)sd.Width || s.texH != (int)sd.Height) {
        s.release();
        D3D11_TEXTURE2D_DESC d{};
        d.Width = sd.Width;
        d.Height = sd.Height;
        d.MipLevels = 1;
        d.ArraySize = 1;
        d.Format = DXGI_FORMAT_NV12;
        d.SampleDesc.Count = 1;
        d.Usage = D3D11_USAGE_DEFAULT;
        d.BindFlags = D3D11_BIND_SHADER_RESOURCE;
        if (FAILED(dev_->CreateTexture2D(&d, nullptr, &s.nv12))) {
            nv12Ok_ = false;
            return false;
        }
        D3D11_SHADER_RESOURCE_VIEW_DESC v{};
        v.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
        v.Texture2D.MipLevels = 1;
        v.Format = DXGI_FORMAT_R8_UNORM;
        HRESULT a = dev_->CreateShaderResourceView(s.nv12, &v, &s.nv12Y);
        v.Format = DXGI_FORMAT_R8G8_UNORM;
        HRESULT b = dev_->CreateShaderResourceView(s.nv12, &v, &s.nv12UV);
        if (FAILED(a) || FAILED(b)) {
            logf("NV12 views not supported here (%08lx %08lx)", (unsigned long)a, (unsigned long)b);
            s.release();
            nv12Ok_ = false;
            return false;
        }
        s.hw = true;
        s.texW = (int)sd.Width;
        s.texH = (int)sd.Height;
    }
    ctx_->CopySubresourceRegion(s.nv12, 0, 0, 0, 0, src, sub, nullptr);
    s.w = width;
    s.h = height;
    return true;
}

bool Gfx::putSoftware(int slot, const uint8_t* nv12, int pitch, size_t uvOffset, int width, int height) {
    Slot& s = slots_[slot];
    int w = (width + 1) & ~1, h = (height + 1) & ~1;
    if (s.hw || !s.y || s.texW != w || s.texH != h) {
        s.release();
        D3D11_TEXTURE2D_DESC d{};
        d.Width = (UINT)w;
        d.Height = (UINT)h;
        d.MipLevels = 1;
        d.ArraySize = 1;
        d.Format = DXGI_FORMAT_R8_UNORM;
        d.SampleDesc.Count = 1;
        d.Usage = D3D11_USAGE_DEFAULT;
        d.BindFlags = D3D11_BIND_SHADER_RESOURCE;
        if (FAILED(dev_->CreateTexture2D(&d, nullptr, &s.y))) return false;
        d.Width = (UINT)w / 2;
        d.Height = (UINT)h / 2;
        d.Format = DXGI_FORMAT_R8G8_UNORM;
        if (FAILED(dev_->CreateTexture2D(&d, nullptr, &s.uv))) return false;
        dev_->CreateShaderResourceView(s.y, nullptr, &s.ySrv);
        dev_->CreateShaderResourceView(s.uv, nullptr, &s.uvSrv);
        s.hw = false;
        s.texW = w;
        s.texH = h;
    }
    ctx_->UpdateSubresource(s.y, 0, nullptr, nv12, (UINT)pitch, 0);
    ctx_->UpdateSubresource(s.uv, 0, nullptr, nv12 + uvOffset, (UINT)pitch, 0);
    s.w = width;
    s.h = height;
    return true;
}

void Gfx::setOverlay(const Canvas& c) {
    if (!overlay_ || overlayW_ != c.w || overlayH_ != c.h) {
        SAFE_RELEASE(overlaySrv_);
        SAFE_RELEASE(overlay_);
        D3D11_TEXTURE2D_DESC d{};
        d.Width = (UINT)c.w;
        d.Height = (UINT)c.h;
        d.MipLevels = 1;
        d.ArraySize = 1;
        d.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        d.SampleDesc.Count = 1;
        d.Usage = D3D11_USAGE_DEFAULT;
        d.BindFlags = D3D11_BIND_SHADER_RESOURCE;
        if (FAILED(dev_->CreateTexture2D(&d, nullptr, &overlay_))) return;
        dev_->CreateShaderResourceView(overlay_, nullptr, &overlaySrv_);
        overlayW_ = c.w;
        overlayH_ = c.h;
    }
    ctx_->UpdateSubresource(overlay_, 0, nullptr, c.px.data(), (UINT)c.w * 4, 0);
}

void Gfx::draw(int slot, float overlayAlpha) {
    if (!rtv_ || width_ <= 0 || height_ <= 0) return;
    bool video = slot >= 0 && slot < SLOTS && slots_[slot].w > 0;
    // Black bars around the video; BroCast's dark blue behind the menus.
    float bg[4] = {video ? 0.f : 0x0B / 255.f, video ? 0.f : 0x0F / 255.f, video ? 0.f : 0x1A / 255.f, 1.f};
    ctx_->OMSetRenderTargets(1, &rtv_, nullptr);
    ctx_->ClearRenderTargetView(rtv_, bg);
    ctx_->IASetInputLayout(nullptr);
    ctx_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    ctx_->VSSetShader(vs_, nullptr, 0);
    ctx_->PSSetSamplers(0, 1, &sampler_);
    ctx_->PSSetConstantBuffers(0, 1, &cb_);
    struct { float m[16]; float sc[4]; } cb;
    EnterCriticalSection(&colorLock_);
    memcpy(cb.m, matrix_, sizeof cb.m);
    LeaveCriticalSection(&colorLock_);
    if (video) {
        Slot& s = slots_[slot];
        // Keep the shape: as big as fits, centered.
        float scale = std::min((float)width_ / s.w, (float)height_ / s.h);
        float vw = s.w * scale, vh = s.h * scale;
        D3D11_VIEWPORT vp{(width_ - vw) / 2, (height_ - vh) / 2, vw, vh, 0, 1};
        ctx_->RSSetViewports(1, &vp);
        cb.sc[0] = (float)s.w / s.texW;
        cb.sc[1] = (float)s.h / s.texH;
        cb.sc[2] = 1;
        cb.sc[3] = 0;
        ctx_->UpdateSubresource(cb_, 0, nullptr, &cb, 0, 0);
        ID3D11ShaderResourceView* srvs[2] = {s.hw ? s.nv12Y : s.ySrv, s.hw ? s.nv12UV : s.uvSrv};
        ctx_->PSSetShaderResources(0, 2, srvs);
        ctx_->OMSetBlendState(nullptr, nullptr, 0xffffffff);
        ctx_->PSSetShader(psVideo_, nullptr, 0);
        ctx_->Draw(3, 0);
        ID3D11ShaderResourceView* none[2] = {nullptr, nullptr};
        ctx_->PSSetShaderResources(0, 2, none);
    }
    if (overlayAlpha > 0.01f && overlaySrv_) {
        D3D11_VIEWPORT vp{0, 0, (float)width_, (float)height_, 0, 1};
        ctx_->RSSetViewports(1, &vp);
        cb.sc[0] = cb.sc[1] = 1;
        cb.sc[2] = overlayAlpha;
        cb.sc[3] = 0;
        ctx_->UpdateSubresource(cb_, 0, nullptr, &cb, 0, 0);
        ctx_->PSSetShaderResources(0, 1, &overlaySrv_);
        float f[4] = {0, 0, 0, 0};
        ctx_->OMSetBlendState(blend_, f, 0xffffffff);
        ctx_->PSSetShader(psOverlay_, nullptr, 0);
        ctx_->Draw(3, 0);
        ID3D11ShaderResourceView* none = nullptr;
        ctx_->PSSetShaderResources(0, 1, &none);
    }
    HRESULT hr = swap_->Present(1, 0);
    if (hr == DXGI_ERROR_DEVICE_REMOVED || hr == DXGI_ERROR_DEVICE_RESET) logf("graphics device lost (%08lx)", (unsigned long)hr);
}
