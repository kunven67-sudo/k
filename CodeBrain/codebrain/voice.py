"""🎤 Voice: push-to-talk speech-to-text + 🔊 CodeBrain reading answers out loud. All offline.

- Hearing you: faster-whisper (a speech AI that runs on your PC) + sounddevice (the microphone).
  The voice model (~150 MB) downloads once, the first time, then works with no internet.
- Talking back: Windows' built-in voice (no download needed).
"""

import re
import shutil
import subprocess
import sys
import threading

SAMPLE_RATE = 16000


class VoiceError(Exception):
    pass


def missing_parts():
    """Which voice libraries aren't installed (empty list = voice works)."""
    missing = []
    try:
        import faster_whisper  # noqa: F401
    except Exception:
        missing.append("faster-whisper")
    try:
        import sounddevice  # noqa: F401
    except Exception:  # OSError when the microphone library (PortAudio) is missing
        missing.append("sounddevice")
    return missing


# ====================================================================== hearing
class Recorder:
    """Records the microphone between start() and stop()."""

    def __init__(self):
        self._chunks = []
        self._stream = None

    def start(self):
        import sounddevice as sd
        self._chunks = []

        def callback(indata, frames, time_info, status):
            self._chunks.append(indata.copy())

        try:
            self._stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=callback)
            self._stream.start()
        except Exception as e:
            self._stream = None
            raise VoiceError(f"Can't open the microphone: {e}") from e

    def stop(self):
        """Stop recording and return the sound as a numpy array (or None)."""
        import numpy as np
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            finally:
                self._stream = None
        if not self._chunks:
            return None
        return np.concatenate(self._chunks)[:, 0]


class Transcriber:
    """Turns recorded sound into text with faster-whisper. Uses the graphics card if it can."""

    def __init__(self, model_name="base.en"):
        self.model_name = model_name
        self._model = None
        self._lock = threading.Lock()

    def _load(self, device):
        from faster_whisper import WhisperModel
        compute = "float16" if device == "cuda" else "int8"
        return WhisperModel(self.model_name, device=device, compute_type=compute)

    def load(self):
        with self._lock:
            if self._model is None:
                try:
                    self._model = self._load("cuda")
                except Exception:
                    self._model = self._load("cpu")
        return self._model

    def transcribe(self, audio):
        if audio is None or len(audio) < SAMPLE_RATE * 0.3:   # under 0.3 s = nothing said
            return ""
        model = self.load()
        try:
            return self._run(model, audio)
        except Exception:
            # The graphics card version can fail when CUDA files are missing -> use the CPU instead.
            with self._lock:
                self._model = self._load("cpu")
            return self._run(self._model, audio)

    @staticmethod
    def _run(model, audio):
        segments, _info = model.transcribe(audio, language="en", beam_size=5, vad_filter=True)
        return " ".join(s.text.strip() for s in segments).strip()


class PushToTalk:
    """Glue for the 🎤 button: press() starts listening, release() stops and gives you the text.

    on_text(text) / on_error(message) get called from a background thread.
    """

    def __init__(self, model_name="base.en", recorder=None, transcriber=None):
        self.recorder = recorder or Recorder()
        self.transcriber = transcriber or Transcriber(model_name)
        self.listening = False

    def preload(self):
        threading.Thread(target=self._safe_load, daemon=True).start()

    def _safe_load(self):
        try:
            self.transcriber.load()
        except Exception:
            pass  # we'll show the real error when they actually press the mic

    def press(self):
        if self.listening:
            return
        self.recorder.start()
        self.listening = True

    def release(self, on_text, on_error):
        if not self.listening:
            return
        self.listening = False
        audio = self.recorder.stop()

        def work():
            try:
                on_text(self.transcriber.transcribe(audio))
            except Exception as e:
                on_error(f"Voice problem: {e}")

        threading.Thread(target=work, daemon=True).start()


# ====================================================================== talking
_CODE_BLOCK = re.compile(r"```.*?(```|\Z)", re.S)
_EMOJI = re.compile("[\U0001F000-\U0001FFFF☀-➿⬀-⯿️‍]")


def speakable(text, limit=1200):
    """Clean an answer for reading out loud: no code, no markdown, no emojis."""
    said_code = [False]

    def code_note(_m):
        if said_code[0]:
            return " "
        said_code[0] = True
        return "\nI put the code on the screen.\n"

    text = _CODE_BLOCK.sub(code_note, text)
    text = re.sub(r"https?://\S+", "a link", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"[*_#>|]+", "", text)
    text = _EMOJI.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text).strip()
    if len(text) > limit:
        cut = text.rfind(".", 0, limit)
        text = text[: cut + 1 if cut > limit // 2 else limit] + " ...The rest is on the screen."
    return text


def _speech_command():
    if sys.platform == "win32":
        script = ("[Console]::InputEncoding = [Text.Encoding]::UTF8;"
                  "Add-Type -AssemblyName System.Speech;"
                  "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
                  "$s.Rate = 1;"
                  "$s.Speak([Console]::In.ReadToEnd())")
        return ["powershell", "-NoProfile", "-NonInteractive", "-Command", script]
    if sys.platform == "darwin" and shutil.which("say"):
        return ["say", "-f", "-"]
    for exe in ("espeak-ng", "espeak"):
        if shutil.which(exe):
            return [exe, "--stdin"]
    return None


class Speaker:
    """Reads text out loud in the background. stop() shuts it up instantly."""

    def __init__(self):
        self._proc = None
        self._lock = threading.Lock()
        self.command = _speech_command()

    @property
    def available(self):
        return self.command is not None

    def say(self, text):
        text = speakable(text)
        if not text or not self.available:
            return
        self.stop()
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        try:
            with self._lock:
                self._proc = subprocess.Popen(self.command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                              stderr=subprocess.DEVNULL, creationflags=flags)
                proc = self._proc
        except OSError:
            return

        def feed():
            try:
                proc.stdin.write(text.encode("utf-8"))
                proc.stdin.close()
            except OSError:
                pass

        threading.Thread(target=feed, daemon=True).start()

    def stop(self):
        with self._lock:
            if self._proc and self._proc.poll() is None:
                self._proc.kill()
            self._proc = None
