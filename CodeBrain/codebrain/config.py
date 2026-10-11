"""Settings saved in brain/config.json."""

import json
import shutil
import subprocess

from codebrain.paths import brain_dir

# Which brain (AI model) to use, picked by how much graphics card memory (VRAM) you have.
# All of these are free coding models that run offline through Ollama.
MODEL_BY_VRAM = [
    (20, "qwen2.5-coder:32b"),  # 24 GB+ cards (RTX 3090/4090/5090)
    (10, "qwen2.5-coder:14b"),  # 12-16 GB cards (RTX 3060 12GB/4070/4080)
    (6, "qwen2.5-coder:7b"),    # 8 GB cards
    (0, "qwen2.5-coder:3b"),    # weak PCs / no graphics card
]

DEFAULTS = {
    "model": "qwen2.5-coder:14b",
    "ollama_url": "http://127.0.0.1:11434",
    "context_size": 8192,       # how much the brain can "see" at once
    "temperature": 0.2,         # low = careful + correct code
    "teach_mode": "teach",      # teach | code | hints
    "skill_level": "total beginner",
    "font_size": 12,
    "voice_model": "base.en",   # base.en = fast, small.en = understands you better
    "speak_answers": True,      # 🔊 read answers out loud
    "voice_auto_send": True,    # send right after you finish talking
    "vision_model": "qwen2.5vl:7b",   # 👀 CodeBrain's eyes (only downloaded if you say yes)
    "self_check": True,         # 🔄 check its own code for mistakes before you use it
    "test_run": True,           # 🧪 secretly test-run its own code for a few seconds (safe code only)
    "autocomplete": True,       # 👻 gray ghost-text suggestions while you type (Tab accepts)
}


def detect_vram_gb():
    """Return the graphics card memory in GB, or None if we can't tell."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10,
        ).stdout
        values = [int(v.strip()) for v in out.splitlines() if v.strip().isdigit()]
        return max(values) / 1024 if values else None
    except Exception:
        return None


def pick_context(vram_gb):
    """Bigger cards can let the brain see more at once (more code + longer chats)."""
    if vram_gb is not None and vram_gb >= 14:
        return 16384
    return 8192


def pick_model(vram_gb):
    if vram_gb is None:
        return DEFAULTS["model"]
    for min_gb, model in MODEL_BY_VRAM:
        if vram_gb >= min_gb:
            return model
    return MODEL_BY_VRAM[-1][1]


class Config:
    def __init__(self, path=None):
        self.path = path or brain_dir() / "config.json"
        self.data = dict(DEFAULTS)
        if self.path.exists():
            try:
                self.data.update(json.loads(self.path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass
        else:
            vram = detect_vram_gb()
            self.data["model"] = pick_model(vram)
            self.data["context_size"] = pick_context(vram)
            self.save()

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value
        self.save()

    def get(self, key, default=None):
        return self.data.get(key, default)

    def save(self):
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
