"""Turn the OVERDRIVE blueprint text file into overdrive/data/blueprint.json.

The blueprint is 50 areas x the same 100 rules ("The <area> system must <rule>").
This script checks that structure strictly and fails loudly if a new blueprint breaks it.
Usage: python build/make_blueprint_data.py path/to/OVERDRIVE_AI_5000_Point_Blueprint.txt
"""
import json
import re
import sys
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding="utf-8")
hdr = re.compile(r"^(.*) \(requirements (\d+)[–-](\d+)\)\s*$")
item = re.compile(r"^(\d+)\.\s+(.*)$")
areas, reqs, sec, cur = [], [], None, None
order_mode = False
for line in src.split("\n"):
    m = hdr.match(line)
    if m:
        sec = {"name": m.group(1).strip(), "first": int(m.group(2)), "last": int(m.group(3))}
        areas.append(sec)
        continue
    if line.strip() == "Implementation order":
        order_mode = True
        if cur:
            reqs.append(cur)
        cur = None
        continue
    if order_mode or sec is None:
        continue
    m = item.match(line)
    if m:
        if cur:
            reqs.append(cur)
        cur = {"n": int(m.group(1)), "area": sec["name"], "text": m.group(2).strip()}
    elif cur and line.startswith(" "):
        cur["text"] += " " + line.strip()
    elif line.strip() and cur:
        reqs.append(cur)
        cur = None
if cur:
    reqs.append(cur)

assert len(areas) == 50, f"expected 50 areas, got {len(areas)}"
assert [r["n"] for r in reqs] == list(range(1, 5001)), "requirements must be numbered 1..5000"
subj = re.compile(r"^The (.+?) system must (.*)$")
rules, subjects = None, {}
for i, a in enumerate(areas):
    chunk = reqs[i * 100:(i + 1) * 100]
    assert chunk[0]["n"] == a["first"] and chunk[-1]["n"] == a["last"], a
    parsed = [subj.match(r["text"]) for r in chunk]
    assert all(parsed), f"area {a['name']}: a line doesn't start with 'The ... system must'"
    subjects[a["name"]] = parsed[0].group(1)
    bodies = [p.group(2) for p in parsed]
    if rules is None:
        rules = bodies
    assert bodies == rules, f"area {a['name']} does not use the same 100 rules in the same order"

out = {
    "source": "OVERDRIVE AI 5,000-Point Development Blueprint",
    "note": "All 50 areas use the same 100 rules in the same order; point N = area[(N-1)//100] x rule[(N-1)%100 + 1].",
    "areas": [{"n": i + 1, "name": a["name"], "subject": subjects[a["name"]], "first": a["first"], "last": a["last"]}
              for i, a in enumerate(areas)],
    "rules": [{"n": i + 1, "text": t} for i, t in enumerate(rules)],
}
dst = Path(__file__).resolve().parent.parent / "overdrive" / "data" / "blueprint.json"
dst.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {dst}: {len(out['areas'])} areas x {len(out['rules'])} rules")
