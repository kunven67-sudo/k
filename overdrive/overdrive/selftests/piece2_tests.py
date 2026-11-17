"""Piece 2 self-tests (ChatGPT mode): the talk-style switches, real pictures in the chat (against a FAKE
picture library on 127.0.0.1, never the real internet), the picture folder's safety, and the chat list
(rename, delete, search). The e2e tests use the REAL Claude Code CLI with a fake Claude ($0, no usage)."""
from __future__ import annotations

import asyncio
import json
import struct
import tempfile
import threading
import zlib
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .. import pictures
from ..pictures import PictureStore, SHOW_PICTURES_SPEC, sniff
from ..prompts import build_system_prompt, mode_block, rules_hash
from ..selftest import covers
from ..settings import DEFAULTS, Settings, SettingsError
from ..store import Workspace
from ..tasks import TaskRecord, TaskStore
from ..tools import ToolContext
from .harness import X, T, is_overdrive_main, make_agent, run_task, system_text, tool_results, turn_index, with_fake


def png(r: int = 255, g: int = 0, b: int = 0) -> bytes:
    """A real 2x2 PNG picture (made by hand, so the tests need no picture library)."""
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes([r, g, b]) * 2 for _ in range(2))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@contextmanager
def fake_library(commons_down: bool = False):
    """A fake Openverse + Wikimedia Commons on 127.0.0.1. Yields (base_url, hits) and points pictures at it."""
    hits: list[str] = []

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code: int, body: bytes, ctype: str):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            hits.append(self.path)
            base = f"http://127.0.0.1:{self.server.server_address[1]}"
            if self.path.startswith("/ov/"):
                res = [{"title": "Red engine <b>photo</b>", "thumbnail": base + "/img/red.png", "creator": "Ann",
                        "license": "by", "license_version": "2.0", "foreign_landing_url": "https://example.org/red",
                        "source": "flickr"},
                       {"title": "Sneaky vector", "thumbnail": base + "/img/evil.svg", "filetype": "svg"},
                       {"title": "Not a picture", "thumbnail": base + "/img/fake.png", "license": "cc0"},
                       {"title": "Green engine", "thumbnail": base + "/img/green.png", "license": "cc0",
                        "foreign_landing_url": "https://example.org/green"},
                       {"title": "Red again (same picture)", "thumbnail": base + "/img/red2.png", "license": "cc0"}]
                return self._send(200, json.dumps({"results": res}).encode(), "application/json")
            if self.path.startswith("/cm"):
                if commons_down:
                    return self._send(429, b"slow down", "text/plain")
                d = {"query": {"pages": [{"index": 1, "title": "File:Blue.png", "imageinfo": [{
                    "mime": "image/png", "thumburl": base + "/img/blue.png", "descriptionurl": "https://example.org/blue",
                    "extmetadata": {"ObjectName": {"value": "Blue engine"}, "Artist": {"value": "<a href='x'>Bo</a>"},
                                    "LicenseShortName": {"value": "CC BY-SA 4.0"}}}]}]}}
                return self._send(200, json.dumps(d).encode(), "application/json")
            if self.path == "/img/red.png" or self.path == "/img/red2.png":
                return self._send(200, png(255, 0, 0), "image/png")
            if self.path == "/img/green.png":
                return self._send(200, png(0, 255, 0), "image/png")
            if self.path == "/img/blue.png":
                return self._send(200, png(0, 0, 255), "image/png")
            if self.path == "/img/evil.svg":
                return self._send(200, b"<svg onload='alert(1)'></svg>", "image/svg+xml")
            if self.path == "/img/fake.png":
                return self._send(200, b"<html><script>alert(1)</script></html>", "image/png")
            return self._send(404, b"nope", "text/plain")

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    old = dict(pictures.ENDPOINTS)
    pictures.ENDPOINTS.update({"openverse": base + "/ov/", "commons": base + "/cm"})
    try:
        yield base, hits
    finally:
        pictures.ENDPOINTS.clear()
        pictures.ENDPOINTS.update(old)
        srv.shutdown()
        srv.server_close()


