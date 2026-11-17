"""Real assets finder (Piece 3): free CC0 textures, 3D models, skies (HDRIs) and sounds from real libraries.
No code-drawn or AI-looking art: ambientCG (textures, CC0), Poly Haven (models + HDRIs + textures, CC0),
Openverse (sounds, filtered to CC0). find_assets searches (shows previews); get_asset downloads one into a
project folder in the workspace. Textures default to 1K (light on a 2 GB graphics card)."""
from __future__ import annotations

import io
import json
import urllib.parse
import zipfile
from pathlib import PurePosixPath

from .permissions import Risk
from .pictures import _get, _get_json, sniff
from .tools import ToolContext, ToolResult, ToolSpec

ENDPOINTS = {"ambientcg": "https://ambientcg.com/api/v2/full_json", "polyhaven": "https://api.polyhaven.com",
             "openverse_audio": "https://api.openverse.org/v1/audio/"}
MAX_DOWNLOAD = 300 * 1024 * 1024
MAX_FILE = 120 * 1024 * 1024
KINDS = ("texture", "model", "hdri", "sound")
RES = ("1k", "2k", "4k")


def search(kind: str, query: str, count: int) -> list[dict]:
    q = urllib.parse.quote(query)
    out: list[dict] = []
    if kind == "texture":
        d = _get_json(f"{ENDPOINTS['ambientcg']}?type=Material&q={q}&limit={count}&include=downloadData,previewData")
        for a in (d.get("foundAssets") or [])[:count]:
            out.append({"source": "ambientcg", "id": a.get("assetId"), "name": a.get("displayName") or a.get("assetId"),
                        "license": "CC0", "preview": (a.get("previewImage") or {}).get("256-PNG", ""),
                        "page": f"https://ambientcg.com/view?id={a.get('assetId')}"})
    elif kind in ("model", "hdri"):
        t = "models" if kind == "model" else "hdris"
        d = _get_json(f"{ENDPOINTS['polyhaven']}/assets?t={t}&search={q}")
        for aid, a in list((d or {}).items())[:count]:
            out.append({"source": "polyhaven", "id": aid, "name": a.get("name") or aid, "license": "CC0",
                        "preview": f"https://cdn.polyhaven.com/asset_img/thumbs/{aid}.png?width=256",
                        "page": f"https://polyhaven.com/a/{aid}", "kind": kind})
    elif kind == "sound":
        d = _get_json(f"{ENDPOINTS['openverse_audio']}?q={q}&license=cc0&page_size={count}")
        for a in (d.get("results") or [])[:count]:
            out.append({"source": "openverse", "id": a.get("id"), "name": a.get("title") or "sound", "license": "CC0",
                        "url": a.get("url"), "filetype": a.get("filetype") or "mp3", "creator": a.get("creator") or "",
                        "page": a.get("foreign_landing_url") or ""})
    return [x for x in out if x.get("id")]


def _safe_rel(name: str) -> str | None:
    p = PurePosixPath(name.replace("\\", "/"))
    if p.is_absolute() or ".." in p.parts or not p.parts:
        return None
    return p.as_posix()


def download(source: str, aid: str, res: str, kind: str = "") -> list[tuple[str, bytes]]:
    """[(relative file name, bytes)] for one asset."""
    files: list[tuple[str, bytes]] = []
    total = 0

    def fetch(url: str, limit: int = MAX_FILE) -> bytes:
        nonlocal total
        data, _ = _get(url, 60, limit)
        total += len(data)
        if total > MAX_DOWNLOAD:
            raise ValueError("that asset is too big (300 MB max)")
        return data

    if source == "ambientcg":
        d = _get_json(f"{ENDPOINTS['ambientcg']}?id={urllib.parse.quote(aid)}&include=downloadData")
        a = (d.get("foundAssets") or [None])[0]
        if not a:
            raise ValueError("ambientCG doesn't have that one")
        dls = a["downloadFolders"]["default"]["downloadFiletypeCategories"]["zip"]["downloads"]
        want = f"{res.upper()}-JPG"
        pick = next((x for x in dls if x["attribute"] == want), None) or next((x for x in dls if "JPG" in x["attribute"]), dls[0])
        blob = fetch(pick["downloadLink"], MAX_DOWNLOAD)
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            for info in z.infolist():
                rel = _safe_rel(info.filename)
                if rel and not info.is_dir() and info.file_size < MAX_FILE:
                    files.append((rel, z.read(info)))
    elif source == "polyhaven":
        d = _get_json(f"{ENDPOINTS['polyhaven']}/files/{urllib.parse.quote(aid)}")
        if "hdri" in d and kind != "model":
            entry = d["hdri"].get(res) or d["hdri"][sorted(d["hdri"])[0]]
            hdr = entry.get("hdr") or entry.get("exr")
            files.append((PurePosixPath(hdr["url"]).name, fetch(hdr["url"])))
        else:
            g = d.get("gltf") or {}
            entry = g.get(res) or (g[sorted(g)[0]] if g else None)
            if not entry:
                raise ValueError("Poly Haven has no glTF for that one")
            main = entry["gltf"]
            files.append((PurePosixPath(main["url"]).name, fetch(main["url"])))
            for rel, inc in (main.get("include") or {}).items():
                safe = _safe_rel(rel)
                if safe:
                    files.append((safe, fetch(inc["url"])))
    elif source == "openverse":
        d = _get_json(f"{ENDPOINTS['openverse_audio']}{urllib.parse.quote(aid)}/")
        if str(d.get("license", "")).lower() != "cc0":
            raise ValueError("that sound isn't CC0, so OVERDRIVE won't use it")
        ext = (d.get("filetype") or "mp3").lower()
        files.append((f"{aid[:12]}.{ext}", fetch(d["url"])))
        files.append(("CREDITS.txt", json.dumps({"title": d.get("title"), "creator": d.get("creator"), "license": "CC0",
                                                  "page": d.get("foreign_landing_url")}, indent=1).encode()))
    else:
        raise ValueError("unknown source")
    return files


