"""Live events for the window (task progress, cards, usage, log lines)."""
from __future__ import annotations

import asyncio
import itertools
import threading
from collections import deque
from typing import Any


class EventBus:
    def __init__(self, keep: int = 400):
        self._seq = itertools.count(1)
        self._recent: deque[dict] = deque(maxlen=keep)
        self._subs: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def publish(self, type_: str, **data: Any) -> dict:
        with self._lock:
            ev = {"seq": next(self._seq), "type": type_, **data}
            self._recent.append(ev)
        loop = self._loop
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if loop is not None and running is not loop and not loop.is_closed():
            try:
                loop.call_soon_threadsafe(self._fanout, ev)
                return ev
            except RuntimeError:  # the loop closed in between
                pass
        if loop is None or running is loop or loop.is_closed():
            self._fanout(ev)
        return ev

    def _fanout(self, ev: dict) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(ev)
            except asyncio.QueueFull:
                pass  # a stuck window: it will resync from /api/state

    def subscribe(self, since: int = 0) -> tuple[asyncio.Queue, list[dict]]:
        q: asyncio.Queue = asyncio.Queue(maxsize=2000)
        with self._lock:
            backlog = [e for e in self._recent if e["seq"] > since]
        self._subs.add(q)
        return q, backlog

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    @property
    def last_seq(self) -> int:
        with self._lock:
            return self._recent[-1]["seq"] if self._recent else 0
