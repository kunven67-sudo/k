"""Piece 3 self-tests. Part 1 = memory: importing old notes (sorted, no copies, deletes stay deleted),
"saves + tells you" with Undo, personal things and rules always asking first, and the Memory page actions.
The e2e tests use the REAL Claude Code CLI with a fake Claude ($0, no usage)."""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

from ..memory import Memory
from ..memory_import import classify, import_notes, split_sections
from ..memory_tools import is_sensitive
from ..selftest import TempDir, covers
from .harness import X, T, is_overdrive_main, make_agent, run_task, tool_results, turn_index, with_fake

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
