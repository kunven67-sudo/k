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

RISKS = ("read", "write", "destructive", "external", "money")
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
    "permissions": {"read": "auto", "write": "ask", "destructive": "ask", "external": "ask", "money": "block"},
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
}


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