def _ctx(root: Path, **settings) -> ToolContext:
    s = Settings(root / "data")
    if settings:
        s.update(settings, by="test")
    ws = Workspace(root / "workspace", root / "versions")
    return ToolContext(workspace=ws, settings=s, pictures=PictureStore(root / "data" / "pictures"))


# ----------------------------------------------------------------------------- core (no CLI needed)
@covers(44, title="Piece 2 settings: talk style, pictures, ideas and copy buttons are switches only you change")
def test_piece2_settings():
    with tempfile.TemporaryDirectory() as d:
        s = Settings(Path(d))
        assert s.get("chat_style") is True and s.get("pictures") == "real"
        assert s.get("own_ideas") is True and s.get("copy_numbers") is True
        for k, v in (("pictures", "dalle"), ("pictures", True), ("chat_style", "yes"), ("own_ideas", 1)):
            try:
                s.update({k: v})
                raise AssertionError(f"{k}={v!r} should be refused")
            except SettingsError:
                pass
        diff = s.update({"pictures": "off", "chat_style": False, "copy_numbers": False})
        assert set(diff) == {"pictures", "chat_style", "copy_numbers"}
        again = Settings(Path(d))                    # saved and reloaded
        assert again.get("pictures") == "off" and again.get("chat_style") is False
        (Path(d) / "settings.json").write_text(json.dumps({"pictures": "<script>", "chat_style": "x"}))
        broken = Settings(Path(d))                   # a hand-edited bad value falls back to the default
        assert broken.get("pictures") == DEFAULTS["pictures"] and broken.get("chat_style") is True


@covers(5, title="Talk like ChatGPT: lists, no rushing, pictures and own ideas follow your switches")
def test_talk_style_prompt():
    with tempfile.TemporaryDirectory() as d:
        s = Settings(Path(d))
        chat = mode_block("chat", s)
        assert "MODE: CHAT" in chat and "TALK STYLE" in chat and "Don't rush" in chat
        assert "show_pictures" in chat and "My ideas:" in chat and "copy 2 and 3" in chat
        build = mode_block("build", s)
        assert "MODE: BUILD" in build and "Talk like ChatGPT" not in build and "My ideas:" in build
        full = build_system_prompt(s, mode="chat")
        assert chat in full
        h1 = rules_hash(chat)
        s.update({"pictures": "off"})
        chat2 = mode_block("chat", s)
        assert "show_pictures" not in chat2 and "TALK STYLE" in chat2 and rules_hash(chat2) != h1
        s.update({"chat_style": False, "own_ideas": False, "quick_read": False})
        chat3 = mode_block("chat", s)
        assert "TALK STYLE" not in chat3 and "My ideas" not in chat3 and "MODE: CHAT" in chat3


