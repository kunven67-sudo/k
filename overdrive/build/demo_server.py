"""Run the OVERDRIVE window against a FAKE Claude (for UI tests and screenshots, $0).

  python build/demo_server.py [--port 47999] [--no-cli]

Prints the window URL (with its secret key). --no-cli shows the first-run setup screen.
The fake Claude's answers are scripted here; real use talks to the real Claude.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from overdrive import selftest  # noqa: E402
from overdrive.brain import find_cli  # noqa: E402
from overdrive.selftests.harness import FakeClaude, T, X, is_overdrive_main, system_text, tool_results, turn_index  # noqa: E402


def human_text(req: dict) -> str:
    for m in reversed(req.get("messages", [])):
        if m.get("role") != "user":
            continue
        c = m.get("content")
        if isinstance(c, str):
            return c
        texts = [x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text"]
        if texts and not any(isinstance(x, dict) and x.get("type") == "tool_result" for x in c):
            return texts[-1]
    return ""


def script(req: dict, fake: FakeClaude):
    if "check other AI work" in system_text(req):
        return [X('{"status": "done", "reason": "The journal shows todo.txt was created with 3 items, matching the goal."}')]
    if not is_overdrive_main(req):
        return [X("ok")]
    ask = human_text(req).lower()
    i = turn_index(req)
    if "time" in ask:
        steps = [
            [X("Let me plan this."), T("task_plan", goal="Tell the current time and work out 17.5% of 2,480",
                                       success_criteria=["Current local time reported from the PC clock",
                                                         "17.5% of 2,480 calculated exactly"],
                                       needs=["get_time (read)", "calculator (read)"], assumptions=[],
                                       approach="Check the clock and use the calculator, no guessing.")],
            [T("get_time"), T("calculator", expression="0.175 * 2480")],
            [T("task_report", status="done", summary="Got the time from the PC clock and calculated 17.5% of 2,480 = 434.",
               confidence="high", verified=["get_time returned the local time", "calculator: 0.175 * 2480 = 434"],
               assumptions=[], unknowns=[],
               criteria=[{"criterion": "Current local time reported from the PC clock", "met": True,
                          "evidence": "get_time returned the local time and time zone"},
                         {"criterion": "17.5% of 2,480 calculated exactly", "met": True,
                          "evidence": "calculator returned 0.175 * 2480 = 434"}])],
            [X("Here you go:\n\n- **Time:** checked the PC clock just now (see the step above).\n- **17.5% of 2,480 = 434**\n\n"
               "Both came from tools, not my head, so I'm confident in them.")],
        ]
        return steps[i] if i < len(steps) else [X("Done.")]
    if "todo" in ask:
        content = "TO DO THIS WEEK\n\n1. Finish the science project\n2. Clean my desk\n3. Call grandma on Sunday\n"
        steps = [
            [T("task_plan", goal="Create todo.txt with 3 things to do this week",
               success_criteria=["todo.txt exists in the workspace", "It lists exactly 3 tasks"],
               needs=["write_text_file (create, needs your Yes)"], assumptions=["The 3 tasks can be general examples"],
               approach="Write a short list and save it as a new file.")],
            [T("write_text_file", path="todo.txt", content=content, mode="create",
               reason="You asked for a todo.txt file with 3 things to do this week")],
            [T("task_report", status="done", summary="Created todo.txt with 3 tasks.", confidence="high",
               verified=["write_text_file: Created todo.txt (88 bytes)"],
               assumptions=["I picked example tasks because none were given"], unknowns=[],
               criteria=[{"criterion": "todo.txt exists in the workspace", "met": True,
                          "evidence": "write_text_file: Created todo.txt (88 bytes)"},
                         {"criterion": "It lists exactly 3 tasks", "met": True,
                          "evidence": "The saved content has items 1, 2 and 3"}])],
            [X("Saved **todo.txt** in your OVERDRIVE workspace with 3 things to do. I picked example tasks since you "
               "didn't name any; tell me yours and I'll swap them in (that would ask you first, and keep this version).")],
        ]
        return steps[i] if i < len(steps) else [X("Done.")]
    steps = [
        [T("task_plan", goal="Explain what OVERDRIVE can and can't do in Stage 1",
           success_criteria=["Lists what works now and what is not built yet"], needs=[], assumptions=[])],
        [T("task_report", status="done", summary="Explained Stage 1 abilities and limits.", confidence="high",
           criteria=[{"criterion": "Lists what works now and what is not built yet", "met": True,
                      "evidence": "Answer covers the Stage 1 tool list from my instructions"}])],
        [X("**Right now (Stage 1)** I can check the time, do exact math, and list, read and save text files in your "
           "OVERDRIVE workspace. Anything risky asks you first.\n\n**Not built yet:** web browsing, running programs, "
           "seeing your screen, images/audio, and memory between chats.")],
    ]
    return steps[i] if i < len(steps) else [X("Done.")]


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default="47999")
    ap.add_argument("--no-cli", action="store_true")
    ap.add_argument("--home", default="")
    a = ap.parse_args()
    os.environ["OVERDRIVE_PORT"] = a.port
    os.environ["OVERDRIVE_NO_WINDOW"] = "1"
    from overdrive.agent import Overdrive
    from overdrive.server import Server, serve
    fake = FakeClaude(script)
    root = Path(a.home or tempfile.mkdtemp(prefix="overdrive-demo-"))
    cfg = root / "claude-config"
    cfg.mkdir(parents=True, exist_ok=True)
    od = Overdrive(home=root / "home", test_env={
        "ANTHROPIC_BASE_URL": fake.url, "ANTHROPIC_API_KEY": "sk-ant-demo-fake", "CLAUDE_CONFIG_DIR": str(cfg),
        "CLAUDE_CODE_OAUTH_TOKEN": "", "ANTHROPIC_AUTH_TOKEN": ""})
    cli = "" if a.no_cli else (find_cli() or "")
    od.settings.update({"cli_path": cli or str(root / "missing-claude.exe")}, by="demo")
    if a.no_cli:
        od.test_env = None  # show the real first-run screen
    selftest.CLI = cli or None
    # print the URL once the server knows its token
    orig = Server.__init__

    def init(self, od_, token=None):
        orig(self, od_, token)
        print(f"URL http://127.0.0.1:{a.port}/#t={self.token}", flush=True)
    Server.__init__ = init  # type: ignore[method-assign]
    await serve(od, open_ui=False)


if __name__ == "__main__":
    asyncio.run(main())
