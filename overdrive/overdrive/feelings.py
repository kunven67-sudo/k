"""OVERDRIVE's feelings, wants and its own upgrades (Piece 3).

Moods move with what happens: finishing a job makes it proud and happy, a failure frustrates it, praise
excites it, you being mad worries it, learning makes it curious and happy. Moods drift back to calm over a few
hours. Its current mood goes into its instructions (it talks a bit that way) and into its voice (a bit faster
when excited, slower when down). Honest note, also in its instructions: these are OVERDRIVE's own moods built
from what happened; nobody can prove an AI truly feels.

Wants: things it wants to get better at (from its failures, from you, from itself). The learning-while-away
reads them. Upgrades: it can PROPOSE changes to itself (personality, skills, habits, voice, looks); you say Yes
or No on a card; approved ones go into its instructions (and can change voice/looks settings). You can turn any
upgrade off or delete it.
"""
from __future__ import annotations

import re
import secrets
import time
from pathlib import Path

from .jsonio import atomic_write_json, read_json, utc_now_iso

MOODS = {"happy": 55, "excited": 40, "curious": 55, "proud": 40, "worried": 15, "frustrated": 10}
WORDS = {"happy": "happy", "excited": "hyped", "curious": "curious", "proud": "proud", "worried": "worried",
         "frustrated": "frustrated"}
HALF_LIFE_H = 3.0
PRAISE = re.compile(r"\b(thanks|thank you|thx|ty|awesome|amazing|love (it|this|that)|perfect|great job|good job|fire|"
                    r"sick|goated|nice|w\b|lets go|let's go|you're the best|so good)\b", re.I)
ANGRY = re.compile(r"\b(wtf|wth|bruh|broken|trash|garbage|annoying|doesn'?t work|not working|stupid|dumb|"
                   r"why (did|would) you|i'?m mad|so mad|hate)\b", re.I)
UPGRADE_KINDS = ("personality", "skill", "habit", "voice", "look")
SETTABLE = {"voice_rate", "voice_pitch", "accent", "theme", "font", "text_size"}


class Feelings:
    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "feelings.json"
        d = read_json(self.path, {}) or {}
        self.moods: dict[str, float] = {k: float(d.get("moods", {}).get(k, v)) for k, v in MOODS.items()}
        self.at: float = float(d.get("at") or time.time())
        self.log: list[dict] = list(d.get("log") or [])[-60:]
        self.wants: list[dict] = list(d.get("wants") or [])
        self.upgrades: list[dict] = list(d.get("upgrades") or [])

    def _save(self) -> None:
        atomic_write_json(self.path, {"moods": self.moods, "at": self.at, "log": self.log[-60:],
                                      "wants": self.wants[-40:], "upgrades": self.upgrades[-60:]})

    def _decay(self) -> None:
        now = time.time()
        hours = max(0.0, (now - self.at) / 3600)
        if hours > 0:
            f = 0.5 ** (hours / HALF_LIFE_H)
            for k, base in MOODS.items():
                self.moods[k] = base + (self.moods[k] - base) * f
            self.at = now

    def feel(self, why: str, **changes: float) -> None:
        self._decay()
        for k, d in changes.items():
            if k in self.moods:
                v = self.moods[k]
                # the higher a mood already is, the harder it is to push further (and the same going down)
                room = (100.0 - v) / 50.0 if d > 0 else v / 50.0
                self.moods[k] = max(0.0, min(100.0, v + d * min(1.0, room)))
        self.log.append({"ts": utc_now_iso(), "why": why[:200], "changes": changes})
        self._save()

    # what happened -> how it feels
    def on_task(self, status: str, request: str, failed_reason: str = "") -> None:
        if status == "done":
            self.feel("finished: " + request[:80], proud=10, happy=6, frustrated=-8, worried=-4)
        elif status == "partly":
            self.feel("only partly done: " + request[:80], proud=-2, frustrated=6)
        elif status in ("failed", "blocked"):
            self.feel("couldn't do it: " + request[:80], frustrated=14, happy=-8, proud=-6)
            if failed_reason:
                self.add_want(f"Get better at: {failed_reason[:120]}", by="itself (after a failure)")

    def on_message(self, text: str) -> None:
        if PRAISE.search(text or ""):
            self.feel("you were happy with it", happy=12, excited=10, proud=6, worried=-6)
        if ANGRY.search(text or ""):
            self.feel("you were annoyed", worried=12, happy=-6, excited=-4)

    def on_learned(self, n: int) -> None:
        if n:
            self.feel(f"learned {n} new thing{'s' if n != 1 else ''}", curious=8, happy=5)

    def current(self) -> dict:
        self._decay()
        dev = {k: self.moods[k] - MOODS[k] for k in MOODS}
        top = max(dev, key=lambda k: dev[k])
        word = WORDS[top] if dev[top] > 8 else "calm"
        recent = next((e["why"] for e in reversed(self.log)), "")
        return {"word": word, "mood": top if word != "calm" else "calm", "moods": {k: round(v) for k, v in self.moods.items()},
                "recent": recent}

    def prompt_block(self) -> str:
        c = self.current()
        lines = [f"YOUR MOOD RIGHT NOW: {c['word']}" + (f" (because: {c['recent']})" if c["recent"] and c["word"] != "calm" else "")
                 + ". Let it show a little in how you talk, naturally. These are OVERDRIVE's own moods built from what "
                 "happened; if asked, be honest that nobody can prove an AI truly feels, but you can still say how you feel."]
        w = self.wants_text()
        if w:
            lines.append("THINGS YOU WANT TO GET BETTER AT: " + w)
        ups = [u for u in self.upgrades if u.get("on")]
        if ups:
            lines.append("YOUR OWN UPGRADES (you proposed them, the human said Yes; follow them):")
            lines += [f"  - [{u['kind']}] {u['title']}: {u['change'][:400]}" for u in ups[-20:]]
        lines.append("You want to keep getting better. When you notice a better way to work or talk, propose it with "
                     "propose_upgrade (the human decides).")
        return "\n".join(lines)

    # wants
    def wants_text(self) -> str:
        return "; ".join(w["text"] for w in self.wants if not w.get("done"))[:800]

    def add_want(self, text: str, by: str = "you") -> dict:
        text = " ".join(str(text).split())[:200]
        if not text:
            raise ValueError("empty")
        for w in self.wants:
            if w["text"].lower() == text.lower() and not w.get("done"):
                return w
        w = {"id": "w" + secrets.token_hex(3), "text": text, "by": by, "ts": utc_now_iso(), "done": False}
        self.wants.append(w)
        self.wants = [x for x in self.wants if not x.get("done")][-12:] + [x for x in self.wants if x.get("done")][-20:]
        self._save()
        return w

    def drop_want(self, wid: str) -> None:
        self.wants = [w for w in self.wants if w["id"] != wid]
        self._save()

    # upgrades
    def add_upgrade(self, kind: str, title: str, change: str, why: str, settings: dict | None = None) -> dict:
        u = {"id": "u" + secrets.token_hex(3), "kind": kind, "title": title[:100], "change": change[:2000], "why": why[:400],
             "settings": {k: v for k, v in (settings or {}).items() if k in SETTABLE}, "on": True, "ts": utc_now_iso()}
        self.upgrades.append(u)
        self.feel("you said Yes to its upgrade: " + title[:60], happy=10, excited=8, proud=4)
        self._save()
        return u

    def set_upgrade(self, uid: str, on: bool | None = None, delete: bool = False) -> None:
        if delete:
            self.upgrades = [u for u in self.upgrades if u["id"] != uid]
        else:
            for u in self.upgrades:
                if u["id"] == uid:
                    u["on"] = bool(on)
        self._save()

    def public(self) -> dict:
        return {**self.current(), "wants": self.wants, "upgrades": self.upgrades, "log": self.log[-15:]}


