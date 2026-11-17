"""The window: a local page shown in OVERDRIVE's own window (OVERDRIVE.exe --window, WebView2 inside).

Locked to your PC: it listens on 127.0.0.1 only, every API call needs a
random secret made at startup, and requests from other sites are refused
(Host + Origin checks). OVERDRIVE closes itself about a minute after the
window is closed, unless a task is still running.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse, Response, StreamingResponse
from starlette.routing import Route

from . import STAGE, VERSION, brain, registry, selftest
from .agent import SDK_VERSION, Busy, Overdrive
from .jsonio import atomic_write_json, read_json
from .settings import MODELS, SettingsError

UI = Path(__file__).resolve().parent / "ui"
STATIC = {"app.js": "text/javascript", "md.js": "text/javascript", "p3.js": "text/javascript", "p4.js": "text/javascript",
          "fx.js": "text/javascript", "music.js": "text/javascript", "app.css": "text/css", "logo.svg": "image/svg+xml",
          "favicon.svg": "image/svg+xml"}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; "
       "font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")


async def compat_info(od: Overdrive) -> dict:
    setup = await od.check_setup()
    return {"overdrive": VERSION, "stage": STAGE, "python": platform.python_version(), "os": platform.platform(),
            "agent_sdk": SDK_VERSION, "claude_code": setup.get("version") or "not found",
            "claude_code_path": setup.get("cli") or "", "window": "own window (WebView2)" if app_exe() else ("Edge app window" if find_edge() else "browser"),
            "data_folder": str(od.paths.home), "supported": "Windows 10 (1809+) / 11, 64-bit"}


def find_edge() -> str | None:
    if platform.system() == "Windows":
        for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
            if base:
                p = Path(base) / "Microsoft" / "Edge" / "Application" / "msedge.exe"
                if p.is_file():
                    return str(p)
        return shutil.which("msedge")
    for name in ("microsoft-edge", "microsoft-edge-stable", "chromium", "chromium-browser", "google-chrome"):
        hit = shutil.which(name)
        if hit:
            return hit
    return None


def app_exe() -> Path | None:
    """OVERDRIVE.exe (its own window maker), next to the python folder in the Windows build."""
    for c in (os.environ.get("OVERDRIVE_EXE", ""), str(Path(sys.executable).resolve().parent.parent / "OVERDRIVE.exe")):
        if c and c.lower().endswith(".exe") and Path(c).is_file():
            return Path(c)
    return None


def open_window(url: str, profile: Path, kind: str = "window") -> str:
    """Open OVERDRIVE's own window (WebView2, no browser). Old way (Edge app mode) only if the exe isn't there.
    kind = "window" (the app) or "os" (OVERDRIVE OS). Returns how it was opened."""
    if os.environ.get("OVERDRIVE_NO_WINDOW"):
        return "none"
    exe = app_exe() if platform.system() == "Windows" else None
    if exe:
        subprocess.Popen([str(exe), f"--{kind}", url, "--data", str(profile.parent / "window")],
                         creationflags=brain.NO_WINDOW, close_fds=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return "app"
    edge = find_edge()
    if edge:
        args = [edge, f"--app={url}", f"--user-data-dir={profile}", "--window-size=1320,880",
                "--no-first-run", "--no-default-browser-check", "--disable-features=Translate"]
        flags = brain.NO_WINDOW if platform.system() == "Windows" else 0
        subprocess.Popen(args, creationflags=flags, close_fds=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return "edge"
    webbrowser.open(url)
    return "browser"


def open_folder(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    if platform.system() == "Windows":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif shutil.which("xdg-open"):
        subprocess.Popen(["xdg-open", str(path)])


from .p4routes import P4Routes  # noqa: E402


class Server(P4Routes):
    def __init__(self, od: Overdrive, token: str | None = None):
        self.od = od
        self.token = token or secrets.token_urlsafe(24)
        self.port = 0
        self.streams = 0
        # +60 s grace: the first window start (WebView2 making its folder) can be slow on older PCs.
        self.last_stream_seen = time.monotonic() + 60
        self.selftest_running = False
        self.signin_watch: dict[str, asyncio.Task] = {}
        self.should_exit = asyncio.Event()
        self.app = Starlette(routes=self._routes())
        self.app.add_middleware(_Guard, server=self)

    # ------------------------------------------------------------------ helpers
    def _state(self) -> dict:
        od = self.od
        cur = od.current
        return {
            "version": VERSION, "stage": STAGE, "settings": od.settings.all(), "models": MODELS,
            "conversations": [c.__dict__ for c in sorted(od.conversations.values(), key=lambda c: c.created, reverse=True)],
            "current": cur.rec.public() if cur else None,
            "cards": [c.public() for c in od.broker.open_cards()],
            "usage": od.usage.public(),
            "tools": [t.public() for t in od.tools.all()],
            "event_seq": od.events.last_seq,
            "removed_env": od.removed_env,
            "home": str(od.paths.home),
            "notes": list(od.startup_notes),
            "queue": list(od.queue),
            "away": od.away.public(),
            "net": od.net.public(),
            "accounts": od.accounts.public(),
            "jobs": len([j for j in od.schedule.jobs if j.get("enabled")]),
            "tour_done": bool(od.settings.get("tour_done")),
            "btw": od.btw.public(),
            "interrupted": list(od.interrupted),
            "feelings": od.feelings.public(),
            "memory_counts": od.memory.counts(),
        }

    def _routes(self) -> list[Route]:
        r = [Route("/", self.index), Route("/static/{name}", self.static), Route("/api/ping", self.ping),
             Route("/pic/{name}", self.picture)]
        for path, fn, methods in (
            ("/api/state", self.state, ["GET"]), ("/api/setup", self.setup, ["GET", "POST"]),
            ("/api/setup/install", self.install, ["POST"]), ("/api/setup/signin", self.signin, ["POST"]),
            ("/api/conversation/{cid}", self.conversation, ["GET"]), ("/api/new_chat", self.new_chat, ["POST"]),
            ("/api/send", self.send, ["POST"]), ("/api/stop", self.stop, ["POST"]), ("/api/mode", self.mode, ["POST"]), ("/api/card", self.card, ["POST"]),
            ("/api/events", self.events, ["GET"]), ("/api/status", self.status, ["GET"]),
            ("/api/selftest", self.selftest, ["POST"]), ("/api/logs", self.logs, ["GET"]),
            ("/api/logs/verify", self.logs_verify, ["GET"]), ("/api/settings", self.settings, ["POST"]),
            ("/api/tools/run", self.tool_run, ["POST"]), ("/api/undo", self.undo, ["POST"]),
            ("/api/export", self.export, ["POST"]),
            ("/api/chat/rename", self.chat_rename, ["POST"]), ("/api/chat/delete", self.chat_delete, ["POST"]),
            ("/api/chat/search", self.chat_search, ["GET"]), ("/api/open", self.open, ["POST"]), ("/api/quit", self.quit, ["POST"]),
            # Piece 3: memory page
            ("/api/queue", self.queue_action, ["POST"]),
            ("/api/accounts", self.accounts_page, ["GET"]), ("/api/accounts/action", self.accounts_action, ["POST"]),
            ("/api/schedule", self.schedule_page, ["GET"]), ("/api/schedule/action", self.schedule_action, ["POST"]),
            ("/api/chat/done", self.chat_done, ["POST"]), ("/api/timemachine", self.timemachine, ["GET", "POST"]), ("/api/selfmod", self.selfmod_page, ["GET", "POST"]), ("/api/feelings", self.feelings_action, ["POST"]), ("/api/imported", self.imported, ["GET", "POST"]), ("/api/upload", self.upload, ["POST"]),
            ("/api/edit", self.edit, ["POST"]), ("/api/interrupted", self.interrupted, ["POST"]), ("/api/btw", self.btw_ask, ["POST"]),
            ("/api/away", self.away_page, ["GET"]), ("/api/away/action", self.away_action, ["POST"]),
            ("/api/memory", self.memory_page, ["GET"]), ("/api/memory/edit", self.memory_edit, ["POST"]),
            ("/api/memory/set", self.memory_set, ["POST"]), ("/api/memory/forget", self.memory_forget, ["POST"]),
            ("/api/memory/import", self.memory_import, ["POST"]), ("/api/memory/undo", self.memory_undo, ["POST"]),
        ):
            r.append(Route(path, fn, methods=methods))
        for path, fn, methods in self.p4_routes():
            r.append(Route(path, fn, methods=methods))
        return r

    @staticmethod
    async def _json(request: Request) -> dict:
        try:
            body = await request.json()
        except Exception:
            body = {}
        return body if isinstance(body, dict) else {}

    # ------------------------------------------------------------------ pages
    async def index(self, request: Request) -> Response:
        html = (UI / "index.html").read_text(encoding="utf-8")
        return Response(html, media_type="text/html", headers={"Content-Security-Policy": CSP,
                                                                "Cache-Control": "no-store"})

    async def static(self, request: Request) -> Response:
        name = request.path_params["name"]
        if name not in STATIC:
            return PlainTextResponse("not found", 404)
        return FileResponse(UI / name, media_type=STATIC[name], headers={"Cache-Control": "no-store"})

    async def picture(self, request: Request) -> Response:
        """A picture shown in a chat. <img> can't send the key header, so the key comes as ?k=."""
        key = request.query_params.get("k", "")
        if not hmac.compare_digest(key.encode(), self.token.encode()):
            return PlainTextResponse("Missing or wrong OVERDRIVE key.", 401)
        name = request.path_params["name"]
        path = self.od.pictures.path(name)
        if path is None:
            return PlainTextResponse("not found", 404)
        from .pictures import MIME
        return FileResponse(path, media_type=MIME[name.rsplit(".", 1)[1]],
                            headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})

    async def ping(self, request: Request) -> Response:
        return JSONResponse({"ok": True, "app": "OVERDRIVE", "version": VERSION})

    # ------------------------------------------------------------------ api
    async def state(self, request: Request) -> Response:
        return JSONResponse(self._state())

    async def setup(self, request: Request) -> Response:
        return JSONResponse(await self.od.check_setup(force=request.method == "POST"))

    async def install(self, request: Request) -> Response:
        body = await self._json(request)
        method = body.get("method", "winget")
        if method not in brain.INSTALL_HELP:
            return JSONResponse({"error": "unknown install method"}, 400)
        cmd = brain.INSTALL_HELP[method]
        self.od.audit.write("setup_install_opened", {"method": method, "command": cmd})
        try:
            brain.open_console(cmd, "Install Claude Code")
        except OSError as e:
            return JSONResponse({"error": str(e), "command": cmd}, 500)
        return JSONResponse({"ok": True, "command": cmd})

    async def signin(self, request: Request) -> Response:
        setup = await self.od.check_setup(force=True)
        if not setup.get("cli"):
            return JSONResponse({"error": "Install Claude Code first."}, 400)
        body = await self._json(request)
        self.od.audit.write("setup_signin_opened", {"long": bool(body.get("long"))})
        res = await self._signin(self.od.accounts.active, long=bool(body.get("long")))
        if not res.get("opened"):
            return JSONResponse({"error": res.get("note") or "couldn't open the sign-in window"}, 500)
        return JSONResponse({"ok": True})

    async def conversation(self, request: Request) -> Response:
        cid = request.path_params["cid"]
        conv = self.od.conversations.get(cid)
        if conv is None:
            return JSONResponse({"error": "no such chat"}, 404)
        tasks = [r.public() for r in self.od.task_store.list(cid)]
        return JSONResponse({"conversation": conv.__dict__, "tasks": tasks})

    async def new_chat(self, request: Request) -> Response:
        if self.od.busy() and not self.od.background_running():
            return JSONResponse({"error": "Wait until the running task is finished."}, 409)
        return JSONResponse({"conversation": self.od.new_conversation().__dict__})

    async def send(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            att = [str(a) for a in body.get("attachments") or [] if isinstance(a, str)][:6]
            rec = await self.od.send(str(body.get("text", "")), body.get("conversation") or None,
                                     mode=body.get("mode") if body.get("mode") in ("chat", "build") else None,
                                     attachments=att)
        except Busy as e:
            if body.get("queue"):
                try:
                    item = self.od.enqueue(str(body.get("text", "")), body.get("conversation") or None,
                                           source=str(body.get("source") or "typed"))
                except ValueError as e2:
                    return JSONResponse({"error": str(e2)}, 400)
                return JSONResponse({"queued": item})
            return JSONResponse({"error": str(e)}, 409)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"task": rec.public()})

    # ------------------------------------------------------------------ accounts (Piece 3)
    async def accounts_page(self, request: Request) -> Response:
        od = self.od
        cli = brain.find_cli(od.settings.get("cli_path"))
        out = od.accounts.public()
        for a in out["accounts"]:
            if cli and not od.test_env:
                st = await brain.auth_status(cli, env=od.accounts.env(a["name"]))
            else:
                st = {"loggedIn": bool(od.test_env), "plan_ok": bool(od.test_env), "method": "test", "email": ""}
            if st.get("loggedIn") and od.accounts.pays(a["name"]) and not st.get("plan_ok"):
                st = {**st, "plan_ok": True, "plan": st.get("plan") or "Pay per message"}
            if st.get("plan"):
                a["plan"] = st["plan"]
                try:
                    od.accounts.set_extra(a["name"], plan=st["plan"])
                except ValueError:
                    pass
            a.update(signed_in=bool(st.get("plan_ok")), logged_in=bool(st.get("loggedIn")), email=st.get("email", ""),
                     note=st.get("note", ""))
        return JSONResponse(out)

    async def accounts_action(self, request: Request) -> Response:
        b = await self._json(request)
        act, od = str(b.get("action") or ""), self.od
        try:
            if act == "add":
                item = od.accounts.add(str(b.get("name") or ""))
                od.audit.write("account_added", {"name": item["name"]})
                return JSONResponse({"added": item["name"], **await self._signin(item["name"])})
            if act == "signin":
                return JSONResponse(await self._signin(str(b.get("name") or "")))
            if act == "switch":
                if od.current is not None and not od.current.rec.background:
                    return JSONResponse({"error": "Wait until the running task is finished."}, 409)
                res = od.accounts.switch(str(b.get("name") or ""), od.usage)
                od._setup_cache = None
                od.audit.write("account_switched", {**res, "by": "you"})
                od.events.publish("usage", usage=od.usage.public())
                od.events.publish("accounts", accounts=od.accounts.public())
                return JSONResponse(res)
            if act == "long_signin":
                # "Stay signed in for a year": Claude Code's setup-token prints a long code you paste here once
                return JSONResponse(await self._signin(str(b.get("name") or ""), long=True))
            if act == "long_token":
                name = str(b.get("name") or "")
                od.accounts.set_long_token(name, str(b.get("token") or ""))
                od._setup_cache = None
                od.audit.write("account_long_signin_saved", {"name": name, "on": bool(b.get("token"))})
                self._kick_signin_watch(name)
                return JSONResponse({"ok": True, "accounts": od.accounts.public()})
            if act == "pay":
                name, on = str(b.get("name") or ""), bool(b.get("on"))
                od.accounts.set_extra(name, pay=on)
                od._setup_cache = None
                od.audit.write("account_pay_per_message", {"name": name, "on": on})
                res: dict = {"ok": True, "pay": on}
                if on:
                    res.update(await self._signin(name, console=True))
                return JSONResponse(res)
            if act == "remove":
                od.accounts.remove(str(b.get("name") or ""))
                od.audit.write("account_removed", {"name": b.get("name")})
                return JSONResponse(od.accounts.public())
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"error": "unknown action"}, 400)

    async def _signin(self, name: str, long: bool = False, console: bool = False) -> dict:
        od = self.od
        if od.accounts.get(name) is None:
            raise ValueError("no such account")
        cli = brain.find_cli(od.settings.get("cli_path"))
        if not cli:
            return {"opened": False, "note": "Install Claude Code first."}
        env = {k: v for k, v in od.accounts.env(name).items() if k != "CLAUDE_CODE_OAUTH_TOKEN"}
        cmd = [cli, "setup-token"] if long else [cli, "auth", "login", "--console" if console else "--claudeai"]
        title = ("Stay signed in: " if long else "Sign in: ") + name
        try:
            brain.open_console(cmd, title, env=env)
        except OSError as e:
            return {"opened": False, "note": str(e)}
        od.audit.write("account_signin_opened", {"name": name, "kind": "year" if long else "console" if console else "claude.ai"})
        if not long:
            self._kick_signin_watch(name)
        return {"opened": True}

    def _kick_signin_watch(self, name: str) -> None:
        """Piece 4 fix: after you sign in, OVERDRIVE sees it by itself within a few seconds (no reload)."""
        old = self.signin_watch.get(name)
        if old and not old.done():
            old.cancel()
        self.signin_watch[name] = asyncio.create_task(self._watch_signin(name))

    async def _watch_signin(self, name: str, every: float = 3.0, minutes: float = 15.0) -> None:
        od = self.od
        cli = brain.find_cli(od.settings.get("cli_path"))
        if not cli:
            return
        end = time.monotonic() + minutes * 60
        while time.monotonic() < end:
            await asyncio.sleep(every)
            try:
                st = await brain.auth_status(cli, env=od.accounts.env(name))
            except Exception:
                continue
            if st.get("loggedIn"):
                od._setup_cache = None
                if st.get("plan"):
                    try:
                        od.accounts.set_extra(name, plan=st["plan"])
                    except ValueError:
                        pass
                setup = await od.check_setup(force=True)
                od.events.publish("setup", setup=setup, account=name, plan=st.get("plan", ""),
                                  ok=bool(st.get("plan_ok") or od.accounts.pays(name)))
                od.events.publish("accounts", accounts=od.accounts.public())
                od.audit.write("account_signed_in_seen", {"name": name, "plan": st.get("plan", "")})
                return

    # ------------------------------------------------------------------ schedule (Piece 3)
    async def schedule_page(self, request: Request) -> Response:
        convs = [{"id": c.id, "title": c.title} for c in sorted(self.od.conversations.values(), key=lambda c: c.created,
                                                                 reverse=True) if not c.done][:60]
        return JSONResponse({"jobs": self.od.schedule.jobs, "chats": convs})

    async def schedule_action(self, request: Request) -> Response:
        b = await self._json(request)
        act, od = str(b.get("action") or ""), self.od
        job = b.get("job") if isinstance(b.get("job"), dict) else {}
        try:
            if act == "add":
                res = od.schedule.add(job, by="you")
            elif act == "update":
                res = od.schedule.update(str(b.get("id") or ""), job)
            elif act == "delete":
                od.schedule.delete(str(b.get("id") or ""))
                res = {"deleted": b.get("id")}
            elif act == "run":
                j = od.schedule.get(str(b.get("id") or ""))
                if j is None:
                    raise ValueError("no such job")
                if od.current is not None and not od.current.rec.background:
                    return JSONResponse({"error": "Wait until the running task is finished."}, 409)
                conv = od.conversations.get(j.get("conversation") or "") or od.new_conversation(j["title"])
                conv.mode = j["mode"]
                rec = await od.send(j["text"], conv.id)
                res = {"task": rec.id, "conversation": conv.id}
            else:
                return JSONResponse({"error": "unknown action"}, 400)
        except (ValueError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)
        od.audit.write("schedule_" + act, {"id": b.get("id"), "job": job, "by": "you"})
        od.events.publish("schedule", jobs=od.schedule.jobs)
        return JSONResponse(res)

    async def imported(self, request: Request) -> Response:
        """Your old claude.ai chats: list (GET), one chat (GET ?key=), import / keep going / remove (POST)."""
        od = self.od
        if request.method == "GET":
            key = request.query_params.get("key")
            if key:
                d = od.archive.get(key)
                return JSONResponse(d) if d else JSONResponse({"error": "not found"}, 404)
            q = request.query_params.get("q", "").strip()
            if q:
                return JSONResponse({"hits": await asyncio.to_thread(od.archive.search, q[:200])})
            return JSONResponse({"folders": od.archive.folders()})
        b = await self._json(request)
        act = str(b.get("action") or "")
        try:
            if act == "import":
                from .chatimport import ImportFailed
                path = str(b.get("path") or "").strip().strip('"')
                if not path:
                    return JSONResponse({"error": "Paste the export zip's path first."}, 400)
                try:
                    res = await asyncio.to_thread(od.archive.import_export, Path(path).expanduser(), str(b.get("account") or ""))
                except (ImportFailed, OSError, ValueError) as e:
                    return JSONResponse({"error": str(e)}, 400)
                od.audit.write("chats_imported", {k: res[k] for k in ("account", "chats", "added", "updated")})
                return JSONResponse(res)
            if act == "continue":
                text = od.archive.continue_text(str(b.get("key") or ""))
                meta = od.archive.index[str(b.get("key"))]
                conv = od.new_conversation(meta["name"][:60])
                rec = await od.send(text, conv.id)
                return JSONResponse({"task": rec.public(), "conversation": conv.id})
            if act == "remove":
                return JSONResponse({"removed": od.archive.remove_account(str(b.get("account") or ""))})
        except (ValueError, KeyError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"error": "unknown action"}, 400)

    async def timemachine(self, request: Request) -> Response:
        tm = self.od.timemachine
        if request.method == "GET":
            return JSONResponse({"versions": tm.versions(request.query_params.get("project", ""))})
        b = await self._json(request)
        name, vid, act = str(b.get("project") or ""), str(b.get("version") or ""), str(b.get("action") or "")
        try:
            if act == "save":
                v = await asyncio.to_thread(tm.snapshot, name, "saved by you")
                res = {"saved": bool(v)}
            elif act == "open_copy":
                res = {"folder": await asyncio.to_thread(tm.open_copy, name, vid)}
            elif act == "go_back":
                if self.od.current is not None and not self.od.current.rec.background:
                    return JSONResponse({"error": "Wait until the running task is finished."}, 409)
                res = await asyncio.to_thread(tm.go_back, name, vid)
            else:
                return JSONResponse({"error": "unknown action"}, 400)
        except (ValueError, OSError) as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.audit.write("timemachine_" + act, {"project": name, "version": vid, "by": "you"})
        return JSONResponse(res)

    async def selfmod_page(self, request: Request) -> Response:
        sm = self.od.selfmod
        if request.method == "GET":
            return JSONResponse({"versions": sm.versions(), "state": sm.state()})
        b = await self._json(request)
        name = str(b.get("name") or "")
        v = next((x for x in sm.versions() if x["name"] == name), None)
        if v is None:
            return JSONResponse({"error": "no such version"}, 400)
        if self.od.current is not None and not self.od.current.rec.background:
            return JSONResponse({"error": "Wait until the running task is finished."}, 409)
        try:
            await asyncio.to_thread(sm.restore, Path(v["path"]), "you went back to it")
        except (ValueError, OSError) as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.audit.write("self_update_restored", {"version": name, "by": "you"})
        self.od.events.publish("restart", why="went back to an older version")
        asyncio.create_task(self._restart_soon())
        return JSONResponse({"ok": True})

    async def _restart_soon(self) -> None:
        await asyncio.sleep(1.5)
        from .selfmod import restart_now
        self.od.audit.write("app_restart", {"why": "its own update"})
        restart_now(Path(__file__).resolve().parent.parent)
        self.should_exit.set()

    async def feelings_action(self, request: Request) -> Response:
        b = await self._json(request)
        f, act = self.od.feelings, str(b.get("action") or "")
        try:
            if act == "add_want":
                f.add_want(str(b.get("text") or ""), by="you")
            elif act == "drop_want":
                f.drop_want(str(b.get("id") or ""))
            elif act in ("upgrade_on", "upgrade_off", "upgrade_delete"):
                f.set_upgrade(str(b.get("id") or ""), on=act == "upgrade_on", delete=act == "upgrade_delete")
            else:
                return JSONResponse({"error": "unknown action"}, 400)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.audit.write("feelings_" + act, {"by": "you", **{k: b.get(k) for k in ("id", "text")}})
        self.od.events.publish("feelings", feelings=f.public())
        return JSONResponse(f.public())

    async def upload(self, request: Request) -> Response:
        """A picture you drop, paste or attach in the chat. Saved in OVERDRIVE's picture folder (checked: real
        JPEG/PNG/GIF/WebP only), sent to Claude with your message so it can look at it."""
        import base64
        b = await self._json(request)
        data = str(b.get("data") or "")
        if "," in data[:100]:
            data = data.split(",", 1)[1]
        try:
            raw = base64.b64decode(data, validate=True)
        except Exception:
            return JSONResponse({"error": "That file didn't come through right."}, 400)
        if len(raw) > 15 * 1024 * 1024:
            return JSONResponse({"error": "That picture is too big (15 MB max)."}, 400)
        from .pictures import PictureError
        try:
            name = self.od.pictures.put(raw)
        except PictureError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.audit.write("picture_uploaded", {"file": name, "bytes": len(raw)})
        return JSONResponse({"file": name})

    async def edit(self, request: Request) -> Response:
        b = await self._json(request)
        att = [str(a) for a in b.get("attachments") or [] if isinstance(a, str)][:6]
        try:
            rec = await self.od.edit_message(str(b.get("task") or ""), str(b.get("text") or ""), att)
        except (ValueError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"task": rec.public()})

    async def interrupted(self, request: Request) -> Response:
        b = await self._json(request)
        tid = str(b.get("task") or "")
        if b.get("action") == "leave":
            self.od.interrupted = [x for x in self.od.interrupted if x["task"] != tid]
            return JSONResponse({"ok": True})
        try:
            rec = await self.od.keep_going(tid)
        except (ValueError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"task": rec.public()})

    async def btw_ask(self, request: Request) -> Response:
        b = await self._json(request)
        try:
            return JSONResponse({"item": self.od.btw.ask(str(b.get("text") or ""))})
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)

    async def chat_done(self, request: Request) -> Response:
        b = await self._json(request)
        try:
            return JSONResponse({"conversation": self.od.set_chat_done(str(b.get("conversation") or ""),
                                                                       bool(b.get("done")))})
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)

    # ------------------------------------------------------------------ while you're away (Piece 3)
    async def away_page(self, request: Request) -> Response:
        od = self.od
        projects = await asyncio.to_thread(od.projects.list)
        bugs = od.away.bugs.open_bugs()
        per = {}
        for b in bugs:
            per[b["project"]] = per.get(b["project"], 0) + 1
        for p in projects:
            p["bugs"] = per.get(p["name"], 0)
            p["checked"] = (od.away.bugs.data.get(p["name"]) or {}).get("checked")
        learned = [r.to_dict() for r in od.memory.list(("fact", "experience"), limit=200) if "learned" in r.tags][:40]
        ok, why = od.away.can_learn()
        return JSONResponse({"away": od.away.public(), "projects": projects, "bugs": bugs[:500], "learned": learned,
                             "can_learn": ok, "why_not": why, "five_hour": od.away.five_hour()})

    async def away_action(self, request: Request) -> Response:
        b = await self._json(request)
        act, od = str(b.get("action") or ""), self.od
        try:
            if act == "done":
                res = od.projects.set_done(str(b.get("project") or ""), bool(b.get("done")))
                od.audit.write("project_done", {"project": res["name"], "done": res.get("done"), "by": "you"})
            elif act == "check":
                res = await od.away.hunt_now(str(b.get("project") or ""))
            elif act == "dismiss":
                res = {"ok": od.away.bugs.dismiss(str(b.get("bug") or ""))}
            elif act == "seen":
                od.away.mark_seen()
                res = {"ok": True}
            elif act == "learn_now":
                if od.current is not None:
                    return JSONResponse({"error": "Wait until the running task is finished."}, 409)
                res = {"task": await od.away.start_learning()}
            else:
                return JSONResponse({"error": "unknown action"}, 400)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse(res)

    async def queue_action(self, request: Request) -> Response:
        b = await self._json(request)
        qid, action = str(b.get("id") or ""), str(b.get("action") or "")
        try:
            if action == "remove":
                self.od.unqueue(qid)
            elif action == "send":
                await self.od.send_queued(qid)
            else:
                return JSONResponse({"error": "unknown action"}, 400)
        except (ValueError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"queue": self.od.queue})

    async def mode(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            conv = self.od.set_mode(str(body.get("conversation") or ""), str(body.get("mode") or ""))
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"conversation": conv})

    async def stop(self, request: Request) -> Response:
        return JSONResponse({"stopped": await self.od.stop()})

    async def card(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            card = self.od.answer_card(str(body.get("id")), str(body.get("status")), body.get("answer"),
                                       str(body.get("note") or ""))
        except (KeyError, ValueError) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"card": card})

    async def events(self, request: Request) -> Response:
        since = int(request.query_params.get("since", "0") or 0)
        q, backlog = self.od.events.subscribe(since)

        async def gen():
            self.streams += 1
            try:
                for ev in backlog:
                    yield json.dumps(ev, default=str) + "\n"
                while True:
                    try:
                        ev = await asyncio.wait_for(q.get(), 15)
                        yield json.dumps(ev, default=str) + "\n"
                    except asyncio.TimeoutError:
                        yield json.dumps({"type": "ping", "t": time.time()}) + "\n"
                    self.last_stream_seen = time.monotonic()
            finally:
                self.streams -= 1
                self.last_stream_seen = time.monotonic()
                self.od.events.unsubscribe(q)
        return StreamingResponse(gen(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store",
                                                                                     "X-Accel-Buffering": "no"})

    async def status(self, request: Request) -> Response:
        st = selftest.latest_results(self.od.paths.data)
        grid = registry.grid(st.get("results", {}))
        recent = self.od.task_store.list(limit=50)
        done = [r for r in recent if r.duration_ms]
        perf = {"tasks": len(recent),
                "avg_task_s": round(sum(r.duration_ms for r in done) / len(done) / 1000, 1) if done else None,
                "status_counts": {s: sum(1 for r in recent if r.status == s) for s in ("done", "partly", "failed", "blocked")}}
        slow: dict[str, list[int]] = {}
        for r in recent:
            for c in r.calls:
                slow.setdefault(c["tool"], []).append(int(c.get("ms") or 0))
        perf["tool_ms"] = {k: {"avg": int(sum(v) / len(v)), "max": max(v), "n": len(v)} for k, v in slow.items()}
        limitations_file = _docs_dir() / "LIMITATIONS.md"
        return JSONResponse({
            "grid": grid, "compat": await compat_info(self.od), "selftest": {k: v for k, v in st.items() if k != "results"},
            "selftest_results": st.get("results", {}), "selftest_running": self.selftest_running, "perf": perf,
            "tools": [t.public() for t in self.od.tools.all()],
            "limitations": limitations_file.read_text(encoding="utf-8") if limitations_file.exists() else "",
        })

    async def selftest(self, request: Request) -> Response:
        if self.selftest_running:
            return JSONResponse({"error": "Self-tests are already running."}, 409)
        if self.od.busy():
            return JSONResponse({"error": "Wait until the running task is finished."}, 409)
        body = await self._json(request)
        include_e2e = bool(body.get("e2e", True))
        only = set(body["only"]) if isinstance(body.get("only"), list) else None
        self.selftest_running = True
        self.od.audit.write("selftest_started", {"e2e": include_e2e, "only": sorted(only) if only else None})
        loop = asyncio.get_running_loop()
        cli = brain.find_cli(self.od.settings.get("cli_path"))

        def progress(name: str, result: dict) -> None:
            self.od.events.publish("selftest", name=name, result=result)

        async def go():
            try:
                summary = await loop.run_in_executor(None, lambda: selftest.run_all(
                    self.od.paths.data, include_e2e=include_e2e, cli=cli, only=only, progress=progress))
                self.od.audit.write("selftest_finished", {k: summary.get(k) for k in ("passed", "failed", "skipped", "regressions")})
                self.od.events.publish("selftest_done", summary={k: summary.get(k) for k in
                                                                 ("passed", "failed", "skipped", "regressions", "when")})
            except Exception as e:
                self.od.events.publish("selftest_done", summary={"error": repr(e)})
            finally:
                self.selftest_running = False
        asyncio.create_task(go())
        return JSONResponse({"started": True})

    async def logs(self, request: Request) -> Response:
        p = request.query_params
        kinds = {k for k in (p.get("kinds") or "").split(",") if k} or None
        entries = self.od.audit.read(day=p.get("day") or None, task=p.get("task") or None, kinds=kinds,
                                     query=p.get("q") or None, limit=min(int(p.get("limit", "300") or 300), 2000))
        return JSONResponse({"days": self.od.audit.days(), "entries": entries})

    async def logs_verify(self, request: Request) -> Response:
        return JSONResponse(await asyncio.to_thread(self.od.audit.verify))

    async def settings(self, request: Request) -> Response:
        body = await self._json(request)
        changes = body.get("changes")
        if not isinstance(changes, dict):
            return JSONResponse({"error": "changes must be an object"}, 400)
        try:
            diff = self.od.settings.update(changes, by="you (settings page)")
        except SettingsError as e:
            return JSONResponse({"error": str(e)}, 400)
        if "cli_path" in diff:
            await self.od.check_setup(force=True)
        if "start_with_windows" in diff:
            from .autostart import apply
            note = apply(bool(diff["start_with_windows"][1]))
            if note:
                return JSONResponse({"changed": diff, "settings": self.od.settings.all(), "note": note})
        return JSONResponse({"changed": diff, "settings": self.od.settings.all()})

    async def tool_run(self, request: Request) -> Response:
        body = await self._json(request)
        args = body.get("args") if isinstance(body.get("args"), dict) else {}
        try:
            return JSONResponse(await self.od.run_tool_manually(str(body.get("tool")), args))
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)

    async def undo(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            return JSONResponse(self.od.undo_task(str(body.get("task"))))
        except (ValueError, Busy) as e:
            return JSONResponse({"error": str(e)}, 400)

    async def chat_rename(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            conv = self.od.rename_conversation(str(body.get("conversation") or ""), str(body.get("title") or ""))
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"conversation": conv})

    async def chat_delete(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            res = self.od.delete_conversation(str(body.get("conversation") or ""))
        except Busy as e:
            return JSONResponse({"error": str(e)}, 409)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse(res)

    async def chat_search(self, request: Request) -> Response:
        q = request.query_params.get("q", "")[:200]
        return JSONResponse({"hits": await asyncio.to_thread(self.od.search_conversations, q)})

    # ------------------------------------------------------------------ memory page (Piece 3)
    async def memory_page(self, request: Request) -> Response:
        p = request.query_params
        from .memory import CATEGORIES, CATEGORY_NAMES
        cat = p.get("cat", "all")
        if cat not in CATEGORIES and cat != "all":
            cat = "all"
        status = "archived" if p.get("archived") == "1" else "active"
        try:
            limit, offset = int(p.get("limit", "100") or 100), int(p.get("offset", "0") or 0)
        except ValueError:
            limit, offset = 100, 0
        page = await asyncio.to_thread(self.od.memory.page, cat, p.get("q", "")[:300], status, limit, offset)
        return JSONResponse({**page, "counts": await asyncio.to_thread(self.od.memory.counts),
                             "names": CATEGORY_NAMES, "save": self.od.settings.get("memory_save")})

    async def memory_edit(self, request: Request) -> Response:
        b = await self._json(request)
        tags = b.get("tags")
        if tags is not None and (not isinstance(tags, list) or not all(isinstance(t, str) for t in tags)):
            return JSONResponse({"error": "tags must be a list of words"}, 400)
        try:
            row = self.od.memory_edit(str(b.get("id") or ""), b.get("title"), b.get("content"), tags)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.events.publish("memory_changed", op="edit")
        return JSONResponse({"row": row})

    async def memory_set(self, request: Request) -> Response:
        b = await self._json(request)
        try:
            row = self.od.memory_set(str(b.get("id") or ""), str(b.get("action") or ""))
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.events.publish("memory_changed", op=str(b.get("action")))
        return JSONResponse({"row": row})

    async def memory_forget(self, request: Request) -> Response:
        b = await self._json(request)
        try:
            res = self.od.memory_forget(str(b.get("id") or ""))
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        self.od.events.publish("memory_changed", op="forget")
        return JSONResponse(res)

    async def memory_import(self, request: Request) -> Response:
        b = await self._json(request)
        path = str(b.get("path") or "").strip().strip('"')
        if not path:
            return JSONResponse({"error": "Type the folder or .zip path first."}, 400)
        try:
            res = await asyncio.to_thread(self.od.memory_import, Path(path))
        except (ValueError, OSError) as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse(res)

    async def memory_undo(self, request: Request) -> Response:
        b = await self._json(request)
        try:
            return JSONResponse(self.od.undo_memory(str(b.get("task") or ""), int(b.get("index", -1))))
        except (ValueError, TypeError) as e:
            return JSONResponse({"error": str(e)}, 400)

    async def export(self, request: Request) -> Response:
        path = await asyncio.to_thread(self.od.export_zip)
        return JSONResponse({"file": str(path), "name": path.name})

    async def open(self, request: Request) -> Response:
        body = await self._json(request)
        target = {"workspace": self.od.paths.workspace, "exports": self.od.paths.exports, "home": self.od.paths.home,
                  "versions": self.od.paths.versions, "logs": self.od.paths.logs}.get(str(body.get("what")))
        if target is None:
            return JSONResponse({"error": "unknown folder"}, 400)
        try:
            open_folder(target)
        except OSError as e:
            return JSONResponse({"error": str(e)}, 500)
        return JSONResponse({"ok": True, "path": str(target)})

    async def quit(self, request: Request) -> Response:
        if self.od.busy():
            await self.od.stop()
        self.od.audit.write("app_quit", {"by": "you (Quit button)"})
        self.should_exit.set()
        return JSONResponse({"ok": True})

    # ------------------------------------------------------------------ lifecycle
    async def watch_idle(self, idle_s: float = 60) -> None:
        """Close OVERDRIVE when no window has been open for a while and nothing is running."""
        while not self.should_exit.is_set():
            await asyncio.sleep(5)
            idle = time.monotonic() - self.last_stream_seen
            if self.od.settings.get("keep_running"):
                continue      # Piece 3: it keeps working while you're away (Settings > Quit ends it)
            if self.streams == 0 and idle > idle_s and not self.od.busy() and not self.selftest_running:
                self.od.audit.write("app_quit", {"by": "window closed"})
                self.should_exit.set()


class _Guard:
    """ASGI middleware: Host check, Origin check, secret token on every /api call."""

    def __init__(self, app, server: Server):
        self.app, self.server = app, server

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        port = self.server.port
        allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        path = scope.get("path", "")

        async def deny(code: int, msg: str):
            resp = PlainTextResponse(msg, code)
            await resp(scope, receive, send)

        if headers.get("host") not in allowed_hosts:
            return await deny(403, "OVERDRIVE only answers its own window.")
        origin = headers.get("origin")
        if origin and origin not in {f"http://{h}" for h in allowed_hosts}:
            return await deny(403, "Requests from other sites are blocked.")
        if path.startswith("/api/") and path != "/api/ping":
            token = headers.get("x-od-token", "")
            if not hmac.compare_digest(token.encode(), self.server.token.encode()):
                return await deny(401, "Missing or wrong OVERDRIVE key.")
        return await self.app(scope, receive, send)


def _docs_dir() -> Path:
    here = Path(__file__).resolve().parent.parent
    return here if (here / "LIMITATIONS.md").exists() else here.parent


# ---------------------------------------------------------------------- running
DEFAULT_PORT = 47311   # the same address every start (saved window settings stay with it)


def _bind() -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    want = os.environ.get("OVERDRIVE_PORT", "").strip()
    if want:
        s.bind(("127.0.0.1", int(want or 0)))
    else:
        try:
            s.bind(("127.0.0.1", DEFAULT_PORT))
        except OSError:                       # taken by something else: any free port still works
            s.close()
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(("127.0.0.1", 0))
    s.listen(64)
    s.setblocking(False)
    return s


def existing_instance(od_home: Path) -> str | None:
    """If OVERDRIVE is already running, return its window URL."""
    info = read_json(od_home / "data" / "running.json", None)
    if not isinstance(info, dict):
        return None
    import urllib.request
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{int(info['port'])}/api/ping", timeout=2) as r:
            if json.loads(r.read()).get("app") == "OVERDRIVE":
                return info.get("url")
    except Exception:
        return None
    return None


async def serve(od: Overdrive, open_ui: bool = True) -> None:
    import uvicorn
    server = Server(od)
    sock = _bind()
    server.port = sock.getsockname()[1]
    url = f"http://127.0.0.1:{server.port}/#t={server.token}"
    od.events.bind_loop(asyncio.get_running_loop())
    atomic_write_json(od.paths.data / "running.json", {"port": server.port, "url": url, "pid": os.getpid()})
    config = uvicorn.Config(server.app, log_level="warning", access_log=False, lifespan="off", timeout_graceful_shutdown=2)
    userver = uvicorn.Server(config)
    od.audit.write("window_server", {"port": server.port})
    serve_task = asyncio.create_task(userver.serve(sockets=[sock]))
    if open_ui:
        await asyncio.sleep(0.3)
        open_window(url, od.paths.data / "window-profile")
    idle_task = asyncio.create_task(server.watch_idle())
    away_task = asyncio.create_task(od.away.run())
    net_task = asyncio.create_task(od.net.run())
    sched_task = asyncio.create_task(od.run_schedule())

    async def auto_resume() -> None:
        # power-cut proof: give you 25 seconds to say "leave it", then keep going by itself
        await asyncio.sleep(25)
        if od.settings.get("auto_resume") and od.interrupted and od.current is None:
            try:
                await od.keep_going(od.interrupted[0]["task"])
            except Exception as e:
                od.audit.write("auto_resume_failed", {"error": repr(e)[:300]})
    resume_task = asyncio.create_task(auto_resume())

    async def watch_restart() -> None:
        # after "Yes, install it": restart into the new version once the answer is finished
        while True:
            await asyncio.sleep(1)
            if od.restart_requested and od.current is None and not os.environ.get("OVERDRIVE_NO_RESTART"):
                od.restart_requested = False
                await server._restart_soon()
                return

    async def confirm_start() -> None:
        await asyncio.sleep(15)
        od.selfmod.started_ok()        # the new version is up: no going back by itself anymore
    restart_task = asyncio.create_task(watch_restart())
    confirm_task = asyncio.create_task(confirm_start())
    od.pictures.cleanup(int(od.settings.get("pictures_keep_days")), int(od.settings.get("pictures_max_mb")))
    try:
        await server.should_exit.wait()
    finally:
        idle_task.cancel()
        away_task.cancel()
        net_task.cancel()
        sched_task.cancel()
        resume_task.cancel()
        restart_task.cancel()
        confirm_task.cancel()
        if od.busy():
            await od.stop()
        userver.should_exit = True
        try:
            await asyncio.wait_for(serve_task, 5)
        except Exception:
            pass
        try:
            (od.paths.data / "running.json").unlink()
        except OSError:
            pass
