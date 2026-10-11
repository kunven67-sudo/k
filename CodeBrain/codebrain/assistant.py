"""The thinking part shared by the window app and the terminal: chat, explain, Bug Detective, eyes, learning."""

import re

from codebrain import prompts
from codebrain import project as P
from codebrain.brain import Brain
from codebrain.config import Config
from codebrain.memory import Memory
from codebrain.xp import XP

CHARS_PER_TOKEN = 3          # code is about 3 characters per token
REPLY_RESERVE = 2048         # tokens kept free for the answer
MAX_EDITOR_CHARS = 8000


class Assistant:
    def __init__(self, config=None, memory=None, xp=None, brain=None):
        self.config = config or Config()
        self.memory = memory or Memory()
        self.xp = xp or XP()
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

    def _converse(self, user_text, on_token, query, xp_action="chat", **ctx):
        self.history.append({"role": "user", "content": user_text})
        try:
            reply = self.brain.chat(self._messages(query, message=user_text, **ctx), on_token=on_token)
        except Exception:
            self.history.pop()
            raise
        self.history.append({"role": "assistant", "content": reply})
        level_up = self.xp.add(xp_action)
        return reply, level_up

    # ---------- what the buttons do ----------
    def ask(self, message, on_token=None, filename=None, editor_code=None, path=None):
        """Normal chat. Returns (reply, learned_memories, level_up_message)."""
        learned = self.memory.learn_from_message(message)
        query = message + " " + (editor_code or "")[:2000]
        reply, level_up = self._converse(message, on_token, query, filename=filename, code=editor_code, path=path)
        return reply, learned, level_up

    def explain(self, code, on_token=None):
        text = prompts.EXPLAIN.format(skill=self.config.get("skill_level"), code=code)
        reply, level_up = self._converse(text, on_token, code, xp_action="explain")
        return reply, level_up

    def bug_detective(self, code, error, filename="untitled.py", on_token=None, path=None):
        """Explain a crash + give fixed code. Remembers the lesson (confirmed once the fix runs OK)."""
        text = prompts.BUG_DETECTIVE.format(filename=filename, code=code[:MAX_EDITOR_CHARS], error=error[-3000:])
        reply, level_up = self._converse(text, on_token, error + " " + code[:1500], xp_action="explain",
                                         path=path, code=code)
        lesson = prompts.extract_lesson(reply) or reply.split("\n\n")[0][:300]
        self.pending_fix = self.memory.add_fix(error, lesson)
        return reply, level_up

    def look(self, png_bytes, question, on_token=None, filename=None, editor_code=None, path=None, on_status=None):
        """👀 Look at a screenshot: the vision brain describes it, then the coding brain fixes the code."""
        question = question.strip() or "Look at my game. Does anything look wrong? How do I fix it?"
        if on_status:
            on_status("👀 Looking at your screenshot...")
        seen = self.brain.see(prompts.LOOK.format(question=question), png_bytes)
        seen = re.sub(r"```.*?(```|\Z)", "", seen, flags=re.S).strip() or "(I couldn't make out much.)"
        if on_token:
            on_token(f"👀 **What I see:** {seen}\n\n")
        if on_status:
            on_status("🧠 Thinking about how to fix it...")
        text = prompts.LOOK_FOLLOWUP.format(question=question, seen=seen)
        query = question + " " + (editor_code or "")[:2000]
        reply, level_up = self._converse(text, on_token, query, filename=filename, code=editor_code, path=path)
        return f"👀 **What I see:** {seen}\n\n{reply}", [], level_up

    def after_run(self, result):
        """Call after every run. Learns from success/failure. Returns a hype message or None."""
        if result.stopped or result.crashed:
            return None
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
