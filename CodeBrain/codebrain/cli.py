"""CodeBrain 🧠 hacker terminal mode. Type to chat, /help for commands."""

import os
import sys
import threading
import time
from pathlib import Path

from codebrain import lessons as L
from codebrain.assistant import Assistant
from codebrain.codeblocks import best_code
from codebrain.memory import CATEGORIES
from codebrain.paths import projects_dir
from codebrain.runner import run_interactive
from codebrain import versions as V
from codebrain.snippets import CATEGORIES as SNIPPET_CATEGORIES
from codebrain.snippets import Snippets, snippet_part
from codebrain.voice import PushToTalk, Speaker, missing_parts

if sys.platform == "win32":
    os.system("")  # turns on colors in the Windows terminal
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

G, DG, Y, R, B, M, BOLD, END = ("\033[92m", "\033[32m", "\033[93m", "\033[91m", "\033[96m",
                                "\033[90m", "\033[1m", "\033[0m")

BANNER = f"""{G}{BOLD}
   ██████╗ ██████╗ ██████╗ ███████╗██████╗ ██████╗  █████╗ ██╗███╗   ██╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
  ██║     ██║   ██║██║  ██║█████╗  ██████╔╝██████╔╝███████║██║██╔██╗ ██║
  ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║
  ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝██║  ██║██║  ██║██║██║ ╚████║
   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝{END}
{DG}   🧠 offline coding coach  •  type /help for commands{END}
"""

HELP = f"""{G}{BOLD}Commands{END}
  {G}/open <file>{END}     open a file (it becomes 'your code' that I can see)
  {G}/new <name>{END}      make a new file in your projects folder
  {G}/save{END}            save my last code answer into your open file
  {G}/run{END}             run your open file (Ctrl+C stops it)
  {G}/fix{END}             🐛 Bug Detective on the last crash
  {G}/explain{END}         🔍 explain your open file
  {G}/files{END}           list your projects
  {G}/lessons{END}         📚 list lessons    {G}/lesson <id>{END}  start one (example: /lesson py1)
  {G}/memory{END}          🧠 see my memories  {G}/forget <id>{END}  delete one
  {G}/remember <text>{END} make me remember something
  {G}/voice{END}           🎤 talk to me (press Enter when you're done talking)
  {G}/speak on|off{END}    🔊 read my answers out loud
  {G}/snippets{END}        📦 list snippets   {G}/snippet <id>{END}  show one
  {G}/snippet <id> add{END}  add it to your file   {G}/snippet <id> try{END}  run its demo
  {G}/look <question>{END} 📸 I take a screenshot in 3 seconds (switch to your game!) and look at it
  {G}/project <name>{END}  🎮 new game project in its own folder
  {G}/versions{END}        🕘 backups of your file   {G}/restore <n>{END}  go back to backup n
  {G}/style{END}           🎨 what I learned about how you code
  {G}/xp{END}              ⭐ your level
  {G}/mode teach|code|hints{END}   how I help you
  {G}/model <name>{END}    switch brain    {G}/clear{END}  new chat    {G}/quit{END}  bye
Anything else = chat with me."""


