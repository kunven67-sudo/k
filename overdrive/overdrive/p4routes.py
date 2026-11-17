"""Piece 4 window routes (mixed into server.Server): voice, sounds, backgrounds, music, profiles, email,
notifications, backup, phone remote, OVERDRIVE OS. Every /api route here is behind the same key + Host checks."""
from __future__ import annotations

import asyncio

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .voice import VoiceError, say_windows


class P4Routes:
    od: object

    def p4_routes(self) -> list[tuple]:
        return [
            ("/api/voice", self.voice_api, ["GET", "POST"]),
            ("/api/say", self.say_api, ["POST"]),
        ]

    # ------------------------------------------------------------------ voice
    async def voice_api(self, request: Request) -> Response:
        od = self.od
        which = od.settings.get("voice_model")
        if request.method == "GET":
            mics = await asyncio.to_thread(od.voice.mics)
            return JSONResponse({**od.voice.status(which), "mics": mics})
        b = await self._json(request)
        act = str(b.get("action") or "")
        try:
            if act == "start":
                sid = await asyncio.to_thread(od.voice.start, str(b.get("for") or "dict"), which, od.settings.get("voice_mic"))
                return JSONResponse({"session": sid})
            if act == "stop":
                await asyncio.to_thread(od.voice.stop)
                return JSONResponse({"ok": True})
            if act == "download":
                od.voice.download(which)
                return JSONResponse(od.voice.status(which))
        except VoiceError as e:
            if str(e) == "downloading":
                return JSONResponse({"downloading": True, **od.voice.status(which)}, 202)
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"error": "unknown action"}, 400)

    async def say_api(self, request: Request) -> Response:
        b = await self._json(request)
        ok = say_windows(str(b.get("text") or ""), int(b.get("rate") or 0))
        return JSONResponse({"ok": ok})
