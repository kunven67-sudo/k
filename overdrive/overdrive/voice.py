"""OVERDRIVE's own ears (Piece 4): speech typing that runs on your PC, no browser needed.

OVERDRIVE's window is its own app now (WebView2), and WebView2 has no speech typing. So OVERDRIVE listens itself:
your mic -> Vosk (an offline speech recognizer) -> words, sent to the window as "voice" events while you talk.
Works without internet once the voice pack is downloaded (once, the first time you press the mic):
  small  = vosk-model-small-en-us-0.15  (about 40 MB, fast, good)
  better = vosk-model-en-us-0.22-lgraph (about 128 MB, more accurate, a bit slower)

Talking back (its voice) stays in the window (speechSynthesis); say() is a Windows fallback (SAPI) for windows
that have no voices.
Tests: OVERDRIVE_VOICE_WAV=<file.wav> makes it "hear" that file instead of the mic.
"""
from __future__ import annotations

import json
import os
import queue
import shutil
import threading
import time
import urllib.request
import wave
import zipfile
from pathlib import Path
from typing import Callable

MODELS = {
    "small": ("vosk-model-small-en-us-0.15", "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip", 40,
              "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"),
    "better": ("vosk-model-en-us-0.22-lgraph", "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip", 128, ""),
}
# The speech engine itself (Vosk's DLLs, from its official PyPI package), fetched with the first voice pack.
ENGINE_URL = ("https://files.pythonhosted.org/packages/c0/4c/deb0861f7da9696f8a255f1731bb73e9412cca29c4b3888a3fcb2a930a59/"
              "vosk-0.3.45-py3-none-win_amd64.whl")
ENGINE_SHA256 = "6994ddc68556c7e5730c3b6f6bad13320e3519b13ce3ed2aa25a86724e7c10ac"
ENGINE_FILES = ("libvosk.dll", "libstdc++-6.dll", "libgcc_s_seh-1.dll", "libwinpthread-1.dll")


class _CEngine:
    """Vosk through its C library (ctypes): no extra Python packages needed."""

    def __init__(self, lib_path: Path):
        import ctypes
        if os.name == "nt":
            os.add_dll_directory(str(lib_path.parent))          # its 3 helper DLLs sit next to it
        lib = ctypes.CDLL(str(lib_path))
        lib.vosk_model_new.restype = ctypes.c_void_p
        lib.vosk_model_new.argtypes = [ctypes.c_char_p]
        lib.vosk_recognizer_new.restype = ctypes.c_void_p
        lib.vosk_recognizer_new.argtypes = [ctypes.c_void_p, ctypes.c_float]
        lib.vosk_recognizer_accept_waveform.restype = ctypes.c_int
        lib.vosk_recognizer_accept_waveform.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
        for f in ("vosk_recognizer_result", "vosk_recognizer_partial_result", "vosk_recognizer_final_result"):
            getattr(lib, f).restype = ctypes.c_char_p
            getattr(lib, f).argtypes = [ctypes.c_void_p]
        lib.vosk_recognizer_free.argtypes = [ctypes.c_void_p]
        lib.vosk_set_log_level.argtypes = [ctypes.c_int]
        lib.vosk_set_log_level(-1)
        self.lib = lib
        eng = self

        class Model:
            def __init__(self, path: str):
                self.h = lib.vosk_model_new(str(path).encode("utf-8"))
                if not self.h:
                    raise VoiceError("The voice pack is broken. Delete OVERDRIVE\\data\\voice and press the mic again.")

        class KaldiRecognizer:
            def __init__(self, model, rate):
                self.h = lib.vosk_recognizer_new(model.h, float(rate))

            def AcceptWaveform(self, data: bytes) -> bool:  # noqa: N802
                return bool(lib.vosk_recognizer_accept_waveform(self.h, data, len(data)))

            def Result(self) -> str:  # noqa: N802
                return (lib.vosk_recognizer_result(self.h) or b"{}").decode("utf-8", "replace")

            def PartialResult(self) -> str:  # noqa: N802
                return (lib.vosk_recognizer_partial_result(self.h) or b"{}").decode("utf-8", "replace")

            def FinalResult(self) -> str:  # noqa: N802
                return (lib.vosk_recognizer_final_result(self.h) or b"{}").decode("utf-8", "replace")

            def __del__(self):
                try:
                    lib.vosk_recognizer_free(self.h)
                except Exception:
                    pass
        self.Model, self.KaldiRecognizer = Model, KaldiRecognizer
        del eng


