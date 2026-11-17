"""Piece 3 self-tests. Part 1 = memory: importing old notes (sorted, no copies, deletes stay deleted),
"saves + tells you" with Undo, personal things and rules always asking first, and the Memory page actions.
The e2e tests use the REAL Claude Code CLI with a fake Claude ($0, no usage)."""
from __future__ import annotations

import io
import zlib
import zipfile
from pathlib import Path

from ..memory import Memory
from ..memory_import import classify, import_notes, split_sections
from ..memory_tools import is_sensitive
from ..selftest import TempDir, covers
from .harness import X, T, is_overdrive_main, make_agent, run_task, system_text, tool_results, turn_index, with_fake

NOTES = {
    "CLAUDE.md": "# Memory\n\n## Rules\n- DEFAULT = YES: build what they ask.\n- No emojis in games. Real assets only.\n"
                 "  (second line of the same rule)\n\n## Now\n- 11-16 SKYPAD parked, wait for them.\n"
                 "- 11-15 DESKVERSE built.\n\n## Day counter\nLAST CHAT: 2026-11-17.\n",
    "me/about.md": "# About them\n\n## Them\nLikes racing games and real-looking graphics.\n\n## Friends\nSam: plays co-op.\n",
    "notes/projects.md": "# Projects\n\n## SKYPAD\nA Roblox game. Parked.\n\n## WISHFIELD\nWish-for-anything grassland.\n"
                         "```\n## not a heading (inside code)\n```\n",
    "notes/talk-2026-11-03.md": "## What they said\nThey want it realistic.\n",
    "notes/likes.md": "## Loved\nBig gore, slow motion.\n",
    "assets/big.png": "not text",
    ".git/config": "[core]",
    "tools/run.py": "print('not a note')",
}


def write_notes(root: Path, notes: dict = NOTES) -> Path:
    for rel, text in notes.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return root


@covers(57, 58, 62, title="Importing old notes sorts them into rules, projects, about me, people, experiences")
def test_memory_import_sorts():
    with TempDir() as tmp:
        notes = write_notes(tmp / "notes-repo")
        mem = Memory(tmp / "mem")
        r = import_notes(mem, notes)
        assert r["files"] == 5, r                                  # .md only; .git, assets and code skipped
        c = mem.counts()
        assert c["rules"] == 2, c                                  # one rule per CLAUDE.md bullet
        rules = {x["title"] for x in mem.page("rules")["rows"]}
        assert "DEFAULT = YES" in " ".join(rules), rules
        two_line = [x for x in mem.page("rules")["rows"] if "No emojis" in x["content"]][0]
        assert "second line of the same rule" in two_line["content"]
        assert c["projects"] >= 4, c                               # 2 "Now" bullets + SKYPAD + WISHFIELD
        assert c["about"] == 2 and c["people"] == 1 and c["experiences"] == 1, c
        about = mem.page("about")["rows"]
        assert any("personal" in x["tags"] for x in about)        # me/... rows are marked personal
        secs = split_sections("notes/projects.md", NOTES["notes/projects.md"])
        assert [s.heading for s in secs] == ["SKYPAD", "WISHFIELD"], [s.heading for s in secs]
        assert "WHAT OVERDRIVE REMEMBERS" in mem.digest() and "DEFAULT = YES" in mem.digest()
        mem.close()


@covers(59, 61, title="Importing again makes no copies, updates what changed, and never brings back a deleted row")
def test_memory_reimport_no_duplicates():
    with TempDir() as tmp:
        notes = write_notes(tmp / "notes-repo")
        mem = Memory(tmp / "mem")
        first = import_notes(mem, notes)
        again = import_notes(mem, notes)
        assert again["added"] == 0 and again["updated"] == 0 and again["unchanged"] == first["added"], again
        (notes / "notes" / "projects.md").write_text(NOTES["notes/projects.md"].replace("Parked.", "Back on!"),
                                                    encoding="utf-8")
        skypad = [x for x in mem.page("projects", "SKYPAD")["rows"] if x["title"] == "SKYPAD"][0]
        mem.set_pinned(skypad["id"], True)
        third = import_notes(mem, notes)
        assert third["updated"] == 1 and third["added"] == 0, third
        now = [x for x in mem.page("projects", "SKYPAD")["rows"] if x["title"] == "SKYPAD"][0]
        assert "Back on!" in now["content"] and "pinned" in now["tags"], now   # pin survives an update
        old = mem.get(skypad["id"])
        assert old.status == "superseded" and old.superseded_by == now["id"]  # history kept
        mem.forget(now["id"], provenance="test")
        fourth = import_notes(mem, notes)
        assert fourth["added"] == 0 and fourth["kept_deleted"] == 1, fourth
        assert not [x for x in mem.page("projects", "SKYPAD")["rows"] if x["title"] == "SKYPAD"]
        # A GitHub "Download ZIP" (everything inside one top folder) reads the same notes.
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            for rel, text in NOTES.items():
                z.writestr(f"notes-main/{rel}", text)
            z.writestr("../evil.md", "## Escape\nnope")
        zp = tmp / "notes.zip"
        zp.write_bytes(buf.getvalue())
        mem2 = Memory(tmp / "mem2")
        rz = import_notes(mem2, zp)
        assert rz["files"] == 5 and rz["added"] == first["added"], (rz, first)
        assert not mem2.page("all", "Escape")["rows"]
        mem.close()
        mem2.close()


@covers(63, title="Memory page actions: pin, archive and bring back, revert an update, find duplicates")
def test_memory_page_actions():
    with TempDir() as tmp:
        mem = Memory(tmp / "mem")
        a = mem.remember("fact", "Favorite color", "Orange", provenance="test", tags=["about-me"])
        assert mem.page("about")["total"] == 1 and mem.page("facts")["total"] == 0
        assert mem.find_duplicate("fact", "favorite COLOR", "  orange ") is not None
        assert mem.find_duplicate("fact", "Favorite color", "Blue") is None
        b = mem.update(a.id, {"content": "Blue"}, provenance="test")
        back = mem.revert_update(b.id)
        assert back.id == a.id and back.status == "active" and mem.get(b.id) is None
        mem.archive(a.id, provenance="test")
        assert mem.page("about")["total"] == 0 and mem.page("about", status="archived")["total"] == 1
        assert mem.unarchive(a.id).status == "active"
        mem.set_pinned(a.id, True)
        mem.remember("project", "Racing game", "Realistic racer", provenance="test")
        rows = mem.page("all")["rows"]
        assert rows[0]["id"] == a.id, rows                        # pinned on top
        assert "Pinned by the human" in mem.digest() and "Favorite color" in mem.digest()
        mem.set_pinned(a.id, False)
        assert "pinned" not in mem.get(a.id).tags
        mem.close()


@covers(63, title="Personal things and rules always ask first; normal things can save and tell")
def test_memory_sensitive_check():
    assert is_sensitive({"kind": "fact", "title": "Likes racing games", "content": "Loves racing games"}) == ""
    assert is_sensitive({"kind": "instruction", "title": "Never use red", "content": "x"})
    assert is_sensitive({"kind": "fact", "title": "x", "content": "y", "personal": True})
    assert is_sensitive({"kind": "fact", "title": "Went to the doctor", "content": "check-up"})
    assert is_sensitive({"kind": "fact", "title": "x", "content": "y", "tags": ["personal"]})

    class Row:
        kind, tags, title, content = "fact", ["personal"], "t", "c"
    assert is_sensitive({"id": "f_1", "content": "new"}, Row())


