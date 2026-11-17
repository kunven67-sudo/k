"""Your old claude.ai chats (Piece 3). claude.ai: Settings > Privacy > Export data emails you a zip with every
chat on that account (conversations.json, with the real names and dates). OVERDRIVE reads that zip into its own
"Imported" section: one folder per account, newest first, each chat with the date it was really made, and the
oldest chat of all gets a "First chat ever" badge. Imported chats are history you can read and search; "Keep going"
starts a new OVERDRIVE chat that knows what the old one was about. Importing the same export again adds nothing twice.
"""
from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime
from pathlib import Path

from .jsonio import atomic_write_json, read_json, utc_now_iso

MAX_ZIP = 4 * 1024 * 1024 * 1024
MAX_JSON = 2 * 1024 * 1024 * 1024


class ImportFailed(ValueError):
    pass


def _when(s) -> str:
    """Normalize a claude.ai timestamp to ISO (UTC, with Z)."""
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00")).isoformat()
    except (ValueError, TypeError):
        return ""


def _msg_text(m: dict) -> str:
    t = m.get("text")
    if isinstance(t, str) and t.strip():
        return t
    parts = []
    for c in m.get("content") or []:
        if isinstance(c, dict) and c.get("type") == "text" and isinstance(c.get("text"), str):
            parts.append(c["text"])
    return "\n\n".join(parts)


def _read_export(path: Path) -> tuple[list, str]:
    """(conversations list, account email or "") from an export zip, a folder, or conversations.json."""
    path = Path(path)
    email = ""
    if path.is_dir():
        conv_file = path / "conversations.json"
        if not conv_file.is_file():
            hits = list(path.rglob("conversations.json"))
            if not hits:
                raise ImportFailed("No conversations.json in that folder. Unzip the claude.ai export there, or pick the zip.")
            conv_file = hits[0]
        users = conv_file.parent / "users.json"
        if users.is_file():
            email = _email(json.loads(users.read_text(encoding="utf-8")))
        if conv_file.stat().st_size > MAX_JSON:
            raise ImportFailed("That export is too big to read.")
        return json.loads(conv_file.read_text(encoding="utf-8")), email
    if path.is_file() and path.suffix.lower() == ".json":
        return json.loads(path.read_text(encoding="utf-8")), email
    if path.is_file() and zipfile.is_zipfile(path):
        if path.stat().st_size > MAX_ZIP:
            raise ImportFailed("That zip is too big.")
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.replace("\\", "/").split("/")[-1] == "conversations.json"]
            if not names:
                raise ImportFailed("That zip has no conversations.json. Use the zip from claude.ai > Settings > Privacy > Export data.")
            info = z.getinfo(names[0])
            if info.file_size > MAX_JSON:
                raise ImportFailed("That export is too big to read.")
            convs = json.loads(z.read(info).decode("utf-8"))
            u = [n for n in z.namelist() if n.replace("\\", "/").split("/")[-1] == "users.json"]
            if u:
                try:
                    email = _email(json.loads(z.read(u[0]).decode("utf-8")))
                except (ValueError, UnicodeDecodeError):
                    pass
        return convs, email
    raise ImportFailed("Pick the claude.ai export zip (or the folder you unzipped it to).")


def _email(users) -> str:
    if isinstance(users, list) and users and isinstance(users[0], dict):
        return str(users[0].get("email_address") or users[0].get("email") or "")
    if isinstance(users, dict):
        return str(users.get("email_address") or users.get("email") or "")
    return ""


