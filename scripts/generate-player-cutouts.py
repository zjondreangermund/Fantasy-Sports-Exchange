#!/usr/bin/env python3
"""Generate opt-in cutout portraits for verified active API-Football EPL players.

Never modifies provider/player/card records or original portraits. Only images
that pass transparent-alpha and plausible-foreground checks are published.
Failed pictures retain their existing official portrait in the app.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT / "client/public/portraits/cutouts"
MANIFEST_PATH = PORTRAITS / "manifest.json"
DEFAULT_DIRECTORY = "https://playfantasyarena.com/api/leagues/premier-league/cutout-portrait-sources"
MAX_BYTES = 2_500_000
RETRY_DAYS = 5
# These six names come from the collection screenshot; include the rest of the
# current squad directory in subsequent small and reproducible batches.
PRIORITY_NAMES = ("gyokeres", "jaros", "savona", "saliba", "rodon", "davies")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_name(value: str) -> str:
    import unicodedata
    value = unicodedata.normalize("NFKD", str(value).lower())
    return "".join(c for c in value if c.isascii() and c.isalnum())


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"Accept": "application/json,image/png", "User-Agent": "FantasyArena-PortraitCutoutBatch/1.0"})
    with urlopen(request, timeout=28) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        if int(response.headers.get("Content-Length") or 0) > MAX_BYTES:
            raise ValueError("Source image too large")
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("Source image exceeded maximum size")
        return data


def load_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    data = json.loads(path.read_text("utf-8"))
    return data if isinstance(data, dict) else fallback


def player_list(raw: dict) -> list[dict]:
    if raw.get("provider") != "api-football" or not isinstance(raw.get("players"), list):
        raise ValueError("Unexpected player directory schema")
    ids: dict[int, dict] = {}
    for raw_player in raw["players"]:
        if not isinstance(raw_player, dict):
            continue
        player_id = raw_player.get("id")
        try:
            player_id = int(player_id)
        except (ValueError, TypeError):
            continue
        if player_id <= 0 or player_id > 10_000_000:
            continue
        ids[player_id] = {
            "id": player_id,
            "name": str(raw_player.get("name") or "")[:110],
            "team": str(raw_player.get("team") or "")[:90],
        }
    if not ids:
        raise ValueError("No verified active API-Football players available")
    return sorted(ids.values(), key=lambda p: (
        0 if any(x in normalize_name(p["name"]) for x in PRIORITY_NAMES) else 1,
        normalize_name(p["team"]), normalize_name(p["name"]), p["id"],
    ))


def check_transparent_portrait(image: Image.Image) -> tuple[float, tuple[int, int, int, int]]:
    # Strongly prefer a real alpha silhouette; artificial white backgrounds fail.
    alpha = image.getchannel("A")
    width, height = image.size
    alpha_sample = alpha.point(lambda x: 255 if x >= 55 else 0)
    histogram = alpha_sample.histogram()
    coverage = histogram[255] / max(1, width * height)
    bbox = alpha_sample.getbbox()
    if not bbox or coverage < 0.07 or coverage > 0.93:
        raise ValueError(f"Invalid alpha foreground coverage {coverage:.2f}")
    left, top, right, bottom = bbox
    if (right - left) < width * 0.11 or (bottom - top) < height * 0.29:
        raise ValueError("Foreground mask too small or fragmented")
    if top > height * 0.62:
        raise ValueError("No plausible upper-body silhouette")
    return coverage, bbox


def convert_portrait(source: bytes, session) -> bytes:
    from rembg import remove

    image = Image.open(io.BytesIO(source))
    image = ImageOps.exif_transpose(image)
    if image.width < 90 or image.height < 90:
        raise ValueError("Official portrait resolution too small")
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    image = image.convert("RGBA")

    original_alpha = image.getchannel("A")
    alpha_range = original_alpha.getextrema()
    # Provider PNGs can already have true transparency; avoid erasing those.
    if alpha_range[0] > 220:
        result = remove(image, session=session).convert("RGBA")
    else:
        result = image

    coverage, _ = check_transparent_portrait(result)
    output = io.BytesIO()
    result.save(output, format="WEBP", quality=91, method=6)
    payload = output.getvalue()
    with Image.open(io.BytesIO(payload)) as check:
        if check.mode != "RGBA":
            raise ValueError("Output lost its alpha channel")
        new_coverage, _ = check_transparent_portrait(check)
        if abs(coverage - new_coverage) > 0.04:
            raise ValueError("Transparency damaged during compression")
    if len(payload) > 600_000:
        raise ValueError("Cutout asset is too large")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-url", default=DEFAULT_DIRECTORY)
    parser.add_argument("--source-file", help="Offline fixture JSON for checking input selection")
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args()

    if not 1 <= args.batch_size <= 100:
        parser.error("Batch size must be between 1 and 100")
    PORTRAITS.mkdir(parents=True, exist_ok=True)

    manifest = load_json(MANIFEST_PATH, {"version": 1, "players": {}, "failed": {}})
    manifest["version"] = 1
    existing = manifest.setdefault("players", {})
    failed = manifest.setdefault("failed", {})

    if args.source_file:
        raw_directory = json.loads(Path(args.source_file).read_text("utf-8"))
    else:
        raw_directory = json.loads(fetch_bytes(args.source_url))
    directory = player_list(raw_directory)
    now = utcnow()

    pending = []
    for player in directory:
        key = str(player["id"])
        image_path = PORTRAITS / f"{key}.webp"
        if key in existing and image_path.is_file():
            continue
        failure = failed.get(key)
        if failure and not args.retry_failed:
            try:
                last_failure = datetime.fromisoformat(failure["at"].replace("Z", "+00:00"))
                if now - last_failure < timedelta(days=RETRY_DAYS):
                    continue
            except (KeyError, ValueError, TypeError):
                pass
        pending.append(player)
        if len(pending) >= args.batch_size:
            break

    print(f"API-Football active players: {len(directory)}; previously accepted cutouts: {len(existing)}; selected this batch: {len(pending)}")
    if args.dry_run or not pending:
        for player in pending:
            print(f"  READY {player['id']} {player['name']} ({player['team']})")
        return

    # Load one reusable segmentation model per batch, never per player.
    from rembg import new_session
    session = new_session("isnet-general-use")
    processed = 0
    rejected = 0

    for player in pending:
        player_id = player["id"]
        key = str(player_id)
        image_path = PORTRAITS / f"{key}.webp"
        try:
            photo_url = f"https://media.api-sports.io/football/players/{player_id}.png"
            image = fetch_bytes(photo_url)
            if not image.startswith(b"\x89PNG\r\n\x1a\n"):
                raise UnidentifiedImageError("Provider did not return a PNG portrait")
            cutout = convert_portrait(image, session)
            temp = image_path.with_suffix(".webp.tmp")
            temp.write_bytes(cutout)
            temp.replace(image_path)
            existing[key] = {
                "name": player["name"],
                "team": player["team"],
                "sha256": hashlib.sha256(cutout).hexdigest()[:16],
            }
            failed.pop(key, None)
            processed += 1
            print(f"  OK  {player_id} {player['name']} ({len(cutout)} bytes)")
        except (ValueError, OSError, HTTPError, URLError, RuntimeError, UnidentifiedImageError) as error:
            failed[key] = {"at": now.isoformat(), "reason": type(error).__name__}
            rejected += 1
            print(f"  SKIP {player_id} {player['name']}: {type(error).__name__}: {str(error)[:150]}")

    manifest["players"] = dict(sorted(existing.items(), key=lambda pair: int(pair[0])))
    manifest["failed"] = dict(sorted(failed.items(), key=lambda pair: int(pair[0])))
    # Store only asset metadata and failure retry dates. No logins/ownership
    # information and no changes to cards, scores, wallets, minting or odds.
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"Batch completed: accepted {processed}, deferred {rejected}, total accepted {len(existing)}.")

    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(f"### Verified Premier League cutout portraits\n\n")
            handle.write(f"- Active API players: **{len(directory)}**\n")
            handle.write(f"- Accepted this batch: **{processed}**\n")
            handle.write(f"- Rejected/deferred: **{rejected}**\n")
            handle.write(f"- All accepted assets: **{len(existing)}**\n")
            handle.write("- Original API-Football photos and all gameplay records remain unchanged.\n")


if __name__ == "__main__":
    main()
