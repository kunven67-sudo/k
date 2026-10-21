"""Real-ESRGAN (anime 6B) upscaler without basicsr: RRDBNet arch + tiled inference on CPU."""
import torch, torch.nn as nn, torch.nn.functional as F, numpy as np
class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2*gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3*gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4*gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x
class RRDB(nn.Module):
    def __init__(s, nf, gc=32):
        super().__init__(); s.rdb1 = RDB(nf, gc); s.rdb2 = RDB(nf, gc); s.rdb3 = RDB(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class RRDBNet(nn.Module):
    def __init__(s, nb=6, nf=64, gc=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1); s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.lrelu(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.lrelu(s.conv_hr(f)))
_net = None
def net():
    global _net
    if _net is None:
        torch.set_num_threads(4)
        _net = RRDBNet(); sd = torch.load('/tmp/claude-0/models/RealESRGAN_x4plus_anime_6B.pth', map_location='cpu')
        _net.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True); _net.eval()
    return _net
def upscale(bgr, tile=192, pad=10):
    """bgr uint8 HxWx3 -> 4x bgr uint8"""
    img = torch.from_numpy(bgr[:, :, ::-1].astype(np.float32) / 255.).permute(2, 0, 1)[None]
    _, _, H, W = img.shape; out = torch.zeros(1, 3, H*4, W*4)
    with torch.no_grad():
        for y in range(0, H, tile):
            for x in range(0, W, tile):
                y0, x0 = max(0, y - pad), max(0, x - pad); y1, x1 = min(H, y + tile + pad), min(W, x + tile + pad)
                o = net()(img[:, :, y0:y1, x0:x1])
                oy, ox = (y - y0) * 4, (x - x0) * 4; h, w = min(tile, H - y) * 4, min(tile, W - x) * 4
                out[:, :, y*4:y*4+h, x*4:x*4+w] = o[:, :, oy:oy+h, ox:ox+w]
    return (out[0].clamp(0, 1).permute(1, 2, 0).numpy()[:, :, ::-1] * 255).round().astype(np.uint8)

class SRVGG(nn.Module):
    """realesr-animevideov3: small and fast (SRVGGNetCompact, 16 convs, PReLU, pixel shuffle x4)"""
    def __init__(s, nf=64, nc=16, up=4):
        super().__init__()
        s.body = nn.ModuleList([nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(num_parameters=nf)])
        for _ in range(nc): s.body.append(nn.Conv2d(nf, nf, 3, 1, 1)); s.body.append(nn.PReLU(num_parameters=nf))
        s.body.append(nn.Conv2d(nf, 3 * up * up, 3, 1, 1)); s.up = nn.PixelShuffle(up); s.k = up
    def forward(s, x):
        o = x
        for m in s.body: o = m(o)
        return s.up(o) + F.interpolate(x, scale_factor=s.k, mode='nearest')
_fast = None
def upscale_fast(bgr):
    global _fast
    if _fast is None:
        torch.set_num_threads(4)
        _fast = SRVGG(); sd = torch.load('/tmp/claude-0/models/realesr-animevideov3.pth', map_location='cpu')
        _fast.load_state_dict(sd.get('params', sd), strict=True); _fast.eval()
    img = torch.from_numpy(bgr[:, :, ::-1].astype(np.float32) / 255.).permute(2, 0, 1)[None]
    with torch.no_grad(): o = _fast(img)
    return (o[0].clamp(0, 1).permute(1, 2, 0).numpy()[:, :, ::-1] * 255).round().astype(np.uint8)
