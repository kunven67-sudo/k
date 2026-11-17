"""Claude accounts (Piece 3). Each account is its own Claude Code sign-in folder (CLAUDE_CONFIG_DIR).

"main" = Claude Code's normal sign-in on this PC. More accounts each get a folder under OVERDRIVE/accounts/.
When an account's limit runs out, OVERDRIVE TELLS you and you pick another with one click. It never
switches by itself: hopping accounts automatically to dodge limits can get accounts banned.
A chat keeps going on the new account: its saved history is copied over to that account's folder.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

from .jsonio import atomic_write_json, read_json, utc_now_iso

MAIN = "main"


def default_config_dir() -> Path:
    return Path.home() / ".claude"


class Accounts:
    def __init__(self, home: Path, data_dir: Path):
        self.root = Path(home) / "accounts"
        self.path = Path(data_dir) / "accounts.json"
        d = read_json(self.path, {}) or {}
        self.active: str = d.get("active") or MAIN
        self.items: list[dict] = [a for a in d.get("accounts", []) if isinstance(a, dict) and a.get("name")]
        self.limits: dict[str, dict] = d.get("limits", {}) if isinstance(d.get("limits"), dict) else {}
        # Piece 4: per account: "pay" (pay per message with an Anthropic Console sign-in, costs money),
        # "plan" (last plan seen: Pro / Max / Free...). The year-long sign-in code lives in the SecretBox.
        self.extra: dict[str, dict] = d.get("extra", {}) if isinstance(d.get("extra"), dict) else {}
        from .secretbox import SecretBox
        self.secrets = SecretBox(data_dir)
        if self.active != MAIN and not self.get(self.active):
            self.active = MAIN

    def _save(self) -> None:
        atomic_write_json(self.path, {"active": self.active, "accounts": self.items, "limits": self.limits,
                                      "extra": self.extra})

    # ---- Piece 4: plan badge, pay per message, year-long sign-in
    def set_extra(self, name: str, **kv) -> None:
        if self.get(name) is None:
            raise ValueError("no such account")
        self.extra.setdefault(name, {}).update(kv)
        self._save()

    def pays(self, name: str | None = None) -> bool:
        return bool(self.extra.get(name or self.active, {}).get("pay"))

    def set_long_token(self, name: str, token: str) -> None:
        token = "".join(str(token or "").split())
        if token and not re.fullmatch(r"sk-ant-oat\d*-[A-Za-z0-9_\-]{20,400}", token):
            raise ValueError("That doesn't look like the sign-in code. It starts with sk-ant-oat and is one long line.")
        if self.get(name) is None:
            raise ValueError("no such account")
        self.secrets.set(f"oauth:{name}", token)
        self.set_extra(name, long_token=bool(token))

    def has_long_token(self, name: str | None = None) -> bool:
        return bool(self.extra.get(name or self.active, {}).get("long_token")) and self.secrets.has(f"oauth:{name or self.active}")

    def get(self, name: str) -> dict | None:
        if name == MAIN:
            return {"name": MAIN, "dir": "", "added": ""}
        return next((a for a in self.items if a["name"] == name), None)

    def names(self) -> list[str]:
        return [MAIN] + [a["name"] for a in self.items]

    def config_dir(self, name: str | None = None) -> Path:
        a = self.get(name or self.active)
        return Path(a["dir"]) if a and a.get("dir") else default_config_dir()

    def env(self, name: str | None = None) -> dict:
        """Extra environment for Claude Code runs on this account ({} = the normal sign-in)."""
        n = name or self.active
        a = self.get(n)
        env = {"CLAUDE_CONFIG_DIR": a["dir"]} if a and a.get("dir") else {}
        if self.extra.get(n, {}).get("long_token"):
            tok = self.secrets.get(f"oauth:{n}")
            if tok:
                env["CLAUDE_CODE_OAUTH_TOKEN"] = tok      # the year-long sign-in: no codes to type for a year
        return env

    def add(self, name: str) -> dict:
        name = " ".join(str(name or "").split())[:40]
        if not name or not re.fullmatch(r"[\w .'-]+", name):
            raise ValueError("Give the account a short name (letters, numbers, spaces).")
        if name.lower() in (n.lower() for n in self.names()):
            raise ValueError(f"There's already an account called {name!r}.")
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "account"
        folder = self.root / slug
        n = 2
        while folder.exists():
            folder = self.root / f"{slug}-{n}"
            n += 1
        folder.mkdir(parents=True)
        item = {"name": name, "dir": str(folder), "added": utc_now_iso()}
        self.items.append(item)
        self._save()
        return item

    def remove(self, name: str) -> None:
        if name == MAIN:
            raise ValueError("The main account can't be removed.")
        a = self.get(name)
        if a is None:
            raise ValueError("no such account")
        self.items = [x for x in self.items if x["name"] != name]
        if self.active == name:
            self.active = MAIN
        self._save()        # its sign-in folder stays on disk (nothing deleted by surprise)

    def switch(self, name: str, usage) -> dict:
        """Switch the active account. Each account keeps its own usage-limit readings."""
        if self.get(name) is None:
            raise ValueError("no such account")
        if name == self.active:
            return {"active": name, "changed": False}
        self.limits[self.active] = dict(usage.rate_limits)
        usage.rate_limits = dict(self.limits.get(name, {}))
        usage._save()
        old, self.active = self.active, name
        self._save()
        return {"active": name, "changed": True, "old": old}

    def carry_session(self, session_id: str, from_name: str, to_name: str) -> bool:
        """Copy a chat's saved history (Claude Code's <session>.jsonl) to another account's folder,
        so the chat continues there. False = not found (the chat then starts fresh, with a note)."""
        if not session_id or from_name == to_name or not re.fullmatch(r"[0-9a-fA-F-]{8,64}", session_id):
            return False
        src_root = self.config_dir(from_name) / "projects"
        dst_root = self.config_dir(to_name) / "projects"
        try:
            hits = list(src_root.glob(f"*/{session_id}.jsonl"))
        except OSError:
            return False
        if not hits:
            return False
        src = hits[0]
        dst = dst_root / src.parent.name / src.name
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        except OSError:
            return False
        return True

    def public(self) -> dict:
        return {"active": self.active,
                "accounts": [{"name": n, "main": n == MAIN, "active": n == self.active,
                              "plan": self.extra.get(n, {}).get("plan", ""), "pay": self.pays(n),
                              "long_token": self.has_long_token(n),
                              "limits": self.limits.get(n, {}) if n != self.active else None} for n in self.names()]}
