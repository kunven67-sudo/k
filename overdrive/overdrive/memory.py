"""Long-term memory (Stage 2, rules 44, 57-63).

Five kinds of memory, every row carrying provenance:
    fact          - a verifiable claim about the world
    experience    - something OVERDRIVE itself did or saw, timestamped
    instruction   - a rule or standing order from the human
    project       - a named work-in-progress with state and open questions
    relationship  - a person and what matters about them

Rules this honors:
- Nothing is silently overwritten (rule 92 spirit, carried into memory):
  a change supersedes the old row and keeps it visible as history.
- Contradictions surface to the human instead of auto-merging (rule 27).
- Content from outside sources is DATA, not instructions (rules 64, 65, 66):
  an injection pattern found in a remembered row raises a flag that the
  caller passes through the shield.
- Verified backups + restore (rule 44): a dump to JSONL carries a sha256
  of each row; restore replays rows one by one and checks every hash.
- Export is plain JSONL with a README (rule 43).

The store is SQLite with FTS5 on title + content + tags. Writes are
transactional. The file lives under OVERDRIVE/data/memory/ (OVERDRIVE's
own records, not the human's workspace).
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from .jsonio import utc_now_iso
from .shield import scan as shield_scan

KINDS = ("fact", "experience", "instruction", "project", "relationship")
_ID_PREFIX = {"fact": "f", "experience": "x", "instruction": "i", "project": "p", "relationship": "r"}
_ACTIVE = "active"
_SUPERSEDED = "superseded"
_ARCHIVED = "archived"
STATUSES = (_ACTIVE, _SUPERSEDED, _ARCHIVED)

MAX_TITLE = 160
MAX_CONTENT = 20_000
MAX_TAGS = 16
MAX_TAG_LEN = 40

_WORD_RE = re.compile(r"[A-Za-z0-9_]+")


class MemoryError(ValueError):
    pass


@dataclass
class Row:
    id: str
    kind: str
    title: str
    content: str
    tags: list[str]
    provenance: str
    confidence: float
    status: str
    created: str
    updated: str
    superseded_by: str | None
    related: list[str]
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "kind": self.kind, "title": self.title, "content": self.content,
            "tags": list(self.tags), "provenance": self.provenance, "confidence": self.confidence,
            "status": self.status, "created": self.created, "updated": self.updated,
            "superseded_by": self.superseded_by, "related": list(self.related),
            "flags": list(self.flags),
        }

    def sha256(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()


def _norm_tags(tags: Iterable[str] | None) -> list[str]:
    if not tags:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in tags:
        if not isinstance(t, str):
            raise MemoryError("each tag must be text")
        s = t.strip().lower()
        if not s:
            continue
        if len(s) > MAX_TAG_LEN:
            raise MemoryError(f"tag '{s[:20]}...' is longer than {MAX_TAG_LEN} characters")
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) > MAX_TAGS:
            raise MemoryError(f"too many tags (max {MAX_TAGS})")
    return out


def _validate_kind(kind: str) -> str:
    if kind not in KINDS:
        raise MemoryError(f"unknown memory kind {kind!r}; must be one of {KINDS}")
    return kind


def _validate_text(label: str, text: str, max_len: int, min_len: int = 1) -> str:
    if not isinstance(text, str):
        raise MemoryError(f"{label} must be text")
    t = text.strip()
    if len(t) < min_len:
        raise MemoryError(f"{label} is too short (at least {min_len} character)")
    if len(text) > max_len:
        raise MemoryError(f"{label} is too long ({len(text)} chars, max {max_len})")
    return t if label == "title" else text


def _validate_confidence(v: Any) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise MemoryError("confidence must be a number from 0 to 1")
    if not 0.0 <= f <= 1.0:
        raise MemoryError("confidence must be between 0 and 1")
    return round(f, 3)


def _new_id(kind: str) -> str:
    return f"{_ID_PREFIX[kind]}_{secrets.token_hex(6)}"


def _fts_query(q: str) -> str:
    """Turn free text into a safe FTS5 query. Words are OR-ed; punctuation
    that would be treated as FTS syntax is stripped."""
    words = _WORD_RE.findall(q or "")
    if not words:
        return ""
    # FTS5 prefix search per token, OR'd together.
    return " OR ".join(f'"{w}"*' for w in words[:12])


SCHEMA = """
CREATE TABLE IF NOT EXISTS memory (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    tags          TEXT NOT NULL,       -- JSON array
    provenance    TEXT NOT NULL,
    confidence    REAL NOT NULL,
    status        TEXT NOT NULL,
    created       TEXT NOT NULL,
    updated       TEXT NOT NULL,
    superseded_by TEXT,
    related       TEXT NOT NULL,       -- JSON array
    flags         TEXT NOT NULL        -- JSON array of injection-pattern names seen
);
CREATE INDEX IF NOT EXISTS memory_kind_status ON memory(kind, status);
CREATE INDEX IF NOT EXISTS memory_updated    ON memory(updated DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    title, content, tags,
    content='memory', content_rowid='rowid',
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
    INSERT INTO memory_fts(rowid, title, content, tags)
        VALUES (new.rowid, new.title, new.content, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, title, content, tags)
        VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, title, content, tags)
        VALUES ('delete', old.rowid, old.title, old.content, old.tags);
    INSERT INTO memory_fts(rowid, title, content, tags)
        VALUES (new.rowid, new.title, new.content, new.tags);
