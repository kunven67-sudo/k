"""Fix the stage where nobody ever saw it (stage_ref.png, reference px): behind the player the painted-in smear
(+ her ghost legs + junk at the bottom) gets rebuilt from the stage's own lines: black above the floor line, the
floor, the pink ramp coming in from the right (ending behind her), the blue wall over it; behind the opponent three
little ghost marks of her shoes get painted out.  -> stage_ref_fixed.png, then the upscaler -> stage/stage.png"""
import cv2, numpy as np, json, os, sys
os.chdir('/tmp/claude-0/nf'); sys.path.insert(0, 'tools')
s = cv2.imread('stage_ref.png'); CX0, CY0 = -123, 42
H, W = s.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; X = xx + CX0; Y = yy + CY0          # reference coords of every pixel
o = s.astype(np.float32).copy()
# ---- behind the player
R = (X >= 640) & (X <= 905) & (Y >= 292)
yt = 318 + (990 - X) * 0.57          # ramp: top edge (black line)
yb = 411 + (990 - X) * 0.43          # ramp: bottom of the pink
XE = 790                             # where the ramp ends (behind her)
HOR = 337.5                          # floor line (black above)
def col(x, y): return s[int(y) - CY0, int(x) - CX0].astype(np.float32)
# floor colour per row, from left of the patch (median of x 618-638, skips the tile lines)
floor = {}
for y in range(int(HOR), CY0 + H):
    c = np.median(s[y - CY0, 618 - CX0:638 - CX0].astype(np.float32), 0)
    floor[y] = c
ramp_x = 910                          # the pink, sampled across the band just right of the patch
SLOPE = 0.5                          # the ramp goes down to the left this much per px
for y0 in range(292, CY0 + H):
    for x0 in range(640, 906):
        if not R[y0 - CY0, x0 - CX0]: continue
        top = 318 + (990 - x0) * 0.57
        sy = y0 - (908 - x0) * SLOPE     # the same spot of the ramp, slid back along it to just right of the patch
        if x0 >= XE and 352 <= sy <= 482:
            c = col(908, sy)                                   # the ramp + the dark band under it, copied along
        elif x0 >= XE and sy > 482:
            c = np.array([4, 2, 3], np.float32)
        elif x0 >= 883 and y0 < top:
            c = col(905 + (905 - x0) + 1, y0)                  # the blue wall, mirrored at the patch edge
        elif y0 < HOR:
            c = np.array([0, 0, 0], np.float32)
        else:
            c = floor[y0] if y0 <= 516 else np.array([10, 4, 6], np.float32)
        o[y0 - CY0, x0 - CX0] = c
# soften the new edges a touch (inside the patch only)
bl = cv2.GaussianBlur(o, (3, 3), 0.6)
Rm = cv2.erode(R.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
o[Rm] = bl[Rm]
# ---- behind the opponent: her shoe ghosts on the ramp (reference px)
m = np.zeros((H, W), np.uint8)
for (cx, cy, r) in ((188, 208, 6), (234, 238, 5), (244, 250, 6)):
    cv2.circle(m, (cx - CX0, cy - CY0), r, 1, -1)
o8 = np.clip(o, 0, 255).astype(np.uint8)
o8 = cv2.inpaint(o8, m, 5, cv2.INPAINT_TELEA)
cv2.imwrite('stage_ref_fixed.png', o8)
if '--preview' in sys.argv: sys.exit()
from esrgan import upscale_fast
up = upscale_fast(o8)
st = cv2.resize(up, (W * 2, H * 2), interpolation=cv2.INTER_AREA)
if not os.path.exists('stage/stage_v1.png'): os.rename('stage/stage.png', 'stage/stage_v1.png')
cv2.imwrite('stage/stage.png', st)
print('stage fixed', st.shape)
