"""Where OVERDRIVE keeps things.

One home folder (default: ~/OVERDRIVE), split so your files, OVERDRIVE's own
records, old versions and experiments never mix (rule 45).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Paths:
    home: Path

    @property
    def data(self) -> Path:
        """OVERDRIVE's own records: settings, tasks, usage."""
        return self.home / "data"

    @property
    def tasks(self) -> Path:
        return self.home / "data" / "tasks"

    @property
    def logs(self) -> Path:
        """Append-only audit log."""
        return self.home / "logs"

    @property
    def workspace(self) -> Path:
        """Your files. The only folder OVERDRIVE's file tools can touch."""
        return self.home / "workspace"

    @property
    def versions(self) -> Path:
        """Old copies of files (nothing is ever silently overwritten)."""
        return self.home / "versions"

    @property
    def lab(self) -> Path:
        """Experimental tools may only write here, never into your workspace."""
        return self.home / "lab"

    @property
    def exports(self) -> Path:
        return self.home / "exports"

    def ensure(self) -> "Paths":
        for p in (self.data, self.tasks, self.logs, self.workspace, self.versions, self.lab, self.exports):
            p.mkdir(parents=True, exist_ok=True)
        return self


def default_home() -> Path:
    env = os.environ.get("OVERDRIVE_HOME", "").strip()
    if env:
        return Path(env).expanduser()
    return Path.home() / "OVERDRIVE"
