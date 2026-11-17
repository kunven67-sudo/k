"""The internet light (Piece 3). Checks every few seconds whether the internet works (a quick connection to
Anthropic, then a fallback). When it drops, the window shows a banner that STAYS until you close it, so you
see it even if you were away; when it comes back, the banner says when and for how long it was out."""
from __future__ import annotations

import asyncio
import socket
import time
from typing import Any, Callable

HOSTS = (("api.anthropic.com", 443), ("1.1.1.1", 443), ("8.8.8.8", 53))


def check_internet(timeout: float = 3.0) -> bool:
    for host, port in HOSTS:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


class Net:
    def __init__(self, od: Any, check: Callable[[], bool] = check_internet):
        self.od = od
        self.check = check
        self.online: bool | None = None
        self.since = time.time()
        self.drops: list[dict] = []          # recent drops: {down, up, seconds}

    def public(self) -> dict:
        return {"online": self.online, "since": self.since, "drops": self.drops[-5:]}

    async def poll(self) -> None:
        ok = await asyncio.to_thread(self.check)
        if ok == self.online:
            return
        now = time.time()
        if self.online is not None:
            if not ok:
                self.drops.append({"down": now, "up": None, "seconds": None})
                self.od.audit.write("internet_down", {})
            elif self.drops and self.drops[-1]["up"] is None:
                d = self.drops[-1]
                d["up"], d["seconds"] = now, round(now - d["down"])
                self.od.audit.write("internet_back", {"seconds": d["seconds"]})
            del self.drops[:-20]
        self.online, self.since = ok, now
        self.od.events.publish("net", net=self.public())

    async def run(self, every: float = 8.0) -> None:
        while True:
            try:
                await self.poll()
            except Exception as e:
                self.od.audit.write("net_check_error", {"error": repr(e)[:300]})
            await asyncio.sleep(every if self.online is not False else 4.0)