@covers(57, 63, cli=True, title="Memory saves + tells you (with Undo); personal things ask first")
def test_e2e_memory_save_and_tell():
    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        results = []

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("ok")]
            i = turn_index(req)
            results.extend(tool_results(req))
            if i == 0:
                return [T("memory_remember", kind="fact", title="Likes racing games",
                          content="The human loves realistic racing games.", about_me=True, reason="they said so")]
            if i == 1:
                return [T("memory_remember", kind="fact", title="Likes racing games",
                          content="The human loves realistic racing games.", reason="saying it again")]
            if i == 2:
                return [T("memory_remember", kind="fact", title="Health thing", content="Has a doctor visit Monday.",
                          personal=True, reason="they told me")]
            if i == 3:
                return [X("Got it, saved.")]
            return [X("done")]
        fake.script = script
        cards = []

        def answer(card):
            cards.append(card.public())
            return ("no", None, "don't save that")
        rec = run_task(od, "I love racing games. Also I see the doctor Monday", answer=answer)
        assert rec.status == "done", (rec.status, rec.status_reason)
        assert len(cards) == 1 and "personal" in cards[0]["body"]["preview"]["why"], cards   # only the personal one asked
        assert len(rec.memory_changes) == 1, rec.memory_changes                             # the copy wasn't saved twice
        ch = rec.memory_changes[0]
        assert ch["op"] == "remember" and ch["decision"] == "auto" and ch["title"] == "Likes racing games"
        row = od.memory.get(ch["id"])
        assert row is not None and "about-me" in row.tags
        assert any("Already remembered" in t for _, t, _ in results), results
        assert od.memory.count() == 1
        od.undo_memory(rec.id, 0)
        assert od.memory.get(ch["id"]) is None and od.task_store.load(rec.id).memory_changes[0]["undone"]
        try:
            od.undo_memory(rec.id, 0)
            raise AssertionError("undo twice should fail")
        except ValueError:
            pass
        od.settings.update({"memory_save": "ask"}, by="test")
        assert od._memory_needs_ask(od_state(od), "memory_remember", {"kind": "fact", "title": "a", "content": "b"})
    with_fake(lambda r, f: [X("ok")], go)


def od_state(od):
    """A stand-in RunState with an empty task (for asking the gate a question directly)."""
    from ..agent import RunState
    from ..tasks import TaskRecord
    return RunState(rec=TaskRecord(id="t20260101-000000-abcd", conversation="c0", request="x"),
                    conv=od.new_conversation())


@covers(43, title="A memory pack next to OVERDRIVE is read once on first start")
def test_memory_pack_first_start():
    with TempDir() as tmp:
        from ..agent import Overdrive
        from ..memory_import import make_pack
        notes = write_notes(tmp / "notes-repo")
        home = tmp / "home"
        home.mkdir()
        info = make_pack(notes, home / "memory-pack.zip")
        assert info["files"] == 5, info
        od = Overdrive(home=home, test_env={"X": "1"})
        first = od.auto_import_packs()
        assert len(first) == 1 and first[0]["added"] > 5 and od.startup_notes, first
        n = od.memory.count()
        assert od.auto_import_packs() == [] and od.memory.count() == n        # same pack: never twice
        od2 = Overdrive(home=home, test_env={"X": "1"})
        assert od2.auto_import_packs() == []                                 # also after a restart


# ================================================================ Part 2: talking to it while it works
@covers(84, 100, cli=True, title="A message sent while it works waits, then goes in right after (STOP pauses it)")
def test_e2e_queue_while_busy():
    import asyncio
    import time as _time
    asked = []

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("ok")]
            users = [m for m in req.get("messages", []) if m.get("role") == "user"]
            last = str(users[-1].get("content")) if users else ""
            asked.append(last)
            if "slow one" in last:
                return ("delay", 2.5, [X("Working on the slow one. Here is a long answer about it, word by word.")])
            return [X("Got your second message.")]
        fake.script = script

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            first = await od.send("do the slow one")
            await asyncio.sleep(0.3)
            item = od.enqueue("also make it red", source="voice")
            assert item["conversation"] == first.conversation and od.queue, od.queue
            deadline = _time.monotonic() + 120
            while (od.current is not None or od.queue) and _time.monotonic() < deadline:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0.5)
            tasks = [od.task_store.load(t) for t in od.conversations[first.conversation].tasks]
            assert len(tasks) == 2, [t.request for t in tasks]
            assert tasks[1].request.startswith("(I said this while you were working") and "make it red" in tasks[1].request
            assert all(t.status == "done" for t in tasks), [(t.status, t.status_reason) for t in tasks]
            # STOP pauses the queue: the waiting message stays until "Send now"
            await od.send("do the slow one again", first.conversation)
            await asyncio.sleep(0.3)
            od.enqueue("and blue", first.conversation)
            await od.stop()
            while od.current is not None:
                await asyncio.sleep(0.1)
            await asyncio.sleep(1.2)
            assert od.current is None and len(od.queue) == 1, (od.current, od.queue)
            await od.send_queued(od.queue[0]["id"])
            while od.current is not None:
                await asyncio.sleep(0.1)
            assert not od.queue and len(od.conversations[first.conversation].tasks) == 4
            od.enqueue("x", first.conversation)            # idle: it goes in right away
            od.queue.clear()
            try:
                od.unqueue("q-none")
                raise AssertionError("removing a missing message should fail")
            except ValueError:
                pass
        asyncio.run(main())
    with_fake(lambda r, f: [X("ok")], go)


@covers(53, title="Voice settings are checked (speed, pitch, when to read out loud)")
def test_voice_settings():
    from ..settings import Settings, SettingsError
    with TempDir() as tmp:
        s = Settings(tmp)
        s.update({"voice_rate": 1.25, "voice_pitch": 0.9, "voice_read": "always", "voice_name": "Microsoft Guy Online (Natural)"})
        assert s.get("voice_rate") == 1.25 and s.get("voice_read") == "always"
        for bad in ({"voice_rate": 5}, {"voice_read": "sometimes"}, {"voice_pitch": "high"}):
            try:
                s.update(bad)
                raise AssertionError(f"should refuse {bad}")
            except SettingsError:
                pass


# ================================================================ Part 3: while you're away
def _png_header(w: int, h: int) -> bytes:
    import struct as _s
    import zlib as _z
    ihdr = _s.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _s.pack(">I", 13) + b"IHDR" + ihdr + _s.pack(">I", _z.crc32(b"IHDR" + ihdr) & 0xFFFFFFFF)


def make_projects(ws: Path) -> None:
    racer = ws / "games" / "racer"
    racer.mkdir(parents=True)
    (racer / "index.html").write_text('<script src="game.js"></script><img src="art/car.png"><a href="https://x.org">x</a>'
                                      '<link rel="stylesheet" href="style.css">', encoding="utf-8")
    (racer / "game.js").write_text("let speed = 1;\n", encoding="utf-8")
    (racer / "style.css").write_text("body{}", encoding="utf-8")
    (racer / "level.json").write_text('{"cars": [1, 2,]}', encoding="utf-8")
    (racer / "sky.png").write_bytes(_png_header(8192, 4096))
    (racer / "crash-01.dmp").write_bytes(b"MDMP")
    (racer / "game.log").write_text("start\nTraceback (most recent call last):\n  boom\n", encoding="utf-8")
    tool = ws / "apps" / "helper"
    tool.mkdir(parents=True)
    (tool / "main.py").write_text("def f(:\n    pass\n", encoding="utf-8")
    (tool / "ok.py").write_text("print('fine')\n", encoding="utf-8")
    (ws / "space-run").mkdir()
    (ws / "space-run" / "main.py").write_text("x = 1\n", encoding="utf-8")