class ChatArchive:
    def __init__(self, data_dir: Path):
        self.dir = Path(data_dir) / "imported-chats"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.dir / "index.json"
        self.index: dict[str, dict] = read_json(self.index_path, {}) or {}

    def _save(self) -> None:
        atomic_write_json(self.index_path, self.index)

    def import_export(self, path: Path, account: str = "") -> dict:
        convs, email = _read_export(path)
        if not isinstance(convs, list):
            raise ImportFailed("That conversations.json doesn't look like a claude.ai export.")
        account = " ".join(str(account or email or "claude.ai").split())[:80]
        added = updated = skipped = 0
        for c in convs:
            if not isinstance(c, dict) or not c.get("uuid"):
                skipped += 1
                continue
            uid = re.sub(r"[^0-9a-zA-Z-]", "", str(c["uuid"]))[:64]
            if not uid:
                skipped += 1
                continue
            msgs = []
            for m in c.get("chat_messages") or []:
                if not isinstance(m, dict):
                    continue
                text = _msg_text(m)
                files = [str(f.get("file_name") or "") for f in (m.get("files") or []) + (m.get("attachments") or [])
                         if isinstance(f, dict)]
                if not text.strip() and not files:
                    continue
                msgs.append({"who": "you" if m.get("sender") == "human" else "claude", "text": text[:200_000],
                             "when": _when(m.get("created_at")), "files": [f for f in files if f][:10]})
            created = _when(c.get("created_at")) or (msgs[0]["when"] if msgs else "")
            name = " ".join(str(c.get("name") or "").split())[:120]
            if not name:
                first = " ".join(next((m["text"] for m in msgs if m["who"] == "you"), "").split())
                if len(first) > 48:
                    first = (first[:48].rsplit(" ", 1)[0] or first[:48]) + "..."
                name = first or "Untitled chat"
            key = f"{account}::{uid}"
            entry = {"id": uid, "key": key, "account": account, "name": name, "created": created,
                     "updated": _when(c.get("updated_at")) or created, "messages": len(msgs)}
            old = self.index.get(key)
            if old and old.get("updated") == entry["updated"] and old.get("messages") == entry["messages"]:
                skipped += 1
                continue
            atomic_write_json(self._file(account, uid), {"meta": entry, "messages": msgs})
            if old:
                updated += 1
            else:
                added += 1
            self.index[key] = entry
        self._save()
        return {"account": account, "chats": len(convs), "added": added, "updated": updated, "skipped": skipped,
                "first_ever": self.first_ever()}

    def _file(self, account: str, uid: str) -> Path:
        folder = self.dir / (re.sub(r"[^0-9a-zA-Z@._-]+", "_", account)[:60] or "account")
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{uid}.json"

    def first_ever(self) -> str:
        dated = [e for e in self.index.values() if e.get("created")]
        if not dated:
            return ""
        return min(dated, key=lambda e: e["created"])["key"]

    def folders(self) -> list[dict]:
        first = self.first_ever()
        by: dict[str, list] = {}
        for e in self.index.values():
            by.setdefault(e["account"], []).append(dict(e, first_ever=e["key"] == first))
        out = []
        for acc, items in sorted(by.items()):
            items.sort(key=lambda e: e.get("created") or "", reverse=True)
            out.append({"account": acc, "count": len(items), "chats": items})
        return out

    def get(self, key: str) -> dict | None:
        e = self.index.get(key)
        if e is None:
            return None
        d = read_json(self._file(e["account"], e["id"]), None)
        if not isinstance(d, dict):
            return None
        d["meta"] = dict(d["meta"], first_ever=key == self.first_ever())
        return d

    def search(self, q: str, limit: int = 30) -> list[dict]:
        words = [w for w in q.lower().split() if w][:8]
        if not words:
            return []
        hits = []
        for e in sorted(self.index.values(), key=lambda e: e.get("created") or "", reverse=True):
            if all(w in e["name"].lower() for w in words):
                hits.append(dict(e, snippet=""))
            else:
                d = read_json(self._file(e["account"], e["id"]), None) or {}
                for m in d.get("messages", []):
                    low = m["text"].lower()
                    if all(w in low for w in words):
                        i = low.find(words[0])
                        hits.append(dict(e, snippet=" ".join(m["text"][max(0, i - 50): i + 110].split())))
                        break
            if len(hits) >= limit:
                break
        return hits

    def remove_account(self, account: str) -> int:
        keys = [k for k, e in self.index.items() if e["account"] == account]
        for k in keys:
            e = self.index.pop(k)
            try:
                self._file(e["account"], e["id"]).unlink()
            except OSError:
                pass
        self._save()
        return len(keys)

    def continue_text(self, key: str) -> str:
        d = self.get(key)
        if d is None:
            raise ValueError("no such imported chat")
        meta, msgs = d["meta"], d["messages"]
        tail, size = [], 0
        for m in reversed(msgs):
            piece = f"{'Me' if m['who'] == 'you' else 'Claude'}: {m['text'][:2500]}"
            if size + len(piece) > 9000:
                break
            tail.append(piece)
            size += len(piece)
        return (f"Let's keep going with my old claude.ai chat “{meta['name']}” (from "
                f"{(meta.get('created') or '')[:10]}, {meta['messages']} messages). The end of it, as data:\n\n"
                + "\n\n".join(reversed(tail)) + "\n\nPick up from there with me.")