class CLI:
    def __init__(self):
        self.ai = Assistant()
        self.snippets = Snippets()
        self.speaker = Speaker()
        self.ptt = None
        self.path = None
        self.last_reply = ""
        self.last_result = None

    # ---------- helpers ----------
    def say(self, text, color=G):
        print(f"{color}{text}{END}")

    def code(self):
        if self.path and self.path.exists():
            return self.path.read_text(encoding="utf-8", errors="replace")
        return ""

    def resolve(self, name):
        p = Path(name).expanduser()
        if not p.is_absolute():
            p = projects_dir() / p
        if p.suffix == "" and not p.exists():
            p = p.with_suffix(".py")
        return p

    def hooks(self):
        def on_status(text):
            print(f"\n{M}{text}{END}", flush=True)

        def on_reset():
            print(f"\n{Y}🔄 I double-checked my code and found a mistake. Here's the fixed answer:{END}\n", flush=True)
        return {"on_status": on_status, "on_reset": on_reset}

    def stream(self, job):
        print(f"\n{G}{BOLD}🧠 CodeBrain{END}")
        in_code = [False]
        buf = [""]

        def on_token(tok):
            # color code blocks green, line by line
            buf[0] += tok
            while "\n" in buf[0]:
                line, buf[0] = buf[0].split("\n", 1)
                if line.strip().startswith("```"):
                    in_code[0] = not in_code[0]
                    print(f"{M}{line}{END}")
                else:
                    print(f"{G}{line}{END}" if in_code[0] else line)
                sys.stdout.flush()

        try:
            result = job(on_token)
            if buf[0]:
                print(buf[0])
                buf[0] = ""
        except KeyboardInterrupt:
            print(f"\n{M}(stopped){END}")
            return None
        except Exception as e:
            print(f"\n{R}⚠️ {e}{END}")
            return None
        self.last_reply = result[0]
        if self.ai.config.get("speak_answers", True):
            self.speaker.say(self.last_reply)
        if best_code(self.last_reply):
            self.say("📥 Type /save to put this code into your file" +
                     ("" if self.path else " (open or /new a file first)"), M)
        if result[-1]:
            self.say(result[-1], Y)
        return result

    # ---------- commands ----------
    def cmd_open(self, arg):
        if not arg:
            return self.say("Usage: /open my_game.py", Y)
        p = self.resolve(arg)
        if not p.exists():
            return self.say(f"Can't find {p}. Use /new {arg} to make it.", R)
        self.path = p
        self.say(f"📄 Opened {p}")

    def cmd_new(self, arg):
        p = self.resolve(arg or "my_program.py")
        if p.exists():
            self.say(f"{p.name} already exists - opening it instead.", Y)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('# My program\nprint("Hello from CodeBrain! 🧠")\n', encoding="utf-8")
            self.ai.xp.add("new_file")
            self.say(f"📄 Created {p}")
        self.path = p

    def cmd_save(self, _arg):
        code = best_code(self.last_reply)
        if not code:
            return self.say("My last answer had no code in it.", Y)
        if not self.path:
            self.cmd_new("my_program.py")
        if self.path.exists():
            V.save_version(self.path, self.path.read_text(encoding="utf-8", errors="replace"), "before-save")
        self.path.write_text(code + "\n", encoding="utf-8")
        V.save_version(self.path, code + "\n", "save")
        self.say(f"💾 Saved to {self.path}. Type /run to test it!")

    def cmd_run(self, _arg):
        if not self.path:
            return self.say("Open a file first: /open name.py", Y)
        self.say(f"▶ Running {self.path.name} (Ctrl+C to stop)\n" + "─" * 50, M)
        code = self.code()
        V.save_version(self.path, code, "run")
        result = run_interactive(self.path)
        self.last_result = result
        print(M + "─" * 50 + END)
        if result.stopped:
            self.say("■ Stopped.", M)
        elif result.crashed:
            self.say("💥 It crashed! Type /fix and I'll explain + fix it.", R)
        else:
            self.say("✅ Finished with no errors!")
        msg = self.ai.after_run(result, code=code)
        if msg:
            self.say(msg, Y)

    def cmd_versions(self, _arg):
        if not self.path:
            return self.say("Open a file first: /open name.py", Y)
        versions = V.list_versions(self.path)
        if not versions:
            return self.say("No backups yet. /run or /save and I'll start keeping them 💾", Y)
        for n, (_v, stamp, lines) in enumerate(versions, start=1):
            print(f"  {Y}{n:>3}{END}  {stamp}  {M}({lines} lines){END}")
        self.say("Go back with /restore <number>", M)

    def cmd_restore(self, arg):
        versions = V.list_versions(self.path) if self.path else []
        if not arg.strip().isdigit() or not 1 <= int(arg) <= len(versions):
            return self.say("Which one? See /versions", Y)
        old = versions[int(arg) - 1][0].read_text(encoding="utf-8", errors="replace")
        V.save_version(self.path, self.code(), "before-restore")
        self.path.write_text(old, encoding="utf-8")
        self.say(f"↩ Restored backup {arg}. (Your code from before is backed up too.)")

    def cmd_style(self, _arg):
        style = self.ai.style
        self.say(f"🎨 I've studied {style.data['programs']} of your programs that worked.")
        for line in style.summary_lines():
            print(f"  • You {line}")
        if style.skills():
            print(f"  🧠 You've used: {', '.join(style.skills())}")

    def cmd_fix(self, _arg):
        if not self.last_result or not self.last_result.crashed:
            return self.say("No crash to investigate. /run your code first 🔍", Y)
        self.stream(lambda t: self.ai.bug_detective(self.code(), self.last_result.error_text, self.path.name, t,
                                                    self.path, **self.hooks()))

    def cmd_explain(self, _arg):
        code = self.code()
        if not code.strip():
            return self.say("Open a file first: /open name.py", Y)
        self.stream(lambda t: self.ai.explain(code, t))

    def cmd_files(self, _arg):
        files = self.ai.memory.scan_project_files(limit=100)
        if not files:
            return self.say(f"No projects yet! Make one with /new. Folder: {projects_dir()}", Y)
        for name, summary in files:
            print(f"  {G}{name}{END}  {M}{summary}{END}")

    def cmd_lessons(self, _arg):
        done = set(self.ai.xp.data["lessons_done"])
        for track in L.TRACKS:
            self.say(f"\n{BOLD}{track}")
            for lesson in L.in_track(track):
                mark = "✅" if lesson["id"] in done else "⬜"
                print(f"  {mark} {Y}{lesson['id']:<5}{END} {lesson['title']}")
        self.say("\nStart one with /lesson <id>", M)

    def cmd_lesson(self, arg):
        lesson = L.by_id(arg.strip())
        if not lesson:
            return self.say("Which one? Example: /lesson py1  (see /lessons)", Y)
        self.say(f"\n{BOLD}{lesson['title']}")
        print(lesson["text"])
        if lesson.get("code"):
            folder = projects_dir() / "lessons"
            folder.mkdir(exist_ok=True)
            self.path = folder / f"lesson_{lesson['id']}.py"
            self.path.write_text(lesson["code"], encoding="utf-8")
            self.say(f"\n📄 Example saved + opened: {self.path}\nType /run to try it.", M)
        if lesson.get("challenge"):
            self.say("🏆 CHALLENGE: " + lesson["challenge"], Y)
        if lesson.get("ask"):
            self.stream(lambda t: self.ai.ask(lesson["ask"], t, self.path.name if self.path else None, self.code()))
            if input(f"{Y}Did you finish this step? (y/n) {END}").lower().startswith("y"):
                self.say(self.ai.xp.finish_lesson(lesson["id"]) or "✅ Step done!", Y)
        quiz = lesson.get("quiz")
        if quiz:
            self.say(f"\n❓ QUIZ: {quiz['q']}", B)
            for i, opt in enumerate(quiz["options"], 1):
                print(f"   {i}. {opt}")
            while True:
                ans = input(f"{B}Your answer (number, or Enter to skip): {END}").strip()
                if not ans:
                    break
                if ans.isdigit() and int(ans) - 1 == quiz["answer"]:
                    self.say("✅ Correct! " + quiz["why"])
                    for msg in (self.ai.xp.add("quiz_right"), self.ai.xp.finish_lesson(lesson["id"])):
                        if msg:
                            self.say(msg, Y)
                    break
                self.say("❌ Not quite, try again!", R)

    def cmd_memory(self, _arg):
        mem = self.ai.memory
        for cat in CATEGORIES:
            self.say(f"\n{BOLD}{cat.upper()}")
            for item in mem.data[cat]:
                text = item.get("text") or (f"{item.get('name')}: {item.get('description')}" if cat == "projects"
                                            else f"{item.get('error')} → {item.get('lesson')}")
                print(f"  {M}[{item['id']}]{END} {text[:150]}")
        self.say("\nDelete with /forget <id>", M)

    def cmd_forget(self, arg):
        self.say("🗑 Forgotten." if self.ai.memory.forget(arg.strip()) else "No memory with that id.", Y)

    def cmd_remember(self, arg):
        if arg.strip():
            self.ai.memory.add_note(arg)
            self.say("🧠 Got it, I'll remember that.")

    def cmd_xp(self, _arg):
        self.say("⭐ " + self.ai.xp.summary(), Y)

    def cmd_mode(self, arg):
        if arg.strip() in ("teach", "code", "hints"):
            self.ai.config["teach_mode"] = arg.strip()
            self.say(f"Mode: {arg.strip()}")
        else:
            self.say("Use /mode teach, /mode code or /mode hints", Y)

    def cmd_model(self, arg):
        if not arg.strip():
            return self.say(f"Current brain: {self.ai.brain.model}\nInstalled: {', '.join(self.ai.brain.installed_models())}")
        self.ai.config["model"] = arg.strip()
        self.start_brain()

    def cmd_voice(self, _arg):
        missing = missing_parts()
        if missing:
            return self.say(f"Voice isn't installed (missing: {', '.join(missing)}). Run SETUP.bat again.", Y)
        if self.ptt is None:
            self.ptt = PushToTalk(self.ai.config.get("voice_model", "base.en"))
        self.speaker.stop()
        try:
            self.ptt.press()
        except Exception as e:
            return self.say(f"🎤 {e}", R)
        input(f"{R}🔴 Listening... talk now, then press Enter.{END}")
        done = threading.Event()
        heard = {}
        self.say("✍️ Turning your voice into text... (first time takes longer)", M)
        self.ptt.release(on_text=lambda t: (heard.update(text=t), done.set()),
                         on_error=lambda m: (heard.update(error=m), done.set()))
        done.wait()
        if heard.get("error"):
            return self.say(heard["error"], R)
        text = heard.get("text", "")
        if not text:
            return self.say("🎤 I didn't hear anything. Try again!", Y)
        print(f"{B}{BOLD}you said:{END} {text}")
        self.chat(text)

    def cmd_speak(self, arg):
        on = arg.strip().lower() != "off"
        self.ai.config["speak_answers"] = on
        if not on:
            self.speaker.stop()
        self.say("🔊 I'll read my answers out loud." if on else "🔇 Okay, text only.")

    def cmd_snippets(self, _arg):
        for cat in SNIPPET_CATEGORIES:
            items = self.snippets.in_category(cat)
            if items:
                self.say(f"\n{BOLD}{cat}")
                for s in items:
                    print(f"  {Y}{s['id']:<14}{END} {s['name']}  {M}{s['description'][:70]}{END}")
        self.say("\nShow one with /snippet <id>", M)

    def cmd_snippet(self, arg):
        sid, _, action = arg.strip().partition(" ")
        snippet = self.snippets.get(sid)
        if not snippet:
            return self.say("Which one? See /snippets", Y)
        part = snippet_part(snippet["code"])
        if action == "add":
            if not self.path:
                return self.say("Open a file first: /open name.py", Y)
            with self.path.open("a", encoding="utf-8") as f:
                f.write("\n" + part + "\n")
            return self.say(f"📥 Added '{snippet['name']}' to the end of {self.path.name}")
        if action == "try":
            folder = projects_dir() / "snippets"
            folder.mkdir(exist_ok=True)
            demo = folder / f"try_{snippet['id']}.py"
            demo.write_text(snippet["code"], encoding="utf-8")
            self.say(f"▶ Running the demo (Ctrl+C to stop)", M)
            run_interactive(demo)
            return
        self.say(f"\n{BOLD}{snippet['name']}{END}{G}  {snippet['description']}")
        print(f"{G}{part}{END}")
        self.say(f"\n/snippet {sid} add  -> add to your file   •   /snippet {sid} try  -> run the demo", M)

    def cmd_look(self, arg):
        brain = self.ai.brain
        if not brain.has_model(brain.vision_model):
            if not input(f"{Y}I need my eyes ({brain.vision_model}, ~6 GB, one time). Download? (y/n) {END}"
                         ).lower().startswith("y"):
                return
            last = [""]

            def progress(t):
                if t != last[0]:
                    last[0] = t
                    print(f"\r{M}{t[:90]:<90}{END}", end="", flush=True)
            try:
                brain.pull_model(progress, model=brain.vision_model)
                print()
            except Exception as e:
                return self.say(f"\n⚠️ {e}", R)
        from codebrain.screenshot import grab_screen, to_png
        for n in (3, 2, 1):
            print(f"{Y}📸 Switch to your game... {n}{END}", flush=True)
            time.sleep(1)
        try:
            png = to_png(grab_screen())
        except Exception as e:
            return self.say(f"Couldn't take a screenshot: {e}", R)
        self.say("📸 Got it! Looking...", M)
        name = self.path.name if self.path else None
        self.stream(lambda t: self.ai.look(png, arg, t, name, self.code(), self.path, **self.hooks()))

    def cmd_project(self, arg):
        name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in arg.strip()) or "my_game"
        folder = projects_dir() / name
        folder.mkdir(parents=True, exist_ok=True)
        main = folder / "main.py"
        if not main.exists():
            main.write_text(f'# {name} - start here!\nprint("Welcome to {name}! 🎮")\n', encoding="utf-8")
        self.path = main
        self.say(f"🎮 Project '{name}' ready: {main}\nEvery file in that folder, I can read when you ask about it.")

    def chat(self, line):
        result = self.stream(lambda t: self.ai.ask(line, t, self.path.name if self.path else None, self.code(),
                                                   self.path, **self.hooks()))
        if result and result[1]:
            for item in result[1]:
                self.say(f"🧠 Saved to memory: {item['text']}", M)

    def cmd_clear(self, _arg):
        self.ai.reset()
        self.say("🧹 Fresh chat! (Long-term memory is still there.)")

    # ---------- main loop ----------
    def start_brain(self):
        self.say(f"🧠 Waking up the brain ({self.ai.brain.model})...", M)
        last = [""]

        def progress(text):
            if text != last[0]:
                last[0] = text
                print(f"\r{M}{text[:90]:<90}{END}", end="", flush=True)

        try:
            self.ai.brain.ensure_ready(progress)
            print()
            self.say("🧠 Brain ready!")
        except Exception as e:
            print()
            self.say(f"⚠️ {e}", R)

    def loop(self):
        print(BANNER)
        self.say("⭐ " + self.ai.xp.summary(), Y)
        self.start_brain()
        commands = {name[4:]: getattr(self, name) for name in dir(self) if name.startswith("cmd_")}
        while True:
            try:
                prompt_name = self.path.name if self.path else "no file"
                line = input(f"\n{B}{BOLD}you{END}{M} ({prompt_name}){END} {G}❯{END} ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if not line:
                continue
            if line.startswith("/"):
                name, _, arg = line[1:].partition(" ")
                if name in ("quit", "exit", "q"):
                    break
                if name == "help":
                    print(HELP)
                elif name in commands:
                    try:
                        commands[name](arg)
                    except KeyboardInterrupt:
                        print()
                else:
                    self.say("Unknown command. Type /help", Y)
                continue
            self.chat(line)
        self.speaker.stop()
        self.say("👋 See you next time! Keep coding 🔥")


def run_cli():
    CLI().loop()
