"""OVERDRIVE's engine: runs tasks through the Claude Code link with every
safety system switched on (rules 1, 14, 15, 29, 32-35, 37, 40, 41, 46, 64,
72, 76, 79, 80, 82, 84, 95, 100).
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import platform
import secrets
import sys
import time
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import VERSION, brain, builtin, shield
from .audit import AuditLog
from .basic_tools import register_basic_tools
from .events import EventBus
from .journal import Entry, Journal
from .jsonio import atomic_write_json, read_json, utc_now_iso
from .limits import Usage
from .memory import Memory
from .memory import MemoryError as MemoryError_
from .memory_tools import is_sensitive, register_memory_tools
from .paths import Paths, default_home
from .permissions import Broker, Card, Grants, Risk, decide
from .pictures import SHOW_PICTURES_SPEC, PictureStore
from .prompts import build_system_prompt, mode_block, mode_switch_note, rules_hash
from .settings import Settings
from .store import Workspace
from .tasks import TaskRecord, TaskStore, check_task, merge_double_check, new_task_id, summarize_args
from .tools import ToolContext, ToolRegistry, ToolResult, ToolSpec

try:  # The Agent SDK is needed for the brain, not for offline tools / tests of the core.
    from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, CLINotFoundError,
                                  PermissionResultAllow, PermissionResultDeny, RateLimitEvent, ResultMessage,
                                  StreamEvent, SystemMessage, TextBlock, ToolResultBlock, ToolUseBlock, UserMessage,
                                  create_sdk_mcp_server, tool)
    from claude_agent_sdk import __version__ as SDK_VERSION
except Exception as _e:  # pragma: no cover
    ClaudeSDKClient = None  # type: ignore[assignment]
    SDK_VERSION = f"missing ({_e})"

READ_RISKS = (Risk.INTERNAL, Risk.READ)
TOOL_TIMEOUT_S = 60


class Busy(Exception):
    pass


class NotReady(Exception):
    pass


@dataclass
class Conversation:
    id: str
    title: str
    created: str
    session_id: str = ""
    cost_total: float = 0.0
    tasks: list[str] = field(default_factory=list)
    mode: str = "chat"          # "chat" (talk, look things up, plan) or "build" (makes, runs and tests things)
    session_mode: str = ""      # the mode the Claude Code session started in (its instructions keep that mode)
    session_rules: str = ""     # fingerprint of the mode + talk-style rules the session started with (Piece 2)
    model: str = ""             # per-chat model/effort picked for a big job ("" = use Settings)
    effort: str = ""


@dataclass
class RunState:
    rec: TaskRecord
    conv: Conversation
    journal: Journal = field(default_factory=Journal)
    client: Any = None
    stopped: bool = False
    limit: str = ""
    started: float = field(default_factory=time.monotonic)
    first_token_ms: int | None = None
    pending: dict[str, list[Entry]] = field(default_factory=dict)
    texts: list[tuple[int, str]] = field(default_factory=list)   # (tool_uses_seen_before, text)
    tool_uses_seen: int = 0
    stderr: list[str] = field(default_factory=list)
    result: Any = None
    error_kind: str = ""
    error_text: str = ""
    retries: list[dict] = field(default_factory=list)
    builtin_pending: dict[str, list[dict]] = field(default_factory=dict)  # allowed Claude Code calls waiting for a result
    tool_use_ids: dict[str, tuple[str, dict]] = field(default_factory=dict)
    file_changes: dict[str, dict] = field(default_factory=dict)          # workspace file -> change record (Undo)
    build_go: dict | None = None                                          # start_build said Yes: continue in Build mode

    def final_text(self) -> str:
        if not self.texts:
            return ""
        last = max(n for n, _ in self.texts)
        after = [t for n, t in self.texts if n == last and n == self.tool_uses_seen]
        chosen = after if after else [t for _, t in self.texts]
        return "\n\n".join(t.strip() for t in chosen if t.strip())


class Overdrive:
    def __init__(self, home: Path | None = None, test_env: dict | None = None):
        self.paths = Paths(Path(home) if home else default_home()).ensure()
        self.audit = AuditLog(self.paths.logs)
        self.settings = Settings(self.paths.data, self.audit)
        self.usage = Usage(self.paths.data)
        self.workspace = Workspace(self.paths.workspace, self.paths.versions)
        self.task_store = TaskStore(self.paths.tasks)
        self.memory = Memory(self.paths.data / "memory")
        self.tools = ToolRegistry()
        register_basic_tools(self.tools)
        register_memory_tools(self.tools)
        self.tools.add(START_BUILD_SPEC)
        self.pictures = PictureStore(self.paths.pictures)
        self.tools.add(SHOW_PICTURES_SPEC)
        self.grants = Grants()
        self.events = EventBus()
        self.broker = Broker(on_change=self._card_changed)
        self.test_env = test_env
        self.current: RunState | None = None
        self._run_task_handle: asyncio.Task | None = None
        self._go_build_handle: asyncio.Task | None = None
        self.default_mode = "chat"     # new chats start in Chat mode (talk first, build on Yes)
        self._setup_cache: tuple[float, dict] | None = None
        self._conv_path = self.paths.data / "conversations.json"
        self.conversations: dict[str, Conversation] = {}
        self._load_conversations()
        self.startup_notes: list[str] = []      # shown once in the window (e.g. "I read your memory pack")
        self.queue: list[dict] = []             # Piece 3: messages you sent (typed or said) while it was busy
        self._queue_paused = False              # STOP pauses the queue until you send again
        self.removed_env = [] if test_env else brain.clean_env_for_plan()
        self.audit.on_write(lambda e: self.events.publish("log", entry={k: e[k] for k in ("seq", "ts", "kind", "task")}))
        self.audit.write("app_start", {
            "version": VERSION, "python": sys.version.split()[0], "os": platform.platform(), "sdk": SDK_VERSION,
            "home": str(self.paths.home), "removed_api_vars": self.removed_env, "test_mode": bool(test_env),
            "audit_recovered": self.audit.recovered_note,
        })

    # ------------------------------------------------------------------ conversations
    def _load_conversations(self) -> None:
        raw = read_json(self._conv_path, []) or []
        for c in raw if isinstance(raw, list) else []:
            try:
                conv = Conversation(**{k: v for k, v in c.items() if k in Conversation.__dataclass_fields__})
                self.conversations[conv.id] = conv
            except TypeError:
                continue

    def _save_conversations(self) -> None:
        atomic_write_json(self._conv_path, [c.__dict__ for c in self.conversations.values()])

    def new_conversation(self, title: str = "New chat") -> Conversation:
        conv = Conversation(id="c" + secrets.token_hex(5), title=title[:80], created=utc_now_iso(),
                            mode=self.default_mode)
        self.conversations[conv.id] = conv
        self._save_conversations()
        return conv

    # ------------------------------------------------------------------ setup
    async def check_setup(self, force: bool = False) -> dict:
        if self._setup_cache and not force and time.monotonic() - self._setup_cache[0] < 60:
            return self._setup_cache[1]
        cli = brain.find_cli(self.settings.get("cli_path"))
        out: dict[str, Any] = {"cli": cli, "version": None, "auth": None, "ready": False, "problem": "", "kind": ""}
        if ClaudeSDKClient is None:
            out.update(problem="The Claude Agent SDK library is missing from this OVERDRIVE build.", kind="error")
        elif not cli:
            out.update(problem=brain.FRIENDLY["not_installed"], kind="not_installed")
        else:
            out["version"] = await brain.cli_version(cli)
            if not out["version"]:
                out.update(problem=f"Found Claude Code at {cli} but it didn't answer. Try reinstalling it.", kind="error")
            elif self.test_env:
                out.update(auth={"loggedIn": True, "method": "test (fake Claude)", "plan_ok": True, "note": ""},
                           ready=True)
            else:
                out["auth"] = await brain.auth_status(cli)
                if not out["auth"].get("plan_ok"):
                    out.update(problem=out["auth"].get("note") or brain.FRIENDLY["auth"], kind="auth")
                else:
                    out["ready"] = True
        self._setup_cache = (time.monotonic(), out)
        return out

    # ------------------------------------------------------------------ events
    def _card_changed(self, what: str, card: Card) -> None:
        self.events.publish(what, card=card.public())

    def _emit_task(self, rec: TaskRecord) -> None:
        self.events.publish("task", task=rec.public())

    # ------------------------------------------------------------------ public actions
    def busy(self) -> bool:
        return self.current is not None

    async def send(self, text: str, conversation_id: str | None = None, mode: str | None = None) -> TaskRecord:
        text = (text or "").strip()
        if not text:
            raise ValueError("empty message")
        if len(text) > 20000:
            raise ValueError("message is too long (20,000 characters max)")
        if self.current is not None:
            raise Busy("OVERDRIVE is still working on the last task. Wait for it, or press STOP.")
        conv = self.conversations.get(conversation_id or "")
        if conv is None:
            conv = self.new_conversation(text[:60])
            if mode in ("chat", "build"):
                conv.mode = mode
        if conv.title == "New chat":
            conv.title = text[:60]
        rec = TaskRecord(id=new_task_id(), conversation=conv.id, request=text)
        rec.mode = conv.mode if conv.mode in ("chat", "build") else "chat"
        rec.settings = {k: self.settings.get(k) for k in ("model", "fallback_model", "effort", "detail", "max_steps",
                                                          "max_minutes", "task_budget_usd", "double_check")}
        rec.settings["model"] = conv.model or rec.settings["model"]
        rec.settings["effort"] = conv.effort or rec.settings["effort"]
        rec.settings["mode"] = rec.mode
        conv.tasks.append(rec.id)
        self._save_conversations()
        st = RunState(rec=rec, conv=conv)
        self.current = st
        self.task_store.save(rec)
        self.audit.write("task_start", {"request": text, "conversation": conv.id, "settings": rec.settings}, task=rec.id)
        self._emit_task(rec)
        self._run_task_handle = asyncio.create_task(self._run_task(st))
        return rec

    # ------------------------------------------------------------------ queue (Piece 3: talk to it mid-build)
    MAX_QUEUE = 10

    def enqueue(self, text: str, conversation_id: str | None = None, source: str = "typed") -> dict:
        """A message sent while a task runs waits here and goes in right after (no 'busy' error)."""
        text = (text or "").strip()
        if not text:
            raise ValueError("empty message")
        if len(text) > 20000:
            raise ValueError("message is too long (20,000 characters max)")
        if len(self.queue) >= self.MAX_QUEUE:
            raise ValueError(f"{self.MAX_QUEUE} messages are already waiting. Wait a bit, or remove one.")
        conv = conversation_id or (self.current.conv.id if self.current else None)
        item = {"id": "q" + secrets.token_hex(4), "text": text, "conversation": conv, "source": source,
                "ts": utc_now_iso()}
        self.queue.append(item)
        self._queue_paused = False
        self.audit.write("queued", {"text": text, "conversation": conv, "source": source})
        self.events.publish("queue", queue=list(self.queue))
        if self.current is None:
            self._kick_queue()
        return item

    def unqueue(self, qid: str) -> None:
        before = len(self.queue)
        self.queue = [q for q in self.queue if q["id"] != qid]
        if len(self.queue) == before:
            raise ValueError("that message isn't waiting anymore")
        self.events.publish("queue", queue=list(self.queue))

    async def send_queued(self, qid: str) -> TaskRecord:
        item = next((q for q in self.queue if q["id"] == qid), None)
        if item is None:
            raise ValueError("that message isn't waiting anymore")
        if self.current is not None:
            raise Busy("It's still working. Your message goes in by itself when this step is done.")
        self.queue.remove(item)
        self._queue_paused = False
        self.events.publish("queue", queue=list(self.queue))
        return await self.send(self._queued_text(item), item["conversation"])

    @staticmethod
    def _queued_text(item: dict) -> str:
        how = "said" if item.get("source") == "voice" else "sent"
        return f"(I {how} this while you were working on the last message.) {item['text']}"

    def _kick_queue(self) -> None:
        try:
            asyncio.get_running_loop().create_task(self._drain_queue())
        except RuntimeError:
            pass

    async def _drain_queue(self) -> None:
        await asyncio.sleep(0.8)       # after an automatic "GO, build it" follow-up has had its turn
        if self.current is not None or not self.queue or self._queue_paused:
            return
        item = self.queue.pop(0)
        self.events.publish("queue", queue=list(self.queue))
        try:
            await self.send(self._queued_text(item), item["conversation"])
        except Busy:
            self.queue.insert(0, item)
            self.events.publish("queue", queue=list(self.queue))
        except Exception as e:
            self.audit.write("queue_send_failed", {"error": repr(e), "text": item["text"]})

    async def wait_current(self, timeout: float = 600) -> TaskRecord | None:
        h = self._run_task_handle
        if h is None:
            return None
        await asyncio.wait_for(asyncio.shield(h), timeout)
        return h.result()

    async def stop(self) -> bool:
        st = self.current
        if st is None:
            return False
        st.stopped = True
        self.audit.write("stop_pressed", {}, task=st.rec.id)
        self.broker.cancel_all("stopped")
        if st.client is not None:
            try:
                await asyncio.wait_for(st.client.interrupt(), 10)
            except Exception:
                pass
        return True

    def answer_card(self, card_id: str, status: str, answer: Any = None, note: str = "") -> dict:
        card = self.broker.resolve(card_id, status, answer, note)
        self.audit.write("card_answered", {"card": card.id, "kind": card.kind, "status": status,
                                           "answer": answer, "note": note, "title": card.title}, task=card.task_id)
        return card.public()

    # ------------------------------------------------------------------ the gate (can_use_tool)
    def _make_gate(self, st: RunState):
        async def gate(name: str, inp: dict, ctx) -> Any:
            try:
                return await self._gate(st, name, inp if isinstance(inp, dict) else {}, ctx)
            except Exception as e:  # never let a bug in the gate turn into an allow
                self.audit.write("gate_error", {"tool": name, "error": repr(e)}, task=st.rec.id)
                return PermissionResultDeny(message=f"OVERDRIVE's permission gate hit an error and refused: {e}")
        return gate

    async def _gate(self, st: RunState, name: str, inp: dict, ctx) -> Any:
        rec, s = st.rec, self.settings
        timeout = 60.0 * float(s.get("approval_timeout_min"))
        if st.stopped:
            return PermissionResultDeny(message="The human pressed STOP.", interrupt=True)
        if name == "AskUserQuestion":
            return await self._ask_question(st, inp, timeout)
        if builtin.is_builtin(name):
            return await self._gate_builtin(st, name, inp, timeout)
        spec = self.tools.from_mcp_name(name)
        if spec is None:
            st.journal.add(name, inp, "unknown", "blocked", "not an OVERDRIVE tool")
            self.audit.write("tool_blocked", {"tool": name, "why": "unknown tool (least privilege)"}, task=rec.id)
            return PermissionResultDeny(message=f"OVERDRIVE blocked '{name}': only OVERDRIVE's own tools are allowed.")
        problems = self.tools.validate(spec.name, inp)
        if problems:
            st.journal.add(spec.name, inp, "invalid", "invalid", "; ".join(problems))
            self.audit.write("tool_input_rejected", {"tool": spec.name, "problems": problems}, task=rec.id)
            self._note_refused(st, spec.name, spec.title, "invalid", "invalid", "Inputs rejected: " + "; ".join(problems), inp)
            if st.journal.stuck(spec.name, inp):
                return await self._stuck(st, spec, inp)
            return PermissionResultDeny(message="OVERDRIVE rejected these inputs: " + "; ".join(problems)
                                        + ". Fix them and try again.")
        if spec.name == "start_build":
            return await self._gate_start_build(st, inp, timeout)
        if rec.mode == "chat" and not spec.name.startswith("memory_") and \
                spec.risk_for(inp) not in (Risk.INTERNAL, Risk.READ, Risk.WEB):   # look-only (web = pictures)
            st.journal.add(spec.name, inp, "unknown", "blocked", "not allowed in chat mode")
            self._note_refused(st, spec.name, spec.title, "unknown", "blocked", "Not allowed in Chat mode", inp)
            if st.journal.stuck(spec.name, inp):
                return await self._stuck(st, spec, inp)
            return PermissionResultDeny(message="You're in Chat mode, so you can't make or change files. If the human "
                                                "wants something made, plan it with them, then call start_build.")
        if rec.mode == "build" and spec.name not in ("task_plan", "start_build") and rec.plan is None:
            st.journal.add(spec.name, inp, "internal", "blocked", "no plan yet")
            self._note_refused(st, spec.name, spec.title, "internal", "blocked", "Blocked: plan first", inp)
            if st.journal.stuck(spec.name, inp):
                return await self._stuck(st, spec, inp)
            return PermissionResultDeny(message="Call task_plan first: every task starts with a plan "
                                                "(goal + checkable success criteria).")
        if spec.status == "off":
            st.journal.add(spec.name, inp, "internal", "blocked", "tool is off")
            self._note_refused(st, spec.name, spec.title, "internal", "blocked", f"Tool is off: {spec.off_reason}", inp)
            return PermissionResultDeny(message=f"{spec.title} is turned off: {spec.off_reason}")
        if spec.network and not s.get("network"):
            st.journal.add(spec.name, inp, "external", "blocked", "network off")
            self._note_refused(st, spec.name, spec.title, "external", "blocked", "Network is off", inp)
            return PermissionResultDeny(message="Network is turned off in OVERDRIVE's settings. Tell the human.")
        if st.journal.stuck(spec.name, inp):
            return await self._stuck(st, spec, inp)
        risk = spec.risk_for(inp)
        policy = decide(s.get("permissions"), risk)
        if spec.status == "experimental" and risk not in READ_RISKS and policy == "auto":
            policy = "ask"
        mem_why = ""
        if spec.name.startswith("memory_") and risk not in READ_RISKS and policy != "block":
            # Piece 3 (their pick): normal things save + tell you (Undo); personal things and rules ask first.
            mem_why = self._memory_needs_ask(st, spec.name, inp)
            policy = "ask" if mem_why else "auto"
        decision = "auto"
        if policy == "block":
            st.journal.add(spec.name, inp, risk.value, "blocked", "policy")
            self._note_refused(st, spec.name, spec.title, risk.value, "blocked", f"Blocked by your permission policy ({risk.label})", inp)
            self.audit.write("tool_blocked", {"tool": spec.name, "risk": risk.value, "why": "permission policy"}, task=rec.id)
            return PermissionResultDeny(message=f"OVERDRIVE's permission policy blocks '{risk.label}' actions. "
                                                "Don't try another way; tell the human what you wanted to do and why.")
        if policy == "ask":
            ctx_tool = ToolContext(workspace=self.workspace, task=rec, settings=s, audit=self.audit)
            preview = spec.preview(inp, ctx_tool) if spec.preview else {"inputs": summarize_args(inp, 1200)}
            if mem_why:
                preview = dict(preview, why=f"Memory asks first because {mem_why}.")
            body = {"tool": spec.name, "tool_title": spec.title, "risk": risk.value, "risk_label": risk.label,
                    "reason": inp.get("reason", ""), "preview": preview, "network": spec.network}
            title = f"OVERDRIVE wants to: {spec.title}"
            self.audit.write("approval_asked", {"tool": spec.name, "risk": risk.value, "inputs": inp}, task=rec.id)
            card = await self.broker.ask("approval", title, body, rec.id, risk.value, timeout)
            decision = card.status
            if decision != "yes":
                st.journal.add(spec.name, inp, risk.value, decision, card.note)
                self._note_refused(st, spec.name, spec.title, risk.value, decision,
                                   {"no": "You said No", "timeout": "No answer in time"}.get(decision, "Stopped")
                                   + (f': "{card.note}"' if card.note else ""), inp)
                if decision == "stopped":
                    return PermissionResultDeny(message="The human pressed STOP.", interrupt=True)
                why = {"no": "The human said No", "timeout": "Nobody answered in time (counts as No)"}.get(decision, decision)
                if card.note:
                    why += f'. Their note: "{card.note}"'
                return PermissionResultDeny(message=f"{why}. Do not retry this or try another way; continue without "
                                                    "it and explain in your report.")
        entry = st.journal.add(spec.name, inp, risk.value, decision)
        st.pending.setdefault(_key(spec.name, inp), []).append(entry)
        self.grants.issue(spec.name, inp)
        return PermissionResultAllow()

    MEMORY_AUTO_PER_TASK = 8

    def _memory_needs_ask(self, st: RunState, name: str, inp: dict) -> str:
        """Why this memory write must ask the human first ("" = save it and tell them)."""
        if self.settings.get("memory_save") == "ask":
            return "your setting says memory always asks"
        row = None
        if name in ("memory_update", "memory_archive"):
            row = self.memory.get(str(inp.get("id") or ""))
        why = is_sensitive(inp, row)
        if why:
            return why
        auto = sum(1 for m in st.rec.memory_changes if m.get("decision") == "auto")
        if auto >= self.MEMORY_AUTO_PER_TASK:
            return f"it already saved {auto} things in this one task (no memory spam)"
        return ""

    def _note_refused(self, st: RunState, tool_name: str, title: str, risk: str, decision: str, why: str,
                      inp: dict) -> None:
        """Refused calls show up on the task too, so you can see everything Claude tried."""
        st.rec.calls.append({"ts": utc_now_iso(), "tool": tool_name, "title": title, "risk": risk,
                             "decision": decision, "ok": None, "ms": 0, "note": "",
                             "args": summarize_args(inp), "summary": why[:300]})
        self.task_store.save(st.rec)
        self._emit_task(st.rec)

    # ------------------------------------------------------------------ Claude Code's own tools (Piece 1)
    async def _gate_builtin(self, st: RunState, name: str, inp: dict, timeout: float) -> Any:
        rec, s = st.rec, self.settings
        root = self.paths.workspace
        allowed = builtin.BUILD_TOOLS if rec.mode == "build" else builtin.CHAT_TOOLS
        v = builtin.classify(name, inp, root)
        title = v.title if v else name
        stub = _Named(name, title)
        if v is None or name not in allowed:
            st.journal.add(name, inp, "unknown", "blocked", f"not allowed in {rec.mode} mode")
            self.audit.write("tool_blocked", {"tool": name, "why": f"not allowed in {rec.mode} mode"}, task=rec.id)
            self._note_refused(st, name, title, "unknown", "blocked", f"Not allowed in {rec.mode.title()} mode", inp)
            if st.journal.stuck(name, inp):
                return await self._stuck(st, stub, inp)
            if rec.mode == "chat":
                return PermissionResultDeny(message="You're in Chat mode, so you can't make or change files or run "
                                                    "commands. If the human wants something made, plan it with them, "
                                                    "then call start_build to ask for Build mode.")
            return PermissionResultDeny(message=f"OVERDRIVE doesn't allow the '{name}' tool.")
        if v.needs_network and not s.get("network"):
            st.journal.add(name, inp, v.risk.value, "blocked", "network off")
            self._note_refused(st, name, title, v.risk.value, "blocked", "Network is off", inp)
            return PermissionResultDeny(message="Network is turned off in OVERDRIVE's settings. Tell the human.")
        if rec.mode == "build" and rec.plan is None and v.risk not in (Risk.INTERNAL, Risk.READ, Risk.WEB):
            st.journal.add(name, inp, "internal", "blocked", "no plan yet")
            self._note_refused(st, name, title, "internal", "blocked", "Blocked: plan first", inp)
            if st.journal.stuck(name, inp):
                return await self._stuck(st, stub, inp)
            return PermissionResultDeny(message="Call task_plan first: every build task starts with a plan "
                                                "(goal + checkable success criteria).")
        if st.journal.stuck(name, inp):
            return await self._stuck(st, stub, inp)
        policy = decide(s.get("permissions"), v.risk)
        if v.force_ask and policy == "auto":
            policy = "ask"
        decision = "auto"
        if policy == "block":
            st.journal.add(name, inp, v.risk.value, "blocked", "policy")
            self._note_refused(st, name, title, v.risk.value, "blocked",
                               f"Blocked by your permission policy ({v.risk.label})", inp)
            self.audit.write("tool_blocked", {"tool": name, "risk": v.risk.value, "why": "permission policy"},
                             task=rec.id)
            return PermissionResultDeny(message=f"OVERDRIVE's permission policy blocks '{v.risk.label}' actions. "
                                                "Don't try another way; tell the human what you wanted to do and why.")
        if policy == "ask":
            body = {"tool": name, "tool_title": title, "risk": v.risk.value, "risk_label": v.risk.label,
                    "reason": str(inp.get("description", ""))[:300], "preview": builtin.preview(name, inp, v, root),
                    "network": v.needs_network}
            self.audit.write("approval_asked", {"tool": name, "risk": v.risk.value, "inputs": inp}, task=rec.id)
            card = await self.broker.ask("approval", f"OVERDRIVE wants to: {title}", body, rec.id, v.risk.value,
                                         timeout)
            decision = card.status
            if decision != "yes":
                st.journal.add(name, inp, v.risk.value, decision, card.note)
                self._note_refused(st, name, title, v.risk.value, decision,
                                   {"no": "You said No", "timeout": "No answer in time"}.get(decision, "Stopped")
                                   + (f': "{card.note}"' if card.note else ""), inp)
                if decision == "stopped":
                    return PermissionResultDeny(message="The human pressed STOP.", interrupt=True)
                why = {"no": "The human said No", "timeout": "Nobody answered in time (counts as No)"}.get(decision,
                                                                                                          decision)
                if card.note:
                    why += f'. Their note: "{card.note}"'
                return PermissionResultDeny(message=f"{why}. Do not retry this or try another way; continue without "
                                                    "it and explain in your report.")
        if name in builtin.EDIT_TOOLS and v.inside and v.path is not None:
            try:
                self._remember_file_change(st, v.path)
            except OSError as e:
                st.journal.add(name, inp, v.risk.value, "blocked", f"couldn't save the old version: {e}")
                return PermissionResultDeny(message=f"OVERDRIVE couldn't save the old version first ({e}), so it "
                                                    "refused the change. Tell the human.")
        entry = st.journal.add(name, inp, v.risk.value, decision)
        call = {"ts": utc_now_iso(), "tool": name, "title": title, "risk": v.risk.value, "decision": decision,
                "ok": None, "ms": 0, "note": "", "args": summarize_args(inp), "summary": "running..."}
        rec.calls.append(call)
        st.builtin_pending.setdefault(_key(name, inp), []).append({"entry": entry, "call": call,
                                                                   "t0": time.monotonic()})
        self.audit.write("tool_allowed", {"tool": name, "risk": v.risk.value, "decision": decision,
                                          "inputs": summarize_args(inp, 2000)}, task=rec.id)
        self.task_store.save(rec)
        self._emit_task(rec)
        return PermissionResultAllow()

    async def _gate_start_build(self, st: RunState, inp: dict, timeout: float) -> Any:
        """Chat first, asks before Build: the human sees the plan + model/effort, and only Yes starts building."""
        rec, conv, s = st.rec, st.conv, self.settings
        model = str(inp.get("model") or "")
        effort = str(inp.get("effort") or "")
        cur_model, cur_effort = conv.model or s.get("model"), conv.effort or s.get("effort")
        auto_model = s.get("model_switch") == "auto"
        if rec.mode == "build":
            if (not model or model == cur_model) and (not effort or effort == cur_effort):
                return PermissionResultDeny(message="You're already in Build mode with that model and effort. "
                                                    "Just keep building.")
            if auto_model:
                conv.model, conv.effort = model or conv.model, effort or conv.effort
                self._save_conversations()
                self.audit.write("model_switched", {"model": model, "effort": effort, "by": "auto setting"},
                                 task=rec.id)
                rec.flags.append(f"Switched to {model or cur_model} + {effort or cur_effort} for the next step "
                                 "(your setting: switch by itself).")
                st.journal.add("start_build", inp, "internal", "auto")
                self.grants.issue("start_build", inp)
                st.pending.setdefault(_key("start_build", inp), []).append(st.journal.entries[-1])
                return PermissionResultAllow()
        title = "Ready to build?" if rec.mode == "chat" else "Switch model for this job?"
        body = {"tool": "start_build", "tool_title": "Start building" if rec.mode == "chat" else "Switch model",
                "risk": "write", "risk_label": "Build mode", "reason": str(inp.get("why_model", ""))[:400],
                "preview": {"plan": str(inp.get("plan", ""))[:3000],
                            "steps": [str(x)[:300] for x in (inp.get("steps") or [])[:20]],
                            "model": f"{model or cur_model} + {effort or cur_effort} effort",
                            "now": f"{cur_model} + {cur_effort} effort",
                            "note": ("Yes = start building with this model." if not auto_model else
                                     "Yes = start building (the model switches by itself, your setting).")},
                "network": False}
        self.audit.write("approval_asked", {"tool": "start_build", "inputs": inp}, task=rec.id)
        card = await self.broker.ask("approval", title, body, rec.id, "write", timeout)
        if card.status != "yes":
            st.journal.add("start_build", inp, "internal", card.status, card.note)
            if card.status == "stopped":
                return PermissionResultDeny(message="The human pressed STOP.", interrupt=True)
            why = "The human said not yet" if card.status == "no" else "Nobody answered in time"
            if card.note:
                why += f'. Their note: "{card.note}"'
            return PermissionResultDeny(message=f"{why}. Stay in Chat mode. Ask what they want to change, and "
                                                "don't build anything.")
        if model:
            conv.model = model
        if effort:
            conv.effort = effort
        if rec.mode == "chat":
            conv.mode = "build"
            st.build_go = {"plan": str(inp.get("plan", ""))[:3000]}
        self._save_conversations()
        self.events.publish("conversation", conversation=dict(conv.__dict__))
        self.audit.write("build_go", {"model": conv.model, "effort": conv.effort, "mode": conv.mode}, task=rec.id)
        st.journal.add("start_build", inp, "internal", "yes")
        st.pending.setdefault(_key("start_build", inp), []).append(st.journal.entries[-1])
        self.grants.issue("start_build", inp)
        return PermissionResultAllow()

    async def _go_build(self, conv_id: str) -> None:
        await asyncio.sleep(0.3)
        try:
            await self.send(GO_TEXT, conv_id)
        except Exception as e:  # e.g. a new message got there first
            self.audit.write("build_go_failed", {"error": repr(e)})

    def set_mode(self, conv_id: str, mode: str) -> dict:
        """The human flips Chat/Build for a chat (the switch next to the message box)."""
        if mode not in ("chat", "build"):
            raise ValueError("mode must be chat or build")
        conv = self.conversations.get(conv_id)
        if conv is None:
            raise ValueError("no such chat")
        old, conv.mode = conv.mode, mode
        self._save_conversations()
        self.audit.write("mode_changed", {"conversation": conv_id, "old": old, "new": mode, "by": "you"})
        self.events.publish("conversation", conversation=dict(conv.__dict__))
        return conv.__dict__

    # ------------------------------------------------------------------ chat list (Piece 2: rename, delete, search)
    def rename_conversation(self, conv_id: str, title: str) -> dict:
        conv = self.conversations.get(conv_id)
        if conv is None:
            raise ValueError("no such chat")
        title = " ".join(str(title or "").split())[:80]
        if not title:
            raise ValueError("the name can't be empty")
        old, conv.title = conv.title, title
        self._save_conversations()
        self.audit.write("chat_renamed", {"conversation": conv_id, "old": old, "new": title, "by": "you"})
        self.events.publish("conversation", conversation=dict(conv.__dict__))
        return conv.__dict__

    def delete_conversation(self, conv_id: str) -> dict:
        """Delete a chat and its task records. The audit log keeps its history (it's append-only)."""
        conv = self.conversations.get(conv_id)
        if conv is None:
            raise ValueError("no such chat")
        if self.current is not None and self.current.conv.id == conv_id:
            raise Busy("This chat is still working. Press STOP first.")
        removed = 0
        for tid in list(conv.tasks):
            if self.task_store.delete(tid):
                removed += 1
        del self.conversations[conv_id]
        self._save_conversations()
        self.audit.write("chat_deleted", {"conversation": conv_id, "title": conv.title, "tasks": removed, "by": "you"})
        return {"deleted": conv_id, "tasks": removed}

    def search_conversations(self, query: str, limit: int = 30) -> list[dict]:
        """Find chats by name or by what was said in them (your messages + OVERDRIVE's answers)."""
        words = [w for w in str(query or "").lower().split() if w][:8]
        if not words:
            return []
        hits = []
        for conv in sorted(self.conversations.values(), key=lambda c: c.created, reverse=True):
            title = conv.title.lower()
            snippet, score = "", 0
            if all(w in title for w in words):
                score = 2
            for tid in reversed(conv.tasks):
                rec = self.task_store.load(tid)
                if rec is None:
                    continue
                for text in (rec.request, rec.final_text):
                    low = (text or "").lower()
                    if all(w in low for w in words):
                        i = low.find(words[0])
                        snippet = " ".join(text[max(0, i - 50): i + 110].split())
                        score = max(score, 1)
                        break
                if snippet:
                    break
            if score:
                hits.append({"id": conv.id, "title": conv.title, "snippet": snippet, "score": score})
            if len(hits) >= limit:
                break
        hits.sort(key=lambda h: -h["score"])
        return hits

    def _remember_file_change(self, st: RunState, path: Path) -> None:
        """Before Claude Code changes a workspace file: keep the old version (once per task), so Undo works."""
        rel = self.workspace.rel(path)
        if rel in st.file_changes:
            return
        if path.is_file():
            snap = self.workspace._snapshot(path, "before Claude Code edit", st.rec.id)
            st.file_changes[rel] = {"op": "replaced", "path": rel, "snapshot": snap,
                                    "old_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        else:
            st.file_changes[rel] = {"op": "created", "path": rel}

    def _finalize_file_changes(self, st: RunState) -> None:
        """After the run: record what each touched workspace file looks like now (Undo checks this)."""
        for rel, ch in st.file_changes.items():
            path = self.workspace.root / rel
            if not path.is_file():
                continue                       # never made (refused or failed): nothing to undo
            data = path.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            if ch["op"] == "replaced" and sha == ch.get("old_sha256"):
                continue                       # ended up unchanged
            done = dict(ch, sha256=sha, bytes=len(data), by="Claude Code")
            st.rec.changes.append(done)
            st.journal.changes.append(done)
        st.file_changes.clear()

    def _builtin_result(self, st: RunState, tool_use_id: str, is_error: bool, content: Any) -> None:
        hit = st.tool_use_ids.pop(tool_use_id, None)
        if hit is None:
            return
        name, inp = hit
        if not builtin.is_builtin(name):
            return
        text = content if isinstance(content, str) else " ".join(
            str(c.get("text", "")) for c in (content or []) if isinstance(c, dict))
        queue = st.builtin_pending.get(_key(name, inp)) or []
        if queue:
            item = queue.pop(0)
            entry, call = item["entry"], item["call"]
        else:   # Claude Code allowed it by itself (a read inside the workspace): still show it
            v = builtin.classify(name, inp, self.paths.workspace)
            risk = v.risk.value if v else "read"
            entry = st.journal.add(name, inp, risk, "auto")
            call = {"ts": utc_now_iso(), "tool": name, "title": builtin.TITLES.get(name, name), "risk": risk,
                    "decision": "auto", "ok": None, "ms": 0, "note": "", "args": summarize_args(inp), "summary": ""}
            st.rec.calls.append(call)
            item = {"t0": time.monotonic()}
        summary = (("Error: " if is_error else "") + text.strip())[:300]
        # A command or edit that errors is normal while building (a failing test, a retry); it isn't a refused
        # action, so the journal counts it as run. The task page still shows it as an error.
        st.journal.finish(entry, ok=True, summary=summary, side_effect=False)
        call["ok"], call["summary"] = (not is_error), summary or "done"
        call["ms"] = int((time.monotonic() - item["t0"]) * 1000)
        self.task_store.save(st.rec)
        self._emit_task(st.rec)

    async def _stuck(self, st: RunState, spec: Any, inp: dict) -> Any:
        st.limit = (f"Stopped: Claude kept trying '{spec.title}' after it was refused "
                    f"({st.journal.refusals(spec.name, inp)} times). That's a loop.")
        self.audit.write("loop_detected", {"tool": spec.name}, task=st.rec.id)
        return PermissionResultDeny(message="OVERDRIVE stopped this task: the same refused call kept repeating.",
                                    interrupt=True)

    async def _ask_question(self, st: RunState, inp: dict, timeout: float) -> Any:
        qs = inp.get("questions")
        if not isinstance(qs, list) or not qs:
            return PermissionResultDeny(message="Question format not understood.")
        clean = []
        for q in qs[:4]:
            if not isinstance(q, dict) or not isinstance(q.get("question"), str):
                return PermissionResultDeny(message="Question format not understood.")
            clean.append({"question": q["question"][:500], "header": str(q.get("header", ""))[:40],
                          "multiSelect": bool(q.get("multiSelect")),
                          "options": [{"label": str(o.get("label", ""))[:100], "description": str(o.get("description", ""))[:300]}
                                      for o in (q.get("options") or [])[:6] if isinstance(o, dict)]})
        self.audit.write("question_asked", {"questions": clean}, task=st.rec.id)
        card = await self.broker.ask("question", "OVERDRIVE has a question", {"questions": clean}, st.rec.id, None, timeout)
        if card.status == "answered" and isinstance(card.answer, dict):
            answers = {str(k)[:500]: str(v)[:2000] for k, v in card.answer.items()}
            return PermissionResultAllow(updated_input={**inp, "answers": answers})
        if card.status == "stopped":
            return PermissionResultDeny(message="The human pressed STOP.", interrupt=True)
        return PermissionResultDeny(message="The human didn't answer the question in time. Continue with the safest "
                                            "reasonable choice and say what you assumed.")

    # ------------------------------------------------------------------ tool execution (MCP handler)
    async def execute_tool(self, spec: ToolSpec, args: dict, st: RunState | None = None) -> dict:
        st = st or self.current
        if st is None:
            return {"content": [{"type": "text", "text": "No OVERDRIVE task is running."}], "is_error": True}
        rec = st.rec
        if not self.grants.take(spec.name, args):
            self.audit.write("tool_without_grant", {"tool": spec.name}, task=rec.id)
            return {"content": [{"type": "text", "text": "OVERDRIVE refused: this call did not pass the permission gate."}],
                    "is_error": True}
        queue = st.pending.get(_key(spec.name, args)) or []
        entry = queue.pop(0) if queue else st.journal.add(spec.name, args, spec.risk_for(args).value, "auto")
        risk = spec.risk_for(args)
        side_effect = risk not in READ_RISKS
        t0 = time.perf_counter()
        note = ""
        prev = st.journal.already_done(spec.name, args) if side_effect else None
        if prev is not None:
            res = ToolResult(text=f"Already done earlier in this task, not repeated: {prev.summary}")
            note = "duplicate skipped"
        else:
            fp = self._fingerprint(spec, args) if spec.cacheable else None
            cached = st.journal.cache_get(spec.name, args, fp) if fp else None
            if cached is not None:
                res = ToolResult(text=cached + "\n(OVERDRIVE: same as your earlier read, the file hasn't changed.)")
                note = "cache"
            else:
                ctx = ToolContext(workspace=self.workspace, task=rec, settings=self.settings, audit=self.audit,
                                  lab=self.paths.lab, memory=self.memory, pictures=self.pictures)
                try:
                    res = await asyncio.wait_for(spec.handler(args, ctx), TOOL_TIMEOUT_S)
                except asyncio.TimeoutError:
                    res = ToolResult(text=f"{spec.title} took longer than {TOOL_TIMEOUT_S}s and was stopped.", is_error=True)
                except Exception as e:
                    res = ToolResult(text=f"{spec.title} crashed: {e!r}", is_error=True)
                if res.untrusted and not res.is_error:
                    boxed, flags = shield.wrap(res.text, res.source)
                    if flags:
                        rec.flags.append(f"Possible prompt injection in {res.source}: {', '.join(flags)}")
                        self.audit.write("injection_flagged", {"source": res.source, "patterns": flags}, task=rec.id)
                        self.events.publish("warning", task=rec.id,
                                            text=f"Heads up: {res.source} contains text that looks like orders "
                                                 f"for the AI ({', '.join(flags)}). It was treated as data only.")
                    res = ToolResult(text=boxed, is_error=False, changes=res.changes, data=res.data)
                if fp and not res.is_error:
                    st.journal.cache_put(spec.name, args, fp, res.text)
        ms = int((time.perf_counter() - t0) * 1000)
        st.journal.finish(entry, ok=not res.is_error, summary=res.text, changes=res.changes, side_effect=side_effect)
        if res.changes:
            rec.changes.extend(c for c in res.changes if c.get("op") not in (None, "unchanged"))
        if res.data and isinstance(res.data.get("memory"), dict) and not res.is_error:
            rec.memory_changes.append(dict(res.data["memory"], decision=entry.decision, undone=False,
                                           ts=utc_now_iso()))
            self.events.publish("memory_changed", op=res.data["memory"].get("op"))
        if res.data and isinstance(res.data.get("pictures"), list) and res.data["pictures"]:
            rec.pictures.extend(res.data["pictures"][:8])
            del rec.pictures[:-24]                      # at most 24 pictures per answer
        if spec.name == "task_plan" and not res.is_error:
            rec.plan = dict(args)
        if spec.name == "task_report" and not res.is_error:
            rec.report = dict(args)
        rec.calls.append({"ts": utc_now_iso(), "tool": spec.name, "title": spec.title, "risk": risk.value,
                          "decision": entry.decision, "ok": not res.is_error, "ms": ms, "note": note,
                          "args": summarize_args(args), "summary": res.text[:300]})
        self.audit.write("tool_result", {"tool": spec.name, "ok": not res.is_error, "ms": ms, "note": note,
                                         "inputs": args, "output": res.text, "changes": res.changes}, task=rec.id)
        self.task_store.save(rec)
        self._emit_task(rec)
        return {"content": [{"type": "text", "text": res.text}], "is_error": res.is_error}

    def _fingerprint(self, spec: ToolSpec, args: dict) -> str | None:
        try:
            p = self.workspace.resolve(args.get("path", "."))
            stt = p.stat()
            return f"{stt.st_size}-{stt.st_mtime_ns}"
        except Exception:
            return None

    def _sdk_server(self, st: RunState):
        sdk_tools = []
        for spec in self.tools.all():
            async def handler(args: dict, _spec: ToolSpec = spec) -> dict:
                return await self.execute_tool(_spec, args if isinstance(args, dict) else {}, st)
            sdk_tools.append(tool(spec.name, spec.description, spec.schema)(handler))
        return create_sdk_mcp_server(name=ToolRegistry.MCP_SERVER, version=VERSION, tools=sdk_tools)

    # ------------------------------------------------------------------ running a task
    def _options(self, st: RunState, cli: str) -> Any:
        s = self.settings
        env = {"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"}
        if self.test_env:
            env.update(self.test_env)
        fallback = s.get("fallback_model") or None
        if fallback == s.get("model"):
            fallback = None
        budget = round(float(st.conv.cost_total or 0.0) + float(s.get("task_budget_usd")), 4)
        mode = st.rec.mode
        model = st.conv.model or s.get("model")
        if fallback == model:
            fallback = None
        return ClaudeAgentOptions(
            tools=list(builtin.BUILD_TOOLS if mode == "build" else builtin.CHAT_TOOLS), allowed_tools=[],
            mcp_servers={ToolRegistry.MCP_SERVER: self._sdk_server(st)},
            strict_mcp_config=True, setting_sources=[],
            system_prompt=build_system_prompt(s, memory_digest=self.memory.digest(), mode=mode),
            permission_mode="default", can_use_tool=self._make_gate(st), model=model,
            fallback_model=fallback, effort=st.conv.effort or s.get("effort"), max_turns=int(s.get("max_steps")),
            max_budget_usd=budget, cwd=str(self.paths.workspace), cli_path=cli, env=env,
            include_partial_messages=True, resume=st.conv.session_id or None,
            stderr=lambda line: st.stderr.append(line[:500]) if len(st.stderr) < 200 else None,
        )

    time_limit_override_s: float | None = None   # self-tests only (a real limit is minutes)

    async def _watchdog(self, st: RunState) -> None:
        limit_s = self.time_limit_override_s or 60 * int(self.settings.get("max_minutes"))
        while True:
            await asyncio.sleep(1)
            if time.monotonic() - st.started > limit_s and not st.limit:
                st.limit = f"Hit the time limit ({limit_s // 60} min per task, change it in Settings)."
                self.audit.write("limit_hit", {"limit": "time", "minutes": limit_s // 60}, task=st.rec.id)
                self.broker.cancel_all("stopped")
                if st.client is not None:
                    try:
                        await asyncio.wait_for(st.client.interrupt(), 10)
                    except Exception:
                        pass
                return

    def _on_message(self, st: RunState, msg: Any) -> None:
        rec = st.rec
        if isinstance(msg, StreamEvent):
            ev = msg.event or {}
            if ev.get("type") == "content_block_delta" and (ev.get("delta") or {}).get("type") == "text_delta":
                if st.first_token_ms is None:
                    st.first_token_ms = int((time.monotonic() - st.started) * 1000)
                self.events.publish("delta", task=rec.id, text=ev["delta"].get("text", ""))
        elif isinstance(msg, SystemMessage):
            d = msg.data or {}
            if msg.subtype == "init":
                rec.model = str(d.get("model") or "")
                rec.cli_version = str(d.get("claude_code_version") or rec.cli_version)
                rec.session_id = str(d.get("session_id") or rec.session_id)
                servers = d.get("mcp_servers") or []
                self.audit.write("brain_init", {"model": rec.model, "cli": rec.cli_version, "tools": d.get("tools"),
                                                "mcp_servers": servers, "permission_mode": d.get("permissionMode")},
                                 task=rec.id)
                bad = [x for x in servers if x.get("name") == ToolRegistry.MCP_SERVER and x.get("status") != "connected"]
                if bad:
                    st.error_kind, st.error_text = "error", "OVERDRIVE's tools didn't connect to Claude Code."
            elif msg.subtype == "api_retry":
                info = {k: d.get(k) for k in ("attempt", "max_retries", "retry_delay_ms", "error_status", "error")}
                st.retries.append(info)
                self.audit.write("brain_retry", info, task=rec.id)
                self.events.publish("status", task=rec.id,
                                    text=f"Claude hiccup ({d.get('error')}), retrying {d.get('attempt')}/{d.get('max_retries')}...")
        elif isinstance(msg, AssistantMessage):
            for b in msg.content:
                if isinstance(b, TextBlock) and b.text.strip():
                    st.texts.append((st.tool_uses_seen, b.text))
                elif isinstance(b, ToolUseBlock):
                    st.tool_uses_seen += 1
                    if builtin.is_builtin(b.name):
                        st.tool_use_ids[b.id] = (b.name, b.input if isinstance(b.input, dict) else {})
            if msg.error:
                st.error_kind = {"authentication_failed": "auth", "rate_limit": "rate_limit",
                                 "billing_error": "billing"}.get(msg.error, st.error_kind or "error")
                st.error_text = brain.FRIENDLY.get(st.error_kind, "Claude returned an error.")
        elif isinstance(msg, UserMessage) and isinstance(msg.content, list):
            for b in msg.content:
                if isinstance(b, ToolResultBlock):
                    self._builtin_result(st, b.tool_use_id, bool(b.is_error), b.content)
        elif isinstance(msg, RateLimitEvent):
            info = dict(msg.rate_limit_info.raw or {})
            info.update({"status": msg.rate_limit_info.status, "utilization": msg.rate_limit_info.utilization,
                         "resets_at": msg.rate_limit_info.resets_at,
                         "rate_limit_type": msg.rate_limit_info.rate_limit_type})
            self.usage.update_rate_limit(info)
            self.events.publish("usage", usage=self.usage.public())
        elif isinstance(msg, ResultMessage):
            st.result = msg

    async def _run_task(self, st: RunState) -> TaskRecord:
        rec = st.rec
        watchdog: asyncio.Task | None = None
        try:
            setup = await self.check_setup()
            if not setup["ready"]:
                st.error_kind, st.error_text = setup["kind"] or "error", setup["problem"]
                return await self._finish(st)
            if not self.settings.get("network"):
                st.error_kind, st.error_text = "offline", ("Network is turned off in Settings, so Claude can't think. "
                                                           "Local tools still work in the Tools tab.")
                return await self._finish(st)
            ok, why = self.usage.can_start(self.settings)
            if not ok:
                st.limit = why
                return await self._finish(st)
            rec.cli_version = setup.get("version") or ""
            watchdog = asyncio.create_task(self._watchdog(st))
            for attempt in (1, 2):
                text = ""
                try:
                    await self._talk(st, setup["cli"])
                except Exception as e:
                    text = f"{e} " + " ".join(st.stderr[-20:])
                    if not (attempt == 1 and st.conv.session_id and "no conversation found" in text.lower()):
                        raise
                else:
                    r = st.result
                    if r is not None and r.is_error:
                        text = " ".join([str(r.result or ""), " ".join(r.errors or []), " ".join(st.stderr[-20:])])
                    if not (attempt == 1 and st.conv.session_id and "no conversation found" in text.lower()):
                        break
                # The saved chat history is gone (e.g. Claude Code was reinstalled): start a fresh chat once.
                self.audit.write("resume_failed", {"session": st.conv.session_id}, task=rec.id)
                st.conv.session_id, st.conv.cost_total = "", 0.0
                rec.flags.append("The earlier chat history couldn't be loaded, so this started a fresh chat.")
                st.stderr.clear()
                st.result, st.error_kind, st.error_text = None, "", ""
        except asyncio.CancelledError:
            st.stopped = True
            raise
        except Exception as e:
            if type(e).__name__ == "CLINotFoundError":
                st.error_kind, st.error_text = "not_installed", brain.FRIENDLY["not_installed"]
            else:
                detail = " ".join(st.stderr[-8:])
                kind = brain.classify_error(f"{e} {detail}")
                st.error_kind = kind
                st.error_text = brain.FRIENDLY.get(kind, "Claude Code stopped with an error.") + f" ({str(e)[:300]})"
            self.audit.write("brain_error", {"error": repr(e)[:1000], "stderr": st.stderr[-20:]}, task=rec.id)
        finally:
            if watchdog:
                watchdog.cancel()
        return await self._finish(st)

    async def _talk(self, st: RunState, cli: str) -> None:
        rec = st.rec
        options = self._options(st, cli)
        self.audit.write("network", {"to": "Anthropic (Claude), through Claude Code", "why": "brain run",
                                     "model": options.model, "resume": bool(options.resume)}, task=rec.id)
        async with ClaudeSDKClient(options=options) as client:
            st.client = client
            if st.stopped:
                return
            rules = rules_hash(mode_block(rec.mode, self.settings))
            if not st.conv.session_id:
                st.conv.session_mode = rec.mode       # a fresh session: its instructions are in this mode
                st.conv.session_rules = rules
            query = rec.request
            if st.conv.session_id and ((st.conv.session_mode and st.conv.session_mode != rec.mode)
                                       or st.conv.session_rules != rules):
                # Claude Code keeps a chat's FIRST instructions: after a mode or talk-style switch, say the new ones.
                query = mode_switch_note(rec.mode, self.settings) + rec.request
            await client.query(query)
            async for msg in client.receive_response():
                self._on_message(st, msg)
        st.client = None

    async def _finish(self, st: RunState) -> TaskRecord:
        rec, res = st.rec, st.result
        try:
            self._finalize_file_changes(st)
        except OSError as e:
            rec.flags.append(f"Couldn't record some file changes for Undo: {e}")
        try:
            run: dict[str, Any] = {"stopped": st.stopped, "limit": st.limit}
            if res is not None:
                prev_total = float(st.conv.cost_total or 0.0)
                total = float(res.total_cost_usd or 0.0)
                rec.cost_usd = round(max(0.0, total - prev_total), 6) if total else None
                st.conv.cost_total = total or prev_total
                st.conv.session_id = res.session_id or st.conv.session_id
                rec.session_id = res.session_id or rec.session_id
                rec.turns, rec.duration_ms = res.num_turns, res.duration_ms
                reason = (res.terminal_reason or "") + " " + (res.subtype or "")
                if not st.stopped and not st.limit:
                    if "max_turns" in reason:
                        run["limit"] = (f"Hit the step limit ({self.settings.get('max_steps')} steps per task, "
                                        "change it in Settings).")
                    elif "budget" in reason:
                        run["limit"] = "Hit the usage cap for one task (change it in Settings)."
                    elif res.is_error and not st.error_kind:
                        text = " ".join([str(res.result or ""), " ".join(res.errors or []), " ".join(st.stderr[-6:])])
                        st.error_kind = brain.classify_error(text)
                        st.error_text = brain.FRIENDLY.get(st.error_kind, "Claude stopped with an error.") + \
                            (f" ({text.strip()[:300]})" if text.strip() else "")
            elif not st.error_kind and not st.stopped and not st.limit:
                st.error_kind, st.error_text = "error", "Claude Code ended without a result. " + " ".join(st.stderr[-4:])
            if st.error_kind:
                run["error"], run["error_kind"] = st.error_text, st.error_kind
            rec.final_text = st.final_text()
            run["build_go"] = bool(st.build_go)
            run["failures"] = [f"{e.tool} ({'not run: ' + e.decision if e.ok is None else 'failed'}"
                               f"{': ' + e.reason if e.reason else ''})" for e in st.journal.failures()]
            status, reason, checks = check_task(rec, self.workspace, run)
            note = ""
            if (status in ("done", "partly") and rec.changes and self.settings.get("double_check")
                    and not self.test_env_skip_double_check()):
                verdict = await self._double_check(st)
                rec.double_check = verdict
                if verdict:
                    status, note = merge_double_check(status, verdict)
                    checks.append({"name": "Second check (fresh Claude)", "ok": verdict.get("status") == "done",
                                   "detail": str(verdict.get("reason", ""))[:400], "kind": "check"})
            rec.status, rec.checks = status, checks
            rec.status_reason = (note + " " + reason).strip() if note else reason
            rec.summary = str((rec.report or {}).get("summary") or "")[:600]
            rec.error = st.error_text
            if st.first_token_ms is not None:
                rec.flags.append(f"First words after {st.first_token_ms} ms")
        except Exception as e:  # the checker itself must never lose a task
            rec.status, rec.status_reason = "failed", f"OVERDRIVE's checker crashed: {e!r}"
            self.audit.write("checker_error", {"error": repr(e)}, task=rec.id)
        rec.finished = utc_now_iso()
        self.task_store.save(rec)
        self._save_conversations()
        if res is not None:
            self.usage.add_task(rec.cost_usd, rec.turns)
        self.audit.write("task_end", {"status": rec.status, "reason": rec.status_reason, "model": rec.model,
                                      "cli": rec.cli_version, "cost_usd_estimate": rec.cost_usd, "turns": rec.turns,
                                      "changes": rec.changes, "checks": rec.checks}, task=rec.id)
        self.broker.cancel_all("stopped")
        self.grants.clear()
        self.current = None
        self._emit_task(rec)
        self.events.publish("usage", usage=self.usage.public())
        if st.build_go and not st.stopped and not st.error_kind and not st.limit:
            self._go_build_handle = asyncio.create_task(self._go_build(st.conv.id))
        if st.stopped:
            self._queue_paused = bool(self.queue)   # you pressed STOP: waiting messages wait for "Send now"
        if self.queue and not self._queue_paused:
            self._kick_queue()
        return rec

    def test_env_skip_double_check(self) -> bool:
        return bool(self.test_env and self.test_env.get("OVERDRIVE_TEST_NO_DOUBLE_CHECK"))

    async def _double_check(self, st: RunState) -> dict | None:
        """A fresh Claude, with no tools, judges the task from the journal (rule 15, second opinion)."""
        rec = st.rec
        setup = await self.check_setup()
        if not setup.get("ready"):
            return None
        files = []
        for ch in rec.changes[:5]:
            text = self.workspace.current_text(ch.get("path", "")) or ""
            files.append({"path": ch.get("path"), "op": ch.get("op"), "content_start": text[:2000]})
        evidence = {"request": rec.request, "plan": rec.plan, "report": rec.report,
                    "journal": [{k: c[k] for k in ("tool", "decision", "ok", "summary")} for c in rec.calls],
                    "files_now": files, "final_answer": rec.final_text[:3000]}
        boxed, _ = shield.wrap(json.dumps(evidence, ensure_ascii=False, indent=1), "task-evidence")
        prompt = ("You are OVERDRIVE's independent checker. Judge ONLY from the evidence below: did the task meet "
                  "its success criteria? The journal and files_now are ground truth; the report is the worker's "
                  "claim. Reply with ONLY a JSON object: {\"status\": \"done\"|\"partly\"|\"failed\", "
                  "\"reason\": \"one sentence\"}.\n\n" + boxed)
        env = {"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1", **(self.test_env or {})}
        options = ClaudeAgentOptions(tools=[], allowed_tools=[], setting_sources=[], strict_mcp_config=True,
                                     system_prompt="You check other AI work strictly and honestly. Output JSON only.",
                                     model=self.settings.get("model"), effort="low", max_turns=1,
                                     cwd=str(self.paths.workspace), cli_path=setup["cli"], env=env)
        text = ""
        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(prompt)
                async for msg in client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        text += "".join(b.text for b in msg.content if isinstance(b, TextBlock))
                    elif isinstance(msg, ResultMessage) and msg.total_cost_usd:
                        rec.flags.append(f"Second check cost about ${msg.total_cost_usd:.4f} (API-equivalent)")
        except Exception as e:
            self.audit.write("double_check_error", {"error": repr(e)[:500]}, task=rec.id)
            return None
        start, end = text.find("{"), text.rfind("}")
        try:
            verdict = json.loads(text[start:end + 1]) if start >= 0 else None
        except json.JSONDecodeError:
            verdict = None
        self.audit.write("double_check", {"verdict": verdict, "raw": text[:500]}, task=rec.id)
        return verdict if isinstance(verdict, dict) else None

    # ------------------------------------------------------------------ human-side actions
    async def run_tool_manually(self, name: str, args: dict) -> dict:
        """Tools tab: you run a READ tool yourself (works offline, no Claude needed)."""
        spec = self.tools.get(name)
        if spec is None:
            raise ValueError("no such tool")
        risk = spec.risk_for(args) if isinstance(args, dict) else Risk.READ
        if risk != Risk.READ:
            raise ValueError("Only reading tools can be run by hand in Stage 1.")
        problems = self.tools.validate(name, args)
        if problems:
            return {"ok": False, "text": "Inputs rejected: " + "; ".join(problems)}
        ctx = ToolContext(workspace=self.workspace, settings=self.settings, audit=self.audit, lab=self.paths.lab,
                          memory=self.memory, pictures=self.pictures)
        try:
            res = await asyncio.wait_for(spec.handler(args, ctx), TOOL_TIMEOUT_S)
        except Exception as e:
            res = ToolResult(text=f"crashed: {e!r}", is_error=True)
        self.audit.write("manual_tool", {"tool": name, "inputs": args, "ok": not res.is_error, "output": res.text})
        return {"ok": not res.is_error, "text": res.text}

    def undo_task(self, task_id: str) -> dict:
        rec = self.task_store.load(task_id)
        if rec is None:
            raise ValueError("no such task")
        if self.current is not None:
            raise Busy("Wait until the running task is finished.")
        if rec.undo is not None:
            raise ValueError("this task was already undone")
        results = self.workspace.undo(rec.changes, task=rec.id)
        rec.undo = results
        self.task_store.save(rec)
        self.audit.write("undo", {"results": results}, task=rec.id)
        self._emit_task(rec)
        return {"task": rec.public(), "results": results}

    def undo_memory(self, task_id: str, index: int) -> dict:
        """The Undo button next to "Saved to memory": puts memory back the way it was."""
        rec = self.task_store.load(task_id)
        if rec is None:
            raise ValueError("no such task")
        if self.current is not None and self.current.rec.id == task_id:
            rec = self.current.rec
        if not 0 <= index < len(rec.memory_changes):
            raise ValueError("no such memory change")
        ch = rec.memory_changes[index]
        if ch.get("undone"):
            raise ValueError("already undone")
        op = ch.get("op")
        try:
            if op == "remember":
                if self.memory.get(ch["id"]) is not None:
                    self.memory.forget(ch["id"], provenance="you (Undo in chat)")
            elif op == "update":
                self.memory.revert_update(ch["id"])
            elif op == "archive":
                self.memory.unarchive(ch["id"])
            else:
                raise ValueError("unknown memory change")
        except MemoryError_ as e:
            raise ValueError(str(e))
        ch["undone"] = True
        self.task_store.save(rec)
        self.audit.write("memory_undo", {"change": ch}, task=rec.id)
        self._emit_task(rec)
        self.events.publish("memory_changed", op="undo")
        return {"task": rec.public()}

    # ------------------------------------------------------------------ memory page (Piece 3)
    def memory_edit(self, row_id: str, title: str | None, content: str | None, tags: list | None) -> dict:
        patch: dict[str, Any] = {}
        if title is not None:
            patch["title"] = title
        if content is not None:
            patch["content"] = content
        if tags is not None:
            patch["tags"] = tags
        if not patch:
            raise ValueError("nothing to change")
        try:
            row = self.memory.update(row_id, patch, provenance="you (Memory page)")
        except MemoryError_ as e:
            raise ValueError(str(e))
        self.audit.write("memory_edited", {"old": row_id, "new": row.id, "fields": sorted(patch), "by": "you"})
        return row.to_dict()

    def memory_forget(self, row_id: str) -> dict:
        try:
            row = self.memory.forget(row_id, provenance="you (Memory page)")
        except MemoryError_ as e:
            raise ValueError(str(e))
        self.audit.write("memory_forgotten", {"id": row_id, "kind": row.kind, "title": row.title, "by": "you"})
        return {"deleted": row_id}

    def memory_set(self, row_id: str, action: str) -> dict:
        try:
            if action == "pin":
                row = self.memory.set_pinned(row_id, True)
            elif action == "unpin":
                row = self.memory.set_pinned(row_id, False)
            elif action == "archive":
                row = self.memory.archive(row_id, provenance="you (Memory page)")
            elif action == "unarchive":
                row = self.memory.unarchive(row_id)
            else:
                raise ValueError("unknown action")
        except MemoryError_ as e:
            raise ValueError(str(e))
        self.audit.write("memory_" + action, {"id": row_id, "title": row.title, "by": "you"})
        return row.to_dict()

    def memory_import(self, source: Path, label: str = "", by: str = "you (Memory page)") -> dict:
        from .memory_import import file_sha, import_notes
        src = Path(source).expanduser()
        if not src.exists():
            raise ValueError(f"Can't find {src}")
        res = import_notes(self.memory, src, label=label)
        try:
            done = read_json(self.paths.data / "imports.json", {}) or {}
            done[file_sha(src)] = {"when": utc_now_iso(), "source": str(src),
                                   **{k: res[k] for k in ("added", "updated", "unchanged")}}
            atomic_write_json(self.paths.data / "imports.json", done)
        except OSError:
            pass
        self.audit.write("memory_import", {k: res[k] for k in ("files", "sections", "added", "updated", "unchanged",
                                                               "kept_deleted", "by_kind", "source")} | {"by": by})
        self.events.publish("memory_changed", op="import")
        return res

    def auto_import_packs(self) -> list[dict]:
        """First start: a memory-pack.zip shipped next to OVERDRIVE is read in once (so you never paste stuff).
        The same pack is never imported twice; a newer pack updates the rows that changed."""
        from .memory_import import file_sha, find_packs
        app_root = Path(__file__).resolve().parent.parent
        roots = [self.paths.home, app_root, app_root.parent]
        done = read_json(self.paths.data / "imports.json", {}) or {}
        out = []
        for pack in find_packs(roots):
            try:
                sha = file_sha(pack)
                if sha in done:
                    continue
                res = self.memory_import(pack, label="memory pack", by="OVERDRIVE (first start)")
                out.append(res)
                self.startup_notes.append(
                    f"I read your memory pack: {res['added']} new things, {res['updated']} updated. "
                    "See them on the Memory page.")
            except Exception as e:  # never stop OVERDRIVE from starting over this
                self.audit.write("memory_import_failed", {"pack": str(pack), "error": repr(e)[:500]})
        return out

    def export_zip(self) -> Path:
        """Everything OVERDRIVE knows, in plain JSON/JSONL, in one zip (rule 43)."""
        stamp = time.strftime("%Y%m%d-%H%M%S")
        out = self.paths.exports / f"overdrive-export-{stamp}.zip"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("README.txt", EXPORT_README.format(version=VERSION, when=utc_now_iso()))
            # Only OVERDRIVE's own records. NOT the window's browser profile (cookies) or running.json (window key).
            data = self.paths.data
            files = [data / n for n in ("settings.json", "conversations.json", "usage.json", "selftest-results.json")]
            files += sorted(self.paths.tasks.glob("t*.json"))
            for p in files:
                if p.is_file():
                    z.write(p, f"data/{p.relative_to(data).as_posix()}")
            for p in sorted(self.paths.logs.glob("*")):
                if p.is_file() and (p.name.startswith("audit-") or p.name.startswith("crash-")):
                    z.write(p, f"logs/{p.name}")
            idx = self.paths.versions / "index.jsonl"
            if idx.exists():
                z.write(idx, "versions/index.jsonl")
        out.write_bytes(buf.getvalue())
        self.audit.write("export", {"file": out.name, "bytes": out.stat().st_size})
        return out


def _key(tool_name: str, args: dict) -> str:
    return hashlib.sha256((tool_name + "\n" + json.dumps(args, sort_keys=True, default=str)).encode()).hexdigest()


EXPORT_README = """OVERDRIVE export (version {version}, made {when})

data/settings.json        your settings and permission policy
data/conversations.json   chats: id, title, Claude session id, task ids
data/tasks/<id>.json      one file per task: request, plan, report, every tool call, changes, checks, result
data/usage.json           daily usage meter + the latest Claude usage-limit info
data/selftest-results.json latest self-test results
logs/audit-YYYY-MM-DD.jsonl  the audit log: one JSON object per line
    seq, ts (UTC), task, kind, data, prev (hash of the line before), h (hash of this line)
    Recheck the chain: sha256 of the line's JSON without "h" (sorted keys, no spaces) must equal "h",
    and "prev" must equal the "h" of the line before.
versions/index.jsonl      list of saved old file versions (the files themselves stay in OVERDRIVE/versions)

Secrets were blanked out before anything was written.
"""


class _Named:
    """Just enough of a ToolSpec (name + title) for the loop guard on Claude Code's own tools."""
    def __init__(self, name: str, title: str):
        self.name, self.title = name, title


GO_TEXT = ("GO. I said Yes: Build mode is on. Build it now, following the plan we made "
           "(task_plan first, then make it, run it, test it, fix it, then task_report).")


async def _h_start_build(args: dict, ctx: ToolContext) -> ToolResult:
    return ToolResult(text="The human said YES. If you were in Chat mode: end your turn now with one short line; "
                           "OVERDRIVE restarts you in Build mode right away with all your building tools. "
                           "If you were already building: the new model starts with the next task.")


START_BUILD_SPEC = ToolSpec(
    name="start_build", title="Ask to start building",
    description=("Chat mode only has look-only tools. When the human wants something made (a game, an app, a "
                 "file, code), first talk it through and plan it with them, then call this: it shows the human "
                 "your plan, the steps, and which model + effort fits the job, and asks them to click Yes. Only "
                 "Yes switches to Build mode. In Build mode, call it to suggest a different model for a big job."),
    schema={"type": "object", "properties": {
        "plan": {"type": "string", "minLength": 1, "maxLength": 3000, "description": "What you'll build, in plain words."},
        "steps": {"type": "array", "maxItems": 20, "items": {"type": "string", "maxLength": 300}},
        "model": {"type": "string", "enum": ["opus", "sonnet", "haiku", "fable"],
                  "description": "Best model for this job (opus = big builds, sonnet = medium, fable = hardest bugs)."},
        "effort": {"type": "string", "enum": ["low", "medium", "high", "xhigh", "max"]},
        "why_model": {"type": "string", "maxLength": 400, "description": "One line: why this model + effort."}},
        "required": ["plan"], "additionalProperties": False},
    risk=Risk.INTERNAL, handler=_h_start_build, selftest="test_e2e_start_build",
    limitations=["A model change applies from the next task (Claude Code can't switch models mid-run)."])
