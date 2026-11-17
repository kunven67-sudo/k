"""Your PC, for the no-lag check (Piece 3). Read once from Windows itself (registry + memory info, no
programs run): CPU, RAM, graphics card + its memory, and where Blender is. Builds are told to make every game
run smooth on THIS PC (auto quality, light textures) and to test it."""
from __future__ import annotations

import ctypes
import glob
import os
import platform
import shutil
from functools import lru_cache


def _reg(path: str, name: str) -> str | int | None:
    try:
        import winreg  # type: ignore[import-not-found]
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as k:
            return winreg.QueryValueEx(k, name)[0]
    except Exception:
        return None


def _gpus() -> list[dict]:
    out = []
    try:
        import winreg  # type: ignore[import-not-found]
        base = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, base) as k:
            for i in range(32):
                try:
                    sub = winreg.EnumKey(k, i)
                except OSError:
                    break
                name = _reg(f"{base}\\{sub}", "DriverDesc")
                if not name:
                    continue
                mem = _reg(f"{base}\\{sub}", "HardwareInformation.qwMemorySize") or _reg(f"{base}\\{sub}", "HardwareInformation.MemorySize")
                if isinstance(mem, bytes):
                    mem = int.from_bytes(mem[:8], "little")
                out.append({"name": str(name), "vram_gb": round(int(mem) / 1024 ** 3, 1) if isinstance(mem, int) and mem > 0 else None})
    except Exception:
        pass
    return [g for g in out if "basic display" not in g["name"].lower()]


def _ram_gb() -> float | None:
    if platform.system() == "Windows":
        class MS(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong), ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong), ("ullTotalPageFile", ctypes.c_ulonglong),
                        ("ullAvailPageFile", ctypes.c_ulonglong), ("ullTotalVirtual", ctypes.c_ulonglong),
                        ("ullAvailVirtual", ctypes.c_ulonglong), ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        m = MS()
        m.dwLength = ctypes.sizeof(MS)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)):  # type: ignore[attr-defined]
            return round(m.ullTotalPhys / 1024 ** 3, 1)
        return None
    try:
        with open("/proc/meminfo") as f:
            return round(int(f.readline().split()[1]) / 1024 ** 2, 1)
    except (OSError, ValueError, IndexError):
        return None


def find_blender() -> str:
    if platform.system() == "Windows":
        for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", "")):
            if base:
                hits = sorted(glob.glob(os.path.join(base, "Blender Foundation", "Blender*", "blender.exe")))
                if hits:
                    return hits[-1]
        steam = r"C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe"
        if os.path.isfile(steam):
            return steam
    return shutil.which("blender") or ""


@lru_cache(maxsize=1)
def profile() -> dict:
    cpu = _reg(r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "ProcessorNameString") if platform.system() == "Windows" else None
    if not cpu:
        try:
            with open("/proc/cpuinfo") as f:
                cpu = next((ln.split(":", 1)[1].strip() for ln in f if ln.startswith("model name")), None)
        except OSError:
            cpu = None
    return {"os": platform.platform(), "cpu": " ".join(str(cpu or platform.processor() or "unknown").split()),
            "threads": os.cpu_count(), "ram_gb": _ram_gb(), "gpus": _gpus() if platform.system() == "Windows" else [],
            "blender": find_blender()}


def prompt_block(override: str = "") -> str:
    p = profile()
    if override.strip():
        pc = override.strip()
    else:
        gpu = ", ".join(f"{g['name']}" + (f" ({g['vram_gb']} GB)" if g.get("vram_gb") else "") for g in p["gpus"]) or "unknown graphics card"
        pc = f"{p['cpu']} ({p['threads']} threads), {p['ram_gb'] or '?'} GB RAM, {gpu}"
    lines = [f"THE HUMAN'S PC: {pc}.",
             "NO-LAG RULE: every game or 3D thing you build must run smooth on THAT PC. Add an auto quality setting "
             "(picks low/medium/high from the frame rate) plus a manual quality option, keep textures 1K-2K, keep draw "
             "calls and shadows sensible, and test the frame rate before you call it done."]
    if p.get("blender"):
        lines.append(f"BLENDER is installed: {p['blender']}. Make real 3D models with it in background mode "
                     "(blender -b -P your_script.py), render a preview PNG and look at it (Read the png).")
    else:
        lines.append("BLENDER isn't installed. If a job needs real 3D models, ask the human to let you install it "
                     "(winget install BlenderFoundation.Blender).")
    return "\n".join(lines)