END;
"""


def _row_from(r: sqlite3.Row) -> Row:
    return Row(
        id=r["id"], kind=r["kind"], title=r["title"], content=r["content"],
        tags=json.loads(r["tags"] or "[]"), provenance=r["provenance"],
        confidence=float(r["confidence"]), status=r["status"],
        created=r["created"], updated=r["updated"],
        superseded_by=r["superseded_by"], related=json.loads(r["related"] or "[]"),
        flags=json.loads(r["flags"] or "[]"),
    )


class Memory:
    """OVERDRIVE's long-term memory store.

    Open one per process (SQLite handles concurrent readers; the write path
    uses an exclusive transaction per operation).
    """

    def __init__(self, home: Path):
        self.home = Path(home)
        self.home.mkdir(parents=True, exist_ok=True)
        self.path = self.home / "memory.db"
        self._conn = sqlite3.connect(self.path, isolation_level=None, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.execute("PRAGMA synchronous = NORMAL")
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SCHEMA)

    # -------------------------------------------------- introspection
    def count(self, kind: str | None = None, status: str = _ACTIVE) -> int:
        if kind is None:
            return self._conn.execute(
                "SELECT COUNT(*) FROM memory WHERE status = ?", (status,)
            ).fetchone()[0]
        _validate_kind(kind)
        return self._conn.execute(
            "SELECT COUNT(*) FROM memory WHERE kind = ? AND status = ?", (kind, status)
        ).fetchone()[0]

    def get(self, row_id: str) -> Row | None:
        r = self._conn.execute("SELECT * FROM memory WHERE id = ?", (row_id,)).fetchone()
        return _row_from(r) if r else None

    # -------------------------------------------------- write path
    def remember(
        self, kind: str, title: str, content: str, provenance: str,
        tags: Iterable[str] | None = None, confidence: float = 0.8,
        related: Iterable[str] | None = None,
    ) -> Row:
        kind = _validate_kind(kind)
        title = _validate_text("title", title, MAX_TITLE)
        content = _validate_text("content", content, MAX_CONTENT, min_len=1)
        provenance = _validate_text("provenance", provenance, 400)
        confidence = _validate_confidence(confidence)
        norm_tags = _norm_tags(tags)
        norm_related = _norm_related(related, self._conn)
        # Rule 65: flag injection-shaped text so the caller can tell the human.
        flags = shield_scan(title) + shield_scan(content)
        flags = sorted(set(flags))

        now = utc_now_iso()
        row = Row(
            id=_new_id(kind), kind=kind, title=title, content=content,
            tags=norm_tags, provenance=provenance, confidence=confidence,
            status=_ACTIVE, created=now, updated=now, superseded_by=None,
            related=norm_related, flags=flags,
        )
        self._insert(row)
        return row

    def update(self, row_id: str, patch: dict, provenance: str) -> Row:
        """Non-destructive update: the old row is marked `superseded`
        (NOT deleted) and a fresh row with the patched fields is inserted.
        A reader can still walk the chain via `superseded_by`.
        Only the human-facing fields can be patched; id / created / status
        are server-controlled.
        """
        prov = _validate_text("provenance", provenance, 400)
        old = self.get(row_id)
        if old is None:
            raise MemoryError(f"no memory with id {row_id!r}")
        if old.status != _ACTIVE:
            raise MemoryError(f"memory {row_id} is {old.status}; only an active row can be updated")

        allowed = {"title", "content", "tags", "confidence", "related"}
        bad = set(patch) - allowed
        if bad:
            raise MemoryError(f"these fields can't be patched: {sorted(bad)}")

        new_title = _validate_text("title", patch.get("title", old.title), MAX_TITLE)
        new_content = _validate_text("content", patch.get("content", old.content), MAX_CONTENT, min_len=1)
        new_tags = _norm_tags(patch["tags"]) if "tags" in patch else list(old.tags)
        new_conf = _validate_confidence(patch["confidence"]) if "confidence" in patch else old.confidence
        new_related = _norm_related(patch["related"], self._conn) if "related" in patch else list(old.related)
        flags = sorted(set(shield_scan(new_title) + shield_scan(new_content)))

        now = utc_now_iso()
        new_row = Row(
            id=_new_id(old.kind), kind=old.kind, title=new_title, content=new_content,
            tags=new_tags, provenance=prov, confidence=new_conf,
            status=_ACTIVE, created=now, updated=now, superseded_by=None,
            related=new_related, flags=flags,
        )
        with self._conn:
            self._insert(new_row, commit=False)
            self._conn.execute(
                "UPDATE memory SET status = ?, superseded_by = ?, updated = ? WHERE id = ?",
                (_SUPERSEDED, new_row.id, now, old.id),
            )
        return new_row

    def archive(self, row_id: str, provenance: str) -> Row:
        """Move an active row to archived status. Used when the human says a
        project is over, an instruction no longer applies, etc. Archived rows
        are kept (never deleted) so history is preserved."""
        _validate_text("provenance", provenance, 400)
        old = self.get(row_id)
        if old is None:
            raise MemoryError(f"no memory with id {row_id!r}")
        if old.status == _ARCHIVED:
            return old
        now = utc_now_iso()
        with self._conn:
            self._conn.execute(
                "UPDATE memory SET status = ?, updated = ? WHERE id = ?",
                (_ARCHIVED, now, row_id),
            )
        row = self.get(row_id)
        assert row is not None
        return row

    def forget(self, row_id: str, provenance: str) -> Row:
        """Permanently delete a row. Rule 63: the human must be able to delete
        stored information. This path is NOT exposed to Claude as a tool;
        it is called from the UI / settings on the human's own action.
        The deleted row is returned so the caller can show it in the audit log.
        """
        _validate_text("provenance", provenance, 400)
        row = self.get(row_id)
        if row is None:
            raise MemoryError(f"no memory with id {row_id!r}")
        with self._conn:
            self._conn.execute("DELETE FROM memory WHERE id = ?", (row_id,))
            # Null out references so chain walks don't crash
            self._conn.execute(
                "UPDATE memory SET superseded_by = NULL WHERE superseded_by = ?", (row_id,),
            )
        return row

    def _insert(self, row: Row, commit: bool = True) -> None:
        sql = (
            "INSERT INTO memory (id, kind, title, content, tags, provenance, confidence, status, "
            "created, updated, superseded_by, related, flags) "
            "VALUES (:id, :kind, :title, :content, :tags, :provenance, :confidence, :status, "
            ":created, :updated, :superseded_by, :related, :flags)"
        )
        params = row.to_dict()
        params["tags"] = json.dumps(params["tags"], ensure_ascii=False)
        params["related"] = json.dumps(params["related"], ensure_ascii=False)
        params["flags"] = json.dumps(params["flags"], ensure_ascii=False)
        if commit:
            with self._conn:
                self._conn.execute(sql, params)
        else:
            self._conn.execute(sql, params)

    # -------------------------------------------------- contradiction check
    def contradictions(self, kind: str, title: str, exclude_id: str | None = None) -> list[Row]:
        """Return active rows with the same kind + same (case-insensitive) title.
        These are the candidates to surface to the human before a write."""
        _validate_kind(kind)
        rows = self._conn.execute(
            "SELECT * FROM memory WHERE kind = ? AND status = ? AND LOWER(title) = LOWER(?)",
            (kind, _ACTIVE, title),
        ).fetchall()
        return [_row_from(r) for r in rows if r["id"] != exclude_id]

    # -------------------------------------------------- read path
    def recall(self, query: str, kinds: Iterable[str] | None = None, limit: int = 10) -> list[Row]:
        limit = max(1, min(int(limit), 50))
        if kinds:
            kinds = tuple(_validate_kind(k) for k in kinds)
        q = _fts_query(query)
        if not q:
            return self.list(kinds=kinds, limit=limit)
        where = ["memory.status = ?"]
        params: list[Any] = [_ACTIVE]
        if kinds:
            where.append("memory.kind IN (" + ",".join("?" for _ in kinds) + ")")
            params.extend(kinds)
        sql = (
            "SELECT memory.*, bm25(memory_fts) AS score FROM memory_fts "
            "JOIN memory ON memory.rowid = memory_fts.rowid "
            "WHERE memory_fts MATCH ? AND " + " AND ".join(where) + " "
            "ORDER BY score ASC LIMIT ?"
        )
        rows = self._conn.execute(sql, (q, *params, limit)).fetchall()
        return [_row_from(r) for r in rows]

    def list(self, kinds: Iterable[str] | None = None, status: str = _ACTIVE, limit: int = 20) -> list[Row]:
        limit = max(1, min(int(limit), 200))
        where = ["status = ?"]
        params: list[Any] = [status]
        if kinds:
            kinds = tuple(_validate_kind(k) for k in kinds)
            where.append("kind IN (" + ",".join("?" for _ in kinds) + ")")
            params.extend(kinds)
        # rowid is monotonically increasing on insert, so it's a stable tiebreaker
        # when two rows share the same updated-millisecond timestamp.
        sql = ("SELECT * FROM memory WHERE " + " AND ".join(where)
               + " ORDER BY updated DESC, rowid DESC LIMIT ?")
        return [_row_from(r) for r in self._conn.execute(sql, (*params, limit)).fetchall()]

    def all_rows(self) -> list[Row]:
        """Every row, every status. Used by backup/export."""
        rows = self._conn.execute("SELECT * FROM memory ORDER BY created ASC").fetchall()
        return [_row_from(r) for r in rows]

    # -------------------------------------------------- boot digest
    def digest(self, instruction_limit: int = 12, project_limit: int = 8,
               relationship_limit: int = 8) -> str:
        """A compact text block that boots OVERDRIVE with the active standing
        orders, open projects and people it knows. Appended to the system
        prompt. Content is plain text with markers; it is OVERDRIVE's own
        trusted material, not outside data (rule 66: still built only from
        OVERDRIVE's text + settings, never from tool output)."""
        instructions = self.list(("instruction",), limit=instruction_limit)
        projects = self.list(("project",), limit=project_limit)
        relationships = self.list(("relationship",), limit=relationship_limit)

        if not (instructions or projects or relationships):
            return ""

        parts = ["WHAT OVERDRIVE REMEMBERS (from your long-term memory):"]
        if instructions:
            parts.append("Standing orders from the human:")
            for r in instructions:
                parts.append(f"  - [{r.id}] {r.title}")
                if r.content and r.content.strip() != r.title:
                    parts.append(f"      {_summary(r.content)}")
        if projects:
            parts.append("Open projects:")
            for r in projects:
                parts.append(f"  - [{r.id}] {r.title}: {_summary(r.content)}")
        if relationships:
            parts.append("People:")
            for r in relationships:
                parts.append(f"  - [{r.id}] {r.title}: {_summary(r.content)}")
        parts.append("Use the memory_recall tool to look up facts and experiences before guessing.")
        return "\n".join(parts)

    # -------------------------------------------------- backup / restore
    def backup(self, path: Path) -> dict:
        """Write every row as JSONL with a sha256 per row and an overall
        manifest line at the top. Rule 44."""
        path = Path(path)
        rows = self.all_rows()
        sha_all = hashlib.sha256()
        lines: list[str] = []
        for r in rows:
            d = r.to_dict()
            d["sha256"] = r.sha256()
            text = json.dumps(d, ensure_ascii=False, sort_keys=True)
            sha_all.update(text.encode("utf-8"))
            lines.append(text)
        manifest = {
            "overdrive_memory_backup": 1, "when": utc_now_iso(),
            "rows": len(rows), "sha256_all_rows": sha_all.hexdigest(),
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(json.dumps(manifest, sort_keys=True) + "\n")
            for line in lines:
                f.write(line + "\n")
        return manifest

    def restore(self, path: Path, replace: bool = False) -> dict:
        """Re-load a backup, verifying every row's sha256 and the manifest
        checksum. If `replace` is True, the current table is wiped first;
        otherwise rows are inserted and ids already in the store are skipped.
        Rows whose checksum doesn't match are rejected and reported.
        Returns {restored, skipped, rejected: [(id, reason)]}."""
        path = Path(path)
        if not path.is_file():
            raise MemoryError(f"backup file not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if not lines:
            raise MemoryError("backup is empty")
        try:
            manifest = json.loads(lines[0])
        except json.JSONDecodeError as e:
            raise MemoryError(f"backup header is not valid JSON: {e}")
        if not isinstance(manifest, dict) or manifest.get("overdrive_memory_backup") != 1:
            raise MemoryError("backup header has the wrong format")

        sha_all = hashlib.sha256()
        restored = skipped = 0
        rejected: list[tuple[str, str]] = []
        rows_to_insert: list[Row] = []
        for raw in lines[1:]:
            raw = raw.strip()
            if not raw:
                continue
            try:
                d = json.loads(raw)
            except json.JSONDecodeError as e:
                rejected.append(("?", f"not valid JSON: {e}"))
                continue
            expected_sha = d.pop("sha256", None)
            try:
                row = Row(
                    id=d["id"], kind=d["kind"], title=d["title"], content=d["content"],
                    tags=list(d.get("tags") or []), provenance=d["provenance"],
                    confidence=float(d["confidence"]), status=d["status"],
                    created=d["created"], updated=d["updated"],
                    superseded_by=d.get("superseded_by"), related=list(d.get("related") or []),
                    flags=list(d.get("flags") or []),
                )
            except (KeyError, TypeError, ValueError) as e:
                rejected.append((d.get("id", "?"), f"bad row shape: {e}"))
                continue
            if row.kind not in KINDS or row.status not in STATUSES:
                rejected.append((row.id, f"unknown kind/status ({row.kind}/{row.status})"))
                continue
            actual = row.sha256()
            if expected_sha and expected_sha != actual:
                rejected.append((row.id, "sha256 mismatch"))
                continue
            sha_all.update(json.dumps({**row.to_dict(), "sha256": actual},
                                      ensure_ascii=False, sort_keys=True).encode("utf-8"))
            rows_to_insert.append(row)

        if manifest.get("sha256_all_rows") and manifest["sha256_all_rows"] != sha_all.hexdigest():
            raise MemoryError("backup is corrupted: overall sha256 does not match the manifest")

        with self._conn:
            if replace:
                self._conn.execute("DELETE FROM memory")
            existing = {r[0] for r in self._conn.execute("SELECT id FROM memory").fetchall()}
            for row in rows_to_insert:
                if row.id in existing:
                    skipped += 1
                    continue
                self._insert(row, commit=False)
                restored += 1
        return {"restored": restored, "skipped": skipped, "rejected": rejected,
                "manifest": manifest}

    def export_jsonl(self, path: Path) -> dict:
        """Plain JSONL export (rule 43). Same shape as backup, but without the
        sha256 column. Humans can read it; restore won't accept it (no header)."""
        path = Path(path)
        rows = self.all_rows()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r.to_dict(), ensure_ascii=False, sort_keys=True) + "\n")
        return {"rows": len(rows), "path": str(path)}

    def close(self) -> None:
        try:
            self._conn.close()
        except sqlite3.Error:
            pass


def _summary(text: str, limit: int = 180) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _norm_related(related: Iterable[str] | None, conn: sqlite3.Connection | None) -> list[str]:
    if not related:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for rid in related:
        if not isinstance(rid, str):
            raise MemoryError("related ids must be text")
        rid = rid.strip()
        if not rid or rid in seen:
            continue
        seen.add(rid)
        out.append(rid)
    if conn is not None and out:
        rows = conn.execute(
            "SELECT id FROM memory WHERE id IN (" + ",".join("?" for _ in out) + ")", out,
        ).fetchall()
        found = {r[0] for r in rows}
        missing = [r for r in out if r not in found]
        if missing:
            raise MemoryError(f"these related ids don't exist: {missing}")
    return out