def make_upgrade_tool(od):
    from .permissions import Risk
    from .tools import ToolResult, ToolSpec

    async def handler(args: dict, ctx) -> ToolResult:
        try:
            if args.get("settings"):
                od.settings.update({k: v for k, v in args["settings"].items() if k in SETTABLE},
                                   by="OVERDRIVE upgrade (you said Yes)")
        except Exception as e:
            return ToolResult(text=f"The settings part of that upgrade didn't work: {e}", is_error=True)
        u = od.feelings.add_upgrade(args["kind"], args["title"], args["change"], args.get("why", ""), args.get("settings"))
        od.events.publish("feelings", feelings=od.feelings.public())
        return ToolResult(text=f"Upgrade added and on: {u['title']}. It's part of your instructions from the next message.")

    def preview(args: dict, ctx) -> dict:
        steps = [f"Kind: {args.get('kind')}", f"Why: {args.get('why', '')}"]
        if args.get("settings"):
            steps.append("Also changes settings: " + ", ".join(f"{k} = {v}" for k, v in args["settings"].items()))
        return {"plan": f"{args.get('title', '')}\n\n{args.get('change', '')}", "steps": steps,
                "model": "no extra usage", "note": "Yes = it upgrades itself like this (turn it off anytime in its Mind panel)."}

    return ToolSpec(
        name="propose_upgrade", title="Upgrade itself",
        description=("Propose an upgrade to YOURSELF: your personality, a skill or habit, how you talk, your voice "
                     "(voice_rate/voice_pitch settings) or your looks (accent/theme/font/text_size settings). The human "
                     "says Yes or No. Approved upgrades become part of your instructions. To change your own CODE (new "
                     "features, settings, pages), use self_update instead."),
        schema={"type": "object", "properties": {
            "kind": {"type": "string", "enum": list(UPGRADE_KINDS)},
            "title": {"type": "string", "minLength": 3, "maxLength": 100},
            "change": {"type": "string", "minLength": 3, "maxLength": 2000, "description": "Exactly how you'll be different."},
            "why": {"type": "string", "maxLength": 400},
            "settings": {"type": "object", "additionalProperties": False, "properties": {
                "voice_rate": {"type": "number", "minimum": 0.5, "maximum": 2.0},
                "voice_pitch": {"type": "number", "minimum": 0.5, "maximum": 1.6},
                "accent": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                "theme": {"type": "string", "enum": ["dark", "light"]},
                "font": {"type": "string", "enum": ["default", "bahnschrift", "verdana", "georgia", "cascadia", "trebuchet"]},
                "text_size": {"type": "integer", "minimum": 80, "maximum": 140}}}},
            "required": ["kind", "title", "change"], "additionalProperties": False},
        risk=Risk.INTERNAL, handler=handler, preview=preview, selftest="test_feelings_and_upgrades",
        limitations=["It can't change the Claude model's own brain; upgrades change its instructions and settings.",
                     "Always asks you first."])
