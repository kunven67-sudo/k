"""Where the scrolling arrows are on a video frame (player's notes, from player_chart.json): boxes in video px."""
import json
plr = json.load(open('/tmp/claude-0/nf/player_chart.json'))
SH = 0.048; V = 1110; LX = [636, 728, 821, 914]; SY = 75
def boxes(f, pad=0):
    t = f / 30; out = []
    for p in plr:
        th = p['t'] + SH; sus = p['sus']
        if th + sus < t - 0.3 or th > t + 0.7: continue
        lx = LX[p['lane']]
        y = SY + (th - t) * V
        if th >= t - 0.02:                       # the arrow itself (not hit yet)
            out.append((lx - 46 - pad, y - 46 - pad, lx + 46 + pad, y + 46 + pad, 'note'))
        if sus > 0 and th + sus > t:             # hold trail, from the arrow (or the strum once hit) down to its end
            y0 = max(SY, y); y1 = SY + (th + sus - t) * V
            out.append((lx - 22 - pad, y0 - pad, lx + 22 + pad, y1 + 20 + pad, 'hold'))
        if t - 0.3 <= th < t + 0.02 or (sus > 0 and th <= t <= th + sus + 0.25):   # splash / hold sparks at the strum
            # (right after the hit a streak of the arrow's colour hangs below the strum for a few frames)
            out.append((lx - 80 - pad, SY - 80 - pad, lx + 80 + pad, SY + (210 if t - th < 0.12 else 90) + pad, 'splash'))
    return out
