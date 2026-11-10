"""Build the portable Windows version of OVERDRIVE (works from Linux too).

  python build/build_windows.py            -> build/dist/OVERDRIVE/ and build/dist/OVERDRIVE-windows.zip

What goes in:
  OVERDRIVE.exe          tiny Go launcher (no console window)
  python/                official Python embeddable package (python.org) + the exact wheels from requirements.txt
  app/overdrive/         OVERDRIVE itself
  app/*.md               setup, limitations, readme
The ~300 MB Claude Code copy bundled inside claude-agent-sdk is left out: OVERDRIVE uses the Claude Code
you install (it keeps itself up to date).
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

PY_VERSION = "3.13.17"
EMBED_URL = f"https://www.python.org/ftp/python/{PY_VERSION}/python-{PY_VERSION}-embed-amd64.zip"
# Matches python.org's official SBOM (python-3.13.17-embed-amd64.zip.spdx.json). The build stops if it ever differs.
EMBED_SHA256 = "9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38"

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = HERE / ".cache"
DIST = HERE / "dist"
OUT = DIST / "OVERDRIVE"


def log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


def download(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"downloading {url}")
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f)
    tmp.replace(dest)
    return dest


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def wheels() -> list[Path]:
    req = ROOT / "requirements-windows.txt"
    key = hashlib.sha256((ROOT / "requirements.txt").read_bytes() + req.read_bytes()).hexdigest()[:12]
    wdir = CACHE / f"wheels-{key}"
    if not wdir.exists() or not list(wdir.glob("*.whl")):
        wdir.mkdir(parents=True, exist_ok=True)
        log("downloading Windows wheels")
        subprocess.check_call([sys.executable, "-m", "pip", "download", "-q", "--only-binary=:all:",
                               "--platform", "win_amd64", "--python-version", "3.13", "--implementation", "cp",
                               "--no-deps", "-r", str(req), "-d", str(wdir)])
    return sorted(wdir.glob("*.whl"))


def install_wheel(whl: Path, site: Path) -> None:
    with zipfile.ZipFile(whl) as z:
        for info in z.infolist():
            name = info.filename
            if name.endswith("/"):
                continue
            parts = name.split("/")
            if parts[0].endswith(".data"):
                if len(parts) > 2 and parts[1] in ("purelib", "platlib"):
                    target = site.joinpath(*parts[2:])
                else:
                    continue  # scripts / headers / data: not needed
            else:
                target = site.joinpath(*parts)
            if "_bundled" in parts:      # Claude Code copy inside claude-agent-sdk (~300 MB): skip
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst)


def copy_app(dest: Path) -> None:
    def ignore(d: str, names: list[str]) -> list[str]:
        return [n for n in names if n == "__pycache__" or n.endswith(".pyc")]
    shutil.copytree(ROOT / "overdrive", dest / "overdrive", ignore=ignore)
    for doc in ("README.md", "SETUP.md", "LIMITATIONS.md"):
        shutil.copy2(ROOT / doc, dest / doc)


def build_launcher(dest: Path) -> None:
    ldir = HERE / "launcher"
    env = dict(os.environ, GOOS="windows", GOARCH="amd64", CGO_ENABLED="0")
    winres = shutil.which("go-winres") or os.environ.get("GO_WINRES", "")
    if winres:
        subprocess.check_call([winres, "make", "--in", "winres.json", "--arch", "amd64"], cwd=ldir)
    else:
        log("go-winres not found: building the launcher without an icon")
    subprocess.check_call(["go", "build", "-trimpath", "-ldflags", "-H windowsgui -s -w", "-o", str(dest), "."],
                          cwd=ldir, env=env)
    for syso in ldir.glob("*.syso"):
        syso.unlink()


START_HERE = """OVERDRIVE (Stage 1: Core)

1. Keep this whole folder together (OVERDRIVE.exe needs the python and app folders next to it).
2. Double-click OVERDRIVE.exe.
3. The Setup screen installs Claude Code and signs you in with your claude.ai account (one button each).

Your stuff is saved in C:\\Users\\<you>\\OVERDRIVE (workspace, versions, logs). Deleting this folder doesn't touch it.
More: app\\SETUP.md and app\\LIMITATIONS.md
"""


def main() -> None:
    embed = download(EMBED_URL, CACHE / f"python-{PY_VERSION}-embed-amd64.zip")
    digest = sha256(embed)
    log(f"python embed sha256 {digest}")
    if EMBED_SHA256 and digest != EMBED_SHA256:
        raise SystemExit("python embeddable zip hash changed! refusing to build")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    py = OUT / "python"
    with zipfile.ZipFile(embed) as z:
        z.extractall(py)
    site = py / "Lib" / "site-packages"
    site.mkdir(parents=True, exist_ok=True)
    whls = wheels()
    for w in whls:
        install_wheel(w, site)
    log(f"installed {len(whls)} wheels")
    pth = next(py.glob("python3*._pth"))
    zipname = next(py.glob("python3*.zip")).name
    pth.write_text(f"{zipname}\n.\nLib\\site-packages\n..\\app\nimport site\n", encoding="ascii")
    for d in list(py.rglob("__pycache__")):
        shutil.rmtree(d, ignore_errors=True)
    copy_app(OUT / "app")
    build_launcher(OUT / "OVERDRIVE.exe")
    (OUT / "START HERE.txt").write_text(START_HERE.replace("\n", "\r\n"), encoding="utf-8")
    zpath = DIST / "OVERDRIVE-windows.zip"
    if zpath.exists():
        zpath.unlink()
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(OUT.rglob("*")):
            if p.is_file():
                z.write(p, f"OVERDRIVE/{p.relative_to(OUT).as_posix()}")
    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    log(f"folder {size / 1e6:.1f} MB, zip {zpath.stat().st_size / 1e6:.1f} MB -> {zpath}")


if __name__ == "__main__":
    main()