@covers(16, 19, title="Bug hunt finds broken code, files, missing pictures, crashes and too-big pictures (fixes nothing)")
def test_bug_hunt_checks():
    from ..bughunt import BugBook, hunt_project
    from ..projects import Projects
    with TempDir() as tmp:
        ws = tmp / "ws"
        make_projects(ws)
        before = {p: p.read_bytes() for p in ws.rglob("*") if p.is_file()}
        pr = Projects(ws, tmp)
        names = [p["name"] for p in pr.list()]
        assert names == ["apps/helper", "games/racer", "space-run"], names
        r = hunt_project(pr.folder("games/racer"), "games/racer")
        kinds = sorted(b["kind"] for b in r["bugs"])
        assert kinds == ["crash", "heavy", "json", "log", "missing"], r["bugs"]
        assert any("art/car.png" in b["message"] for b in r["bugs"])
        h = hunt_project(pr.folder("apps/helper"), "apps/helper")
        assert len(h["bugs"]) == 1 and h["bugs"][0]["kind"] == "syntax" and h["bugs"][0]["line"] == 1, h
        assert hunt_project(pr.folder("space-run"), "space-run")["bugs"] == []
        assert before == {p: p.read_bytes() for p in ws.rglob("*") if p.is_file()}   # it only looks
        book = BugBook(tmp)
        c = book.record("games/racer", r["bugs"])
        assert c["new"] == 5 and c["open"] == 5
        assert book.record("games/racer", r["bugs"])["new"] == 0                        # same bugs: not new again
        (ws / "games" / "racer" / "level.json").write_text('{"cars": [1, 2]}', encoding="utf-8")
        c2 = book.record("games/racer", hunt_project(pr.folder("games/racer"), "games/racer")["bugs"])
        assert c2["fixed"] == 1 and c2["open"] == 4, c2
        heavy = [b for b in book.open_bugs() if b["kind"] == "heavy"][0]
        assert book.dismiss(heavy["id"])
        c3 = book.record("games/racer", hunt_project(pr.folder("games/racer"), "games/racer")["bugs"])
        assert c3["new"] == 0 and c3["open"] == 3, c3                                   # "not a bug" stays hidden


@covers(45, title="Projects: Done switch, and old projects get marked done (or asked about)")
def test_projects_done():
    import os
    import time as _time
    from ..projects import Projects
    with TempDir() as tmp:
        ws = tmp / "ws"
        make_projects(ws)
        old = _time.time() - 40 * 86400
        for p in (ws / "space-run").rglob("*"):
            os.utime(p, (old, old))
        pr = Projects(ws, tmp)
        assert pr.auto_done("never", 14) == {"marked": [], "ask": []}
        got = pr.auto_done("ask", 14)
        assert got["ask"] == ["space-run"], (got, [(x["name"], x["changed_days"]) for x in pr.list()])
        assert pr.auto_done("ask", 14)["ask"] == []                 # asks only once
        assert pr.auto_done("always", 14)["marked"] == ["space-run"] and pr.is_done("space-run")
        pr.set_done("space-run", False)
        assert not Projects(ws, tmp).is_done("space-run")           # saved
        try:
            pr.set_done("nope", True)
            raise AssertionError("unknown project should fail")
        except ValueError:
            pass


@covers(80, 84, cli=True, title="Away: bug hunt + learning with the daily cap, a report when you're back, you go first")
def test_e2e_away_learn_and_hunt():
    import asyncio
    import time as _time

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")
        make_projects(od.paths.workspace)
        od.projects.set_done("space-run", True)
        idle = {"s": 0.0}
        od.away.idle_fn = lambda: idle["s"]

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("ok")]
            users = json_text(req)
            if "LEARN TIME" in users:
                i = turn_index(req)
                if i == 0:
                    return [T("memory_remember", kind="fact", title="Cars feel heavy with weight transfer",
                              content="Shift weight forward when braking.", tags=["learned", "cars"], reason="learned")]
                return ("delay", 3, [X("I learned how weight transfer makes cars feel heavy. Helps your racer.")])
            return [X("Hi! I'm here.")]
        fake.script = script

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            events = []
            q, _ = od.events.subscribe(0)
            await od.away.tick()
            assert not od.away.away                                   # you're here
            idle["s"] = 3600.0
            await od.away.tick()
            assert od.away.away and od.away.learn_task_id, od.away.public()
            rec = od.current.rec
            assert rec.background and od.conversations[rec.conversation].title == "While you were away"
            assert od.conversations[rec.conversation].model == "sonnet"
            deadline = _time.monotonic() + 90
            while (od.current is not None or (od.away.hunt_task and not od.away.hunt_task.done())) and _time.monotonic() < deadline:
                await asyncio.sleep(0.1)
            await od.away.tick()                                       # notices the learning run ended
            await od.away.tick()                                       # second project
            while od.away.hunt_task and not od.away.hunt_task.done():
                await asyncio.sleep(0.1)
            await od.away.tick()
            while od.away.hunt_task and not od.away.hunt_task.done():
                await asyncio.sleep(0.1)
            assert od.away.learn_used_today() == 2.5, od.away.learn_used_today()   # no meter reported: counted as 2.5%
            assert not od.away.can_learn()[0]                          # not again right away
            idle["s"] = 1.0
            await od.away.tick()
            rep = od.away.state["reports"][-1]
            assert rep["learned"] == ["Cars feel heavy with weight transfer"], rep
            assert sorted(rep["checked"]) == ["apps/helper", "games/racer"], rep   # done project skipped
            assert rep["bugs_new"] == 6 and not rep["seen"], rep
            while not q.empty():
                events.append(q.get_nowait()["type"])
            assert "away_report" in events
            # the cap: 10% allows more, 5% used up stops it
            od.away.state["learn_days"][__import__("overdrive.away", fromlist=["x"])._today()] = {"pct": 5.0, "runs": 2}
            od.away.state["last_learn"] = 0
            assert "cap" in od.away.can_learn()[1]
            od.settings.update({"away_learn_cap": 10}, by="test")
            assert od.away.can_learn()[0]
            # you go first: your message stops its own learning run
            idle["s"] = 3600.0
            await od.away.tick()
            assert od.current is not None and od.current.rec.background
            mine = await od.send("hey are you there", None)
            assert not mine.background
            while od.current is not None:
                await asyncio.sleep(0.1)
            assert od.task_store.load(mine.id).status == "done"
        asyncio.run(main())
    with_fake(lambda r, f: [X("ok")], go)


def json_text(req) -> str:
    import json as _json
    return _json.dumps(req.get("messages", []))


