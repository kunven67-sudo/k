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
            ("/api/bg", self.bg_list, ["GET"]), ("/api/bg/upload", self.bg_upload, ["POST"]),
            ("/api/bg/delete", self.bg_delete, ["POST"]),
        ]

    def p4_open_routes(self) -> list[tuple]:
        """Routes that check the key from ?k= themselves (<img>/<video> can't send headers)."""
        return [("/bgfile/{name}", self.bg_file, ["GET"])]

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

    # ------------------------------------------------------------------ your own backgrounds
    async def bg_list(self, request: Request) -> Response:
        return JSONResponse({"files": self.od.backgrounds.list()})

    async def bg_upload(self, request: Request) -> Response:
        from .backgrounds import BackgroundError
        try:
            name = await self.od.backgrounds.save_stream(request.stream())
        except BackgroundError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.audit.write("background_added", {"file": name})
        return JSONResponse({"file": name, "files": self.od.backgrounds.list()})

    async def bg_delete(self, request: Request) -> Response:
        from .backgrounds import BackgroundError
        b = await self._json(request)
        try:
            self.od.backgrounds.delete(str(b.get("name") or ""))
        except BackgroundError as e:
            return JSONResponse({"error": str(e)}, 400)
        if self.od.settings.get("bg_custom") == b.get("name"):
            self.od.settings.update({"bg_custom": "", "background": "aurora"}, by="you")
        return JSONResponse({"files": self.od.backgrounds.list()})

    async def bg_file(self, request: Request) -> Response:
        import hmac
        from starlette.responses import FileResponse, PlainTextResponse
        from .backgrounds import MIME
        if not hmac.compare_digest(request.query_params.get("k", "").encode(), self.token.encode()):
            return PlainTextResponse("Missing or wrong OVERDRIVE key.", 401)
        name = request.path_params["name"]
        path = self.od.backgrounds.path(name)
        if path is None:
            return PlainTextResponse("not found", 404)
        return FileResponse(path, media_type=MIME[name.rsplit(".", 1)[1]],
                            headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})