async def h_find(args: dict, ctx: ToolContext) -> ToolResult:
    import asyncio
    kind, query, count = args["kind"], args["query"], int(args.get("count", 4))
    try:
        found = await asyncio.to_thread(search, kind, query, count)
    except Exception as e:
        return ToolResult(text=f"The {kind} library didn't answer: {e}", is_error=True)
    if not found:
        return ToolResult(text=f"No free CC0 {kind}s found for “{query}”. Try other words.")
    pics = []
    if ctx.pictures is not None:
        for f in found:
            if f.get("preview"):
                try:
                    data, _ = await asyncio.to_thread(_get, f["preview"], 12, 3 * 1024 * 1024)
                    if sniff(data):
                        pics.append({"file": ctx.pictures.put(data), "title": f["name"], "license": "CC0",
                                     "source": f["source"], "page": f.get("page", ""), "caption": f"Free {kind}s: {query}"})
                except Exception:
                    pass
    lines = [f"{len(found)} free CC0 {kind}(s) for “{query}” (previews are shown to the human):"]
    for f in found:
        lines.append(f"- source={f['source']} id={f['id']} name={f['name']}" + (f" by {f['creator']}" if f.get("creator") else ""))
    lines.append("Download one with get_asset (source + id) into the project's folder.")
    return ToolResult(text="\n".join(lines), untrusted=True, source=f"{kind} library", data={"pictures": pics})


async def h_get(args: dict, ctx: ToolContext) -> ToolResult:
    import asyncio
    dest = args["dest"].strip("/\\")
    try:
        files = await asyncio.to_thread(download, args["source"], args["id"], args.get("resolution", "1k"), args.get("kind", ""))
    except Exception as e:
        return ToolResult(text=f"Couldn't download it: {e}", is_error=True)
    changes, written = [], []
    for rel, data in files:
        path = ctx.workspace.resolve(f"{dest}/{rel}")
        path.parent.mkdir(parents=True, exist_ok=True)
        existed = path.exists()
        if existed:
            ctx.workspace._snapshot(path, "replaced by get_asset", ctx.task.id if ctx.task else None)
        path.write_bytes(data)
        written.append(ctx.workspace.rel(path))
        changes.append({"op": "replaced" if existed else "created", "path": ctx.workspace.rel(path), "bytes": len(data)})
    return ToolResult(text=f"Downloaded {len(written)} file(s) (CC0, free to use) into {dest}/: " + ", ".join(written[:20]),
                      changes=changes)


def register_asset_tools(reg) -> None:
    reg.add(ToolSpec(
        name="find_assets", title="Find real free assets",
        description=("Search real free CC0 libraries: kind=texture (ambientCG), model or hdri (Poly Haven), sound "
                     "(Openverse, CC0 only). Shows previews to the human. Use this instead of drawing art in code."),
        schema={"type": "object", "properties": {
            "kind": {"type": "string", "enum": list(KINDS)}, "query": {"type": "string", "minLength": 2, "maxLength": 80},
            "count": {"type": "integer", "minimum": 1, "maximum": 6, "default": 4}},
            "required": ["kind", "query"], "additionalProperties": False},
        risk=Risk.WEB, handler=h_find, network=True, selftest="test_assets_finder",
        limitations=["Only CC0 libraries (free for anything, no credit needed).", "Search quality depends on the library."]))
    reg.add(ToolSpec(
        name="get_asset", title="Download a free asset",
        description=("Download one asset from find_assets into a workspace folder (dest, like games/racer/assets/asphalt). "
                     "Textures come as a zip of maps (color, normal, roughness...), models as glTF with their textures, "
                     "HDRIs as .hdr, sounds as mp3/ogg + CREDITS.txt. resolution 1k is light (good for a 2 GB card)."),
        schema={"type": "object", "properties": {
            "source": {"type": "string", "enum": ["ambientcg", "polyhaven", "openverse"]},
            "id": {"type": "string", "minLength": 1, "maxLength": 120},
            "kind": {"type": "string", "enum": list(KINDS)},
            "resolution": {"type": "string", "enum": list(RES), "default": "1k"},
            "dest": {"type": "string", "minLength": 1, "maxLength": 300}},
            "required": ["source", "id", "dest"], "additionalProperties": False},
        risk=Risk.WRITE, handler=h_get, network=True, selftest="test_assets_finder",
        limitations=["300 MB max per asset.", "Files it replaces are kept as old versions."]))