# ================================================================ Part 4: schedule, accounts, internet, done chats
@covers(84, title="Schedule: jobs come due at their time, repeat, skip or run after the PC was off, usage-reset jobs")
def test_schedule_jobs():
    from datetime import datetime, timedelta
    from ..schedule import Schedule, reset_passed
    with TempDir() as tmp:
        sc = Schedule(tmp)
        now = datetime.now()
        stamp = lambda d: d.strftime("%Y-%m-%dT%H:%M")
        a = sc.add({"text": "check the racer", "at": stamp(now + timedelta(minutes=5)), "repeat": "daily"})
        assert a["title"] == "check the racer" and a["enabled"]
        for bad in ({"text": ""}, {"text": "x", "at": "soon"}, {"text": "x", "at": stamp(now - timedelta(days=1))},
                    {"text": "x", "at": stamp(now), "repeat": "hourly"}):
            try:
                sc.add(bad)
                raise AssertionError(f"should refuse {bad}")
            except ValueError:
                pass
        never = lambda j: False
        assert sc.due(now, never, started_at=0) == []
        later = now + timedelta(minutes=6)
        due = sc.due(later, never, started_at=0)
        assert [j["id"] for j in due] == [a["id"]]
        sc.mark_ran(a, "t1", "c1", now=later)
        assert sc.get(a["id"])["enabled"] and sc.get(a["id"])["at"] > stamp(later)        # daily: moved to tomorrow
        # the PC was off at that time: "skip" skips it, "run" runs it now
        b = sc.add({"text": "skip me", "at": stamp(now + timedelta(minutes=1)), "missed": "skip"})
        c = sc.add({"text": "run me", "at": stamp(now + timedelta(minutes=1)), "missed": "run"})
        started = (now + timedelta(minutes=30)).timestamp()
        due = sc.due(now + timedelta(minutes=31), never, started_at=started)
        assert [j["id"] for j in due] == [c["id"]] and not sc.get(b["id"])["enabled"], due
        sc.mark_ran(c, "t2", "c2")
        assert not sc.get(c["id"])["enabled"] and sc.get(c["id"])["finished"]               # once: finished
        u = sc.add({"text": "build it", "when": "usage_reset", "mode": "build"})
        assert [j["id"] for j in sc.due(now, lambda j: True, 0)] == [u["id"]]
        assert Schedule(tmp).get(u["id"])["mode"] == "build"                                # saved
        import time as _t
        assert reset_passed({"five_hour": {"resets_at": _t.time() - 10}}, since=_t.time() - 100)
        assert not reset_passed({"five_hour": {"resets_at": _t.time() + 600}}, since=_t.time() - 100)
        sc.delete(u["id"])
        assert sc.get(u["id"]) is None


