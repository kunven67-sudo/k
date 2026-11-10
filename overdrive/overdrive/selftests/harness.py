"""Test helpers: a fake Claude (Anthropic Messages API look-alike on 127.0.0.1)
and a way to drive OVERDRIVE end to end with the REAL Claude Code CLI.
Costs $0: no request ever leaves your PC.
"""
from __future__ import annotations

import asyncio
import itertools
import json
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

from .. import selftest


class FakeClaude:
    """script(request_json, fake) -> list of blocks | ("error", status, body) | ("delay", seconds, blocks)
    blocks: {"type": "text", "text": ...} or {"type": "tool_use", "name": ..., "input": {...}}"""

    def __init__(self, script: Callable[[dict, "FakeClaude"], Any]):
        self.script = script
        self.requests: list[dict] = []
        self._ids = itertools.count(1)
        fake = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *a: Any) -> None:
                pass

            def _json(self, code: int, obj: Any) -> None:
                b = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self) -> None:
                self._json(200, {"data": [], "has_more": False})

            def do_POST(self) -> None:
                try:
                    n = int(self.headers.get("content-length") or 0)
                    req = json.loads(self.rfile.read(n) or b"{}") if n else {}
                    if not self.path.startswith("/v1/messages") or "count_tokens" in self.path:
                        return self._json(200, {"input_tokens": 10})
                    fake.requests.append(req)
                    out = fake.script(req, fake)
                    if isinstance(out, tuple) and out[0] == "error":
                        return self._json(out[1], out[2])
                    delay = 0.0
                    if isinstance(out, tuple) and out[0] == "delay":
                        delay, out = out[1], out[2]
                    fake._stream(self, req, out, delay)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def _stream(self, h: BaseHTTPRequestHandler, req: dict, blocks: list[dict], delay: float) -> None:
        model = req.get("model", "claude-opus-5-5")
        h.send_response(200)
        h.send_header("content-type", "text/event-stream")
        h.send_header("cache-control", "no-cache")
        h.send_header("connection", "close")
        h.end_headers()

        def ev(name: str, d: dict) -> None:
            h.wfile.write(f"event: {name}\ndata: {json.dumps(d)}\n\n".encode())
            h.wfile.flush()

        ev("message_start", {"type": "message_start", "message": {
            "id": f"msg_{next(self._ids)}", "type": "message", "role": "assistant", "model": model, "content": [],
            "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 120, "output_tokens": 1}}})
        stop = "end_turn"
        for i, b in enumerate(blocks):
            if b["type"] == "text":
                ev("content_block_start", {"type": "content_block_start", "index": i, "content_block": {"type": "text", "text": ""}})
                words = b["text"].split(" ")
                for j, w in enumerate(words):
                    if delay:
                        time.sleep(delay / max(1, len(words)))
                    ev("content_block_delta", {"type": "content_block_delta", "index": i,
                                               "delta": {"type": "text_delta", "text": w if j == 0 else " " + w}})
                ev("content_block_stop", {"type": "content_block_stop", "index": i})
            else:
                stop = "tool_use"
                ev("content_block_start", {"type": "content_block_start", "index": i, "content_block": {
                    "type": "tool_use", "id": b.get("id") or f"toolu_{next(self._ids):05d}", "name": b["name"], "input": {}}})
                ev("content_block_delta", {"type": "content_block_delta", "index": i,
                                           "delta": {"type": "input_json_delta", "partial_json": json.dumps(b["input"])}})
                ev("content_block_stop", {"type": "content_block_stop", "index": i})
        ev("message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None},
                             "usage": {"output_tokens": 40}})
        ev("message_stop", {"type": "message_stop"})
        h.close_connection = True


# ---------------------------------------------------------------------------
# request helpers
# ---------------------------------------------------------------------------
def system_text(req: dict) -> str:
    s = req.get("system")
    if isinstance(s, list):
        return " ".join(x.get("text", "") for x in s if isinstance(x, dict))
    return str(s or "")


def is_overdrive_main(req: dict) -> bool:
    return "You are OVERDRIVE" in system_text(req)


def turn_index(req: dict) -> int:
    """How many assistant turns happened since the human's latest message."""
    msgs = req.get("messages", [])
    last_human = 0
    for i, m in enumerate(msgs):
        if m.get("role") == "user":
            c = m.get("content")
            if isinstance(c, str) or not any(isinstance(x, dict) and x.get("type") == "tool_result" for x in (c or [])):
                last_human = i
    return sum(1 for m in msgs[last_human:] if m.get("role") == "assistant")


def tool_results(req: dict) -> list[tuple[str, str, bool]]:
    """(tool name, text, is_error) for tool results in the last user message."""
    msgs = req.get("messages", [])
    names = {}
    for m in msgs:
        if m.get("role") == "assistant" and isinstance(m.get("content"), list):
            for c in m["content"]:
                if isinstance(c, dict) and c.get("type") == "tool_use":
                    names[c["id"]] = c["name"]
    out = []
    # Claude Code may add system notes (e.g. "USD budget: ...") after the tool results: skip them.
    last_user = next((m for m in reversed(msgs) if m.get("role") == "user"), None)
    if last_user and isinstance(last_user.get("content"), list):
        for c in last_user["content"]:
            if isinstance(c, dict) and c.get("type") == "tool_result":
                cont = c.get("content")
                txt = cont if isinstance(cont, str) else "".join(
                    x.get("text", "") for x in (cont or []) if isinstance(x, dict))
                out.append((names.get(c.get("tool_use_id"), "?"), txt, bool(c.get("is_error"))))
    return out


def T(name: str, **inp: Any) -> dict:
    """A tool_use block for an OVERDRIVE tool."""
    full = name if name.startswith("mcp__") or name == "AskUserQuestion" else f"mcp__overdrive__{name}"
    return {"type": "tool_use", "name": full, "input": inp}


def X(text: str) -> dict:
    return {"type": "text", "text": text}


def turns_script(turns: list[list[dict]], checker_verdict: dict | None = None):
    """Main OVERDRIVE requests get turns[i]; the double-checker gets checker_verdict; anything else gets 'ok'."""
    def script(req: dict, fake: FakeClaude):
        if is_overdrive_main(req):
            i = turn_index(req)
            return turns[i] if i < len(turns) else [X("(fake Claude has nothing more to say)")]
        if "check other AI work" in system_text(req):
            return [X(json.dumps(checker_verdict or {"status": "done", "reason": "journal matches"}))]
        return [X("ok")]
    return script


PLAN = dict(goal="Test goal", success_criteria=["The thing is done"], needs=[])


def report(status: str = "done", met: bool = True, evidence: str = "tool result shows it worked", **extra: Any) -> dict:
    d = dict(status=status, criteria=[dict(criterion="The thing is done", met=met, evidence=evidence)],
             summary="Fake summary of the task.", confidence="high", verified=[], assumptions=[], unknowns=[])
    d.update(extra)
    return d


# ---------------------------------------------------------------------------
# running OVERDRIVE end to end
# ---------------------------------------------------------------------------
def make_agent(root: Path, fake: FakeClaude, double_check: bool = False, **settings: Any):
    from ..agent import Overdrive
    cfg = root / "claude-config"
    cfg.mkdir(parents=True, exist_ok=True)
    env = {"ANTHROPIC_BASE_URL": fake.url, "ANTHROPIC_API_KEY": "sk-ant-test-fake-key-not-real",
           "CLAUDE_CONFIG_DIR": str(cfg), "CLAUDE_CODE_OAUTH_TOKEN": "", "ANTHROPIC_AUTH_TOKEN": ""}
    if not double_check:
        env["OVERDRIVE_TEST_NO_DOUBLE_CHECK"] = "1"
    od = Overdrive(home=root / "home", test_env=env)
    od.settings.update({"cli_path": selftest.CLI or "", "max_minutes": 3, **settings}, by="test")
    return od


def run_task(od, text: str, answer: Callable[[Any], tuple] | None = None, on_start: Callable | None = None,
             timeout: float = 150, conversation: str | None = None):
    """Send one message and wait for the task to finish. answer(card) -> (status, answer, note)."""
    async def main():
        loop = asyncio.get_running_loop()
        od.events.bind_loop(loop)
        rec = await od.send(text, conversation)
        if on_start:
            asyncio.create_task(on_start(od))
        deadline = time.monotonic() + timeout
        while od.current is not None:
            if time.monotonic() > deadline:
                await od.stop()
                raise AssertionError("task took too long")
            for card in od.broker.open_cards():
                if answer is None:
                    od.answer_card(card.id, "no", note="test default: no")
                else:
                    res = answer(card)
                    if res is None:      # leave the card open (e.g. to test STOP)
                        continue
                    status, ans, note = res
                    od.answer_card(card.id, status, ans, note)
            await asyncio.sleep(0.05)
        return od.task_store.load(rec.id)
    return asyncio.run(main())


def with_fake(script, fn):
    """Run fn(root, fake) with a fresh temp folder and fake Claude, cleaning up after."""
    fake = FakeClaude(script)
    tmp = Path(tempfile.mkdtemp(prefix="overdrive-e2e-"))
    try:
        return fn(tmp, fake)
    finally:
        fake.close()
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
