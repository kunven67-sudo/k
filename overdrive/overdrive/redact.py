"""Blank out secrets before anything is logged or shown (rules 31 and 42)."""
from __future__ import annotations

import re
from typing import Any

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private-key", re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)")),
    ("anthropic-key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}")),
    ("openai-key", re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{20,}")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("aws-key-id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("google-key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=\-]{16,}")),
    ("url-password", re.compile(r"(?i)\b([a-z][a-z0-9+.\-]*://[^\s:/@]+:)([^\s@/]{3,})(@)")),
]

# key = value / key: value pairs where the key name says "secret".
_KV = re.compile(
    r"(?i)\b(password|passwd|pwd|passcode|secret|client[_-]?secret|api[_-]?key|apikey|access[_-]?key|"
    r"auth[_-]?token|access[_-]?token|refresh[_-]?token|token|private[_-]?key)\b(\s*[:=]\s*)([\"']?)([^\s\"',;]{4,})"
)

# Dict keys whose whole value is a secret.
_SECRET_KEYS = re.compile(
    r"(?i)^(password|passwd|pwd|secret|client_secret|api_key|apikey|x-api-key|access_key|access_token|"
    r"refresh_token|auth_token|token|authorization|cookie|set-cookie|private_key|anthropic_api_key|"
    r"claude_code_oauth_token|anthropic_auth_token)$"
)

_CARD = re.compile(r"(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)")


def _luhn_ok(digits: str) -> bool:
    total, alt = 0, False
    for ch in reversed(digits):
        d = ord(ch) - 48
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        alt = not alt
    return total % 10 == 0


def _cards(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        digits = re.sub(r"[ -]", "", m.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits) and len(set(digits)) >= 2:
            return "[REDACTED:card-number]"
        return m.group(0)

    return _CARD.sub(repl, text)


def redact_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return text
    out = text
    for kind, pat in _PATTERNS:
        if kind == "url-password":
            out = pat.sub(lambda m: f"{m.group(1)}[REDACTED:password]{m.group(3)}", out)
        else:
            out = pat.sub(f"[REDACTED:{kind}]", out)
    out = _KV.sub(lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}[REDACTED:{m.group(1).lower()}]", out)
    out = _cards(out)
    return out


def redact(obj: Any, _depth: int = 0) -> Any:
    """Return a copy of obj with secrets blanked out (strings, lists, dicts)."""
    if _depth > 40:
        return "[REDACTED:too-deep]"
    if isinstance(obj, str):
        return redact_text(obj)
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if isinstance(k, str) and _SECRET_KEYS.match(k) and v not in (None, "", False):
                out[k] = "[REDACTED:secret-field]"
            else:
                out[k] = redact(v, _depth + 1)
        return out
    if isinstance(obj, (list, tuple)):
        return [redact(v, _depth + 1) for v in obj]
    return obj