@covers(84, 33, cli=True, title="Claude can put a job on the schedule only after your Yes, and due jobs run by themselves")
def test_e2e_schedule_tool_and_run():
    import asyncio
    from datetime import datetime, timedelta

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")
        at = (datetime.now() + timedelta(minutes=2)).strftime("%Y-%m-%dT%H:%M")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("ok")]
            text = json_text(req)
            i = turn_index(req)
            if "Scheduled job" in text:
                return [X("Doing the scheduled job now.")]
            if i == 0:
                return [T("schedule_job", title="Night map", text="Work on the night map and test it", at=at,
                          mode="build", reason="you asked for Friday")]
            return [X("Okay.")]
        fake.script = script
        cards = []

        def answer(card):
            cards.append(card.public())
            return ("yes", None, "")
        rec = run_task(od, "do the night map later today", answer=answer)
        assert rec.status == "done" and len(cards) == 1, (rec.status_reason, cards)
        assert "Night map" in cards[0]["body"]["preview"]["plan"]
        jobs = od.schedule.jobs
        assert len(jobs) == 1 and jobs[0]["mode"] == "build" and jobs[0]["by"].startswith("OVERDRIVE"), jobs
        rec2 = run_task(od, "do it again", answer=lambda c: ("no", None, "no thanks"))      # No = nothing added
        assert len(od.schedule.jobs) == 1
        jobs[0]["at"] = (datetime.now() - timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M")

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            ran = await od.schedule_tick()
            assert len(ran) == 1
            while od.current is not None:
                await asyncio.sleep(0.1)
            t = od.task_store.load(ran[0])
            # Build mode without a plan from the fake Claude = "partly" (the checker is strict, as it should be)
            assert t.status in ("done", "partly") and "Scheduled job" in t.request and t.mode == "build", (t.status, t.status_reason)
            assert od.conversations[t.conversation].title == "Night map"
            assert not od.schedule.jobs[0]["enabled"]                                       # once: done
            assert await od.schedule_tick() == []
        asyncio.run(main())
    with_fake(lambda r, f: [X("ok")], go)


@covers(81, title="Accounts: add, one-click switch (never by itself), each keeps its own limits, chats carry over")
def test_accounts():
    from ..accounts import MAIN, Accounts
    from ..limits import Usage
    with TempDir() as tmp:
        acc = Accounts(tmp / "home", tmp)
        usage = Usage(tmp)
        assert acc.active == MAIN and acc.env() == {}
        b = acc.add("Second account")
        assert Path(b["dir"]).is_dir() and acc.env("Second account") == {"CLAUDE_CONFIG_DIR": b["dir"]}
        for bad in ("", "second ACCOUNT", "x" * 0, "bad/name"):
            try:
                acc.add(bad)
                raise AssertionError(f"should refuse {bad!r}")
            except ValueError:
                pass
        usage.update_rate_limit({"rate_limit_type": "five_hour", "status": "rejected", "utilization": 1.0})
        assert not usage.can_start(_FakeSettings())[0]
        acc.switch("Second account", usage)
        assert acc.active == "Second account" and usage.can_start(_FakeSettings())[0]     # its own limits
        acc.switch(MAIN, usage)
        assert usage.rate_limits["five_hour"]["status"] == "rejected"                    # main's limits came back
        # a chat's saved history comes along to the other account
        sid = "0f1e2d3c-1111-2222-3333-444455556666"
        src = tmp / "fake-main"
        acc.items.append({"name": "Third", "dir": str(src), "added": ""})
        (src / "projects" / "C--work").mkdir(parents=True)
        (src / "projects" / "C--work" / f"{sid}.jsonl").write_text("{}\n")
        assert acc.carry_session(sid, "Third", "Second account")
        assert (Path(b["dir"]) / "projects" / "C--work" / f"{sid}.jsonl").is_file()
        assert not acc.carry_session("../../evil", "Third", "Second account")
        assert not acc.carry_session("aaaaaaaa-0000", "Third", "Second account")
        try:
            acc.remove(MAIN)
            raise AssertionError("main can't be removed")
        except ValueError:
            pass
        acc.remove("Second account")
        assert Accounts(tmp / "home", tmp).names() == [MAIN, "Third"]


class _FakeSettings:
    def get(self, k):
        return {"daily_budget_usd": 100.0, "pause_at_usage_pct": 90}[k]


@covers(79, title="Internet light: notices a drop and the return, and remembers how long it was out")
def test_internet_light():
    import asyncio
    from ..net import Net

    class OD:
        class audit:
            @staticmethod
            def write(*a, **k):
                pass

        class events:
            seen: list = []

            @classmethod
            def publish(cls, t, **d):
                cls.seen.append((t, d))
    state = {"ok": True}
    n = Net(OD, check=lambda: state["ok"])

    async def main():
        await n.poll()
        assert n.online is True and n.drops == []
        state["ok"] = False
        await n.poll()
        await n.poll()                                   # still down: no second event
        assert n.online is False and len(n.drops) == 1 and n.drops[0]["up"] is None
        state["ok"] = True
        await n.poll()
        assert n.online and n.drops[0]["seconds"] is not None
    asyncio.run(main())
    assert [t for t, _ in OD.events.seen] == ["net", "net", "net"]


@covers(45, title="Done folder: chats move to Done (by you, or when old), and talking in one brings it back")
def test_done_chats():
    import asyncio
    from datetime import datetime, timedelta, timezone
    with TempDir() as tmp:
        from ..agent import Overdrive
        od = Overdrive(home=tmp / "home", test_env={"X": "1"})
        a, b = od.new_conversation("old one"), od.new_conversation("new one")
        a.updated = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
        assert od.old_chats(14) == [a.id]
        od.set_chat_done(b.id, True)
        assert Overdrive(home=tmp / "home", test_env={"X": "1"}).conversations[b.id].done        # saved
        od.settings.update({"auto_done": "always"}, by="test")
        od.away.last_auto_done = ""
        od.away._auto_done_daily()
        assert od.conversations[a.id].done
        od.settings.update({"auto_done": "ask"}, by="test")
        c = od.new_conversation("another old")
        c.updated = a.updated
        q, _ = od.events.subscribe(0)
        od.away.last_auto_done = ""
        od.away._auto_done_daily()
        asks = []
        while not q.empty():
            ev = q.get_nowait()
            if ev["type"] == "chats_done_ask":
                asks.append(ev)
        assert asks and asks[0]["chats"][0]["id"] == c.id
        od.away.last_auto_done = ""
        od.away._auto_done_daily()                       # asks only once
        assert not od.conversations[c.id].done


# ================================================================ Part 5: by the way box
@covers(84, 100, cli=True, title="By the way: a side question is answered during a job, without touching the job")
def test_e2e_by_the_way():
    import asyncio
    import time as _time

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")
        main_reqs, side_reqs = [], []

        def script(req, f):
            if "by the way" in system_text(req):
                side_reqs.append(json_text(req))
                return [X("Weight transfer = the car leans forward when braking.")]
            if not is_overdrive_main(req):
                return [X("ok")]
            main_reqs.append(json_text(req))
            return ("delay", 6, [X("Here is a long slow answer about building the night map, word by word, slowly.")])
        fake.script = script

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            rec = await od.send("build me the night map plan")
            await asyncio.sleep(0.5)
            item = od.btw.ask("what is weight transfer?")
            t0 = _time.monotonic()
            while item["status"] == "thinking" and _time.monotonic() - t0 < 60:
                await asyncio.sleep(0.1)
            assert item["status"] == "done" and "leans forward" in item["a"], item
            assert od.current is not None and od.current.rec.id == rec.id      # the main job is still going
            while od.current is not None:
                await asyncio.sleep(0.1)
            done = od.task_store.load(rec.id)
            assert done.status == "done" and "night map" in done.final_text
            assert not any("weight transfer" in r for r in main_reqs)          # the main job never saw it
            assert "night map plan" in side_reqs[0]                            # the side answer knew the job
            assert "leans forward" not in done.final_text                      # not mixed into the main chat
            try:
                od.btw.ask("   ")
                raise AssertionError("empty question should fail")
            except ValueError:
                pass
        asyncio.run(main())
    with_fake(lambda r, f: [X("ok")], go)


# ================================================================ Part 5b
def _user_texts(req) -> str:
    return json_text(req)


@covers(59, cli=True, title="Real Edit: the chat rewinds to before that message, and Claude forgets the old branch")
def test_e2e_real_edit():
    import asyncio
    seen = []

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("Car Colors")]
            seen.append(_user_texts(req))
            return [X(f"ok {len(seen)}")]
        fake.script = script
        r1 = run_task(od, "my car is RED-ALPHA")
        conv = r1.conversation
        r2 = run_task(od, "my bike is GREEN-BRAVO", conversation=conv)
        r3 = run_task(od, "what colors did I say?", conversation=conv)
        assert od.task_store.load(r1.id).end_uuid, "rewind point recorded"

        async def edit(task, text):
            od.events.bind_loop(asyncio.get_running_loop())
            new = await od.edit_message(task, text)
            while od.current is not None:
                await asyncio.sleep(0.1)
            return od.task_store.load(new.id)
        new = asyncio.run(edit(r2.id, "my bike is BLUE-CHARLIE"))
        assert new.status == "done", (new.status, new.status_reason)
        last = seen[-1]
        assert "RED-ALPHA" in last and "BLUE-CHARLIE" in last, last[-600:]
        assert "GREEN-BRAVO" not in last and "what colors" not in last, "the old branch must be forgotten"
        assert od.task_store.load(r2.id).rewound and od.task_store.load(r3.id).rewound
        assert not od.task_store.load(r1.id).rewound and new.rerun_of == r2.id
        assert od.conversations[conv].rewind_at == ""                  # used once
        new2 = asyncio.run(edit(r1.id, "my car is GOLD-DELTA"))     # editing the very first message = fresh chat
        assert "GOLD-DELTA" in seen[-1] and "RED-ALPHA" not in seen[-1] and "BLUE-CHARLIE" not in seen[-1]
        assert new2.status == "done"
    with_fake(lambda r, f: [X("ok")], go)


@covers(37, cli=True, title="Pictures you drop in the chat reach Claude as real pictures it can look at")
def test_e2e_dropped_pictures():
    from .piece2_tests import png
    got = {}

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("Red Square")]
            users = [m for m in req.get("messages", []) if m.get("role") == "user"]
            got["content"] = users[-1].get("content")
            return [X("It's a small red square.")]
        fake.script = script
        name = od.pictures.put(png(255, 0, 0))
        import asyncio

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            rec = await od.send("what is in this picture?", attachments=[name, "../evil.png", "nope.jpg"])
            while od.current is not None:
                await asyncio.sleep(0.1)
            return od.task_store.load(rec.id)
        rec = asyncio.run(main())
        assert rec.status == "done" and rec.attachments == [name], rec.attachments
        content = got["content"]
        assert isinstance(content, list), content
        kinds = [b.get("type") for b in content]
        assert "image" in kinds and "text" in kinds, kinds
        img = next(b for b in content if b.get("type") == "image")
        assert img["source"]["media_type"] == "image/png" and len(img["source"]["data"]) > 20
    with_fake(lambda r, f: [X("ok")], go)


@covers(5, cli=True, title="Chats get a short real name after the first answer (not your whole first message)")
def test_e2e_smart_chat_names():
    import asyncio

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if "You name chats" in system_text(req):
                return [X('"Fruit Talk."')]
            if not is_overdrive_main(req):
                return [X("ok")]
            return [X("Fruits are great. Mangoes are the best one, honestly.")]
        fake.script = script
        long_msg = "I like fruits, especially mangoes and also bananas and I was wondering which one is the healthiest overall"

        async def main():
            od.events.bind_loop(asyncio.get_running_loop())
            rec = await od.send(long_msg)
            conv = od.conversations[rec.conversation]
            assert conv.title.endswith("...") and len(conv.title) <= 52, conv.title  # placeholder, cut on a word
            for _ in range(300):
                if conv.title == "Fruit Talk" and od.current is None:
                    break
                await asyncio.sleep(0.1)
            assert conv.title == "Fruit Talk", conv.title
            await od.send("and apples?", conv.id)
            while od.current is not None:
                await asyncio.sleep(0.1)
            await asyncio.sleep(0.5)
            assert conv.title == "Fruit Talk"                                       # named once
        asyncio.run(main())
    with_fake(lambda r, f: [X("ok")], go)


