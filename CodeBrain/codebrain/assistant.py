"""The thinking part shared by the window app and the terminal: chat, explain, Bug Detective, eyes, learning."""

import re
from pathlib import Path

from codebrain import prompts
from codebrain import project as P
from codebrain import selfcheck
from codebrain import testrun
from codebrain.codeblocks import best_code
from codebrain.docs import Docs
from codebrain.brain import Brain
from codebrain.config import Config
from codebrain.memory import Memory
from codebrain.style import StyleProfile
from codebrain.xp import XP

CHARS_PER_TOKEN = 3          # code is about 3 characters per token
REPLY_RESERVE = 2048         # tokens kept free for the answer
MAX_EDITOR_CHARS = 8000


class Assistant:
    def __init__(self, config=None, memory=None, xp=None, brain=None, style=None, docs=None):
        self.config = config or Config()
        self.memory = memory or Memory()
        self.xp = xp or XP()
        self.style = style or StyleProfile()
        self.docs = docs or Docs()
        self.brain = brain or Brain(self.config)
        self.history = []          # [{"role": "user"/"assistant", "content": ...}]
        self.pending_fix = None    # a Bug Detective fix waiting to be proven by a good run

    def reset(self):
        self.history = []

    # ---------- fitting everything into the brain's memory ----------
    def budget(self):
        """How many characters fit in one request (if we send more, the brain forgets its instructions)."""
        tokens = int(self.config.get("context_size", 8192)) - REPLY_RESERVE
        return max(6000, tokens * CHARS_PER_TOKEN)

    @staticmethod
    def _trim_history(history, max_chars):
        """Newest messages first, until the budget is used. The newest one is always kept."""
        total, kept = 0, []
        for msg in reversed(history):
            total += len(msg["content"])
            if total > max_chars and kept:
                break
            kept.append(msg)
        return list(reversed(kept))

    def _messages(self, query, filename=None, code=None, path=None, message=""):
        system = prompts.system_prompt(self.config, self.memory, query)
        style = self.style.prompt_text()
        if style:
            system += "\n\n" + style
        api = self.docs.prompt_text(message or query[:500])
        if api:
            system += "\n\n" + api
        room = self.budget() - len(system)
        extra = []
        if code and code.strip():
            limit = int(min(MAX_EDITOR_CHARS, max(1000, room * 0.35)))
            shown = code if len(code) <= limit else code[:limit] + "\n# ... (file is longer, cut off here)"
            extra.append(prompts.EDITOR_CONTEXT.format(filename=filename or "untitled.py", code=shown))
            room -= len(extra[-1])
        if path:
            proj = P.build_context(message, path, code, int(max(0, room * 0.4)))
            if proj:
                extra.append(proj)
                room -= len(proj)
        if extra:
            system += "\n\n" + "\n\n".join(extra)
        return [{"role": "system", "content": system}] + self._trim_history(self.history, max(2000, room))

    def _converse(self, user_text, on_token, query, xp_action="chat", on_status=None, on_reset=None, **ctx):
        self.history.append({"role": "user", "content": user_text})
        try:
            reply = self.brain.chat(self._messages(query, message=user_text, **ctx), on_token=on_token)
        except Exception:
            self.history.pop()
            raise
        self.history.append({"role": "assistant", "content": reply})
        reply = self._self_check(reply, query, on_token, on_status, on_reset, ctx)
        level_up = self.xp.add(xp_action)
        return reply, level_up

    def _self_check(self, reply, query, on_token, on_status, on_reset, ctx, tries=2):
        """🔄 Check the code in the answer; if it's broken, quietly ask for a fixed answer (up to `tries` times)."""
        if not self.config.get("self_check", True):
            return reply
        folder = P.project_folder(ctx["path"]) if ctx.get("path") else None
        for attempt in range(tries + 1):
            problems = selfcheck.check_reply(reply, folder, ctx.get("code"), self.docs)
            if not problems and self.config.get("test_run", True):
                problems = self._test_run(reply, folder, ctx, on_status)
            if not problems:
                return reply
            if attempt == tries:      # still not perfect: be honest about it
                note = ("\n\n⚠️ *My self-check still sees a possible problem: " + "; ".join(problems[:3]) +
                        ". If it crashes, press 🐛 Bug Detective.*")
                if on_token:
                    on_token(note)
                reply += note
                self.history[-1]["content"] = reply
                return reply
            if on_status:
                on_status("🔄 Self-check found a mistake in my code - fixing it...")
            fix_request = prompts.SELF_CHECK.format(problems="\n".join("- " + p for p in problems))
            self.history.append({"role": "user", "content": fix_request})
            try:
                if on_reset:
                    on_reset()
                fixed = self.brain.chat(self._messages(query, message=fix_request, **ctx), on_token=on_token)
            except InterruptedError:
                self.history.pop()
                raise
            except Exception:
                self.history.pop()
                return reply          # couldn't fix it; keep the first answer
            self.history.pop()                                   # the fix request
            self.history[-1] = {"role": "assistant", "content": fixed}   # the fixed answer replaces the old one
            reply = fixed
        return reply

    def _test_run(self, reply, folder, ctx, on_status):
        """🧪 Run the answer's program for a few seconds in a temp copy. Returns problems (or [])."""
        files = dict(P.file_blocks(reply))
        current = Path(ctx["path"]).name if ctx.get("path") else None
        if files:
            main = current if current in files else "main.py" if "main.py" in files else next(iter(files))
        else:
            code = best_code(reply)
            if not code or not selfcheck._looks_complete(code) or "import" not in code:
                return []                          # just a piece of code, nothing to run
            main = current or "main.py"
            files = {main: code}
        if on_status:
            on_status("🧪 Test-running my code for a few seconds...")
        result = testrun.test_run(files, main, folder)
        if result.crashed:
            return [f"when I test-ran {main}, it crashed:\n{result.error[-1500:]}"]
        return []

    # ---------- what the buttons do ----------
    def ask(self, message, on_token=None, filename=None, editor_code=None, path=None, **hooks):
        """Normal chat. Returns (reply, learned_memories, level_up_message).
        hooks: on_status(text), on_reset() - used by the self-check to swap in a fixed answer."""
        learned = self.memory.learn_from_message(message)
        query = message + " " + (editor_code or "")[:2000]
        reply, level_up = self._converse(message, on_token, query, filename=filename, code=editor_code, path=path,
                                         **hooks)
        return reply, learned, level_up

    def explain(self, code, on_token=None):
        text = prompts.EXPLAIN.format(skill=self.config.get("skill_level"), code=code)
        reply, level_up = self._converse(text, on_token, code, xp_action="explain")
        return reply, level_up

    def bug_detective(self, code, error, filename="untitled.py", on_token=None, path=None, **hooks):
        """Explain a crash + give fixed code. Remembers the lesson (confirmed once the fix runs OK)."""
        text = prompts.BUG_DETECTIVE.format(filename=filename, code=code[:MAX_EDITOR_CHARS], error=error[-3000:])
        reply, level_up = self._converse(text, on_token, error + " " + code[:1500], xp_action="explain",
                                         path=path, code=code, **hooks)
        lesson = prompts.extract_lesson(reply) or reply.split("\n\n")[0][:300]
        self.pending_fix = self.memory.add_fix(error, lesson)
        return reply, level_up

    def look(self, png_bytes, question, on_token=None, filename=None, editor_code=None, path=None, on_status=None,
             on_reset=None):
        """👀 Look at a screenshot: the vision brain describes it, then the coding brain fixes the code."""
        question = question.strip() or "Look at my game. Does anything look wrong? How do I fix it?"
        if on_status:
            on_status("👀 Looking at your screenshot...")
        seen = self.brain.see(prompts.LOOK.format(question=question), png_bytes)
        seen = re.sub(r"```.*?(```|\Z)", "", seen, flags=re.S).strip() or "(I couldn't make out much.)"
        header = f"👀 **What I see:** {seen}\n\n"
        if on_token:
            on_token(header)
        if on_status:
            on_status("🧠 Thinking about how to fix it...")

        def reset():               # self-check swapped the answer: keep showing what we saw
            if on_reset:
                on_reset()
            if on_token:
                on_token(header)

        text = prompts.LOOK_FOLLOWUP.format(question=question, seen=seen)
        query = question + " " + (editor_code or "")[:2000]
        reply, level_up = self._converse(text, on_token, query, filename=filename, code=editor_code, path=path,
                                         on_status=on_status, on_reset=reset)
        return f"👀 **What I see:** {seen}\n\n{reply}", [], level_up

    def next_steps(self, on_token=None, **hooks):
        """🧑‍🏫 Suggest what to learn next, based on skills, lessons and projects."""
        from codebrain import lessons as L
        done = set(self.xp.data["lessons_done"])
        text = prompts.NEXT_STEPS.format(
            level=self.xp.level, title=self.xp.title, xp=self.xp.total,
            skills=", ".join(self.style.skills(min_times=1)) or "nothing yet",
            lessons=", ".join(l["title"] for l in L.LESSONS if l["id"] in done) or "none yet",
            todo=", ".join(l["title"] for l in L.LESSONS if l["id"] not in done)[:900] or "none",
            projects=", ".join(p["name"] for p in self.memory.data["projects"]) or "none")
        reply, level_up = self._converse(text, on_token, "learn next lessons skills", **hooks)
        return reply, [], level_up

    def after_run(self, result, code=None):
        """Call after every run. Learns from success/failure. Returns a hype message or None."""
        if result.stopped or result.crashed:
            return None
        if code:
            self.style.learn(code)        # 🎨 it worked -> learn how you like to write code
        msgs = []
        if self.pending_fix:
            self.memory.confirm_fix(self.pending_fix["id"])
            self.pending_fix = None
            msgs.append("🔥 LET'S GO, the bug is squashed! I saved that lesson in my memory.")
            up = self.xp.add("bug_fixed")
        else:
            up = self.xp.add("run_ok")
        if up:
            msgs.append(up)
        return "\n".join(msgs) or None
