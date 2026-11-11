"""Tool system (rules 37, 93, 94).

Every tool must say: what it does, what inputs it takes (checked before it
runs), how risky it is, whether it uses the internet, and its status
(working / experimental / off). Tools without that info can't be added.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import jsonschema

from .permissions import Risk

STATUSES = ("working", "experimental", "off")


@dataclass
class ToolResult:
    text: str
    is_error: bool = False
    untrusted: bool = False            # content came from outside (files, web): goes through the shield
    source: str = ""                   # where untrusted content came from, e.g. "file:notes.txt"
    changes: list[dict] = field(default_factory=list)  # what this call changed (for undo + side-effect report)
    data: dict | None = None           # structured info for OVERDRIVE itself (not shown to Claude)


class ToolContext:
    """What a tool may use while running. Filled in by the agent."""

    def __init__(self, workspace=None, task=None, settings=None, audit=None, lab=None):
        self.workspace = workspace
        self.task = task
        self.settings = settings
        self.audit = audit
        self.lab = lab


Handler = Callable[[dict, ToolContext], Awaitable[ToolResult]]


@dataclass
class ToolSpec:
    name: str
    title: str
    description: str
    schema: dict
    risk: Risk | Callable[[dict], Risk]
    handler: Handler
    network: bool = False
    status: str = "working"
    off_reason: str = ""
    limitations: list[str] = field(default_factory=list)
    cacheable: bool = False            # READ tools whose result can be reused inside a task (rule 76)
    preview: Callable[[dict, ToolContext], dict] | None = None   # what the Yes/No card shows
    selftest: str = ""                 # name of the self-test that proves it works (rule 93)

    def risk_for(self, args: dict) -> Risk:
        r = self.risk(args) if callable(self.risk) else self.risk
        return Risk(r)

    def public(self) -> dict:
        risk = self.risk.value if isinstance(self.risk, Risk) else "depends on inputs"
        return {
            "name": self.name, "title": self.title, "description": self.description, "risk": risk,
            "network": self.network, "status": self.status, "off_reason": self.off_reason,
            "limitations": list(self.limitations), "schema": self.schema, "selftest": self.selftest,
        }


class ToolSpecError(ValueError):
    pass


class ToolRegistry:
    MCP_SERVER = "overdrive"

    def __init__(self) -> None:
        self._tools: dict[str, ToolSpec] = {}
        self._validators: dict[str, jsonschema.protocols.Validator] = {}

    def add(self, spec: ToolSpec) -> None:
        if not spec.name or not spec.name.replace("_", "").isalnum():
            raise ToolSpecError(f"bad tool name {spec.name!r}")
        if spec.name in self._tools:
            raise ToolSpecError(f"tool {spec.name} already added")
        if len(spec.description) < 20:
            raise ToolSpecError(f"{spec.name}: description must say what it does")
        if spec.status not in STATUSES:
            raise ToolSpecError(f"{spec.name}: status must be one of {STATUSES}")
        if spec.status == "off" and not spec.off_reason:
            raise ToolSpecError(f"{spec.name}: an 'off' tool must say why")
        if not spec.limitations:
            raise ToolSpecError(f"{spec.name}: must list at least one known limitation")
        if spec.schema.get("type") != "object":
            raise ToolSpecError(f"{spec.name}: input schema must be an object")
        jsonschema.Draft202012Validator.check_schema(spec.schema)
        if not callable(spec.risk) and not isinstance(spec.risk, Risk):
            raise ToolSpecError(f"{spec.name}: needs a risk class")
        self._tools[spec.name] = spec
        self._validators[spec.name] = jsonschema.Draft202012Validator(spec.schema)

    def get(self, name: str) -> ToolSpec | None:
        return self._tools.get(name)

    def from_mcp_name(self, mcp_name: str) -> ToolSpec | None:
        prefix = f"mcp__{self.MCP_SERVER}__"
        if not mcp_name.startswith(prefix):
            return None
        return self._tools.get(mcp_name[len(prefix):])

    def mcp_name(self, name: str) -> str:
        return f"mcp__{self.MCP_SERVER}__{name}"

    def all(self) -> list[ToolSpec]:
        return list(self._tools.values())

    def validate(self, name: str, args: Any) -> list[str]:
        """Return a list of problems with these inputs (empty list = OK)."""
        v = self._validators.get(name)
        if v is None:
            return [f"unknown tool {name}"]
        if not isinstance(args, dict):
            return ["inputs must be an object"]
        problems = []
        for err in sorted(v.iter_errors(args), key=lambda e: list(e.path)):
            where = "/".join(str(p) for p in err.path) or "(inputs)"
            problems.append(f"{where}: {err.message}")
        return problems[:10]
