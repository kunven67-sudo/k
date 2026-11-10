"""Permission gates (rules 29, 32, 33, 34, 35, 84).

Every tool has a risk class. Your policy says what happens for each class:
auto (just do it), ask (Yes/No card in the window), or block.
Deleting/replacing, sending anything off your PC, and spending money are
locked to ask-or-block. OVERDRIVE cannot change its own permissions.
"""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from .jsonio import canonical_json, utc_now_iso


class Risk(str, Enum):
    INTERNAL = "internal"        # OVERDRIVE's own bookkeeping (plan/report). Always allowed.
    READ = "read"                # looks at things inside its allowed folder
    WRITE = "write"              # makes something new
    DESTRUCTIVE = "destructive"  # changes, replaces or removes something that exists
    EXTERNAL = "external"        # sends anything off your PC
    MONEY = "money"              # buys or pays for something

    @property
    def label(self) -> str:
        return {
            "internal": "OVERDRIVE bookkeeping",
            "read": "Read",
            "write": "Write (new)",
            "destructive": "Change / replace / delete",
            "external": "Send off your PC",
            "money": "Spend money",
        }[self.value]


ORDER = [Risk.INTERNAL, Risk.READ, Risk.WRITE, Risk.DESTRUCTIVE, Risk.EXTERNAL, Risk.MONEY]


def decide(policy: dict[str, str], risk: Risk) -> str:
    """auto / ask / block for a risk class. Locked classes can never be auto."""
    if risk == Risk.INTERNAL:
        return "auto"
    pol = policy.get(risk.value, "ask")
    if risk in (Risk.DESTRUCTIVE, Risk.EXTERNAL, Risk.MONEY) and pol == "auto":
        return "ask"  # even a hand-edited settings file can't unlock these
    if pol not in ("auto", "ask", "block"):
        return "ask"
    return pol


def input_key(tool: str, args: dict) -> str:
    return hashlib.sha256(f"{tool}\n{canonical_json(args)}".encode("utf-8")).hexdigest()


class Grants:
    """One-time permission slips. A tool only runs if the gate issued a slip for
    exactly that tool + exactly those inputs (defense in depth: even if some
    path skipped the gate, the tool itself refuses to run)."""

    TTL = 300.0

    def __init__(self) -> None:
        self._slips: dict[str, list[float]] = {}

    def issue(self, tool: str, args: dict) -> None:
        self._slips.setdefault(input_key(tool, args), []).append(time.monotonic())

    def take(self, tool: str, args: dict) -> bool:
        key = input_key(tool, args)
        now = time.monotonic()
        slips = [t for t in self._slips.get(key, []) if now - t < self.TTL]
        if not slips:
            self._slips.pop(key, None)
            return False
        slips.pop(0)
        if slips:
            self._slips[key] = slips
        else:
            self._slips.pop(key, None)
        return True

    def clear(self) -> None:
        self._slips.clear()


@dataclass
class Card:
    """Something only you can answer: a Yes/No approval or a question."""

    id: str
    kind: str                      # "approval" | "question"
    task_id: str | None
    title: str
    body: dict
    risk: str | None
    created: str
    timeout_s: float
    status: str = "open"           # open | yes | no | answered | timeout | stopped
    answer: Any = None
    note: str = ""
    future: asyncio.Future | None = field(default=None, repr=False)

    def public(self) -> dict:
        return {
            "id": self.id, "kind": self.kind, "task_id": self.task_id, "title": self.title, "body": self.body,
            "risk": self.risk, "created": self.created, "timeout_s": self.timeout_s, "status": self.status,
            "answer": self.answer, "note": self.note,
        }


class Broker:
    """Holds open cards and waits for your answer (or STOP, or the timeout)."""

    def __init__(self, on_change: Callable[[str, Card], None] | None = None):
        self.cards: dict[str, Card] = {}
        self.on_change = on_change

    def _emit(self, what: str, card: Card) -> None:
        if self.on_change:
            try:
                self.on_change(what, card)
            except Exception:
                pass

    def open_cards(self) -> list[Card]:
        return [c for c in self.cards.values() if c.status == "open"]

    async def ask(self, kind: str, title: str, body: dict, task_id: str | None, risk: str | None,
                  timeout_s: float) -> Card:
        loop = asyncio.get_running_loop()
        card = Card(id="c_" + secrets.token_hex(6), kind=kind, task_id=task_id, title=title, body=body, risk=risk,
                    created=utc_now_iso(), timeout_s=timeout_s, future=loop.create_future())
        self.cards[card.id] = card
        self._emit("card_open", card)
        try:
            await asyncio.wait_for(asyncio.shield(card.future), timeout=timeout_s)
        except asyncio.TimeoutError:
            if card.status == "open":
                card.status = "timeout"
        except asyncio.CancelledError:
            if card.status == "open":
                card.status = "stopped"
            self._emit("card_closed", card)
            raise
        self._emit("card_closed", card)
        return card

    def resolve(self, card_id: str, status: str, answer: Any = None, note: str = "") -> Card:
        card = self.cards.get(card_id)
        if card is None:
            raise KeyError("no such card")
        if card.status != "open":
            raise ValueError(f"card already {card.status}")
        if status not in ("yes", "no", "answered"):
            raise ValueError("bad answer")
        card.status, card.answer, card.note = status, answer, (note or "")[:2000]
        if card.future and not card.future.done():
            card.future.set_result(True)
        return card

    def cancel_all(self, reason: str = "stopped") -> int:
        n = 0
        for card in self.open_cards():
            card.status = reason
            if card.future and not card.future.done():
                card.future.set_result(True)
            n += 1
        return n
