"""Your own backgrounds (Piece 4): a picture or a video you pick becomes OVERDRIVE's moving background.

Saved in OVERDRIVE\\data\\backgrounds. Only real pictures (JPEG/PNG/WebP/GIF) and videos (MP4/WebM) are kept,
checked by their first bytes, not by their name. Up to 400 MB a file.
"""
from __future__ import annotations

import re
import secrets
from pathlib import Path

MAX_BYTES = 400 * 1024 * 1024
NAME = re.compile(r"[a-z0-9]{6,40}\.(jpg|png|webp|gif|mp4|webm)")
MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif", "mp4": "video/mp4", "webm": "video/webm"}


class BackgroundError(ValueError):
    pass


def kind_of(head: bytes) -> str | None:
    if head[:3] == b"\xff\xd8\xff":
        return "jpg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if head[4:8] == b"ftyp":
        return "mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    return None


class Backgrounds:
    def __init__(self, data_dir: Path):
        self.dir = Path(data_dir) / "backgrounds"

    def path(self, name: str) -> Path | None:
        if not NAME.fullmatch(name or ""):
            return None
        p = self.dir / name
        return p if p.is_file() else None

    def list(self) -> list[dict]:
        if not self.dir.is_dir():
            return []
        out = []
        for p in sorted(self.dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if NAME.fullmatch(p.name):
                out.append({"name": p.name, "video": p.suffix in (".mp4", ".webm"), "mb": round(p.stat().st_size / 1e6, 1)})
        return out

    async def save_stream(self, chunks) -> str:
        """Save an upload as it streams in (big videos never sit in memory)."""
        self.dir.mkdir(parents=True, exist_ok=True)
        tmp = self.dir / f".up-{secrets.token_hex(6)}"
        size, head = 0, b""
        try:
            with open(tmp, "wb") as f:
                async for chunk in chunks:
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise BackgroundError("That file is too big (400 MB max).")
                    if len(head) < 16:
                        head += chunk[:16]
                    f.write(chunk)
            kind = kind_of(head)
            if not kind:
                raise BackgroundError("Only pictures (JPG, PNG, WebP, GIF) and videos (MP4, WebM) can be backgrounds.")
            name = f"{secrets.token_hex(8)}.{kind}"
            tmp.replace(self.dir / name)
            return name
        finally:
            if tmp.exists():
                tmp.unlink()

    def delete(self, name: str) -> None:
        p = self.path(name)
        if p is None:
            raise BackgroundError("no such background")
        p.unlink()
