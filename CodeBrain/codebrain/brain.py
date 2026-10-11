"""Talks to the AI brain (Ollama) running on YOUR PC. No API key, no internet needed."""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

# Never send local brain traffic through a proxy.
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class BrainError(Exception):
    pass


def _find_ollama():
    found = shutil.which("ollama")
    if found:
        return found
    if sys.platform == "win32":
        local = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe")
        if os.path.exists(local):
            return local
    return None


class Brain:
    def __init__(self, config):
        self.config = config

    @property
    def url(self):
        return self.config["ollama_url"].rstrip("/")

    @property
    def model(self):
        return self.config["model"]

    # ---------- low level ----------
    def _request(self, path, payload=None, timeout=10):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(
            self.url + path, data=data,
            headers={"Content-Type": "application/json"},
            method="POST" if data is not None else "GET",
        )
        return _opener.open(req, timeout=timeout)

    def _stream(self, path, payload, timeout=600):
        """Yield each JSON line Ollama sends back."""
        try:
            with self._request(path, payload, timeout=timeout) as resp:
                for raw in resp:
                    raw = raw.strip()
                    if not raw:
                        continue
                    msg = json.loads(raw.decode("utf-8"))
                    if msg.get("error"):
                        raise BrainError(msg["error"])
                    yield msg
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            try:
                detail = json.loads(detail).get("error", detail)
            except ValueError:
                pass
            raise BrainError(detail) from e
        except urllib.error.URLError as e:
            raise BrainError(
                "Can't reach the brain (Ollama). Is it installed? Run SETUP.bat first."
            ) from e

    # ---------- health ----------
    def is_running(self):
        try:
            with self._request("/api/tags", timeout=2):
                return True
        except Exception:
            return False

    def start_server(self, wait=15):
        """Start Ollama in the background if it isn't running yet."""
        if self.is_running():
            return True
        exe = _find_ollama()
        if not exe:
            return False
        flags = 0
        if sys.platform == "win32":
            flags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
        try:
            subprocess.Popen([exe, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             stdin=subprocess.DEVNULL, creationflags=flags)
        except OSError:
            return False
        end = time.time() + wait
        while time.time() < end:
            if self.is_running():
                return True
            time.sleep(0.5)
        return False

    def installed_models(self):
        try:
            with self._request("/api/tags", timeout=5) as resp:
                return [m["name"] for m in json.loads(resp.read()).get("models", [])]
        except Exception:
            return []

    def has_model(self, model=None):
        model = model or self.model
        want = model if ":" in model else model + ":latest"
        return want in self.installed_models()

    def pull_model(self, on_progress=None, model=None):
        """Download a brain. on_progress(text) gets called with status updates."""
        for msg in self._stream("/api/pull", {"model": model or self.model, "stream": True}, timeout=None):
            if on_progress:
                status = msg.get("status", "")
                total, done = msg.get("total"), msg.get("completed")
                if total and done:
                    status += f" {done / total:.0%} ({done / 1e9:.1f}/{total / 1e9:.1f} GB)"
                on_progress(status)

    def ensure_ready(self, on_progress=None):
        """Make sure the server runs and the model is downloaded."""
        if not self.start_server():
            raise BrainError(
                "The brain (Ollama) isn't running and I couldn't start it.\n"
                "Run SETUP.bat, or open the Ollama app from the Start menu."
            )
        if not self.has_model():
            if on_progress:
                on_progress(f"Downloading brain '{self.model}' (one time only)...")
            self.pull_model(on_progress)

    # ---------- thinking ----------
    def chat(self, messages, on_token=None, temperature=None):
        """Send a conversation, stream the answer token by token, return full text."""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "keep_alive": "30m",
            "options": {
                "num_ctx": int(self.config["context_size"]),
                "temperature": self.config["temperature"] if temperature is None else temperature,
            },
        }
        parts = []
        for msg in self._stream("/api/chat", payload):
            token = msg.get("message", {}).get("content", "")
            if token:
                parts.append(token)
                if on_token:
                    on_token(token)
            if msg.get("done"):
                break
        return "".join(parts)

    @property
    def vision_model(self):
        return self.config.get("vision_model", "qwen2.5vl:7b")

    def see(self, prompt, png_bytes):
        """👀 Ask the vision brain about a picture. Returns its description."""
        import base64
        payload = {
            "model": self.vision_model,
            "messages": [{"role": "user", "content": prompt,
                          "images": [base64.b64encode(png_bytes).decode("ascii")]}],
            "stream": True,
            "keep_alive": "5m",
            "options": {"temperature": 0.1, "num_ctx": 8192},
        }
        return "".join(m.get("message", {}).get("content", "") for m in self._stream("/api/chat", payload)).strip()

    def quick(self, prompt, system=None):
        """One-shot question, no streaming (used for small background jobs)."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return self.chat(messages, temperature=0)
