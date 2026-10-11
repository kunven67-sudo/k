"""Run with:  python -m unittest discover -s tests   (from the CodeBrain folder)"""

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_TMP = tempfile.mkdtemp(prefix="codebrain-test-")
os.environ["CODEBRAIN_HOME"] = _TMP

from codebrain import lessons, prompts  # noqa: E402
from codebrain.assistant import Assistant  # noqa: E402
from codebrain.brain import Brain, BrainError  # noqa: E402
from codebrain.codeblocks import best_code, find_blocks  # noqa: E402
from codebrain.config import Config, pick_model  # noqa: E402
from codebrain.highlight import IndexMapper, spans  # noqa: E402
from codebrain.memory import Memory  # noqa: E402
from codebrain.runner import CodeRun, error_line_number, run_blocking  # noqa: E402
from codebrain.xp import XP, xp_for_level  # noqa: E402
from codebrain import snippets as SN  # noqa: E402
from codebrain.voice import PushToTalk, missing_parts, speakable  # noqa: E402
from codebrain.doctor import Doctor  # noqa: E402
from codebrain import project as P  # noqa: E402
from codebrain.paths import projects_dir  # noqa: E402


def tmpfile(name):
    return Path(tempfile.mkdtemp(dir=_TMP)) / name


def write_prog(code):
    p = tmpfile("prog.py")
    p.write_text(code, encoding="utf-8")
    return p