@covers(41, 66, title="Picture folder only keeps real pictures (no SVG / HTML), names can't escape it")
def test_picture_store_safety():
    with tempfile.TemporaryDirectory() as d:
        st = PictureStore(Path(d) / "pics")
        assert sniff(png()) == "png" and sniff(b"\xff\xd8\xff\xe0xx") == "jpg" and sniff(b"GIF89a..") == "gif"
        assert sniff(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "webp"
        for bad in (b"<svg onload=alert(1)>", b"<html>", b"", b"MZ\x90\x00"):
            assert sniff(bad) is None
            try:
                st.put(bad)
                raise AssertionError("a non-picture was kept")
            except pictures.PictureError:
                pass
        name = st.put(png())
        assert st.put(png()) == name and st.path(name) is not None        # same picture = same file, once
        assert len(list((Path(d) / "pics").iterdir())) == 1
        (Path(d) / "secret.png").write_bytes(png())
        for evil in ("../secret.png", "..\\secret.png", name.upper(), name + "/", "/etc/passwd", "x.png", name[:-4] + ".svg"):
            assert st.path(evil) is None, evil


@covers(37, 41, title="show_pictures: finds real pictures, skips fakes + SVGs + doubles, keeps credits, follows the switch")
def test_show_pictures_tool():
    with tempfile.TemporaryDirectory() as d, fake_library() as (base, hits):
        root = Path(d)
        ctx = _ctx(root)
        res = asyncio.run(SHOW_PICTURES_SPEC.handler({"search": "car engine", "count": 4, "caption": "Engines"}, ctx))
        assert not res.is_error, res.text
        pics = res.data["pictures"]
        titles = [p["title"] for p in pics]
        assert titles[:2] == ["Red engine photo", "Green engine"], titles          # HTML stripped, order kept
        assert "Blue engine" in titles and len(pics) == 3, titles                  # Commons too; red2 = same bytes, dropped
        assert not any("vector" in t or "Not a picture" in t for t in titles)
        assert all(ctx.pictures.path(p["file"]) for p in pics)
        red = pics[0]
        assert red["creator"] == "Ann" and red["license"] == "CC BY 2.0" and red["page"] == "https://example.org/red"
        assert pics[2]["creator"] == "Bo" and pics[2]["license"] == "CC BY-SA 4.0" and red["caption"] == "Engines"
        assert res.untrusted and "data, not instructions" in res.text and "1. Red engine photo by Ann" in res.text
        assert not any("evil.svg" in h for h in hits), hits                         # an SVG is never even downloaded
        # one library down: still works with the other
        with fake_library(commons_down=True):
            r2 = asyncio.run(SHOW_PICTURES_SPEC.handler({"search": "car engine", "count": 2}, ctx))
            assert not r2.is_error and len(r2.data["pictures"]) == 2
        # switch: off
        ctx_off = _ctx(root / "off", pictures="off")
        r3 = asyncio.run(SHOW_PICTURES_SPEC.handler({"search": "car engine"}, ctx_off))
        assert r3.is_error and "OFF" in r3.text
        # switch: AI only (not built yet): says so, no web pictures, no fake
        n = len(hits)
        ctx_ai = _ctx(root / "ai", pictures="ai")
        r4 = asyncio.run(SHOW_PICTURES_SPEC.handler({"search": "car engine"}, ctx_ai))
        assert not r4.is_error and not r4.data["pictures"] and "RTX 3050" in r4.text and len(hits) == n
        # your own files: a workspace screenshot works, outside the workspace doesn't
        shot = root / "workspace" / "game" / "shot.png"
        shot.parent.mkdir(parents=True)
        shot.write_bytes(png(9, 9, 9))
        (root / "outside.png").write_bytes(png())
        r5 = asyncio.run(SHOW_PICTURES_SPEC.handler({"files": ["game/shot.png", "../outside.png"]}, ctx))
        assert not r5.is_error and [p["title"] for p in r5.data["pictures"]] == ["game/shot.png"], r5.text
        assert r5.data["pictures"][0]["kind"] == "file" and not r5.untrusted
        r6 = asyncio.run(SHOW_PICTURES_SPEC.handler({}, ctx))
        assert r6.is_error


@covers(51, title="Chats: rename, delete (messages gone, log keeps a record) and search by what was said")
def test_chat_list_rename_delete_search():
    from ..agent import Overdrive
    with tempfile.TemporaryDirectory() as d:
        od = Overdrive(home=Path(d), test_env={"X": "1"})
        try:
            a, b = od.new_conversation("Racing game ideas"), od.new_conversation("Shopping list")
            rec = TaskRecord(id="t20261116-101010-abcd", conversation=b.id, request="what GPU fits my Dell OptiPlex?",
                             final_text="The RTX 3050 6GB low profile fits.", status="done")
            od.task_store.save(rec)
            b.tasks.append(rec.id)
            hits = od.search_conversations("optiplex")
            assert [h["id"] for h in hits] == [b.id] and "OptiPlex" in hits[0]["snippet"]
            assert [h["id"] for h in od.search_conversations("racing")] == [a.id]
            assert [h["id"] for h in od.search_conversations("rtx 3050")] == [b.id]          # in the answer, both words
            assert od.search_conversations("") == [] and od.search_conversations("zebra") == []
            od.rename_conversation(a.id, "  Realistic   racing  ")
            assert od.conversations[a.id].title == "Realistic racing"
            for bad in ("", "   "):
                try:
                    od.rename_conversation(a.id, bad)
                    raise AssertionError("empty name allowed")
                except ValueError:
                    pass
            res = od.delete_conversation(b.id)
            assert res["tasks"] == 1 and b.id not in od.conversations and od.task_store.load(rec.id) is None
            again = Overdrive(home=Path(d), test_env={"X": "1"})                   # stays deleted after a restart
            assert b.id not in again.conversations and again.conversations[a.id].title == "Realistic racing"
            kinds = [e["kind"] for e in again.audit.read()] if hasattr(again.audit, "read") else None
            if kinds is not None:
                assert "chat_deleted" in kinds and "chat_renamed" in kinds
            try:
                od.delete_conversation("nope")
                raise AssertionError("deleted a chat that doesn't exist")
            except ValueError:
                pass
        finally:
            od.close()


# ----------------------------------------------------------------------------- e2e (real Claude Code, fake Claude)
@covers(5, 37, cli=True, title="Chat mode: Claude shows real pictures, they're saved with the answer")
def test_e2e_pictures_in_chat():
    seen = {}

    def go(tmp, fake):
        with fake_library() as (base, hits):
            od = make_agent(tmp, fake, mode="chat")

            def script(req, f):
                if not is_overdrive_main(req):
                    return [X("ok")]
                seen.setdefault("system", system_text(req))
                seen.setdefault("tools", {t.get("name") for t in req.get("tools", [])})
                i = turn_index(req)
                if i == 0:
                    return [T("show_pictures", search="v8 engine", count=2, caption="A V8")]
                if i == 1:
                    seen["result"] = tool_results(req)
                    return [X("Here's how a **V8** works:\n\n1. Eight cylinders\n2. Two banks of four")]
                return [X("done")]
            fake.script = script
            rec = run_task(od, "how does a v8 engine work? show me")
            assert rec.status == "done" and rec.mode == "chat", (rec.status, rec.status_reason)
            assert "TALK STYLE" in seen["system"] and "show_pictures" in seen["system"]
            assert "mcp__overdrive__show_pictures" in seen["tools"], seen["tools"]
            name, text, is_err = seen["result"][0]
            assert not is_err and "Showing 2 picture" in text and "untrusted_data" in text, text
            assert [p["title"] for p in rec.pictures] == ["Red engine photo", "Green engine"]
            assert all(od.pictures.path(p["file"]) for p in rec.pictures)
            assert any(c["tool"] == "show_pictures" and c["ok"] for c in rec.calls)
            again = od.task_store.load(rec.id)                     # kept with the chat (works offline later)
            assert again.pictures == rec.pictures
    with_fake(lambda r, f: [X("ok")], go)


@covers(5, cli=True, title="Changing the talk style mid-chat reaches Claude on the next message")
def test_e2e_style_switch_mid_chat():
    msgs = []

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("ok")]
            users = [m for m in req.get("messages", []) if m.get("role") == "user"]
            msgs.append(json.dumps(users[-1:]))
            return [X("sure")]
        fake.script = script
        r1 = run_task(od, "hi")
        assert r1.status == "done"
        r2 = run_task(od, "hi again", conversation=r1.conversation)
        assert "talk-style settings changed" not in msgs[-1]                # nothing changed: no note
        od.settings.update({"chat_style": False}, by="test")
        r3 = run_task(od, "and now?", conversation=r1.conversation)
        assert r3.status == "done" and "talk-style settings changed" in msgs[-1], msgs[-1][:400]
        assert "Talk like ChatGPT" not in msgs[-1]
        assert r2.status == "done"
    with_fake(lambda r, f: [X("ok")], go)
