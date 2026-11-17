"""Settings, including the permission policy.

Only you can change these (through the window). OVERDRIVE's brain has no tool
that can read or write this file, and every change is written to the audit
log with the old and new value. Some permission classes are locked: deleting,
sending things off your PC, and spending money can never be set to "auto".
"""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from .jsonio import atomic_write_json, read_json

RISKS = ("read", "web", "write", "run", "destructive", "external", "money")
POLICIES = ("auto", "ask", "block")
LOCKED_RISKS = {"destructive": ("ask", "block"), "external": ("ask", "block"), "money": ("ask", "block")}

MODELS = {
    "opus": "Claude Opus (smartest, uses the most usage)",
    "sonnet": "Claude Sonnet (fast + smart, uses less)",
    "haiku": "Claude Haiku (fastest, uses the least)",
    "fable": "Claude Fable (top model, heaviest usage)",
}

DEFAULTS: dict[str, Any] = {
    "model": "opus",
    "fallback_model": "",
    "effort": "medium",
    "detail": "normal",
    "max_steps": 25,
    "max_minutes": 10,
    "task_budget_usd": 2.0,
    "daily_budget_usd": 10.0,
    "pause_at_usage_pct": 90,
    "network": True,
    "double_check": True,
    "approval_timeout_min": 10,
    "cli_path": "",
    "permissions": {"read": "auto", "web": "auto", "write": "auto", "run": "auto", "destructive": "ask",
                    "external": "ask", "money": "block"},
    "model_switch": "ask",
    # Piece 2 (ChatGPT mode): each one can be switched on/off in Settings
    "chat_style": True,          # talk like ChatGPT: lists, tables, no rushing to build
    "pictures": "real",          # real / ai / both / off
    "own_ideas": True,           # "My ideas:" after plans and builds
    "copy_numbers": True,        # numbered copy buttons on every answer piece (window only)
    # Piece 3
    "memory_save": "tell",       # tell = normal things save + tell you (Undo); ask = every save asks first
    "voice_name": "",            # "" = the best natural voice Edge has
    "voice_rate": 1.0,           # talking speed
    "voice_pitch": 1.0,
    "voice_read": "voice_mode",  # read answers out loud: voice_mode (only in voice mode) / always / off
    "voice_moods": True,         # its voice follows its mood (a bit faster when excited, slower when sad)
    # while you're away
    "away_learn": True,          # learn when the PC is idle (uses a little usage, capped)
    "away_learn_cap": 5,         # % of the 5-hour limit per day: 5 or 10 (your pick)
    "away_bugs": True,           # bug hunt when the PC is idle (zero usage)
    "bug_scope": "all",          # all projects / picked ones (done projects are always skipped)
    "bug_picked": [],
    "away_after_min": 10,        # "away" = no mouse or keyboard for this many minutes
    "keep_running": True,        # keep working when the window is closed (Quit in Settings ends it)
    "start_with_windows": False,
    "auto_done": "ask",          # projects nobody touched for a while: always (mark done) / ask / never
    "auto_done_days": 14,
    "tour_done": False,          # the first-start tour was shown
    "btw_model": "sonnet",       # the quick model for "by the way" side questions
    "chat_names": "smart",       # smart = a short real name after the first answer; first_words = old way
    "quick_read": True,          # long answers start with a one-line "Quick read:"
    "auto_resume": True,         # after a power cut: keep going by itself (after a short countdown)
    "theme": "dark",             # dark / light
    "font": "default",
    "text_size": 100,            # percent
    "accent": "#ff6a2b",
    "pictures_keep_days": 0,     # chat pictures: delete after N days (0 = keep forever)
    "pictures_max_mb": 1000,     # ...or when the folder gets bigger than this (oldest go first)
    "pc_profile": "",            # "" = read the PC by itself; or type your PC (for the no-lag check)
}

