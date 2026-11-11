"""The window: a local web page shown in an Edge app window.

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
STATIC = {"app.js": "text/javascript", "app.css": "text/css", "logo.svg": "image/svg+xml",
          "favicon.svg": "image/svg+xml"}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; "
       "font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")


async def compat_info(od: Overdrive) -> dict:
    setup = await od.check_setup()
    return {"overdrive": VERSION, "stage": STAGE, "python": platform.python_version(), "os": platform.platform(),
            "agent_sdk": SDK_VERSION, "claude_code": setup.get("version") or "not found",
            "claude_code_path": setup.get("cli") or "", "edge": find_edge() or "not found",
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


def open_window(url: str, profile: Path) -> None:
    """Open the OVERDRIVE window: Edge in app mode with its own small profile."""
    edge = find_edge()
    if edge and not os.environ.get("OVERDRIVE_NO_WINDOW"):
        args = [edge, f"--app={url}", f"--user-data-dir={profile}", "--window-size=1320,880",
                "--no-first-run", "--no-default-browser-check", "--disable-features=Translate"]
        flags = brain.NO_WINDOW if platform.system() == "Windows" else 0
        subprocess.Popen(args, creationflags=flags, close_fds=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif not os.environ.get("OVERDRIVE_NO_WINDOW"):
        webbrowser.open(url)


def open_folder(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    if platform.system() == "Windows":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif shutil.which("xdg-open"):
        subprocess.Popen(["xdg-open", str(path)])


class Server:
    def __init__(self, od: Overdrive, token: str | None = None):
        self.od = od
        self.token = token or secrets.token_urlsafe(24)
        self.port = 0
        self.streams = 0
        # +60 s grace: the first window start (Edge making its profile) can be slow on older PCs.
        self.last_stream_seen = time.monotonic() + 60
        self.selftest_running = False
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
        }

    def _routes(self) -> list[Route]:
        r = [Route("/", self.index), Route("/static/{name}", self.static), Route("/api/ping", self.ping)]
        for path, fn, methods in (
            ("/api/state", self.state, ["GET"]), ("/api/setup", self.setup, ["GET", "POST"]),
            ("/api/setup/install", self.install, ["POST"]), ("/api/setup/signin", self.signin, ["POST"]),
            ("/api/conversation/{cid}", self.conversation, ["GET"]), ("/api/new_chat", self.new_chat, ["POST"]),
            ("/api/send", self.send, ["POST"]), ("/api/stop", self.stop, ["POST"]), ("/api/card", self.card, ["POST"]),
            ("/api/events", self.events, ["GET"]), ("/api/status", self.status, ["GET"]),
            ("/api/selftest", self.selftest, ["POST"]), ("/api/logs", self.logs, ["GET"]),
            ("/api/logs/verify", self.logs_verify, ["GET"]), ("/api/settings", self.settings, ["POST"]),
            ("/api/tools/run", self.tool_run, ["POST"]), ("/api/undo", self.undo, ["POST"]),
            ("/api/export", self.export, ["POST"]), ("/api/open", self.open, ["POST"]), ("/api/quit", self.quit, ["POST"]),
        ):
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
        self.od.audit.write("setup_signin_opened", {})
        try:
            brain.open_console([setup["cli"], "auth", "login"], "Sign in to Claude")
        except OSError as e:
            return JSONResponse({"error": str(e)}, 500)
        return JSONResponse({"ok": True})

    async def conversation(self, request: Request) -> Response:
        cid = request.path_params["cid"]
        conv = self.od.conversations.get(cid)
        if conv is None:
            return JSONResponse({"error": "no such chat"}, 404)
        tasks = [r.public() for r in self.od.task_store.list(cid)]
        return JSONResponse({"conversation": conv.__dict__, "tasks": tasks})

    async def new_chat(self, request: Request) -> Response:
        if self.od.busy():
            return JSONResponse({"error": "Wait until the running task is finished."}, 409)
        return JSONResponse({"conversation": self.od.new_conversation().__dict__})

    async def send(self, request: Request) -> Response:
        body = await self._json(request)
        try:
            rec = await self.od.send(str(body.get("text", "")), body.get("conversation") or None)
        except Busy as e:
            return JSONResponse({"error": str(e)}, 409)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, 400)
        return JSONResponse({"task": rec.public()})

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
def _bind() -> socket.socket:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", int(os.environ.get("OVERDRIVE_PORT", "0") or 0)))
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
    try:
        await server.should_exit.wait()
    finally:
        idle_task.cancel()
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