def _sha256(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class VoiceError(Exception):
    pass


class Voice:
    def __init__(self, data_dir: Path, publish: Callable[..., None], audit: Callable[[str, dict], None] | None = None):
        self.dir = Path(data_dir) / "voice"
        self.publish = publish
        self.audit = audit or (lambda *_: None)
        self.lock = threading.Lock()
        self.downloading: dict | None = None
        self._model = None
        self._model_name = ""
        self.session = 0
        self.listening = ""            # "" / "dict" / "voice"
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_error = ""
        self._eng = None

    # ------------------------------------------------------------------ the voice pack
    def model_dir(self, which: str) -> Path:
        return self.dir / MODELS.get(which, MODELS["small"])[0]

    def have_model(self, which: str) -> bool:
        d = self.model_dir(which)
        return (d / "am").is_dir() or (d / "conf").is_dir()

    # ---- the engine: Vosk's C library (downloaded once) or the vosk Python package if it's installed
    @property
    def engine_dir(self) -> Path:
        return self.dir / "engine"

    def _engine_lib(self) -> Path | None:
        env = os.environ.get("OVERDRIVE_VOICE_ENGINE", "")
        if env and Path(env).is_file():
            return Path(env)
        lib = self.engine_dir / "libvosk.dll"
        return lib if os.name == "nt" and lib.is_file() else None

    def engine(self):
        if self._eng is not None:
            return self._eng
        lib = self._engine_lib()
        if lib is not None:
            self._eng = _CEngine(lib)
            return self._eng
        try:
            import vosk
            try:
                vosk.SetLogLevel(-1)
            except Exception:
                pass
            self._eng = vosk
        except Exception:
            self._eng = None
        return self._eng

    def engine_ok(self) -> bool:
        if self._engine_lib() is not None:
            return True
        try:
            import importlib.util
            return importlib.util.find_spec("vosk") is not None
        except Exception:
            return False

    def status(self, which: str = "small") -> dict:
        engine = self.engine_ok()
        return {"engine": engine, "can_get_engine": engine or os.name == "nt", "model": which,
                "ready": engine and self.have_model(which),
                "size_mb": MODELS.get(which, MODELS["small"])[2] + (0 if engine else 14), "downloading": self.downloading,
                "listening": self.listening, "error": self.last_error,
                "test_file": bool(os.environ.get("OVERDRIVE_VOICE_WAV"))}

    def download(self, which: str = "small") -> None:
        """Get the voice pack (in the background). Progress comes as "voice" events (kind=download)."""
        name, url, mb, sha = MODELS.get(which, MODELS["small"])
        need_engine = not self.engine_ok() and (os.name == "nt" or os.environ.get("OVERDRIVE_VOICE_ENGINE_URL"))
        with self.lock:
            if self.downloading or (self.have_model(which) and not need_engine):
                return
            self.downloading = {"model": which, "done": 0, "total": (mb + (14 if need_engine else 0)) * 1_000_000}
        threading.Thread(target=self._download, args=(which, name, url, sha, need_engine), daemon=True).start()

    def _fetch(self, url: str, dest: Path) -> None:
        req = urllib.request.Request(url, headers={"User-Agent": "OVERDRIVE"})
        last = 0.0
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 16)
                if not chunk:
                    break
                f.write(chunk)
                self.downloading["done"] += len(chunk)
                if time.monotonic() - last > 0.4:
                    last = time.monotonic()
                    self.publish("voice", kind="download", done=self.downloading["done"], total=self.downloading["total"])

    def _download(self, which: str, name: str, url: str, sha: str, need_engine: bool) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        tmp = self.dir / (name + ".zip.part")
        etmp = self.dir / "engine.whl.part"
        try:
            if need_engine:
                eurl = os.environ.get("OVERDRIVE_VOICE_ENGINE_URL") or ENGINE_URL
                self._fetch(eurl, etmp)
                if not os.environ.get("OVERDRIVE_VOICE_ENGINE_URL") and _sha256(etmp) != ENGINE_SHA256:
                    raise VoiceError("the speech engine download didn't match (blocked or changed)")
                self.engine_dir.mkdir(parents=True, exist_ok=True)
                with zipfile.ZipFile(etmp) as z:
                    for f in ENGINE_FILES:
                        with z.open(f"vosk/{f}") as src, open(self.engine_dir / f, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                self._eng = None
            if not self.have_model(which):
                self._fetch(os.environ.get("OVERDRIVE_VOICE_MODEL_URL") or url, tmp)
                if sha and not os.environ.get("OVERDRIVE_VOICE_MODEL_URL") and _sha256(tmp) != sha:
                    raise VoiceError("the voice pack download didn't match (blocked or changed)")
                out = self.dir / (name + ".unpack")
                if out.exists():
                    shutil.rmtree(out, ignore_errors=True)
                with zipfile.ZipFile(tmp) as z:
                    root = out.resolve()
                    for m in z.infolist():                 # never write outside the voice folder
                        target = (out / m.filename).resolve()
                        if root not in target.parents and target != root:
                            raise VoiceError("bad file in the voice pack")
                    z.extractall(out)
                inner = next((p for p in out.iterdir() if p.is_dir()), out)
                final = self.model_dir(which)
                if final.exists():
                    shutil.rmtree(final, ignore_errors=True)
                shutil.move(str(inner), str(final))
                shutil.rmtree(out, ignore_errors=True)
            self.audit("voice_pack_downloaded", {"model": name, "engine": need_engine})
            self.publish("voice", kind="download_done", model=which)
        except Exception as e:
            self.last_error = f"Couldn't download the voice pack: {e}"
            self.publish("voice", kind="error", error=self.last_error)
        finally:
            for t in (tmp, etmp):
                try:
                    t.unlink()
                except OSError:
                    pass
            self.downloading = None

    def _load(self, which: str):
        if self._model is not None and self._model_name == which:
            return self._model
        eng = self.engine()
        if eng is None:
            raise VoiceError("The speech engine isn't here yet. Press the mic again to download it.")
        self._model = eng.Model(str(self.model_dir(which)))
        self._model_name = which
        return self._model

    # ------------------------------------------------------------------ listening
    def start(self, for_what: str, which: str = "small", device: str = "") -> int:
        if for_what not in ("dict", "voice"):
            raise VoiceError("unknown listening kind")
        st = self.status(which)
        if not st["can_get_engine"]:
            raise VoiceError("The speech engine (Vosk) is missing from this OVERDRIVE build.")
        if not st["ready"]:
            self.download(which)
            raise VoiceError("downloading")
        self.stop()
        self.session += 1
        sid = self.session
        self.listening = for_what
        self.last_error = ""
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, args=(sid, which, device, self._stop), daemon=True)
        self._thread.start()
        return sid

    def stop(self) -> None:
        self._stop.set()
        t = self._thread
        if t and t.is_alive() and t is not threading.current_thread():
            t.join(timeout=2)
        self._thread = None
        self.listening = ""

    def _run(self, sid: int, which: str, device: str, stop: threading.Event) -> None:
        try:
            model = self._load(which)
            vosk = self.engine()
            wav = os.environ.get("OVERDRIVE_VOICE_WAV", "")
            if wav:
                self._listen_file(sid, model, vosk, Path(wav), stop)
            else:
                self._listen_mic(sid, model, vosk, device, stop)
        except Exception as e:
            msg = str(e)
            if "PortAudio" in msg or "device" in msg.lower() or "Invalid" in msg:
                msg = ("No microphone found (or Windows is blocking it). Plug one in, or turn on Windows Settings > "
                       "Privacy > Microphone > Let desktop apps use your microphone.")
            self.last_error = msg
            self.publish("voice", kind="error", error=msg, session=sid)
        finally:
            if self.session == sid:
                self.listening = ""
            self.publish("voice", kind="end", session=sid)

    def _feed(self, sid: int, rec, data: bytes, state: dict) -> None:
        # loudness for the mic glow (about 10 a second)
        if len(data) >= 2 and time.monotonic() - state["lvl_t"] > 0.1:
            state["lvl_t"] = time.monotonic()
            import array
            a = array.array("h")
            a.frombytes(data[: len(data) // 2 * 2])
            peak = max((abs(x) for x in a[::8]), default=0)
            self.publish("voice", kind="level", level=round(min(1.0, peak / 12000), 2), session=sid)
        if rec.AcceptWaveform(data):
            text = json.loads(rec.Result()).get("text", "").strip()
            if text:
                self.publish("voice", kind="final", text=text, session=sid)
            state["partial"] = ""
        else:
            part = json.loads(rec.PartialResult()).get("partial", "").strip()
            if part and part != state["partial"]:
                state["partial"] = part
                self.publish("voice", kind="partial", text=part, session=sid)

    def _listen_file(self, sid: int, model, vosk, path: Path, stop: threading.Event) -> None:
        with wave.open(str(path), "rb") as w:
            rec = vosk.KaldiRecognizer(model, w.getframerate())
            state = {"lvl_t": 0.0, "partial": ""}
            fast = os.environ.get("OVERDRIVE_VOICE_FAST") == "1"
            while not stop.is_set():
                data = w.readframes(4000)
                if not data:
                    break
                self._feed(sid, rec, data, state)
                if not fast:
                    time.sleep(4000 / w.getframerate())
            text = json.loads(rec.FinalResult()).get("text", "").strip()
            if text:
                self.publish("voice", kind="final", text=text, session=sid)

    def _listen_mic(self, sid: int, model, vosk, device: str, stop: threading.Event) -> None:
        import sounddevice as sd
        dev = int(device) if str(device).isdigit() else None
        info = sd.query_devices(dev, "input")
        rate = int(info.get("default_samplerate") or 16000)
        rec = vosk.KaldiRecognizer(model, rate)
        q: queue.Queue[bytes] = queue.Queue(maxsize=200)

        def cb(indata, frames, t, status):          # runs on the sound card's thread: just hand it over
            try:
                q.put_nowait(bytes(indata))
            except queue.Full:
                pass
        state = {"lvl_t": 0.0, "partial": ""}
        with sd.RawInputStream(samplerate=rate, blocksize=int(rate * 0.2), device=dev, dtype="int16",
                               channels=1, callback=cb):
            self.publish("voice", kind="open", session=sid, mic=str(info.get("name", "")))
            while not stop.is_set():
                try:
                    data = q.get(timeout=0.3)
                except queue.Empty:
                    continue
                self._feed(sid, rec, data, state)
        text = json.loads(rec.FinalResult()).get("text", "").strip()
        if text:
            self.publish("voice", kind="final", text=text, session=sid)

    @staticmethod
    def mics() -> list[dict]:
        try:
            import sounddevice as sd
            return [{"id": str(i), "name": d["name"]} for i, d in enumerate(sd.query_devices())
                    if d.get("max_input_channels", 0) > 0 and d.get("hostapi") == 0]
        except Exception:
            return []


def say_windows(text: str, rate: int = 0) -> bool:
    """Fallback voice: Windows' own SAPI voice (only when the window has no voices). Talks in its own thread."""
    try:
        import win32com.client  # type: ignore  # noqa: F401
    except Exception:
        return False

    def run() -> None:
        try:
            import pythoncom  # type: ignore
            import win32com.client  # type: ignore
            pythoncom.CoInitialize()
            v = win32com.client.Dispatch("SAPI.SpVoice")
            v.Rate = max(-10, min(10, int(rate)))
            v.Speak(text[:4000], 0)
        except Exception:
            pass
    threading.Thread(target=run, daemon=True).start()
    return True