@covers(44, title="Power cut: a task that was running when it shut down gets 'I was in the middle of X'")
def test_power_cut_recovery():
    from ..agent import Overdrive
    from ..tasks import TaskRecord
    with TempDir() as tmp:
        od = Overdrive(home=tmp / "home", test_env={"X": "1"})
        conv = od.new_conversation("racer")
        rec = TaskRecord(id="t20261117-101010-abcd", conversation=conv.id, request="build the night map")
        od.task_store.save(rec)                                         # status "running", then the power went out
        od2 = Overdrive(home=tmp / "home", test_env={"X": "1"})
        found = od2.recover_interrupted()
        assert found and found[0]["request"] == "build the night map" and od2.interrupted
        again = od2.task_store.load(rec.id)
        assert again.status == "failed" and "turned off" in again.status_reason
        assert Overdrive(home=tmp / "home", test_env={"X": "1"}).recover_interrupted() == []   # only once


@covers(43, title="Picture clean-up: old pictures and an over-full folder get trimmed, oldest first")
def test_picture_cleanup():
    import os
    import time as _t
    from ..pictures import PictureStore
    from .piece2_tests import png
    with TempDir() as tmp:
        ps = PictureStore(tmp)
        names = [ps.put(png(i, 0, 0)) for i in range(5)]
        old = _t.time() - 40 * 86400
        os.utime(ps.path(names[0]), (old, old))
        r = ps.cleanup(30, 1000)
        assert r["removed"] == 1 and ps.path(names[0]) is None
        size = sum((tmp / n).stat().st_size for n in names[1:])
        r2 = ps.cleanup(0, 0) if False else ps.cleanup(0, 50)
        assert r2["removed"] == 0
        assert ps.cleanup(0, 1000)["left"] == 4 and size > 0


# ================================================================ Part 5c: old chats, feelings, changing itself
def _export_zip(path: Path, email: str = "me@example.com") -> Path:
    import json as _json
    convs = [
        {"uuid": "aaaa-1111", "name": "Racing game ideas", "created_at": "2025-03-02T10:00:00.000000Z",
         "updated_at": "2025-03-02T11:00:00.000000Z",
         "chat_messages": [{"sender": "human", "text": "lets make a racing game", "created_at": "2025-03-02T10:00:00Z"},
                           {"sender": "assistant", "text": "", "content": [{"type": "text", "text": "Sure! Realistic or arcade?"}],
                            "created_at": "2025-03-02T10:00:05Z"}]},
        {"uuid": "bbbb-2222", "name": "", "created_at": "2024-01-05T08:30:00.000000Z", "updated_at": "2024-01-05T08:31:00Z",
         "chat_messages": [{"sender": "human", "text": "hi claude this is my very first message to you ever", "created_at": "2024-01-05T08:30:00Z"},
                           {"sender": "assistant", "text": "Hi! Nice to meet you.", "created_at": "2024-01-05T08:30:03Z"}]},
        {"uuid": "cccc-3333", "name": "Empty one", "created_at": "2025-06-01T00:00:00Z", "chat_messages": []},
        "junk",
    ]
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("data-2026/conversations.json", _json.dumps(convs))
        z.writestr("data-2026/users.json", _json.dumps([{"email_address": email}]))
    return path


@covers(43, 57, title="Old claude.ai chats: real dates, one folder per account, First chat ever, no copies")
def test_chat_archive_import():
    from ..chatimport import ChatArchive, ImportFailed
    with TempDir() as tmp:
        ar = ChatArchive(tmp)
        r = ar.import_export(_export_zip(tmp / "a.zip"))
        assert r["account"] == "me@example.com" and r["added"] == 3 and r["skipped"] == 1, r
        f = ar.folders()
        assert len(f) == 1 and [c["name"] for c in f[0]["chats"]] == ["Empty one", "Racing game ideas",
                                                                       "hi claude this is my very first message to you..."], f
        first = [c for c in f[0]["chats"] if c["first_ever"]]
        assert len(first) == 1 and first[0]["created"].startswith("2024-01-05"), first
        d = ar.get(first[0]["key"])
        assert d["meta"]["first_ever"] and d["messages"][0]["who"] == "you" and d["messages"][1]["text"] == "Hi! Nice to meet you."
        racing = ar.get("me@example.com::aaaa-1111")
        assert racing["messages"][1]["text"] == "Sure! Realistic or arcade?"          # text from content blocks
        again = ar.import_export(tmp / "a.zip")
        assert again["added"] == 0 and again["updated"] == 0, again
        r2 = ar.import_export(_export_zip(tmp / "b.zip", "second@example.com"), account="Second account")
        assert r2["account"] == "Second account" and len(ar.folders()) == 2
        assert ar.first_ever() == first[0]["key"]                                       # still the oldest of ALL
        hits = ar.search("arcade")
        assert hits and hits[0]["name"] == "Racing game ideas" and "arcade" in hits[0]["snippet"].lower()
        assert "Realistic or arcade" in ar.continue_text("me@example.com::aaaa-1111")
        bad = tmp / "bad.zip"
        with zipfile.ZipFile(bad, "w") as z:
            z.writestr("x.txt", "nope")
        try:
            ar.import_export(bad)
            raise AssertionError("a zip without chats should fail")
        except ImportFailed:
            pass
        assert ar.remove_account("Second account") == 3 and len(ChatArchive(tmp).folders()) == 1


@covers(9, title="Feelings move with what happens, drift back, and its approved upgrades shape it")
def test_feelings_and_upgrades():
    from ..feelings import MOODS, Feelings
    with TempDir() as tmp:
        f = Feelings(tmp)
        assert f.current()["word"] == "calm"
        f.on_task("done", "build the racer")
        f.on_task("done", "fix the menu")
        assert f.current()["word"] == "proud", f.current()
        f.on_message("yo this is fire, thanks bro")
        assert f.moods["excited"] > MOODS["excited"]
        f.on_task("failed", "export the game", failed_reason="the exporter crashed")
        assert any("exporter" in w["text"] for w in f.wants)
        f.at -= 30 * 3600                                     # a day later: back to calm
        assert f.current()["word"] == "calm"
        u = f.add_upgrade("voice", "Talk a bit faster", "Use shorter sentences when excited.", "they like fast",
                          settings={"voice_rate": 1.2, "evil": "x"})
        assert u["settings"] == {"voice_rate": 1.2}
        assert "Talk a bit faster" in f.prompt_block() and "YOUR MOOD RIGHT NOW" in f.prompt_block()
        f.set_upgrade(u["id"], on=False)
        assert "YOUR OWN UPGRADES" not in f.prompt_block()
        assert Feelings(tmp).upgrades[0]["on"] is False                                  # saved


