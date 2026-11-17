"""Import a notes folder (or a .zip of one) into OVERDRIVE's memory (Piece 3).

The human's old memory lives as Markdown notes (a CLAUDE.md with rules, notes/*.md with projects,
me/*.md about them). This reads those notes ONCE into OVERDRIVE's own memory, sorted into kinds, so
there is only one memory afterwards. Running it again is safe: every section remembers where it came
from, so a changed section updates its row (the old text is kept as history), an unchanged one is
skipped, and a row the human deleted on the Memory page never comes back.

Only text notes are read (.md / .markdown / .txt), at most MAX_FILES files and MAX_TOTAL bytes.
Nothing here runs code from the notes; their text is stored as data (the shield flags order-like text).
"""
from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from .memory import MAX_CONTENT, MAX_TITLE, Memory, MemoryError

TEXT_EXT = {".md", ".markdown", ".txt"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", "send", ".venv", "venv", "dist", "build", "assets"}
MAX_FILES = 400
MAX_FILE_BYTES = 2_000_000
MAX_TOTAL = 25_000_000
PACK_NAMES = ("memory-pack.zip", "memory-pack")

# Which CLAUDE.md headings hold rules (each bullet = one rule) and which hold "what's going on now".
RULE_HEADINGS = re.compile(r"rule|talk|making|usage|style|do this|always|never|privacy|private|preferences?",
                           re.I)
NOW_HEADINGS = re.compile(r"\bnow\b|current|status|today", re.I)
EXPERIENCE_FILES = re.compile(r"talk|answers|handoff|archive|night-shift|morning|report|journal|diary|log", re.I)
ABOUT_FILES = re.compile(r"(^|[-_ ])(likes|about|profile|preferences)([-_ ]|$)|^me$", re.I)
PEOPLE_HEADINGS = re.compile(r"^(people|friends?|family|contacts?)\b", re.I)


class ImportError_(ValueError):
    pass


@dataclass
class Section:
    file: str            # path inside the notes, with / slashes
    heading: str
    text: str


@dataclass
class Item:
    key: str
    kind: str
    title: str
    content: str
    tags: list[str] = field(default_factory=list)


# ------------------------------------------------------------------ reading the notes
def _read_files(source: Path) -> tuple[dict[str, str], list[str]]:
    """{relative path: text} for every text note in a folder or zip, plus what was skipped (and why)."""
    files: dict[str, bytes] = {}
    skipped: list[str] = []
    total = 0

    def take(rel: str, size: int, read) -> None:
        nonlocal total
        parts = PurePosixPath(rel).parts
        if any(p in SKIP_DIRS or p.startswith(".") for p in parts[:-1]):
            return
        if PurePosixPath(rel).suffix.lower() not in TEXT_EXT:
            return
        if size > MAX_FILE_BYTES:
            skipped.append(f"{rel} (too big)")
            return
        if len(files) >= MAX_FILES or total + size > MAX_TOTAL:
            skipped.append(f"{rel} (limit reached)")
            return
        files[rel] = read()
        total += size

    if source.is_dir():
        for p in sorted(source.rglob("*")):
            if p.is_file() and not p.is_symlink():
                take(p.relative_to(source).as_posix(), p.stat().st_size, p.read_bytes)
    elif source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as z:
            for info in sorted(z.infolist(), key=lambda i: i.filename):
                name = info.filename.replace("\\", "/")
                if info.is_dir() or name.startswith("/") or ".." in PurePosixPath(name).parts:
                    continue
                take(name, info.file_size, lambda info=info: z.read(info))
    else:
        raise ImportError_(f"{source} is not a folder or a .zip file")
    # A GitHub "Download ZIP" puts everything in one top folder (claude-memory-main/...): drop it.
    tops = {PurePosixPath(k).parts[0] for k in files if len(PurePosixPath(k).parts) > 1}
    if len(tops) == 1 and all(len(PurePosixPath(k).parts) > 1 for k in files):
        top = tops.pop()
        files = {k[len(top) + 1:]: v for k, v in files.items()}
    out = {}
    for k, raw in files.items():
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                out[k] = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
    return out, skipped


def split_sections(file: str, text: str) -> list[Section]:
    """Split a note into sections at '## ' headings. Text before the first one is its own section."""
    lines = text.replace("\r\n", "\n").split("\n")
    title = PurePosixPath(file).stem
    for ln in lines:
        if ln.startswith("# "):
            title = ln[2:].strip() or title
            break
    out: list[Section] = []
    cur_head, buf = title, []
    in_code = False
    for ln in lines:
        if ln.lstrip().startswith("```"):
            in_code = not in_code
        if not in_code and ln.startswith("## "):
            if "".join(buf).strip():
                out.append(Section(file, cur_head, "\n".join(buf).strip()))
            cur_head, buf = ln[3:].strip() or title, []
            continue
        if not in_code and ln.startswith("# ") and not buf:
            continue
        buf.append(ln)
    if "".join(buf).strip():
        out.append(Section(file, cur_head, "\n".join(buf).strip()))
    return out


def _bullets(text: str) -> list[str]:
    """Top-level '- ' bullets, each with the lines that continue it."""
    items: list[str] = []
    cur: list[str] = []
    for ln in text.split("\n"):
        if re.match(r"^[-*] ", ln):
            if cur:
                items.append("\n".join(cur).strip())
            cur = [ln[2:]]
        elif cur and (ln.startswith("  ") or (ln.strip() and not re.match(r"^#+ ", ln))):
            cur.append(ln.strip())
        elif cur and not ln.strip():
            items.append("\n".join(cur).strip())
            cur = []
    if cur:
        items.append("\n".join(cur).strip())
    return [i for i in items if i]


def _plain(text: str) -> str:
    """Markdown -> one plain line (for titles)."""
    t = re.sub(r"`([^`]*)`", r"\1", text)
    t = re.sub(r"\*\*([^*]+)\*\*|__([^_]+)__", lambda m: m.group(1) or m.group(2), t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    return " ".join(t.split())


def _short_title(text: str, limit: int = 110) -> str:
    t = _plain(text)
    first = re.split(r"(?<=[.!?])\s|:\s|\s-\s|\s=\s", t, maxsplit=1)[0]
    if 12 <= len(first) <= limit:
        return first
    return t if len(t) <= limit else t[: limit - 1].rstrip() + "…"


def _tag(s: str) -> str:
    t = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return t[:40] or "notes"


def classify(sections: list[Section]) -> list[Item]:
    """Turn note sections into memory rows. The rules for sorting (by file and heading):
    CLAUDE.md rule headings -> one 'instruction' (rule) per bullet; its 'Now' heading -> 'project' rows;
    me/... and likes/about files -> 'fact' rows tagged about-me; talk/answers/handoff/archive files ->
    'experience'; a 'People'/'Friends'/'Family' heading -> 'relationship'; any other note section -> 'project'."""
    items: list[Item] = []
    seen: dict[str, int] = {}

    def key_for(file: str, heading: str) -> str:
        base = f"{file}#{heading}"
        seen[base] = seen.get(base, 0) + 1
        return f"{base}#{seen[base]}"

    for sec in sections:
        path = PurePosixPath(sec.file)
        stem = path.stem
        file_tag = _tag(stem)
        if path.name.lower() == "claude.md":
            if RULE_HEADINGS.search(sec.heading) or NOW_HEADINGS.search(sec.heading):
                is_now = bool(NOW_HEADINGS.search(sec.heading)) and not RULE_HEADINGS.search(sec.heading)
                bl = _bullets(sec.text)
                if bl:
                    for b in bl:
                        items.append(Item(key_for(sec.file, sec.heading), "project" if is_now else "instruction",
                                          _short_title(b), b,
                                          ["imported", "now" if is_now else "rule", _tag(sec.heading)]))
                    continue
            kind = "instruction" if RULE_HEADINGS.search(sec.heading) else "fact"
            items.append(Item(key_for(sec.file, sec.heading), kind, _plain(sec.heading)[:MAX_TITLE], sec.text,
                              ["imported", _tag(sec.heading)]))
            continue
        if PEOPLE_HEADINGS.search(sec.heading):
            kind, tags = "relationship", ["imported", file_tag]
        elif path.parts and path.parts[0].lower() == "me" or ABOUT_FILES.search(stem):
            kind, tags = "fact", ["imported", "about-me", file_tag]
            if path.parts and path.parts[0].lower() == "me":
                tags.append("personal")
        elif EXPERIENCE_FILES.search(stem):
            kind, tags = "experience", ["imported", file_tag]
        else:
            kind, tags = "project", ["imported", file_tag]
        head = _plain(sec.heading)
        title = head if head.lower() != stem.lower() else _plain(stem)
        if kind == "project" and stem.lower() not in head.lower() and stem.lower() not in ("projects", "notes", "readme"):
            title = f"{_plain(stem)}: {head}"
        items.append(Item(key_for(sec.file, sec.heading), kind, title[:MAX_TITLE], sec.text, tags))
    # Long sections become numbered parts (a row holds at most MAX_CONTENT characters).
    out: list[Item] = []
    for it in items:
        if len(it.content) <= MAX_CONTENT:
            out.append(it)
            continue
        chunk = MAX_CONTENT - 200
        n = (len(it.content) + chunk - 1) // chunk
        for i in range(n):
            part = it.content[i * chunk:(i + 1) * chunk]
            title = f"{it.title} (part {i + 1} of {n})"[:MAX_TITLE]
            out.append(Item(f"{it.key}@{i + 1}", it.kind, title, part, list(it.tags)))
    return out


# ------------------------------------------------------------------ the import itself
def import_notes(mem: Memory, source: Path, label: str = "") -> dict:
    """Read the notes at `source` (folder or .zip) into memory. Returns what happened."""
    source = Path(source)
    files, skipped = _read_files(source)
    if not files:
        raise ImportError_("No text notes (.md / .txt) were found there.")
    sections: list[Section] = []
    for rel in sorted(files, key=lambda r: (r.lower() != "claude.md", r)):
        sections.extend(split_sections(rel, files[rel]))
    items = classify(sections)
    label = label or source.name
    added = updated = unchanged = kept_deleted = 0
    by_kind: dict[str, int] = {}
    errors: list[str] = []
    for it in items:
        tags = []
        for t in it.tags:
            if t not in tags:
                tags.append(t)
        sha = hashlib.sha256(f"{it.kind}\n{it.title}\n{it.content}".encode("utf-8")).hexdigest()
        prov = f"import: {label}/{it.key.split('#')[0]}"[:400]
        try:
            hit = mem.source_get(it.key)
            if hit is not None:
                row_id, old_sha = hit
                if row_id == "":
                    kept_deleted += 1          # the human deleted it: never bring it back
                    continue
                row = mem.get(row_id)
                if row is None:
                    kept_deleted += 1
                    continue
                if old_sha == sha or row.status != "active":
                    unchanged += 1             # same text, or the human archived it: leave it alone
                    continue
                keep = [t for t in row.tags if t == "pinned"]
                new = mem.update(row_id, {"title": it.title, "content": it.content, "tags": (keep + tags)[:16]},
                                 provenance=prov)
                mem.source_put(it.key, new.id, sha)
                updated += 1
            else:
                dup = mem.find_duplicate(it.kind, it.title, it.content)
                row = dup or mem.remember(it.kind, it.title, it.content, provenance=prov, tags=tags[:16],
                                          confidence=0.9)
                mem.source_put(it.key, row.id, sha)
                if dup:
                    unchanged += 1
                    continue
                added += 1
            by_kind[it.kind] = by_kind.get(it.kind, 0) + 1
        except MemoryError as e:
            errors.append(f"{it.key}: {e}")
    return {"files": len(files), "sections": len(items), "added": added, "updated": updated,
            "unchanged": unchanged, "kept_deleted": kept_deleted, "by_kind": by_kind,
            "skipped_files": skipped[:50], "errors": errors[:50], "source": str(source)}


def file_sha(path: Path) -> str:
    h = hashlib.sha256()
    if path.is_dir():
        for p in sorted(path.rglob("*")):
            if p.is_file() and p.suffix.lower() in TEXT_EXT and not any(x in SKIP_DIRS for x in p.parts):
                h.update(p.relative_to(path).as_posix().encode())
                h.update(p.read_bytes())
    else:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
    return h.hexdigest()


def find_packs(roots: list[Path]) -> list[Path]:
    """A memory pack shipped next to OVERDRIVE (or in its home folder) is imported on first start."""
    out = []
    for r in roots:
        for name in PACK_NAMES:
            p = r / name
            if p.exists() and p not in out:
                out.append(p)
    return out


def make_pack(src: Path, dest: Path) -> dict:
    """Zip only the text notes of a notes folder (used by the build to make memory-pack.zip)."""
    files, skipped = _read_files(src)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rel, text in sorted(files.items()):
            z.writestr(rel, text)
    dest.write_bytes(buf.getvalue())
    return {"files": len(files), "bytes": dest.stat().st_size, "skipped": skipped}
