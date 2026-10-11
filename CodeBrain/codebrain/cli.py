"""CodeBrain 🧠 hacker terminal mode. Type to chat, /help for commands."""

import os
import sys
from pathlib import Path

from codebrain import lessons as L
from codebrain.assistant import Assistant
from codebrain.codeblocks import best_code
from codebrain.memory import CATEGORIES
from codebrain.paths import projects_dir
from codebrain.runner import run_interactive

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
  {G}/xp{END}              ⭐ your level
  {G}/mode teach|code|hints{END}   how I help you
  {G}/model <name>{END}    switch brain    {G}/clear{END}  new chat    {G}/quit{END}  bye
Anything else = chat with me."""


class CLI:
    def __init__(self):
        self.ai = Assistant()
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
        except KeyboardInterrupt:
            print(f"\n{M}(stopped){END}")
            return None
        except Exception as e:
            print(f"\n{R}⚠️ {e}{END}")
            return None
        if buf[0]:
            print(buf[0])
        self.last_reply = result[0]
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
        self.path.write_text(code + "\n", encoding="utf-8")
        self.say(f"💾 Saved to {self.path}. Type /run to test it!")

    def cmd_run(self, _arg):
        if not self.path:
            return self.say("Open a file first: /open name.py", Y)
        self.say(f"▶ Running {self.path.name} (Ctrl+C to stop)\n" + "─" * 50, M)
        result = run_interactive(self.path)
        self.last_result = result
        print(M + "─" * 50 + END)
        if result.stopped:
            self.say("■ Stopped.", M)
        elif result.crashed:
            self.say("💥 It crashed! Type /fix and I'll explain + fix it.", R)
        else:
            self.say("✅ Finished with no errors!")
        msg = self.ai.after_run(result)
        if msg:
            self.say(msg, Y)

    def cmd_fix(self, _arg):
        if not self.last_result or not self.last_result.crashed:
            return self.say("No crash to investigate. /run your code first 🔍", Y)
        self.stream(lambda t: self.ai.bug_detective(self.code(), self.last_result.error_text, self.path.name, t))

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
            result = self.stream(lambda t: self.ai.ask(line, t, self.path.name if self.path else None, self.code()))
            if result and result[1]:
                for item in result[1]:
                    self.say(f"🧠 Saved to memory: {item['text']}", M)
        self.say("👋 See you next time! Keep coding 🔥")


def run_cli():
    CLI().loop()
