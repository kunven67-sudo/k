"""XP + levels ⭐ - coding feels like a game."""

import json
from pathlib import Path

from codebrain.paths import brain_dir

REWARDS = {
    "chat": 2,
    "explain": 3,
    "run_ok": 10,
    "bug_fixed": 25,
    "quiz_right": 15,
    "lesson_done": 50,
    "new_file": 5,
}

TITLES = [
    "Code Baby 👶",
    "Hello-Worlder 👋",
    "Variable Victor 📦",
    "Loop Rookie 🔁",
    "Bug Squasher 🐛",
    "Function Fighter 🥊",
    "2D Game Maker 🕹️",
    "3D Explorer 🧊",
    "Game Dev 🎮",
    "Code Wizard 🧙",
    "Code Legend 🏆",
]


def xp_for_level(level):
    """Total XP needed to REACH a level. Level 1 = 0 XP, each level needs 100 more than the last."""
    return 50 * (level - 1) * level


class XP:
    def __init__(self, path=None):
        self.path = Path(path) if path else brain_dir() / "xp.json"
        self.data = {"xp": 0, "lessons_done": [], "counts": {}}
        if self.path.exists():
            try:
                self.data.update(json.loads(self.path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass

    def save(self):
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    @property
    def total(self):
        return self.data["xp"]

    @property
    def level(self):
        lvl = 1
        while self.total >= xp_for_level(lvl + 1):
            lvl += 1
        return lvl

    @property
    def title(self):
        return TITLES[min(self.level - 1, len(TITLES) - 1)]

    def progress(self):
        """(xp into this level, xp needed for this level)"""
        start, end = xp_for_level(self.level), xp_for_level(self.level + 1)
        return self.total - start, end - start

    def add(self, action, amount=None):
        """Give XP. Returns a message if you leveled up, else None."""
        before = self.level
        self.data["xp"] += REWARDS.get(action, 0) if amount is None else amount
        counts = self.data.setdefault("counts", {})
        counts[action] = counts.get(action, 0) + 1
        self.save()
        if self.level > before:
            return f"🎉 LEVEL UP! You're now level {self.level}: {self.title}"
        return None

    def finish_lesson(self, lesson_id):
        if lesson_id in self.data["lessons_done"]:
            return None
        self.data["lessons_done"].append(lesson_id)
        return self.add("lesson_done")

    def summary(self):
        have, need = self.progress()
        return f"Level {self.level} {self.title}  |  {have}/{need} XP to next level  |  {self.total} XP total"
