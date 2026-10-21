"""raw_notes.json (notes.py) + raw_holds.json (holds.py) -> player_chart.json: video time -> audio time (the
picture is 48 ms behind the sound), snapped to the 125 BPM 32nd grid (beat 0 at -0.085 s), holds from whichever
reading saw the trail's end (+0.025 s: the rounded end of a trail is too faint to count)."""
import json
raw = json.load(open('raw_notes.json')); hv = json.load(open('raw_holds.json'))
SHIFT, B0, STEP, CAP = 0.048, -0.085, 0.06, 0.025
out = []
for n, h in zip(raw, hv):
    s1 = h['sus'] + CAP if 0.08 <= h['sus'] <= 3 else 0
    s2 = n['susmax'] + CAP if (n['susmax'] or 0) >= 0.08 else 0
    sus = max(s1, s2); k = round((n['t'] - SHIFT - B0) / STEP)
    out.append(dict(t=round(B0 + k * STEP, 4), k32=k, lane=n['lane'], sus=round(round(sus / STEP) * STEP, 3) if sus >= 0.1 else 0.0))
json.dump(out, open('player_chart.json', 'w'))