class FakeOllama(BaseHTTPRequestHandler):
    """Pretends to be Ollama so we can test without a real brain."""
    reply = "Here you go!\n```python\nprint('hi')\n```\nLESSON: always close your brackets."
    requests = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        body = json.dumps({"models": [{"name": "test-model:latest"}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeOllama.requests.append((self.path, payload))
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.end_headers()
        if payload.get("model") == "broken":
            self.wfile.write(json.dumps({"error": "model 'broken' not found"}).encode() + b"\n")
            return
        for i in range(0, len(self.reply), 7):
            chunk = {"message": {"role": "assistant", "content": self.reply[i:i + 7]}, "done": False}
            self.wfile.write(json.dumps(chunk).encode() + b"\n")
            self.wfile.flush()
        self.wfile.write(json.dumps({"message": {"content": ""}, "done": True}).encode() + b"\n")


class TestMemory(unittest.TestCase):
    def setUp(self):
        self.mem = Memory(tmpfile("memory.json"))

    def test_seeds_game_plans_once(self):
        names = [p["name"] for p in self.mem.data["projects"]]
        self.assertEqual(names, ["Graveyard Zombies", "4D Maze"])
        self.assertIn("slide", self.mem.context_text("how do I do the 4d maze slices?"))
        # deleting a plan sticks (it doesn't come back next time)
        self.mem.forget(self.mem.data["projects"][1]["id"])
        self.assertEqual([p["name"] for p in Memory(self.mem.path).data["projects"]], ["Graveyard Zombies"])

    def test_seeds_zombie_plan(self):
        self.assertEqual(self.mem.data["projects"][0]["name"], "Graveyard Zombies")
        self.assertIn("Graveyard", self.mem.context_text("help me with my zombie game"))
        self.assertNotIn("Suggested build order", self.mem.context_text("what is a list"))

    def test_learns_facts(self):
        learned = self.mem.learn_from_message("Hi, my name is Kai and I love 3D shooters!")
        texts = [i["text"] for i in learned]
        self.assertTrue(any("Kai" in t for t in texts))
        self.assertTrue(any("3D shooters" in t for t in texts))
        # same fact again isn't duplicated
        self.assertEqual(self.mem.learn_from_message("I love 3D shooters"), [])

    def test_remember_note(self):
        learned = self.mem.learn_from_message("remember that I use 4 spaces")
        self.assertEqual(learned[0]["text"], "I use 4 spaces")
        self.assertIn("I use 4 spaces", self.mem.context_text())

    def test_fixes_dedupe_and_recall(self):
        err = 'Traceback...\n  File "x.py", line 3\nNameError: name \'scren\' is not defined'
        a = self.mem.add_fix(err, "Check spelling of variable names like screen.")
        b = self.mem.add_fix(err, "Check spelling of variable names like screen.")
        self.assertEqual(a["id"], b["id"])
        self.assertEqual(b["times_seen"], 2)
        self.assertEqual(self.mem.relevant_fixes("NameError scren")[0]["id"], a["id"])
        self.assertTrue(self.mem.confirm_fix(a["id"]))

    def test_persist_and_forget(self):
        item = self.mem.add_note("likes green")
        again = Memory(self.mem.path)
        self.assertEqual(again.data["notes"][0]["text"], "likes green")
        self.assertTrue(again.forget(item["id"]))
        self.assertEqual(Memory(self.mem.path).data["notes"], [])

    def test_broken_file_is_kept(self):
        path = tmpfile("memory.json")
        path.write_text("{not json", encoding="utf-8")
        Memory(path)
        self.assertTrue(any("broken" in p.name for p in path.parent.iterdir()))


class TestXP(unittest.TestCase):
    def test_levels(self):
        xp = XP(tmpfile("xp.json"))
        self.assertEqual(xp.level, 1)
        self.assertEqual(xp_for_level(2), 100)
        msg = None
        for _ in range(10):
            msg = xp.add("run_ok") or msg
        self.assertEqual(xp.level, 2)
        self.assertIn("LEVEL UP", msg)
        self.assertEqual(xp.progress(), (0, 200))
        before = xp.total
        xp.finish_lesson("py1")
        xp.finish_lesson("py1")                 # finishing twice only counts once
        self.assertEqual(xp.total, before + 50)


class TestCodeBlocks(unittest.TestCase):
    def test_best_code(self):
        text = "Try:\n```python\nx = 1\n```\nand the full thing:\n```python\nimport pygame\nx = 2\n```\n```bash\npip install\n```"
        self.assertEqual(len(find_blocks(text)), 3)
        self.assertEqual(best_code(text), "import pygame\nx = 2")
        self.assertIsNone(best_code("no code here"))
        self.assertEqual(best_code("```python\nprint(1)"), "print(1)")  # unfinished stream

    def test_extract_lesson(self):
        self.assertEqual(prompts.extract_lesson("blah\n3. **LESSON:** indent with 4 spaces"), "indent with 4 spaces")


class TestHighlight(unittest.TestCase):
    def test_spans(self):
        code = 'def go():\n    s = "# not a comment"  # real\n    return 5\n'
        tags = {(t, code[a:b]) for t, a, b in spans(code)}
        self.assertIn(("keyword", "def"), tags)
        self.assertIn(("defname", "go"), tags)
        self.assertIn(("string", '"# not a comment"'), tags)
        self.assertIn(("comment", "# real"), tags)
        self.assertIn(("number", "5"), tags)
        self.assertNotIn(("keyword", "not"), tags)

    def test_emoji_index(self):
        text = 'print("🔫 pew")\nx = 1'
        self.assertEqual(IndexMapper(text, utf16=True).index(text.index("pew")), "1.10")
        self.assertEqual(IndexMapper(text, utf16=False).index(text.index("pew")), "1.9")
        self.assertEqual(IndexMapper(text, utf16=True).index(text.index("x")), "2.0")


class TestRunner(unittest.TestCase):
    def test_ok_and_crash(self):
        ok = run_blocking(write_prog("print('hello 🧠')"), timeout=30)
        self.assertFalse(ok.crashed)
        self.assertIn("hello 🧠", ok.stdout)
        bad = run_blocking(write_prog("x = 1\nprint(y)\n"), timeout=30)
        self.assertTrue(bad.crashed)
        self.assertIn("NameError", bad.error_text)
        self.assertEqual(error_line_number(bad.error_text, "prog.py"), 2)

    def test_live_run_with_input(self):
        run = CodeRun(write_prog("name = input('Name? ')\nprint('Hi', name)\n"))
        run.send_input("Kai")
        out, result = [], None
        end = time.time() + 30
        while result is None and time.time() < end:
            kind, payload = run.events.get(timeout=30)
            if kind == "done":
                result = payload
            else:
                out.append(payload)
        self.assertFalse(result.crashed)
        self.assertIn("Hi Kai", "".join(out))

    def test_stop(self):
        run = CodeRun(write_prog("import time\nwhile True: time.sleep(0.1)\n"))
        time.sleep(0.5)
        run.stop()
        while True:
            kind, payload = run.events.get(timeout=30)
            if kind == "done":
                break
        self.assertTrue(payload.stopped)
        self.assertFalse(payload.crashed)


class TestLessons(unittest.TestCase):
    def test_all_lessons_valid(self):
        ids = [l["id"] for l in lessons.LESSONS]
        self.assertEqual(len(ids), len(set(ids)))
        for lesson in lessons.LESSONS:
            self.assertIn(lesson["track"], lessons.TRACKS)
            if lesson["code"]:
                compile(lesson["code"], lesson["id"], "exec")
            quiz = lesson.get("quiz")
            if quiz:
                self.assertLess(quiz["answer"], len(quiz["options"]))
        zombie = lessons.in_track(lessons.TRACK_ZOMBIE)
        maze = lessons.in_track(lessons.TRACK_MAZE)
        self.assertEqual((len(zombie), len(maze)), (13, 8))
        self.assertTrue(all(not l["code"] and l["ask"] for l in zombie + maze))  # you build them yourself!

    def test_basic_lessons_run(self):
        inputs = {"py2": "Kai\n12\nlaser\n"}
        for lesson in lessons.in_track(lessons.PY_TRACK):
            p = tmpfile(f"{lesson['id']}.py")
            p.write_text(lesson["code"], encoding="utf-8")
            result = run_blocking(p, timeout=30, input_text=inputs.get(lesson["id"], ""))
            self.assertFalse(result.crashed, f"{lesson['id']} crashed:\n{result.stderr}")


class TestSnippets(unittest.TestCase):
    def test_builtin(self):
        ids = [x["id"] for x in SN.BUILTIN]
        self.assertEqual(len(ids), len(set(ids)))
        for snip in SN.BUILTIN:
            self.assertIn(snip["category"], SN.CATEGORIES)
            compile(snip["code"], snip["id"], "exec")
            part = SN.snippet_part(snip["code"])
            self.assertTrue(part.startswith(SN.START) and part.endswith(SN.END), snip["id"])
            compile(part, snip["id"] + "-part", "exec")   # the inserted piece is valid Python on its own
        for cat in SN.CATEGORIES[:4]:
            self.assertGreaterEqual(len([x for x in SN.BUILTIN if x["category"] == cat]), 2)

    def test_highscore_runs(self):
        snip = next(x for x in SN.BUILTIN if x["id"] == "highscore")
        p = write_prog(snip["code"])
        first = run_blocking(p, timeout=30)
        second = run_blocking(p, timeout=30)
        self.assertFalse(first.crashed or second.crashed, first.stderr + second.stderr)
        self.assertTrue(p.with_name("highscore.json").exists())

    def test_my_snippets(self):
        lib = SN.Snippets(tmpfile("snippets.json"))
        item = lib.add("double jump", "def double_jump():\n    pass")
        self.assertEqual(SN.Snippets(lib.path).get(item["id"])["name"], "double jump")
        self.assertEqual(SN.snippet_part(item["code"]), "def double_jump():\n    pass")
        self.assertTrue(lib.delete(item["id"]))
        self.assertIsNone(SN.Snippets(lib.path).get(item["id"]))


class TestProject(unittest.TestCase):
    def setUp(self):
        self.folder = projects_dir() / f"game_{time.time_ns()}"
        (self.folder / "levels").mkdir(parents=True)
        (self.folder / "main.py").write_text("import enemies\nfrom levels import level1\nprint('main')\n")
        (self.folder / "enemies.py").write_text("class Zombie:\n    speed = 3\n")
        (self.folder / "levels" / "__init__.py").write_text("")
        (self.folder / "levels" / "level1.py").write_text("LAYOUT = '###'\n")
        (self.folder / "player.py").write_text("class Player:\n    hp = 100\n")
        (self.folder / "sounds.py").write_text("BOOM = 1\n")

    def ctx(self, message, budget=20000):
        main = self.folder / "main.py"
        return P.build_context(message, main, main.read_text(), budget)

    def test_project_folder(self):
        self.assertEqual(P.project_folder(self.folder / "levels" / "level1.py"), self.folder)

    def test_imports_and_mentions(self):
        text = self.ctx("why is my player so slow?")
        self.assertIn("class Zombie", text)          # imported by main.py
        self.assertIn("class Player", text)          # mentioned by name
        self.assertNotIn("BOOM", text)               # not relevant
        self.assertIn("sounds.py", text)             # but listed
        self.assertIn("BOOM", self.ctx("check my whole project"))

    def test_budget(self):
        self.assertLessEqual(len(self.ctx("check my whole project", budget=900)), 900)
        self.assertEqual(P.build_context("hi", None, "", 5000), "")

    def test_file_blocks(self):
        reply = "Two files:\n```python\n# file: enemies.py\nclass Zombie: pass\n```\n```python\n# player.py\nx = 1\n```\n```python\nprint(1)\n```"
        self.assertEqual([n for n, _ in P.file_blocks(reply)], ["enemies.py", "player.py"])
        self.assertIsNone(P.safe_target(self.folder, "../../evil.py"))
        self.assertEqual(P.safe_target(self.folder, "levels/level2.py"), (self.folder / "levels" / "level2.py").resolve())


class FakeRecorder:
    def __init__(self, audio):
        self.audio = audio
        self.started = False

    def start(self):
        self.started = True

    def stop(self):
        return self.audio


class FakeTranscriber:
    def load(self):
        pass

    def transcribe(self, audio):
        if audio is None:
            return ""
        return "make me a snake game"


class TestVoice(unittest.TestCase):
    def test_speakable(self):
        text = "LET'S GO 🔥 **Nice!**\n```python\nprint('x')\n```\nThen `run` it.\n```python\nmore\n```"
        said = speakable(text)
        self.assertNotIn("print", said)
        self.assertNotIn("🔥", said)
        self.assertNotIn("*", said)
        self.assertEqual(said.count("I put the code on the screen"), 1)
        self.assertIn("Then run it.", said)
        self.assertLess(len(speakable("word. " * 1000)), 1300)

    def test_push_to_talk(self):
        heard, errors = [], []
        done = threading.Event()
        ptt = PushToTalk(recorder=FakeRecorder([0.1] * 16000), transcriber=FakeTranscriber())
        ptt.release(heard.append, errors.append)          # not listening yet -> ignored
        ptt.press()
        self.assertTrue(ptt.listening)
        ptt.release(lambda t: (heard.append(t), done.set()), errors.append)
        self.assertTrue(done.wait(5))
        self.assertEqual(heard, ["make me a snake game"])
        self.assertFalse(ptt.listening)
        self.assertEqual(errors, [])

    def test_missing_parts_is_a_list(self):
        self.assertIsInstance(missing_parts(), list)


class TestDoctor(unittest.TestCase):
    def test_runs_without_crashing(self):
        import contextlib
        import io
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            Doctor(deep=False).run()
        self.assertIn("CodeBrain Doctor", out.getvalue())
        self.assertNotIn("crashed", out.getvalue())


class TestBrainAndAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeOllama)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def make(self, model="test-model"):
        cfg = Config(tmpfile("config.json"))
        cfg["ollama_url"] = f"http://127.0.0.1:{self.server.server_port}"
        cfg["model"] = model
        return Assistant(config=cfg, memory=Memory(tmpfile("m.json")), xp=XP(tmpfile("x.json")))

    def test_pick_model(self):
        self.assertEqual(pick_model(12), "qwen2.5-coder:14b")
        self.assertEqual(pick_model(16), "qwen2.5-coder:14b")
        self.assertEqual(pick_model(24), "qwen2.5-coder:32b")
        self.assertEqual(pick_model(8), "qwen2.5-coder:7b")

    def test_ready(self):
        ai = self.make()
        self.assertTrue(ai.brain.is_running())
        self.assertTrue(ai.brain.has_model())
        ai.brain.ensure_ready()

    def test_chat_streams_and_learns(self):
        ai = self.make()
        tokens = []
        reply, learned, _ = ai.ask("my name is Kai. how do I print?", tokens.append, "game.py", "x = 1")
        self.assertEqual("".join(tokens), FakeOllama.reply)
        self.assertEqual(reply, FakeOllama.reply)
        self.assertTrue(learned)
        path, payload = FakeOllama.requests[-1]
        self.assertEqual(path, "/api/chat")
        system = payload["messages"][0]["content"]
        self.assertIn("CodeBrain", system)
        self.assertIn("Kai", system)                 # memory went in
        self.assertIn("game.py", system)             # editor code went in
        self.assertEqual(payload["options"]["num_ctx"], 8192)
        self.assertEqual(len(ai.history), 2)
        self.assertEqual(ai.xp.total, 2)

    def test_bug_detective_learning_loop(self):
        ai = self.make()
        crash = run_blocking(write_prog("print(scren)\n"), timeout=30)
        ai.bug_detective("print(scren)\n", crash.error_text, "prog.py")
        fix = ai.memory.data["fixes"][0]
        self.assertEqual(fix["lesson"], "always close your brackets.")
        self.assertFalse(fix["confirmed"])
        ok = run_blocking(write_prog("print('fixed')\n"), timeout=30)
        msg = ai.after_run(ok)
        self.assertIn("squashed", msg)
        self.assertTrue(ai.memory.data["fixes"][0]["confirmed"])

    def test_project_files_reach_the_brain(self):
        ai = self.make()
        folder = projects_dir() / f"proj_{time.time_ns()}"
        folder.mkdir(parents=True)
        (folder / "enemies.py").write_text("ZOMBIE_SPEED = 42\n")
        main = folder / "main.py"
        main.write_text("import enemies\n")
        ai.ask("why are zombies fast?", None, "main.py", main.read_text(), main)
        self.assertIn("ZOMBIE_SPEED = 42", FakeOllama.requests[-1][1]["messages"][0]["content"])

    def test_history_fits_budget(self):
        ai = self.make()
        ai.config["context_size"] = 4096
        for i in range(30):
            ai.history += [{"role": "user", "content": "q" * 1500}, {"role": "assistant", "content": "a" * 1500}]
        ai.ask("last question")
        sent = FakeOllama.requests[-1][1]["messages"]
        self.assertLessEqual(sum(len(m["content"]) for m in sent), ai.budget() + 3000)
        self.assertEqual(sent[-1]["content"], "last question")

    def test_look(self):
        ai = self.make()
        statuses = []
        reply, learned, _ = ai.look(b"\x89PNG fake", "", None, "game.py", "x = 1", None, statuses.append)
        vision_path, vision_payload = FakeOllama.requests[-2]
        self.assertEqual(vision_payload["model"], "qwen2.5vl:7b")
        self.assertEqual(len(vision_payload["messages"][0]["images"]), 1)
        self.assertIn("Does anything look wrong", vision_payload["messages"][0]["content"])
        coder_payload = FakeOllama.requests[-1][1]
        self.assertEqual(coder_payload["model"], "test-model")
        self.assertIn("screenshot", coder_payload["messages"][-1]["content"])
        self.assertTrue(reply.startswith("👀"))
        self.assertEqual(len(statuses), 2)

    def test_brain_error(self):
        ai = self.make(model="broken")
        with self.assertRaises(BrainError):
            ai.ask("hi")
        self.assertEqual(ai.history, [])            # failed message isn't kept

    def test_offline(self):
        cfg = Config(tmpfile("config.json"))
        cfg["ollama_url"] = "http://127.0.0.1:9"
        brain = Brain(cfg)
        self.assertFalse(brain.is_running())
        with self.assertRaises(BrainError):
            brain.chat([{"role": "user", "content": "hi"}])


if __name__ == "__main__":
    unittest.main()