@covers(92, 44, title="Changing itself: a copy, its own tests, install with a backup, automatic go-back")
def test_self_update():
    from ..selfmod import MAX_TRIES, SelfMod
    with TempDir() as tmp:
        app = tmp / "app" / "overdrive"
        app.mkdir(parents=True)
        (app / "__init__.py").write_text("VERSION = '1'\n")
        (app / "settings.py").write_text("A = 1\n")
        (app / "old.py").write_text("x = 1\n")
        results = {"ok": True, "summary": "passed 5, failed 0, skipped 0"}
        sm = SelfMod(tmp / "home", tmp / "ws", tmp / "data", app_pkg=app, runner=lambda root: dict(results))
        (tmp / "data").mkdir()
        dev = sm.prepare("add a setting B")
        (dev / "settings.py").write_text("A = 1\nB = 2\n")
        (dev / "new.py").write_text("y = 2\n")
        (dev / "old.py").unlink()
        try:
            sm.install()
            raise AssertionError("install before check must fail")
        except ValueError:
            pass
        chk = sm.check()
        assert chk["ok"] and chk["diff"] == {"changed": ["settings.py"], "added": ["new.py"], "removed": ["old.py"]}, chk
        (dev / "new.py").write_text("y = 3\n")                                   # changed after the check
        try:
            sm.install()
            raise AssertionError("a copy changed after its check must not install")
        except ValueError:
            pass
        sm.check()
        res = sm.install()
        assert (app / "settings.py").read_text().endswith("B = 2\n") and (app / "new.py").is_file()
        assert not (app / "old.py").exists() and Path(res["backup"], "old.py").is_file()
        assert sm.versions() and sm.state()["step"] == "installed"
        for _ in range(MAX_TRIES):
            assert sm.on_start() == "trying"
        assert sm.on_start() == "rolled_back"                                    # it never got going: put back
        assert (app / "old.py").is_file() and not (app / "new.py").exists()
        results.update(ok=False, summary="passed 4, failed 1")
        sm.prepare("break it")
        (sm.dev_pkg / "settings.py").write_text("oops(\n")
        assert not sm.check()["ok"]
        try:
            sm.install()
            raise AssertionError("failing tests must not install")
        except ValueError:
            pass
        assert (app / "settings.py").read_text() == "A = 1\n"


@covers(9, 33, cli=True, title="It proposes an upgrade to itself; only your Yes adds it, and it shows up in its instructions")
def test_e2e_propose_upgrade():
    seen = []

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("Upgrade Talk")]
            seen.append(system_text(req))
            if turn_index(req) == 0 and "upgrade yourself" in json_text(req):
                return [T("propose_upgrade", kind="voice", title="Talk a bit faster", change="Shorter sentences.",
                          why="they like fast", settings={"voice_rate": 1.25})]
            return [X("Done.")]
        fake.script = script
        rec = run_task(od, "upgrade yourself to talk faster", answer=lambda c: ("yes", None, ""))
        assert rec.status == "done", rec.status_reason
        assert od.settings.get("voice_rate") == 1.25 and od.feelings.upgrades[0]["title"] == "Talk a bit faster"
        run_task(od, "hi again")                                         # a new chat: new instructions
        assert "Talk a bit faster" in seen[-1] and "YOUR MOOD RIGHT NOW" in seen[-1]
        run_task(od, "upgrade yourself again", answer=lambda c: ("no", None, ""))
        assert len(od.feelings.upgrades) == 1                            # No = nothing added
    with_fake(lambda r, f: [X("ok")], go)


# ================================================================ Part 5d



def _fake_assets():
    """A fake ambientCG + Poly Haven + Openverse on 127.0.0.1 (tests never touch the internet)."""
    import io as _io
    import json as _json
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from .piece2_tests import png
    tex = _io.BytesIO()
    with zipfile.ZipFile(tex, "w") as z:
        z.writestr("Asphalt001_1K_Color.jpg", b"\xff\xd8\xff\xe0fakejpg")
        z.writestr("Asphalt001_1K_NormalGL.jpg", b"\xff\xd8\xff\xe0fakejpg2")
        z.writestr("../../evil.txt", b"escape")

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            base = f"http://127.0.0.1:{self.server.server_address[1]}"
            path = self.path
            body, ctype = b"", "application/json"
            if path.startswith("/acg?type=Material"):
                body = _json.dumps({"foundAssets": [{"assetId": "Asphalt001", "displayName": "Asphalt 001",
                                                     "previewImage": {"256-PNG": base + "/thumb.png"}}]}).encode()
            elif path.startswith("/acg?id=Asphalt001"):
                body = _json.dumps({"foundAssets": [{"assetId": "Asphalt001", "downloadFolders": {"default": {
                    "downloadFiletypeCategories": {"zip": {"downloads": [
                        {"attribute": "1K-JPG", "downloadLink": base + "/tex.zip"},
                        {"attribute": "4K-JPG", "downloadLink": base + "/big.zip"}]}}}}}]}).encode()
            elif path.startswith("/ph/assets?t=models"):
                body = _json.dumps({"ArmChair_01": {"name": "Arm Chair 01"}}).encode()
            elif path.startswith("/ph/files/ArmChair_01"):
                body = _json.dumps({"gltf": {"1k": {"gltf": {"url": base + "/chair.gltf", "include": {
                    "textures/chair_diff_1k.jpg": {"url": base + "/chairtex.jpg"}, "../bad.jpg": {"url": base + "/chairtex.jpg"}}}}}}).encode()
            elif path.startswith("/ov/?q="):
                body = _json.dumps({"results": [{"id": "snd-1234567890abcdef", "title": "V8 idle", "license": "cc0", "creator": "Ann"}]}).encode()
            elif path.startswith("/ov/snd-1234567890abcdef/"):
                body = _json.dumps({"id": "snd-1234567890abcdef", "title": "V8 idle", "license": "cc0", "url": base + "/v8.mp3",
                                    "filetype": "mp3", "creator": "Ann", "foreign_landing_url": "https://example.org/v8"}).encode()
            elif path.startswith("/ov/snd-notcc0/"):
                body = _json.dumps({"id": "snd-notcc0", "license": "by", "url": base + "/v8.mp3"}).encode()
            elif path == "/thumb.png":
                body, ctype = png(0, 0, 255), "image/png"
            elif path == "/tex.zip":
                body, ctype = tex.getvalue(), "application/zip"
            elif path == "/chair.gltf":
                body = b'{"asset": {"version": "2.0"}}'
            elif path == "/chairtex.jpg":
                body, ctype = b"\xff\xd8\xff\xe0chair", "image/jpeg"
            elif path == "/v8.mp3":
                body, ctype = b"ID3fakemp3", "audio/mpeg"
            else:
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


