"""🩺 CodeBrain Doctor: checks everything and tells you exactly what to fix."""

import importlib
import os
import shutil
import sys
import time

from codebrain.brain import Brain, _find_ollama
from codebrain.config import Config, detect_vram_gb, pick_model
from codebrain.paths import home_dir, projects_dir

if sys.platform == "win32":
    os.system("")
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

G, Y, R, M, B, END = "\033[92m", "\033[93m", "\033[91m", "\033[90m", "\033[1m", "\033[0m"


class Doctor:
    def __init__(self, deep=True):
        self.deep = deep
        self.problems = 0
        self.warnings = 0

    def ok(self, text):
        print(f"  {G}✅ {text}{END}")

    def warn(self, text, fix):
        self.warnings += 1
        print(f"  {Y}⚠️  {text}{END}\n     {M}👉 {fix}{END}")

    def bad(self, text, fix):
        self.problems += 1
        print(f"  {R}❌ {text}{END}\n     {M}👉 {fix}{END}")

    def section(self, title):
        print(f"\n{B}{title}{END}")

    # ------------------------------------------------------------------ checks
    def check_python(self):
        self.section("🐍 Python")
        v = sys.version_info
        if (3, 10) <= v[:2] <= (3, 13):
            self.ok(f"Python {v.major}.{v.minor}.{v.micro}  ({sys.executable})")
        else:
            self.warn(f"Python {v.major}.{v.minor} might not work with the 3D library (ursina).",
                      "Python 3.12 is best. Run SETUP.bat again.")
        if ".venv" not in sys.executable:
            self.warn("Not running inside CodeBrain's own Python space (.venv).",
                      "Start CodeBrain with CodeBrain.bat, or run SETUP.bat.")

    def check_libraries(self):
        self.section("📦 Libraries")
        for name, why in (("tkinter", "the window app"), ("pygame", "2D games"), ("ursina", "3D games")):
            try:
                importlib.import_module(name)
                self.ok(f"{name} ({why})")
            except Exception as e:
                self.bad(f"{name} is missing ({why}): {e}", "Run SETUP.bat again.")
        from codebrain.voice import Speaker, missing_parts
        missing = missing_parts()
        if missing:
            self.warn(f"Voice won't work, missing: {', '.join(missing)}",
                      "Run SETUP.bat again. (Everything else still works.)")
        else:
            self.ok("faster-whisper + sounddevice (🎤 voice)")
            self.check_microphone()
        if Speaker().available:
            self.ok("Talk-back voice (🔊)")
        else:
            self.warn("No talk-back voice found on this PC.", "On Windows this is built in. On Linux install espeak.")

    def check_microphone(self):
        try:
            import sounddevice as sd
            device = sd.query_devices(kind="input")
            self.ok(f"Microphone: {device['name']}")
        except Exception:
            self.warn("No microphone found.", "Plug in a mic/headset, then check Windows Settings > Privacy > Microphone.")

    def check_gpu(self):
        self.section("🎮 Graphics card")
        vram = detect_vram_gb()
        if vram is None:
            self.warn("Couldn't find an NVIDIA graphics card (nvidia-smi).",
                      "Update your NVIDIA driver from nvidia.com. Without it the brain uses your CPU (much slower).")
        else:
            self.ok(f"{vram:.0f} GB of graphics memory -> best brain: {pick_model(vram)}")

    def check_brain(self):
        self.section("🧠 Brain (Ollama)")
        cfg = Config()
        brain = Brain(cfg)
        exe = _find_ollama()
        if exe:
            self.ok(f"Ollama installed ({exe})")
        else:
            self.bad("Ollama isn't installed.", "Run SETUP.bat, or install it from https://ollama.com/download")
            return
        if brain.start_server():
            self.ok("Ollama is running")
        else:
            self.bad("Ollama won't start.", "Open 'Ollama' from the Start menu, or restart your PC.")
            return
        installed = brain.installed_models()
        if brain.has_model():
            self.ok(f"Brain '{cfg['model']}' is downloaded")
        else:
            self.bad(f"Brain '{cfg['model']}' isn't downloaded. Installed: {', '.join(installed) or 'none'}",
                     "Run SETUP.bat (it downloads it), or pick an installed one in ⚙️ Settings.")
            return
        if not self.deep:
            return
        print(f"  {M}…asking the brain a test question (first time can take ~30 s while it loads)…{END}")
        start = time.time()
        try:
            answer = brain.quick("Reply with exactly the word: READY")
            took = time.time() - start
            if "READY" in answer.upper():
                self.ok(f"Brain answered in {took:.1f} s")
            else:
                self.warn(f"Brain answered something odd: {answer[:60]!r}", "Try SETUP.bat again to re-download it.")
            if took > 90:
                self.warn("The brain is very slow.", "In ⚙️ Settings try a smaller brain like qwen2.5-coder:7b.")
        except Exception as e:
            self.bad(f"Brain test failed: {e}", "Restart Ollama (Start menu) or your PC, then run DOCTOR.bat again.")

    def check_folders(self):
        self.section("📁 Your folders")
        try:
            test = projects_dir() / ".doctor_test"
            test.write_text("ok", encoding="utf-8")
            test.unlink()
            self.ok(f"Projects folder works: {projects_dir()}")
        except OSError as e:
            self.bad(f"Can't write to {projects_dir()}: {e}", "Check the folder isn't read-only or blocked by antivirus.")
        free_gb = shutil.disk_usage(home_dir()).free / 1e9
        if free_gb < 5:
            self.warn(f"Only {free_gb:.1f} GB free on your disk.", "Free up space; brains are 2-20 GB each.")
        else:
            self.ok(f"{free_gb:.0f} GB free disk space")

    def run(self):
        print(f"\n{G}{B}🩺 CodeBrain Doctor{END}  {M}checking everything...{END}")
        for check in (self.check_python, self.check_libraries, self.check_gpu, self.check_brain, self.check_folders):
            try:
                check()
            except Exception as e:  # a broken check shouldn't stop the others
                self.bad(f"{check.__name__} crashed: {e}", "Send this message to whoever helps you with CodeBrain.")
        print()
        if self.problems:
            print(f"{R}{B}❌ Found {self.problems} problem(s). Follow the 👉 tips above.{END}")
        elif self.warnings:
            print(f"{Y}{B}⚠️  CodeBrain works, with {self.warnings} small thing(s) to look at.{END}")
        else:
            print(f"{G}{B}✅ Everything is healthy! Go make something awesome 🔥{END}")
        return self.problems


def run_doctor():
    return Doctor(deep="--quick" not in sys.argv).run()
