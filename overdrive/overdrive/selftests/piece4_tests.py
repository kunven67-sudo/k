"""Piece 4 self-tests: its own window, its own ears, sign-in that sees itself, plan badges, the year-long sign-in,
pay per message, and the rest of Piece 4 (added part by part)."""
from __future__ import annotations

import http.server
import io
import os
import threading
import time
import zipfile
from pathlib import Path

from ..selftest import TempDir, covers


class _Files(http.server.BaseHTTPRequestHandler):
    files: dict = {}

    def do_GET(self):  # noqa: N802
        body = self.files.get(self.path)
        if body is None:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def serve_files(files: dict) -> tuple[str, http.server.HTTPServer]:
    handler = type("H", (_Files,), {"files": files})
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}", srv


def _zip(entries: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in entries.items():
            z.writestr(name, data)
    return buf.getvalue()


@covers(2901, 2902, title="Voice pack: downloads once, unpacks into its own folder, refuses bad zips")
def test_voice_pack_download():
    from ..voice import Voice
    good = _zip({"vosk-model-small-en-us-0.15/am/final.mdl": b"x" * 1000, "vosk-model-small-en-us-0.15/conf/model.conf": b"c"})
    bad = _zip({"../../evil.txt": b"nope"})
    wheel = _zip({f"vosk/{f}": b"dll" for f in ("libvosk.dll", "libstdc++-6.dll", "libgcc_s_seh-1.dll", "libwinpthread-1.dll")})
    base, srv = serve_files({"/good.zip": good, "/bad.zip": bad, "/vosk.whl": wheel})
    old = os.environ.get("OVERDRIVE_VOICE_MODEL_URL")
    os.environ["OVERDRIVE_VOICE_ENGINE_URL"] = base + "/vosk.whl"
    try:
        with TempDir() as tmp:
            evs: list = []
            v = Voice(tmp, lambda t, **k: evs.append(k))
            os.environ["OVERDRIVE_VOICE_MODEL_URL"] = base + "/good.zip"
            assert not v.have_model("small")
            v.download("small")
            t = time.time()
            while v.downloading and time.time() - t < 20:
                time.sleep(0.05)
            assert v.have_model("small"), (evs, list((tmp / "voice").rglob("*")))
            assert any(e.get("kind") == "download_done" for e in evs), evs
            assert not list((tmp / "voice").glob("*.part")) and not list((tmp / "voice").glob("*.unpack"))
            if not v.engine_ok() or os.name == "nt":       # the engine's 4 DLLs came with it
                assert (tmp / "voice" / "engine" / "libvosk.dll").read_bytes() == b"dll"
            # a zip that tries to write outside the voice folder is refused
            os.environ["OVERDRIVE_VOICE_MODEL_URL"] = base + "/bad.zip"
            v.download("better")
            t = time.time()
            while v.downloading and time.time() - t < 20:
                time.sleep(0.05)
            assert not v.have_model("better")
            assert not (tmp / "evil.txt").exists() and not (tmp.parent / "evil.txt").exists()
            assert any(e.get("kind") == "error" for e in evs), evs
    finally:
        srv.shutdown()
        os.environ.pop("OVERDRIVE_VOICE_ENGINE_URL", None)
        if old is None:
            os.environ.pop("OVERDRIVE_VOICE_MODEL_URL", None)
        else:
            os.environ["OVERDRIVE_VOICE_MODEL_URL"] = old


@covers(2903, 2904, title="Its own ears: words come in while you talk (partial), then the final words")
def test_voice_hears():
    from ..voice import Voice, VoiceError
    model = os.environ.get("OVERDRIVE_TEST_VOSK_MODEL", "")
    wav = os.environ.get("OVERDRIVE_TEST_VOSK_WAV", "")
    with TempDir() as tmp:
        evs: list = []
        v = Voice(tmp, lambda t, **k: evs.append(k))
        if not (model and wav and Path(model).is_dir() and v.status()["engine"]):
            # no voice pack on this machine: starting must ask for the download, not crash
            os.environ["OVERDRIVE_VOICE_MODEL_URL"] = "http://127.0.0.1:9/none.zip"
            try:
                v.start("dict")
                raise AssertionError("should need the voice pack first")
            except VoiceError as e:
                assert str(e) in ("downloading",) or "missing" in str(e), e
            finally:
                os.environ.pop("OVERDRIVE_VOICE_MODEL_URL", None)
                t = time.time()
                while v.downloading and time.time() - t < 10:
                    time.sleep(0.05)
            return
        (tmp / "voice").mkdir()
        try:
            (tmp / "voice" / "vosk-model-small-en-us-0.15").symlink_to(model, target_is_directory=True)
        except OSError:
            import shutil
            shutil.copytree(model, tmp / "voice" / "vosk-model-small-en-us-0.15")
        os.environ["OVERDRIVE_VOICE_WAV"], os.environ["OVERDRIVE_VOICE_FAST"] = wav, "1"
        try:
            sid = v.start("dict")
            t = time.time()
            while v.listening and time.time() - t < 60:
                time.sleep(0.1)
        finally:
            os.environ.pop("OVERDRIVE_VOICE_WAV", None)
            os.environ.pop("OVERDRIVE_VOICE_FAST", None)
        finals = [e["text"] for e in evs if e.get("kind") == "final" and e.get("session") == sid]
        assert finals and any("zero" in f or "one" in f for f in finals), evs[-6:]
        assert any(e.get("kind") == "partial" for e in evs), "no words while talking"
        assert any(e.get("kind") == "level" for e in evs), "no mic loudness"
        assert evs[-1].get("kind") == "end"


@covers(4501, 4502, title="Accounts: plan badge, pay per message is opt-in, the year-long code is locked away")
def test_accounts_plan_and_year_code():
    from ..accounts import Accounts
    from ..brain import plan_name
    assert plan_name("pro", "", "claude.ai", True) == "Pro"
    assert plan_name("max", "default_claude_max_20x", "claude.ai", True) == "Max 20x"
    assert plan_name("free", "", "claude.ai", True) == "Free"
    assert plan_name(None, None, "console", True) == "Pay per message"
    assert plan_name("pro", "", "claude.ai", False) == ""
    with TempDir() as tmp:
        a = Accounts(tmp / "home", tmp / "data")
        assert a.env() == {} and not a.pays()
        try:
            a.set_long_token("main", "not a code")
            raise AssertionError("bad code accepted")
        except ValueError:
            pass
        code = "sk-ant-oat01-" + "A1b2_C3d-" * 6
        a.set_long_token("main", code)
        assert a.env()["CLAUDE_CODE_OAUTH_TOKEN"] == code and a.has_long_token()
        raw = (tmp / "data" / "secrets.json").read_text()
        assert code not in raw and "accounts.json" and code not in (tmp / "data" / "accounts.json").read_text()
        b = Accounts(tmp / "home", tmp / "data")          # survives a restart
        assert b.env()["CLAUDE_CODE_OAUTH_TOKEN"] == code
        assert b.public()["accounts"][0]["long_token"] is True
        b.set_extra("main", pay=True, plan="Pay per message")
        assert Accounts(tmp / "home", tmp / "data").pays("main")
        b.set_long_token("main", "")
        assert "CLAUDE_CODE_OAUTH_TOKEN" not in b.env()


@covers(3101, title="Its own window: OVERDRIVE.exe --window is used when it's there, Edge only as a backup")
def test_own_window_pick():
    from .. import server
    with TempDir() as tmp:
        exe = tmp / "OVERDRIVE.exe"
        exe.write_bytes(b"MZ")
        old = os.environ.get("OVERDRIVE_EXE")
        os.environ["OVERDRIVE_EXE"] = str(exe)
        try:
            assert server.app_exe() == exe
        finally:
            if old is None:
                os.environ.pop("OVERDRIVE_EXE", None)
            else:
                os.environ["OVERDRIVE_EXE"] = old
        os.environ["OVERDRIVE_EXE"] = str(tmp / "missing.exe")
        try:
            assert server.app_exe() is None or server.app_exe() != tmp / "missing.exe"
        finally:
            os.environ.pop("OVERDRIVE_EXE", None)