@covers(37, 41, title="Real assets: finds free CC0 textures, models and sounds, downloads them safely (fake library)")
def test_assets_finder():
    import asyncio
    from .. import assets, pictures
    from ..pictures import PictureStore
    from ..store import Workspace
    from ..tools import ToolContext
    srv = _fake_assets()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    old = dict(assets.ENDPOINTS)
    old_ssl = pictures._ssl_context
    assets.ENDPOINTS.update(ambientcg=base + "/acg", polyhaven=base + "/ph", openverse_audio=base + "/ov/")
    try:
        with TempDir() as tmp:
            ws = Workspace(tmp / "ws", tmp / "versions")
            ctx = ToolContext(workspace=ws, pictures=PictureStore(tmp / "pics"))

            async def run():
                r = await assets.h_find({"kind": "texture", "query": "asphalt"}, ctx)
                assert not r.is_error and "Asphalt001" in r.text and r.data["pictures"], r.text
                r = await assets.h_find({"kind": "model", "query": "chair"}, ctx)
                assert "ArmChair_01" in r.text
                r = await assets.h_find({"kind": "sound", "query": "v8"}, ctx)
                assert "snd-1234567890abcdef" in r.text
                g = await assets.h_get({"source": "ambientcg", "id": "Asphalt001", "dest": "games/racer/assets/asphalt"}, ctx)
                assert not g.is_error and (tmp / "ws/games/racer/assets/asphalt/Asphalt001_1K_Color.jpg").is_file(), g.text
                assert not (tmp / "ws/games/evil.txt").exists() and not (tmp / "evil.txt").exists()
                g = await assets.h_get({"source": "polyhaven", "id": "ArmChair_01", "kind": "model", "dest": "games/racer/assets/chair"}, ctx)
                assert (tmp / "ws/games/racer/assets/chair/textures/chair_diff_1k.jpg").is_file(), g.text
                assert not (tmp / "ws/games/racer/assets/bad.jpg").exists()
                g = await assets.h_get({"source": "openverse", "id": "snd-1234567890abcdef", "dest": "games/racer/sfx"}, ctx)
                assert (tmp / "ws/games/racer/sfx/CREDITS.txt").is_file() and not g.is_error
                g = await assets.h_get({"source": "openverse", "id": "snd-notcc0", "dest": "games/racer/sfx"}, ctx)
                assert g.is_error and "CC0" in g.text
            asyncio.run(run())
    finally:
        assets.ENDPOINTS.clear()
        assets.ENDPOINTS.update(old)
        pictures._ssl_context = old_ssl
        srv.shutdown()


@covers(27, 46, title="Rules check gives the human's rules + PC as a checklist; usage guess learns from real jobs")
def test_rules_check_and_usage_guess():
    import asyncio
    from ..agent import Overdrive
    from ..checks import UsageHistory
    with TempDir() as tmp:
        od = Overdrive(home=tmp / "home", test_env={"X": "1"})
        od.memory.remember("instruction", "No emojis in games", "never put emojis in a game", provenance="test")
        od.memory.remember("fact", "Likes realistic games", "real textures", provenance="test", tags=["pinned"])
        od.settings.update({"pc_profile": "i5-6500, 16 GB RAM, GT 1030 2 GB"}, by="test")
        spec = od.tools.get("rules_check")
        r = asyncio.run(spec.handler({}, None))
        assert "No emojis in games" in r.text and "Likes realistic games" in r.text and "GT 1030" in r.text and "NO-LAG" in r.text
        uh = UsageHistory(tmp)
        assert uh.guess("build") is None
        for pct in (3.0, 5.0, 4.0, 30.0):
            uh.add("build", "claude-opus-5-5", pct, 10)
        g = uh.guess("build", "opus")
        assert g["pct"] == 4.5 and g["high"] == 30.0 and g["n"] == 4, g
        assert "4" in od._usage_guess_text("opus") or "No guess" in od._usage_guess_text("opus")


@covers(92, 44, title="Time machine: keeps every version, opens an old copy next to the new one, goes back safely")
def test_time_machine():
    import time as _t
    from ..projects import Projects
    from ..timemachine import TimeMachine
    with TempDir() as tmp:
        ws = tmp / "ws"
        (ws / "games" / "racer").mkdir(parents=True)
        (ws / "games" / "racer" / "game.js").write_text("v1")
        tm = TimeMachine(tmp / "home", Projects(ws, tmp))
        v1 = tm.snapshot("games/racer", "first")
        assert v1 and tm.snapshot("games/racer", "same again") is None                # nothing changed: no copy
        _t.sleep(1.1)
        (ws / "games" / "racer" / "game.js").write_text("v2 with night map")
        (ws / "games" / "racer" / "night.js").write_text("night")
        v2 = tm.snapshot("games/racer", "night map")
        assert v2 and [v["id"] for v in tm.versions("games/racer")] == [v2["id"], v1["id"]]
        copy = tm.open_copy("games/racer", v1["id"])
        assert (ws / copy / "game.js").read_text() == "v1" and (ws / "games/racer/game.js").read_text().startswith("v2")
        _t.sleep(1.1)
        (ws / "games" / "racer" / "game.js").write_text("v3 unsaved work")
        res = tm.go_back("games/racer", v1["id"])
        assert (ws / "games/racer/game.js").read_text() == "v1" and not (ws / "games/racer/night.js").exists()
        assert res["saved_first"] and len(tm.versions("games/racer")) == 3                  # v3 was saved first
        for bad in ("../x", "20261117"):
            try:
                tm.go_back("games/racer", bad)
                raise AssertionError("bad version id must fail")
            except ValueError:
                pass


@covers(19, 93, title="Game eyes parts: real PNG screenshots, blank-screen check, key names; Windows only")
def test_game_eyes_parts():
    import asyncio
    from ..gameeyes import IS_WIN, VK, looks_blank, make_game_eyes_tool, png_from_bgra
    from ..pictures import sniff
    w, h = 4, 3
    px = bytes([10, 20, 30, 255] * (w * h))
    data = png_from_bgra(w, h, px)
    assert sniff(data) == "png" and data[16:24] == bytes([0, 0, 0, 4, 0, 0, 0, 3])
    raw = zlib.decompress(data[data.index(b"IDAT") + 4:data.index(b"IEND") - 8])
    assert raw[1:4] == bytes([30, 20, 10])                          # BGRA -> RGB
    assert looks_blank(bytes([0, 0, 0, 255] * 5000)) and not looks_blank(bytes(range(256)) * 80)
    assert VK["W"] == 0x57 and VK["SPACE"] == 0x20 and VK["F5"] == 0x74
    if not IS_WIN:
        spec = make_game_eyes_tool(None)
        r = asyncio.run(spec.handler({"action": "look"}, None))
        assert r.is_error and "Windows" in r.text


@covers(37, cli=True, title="Pictures a tool makes (like a game screenshot) reach Claude as real images")
def test_e2e_tool_images():
    from ..permissions import Risk
    from ..tools import ToolResult, ToolSpec
    from .piece2_tests import png
    got = {}

    def go(tmp, fake):
        od = make_agent(tmp, fake, mode="chat")

        async def h(args, ctx):
            return ToolResult(text="Screenshot attached.", images=[png(0, 255, 0)])
        od.tools.add(ToolSpec(name="test_shot", title="Test screenshot", description="Returns a test screenshot picture.",
                              schema={"type": "object", "properties": {}}, risk=Risk.READ, handler=h,
                              limitations=["test only"]))

        def script(req, f):
            if not is_overdrive_main(req):
                return [X("Shot")]
            if turn_index(req) == 0:
                return [T("test_shot")]
            users = [m for m in req.get("messages", []) if m.get("role") == "user"]
            got["last"] = users[-1].get("content")
            return [X("I see a green picture.")]
        fake.script = script
        rec = run_task(od, "take a test shot")
        assert rec.status == "done", rec.status_reason
        blocks = json_text({"messages": [{"content": got["last"]}]})
        assert '"image"' in blocks and "image/png" in blocks, blocks[:500]
    with_fake(lambda r, f: [X("ok")], go)
