"""The thinking part shared by the window app and the terminal: chat, explain, Bug Detective, learning."""

from codebrain import prompts
from codebrain.brain import Brain
from codebrain.config import Config
from codebrain.memory import Memory
from codebrain.xp import XP

MAX_HISTORY_CHARS = 14000   # older chat gets dropped so the brain doesn't overflow
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

    def _trimmed_history(self):
        total, kept = 0, []
        for msg in reversed(self.history):
            total += len(msg["content"])
            if total > MAX_HISTORY_CHARS and kept:
                break
            kept.append(msg)
        return list(reversed(kept))

    def _messages(self, query, extra_context=""):
        system = prompts.system_prompt(self.config, self.memory, query)
        if extra_context:
            system += "\n\n" + extra_context
        return [{"role": "system", "content": system}] + self._trimmed_history()

    def _editor_context(self, filename, code):
        if not code or not code.strip():
            return ""
        if len(code) > MAX_EDITOR_CHARS:
            code = code[:MAX_EDITOR_CHARS] + "\n# ... (file is longer, cut off here)"
        return prompts.EDITOR_CONTEXT.format(filename=filename or "untitled.py", code=code)

    def _converse(self, user_text, on_token, query, extra_context="", xp_action="chat"):
        self.history.append({"role": "user", "content": user_text})
        try:
            reply = self.brain.chat(self._messages(query, extra_context), on_token=on_token)
        except Exception:
            self.history.pop()
            raise
        self.history.append({"role": "assistant", "content": reply})
        level_up = self.xp.add(xp_action)
        return reply, level_up

    # ---------- what the buttons do ----------
    def ask(self, message, on_token=None, filename=None, editor_code=None):
        """Normal chat. Returns (reply, learned_memories, level_up_message)."""
        learned = self.memory.learn_from_message(message)
        query = message + " " + (editor_code or "")[:2000]
        reply, level_up = self._converse(message, on_token, query, self._editor_context(filename, editor_code))
        return reply, learned, level_up

    def explain(self, code, on_token=None):
        text = prompts.EXPLAIN.format(skill=self.config.get("skill_level"), code=code)
        reply, level_up = self._converse(text, on_token, code, xp_action="explain")
        return reply, level_up

    def bug_detective(self, code, error, filename="untitled.py", on_token=None):
        """Explain a crash + give fixed code. Remembers the lesson (confirmed once the fix runs OK)."""
        text = prompts.BUG_DETECTIVE.format(filename=filename, code=code[:MAX_EDITOR_CHARS], error=error[-3000:])
        reply, level_up = self._converse(text, on_token, error + " " + code[:1500], xp_action="explain")
        lesson = prompts.extract_lesson(reply) or reply.split("\n\n")[0][:300]
        self.pending_fix = self.memory.add_fix(error, lesson)
        return reply, level_up

    def after_run(self, result):
        """Call after every run. Learns from success/failure. Returns a hype message or None."""
        if result.stopped:
            return None
        if result.crashed:
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
