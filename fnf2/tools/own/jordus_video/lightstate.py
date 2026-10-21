"""How lit the stage is on a video frame (0 = normal, 1 = the beat flash), measured on the floor / sky (light.json)."""
import json, numpy as np
_L = json.load(open('/tmp/claude-0/nf/light.json'))
_fl = {r['f']: float(np.mean(r['floor'])) for r in _L if 'floor' in r}; _sk = {r['f']: float(np.mean(r['sky'])) for r in _L if 'sky' in r}
def light(f):
    for d in (0, -1, 1, -2, 2):
        if f + d in _fl: return float(np.clip((_fl[f + d] - 154) / (212 - 154), 0, 1))
    for d in (0, -1, 1, -2, 2):
        if f + d in _sk: return float(np.clip((_sk[f + d] - 118) / (162 - 118), 0, 1))
    # unknown: by the beat (flash parts: beats 48-63 + 128-191; on for 0.2 s, fades by 0.33 s)
    T = f / 30 - 0.048 + 0.085; b = int(T // 0.48); t = T - b * 0.48
    if not ((48 <= b <= 63) or (128 <= b <= 191)): return 0.0
    return 1.0 if t < 0.2 else max(0.0, 1 - (t - 0.2) / 0.13)
