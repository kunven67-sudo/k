"""Keyboard AI: Claude types for you, straight into whatever window you click.

Tell it a topic ("tell me everything about Earth") and it writes about it,
pressing the keys on your keyboard as it goes. It keeps going, round after
round, digging deeper into the topic until it has nothing left to say, you hit
the round limit, or you press ESC.

Usage:
    python keyboard_ai.py "tell me everything about Earth"
    python keyboard_ai.py            (it will ask you for the topic)

Press ESC at any time to stop typing.
"""

import argparse
import sys
import threading
import time

import anthropic

MODEL = "claude-opus-5-5"
DONE_MARKER = "[ALL DONE]"

SYSTEM_PROMPT = f"""You are a writer whose words are typed live, key by key, into \
the user's keyboard. Whatever you write appears in their document as you write it.

Rules:
- Write plain text only. No markdown: no #, no **, no tables, no code fences.
  Use simple dashes for lists and blank lines between paragraphs.
- Be thorough, accurate and interesting. Cover the topic like an expert who
  wants the reader to end up with a really good understanding of it.
- Each turn, write one solid section, then stop. The user will ask you to keep
  going, and you continue with the next part. Never repeat what you already wrote.
- Plan the whole thing so it builds up from the basics to deep, advanced
  detail, and finish with a short summary.
- When you have truly covered everything worth saying, end your final turn
  with the exact text {DONE_MARKER} on its own line."""

KEEP_GOING = (
    "Keep going with the next part. Go deeper and cover something new. "
    f"If everything worth saying is covered, write the closing summary and end with {DONE_MARKER}"
)


class Typist:
    """Types text into the focused window and listens for ESC to stop."""

    def __init__(self, delay, newline_mode):
        # Imported here so --help works on machines without a display.
        from pynput import keyboard

        self._keyboard = keyboard
        self._controller = keyboard.Controller()
        self._delay = delay
        self._newline_mode = newline_mode
        self.stopped = threading.Event()
        self._listener = keyboard.Listener(on_press=self._on_press)
        self._listener.daemon = True
        self._listener.start()

    def _on_press(self, key):
        if key == self._keyboard.Key.esc:
            self.stopped.set()
            return False
        return None

    def _newline(self):
        Key = self._keyboard.Key
        if self._newline_mode == "enter":
            self._controller.tap(Key.enter)
        elif self._newline_mode == "shift-enter":
            with self._controller.pressed(Key.shift):
                self._controller.tap(Key.enter)
        else:
            self._controller.type(" ")

    def type(self, text):
        for char in text:
            if self.stopped.is_set():
                return
            if char == "\n":
                self._newline()
            elif char != "\r":
                self._controller.type(char)
            if self._delay:
                time.sleep(self._delay)


def write_round(client, messages, typist):
    """Streams one section from Claude, typing it as it arrives.

    Returns the final message, or None if the user pressed ESC.
    """
    pending = ""  # held back so the DONE marker never gets typed
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=SYSTEM_PROMPT,
        messages=messages,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    ) as stream:
        for text in stream.text_stream:
            if typist.stopped.is_set():
                return None
            pending += text
            safe = len(pending) - len(DONE_MARKER)
            if safe > 0:
                typist.type(pending[:safe])
                pending = pending[safe:]
        message = stream.get_final_message()

    typist.type(pending.replace(DONE_MARKER, "").rstrip())
    return message


def main():
    parser = argparse.ArgumentParser(description="Claude types for you on your keyboard.")
    parser.add_argument("topic", nargs="*", help='what to write about, e.g. "tell me everything about Earth"')
    parser.add_argument("--rounds", type=int, default=0,
                        help="max sections to write (0 = no limit, keep going until it's done)")
    parser.add_argument("--delay", type=float, default=0.01,
                        help="seconds between key presses (default 0.01)")
    parser.add_argument("--countdown", type=int, default=5,
                        help="seconds to wait so you can click into the window to type in")
    parser.add_argument("--newline", choices=["enter", "shift-enter", "space"], default="enter",
                        help="how to type line breaks (use shift-enter for chat apps)")
    args = parser.parse_args()

    topic = " ".join(args.topic).strip() or input("What should I write about? > ").strip()
    if not topic:
        sys.exit("No topic given.")

    client = anthropic.Anthropic()
    typist = Typist(args.delay, args.newline)

    print(f"Click into the window you want me to type in. Starting in {args.countdown}s...")
    for i in range(args.countdown, 0, -1):
        print(f"  {i}...")
        time.sleep(1)
    print("Typing! Press ESC to stop.")

    messages = [{"role": "user", "content": topic}]
    rounds = 0
    while True:
        message = write_round(client, messages, typist)
        rounds += 1
        if message is None:
            print("\nStopped (ESC).")
            break
        if message.stop_reason == "refusal":
            print("\nClaude declined to write about that.")
            break

        text = "".join(b.text for b in message.content if b.type == "text")
        if DONE_MARKER in text:
            print(f"\nDone! Wrote {rounds} section(s).")
            break
        if args.rounds and rounds >= args.rounds:
            print(f"\nHit the {args.rounds}-section limit.")
            break

        # Send the whole assistant turn back (keeps thinking blocks intact).
        messages.append({"role": "assistant", "content": message.content})
        messages.append({"role": "user", "content": KEEP_GOING})
        typist.type("\n\n")
        print(f"  section {rounds} done, keep going...")


if __name__ == "__main__":
    main()
