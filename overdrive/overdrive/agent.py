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

from . import VERSION, brain, shield
from .audit import AuditLog
from .basic_tools import register_basic_tools
from .events import EventBus
from .journal import Entry, Journal
from .jsonio import atomic_write_json, read_json, utc_now_iso
from .limits import Usage
from .memory import Memory
from .memory_tools import register_memory_tools
from .paths import Paths, default_home
from .permissions import Broker, Card, Grants, Risk, decide
from .prompts import build_system_prompt
from .settings import Settings
from .store import Workspace
from .tasks import TaskRecord, TaskStore, check_task, merge_double_check, new_task_id, summarize_args
from .tools import ToolContext, ToolRegistry, ToolResult, ToolSpec

try:  # The Agent SDK is needed for the brain, not for offline tools / tests of the core.
    from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, CLINotFoundError,
                                  PermissionResultAllow, PermissionResultDeny, RateLimitEvent, ResultMessage,
                                  StreamEvent, SystemMessage, TextBlock, ToolUseBlock, UserMessage,
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
        self.grants = Grants()
        self.events = EventBus()
        self.broker = Broker(on_change=self._card_changed)
        self.test_env = test_env
        self.current: RunState | None = None
        self._run_task_handle: asyncio.Task | None = None
        self._setup_cache: tuple[float, dict] | None = None
        self._conv_path = self.paths.data / "conversations.json"
        self.conversations: dict[str, Conversation] = {}
        self._load_conversations()
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
        conv = Conversation(id="c" + secrets.token_hex(5), title=title[:80], created=utc_now_iso())
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

    async def send(self, text: str, conversation_id: str | None = None) -> TaskRecord:
        text = (text or "").strip()
        if not text:
            raise ValueError("empty message")
        if len(text) > 20000:
            raise ValueError("message is too long (20,000 characters max)")
        if self.current is not None:
            raise Busy("OVERDRIVE is still working on the last task. Wait for it, or press STOP.")
        conv = self.conversations.get(conversation_id or "") or self.new_conversation(text[:60])
        if conv.title == "New chat":
            conv.title = text[:60]
        rec = TaskRecord(id=new_task_id(), conversation=conv.id, request=text)
        rec.settings = {k: self.settings.get(k) for k in ("model", "fallback_model", "effort", "detail", "max_steps",
                                                          "max_minutes", "task_budget_usd", "double_check")}
        conv.tasks.append(rec.id)
        self._save_conversations()
        st = RunState(rec=rec, conv=conv)
        self.current = st
        self.task_store.save(rec)
        self.audit.write("task_start", {"request": text, "conversation": conv.id, "settings": rec.settings}, task=rec.id)
        self._emit_task(rec)
        self._run_task_handle = asyncio.create_task(self._run_task(st))
        return rec

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
        if spec.name != "task_plan" and rec.plan is None:
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

    def _note_refused(self, st: RunState, tool_name: str, title: str, risk: str, decision: str, why: str,
                      inp: dict) -> None:
        """Refused calls show up on the task too, so you can see everything Claude tried."""
        st.rec.calls.append({"ts": utc_now_iso(), "tool": tool_name, "title": title, "risk": risk,
                             "decision": decision, "ok": None, "ms": 0, "note": "",
                             "args": summarize_args(inp), "summary": why[:300]})
        self.task_store.save(st.rec)
        self._emit_task(st.rec)

    async def _stuck(self, st: RunState, spec: ToolSpec, inp: dict) -> Any:
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
                                  lab=self.paths.lab, memory=self.memory)
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
        return ClaudeAgentOptions(
            tools=["AskUserQuestion"], allowed_tools=[], mcp_servers={ToolRegistry.MCP_SERVER: self._sdk_server(st)},
            strict_mcp_config=True, setting_sources=[],
            system_prompt=build_system_prompt(s, memory_digest=self.memory.digest()),
            permission_mode="default", can_use_tool=self._make_gate(st), model=s.get("model"),
            fallback_model=fallback, effort=s.get("effort"), max_turns=int(s.get("max_steps")),
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
            if msg.error:
                st.error_kind = {"authentication_failed": "auth", "rate_limit": "rate_limit",
                                 "billing_error": "billing"}.get(msg.error, st.error_kind or "error")
                st.error_text = brain.FRIENDLY.get(st.error_kind, "Claude returned an error.")
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
            await client.query(rec.request)
            async for msg in client.receive_response():
                self._on_message(st, msg)
        st.client = None

    async def _finish(self, st: RunState) -> TaskRecord:
        rec, res = st.rec, st.result
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
        ctx = ToolContext(workspace=self.workspace, settings=self.settings, audit=self.audit, lab=self.paths.lab)
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