_SCHEMA: dict[str, tuple] = {
    # name: (type, extra check, human label)
    "model": (str, lambda v: v in MODELS or v.startswith("claude-"), "Model"),
    "fallback_model": (str, lambda v: v == "" or v in MODELS or v.startswith("claude-"), "Backup model"),
    "effort": (str, lambda v: v in ("low", "medium", "high", "xhigh", "max"), "Thinking effort"),
    "detail": (str, lambda v: v in ("simple", "normal", "deep"), "Explanation detail"),
    "max_steps": (int, lambda v: 1 <= v <= 200, "Max steps per task"),
    "max_minutes": (int, lambda v: 1 <= v <= 240, "Max minutes per task"),
    "task_budget_usd": ((int, float), lambda v: 0.05 <= v <= 100, "Usage cap per task"),
    "daily_budget_usd": ((int, float), lambda v: 0.1 <= v <= 1000, "Usage cap per day"),
    "pause_at_usage_pct": (int, lambda v: 10 <= v <= 100, "Pause when Claude usage reaches"),
    "network": (bool, None, "Network"),
    "double_check": (bool, None, "Second check by a fresh Claude"),
    "approval_timeout_min": (int, lambda v: 1 <= v <= 120, "Auto-No after (minutes)"),
    "cli_path": (str, lambda v: len(v) < 500, "Claude Code path"),
    "model_switch": (str, lambda v: v in ("ask", "auto"), "Model switching"),
    "chat_style": (bool, None, "Talk like ChatGPT"),
    "pictures": (str, lambda v: v in ("real", "ai", "both", "off"), "Pictures"),
    "own_ideas": (bool, None, "Its own ideas"),
    "copy_numbers": (bool, None, "Copy buttons on answers"),
    "memory_save": (str, lambda v: v in ("tell", "ask"), "Memory saving"),
    "voice_name": (str, lambda v: len(v) <= 200, "Voice"),
    "voice_rate": ((int, float), lambda v: 0.5 <= v <= 2.0, "Talking speed"),
    "voice_pitch": ((int, float), lambda v: 0.5 <= v <= 1.6, "Voice pitch"),
    "voice_read": (str, lambda v: v in ("voice_mode", "always", "off"), "Read answers out loud"),
    "voice_moods": (bool, None, "Voice follows its mood"),
    "away_learn": (bool, None, "Learn while I'm away"),
    "away_learn_cap": (int, lambda v: v in (5, 10), "Learning cap"),
    "away_bugs": (bool, None, "Bug hunt while I'm away"),
    "bug_scope": (str, lambda v: v in ("all", "picked"), "Bug hunt projects"),
    "bug_picked": (list, lambda v: len(v) <= 200 and all(isinstance(x, str) and len(x) < 300 for x in v), "Picked projects"),
    "away_after_min": (int, lambda v: 2 <= v <= 240, "Away after"),
    "keep_running": (bool, None, "Keep running when the window is closed"),
    "start_with_windows": (bool, None, "Start with Windows"),
    "auto_done": (str, lambda v: v in ("always", "ask", "never"), "Done projects"),
    "auto_done_days": (int, lambda v: 3 <= v <= 365, "Not touched for (days)"),
    "tour_done": (bool, None, "Tour shown"),
    "btw_model": (str, lambda v: v in ("haiku", "sonnet", "opus"), "By the way model"),
    "chat_names": (str, lambda v: v in ("smart", "first_words"), "Chat names"),
    "quick_read": (bool, None, "Quick read line"),
    "auto_resume": (bool, None, "Keep going after a power cut"),
    "theme": (str, lambda v: v in ("dark", "light"), "Theme"),
    "font": (str, lambda v: v in FONTS, "Font"),
    "text_size": (int, lambda v: 80 <= v <= 140, "Text size"),
    "accent": (str, lambda v: bool(__import__("re").fullmatch(r"#[0-9a-fA-F]{6}", v)), "Accent color"),
    "pictures_keep_days": (int, lambda v: v in (0, 7, 30, 90, 365), "Keep chat pictures"),
    "pictures_max_mb": (int, lambda v: 50 <= v <= 20000, "Picture folder limit"),
    "pc_profile": (str, lambda v: len(v) <= 400, "Your PC"),
}

FONTS = ("default", "bahnschrift", "verdana", "georgia", "cascadia", "trebuchet")


class SettingsError(ValueError):
    pass


def validate_change(key: str, value: Any) -> Any:
    if key == "permissions":
        if not isinstance(value, dict):
            raise SettingsError("permissions must be a map of risk -> policy")
        out = {}
        for risk, pol in value.items():
            if risk not in RISKS:
                raise SettingsError(f"unknown risk class '{risk}'")
            if pol not in POLICIES:
                raise SettingsError(f"policy for {risk} must be one of {POLICIES}")
            if risk in LOCKED_RISKS and pol not in LOCKED_RISKS[risk]:
                raise SettingsError(f"'{risk}' is locked: it can only be ask or block, never auto")
            out[risk] = pol
        return out
    if key not in _SCHEMA:
        raise SettingsError(f"unknown setting '{key}'")
    typ, check, label = _SCHEMA[key]
    if typ is int and isinstance(value, bool):
        raise SettingsError(f"{label}: must be a whole number")
    if typ is int and isinstance(value, float) and value.is_integer():
        value = int(value)
    if not isinstance(value, typ):
        raise SettingsError(f"{label}: wrong type")
    if check and not check(value):
        raise SettingsError(f"{label}: value {value!r} is out of range")
    return value


class Settings:
    def __init__(self, data_dir: Path, audit=None):
        self.path = Path(data_dir) / "settings.json"
        self.audit = audit
        stored = read_json(self.path, {}, on_broken=self._broken) or {}
        self.values = copy.deepcopy(DEFAULTS)
        # Load stored values, but re-validate them (a hand-edited file can't unlock anything).
        for k, v in stored.items():
            try:
                if k == "permissions":
                    merged = dict(DEFAULTS["permissions"])
                    for risk, pol in (v or {}).items():
                        try:
                            merged.update(validate_change("permissions", {risk: pol}))
                        except SettingsError:
                            pass
                    self.values["permissions"] = merged
                elif k in _SCHEMA:
                    self.values[k] = validate_change(k, v)
            except SettingsError:
                pass

    def _broken(self, path: Path, aside: Path) -> None:
        if self.audit:
            self.audit.write("settings_file_broken", {"file": str(path), "moved_to": str(aside)})

    def get(self, key: str) -> Any:
        return copy.deepcopy(self.values.get(key, DEFAULTS.get(key)))

    def all(self) -> dict:
        return copy.deepcopy(self.values)

    def update(self, changes: dict, by: str = "you (settings page)") -> dict:
        """Apply changes made by the human. Returns {key: [old, new]} for what changed."""
        clean: dict[str, Any] = {}
        for k, v in changes.items():
            if k == "permissions":
                merged = dict(self.values["permissions"])
                merged.update(validate_change("permissions", v))
                clean[k] = merged
            else:
                clean[k] = validate_change(k, v)
        diff = {}
        for k, v in clean.items():
            if self.values.get(k) != v:
                diff[k] = [copy.deepcopy(self.values.get(k)), copy.deepcopy(v)]
                self.values[k] = v
        if diff:
            atomic_write_json(self.path, self.values)
            if self.audit:
                self.audit.write("settings_changed", {"by": by, "changes": diff})
        return diff
